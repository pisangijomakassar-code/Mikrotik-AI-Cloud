"""
Simple HTTP health check server that runs alongside MCP server.
Provides router health data to the dashboard without needing docker exec.
Runs on port 8080 inside the agent container.
"""

import json
import os
import sys
import threading
from http.server import HTTPServer, BaseHTTPRequestHandler

sys.path.insert(0, os.path.dirname(__file__))


class HealthHandler(BaseHTTPRequestHandler):
    def do_GET(self):
        if self.path == "/health":
            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self.send_header("Access-Control-Allow-Origin", "*")
            self.end_headers()
            self.wfile.write(json.dumps({"status": "ok"}).encode())
            return

        if self.path.startswith("/router-health/"):
            user_id = self.path.split("/router-health/")[1].split("?")[0]
            try:
                from server import registry, connect_router
                all_routers = registry.resolve(user_id, "all")
                results = []
                for r in all_routers:
                    status = {"name": r.get("name", ""), "status": "offline"}
                    try:
                        with connect_router(r["host"], r["port"], r["username"], r["password"]) as api:
                            res = list(api.path("/system/resource"))
                            if res:
                                total = int(res[0].get("total-memory", 0))
                                free = int(res[0].get("free-memory", 0))
                                mem_pct = round((total - free) / total * 100) if total else 0
                                status.update({
                                    "status": "online",
                                    "cpuLoad": res[0].get("cpu-load", 0),
                                    "memoryPercent": mem_pct,
                                    "uptime": res[0].get("uptime", ""),
                                    "version": res[0].get("version", ""),
                                })
                            leases = list(api.path("/ip/dhcp-server/lease"))
                            status["activeClients"] = len([l for l in leases if l.get("status") == "bound"])
                    except Exception as e:
                        status["error"] = str(e)
                    results.append(status)

                self.send_response(200)
                self.send_header("Content-Type", "application/json")
                self.send_header("Access-Control-Allow-Origin", "*")
                self.end_headers()
                self.wfile.write(json.dumps(results).encode())
            except Exception as e:
                self.send_response(500)
                self.send_header("Content-Type", "application/json")
                self.end_headers()
                self.wfile.write(json.dumps({"error": str(e)}).encode())
            return

        self.send_response(404)
        self.end_headers()

    def log_message(self, format, *args):
        pass  # Suppress logs


def start_health_server(port=8080):
    server = HTTPServer(("0.0.0.0", port), HealthHandler)
    thread = threading.Thread(target=server.serve_forever, daemon=True)
    thread.start()
    print(f"Health server started on port {port}")


if __name__ == "__main__":
    start_health_server()
    import time
    while True:
        time.sleep(3600)
