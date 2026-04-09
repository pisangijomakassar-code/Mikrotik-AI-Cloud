# MikroTik AI Agent — Architecture Plan

## Overview

AI-powered MikroTik router management platform. Users register via Telegram, add their routers through natural conversation, and manage them using natural language. One Nanobot instance serves all users with full data isolation.

## Core Principle

```
1 Nanobot Instance → N Users → Each User has N Routers
```

- **Single deployment** — one Docker container runs everything
- **Self-service onboarding** — users register by providing Telegram bot token + user ID
- **Conversational setup** — agent guides users through adding their MikroTik routers
- **Per-user isolation** — each user's routers and data are fully separated

---

## System Architecture

```
┌────────────────────────────────────────────────────────────────┐
│                        USERS (Telegram)                        │
│                                                                │
│  User A (ID: 86340875)    User B (ID: 12345678)    User C ... │
│  via @MikrotikAgentBot    via @MikrotikAgentBot                │
└──────────────────────────────┬────────────���────────────────────┘
                               │
                               ▼
┌───────────────────────────────────────��────────────────────────┐
│                     NANOBOT GATEWAY (single instance)           │
│                                                                │
│  ┌────────────┐  ┌──────��──────┐  ┌─────────────────────────┐│
│  │    LLM     │  │   Memory    │  │   Skills                ││
│  │ (Gemini    │  │   (Dream)   │  │   - mikrotik-admin      ││
│  │  via       │  │  per-session │  │   - onboarding          ││
│  │  OpenRouter│  │             │  │                          ││
│  └─────┬─────��┘  └─────────────┘  └────────────────────��────┘│
│        │                                                       │
│        ▼                                                       │
│  ┌────────────────────────────────────────────────────────┐   │
│  │              MikroTik MCP Server                        │   │
│  │                                                         │   │
│  │  ┌───────────────────────────────────────────────────┐ │   │
│  │  │            Per-User Router Registry                │ │   │
��  │  │                                                    │ │   │
│  │  │  data/                                             │ │   │
│  │  │  ├── 86340875.json   (User A's routers)           │ │   │
│  │  │  │   ├── UmmiNEW   → id30.tunnel.my.id:12065     │ │   │
│  │  │  │   └── Kantor    → office.tunnel.my.id:8728    │ │   │
│  │  │  │                                                │ │   │
│  │  │  ├── 12345678.json   (User B's routers)           │ │   │
│  │  │  │   └── Warnet    → warnet.tunnel.my.id:8728    │ ���   │
│  │  │  │                                                │ │   │
│  │  │  └── ...                                          │ │   │
│  │  └───────���───────────────────────────────────────────┘ │   │
│  │                                                         │   │
│  │  Tools: (all scoped to user_id)                         │   │
│  │  ├─ Onboarding: register_router, remove_router,         │   │
│  ��  │              list_routers, set_default_router          │   │
│  │  ├─ System: get_system_info, get_identity, get_logs     │   │
│  │  ├─ Network: list_interfaces, list_ips, list_routes     │   │
│  │  ├─ Clients: list_dhcp, count_clients, list_arp         │   │
│  │  ├─ Security: list_firewall, list_nat                   ���   │
│  │  ├─ Hotspot: list/add/remove hotspot users              │   │
│  ��  └─ Advanced: raw RouterOS API query                    │   │
│  └───────────────���──────────────────────────────���─────────┘   │
└──────���─────────────────────────────────────────────────────────┘
                               │
              ┌────────────────┼────────────────┐
              ▼                ▼                ▼
     ┌──────────────┐ ┌──────────────┐ ┌──────────────┐
     │  MikroTik A  │ │  MikroTik B  │ │  MikroTik C  │
     │  User A      │ │  User A      │ │  User B      │
     │  hEX v6      │ │  RB750 v7    │ │  CCR v7      │
     │  :12065      │ │  :8728       │ │  :8728       │
     └──────────────┘ └──────────────┘ └──────────────┘
```

---

## User Journey

### Step 1: Registration

User contacts the shared Telegram bot (e.g., `@MikrotikAIBot`).

```
User:  /start
Bot:   Halo! Saya MikroTik AI Agent.
       Saya bisa membantu Anda memonitor dan mengelola router MikroTik
       melalui chat.

       Untuk memulai, saya perlu detail router MikroTik Anda.
       Apakah Anda sudah punya akses RouterOS API ke router Anda?
```

### Step 2: Add First Router

```
Bot:   Anda belum punya router yang terdaftar.
       Silakan berikan detail router MikroTik Anda:

       1. Nama router (bebas, contoh: "Kantor")
       2. Host/domain (contoh: router.example.com)
       3. Port API (biasanya 8728)
       4. Username
       5. Password

       Anda bisa kirim sekaligus atau satu per satu.

User:  Nama: UmmiNEW
       Host: id30.tunnel.my.id
       Port: 12065
       User: Ejen4li
       Pass: rahasia123

Bot:   🔄 Mengecek koneksi ke id30.tunnel.my.id:12065...
       ✅ Berhasil! Router ditemukan:
       • Board: hEX
       • RouterOS: 6.49.8
       • Uptime: 6h48m

       Router "UmmiNEW" berhasil ditambahkan sebagai default router Anda.
       Sekarang Anda bisa bertanya, misalnya:
       • "Berapa client yang online?"
       • "Tampilkan firewall rules"
       • "Buat user hotspot baru"
```

### Step 3: Add More Routers

```
User:  Tambah router baru: Kantor, host office.tunnel.my.id,
       port 8728, user admin, pass admin123

Bot:   🔄 Mengecek koneksi...
       ✅ Router "Kantor" berhasil ditambahkan.
       Anda sekarang punya 2 router:
       1. UmmiNEW (default) ⭐
       2. Kantor
```

### Step 4: Daily Usage

```
User:  Berapa client online?
Bot:   📊 Router UmmiNEW (default): 36 client aktif

User:  Cek juga di Kantor
Bot:   📊 Router Kantor: 15 client aktif

User:  Bandingkan CPU semua router
Bot:   📊 CPU Load:
       • UmmiNEW: 11%
       • Kantor: 5%
```

---

## Data Flow

### Read Query (scoped to user)
```
User A: "Berapa client online di Kantor?"
  │
  ├─ Nanobot → Session: identify user_id = 86340875
  ├─ LLM → MCP: count_active_clients(user_id="86340875", router="Kantor")
  ├─ MCP → Registry: load data/86340875.json → find "Kantor"
  ├─ MCP → RouterOS API: connect office.tunnel.my.id:8728
  ├─ MCP ��� LLM: {active_clients: 15}
  └─ LLM → User A: "Router Kantor: 15 client aktif"
```

### User Isolation
```
User A asks: "List routers"  →  sees: UmmiNEW, Kantor
User B asks: "List routers"  →  sees: Warnet
```

User A cannot see or access User B's routers. The MCP server enforces this by loading only the requesting user's registry file.

### Write Operation (with confirmation)
```
User: "Hapus user hotspot tamu di UmmiNEW"
  │
  ├─ LLM: detect destructive action → ask confirmation
  ├─ Bot → User: "⚠️ Anda yakin ingin menghapus user 'tamu'
  │               di router UmmiNEW? (ya/tidak)"
  ├─ User: "ya"
  ├─ LLM → MCP: remove_hotspot_user(user_id=..., router="UmmiNEW", username="tamu")
  └─ Bot → User: "✅ User 'tamu' berhasil dihapus dari UmmiNEW"
```

---

## Per-User Router Registry

### Storage Structure

```
data/
├── 86340875.json          # User A (Neutron)
├── 12345678.json          # User B
├── 99887766.json          # User C
└── ...
```

### Registry File Format

File: `data/{telegram_user_id}.json`

```json
{
  "version": 1,
  "user_id": "86340875",
  "default_router": "UmmiNEW",
  "routers": {
    "UmmiNEW": {
      "host": "id30.tunnel.my.id",
      "port": 12065,
      "username": "Ejen4li",
      "password": "<encrypted>",
      "label": "Router Rumah Ummi",
      "routeros_version": "6.49.8",
      "board": "hEX",
      "added_at": "2026-04-09T10:00:00Z",
      "last_seen": "2026-04-09T16:45:00Z"
    },
    "Kantor": {
      "host": "office.tunnel.my.id",
      "port": 8728,
      "username": "admin",
      "password": "<encrypted>",
      "label": "Router Kantor Pusat",
      "routeros_version": "7.14",
      "board": "RB750Gr3",
      "added_at": "2026-04-10T08:00:00Z",
      "last_seen": "2026-04-10T15:30:00Z"
    }
  }
}
```

### How user_id Reaches MCP Tools

Nanobot's session system identifies each Telegram user by their numeric ID. The LLM knows the user's identity from the session context. The skill instructs the LLM to always pass `user_id` when calling MCP tools.

```
SKILL.md:
  "IMPORTANT: For every MCP tool call, you MUST include the user_id
   parameter. The user_id is the Telegram user ID of the person
   you're chatting with. You can find it in the session context."
```

### Registry MCP Tools

| Tool | Description | Key Params |
|------|-------------|------------|
| `list_routers` | List user's registered routers | user_id |
| `register_router` | Add a new router (tests connection first) | user_id, name, host, port, username, password |
| `remove_router` | Remove a router | user_id, name |
| `set_default_router` | Change which router is queried by default | user_id, name |
| `test_connection` | Test if a router is reachable | host, port, username, password |

### Router Selection Logic

All query tools accept `user_id` (required) + `router` (optional):

1. Load `data/{user_id}.json`
2. If `router` param provided → use that router
3. If not provided → use `default_router`
4. If no routers exist → return error message guiding user to add one
5. Special keyword `"all"` → query all of this user's routers

---

## Security

### Credential Storage

| Phase | Method | Detail |
|-------|--------|--------|
| Phase 1 (current) | Plain text in .env | Single user, for testing |
| Phase 2 (multi-router) | Plain text in per-user JSON | Functional but not secure |
| Phase 3 (encryption) | Fernet symmetric encryption | Passwords encrypted at rest |

### Encryption Design (Phase 3)

```
Per-instance master key: ~/.nanobot/workspace/.master_key
  │
  ├── Encrypt: router password → store in JSON as {"enc": "<base64>"}
  └── Decrypt: on-demand when connecting to RouterOS API
```

- Master key auto-generated on first boot
- One key for all users (instance-level encryption)
- If key is lost, all users must re-enter router passwords

### Access Control

| Layer | Mechanism |
|-------|-----------|
| **Bot access** | Telegram bot — anyone can start, but only registered routers are accessible |
| **Data isolation** | Per-user JSON files — MCP server only loads requesting user's data |
| **Write operations** | LLM-enforced confirmation before destructive actions |
| **Credentials** | Encrypted at rest (Phase 3); never sent through LLM context |
| **Network** | RouterOS API via tunnel; credentials stay server-side |
| **Container** | Docker; resource limits; optional bubblewrap sandbox |

### Tool Classification

| Category | Tools | Confirmation Required |
|----------|-------|----------------------|
| **Read** | get_system_info, list_interfaces, list_dhcp_leases, count_active_clients, list_firewall_*, list_arp_table, get_recent_logs | No |
| **Write** | add_hotspot_user, remove_hotspot_user | Yes — confirm action + router name |
| **Admin** | register_router, remove_router, set_default_router | Yes — confirm action |
| **Dangerous** | run_routeros_query (raw API access) | Double confirmation — show the command first |

### Credential Flow (credentials never touch the LLM)

```
User: "Tambah router: host x.x.x.x port 8728 user admin pass secret"
  │
  ├─ LLM extracts params from user message
  ├─ LLM → MCP: register_router(user_id, name, host, port, user, pass)
  ├─ MCP: stores password in data/{user_id}.json (encrypted)
  ├─ MCP: tests connection → returns board info
  └�� LLM → User: "✅ Router berhasil ditambahkan"

  Subsequently:
  User: "Cek CPU"
  ├─ LLM → MCP: get_system_info(user_id, router="UmmiNEW")
  ├─ MCP: loads credentials from data/{user_id}.json (server-side)
  ├─ MCP: connects to router, queries, returns data
  └─ LLM → User: "CPU: 11%"

  ⚠️ Password goes: User message → LLM → MCP (one time only, during registration)
  ⚠️ After that: MCP reads from disk, LLM never sees the password again
```

---

## Telegram Configuration

### Single Shared Bot

```json
{
  "channels": {
    "telegram": {
      "enabled": true,
      "token": "${TELEGRAM_BOT_TOKEN}",
      "allowFrom": ["*"]
    }
  }
}
```

- `allowFrom: ["*"]` — any Telegram user can chat
- Session isolation per user (built into Nanobot)
- Each user's data is separate (enforced by MCP server)

### Alternative: Restricted Access

```json
{
  "channels": {
    "telegram": {
      "enabled": true,
      "token": "${TELEGRAM_BOT_TOKEN}",
      "allowFrom": ["86340875", "12345678"]
    }
  }
}
```

Add user IDs as they register. Can be managed via admin command.

---

## Tech Stack

| Component | Technology | Why |
|-----------|-----------|-----|
| AI Agent | Nanobot v0.1.5 | Lightweight, MCP support, multi-channel, session isolation |
| LLM | Google Gemini 3.1 Flash Lite (via OpenRouter) | Cheap, fast, tool calling support |
| MCP Server | Python + FastMCP (stdio) | Standard protocol, auto-discovered by Nanobot |
| RouterOS Client | librouteros | Mature Python library for RouterOS API v6/v7 |
| Messaging | Telegram (primary), WhatsApp (future) | Built-in Nanobot channel support |
| Container | Docker + Docker Compose | Simple single-instance deployment |
| Data Storage | JSON files (per-user) | Simple, no DB dependency, easy to backup |
| Credential Encryption | cryptography (Fernet) | Standard symmetric encryption |

---

## File Structure

```
Mikrotik Ai Agent/
├── docker-compose.yml
├── Dockerfile
├─�� entrypoint.sh
├── .env                          # Instance credentials (gitignored)
├── .env.example                  # Template
├── .gitignore
│
├── mikrotik_mcp/
│   ├── server.py                 # MCP server — all tools + entry point
│   ├── registry.py               # Per-user router CRUD + JSON persistence
│   ├─��� crypto.py                 # Password encryption (Phase 3)
│   └── requirements.txt
│
├── config/
│   └── config.json               # Nanobot config template
│
├── skills/
│   └── mikrotik/
│       └─��� SKILL.md              # LLM context: tools, rules, examples
│
├── data/                         # Per-user router registries (gitignored)
│   ├── 86340875.json             # User A's routers
│   ├── 12345678.json             # User B's routers
│   └── ...
│
└── docs/
    ├── ARCHITECTURE.md           # This file
    └── PHASES.md                 # Implementation phases
```

---

## Supported RouterOS Versions

| Version | Protocol | Support |
|---------|----------|---------|
| v6.x | Binary API (port 8728) | ✅ Full (via librouteros) |
| v7.x | Binary API (port 8728) | ✅ Full (via librouteros) |
| v7.x | REST API (port 443) | ⚠️ Not used — binary API is universal |

---

## Limitations & Known Constraints

1. **RouterOS API access required** — Winbox-only access is not sufficient
2. **Tunnel dependency** — Routers behind NAT need a tunnel service
3. **LLM tool calling** — Model must support function calling
4. **Password exposure during registration** — Password passes through LLM once during `register_router`; after that, MCP reads from disk
5. **No real-time streaming** — Router stats are polled on-demand
6. **Single LLM instance** — All users share the same model and rate limits
7. **Session memory is global** — Nanobot's MEMORY.md is shared; user data isolation is handled by the MCP server's per-user JSON files, not by Nanobot's memory system

---

## Future Considerations

- **Admin dashboard**: Web UI for managing users and viewing all routers
- **Rate limiting**: Per-user tool call limits to prevent abuse
- **Audit log**: Track who did what on which router
- **Webhook alerts**: Router-initiated alerts (e.g., "CPU > 90%") pushed to user
- **WhatsApp support**: Add as second channel (Phase 6)
- **Per-user LLM keys**: Users bring their own OpenRouter/API keys for cost sharing
