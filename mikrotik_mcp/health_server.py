"""
HTTP API server that runs alongside the MCP server inside the agent container.
Provides router data to the dashboard (health, traffic, logs, interfaces).
Runs on port 8080.
"""

import json
import os
import sys
import threading
import time
from http.server import HTTPServer, BaseHTTPRequestHandler
from urllib.parse import urlparse, parse_qs

sys.path.insert(0, os.path.dirname(__file__))


def _send_json(handler, data, status=200):
    handler.send_response(status)
    handler.send_header("Content-Type", "application/json")
    handler.send_header("Access-Control-Allow-Origin", "*")
    handler.end_headers()
    handler.wfile.write(json.dumps(data).encode())


def _get_registry():
    from server import registry
    return registry


def _connect(host, port, username, password):
    from server import connect_router
    return connect_router(host, port, username, password)


class HealthHandler(BaseHTTPRequestHandler):
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

        self.send_response(404)
        self.end_headers()

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

    def do_POST(self):
        parsed = urlparse(self.path)
        path = parsed.path

        if path == "/v1/chat/completions":
            self._handle_chat_completions()
            return

        self.send_response(404)
        self.end_headers()

    def _handle_chat_completions(self):
        """Proxy chat to OpenRouter API directly. Provides OpenAI-compatible endpoint for dashboard chat."""
        import urllib.request
        import urllib.error

        try:
            content_length = int(self.headers.get("Content-Length", 0))
            body = json.loads(self.rfile.read(content_length)) if content_length else {}

            messages = body.get("messages", [])
            session_id = body.get("session_id", "dashboard")
            user_context = body.get("user_context", {})

            # Get user's telegram ID for MCP tool context
            telegram_id = user_context.get("telegram_id", "")

            # Build system prompt with MikroTik context
            system_msg = {
                "role": "system",
                "content": (
                    "You are a MikroTik network assistant. You help users manage their MikroTik routers. "
                    "Keep responses short and casual. Use Indonesian if the user writes in Indonesian. "
                    f"The user's Telegram ID is {telegram_id}. "
                    "You can provide general MikroTik advice but cannot execute router commands from this interface. "
                    "For router management actions, suggest the user use the Telegram bot."
                )
            }

            all_messages = [system_msg] + messages

            # Call OpenRouter directly
            api_key = os.environ.get("OPENROUTER_API_KEY", "")
            model = os.environ.get("CHAT_MODEL", "openai/gpt-5.4-nano")

            if not api_key:
                _send_json(self, {
                    "choices": [{"message": {"role": "assistant", "content": "API key not configured. Contact admin."}}],
                    "model": model,
                })
                return

            payload = json.dumps({
                "model": model,
                "messages": all_messages,
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
                _send_json(self, result)

        except urllib.error.HTTPError as e:
            error_body = e.read().decode() if e.fp else str(e)
            _send_json(self, {
                "choices": [{"message": {"role": "assistant", "content": f"LLM error: {error_body[:200]}"}}],
            })
        except Exception as e:
            _send_json(self, {
                "choices": [{"message": {"role": "assistant", "content": f"Chat error: {str(e)}"}}],
            })

    def log_message(self, format, *args):
        pass  # Suppress request logs


def start_health_server(port=8080):
    server = HTTPServer(("0.0.0.0", port), HealthHandler)
    thread = threading.Thread(target=server.serve_forever, daemon=True)
    thread.start()
    print(f"Health server started on port {port}")


if __name__ == "__main__":
    start_health_server()
    while True:
        time.sleep(3600)
