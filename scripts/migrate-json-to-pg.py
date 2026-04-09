#!/usr/bin/env python3
"""
One-time migration: JSON file registry -> PostgreSQL.

Reads all data/*.json files produced by the JSON-based RouterRegistry and
inserts them into the PostgreSQL database used by the dashboard + PG registry.

Usage:
    DATABASE_URL=postgresql://user:pass@host:5432/dbname python scripts/migrate-json-to-pg.py

Idempotent: skips users / routers that already exist.
"""

import hashlib
import json
import os
import random
import sys
import time
from datetime import datetime, timezone
from pathlib import Path

import psycopg2


def _cuid_like() -> str:
    raw = f"{time.time_ns()}-{random.randint(0, 2**64)}"
    h = hashlib.sha256(raw.encode()).hexdigest()
    return "c" + h[:24]


def _parse_iso(s: str | None) -> datetime | None:
    if not s:
        return None
    try:
        s = s.rstrip("Z")
        return datetime.fromisoformat(s).replace(tzinfo=timezone.utc)
    except Exception:
        return None


def main():
    database_url = os.environ.get("DATABASE_URL")
    if not database_url:
        print("ERROR: DATABASE_URL environment variable is required.", file=sys.stderr)
        sys.exit(1)

    data_dir = os.environ.get("DATA_DIR", "/app/data")
    json_files = sorted(Path(data_dir).glob("*.json"))

    if not json_files:
        print(f"No JSON files found in {data_dir}.")
        sys.exit(0)

    conn = psycopg2.connect(database_url)
    conn.autocommit = False
    cur = conn.cursor()

    stats = {
        "users_created": 0,
        "users_skipped": 0,
        "routers_created": 0,
        "routers_skipped": 0,
        "errors": 0,
    }

    for json_file in json_files:
        telegram_id = json_file.stem
        # Skip non-numeric filenames and hidden files
        if not telegram_id.isdigit():
            continue

        try:
            with open(json_file, "r", encoding="utf-8") as f:
                data = json.load(f)
        except (json.JSONDecodeError, OSError) as exc:
            print(f"  WARN: Cannot read {json_file}: {exc}")
            stats["errors"] += 1
            continue

        print(f"\nProcessing {json_file.name} (telegramId={telegram_id})...")

        # --- Upsert User ---
        cur.execute(
            'SELECT id FROM "User" WHERE "telegramId" = %s',
            (telegram_id,),
        )
        row = cur.fetchone()

        if row:
            internal_user_id = row[0]
            print(f"  User already exists (id={internal_user_id}), skipping creation.")
            stats["users_skipped"] += 1
        else:
            internal_user_id = _cuid_like()
            now = datetime.now(timezone.utc)
            cur.execute(
                """
                INSERT INTO "User"
                    (id, name, "telegramId", role, status, "isProvisioned",
                     "createdAt", "updatedAt")
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
                """,
                (
                    internal_user_id,
                    f"User {telegram_id}",
                    telegram_id,
                    "USER",
                    "ACTIVE",
                    True,
                    now,
                    now,
                ),
            )
            print(f"  Created User (id={internal_user_id}).")
            stats["users_created"] += 1

        # --- Insert Routers ---
        default_name = data.get("default_router")
        routers = data.get("routers", {})

        for router_name, info in routers.items():
            # Check if router already exists
            cur.execute(
                'SELECT id FROM "Router" WHERE "userId" = %s AND name = %s',
                (internal_user_id, router_name),
            )
            if cur.fetchone():
                print(f"  Router '{router_name}' already exists, skipping.")
                stats["routers_skipped"] += 1
                continue

            # Extract encrypted password
            pwd = info.get("password", "")
            if isinstance(pwd, dict) and pwd.get("encrypted"):
                password_enc = pwd["value"]
            elif isinstance(pwd, str):
                # Plain text -- store as-is (will need re-encryption or
                # the CredentialStore should handle it on first access)
                print(f"  WARN: Router '{router_name}' has plain-text password; storing as-is.")
                password_enc = pwd
            else:
                password_enc = ""

            is_default = router_name == default_name
            added_at = _parse_iso(info.get("added_at")) or datetime.now(timezone.utc)
            last_seen = _parse_iso(info.get("last_seen"))

            router_id = _cuid_like()
            cur.execute(
                """
                INSERT INTO "Router"
                    (id, name, host, port, username, "passwordEnc",
                     label, "routerosVersion", board, "isDefault",
                     "addedAt", "lastSeen", "userId")
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                """,
                (
                    router_id,
                    router_name,
                    info.get("host", ""),
                    info.get("port", 8728),
                    info.get("username", "admin"),
                    password_enc,
                    info.get("label", ""),
                    info.get("routeros_version", ""),
                    info.get("board", ""),
                    is_default,
                    added_at,
                    last_seen,
                    internal_user_id,
                ),
            )
            print(f"  Migrated router '{router_name}' (default={is_default}).")
            stats["routers_created"] += 1

    conn.commit()
    cur.close()
    conn.close()

    print("\n--- Migration Summary ---")
    print(f"  Users created:   {stats['users_created']}")
    print(f"  Users skipped:   {stats['users_skipped']}")
    print(f"  Routers created: {stats['routers_created']}")
    print(f"  Routers skipped: {stats['routers_skipped']}")
    print(f"  Errors:          {stats['errors']}")
    print("Done.")


if __name__ == "__main__":
    main()
