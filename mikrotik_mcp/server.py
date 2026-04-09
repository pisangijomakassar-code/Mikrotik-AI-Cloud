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
#  KICK / DISCONNECT (Write — destructive)
# ─────────────────────────────────────────────

@mcp.tool()
def kick_hotspot_user(user_id: str, session_id: str, router: str = "") -> dict:
    """Kick an active hotspot user by their session ID (.id from list_hotspot_active).

    Args:
        user_id: Telegram user ID
        session_id: The .id of the active session to remove
        router: Router name (empty = default)
    """
    conn = _resolve_connection(user_id, router)
    if "error" in conn:
        return conn
    try:
        with connect_router(conn["host"], conn["port"], conn["username"], conn["password"]) as api:
            api.path("/ip/hotspot/active").remove(session_id)
            registry.update_last_seen(user_id, conn["name"])
            return {"status": "ok", "message": f"Hotspot session '{session_id}' kicked"}
    except Exception as e:
        return {"error": f"Failed to kick hotspot user: {e}"}


@mcp.tool()
def remove_dhcp_lease(user_id: str, lease_id: str, router: str = "") -> dict:
    """Remove a DHCP lease to force client to re-request IP.

    Args:
        user_id: Telegram user ID
        lease_id: The .id of the lease to remove
        router: Router name (empty = default)
    """
    conn = _resolve_connection(user_id, router)
    if "error" in conn:
        return conn
    try:
        with connect_router(conn["host"], conn["port"], conn["username"], conn["password"]) as api:
            api.path("/ip/dhcp-server/lease").remove(lease_id)
            registry.update_last_seen(user_id, conn["name"])
            return {"status": "ok", "message": f"DHCP lease '{lease_id}' removed"}
    except Exception as e:
        return {"error": f"Failed to remove DHCP lease: {e}"}


# ─────────────────────────────────────────────
#  INTERFACE MANAGEMENT (Read + Write)
# ─────────────────────────────────────────────

@mcp.tool()
def enable_interface(user_id: str, name: str, router: str = "") -> dict:
    """Enable a network interface by name.

    Args:
        user_id: Telegram user ID
        name: Interface name (e.g. 'ether1', 'wlan1')
        router: Router name (empty = default)
    """
    conn = _resolve_connection(user_id, router)
    if "error" in conn:
        return conn
    try:
        with connect_router(conn["host"], conn["port"], conn["username"], conn["password"]) as api:
            ifaces = list(api.path("/interface").select(
                librouteros.query.Key("name") == name
            ))
            if not ifaces:
                return {"error": f"Interface '{name}' not found"}
            api.path("/interface").update(**{".id": ifaces[0][".id"], "disabled": "false"})
            registry.update_last_seen(user_id, conn["name"])
            return {"status": "ok", "message": f"Interface '{name}' enabled"}
    except Exception as e:
        return {"error": f"Failed to enable interface: {e}"}


@mcp.tool()
def disable_interface(user_id: str, name: str, router: str = "") -> dict:
    """Disable a network interface by name.

    Args:
        user_id: Telegram user ID
        name: Interface name (e.g. 'ether1', 'wlan1')
        router: Router name (empty = default)
    """
    conn = _resolve_connection(user_id, router)
    if "error" in conn:
        return conn
    try:
        with connect_router(conn["host"], conn["port"], conn["username"], conn["password"]) as api:
            ifaces = list(api.path("/interface").select(
                librouteros.query.Key("name") == name
            ))
            if not ifaces:
                return {"error": f"Interface '{name}' not found"}
            api.path("/interface").update(**{".id": ifaces[0][".id"], "disabled": "true"})
            registry.update_last_seen(user_id, conn["name"])
            return {"status": "ok", "message": f"Interface '{name}' disabled"}
    except Exception as e:
        return {"error": f"Failed to disable interface: {e}"}


@mcp.tool()
def list_bridge_ports(user_id: str, router: str = "") -> list[dict]:
    """List bridge port assignments.

    Args:
        user_id: Telegram user ID
        router: Router name (empty = default)
    """
    conn = _resolve_connection(user_id, router)
    if "error" in conn:
        return [conn]
    result = _query_path("/interface/bridge/port", conn["host"], conn["port"], conn["username"], conn["password"])
    registry.update_last_seen(user_id, conn["name"])
    return result


@mcp.tool()
def list_vlans(user_id: str, router: str = "") -> list[dict]:
    """List VLAN interfaces.

    Args:
        user_id: Telegram user ID
        router: Router name (empty = default)
    """
    conn = _resolve_connection(user_id, router)
    if "error" in conn:
        return [conn]
    result = _query_path("/interface/vlan", conn["host"], conn["port"], conn["username"], conn["password"])
    registry.update_last_seen(user_id, conn["name"])
    return result


# ─────────────────────────────────────────────
#  FIREWALL MANAGEMENT (Read + Write)
# ─────────────────────────────────────────────

@mcp.tool()
def list_firewall_address_lists(user_id: str, router: str = "") -> list[dict]:
    """List firewall address lists.

    Args:
        user_id: Telegram user ID
        router: Router name (empty = default)
    """
    conn = _resolve_connection(user_id, router)
    if "error" in conn:
        return [conn]
    result = _query_path("/ip/firewall/address-list", conn["host"], conn["port"], conn["username"], conn["password"])
    registry.update_last_seen(user_id, conn["name"])
    return result


@mcp.tool()
def add_to_address_list(user_id: str, list_name: str, address: str, comment: str = "", timeout: str = "", router: str = "") -> dict:
    """Add an IP address to a firewall address list.

    Args:
        user_id: Telegram user ID
        list_name: Name of the address list (e.g. 'blocked', 'whitelist')
        address: IP address or subnet (e.g. '192.168.1.100', '10.0.0.0/24')
        comment: Optional comment
        timeout: Optional timeout (e.g. '1h', '30m', '1d'). Empty = permanent.
        router: Router name (empty = default)
    """
    conn = _resolve_connection(user_id, router)
    if "error" in conn:
        return conn
    try:
        with connect_router(conn["host"], conn["port"], conn["username"], conn["password"]) as api:
            params = {"list": list_name, "address": address}
            if comment:
                params["comment"] = comment
            if timeout:
                params["timeout"] = timeout
            api.path("/ip/firewall/address-list").add(**params)
            registry.update_last_seen(user_id, conn["name"])
            return {"status": "ok", "message": f"Added {address} to address list '{list_name}'"}
    except Exception as e:
        return {"error": f"Failed to add to address list: {e}"}


@mcp.tool()
def remove_from_address_list(user_id: str, entry_id: str, router: str = "") -> dict:
    """Remove an entry from a firewall address list by its .id.

    Args:
        user_id: Telegram user ID
        entry_id: The .id of the address list entry to remove
        router: Router name (empty = default)
    """
    conn = _resolve_connection(user_id, router)
    if "error" in conn:
        return conn
    try:
        with connect_router(conn["host"], conn["port"], conn["username"], conn["password"]) as api:
            api.path("/ip/firewall/address-list").remove(entry_id)
            registry.update_last_seen(user_id, conn["name"])
            return {"status": "ok", "message": f"Removed entry '{entry_id}' from address list"}
    except Exception as e:
        return {"error": f"Failed to remove from address list: {e}"}


@mcp.tool()
def list_firewall_mangle(user_id: str, router: str = "") -> list[dict]:
    """List mangle rules.

    Args:
        user_id: Telegram user ID
        router: Router name (empty = default)
    """
    conn = _resolve_connection(user_id, router)
    if "error" in conn:
        return [conn]
    result = _query_path("/ip/firewall/mangle", conn["host"], conn["port"], conn["username"], conn["password"])
    registry.update_last_seen(user_id, conn["name"])
    return result


@mcp.tool()
def list_connections(user_id: str, router: str = "") -> list[dict]:
    """List active connections (connection tracking). Returns first 100 entries to avoid huge responses.

    Args:
        user_id: Telegram user ID
        router: Router name (empty = default)
    """
    conn = _resolve_connection(user_id, router)
    if "error" in conn:
        return [conn]
    result = _query_path("/ip/firewall/connection", conn["host"], conn["port"], conn["username"], conn["password"])
    registry.update_last_seen(user_id, conn["name"])
    return result[:100]


# ─────────────────────────────────────────────
#  IP MANAGEMENT (Read + Write)
# ─────────────────────────────────────────────

@mcp.tool()
def add_ip_address(user_id: str, address: str, interface: str, comment: str = "", router: str = "") -> dict:
    """Add an IP address to an interface. Example: address='192.168.1.1/24'.

    Args:
        user_id: Telegram user ID
        address: IP address with prefix (e.g. '192.168.1.1/24')
        interface: Interface name to assign the address to (e.g. 'ether1')
        comment: Optional comment
        router: Router name (empty = default)
    """
    conn = _resolve_connection(user_id, router)
    if "error" in conn:
        return conn
    try:
        with connect_router(conn["host"], conn["port"], conn["username"], conn["password"]) as api:
            params = {"address": address, "interface": interface}
            if comment:
                params["comment"] = comment
            api.path("/ip/address").add(**params)
            registry.update_last_seen(user_id, conn["name"])
            return {"status": "ok", "message": f"Added {address} to interface '{interface}'"}
    except Exception as e:
        return {"error": f"Failed to add IP address: {e}"}


@mcp.tool()
def remove_ip_address(user_id: str, address_id: str, router: str = "") -> dict:
    """Remove an IP address by its .id.

    Args:
        user_id: Telegram user ID
        address_id: The .id of the IP address entry to remove
        router: Router name (empty = default)
    """
    conn = _resolve_connection(user_id, router)
    if "error" in conn:
        return conn
    try:
        with connect_router(conn["host"], conn["port"], conn["username"], conn["password"]) as api:
            api.path("/ip/address").remove(address_id)
            registry.update_last_seen(user_id, conn["name"])
            return {"status": "ok", "message": f"Removed IP address '{address_id}'"}
    except Exception as e:
        return {"error": f"Failed to remove IP address: {e}"}


@mcp.tool()
def list_ip_pools(user_id: str, router: str = "") -> list[dict]:
    """List IP address pools.

    Args:
        user_id: Telegram user ID
        router: Router name (empty = default)
    """
    conn = _resolve_connection(user_id, router)
    if "error" in conn:
        return [conn]
    result = _query_path("/ip/pool", conn["host"], conn["port"], conn["username"], conn["password"])
    registry.update_last_seen(user_id, conn["name"])
    return result


@mcp.tool()
def list_ip_services(user_id: str, router: str = "") -> list[dict]:
    """List enabled/disabled IP services (api, ssh, winbox, www, etc.).

    Args:
        user_id: Telegram user ID
        router: Router name (empty = default)
    """
    conn = _resolve_connection(user_id, router)
    if "error" in conn:
        return [conn]
    result = _query_path("/ip/service", conn["host"], conn["port"], conn["username"], conn["password"])
    registry.update_last_seen(user_id, conn["name"])
    return result


# ─────────────────────────────────────────────
#  DHCP EXTENDED (Read + Write)
# ─────────────────────────────────────────────

@mcp.tool()
def list_dhcp_servers(user_id: str, router: str = "") -> list[dict]:
    """List DHCP server configurations.

    Args:
        user_id: Telegram user ID
        router: Router name (empty = default)
    """
    conn = _resolve_connection(user_id, router)
    if "error" in conn:
        return [conn]
    result = _query_path("/ip/dhcp-server", conn["host"], conn["port"], conn["username"], conn["password"])
    registry.update_last_seen(user_id, conn["name"])
    return result


@mcp.tool()
def list_dhcp_networks(user_id: str, router: str = "") -> list[dict]:
    """List DHCP network configurations (gateway, DNS, domain handed out to clients).

    Args:
        user_id: Telegram user ID
        router: Router name (empty = default)
    """
    conn = _resolve_connection(user_id, router)
    if "error" in conn:
        return [conn]
    result = _query_path("/ip/dhcp-server/network", conn["host"], conn["port"], conn["username"], conn["password"])
    registry.update_last_seen(user_id, conn["name"])
    return result


@mcp.tool()
def make_dhcp_static(user_id: str, lease_id: str, router: str = "") -> dict:
    """Convert a dynamic DHCP lease to static. Reads the lease, then creates a static entry
    with the same MAC and address. The original dynamic lease is removed.

    Args:
        user_id: Telegram user ID
        lease_id: The .id of the dynamic lease to make static
        router: Router name (empty = default)
    """
    conn = _resolve_connection(user_id, router)
    if "error" in conn:
        return conn
    try:
        with connect_router(conn["host"], conn["port"], conn["username"], conn["password"]) as api:
            # First try the make-static command via generic API call
            try:
                params = {".id": lease_id}
                list(api.rawCmd("/ip/dhcp-server/lease/make-static", **params))
                registry.update_last_seen(user_id, conn["name"])
                return {"status": "ok", "message": f"Lease '{lease_id}' converted to static"}
            except Exception:
                # Fallback: read lease details, remove dynamic, add static
                leases = list(api.path("/ip/dhcp-server/lease").select(
                    librouteros.query.Key(".id") == lease_id
                ))
                if not leases:
                    return {"error": f"Lease '{lease_id}' not found"}
                lease = leases[0]
                mac = lease.get("mac-address")
                address = lease.get("address") or lease.get("active-address")
                server = lease.get("server", "")
                if not mac or not address:
                    return {"error": "Lease missing MAC or address — cannot convert"}
                params = {
                    "address": address,
                    "mac-address": mac,
                }
                if server:
                    params["server"] = server
                api.path("/ip/dhcp-server/lease").add(**params)
                registry.update_last_seen(user_id, conn["name"])
                return {"status": "ok", "message": f"Static lease created for {mac} -> {address}"}
    except Exception as e:
        return {"error": f"Failed to make lease static: {e}"}


# ─────────────────────────────────────────────
#  DNS MANAGEMENT (Read + Write)
# ─────────────────────────────────────────────

@mcp.tool()
def list_dns_static(user_id: str, router: str = "") -> list[dict]:
    """List static DNS entries.

    Args:
        user_id: Telegram user ID
        router: Router name (empty = default)
    """
    conn = _resolve_connection(user_id, router)
    if "error" in conn:
        return [conn]
    result = _query_path("/ip/dns/static", conn["host"], conn["port"], conn["username"], conn["password"])
    registry.update_last_seen(user_id, conn["name"])
    return result


@mcp.tool()
def add_dns_static(user_id: str, name: str, address: str, router: str = "") -> dict:
    """Add a static DNS entry.

    Args:
        user_id: Telegram user ID
        name: DNS hostname (e.g. 'myserver.local')
        address: IP address to resolve to (e.g. '192.168.1.100')
        router: Router name (empty = default)
    """
    conn = _resolve_connection(user_id, router)
    if "error" in conn:
        return conn
    try:
        with connect_router(conn["host"], conn["port"], conn["username"], conn["password"]) as api:
            api.path("/ip/dns/static").add(name=name, address=address)
            registry.update_last_seen(user_id, conn["name"])
            return {"status": "ok", "message": f"DNS static entry added: {name} -> {address}"}
    except Exception as e:
        return {"error": f"Failed to add DNS entry: {e}"}


@mcp.tool()
def remove_dns_static(user_id: str, entry_id: str, router: str = "") -> dict:
    """Remove a static DNS entry by its .id.

    Args:
        user_id: Telegram user ID
        entry_id: The .id of the DNS static entry to remove
        router: Router name (empty = default)
    """
    conn = _resolve_connection(user_id, router)
    if "error" in conn:
        return conn
    try:
        with connect_router(conn["host"], conn["port"], conn["username"], conn["password"]) as api:
            api.path("/ip/dns/static").remove(entry_id)
            registry.update_last_seen(user_id, conn["name"])
            return {"status": "ok", "message": f"DNS static entry '{entry_id}' removed"}
    except Exception as e:
        return {"error": f"Failed to remove DNS entry: {e}"}


# ─────────────────────────────────────────────
#  HOTSPOT EXTENDED (Read)
# ─────────────────────────────────────────────

@mcp.tool()
def list_hotspot_profiles(user_id: str, router: str = "") -> list[dict]:
    """List hotspot user profiles with rate limits.

    Args:
        user_id: Telegram user ID
        router: Router name (empty = default)
    """
    conn = _resolve_connection(user_id, router)
    if "error" in conn:
        return [conn]
    result = _query_path("/ip/hotspot/profile", conn["host"], conn["port"], conn["username"], conn["password"])
    registry.update_last_seen(user_id, conn["name"])
    return result


@mcp.tool()
def list_hotspot_ip_bindings(user_id: str, router: str = "") -> list[dict]:
    """List hotspot IP bindings (bypass/block rules).

    Args:
        user_id: Telegram user ID
        router: Router name (empty = default)
    """
    conn = _resolve_connection(user_id, router)
    if "error" in conn:
        return [conn]
    result = _query_path("/ip/hotspot/ip-binding", conn["host"], conn["port"], conn["username"], conn["password"])
    registry.update_last_seen(user_id, conn["name"])
    return result


# ─────────────────────────────────────────────
#  PPP / VPN (Read + Write)
# ─────────────────────────────────────────────

@mcp.tool()
def list_ppp_active(user_id: str, router: str = "") -> list[dict]:
    """List active PPP/VPN connections.

    Args:
        user_id: Telegram user ID
        router: Router name (empty = default)
    """
    conn = _resolve_connection(user_id, router)
    if "error" in conn:
        return [conn]
    result = _query_path("/ppp/active", conn["host"], conn["port"], conn["username"], conn["password"])
    registry.update_last_seen(user_id, conn["name"])
    return result


@mcp.tool()
def list_ppp_secrets(user_id: str, router: str = "") -> list[dict]:
    """List PPP user accounts (PPPoE, PPTP, L2TP, etc.). Passwords are stripped from output.

    Args:
        user_id: Telegram user ID
        router: Router name (empty = default)
    """
    conn = _resolve_connection(user_id, router)
    if "error" in conn:
        return [conn]
    rows = _query_path("/ppp/secret", conn["host"], conn["port"], conn["username"], conn["password"])
    registry.update_last_seen(user_id, conn["name"])
    # Strip passwords from output for security
    for row in rows:
        row.pop("password", None)
    return rows


@mcp.tool()
def add_ppp_secret(user_id: str, name: str, password: str, service: str = "any", profile: str = "default", router: str = "") -> dict:
    """Add a PPP user account (PPPoE, PPTP, L2TP, etc.).

    Args:
        user_id: Telegram user ID
        name: Username for the PPP account
        password: Password for the PPP account
        service: Service type — 'any', 'pppoe', 'pptp', 'l2tp', etc. (default: 'any')
        profile: PPP profile to assign (default: 'default')
        router: Router name (empty = default)
    """
    conn = _resolve_connection(user_id, router)
    if "error" in conn:
        return conn
    try:
        with connect_router(conn["host"], conn["port"], conn["username"], conn["password"]) as api:
            api.path("/ppp/secret").add(
                name=name, password=password, service=service, profile=profile
            )
            registry.update_last_seen(user_id, conn["name"])
            return {"status": "ok", "message": f"PPP secret '{name}' created (service={service}, profile={profile})"}
    except Exception as e:
        return {"error": f"Failed to add PPP secret: {e}"}


@mcp.tool()
def remove_ppp_secret(user_id: str, name: str, router: str = "") -> dict:
    """Remove a PPP user account by name.

    Args:
        user_id: Telegram user ID
        name: Username of the PPP secret to remove
        router: Router name (empty = default)
    """
    conn = _resolve_connection(user_id, router)
    if "error" in conn:
        return conn
    try:
        with connect_router(conn["host"], conn["port"], conn["username"], conn["password"]) as api:
            secrets = list(api.path("/ppp/secret").select(
                librouteros.query.Key("name") == name
            ))
            if not secrets:
                return {"error": f"PPP secret '{name}' not found"}
            api.path("/ppp/secret").remove(secrets[0][".id"])
            registry.update_last_seen(user_id, conn["name"])
            return {"status": "ok", "message": f"PPP secret '{name}' removed"}
    except Exception as e:
        return {"error": f"Failed to remove PPP secret: {e}"}


@mcp.tool()
def kick_ppp_user(user_id: str, session_id: str, router: str = "") -> dict:
    """Disconnect an active PPP session by its .id.

    Args:
        user_id: Telegram user ID
        session_id: The .id of the active PPP session to disconnect
        router: Router name (empty = default)
    """
    conn = _resolve_connection(user_id, router)
    if "error" in conn:
        return conn
    try:
        with connect_router(conn["host"], conn["port"], conn["username"], conn["password"]) as api:
            api.path("/ppp/active").remove(session_id)
            registry.update_last_seen(user_id, conn["name"])
            return {"status": "ok", "message": f"PPP session '{session_id}' disconnected"}
    except Exception as e:
        return {"error": f"Failed to kick PPP user: {e}"}


# ─────────────────────────────────────────────
#  SYSTEM EXTENDED (Read + Write)
# ─────────────────────────────────────────────

@mcp.tool()
def get_system_clock(user_id: str, router: str = "") -> dict:
    """Get router date and time.

    Args:
        user_id: Telegram user ID
        router: Router name (empty = default)
    """
    conn = _resolve_connection(user_id, router)
    if "error" in conn:
        return conn
    rows = _query_path("/system/clock", conn["host"], conn["port"], conn["username"], conn["password"])
    registry.update_last_seen(user_id, conn["name"])
    return rows[0] if rows else {"error": "No clock data returned"}


@mcp.tool()
def list_system_scheduler(user_id: str, router: str = "") -> list[dict]:
    """List scheduled tasks.

    Args:
        user_id: Telegram user ID
        router: Router name (empty = default)
    """
    conn = _resolve_connection(user_id, router)
    if "error" in conn:
        return [conn]
    result = _query_path("/system/scheduler", conn["host"], conn["port"], conn["username"], conn["password"])
    registry.update_last_seen(user_id, conn["name"])
    return result


@mcp.tool()
def list_system_scripts(user_id: str, router: str = "") -> list[dict]:
    """List RouterOS scripts.

    Args:
        user_id: Telegram user ID
        router: Router name (empty = default)
    """
    conn = _resolve_connection(user_id, router)
    if "error" in conn:
        return [conn]
    result = _query_path("/system/script", conn["host"], conn["port"], conn["username"], conn["password"])
    registry.update_last_seen(user_id, conn["name"])
    return result


@mcp.tool()
def run_system_script(user_id: str, script_name: str, router: str = "") -> dict:
    """Run a named RouterOS script. DANGEROUS — ensure you know what the script does before running it.

    Args:
        user_id: Telegram user ID
        script_name: Name of the script to run
        router: Router name (empty = default)
    """
    conn = _resolve_connection(user_id, router)
    if "error" in conn:
        return conn
    try:
        with connect_router(conn["host"], conn["port"], conn["username"], conn["password"]) as api:
            scripts = list(api.path("/system/script").select(
                librouteros.query.Key("name") == script_name
            ))
            if not scripts:
                return {"error": f"Script '{script_name}' not found"}
            script_id = scripts[0][".id"]
            list(api.rawCmd("/system/script/run", **{".id": script_id}))
            registry.update_last_seen(user_id, conn["name"])
            return {"status": "ok", "message": f"Script '{script_name}' executed"}
    except Exception as e:
        return {"error": f"Failed to run script: {e}"}


@mcp.tool()
def list_system_users(user_id: str, router: str = "") -> list[dict]:
    """List RouterOS user accounts. Passwords are not included.

    Args:
        user_id: Telegram user ID
        router: Router name (empty = default)
    """
    conn = _resolve_connection(user_id, router)
    if "error" in conn:
        return [conn]
    rows = _query_path("/user", conn["host"], conn["port"], conn["username"], conn["password"])
    registry.update_last_seen(user_id, conn["name"])
    # Strip passwords for security
    for row in rows:
        row.pop("password", None)
    return rows


@mcp.tool()
def get_system_health(user_id: str, router: str = "") -> dict:
    """Get hardware health info (voltage, temperature if available). Not all models support this.

    Args:
        user_id: Telegram user ID
        router: Router name (empty = default)
    """
    conn = _resolve_connection(user_id, router)
    if "error" in conn:
        return conn
    try:
        rows = _query_path("/system/health", conn["host"], conn["port"], conn["username"], conn["password"])
        registry.update_last_seen(user_id, conn["name"])
        if rows and len(rows) == 1:
            return rows[0]
        # RouterOS v7 returns list of name/value pairs
        if rows and "name" in rows[0]:
            return {r["name"]: r.get("value", "") for r in rows}
        return rows[0] if rows else {"info": "No health data available on this device"}
    except Exception:
        return {"info": "Health monitoring not supported on this device"}


@mcp.tool()
def get_system_routerboard(user_id: str, router: str = "") -> dict:
    """Get RouterBoard hardware info (model, serial number, firmware versions).

    Args:
        user_id: Telegram user ID
        router: Router name (empty = default)
    """
    conn = _resolve_connection(user_id, router)
    if "error" in conn:
        return conn
    try:
        rows = _query_path("/system/routerboard", conn["host"], conn["port"], conn["username"], conn["password"])
        registry.update_last_seen(user_id, conn["name"])
        return rows[0] if rows else {"info": "Not a RouterBoard device"}
    except Exception:
        return {"info": "RouterBoard info not available (may be a non-RB device like x86)"}


@mcp.tool()
def reboot_router(user_id: str, router: str = "") -> dict:
    """Reboot the router. DANGEROUS — the router will go offline for 1-3 minutes.
    Only use when explicitly requested by the user.

    Args:
        user_id: Telegram user ID
        router: Router name (empty = default)
    """
    conn = _resolve_connection(user_id, router)
    if "error" in conn:
        return conn
    try:
        with connect_router(conn["host"], conn["port"], conn["username"], conn["password"]) as api:
            registry.update_last_seen(user_id, conn["name"])
            list(api.rawCmd("/system/reboot"))
            return {"status": "ok", "message": f"Router '{conn['name']}' is rebooting. It will be offline for 1-3 minutes."}
    except Exception as e:
        # Connection may drop during reboot — that's expected
        err_str = str(e).lower()
        if "connection" in err_str or "closed" in err_str or "eof" in err_str:
            return {"status": "ok", "message": f"Router '{conn['name']}' is rebooting (connection dropped as expected)."}
        return {"error": f"Failed to reboot router: {e}"}


# ─────────────────────────────────────────────
#  TOOLS — Diagnostic
#  NOTE: ping_from_router and list_torch are SKIPPED.
#  /tool/ping and /tool/torch are streaming commands in RouterOS
#  that require async/streaming handling not compatible with
#  synchronous MCP stdio transport. Use run_routeros_query as a
#  workaround if needed, though results may be incomplete.
# ─────────────────────────────────────────────


# ─────────────────────────────────────────────
#  QUEUE EXTENDED (Read + Write)
# ─────────────────────────────────────────────

@mcp.tool()
def add_simple_queue(user_id: str, name: str, target: str, max_limit: str, router: str = "") -> dict:
    """Add a simple queue (bandwidth limit).

    Args:
        user_id: Telegram user ID
        name: Queue name (e.g. 'limit-john')
        target: Target IP or subnet (e.g. '192.168.1.100/32')
        max_limit: Upload/download limit (e.g. '5M/10M' for 5Mbps up / 10Mbps down)
        router: Router name (empty = default)
    """
    conn = _resolve_connection(user_id, router)
    if "error" in conn:
        return conn
    try:
        with connect_router(conn["host"], conn["port"], conn["username"], conn["password"]) as api:
            api.path("/queue/simple").add(
                name=name, target=target, **{"max-limit": max_limit}
            )
            registry.update_last_seen(user_id, conn["name"])
            return {"status": "ok", "message": f"Simple queue '{name}' created: target={target}, max-limit={max_limit}"}
    except Exception as e:
        return {"error": f"Failed to add simple queue: {e}"}


@mcp.tool()
def remove_simple_queue(user_id: str, queue_id: str, router: str = "") -> dict:
    """Remove a simple queue by its .id.

    Args:
        user_id: Telegram user ID
        queue_id: The .id of the queue to remove
        router: Router name (empty = default)
    """
    conn = _resolve_connection(user_id, router)
    if "error" in conn:
        return conn
    try:
        with connect_router(conn["host"], conn["port"], conn["username"], conn["password"]) as api:
            api.path("/queue/simple").remove(queue_id)
            registry.update_last_seen(user_id, conn["name"])
            return {"status": "ok", "message": f"Simple queue '{queue_id}' removed"}
    except Exception as e:
        return {"error": f"Failed to remove simple queue: {e}"}


@mcp.tool()
def enable_simple_queue(user_id: str, queue_id: str, router: str = "") -> dict:
    """Enable a disabled simple queue.

    Args:
        user_id: Telegram user ID
        queue_id: The .id of the queue to enable
        router: Router name (empty = default)
    """
    conn = _resolve_connection(user_id, router)
    if "error" in conn:
        return conn
    try:
        with connect_router(conn["host"], conn["port"], conn["username"], conn["password"]) as api:
            api.path("/queue/simple").update(**{".id": queue_id, "disabled": "false"})
            registry.update_last_seen(user_id, conn["name"])
            return {"status": "ok", "message": f"Simple queue '{queue_id}' enabled"}
    except Exception as e:
        return {"error": f"Failed to enable simple queue: {e}"}


@mcp.tool()
def disable_simple_queue(user_id: str, queue_id: str, router: str = "") -> dict:
    """Disable a simple queue (stops bandwidth limiting without removing the rule).

    Args:
        user_id: Telegram user ID
        queue_id: The .id of the queue to disable
        router: Router name (empty = default)
    """
    conn = _resolve_connection(user_id, router)
    if "error" in conn:
        return conn
    try:
        with connect_router(conn["host"], conn["port"], conn["username"], conn["password"]) as api:
            api.path("/queue/simple").update(**{".id": queue_id, "disabled": "true"})
            registry.update_last_seen(user_id, conn["name"])
            return {"status": "ok", "message": f"Simple queue '{queue_id}' disabled"}
    except Exception as e:
        return {"error": f"Failed to disable simple queue: {e}"}


# ─────────────────────────────────────────────
#  MONITORING TOOLS
# ─────────────────────────────────────────────

@mcp.tool()
def check_all_routers_health(user_id: str) -> list[dict]:
    """Check connectivity and basic health of ALL registered routers for this user.
    Returns status (online/offline), CPU, memory, uptime, and active clients for each router.
    Useful for quick overview or scheduled health reports.

    Args:
        user_id: Telegram user ID
    """
    try:
        all_routers = registry.resolve(user_id, "all")
    except ValueError:
        return [{"error": "No routers registered"}]

    results = []
    for router_conn in all_routers:
        name = router_conn.get("name", "unknown")
        status = {"name": name, "status": "offline"}
        try:
            with connect_router(router_conn["host"], router_conn["port"],
                              router_conn["username"], router_conn["password"]) as api:
                # System resource
                resource = list(api.path("/system/resource"))
                if resource:
                    r = resource[0]
                    total_mem = int(r.get("total-memory", 0))
                    free_mem = int(r.get("free-memory", 0))
                    used_pct = round((total_mem - free_mem) / total_mem * 100) if total_mem else 0
                    status.update({
                        "status": "online",
                        "cpu_load": r.get("cpu-load"),
                        "memory_percent": used_pct,
                        "uptime": r.get("uptime"),
                        "version": r.get("version"),
                    })

                # Active clients count
                leases = list(api.path("/ip/dhcp-server/lease"))
                active = len([l for l in leases if l.get("status") == "bound"])
                status["active_clients"] = active

                # Alerts
                alerts = []
                cpu = status.get("cpu_load", 0)
                if isinstance(cpu, (int, float)) and cpu > 80:
                    alerts.append(f"CPU tinggi: {cpu}%")
                if used_pct > 90:
                    alerts.append(f"Memory kritis: {used_pct}%")
                if alerts:
                    status["alerts"] = alerts

                registry.update_last_seen(user_id, name,
                    routeros_version=r.get("version", ""),
                    board=r.get("board-name", ""))
        except Exception as e:
            status["error"] = str(e)

        results.append(status)

    return results


# ─────────────────────────────────────────────
#  ENTRY POINT
# ─────────────────────────────────────────────

if __name__ == "__main__":
    mcp.run(transport="stdio")
