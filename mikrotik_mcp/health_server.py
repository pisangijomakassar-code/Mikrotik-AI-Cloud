"""
HTTP API server that runs alongside the MCP server inside the agent container.
Provides router data to the dashboard (health, traffic, logs, interfaces).
Runs on port 8080.
"""

import json
import os
import random
import shutil
import string
import subprocess
import sys
import threading
import time
from http.server import HTTPServer, BaseHTTPRequestHandler
from urllib.parse import urlparse, parse_qs

sys.path.insert(0, os.path.dirname(__file__))

try:
    from mikrotik_mcp.voucher_db import VoucherDB as _VoucherDB
except ModuleNotFoundError:
    from voucher_db import VoucherDB as _VoucherDB

_voucher_db = None


def _get_voucher_db():
    global _voucher_db
    if _voucher_db is None:
        db_url = os.environ.get("DATABASE_URL")
        if db_url:
            _voucher_db = _VoucherDB(db_url)
    return _voucher_db


# ── SoftEther VPN management (via docker exec into sstp-vpn container) ────────

_SOFTETHER_CONTAINER = "mikrotik-vpn"
_SOFTETHER_HUB = os.environ.get("SSTP_VPN_HUB", "DEFAULT")
_SOFTETHER_PORT = "5555"


def _vpncmd(*args):
    """
    Run a single vpncmd command non-interactively inside the SoftEther container.
    Uses `docker exec` to reach the vpncmd binary in the sstp-vpn container.
    Returns (returncode, combined_output_str).
    """
    password = os.environ.get("SSTP_ADMIN_PASSWORD", "")
    docker = shutil.which("docker")
    if not docker:
        return 1, "docker CLI not found — ensure /var/run/docker.sock is mounted"

    cmd = [
        docker, "exec", _SOFTETHER_CONTAINER,
        "/usr/vpnserver/vpncmd",
        f"/SERVER:localhost:{_SOFTETHER_PORT}",
        f"/PASSWORD:{password}",
        f"/HUB:{_SOFTETHER_HUB}",
        "/CMD",
        *args,
    ]
    try:
        result = subprocess.run(cmd, capture_output=True, text=True, timeout=15)
        return result.returncode, result.stdout + result.stderr
    except subprocess.TimeoutExpired:
        return 1, "vpncmd timed out"
    except Exception as e:
        return 1, str(e)


def _vpn_user_create(username, password):
    """Create a SoftEther VPN user and set its password. Returns (ok, error_msg)."""
    code, out = _vpncmd("UserCreate", username,
                         "/GROUP:none", "/REALNAME:None", "/NOTE:None")
    if code != 0 and "already exists" not in out.lower():
        return False, f"UserCreate failed: {out[:300]}"

    code, out = _vpncmd("UserPasswordSet", username, f"/PASSWORD:{password}")
    if code != 0:
        return False, f"UserPasswordSet failed: {out[:300]}"

    return True, ""


def _vpn_user_delete(username):
    """Delete a SoftEther VPN user. Returns (ok, error_msg)."""
    code, out = _vpncmd("UserDelete", username)
    # Treat "not found" as success (idempotent delete)
    if code != 0 and "not found" not in out.lower() and "does not exist" not in out.lower():
        return False, f"UserDelete failed: {out[:300]}"
    return True, ""


def _vpn_user_connected(username):
    """Check if a VPN user has an active session. Returns bool."""
    code, out = _vpncmd("SessionList")
    if code != 0:
        return False
    return username.lower() in out.lower()


# ─────────────────────────────────────────────────────────────────────────────


def _send_json(handler, data, status=200):
    handler.send_response(status)
    handler.send_header("Content-Type", "application/json")
    handler.send_header("Access-Control-Allow-Origin", "*")
    handler.send_header("Access-Control-Allow-Methods", "GET, POST, DELETE, OPTIONS")
    handler.send_header("Access-Control-Allow-Headers", "Content-Type, Authorization")
    handler.end_headers()
    handler.wfile.write(json.dumps(data).encode())


def _get_registry():
    from server import registry
    return registry


def _connect(host, port, username, password):
    from server import connect_router
    return connect_router(host, port, username, password)


class HealthHandler(BaseHTTPRequestHandler):

    # ── OPTIONS (CORS preflight) ─────────────────────────────────────
    def do_OPTIONS(self):
        self.send_response(200)
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, DELETE, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type, Authorization")
        self.end_headers()

    # ── GET ───────────────────────────────────────────────────────────
    def do_GET(self):
        parsed = urlparse(self.path)
        path = parsed.path
        params = parse_qs(parsed.query)

        # Basic health check
        if path == "/health":
            _send_json(self, {"status": "ok"})
            return

        # Router health (CPU, memory, clients, uptime)
        if path.startswith("/router-health/"):
            self._handle_router_health(path.split("/router-health/")[1])
            return

        # Interface traffic stats (for Network Throughput chart)
        if path.startswith("/router-traffic/"):
            self._handle_router_traffic(path.split("/router-traffic/")[1])
            return

        # Router system logs (real-time, no LLM)
        if path.startswith("/router-logs/"):
            parts = path.split("/router-logs/")[1].split("/")
            user_id = parts[0]
            router_name = parts[1] if len(parts) > 1 else None
            count = int(params.get("count", ["50"])[0])
            self._handle_router_logs(user_id, router_name, count)
            return

        # Full router detail (for edit forms)
        if path.startswith("/router-detail/"):
            parts = path.split("/router-detail/")[1].split("/")
            user_id = parts[0]
            router_name = parts[1] if len(parts) > 1 else None
            self._handle_router_detail(user_id, router_name)
            return

        # Hotspot users
        if path.startswith("/hotspot-users/"):
            user_id = path.split("/hotspot-users/")[1]
            router_name = params.get("router", [None])[0]
            self._handle_hotspot_users(user_id, router_name)
            return

        # Hotspot active sessions
        if path.startswith("/hotspot-active/"):
            user_id = path.split("/hotspot-active/")[1]
            router_name = params.get("router", [None])[0]
            self._handle_hotspot_active(user_id, router_name)
            return

        # Hotspot profiles (list)
        if path.startswith("/hotspot-profiles/"):
            remainder = path.split("/hotspot-profiles/")[1].strip("/")
            parts = remainder.split("/")
            router_name = params.get("router", [None])[0]
            if len(parts) == 1:
                # GET /hotspot-profiles/{user_id}
                self._handle_hotspot_profiles(parts[0], router_name)
            elif len(parts) == 2:
                # GET /hotspot-profiles/{user_id}/{name}
                self._handle_hotspot_profile_get(parts[0], parts[1], router_name)
            return

        # Hotspot servers list
        if path.startswith("/hotspot-servers/"):
            user_id = path.split("/hotspot-servers/")[1]
            router_name = params.get("router", [None])[0]
            self._handle_hotspot_servers(user_id, router_name)
            return

        # Hotspot stats (aggregated counts)
        if path.startswith("/hotspot-stats/"):
            user_id = path.split("/hotspot-stats/")[1]
            router_name = params.get("router", [None])[0]
            self._handle_hotspot_stats(user_id, router_name)
            return

        # IP pools (used as hotspot address-pool)
        if path.startswith("/ip-pools/"):
            user_id = path.split("/ip-pools/")[1]
            router_name = params.get("router", [None])[0]
            self._handle_ip_pools(user_id, router_name)
            return

        # Simple queues (used as parent-queue in hotspot profile)
        if path.startswith("/queues/"):
            user_id = path.split("/queues/")[1]
            router_name = params.get("router", [None])[0]
            self._handle_queues(user_id, router_name)
            return

        # Mikhmon scripts preview (list scripts from MikroTik in Mikhmon format)
        if path.startswith("/mikhmon-scripts/"):
            user_id = path.split("/mikhmon-scripts/")[1].strip("/")
            router_name = params.get("router", [None])[0]
            if user_id:
                self._handle_mikhmon_scripts_list(user_id, router_name)
                return

        # PPP secrets
        if path.startswith("/ppp-secrets/"):
            user_id = path.split("/ppp-secrets/")[1]
            router_name = params.get("router", [None])[0]
            self._handle_ppp_secrets(user_id, router_name)
            return

        # PPP active sessions
        if path.startswith("/ppp-active/"):
            user_id = path.split("/ppp-active/")[1]
            router_name = params.get("router", [None])[0]
            self._handle_ppp_active(user_id, router_name)
            return

        # PPP profiles
        if path.startswith("/ppp-profiles/"):
            user_id = path.split("/ppp-profiles/")[1]
            router_name = params.get("router", [None])[0]
            self._handle_ppp_profiles(user_id, router_name)
            return

        # VPN user session status (SSTP tunnel health)
        if path == "/vpn-user/status":
            username = params.get("username", [None])[0]
            if not username:
                _send_json(self, {"error": "username required"}, 400)
                return
            connected = _vpn_user_connected(username)
            _send_json(self, {"connected": connected, "username": username})
            return

        self.send_response(404)
        self.end_headers()

    # ── POST ──────────────────────────────────────────────────────────
    def do_POST(self):
        parsed = urlparse(self.path)
        path = parsed.path

        if path == "/v1/chat/completions":
            self._handle_chat_completions()
            return

        # Encrypt a router password (called by Next.js dashboard before saving to DB)
        if path == "/encrypt-password":
            try:
                length = int(self.headers.get("Content-Length", 0))
                body = json.loads(self.rfile.read(length))
                plaintext = body.get("password", "")
                if not plaintext:
                    _send_json(self, {"error": "password required"}, 400)
                    return
                from server import registry
                encrypted = registry.crypto.encrypt(plaintext)
                _send_json(self, {"encrypted": encrypted})
            except Exception as e:
                _send_json(self, {"error": str(e)}, 500)
            return

        # Add hotspot user
        if path.startswith("/hotspot-user/"):
            remainder = path.split("/hotspot-user/")[1]
            parts = remainder.strip("/").split("/")
            if len(parts) == 1:
                # POST /hotspot-user/{user_id} — create user
                self._handle_hotspot_user_add(parts[0])
                return
            elif len(parts) == 3 and parts[2] in ("enable", "disable"):
                # POST /hotspot-user/{user_id}/{name}/enable|disable
                self._handle_hotspot_user_toggle(parts[0], parts[1], parts[2])
                return

        # Hotspot profile CRUD
        if path.startswith("/hotspot-profile/"):
            remainder = path.split("/hotspot-profile/")[1].strip("/")
            parts = remainder.split("/")
            if len(parts) == 1:
                # POST /hotspot-profile/{user_id} — add
                self._handle_hotspot_profile_add(parts[0])
                return
            elif len(parts) == 2:
                # POST /hotspot-profile/{user_id}/{name} — update
                self._handle_hotspot_profile_update(parts[0], parts[1])
                return

        # Generate vouchers
        if path.startswith("/generate-vouchers/"):
            user_id = path.split("/generate-vouchers/")[1].strip("/")
            self._handle_generate_vouchers(user_id)
            return

        # Add PPP secret
        if path.startswith("/ppp-secret/"):
            remainder = path.split("/ppp-secret/")[1].strip("/")
            parts = remainder.split("/")
            if len(parts) == 1:
                self._handle_ppp_secret_add(parts[0])
                return

        # Kick PPP session
        if path.startswith("/ppp-active/"):
            remainder = path.split("/ppp-active/")[1].strip("/")
            parts = remainder.split("/")
            if len(parts) == 3 and parts[2] == "kick":
                # POST /ppp-active/{user_id}/{id}/kick
                self._handle_ppp_kick(parts[0], parts[1])
                return

        # VPN user management (SSTP tunnel — create or delete SoftEther user)
        if path == "/vpn-user":
            self._handle_vpn_user()
            return

        if path == "/wg-peer":
            self._handle_wg_peer(None)
            return

        if path == "/ovpn-user":
            self._handle_ovpn_user(None)
            return

        # AI insight
        if path.startswith("/ai-insight/"):
            user_id = path.split("/ai-insight/")[1].strip("/")
            self._handle_ai_insight(user_id)
            return

        # Send telegram message
        if path.startswith("/send-telegram/"):
            user_id = path.split("/send-telegram/")[1].strip("/")
            self._handle_send_telegram(user_id)
            return

        # Hotspot cleanup (remove disabled or expired users)
        if path.startswith("/hotspot-cleanup/"):
            remainder = path.split("/hotspot-cleanup/")[1].strip("/")
            parts = remainder.split("/")
            if len(parts) == 2:
                user_id, cleanup_type = parts[0], parts[1]
                self._handle_hotspot_cleanup(user_id, cleanup_type)
                return

        # Mikhmon script import
        if path.startswith("/mikhmon-import/"):
            user_id = path.split("/mikhmon-import/")[1].strip("/")
            if user_id:
                self._handle_mikhmon_import(user_id)
                return

        self.send_response(404)
        self.end_headers()

    # ── DELETE ────────────────────────────────────────────────────────
    def do_DELETE(self):
        parsed = urlparse(self.path)
        path = parsed.path

        # DELETE /hotspot-user/{user_id}/{name}
        if path.startswith("/hotspot-user/"):
            remainder = path.split("/hotspot-user/")[1].strip("/")
            parts = remainder.split("/")
            if len(parts) == 2:
                self._handle_hotspot_user_delete(parts[0], parts[1])
                return

        # DELETE /hotspot-profile/{user_id}/{name}
        if path.startswith("/hotspot-profile/"):
            remainder = path.split("/hotspot-profile/")[1].strip("/")
            parts = remainder.split("/")
            if len(parts) == 2:
                self._handle_hotspot_profile_delete(parts[0], parts[1])
                return

        # DELETE /ppp-secret/{user_id}/{name}
        if path.startswith("/ppp-secret/"):
            remainder = path.split("/ppp-secret/")[1].strip("/")
            parts = remainder.split("/")
            if len(parts) == 2:
                self._handle_ppp_secret_delete(parts[0], parts[1])
                return

        self.send_response(404)
        self.end_headers()

    # ══════════════════════════════════════════════════════════════════
    #  Existing handlers
    # ══════════════════════════════════════════════════════════════════

    def _handle_router_health(self, user_id):
        try:
            registry = _get_registry()
            all_routers = registry.resolve(user_id, "all")
            results = []
            for r in all_routers:
                status = {"name": r.get("name", ""), "status": "offline"}
                try:
                    with _connect(r["host"], r["port"], r["username"], r["password"]) as api:
                        res = list(api.path("/system/resource"))
                        if res:
                            total = int(res[0].get("total-memory", 0))
                            free = int(res[0].get("free-memory", 0))
                            mem_pct = round((total - free) / total * 100) if total else 0
                            total_mb = round(total / 1024 / 1024)
                            free_mb = round(free / 1024 / 1024)
                            status.update({
                                "status": "online",
                                "cpuLoad": res[0].get("cpu-load", 0),
                                "memoryPercent": mem_pct,
                                "memoryTotalMB": total_mb,
                                "memoryFreeMB": free_mb,
                                "uptime": res[0].get("uptime", ""),
                                "version": res[0].get("version", ""),
                                "board": res[0].get("board-name", ""),
                            })
                        leases = list(api.path("/ip/dhcp-server/lease"))
                        status["activeClients"] = len([l for l in leases if l.get("status") == "bound"])
                except Exception as e:
                    status["error"] = str(e)
                results.append(status)
            _send_json(self, results)
        except Exception as e:
            _send_json(self, {"error": str(e)}, 500)

    def _handle_router_traffic(self, user_id):
        """Get interface traffic stats for Network Throughput display."""
        try:
            registry = _get_registry()
            conn = registry.resolve(user_id, None)  # default router
            with _connect(conn["host"], conn["port"], conn["username"], conn["password"]) as api:
                interfaces = list(api.path("/interface"))
                result = {
                    "router": conn.get("name", ""),
                    "interfaces": []
                }
                for iface in interfaces:
                    if iface.get("running") == True or iface.get("running") == "true":
                        result["interfaces"].append({
                            "name": iface.get("name", ""),
                            "type": iface.get("type", ""),
                            "txBytes": int(iface.get("tx-byte", 0)),
                            "rxBytes": int(iface.get("rx-byte", 0)),
                            "txPackets": int(iface.get("tx-packet", 0)),
                            "rxPackets": int(iface.get("rx-packet", 0)),
                            "running": True,
                        })
            _send_json(self, result)
        except Exception as e:
            _send_json(self, {"error": str(e)}, 500)

    def _handle_router_logs(self, user_id, router_name=None, count=50):
        """Get recent system logs from router (direct, no LLM)."""
        try:
            registry = _get_registry()
            conn = registry.resolve(user_id, router_name)
            with _connect(conn["host"], conn["port"], conn["username"], conn["password"]) as api:
                logs = list(api.path("/log"))
                recent = logs[-count:] if len(logs) > count else logs
                result = {
                    "router": conn.get("name", ""),
                    "total": len(logs),
                    "logs": [
                        {
                            "time": entry.get("time", ""),
                            "topics": entry.get("topics", ""),
                            "message": entry.get("message", ""),
                        }
                        for entry in recent
                    ]
                }
            _send_json(self, result)
        except Exception as e:
            _send_json(self, {"error": str(e)}, 500)

    def _handle_router_detail(self, user_id, router_name=None):
        """Get full router detail including system info, identity, and interfaces."""
        try:
            registry = _get_registry()
            conn = registry.resolve(user_id, router_name)
            with _connect(conn["host"], conn["port"], conn["username"], conn["password"]) as api:
                resource = list(api.path("/system/resource"))
                identity = list(api.path("/system/identity"))
                interfaces = list(api.path("/interface"))

                r = resource[0] if resource else {}
                total_mem = int(r.get("total-memory", 0))
                free_mem = int(r.get("free-memory", 0))

                result = {
                    "router": conn.get("name", ""),
                    "host": conn.get("host", ""),
                    "port": conn.get("port", 0),
                    "identity": identity[0].get("name", "") if identity else "",
                    "board": r.get("board-name", ""),
                    "version": r.get("version", ""),
                    "architecture": r.get("architecture-name", ""),
                    "cpu": r.get("cpu", ""),
                    "cpuLoad": r.get("cpu-load", 0),
                    "cpuCount": r.get("cpu-count", 1),
                    "memoryTotal": total_mem,
                    "memoryFree": free_mem,
                    "memoryPercent": round((total_mem - free_mem) / total_mem * 100) if total_mem else 0,
                    "uptime": r.get("uptime", ""),
                    "interfaces": [
                        {
                            "name": i.get("name", ""),
                            "type": i.get("type", ""),
                            "mac": i.get("mac-address", ""),
                            "running": i.get("running", False),
                            "disabled": i.get("disabled", False),
                            "txBytes": int(i.get("tx-byte", 0)),
                            "rxBytes": int(i.get("rx-byte", 0)),
                        }
                        for i in interfaces
                    ]
                }
            _send_json(self, result)
        except Exception as e:
            _send_json(self, {"error": str(e)}, 500)

    # ══════════════════════════════════════════════════════════════════
    #  Hotspot handlers
    # ══════════════════════════════════════════════════════════════════

    def _handle_hotspot_users(self, user_id, router_name=None):
        """List all hotspot users."""
        try:
            registry = _get_registry()
            conn = registry.resolve(user_id, router_name)
            with _connect(conn["host"], conn["port"], conn["username"], conn["password"]) as api:
                users = list(api.path("ip", "hotspot", "user"))
                result = {
                    "router": conn.get("name", ""),
                    "users": [
                        {
                            "name": u.get("name", ""),
                            "password": u.get("password", ""),
                            "profile": u.get("profile", ""),
                            "server": u.get("server", ""),
                            "macAddress": u.get("mac-address", ""),
                            "address": u.get("address", ""),
                            "limitUptime": u.get("limit-uptime", ""),
                            "limitBytesTotal": u.get("limit-bytes-total", ""),
                            "disabled": u.get("disabled", "false"),
                            "comment": u.get("comment", ""),
                        }
                        for u in users
                    ]
                }
            _send_json(self, result)
        except Exception as e:
            _send_json(self, {"error": str(e)}, 500)

    def _handle_hotspot_active(self, user_id, router_name=None):
        """List active hotspot sessions."""
        try:
            registry = _get_registry()
            conn = registry.resolve(user_id, router_name)
            with _connect(conn["host"], conn["port"], conn["username"], conn["password"]) as api:
                sessions = list(api.path("ip", "hotspot", "active"))
                result = {
                    "router": conn.get("name", ""),
                    "sessions": [
                        {
                            "user": s.get("user", ""),
                            "address": s.get("address", ""),
                            "macAddress": s.get("mac-address", ""),
                            "uptime": s.get("uptime", ""),
                            "server": s.get("server", ""),
                            "bytesIn": int(s.get("bytes-in", 0)),
                            "bytesOut": int(s.get("bytes-out", 0)),
                        }
                        for s in sessions
                    ]
                }
            _send_json(self, result)
        except Exception as e:
            _send_json(self, {"error": str(e)}, 500)

    def _handle_hotspot_profiles(self, user_id, router_name=None):
        """List hotspot user profiles."""
        import concurrent.futures

        try:
            registry = _get_registry()
            conn = registry.resolve(user_id, router_name)

            def _fetch_profiles():
                with _connect(conn["host"], conn["port"], conn["username"], conn["password"]) as api:
                    # Try dedicated profile path with strict timeout via thread
                    def _try_profile_path():
                        return list(api.path("ip", "hotspot", "user", "profile").select())

                    with concurrent.futures.ThreadPoolExecutor(max_workers=1) as ex:
                        fut = ex.submit(_try_profile_path)
                        try:
                            raw = fut.result(timeout=5)
                            profiles = [
                                {
                                    "name": p.get("name", ""),
                                    "rateLimit": p.get("rate-limit", ""),
                                    "sharedUsers": p.get("shared-users", ""),
                                    "sessionTimeout": p.get("session-timeout", ""),
                                    "addressPool": p.get("address-pool", ""),
                                    "expiredMode": p.get("expired-mode", ""),
                                    "macCookie": p.get("add-mac-cookie", "false"),
                                    "parentQueue": p.get("parent-queue", ""),
                                    "onLogin": p.get("on-login", ""),
                                }
                                for p in raw
                                if p.get("name", "") not in ("", "default")
                            ]
                        except Exception:
                            # Fallback: extract unique profile names from hotspot users
                            users = list(api.path("ip", "hotspot", "user").select())
                            seen: set = set()
                            profiles = []
                            for u in users:
                                pname = u.get("profile", "")
                                if pname and pname not in seen:
                                    seen.add(pname)
                                    profiles.append({"name": pname, "rateLimit": "",
                                                     "sharedUsers": "", "sessionTimeout": "",
                                                     "idleTimeout": "", "addressPool": "", "onLogin": ""})
                    return {"router": conn.get("name", ""), "profiles": profiles}

            with concurrent.futures.ThreadPoolExecutor(max_workers=1) as ex:
                fut = ex.submit(_fetch_profiles)
                try:
                    result = fut.result(timeout=8)
                except concurrent.futures.TimeoutError:
                    result = {"router": "", "profiles": []}

            _send_json(self, result)
        except Exception as e:
            _send_json(self, {"error": str(e)}, 500)

    def _handle_ip_pools(self, user_id, router_name=None):
        """List IP pools (used as hotspot address-pool)."""
        try:
            registry = _get_registry()
            conn = registry.resolve(user_id, router_name)
            with _connect(conn["host"], conn["port"], conn["username"], conn["password"]) as api:
                pools = list(api.path("ip", "pool"))
                result = {
                    "router": conn.get("name", ""),
                    "pools": [
                        {
                            "name": p.get("name", ""),
                            "ranges": p.get("ranges", ""),
                        }
                        for p in pools if p.get("name")
                    ],
                }
            _send_json(self, result)
        except Exception as e:
            _send_json(self, {"error": str(e)}, 500)

    def _handle_queues(self, user_id, router_name=None):
        """List simple queues (used as parent-queue in hotspot profile)."""
        try:
            registry = _get_registry()
            conn = registry.resolve(user_id, router_name)
            with _connect(conn["host"], conn["port"], conn["username"], conn["password"]) as api:
                queues = list(api.path("queue", "simple"))
                result = {
                    "router": conn.get("name", ""),
                    "queues": [
                        {"name": q.get("name", "")}
                        for q in queues if q.get("name")
                    ],
                }
            _send_json(self, result)
        except Exception as e:
            _send_json(self, {"error": str(e)}, 500)

    def _handle_hotspot_servers(self, user_id, router_name=None):
        """List configured hotspot servers (ip hotspot)."""
        try:
            registry = _get_registry()
            conn = registry.resolve(user_id, router_name)
            with _connect(conn["host"], conn["port"], conn["username"], conn["password"]) as api:
                servers = list(api.path("ip", "hotspot").select())
                result = {
                    "router": conn.get("name", ""),
                    "servers": [
                        {
                            "name": s.get("name", ""),
                            "interface": s.get("interface", ""),
                            "disabled": s.get("disabled", "false"),
                        }
                        for s in servers
                        if s.get("name")
                    ],
                }
            _send_json(self, result)
        except Exception as e:
            _send_json(self, {"error": str(e)}, 500)

    def _handle_hotspot_stats(self, user_id, router_name=None):
        """Get aggregated hotspot stats (user counts + active sessions)."""
        try:
            registry = _get_registry()
            conn = registry.resolve(user_id, router_name)
            with _connect(conn["host"], conn["port"], conn["username"], conn["password"]) as api:
                users = list(api.path("ip", "hotspot", "user"))
                active = list(api.path("ip", "hotspot", "active"))

                total = len(users)
                disabled_count = sum(
                    1 for u in users
                    if str(u.get("disabled", "false")).lower() == "true"
                )
                enabled_count = total - disabled_count

                result = {
                    "totalUsers": total,
                    "enabledUsers": enabled_count,
                    "disabledUsers": disabled_count,
                    "activeSessions": len(active),
                }
            _send_json(self, result)
        except Exception as e:
            _send_json(self, {"error": str(e)}, 500)

    def _handle_hotspot_user_add(self, user_id):
        """Add a new hotspot user on the router."""
        try:
            content_length = int(self.headers.get("Content-Length", 0))
            body = json.loads(self.rfile.read(content_length)) if content_length else {}

            username = body.get("username")
            password = body.get("password")
            profile = body.get("profile")
            if not username or not password or not profile:
                _send_json(self, {"error": "username, password, and profile are required"}, 400)
                return

            router_name = body.get("router")
            registry = _get_registry()
            conn = registry.resolve(user_id, router_name)

            add_params = {
                "name": username,
                "password": password,
                "profile": profile,
            }
            if body.get("server"):
                add_params["server"] = body["server"]
            if body.get("limitUptime"):
                add_params["limit-uptime"] = body["limitUptime"]
            if body.get("comment"):
                add_params["comment"] = body["comment"]

            with _connect(conn["host"], conn["port"], conn["username"], conn["password"]) as api:
                api.path("ip", "hotspot", "user").add(**add_params)

            _send_json(self, {"status": "ok"})
        except Exception as e:
            _send_json(self, {"error": str(e)}, 500)

    def _handle_hotspot_user_toggle(self, user_id, name, action):
        """Enable or disable a hotspot user."""
        try:
            registry = _get_registry()
            conn = registry.resolve(user_id, None)
            with _connect(conn["host"], conn["port"], conn["username"], conn["password"]) as api:
                resource = api.path("ip", "hotspot", "user")
                item_id = None
                for u in resource:
                    if u.get("name") == name:
                        item_id = u.get(".id")
                        break
                if not item_id:
                    _send_json(self, {"error": f"User '{name}' not found"}, 404)
                    return
                disabled_val = "false" if action == "enable" else "true"
                resource.update(**{".id": item_id, "disabled": disabled_val})
            _send_json(self, {"status": "ok"})
        except Exception as e:
            _send_json(self, {"error": str(e)}, 500)

    def _handle_hotspot_user_delete(self, user_id, name):
        """Remove a hotspot user by name."""
        try:
            registry = _get_registry()
            conn = registry.resolve(user_id, None)
            with _connect(conn["host"], conn["port"], conn["username"], conn["password"]) as api:
                resource = api.path("ip", "hotspot", "user")
                item_id = None
                for u in resource:
                    if u.get("name") == name:
                        item_id = u.get(".id")
                        break
                if not item_id:
                    _send_json(self, {"error": f"User '{name}' not found"}, 404)
                    return
                resource.remove(item_id)
            _send_json(self, {"status": "ok"})
        except Exception as e:
            _send_json(self, {"error": str(e)}, 500)

    # ══════════════════════════════════════════════════════════════════
    #  Voucher generation
    # ══════════════════════════════════════════════════════════════════

    def _handle_generate_vouchers(self, user_id):
        """Generate a batch of hotspot voucher users on the router and persist to DB."""
        try:
            content_length = int(self.headers.get("Content-Length", 0))
            body = json.loads(self.rfile.read(content_length)) if content_length else {}

            count = int(body.get("count", 1))
            profile = body.get("profile")
            if not profile:
                _send_json(self, {"error": "profile is required"}, 400)
                return

            prefix = body.get("prefix", "v")
            # Accept both camelCase and snake_case field names
            pwd_len = int(body.get("password_length") or body.get("passwordLength") or 6)
            usr_len = int(body.get("username_length") or body.get("usernameLength") or 6)
            server = body.get("server") or ""
            router_name = body.get("router_name") or body.get("router") or ""
            reseller_id = body.get("reseller_id") or body.get("resellerId")
            price_per_unit = int(body.get("price_per_unit") or body.get("pricePerUnit") or 0)
            discount = int(body.get("discount") or 0)
            mark_up = int(body.get("markUp") or body.get("mark_up") or 0)
            harga_end_user = price_per_unit  # form's "Harga End User" already mapped to price_per_unit
            limit_uptime = body.get("limitUptime") or body.get("limit_uptime") or ""
            limit_quota_mb = int(body.get("limitQuota") or body.get("limit_quota") or 0)
            comment_tmpl = body.get("comment") or ""
            type_login = body.get("typeLogin") or body.get("type_login") or "Username = Password"

            # Charset based on typeChar — no-ambiguous chars (no 0,O,1,l,I)
            _NO_AMB_LOWER = "abcdefghjkmnpqrstuvwxyz"
            _NO_AMB_UPPER = "ABCDEFGHJKMNPQRSTUVWXYZ"
            _NO_AMB_DIGIT = "23456789"
            type_char_raw = body.get("typeChar") or body.get("type_char") or "Random abcd2345"
            tc = type_char_raw.lower()
            has_lower = any(c.islower() for c in type_char_raw if c.isalpha())
            has_upper = any(c.isupper() for c in type_char_raw if c.isalpha())
            has_digit = any(c.isdigit() for c in type_char_raw)
            if "1234" in tc and not any(x in tc for x in ["abcd", "ab", "aB", "AB"]):
                charset = string.digits
            else:
                parts = ""
                if has_lower:
                    parts += _NO_AMB_LOWER
                if has_upper:
                    parts += _NO_AMB_UPPER
                if has_digit:
                    parts += _NO_AMB_DIGIT
                charset = parts if parts else _NO_AMB_LOWER + _NO_AMB_DIGIT

            registry = _get_registry()
            conn = registry.resolve(user_id, router_name or None)

            vouchers = []
            with _connect(conn["host"], conn["port"], conn["username"], conn["password"]) as api:
                resource = api.path("ip", "hotspot", "user")
                for _ in range(count):
                    uname = prefix + "".join(random.choices(charset, k=usr_len))
                    if type_login == "Username = Password":
                        pwd = uname
                    else:
                        pwd = "".join(random.choices(charset, k=pwd_len))

                    add_params = {
                        "name": uname,
                        "password": pwd,
                        "profile": profile,
                    }
                    if server:
                        add_params["server"] = server
                    if limit_uptime and limit_uptime != "0":
                        add_params["limit-uptime"] = limit_uptime
                    if limit_quota_mb and limit_quota_mb > 0:
                        add_params["limit-bytes-total"] = str(limit_quota_mb * 1048576)
                    if comment_tmpl:
                        add_params["comment"] = comment_tmpl

                    resource.add(**add_params)
                    vouchers.append({"username": uname, "password": pwd})

            # Persist batch to DB
            vdb = _get_voucher_db()
            if vdb:
                try:
                    vdb.save_batch(
                        user_id=user_id,
                        router_name=conn.get("name", ""),
                        profile=profile,
                        vouchers=vouchers,
                        source="dashboard",
                        reseller_id=reseller_id,
                        price_per_unit=price_per_unit,
                        discount=discount,
                        mark_up=mark_up,
                        harga_end_user=harga_end_user,
                    )
                    logger.info("VoucherBatch saved: %s vouchers, profile=%s, user=%s", len(vouchers), profile, user_id)
                except Exception as e:
                    logger.error("Failed to save VoucherBatch to DB: %s", e)
            else:
                logger.warning("VoucherDB not available — batch not persisted (DATABASE_URL missing?)")

            _send_json(self, {"status": "ok", "vouchers": vouchers, "count": len(vouchers)})
        except Exception as e:
            _send_json(self, {"error": str(e)}, 500)

    # ══════════════════════════════════════════════════════════════════
    #  PPP handlers
    # ══════════════════════════════════════════════════════════════════

    def _handle_ppp_secrets(self, user_id, router_name=None):
        """List PPP secrets (passwords stripped)."""
        try:
            registry = _get_registry()
            conn = registry.resolve(user_id, router_name)
            with _connect(conn["host"], conn["port"], conn["username"], conn["password"]) as api:
                secrets = list(api.path("ppp", "secret"))
                result = {
                    "router": conn.get("name", ""),
                    "secrets": [
                        {
                            "name": s.get("name", ""),
                            "service": s.get("service", ""),
                            "profile": s.get("profile", ""),
                            "localAddress": s.get("local-address", ""),
                            "remoteAddress": s.get("remote-address", ""),
                            "disabled": s.get("disabled", "false"),
                            "comment": s.get("comment", ""),
                        }
                        for s in secrets
                    ]
                }
            _send_json(self, result)
        except Exception as e:
            _send_json(self, {"error": str(e)}, 500)

    def _handle_ppp_active(self, user_id, router_name=None):
        """List active PPP sessions."""
        try:
            registry = _get_registry()
            conn = registry.resolve(user_id, router_name)
            with _connect(conn["host"], conn["port"], conn["username"], conn["password"]) as api:
                sessions = list(api.path("ppp", "active"))
                result = {
                    "router": conn.get("name", ""),
                    "sessions": [
                        {
                            "name": s.get("name", ""),
                            "service": s.get("service", ""),
                            "callerId": s.get("caller-id", ""),
                            "address": s.get("address", ""),
                            "uptime": s.get("uptime", ""),
                            "encoding": s.get("encoding", ""),
                        }
                        for s in sessions
                    ]
                }
            _send_json(self, result)
        except Exception as e:
            _send_json(self, {"error": str(e)}, 500)

    def _handle_ppp_profiles(self, user_id, router_name=None):
        """List PPP profiles."""
        try:
            registry = _get_registry()
            conn = registry.resolve(user_id, router_name)
            with _connect(conn["host"], conn["port"], conn["username"], conn["password"]) as api:
                profiles = list(api.path("ppp", "profile"))
                result = {
                    "router": conn.get("name", ""),
                    "profiles": [
                        {
                            "name": p.get("name", ""),
                            "localAddress": p.get("local-address", ""),
                            "remoteAddress": p.get("remote-address", ""),
                            "rateLimit": p.get("rate-limit", ""),
                        }
                        for p in profiles
                    ]
                }
            _send_json(self, result)
        except Exception as e:
            _send_json(self, {"error": str(e)}, 500)

    def _handle_ppp_secret_add(self, user_id):
        """Add a new PPP secret."""
        try:
            content_length = int(self.headers.get("Content-Length", 0))
            body = json.loads(self.rfile.read(content_length)) if content_length else {}

            name = body.get("name")
            password = body.get("password")
            if not name or not password:
                _send_json(self, {"error": "name and password are required"}, 400)
                return

            router_name = body.get("router")
            registry = _get_registry()
            conn = registry.resolve(user_id, router_name)

            add_params = {
                "name": name,
                "password": password,
            }
            if body.get("service"):
                add_params["service"] = body["service"]
            if body.get("profile"):
                add_params["profile"] = body["profile"]
            if body.get("localAddress"):
                add_params["local-address"] = body["localAddress"]
            if body.get("remoteAddress"):
                add_params["remote-address"] = body["remoteAddress"]
            if body.get("comment"):
                add_params["comment"] = body["comment"]

            with _connect(conn["host"], conn["port"], conn["username"], conn["password"]) as api:
                api.path("ppp", "secret").add(**add_params)

            _send_json(self, {"status": "ok"})
        except Exception as e:
            _send_json(self, {"error": str(e)}, 500)

    def _handle_ppp_secret_delete(self, user_id, name):
        """Remove a PPP secret by name."""
        try:
            registry = _get_registry()
            conn = registry.resolve(user_id, None)
            with _connect(conn["host"], conn["port"], conn["username"], conn["password"]) as api:
                resource = api.path("ppp", "secret")
                item_id = None
                for s in resource:
                    if s.get("name") == name:
                        item_id = s.get(".id")
                        break
                if not item_id:
                    _send_json(self, {"error": f"PPP secret '{name}' not found"}, 404)
                    return
                resource.remove(item_id)
            _send_json(self, {"status": "ok"})
        except Exception as e:
            _send_json(self, {"error": str(e)}, 500)

    def _handle_ppp_kick(self, user_id, session_name):
        """Kick (remove) an active PPP session by name."""
        try:
            registry = _get_registry()
            conn = registry.resolve(user_id, None)
            with _connect(conn["host"], conn["port"], conn["username"], conn["password"]) as api:
                resource = api.path("ppp", "active")
                item_id = None
                for s in resource:
                    if s.get("name") == session_name:
                        item_id = s.get(".id")
                        break
                if not item_id:
                    _send_json(self, {"error": f"PPP session '{session_name}' not found"}, 404)
                    return
                resource.remove(item_id)
            _send_json(self, {"status": "ok"})
        except Exception as e:
            _send_json(self, {"error": str(e)}, 500)

    # ══════════════════════════════════════════════════════════════════
    #  AI Insight
    # ══════════════════════════════════════════════════════════════════

    def _handle_ai_insight(self, user_id):
        """Gather router metrics and get AI analysis via OpenRouter."""
        import urllib.request
        import urllib.error

        try:
            content_length = int(self.headers.get("Content-Length", 0))
            body = json.loads(self.rfile.read(content_length)) if content_length else {}
            router_name = body.get("router")

            registry = _get_registry()
            conn = registry.resolve(user_id, router_name)

            # Gather metrics from router
            metrics_text = ""
            with _connect(conn["host"], conn["port"], conn["username"], conn["password"]) as api:
                # System resource
                res = list(api.path("system", "resource"))
                if res:
                    r = res[0]
                    total_mem = int(r.get("total-memory", 0))
                    free_mem = int(r.get("free-memory", 0))
                    mem_pct = round((total_mem - free_mem) / total_mem * 100) if total_mem else 0
                    metrics_text += (
                        f"Router: {conn.get('name', 'unknown')}\n"
                        f"Board: {r.get('board-name', '')}\n"
                        f"Version: {r.get('version', '')}\n"
                        f"CPU Load: {r.get('cpu-load', 0)}%\n"
                        f"Memory: {mem_pct}% used ({round(free_mem/1024/1024)}MB free / {round(total_mem/1024/1024)}MB total)\n"
                        f"Uptime: {r.get('uptime', '')}\n"
                    )

                # Interface traffic
                interfaces = list(api.path("interface"))
                running_ifaces = [i for i in interfaces if i.get("running") in (True, "true")]
                metrics_text += f"\nInterfaces ({len(running_ifaces)} running / {len(interfaces)} total):\n"
                for iface in running_ifaces[:10]:
                    tx = int(iface.get("tx-byte", 0))
                    rx = int(iface.get("rx-byte", 0))
                    metrics_text += f"  {iface.get('name', '')}: TX {_format_bytes(tx)}, RX {_format_bytes(rx)}\n"

                # Hotspot stats
                try:
                    hs_users = list(api.path("ip", "hotspot", "user"))
                    hs_active = list(api.path("ip", "hotspot", "active"))
                    metrics_text += f"\nHotspot: {len(hs_users)} users, {len(hs_active)} active sessions\n"
                except Exception:
                    metrics_text += "\nHotspot: not configured\n"

                # PPP stats
                try:
                    ppp_secrets = list(api.path("ppp", "secret"))
                    ppp_active = list(api.path("ppp", "active"))
                    metrics_text += f"PPP: {len(ppp_secrets)} secrets, {len(ppp_active)} active sessions\n"
                except Exception:
                    metrics_text += "PPP: not configured\n"

                # DHCP leases
                try:
                    leases = list(api.path("ip", "dhcp-server", "lease"))
                    bound = sum(1 for l in leases if l.get("status") == "bound")
                    metrics_text += f"DHCP: {bound} active leases / {len(leases)} total\n"
                except Exception:
                    pass

            # Call OpenRouter for AI analysis
            api_key = os.environ.get("OPENROUTER_API_KEY", "")
            model = os.environ.get("CHAT_MODEL", "openai/gpt-5.4-nano")

            if not api_key:
                _send_json(self, {"error": "OPENROUTER_API_KEY not configured"}, 500)
                return

            payload = json.dumps({
                "model": model,
                "messages": [
                    {
                        "role": "system",
                        "content": (
                            "You are a MikroTik network analyst. Analyze these metrics and provide: "
                            "1) Current status summary, 2) Performance concerns, "
                            "3) Predictions/recommendations. Be concise, use Indonesian."
                        ),
                    },
                    {
                        "role": "user",
                        "content": f"Analyze these router metrics:\n\n{metrics_text}",
                    },
                ],
                "max_tokens": 1024,
            }).encode()

            req = urllib.request.Request(
                "https://openrouter.ai/api/v1/chat/completions",
                data=payload,
                headers={
                    "Content-Type": "application/json",
                    "Authorization": f"Bearer {api_key}",
                    "X-Title": "MikroTik AI Agent Dashboard",
                },
            )

            with urllib.request.urlopen(req, timeout=30) as resp:
                result = json.loads(resp.read())
                insight = ""
                choices = result.get("choices", [])
                if choices:
                    insight = choices[0].get("message", {}).get("content", "")
                _send_json(self, {"insight": insight})

        except urllib.error.HTTPError as e:
            error_body = e.read().decode() if e.fp else str(e)
            _send_json(self, {"error": f"LLM error: {error_body[:200]}"}, 500)
        except Exception as e:
            _send_json(self, {"error": str(e)}, 500)

    # ══════════════════════════════════════════════════════════════════
    #  Mikhmon script import
    # ══════════════════════════════════════════════════════════════════

    def _fetch_mikhmon_scripts(self, registry, user_id, router_name):
        """Fetch system scripts from MikroTik and return only those in Mikhmon format."""
        conn = registry.resolve(user_id, router_name or None)
        if isinstance(conn, list):
            conn = next((c for c in conn if c.get("is_default")), conn[0] if conn else None)
        if not conn or "error" in conn:
            return None, conn or {"error": "No router found"}

        from server import connect_router
        with connect_router(conn["host"], conn["port"], conn["username"], conn["password"]) as api:
            resource = api.path("system", "script")
            scripts = list(resource)

        mikhmon_scripts = []
        for s in scripts:
            name = s.get("name", "")
            parsed = _parse_mikhmon_script_name(name)
            if parsed:
                mikhmon_scripts.append({
                    "id": s.get(".id", ""),
                    "name": name,
                    "owner": s.get("owner", ""),
                    **parsed,
                })
        return mikhmon_scripts, conn

    def _handle_mikhmon_scripts_list(self, user_id, router_name=None):
        """GET /mikhmon-scripts/{user_id} — list Mikhmon-format scripts for preview."""
        try:
            registry = _get_registry()
            scripts, conn_or_err = self._fetch_mikhmon_scripts(registry, user_id, router_name)
            if scripts is None:
                _send_json(self, conn_or_err, 400)
                return
            _send_json(self, {"scripts": scripts, "count": len(scripts), "router": conn_or_err.get("name", "")})
        except Exception as e:
            _send_json(self, {"error": str(e)}, 500)

    def _handle_mikhmon_import(self, user_id):
        """POST /mikhmon-import/{user_id} — import Mikhmon scripts to DB, then delete from MikroTik.

        Body (optional): {"router": "router_name", "deleteAfterImport": true, "month": "2025-10"}
        Returns: {"imported": N, "skipped": M, "deleted": K}
        """
        try:
            content_length = int(self.headers.get("Content-Length", 0))
            body = json.loads(self.rfile.read(content_length)) if content_length else {}
            router_name = body.get("router", "")
            delete_after = body.get("deleteAfterImport", True)
            filter_month = body.get("month", "")  # e.g. "2025-10", empty = all

            registry = _get_registry()
            scripts, conn_or_err = self._fetch_mikhmon_scripts(registry, user_id, router_name)
            if scripts is None:
                _send_json(self, conn_or_err, 400)
                return
            if not scripts:
                _send_json(self, {"imported": 0, "skipped": 0, "deleted": 0, "message": "No Mikhmon scripts found"})
                return

            vdb = _get_voucher_db()
            router_display = conn_or_err.get("name", router_name or "default")

            # Group scripts by date month and profile for batch saving
            from collections import defaultdict
            from datetime import datetime as dt, timezone as _tz
            import re

            _MONTHS = {"jan": 1, "feb": 2, "mar": 3, "apr": 4, "may": 5, "jun": 6,
                       "jul": 7, "aug": 8, "sep": 9, "oct": 10, "nov": 11, "dec": 12}

            def _parse_mikhmon_date_pre(date_str: str):
                if not date_str:
                    return None, None
                s = date_str.strip().lower()
                m = re.match(r"^([a-z]{3})/(\d{1,2})/(\d{4})$", s)
                if m and m.group(1) in _MONTHS:
                    mo, d, y = _MONTHS[m.group(1)], int(m.group(2)), int(m.group(3))
                    return dt(y, mo, d, tzinfo=_tz.utc), f"{y:04d}-{mo:02d}"
                m = re.match(r"^(\d{4})-(\d{1,2})-(\d{1,2})$", s)
                if m:
                    y, mo, d = int(m.group(1)), int(m.group(2)), int(m.group(3))
                    return dt(y, mo, d, tzinfo=_tz.utc), f"{y:04d}-{mo:02d}"
                m = re.match(r"^(\d{1,2})/(\d{1,2})/(\d{4})$", s)
                if m:
                    d, mo, y = int(m.group(1)), int(m.group(2)), int(m.group(3))
                    return dt(y, mo, d, tzinfo=_tz.utc), f"{y:04d}-{mo:02d}"
                return None, None

            # Filter by month if specified
            if filter_month:
                scripts = [s for s in scripts if _parse_mikhmon_date_pre(s.get("date", ""))[1] == filter_month]
                if not scripts:
                    _send_json(self, {"imported": 0, "skipped": 0, "deleted": 0, "message": f"No scripts found for month {filter_month}"})
                    return

            # Group scripts by date month and profile for batch saving
            from collections import defaultdict
            from datetime import datetime as dt, timezone as _tz
            import re

            _MONTHS = {"jan": 1, "feb": 2, "mar": 3, "apr": 4, "may": 5, "jun": 6,
                       "jul": 7, "aug": 8, "sep": 9, "oct": 10, "nov": 11, "dec": 12}

            def _parse_mikhmon_date(date_str: str):
                """Parse Mikhmon date. Supports 'oct/01/2025', '2025-10-01', '01/10/2025'.
                Returns (datetime|None, 'YYYY-MM'|None)."""
                if not date_str:
                    return None, None
                s = date_str.strip().lower()
                # Try "mmm/dd/yyyy" (Mikhmon native)
                m = re.match(r"^([a-z]{3})/(\d{1,2})/(\d{4})$", s)
                if m and m.group(1) in _MONTHS:
                    mo, d, y = _MONTHS[m.group(1)], int(m.group(2)), int(m.group(3))
                    return dt(y, mo, d, tzinfo=_tz.utc), f"{y:04d}-{mo:02d}"
                # Try "YYYY-MM-DD"
                m = re.match(r"^(\d{4})-(\d{1,2})-(\d{1,2})$", s)
                if m:
                    y, mo, d = int(m.group(1)), int(m.group(2)), int(m.group(3))
                    return dt(y, mo, d, tzinfo=_tz.utc), f"{y:04d}-{mo:02d}"
                # Try "DD/MM/YYYY"
                m = re.match(r"^(\d{1,2})/(\d{1,2})/(\d{4})$", s)
                if m:
                    d, mo, y = int(m.group(1)), int(m.group(2)), int(m.group(3))
                    return dt(y, mo, d, tzinfo=_tz.utc), f"{y:04d}-{mo:02d}"
                return None, None

            # Group by (month_from_date, profile) for batch saving
            groups: dict[tuple[str, str], list[dict]] = defaultdict(list)
            for s in scripts:
                date_str = s.get("date", "unknown")
                _, month = _parse_mikhmon_date(date_str)
                if not month:
                    month = "unknown"
                profile = s.get("profile", "")
                groups[(month, profile)].append(s)

            imported = 0
            skipped = 0
            for (month, profile), group_scripts in groups.items():
                vouchers = []
                for s in group_scripts:
                    try:
                        price = int(re.sub(r"[^\d]", "", s.get("price", "0")) or 0)
                    except Exception:
                        price = 0
                    vouchers.append({
                        "username": s.get("username", ""),
                        "password": "",
                        "profile": profile,
                        "mac": s.get("mac", ""),
                        "ip": s.get("ip", ""),
                        "limitUptime": s.get("limitUptime", ""),
                        "date": s.get("date", ""),
                        "time": s.get("time", ""),
                        "price": price,
                        "batchRef": s.get("batchRef", ""),
                        "source": "mikhmon_import",
                    })

                if vdb and vouchers:
                    try:
                        # Use first voucher's price as price_per_unit (same profile = same price)
                        price_per = vouchers[0]["price"] if vouchers else 0

                        # Parse batch date: use earliest date in the group
                        batch_timestamp = None
                        parsed_dates = [_parse_mikhmon_date(g.get("date", ""))[0] for g in group_scripts]
                        parsed_dates = [d for d in parsed_dates if d is not None]
                        if parsed_dates:
                            batch_timestamp = min(parsed_dates)

                        vdb.save_batch(
                            user_id=user_id,
                            router_name=router_display,
                            profile=profile,
                            vouchers=vouchers,
                            source=f"mikhmon_import:{month}",
                            price_per_unit=price_per,
                            created_at=batch_timestamp,
                        )
                        imported += len(vouchers)
                    except Exception as db_err:
                        import logging
                        logging.getLogger(__name__).warning("Mikhmon import DB error: %s", db_err)
                        skipped += len(vouchers)
                else:
                    skipped += len(vouchers)

            # Delete scripts from MikroTik after successful import
            deleted = 0
            if delete_after and imported > 0:
                from server import connect_router
                conn = conn_or_err
                with connect_router(conn["host"], conn["port"], conn["username"], conn["password"]) as api:
                    resource = api.path("system", "script")
                    script_ids = [s["id"] for s in scripts if s.get("id")]
                    for sid in script_ids:
                        try:
                            resource.remove(sid)
                            deleted += 1
                        except Exception:
                            pass

            _send_json(self, {
                "imported": imported,
                "skipped": skipped,
                "deleted": deleted,
                "router": router_display,
            })
        except Exception as e:
            _send_json(self, {"error": str(e)}, 500)

    # ══════════════════════════════════════════════════════════════════
    #  Hotspot cleanup
    # ══════════════════════════════════════════════════════════════════

    def _handle_hotspot_cleanup(self, user_id, cleanup_type):
        """Remove disabled or expired hotspot users. cleanup_type: 'disabled' | 'expired'"""
        try:
            from server import remove_disabled_hotspot_users, remove_expired_hotspot_users
            content_length = int(self.headers.get("Content-Length", 0))
            body = json.loads(self.rfile.read(content_length)) if content_length else {}
            router = body.get("router", "")

            if cleanup_type == "disabled":
                result = remove_disabled_hotspot_users(user_id, router)
            elif cleanup_type == "expired":
                result = remove_expired_hotspot_users(user_id, router)
            else:
                _send_json(self, {"error": "cleanup_type must be 'disabled' or 'expired'"}, 400)
                return

            _send_json(self, result)
        except Exception as e:
            _send_json(self, {"error": str(e)}, 500)

    # ══════════════════════════════════════════════════════════════════
    #  Telegram messaging
    # ══════════════════════════════════════════════════════════════════

    def _handle_send_telegram(self, user_id):
        """Send a Telegram message (with optional photo) to one or more chat IDs.

        Supports two content-types:
        - application/json  → text-only (legacy)
        - multipart/form-data → text + optional photo file
        """
        import urllib.request
        import urllib.error
        import email.parser
        import io

        try:
            content_type = self.headers.get("Content-Type", "")
            content_length = int(self.headers.get("Content-Length", 0))
            raw = self.rfile.read(content_length) if content_length else b""

            photo_bytes = None
            photo_filename = "photo.jpg"

            if "multipart/form-data" in content_type:
                # Parse multipart manually
                boundary = None
                for part in content_type.split(";"):
                    part = part.strip()
                    if part.startswith("boundary="):
                        boundary = part[len("boundary="):].strip('"')
                        break

                if not boundary:
                    _send_json(self, {"error": "Missing multipart boundary"}, 400)
                    return

                # Use email parser to decode multipart
                msg_bytes = b"Content-Type: " + content_type.encode() + b"\r\n\r\n" + raw
                msg = email.parser.BytesParser().parsebytes(msg_bytes)
                fields: dict = {}
                for part in msg.get_payload():  # type: ignore[union-attr]
                    cd = part.get("Content-Disposition", "")
                    name = None
                    filename = None
                    for seg in cd.split(";"):
                        seg = seg.strip()
                        if seg.startswith('name='):
                            name = seg[5:].strip('"')
                        elif seg.startswith('filename='):
                            filename = seg[9:].strip('"')
                    if name:
                        payload = part.get_payload(decode=True)
                        if filename:
                            photo_bytes = payload
                            photo_filename = filename
                        else:
                            fields[name] = (payload or b"").decode("utf-8", errors="replace")

                message = fields.get("message", "")
                chat_ids_raw = fields.get("chatIds", "")
                chat_id_single = fields.get("chatId", "")
                chat_ids = [c for c in chat_ids_raw.split(",") if c] if chat_ids_raw else []
                if not chat_ids and chat_id_single:
                    chat_ids = [chat_id_single]
            else:
                body = json.loads(raw) if raw else {}
                message = body.get("message", "")
                chat_ids = body.get("chatIds", [])
                if not chat_ids:
                    single = body.get("chatId")
                    if single:
                        chat_ids = [single]

            if not message:
                _send_json(self, {"error": "message is required"}, 400)
                return
            if not chat_ids:
                _send_json(self, {"error": "chatId or chatIds is required"}, 400)
                return

            token = os.environ.get("TELEGRAM_BOT_TOKEN", "")
            if not token:
                _send_json(self, {"error": "TELEGRAM_BOT_TOKEN not configured"}, 500)
                return

            sent = 0
            failed = 0
            for chat_id in chat_ids:
                try:
                    if photo_bytes:
                        # sendPhoto with caption
                        boundary_mp = b"----TGBoundary"
                        parts = []
                        parts.append(
                            b"--" + boundary_mp + b"\r\n"
                            b'Content-Disposition: form-data; name="chat_id"\r\n\r\n' +
                            chat_id.encode() + b"\r\n"
                        )
                        parts.append(
                            b"--" + boundary_mp + b"\r\n"
                            b'Content-Disposition: form-data; name="caption"\r\n\r\n' +
                            message.encode() + b"\r\n"
                        )
                        parts.append(
                            b"--" + boundary_mp + b"\r\n"
                            b'Content-Disposition: form-data; name="parse_mode"\r\n\r\nHTML\r\n'
                        )
                        parts.append(
                            b"--" + boundary_mp + b"\r\n"
                            b'Content-Disposition: form-data; name="photo"; filename="' +
                            photo_filename.encode() + b'"\r\n'
                            b'Content-Type: image/jpeg\r\n\r\n' +
                            photo_bytes + b"\r\n"
                        )
                        parts.append(b"--" + boundary_mp + b"--\r\n")
                        body_mp = b"".join(parts)
                        req = urllib.request.Request(
                            f"https://api.telegram.org/bot{token}/sendPhoto",
                            data=body_mp,
                            headers={"Content-Type": f"multipart/form-data; boundary={boundary_mp.decode()}"},
                        )
                    else:
                        payload = json.dumps({
                            "chat_id": chat_id,
                            "text": message,
                            "parse_mode": "HTML",
                        }).encode()
                        req = urllib.request.Request(
                            f"https://api.telegram.org/bot{token}/sendMessage",
                            data=payload,
                            headers={"Content-Type": "application/json"},
                        )

                    with urllib.request.urlopen(req, timeout=10) as resp:
                        resp.read()
                    sent += 1
                except Exception:
                    failed += 1

            _send_json(self, {"sent": sent, "failed": failed})
        except Exception as e:
            _send_json(self, {"error": str(e)}, 500)

    # ══════════════════════════════════════════════════════════════════
    #  Chat completions — proxy to nanobot gateway (port 18790)
    # ══════════════════════════════════════════════════════════════════

    def _handle_chat_completions(self):
        """Forward chat requests to nanobot gateway, which has full MCP tool access."""
        import urllib.request
        import urllib.error

        try:
            content_length = int(self.headers.get("Content-Length", 0))
            body = json.loads(self.rfile.read(content_length)) if content_length else {}

            nanobot_url = os.environ.get("NANOBOT_SERVE_URL", "http://localhost:18790")

            # nanobot serve only accepts exactly 1 message (system messages not supported).
            # Embed telegram_id as a metadata prefix in the user message so the agent
            # knows which user_id to pass to MCP tool calls.
            telegram_id = str((body.get("user_context") or {}).get("telegram_id", "")).strip()
            if telegram_id and body.get("messages"):
                msgs = list(body["messages"])
                # Find the last user message and prepend the identity context
                for i in range(len(msgs) - 1, -1, -1):
                    if msgs[i].get("role") == "user":
                        original = msgs[i].get("content", "")
                        prefix = f"[ctx: user_id={telegram_id}] "
                        if isinstance(original, str):
                            msgs[i] = dict(msgs[i], content=prefix + original)
                        elif isinstance(original, list):
                            parts = [{"type": "text", "text": prefix}] + list(original)
                            msgs[i] = dict(msgs[i], content=parts)
                        break
                body = dict(body, messages=msgs)

            req_data = json.dumps(body, ensure_ascii=False).encode()
            req = urllib.request.Request(
                f"{nanobot_url}/v1/chat/completions",
                data=req_data,
                headers={"Content-Type": "application/json"},
            )

            with urllib.request.urlopen(req, timeout=120) as resp:
                result = json.loads(resp.read())

            # nanobot serve hardcodes usage=0 — estimate from char length (1 token ≈ 4 chars)
            usage = result.get("usage", {})
            if not usage.get("prompt_tokens") and not usage.get("completion_tokens"):
                input_chars = sum(
                    len(str(m.get("content", "")))
                    for m in body.get("messages", [])
                )
                output_chars = len(
                    result.get("choices", [{}])[0]
                    .get("message", {})
                    .get("content", "")
                )
                result["usage"] = {
                    "prompt_tokens": max(1, input_chars // 4),
                    "completion_tokens": max(1, output_chars // 4),
                    "total_tokens": max(1, (input_chars + output_chars) // 4),
                }

            _send_json(self, result)

        except urllib.error.URLError:
            _send_json(self, {
                "choices": [{"message": {"role": "assistant", "content": "AI Agent sedang tidak tersedia. Coba lagi sebentar."}}],
            })
        except Exception as e:
            _send_json(self, {
                "choices": [{"message": {"role": "assistant", "content": f"Error: {str(e)}"}}],
            })

    def _handle_vpn_user(self):
        """POST /vpn-user — create or delete a SoftEther VPN user."""
        try:
            length = int(self.headers.get("Content-Length", 0))
            body = json.loads(self.rfile.read(length)) if length else {}
        except (json.JSONDecodeError, ValueError):
            _send_json(self, {"error": "invalid JSON"}, 400)
            return

        action = body.get("action", "")
        if action == "create":
            username = body.get("username", "").strip()
            password = body.get("password", "").strip()
            if not username or not password:
                _send_json(self, {"error": "username and password required"}, 400)
                return
            ok, err = _vpn_user_create(username, password)
            if not ok:
                _send_json(self, {"error": err}, 500)
            else:
                _send_json(self, {"ok": True, "username": username})

        elif action == "delete":
            username = body.get("username", "").strip()
            if not username:
                _send_json(self, {"error": "username required"}, 400)
                return
            ok, err = _vpn_user_delete(username)
            if not ok:
                _send_json(self, {"error": err}, 500)
            else:
                _send_json(self, {"ok": True})

        else:
            _send_json(self, {"error": f"unknown action: {action!r}"}, 400)

    def _handle_wg_peer(self, user_id):
        """Manage WireGuard peers: add or delete."""
        try:
            import subprocess, json
            content_length = int(self.headers.get("Content-Length", 0))
            body = json.loads(self.rfile.read(content_length)) if content_length else {}
            action = body.get("action", "add")
            pub_key = body.get("pubKey", "")
            vpn_ip = body.get("vpnIp", "")

            if action == "add":
                if not pub_key or not vpn_ip:
                    _send_json(self, {"error": "pubKey and vpnIp required"}, 400)
                    return
                # Add peer to WireGuard
                subprocess.run(
                    ["docker", "exec", "mikrotik-wireguard", "wg", "set", "wg0",
                     "peer", pub_key, "allowed-ips", f"{vpn_ip}/32",
                     "persistent-keepalive", "25"],
                    check=True, capture_output=True
                )
                # Persist config
                subprocess.run(
                    ["docker", "exec", "mikrotik-wireguard", "wg-quick", "save", "wg0"],
                    capture_output=True
                )
                _send_json(self, {"ok": True, "action": "added", "peer": pub_key})

            elif action == "delete":
                if not pub_key:
                    _send_json(self, {"error": "pubKey required"}, 400)
                    return
                subprocess.run(
                    ["docker", "exec", "mikrotik-wireguard", "wg", "set", "wg0",
                     "peer", pub_key, "remove"],
                    check=True, capture_output=True
                )
                subprocess.run(
                    ["docker", "exec", "mikrotik-wireguard", "wg-quick", "save", "wg0"],
                    capture_output=True
                )
                _send_json(self, {"ok": True, "action": "deleted", "peer": pub_key})
            else:
                _send_json(self, {"error": "action must be add or delete"}, 400)
        except Exception as e:
            _send_json(self, {"error": str(e)}, 500)

    def _handle_ovpn_user(self, user_id):
        """Manage OpenVPN users: create or delete."""
        try:
            import subprocess, json, hashlib, os
            content_length = int(self.headers.get("Content-Length", 0))
            body = json.loads(self.rfile.read(content_length)) if content_length else {}
            action = body.get("action", "create")
            username = body.get("username", "")
            password = body.get("password", "")
            vpn_ip = body.get("vpnIp", "")

            if action == "create":
                if not username or not password:
                    _send_json(self, {"error": "username and password required"}, 400)
                    return
                # Hash password with SHA-256
                pw_hash = hashlib.sha256(password.encode()).hexdigest()
                # Write to users file in OpenVPN container
                subprocess.run(
                    ["docker", "exec", "mikrotik-openvpn", "sh", "-c",
                     f"echo '{username}:{pw_hash}' >> /config/users.txt"],
                    check=True, capture_output=True
                )
                # Write CCD file for static IP assignment
                if vpn_ip:
                    # CCD: ifconfig-push CLIENT_IP GATEWAY_IP
                    gw_parts = vpn_ip.rsplit('.', 1)
                    gateway_ip = gw_parts[0] + ".1"
                    subprocess.run(
                        ["docker", "exec", "mikrotik-openvpn", "sh", "-c",
                         f"mkdir -p /config/ccd && echo 'ifconfig-push {vpn_ip} {gateway_ip}' > /config/ccd/{username}"],
                        check=True, capture_output=True
                    )
                _send_json(self, {"ok": True, "action": "created", "username": username})

            elif action == "delete":
                if not username:
                    _send_json(self, {"error": "username required"}, 400)
                    return
                # Remove from users file
                subprocess.run(
                    ["docker", "exec", "mikrotik-openvpn", "sh", "-c",
                     f"sed -i '/^{username}:/d' /config/users.txt"],
                    check=True, capture_output=True
                )
                # Remove CCD file
                subprocess.run(
                    ["docker", "exec", "mikrotik-openvpn", "sh", "-c",
                     f"rm -f /config/ccd/{username}"],
                    capture_output=True
                )
                _send_json(self, {"ok": True, "action": "deleted", "username": username})
            else:
                _send_json(self, {"error": "action must be create or delete"}, 400)
        except Exception as e:
            _send_json(self, {"error": str(e)}, 500)

    # ══════════════════════════════════════════════════════════════════
    #  Hotspot Profile CRUD
    # ══════════════════════════════════════════════════════════════════

    def _handle_hotspot_profile_add(self, user_id):
        """Add a new hotspot user profile."""
        try:
            content_length = int(self.headers.get("Content-Length", 0))
            body = json.loads(self.rfile.read(content_length)) if content_length else {}

            name = body.get("name")
            if not name:
                _send_json(self, {"error": "name is required"}, 400)
                return

            router_name = body.get("router")
            registry = _get_registry()
            conn = registry.resolve(user_id, router_name)

            add_params = {"name": name}
            if body.get("rateLimit"):
                add_params["rate-limit"] = body["rateLimit"]
            if body.get("sharedUsers"):
                add_params["shared-users"] = str(body["sharedUsers"])
            if body.get("masaBerlaku"):
                add_params["session-timeout"] = body["masaBerlaku"]
            if body.get("expiredMode"):
                add_params["expired-mode"] = body["expiredMode"]
            if body.get("macCookie") is not None:
                add_params["add-mac-cookie"] = "true" if body["macCookie"] else "false"
            if body.get("parentQueue"):
                add_params["parent-queue"] = body["parentQueue"]
            if body.get("onLogin"):
                add_params["on-login"] = body["onLogin"]
            if body.get("onLogout"):
                add_params["on-logout"] = body["onLogout"]
            if body.get("addressPool"):
                add_params["address-pool"] = body["addressPool"]

            with _connect(conn["host"], conn["port"], conn["username"], conn["password"]) as api:
                api.path("ip", "hotspot", "user", "profile").add(**add_params)

            _send_json(self, {"status": "ok"})
        except Exception as e:
            _send_json(self, {"error": str(e)}, 500)

    def _handle_hotspot_profile_update(self, user_id, name):
        """Update an existing hotspot user profile."""
        try:
            content_length = int(self.headers.get("Content-Length", 0))
            body = json.loads(self.rfile.read(content_length)) if content_length else {}

            router_name = body.get("router")
            registry = _get_registry()
            conn = registry.resolve(user_id, router_name)

            with _connect(conn["host"], conn["port"], conn["username"], conn["password"]) as api:
                resource = api.path("ip", "hotspot", "user", "profile")
                item_id = None
                for p in resource:
                    if p.get("name") == name:
                        item_id = p.get(".id")
                        break
                if not item_id:
                    _send_json(self, {"error": f"Profile '{name}' not found"}, 404)
                    return

                update_params = {".id": item_id}
                if "rateLimit" in body:
                    update_params["rate-limit"] = body["rateLimit"]
                if "sharedUsers" in body:
                    update_params["shared-users"] = str(body["sharedUsers"])
                if "masaBerlaku" in body:
                    update_params["session-timeout"] = body["masaBerlaku"]
                if "expiredMode" in body:
                    update_params["expired-mode"] = body["expiredMode"]
                if "macCookie" in body:
                    update_params["add-mac-cookie"] = "true" if body["macCookie"] else "false"
                if "parentQueue" in body:
                    update_params["parent-queue"] = body["parentQueue"]
                if "onLogin" in body:
                    update_params["on-login"] = body["onLogin"]
                if "onLogout" in body:
                    update_params["on-logout"] = body["onLogout"]
                if "addressPool" in body:
                    update_params["address-pool"] = body["addressPool"]

                resource.update(**update_params)

            _send_json(self, {"status": "ok"})
        except Exception as e:
            _send_json(self, {"error": str(e)}, 500)

    def _handle_hotspot_profile_delete(self, user_id, name):
        """Delete a hotspot user profile."""
        try:
            registry = _get_registry()
            conn = registry.resolve(user_id, None)
            with _connect(conn["host"], conn["port"], conn["username"], conn["password"]) as api:
                resource = api.path("ip", "hotspot", "user", "profile")
                item_id = None
                for p in resource:
                    if p.get("name") == name:
                        item_id = p.get(".id")
                        break
                if not item_id:
                    _send_json(self, {"error": f"Profile '{name}' not found"}, 404)
                    return
                resource.remove(item_id)
            _send_json(self, {"status": "ok"})
        except Exception as e:
            _send_json(self, {"error": str(e)}, 500)

    def _handle_hotspot_profile_get(self, user_id, name, router_name=None):
        """Get full detail of one hotspot user profile (including on-login script)."""
        try:
            registry = _get_registry()
            conn = registry.resolve(user_id, router_name)
            with _connect(conn["host"], conn["port"], conn["username"], conn["password"]) as api:
                profiles = list(api.path("ip", "hotspot", "user", "profile"))
                for p in profiles:
                    if p.get("name") == name:
                        _send_json(self, {
                            "name": p.get("name", ""),
                            "rateLimit": p.get("rate-limit", ""),
                            "sharedUsers": p.get("shared-users", ""),
                            "sessionTimeout": p.get("session-timeout", ""),
                            "idleTimeout": p.get("idle-timeout", ""),
                            "onLogin": p.get("on-login", ""),
                            "onLogout": p.get("on-logout", ""),
                            "addressPool": p.get("address-pool", ""),
                        })
                        return
                _send_json(self, {"error": f"Profile '{name}' not found"}, 404)
        except Exception as e:
            _send_json(self, {"error": str(e)}, 500)

    def log_message(self, format, *args):
        pass  # Suppress request logs


def _format_bytes(n):
    """Format byte count to human readable string."""
    n = int(n)
    for unit in ("B", "KB", "MB", "GB"):
        if n < 1024:
            return f"{n:.1f} {unit}"
        n /= 1024
    return f"{n:.1f} TB"


def _parse_mikhmon_script_name(script_name: str) -> dict | None:
    """Parse a Mikhmon script name into transaction fields.

    Actual Mikhmon format (9 fields):
      date-|-time-|-username-|-price-|-ip-|-mac-|-limit_uptime-|-profile-|-batch_ref
    Example: oct/01/2025-|-12:57:32-|-58w6zc-|-4000-|-10.10.8.97-|-0A:E2:F4:...-|-1d-|-24jam-5K-|-vc-678

    Returns None if the name doesn't match Mikhmon format (fewer than 6 fields).
    """
    parts = script_name.split("-|-")
    if len(parts) < 6:
        return None
    return {
        "date": parts[0].strip(),
        "time": parts[1].strip(),
        "username": parts[2].strip(),
        "price": parts[3].strip(),
        "ip": parts[4].strip(),
        "mac": parts[5].strip(),
        "limitUptime": parts[6].strip() if len(parts) > 6 else "",
        "profile": parts[7].strip() if len(parts) > 7 else "",
        "batchRef": parts[8].strip() if len(parts) > 8 else "",
    }


def _expired_cleanup_cron(interval_seconds=300):
    """Background cron: every 5 minutes, remove expired hotspot users for all routers.

    Saves expired users to DB before deletion (via remove_expired_hotspot_users).
    Only runs when DATABASE_URL is set (i.e. production environment).
    """
    import logging
    logger = logging.getLogger("expired_cron")
    logger.info("Expired cleanup cron started (interval=%ds)", interval_seconds)

    while True:
        time.sleep(interval_seconds)
        try:
            from server import remove_expired_hotspot_users
            vdb = _get_voucher_db()
            if not vdb:
                continue

            pairs = vdb.list_all_user_router_pairs()
            for telegram_id, router_name in pairs:
                try:
                    result = remove_expired_hotspot_users(telegram_id, router_name)
                    if result.get("count", 0) > 0:
                        logger.info(
                            "Cron expired cleanup: router=%s user=%s removed=%d archived=%d",
                            router_name, telegram_id, result["count"], result.get("archived", 0)
                        )
                except Exception as e:
                    logger.warning("Cron expired cleanup failed for %s/%s: %s", telegram_id, router_name, e)
        except Exception as e:
            logger.warning("Expired cron error: %s", e)


def start_health_server(port=8080):
    server = HTTPServer(("0.0.0.0", port), HealthHandler)
    thread = threading.Thread(target=server.serve_forever, daemon=True)
    thread.start()
    print(f"Health server started on port {port}")

    if os.environ.get("DATABASE_URL"):
        cron_thread = threading.Thread(target=_expired_cleanup_cron, args=(300,), daemon=True)
        cron_thread.start()
        print("Expired cleanup cron started (every 5 minutes)")


if __name__ == "__main__":
    start_health_server()
    while True:
        time.sleep(3600)
