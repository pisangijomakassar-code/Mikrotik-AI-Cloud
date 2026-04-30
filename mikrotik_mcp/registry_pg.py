"""
RouterRegistryPG -- PostgreSQL-backed per-user MikroTik router credential store.

Drop-in replacement for RouterRegistry (JSON-based).  Uses psycopg2 to talk
directly to the same PostgreSQL database that the Next.js dashboard manages
via Prisma.  Tables: "User", "Router" (quoted -- Prisma keeps PascalCase).

Thread-safe: each public method acquires its own connection from the pool,
does its work, then returns the connection.
"""

import logging
import os
from contextlib import contextmanager
from copy import deepcopy
from datetime import datetime, timezone

import psycopg2
import psycopg2.pool
import psycopg2.extras

try:
    from mikrotik_mcp.crypto import CredentialStore
except ModuleNotFoundError:
    from crypto import CredentialStore

logger = logging.getLogger(__name__)


def _now() -> datetime:
    return datetime.now(timezone.utc)


def _cuid_like() -> str:
    """Generate a cuid-like unique id (25 chars, alphanumeric)."""
    import hashlib
    import time
    import random

    raw = f"{time.time_ns()}-{random.randint(0, 2**64)}"
    h = hashlib.sha256(raw.encode()).hexdigest()
    return "c" + h[:24]


class RouterRegistryPG:
    """Manages per-user router registrations stored in PostgreSQL."""

    def __init__(self, database_url: str):
        self.database_url = database_url
        self._pool = psycopg2.pool.ThreadedConnectionPool(
            minconn=1,
            maxconn=10,
            dsn=database_url,
        )
        # Use a fixed key path consistent with the JSON registry
        data_dir = os.environ.get("DATA_DIR", "/app/data")
        self.crypto = CredentialStore(key_path=os.path.join(data_dir, ".master_key"))
        logger.info("PostgreSQL registry initialised (pool 1-10)")

    # ── connection helper ────────────────────────────────────

    @contextmanager
    def _conn(self):
        """Checkout a connection, auto-commit, return on exit."""
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

    # ── internal helpers ─────────────────────────────────────

    def _get_user_id(self, cur, telegram_id: str) -> str | None:
        """Look up internal User.id by telegramId.  Returns None if absent."""
        cur.execute(
            'SELECT id FROM "User" WHERE "telegramId" = %s',
            (str(telegram_id),),
        )
        row = cur.fetchone()
        return row[0] if row else None

    def _require_user(self, cur, telegram_id: str) -> str:
        """Like _get_user_id but raises ValueError when missing."""
        uid = self._get_user_id(cur, telegram_id)
        if uid is None:
            raise ValueError(f"User with telegramId '{telegram_id}' not found.")
        return uid

    def _get_router(self, cur, internal_user_id: str, name: str) -> dict | None:
        """Fetch a single Router row as dict, or None."""
        cur.execute(
            """
            SELECT id, name, host, port, username, "passwordEnc",
                   label, "routerosVersion", board, "isDefault",
                   "addedAt", "lastSeen"
            FROM "Router"
            WHERE "userId" = %s AND name = %s
            """,
            (internal_user_id, name),
        )
        row = cur.fetchone()
        if row is None:
            return None
        return {
            "id": row[0],
            "name": row[1],
            "host": row[2],
            "port": row[3],
            "username": row[4],
            "passwordEnc": row[5],
            "label": row[6],
            "routeros_version": row[7],
            "board": row[8],
            "is_default": row[9],
            "added_at": row[10].isoformat() + "Z" if row[10] else None,
            "last_seen": row[11].isoformat() + "Z" if row[11] else None,
        }

    def _all_routers(self, cur, internal_user_id: str) -> list[dict]:
        """Fetch all Router rows for a user, including tunnel info."""
        cur.execute(
            """
            SELECT
                r.id,
                r.name,
                r.host,
                r.port,
                r.username,
                r."passwordEnc",
                r.label,
                r."routerosVersion",
                r.board,
                r."isDefault",
                r."addedAt",
                r."lastSeen",
                r."connectionMethod"  as connection_method,
                t.method              as tunnel_method,
                t.status              as tunnel_status,
                t."vpnAssignedIp"     as tunnel_vpn_ip,
                tp."localPort"        as tunnel_api_local_port
            FROM "Router" r
            LEFT JOIN "Tunnel" t   ON t."routerId" = r.id
            LEFT JOIN "TunnelPort" tp
                   ON tp."tunnelId" = t.id
                  AND tp."serviceName" = 'api'
                  AND tp.enabled = true
            WHERE r."userId" = %s
            ORDER BY r."isDefault" DESC, r."addedAt" ASC
            """,
            (internal_user_id,),
        )
        rows = cur.fetchall()
        result = []
        for row in rows:
            result.append(
                {
                    "id": row[0],
                    "name": row[1],
                    "host": row[2],
                    "port": row[3],
                    "username": row[4],
                    "passwordEnc": row[5],
                    "label": row[6],
                    "routeros_version": row[7],
                    "board": row[8],
                    "is_default": row[9],
                    "added_at": row[10].isoformat() + "Z" if row[10] else None,
                    "last_seen": row[11].isoformat() + "Z" if row[11] else None,
                    "connection_method": row[12],
                    "tunnel_method": row[13],
                    "tunnel_status": row[14],
                    "tunnel_vpn_ip": row[15],
                    "tunnel_api_local_port": row[16],
                }
            )
        return result

    def _router_to_public(self, r: dict) -> dict:
        """Strip internal fields, return public dict WITHOUT password."""
        return {
            "name": r["name"],
            "host": r["host"],
            "port": r["port"],
            "username": r["username"],
            "label": r["label"],
            "routeros_version": r["routeros_version"],
            "board": r["board"],
            "is_default": r["is_default"],
            "added_at": r["added_at"],
            "last_seen": r["last_seen"],
        }

    def _router_to_connection(self, r: dict) -> dict:
        """Return dict with decrypted password, ready for connection."""
        host = r["host"]
        port = r["port"]

        # Tunnel-based routing
        connection_method = r.get("connection_method", "DIRECT")
        if connection_method == "TUNNEL":
            tunnel_method = r.get("tunnel_method")
            if tunnel_method == "CLOUDFLARE":
                local_port = r.get("tunnel_api_local_port")
                if local_port:
                    host = "127.0.0.1"
                    port = local_port
                else:
                    logger.warning(
                        "Router %s has CLOUDFLARE tunnel but no localPort assigned yet",
                        r.get("name"),
                    )
            elif tunnel_method in ("SSTP", "OVPN", "WIREGUARD"):
                # Untuk VPN-based tunnels, router dapat IP dari VPN server
                # (vpnAssignedIp). Dari VPS, router reachable di vpn_ip:8728.
                vpn_ip = r.get("tunnel_vpn_ip")
                if vpn_ip:
                    host = vpn_ip
                    port = 8728
                else:
                    logger.warning(
                        "Router %s has %s tunnel but no vpnAssignedIp yet",
                        r.get("name"), tunnel_method,
                    )

        return {
            "name": r["name"],
            "host": host,
            "port": port,
            "username": r["username"],
            "password": self.crypto.decrypt(r["passwordEnc"]),
            "label": r["label"],
            "routeros_version": r["routeros_version"],
            "board": r["board"],
            "is_default": r["is_default"],
            "added_at": r["added_at"],
            "last_seen": r["last_seen"],
        }

    # ── public API (same signatures as RouterRegistry) ───────

    def has_routers(self, user_id: str) -> bool:
        """Check if user has any registered routers."""
        with self._conn() as conn:
            cur = conn.cursor()
            uid = self._get_user_id(cur, user_id)
            if uid is None:
                return False
            cur.execute(
                'SELECT COUNT(*) FROM "Router" WHERE "userId" = %s',
                (uid,),
            )
            return cur.fetchone()[0] > 0

    def list_routers(self, user_id: str) -> list[dict]:
        """List all routers for user (WITHOUT passwords).  Include default marker."""
        with self._conn() as conn:
            cur = conn.cursor()
            uid = self._get_user_id(cur, user_id)
            if uid is None:
                return []
            routers = self._all_routers(cur, uid)
            return [self._router_to_public(r) for r in routers]

    def add_router(
        self,
        user_id: str,
        name: str,
        host: str,
        port: int,
        username: str,
        password: str,
        label: str = "",
        routeros_version: str = "",
        board: str = "",
    ) -> dict:
        """Add a router.  Return status dict or error if name already exists."""
        with self._conn() as conn:
            cur = conn.cursor()
            uid = self._require_user(cur, user_id)

            # Check for duplicate
            existing = self._get_router(cur, uid, name)
            if existing is not None:
                return {"error": f"Router '{name}' already exists for this user."}

            # Check if this is the first router (will become default)
            cur.execute(
                'SELECT COUNT(*) FROM "Router" WHERE "userId" = %s',
                (uid,),
            )
            is_first = cur.fetchone()[0] == 0

            now = _now()
            router_id = _cuid_like()
            enc_password = self.crypto.encrypt(password)

            cur.execute(
                """
                INSERT INTO "Router"
                    (id, name, host, port, username, "passwordEnc",
                     label, "routerosVersion", board, "isDefault",
                     "addedAt", "lastSeen", "userId")
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                """,
                (
                    router_id, name, host, port, username, enc_password,
                    label, routeros_version, board, is_first,
                    now, now, uid,
                ),
            )
            logger.info("User %s added router '%s' (%s:%s)", user_id, name, host, port)
            return {"status": "ok", "message": f"Router '{name}' registered."}

    def remove_router(self, user_id: str, name: str) -> dict:
        """Remove router by name.  Adjust default if needed."""
        with self._conn() as conn:
            cur = conn.cursor()
            uid = self._require_user(cur, user_id)

            router = self._get_router(cur, uid, name)
            if router is None:
                return {"error": f"Router '{name}' not found."}

            was_default = router["is_default"]

            cur.execute(
                'DELETE FROM "Router" WHERE id = %s',
                (router["id"],),
            )

            # If it was the default, promote the oldest remaining router
            if was_default:
                cur.execute(
                    """
                    UPDATE "Router"
                    SET "isDefault" = true
                    WHERE id = (
                        SELECT id FROM "Router"
                        WHERE "userId" = %s
                        ORDER BY "addedAt"
                        LIMIT 1
                    )
                    """,
                    (uid,),
                )

            logger.info("User %s removed router '%s'", user_id, name)
            return {"status": "ok", "message": f"Router '{name}' removed."}

    def get_router(self, user_id: str, name: str) -> dict:
        """Get full router details (WITH decrypted password) for connection."""
        with self._conn() as conn:
            cur = conn.cursor()
            uid = self._require_user(cur, user_id)

            router = self._get_router(cur, uid, name)
            if router is None:
                return {"error": f"Router '{name}' not found."}

            return self._router_to_connection(router)

    def set_default(self, user_id: str, name: str) -> dict:
        """Set default router for this user."""
        with self._conn() as conn:
            cur = conn.cursor()
            uid = self._require_user(cur, user_id)

            router = self._get_router(cur, uid, name)
            if router is None:
                return {"error": f"Router '{name}' not found."}

            # Clear all defaults for this user, then set the chosen one
            cur.execute(
                'UPDATE "Router" SET "isDefault" = false WHERE "userId" = %s',
                (uid,),
            )
            cur.execute(
                'UPDATE "Router" SET "isDefault" = true WHERE id = %s',
                (router["id"],),
            )

            return {"status": "ok", "message": f"Default router set to '{name}'."}

    def get_default_name(self, user_id: str) -> str | None:
        """Get the name of the default router, or None."""
        with self._conn() as conn:
            cur = conn.cursor()
            uid = self._get_user_id(cur, user_id)
            if uid is None:
                return None

            cur.execute(
                """
                SELECT name FROM "Router"
                WHERE "userId" = %s AND "isDefault" = true
                LIMIT 1
                """,
                (uid,),
            )
            row = cur.fetchone()
            return row[0] if row else None

    def resolve(self, user_id: str, router_name: str | None = None) -> dict | list[dict]:
        """Resolve router name to connection details.

        - None   -> use default router
        - "all"  -> return list of ALL routers with credentials
        - name   -> return that specific router

        Raises ValueError if not found or user has no routers.
        """
        with self._conn() as conn:
            cur = conn.cursor()
            uid = self._require_user(cur, user_id)

            routers = self._all_routers(cur, uid)
            if not routers:
                raise ValueError("You have no registered routers. Use /addrouter first.")

            # Return all routers
            if router_name and router_name.lower() == "all":
                return [self._router_to_connection(r) for r in routers]

            # Determine which router to use
            target = router_name
            if target is None:
                # Find default
                defaults = [r for r in routers if r["is_default"]]
                if not defaults:
                    raise ValueError(
                        "No default router set. Specify a router name or set a default."
                    )
                return self._router_to_connection(defaults[0])

            # Find by name
            matches = [r for r in routers if r["name"] == target]
            if not matches:
                available = ", ".join(r["name"] for r in routers)
                raise ValueError(
                    f"Router '{target}' not found. Available: {available}"
                )

            return self._router_to_connection(matches[0])

    def update_last_seen(
        self,
        user_id: str,
        name: str,
        routeros_version: str = "",
        board: str = "",
    ):
        """Update last_seen timestamp and optionally version/board."""
        with self._conn() as conn:
            cur = conn.cursor()
            uid = self._get_user_id(cur, user_id)
            if uid is None:
                return  # silently skip

            updates = ['"lastSeen" = %s']
            params: list = [_now()]

            if routeros_version:
                updates.append('"routerosVersion" = %s')
                params.append(routeros_version)
            if board:
                updates.append('"board" = %s')
                params.append(board)

            params.extend([uid, name])

            cur.execute(
                f"""
                UPDATE "Router"
                SET {", ".join(updates)}
                WHERE "userId" = %s AND name = %s
                """,
                params,
            )
