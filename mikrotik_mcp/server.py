"""
MikroTik MCP Server — Bridges AI agents with MikroTik RouterOS v6/v7 via API.
Uses librouteros for the binary RouterOS API protocol (port 8728).
Exposes tools that LLMs can call to query and manage routers.

Multi-user / multi-router: each Telegram user registers their own routers
via RouterRegistry.  Every tool requires a user_id; router defaults to the
user's default router when omitted.
"""

import os
import sys
import logging
import socket
import time
from contextlib import contextmanager
from typing import Any

import librouteros
from mcp.server.fastmcp import FastMCP

from registry import RouterRegistry

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
logger = logging.getLogger(__name__)

# --- Configuration ---
DATA_DIR = os.environ.get("DATA_DIR", "/app/data")
registry = RouterRegistry(data_dir=DATA_DIR)

mcp = FastMCP(
    "mikrotik-agent",
    instructions="MikroTik RouterOS management tools for AI agents. Query and manage MikroTik routers via natural language.",
)


# Cache resolved IPs to avoid repeated DNS lookups (keyed by hostname)
_resolved_ips: dict[str, str] = {}


def _resolve_host(host: str) -> str:
    """Resolve hostname to IP, using a per-host cache."""
    cached = _resolved_ips.get(host)
    if cached:
        return cached
    ip = socket.gethostbyname(host)
    _resolved_ips[host] = ip
    logger.info("Resolved %s -> %s", host, ip)
    return ip


@contextmanager
def connect_router(host: str, port: int, username: str, password: str, retries: int = 2):
    """Context manager for a RouterOS API connection with retry."""
    last_err = None
    for attempt in range(retries + 1):
        try:
            resolved = _resolve_host(host) if (host in _resolved_ips or attempt == 0) else host
            api = librouteros.connect(
                host=resolved,
                port=port,
                username=username,
                password=password,
                timeout=15,
            )
            try:
                yield api
            finally:
                api.close()
            return
        except (socket.gaierror, OSError, librouteros.exceptions.ConnectionClosed) as e:
            last_err = e
            _resolved_ips.pop(host, None)  # force re-resolve
            if attempt < retries:
                time.sleep(1)
                logger.warning("Retry %d/%d for %s:%d after: %s", attempt + 1, retries, host, port, e)
    raise last_err


def _query_path(path: str, host: str, port: int, username: str, password: str, where: dict | None = None) -> list[dict]:
    """Generic helper: query a RouterOS API path and return rows as dicts."""
    with connect_router(host, port, username, password) as api:
        resource = api.path(path)
        if where:
            params = tuple(
                librouteros.query.Key(k) == v for k, v in where.items()
            )
            return list(resource.select(*params))
        return list(resource)


def _format_bytes(n: int | str) -> str:
    n = int(n)
    for unit in ("B", "KB", "MB", "GB"):
        if n < 1024:
            return f"{n:.1f} {unit}"
        n /= 1024
    return f"{n:.1f} TB"


def _resolve_connection(user_id: str, router: str = "") -> dict:
    """Resolve user_id + router name to connection details.

    Returns dict with host, port, username, password, name.
    On error returns dict with 'error' key.
    """
    try:
        return registry.resolve(user_id, router or None)
    except ValueError as e:
        return {"error": str(e)}


# ─────────────────────────────────────────────
#  ROUTER MANAGEMENT TOOLS
# ─────────────────────────────────────────────

@mcp.tool()
def list_routers(user_id: str) -> list[dict]:
    """List all routers registered by this user.

    Args:
        user_id: Telegram user ID
    """
    return registry.list_routers(user_id)


@mcp.tool()
def register_router(user_id: str, name: str, host: str, port: int,
                    username: str, password: str, label: str = "") -> dict:
    """Register a new MikroTik router. Tests connection before saving.

    Args:
        user_id: Telegram user ID
        name: Friendly name for the router
        host: Router hostname or IP
        port: RouterOS API port (usually 8728)
        username: RouterOS login username
        password: RouterOS login password
        label: Optional description
    """
    # First test the connection
    try:
        with connect_router(host, port, username, password) as api:
            resource = list(api.path("/system/resource"))
            identity = list(api.path("/system/identity"))
            board = resource[0].get("board-name", "") if resource else ""
            version = resource[0].get("version", "") if resource else ""
            router_name = identity[0].get("name", "") if identity else ""
    except Exception as e:
        return {"error": f"Connection failed: {e}"}

    result = registry.add_router(
        user_id, name, host, port, username, password,
        label=label, routeros_version=version, board=board,
    )
    if "error" not in result:
        result["board"] = board
        result["version"] = version
        result["identity"] = router_name
    return result


@mcp.tool()
def remove_router(user_id: str, name: str) -> dict:
    """Remove a registered router.

    Args:
        user_id: Telegram user ID
        name: Router name to remove
    """
    return registry.remove_router(user_id, name)


@mcp.tool()
def set_default_router(user_id: str, name: str) -> dict:
    """Set the default router for this user.

    Args:
        user_id: Telegram user ID
        name: Router name to set as default
    """
    return registry.set_default(user_id, name)


@mcp.tool()
def test_connection(host: str, port: int, username: str, password: str) -> dict:
    """Test connectivity to a MikroTik router without registering it.

    Args:
        host: Router hostname or IP
        port: RouterOS API port
        username: Login username
        password: Login password
    """
    try:
        with connect_router(host, port, username, password) as api:
            resource = list(api.path("/system/resource"))
            if resource:
                r = resource[0]
                return {
                    "status": "ok",
                    "board": r.get("board-name"),
                    "version": r.get("version"),
                    "uptime": r.get("uptime"),
                }
        return {"status": "ok", "message": "Connected but no data returned"}
    except Exception as e:
        return {"error": f"Connection failed: {e}"}


# ─────────────────────────────────────────────
#  SYSTEM TOOLS
# ─────────────────────────────────────────────

@mcp.tool()
def get_system_info(user_id: str, router: str = "") -> dict:
    """Get MikroTik router system information: board, version, CPU, memory, uptime.

    Args:
        user_id: Telegram user ID (required)
        router: Router name. Empty = default router.
    """
    conn = _resolve_connection(user_id, router)
    if "error" in conn:
        return conn
    rows = _query_path("/system/resource", conn["host"], conn["port"], conn["username"], conn["password"])
    if not rows:
        return {"error": "No data returned"}
    r = rows[0]
    registry.update_last_seen(user_id, conn["name"])
    return {
        "board": r.get("board-name"),
        "version": r.get("version"),
        "architecture": r.get("architecture-name"),
        "cpu": r.get("cpu"),
        "cpu_load_percent": r.get("cpu-load"),
        "total_memory": _format_bytes(r.get("total-memory", 0)),
        "free_memory": _format_bytes(r.get("free-memory", 0)),
        "uptime": r.get("uptime"),
    }


@mcp.tool()
def get_system_identity(user_id: str, router: str = "") -> dict:
    """Get the router's hostname / identity.

    Args:
        user_id: Telegram user ID (required)
        router: Router name. Empty = default router.
    """
    conn = _resolve_connection(user_id, router)
    if "error" in conn:
        return conn
    rows = _query_path("/system/identity", conn["host"], conn["port"], conn["username"], conn["password"])
    registry.update_last_seen(user_id, conn["name"])
    return rows[0] if rows else {"error": "No data"}


# ─────────────────────────────────────────────
#  INTERFACE TOOLS
# ─────────────────────────────────────────────

@mcp.tool()
def list_interfaces(user_id: str, router: str = "") -> list[dict]:
    """List all network interfaces with status, type, MAC address, and traffic stats.

    Args:
        user_id: Telegram user ID (required)
        router: Router name. Empty = default router.
    """
    conn = _resolve_connection(user_id, router)
    if "error" in conn:
        return [conn]
    rows = _query_path("/interface", conn["host"], conn["port"], conn["username"], conn["password"])
    registry.update_last_seen(user_id, conn["name"])
    return [
        {
            "name": r.get("name"),
            "type": r.get("type"),
            "mac": r.get("mac-address"),
            "running": r.get("running"),
            "disabled": r.get("disabled"),
            "tx_bytes": _format_bytes(r.get("tx-byte", 0)),
            "rx_bytes": _format_bytes(r.get("rx-byte", 0)),
        }
        for r in rows
    ]


@mcp.tool()
def get_interface_traffic(user_id: str, interface_name: str, router: str = "") -> dict:
    """Get real-time traffic stats for a specific interface.

    Args:
        user_id: Telegram user ID (required)
        interface_name: Name of the interface to query
        router: Router name. Empty = default router.
    """
    conn = _resolve_connection(user_id, router)
    if "error" in conn:
        return conn
    host, port, username, password = conn["host"], conn["port"], conn["username"], conn["password"]
    with connect_router(host, port, username, password) as api:
        monitor = api.path("/interface/monitor-traffic")
        result = list(monitor.select(
            librouteros.query.Key("interface") == interface_name,
            librouteros.query.Key(".proplist") == "name,rx-bits-per-second,tx-bits-per-second",
        ))
        if result:
            registry.update_last_seen(user_id, conn["name"])
            return result[0]
    # Fallback: get from /interface
    ifaces = _query_path("/interface", host, port, username, password)
    for r in ifaces:
        if r.get("name") == interface_name:
            registry.update_last_seen(user_id, conn["name"])
            return {
                "name": r.get("name"),
                "tx_bytes": _format_bytes(r.get("tx-byte", 0)),
                "rx_bytes": _format_bytes(r.get("rx-byte", 0)),
                "running": r.get("running"),
            }
    return {"error": f"Interface '{interface_name}' not found"}


# ─────────────────────────────────────────────
#  IP ADDRESS TOOLS
# ─────────────────────────────────────────────

@mcp.tool()
def list_ip_addresses(user_id: str, router: str = "") -> list[dict]:
    """List all IP addresses assigned to interfaces.

    Args:
        user_id: Telegram user ID (required)
        router: Router name. Empty = default router.
    """
    conn = _resolve_connection(user_id, router)
    if "error" in conn:
        return [conn]
    result = _query_path("/ip/address", conn["host"], conn["port"], conn["username"], conn["password"])
    registry.update_last_seen(user_id, conn["name"])
    return result


@mcp.tool()
def list_ip_routes(user_id: str, router: str = "") -> list[dict]:
    """List the IP routing table.

    Args:
        user_id: Telegram user ID (required)
        router: Router name. Empty = default router.
    """
    conn = _resolve_connection(user_id, router)
    if "error" in conn:
        return [conn]
    result = _query_path("/ip/route", conn["host"], conn["port"], conn["username"], conn["password"])
    registry.update_last_seen(user_id, conn["name"])
    return result


@mcp.tool()
def list_dns_settings(user_id: str, router: str = "") -> dict:
    """Get DNS server settings.

    Args:
        user_id: Telegram user ID (required)
        router: Router name. Empty = default router.
    """
    conn = _resolve_connection(user_id, router)
    if "error" in conn:
        return conn
    rows = _query_path("/ip/dns", conn["host"], conn["port"], conn["username"], conn["password"])
    registry.update_last_seen(user_id, conn["name"])
    return rows[0] if rows else {}


# ─────────────────────────────────────────────
#  DHCP TOOLS
# ─────────────────────────────────────────────

@mcp.tool()
def list_dhcp_leases(user_id: str, router: str = "") -> list[dict]:
    """List all DHCP leases — shows connected clients with IP, MAC, hostname, and status.

    Args:
        user_id: Telegram user ID (required)
        router: Router name. Empty = default router.
    """
    conn = _resolve_connection(user_id, router)
    if "error" in conn:
        return [conn]
    rows = _query_path("/ip/dhcp-server/lease", conn["host"], conn["port"], conn["username"], conn["password"])
    registry.update_last_seen(user_id, conn["name"])
    return [
        {
            "address": r.get("address"),
            "mac": r.get("mac-address"),
            "hostname": r.get("host-name", ""),
            "status": r.get("status"),
            "server": r.get("server"),
            "active_address": r.get("active-address"),
            "expires_after": r.get("expires-after", "static"),
        }
        for r in rows
    ]


@mcp.tool()
def count_active_clients(user_id: str, router: str = "") -> dict:
    """Count how many DHCP clients are currently active/bound.

    Args:
        user_id: Telegram user ID (required)
        router: Router name. Empty = default router.
    """
    conn = _resolve_connection(user_id, router)
    if "error" in conn:
        return conn
    rows = _query_path("/ip/dhcp-server/lease", conn["host"], conn["port"], conn["username"], conn["password"])
    active = [r for r in rows if r.get("status") == "bound"]
    registry.update_last_seen(user_id, conn["name"])
    return {"active_clients": len(active), "total_leases": len(rows)}


# ─────────────────────────────────────────────
#  FIREWALL TOOLS
# ─────────────────────────────────────────────

@mcp.tool()
def list_firewall_filter(user_id: str, router: str = "") -> list[dict]:
    """List all firewall filter rules.

    Args:
        user_id: Telegram user ID (required)
        router: Router name. Empty = default router.
    """
    conn = _resolve_connection(user_id, router)
    if "error" in conn:
        return [conn]
    rows = _query_path("/ip/firewall/filter", conn["host"], conn["port"], conn["username"], conn["password"])
    registry.update_last_seen(user_id, conn["name"])
    return [
        {
            "id": r.get(".id"),
            "chain": r.get("chain"),
            "action": r.get("action"),
            "protocol": r.get("protocol", "any"),
            "src_address": r.get("src-address", ""),
            "dst_address": r.get("dst-address", ""),
            "dst_port": r.get("dst-port", ""),
            "comment": r.get("comment", ""),
            "disabled": r.get("disabled"),
            "bytes": r.get("bytes", "0"),
        }
        for r in rows
    ]


@mcp.tool()
def list_firewall_nat(user_id: str, router: str = "") -> list[dict]:
    """List all NAT rules.

    Args:
        user_id: Telegram user ID (required)
        router: Router name. Empty = default router.
    """
    conn = _resolve_connection(user_id, router)
    if "error" in conn:
        return [conn]
    rows = _query_path("/ip/firewall/nat", conn["host"], conn["port"], conn["username"], conn["password"])
    registry.update_last_seen(user_id, conn["name"])
    return [
        {
            "id": r.get(".id"),
            "chain": r.get("chain"),
            "action": r.get("action"),
            "protocol": r.get("protocol", ""),
            "src_address": r.get("src-address", ""),
            "dst_address": r.get("dst-address", ""),
            "dst_port": r.get("dst-port", ""),
            "to_addresses": r.get("to-addresses", ""),
            "to_ports": r.get("to-ports", ""),
            "comment": r.get("comment", ""),
            "disabled": r.get("disabled"),
        }
        for r in rows
    ]


# ─────────────────────────────────────────────
#  HOTSPOT TOOLS
# ─────────────────────────────────────────────

@mcp.tool()
def list_hotspot_active(user_id: str, router: str = "") -> list[dict]:
    """List all active hotspot users currently connected.

    Args:
        user_id: Telegram user ID (required)
        router: Router name. Empty = default router.
    """
    conn = _resolve_connection(user_id, router)
    if "error" in conn:
        return [conn]
    result = _query_path("/ip/hotspot/active", conn["host"], conn["port"], conn["username"], conn["password"])
    registry.update_last_seen(user_id, conn["name"])
    return result


@mcp.tool()
def list_hotspot_users(user_id: str, router: str = "") -> list[dict]:
    """List all configured hotspot user accounts.

    Args:
        user_id: Telegram user ID (required)
        router: Router name. Empty = default router.
    """
    conn = _resolve_connection(user_id, router)
    if "error" in conn:
        return [conn]
    rows = _query_path("/ip/hotspot/user", conn["host"], conn["port"], conn["username"], conn["password"])
    registry.update_last_seen(user_id, conn["name"])
    return [
        {
            "name": r.get("name"),
            "profile": r.get("profile"),
            "limit_uptime": r.get("limit-uptime", ""),
            "limit_bytes_total": r.get("limit-bytes-total", ""),
            "disabled": r.get("disabled"),
            "comment": r.get("comment", ""),
        }
        for r in rows
    ]


@mcp.tool()
def add_hotspot_user(user_id: str, username: str, password: str, profile: str = "default", router: str = "") -> dict:
    """Add a new hotspot user account.

    Args:
        user_id: Telegram user ID (required)
        username: The login username for the hotspot user
        password: The login password
        profile: Hotspot user profile to assign (default: "default")
        router: Router name. Empty = default router.
    """
    conn = _resolve_connection(user_id, router)
    if "error" in conn:
        return conn
    with connect_router(conn["host"], conn["port"], conn["username"], conn["password"]) as api:
        resource = api.path("/ip/hotspot/user")
        resource.add(name=username, password=password, profile=profile)
        registry.update_last_seen(user_id, conn["name"])
        return {"status": "ok", "message": f"Hotspot user '{username}' created with profile '{profile}'"}


@mcp.tool()
def remove_hotspot_user(user_id: str, username: str, router: str = "") -> dict:
    """Remove a hotspot user account by username.

    Args:
        user_id: Telegram user ID (required)
        username: The username to remove
        router: Router name. Empty = default router.
    """
    conn = _resolve_connection(user_id, router)
    if "error" in conn:
        return conn
    with connect_router(conn["host"], conn["port"], conn["username"], conn["password"]) as api:
        resource = api.path("/ip/hotspot/user")
        users = list(resource.select(librouteros.query.Key("name") == username))
        if not users:
            return {"error": f"User '{username}' not found"}
        resource.remove(users[0][".id"])
        registry.update_last_seen(user_id, conn["name"])
        return {"status": "ok", "message": f"Hotspot user '{username}' removed"}


# ─────────────────────────────────────────────
#  WIRELESS TOOLS
# ─────────────────────────────────────────────

@mcp.tool()
def list_wireless_clients(user_id: str, router: str = "") -> list[dict]:
    """List all connected wireless clients (registration table).

    Args:
        user_id: Telegram user ID (required)
        router: Router name. Empty = default router.
    """
    conn = _resolve_connection(user_id, router)
    if "error" in conn:
        return [conn]
    try:
        result = _query_path("/interface/wireless/registration-table", conn["host"], conn["port"], conn["username"], conn["password"])
        registry.update_last_seen(user_id, conn["name"])
        return result
    except Exception:
        return [{"info": "No wireless interface or not supported on this router"}]


# ─────────────────────────────────────────────
#  ARP / NEIGHBORS
# ─────────────────────────────────────────────

@mcp.tool()
def list_arp_table(user_id: str, router: str = "") -> list[dict]:
    """List the ARP table — shows all devices the router has seen.

    Args:
        user_id: Telegram user ID (required)
        router: Router name. Empty = default router.
    """
    conn = _resolve_connection(user_id, router)
    if "error" in conn:
        return [conn]
    result = _query_path("/ip/arp", conn["host"], conn["port"], conn["username"], conn["password"])
    registry.update_last_seen(user_id, conn["name"])
    return result


@mcp.tool()
def list_neighbors(user_id: str, router: str = "") -> list[dict]:
    """List IP neighbors (CDP/MNDP/LLDP discovery).

    Args:
        user_id: Telegram user ID (required)
        router: Router name. Empty = default router.
    """
    conn = _resolve_connection(user_id, router)
    if "error" in conn:
        return [conn]
    result = _query_path("/ip/neighbor", conn["host"], conn["port"], conn["username"], conn["password"])
    registry.update_last_seen(user_id, conn["name"])
    return result


# ─────────────────────────────────────────────
#  QUEUE / BANDWIDTH
# ─────────────────────────────────────────────

@mcp.tool()
def list_simple_queues(user_id: str, router: str = "") -> list[dict]:
    """List all simple queues (bandwidth limits per client/network).

    Args:
        user_id: Telegram user ID (required)
        router: Router name. Empty = default router.
    """
    conn = _resolve_connection(user_id, router)
    if "error" in conn:
        return [conn]
    result = _query_path("/queue/simple", conn["host"], conn["port"], conn["username"], conn["password"])
    registry.update_last_seen(user_id, conn["name"])
    return result


# ─────────────────────────────────────────────
#  LOG
# ─────────────────────────────────────────────

@mcp.tool()
def get_recent_logs(user_id: str, count: int = 50, router: str = "") -> list[dict]:
    """Get recent system log entries.

    Args:
        user_id: Telegram user ID (required)
        count: Number of recent log entries to return (default: 50)
        router: Router name. Empty = default router.
    """
    conn = _resolve_connection(user_id, router)
    if "error" in conn:
        return [conn]
    rows = _query_path("/log", conn["host"], conn["port"], conn["username"], conn["password"])
    registry.update_last_seen(user_id, conn["name"])
    return rows[-count:]


# ─────────────────────────────────────────────
#  GENERIC / ADVANCED
# ─────────────────────────────────────────────

@mcp.tool()
def run_routeros_query(user_id: str, api_path: str, router: str = "") -> list[dict]:
    """Run a raw RouterOS API query on any path. Use for advanced queries not covered by other tools.

    Args:
        user_id: Telegram user ID (required)
        api_path: The RouterOS API path to query, e.g. "/system/clock", "/ip/pool", "/interface/bridge"
        router: Router name. Empty = default router.
    """
    conn = _resolve_connection(user_id, router)
    if "error" in conn:
        return [conn]
    if not api_path.startswith("/"):
        api_path = "/" + api_path
    result = _query_path(api_path, conn["host"], conn["port"], conn["username"], conn["password"])
    registry.update_last_seen(user_id, conn["name"])
    return result


# ─────────────────────────────────────────────
#  ENTRY POINT
# ─────────────────────────────────────────────

if __name__ == "__main__":
    mcp.run(transport="stdio")
