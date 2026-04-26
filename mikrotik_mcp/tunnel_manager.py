"""
Tunnel Manager — manages cloudflared access tcp processes for Cloudflare tunnels.

Runs as a background service alongside health_server.py.
For each CONNECTED Cloudflare tunnel port in DB, spawns a cloudflared access tcp
process.  Monitors health and restarts crashed processes.
"""

import json
import logging
import os
import shutil
import subprocess
import threading
import time
from http.server import BaseHTTPRequestHandler, HTTPServer

import psycopg2
import psycopg2.pool

logger = logging.getLogger(__name__)

# Port range for local cloudflared access listeners (19000–19999)
LOCAL_PORT_BASE = 19000
LOCAL_PORT_RANGE = 1000
LOCAL_PORT_BLOCK = 5


def _stable_port(tunnel_db_id: str, service_name: str) -> int:
    """Return a stable local port in [LOCAL_PORT_BASE, LOCAL_PORT_BASE + LOCAL_PORT_RANGE)."""
    import hashlib

    raw = f"{tunnel_db_id}:{service_name}"
    digest = int(hashlib.sha256(raw.encode()).hexdigest(), 16)
    return LOCAL_PORT_BASE + (digest % LOCAL_PORT_RANGE)


class TunnelManager:
    def __init__(self, database_url: str):
        self._database_url = database_url
        self._pool = psycopg2.pool.ThreadedConnectionPool(
            minconn=1,
            maxconn=5,
            dsn=database_url,
        )
        # { (tunnelId, serviceName) → subprocess.Popen }
        self._processes: dict[tuple[str, str], subprocess.Popen] = {}
        self._lock = threading.Lock()
        logger.info("TunnelManager initialised (pool 1-5)")

    # ── DB helpers ────────────────────────────────────────────────────────────

    def _get_all_cloudflare_tunnel_ports(self) -> list[dict]:
        """
        Query all enabled TunnelPort records whose parent Tunnel uses CLOUDFLARE
        method and has a hostname set.
        """
        conn = self._pool.getconn()
        try:
            conn.autocommit = True
            with conn.cursor() as cur:
                cur.execute(
                    """
                    SELECT
                        tp.id,
                        tp."serviceName",
                        tp."remotePort",
                        tp."localPort",
                        tp."hostname",
                        tp."tunnelId",
                        t."cloudflareTunnelId"
                    FROM "TunnelPort" tp
                    JOIN "Tunnel" t ON t.id = tp."tunnelId"
                    WHERE t.method = 'CLOUDFLARE'
                      AND tp.enabled = true
                      AND tp."hostname" IS NOT NULL
                    """
                )
                rows = cur.fetchall()
            return [
                {
                    "id": r[0],
                    "serviceName": r[1],
                    "remotePort": r[2],
                    "localPort": r[3],
                    "hostname": r[4],
                    "tunnelId": r[5],
                    "cloudflareTunnelId": r[6],
                }
                for r in rows
            ]
        except Exception:
            logger.exception("Failed to query tunnel ports from DB")
            return []
        finally:
            self._pool.putconn(conn)

    def _allocate_local_port(self, tunnel_db_id: str, service_name: str) -> int:
        """
        Allocate a stable local port for (tunnel_db_id, service_name) and
        persist it to TunnelPort.localPort.  Returns the port number.
        """
        port = _stable_port(tunnel_db_id, service_name)
        conn = self._pool.getconn()
        try:
            conn.autocommit = False
            with conn.cursor() as cur:
                cur.execute(
                    """
                    UPDATE "TunnelPort"
                    SET "localPort" = %s
                    WHERE "tunnelId" = %s AND "serviceName" = %s
                    """,
                    (port, tunnel_db_id, service_name),
                )
            conn.commit()
        except Exception:
            conn.rollback()
            logger.exception(
                "Failed to persist localPort %d for tunnel %s / %s",
                port,
                tunnel_db_id,
                service_name,
            )
        finally:
            self._pool.putconn(conn)
        return port

    # ── Process management ────────────────────────────────────────────────────

    def _start_process(self, hostname: str, local_port: int) -> subprocess.Popen:
        """Start a cloudflared access tcp process."""
        return subprocess.Popen(
            [
                "cloudflared",
                "access",
                "tcp",
                "--hostname",
                hostname,
                "--listener",
                f"127.0.0.1:{local_port}",
            ],
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
        )

    def _stop_process(self, key: tuple[str, str]) -> None:
        """Terminate and remove a process by key."""
        proc = self._processes.pop(key, None)
        if proc is None:
            return
        try:
            proc.terminate()
            proc.wait(timeout=5)
        except Exception:
            try:
                proc.kill()
            except Exception:
                pass
        logger.info("Stopped cloudflared process for %s / %s", key[0], key[1])

    # ── Main loop ─────────────────────────────────────────────────────────────

    def _monitor_processes(self) -> None:
        """
        Sync DB state → running cloudflared processes every 30 seconds.
        - Start processes for ports not yet running.
        - Stop processes for ports removed or disabled in DB.
        - Restart processes that have died.
        """
        if not shutil.which("cloudflared"):
            logger.warning(
                "cloudflared binary not found — tunnel manager will not start any processes"
            )

        while True:
            try:
                self._sync()
            except Exception:
                logger.exception("Unexpected error in _monitor_processes")
            time.sleep(30)

    def _sync(self) -> None:
        ports = self._get_all_cloudflare_tunnel_ports()
        desired: dict[tuple[str, str], dict] = {
            (p["tunnelId"], p["serviceName"]): p for p in ports
        }

        with self._lock:
            # Stop processes no longer in DB
            stale_keys = [k for k in self._processes if k not in desired]
            for key in stale_keys:
                logger.info(
                    "Stopping stale process for tunnel %s / %s", key[0], key[1]
                )
                self._stop_process(key)

            # cloudflared binary check (skip starting if missing)
            has_cloudflared = bool(shutil.which("cloudflared"))

            for key, port_info in desired.items():
                tunnel_id = port_info["tunnelId"]
                service_name = port_info["serviceName"]
                hostname = port_info["hostname"]

                # Determine local port
                local_port = port_info.get("localPort")
                if not local_port:
                    local_port = self._allocate_local_port(tunnel_id, service_name)

                existing_proc = self._processes.get(key)

                if existing_proc is not None:
                    # Check if still running
                    if existing_proc.poll() is None:
                        continue  # healthy, nothing to do
                    else:
                        logger.warning(
                            "Process for %s / %s died (rc=%s), restarting",
                            tunnel_id,
                            service_name,
                            existing_proc.returncode,
                        )
                        self._processes.pop(key)

                if not has_cloudflared:
                    logger.warning(
                        "Skipping start for %s / %s — cloudflared not found",
                        tunnel_id,
                        service_name,
                    )
                    continue

                logger.info(
                    "Starting cloudflared access tcp: %s → 127.0.0.1:%d",
                    hostname,
                    local_port,
                )
                try:
                    proc = self._start_process(hostname, local_port)
                    self._processes[key] = proc
                except Exception:
                    logger.exception(
                        "Failed to start cloudflared for %s / %s", tunnel_id, service_name
                    )

    # ── HTTP health server ────────────────────────────────────────────────────

    def _run_http_server(self) -> None:
        manager = self

        class Handler(BaseHTTPRequestHandler):
            def log_message(self, fmt, *args):  # silence access logs
                pass

            def do_GET(self):
                if self.path == "/health":
                    with manager._lock:
                        count = len(manager._processes)
                    body = json.dumps({"status": "ok", "processes": count}).encode()
                    self.send_response(200)
                    self.send_header("Content-Type", "application/json")
                    self.end_headers()
                    self.wfile.write(body)
                else:
                    self.send_response(404)
                    self.end_headers()

        server = HTTPServer(("127.0.0.1", 8081), Handler)
        logger.info("Tunnel manager health server listening on 127.0.0.1:8081")
        server.serve_forever()

    def run(self) -> None:
        """Start the monitoring loop in a daemon thread, then start HTTP health server."""
        t = threading.Thread(target=self._monitor_processes, daemon=True)
        t.start()
        self._run_http_server()


if __name__ == "__main__":
    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s %(levelname)s %(name)s: %(message)s",
    )
    database_url = os.environ.get("DATABASE_URL")
    if not database_url:
        logger.error("DATABASE_URL not set, tunnel manager disabled")
        # Don't crash — just sleep so entrypoint doesn't fail
        while True:
            time.sleep(60)
    manager = TunnelManager(database_url)
    manager.run()
