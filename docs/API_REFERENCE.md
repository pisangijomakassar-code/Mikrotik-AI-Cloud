# MikroTik AI Agent -- API Reference (MCP Tools)

Complete reference for all 137 MCP tools exposed by the MikroTik AI Agent. These tools are called automatically by the AI agent when users send natural language requests via Telegram or the web chat interface.

---

## Table of Contents

- [Overview](#overview)
- [Common Parameters](#common-parameters)
- [Confirmation Rules](#confirmation-rules)
- [Router Management (5 tools)](#router-management)
- [System (15 tools)](#system)
- [Interfaces (10 tools)](#interfaces)
- [Wireless (4 tools)](#wireless)
- [IP Addresses (7 tools)](#ip-addresses)
- [DNS (4 tools)](#dns)
- [DHCP (7 tools)](#dhcp)
- [Firewall (17 tools)](#firewall)
- [Hotspot (28 tools)](#hotspot)
- [PPP/VPN (10 tools)](#pppvpn)
- [Queue / Bandwidth (7 tools)](#queue--bandwidth)
- [Routing (6 tools)](#routing)
- [Monitoring / Tools (8 tools)](#monitoring--tools)
- [Tunnels (4 tools)](#tunnels)
- [Advanced (9 tools)](#advanced)

---

## Overview

All tools communicate with MikroTik routers via the binary RouterOS API protocol (port 8728), using the `librouteros` Python library. Tools are exposed via the MCP (Model Context Protocol) server and called by the AI agent's LLM.

**Key principles:**
- All tools require a `user_id` parameter (the Telegram numeric user ID)
- Most tools accept an optional `router` parameter to target a specific router
- If `router` is omitted, the user's default router is used
- Read-only tools do not require confirmation
- Write/destructive tools require user confirmation before execution
- Dangerous tools require double confirmation

## Common Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `user_id` | string | Yes (all tools) | Telegram numeric user ID of the requesting user |
| `router` | string | No (most tools) | Name of the target router. Omit to use the default router. |

## Confirmation Rules

| Category | Confirmation | Examples |
|----------|-------------|----------|
| **Read** | None | `get_system_info`, `list_interfaces`, `list_dhcp_leases` |
| **Write** | Single ("lanjut? ya/tidak") | `add_hotspot_user`, `remove_firewall_filter`, `enable_interface` |
| **Dangerous** | Double (confirm twice) | `reboot_router`, `run_routeros_query`, `run_system_script` |

---

## Router Management

5 tools for registering, removing, and managing routers.

---

### list_routers

**Description:** List all routers registered by this user.

**Parameters:**
| Name | Type | Required | Description |
|------|------|----------|-------------|
| `user_id` | string | Yes | Telegram user ID |

**Example:**
```
User: "list router saya"
→ list_routers(user_id="86340875")
Response: [{"name": "UmmiNEW", "host": "id30.tunnel.my.id", "port": 12065, "default": true},
           {"name": "Kantor", "host": "office.tunnel.my.id", "port": 8728, "default": false}]
```

**Confirmation:** Not required (read-only)

---

### register_router

**Description:** Register a new MikroTik router. Tests the connection before saving. The first router registered automatically becomes the default.

**Parameters:**
| Name | Type | Required | Default | Description |
|------|------|----------|---------|-------------|
| `user_id` | string | Yes | -- | Telegram user ID |
| `name` | string | Yes | -- | Friendly name for the router (e.g., "Kantor") |
| `host` | string | Yes | -- | Router hostname or IP address |
| `port` | int | Yes | -- | RouterOS API port (usually 8728) |
| `username` | string | Yes | -- | RouterOS login username |
| `password` | string | Yes | -- | RouterOS login password |
| `label` | string | No | `""` | Optional description/label |

**Example:**
```
User: "tambah router Kantor, host 192.168.1.1, port 8728, user admin, pass secret"
→ register_router(user_id="86340875", name="Kantor", host="192.168.1.1",
                   port=8728, username="admin", password="secret")
Response: {"status": "ok", "board": "hEX", "version": "6.49.8", "identity": "MikroTik"}
```

**Confirmation:** Required

---

### remove_router

**Description:** Remove a registered router from the user's account.

**Parameters:**
| Name | Type | Required | Description |
|------|------|----------|-------------|
| `user_id` | string | Yes | Telegram user ID |
| `name` | string | Yes | Router name to remove |

**Example:**
```
User: "hapus router Kantor"
→ remove_router(user_id="86340875", name="Kantor")
Response: {"status": "ok", "message": "Router 'Kantor' removed"}
```

**Confirmation:** Required

---

### set_default_router

**Description:** Change the user's default router. Commands without a specific router target the default.

**Parameters:**
| Name | Type | Required | Description |
|------|------|----------|-------------|
| `user_id` | string | Yes | Telegram user ID |
| `name` | string | Yes | Router name to set as default |

**Example:**
```
User: "set default router ke Warnet"
→ set_default_router(user_id="86340875", name="Warnet")
Response: {"status": "ok", "message": "Default router set to 'Warnet'"}
```

**Confirmation:** Required

---

### test_connection

**Description:** Test connectivity to a MikroTik router without registering it. Does not require `user_id`.

**Parameters:**
| Name | Type | Required | Description |
|------|------|----------|-------------|
| `host` | string | Yes | Router hostname or IP |
| `port` | int | Yes | RouterOS API port |
| `username` | string | Yes | Login username |
| `password` | string | Yes | Login password |

**Example:**
```
User: "test koneksi ke 192.168.1.1 port 8728 user admin pass secret"
→ test_connection(host="192.168.1.1", port=8728, username="admin", password="secret")
Response: {"status": "ok", "board": "hEX", "version": "6.49.8", "uptime": "6h48m"}
```

**Confirmation:** Not required (read-only)

---

## System

15 tools for system information, health, users, scripts, packages, and reboot.

---

### get_system_info

**Description:** Get router CPU, memory, uptime, board name, and RouterOS version.

**Parameters:**
| Name | Type | Required | Default | Description |
|------|------|----------|---------|-------------|
| `user_id` | string | Yes | -- | Telegram user ID |
| `router` | string | No | `""` | Router name, empty = default |

**Example:**
```
User: "cek CPU router"
→ get_system_info(user_id="86340875")
Response: {"board": "hEX", "version": "6.49.8", "cpu_load_percent": 11,
           "total_memory": "256.0 MB", "free_memory": "211.2 MB", "uptime": "6h48m12s"}
```

**Confirmation:** Not required (read-only)

---

### get_system_identity

**Description:** Get the router's hostname/identity string.

**Parameters:**
| Name | Type | Required | Default | Description |
|------|------|----------|---------|-------------|
| `user_id` | string | Yes | -- | Telegram user ID |
| `router` | string | No | `""` | Router name, empty = default |

**Confirmation:** Not required (read-only)

---

### get_system_clock

**Description:** Get the router's current date and time.

**Parameters:**
| Name | Type | Required | Default | Description |
|------|------|----------|---------|-------------|
| `user_id` | string | Yes | -- | Telegram user ID |
| `router` | string | No | `""` | Router name, empty = default |

**Confirmation:** Not required (read-only)

---

### get_system_health

**Description:** Get hardware health info (voltage, temperature). Not all models support this.

**Parameters:**
| Name | Type | Required | Default | Description |
|------|------|----------|---------|-------------|
| `user_id` | string | Yes | -- | Telegram user ID |
| `router` | string | No | `""` | Router name, empty = default |

**Confirmation:** Not required (read-only)

---

### get_system_routerboard

**Description:** Get RouterBoard hardware info: model, serial number, firmware versions.

**Parameters:**
| Name | Type | Required | Default | Description |
|------|------|----------|---------|-------------|
| `user_id` | string | Yes | -- | Telegram user ID |
| `router` | string | No | `""` | Router name, empty = default |

**Confirmation:** Not required (read-only)

---

### list_system_users

**Description:** List RouterOS user accounts (login accounts for the router itself). Passwords are stripped from output.

**Parameters:**
| Name | Type | Required | Default | Description |
|------|------|----------|---------|-------------|
| `user_id` | string | Yes | -- | Telegram user ID |
| `router` | string | No | `""` | Router name, empty = default |

**Confirmation:** Not required (read-only)

---

### list_system_scheduler

**Description:** List scheduled tasks configured on the router.

**Parameters:**
| Name | Type | Required | Default | Description |
|------|------|----------|---------|-------------|
| `user_id` | string | Yes | -- | Telegram user ID |
| `router` | string | No | `""` | Router name, empty = default |

**Confirmation:** Not required (read-only)

---

### list_system_scripts

**Description:** List RouterOS scripts stored on the router.

**Parameters:**
| Name | Type | Required | Default | Description |
|------|------|----------|---------|-------------|
| `user_id` | string | Yes | -- | Telegram user ID |
| `router` | string | No | `""` | Router name, empty = default |

**Confirmation:** Not required (read-only)

---

### run_system_script

**Description:** Run a named RouterOS script. You must know the script name (list scripts first). **DANGEROUS.**

**Parameters:**
| Name | Type | Required | Default | Description |
|------|------|----------|---------|-------------|
| `user_id` | string | Yes | -- | Telegram user ID |
| `script_name` | string | Yes | -- | Name of the script to execute |
| `router` | string | No | `""` | Router name, empty = default |

**Example:**
```
User: "jalankan script auto-backup"
→ run_system_script(user_id="86340875", script_name="auto-backup")
Response: {"status": "ok", "message": "Script 'auto-backup' executed"}
```

**Confirmation:** DOUBLE CONFIRM required (dangerous)

---

### list_system_packages

**Description:** List installed RouterOS packages with versions.

**Parameters:**
| Name | Type | Required | Default | Description |
|------|------|----------|---------|-------------|
| `user_id` | string | Yes | -- | Telegram user ID |
| `router` | string | No | `""` | Router name, empty = default |

**Confirmation:** Not required (read-only)

---

### get_system_license

**Description:** Get RouterOS license information (level, features).

**Parameters:**
| Name | Type | Required | Default | Description |
|------|------|----------|---------|-------------|
| `user_id` | string | Yes | -- | Telegram user ID |
| `router` | string | No | `""` | Router name, empty = default |

**Confirmation:** Not required (read-only)

---

### list_system_logging

**Description:** List logging rules and actions (what gets logged where).

**Parameters:**
| Name | Type | Required | Default | Description |
|------|------|----------|---------|-------------|
| `user_id` | string | Yes | -- | Telegram user ID |
| `router` | string | No | `""` | Router name, empty = default |

**Confirmation:** Not required (read-only)

---

### get_system_ntp_client

**Description:** Get NTP client configuration.

**Parameters:**
| Name | Type | Required | Default | Description |
|------|------|----------|---------|-------------|
| `user_id` | string | Yes | -- | Telegram user ID |
| `router` | string | No | `""` | Router name, empty = default |

**Confirmation:** Not required (read-only)

---

### reboot_router

**Description:** Reboot the router. The router will go offline for 1-3 minutes. **DANGEROUS.**

**Parameters:**
| Name | Type | Required | Default | Description |
|------|------|----------|---------|-------------|
| `user_id` | string | Yes | -- | Telegram user ID |
| `router` | string | No | `""` | Router name, empty = default |

**Example:**
```
User: "reboot router Kantor"
→ reboot_router(user_id="86340875", router="Kantor")
Response: {"status": "ok", "message": "Router 'Kantor' is rebooting. It will be offline for 1-3 minutes."}
```

**Confirmation:** DOUBLE CONFIRM required (dangerous)

---

### check_all_routers_health

**Description:** Check connectivity and basic health of ALL registered routers. Returns status (online/offline), CPU, memory, uptime, and active client count for each router.

**Parameters:**
| Name | Type | Required | Description |
|------|------|----------|-------------|
| `user_id` | string | Yes | Telegram user ID |

**Example:**
```
User: "cek semua router"
→ check_all_routers_health(user_id="86340875")
Response: [{"name": "UmmiNEW", "status": "online", "cpu_load": 8, "memory_percent": 18, "active_clients": 34},
           {"name": "Kantor", "status": "offline", "error": "Connection timed out"}]
```

**Confirmation:** Not required (read-only)

---

## Interfaces

10 tools for viewing and managing network interfaces.

---

### list_interfaces

**Description:** List all network interfaces with status, type, MAC address, and traffic stats (TX/RX bytes).

**Parameters:**
| Name | Type | Required | Default | Description |
|------|------|----------|---------|-------------|
| `user_id` | string | Yes | -- | Telegram user ID |
| `router` | string | No | `""` | Router name, empty = default |

**Confirmation:** Not required (read-only)

---

### get_interface_traffic

**Description:** Get real-time traffic stats for a specific interface.

**Parameters:**
| Name | Type | Required | Default | Description |
|------|------|----------|---------|-------------|
| `user_id` | string | Yes | -- | Telegram user ID |
| `interface_name` | string | Yes | -- | Name of the interface (e.g., "ether1", "wlan1") |
| `router` | string | No | `""` | Router name, empty = default |

**Confirmation:** Not required (read-only)

---

### enable_interface

**Description:** Enable a disabled network interface.

**Parameters:**
| Name | Type | Required | Default | Description |
|------|------|----------|---------|-------------|
| `user_id` | string | Yes | -- | Telegram user ID |
| `name` | string | Yes | -- | Interface name (e.g., "ether1", "wlan1") |
| `router` | string | No | `""` | Router name, empty = default |

**Confirmation:** Required

---

### disable_interface

**Description:** Disable a network interface.

**Parameters:**
| Name | Type | Required | Default | Description |
|------|------|----------|---------|-------------|
| `user_id` | string | Yes | -- | Telegram user ID |
| `name` | string | Yes | -- | Interface name (e.g., "ether1", "wlan1") |
| `router` | string | No | `""` | Router name, empty = default |

**Confirmation:** Required

---

### list_bridge_ports

**Description:** List bridge port assignments.

**Parameters:**
| Name | Type | Required | Default | Description |
|------|------|----------|---------|-------------|
| `user_id` | string | Yes | -- | Telegram user ID |
| `router` | string | No | `""` | Router name, empty = default |

**Confirmation:** Not required (read-only)

---

### list_vlans

**Description:** List VLAN interfaces.

**Parameters:**
| Name | Type | Required | Default | Description |
|------|------|----------|---------|-------------|
| `user_id` | string | Yes | -- | Telegram user ID |
| `router` | string | No | `""` | Router name, empty = default |

**Confirmation:** Not required (read-only)

---

### list_bonding_interfaces

**Description:** List bonding (link aggregation) interfaces.

**Parameters:**
| Name | Type | Required | Default | Description |
|------|------|----------|---------|-------------|
| `user_id` | string | Yes | -- | Telegram user ID |
| `router` | string | No | `""` | Router name, empty = default |

**Confirmation:** Not required (read-only)

---

### list_eoip_tunnels

**Description:** List EoIP tunnel interfaces.

**Parameters:**
| Name | Type | Required | Default | Description |
|------|------|----------|---------|-------------|
| `user_id` | string | Yes | -- | Telegram user ID |
| `router` | string | No | `""` | Router name, empty = default |

**Confirmation:** Not required (read-only)

---

### list_gre_tunnels

**Description:** List GRE tunnel interfaces.

**Parameters:**
| Name | Type | Required | Default | Description |
|------|------|----------|---------|-------------|
| `user_id` | string | Yes | -- | Telegram user ID |
| `router` | string | No | `""` | Router name, empty = default |

**Confirmation:** Not required (read-only)

---

### list_ipip_tunnels

**Description:** List IPIP tunnel interfaces.

**Parameters:**
| Name | Type | Required | Default | Description |
|------|------|----------|---------|-------------|
| `user_id` | string | Yes | -- | Telegram user ID |
| `router` | string | No | `""` | Router name, empty = default |

**Confirmation:** Not required (read-only)

---

## Wireless

4 tools for wireless interface management and client monitoring.

---

### list_wireless_interfaces

**Description:** List wireless interface configurations (SSID, frequency, band, mode).

**Parameters:**
| Name | Type | Required | Default | Description |
|------|------|----------|---------|-------------|
| `user_id` | string | Yes | -- | Telegram user ID |
| `router` | string | No | `""` | Router name, empty = default |

**Confirmation:** Not required (read-only)

---

### list_wireless_clients

**Description:** List connected WiFi clients (wireless registration table).

**Parameters:**
| Name | Type | Required | Default | Description |
|------|------|----------|---------|-------------|
| `user_id` | string | Yes | -- | Telegram user ID |
| `router` | string | No | `""` | Router name, empty = default |

**Confirmation:** Not required (read-only)

---

### list_wireless_security_profiles

**Description:** List wireless security profiles (WPA/WPA2 modes). Pre-shared keys are stripped from output for security.

**Parameters:**
| Name | Type | Required | Default | Description |
|------|------|----------|---------|-------------|
| `user_id` | string | Yes | -- | Telegram user ID |
| `router` | string | No | `""` | Router name, empty = default |

**Confirmation:** Not required (read-only)

---

### list_wireless_access_list

**Description:** List wireless access list (MAC filter allow/deny rules).

**Parameters:**
| Name | Type | Required | Default | Description |
|------|------|----------|---------|-------------|
| `user_id` | string | Yes | -- | Telegram user ID |
| `router` | string | No | `""` | Router name, empty = default |

**Confirmation:** Not required (read-only)

---

## IP Addresses

7 tools for managing IP addresses, routes, pools, and services.

---

### list_ip_addresses

**Description:** List all IP addresses assigned to interfaces.

**Parameters:**
| Name | Type | Required | Default | Description |
|------|------|----------|---------|-------------|
| `user_id` | string | Yes | -- | Telegram user ID |
| `router` | string | No | `""` | Router name, empty = default |

**Confirmation:** Not required (read-only)

---

### add_ip_address

**Description:** Add an IP address to an interface.

**Parameters:**
| Name | Type | Required | Default | Description |
|------|------|----------|---------|-------------|
| `user_id` | string | Yes | -- | Telegram user ID |
| `address` | string | Yes | -- | IP address with prefix (e.g., "192.168.1.1/24") |
| `interface` | string | Yes | -- | Interface name (e.g., "ether1") |
| `comment` | string | No | `""` | Optional comment |
| `router` | string | No | `""` | Router name, empty = default |

**Confirmation:** Required

---

### remove_ip_address

**Description:** Remove an IP address by its .id (get the ID from `list_ip_addresses` first).

**Parameters:**
| Name | Type | Required | Default | Description |
|------|------|----------|---------|-------------|
| `user_id` | string | Yes | -- | Telegram user ID |
| `address_id` | string | Yes | -- | The .id of the IP address entry |
| `router` | string | No | `""` | Router name, empty = default |

**Confirmation:** Required

---

### list_ip_pools

**Description:** List IP address pools.

**Parameters:**
| Name | Type | Required | Default | Description |
|------|------|----------|---------|-------------|
| `user_id` | string | Yes | -- | Telegram user ID |
| `router` | string | No | `""` | Router name, empty = default |

**Confirmation:** Not required (read-only)

---

### list_ip_services

**Description:** List enabled/disabled IP services (api, ssh, winbox, www, etc.).

**Parameters:**
| Name | Type | Required | Default | Description |
|------|------|----------|---------|-------------|
| `user_id` | string | Yes | -- | Telegram user ID |
| `router` | string | No | `""` | Router name, empty = default |

**Confirmation:** Not required (read-only)

---

### list_ip_routes

**Description:** List the IP routing table.

**Parameters:**
| Name | Type | Required | Default | Description |
|------|------|----------|---------|-------------|
| `user_id` | string | Yes | -- | Telegram user ID |
| `router` | string | No | `""` | Router name, empty = default |

**Confirmation:** Not required (read-only)

---

### get_cloud_status

**Description:** Get MikroTik Cloud (DDNS) status and DNS name.

**Parameters:**
| Name | Type | Required | Default | Description |
|------|------|----------|---------|-------------|
| `user_id` | string | Yes | -- | Telegram user ID |
| `router` | string | No | `""` | Router name, empty = default |

**Confirmation:** Not required (read-only)

---

## DNS

4 tools for DNS settings and static entries.

---

### list_dns_settings

**Description:** Get DNS server configuration (servers, cache, allow-remote-requests, etc.).

**Parameters:**
| Name | Type | Required | Default | Description |
|------|------|----------|---------|-------------|
| `user_id` | string | Yes | -- | Telegram user ID |
| `router` | string | No | `""` | Router name, empty = default |

**Confirmation:** Not required (read-only)

---

### list_dns_static

**Description:** List static DNS entries.

**Parameters:**
| Name | Type | Required | Default | Description |
|------|------|----------|---------|-------------|
| `user_id` | string | Yes | -- | Telegram user ID |
| `router` | string | No | `""` | Router name, empty = default |

**Confirmation:** Not required (read-only)

---

### add_dns_static

**Description:** Add a static DNS entry.

**Parameters:**
| Name | Type | Required | Default | Description |
|------|------|----------|---------|-------------|
| `user_id` | string | Yes | -- | Telegram user ID |
| `name` | string | Yes | -- | DNS hostname (e.g., "myserver.local") |
| `address` | string | Yes | -- | IP address to resolve to (e.g., "192.168.1.100") |
| `router` | string | No | `""` | Router name, empty = default |

**Confirmation:** Required

---

### remove_dns_static

**Description:** Remove a static DNS entry by its .id.

**Parameters:**
| Name | Type | Required | Default | Description |
|------|------|----------|---------|-------------|
| `user_id` | string | Yes | -- | Telegram user ID |
| `entry_id` | string | Yes | -- | The .id of the DNS static entry |
| `router` | string | No | `""` | Router name, empty = default |

**Confirmation:** Required

---

## DHCP

7 tools for DHCP server management and client monitoring.

---

### list_dhcp_servers

**Description:** List DHCP server configurations.

**Parameters:**
| Name | Type | Required | Default | Description |
|------|------|----------|---------|-------------|
| `user_id` | string | Yes | -- | Telegram user ID |
| `router` | string | No | `""` | Router name, empty = default |

**Confirmation:** Not required (read-only)

---

### list_dhcp_networks

**Description:** List DHCP network configurations (gateway, DNS, domain handed out to clients).

**Parameters:**
| Name | Type | Required | Default | Description |
|------|------|----------|---------|-------------|
| `user_id` | string | Yes | -- | Telegram user ID |
| `router` | string | No | `""` | Router name, empty = default |

**Confirmation:** Not required (read-only)

---

### list_dhcp_leases

**Description:** List all DHCP leases (connected clients with IP, MAC, hostname, and status).

**Parameters:**
| Name | Type | Required | Default | Description |
|------|------|----------|---------|-------------|
| `user_id` | string | Yes | -- | Telegram user ID |
| `router` | string | No | `""` | Router name, empty = default |

**Example:**
```
User: "list client DHCP"
→ list_dhcp_leases(user_id="86340875")
Response: [{"address": "10.10.8.18", "mac": "B6:00:D0:44:76:13",
            "hostname": "Infinix-HOT-60i", "status": "bound", "expires_after": "8m30s"}, ...]
```

**Confirmation:** Not required (read-only)

---

### list_dhcp_clients

**Description:** List DHCP client interfaces (interfaces where the router itself gets its IP via DHCP from an upstream server). Different from DHCP leases.

**Parameters:**
| Name | Type | Required | Default | Description |
|------|------|----------|---------|-------------|
| `user_id` | string | Yes | -- | Telegram user ID |
| `router` | string | No | `""` | Router name, empty = default |

**Confirmation:** Not required (read-only)

---

### count_active_clients

**Description:** Count how many DHCP clients are currently active/bound. Much faster than listing all leases.

**Parameters:**
| Name | Type | Required | Default | Description |
|------|------|----------|---------|-------------|
| `user_id` | string | Yes | -- | Telegram user ID |
| `router` | string | No | `""` | Router name, empty = default |

**Example:**
```
User: "berapa client online?"
→ count_active_clients(user_id="86340875")
Response: {"active_clients": 34, "total_leases": 45}
```

**Confirmation:** Not required (read-only)

---

### make_dhcp_static

**Description:** Convert a dynamic DHCP lease to a static binding. The client will always get the same IP.

**Parameters:**
| Name | Type | Required | Default | Description |
|------|------|----------|---------|-------------|
| `user_id` | string | Yes | -- | Telegram user ID |
| `lease_id` | string | Yes | -- | The .id of the dynamic lease to make static |
| `router` | string | No | `""` | Router name, empty = default |

**Confirmation:** Required

---

### remove_dhcp_lease

**Description:** Remove a DHCP lease to force the client to re-request an IP.

**Parameters:**
| Name | Type | Required | Default | Description |
|------|------|----------|---------|-------------|
| `user_id` | string | Yes | -- | Telegram user ID |
| `lease_id` | string | Yes | -- | The .id of the lease to remove |
| `router` | string | No | `""` | Router name, empty = default |

**Confirmation:** Required

---

## Firewall

17 tools for firewall filter, NAT, mangle, raw, address lists, and connection tracking.

---

### list_firewall_filter

**Description:** List all firewall filter rules with chain, action, protocol, addresses, ports, and byte counters.

**Parameters:**
| Name | Type | Required | Default | Description |
|------|------|----------|---------|-------------|
| `user_id` | string | Yes | -- | Telegram user ID |
| `router` | string | No | `""` | Router name, empty = default |

**Confirmation:** Not required (read-only)

---

### add_firewall_filter

**Description:** Add a firewall filter rule.

**Parameters:**
| Name | Type | Required | Default | Description |
|------|------|----------|---------|-------------|
| `user_id` | string | Yes | -- | Telegram user ID |
| `chain` | string | Yes | -- | Chain name: "input", "forward", or "output" |
| `action` | string | Yes | -- | Action: "accept", "drop", "reject", "jump", etc. |
| `protocol` | string | No | `""` | Protocol: "tcp", "udp", "icmp", etc. Empty = any |
| `src_address` | string | No | `""` | Source IP/subnet. Empty = any |
| `dst_address` | string | No | `""` | Destination IP/subnet. Empty = any |
| `dst_port` | string | No | `""` | Destination port(s). Empty = any |
| `comment` | string | No | `""` | Rule comment/description |
| `router` | string | No | `""` | Router name, empty = default |

**Confirmation:** Required

---

### remove_firewall_filter

**Description:** Remove a firewall filter rule by its .id.

**Parameters:**
| Name | Type | Required | Default | Description |
|------|------|----------|---------|-------------|
| `user_id` | string | Yes | -- | Telegram user ID |
| `rule_id` | string | Yes | -- | The .id of the firewall rule to remove |
| `router` | string | No | `""` | Router name, empty = default |

**Confirmation:** Required

---

### enable_firewall_rule

**Description:** Enable a disabled firewall filter rule.

**Parameters:**
| Name | Type | Required | Default | Description |
|------|------|----------|---------|-------------|
| `user_id` | string | Yes | -- | Telegram user ID |
| `rule_id` | string | Yes | -- | The .id of the firewall rule to enable |
| `router` | string | No | `""` | Router name, empty = default |

**Confirmation:** Required

---

### disable_firewall_rule

**Description:** Disable a firewall filter rule without deleting it.

**Parameters:**
| Name | Type | Required | Default | Description |
|------|------|----------|---------|-------------|
| `user_id` | string | Yes | -- | Telegram user ID |
| `rule_id` | string | Yes | -- | The .id of the firewall rule to disable |
| `router` | string | No | `""` | Router name, empty = default |

**Confirmation:** Required

---

### list_firewall_nat

**Description:** List all NAT rules.

**Parameters:**
| Name | Type | Required | Default | Description |
|------|------|----------|---------|-------------|
| `user_id` | string | Yes | -- | Telegram user ID |
| `router` | string | No | `""` | Router name, empty = default |

**Confirmation:** Not required (read-only)

---

### add_nat_rule

**Description:** Add a NAT rule (masquerade, dst-nat, src-nat, etc.).

**Parameters:**
| Name | Type | Required | Default | Description |
|------|------|----------|---------|-------------|
| `user_id` | string | Yes | -- | Telegram user ID |
| `chain` | string | Yes | -- | Chain: "srcnat" or "dstnat" |
| `action` | string | Yes | -- | Action: "masquerade", "dst-nat", "src-nat", etc. |
| `protocol` | string | No | `""` | Protocol. Empty = any |
| `src_address` | string | No | `""` | Source IP/subnet. Empty = any |
| `dst_address` | string | No | `""` | Destination IP/subnet. Empty = any |
| `dst_port` | string | No | `""` | Destination port(s). Empty = any |
| `to_addresses` | string | No | `""` | NAT destination address(es) |
| `to_ports` | string | No | `""` | NAT destination port(s) |
| `comment` | string | No | `""` | Rule comment/description |
| `router` | string | No | `""` | Router name, empty = default |

**Confirmation:** Required

---

### remove_nat_rule

**Description:** Remove a NAT rule by its .id.

**Parameters:**
| Name | Type | Required | Default | Description |
|------|------|----------|---------|-------------|
| `user_id` | string | Yes | -- | Telegram user ID |
| `rule_id` | string | Yes | -- | The .id of the NAT rule to remove |
| `router` | string | No | `""` | Router name, empty = default |

**Confirmation:** Required

---

### enable_nat_rule

**Description:** Enable a disabled NAT rule.

**Parameters:**
| Name | Type | Required | Default | Description |
|------|------|----------|---------|-------------|
| `user_id` | string | Yes | -- | Telegram user ID |
| `rule_id` | string | Yes | -- | The .id of the NAT rule to enable |
| `router` | string | No | `""` | Router name, empty = default |

**Confirmation:** Required

---

### disable_nat_rule

**Description:** Disable a NAT rule without removing it.

**Parameters:**
| Name | Type | Required | Default | Description |
|------|------|----------|---------|-------------|
| `user_id` | string | Yes | -- | Telegram user ID |
| `rule_id` | string | Yes | -- | The .id of the NAT rule to disable |
| `router` | string | No | `""` | Router name, empty = default |

**Confirmation:** Required

---

### list_firewall_mangle

**Description:** List mangle rules.

**Parameters:**
| Name | Type | Required | Default | Description |
|------|------|----------|---------|-------------|
| `user_id` | string | Yes | -- | Telegram user ID |
| `router` | string | No | `""` | Router name, empty = default |

**Confirmation:** Not required (read-only)

---

### list_firewall_raw

**Description:** List raw firewall rules (pre-connection tracking). These rules are processed before connection tracking.

**Parameters:**
| Name | Type | Required | Default | Description |
|------|------|----------|---------|-------------|
| `user_id` | string | Yes | -- | Telegram user ID |
| `router` | string | No | `""` | Router name, empty = default |

**Confirmation:** Not required (read-only)

---

### list_firewall_address_lists

**Description:** List all firewall address list entries.

**Parameters:**
| Name | Type | Required | Default | Description |
|------|------|----------|---------|-------------|
| `user_id` | string | Yes | -- | Telegram user ID |
| `router` | string | No | `""` | Router name, empty = default |

**Confirmation:** Not required (read-only)

---

### add_to_address_list

**Description:** Add an IP address to a firewall address list.

**Parameters:**
| Name | Type | Required | Default | Description |
|------|------|----------|---------|-------------|
| `user_id` | string | Yes | -- | Telegram user ID |
| `list_name` | string | Yes | -- | Name of the address list (e.g., "blocked", "whitelist") |
| `address` | string | Yes | -- | IP address or subnet (e.g., "192.168.1.100", "10.0.0.0/24") |
| `comment` | string | No | `""` | Optional comment |
| `timeout` | string | No | `""` | Optional timeout (e.g., "1h", "30m", "1d"). Empty = permanent |
| `router` | string | No | `""` | Router name, empty = default |

**Confirmation:** Required

---

### remove_from_address_list

**Description:** Remove an entry from a firewall address list by its .id.

**Parameters:**
| Name | Type | Required | Default | Description |
|------|------|----------|---------|-------------|
| `user_id` | string | Yes | -- | Telegram user ID |
| `entry_id` | string | Yes | -- | The .id of the address list entry |
| `router` | string | No | `""` | Router name, empty = default |

**Confirmation:** Required

---

### list_connections

**Description:** List active connections (connection tracking). Returns first 100 entries to avoid huge responses.

**Parameters:**
| Name | Type | Required | Default | Description |
|------|------|----------|---------|-------------|
| `user_id` | string | Yes | -- | Telegram user ID |
| `router` | string | No | `""` | Router name, empty = default |

**Confirmation:** Not required (read-only)

---

### list_bridge_filter

**Description:** List bridge firewall filter rules (Layer 2 firewall).

**Parameters:**
| Name | Type | Required | Default | Description |
|------|------|----------|---------|-------------|
| `user_id` | string | Yes | -- | Telegram user ID |
| `router` | string | No | `""` | Router name, empty = default |

**Confirmation:** Not required (read-only)

---

## Hotspot

28 tools for comprehensive hotspot management (Mikhmon-like functionality).

---

### list_hotspot_active

**Description:** List all currently connected/active hotspot users.

**Parameters:**
| Name | Type | Required | Default | Description |
|------|------|----------|---------|-------------|
| `user_id` | string | Yes | -- | Telegram user ID |
| `router` | string | No | `""` | Router name, empty = default |

**Confirmation:** Not required (read-only)

---

### count_hotspot_active

**Description:** Count currently active/online hotspot sessions (just the number, not the full list).

**Parameters:**
| Name | Type | Required | Default | Description |
|------|------|----------|---------|-------------|
| `user_id` | string | Yes | -- | Telegram user ID |
| `router` | string | No | `""` | Router name, empty = default |

**Confirmation:** Not required (read-only)

---

### kick_hotspot_user

**Description:** Disconnect an active hotspot session by its session .id.

**Parameters:**
| Name | Type | Required | Default | Description |
|------|------|----------|---------|-------------|
| `user_id` | string | Yes | -- | Telegram user ID |
| `session_id` | string | Yes | -- | The .id from `list_hotspot_active` |
| `router` | string | No | `""` | Router name, empty = default |

**Confirmation:** Required

---

### list_hotspot_users

**Description:** List all configured hotspot user accounts. Warning: can return 1000+ entries on busy routers. Use `count_hotspot_users` for just the count.

**Parameters:**
| Name | Type | Required | Default | Description |
|------|------|----------|---------|-------------|
| `user_id` | string | Yes | -- | Telegram user ID |
| `router` | string | No | `""` | Router name, empty = default |

**Confirmation:** Not required (read-only)

---

### count_hotspot_users

**Description:** Count total/enabled/disabled hotspot users without listing all of them. Much faster than `list_hotspot_users` for large user lists.

**Parameters:**
| Name | Type | Required | Default | Description |
|------|------|----------|---------|-------------|
| `user_id` | string | Yes | -- | Telegram user ID |
| `router` | string | No | `""` | Router name, empty = default |

**Example:**
```
User: "berapa total user hotspot?"
→ count_hotspot_users(user_id="86340875")
Response: {"total_users": 450, "enabled": 420, "disabled": 30}
```

**Confirmation:** Not required (read-only)

---

### search_hotspot_user

**Description:** Search for a specific hotspot user by name. Tries exact match first, then partial match.

**Parameters:**
| Name | Type | Required | Default | Description |
|------|------|----------|---------|-------------|
| `user_id` | string | Yes | -- | Telegram user ID |
| `username` | string | Yes | -- | Username to search for (exact or partial) |
| `router` | string | No | `""` | Router name, empty = default |

**Confirmation:** Not required (read-only)

---

### get_hotspot_user_detail

**Description:** Get detailed info about a specific hotspot user including usage stats: uptime used, bytes in/out, packets, limits, last-logged-out, etc.

**Parameters:**
| Name | Type | Required | Default | Description |
|------|------|----------|---------|-------------|
| `user_id` | string | Yes | -- | Telegram user ID |
| `username` | string | Yes | -- | The hotspot username to look up |
| `router` | string | No | `""` | Router name, empty = default |

**Confirmation:** Not required (read-only)

---

### add_hotspot_user

**Description:** Create a new hotspot user account. Validates that the specified profile exists before creating.

**Parameters:**
| Name | Type | Required | Default | Description |
|------|------|----------|---------|-------------|
| `user_id` | string | Yes | -- | Telegram user ID |
| `username` | string | Yes | -- | Login username for the hotspot user |
| `password` | string | Yes | -- | Login password |
| `profile` | string | No | `"default"` | Hotspot user profile to assign |
| `router` | string | No | `""` | Router name, empty = default |

**Confirmation:** Required

---

### remove_hotspot_user

**Description:** Delete a hotspot user account by username.

**Parameters:**
| Name | Type | Required | Default | Description |
|------|------|----------|---------|-------------|
| `user_id` | string | Yes | -- | Telegram user ID |
| `username` | string | Yes | -- | The username to remove |
| `router` | string | No | `""` | Router name, empty = default |

**Confirmation:** Required

---

### enable_hotspot_user

**Description:** Enable/reactivate a disabled hotspot user account.

**Parameters:**
| Name | Type | Required | Default | Description |
|------|------|----------|---------|-------------|
| `user_id` | string | Yes | -- | Telegram user ID |
| `username` | string | Yes | -- | The username to enable |
| `router` | string | No | `""` | Router name, empty = default |

**Confirmation:** Required

---

### disable_hotspot_user

**Description:** Disable/suspend a hotspot user account without deleting it.

**Parameters:**
| Name | Type | Required | Default | Description |
|------|------|----------|---------|-------------|
| `user_id` | string | Yes | -- | Telegram user ID |
| `username` | string | Yes | -- | The username to disable |
| `router` | string | No | `""` | Router name, empty = default |

**Confirmation:** Required

---

### update_hotspot_user

**Description:** Update an existing hotspot user's password, profile, or name.

**Parameters:**
| Name | Type | Required | Default | Description |
|------|------|----------|---------|-------------|
| `user_id` | string | Yes | -- | Telegram user ID |
| `username` | string | Yes | -- | Current username to update |
| `new_password` | string | No | `""` | New password (empty = keep current) |
| `new_profile` | string | No | `""` | New profile name (empty = keep current) |
| `new_name` | string | No | `""` | New username (empty = keep current) |
| `router` | string | No | `""` | Router name, empty = default |

**Confirmation:** Required

---

### generate_hotspot_vouchers

**Description:** Generate multiple hotspot voucher users in bulk (like Mikhmon). Creates random username/password pairs. Max 100 per batch.

**Parameters:**
| Name | Type | Required | Default | Description |
|------|------|----------|---------|-------------|
| `user_id` | string | Yes | -- | Telegram user ID |
| `count` | int | Yes | -- | Number of vouchers to generate (1-100) |
| `profile` | string | Yes | -- | Hotspot user profile (e.g., "5rb", "Free") |
| `prefix` | string | No | `""` | Username prefix (e.g., "V" produces "V3k8m2") |
| `password_length` | int | No | `6` | Length of generated password (4-16) |
| `username_length` | int | No | `6` | Length of random part of username (4-16) |
| `limit_uptime` | string | No | `""` | Per-user uptime limit (e.g., "1h", "3h", "1d") |
| `limit_bytes_total` | string | No | `""` | Per-user data limit (e.g., "100M", "1G") |
| `comment` | string | No | `""` | Comment for all generated users |
| `router` | string | No | `""` | Router name, empty = default |

**Example:**
```
User: "generate 20 voucher profile 5rb"
→ generate_hotspot_vouchers(user_id="86340875", count=20, profile="5rb")
Response: {"status": "ok", "count": 20, "profile": "5rb",
           "vouchers": [{"username": "v8k3m2", "password": "a9x7p1"}, ...]}
```

**Confirmation:** Required

---

### get_hotspot_voucher_stats

**Description:** Get hotspot user statistics: total, active, disabled, and count by profile. Like Mikhmon's dashboard.

**Parameters:**
| Name | Type | Required | Default | Description |
|------|------|----------|---------|-------------|
| `user_id` | string | Yes | -- | Telegram user ID |
| `router` | string | No | `""` | Router name, empty = default |

**Example:**
```
User: "statistik voucher hotspot"
→ get_hotspot_voucher_stats(user_id="86340875")
Response: {"total": 450, "enabled": 420, "disabled": 30,
           "by_profile": {"5rb": 200, "10rb": 150, "Free": 80, "Premium": 20}}
```

**Confirmation:** Not required (read-only)

---

### bulk_enable_hotspot_users

**Description:** Enable multiple hotspot users at once.

**Parameters:**
| Name | Type | Required | Default | Description |
|------|------|----------|---------|-------------|
| `user_id` | string | Yes | -- | Telegram user ID |
| `usernames` | string | Yes | -- | Comma-separated list of usernames to enable |
| `router` | string | No | `""` | Router name, empty = default |

**Confirmation:** Required

---

### bulk_disable_hotspot_users

**Description:** Disable/suspend multiple hotspot users at once.

**Parameters:**
| Name | Type | Required | Default | Description |
|------|------|----------|---------|-------------|
| `user_id` | string | Yes | -- | Telegram user ID |
| `usernames` | string | Yes | -- | Comma-separated list of usernames to disable |
| `router` | string | No | `""` | Router name, empty = default |

**Confirmation:** Required

---

### bulk_remove_hotspot_users

**Description:** Remove multiple hotspot users at once. Removed users cannot be recovered. **DANGEROUS.**

**Parameters:**
| Name | Type | Required | Default | Description |
|------|------|----------|---------|-------------|
| `user_id` | string | Yes | -- | Telegram user ID |
| `usernames` | string | Yes | -- | Comma-separated list of usernames to remove |
| `router` | string | No | `""` | Router name, empty = default |

**Confirmation:** Required

---

### remove_disabled_hotspot_users

**Description:** Remove ALL disabled hotspot users (cleanup). Permanently deletes every disabled user. Cannot be undone. **DANGEROUS.**

**Parameters:**
| Name | Type | Required | Default | Description |
|------|------|----------|---------|-------------|
| `user_id` | string | Yes | -- | Telegram user ID |
| `router` | string | No | `""` | Router name, empty = default |

**Confirmation:** Required

---

### remove_expired_hotspot_users

**Description:** Remove hotspot users that have exceeded their uptime or data limit. A user is expired if uptime >= limit-uptime or total bytes >= limit-bytes-total. **DANGEROUS.**

**Parameters:**
| Name | Type | Required | Default | Description |
|------|------|----------|---------|-------------|
| `user_id` | string | Yes | -- | Telegram user ID |
| `router` | string | No | `""` | Router name, empty = default |

**Confirmation:** Required

---

### list_hotspot_user_profiles

**Description:** List hotspot user profiles (rate limit templates like "5rb", "Free", "Premium"). This is `/ip/hotspot/user/profile`.

**Parameters:**
| Name | Type | Required | Default | Description |
|------|------|----------|---------|-------------|
| `user_id` | string | Yes | -- | Telegram user ID |
| `router` | string | No | `""` | Router name, empty = default |

**Confirmation:** Not required (read-only)

---

### add_hotspot_user_profile

**Description:** Create a new hotspot user profile (rate limit template).

**Parameters:**
| Name | Type | Required | Default | Description |
|------|------|----------|---------|-------------|
| `user_id` | string | Yes | -- | Telegram user ID |
| `name` | string | Yes | -- | Profile name (e.g., "5rb", "Free", "Premium") |
| `rate_limit` | string | No | `""` | Upload/download limit (e.g., "1M/2M", "512k/1M") |
| `shared_users` | int | No | `1` | Max concurrent sessions per user |
| `session_timeout` | string | No | `""` | Session timeout (e.g., "1h", "8h", "1d") |
| `router` | string | No | `""` | Router name, empty = default |

**Confirmation:** Required

---

### update_hotspot_user_profile

**Description:** Update an existing hotspot user profile's settings.

**Parameters:**
| Name | Type | Required | Default | Description |
|------|------|----------|---------|-------------|
| `user_id` | string | Yes | -- | Telegram user ID |
| `name` | string | Yes | -- | Profile name to update |
| `rate_limit` | string | No | `""` | New rate limit (empty = don't change) |
| `shared_users` | int | No | `0` | New max concurrent sessions (0 = don't change) |
| `session_timeout` | string | No | `""` | New session timeout (empty = don't change) |
| `keepalive_timeout` | string | No | `""` | New keepalive timeout (empty = don't change) |
| `router` | string | No | `""` | Router name, empty = default |

**Confirmation:** Required

---

### remove_hotspot_user_profile

**Description:** Remove a hotspot user profile. Fails if users are still assigned to it. Cannot remove the "default" profile.

**Parameters:**
| Name | Type | Required | Default | Description |
|------|------|----------|---------|-------------|
| `user_id` | string | Yes | -- | Telegram user ID |
| `name` | string | Yes | -- | Profile name to remove |
| `router` | string | No | `""` | Router name, empty = default |

**Confirmation:** Required

---

### list_hotspot_server_profiles

**Description:** List hotspot server profiles (login page config, RADIUS, DNS settings). Different from user profiles.

**Parameters:**
| Name | Type | Required | Default | Description |
|------|------|----------|---------|-------------|
| `user_id` | string | Yes | -- | Telegram user ID |
| `router` | string | No | `""` | Router name, empty = default |

**Confirmation:** Not required (read-only)

---

### list_hotspot_servers

**Description:** List hotspot server instances.

**Parameters:**
| Name | Type | Required | Default | Description |
|------|------|----------|---------|-------------|
| `user_id` | string | Yes | -- | Telegram user ID |
| `router` | string | No | `""` | Router name, empty = default |

**Confirmation:** Not required (read-only)

---

### list_hotspot_ip_bindings

**Description:** List hotspot IP bindings (bypass/block rules for specific IPs or MACs).

**Parameters:**
| Name | Type | Required | Default | Description |
|------|------|----------|---------|-------------|
| `user_id` | string | Yes | -- | Telegram user ID |
| `router` | string | No | `""` | Router name, empty = default |

**Confirmation:** Not required (read-only)

---

### list_hotspot_cookies

**Description:** List hotspot cookies (saved auto-login sessions).

**Parameters:**
| Name | Type | Required | Default | Description |
|------|------|----------|---------|-------------|
| `user_id` | string | Yes | -- | Telegram user ID |
| `router` | string | No | `""` | Router name, empty = default |

**Confirmation:** Not required (read-only)

---

### list_hotspot_walled_garden

**Description:** List hotspot walled garden rules (sites/URLs allowed before login).

**Parameters:**
| Name | Type | Required | Default | Description |
|------|------|----------|---------|-------------|
| `user_id` | string | Yes | -- | Telegram user ID |
| `router` | string | No | `""` | Router name, empty = default |

**Confirmation:** Not required (read-only)

---

## PPP/VPN

10 tools for PPP secret management, active session monitoring, and VPN server configuration.

---

### list_ppp_active

**Description:** List active PPP/VPN connections.

**Parameters:**
| Name | Type | Required | Default | Description |
|------|------|----------|---------|-------------|
| `user_id` | string | Yes | -- | Telegram user ID |
| `router` | string | No | `""` | Router name, empty = default |

**Confirmation:** Not required (read-only)

---

### list_ppp_secrets

**Description:** List PPP user accounts (PPPoE, PPTP, L2TP, etc.). Passwords are stripped from output for security.

**Parameters:**
| Name | Type | Required | Default | Description |
|------|------|----------|---------|-------------|
| `user_id` | string | Yes | -- | Telegram user ID |
| `router` | string | No | `""` | Router name, empty = default |

**Confirmation:** Not required (read-only)

---

### add_ppp_secret

**Description:** Add a PPP user account.

**Parameters:**
| Name | Type | Required | Default | Description |
|------|------|----------|---------|-------------|
| `user_id` | string | Yes | -- | Telegram user ID |
| `name` | string | Yes | -- | Username for the PPP account |
| `password` | string | Yes | -- | Password for the PPP account |
| `service` | string | No | `"any"` | Service type: "any", "pppoe", "pptp", "l2tp", etc. |
| `profile` | string | No | `"default"` | PPP profile to assign |
| `router` | string | No | `""` | Router name, empty = default |

**Confirmation:** Required

---

### remove_ppp_secret

**Description:** Remove a PPP user account by name.

**Parameters:**
| Name | Type | Required | Default | Description |
|------|------|----------|---------|-------------|
| `user_id` | string | Yes | -- | Telegram user ID |
| `name` | string | Yes | -- | Username of the PPP secret to remove |
| `router` | string | No | `""` | Router name, empty = default |

**Confirmation:** Required

---

### kick_ppp_user

**Description:** Disconnect an active PPP/VPN session by its .id.

**Parameters:**
| Name | Type | Required | Default | Description |
|------|------|----------|---------|-------------|
| `user_id` | string | Yes | -- | Telegram user ID |
| `session_id` | string | Yes | -- | The .id of the active PPP session |
| `router` | string | No | `""` | Router name, empty = default |

**Confirmation:** Required

---

### list_ppp_profiles

**Description:** List PPP profiles (rate limits, DNS, IP pools for PPPoE/PPTP/L2TP users).

**Parameters:**
| Name | Type | Required | Default | Description |
|------|------|----------|---------|-------------|
| `user_id` | string | Yes | -- | Telegram user ID |
| `router` | string | No | `""` | Router name, empty = default |

**Confirmation:** Not required (read-only)

---

### list_l2tp_server

**Description:** Get L2TP server configuration and status.

**Parameters:**
| Name | Type | Required | Default | Description |
|------|------|----------|---------|-------------|
| `user_id` | string | Yes | -- | Telegram user ID |
| `router` | string | No | `""` | Router name, empty = default |

**Confirmation:** Not required (read-only)

---

### list_pptp_server

**Description:** Get PPTP server configuration and status.

**Parameters:**
| Name | Type | Required | Default | Description |
|------|------|----------|---------|-------------|
| `user_id` | string | Yes | -- | Telegram user ID |
| `router` | string | No | `""` | Router name, empty = default |

**Confirmation:** Not required (read-only)

---

### list_sstp_server

**Description:** Get SSTP server configuration and status.

**Parameters:**
| Name | Type | Required | Default | Description |
|------|------|----------|---------|-------------|
| `user_id` | string | Yes | -- | Telegram user ID |
| `router` | string | No | `""` | Router name, empty = default |

**Confirmation:** Not required (read-only)

---

### list_pppoe_client

**Description:** List PPPoE client interfaces (WAN connections via PPPoE).

**Parameters:**
| Name | Type | Required | Default | Description |
|------|------|----------|---------|-------------|
| `user_id` | string | Yes | -- | Telegram user ID |
| `router` | string | No | `""` | Router name, empty = default |

**Confirmation:** Not required (read-only)

---

## Queue / Bandwidth

7 tools for simple queues, queue tree, and queue types.

---

### list_simple_queues

**Description:** List all simple queues (bandwidth limit rules per client/network).

**Parameters:**
| Name | Type | Required | Default | Description |
|------|------|----------|---------|-------------|
| `user_id` | string | Yes | -- | Telegram user ID |
| `router` | string | No | `""` | Router name, empty = default |

**Confirmation:** Not required (read-only)

---

### add_simple_queue

**Description:** Add a simple queue (bandwidth limit).

**Parameters:**
| Name | Type | Required | Default | Description |
|------|------|----------|---------|-------------|
| `user_id` | string | Yes | -- | Telegram user ID |
| `name` | string | Yes | -- | Queue name (e.g., "limit-john") |
| `target` | string | Yes | -- | Target IP or subnet (e.g., "192.168.1.100/32") |
| `max_limit` | string | Yes | -- | Upload/download limit (e.g., "5M/10M") |
| `router` | string | No | `""` | Router name, empty = default |

**Confirmation:** Required

---

### remove_simple_queue

**Description:** Remove a simple queue by its .id.

**Parameters:**
| Name | Type | Required | Default | Description |
|------|------|----------|---------|-------------|
| `user_id` | string | Yes | -- | Telegram user ID |
| `queue_id` | string | Yes | -- | The .id of the queue to remove |
| `router` | string | No | `""` | Router name, empty = default |

**Confirmation:** Required

---

### enable_simple_queue

**Description:** Enable a disabled simple queue.

**Parameters:**
| Name | Type | Required | Default | Description |
|------|------|----------|---------|-------------|
| `user_id` | string | Yes | -- | Telegram user ID |
| `queue_id` | string | Yes | -- | The .id of the queue to enable |
| `router` | string | No | `""` | Router name, empty = default |

**Confirmation:** Required

---

### disable_simple_queue

**Description:** Disable a simple queue (stops bandwidth limiting without removing the rule).

**Parameters:**
| Name | Type | Required | Default | Description |
|------|------|----------|---------|-------------|
| `user_id` | string | Yes | -- | Telegram user ID |
| `queue_id` | string | Yes | -- | The .id of the queue to disable |
| `router` | string | No | `""` | Router name, empty = default |

**Confirmation:** Required

---

### list_queue_tree

**Description:** List queue tree entries (hierarchical/advanced bandwidth management).

**Parameters:**
| Name | Type | Required | Default | Description |
|------|------|----------|---------|-------------|
| `user_id` | string | Yes | -- | Telegram user ID |
| `router` | string | No | `""` | Router name, empty = default |

**Confirmation:** Not required (read-only)

---

### list_queue_types

**Description:** List queue types (PCQ, SFQ, FIFO, etc.).

**Parameters:**
| Name | Type | Required | Default | Description |
|------|------|----------|---------|-------------|
| `user_id` | string | Yes | -- | Telegram user ID |
| `router` | string | No | `""` | Router name, empty = default |

**Confirmation:** Not required (read-only)

---

## Routing

6 tools for static routes, OSPF, BGP, and routing filters.

---

### list_ip_routes

See [IP Addresses > list_ip_routes](#list_ip_routes) above.

---

### add_static_route

**Description:** Add a static route.

**Parameters:**
| Name | Type | Required | Default | Description |
|------|------|----------|---------|-------------|
| `user_id` | string | Yes | -- | Telegram user ID |
| `dst_address` | string | Yes | -- | Destination network (e.g., "0.0.0.0/0", "10.0.0.0/8") |
| `gateway` | string | Yes | -- | Gateway IP address (e.g., "192.168.1.1") |
| `distance` | int | No | `1` | Administrative distance |
| `comment` | string | No | `""` | Optional comment |
| `router` | string | No | `""` | Router name, empty = default |

**Confirmation:** Required

---

### remove_static_route

**Description:** Remove a static route by its .id.

**Parameters:**
| Name | Type | Required | Default | Description |
|------|------|----------|---------|-------------|
| `user_id` | string | Yes | -- | Telegram user ID |
| `route_id` | string | Yes | -- | The .id of the route to remove |
| `router` | string | No | `""` | Router name, empty = default |

**Confirmation:** Required

---

### list_routing_ospf_instances

**Description:** List OSPF instances. Requires the routing package to be installed.

**Parameters:**
| Name | Type | Required | Default | Description |
|------|------|----------|---------|-------------|
| `user_id` | string | Yes | -- | Telegram user ID |
| `router` | string | No | `""` | Router name, empty = default |

**Confirmation:** Not required (read-only)

---

### list_routing_ospf_neighbors

**Description:** List OSPF neighbor adjacencies. Requires the routing package.

**Parameters:**
| Name | Type | Required | Default | Description |
|------|------|----------|---------|-------------|
| `user_id` | string | Yes | -- | Telegram user ID |
| `router` | string | No | `""` | Router name, empty = default |

**Confirmation:** Not required (read-only)

---

### list_routing_bgp_sessions

**Description:** List BGP peer sessions. Requires the routing package.

**Parameters:**
| Name | Type | Required | Default | Description |
|------|------|----------|---------|-------------|
| `user_id` | string | Yes | -- | Telegram user ID |
| `router` | string | No | `""` | Router name, empty = default |

**Confirmation:** Not required (read-only)

---

### list_routing_filters

**Description:** List routing filter rules. Requires the routing package.

**Parameters:**
| Name | Type | Required | Default | Description |
|------|------|----------|---------|-------------|
| `user_id` | string | Yes | -- | Telegram user ID |
| `router` | string | No | `""` | Router name, empty = default |

**Confirmation:** Not required (read-only)

---

## Monitoring / Tools

8 tools for netwatch, logs, ARP, neighbors, SNMP, UPnP, and IP accounting.

---

### list_netwatch

**Description:** List netwatch entries (host monitoring with up/down scripts).

**Parameters:**
| Name | Type | Required | Default | Description |
|------|------|----------|---------|-------------|
| `user_id` | string | Yes | -- | Telegram user ID |
| `router` | string | No | `""` | Router name, empty = default |

**Confirmation:** Not required (read-only)

---

### get_recent_logs

**Description:** Get recent system log entries.

**Parameters:**
| Name | Type | Required | Default | Description |
|------|------|----------|---------|-------------|
| `user_id` | string | Yes | -- | Telegram user ID |
| `count` | int | No | `50` | Number of recent log entries to return |
| `router` | string | No | `""` | Router name, empty = default |

**Confirmation:** Not required (read-only)

---

### list_arp_table

**Description:** List the ARP table (all devices the router has seen, with IP and MAC addresses).

**Parameters:**
| Name | Type | Required | Default | Description |
|------|------|----------|---------|-------------|
| `user_id` | string | Yes | -- | Telegram user ID |
| `router` | string | No | `""` | Router name, empty = default |

**Confirmation:** Not required (read-only)

---

### list_neighbors

**Description:** List IP neighbors discovered via CDP/MNDP/LLDP.

**Parameters:**
| Name | Type | Required | Default | Description |
|------|------|----------|---------|-------------|
| `user_id` | string | Yes | -- | Telegram user ID |
| `router` | string | No | `""` | Router name, empty = default |

**Confirmation:** Not required (read-only)

---

### list_snmp_settings

**Description:** Get SNMP configuration.

**Parameters:**
| Name | Type | Required | Default | Description |
|------|------|----------|---------|-------------|
| `user_id` | string | Yes | -- | Telegram user ID |
| `router` | string | No | `""` | Router name, empty = default |

**Confirmation:** Not required (read-only)

---

### list_upnp_settings

**Description:** Get UPnP configuration.

**Parameters:**
| Name | Type | Required | Default | Description |
|------|------|----------|---------|-------------|
| `user_id` | string | Yes | -- | Telegram user ID |
| `router` | string | No | `""` | Router name, empty = default |

**Confirmation:** Not required (read-only)

---

### get_ip_accounting

**Description:** Get IP accounting settings (traffic tracking per IP pair).

**Parameters:**
| Name | Type | Required | Default | Description |
|------|------|----------|---------|-------------|
| `user_id` | string | Yes | -- | Telegram user ID |
| `router` | string | No | `""` | Router name, empty = default |

**Confirmation:** Not required (read-only)

---

### list_ip_accounting_snapshot

**Description:** Get IP accounting snapshot (traffic data per IP pair). Limited to first 50 entries.

**Parameters:**
| Name | Type | Required | Default | Description |
|------|------|----------|---------|-------------|
| `user_id` | string | Yes | -- | Telegram user ID |
| `router` | string | No | `""` | Router name, empty = default |

**Confirmation:** Not required (read-only)

---

## Tunnels

4 tools for viewing tunnel interfaces (EoIP, GRE, IPIP, bonding). See also [Interfaces](#interfaces) section for the same tools listed there.

The tunnel tools (`list_eoip_tunnels`, `list_gre_tunnels`, `list_ipip_tunnels`, `list_bonding_interfaces`) are documented under [Interfaces](#interfaces).

---

## Advanced

9 tools for raw API queries, backup/export, scheduling, CAPsMAN, and IPv6.

---

### run_routeros_query

**Description:** Run a raw RouterOS API query on any path. Use for features not covered by the dedicated tools. **DANGEROUS.**

**Parameters:**
| Name | Type | Required | Default | Description |
|------|------|----------|---------|-------------|
| `user_id` | string | Yes | -- | Telegram user ID |
| `api_path` | string | Yes | -- | The RouterOS API path (e.g., "/system/clock", "/ip/pool") |
| `router` | string | No | `""` | Router name, empty = default |

**Example:**
```
User: "cek IP pool"
→ run_routeros_query(user_id="86340875", api_path="/ip/pool")
Response: [{"name": "dhcp-pool", "ranges": "10.10.8.2-10.10.8.254"}]
```

**Example API paths:**
- `/ip/proxy` -- proxy settings
- `/ip/socks` -- SOCKS proxy
- `/ip/traffic-flow` -- traffic flow config
- `/certificate` -- certificates
- `/system/note` -- system notes
- `/interface/ethernet` -- ethernet settings

**Confirmation:** DOUBLE CONFIRM required (dangerous)

---

### create_backup

**Description:** Create a router backup file stored on the router's filesystem. Download via WinBox/FTP.

**Parameters:**
| Name | Type | Required | Default | Description |
|------|------|----------|---------|-------------|
| `user_id` | string | Yes | -- | Telegram user ID |
| `name` | string | No | `"backup"` | Backup filename without extension |
| `router` | string | No | `""` | Router name, empty = default |

**Confirmation:** Required

---

### export_config

**Description:** Export router configuration as text. Full `/export` may not be available via API; falls back to a summary of key config sections.

**Parameters:**
| Name | Type | Required | Default | Description |
|------|------|----------|---------|-------------|
| `user_id` | string | Yes | -- | Telegram user ID |
| `router` | string | No | `""` | Router name, empty = default |

**Confirmation:** Not required (read-only)

---

### add_scheduler

**Description:** Add a scheduled task on the router. The `on_event` parameter contains the RouterOS script to execute.

**Parameters:**
| Name | Type | Required | Default | Description |
|------|------|----------|---------|-------------|
| `user_id` | string | Yes | -- | Telegram user ID |
| `name` | string | Yes | -- | Scheduler entry name |
| `on_event` | string | Yes | -- | Script body or script name to execute |
| `start_time` | string | No | `"startup"` | When to start: "startup" or time like "00:00:00" |
| `interval` | string | No | `""` | Repeat interval (e.g., "1h", "30m", "1d"). Empty = run once |
| `router` | string | No | `""` | Router name, empty = default |

**Confirmation:** Required

---

### remove_scheduler

**Description:** Remove a scheduled task by name.

**Parameters:**
| Name | Type | Required | Default | Description |
|------|------|----------|---------|-------------|
| `user_id` | string | Yes | -- | Telegram user ID |
| `name` | string | Yes | -- | Name of the scheduler entry to remove |
| `router` | string | No | `""` | Router name, empty = default |

**Confirmation:** Required

---

### list_ipv6_addresses

**Description:** List IPv6 addresses. Not all routers have IPv6 enabled.

**Parameters:**
| Name | Type | Required | Default | Description |
|------|------|----------|---------|-------------|
| `user_id` | string | Yes | -- | Telegram user ID |
| `router` | string | No | `""` | Router name, empty = default |

**Confirmation:** Not required (read-only)

---

### list_ipv6_routes

**Description:** List IPv6 routing table. Not all routers have IPv6 enabled.

**Parameters:**
| Name | Type | Required | Default | Description |
|------|------|----------|---------|-------------|
| `user_id` | string | Yes | -- | Telegram user ID |
| `router` | string | No | `""` | Router name, empty = default |

**Confirmation:** Not required (read-only)

---

### list_capsman_interfaces

**Description:** List CAPsMAN managed wireless interfaces. Only available on routers configured as CAPsMAN controllers.

**Parameters:**
| Name | Type | Required | Default | Description |
|------|------|----------|---------|-------------|
| `user_id` | string | Yes | -- | Telegram user ID |
| `router` | string | No | `""` | Router name, empty = default |

**Confirmation:** Not required (read-only)

---

### list_capsman_registrations

**Description:** List CAPsMAN registered access points. Only available on CAPsMAN controllers.

**Parameters:**
| Name | Type | Required | Default | Description |
|------|------|----------|---------|-------------|
| `user_id` | string | Yes | -- | Telegram user ID |
| `router` | string | No | `""` | Router name, empty = default |

**Confirmation:** Not required (read-only)

---

## Tool Count Summary

| Category | Read | Write | Dangerous | Total |
|----------|------|-------|-----------|-------|
| Router Management | 2 | 3 | 0 | 5 |
| System | 11 | 0 | 4 | 15 |
| Interfaces | 8 | 2 | 0 | 10 |
| Wireless | 4 | 0 | 0 | 4 |
| IP Addresses | 5 | 2 | 0 | 7 |
| DNS | 2 | 2 | 0 | 4 |
| DHCP | 5 | 2 | 0 | 7 |
| Firewall | 8 | 9 | 0 | 17 |
| Hotspot | 10 | 18 | 0 | 28 |
| PPP/VPN | 7 | 3 | 0 | 10 |
| Queue / Bandwidth | 3 | 4 | 0 | 7 |
| Routing | 6 | 0 | 0 | 6 |
| Monitoring / Tools | 8 | 0 | 0 | 8 |
| Advanced | 5 | 3 | 1 | 9 |
| **Total** | **84** | **48** | **5** | **137** |
