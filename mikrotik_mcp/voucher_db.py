"""
VoucherDB -- PostgreSQL-backed voucher batch and reseller saldo operations.

Uses psycopg2 directly (same pattern as registry_pg.py) to talk to the
Prisma-managed database.  Tables use PascalCase quoted identifiers.
"""

import json
import logging
import os
from contextlib import contextmanager
from datetime import datetime, timezone

import psycopg2
import psycopg2.pool
import psycopg2.extras

logger = logging.getLogger(__name__)


def _now() -> datetime:
    return datetime.now(timezone.utc)


def _cuid_like() -> str:
    import hashlib, time, random
    raw = f"{time.time_ns()}-{random.randint(0, 2**64)}"
    return "c" + hashlib.sha256(raw.encode()).hexdigest()[:24]


class VoucherDB:
    """Direct psycopg2 access to Reseller/VoucherBatch/SaldoTransaction tables."""

    def __init__(self, database_url: str | None = None):
        dsn = database_url or os.environ.get("DATABASE_URL", "")
        if not dsn:
            logger.warning("VoucherDB: no DATABASE_URL, voucher persistence disabled")
            self._pool = None
            return
        self._pool = psycopg2.pool.ThreadedConnectionPool(minconn=1, maxconn=5, dsn=dsn)
        logger.info("VoucherDB initialised (pool 1-5)")

    @contextmanager
    def _conn(self):
        if not self._pool:
            raise RuntimeError("VoucherDB not connected (no DATABASE_URL)")
        conn = self._pool.getconn()
        try:
            conn.autocommit = False
            yield conn
            conn.commit()
        except Exception:
            conn.rollback()
            raise
        finally:
            self._pool.putconn(conn)

    # ── User lookup ──

    def _get_user_id(self, cur, telegram_id: str) -> str | None:
        cur.execute('SELECT "id" FROM "User" WHERE "telegramId" = %s', (telegram_id,))
        row = cur.fetchone()
        return row[0] if row else None

    # ── VoucherBatch ──

    def save_batch(
        self,
        user_id: str,
        router_name: str,
        profile: str,
        vouchers: list[dict],
        source: str = "nanobot",
        reseller_id: str | None = None,
        price_per_unit: int = 0,
        discount: int = 0,
        mark_up: int = 0,
        harga_end_user: int = 0,
    ) -> str | None:
        """Insert a VoucherBatch record after successful router creation.

        user_id is the Telegram ID (will be resolved to internal User.id).
        Returns the batch id, or None if DB not available.
        """
        if not self._pool:
            return None

        with self._conn() as conn:
            cur = conn.cursor()
            internal_uid = self._get_user_id(cur, user_id)
            if not internal_uid:
                logger.warning("VoucherDB.save_batch: user %s not found", user_id)
                return None

            batch_id = _cuid_like()
            count = len(vouchers)
            total_cost = count * price_per_unit

            cur.execute(
                """
                INSERT INTO "VoucherBatch"
                    ("id", "routerName", "profile", "count", "pricePerUnit",
                     "totalCost", "vouchers", "source", "createdAt",
                     "discount", "markUp", "hargaEndUser",
                     "resellerId", "userId")
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                """,
                (
                    batch_id, router_name, profile, count, price_per_unit,
                    total_cost, json.dumps(vouchers), source, _now(),
                    int(discount or 0), int(mark_up or 0), int(harga_end_user or 0),
                    reseller_id, internal_uid,
                ),
            )
            return batch_id

    # ── Reseller lookups ──

    def get_reseller_by_telegram(self, telegram_id: str) -> dict | None:
        """Lookup reseller by Telegram ID. Returns dict with id, name, balance, userId, discount, voucherGroup."""
        if not self._pool:
            return None

        with self._conn() as conn:
            cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
            cur.execute(
                """
                SELECT r."id", r."name", r."balance", r."phone", r."status",
                       r."discount", r."voucherGroup",
                       r."userId", u."telegramId" as "ownerTelegramId"
                FROM "Reseller" r
                JOIN "User" u ON u."id" = r."userId"
                WHERE r."telegramId" = %s AND r."status" = 'ACTIVE'
                """,
                (telegram_id,),
            )
            row = cur.fetchone()
            return dict(row) if row else None

    # ── VoucherType lookups (for reseller bot pricing) ──

    def list_voucher_types_for_reseller(
        self, owner_user_id_internal: str, reseller_voucher_group: str
    ) -> list[dict]:
        """Return VoucherTypes owned by user, filtered by reseller's voucherGroup.

        VoucherType.voucherGroup and Reseller.voucherGroup are both comma-separated
        strings (e.g. "default,1,2"). A VoucherType is visible if any of its groups
        matches any of the reseller's groups, OR if its group is "default".
        """
        if not self._pool:
            return []

        reseller_groups = [g.strip() for g in (reseller_voucher_group or "default").split(",") if g.strip()]
        if not reseller_groups:
            reseller_groups = ["default"]

        with self._conn() as conn:
            cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
            cur.execute(
                """
                SELECT "id", "namaVoucher", "deskripsi", "harga", "markUp",
                       "server", "profile", "limitUptime",
                       "limitQuotaDl", "limitQuotaUl", "limitQuotaTotal",
                       "typeChar", "typeLogin", "prefix", "panjangKarakter",
                       "voucherGroup"
                FROM "VoucherType"
                WHERE "userId" = %s
                ORDER BY "harga" ASC, "namaVoucher" ASC
                """,
                (owner_user_id_internal,),
            )
            rows = cur.fetchall()

        result = []
        for row in rows:
            d = dict(row)
            vt_groups = [g.strip() for g in (d.get("voucherGroup") or "default").split(",") if g.strip()]
            # Visible if any group matches, OR voucher type is in "default" group
            if "default" in vt_groups or any(g in reseller_groups for g in vt_groups):
                result.append(d)
        return result

    def get_voucher_type_by_id(self, voucher_type_id: str) -> dict | None:
        """Fetch single VoucherType by id."""
        if not self._pool:
            return None
        with self._conn() as conn:
            cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
            cur.execute(
                """
                SELECT "id", "namaVoucher", "deskripsi", "harga", "markUp",
                       "server", "profile", "limitUptime",
                       "limitQuotaDl", "limitQuotaUl", "limitQuotaTotal",
                       "typeChar", "typeLogin", "prefix", "panjangKarakter",
                       "voucherGroup", "userId"
                FROM "VoucherType"
                WHERE "id" = %s
                """,
                (voucher_type_id,),
            )
            row = cur.fetchone()
            return dict(row) if row else None

    def check_saldo(self, reseller_id: str) -> int | None:
        """Return current balance for a reseller."""
        if not self._pool:
            return None

        with self._conn() as conn:
            cur = conn.cursor()
            cur.execute('SELECT "balance" FROM "Reseller" WHERE "id" = %s', (reseller_id,))
            row = cur.fetchone()
            return row[0] if row else None

    def deduct_saldo(
        self,
        reseller_id: str,
        amount: int,
        description: str = "",
    ) -> dict:
        """Atomic: deduct balance + create SaldoTransaction.

        Raises ValueError if insufficient balance.
        Returns the transaction record.
        """
        if not self._pool:
            raise RuntimeError("VoucherDB not connected")

        with self._conn() as conn:
            cur = conn.cursor()

            # Lock the reseller row
            cur.execute(
                'SELECT "balance" FROM "Reseller" WHERE "id" = %s FOR UPDATE',
                (reseller_id,),
            )
            row = cur.fetchone()
            if not row:
                raise ValueError(f"Reseller {reseller_id} not found")

            balance_before = row[0]
            if balance_before < amount:
                raise ValueError(
                    f"Saldo tidak mencukupi (saldo: {balance_before}, butuh: {amount})"
                )

            balance_after = balance_before - amount

            cur.execute(
                'UPDATE "Reseller" SET "balance" = %s, "updatedAt" = %s WHERE "id" = %s',
                (balance_after, _now(), reseller_id),
            )

            tx_id = _cuid_like()
            cur.execute(
                """
                INSERT INTO "SaldoTransaction"
                    ("id", "type", "amount", "balanceBefore", "balanceAfter",
                     "description", "createdAt", "resellerId")
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
                """,
                (
                    tx_id, "VOUCHER_PURCHASE", amount,
                    balance_before, balance_after,
                    description, _now(), reseller_id,
                ),
            )

            return {
                "id": tx_id,
                "balanceBefore": balance_before,
                "balanceAfter": balance_after,
                "amount": amount,
            }

    def get_transactions(self, reseller_id: str, limit: int = 10) -> list[dict]:
        """Get recent transactions for a reseller."""
        if not self._pool:
            return []

        with self._conn() as conn:
            cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
            cur.execute(
                """
                SELECT "id", "type", "amount", "balanceBefore", "balanceAfter",
                       "description", "createdAt"
                FROM "SaldoTransaction"
                WHERE "resellerId" = %s
                ORDER BY "createdAt" DESC
                LIMIT %s
                """,
                (reseller_id, limit),
            )
            rows = cur.fetchall()
            result = []
            for row in rows:
                d = dict(row)
                if isinstance(d.get("createdAt"), datetime):
                    d["createdAt"] = d["createdAt"].isoformat()
                result.append(d)
            return result

    def get_voucher_batches(self, telegram_id: str, limit: int = 5) -> list[dict]:
        """Return recent VoucherBatch records for a user (by telegram_id)."""
        if not self._pool:
            return []

        with self._conn() as conn:
            cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
            cur.execute(
                """
                SELECT vb."id", vb."routerName", vb."profile", vb."count",
                       vb."pricePerUnit", vb."vouchers", vb."source", vb."createdAt"
                FROM "VoucherBatch" vb
                JOIN "User" u ON u."id" = vb."userId"
                WHERE u."telegramId" = %s
                ORDER BY vb."createdAt" DESC
                LIMIT %s
                """,
                (telegram_id, limit),
            )
            rows = cur.fetchall()
            result = []
            for row in rows:
                d = dict(row)
                if isinstance(d.get("createdAt"), datetime):
                    d["createdAt"] = d["createdAt"].strftime("%d-%m-%Y %H:%M:%S")
                result.append(d)
            return result

    def get_owner_telegram_id(self, reseller_id: str) -> str | None:
        """Get the owner (User) telegram ID for a reseller. Used to send deposit notifications."""
        if not self._pool:
            return None

        with self._conn() as conn:
            cur = conn.cursor()
            cur.execute(
                """
                SELECT u."telegramId"
                FROM "Reseller" r
                JOIN "User" u ON u."id" = r."userId"
                WHERE r."id" = %s
                """,
                (reseller_id,),
            )
            row = cur.fetchone()
            return row[0] if row else None
