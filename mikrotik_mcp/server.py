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
import random
import socket
import string
import time
from contextlib import contextmanager
from datetime import datetime, timezone
from typing import Any

import librouteros
from librouteros.query import Key
from mcp.server.fastmcp import FastMCP

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
logger = logging.getLogger(__name__)

# --- Configuration ---
DATA_DIR = os.environ.get("DATA_DIR", "/app/data")
DATABASE_URL = os.environ.get("DATABASE_URL", "")

if DATABASE_URL:
    from registry_pg import RouterRegistryPG
    registry = RouterRegistryPG(database_url=DATABASE_URL)
    logger.info("Using PostgreSQL registry")
else:
    from registry import RouterRegistry
    registry = RouterRegistry(data_dir=DATA_DIR)
    logger.info("Using JSON file registry")

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
    api = None
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
            break
        except (socket.gaierror, OSError, librouteros.exceptions.ConnectionClosed) as e:
            last_err = e
            _resolved_ips.pop(host, None)  # force re-resolve
            if attempt < retries:
                time.sleep(1)
                logger.warning("Retry %d/%d for %s:%d after: %s", attempt + 1, retries, host, port, e)
    if api is None:
        raise last_err
    try:
        yield api
    finally:
        api.close()


def _query_path(path: str, host: str, port: int, username: str, password: str, where: dict | None = None) -> list[dict]:
    """Generic helper: query a RouterOS API path and return rows as dicts."""
    with connect_router(host, port, username, password) as api:
        resource = api.path(path)
        if where:
            conditions = tuple(Key(k) == v for k, v in where.items())
            return list(resource.select().where(*conditions))
        return list(resource)


def _format_bytes(n: int | str) -> str:
    n = int(n)
    for unit in ("B", "KB", "MB", "GB"):
        if n < 1024:
            return f"{n:.1f} {unit}"
        n /= 1024
    return f"{n:.1f} TB"


def _parse_ros_time(s: str) -> int:
    """Parse RouterOS time string (e.g., '1h30m', '2d3h', '45m10s') to seconds."""
    if not s:
        return 0
    total = 0
    num = ""
    for ch in s:
        if ch.isdigit():
            num += ch
        else:
            if num:
                n = int(num)
                if ch == "w":
                    total += n * 604800
                elif ch == "d":
                    total += n * 86400
                elif ch == "h":
                    total += n * 3600
                elif ch == "m":
                    total += n * 60
                elif ch == "s":
                    total += n
                num = ""
    if num:
        total += int(num)
    return total


def _parse_ros_bytes(s: str) -> int:
    """Parse RouterOS byte string (e.g., '100M', '1G', '500K', '1048576') to bytes."""
    if not s:
        return 0
    s = s.strip().upper()
    multipliers = {"K": 1024, "M": 1024**2, "G": 1024**3, "T": 1024**4}
    if s[-1] in multipliers:
        try:
            return int(float(s[:-1]) * multipliers[s[-1]])
        except ValueError:
            return 0
    try:
        return int(s)
    except ValueError:
        return 0


def _normalize_bytes_input(value: str) -> str:
    """Convert human-friendly byte strings ('500M', '1G') to integer byte strings for RouterOS."""
    if not value:
        return value
    stripped = value.strip()
    try:
        int(stripped)
        return stripped
    except ValueError:
        pass
    result = _parse_ros_bytes(stripped)
    return str(result) if result > 0 else stripped


def _validate_user_id(user_id: str) -> str | None:
    """Return an error message if user_id looks like a group chat ID, else None."""
    try:
        uid = int(user_id)
    except (ValueError, TypeError):
        return f"Invalid user_id '{user_id}'. Must be a numeric Telegram user ID."
    if uid < 0:
        return (
            f"ERROR: user_id '{user_id}' is a Telegram GROUP CHAT ID (negative number). "
            "You MUST use the SENDER's personal Telegram user ID (positive number) instead. "
            "Look at the message metadata for the sender's numeric ID."
        )
    return None


def _resolve_connection(user_id: str, router: str = "") -> dict:
    """Resolve user_id + router name to connection details.

    Returns dict with host, port, username, password, name.
    On error returns dict with 'error' key.
    """
    err = _validate_user_id(user_id)
    if err:
        return {"error": err}
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
        user_id: Telegram user ID (must be the sender's PERSONAL ID, not a group chat ID)
    """
    err = _validate_user_id(user_id)
    if err:
        return [{"error": err}]
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
def list_hotspot_users(user_id: str, profile: str = "", router: str = "") -> list[dict]:
    """List configured hotspot user accounts. Always filter by profile when the user asks for users
    in a specific profile — do NOT list all users if a profile is mentioned.

    Args:
        user_id: Telegram user ID (required)
        profile: Filter by profile name (e.g., 'free xxx', 'Premium'). Empty = return all (warning: can be thousands).
        router: Router name. Empty = default router.
    """
    conn = _resolve_connection(user_id, router)
    if "error" in conn:
        return [conn]
    try:
        with connect_router(conn["host"], conn["port"], conn["username"], conn["password"]) as api:
            resource = api.path("ip", "hotspot", "user")
            if profile:
                rows = list(resource.select().where(Key("profile") == profile))
            else:
                rows = list(resource)
            registry.update_last_seen(user_id, conn["name"])
            return [
                {
                    "name": r.get("name"),
                    "profile": r.get("profile"),
                    "server": r.get("server", ""),
                    "limit_uptime": r.get("limit-uptime", ""),
                    "limit_bytes_total": r.get("limit-bytes-total", ""),
                    "disabled": r.get("disabled"),
                    "comment": r.get("comment", ""),
                }
                for r in rows
            ]
    except Exception as e:
        return [{"error": f"Failed to list hotspot users: {e}"}]


@mcp.tool()
def count_hotspot_users(user_id: str, profile: str = "", router: str = "") -> dict:
    """Count total hotspot users (without listing all of them). Much faster for large user lists.
    When counting users in a specific profile, always pass the profile parameter.

    Args:
        user_id: Telegram user ID (required)
        profile: Filter by profile name. Empty = count all profiles.
        router: Router name. Empty = default router.
    """
    conn = _resolve_connection(user_id, router)
    if "error" in conn:
        return conn
    try:
        with connect_router(conn["host"], conn["port"], conn["username"], conn["password"]) as api:
            resource = api.path("ip", "hotspot", "user")
            if profile:
                rows = list(resource.select().where(Key("profile") == profile))
            else:
                rows = list(resource)
            registry.update_last_seen(user_id, conn["name"])
            total = len(rows)
            enabled = len([r for r in rows if r.get("disabled", "false") != "true"])
            disabled = total - enabled
            result = {"total_users": total, "enabled": enabled, "disabled": disabled}
            if profile:
                result["profile"] = profile
            return result
    except Exception as e:
        return {"error": f"Failed to count hotspot users: {e}"}


@mcp.tool()
def count_hotspot_active(user_id: str, router: str = "") -> dict:
    """Count currently active/online hotspot sessions.

    Args:
        user_id: Telegram user ID (required)
        router: Router name. Empty = default router.
    """
    conn = _resolve_connection(user_id, router)
    if "error" in conn:
        return conn
    try:
        rows = _query_path("/ip/hotspot/active", conn["host"], conn["port"], conn["username"], conn["password"])
        registry.update_last_seen(user_id, conn["name"])
        return {"active_sessions": len(rows)}
    except Exception as e:
        return {"error": f"Failed to count active hotspot sessions: {e}"}


@mcp.tool()
def add_hotspot_user(user_id: str, username: str, password: str, profile: str = "default",
                     server: str = "", limit_uptime: str = "", limit_bytes_total: str = "",
                     limit_bytes_in: str = "", limit_bytes_out: str = "",
                     comment: str = "", address: str = "", mac_address: str = "",
                     email: str = "", router: str = "") -> dict:
    """Add a new hotspot user account.

    Args:
        user_id: Telegram user ID (required)
        username: The login username for the hotspot user
        password: The login password
        profile: Hotspot user profile to assign (default: "default")
        server: Hotspot server name to assign user to. Empty = default 'all'.
        limit_uptime: Max online time (e.g., '1h', '3h', '1d'). Empty = unlimited.
        limit_bytes_total: Total data limit (e.g., '500M', '1G'). Empty = unlimited.
        limit_bytes_in: Download data limit (e.g., '500M', '1G'). Empty = unlimited.
        limit_bytes_out: Upload data limit (e.g., '100M', '500M'). Empty = unlimited.
        comment: Comment text for this user.
        address: Static IP address binding (e.g., '10.10.8.100'). Empty = no binding.
        mac_address: MAC address binding (e.g., 'AA:BB:CC:DD:EE:FF'). Empty = no binding.
        email: User's email address.
        router: Router name. Empty = default router.
    """
    conn = _resolve_connection(user_id, router)
    if "error" in conn:
        return conn
    try:
        with connect_router(conn["host"], conn["port"], conn["username"], conn["password"]) as api:
            profiles = list(api.path("ip", "hotspot", "user", "profile"))
            profile_names = [p.get("name", "") for p in profiles]
            if profile and profile not in profile_names:
                return {"error": f"Profile '{profile}' not found. Available profiles: {', '.join(profile_names)}. Try one of these instead."}
            if server:
                servers = list(api.path("ip", "hotspot"))
                server_names = [s.get("name", "") for s in servers]
                if server not in server_names:
                    return {"error": f"Hotspot server '{server}' not found. Available: {', '.join(server_names)}"}
            params: dict[str, str] = {"name": username, "password": password, "profile": profile}
            if server:
                params["server"] = server
            if limit_uptime:
                params["limit-uptime"] = limit_uptime
            if limit_bytes_total:
                params["limit-bytes-total"] = _normalize_bytes_input(limit_bytes_total)
            if limit_bytes_in:
                params["limit-bytes-in"] = _normalize_bytes_input(limit_bytes_in)
            if limit_bytes_out:
                params["limit-bytes-out"] = _normalize_bytes_input(limit_bytes_out)
            if comment:
                params["comment"] = comment
            if address:
                params["address"] = address
            if mac_address:
                params["mac-address"] = mac_address
            if email:
                params["email"] = email
            resource = api.path("ip", "hotspot", "user")
            resource.add(**params)
            registry.update_last_seen(user_id, conn["name"])
            extras = []
            if limit_uptime:
                extras.append(f"uptime={limit_uptime}")
            if limit_bytes_total:
                extras.append(f"data={limit_bytes_total}")
            if server:
                extras.append(f"server={server}")
            extra_info = f" ({', '.join(extras)})" if extras else ""
            return {"status": "ok", "message": f"Hotspot user '{username}' created with profile '{profile}'{extra_info}"}
    except Exception as e:
        err = str(e)
        if "already" in err.lower() or "exists" in err.lower():
            return {"error": f"User '{username}' already exists. Use a different name or remove the existing one first."}
        return {"error": f"Failed to add hotspot user: {err}"}


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
    try:
        with connect_router(conn["host"], conn["port"], conn["username"], conn["password"]) as api:
            resource = api.path("ip", "hotspot", "user")
            users = list(resource.select().where(Key("name") == username))
            if not users:
                return {"error": f"User '{username}' not found. Check the exact username spelling."}
            resource.remove(users[0][".id"])
            registry.update_last_seen(user_id, conn["name"])
            return {"status": "ok", "message": f"Hotspot user '{username}' removed"}
    except Exception as e:
        return {"error": f"Failed to remove hotspot user: {e}"}


@mcp.tool()
def enable_hotspot_user(user_id: str, username: str, router: str = "") -> dict:
    """Enable a disabled hotspot user account (reactivate suspended user).

    Args:
        user_id: Telegram user ID (required)
        username: The username to enable
        router: Router name. Empty = default router.
    """
    conn = _resolve_connection(user_id, router)
    if "error" in conn:
        return conn
    try:
        with connect_router(conn["host"], conn["port"], conn["username"], conn["password"]) as api:
            resource = api.path("ip", "hotspot", "user")
            users = list(resource.select().where(Key("name") == username))
            if not users:
                return {"error": f"User '{username}' not found."}
            resource.update(**{".id": users[0][".id"], "disabled": "false"})
            registry.update_last_seen(user_id, conn["name"])
            return {"status": "ok", "message": f"Hotspot user '{username}' enabled"}
    except Exception as e:
        return {"error": f"Failed to enable hotspot user: {e}"}


@mcp.tool()
def disable_hotspot_user(user_id: str, username: str, router: str = "") -> dict:
    """Disable (suspend) a hotspot user account without deleting it.

    Args:
        user_id: Telegram user ID (required)
        username: The username to disable/suspend
        router: Router name. Empty = default router.
    """
    conn = _resolve_connection(user_id, router)
    if "error" in conn:
        return conn
    try:
        with connect_router(conn["host"], conn["port"], conn["username"], conn["password"]) as api:
            resource = api.path("ip", "hotspot", "user")
            users = list(resource.select().where(Key("name") == username))
            if not users:
                return {"error": f"User '{username}' not found."}
            resource.update(**{".id": users[0][".id"], "disabled": "true"})
            registry.update_last_seen(user_id, conn["name"])
            return {"status": "ok", "message": f"Hotspot user '{username}' disabled/suspended"}
    except Exception as e:
        return {"error": f"Failed to disable hotspot user: {e}"}


@mcp.tool()
def update_hotspot_user(user_id: str, username: str, new_password: str = "", new_profile: str = "",
                        new_name: str = "", server: str = "", limit_uptime: str = "",
                        limit_bytes_total: str = "", limit_bytes_in: str = "", limit_bytes_out: str = "",
                        comment: str = "", address: str = "", mac_address: str = "",
                        email: str = "", disabled: str = "", router: str = "") -> dict:
    """Update an existing hotspot user (change any field).

    Args:
        user_id: Telegram user ID (required)
        username: Current username to update
        new_password: New password. Empty = don't change.
        new_profile: New profile name. Empty = don't change.
        new_name: New username. Empty = don't change.
        server: New hotspot server assignment. Empty = don't change.
        limit_uptime: New uptime limit (e.g., '1h', '3h', '1d'). Empty = don't change. Use '0s' to clear.
        limit_bytes_total: New total data limit (e.g., '500M', '1G'). Empty = don't change. Use '0' to clear.
        limit_bytes_in: New download limit (e.g., '500M'). Empty = don't change. Use '0' to clear.
        limit_bytes_out: New upload limit (e.g., '100M'). Empty = don't change. Use '0' to clear.
        comment: New comment. Empty = don't change.
        address: New IP binding (e.g., '10.10.8.100'). Empty = don't change.
        mac_address: New MAC binding (e.g., 'AA:BB:CC:DD:EE:FF'). Empty = don't change.
        email: New email. Empty = don't change.
        disabled: Set 'true' to disable, 'false' to enable. Empty = don't change.
        router: Router name. Empty = default router.
    """
    conn = _resolve_connection(user_id, router)
    if "error" in conn:
        return conn
    try:
        with connect_router(conn["host"], conn["port"], conn["username"], conn["password"]) as api:
            resource = api.path("ip", "hotspot", "user")
            users = list(resource.select().where(Key("name") == username))
            if not users:
                return {"error": f"User '{username}' not found."}
            update_params: dict = {".id": users[0][".id"]}
            changes = []
            if new_password:
                update_params["password"] = new_password
                changes.append("password")
            if new_profile:
                profiles = list(api.path("ip", "hotspot", "user", "profile"))
                profile_names = [p.get("name", "") for p in profiles]
                if new_profile not in profile_names:
                    return {"error": f"Profile '{new_profile}' not found. Available: {', '.join(profile_names)}"}
                update_params["profile"] = new_profile
                changes.append(f"profile→{new_profile}")
            if new_name:
                update_params["name"] = new_name
                changes.append(f"name→{new_name}")
            if server:
                servers = list(api.path("ip", "hotspot"))
                server_names = [s.get("name", "") for s in servers]
                if server not in server_names:
                    return {"error": f"Hotspot server '{server}' not found. Available: {', '.join(server_names)}"}
                update_params["server"] = server
                changes.append(f"server→{server}")
            if limit_uptime:
                update_params["limit-uptime"] = limit_uptime
                changes.append(f"limit-uptime={limit_uptime}")
            if limit_bytes_total:
                update_params["limit-bytes-total"] = _normalize_bytes_input(limit_bytes_total)
                changes.append(f"limit-bytes-total={limit_bytes_total}")
            if limit_bytes_in:
                update_params["limit-bytes-in"] = _normalize_bytes_input(limit_bytes_in)
                changes.append(f"limit-bytes-in={limit_bytes_in}")
            if limit_bytes_out:
                update_params["limit-bytes-out"] = _normalize_bytes_input(limit_bytes_out)
                changes.append(f"limit-bytes-out={limit_bytes_out}")
            if comment:
                update_params["comment"] = comment
                changes.append("comment updated")
            if address:
                update_params["address"] = address
                changes.append(f"address={address}")
            if mac_address:
                update_params["mac-address"] = mac_address
                changes.append(f"mac-address={mac_address}")
            if email:
                update_params["email"] = email
                changes.append(f"email={email}")
            if disabled:
                update_params["disabled"] = disabled
                changes.append(f"disabled={disabled}")
            if not changes:
                return {"error": "No changes specified."}
            resource.update(**update_params)
            registry.update_last_seen(user_id, conn["name"])
            return {"status": "ok", "message": f"User '{username}' updated: {', '.join(changes)}"}
    except Exception as e:
        return {"error": f"Failed to update hotspot user: {e}"}


@mcp.tool()
def search_hotspot_user(user_id: str, username: str, router: str = "") -> list[dict]:
    """Search for a specific hotspot user by name (exact or partial match).

    Args:
        user_id: Telegram user ID (required)
        username: Username to search for
        router: Router name. Empty = default router.
    """
    conn = _resolve_connection(user_id, router)
    if "error" in conn:
        return [conn]
    try:
        with connect_router(conn["host"], conn["port"], conn["username"], conn["password"]) as api:
            resource = api.path("ip", "hotspot", "user")
            # Try exact match first (server-side filter)
            users = list(resource.select().where(Key("name") == username))
            if not users:
                # Fallback: partial/case-insensitive match (local scan)
                all_users = list(resource)
                users = [u for u in all_users if username.lower() in u.get("name", "").lower()]
            registry.update_last_seen(user_id, conn["name"])
            return [
                {
                    "name": u.get("name"),
                    "profile": u.get("profile"),
                    "disabled": u.get("disabled"),
                    "limit_uptime": u.get("limit-uptime", ""),
                    "limit_bytes_total": u.get("limit-bytes-total", ""),
                    "server": u.get("server", ""),
                    "comment": u.get("comment", ""),
                }
                for u in users
            ] if users else [{"info": f"No user found matching '{username}'"}]
    except Exception as e:
        return [{"error": f"Failed to search hotspot user: {e}"}]


@mcp.tool()
def add_hotspot_user_profile(user_id: str, name: str, rate_limit: str = "", shared_users: int = 1,
                              session_timeout: str = "", keepalive_timeout: str = "",
                              idle_timeout: str = "", address_list: str = "",
                              transparent_proxy: str = "", open_status_page: str = "",
                              router: str = "") -> dict:
    """Create a new hotspot user profile (rate limit template).

    Args:
        user_id: Telegram user ID (required)
        name: Profile name (e.g., '5rb', 'Free', 'Premium')
        rate_limit: Upload/download limit (e.g., '1M/2M' or '512k/1M')
        shared_users: Max concurrent sessions per user (default: 1)
        session_timeout: Session timeout (e.g., '1h', '8h', '1d')
        keepalive_timeout: Keepalive timeout for detecting dead connections (e.g., '2m')
        idle_timeout: Disconnect after idle period (e.g., '5m', '10m')
        address_list: Firewall address list to add logged-in users to
        transparent_proxy: Enable transparent proxy ('yes' or 'no')
        open_status_page: Auto-open status page on login ('always', 'http-login', 'no')
        router: Router name. Empty = default router.
    """
    conn = _resolve_connection(user_id, router)
    if "error" in conn:
        return conn
    try:
        with connect_router(conn["host"], conn["port"], conn["username"], conn["password"]) as api:
            params: dict = {"name": name, "shared-users": str(shared_users)}
            if rate_limit:
                params["rate-limit"] = rate_limit
            if session_timeout:
                params["session-timeout"] = session_timeout
            if keepalive_timeout:
                params["keepalive-timeout"] = keepalive_timeout
            if idle_timeout:
                params["idle-timeout"] = idle_timeout
            if address_list:
                params["address-list"] = address_list
            if transparent_proxy:
                params["transparent-proxy"] = transparent_proxy
            if open_status_page:
                params["open-status-page"] = open_status_page
            api.path("ip", "hotspot", "user", "profile").add(**params)
            registry.update_last_seen(user_id, conn["name"])
            return {"status": "ok", "message": f"Profile '{name}' created (rate: {rate_limit or 'unlimited'}, shared: {shared_users})"}
    except Exception as e:
        err = str(e)
        if "already" in err.lower():
            return {"error": f"Profile '{name}' already exists."}
        return {"error": f"Failed to create profile: {e}"}


@mcp.tool()
def enable_firewall_rule(user_id: str, rule_id: str, router: str = "") -> dict:
    """Enable a disabled firewall filter rule.

    Args:
        user_id: Telegram user ID (required)
        rule_id: The .id of the firewall rule to enable
        router: Router name. Empty = default router.
    """
    conn = _resolve_connection(user_id, router)
    if "error" in conn:
        return conn
    try:
        with connect_router(conn["host"], conn["port"], conn["username"], conn["password"]) as api:
            api.path("/ip/firewall/filter").update(**{".id": rule_id, "disabled": "false"})
            registry.update_last_seen(user_id, conn["name"])
            return {"status": "ok", "message": f"Firewall rule {rule_id} enabled"}
    except Exception as e:
        return {"error": f"Failed to enable firewall rule: {e}"}


@mcp.tool()
def disable_firewall_rule(user_id: str, rule_id: str, router: str = "") -> dict:
    """Disable a firewall filter rule without removing it.

    Args:
        user_id: Telegram user ID (required)
        rule_id: The .id of the firewall rule to disable
        router: Router name. Empty = default router.
    """
    conn = _resolve_connection(user_id, router)
    if "error" in conn:
        return conn
    try:
        with connect_router(conn["host"], conn["port"], conn["username"], conn["password"]) as api:
            api.path("/ip/firewall/filter").update(**{".id": rule_id, "disabled": "true"})
            registry.update_last_seen(user_id, conn["name"])
            return {"status": "ok", "message": f"Firewall rule {rule_id} disabled"}
    except Exception as e:
        return {"error": f"Failed to disable firewall rule: {e}"}


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
            ifaces = list(api.path("interface").select().where(Key("name") == name))
            if not ifaces:
                return {"error": f"Interface '{name}' not found"}
            api.path("interface").update(**{".id": ifaces[0][".id"], "disabled": "false"})
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
            ifaces = list(api.path("interface").select().where(Key("name") == name))
            if not ifaces:
                return {"error": f"Interface '{name}' not found"}
            api.path("interface").update(**{".id": ifaces[0][".id"], "disabled": "true"})
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


@mcp.tool()
def set_ip_service(user_id: str, service_name: str, disabled: str = "",
                   port: str = "", address: str = "", router: str = "") -> dict:
    """Enable, disable, or configure an IP service (telnet, ssh, winbox, api, www, etc.).

    Args:
        user_id: Telegram user ID
        service_name: Service name exactly as shown in list_ip_services (e.g., 'telnet', 'ssh', 'winbox', 'api', 'www', 'www-ssl', 'ftp', 'api-ssl')
        disabled: Set 'true' to disable the service, 'false' to enable. Empty = don't change.
        port: New port number for the service. Empty = don't change.
        address: Allowed source address/subnet (e.g., '192.168.88.0/24'). Empty = don't change.
        router: Router name (empty = default)
    """
    conn = _resolve_connection(user_id, router)
    if "error" in conn:
        return conn
    try:
        with connect_router(conn["host"], conn["port"], conn["username"], conn["password"]) as api:
            resource = api.path("ip", "service")
            services = list(resource.select().where(Key("name") == service_name))
            if not services:
                all_svc = [s.get("name", "") for s in resource]
                return {"error": f"Service '{service_name}' not found. Available: {', '.join(all_svc)}"}
            update_params: dict = {".id": services[0][".id"]}
            changes = []
            if disabled:
                update_params["disabled"] = disabled
                changes.append("disabled" if disabled == "true" else "enabled")
            if port:
                update_params["port"] = port
                changes.append(f"port→{port}")
            if address:
                update_params["address"] = address
                changes.append(f"address={address}")
            if not changes:
                return {"error": "No changes specified. Provide disabled, port, or address."}
            resource.update(**update_params)
            registry.update_last_seen(user_id, conn["name"])
            return {"status": "ok", "message": f"Service '{service_name}' updated: {', '.join(changes)}"}
    except Exception as e:
        return {"error": f"Failed to update IP service: {e}"}


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
                leases = list(api.path("ip", "dhcp-server", "lease").select().where(Key(".id") == lease_id))
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
def add_dns_static(user_id: str, name: str, address: str, comment: str = "",
                    ttl: str = "", disabled: str = "", router: str = "") -> dict:
    """Add a static DNS entry.

    Args:
        user_id: Telegram user ID
        name: DNS hostname (e.g. 'myserver.local')
        address: IP address to resolve to (e.g. '192.168.1.100')
        comment: Entry description.
        ttl: Time-to-live (e.g., '1d', '1h'). Empty = use global TTL.
        disabled: Create as disabled ('true'). Empty = enabled.
        router: Router name (empty = default)
    """
    conn = _resolve_connection(user_id, router)
    if "error" in conn:
        return conn
    try:
        with connect_router(conn["host"], conn["port"], conn["username"], conn["password"]) as api:
            params: dict[str, str] = {"name": name, "address": address}
            if comment:
                params["comment"] = comment
            if ttl:
                params["ttl"] = ttl
            if disabled:
                params["disabled"] = disabled
            api.path("ip", "dns", "static").add(**params)
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
def list_hotspot_server_profiles(user_id: str, router: str = "") -> list[dict]:
    """List hotspot SERVER profiles (login page, RADIUS, etc — NOT rate limits).

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
def list_hotspot_user_profiles(user_id: str, router: str = "") -> list[dict]:
    """List hotspot USER profiles (rate limits, bandwidth limits like 5rb, Free, Trial, etc).
    This is /ip/hotspot/user/profile — different from server profiles.

    Args:
        user_id: Telegram user ID
        router: Router name (empty = default)
    """
    conn = _resolve_connection(user_id, router)
    if "error" in conn:
        return [conn]
    result = _query_path("/ip/hotspot/user/profile", conn["host"], conn["port"], conn["username"], conn["password"])
    registry.update_last_seen(user_id, conn["name"])
    return result


@mcp.tool()
def list_hotspot_servers(user_id: str, router: str = "") -> list[dict]:
    """List hotspot server instances.

    Args:
        user_id: Telegram user ID
        router: Router name (empty = default)
    """
    conn = _resolve_connection(user_id, router)
    if "error" in conn:
        return [conn]
    result = _query_path("/ip/hotspot", conn["host"], conn["port"], conn["username"], conn["password"])
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


@mcp.tool()
def list_hotspot_cookies(user_id: str, router: str = "") -> list[dict]:
    """List hotspot cookies (saved login sessions).

    Args:
        user_id: Telegram user ID
        router: Router name (empty = default)
    """
    conn = _resolve_connection(user_id, router)
    if "error" in conn:
        return [conn]
    result = _query_path("/ip/hotspot/cookie", conn["host"], conn["port"], conn["username"], conn["password"])
    registry.update_last_seen(user_id, conn["name"])
    return result


@mcp.tool()
def list_hotspot_walled_garden(user_id: str, router: str = "") -> list[dict]:
    """List hotspot walled garden rules (allowed sites before login).

    Args:
        user_id: Telegram user ID
        router: Router name (empty = default)
    """
    conn = _resolve_connection(user_id, router)
    if "error" in conn:
        return [conn]
    result = _query_path("/ip/hotspot/walled-garden", conn["host"], conn["port"], conn["username"], conn["password"])
    registry.update_last_seen(user_id, conn["name"])
    return result


# ─────────────────────────────────────────────
#  HOTSPOT VOUCHER MANAGEMENT (Mikhmon-like)
# ─────────────────────────────────────────────

@mcp.tool()
def generate_hotspot_vouchers(user_id: str, count: int, profile: str, prefix: str = "",
                               password_length: int = 6, username_length: int = 6,
                               limit_uptime: str = "", limit_bytes_total: str = "",
                               limit_bytes_in: str = "", limit_bytes_out: str = "",
                               comment: str = "", server: str = "", router: str = "") -> dict:
    """Generate multiple hotspot voucher users in bulk (like Mikhmon).

    Creates random username/password pairs and adds them as hotspot users.
    Useful for generating voucher cards for resale or distribution.

    Args:
        user_id: Telegram user ID
        count: Number of vouchers to generate (max 100)
        profile: Hotspot user profile to assign (e.g., '5rb', 'Free')
        prefix: Optional prefix for usernames (e.g., 'V' produces V3k8m2)
        password_length: Length of generated password (default 6)
        username_length: Length of random part of username (default 6)
        limit_uptime: Per-user uptime limit (e.g., '1h', '3h', '1d')
        limit_bytes_total: Per-user total data limit (e.g., '100M', '1G')
        limit_bytes_in: Per-user download limit (e.g., '500M', '1G'). Empty = unlimited.
        limit_bytes_out: Per-user upload limit (e.g., '100M', '500M'). Empty = unlimited.
        comment: Comment for all generated users (e.g., 'Batch 2026-04-09')
        server: Hotspot server to assign vouchers to. Empty = default ('all').
        router: Router name. Empty = default router.
    """
    if count < 1:
        return {"error": "Count must be at least 1."}
    if count > 100:
        return {"error": "Maximum 100 vouchers per batch to prevent abuse. Split into multiple batches."}
    if username_length < 4 or username_length > 16:
        return {"error": "username_length must be between 4 and 16."}
    if password_length < 4 or password_length > 16:
        return {"error": "password_length must be between 4 and 16."}

    conn = _resolve_connection(user_id, router)
    if "error" in conn:
        return conn
    try:
        with connect_router(conn["host"], conn["port"], conn["username"], conn["password"]) as api:
            # Validate profile exists
            profiles = list(api.path("ip", "hotspot", "user", "profile"))
            profile_names = [p.get("name", "") for p in profiles]
            if profile not in profile_names:
                return {"error": f"Profile '{profile}' not found. Available profiles: {', '.join(profile_names)}"}
            if server:
                hotspot_servers = list(api.path("ip", "hotspot"))
                hs_names = [s.get("name", "") for s in hotspot_servers]
                if server not in hs_names:
                    return {"error": f"Hotspot server '{server}' not found. Available: {', '.join(hs_names)}"}

            # Get existing usernames to avoid collisions
            existing = {u.get("name", "") for u in api.path("ip", "hotspot", "user")}

            charset = string.ascii_lowercase + string.digits
            resource = api.path("ip", "hotspot", "user")
            vouchers = []
            errors = []

            for i in range(count):
                # Generate unique username
                for _ in range(10):  # max 10 retries for uniqueness
                    uname = prefix + "".join(random.choices(charset, k=username_length))
                    if uname not in existing:
                        break
                else:
                    errors.append(f"Voucher #{i+1}: failed to generate unique username after 10 retries")
                    continue

                pwd = "".join(random.choices(charset, k=password_length))

                params: dict[str, str] = {
                    "name": uname,
                    "password": pwd,
                    "profile": profile,
                }
                if limit_uptime:
                    params["limit-uptime"] = limit_uptime
                if limit_bytes_total:
                    params["limit-bytes-total"] = _normalize_bytes_input(limit_bytes_total)
                if limit_bytes_in:
                    params["limit-bytes-in"] = _normalize_bytes_input(limit_bytes_in)
                if limit_bytes_out:
                    params["limit-bytes-out"] = _normalize_bytes_input(limit_bytes_out)
                if comment:
                    params["comment"] = comment
                if server:
                    params["server"] = server

                try:
                    resource.add(**params)
                    existing.add(uname)
                    vouchers.append({
                        "username": uname,
                        "password": pwd,
                        "created_at": datetime.now(timezone.utc).strftime("%d-%m-%Y %H:%M:%S"),
                    })
                except Exception as e:
                    errors.append(f"Voucher #{i+1} ({uname}): {e}")

            registry.update_last_seen(user_id, conn["name"])

            # Persist to PostgreSQL (best-effort)
            try:
                vdb = _get_voucher_db()
                if vdb and vouchers:
                    vdb.save_batch(
                        user_id=user_id,
                        router_name=conn["name"],
                        profile=profile,
                        vouchers=vouchers,
                        source="nanobot",
                    )
            except Exception as e:
                logger.warning("Failed to persist voucher batch to DB: %s", e)

            # Fetch profile details so the LLM can show duration/speed in response
            profile_obj = next((p for p in profiles if p.get("name") == profile), {})
            profile_details: dict = {}
            if profile_obj.get("session-timeout"):
                profile_details["session_timeout"] = profile_obj["session-timeout"]
            if profile_obj.get("limit-uptime"):
                profile_details["limit_uptime"] = profile_obj["limit-uptime"]
            if profile_obj.get("shared-users"):
                profile_details["shared_users"] = profile_obj["shared-users"]
            if profile_obj.get("rate-limit"):
                profile_details["rate_limit"] = profile_obj["rate-limit"]
            if profile_obj.get("address-list"):
                profile_details["address_list"] = profile_obj["address-list"]

            result: dict = {
                "status": "ok",
                "count": len(vouchers),
                "profile": profile,
                "profile_details": profile_details,
                "vouchers": vouchers,
            }
            if errors:
                result["errors"] = errors
            return result
    except Exception as e:
        return {"error": f"Failed to generate vouchers: {e}"}


@mcp.tool()
def get_voucher_history(user_id: str, limit: int = 5) -> list[dict]:
    """Retrieve recent voucher batches generated by this user (from database).

    Use this when user asks about previously generated vouchers, e.g.:
    - "voucher tadi apa ya?"
    - "kasih liat voucher terakhir saya"
    - "cek voucher yang tadi dibuat"

    Does NOT connect to the router — reads from database only (fast).

    Args:
        user_id: Telegram user ID (required)
        limit: Number of recent batches to return (default 5, max 20)
    """
    limit = min(max(1, limit), 20)
    try:
        vdb = _get_voucher_db()
        if not vdb:
            return [{"error": "Voucher history not available (database not connected)"}]
        batches = vdb.get_voucher_batches(user_id, limit=limit)
        if not batches:
            return [{"info": "Belum ada voucher yang pernah digenerate"}]
        return batches
    except Exception as e:
        return [{"error": f"Failed to fetch voucher history: {e}"}]


@mcp.tool()
def get_hotspot_voucher_stats(user_id: str, router: str = "") -> dict:
    """Get hotspot user statistics: total, active, disabled, expired, by profile.

    Like Mikhmon's dashboard showing user counts per profile.

    Args:
        user_id: Telegram user ID (required)
        router: Router name. Empty = default router.
    """
    conn = _resolve_connection(user_id, router)
    if "error" in conn:
        return conn
    try:
        with connect_router(conn["host"], conn["port"], conn["username"], conn["password"]) as api:
            users = list(api.path("/ip/hotspot/user"))
            registry.update_last_seen(user_id, conn["name"])

            total = len(users)
            enabled = 0
            disabled = 0
            by_profile: dict[str, int] = {}

            for u in users:
                if u.get("disabled", "false") == "true":
                    disabled += 1
                else:
                    enabled += 1
                prof = u.get("profile", "unknown")
                by_profile[prof] = by_profile.get(prof, 0) + 1

            return {
                "total": total,
                "enabled": enabled,
                "disabled": disabled,
                "by_profile": by_profile,
            }
    except Exception as e:
        return {"error": f"Failed to get voucher stats: {e}"}


@mcp.tool()
def get_hotspot_user_detail(user_id: str, username: str, router: str = "") -> dict:
    """Get detailed info about a specific hotspot user including usage stats.

    Returns all available fields: name, profile, uptime-used, bytes-in/out,
    packets-in/out, limits, disabled status, comment, last-logged-out, etc.

    Args:
        user_id: Telegram user ID (required)
        username: The hotspot username to look up
        router: Router name. Empty = default router.
    """
    conn = _resolve_connection(user_id, router)
    if "error" in conn:
        return conn
    try:
        with connect_router(conn["host"], conn["port"], conn["username"], conn["password"]) as api:
            resource = api.path("ip", "hotspot", "user")
            users = list(resource.select().where(Key("name") == username))
            if not users:
                return {"error": f"Hotspot user '{username}' not found."}
            registry.update_last_seen(user_id, conn["name"])
            u = users[0]
            return {
                "name": u.get("name"),
                "profile": u.get("profile"),
                "disabled": u.get("disabled"),
                "comment": u.get("comment", ""),
                "server": u.get("server", ""),
                "limit_uptime": u.get("limit-uptime", ""),
                "limit_bytes_total": u.get("limit-bytes-total", ""),
                "limit_bytes_in": u.get("limit-bytes-in", ""),
                "limit_bytes_out": u.get("limit-bytes-out", ""),
                "uptime_used": u.get("uptime", ""),
                "bytes_in": u.get("bytes-in", "0"),
                "bytes_out": u.get("bytes-out", "0"),
                "packets_in": u.get("packets-in", "0"),
                "packets_out": u.get("packets-out", "0"),
                "last_logged_out": u.get("last-logged-out", ""),
                "address": u.get("address", ""),
                "mac_address": u.get("mac-address", ""),
                "email": u.get("email", ""),
            }
    except Exception as e:
        return {"error": f"Failed to get hotspot user detail: {e}"}


@mcp.tool()
def bulk_enable_hotspot_users(user_id: str, usernames: str, router: str = "") -> dict:
    """Enable multiple hotspot users at once.

    Args:
        user_id: Telegram user ID (required)
        usernames: Comma-separated list of usernames to enable
        router: Router name. Empty = default router.
    """
    conn = _resolve_connection(user_id, router)
    if "error" in conn:
        return conn
    name_list = [n.strip() for n in usernames.split(",") if n.strip()]
    if not name_list:
        return {"error": "No usernames provided. Pass a comma-separated list."}
    try:
        with connect_router(conn["host"], conn["port"], conn["username"], conn["password"]) as api:
            resource = api.path("ip", "hotspot", "user")
            all_users = {u["name"]: u for u in resource.select(Key("name"), Key(".id"))}
            enabled = []
            errors = []
            for uname in name_list:
                try:
                    user = all_users.get(uname)
                    if not user:
                        errors.append(f"{uname}: not found")
                        continue
                    resource.update(**{".id": user[".id"], "disabled": "false"})
                    enabled.append(uname)
                except Exception as e:
                    errors.append(f"{uname}: {e}")
            registry.update_last_seen(user_id, conn["name"])
            result: dict = {"status": "ok", "enabled": enabled, "count": len(enabled)}
            if errors:
                result["errors"] = errors
            return result
    except Exception as e:
        return {"error": f"Failed to bulk enable hotspot users: {e}"}


@mcp.tool()
def bulk_disable_hotspot_users(user_id: str, usernames: str, router: str = "") -> dict:
    """Disable/suspend multiple hotspot users at once.

    Args:
        user_id: Telegram user ID (required)
        usernames: Comma-separated list of usernames to disable
        router: Router name. Empty = default router.
    """
    conn = _resolve_connection(user_id, router)
    if "error" in conn:
        return conn
    name_list = [n.strip() for n in usernames.split(",") if n.strip()]
    if not name_list:
        return {"error": "No usernames provided. Pass a comma-separated list."}
    try:
        with connect_router(conn["host"], conn["port"], conn["username"], conn["password"]) as api:
            resource = api.path("ip", "hotspot", "user")
            all_users = {u["name"]: u for u in resource.select(Key("name"), Key(".id"))}
            disabled = []
            errors = []
            for uname in name_list:
                try:
                    user = all_users.get(uname)
                    if not user:
                        errors.append(f"{uname}: not found")
                        continue
                    resource.update(**{".id": user[".id"], "disabled": "true"})
                    disabled.append(uname)
                except Exception as e:
                    errors.append(f"{uname}: {e}")
            registry.update_last_seen(user_id, conn["name"])
            result: dict = {"status": "ok", "disabled": disabled, "count": len(disabled)}
            if errors:
                result["errors"] = errors
            return result
    except Exception as e:
        return {"error": f"Failed to bulk disable hotspot users: {e}"}


@mcp.tool()
def bulk_remove_hotspot_users(user_id: str, usernames: str, router: str = "") -> dict:
    """Remove multiple hotspot users at once. DANGEROUS — removed users cannot be recovered.

    Args:
        user_id: Telegram user ID (required)
        usernames: Comma-separated list of usernames to remove
        router: Router name. Empty = default router.
    """
    conn = _resolve_connection(user_id, router)
    if "error" in conn:
        return conn
    name_list = [n.strip() for n in usernames.split(",") if n.strip()]
    if not name_list:
        return {"error": "No usernames provided. Pass a comma-separated list."}
    try:
        with connect_router(conn["host"], conn["port"], conn["username"], conn["password"]) as api:
            resource = api.path("ip", "hotspot", "user")
            all_users = {u["name"]: u for u in resource.select(Key("name"), Key(".id"))}
            removed = []
            errors = []
            for uname in name_list:
                try:
                    user = all_users.get(uname)
                    if not user:
                        errors.append(f"{uname}: not found")
                        continue
                    resource.remove(user[".id"])
                    removed.append(uname)
                except Exception as e:
                    errors.append(f"{uname}: {e}")
            registry.update_last_seen(user_id, conn["name"])
            result: dict = {"status": "ok", "removed": removed, "count": len(removed)}
            if errors:
                result["errors"] = errors
            return result
    except Exception as e:
        return {"error": f"Failed to bulk remove hotspot users: {e}"}


@mcp.tool()
def remove_disabled_hotspot_users(user_id: str, router: str = "") -> dict:
    """Remove ALL disabled hotspot users (cleanup). DANGEROUS — this permanently deletes
    every hotspot user that is currently disabled. Cannot be undone.

    Args:
        user_id: Telegram user ID (required)
        router: Router name. Empty = default router.
    """
    conn = _resolve_connection(user_id, router)
    if "error" in conn:
        return conn
    try:
        with connect_router(conn["host"], conn["port"], conn["username"], conn["password"]) as api:
            resource = api.path("/ip/hotspot/user")
            all_users = list(resource)
            disabled_users = [u for u in all_users if u.get("disabled", "false") == "true"]
            if not disabled_users:
                return {"status": "ok", "count": 0, "message": "No disabled users found."}

            removed = []
            errors = []
            for u in disabled_users:
                try:
                    resource.remove(u[".id"])
                    removed.append(u.get("name", u[".id"]))
                except Exception as e:
                    errors.append(f"{u.get('name', u['.id'])}: {e}")

            registry.update_last_seen(user_id, conn["name"])
            result: dict = {"status": "ok", "removed": removed, "count": len(removed)}
            if errors:
                result["errors"] = errors
            return result
    except Exception as e:
        return {"error": f"Failed to remove disabled hotspot users: {e}"}


@mcp.tool()
def remove_expired_hotspot_users(user_id: str, router: str = "") -> dict:
    """Remove hotspot users that have exceeded their uptime or data limit. DANGEROUS —
    permanently deletes expired users. Cannot be undone.

    A user is considered expired if:
    - It has a limit-uptime set AND uptime >= limit-uptime, OR
    - It has a limit-bytes-total set AND (bytes-in + bytes-out) >= limit-bytes-total

    Args:
        user_id: Telegram user ID (required)
        router: Router name. Empty = default router.
    """
    conn = _resolve_connection(user_id, router)
    if "error" in conn:
        return conn
    try:
        with connect_router(conn["host"], conn["port"], conn["username"], conn["password"]) as api:
            resource = api.path("/ip/hotspot/user")
            all_users = list(resource)
            expired_users = []

            for u in all_users:
                limit_uptime = u.get("limit-uptime", "")
                limit_bytes = u.get("limit-bytes-total", "")

                if not limit_uptime and not limit_bytes:
                    continue  # no limits set, can't expire

                is_expired = False

                if limit_uptime:
                    used_uptime = u.get("uptime", "0s")
                    if _parse_ros_time(used_uptime) >= _parse_ros_time(limit_uptime) and _parse_ros_time(limit_uptime) > 0:
                        is_expired = True

                if not is_expired and limit_bytes:
                    bytes_in = int(u.get("bytes-in", "0") or "0")
                    bytes_out = int(u.get("bytes-out", "0") or "0")
                    limit_val = _parse_ros_bytes(limit_bytes)
                    if limit_val > 0 and (bytes_in + bytes_out) >= limit_val:
                        is_expired = True

                if is_expired:
                    expired_users.append(u)

            if not expired_users:
                return {"status": "ok", "count": 0, "message": "No expired users found."}

            removed = []
            errors = []
            for u in expired_users:
                try:
                    resource.remove(u[".id"])
                    removed.append(u.get("name", u[".id"]))
                except Exception as e:
                    errors.append(f"{u.get('name', u['.id'])}: {e}")

            registry.update_last_seen(user_id, conn["name"])
            result: dict = {"status": "ok", "removed": removed, "count": len(removed)}
            if errors:
                result["errors"] = errors
            return result
    except Exception as e:
        return {"error": f"Failed to remove expired hotspot users: {e}"}


@mcp.tool()
def update_hotspot_user_profile(user_id: str, name: str, rate_limit: str = "",
                                 shared_users: int = 0, session_timeout: str = "",
                                 keepalive_timeout: str = "", idle_timeout: str = "",
                                 address_list: str = "", transparent_proxy: str = "",
                                 open_status_page: str = "", router: str = "") -> dict:
    """Update an existing hotspot user profile settings.

    Args:
        user_id: Telegram user ID (required)
        name: Profile name to update (e.g., '5rb', 'Free', 'Premium')
        rate_limit: New upload/download limit (e.g., '1M/2M'). Empty = don't change.
        shared_users: New max concurrent sessions (0 = don't change)
        session_timeout: New session timeout (e.g., '1h', '8h'). Empty = don't change.
        keepalive_timeout: New keepalive timeout (e.g., '2m'). Empty = don't change.
        idle_timeout: New idle timeout (e.g., '5m', '10m'). Empty = don't change.
        address_list: Firewall address list for logged-in users. Empty = don't change.
        transparent_proxy: Enable transparent proxy ('yes' or 'no'). Empty = don't change.
        open_status_page: Auto-open status page ('always', 'http-login', 'no'). Empty = don't change.
        router: Router name. Empty = default router.
    """
    conn = _resolve_connection(user_id, router)
    if "error" in conn:
        return conn
    try:
        with connect_router(conn["host"], conn["port"], conn["username"], conn["password"]) as api:
            resource = api.path("ip", "hotspot", "user", "profile")
            profiles = list(resource.select().where(Key("name") == name))
            if not profiles:
                available = [p.get("name", "") for p in resource]
                return {"error": f"Profile '{name}' not found. Available profiles: {', '.join(available)}"}

            update_params: dict[str, str] = {".id": profiles[0][".id"]}
            changes = []
            if rate_limit:
                update_params["rate-limit"] = rate_limit
                changes.append(f"rate-limit={rate_limit}")
            if shared_users > 0:
                update_params["shared-users"] = str(shared_users)
                changes.append(f"shared-users={shared_users}")
            if session_timeout:
                update_params["session-timeout"] = session_timeout
                changes.append(f"session-timeout={session_timeout}")
            if keepalive_timeout:
                update_params["keepalive-timeout"] = keepalive_timeout
                changes.append(f"keepalive-timeout={keepalive_timeout}")
            if idle_timeout:
                update_params["idle-timeout"] = idle_timeout
                changes.append(f"idle-timeout={idle_timeout}")
            if address_list:
                update_params["address-list"] = address_list
                changes.append(f"address-list={address_list}")
            if transparent_proxy:
                update_params["transparent-proxy"] = transparent_proxy
                changes.append(f"transparent-proxy={transparent_proxy}")
            if open_status_page:
                update_params["open-status-page"] = open_status_page
                changes.append(f"open-status-page={open_status_page}")

            if not changes:
                return {"error": "No changes specified."}

            resource.update(**update_params)
            registry.update_last_seen(user_id, conn["name"])
            return {"status": "ok", "message": f"Profile '{name}' updated: {', '.join(changes)}"}
    except Exception as e:
        return {"error": f"Failed to update hotspot user profile: {e}"}


@mcp.tool()
def remove_hotspot_user_profile(user_id: str, name: str, router: str = "") -> dict:
    """Remove a hotspot user profile. Will fail if users are still assigned to it.

    Args:
        user_id: Telegram user ID (required)
        name: Profile name to remove
        router: Router name. Empty = default router.
    """
    conn = _resolve_connection(user_id, router)
    if "error" in conn:
        return conn
    if name.lower() == "default":
        return {"error": "Cannot remove the 'default' profile."}
    try:
        with connect_router(conn["host"], conn["port"], conn["username"], conn["password"]) as api:
            resource = api.path("ip", "hotspot", "user", "profile")
            profiles = list(resource.select().where(Key("name") == name))
            if not profiles:
                available = [p.get("name", "") for p in resource]
                return {"error": f"Profile '{name}' not found. Available profiles: {', '.join(available)}"}

            # Check if any users are assigned to this profile
            users = list(api.path("ip", "hotspot", "user").select(Key("name")).where(Key("profile") == name))
            if users:
                return {"error": f"Cannot remove profile '{name}': {len(users)} user(s) still assigned to it. "
                        f"Reassign or remove those users first."}

            resource.remove(profiles[0][".id"])
            registry.update_last_seen(user_id, conn["name"])
            return {"status": "ok", "message": f"Hotspot user profile '{name}' removed"}
    except Exception as e:
        return {"error": f"Failed to remove hotspot user profile: {e}"}


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
def add_ppp_secret(user_id: str, name: str, password: str, service: str = "any",
                    profile: str = "default", local_address: str = "", remote_address: str = "",
                    comment: str = "", disabled: str = "", routes: str = "",
                    router: str = "") -> dict:
    """Add a PPP user account (PPPoE, PPTP, L2TP, etc.).

    Args:
        user_id: Telegram user ID
        name: Username for the PPP account
        password: Password for the PPP account
        service: Service type — 'any', 'pppoe', 'pptp', 'l2tp', etc. (default: 'any')
        profile: PPP profile to assign (default: 'default')
        local_address: IP on router side of tunnel. Empty = from pool.
        remote_address: IP for client side of tunnel. Empty = from pool.
        comment: Account description.
        disabled: Create as disabled ('true'). Empty = enabled.
        routes: Static routes to add when user connects (comma-separated CIDRs).
        router: Router name (empty = default)
    """
    conn = _resolve_connection(user_id, router)
    if "error" in conn:
        return conn
    try:
        with connect_router(conn["host"], conn["port"], conn["username"], conn["password"]) as api:
            params: dict[str, str] = {"name": name, "password": password, "service": service, "profile": profile}
            if local_address:
                params["local-address"] = local_address
            if remote_address:
                params["remote-address"] = remote_address
            if comment:
                params["comment"] = comment
            if disabled:
                params["disabled"] = disabled
            if routes:
                params["routes"] = routes
            api.path("ppp", "secret").add(**params)
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
            secrets = list(api.path("ppp", "secret").select().where(Key("name") == name))
            if not secrets:
                return {"error": f"PPP secret '{name}' not found"}
            api.path("ppp", "secret").remove(secrets[0][".id"])
            registry.update_last_seen(user_id, conn["name"])
            return {"status": "ok", "message": f"PPP secret '{name}' removed"}
    except Exception as e:
        return {"error": f"Failed to remove PPP secret: {e}"}


@mcp.tool()
def update_ppp_secret(user_id: str, name: str, new_password: str = "", new_profile: str = "",
                       local_address: str = "", remote_address: str = "",
                       comment: str = "", disabled: str = "", routes: str = "",
                       router: str = "") -> dict:
    """Update an existing PPP user account (change password, profile, addresses, etc).

    Args:
        user_id: Telegram user ID
        name: Current PPP username to update
        new_password: New password. Empty = don't change.
        new_profile: New profile. Empty = don't change.
        local_address: New local IP. Empty = don't change.
        remote_address: New remote IP. Empty = don't change.
        comment: New comment. Empty = don't change.
        disabled: Set 'true' to disable, 'false' to enable. Empty = don't change.
        routes: New routes. Empty = don't change.
        router: Router name (empty = default)
    """
    conn = _resolve_connection(user_id, router)
    if "error" in conn:
        return conn
    try:
        with connect_router(conn["host"], conn["port"], conn["username"], conn["password"]) as api:
            secrets = list(api.path("ppp", "secret").select().where(Key("name") == name))
            if not secrets:
                return {"error": f"PPP secret '{name}' not found"}
            update_params: dict = {".id": secrets[0][".id"]}
            changes = []
            if new_password:
                update_params["password"] = new_password
                changes.append("password")
            if new_profile:
                update_params["profile"] = new_profile
                changes.append(f"profile→{new_profile}")
            if local_address:
                update_params["local-address"] = local_address
                changes.append(f"local-address={local_address}")
            if remote_address:
                update_params["remote-address"] = remote_address
                changes.append(f"remote-address={remote_address}")
            if comment:
                update_params["comment"] = comment
                changes.append("comment updated")
            if disabled:
                update_params["disabled"] = disabled
                changes.append(f"disabled={disabled}")
            if routes:
                update_params["routes"] = routes
                changes.append(f"routes={routes}")
            if not changes:
                return {"error": "No changes specified."}
            api.path("ppp", "secret").update(**update_params)
            registry.update_last_seen(user_id, conn["name"])
            return {"status": "ok", "message": f"PPP secret '{name}' updated: {', '.join(changes)}"}
    except Exception as e:
        return {"error": f"Failed to update PPP secret: {e}"}


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
            scripts = list(api.path("system", "script").select().where(Key("name") == script_name))
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
def add_simple_queue(user_id: str, name: str, target: str, max_limit: str,
                      burst_limit: str = "", burst_threshold: str = "", burst_time: str = "",
                      priority: str = "", limit_at: str = "", parent: str = "",
                      comment: str = "", disabled: str = "", router: str = "") -> dict:
    """Add a simple queue (bandwidth limit).

    Args:
        user_id: Telegram user ID
        name: Queue name (e.g. 'limit-john')
        target: Target IP or subnet (e.g. '192.168.1.100/32')
        max_limit: Upload/download limit (e.g. '5M/10M' for 5Mbps up / 10Mbps down)
        burst_limit: Burst speed limit (e.g., '10M/20M'). Empty = no burst.
        burst_threshold: Threshold to trigger burst (e.g., '4M/8M'). Empty = no burst.
        burst_time: Burst duration in seconds (e.g., '10/10'). Empty = no burst.
        priority: Queue priority 1-8 (1=highest). Format: 'upload/download' e.g. '1/1'.
        limit_at: Guaranteed minimum bandwidth (e.g., '2M/4M'). Empty = none.
        parent: Parent queue name for hierarchical queueing. Empty = none.
        comment: Queue description.
        disabled: Create as disabled ('true'). Empty = enabled.
        router: Router name (empty = default)
    """
    conn = _resolve_connection(user_id, router)
    if "error" in conn:
        return conn
    try:
        with connect_router(conn["host"], conn["port"], conn["username"], conn["password"]) as api:
            params: dict[str, str] = {"name": name, "target": target, "max-limit": max_limit}
            if burst_limit:
                params["burst-limit"] = burst_limit
            if burst_threshold:
                params["burst-threshold"] = burst_threshold
            if burst_time:
                params["burst-time"] = burst_time
            if priority:
                params["priority"] = priority
            if limit_at:
                params["limit-at"] = limit_at
            if parent:
                params["parent"] = parent
            if comment:
                params["comment"] = comment
            if disabled:
                params["disabled"] = disabled
            api.path("queue", "simple").add(**params)
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
#  DHCP CLIENT
# ─────────────────────────────────────────────

@mcp.tool()
def list_dhcp_clients(user_id: str, router: str = "") -> list[dict]:
    """List DHCP client configurations (interfaces getting IP via DHCP).
    Different from DHCP leases — this shows interfaces where the router GETS its IP from an upstream DHCP server.

    Args:
        user_id: Telegram user ID
        router: Router name (empty = default)
    """
    conn = _resolve_connection(user_id, router)
    if "error" in conn:
        return [conn]
    result = _query_path("/ip/dhcp-client", conn["host"], conn["port"], conn["username"], conn["password"])
    registry.update_last_seen(user_id, conn["name"])
    return result


# ─────────────────────────────────────────────
#  WIRELESS EXTENDED
# ─────────────────────────────────────────────

@mcp.tool()
def list_wireless_interfaces(user_id: str, router: str = "") -> list[dict]:
    """List wireless interface configurations (SSID, frequency, band, mode).

    Args:
        user_id: Telegram user ID
        router: Router name (empty = default)
    """
    conn = _resolve_connection(user_id, router)
    if "error" in conn:
        return [conn]
    try:
        result = _query_path("/interface/wireless", conn["host"], conn["port"], conn["username"], conn["password"])
        registry.update_last_seen(user_id, conn["name"])
        return result
    except Exception:
        return [{"info": "No wireless interface or not supported on this router"}]


@mcp.tool()
def list_wireless_security_profiles(user_id: str, router: str = "") -> list[dict]:
    """List wireless security profiles (WPA/WPA2 auth modes). Keys/passwords are stripped from output.

    Args:
        user_id: Telegram user ID
        router: Router name (empty = default)
    """
    conn = _resolve_connection(user_id, router)
    if "error" in conn:
        return [conn]
    try:
        rows = _query_path("/interface/wireless/security-profiles", conn["host"], conn["port"], conn["username"], conn["password"])
        registry.update_last_seen(user_id, conn["name"])
        # Strip sensitive key fields
        for row in rows:
            row.pop("wpa-pre-shared-key", None)
            row.pop("wpa2-pre-shared-key", None)
        return rows
    except Exception:
        return [{"info": "No wireless interface or not supported on this router"}]


@mcp.tool()
def list_wireless_access_list(user_id: str, router: str = "") -> list[dict]:
    """List wireless access list (MAC filter allow/deny rules).

    Args:
        user_id: Telegram user ID
        router: Router name (empty = default)
    """
    conn = _resolve_connection(user_id, router)
    if "error" in conn:
        return [conn]
    try:
        result = _query_path("/interface/wireless/access-list", conn["host"], conn["port"], conn["username"], conn["password"])
        registry.update_last_seen(user_id, conn["name"])
        return result
    except Exception:
        return [{"info": "No wireless interface or not supported on this router"}]


# ─────────────────────────────────────────────
#  PPP EXTENDED
# ─────────────────────────────────────────────

@mcp.tool()
def list_ppp_profiles(user_id: str, router: str = "") -> list[dict]:
    """List PPP profiles (rate limits, DNS, IP pools for PPPoE/PPTP/L2TP users).

    Args:
        user_id: Telegram user ID
        router: Router name (empty = default)
    """
    conn = _resolve_connection(user_id, router)
    if "error" in conn:
        return [conn]
    result = _query_path("/ppp/profile", conn["host"], conn["port"], conn["username"], conn["password"])
    registry.update_last_seen(user_id, conn["name"])
    return result


@mcp.tool()
def list_l2tp_server(user_id: str, router: str = "") -> list[dict]:
    """List L2TP server configuration.

    Args:
        user_id: Telegram user ID
        router: Router name (empty = default)
    """
    conn = _resolve_connection(user_id, router)
    if "error" in conn:
        return [conn]
    result = _query_path("/interface/l2tp-server/server", conn["host"], conn["port"], conn["username"], conn["password"])
    registry.update_last_seen(user_id, conn["name"])
    return result


@mcp.tool()
def list_pptp_server(user_id: str, router: str = "") -> list[dict]:
    """List PPTP server configuration.

    Args:
        user_id: Telegram user ID
        router: Router name (empty = default)
    """
    conn = _resolve_connection(user_id, router)
    if "error" in conn:
        return [conn]
    result = _query_path("/interface/pptp-server/server", conn["host"], conn["port"], conn["username"], conn["password"])
    registry.update_last_seen(user_id, conn["name"])
    return result


@mcp.tool()
def list_sstp_server(user_id: str, router: str = "") -> list[dict]:
    """List SSTP server configuration.

    Args:
        user_id: Telegram user ID
        router: Router name (empty = default)
    """
    conn = _resolve_connection(user_id, router)
    if "error" in conn:
        return [conn]
    result = _query_path("/interface/sstp-server/server", conn["host"], conn["port"], conn["username"], conn["password"])
    registry.update_last_seen(user_id, conn["name"])
    return result


# ─────────────────────────────────────────────
#  QUEUE EXTENDED (Read)
# ─────────────────────────────────────────────

@mcp.tool()
def list_queue_tree(user_id: str, router: str = "") -> list[dict]:
    """List queue tree entries (hierarchical bandwidth management).

    Args:
        user_id: Telegram user ID
        router: Router name (empty = default)
    """
    conn = _resolve_connection(user_id, router)
    if "error" in conn:
        return [conn]
    result = _query_path("/queue/tree", conn["host"], conn["port"], conn["username"], conn["password"])
    registry.update_last_seen(user_id, conn["name"])
    return result


@mcp.tool()
def list_queue_types(user_id: str, router: str = "") -> list[dict]:
    """List queue types (PCQ, SFQ, FIFO, etc).

    Args:
        user_id: Telegram user ID
        router: Router name (empty = default)
    """
    conn = _resolve_connection(user_id, router)
    if "error" in conn:
        return [conn]
    result = _query_path("/queue/type", conn["host"], conn["port"], conn["username"], conn["password"])
    registry.update_last_seen(user_id, conn["name"])
    return result


# ─────────────────────────────────────────────
#  SYSTEM EXTENDED (Read) — Packages, License, Logging, NTP
# ─────────────────────────────────────────────

@mcp.tool()
def list_system_packages(user_id: str, router: str = "") -> list[dict]:
    """List installed RouterOS packages with versions.

    Args:
        user_id: Telegram user ID
        router: Router name (empty = default)
    """
    conn = _resolve_connection(user_id, router)
    if "error" in conn:
        return [conn]
    result = _query_path("/system/package", conn["host"], conn["port"], conn["username"], conn["password"])
    registry.update_last_seen(user_id, conn["name"])
    return result


@mcp.tool()
def get_system_license(user_id: str, router: str = "") -> dict:
    """Get RouterOS license information (level, features).

    Args:
        user_id: Telegram user ID
        router: Router name (empty = default)
    """
    conn = _resolve_connection(user_id, router)
    if "error" in conn:
        return conn
    rows = _query_path("/system/license", conn["host"], conn["port"], conn["username"], conn["password"])
    registry.update_last_seen(user_id, conn["name"])
    return rows[0] if rows else {"info": "No license data available"}


@mcp.tool()
def list_system_logging(user_id: str, router: str = "") -> list[dict]:
    """List logging rules (what gets logged where).

    Args:
        user_id: Telegram user ID
        router: Router name (empty = default)
    """
    conn = _resolve_connection(user_id, router)
    if "error" in conn:
        return [conn]
    result = _query_path("/system/logging", conn["host"], conn["port"], conn["username"], conn["password"])
    registry.update_last_seen(user_id, conn["name"])
    return result


@mcp.tool()
def get_system_ntp_client(user_id: str, router: str = "") -> dict:
    """Get NTP client configuration.

    Args:
        user_id: Telegram user ID
        router: Router name (empty = default)
    """
    conn = _resolve_connection(user_id, router)
    if "error" in conn:
        return conn
    rows = _query_path("/system/ntp/client", conn["host"], conn["port"], conn["username"], conn["password"])
    registry.update_last_seen(user_id, conn["name"])
    return rows[0] if rows else {}


# ─────────────────────────────────────────────
#  ROUTING (OSPF, BGP, Filters)
# ─────────────────────────────────────────────

@mcp.tool()
def list_routing_ospf_instances(user_id: str, router: str = "") -> list[dict]:
    """List OSPF instances. Requires the routing package to be installed.

    Args:
        user_id: Telegram user ID
        router: Router name (empty = default)
    """
    conn = _resolve_connection(user_id, router)
    if "error" in conn:
        return [conn]
    try:
        result = _query_path("/routing/ospf/instance", conn["host"], conn["port"], conn["username"], conn["password"])
        registry.update_last_seen(user_id, conn["name"])
        return result
    except Exception:
        return [{"info": "Routing package not installed"}]


@mcp.tool()
def list_routing_ospf_neighbors(user_id: str, router: str = "") -> list[dict]:
    """List OSPF neighbors. Requires the routing package to be installed.

    Args:
        user_id: Telegram user ID
        router: Router name (empty = default)
    """
    conn = _resolve_connection(user_id, router)
    if "error" in conn:
        return [conn]
    try:
        result = _query_path("/routing/ospf/neighbor", conn["host"], conn["port"], conn["username"], conn["password"])
        registry.update_last_seen(user_id, conn["name"])
        return result
    except Exception:
        return [{"info": "Routing package not installed"}]


@mcp.tool()
def list_routing_bgp_sessions(user_id: str, router: str = "") -> list[dict]:
    """List BGP sessions/peers. Requires the routing package to be installed.

    Args:
        user_id: Telegram user ID
        router: Router name (empty = default)
    """
    conn = _resolve_connection(user_id, router)
    if "error" in conn:
        return [conn]
    try:
        result = _query_path("/routing/bgp/session", conn["host"], conn["port"], conn["username"], conn["password"])
        registry.update_last_seen(user_id, conn["name"])
        return result
    except Exception:
        return [{"info": "Routing package not installed"}]


@mcp.tool()
def list_routing_filters(user_id: str, router: str = "") -> list[dict]:
    """List routing filter rules. Requires the routing package to be installed.

    Args:
        user_id: Telegram user ID
        router: Router name (empty = default)
    """
    conn = _resolve_connection(user_id, router)
    if "error" in conn:
        return [conn]
    try:
        result = _query_path("/routing/filter/rule", conn["host"], conn["port"], conn["username"], conn["password"])
        registry.update_last_seen(user_id, conn["name"])
        return result
    except Exception:
        return [{"info": "Routing package not installed"}]


# ─────────────────────────────────────────────
#  TOOLS / MONITORING
# ─────────────────────────────────────────────

@mcp.tool()
def list_netwatch(user_id: str, router: str = "") -> list[dict]:
    """List netwatch entries (host monitoring with up/down scripts).

    Args:
        user_id: Telegram user ID
        router: Router name (empty = default)
    """
    conn = _resolve_connection(user_id, router)
    if "error" in conn:
        return [conn]
    result = _query_path("/tool/netwatch", conn["host"], conn["port"], conn["username"], conn["password"])
    registry.update_last_seen(user_id, conn["name"])
    return result


@mcp.tool()
def get_cloud_status(user_id: str, router: str = "") -> dict:
    """Get MikroTik Cloud (DDNS) status and DNS name.

    Args:
        user_id: Telegram user ID
        router: Router name (empty = default)
    """
    conn = _resolve_connection(user_id, router)
    if "error" in conn:
        return conn
    rows = _query_path("/ip/cloud", conn["host"], conn["port"], conn["username"], conn["password"])
    registry.update_last_seen(user_id, conn["name"])
    return rows[0] if rows else {"info": "Cloud/DDNS not available"}


@mcp.tool()
def list_snmp_settings(user_id: str, router: str = "") -> dict:
    """Get SNMP configuration.

    Args:
        user_id: Telegram user ID
        router: Router name (empty = default)
    """
    conn = _resolve_connection(user_id, router)
    if "error" in conn:
        return conn
    rows = _query_path("/snmp", conn["host"], conn["port"], conn["username"], conn["password"])
    registry.update_last_seen(user_id, conn["name"])
    return rows[0] if rows else {}


@mcp.tool()
def list_upnp_settings(user_id: str, router: str = "") -> dict:
    """Get UPnP configuration.

    Args:
        user_id: Telegram user ID
        router: Router name (empty = default)
    """
    conn = _resolve_connection(user_id, router)
    if "error" in conn:
        return conn
    rows = _query_path("/ip/upnp", conn["host"], conn["port"], conn["username"], conn["password"])
    registry.update_last_seen(user_id, conn["name"])
    return rows[0] if rows else {}


# ─────────────────────────────────────────────
#  INTERFACE TUNNELS
# ─────────────────────────────────────────────

@mcp.tool()
def list_eoip_tunnels(user_id: str, router: str = "") -> list[dict]:
    """List EoIP tunnel interfaces.

    Args:
        user_id: Telegram user ID
        router: Router name (empty = default)
    """
    conn = _resolve_connection(user_id, router)
    if "error" in conn:
        return [conn]
    result = _query_path("/interface/eoip", conn["host"], conn["port"], conn["username"], conn["password"])
    registry.update_last_seen(user_id, conn["name"])
    return result


@mcp.tool()
def list_gre_tunnels(user_id: str, router: str = "") -> list[dict]:
    """List GRE tunnel interfaces.

    Args:
        user_id: Telegram user ID
        router: Router name (empty = default)
    """
    conn = _resolve_connection(user_id, router)
    if "error" in conn:
        return [conn]
    result = _query_path("/interface/gre", conn["host"], conn["port"], conn["username"], conn["password"])
    registry.update_last_seen(user_id, conn["name"])
    return result


@mcp.tool()
def list_ipip_tunnels(user_id: str, router: str = "") -> list[dict]:
    """List IPIP tunnel interfaces.

    Args:
        user_id: Telegram user ID
        router: Router name (empty = default)
    """
    conn = _resolve_connection(user_id, router)
    if "error" in conn:
        return [conn]
    result = _query_path("/interface/ipip", conn["host"], conn["port"], conn["username"], conn["password"])
    registry.update_last_seen(user_id, conn["name"])
    return result


@mcp.tool()
def list_bonding_interfaces(user_id: str, router: str = "") -> list[dict]:
    """List bonding (link aggregation) interfaces.

    Args:
        user_id: Telegram user ID
        router: Router name (empty = default)
    """
    conn = _resolve_connection(user_id, router)
    if "error" in conn:
        return [conn]
    result = _query_path("/interface/bonding", conn["host"], conn["port"], conn["username"], conn["password"])
    registry.update_last_seen(user_id, conn["name"])
    return result


# ─────────────────────────────────────────────
#  FIREWALL EXTENDED (Write)
# ─────────────────────────────────────────────

@mcp.tool()
def add_firewall_filter(user_id: str, chain: str, action: str, protocol: str = "",
                        src_address: str = "", dst_address: str = "", dst_port: str = "",
                        src_port: str = "", in_interface: str = "", out_interface: str = "",
                        connection_state: str = "", src_address_list: str = "",
                        dst_address_list: str = "", log: str = "", log_prefix: str = "",
                        jump_target: str = "", disabled: str = "",
                        comment: str = "", router: str = "") -> dict:
    """Add a firewall filter rule. WRITE operation.

    Args:
        user_id: Telegram user ID
        chain: Chain name (input, forward, output)
        action: Action (accept, drop, reject, jump, log, passthrough, etc)
        protocol: Protocol (tcp, udp, icmp, etc). Empty = any.
        src_address: Source IP/subnet. Empty = any.
        dst_address: Destination IP/subnet. Empty = any.
        dst_port: Destination port(s) e.g., '80', '80,443', '8000-9000'. Empty = any.
        src_port: Source port(s). Empty = any.
        in_interface: Incoming interface (e.g., 'ether1', 'bridge1'). Empty = any.
        out_interface: Outgoing interface. Empty = any.
        connection_state: Connection state (e.g., 'established,related' or 'new'). Empty = any.
        src_address_list: Source address list name. Empty = any.
        dst_address_list: Destination address list name. Empty = any.
        log: Enable logging ('true' or 'false'). Empty = don't set.
        log_prefix: Log prefix string for identification. Empty = none.
        jump_target: Target chain for jump action.
        disabled: Create rule as disabled ('true'). Empty = enabled.
        comment: Rule comment/description.
        router: Router name (empty = default)
    """
    conn = _resolve_connection(user_id, router)
    if "error" in conn:
        return conn
    try:
        with connect_router(conn["host"], conn["port"], conn["username"], conn["password"]) as api:
            params: dict[str, str] = {"chain": chain, "action": action}
            if protocol:
                params["protocol"] = protocol
            if src_address:
                params["src-address"] = src_address
            if dst_address:
                params["dst-address"] = dst_address
            if dst_port:
                params["dst-port"] = dst_port
            if src_port:
                params["src-port"] = src_port
            if in_interface:
                params["in-interface"] = in_interface
            if out_interface:
                params["out-interface"] = out_interface
            if connection_state:
                params["connection-state"] = connection_state
            if src_address_list:
                params["src-address-list"] = src_address_list
            if dst_address_list:
                params["dst-address-list"] = dst_address_list
            if log:
                params["log"] = log
            if log_prefix:
                params["log-prefix"] = log_prefix
            if jump_target:
                params["jump-target"] = jump_target
            if disabled:
                params["disabled"] = disabled
            if comment:
                params["comment"] = comment
            api.path("ip", "firewall", "filter").add(**params)
            registry.update_last_seen(user_id, conn["name"])
            return {"status": "ok", "message": f"Firewall filter rule added: chain={chain}, action={action}"}
    except Exception as e:
        return {"error": f"Failed to add firewall filter rule: {e}"}


@mcp.tool()
def remove_firewall_filter(user_id: str, rule_id: str, router: str = "") -> dict:
    """Remove a firewall filter rule by its .id. WRITE operation.

    Args:
        user_id: Telegram user ID
        rule_id: The .id of the firewall filter rule to remove
        router: Router name (empty = default)
    """
    conn = _resolve_connection(user_id, router)
    if "error" in conn:
        return conn
    try:
        with connect_router(conn["host"], conn["port"], conn["username"], conn["password"]) as api:
            api.path("/ip/firewall/filter").remove(rule_id)
            registry.update_last_seen(user_id, conn["name"])
            return {"status": "ok", "message": f"Firewall filter rule '{rule_id}' removed"}
    except Exception as e:
        return {"error": f"Failed to remove firewall filter rule: {e}"}


@mcp.tool()
def add_nat_rule(user_id: str, chain: str, action: str, protocol: str = "",
                 src_address: str = "", dst_address: str = "", dst_port: str = "",
                 src_port: str = "", in_interface: str = "", out_interface: str = "",
                 to_addresses: str = "", to_ports: str = "",
                 log: str = "", log_prefix: str = "", disabled: str = "",
                 comment: str = "", router: str = "") -> dict:
    """Add a NAT rule. WRITE operation.

    Args:
        user_id: Telegram user ID
        chain: Chain name (srcnat, dstnat)
        action: Action (masquerade, dst-nat, src-nat, redirect, etc)
        protocol: Protocol (tcp, udp, etc). Empty = any.
        src_address: Source IP/subnet. Empty = any.
        dst_address: Destination IP/subnet. Empty = any.
        dst_port: Destination port(s). Empty = any.
        src_port: Source port(s). Empty = any.
        in_interface: Incoming interface. Empty = any.
        out_interface: Outgoing interface. Empty = any.
        to_addresses: NAT destination address(es). Empty = not set.
        to_ports: NAT destination port(s). Empty = not set.
        log: Enable logging ('true' or 'false'). Empty = don't set.
        log_prefix: Log prefix string. Empty = none.
        disabled: Create rule as disabled ('true'). Empty = enabled.
        comment: Rule comment/description.
        router: Router name (empty = default)
    """
    conn = _resolve_connection(user_id, router)
    if "error" in conn:
        return conn
    try:
        with connect_router(conn["host"], conn["port"], conn["username"], conn["password"]) as api:
            params: dict[str, str] = {"chain": chain, "action": action}
            if protocol:
                params["protocol"] = protocol
            if src_address:
                params["src-address"] = src_address
            if dst_address:
                params["dst-address"] = dst_address
            if dst_port:
                params["dst-port"] = dst_port
            if src_port:
                params["src-port"] = src_port
            if in_interface:
                params["in-interface"] = in_interface
            if out_interface:
                params["out-interface"] = out_interface
            if to_addresses:
                params["to-addresses"] = to_addresses
            if to_ports:
                params["to-ports"] = to_ports
            if log:
                params["log"] = log
            if log_prefix:
                params["log-prefix"] = log_prefix
            if disabled:
                params["disabled"] = disabled
            if comment:
                params["comment"] = comment
            api.path("ip", "firewall", "nat").add(**params)
            registry.update_last_seen(user_id, conn["name"])
            return {"status": "ok", "message": f"NAT rule added: chain={chain}, action={action}"}
    except Exception as e:
        return {"error": f"Failed to add NAT rule: {e}"}


@mcp.tool()
def remove_nat_rule(user_id: str, rule_id: str, router: str = "") -> dict:
    """Remove a NAT rule by its .id. WRITE operation.

    Args:
        user_id: Telegram user ID
        rule_id: The .id of the NAT rule to remove
        router: Router name (empty = default)
    """
    conn = _resolve_connection(user_id, router)
    if "error" in conn:
        return conn
    try:
        with connect_router(conn["host"], conn["port"], conn["username"], conn["password"]) as api:
            api.path("/ip/firewall/nat").remove(rule_id)
            registry.update_last_seen(user_id, conn["name"])
            return {"status": "ok", "message": f"NAT rule '{rule_id}' removed"}
    except Exception as e:
        return {"error": f"Failed to remove NAT rule: {e}"}


# ─────────────────────────────────────────────
#  STATIC ROUTE MANAGEMENT
# ─────────────────────────────────────────────

@mcp.tool()
def add_static_route(user_id: str, dst_address: str, gateway: str, distance: int = 1, comment: str = "", router: str = "") -> dict:
    """Add a static route. Example: dst_address='0.0.0.0/0', gateway='192.168.1.1'.

    Args:
        user_id: Telegram user ID
        dst_address: Destination network (e.g. '0.0.0.0/0', '10.0.0.0/8')
        gateway: Gateway IP address (e.g. '192.168.1.1')
        distance: Administrative distance (default: 1)
        comment: Optional comment
        router: Router name (empty = default)
    """
    conn = _resolve_connection(user_id, router)
    if "error" in conn:
        return conn
    try:
        with connect_router(conn["host"], conn["port"], conn["username"], conn["password"]) as api:
            params: dict[str, str] = {
                "dst-address": dst_address,
                "gateway": gateway,
                "distance": str(distance),
            }
            if comment:
                params["comment"] = comment
            api.path("/ip/route").add(**params)
            registry.update_last_seen(user_id, conn["name"])
            return {"status": "ok", "message": f"Static route added: {dst_address} via {gateway} (distance={distance})"}
    except Exception as e:
        return {"error": f"Failed to add static route: {e}. Check that dst_address is a valid CIDR (e.g. '10.0.0.0/8') and gateway is reachable."}


@mcp.tool()
def remove_static_route(user_id: str, route_id: str, router: str = "") -> dict:
    """Remove a static route by its .id. Use list_ip_routes to find the .id first.

    Args:
        user_id: Telegram user ID
        route_id: The .id of the route to remove
        router: Router name (empty = default)
    """
    conn = _resolve_connection(user_id, router)
    if "error" in conn:
        return conn
    try:
        with connect_router(conn["host"], conn["port"], conn["username"], conn["password"]) as api:
            api.path("/ip/route").remove(route_id)
            registry.update_last_seen(user_id, conn["name"])
            return {"status": "ok", "message": f"Static route '{route_id}' removed"}
    except Exception as e:
        return {"error": f"Failed to remove static route: {e}. Verify the route .id exists using list_ip_routes."}


# ─────────────────────────────────────────────
#  NAT ENABLE / DISABLE
# ─────────────────────────────────────────────

@mcp.tool()
def enable_nat_rule(user_id: str, rule_id: str, router: str = "") -> dict:
    """Enable a disabled NAT rule.

    Args:
        user_id: Telegram user ID
        rule_id: The .id of the NAT rule to enable
        router: Router name (empty = default)
    """
    conn = _resolve_connection(user_id, router)
    if "error" in conn:
        return conn
    try:
        with connect_router(conn["host"], conn["port"], conn["username"], conn["password"]) as api:
            api.path("/ip/firewall/nat").update(**{".id": rule_id, "disabled": "false"})
            registry.update_last_seen(user_id, conn["name"])
            return {"status": "ok", "message": f"NAT rule {rule_id} enabled"}
    except Exception as e:
        return {"error": f"Failed to enable NAT rule: {e}. Verify the rule .id using list_firewall_nat."}


@mcp.tool()
def disable_nat_rule(user_id: str, rule_id: str, router: str = "") -> dict:
    """Disable a NAT rule without removing it.

    Args:
        user_id: Telegram user ID
        rule_id: The .id of the NAT rule to disable
        router: Router name (empty = default)
    """
    conn = _resolve_connection(user_id, router)
    if "error" in conn:
        return conn
    try:
        with connect_router(conn["host"], conn["port"], conn["username"], conn["password"]) as api:
            api.path("/ip/firewall/nat").update(**{".id": rule_id, "disabled": "true"})
            registry.update_last_seen(user_id, conn["name"])
            return {"status": "ok", "message": f"NAT rule {rule_id} disabled"}
    except Exception as e:
        return {"error": f"Failed to disable NAT rule: {e}. Verify the rule .id using list_firewall_nat."}


# ─────────────────────────────────────────────
#  SCHEDULER CRUD
# ─────────────────────────────────────────────

@mcp.tool()
def add_scheduler(user_id: str, name: str, on_event: str, start_time: str = "startup", interval: str = "", router: str = "") -> dict:
    """Add a scheduled task. on_event is the RouterOS script to run.

    Args:
        user_id: Telegram user ID
        name: Scheduler entry name
        on_event: Script body or script name to execute
        start_time: When to start — 'startup' or time like '00:00:00' (default: 'startup')
        interval: Repeat interval (e.g. '1h', '30m', '1d'). Empty = run once.
        router: Router name (empty = default)
    """
    conn = _resolve_connection(user_id, router)
    if "error" in conn:
        return conn
    try:
        with connect_router(conn["host"], conn["port"], conn["username"], conn["password"]) as api:
            params: dict[str, str] = {
                "name": name,
                "on-event": on_event,
                "start-time": start_time,
            }
            if interval:
                params["interval"] = interval
            api.path("/system/scheduler").add(**params)
            registry.update_last_seen(user_id, conn["name"])
            return {"status": "ok", "message": f"Scheduler '{name}' created (start={start_time}, interval={interval or 'once'})"}
    except Exception as e:
        err = str(e)
        if "already" in err.lower():
            return {"error": f"Scheduler '{name}' already exists. Remove it first or use a different name."}
        return {"error": f"Failed to add scheduler: {e}"}


@mcp.tool()
def remove_scheduler(user_id: str, name: str, router: str = "") -> dict:
    """Remove a scheduled task by name.

    Args:
        user_id: Telegram user ID
        name: Name of the scheduler entry to remove
        router: Router name (empty = default)
    """
    conn = _resolve_connection(user_id, router)
    if "error" in conn:
        return conn
    try:
        with connect_router(conn["host"], conn["port"], conn["username"], conn["password"]) as api:
            entries = list(api.path("system", "scheduler").select().where(Key("name") == name))
            if not entries:
                return {"error": f"Scheduler '{name}' not found. Use list_system_scheduler to see available entries."}
            api.path("system", "scheduler").remove(entries[0][".id"])
            registry.update_last_seen(user_id, conn["name"])
            return {"status": "ok", "message": f"Scheduler '{name}' removed"}
    except Exception as e:
        return {"error": f"Failed to remove scheduler: {e}"}


# ─────────────────────────────────────────────
#  BACKUP / EXPORT
# ─────────────────────────────────────────────

@mcp.tool()
def create_backup(user_id: str, name: str = "backup", router: str = "") -> dict:
    """Create a router backup file on the router. Returns the filename.
    The backup is stored on the router's filesystem and can be downloaded via WinBox/FTP.

    Args:
        user_id: Telegram user ID
        name: Backup filename without extension (default: 'backup')
        router: Router name (empty = default)
    """
    conn = _resolve_connection(user_id, router)
    if "error" in conn:
        return conn
    try:
        with connect_router(conn["host"], conn["port"], conn["username"], conn["password"]) as api:
            list(api.rawCmd("/system/backup/save", name=name))
            registry.update_last_seen(user_id, conn["name"])
            return {"status": "ok", "message": f"Backup created: {name}.backup (stored on router filesystem)"}
    except Exception as e:
        return {"error": f"Failed to create backup: {e}. The backup command may not be available via API on some RouterOS versions."}


@mcp.tool()
def export_config(user_id: str, router: str = "") -> dict:
    """Export router configuration as text. Note: full /export may not be available via API.
    Falls back to returning key configuration sections if the export command fails.

    Args:
        user_id: Telegram user ID
        router: Router name (empty = default)
    """
    conn = _resolve_connection(user_id, router)
    if "error" in conn:
        return conn
    try:
        with connect_router(conn["host"], conn["port"], conn["username"], conn["password"]) as api:
            try:
                result = list(api.rawCmd("/export"))
                registry.update_last_seen(user_id, conn["name"])
                return {"status": "ok", "config": result}
            except Exception:
                # /export is not available via API on most RouterOS versions
                # Return a summary of key config sections instead
                identity = list(api.path("/system/identity"))
                resource = list(api.path("/system/resource"))
                registry.update_last_seen(user_id, conn["name"])
                return {
                    "info": "Full /export is not available via API. Use WinBox or SSH for full config export.",
                    "identity": identity[0].get("name", "") if identity else "",
                    "version": resource[0].get("version", "") if resource else "",
                    "suggestion": "Use run_routeros_query to query specific config sections instead.",
                }
    except Exception as e:
        return {"error": f"Failed to export config: {e}"}


# ─────────────────────────────────────────────
#  PPPoE CLIENT
# ─────────────────────────────────────────────

@mcp.tool()
def list_pppoe_client(user_id: str, router: str = "") -> list[dict]:
    """List PPPoE client interfaces (WAN connections via PPPoE).

    Args:
        user_id: Telegram user ID
        router: Router name (empty = default)
    """
    conn = _resolve_connection(user_id, router)
    if "error" in conn:
        return [conn]
    try:
        result = _query_path("/interface/pppoe-client", conn["host"], conn["port"], conn["username"], conn["password"])
        registry.update_last_seen(user_id, conn["name"])
        return result
    except Exception as e:
        return [{"error": f"Failed to list PPPoE clients: {e}. This router may not have any PPPoE client interfaces configured."}]


# ─────────────────────────────────────────────
#  IP ACCOUNTING
# ─────────────────────────────────────────────

@mcp.tool()
def get_ip_accounting(user_id: str, router: str = "") -> dict:
    """Get IP accounting settings (traffic tracking per IP pair).

    Args:
        user_id: Telegram user ID
        router: Router name (empty = default)
    """
    conn = _resolve_connection(user_id, router)
    if "error" in conn:
        return conn
    try:
        rows = _query_path("/ip/accounting", conn["host"], conn["port"], conn["username"], conn["password"])
        registry.update_last_seen(user_id, conn["name"])
        return rows[0] if rows else {"info": "IP accounting not configured on this router"}
    except Exception as e:
        return {"error": f"Failed to get IP accounting settings: {e}"}


@mcp.tool()
def list_ip_accounting_snapshot(user_id: str, router: str = "") -> list[dict]:
    """Get IP accounting snapshot (traffic per IP pair). Limited to first 50 entries.
    Take a snapshot first via the router if needed.

    Args:
        user_id: Telegram user ID
        router: Router name (empty = default)
    """
    conn = _resolve_connection(user_id, router)
    if "error" in conn:
        return [conn]
    try:
        rows = _query_path("/ip/accounting/snapshot", conn["host"], conn["port"], conn["username"], conn["password"])
        registry.update_last_seen(user_id, conn["name"])
        return rows[:50]
    except Exception as e:
        return [{"error": f"Failed to get IP accounting snapshot: {e}. Ensure IP accounting is enabled and a snapshot has been taken."}]


# ─────────────────────────────────────────────
#  BRIDGE FILTER
# ─────────────────────────────────────────────

@mcp.tool()
def list_bridge_filter(user_id: str, router: str = "") -> list[dict]:
    """List bridge firewall filter rules (Layer 2 firewall).

    Args:
        user_id: Telegram user ID
        router: Router name (empty = default)
    """
    conn = _resolve_connection(user_id, router)
    if "error" in conn:
        return [conn]
    try:
        result = _query_path("/interface/bridge/filter", conn["host"], conn["port"], conn["username"], conn["password"])
        registry.update_last_seen(user_id, conn["name"])
        return result
    except Exception as e:
        return [{"error": f"Failed to list bridge filter rules: {e}"}]


# ─────────────────────────────────────────────
#  IPv6
# ─────────────────────────────────────────────

@mcp.tool()
def list_ipv6_addresses(user_id: str, router: str = "") -> list[dict]:
    """List IPv6 addresses. Not all routers have IPv6 enabled.

    Args:
        user_id: Telegram user ID
        router: Router name (empty = default)
    """
    conn = _resolve_connection(user_id, router)
    if "error" in conn:
        return [conn]
    try:
        result = _query_path("/ipv6/address", conn["host"], conn["port"], conn["username"], conn["password"])
        registry.update_last_seen(user_id, conn["name"])
        return result
    except Exception:
        return [{"info": "IPv6 not available on this router. The IPv6 package may not be installed."}]


@mcp.tool()
def list_ipv6_routes(user_id: str, router: str = "") -> list[dict]:
    """List IPv6 routing table. Not all routers have IPv6 enabled.

    Args:
        user_id: Telegram user ID
        router: Router name (empty = default)
    """
    conn = _resolve_connection(user_id, router)
    if "error" in conn:
        return [conn]
    try:
        result = _query_path("/ipv6/route", conn["host"], conn["port"], conn["username"], conn["password"])
        registry.update_last_seen(user_id, conn["name"])
        return result
    except Exception:
        return [{"info": "IPv6 not available on this router. The IPv6 package may not be installed."}]


# ─────────────────────────────────────────────
#  CAPsMAN
# ─────────────────────────────────────────────

@mcp.tool()
def list_capsman_interfaces(user_id: str, router: str = "") -> list[dict]:
    """List CAPsMAN managed wireless interfaces. Only available on routers acting as CAPsMAN controller.

    Args:
        user_id: Telegram user ID
        router: Router name (empty = default)
    """
    conn = _resolve_connection(user_id, router)
    if "error" in conn:
        return [conn]
    try:
        result = _query_path("/caps-man/interface", conn["host"], conn["port"], conn["username"], conn["password"])
        registry.update_last_seen(user_id, conn["name"])
        return result
    except Exception:
        return [{"info": "CAPsMAN not available on this router. It may not be configured as a CAPsMAN controller."}]


@mcp.tool()
def list_capsman_registrations(user_id: str, router: str = "") -> list[dict]:
    """List CAPsMAN registered access points. Only available on CAPsMAN controllers.

    Args:
        user_id: Telegram user ID
        router: Router name (empty = default)
    """
    conn = _resolve_connection(user_id, router)
    if "error" in conn:
        return [conn]
    try:
        result = _query_path("/caps-man/registration-table", conn["host"], conn["port"], conn["username"], conn["password"])
        registry.update_last_seen(user_id, conn["name"])
        return result
    except Exception:
        return [{"info": "CAPsMAN not available on this router. It may not be configured as a CAPsMAN controller."}]


# ─────────────────────────────────────────────
#  FIREWALL RAW
# ─────────────────────────────────────────────

@mcp.tool()
def list_firewall_raw(user_id: str, router: str = "") -> list[dict]:
    """List raw firewall rules (pre-connection tracking). These rules are processed before connection tracking.

    Args:
        user_id: Telegram user ID
        router: Router name (empty = default)
    """
    conn = _resolve_connection(user_id, router)
    if "error" in conn:
        return [conn]
    try:
        rows = _query_path("/ip/firewall/raw", conn["host"], conn["port"], conn["username"], conn["password"])
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
    except Exception as e:
        return [{"error": f"Failed to list raw firewall rules: {e}"}]


# ─────────────────────────────────────────────
#  RESELLER TOOLS
# ─────────────────────────────────────────────

@mcp.tool()
def reseller_check_saldo(user_id: str, reseller_telegram_id: str) -> dict:
    """Check a reseller's current saldo/balance.

    Args:
        user_id: Telegram user ID
        reseller_telegram_id: Reseller's Telegram ID
    """
    err = _validate_user_id(user_id)
    if err:
        return {"error": err}
    try:
        vdb = _get_voucher_db()
        if not vdb:
            return {"error": "Voucher database not available"}
        reseller = vdb.get_reseller_by_telegram(reseller_telegram_id)
        if not reseller:
            return {"error": "Reseller not found"}
        return {
            "status": "ok",
            "reseller_name": reseller["name"],
            "balance": reseller["balance"],
        }
    except Exception as e:
        return {"error": f"Failed to check reseller saldo: {e}"}


@mcp.tool()
def reseller_generate_voucher(user_id: str, reseller_telegram_id: str, profile: str,
                               count: int = 1, router: str = "") -> dict:
    """Generate hotspot vouchers on behalf of a reseller, deducting from their saldo.

    Args:
        user_id: Telegram user ID
        reseller_telegram_id: Reseller's Telegram ID
        profile: Hotspot user profile to assign
        count: Number of vouchers to generate (max 100)
        router: Router name. Empty = default router.
    """
    err = _validate_user_id(user_id)
    if err:
        return {"error": err}
    if count < 1:
        return {"error": "Count must be at least 1."}
    if count > 100:
        return {"error": "Maximum 100 vouchers per batch."}

    try:
        vdb = _get_voucher_db()
        if not vdb:
            return {"error": "Voucher database not available"}
        reseller = vdb.get_reseller_by_telegram(reseller_telegram_id)
        if not reseller:
            return {"error": "Reseller not found"}

        price_per_unit = 0  # TODO: add pricing config
        total_cost = count * price_per_unit
        if total_cost > 0:
            balance = vdb.check_saldo(reseller["id"])
            if balance is None or balance < total_cost:
                return {"error": f"Saldo tidak mencukupi (saldo: {balance}, butuh: {total_cost})"}

        conn = _resolve_connection(user_id, router)
        if "error" in conn:
            return conn

        with connect_router(conn["host"], conn["port"], conn["username"], conn["password"]) as api:
            profiles = list(api.path("ip", "hotspot", "user", "profile"))
            profile_names = [p.get("name", "") for p in profiles]
            if profile not in profile_names:
                return {"error": f"Profile '{profile}' not found. Available profiles: {', '.join(profile_names)}"}

            existing = {u.get("name", "") for u in api.path("ip", "hotspot", "user")}
            charset = string.ascii_lowercase + string.digits
            resource = api.path("ip", "hotspot", "user")
            vouchers = []
            errors = []

            for i in range(count):
                for _ in range(10):
                    uname = "".join(random.choices(charset, k=6))
                    if uname not in existing:
                        break
                else:
                    errors.append(f"Voucher #{i+1}: failed to generate unique username")
                    continue

                pwd = "".join(random.choices(charset, k=6))
                params: dict[str, str] = {
                    "name": uname,
                    "password": pwd,
                    "profile": profile,
                }
                try:
                    resource.add(**params)
                    existing.add(uname)
                    vouchers.append({"username": uname, "password": pwd})
                except Exception as e:
                    errors.append(f"Voucher #{i+1} ({uname}): {e}")

        if not vouchers:
            return {"error": "No vouchers created", "details": errors}

        # Deduct saldo
        balance_after = reseller["balance"]
        if total_cost > 0:
            tx = vdb.deduct_saldo(
                reseller["id"], total_cost,
                description=f"Voucher {profile} x{len(vouchers)}",
            )
            balance_after = tx["balanceAfter"]

        # Persist batch
        try:
            vdb.save_batch(
                user_id=user_id,
                router_name=conn["name"],
                profile=profile,
                vouchers=vouchers,
                source="reseller_bot",
                reseller_id=reseller["id"],
                price_per_unit=price_per_unit,
            )
        except Exception as e:
            logger.warning("Failed to persist reseller voucher batch to DB: %s", e)

        registry.update_last_seen(user_id, conn["name"])
        result: dict = {
            "status": "ok",
            "vouchers": vouchers,
            "count": len(vouchers),
            "balance_after": balance_after,
        }
        if errors:
            result["errors"] = errors
        return result
    except ValueError as e:
        return {"error": str(e)}
    except Exception as e:
        return {"error": f"Failed to generate reseller vouchers: {e}"}


@mcp.tool()
def reseller_request_deposit(user_id: str, reseller_telegram_id: str, amount: int) -> dict:
    """Request a saldo deposit for a reseller. Notifies the owner.

    Args:
        user_id: Telegram user ID
        reseller_telegram_id: Reseller's Telegram ID
        amount: Deposit amount requested
    """
    err = _validate_user_id(user_id)
    if err:
        return {"error": err}
    if amount <= 0:
        return {"error": "Amount must be positive."}
    try:
        vdb = _get_voucher_db()
        if not vdb:
            return {"error": "Voucher database not available"}
        reseller = vdb.get_reseller_by_telegram(reseller_telegram_id)
        if not reseller:
            return {"error": "Reseller not found"}
        owner_tid = vdb.get_owner_telegram_id(reseller["id"])
        return {
            "status": "ok",
            "message": "Deposit request sent",
            "owner_telegram_id": owner_tid,
            "amount": amount,
        }
    except Exception as e:
        return {"error": f"Failed to request deposit: {e}"}


@mcp.tool()
def reseller_transaction_history(user_id: str, reseller_telegram_id: str, limit: int = 10) -> dict:
    """Get recent saldo transaction history for a reseller.

    Args:
        user_id: Telegram user ID
        reseller_telegram_id: Reseller's Telegram ID
        limit: Max number of transactions to return (default 10)
    """
    err = _validate_user_id(user_id)
    if err:
        return {"error": err}
    try:
        vdb = _get_voucher_db()
        if not vdb:
            return {"error": "Voucher database not available"}
        reseller = vdb.get_reseller_by_telegram(reseller_telegram_id)
        if not reseller:
            return {"error": "Reseller not found"}
        transactions = vdb.get_transactions(reseller["id"], limit)
        return {
            "status": "ok",
            "transactions": transactions,
            "reseller_name": reseller["name"],
        }
    except Exception as e:
        return {"error": f"Failed to get transaction history: {e}"}


# ─────────────────────────────────────────────
#  GENERIC WRITE TOOL (Fallback for uncovered operations)
# ─────────────────────────────────────────────

@mcp.tool()
def run_routeros_command(user_id: str, api_path: str, action: str, params: str = "",
                          router: str = "") -> dict:
    """Execute a write command on any RouterOS API path. Use as fallback for operations
    not covered by dedicated tools.

    Args:
        user_id: Telegram user ID (required)
        api_path: The RouterOS API path (e.g., '/ip/service', '/interface/bridge')
        action: One of 'add', 'set', 'remove'. 'add' creates new entry, 'set' updates by .id, 'remove' deletes by .id.
        params: JSON string of parameters (e.g., '{"name":"bridge1"}' for add, '{".id":"*1","disabled":"true"}' for set, '{".id":"*1"}' for remove)
        router: Router name. Empty = default router.
    """
    import json as _json
    conn = _resolve_connection(user_id, router)
    if "error" in conn:
        return conn
    if action not in ("add", "set", "remove"):
        return {"error": f"Invalid action '{action}'. Must be 'add', 'set', or 'remove'."}
    try:
        parsed = _json.loads(params) if params else {}
    except _json.JSONDecodeError as e:
        return {"error": f"Invalid JSON params: {e}"}
    try:
        with connect_router(conn["host"], conn["port"], conn["username"], conn["password"]) as api:
            resource = api.path(api_path)
            if action == "add":
                new_id = resource.add(**parsed)
                registry.update_last_seen(user_id, conn["name"])
                return {"status": "ok", "message": f"Entry added at {api_path}", ".id": new_id}
            elif action == "set":
                resource.update(**parsed)
                registry.update_last_seen(user_id, conn["name"])
                return {"status": "ok", "message": f"Entry updated at {api_path}"}
            elif action == "remove":
                rid = parsed.get(".id", "")
                if not rid:
                    return {"error": "Remove requires '.id' in params"}
                resource.remove(rid)
                registry.update_last_seen(user_id, conn["name"])
                return {"status": "ok", "message": f"Entry '{rid}' removed from {api_path}"}
    except Exception as e:
        return {"error": f"Command failed on {api_path}: {e}"}


# ─────────────────────────────────────────────
#  HOTSPOT EXTENDED — IP Bindings, Walled Garden
# ─────────────────────────────────────────────

@mcp.tool()
def add_hotspot_ip_binding(user_id: str, address: str = "", mac_address: str = "",
                            type: str = "bypassed", comment: str = "",
                            server: str = "", router: str = "") -> dict:
    """Add a hotspot IP binding (bypass or block an IP/MAC from hotspot auth).

    Args:
        user_id: Telegram user ID
        address: IP address to bind (e.g., '10.10.8.100'). Empty = any.
        mac_address: MAC address to bind (e.g., 'AA:BB:CC:DD:EE:FF'). Empty = any.
        type: Binding type — 'bypassed' (skip auth), 'blocked' (deny access), 'regular' (normal auth).
        comment: Description.
        server: Hotspot server name. Empty = all.
        router: Router name (empty = default)
    """
    conn = _resolve_connection(user_id, router)
    if "error" in conn:
        return conn
    try:
        with connect_router(conn["host"], conn["port"], conn["username"], conn["password"]) as api:
            params: dict[str, str] = {"type": type}
            if address:
                params["address"] = address
            if mac_address:
                params["mac-address"] = mac_address
            if comment:
                params["comment"] = comment
            if server:
                params["server"] = server
            api.path("ip", "hotspot", "ip-binding").add(**params)
            registry.update_last_seen(user_id, conn["name"])
            target = address or mac_address or "any"
            return {"status": "ok", "message": f"IP binding added: {target} → {type}"}
    except Exception as e:
        return {"error": f"Failed to add IP binding: {e}"}


@mcp.tool()
def remove_hotspot_ip_binding(user_id: str, binding_id: str, router: str = "") -> dict:
    """Remove a hotspot IP binding by its .id.

    Args:
        user_id: Telegram user ID
        binding_id: The .id of the binding to remove
        router: Router name (empty = default)
    """
    conn = _resolve_connection(user_id, router)
    if "error" in conn:
        return conn
    try:
        with connect_router(conn["host"], conn["port"], conn["username"], conn["password"]) as api:
            api.path("ip", "hotspot", "ip-binding").remove(binding_id)
            registry.update_last_seen(user_id, conn["name"])
            return {"status": "ok", "message": f"IP binding '{binding_id}' removed"}
    except Exception as e:
        return {"error": f"Failed to remove IP binding: {e}"}


@mcp.tool()
def add_hotspot_walled_garden(user_id: str, dst_host: str = "", dst_port: str = "",
                               action: str = "allow", comment: str = "",
                               server: str = "", router: str = "") -> dict:
    """Add a walled garden rule (allow access to site/IP before hotspot login).

    Args:
        user_id: Telegram user ID
        dst_host: Destination hostname pattern (e.g., '*.google.com', 'example.com'). Supports wildcards.
        dst_port: Destination port (e.g., '443'). Empty = any.
        action: 'allow' or 'deny'. Default: allow.
        comment: Description.
        server: Hotspot server name. Empty = all.
        router: Router name (empty = default)
    """
    conn = _resolve_connection(user_id, router)
    if "error" in conn:
        return conn
    try:
        with connect_router(conn["host"], conn["port"], conn["username"], conn["password"]) as api:
            params: dict[str, str] = {"action": action}
            if dst_host:
                params["dst-host"] = dst_host
            if dst_port:
                params["dst-port"] = dst_port
            if comment:
                params["comment"] = comment
            if server:
                params["server"] = server
            api.path("ip", "hotspot", "walled-garden").add(**params)
            registry.update_last_seen(user_id, conn["name"])
            return {"status": "ok", "message": f"Walled garden rule added: {dst_host or 'any'} → {action}"}
    except Exception as e:
        return {"error": f"Failed to add walled garden rule: {e}"}


@mcp.tool()
def remove_hotspot_walled_garden(user_id: str, rule_id: str, router: str = "") -> dict:
    """Remove a walled garden rule by its .id.

    Args:
        user_id: Telegram user ID
        rule_id: The .id of the rule to remove
        router: Router name (empty = default)
    """
    conn = _resolve_connection(user_id, router)
    if "error" in conn:
        return conn
    try:
        with connect_router(conn["host"], conn["port"], conn["username"], conn["password"]) as api:
            api.path("ip", "hotspot", "walled-garden").remove(rule_id)
            registry.update_last_seen(user_id, conn["name"])
            return {"status": "ok", "message": f"Walled garden rule '{rule_id}' removed"}
    except Exception as e:
        return {"error": f"Failed to remove walled garden rule: {e}"}


# ─────────────────────────────────────────────
#  NETWORK INFRA — Bridge, VLAN, DHCP, IP Pool
# ─────────────────────────────────────────────

@mcp.tool()
def add_bridge_port(user_id: str, bridge: str, interface: str, comment: str = "",
                     router: str = "") -> dict:
    """Add an interface to a bridge.

    Args:
        user_id: Telegram user ID
        bridge: Bridge name (e.g., 'bridge1')
        interface: Interface to add to bridge (e.g., 'ether2', 'wlan1')
        comment: Description.
        router: Router name (empty = default)
    """
    conn = _resolve_connection(user_id, router)
    if "error" in conn:
        return conn
    try:
        with connect_router(conn["host"], conn["port"], conn["username"], conn["password"]) as api:
            params: dict[str, str] = {"bridge": bridge, "interface": interface}
            if comment:
                params["comment"] = comment
            api.path("interface", "bridge", "port").add(**params)
            registry.update_last_seen(user_id, conn["name"])
            return {"status": "ok", "message": f"Interface '{interface}' added to bridge '{bridge}'"}
    except Exception as e:
        return {"error": f"Failed to add bridge port: {e}"}


@mcp.tool()
def remove_bridge_port(user_id: str, port_id: str, router: str = "") -> dict:
    """Remove an interface from a bridge by its .id.

    Args:
        user_id: Telegram user ID
        port_id: The .id of the bridge port to remove
        router: Router name (empty = default)
    """
    conn = _resolve_connection(user_id, router)
    if "error" in conn:
        return conn
    try:
        with connect_router(conn["host"], conn["port"], conn["username"], conn["password"]) as api:
            api.path("interface", "bridge", "port").remove(port_id)
            registry.update_last_seen(user_id, conn["name"])
            return {"status": "ok", "message": f"Bridge port '{port_id}' removed"}
    except Exception as e:
        return {"error": f"Failed to remove bridge port: {e}"}


@mcp.tool()
def add_vlan(user_id: str, name: str, vlan_id: int, interface: str, comment: str = "",
             router: str = "") -> dict:
    """Create a VLAN interface.

    Args:
        user_id: Telegram user ID
        name: VLAN interface name (e.g., 'vlan100')
        vlan_id: VLAN ID number (1-4094)
        interface: Parent interface (e.g., 'ether1', 'bridge1')
        comment: Description.
        router: Router name (empty = default)
    """
    conn = _resolve_connection(user_id, router)
    if "error" in conn:
        return conn
    try:
        with connect_router(conn["host"], conn["port"], conn["username"], conn["password"]) as api:
            params: dict[str, str] = {"name": name, "vlan-id": str(vlan_id), "interface": interface}
            if comment:
                params["comment"] = comment
            api.path("interface", "vlan").add(**params)
            registry.update_last_seen(user_id, conn["name"])
            return {"status": "ok", "message": f"VLAN '{name}' (ID {vlan_id}) created on {interface}"}
    except Exception as e:
        return {"error": f"Failed to create VLAN: {e}"}


@mcp.tool()
def remove_vlan(user_id: str, vlan_name: str, router: str = "") -> dict:
    """Remove a VLAN interface by name.

    Args:
        user_id: Telegram user ID
        vlan_name: VLAN interface name to remove
        router: Router name (empty = default)
    """
    conn = _resolve_connection(user_id, router)
    if "error" in conn:
        return conn
    try:
        with connect_router(conn["host"], conn["port"], conn["username"], conn["password"]) as api:
            vlans = list(api.path("interface", "vlan").select().where(Key("name") == vlan_name))
            if not vlans:
                return {"error": f"VLAN '{vlan_name}' not found"}
            api.path("interface", "vlan").remove(vlans[0][".id"])
            registry.update_last_seen(user_id, conn["name"])
            return {"status": "ok", "message": f"VLAN '{vlan_name}' removed"}
    except Exception as e:
        return {"error": f"Failed to remove VLAN: {e}"}


@mcp.tool()
def add_ip_pool(user_id: str, name: str, ranges: str, comment: str = "",
                router: str = "") -> dict:
    """Create an IP address pool (for DHCP or PPP).

    Args:
        user_id: Telegram user ID
        name: Pool name (e.g., 'dhcp-pool')
        ranges: IP range(s) (e.g., '192.168.1.100-192.168.1.200')
        comment: Description.
        router: Router name (empty = default)
    """
    conn = _resolve_connection(user_id, router)
    if "error" in conn:
        return conn
    try:
        with connect_router(conn["host"], conn["port"], conn["username"], conn["password"]) as api:
            params: dict[str, str] = {"name": name, "ranges": ranges}
            if comment:
                params["comment"] = comment
            api.path("ip", "pool").add(**params)
            registry.update_last_seen(user_id, conn["name"])
            return {"status": "ok", "message": f"IP pool '{name}' created: {ranges}"}
    except Exception as e:
        return {"error": f"Failed to create IP pool: {e}"}


@mcp.tool()
def remove_ip_pool(user_id: str, pool_name: str, router: str = "") -> dict:
    """Remove an IP pool by name.

    Args:
        user_id: Telegram user ID
        pool_name: Pool name to remove
        router: Router name (empty = default)
    """
    conn = _resolve_connection(user_id, router)
    if "error" in conn:
        return conn
    try:
        with connect_router(conn["host"], conn["port"], conn["username"], conn["password"]) as api:
            pools = list(api.path("ip", "pool").select().where(Key("name") == pool_name))
            if not pools:
                return {"error": f"IP pool '{pool_name}' not found"}
            api.path("ip", "pool").remove(pools[0][".id"])
            registry.update_last_seen(user_id, conn["name"])
            return {"status": "ok", "message": f"IP pool '{pool_name}' removed"}
    except Exception as e:
        return {"error": f"Failed to remove IP pool: {e}"}


@mcp.tool()
def add_dhcp_server(user_id: str, name: str, interface: str, address_pool: str,
                     lease_time: str = "10m", disabled: str = "",
                     router: str = "") -> dict:
    """Create a DHCP server instance.

    Args:
        user_id: Telegram user ID
        name: DHCP server name (e.g., 'dhcp1')
        interface: Interface to serve DHCP on (e.g., 'bridge1')
        address_pool: IP pool name to use (e.g., 'dhcp-pool')
        lease_time: Lease duration (e.g., '10m', '1h', '1d'). Default: 10m.
        disabled: Create as disabled ('true'). Empty = enabled.
        router: Router name (empty = default)
    """
    conn = _resolve_connection(user_id, router)
    if "error" in conn:
        return conn
    try:
        with connect_router(conn["host"], conn["port"], conn["username"], conn["password"]) as api:
            params: dict[str, str] = {
                "name": name, "interface": interface,
                "address-pool": address_pool, "lease-time": lease_time,
            }
            if disabled:
                params["disabled"] = disabled
            api.path("ip", "dhcp-server").add(**params)
            registry.update_last_seen(user_id, conn["name"])
            return {"status": "ok", "message": f"DHCP server '{name}' created on {interface}"}
    except Exception as e:
        return {"error": f"Failed to create DHCP server: {e}"}


@mcp.tool()
def add_dhcp_network(user_id: str, address: str, gateway: str, dns_server: str = "",
                      domain: str = "", comment: str = "", router: str = "") -> dict:
    """Add a DHCP network (defines gateway, DNS for a subnet).

    Args:
        user_id: Telegram user ID
        address: Network address (e.g., '192.168.1.0/24')
        gateway: Default gateway IP (e.g., '192.168.1.1')
        dns_server: DNS server(s) to assign (e.g., '8.8.8.8,8.8.4.4'). Empty = none.
        domain: Domain name to assign. Empty = none.
        comment: Description.
        router: Router name (empty = default)
    """
    conn = _resolve_connection(user_id, router)
    if "error" in conn:
        return conn
    try:
        with connect_router(conn["host"], conn["port"], conn["username"], conn["password"]) as api:
            params: dict[str, str] = {"address": address, "gateway": gateway}
            if dns_server:
                params["dns-server"] = dns_server
            if domain:
                params["domain"] = domain
            if comment:
                params["comment"] = comment
            api.path("ip", "dhcp-server", "network").add(**params)
            registry.update_last_seen(user_id, conn["name"])
            return {"status": "ok", "message": f"DHCP network added: {address} gw={gateway}"}
    except Exception as e:
        return {"error": f"Failed to add DHCP network: {e}"}


# ─────────────────────────────────────────────
#  FIREWALL — Mangle, Queue Tree
# ─────────────────────────────────────────────

@mcp.tool()
def add_mangle_rule(user_id: str, chain: str, action: str, new_packet_mark: str = "",
                     new_connection_mark: str = "", protocol: str = "",
                     src_address: str = "", dst_address: str = "", dst_port: str = "",
                     in_interface: str = "", out_interface: str = "",
                     connection_state: str = "", passthrough: str = "true",
                     comment: str = "", disabled: str = "", router: str = "") -> dict:
    """Add a firewall mangle rule (packet/connection marking for QoS).

    Args:
        user_id: Telegram user ID
        chain: Chain (prerouting, postrouting, forward, input, output)
        action: Action (mark-packet, mark-connection, mark-routing, passthrough, etc)
        new_packet_mark: New packet mark name (for mark-packet action)
        new_connection_mark: New connection mark name (for mark-connection action)
        protocol: Protocol (tcp, udp, icmp). Empty = any.
        src_address: Source IP/subnet. Empty = any.
        dst_address: Destination IP/subnet. Empty = any.
        dst_port: Destination port(s). Empty = any.
        in_interface: Incoming interface. Empty = any.
        out_interface: Outgoing interface. Empty = any.
        connection_state: Connection state (new, established, related). Empty = any.
        passthrough: Pass to next rule after match ('true'/'false'). Default: true.
        comment: Description.
        disabled: Create as disabled ('true'). Empty = enabled.
        router: Router name (empty = default)
    """
    conn = _resolve_connection(user_id, router)
    if "error" in conn:
        return conn
    try:
        with connect_router(conn["host"], conn["port"], conn["username"], conn["password"]) as api:
            params: dict[str, str] = {"chain": chain, "action": action, "passthrough": passthrough}
            if new_packet_mark:
                params["new-packet-mark"] = new_packet_mark
            if new_connection_mark:
                params["new-connection-mark"] = new_connection_mark
            if protocol:
                params["protocol"] = protocol
            if src_address:
                params["src-address"] = src_address
            if dst_address:
                params["dst-address"] = dst_address
            if dst_port:
                params["dst-port"] = dst_port
            if in_interface:
                params["in-interface"] = in_interface
            if out_interface:
                params["out-interface"] = out_interface
            if connection_state:
                params["connection-state"] = connection_state
            if comment:
                params["comment"] = comment
            if disabled:
                params["disabled"] = disabled
            api.path("ip", "firewall", "mangle").add(**params)
            registry.update_last_seen(user_id, conn["name"])
            return {"status": "ok", "message": f"Mangle rule added: chain={chain}, action={action}"}
    except Exception as e:
        return {"error": f"Failed to add mangle rule: {e}"}


@mcp.tool()
def remove_mangle_rule(user_id: str, rule_id: str, router: str = "") -> dict:
    """Remove a mangle rule by its .id.

    Args:
        user_id: Telegram user ID
        rule_id: The .id of the mangle rule to remove
        router: Router name (empty = default)
    """
    conn = _resolve_connection(user_id, router)
    if "error" in conn:
        return conn
    try:
        with connect_router(conn["host"], conn["port"], conn["username"], conn["password"]) as api:
            api.path("ip", "firewall", "mangle").remove(rule_id)
            registry.update_last_seen(user_id, conn["name"])
            return {"status": "ok", "message": f"Mangle rule '{rule_id}' removed"}
    except Exception as e:
        return {"error": f"Failed to remove mangle rule: {e}"}


@mcp.tool()
def add_queue_tree(user_id: str, name: str, parent: str, packet_mark: str = "",
                    max_limit: str = "", limit_at: str = "", burst_limit: str = "",
                    burst_threshold: str = "", burst_time: str = "", priority: str = "",
                    queue_type: str = "", comment: str = "", disabled: str = "",
                    router: str = "") -> dict:
    """Add a queue tree entry (advanced hierarchical bandwidth management).

    Args:
        user_id: Telegram user ID
        name: Queue name
        parent: Parent queue or interface (e.g., 'global', 'ether1')
        packet_mark: Packet mark to match (from mangle rules)
        max_limit: Maximum bandwidth (e.g., '10M')
        limit_at: Guaranteed minimum bandwidth (e.g., '2M')
        burst_limit: Burst speed (e.g., '15M')
        burst_threshold: Burst threshold (e.g., '8M')
        burst_time: Burst time (e.g., '10')
        priority: Priority 1-8 (1=highest)
        queue_type: Queue algorithm (default, pcq-upload-default, etc)
        comment: Description.
        disabled: Create as disabled ('true'). Empty = enabled.
        router: Router name (empty = default)
    """
    conn = _resolve_connection(user_id, router)
    if "error" in conn:
        return conn
    try:
        with connect_router(conn["host"], conn["port"], conn["username"], conn["password"]) as api:
            params: dict[str, str] = {"name": name, "parent": parent}
            if packet_mark:
                params["packet-mark"] = packet_mark
            if max_limit:
                params["max-limit"] = max_limit
            if limit_at:
                params["limit-at"] = limit_at
            if burst_limit:
                params["burst-limit"] = burst_limit
            if burst_threshold:
                params["burst-threshold"] = burst_threshold
            if burst_time:
                params["burst-time"] = burst_time
            if priority:
                params["priority"] = priority
            if queue_type:
                params["queue"] = queue_type
            if comment:
                params["comment"] = comment
            if disabled:
                params["disabled"] = disabled
            api.path("queue", "tree").add(**params)
            registry.update_last_seen(user_id, conn["name"])
            return {"status": "ok", "message": f"Queue tree '{name}' created under {parent}"}
    except Exception as e:
        return {"error": f"Failed to add queue tree: {e}"}


@mcp.tool()
def remove_queue_tree(user_id: str, queue_id: str, router: str = "") -> dict:
    """Remove a queue tree entry by its .id.

    Args:
        user_id: Telegram user ID
        queue_id: The .id of the queue tree to remove
        router: Router name (empty = default)
    """
    conn = _resolve_connection(user_id, router)
    if "error" in conn:
        return conn
    try:
        with connect_router(conn["host"], conn["port"], conn["username"], conn["password"]) as api:
            api.path("queue", "tree").remove(queue_id)
            registry.update_last_seen(user_id, conn["name"])
            return {"status": "ok", "message": f"Queue tree '{queue_id}' removed"}
    except Exception as e:
        return {"error": f"Failed to remove queue tree: {e}"}


# ─────────────────────────────────────────────
#  SYSTEM — Users, Scripts, Netwatch
# ─────────────────────────────────────────────

@mcp.tool()
def add_system_user(user_id: str, name: str, password: str, group: str = "read",
                     comment: str = "", router: str = "") -> dict:
    """Add a RouterOS system user account.

    Args:
        user_id: Telegram user ID
        name: Username for the new account
        password: Password for the account
        group: User group — 'full', 'read', 'write' (default: 'read')
        comment: Description.
        router: Router name (empty = default)
    """
    conn = _resolve_connection(user_id, router)
    if "error" in conn:
        return conn
    try:
        with connect_router(conn["host"], conn["port"], conn["username"], conn["password"]) as api:
            params: dict[str, str] = {"name": name, "password": password, "group": group}
            if comment:
                params["comment"] = comment
            api.path("user").add(**params)
            registry.update_last_seen(user_id, conn["name"])
            return {"status": "ok", "message": f"System user '{name}' created (group: {group})"}
    except Exception as e:
        return {"error": f"Failed to add system user: {e}"}


@mcp.tool()
def remove_system_user(user_id: str, name: str, router: str = "") -> dict:
    """Remove a RouterOS system user account by name.

    Args:
        user_id: Telegram user ID
        name: Username to remove (cannot remove 'admin')
        router: Router name (empty = default)
    """
    if name.lower() == "admin":
        return {"error": "Cannot remove the 'admin' user."}
    conn = _resolve_connection(user_id, router)
    if "error" in conn:
        return conn
    try:
        with connect_router(conn["host"], conn["port"], conn["username"], conn["password"]) as api:
            users = list(api.path("user").select().where(Key("name") == name))
            if not users:
                return {"error": f"System user '{name}' not found"}
            api.path("user").remove(users[0][".id"])
            registry.update_last_seen(user_id, conn["name"])
            return {"status": "ok", "message": f"System user '{name}' removed"}
    except Exception as e:
        return {"error": f"Failed to remove system user: {e}"}


@mcp.tool()
def add_system_script(user_id: str, name: str, source: str, comment: str = "",
                       router: str = "") -> dict:
    """Add a RouterOS script.

    Args:
        user_id: Telegram user ID
        name: Script name
        source: Script source code (RouterOS scripting language)
        comment: Description.
        router: Router name (empty = default)
    """
    conn = _resolve_connection(user_id, router)
    if "error" in conn:
        return conn
    try:
        with connect_router(conn["host"], conn["port"], conn["username"], conn["password"]) as api:
            params: dict[str, str] = {"name": name, "source": source}
            if comment:
                params["comment"] = comment
            api.path("system", "script").add(**params)
            registry.update_last_seen(user_id, conn["name"])
            return {"status": "ok", "message": f"Script '{name}' created"}
    except Exception as e:
        return {"error": f"Failed to add script: {e}"}


@mcp.tool()
def remove_system_script(user_id: str, name: str, router: str = "") -> dict:
    """Remove a RouterOS script by name.

    Args:
        user_id: Telegram user ID
        name: Script name to remove
        router: Router name (empty = default)
    """
    conn = _resolve_connection(user_id, router)
    if "error" in conn:
        return conn
    try:
        with connect_router(conn["host"], conn["port"], conn["username"], conn["password"]) as api:
            scripts = list(api.path("system", "script").select().where(Key("name") == name))
            if not scripts:
                return {"error": f"Script '{name}' not found"}
            api.path("system", "script").remove(scripts[0][".id"])
            registry.update_last_seen(user_id, conn["name"])
            return {"status": "ok", "message": f"Script '{name}' removed"}
    except Exception as e:
        return {"error": f"Failed to remove script: {e}"}


@mcp.tool()
def add_netwatch(user_id: str, host: str, interval: str = "1m",
                  up_script: str = "", down_script: str = "",
                  comment: str = "", disabled: str = "", router: str = "") -> dict:
    """Add a netwatch entry (monitor host and run scripts on up/down events).

    Args:
        user_id: Telegram user ID
        host: IP address to monitor (e.g., '8.8.8.8')
        interval: Check interval (e.g., '30s', '1m', '5m'). Default: 1m.
        up_script: RouterOS script to run when host comes up. Empty = none.
        down_script: RouterOS script to run when host goes down. Empty = none.
        comment: Description.
        disabled: Create as disabled ('true'). Empty = enabled.
        router: Router name (empty = default)
    """
    conn = _resolve_connection(user_id, router)
    if "error" in conn:
        return conn
    try:
        with connect_router(conn["host"], conn["port"], conn["username"], conn["password"]) as api:
            params: dict[str, str] = {"host": host, "interval": interval}
            if up_script:
                params["up-script"] = up_script
            if down_script:
                params["down-script"] = down_script
            if comment:
                params["comment"] = comment
            if disabled:
                params["disabled"] = disabled
            api.path("tool", "netwatch").add(**params)
            registry.update_last_seen(user_id, conn["name"])
            return {"status": "ok", "message": f"Netwatch added: monitoring {host} every {interval}"}
    except Exception as e:
        return {"error": f"Failed to add netwatch: {e}"}


@mcp.tool()
def remove_netwatch(user_id: str, netwatch_id: str, router: str = "") -> dict:
    """Remove a netwatch entry by its .id.

    Args:
        user_id: Telegram user ID
        netwatch_id: The .id of the netwatch entry to remove
        router: Router name (empty = default)
    """
    conn = _resolve_connection(user_id, router)
    if "error" in conn:
        return conn
    try:
        with connect_router(conn["host"], conn["port"], conn["username"], conn["password"]) as api:
            api.path("tool", "netwatch").remove(netwatch_id)
            registry.update_last_seen(user_id, conn["name"])
            return {"status": "ok", "message": f"Netwatch '{netwatch_id}' removed"}
    except Exception as e:
        return {"error": f"Failed to remove netwatch: {e}"}


# ─────────────────────────────────────────────
#  PPP — Profiles
# ─────────────────────────────────────────────

@mcp.tool()
def add_ppp_profile(user_id: str, name: str, local_address: str = "", remote_address: str = "",
                     rate_limit: str = "", dns_server: str = "",
                     comment: str = "", router: str = "") -> dict:
    """Create a PPP profile (rate limit / address template for PPP users).

    Args:
        user_id: Telegram user ID
        name: Profile name (e.g., 'pppoe-10m')
        local_address: Local address or pool name. Empty = from default.
        remote_address: Remote address or pool name. Empty = from default.
        rate_limit: Rate limit (e.g., '10M/10M' for up/down). Empty = unlimited.
        dns_server: DNS server(s) to assign. Empty = none.
        comment: Description.
        router: Router name (empty = default)
    """
    conn = _resolve_connection(user_id, router)
    if "error" in conn:
        return conn
    try:
        with connect_router(conn["host"], conn["port"], conn["username"], conn["password"]) as api:
            params: dict[str, str] = {"name": name}
            if local_address:
                params["local-address"] = local_address
            if remote_address:
                params["remote-address"] = remote_address
            if rate_limit:
                params["rate-limit"] = rate_limit
            if dns_server:
                params["dns-server"] = dns_server
            if comment:
                params["comment"] = comment
            api.path("ppp", "profile").add(**params)
            registry.update_last_seen(user_id, conn["name"])
            return {"status": "ok", "message": f"PPP profile '{name}' created"}
    except Exception as e:
        return {"error": f"Failed to create PPP profile: {e}"}


@mcp.tool()
def remove_ppp_profile(user_id: str, name: str, router: str = "") -> dict:
    """Remove a PPP profile by name.

    Args:
        user_id: Telegram user ID
        name: Profile name to remove (cannot remove 'default')
        router: Router name (empty = default)
    """
    if name.lower() == "default":
        return {"error": "Cannot remove the 'default' profile."}
    conn = _resolve_connection(user_id, router)
    if "error" in conn:
        return conn
    try:
        with connect_router(conn["host"], conn["port"], conn["username"], conn["password"]) as api:
            profiles = list(api.path("ppp", "profile").select().where(Key("name") == name))
            if not profiles:
                return {"error": f"PPP profile '{name}' not found"}
            api.path("ppp", "profile").remove(profiles[0][".id"])
            registry.update_last_seen(user_id, conn["name"])
            return {"status": "ok", "message": f"PPP profile '{name}' removed"}
    except Exception as e:
        return {"error": f"Failed to remove PPP profile: {e}"}


# ─────────────────────────────────────────────
#  ENTRY POINT
# ─────────────────────────────────────────────

if __name__ == "__main__":
    mcp.run(transport="stdio")
