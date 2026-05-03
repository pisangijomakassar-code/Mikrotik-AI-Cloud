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

    def _get_tenant_id(self, cur, telegram_id: str) -> str | None:
        """Resolve telegramId → User.tenantId (multi-tenant)."""
        cur.execute(
            'SELECT "tenantId" FROM "User" WHERE "telegramId" = %s',
            (telegram_id,),
        )
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
        created_at: datetime | None = None,
    ) -> str | None:
        """Insert a VoucherBatch record after successful router creation.

        user_id is the Telegram ID (will be resolved to internal User.id).
        created_at: optional timestamp (defaults to now). For Mikhmon imports, pass the date from script.
        Returns the batch id, or None if DB not available.
        """
        if not self._pool:
            return None

        with self._conn() as conn:
            cur = conn.cursor()
            tenant_id = self._get_tenant_id(cur, user_id)
            if not tenant_id:
                logger.warning("VoucherDB.save_batch: user %s has no tenant", user_id)
                return None

            batch_id = _cuid_like()
            count = len(vouchers)
            total_cost = count * price_per_unit
            batch_timestamp = created_at or _now()

            cur.execute(
                """
                INSERT INTO "VoucherBatch"
                    ("id", "routerName", "profile", "count", "pricePerUnit",
                     "totalCost", "vouchers", "source", "createdAt",
                     "discount", "markUp", "hargaEndUser",
                     "resellerId", "tenantId")
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                """,
                (
                    batch_id, router_name, profile, count, price_per_unit,
                    total_cost, json.dumps(vouchers), source, batch_timestamp,
                    int(discount or 0), int(mark_up or 0), int(harga_end_user or 0),
                    reseller_id, tenant_id,
                ),
            )
            return batch_id

    def delete_mikhmon_batch(self, user_id: str, router_name: str, profile: str, source: str) -> int:
        """Delete existing Mikhmon import batch(es) matching (tenantId, routerName, profile, source).

        Called before save_batch for Mikhmon imports to prevent duplicate rows from hourly cron.
        """
        if not self._pool:
            return 0
        with self._conn() as conn:
            cur = conn.cursor()
            tenant_id = self._get_tenant_id(cur, user_id)
            if not tenant_id:
                return 0
            cur.execute(
                'DELETE FROM "VoucherBatch" WHERE "tenantId"=%s AND "routerName"=%s AND "profile"=%s AND "source"=%s',
                (tenant_id, router_name, profile, source),
            )
            return cur.rowcount

    # ── HotspotUserArchive ──

    def save_expired_users(
        self,
        telegram_id: str,
        router_name: str,
        users: list[dict],
        reason: str = "expired",
    ) -> int:
        """Save expired/archived hotspot users to HotspotUserArchive before deletion.

        users: list of MikroTik user dicts (raw from /ip/hotspot/user).
        Returns number of rows inserted (0 if DB unavailable).
        """
        if not self._pool or not users:
            return 0

        with self._conn() as conn:
            cur = conn.cursor()
            internal_uid = self._get_user_id(cur, telegram_id)
            if not internal_uid:
                logger.warning("save_expired_users: telegram_id %s not found in DB", telegram_id)
                return 0

            now = _now()
            count = 0
            for u in users:
                row_id = _cuid_like()
                cur.execute(
                    """
                    INSERT INTO "HotspotUserArchive"
                        ("id", "routerName", "username", "profile", "macAddress",
                         "server", "comment", "limitUptime", "limitBytesTotal",
                         "uptimeUsed", "bytesIn", "bytesOut", "reason", "archivedAt", "userId")
                    VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                    """,
                    (
                        row_id,
                        router_name,
                        u.get("name", ""),
                        u.get("profile", ""),
                        u.get("mac-address", ""),
                        u.get("server", ""),
                        u.get("comment", ""),
                        u.get("limit-uptime", ""),
                        u.get("limit-bytes-total", ""),
                        u.get("uptime", ""),
                        int(u.get("bytes-in", "0") or 0),
                        int(u.get("bytes-out", "0") or 0),
                        reason,
                        now,
                        internal_uid,
                    ),
                )
                count += 1
            return count

    def list_all_user_router_pairs(self) -> list[tuple[str, str]]:
        """Return all (telegram_id, router_name) pairs for active users with routers.

        Used by the expired cleanup cron to iterate over all routers.
        """
        if not self._pool:
            return []
        with self._conn() as conn:
            cur = conn.cursor()
            cur.execute(
                """
                SELECT u."telegramId", r."name"
                FROM "Router" r
                JOIN "User" u ON u."tenantId" = r."tenantId" AND u."role" = 'ADMIN'
                WHERE u."status" = 'ACTIVE'
                ORDER BY u."telegramId", r."name"
                """
            )
            return [(row[0], row[1]) for row in cur.fetchall()]

    # ── Reseller lookups ──

    def get_reseller_by_telegram(self, telegram_id: str) -> dict | None:
        """Lookup reseller by Telegram ID. Returns dict with id, name, balance, tenantId,
        discount, voucherGroup, routerId, routerName, ownerTelegramId.
        ONLY returns ACTIVE resellers — pakai get_reseller_status_by_telegram() utk cek status."""
        if not self._pool:
            return None

        with self._conn() as conn:
            cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
            cur.execute(
                """
                SELECT r."id", r."name", r."balance", r."phone", r."status",
                       r."discount", r."voucherGroup",
                       r."tenantId", u."telegramId" as "ownerTelegramId",
                       r."routerId", ro."name" as "routerName"
                FROM "Reseller" r
                LEFT JOIN "User" u ON u."tenantId" = r."tenantId" AND u."role" = 'ADMIN'
                LEFT JOIN "Router" ro ON ro."id" = r."routerId"
                WHERE r."telegramId" = %s AND r."status" = 'ACTIVE'
                LIMIT 1
                """,
                (telegram_id,),
            )
            row = cur.fetchone()
            return dict(row) if row else None

    def get_reseller_status_by_telegram(self, telegram_id: str) -> dict | None:
        """Lookup reseller by Telegram ID untuk semua status (PENDING/ACTIVE/INACTIVE/SUSPENDED).
        Returns minimal info: id, name, status, createdAt. Dipakai bot untuk pesan UX
        yg membedakan 'belum daftar' vs 'menunggu approval' vs 'di-suspend'."""
        if not self._pool:
            return None
        with self._conn() as conn:
            cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
            cur.execute(
                """
                SELECT r."id", r."name", r."status", r."createdAt",
                       u."telegramId" as "ownerTelegramId"
                FROM "Reseller" r
                LEFT JOIN "User" u ON u."tenantId" = r."tenantId" AND u."role" = 'ADMIN'
                WHERE r."telegramId" = %s
                ORDER BY r."createdAt" DESC
                LIMIT 1
                """,
                (telegram_id,),
            )
            row = cur.fetchone()
            return dict(row) if row else None

    # ── VoucherType lookups (for reseller bot pricing) ──

    def list_voucher_types_for_reseller(
        self, tenant_id: str, reseller_voucher_group: str
    ) -> list[dict]:
        """Return VoucherTypes owned by tenant, filtered by reseller's voucherGroup.

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
                WHERE "tenantId" = %s
                ORDER BY "harga" ASC, "namaVoucher" ASC
                """,
                (tenant_id,),
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
                       "voucherGroup", "tenantId"
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

    def add_saldo(
        self,
        reseller_id: str,
        amount: int,
        description: str = "",
    ) -> dict:
        """Atomic: ADD balance + create SaldoTransaction (TOP_UP).
        Returns the transaction record. Used by reseller_bot owner-approve flow.
        """
        if not self._pool:
            raise RuntimeError("VoucherDB not connected")
        if amount <= 0:
            raise ValueError("amount must be > 0")

        with self._conn() as conn:
            cur = conn.cursor()
            cur.execute('SELECT "balance" FROM "Reseller" WHERE "id" = %s FOR UPDATE', (reseller_id,))
            row = cur.fetchone()
            if not row:
                raise ValueError(f"Reseller {reseller_id} not found")
            balance_before = row[0]
            balance_after = balance_before + amount

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
                    tx_id, "TOP_UP", amount,
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
                JOIN "User" u ON u."tenantId" = vb."tenantId"
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
                JOIN "User" u ON u."tenantId" = r."tenantId" AND u."role" = 'ADMIN'
                WHERE r."id" = %s
                LIMIT 1
                """,
                (reseller_id,),
            )
            row = cur.fetchone()
            return row[0] if row else None

    # ── TrafficSnapshot ──

    def save_traffic_snapshot(
        self,
        telegram_id: str,
        router_name: str,
        interface_name: str,
        tx_bytes: int,
        rx_bytes: int,
    ) -> bool:
        """Persist one /interface counter snapshot. Returns True on success."""
        if not self._pool:
            return False
        with self._conn() as conn:
            cur = conn.cursor()
            tenant_id = self._get_tenant_id(cur, telegram_id)
            if not tenant_id:
                return False
            cur.execute(
                """
                INSERT INTO "TrafficSnapshot"
                  ("id", "routerName", "interfaceName", "txBytes", "rxBytes",
                   "takenAt", "tenantId")
                VALUES (%s, %s, %s, %s, %s, %s, %s)
                """,
                (
                    _cuid_like(), router_name, interface_name,
                    int(tx_bytes), int(rx_bytes), _now(), tenant_id,
                ),
            )
            return True

    def get_monthly_traffic(
        self,
        telegram_id: str,
        router_name: str,
        year: int | None = None,
        month: int | None = None,
        start: datetime | None = None,
        end: datetime | None = None,
    ) -> dict:
        """Sum delta tx/rx bytes per-interface untuk rentang waktu tertentu.

        Bisa dipanggil 2 mode:
          - year+month → seluruh bulan tsb (default kalau range tdk diisi)
          - start+end  → rentang custom (mis. 30 hari terakhir)

        Reboot detection: kalau current < previous, counter reset → skip delta
        (sample tsb jadi base baru saja).

        Returns: {"interfaces": [{name, txBytes, rxBytes}], "totalTx", "totalRx"}.
        """
        if not self._pool:
            return {"interfaces": [], "totalTx": 0, "totalRx": 0}

        if start is not None and end is not None:
            period_start, period_end = start, end
        else:
            if year is None or month is None:
                now = _now()
                year = year or now.year
                month = month or now.month
            period_start = datetime(year, month, 1, tzinfo=timezone.utc)
            if month == 12:
                period_end = datetime(year + 1, 1, 1, tzinfo=timezone.utc)
            else:
                period_end = datetime(year, month + 1, 1, tzinfo=timezone.utc)

        with self._conn() as conn:
            cur = conn.cursor()
            tenant_id = self._get_tenant_id(cur, telegram_id)
            if not tenant_id:
                return {"interfaces": [], "totalTx": 0, "totalRx": 0}

            cur.execute(
                """
                SELECT "interfaceName", "txBytes", "rxBytes", "takenAt"
                FROM "TrafficSnapshot"
                WHERE "tenantId" = %s AND "routerName" = %s
                  AND "takenAt" >= %s AND "takenAt" < %s
                ORDER BY "interfaceName", "takenAt"
                """,
                (tenant_id, router_name, period_start, period_end),
            )
            rows = cur.fetchall()

        per_iface: dict[str, dict] = {}
        prev_per_iface: dict[str, tuple[int, int]] = {}
        for iface, tx, rx, _taken in rows:
            tx, rx = int(tx), int(rx)
            entry = per_iface.setdefault(iface, {"name": iface, "txBytes": 0, "rxBytes": 0})
            prev = prev_per_iface.get(iface)
            if prev is not None:
                ptx, prx = prev
                # Reboot guard — counter only goes up. Skip if it dropped.
                if tx >= ptx:
                    entry["txBytes"] += tx - ptx
                if rx >= prx:
                    entry["rxBytes"] += rx - prx
            prev_per_iface[iface] = (tx, rx)

        ifaces = list(per_iface.values())
        total_tx = sum(i["txBytes"] for i in ifaces)
        total_rx = sum(i["rxBytes"] for i in ifaces)
        return {"interfaces": ifaces, "totalTx": total_tx, "totalRx": total_rx}

    def cleanup_old_snapshots(self, retention_months: int = 12) -> int:
        """Delete snapshots older than retention_months. Returns rows removed."""
        if not self._pool:
            return 0
        from datetime import timedelta
        cutoff = _now() - timedelta(days=retention_months * 31)
        with self._conn() as conn:
            cur = conn.cursor()
            cur.execute(
                'DELETE FROM "TrafficSnapshot" WHERE "takenAt" < %s',
                (cutoff,),
            )
            return cur.rowcount or 0
