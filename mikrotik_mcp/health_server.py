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

        # Hotspot profiles
        if path.startswith("/hotspot-profiles/"):
            user_id = path.split("/hotspot-profiles/")[1]
            router_name = params.get("router", [None])[0]
            self._handle_hotspot_profiles(user_id, router_name)
            return

        # Hotspot stats (aggregated counts)
        if path.startswith("/hotspot-stats/"):
            user_id = path.split("/hotspot-stats/")[1]
            router_name = params.get("router", [None])[0]
            self._handle_hotspot_stats(user_id, router_name)
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
                            "profile": u.get("profile", ""),
                            "server": u.get("server", ""),
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
        try:
            registry = _get_registry()
            conn = registry.resolve(user_id, router_name)
            with _connect(conn["host"], conn["port"], conn["username"], conn["password"]) as api:
                profiles = list(api.path("ip", "hotspot", "user", "profile"))
                result = {
                    "router": conn.get("name", ""),
                    "profiles": [
                        {
                            "name": p.get("name", ""),
                            "rateLimit": p.get("rate-limit", ""),
                            "sharedUsers": p.get("shared-users", ""),
                            "sessionTimeout": p.get("session-timeout", ""),
                        }
                        for p in profiles
                    ]
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
            pwd_len = int(body.get("passwordLength", 6))
            usr_len = int(body.get("usernameLength", 6))
            server = body.get("server")
            router_name = body.get("router")

            charset = string.ascii_lowercase + string.digits

            registry = _get_registry()
            conn = registry.resolve(user_id, router_name)

            vouchers = []
            with _connect(conn["host"], conn["port"], conn["username"], conn["password"]) as api:
                resource = api.path("ip", "hotspot", "user")
                for _ in range(count):
                    uname = prefix + "".join(random.choices(charset, k=usr_len))
                    pwd = "".join(random.choices(charset, k=pwd_len))

                    add_params = {
                        "name": uname,
                        "password": pwd,
                        "profile": profile,
                    }
                    if server:
                        add_params["server"] = server

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
                    )
                except Exception:
                    pass  # DB persistence is best-effort

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
    #  Telegram messaging
    # ══════════════════════════════════════════════════════════════════

    def _handle_send_telegram(self, user_id):
        """Send a Telegram message to one or more chat IDs."""
        import urllib.request
        import urllib.error

        try:
            content_length = int(self.headers.get("Content-Length", 0))
            body = json.loads(self.rfile.read(content_length)) if content_length else {}

            message = body.get("message", "")
            if not message:
                _send_json(self, {"error": "message is required"}, 400)
                return

            # Support single chatId or multiple chatIds
            chat_ids = body.get("chatIds", [])
            if not chat_ids:
                single = body.get("chatId")
                if single:
                    chat_ids = [single]
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
    #  Chat completions — proxy to nanobot serve (port 18790)
    # ══════════════════════════════════════════════════════════════════

    def _handle_chat_completions(self):
        """Forward chat requests to nanobot serve, which has full MCP tool access."""
        import urllib.request
        import urllib.error

        try:
            content_length = int(self.headers.get("Content-Length", 0))
            body = json.loads(self.rfile.read(content_length)) if content_length else {}

            nanobot_url = os.environ.get("NANOBOT_SERVE_URL", "http://localhost:18790")

            req_data = json.dumps(body, ensure_ascii=False).encode()
            req = urllib.request.Request(
                f"{nanobot_url}/v1/chat/completions",
                data=req_data,
                headers={"Content-Type": "application/json"},
            )

            with urllib.request.urlopen(req, timeout=120) as resp:
                result = json.loads(resp.read())
                _send_json(self, result)

        except urllib.error.URLError as e:
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


def start_health_server(port=8080):
    server = HTTPServer(("0.0.0.0", port), HealthHandler)
    thread = threading.Thread(target=server.serve_forever, daemon=True)
    thread.start()
    print(f"Health server started on port {port}")


if __name__ == "__main__":
    start_health_server()
    while True:
        time.sleep(3600)
