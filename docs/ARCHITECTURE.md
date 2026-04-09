# MikroTik AI Agent — Architecture

## Overview

AI-powered MikroTik router management service. Paid users interact with a shared Telegram bot to monitor and manage their MikroTik routers using natural language. A single Nanobot instance serves all provisioned users with full data isolation.

## Core Principle

```
1 Nanobot Instance (shared) → N Users (paid, manually provisioned) → Each User has N Routers
```

- **Single deployment** — one Docker container runs the entire service
- **Paid access** — admin manually provisions users after payment
- **Conversational setup** — once granted access, users self-register their routers via chat
- **Per-user isolation** — each user's routers and data are fully separated within the same Nanobot gateway

---

## Business Model

This is a **paid access service**, not a public/free bot.

1. **Payment** — User pays for access (handled outside the system)
2. **Provisioning** — Admin adds the user's Telegram numeric ID to the `allowFrom` list in `config/config.json` and redeploys
3. **Self-service onboarding** — Once allowed, the user messages the Telegram bot, and the agent guides them through registering their MikroTik routers
4. **Usage** — User manages their routers through natural language chat

Users cannot access the bot unless their Telegram ID is explicitly listed in `allowFrom`. There is no self-registration or public access.

---

## System Architecture

```
┌────────────────────────────────────────────────────────────────┐
│                   PAID USERS (Telegram)                         │
│                                                                │
│  User A (ID: 86340875)    User B (ID: 12345678)    User C ... │
│  via @MikrotikAgentBot    via @MikrotikAgentBot                │
│                                                                │
│  (Only users listed in allowFrom can interact)                 │
└──────────────────────────────┬─────────────────────────────────┘
                               │
                               ▼
┌────────────────────────────────────────────────────────────────┐
│                  NANOBOT GATEWAY (single instance)              │
│                                                                │
│  ┌────────────┐  ┌─────────────┐  ┌────────────────────────┐  │
│  │    LLM     │  │   Memory    │  │   Skills               │  │
│  │  Gemini    │  │   (Dream)   │  │   - mikrotik-admin     │  │
│  │  2.5 Flash │  │  per-session │  │                        │  │
│  │  Lite via  │  │             │  │   Personality:          │  │
│  │  OpenRouter│  │             │  │   - config/SOUL.md      │  │
│  └─────┬──────┘  └─────────────┘  └────────────────────────┘  │
│        │                                                       │
│        ▼                                                       │
│  ┌────────────────────────────────────────────────────────┐   │
│  │              MikroTik MCP Server (66 tools)             │   │
│  │                                                         │   │
│  │  ┌───────────────────────────────────────────────────┐ │   │
│  │  │            Per-User Router Registry                │ │   │
│  │  │                                                    │ │   │
│  │  │  data/                                             │ │   │
│  │  │  ├── 86340875.json   (User A's routers)           │ │   │
│  │  │  │   ├── UmmiNEW   → id30.tunnel.my.id:12065     │ │   │
│  │  │  │   └── Kantor    → office.tunnel.my.id:8728    │ │   │
│  │  │  │                                                │ │   │
│  │  │  ├── 12345678.json   (User B's routers)           │ │   │
│  │  │  │   └── Warnet    → warnet.tunnel.my.id:8728    │ │   │
│  │  │  │                                                │ │   │
│  │  │  └── ...                                          │ │   │
│  │  └───────────────────────────────────────────────────┘ │   │
│  │                                                         │   │
│  │  Tools (66 total, all scoped to user_id):               │   │
│  │  ├─ Router Mgmt: register/remove/list/set_default       │   │
│  │  ├─ System: info, identity, clock, health, routerboard  │   │
│  │  │          users, scheduler, scripts, reboot            │   │
│  │  ├─ Network: interfaces, IPs, routes, DNS, traffic      │   │
│  │  ├─ Interface Mgmt: enable/disable, bridge, VLAN        │   │
│  │  ├─ IP Mgmt: add/remove IP, pools, services             │   │
│  │  ├─ Clients: DHCP leases, ARP, neighbors, wireless      │   │
│  │  ├─ DHCP Extended: servers, networks, make static        │   │
│  │  ├─ DNS: static entries CRUD                             │   │
│  │  ├─ Security: firewall filter, NAT, mangle, addr lists  │   │
│  │  ├─ Hotspot: active/users/profiles/bindings, CRUD       │   │
│  │  ├─ PPP/VPN: active/secrets, CRUD, kick                 │   │
│  │  ├─ Bandwidth: simple queues CRUD, enable/disable        │   │
│  │  ├─ Logs: recent system logs                             │   │
│  │  └─ Advanced: raw RouterOS API query                     │   │
│  └────────────────────────────────────────────────────────┘   │
└───────────────────────────────────────────────────────────────┘
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

## Communication Style (SOUL.md)

The bot's personality and communication rules are defined in `config/SOUL.md`, which is copied into the Nanobot workspace on every container start (via `entrypoint.sh`).

Key rules:

- **Casual/gaul Indonesian** — like chatting with a tech friend, not formal support
- **Short responses** — 1-3 lines ideal, max 5 lines
- **Examples**: "ada 34 user online nih" not "Terdapat 34 pengguna yang sedang aktif"
- **Never expose internals** — no tool names, no "user_id", no "MCP", no "calling tool X"
- **Confirm before writes** — always ask "Lanjut? (ya/tidak)" before any destructive action
- **Follow user's language** — if the user writes in English, reply in English (still casual)

---

## User Journey

### Step 1: Admin Provisions Access

Admin adds the user's Telegram ID to `allowFrom` in `config/config.json` after payment:

```json
{
  "channels": {
    "telegram": {
      "allowFrom": ["86340875", "12345678"]
    }
  }
}
```

Redeploy to apply changes.

### Step 2: First Contact

User messages the bot. The agent detects they have no routers and guides them through registration.

```
User:  /start
Bot:   Halo! Gue asisten MikroTik lo.
       Belum ada router yang terdaftar nih.
       Kirim detail router: nama, host, port, username, password.
```

### Step 3: Add First Router

```
User:  Nama: UmmiNEW
       Host: id30.tunnel.my.id
       Port: 12065
       User: Ejen4li
       Pass: rahasia123

Bot:   Router UmmiNEW ditambahkan, hEX v6.49.8, uptime 6j48m
```

### Step 4: Add More Routers

```
User:  Tambah router baru: Kantor, host office.tunnel.my.id,
       port 8728, user admin, pass admin123

Bot:   Router Kantor ditambahkan.
       Punya 2 router: UmmiNEW (default), Kantor
```

### Step 5: Daily Usage

```
User:  Berapa client online?
Bot:   34 user online di UmmiNEW

User:  Cek juga di Kantor
Bot:   15 user online di Kantor
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
  ├─ MCP → LLM: {active_clients: 15}
  └─ LLM → User A: "15 user online di Kantor"
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
  ├─ Bot → User: "Mau hapus user hotspot tamu di UmmiNEW nih, lanjut? (ya/tidak)"
  ├─ User: "ya"
  ├─ LLM → MCP: remove_hotspot_user(user_id=..., router="UmmiNEW", username="tamu")
  └─ Bot → User: "User tamu udah dihapus dari UmmiNEW"
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

### Router Selection Logic

All query tools accept `user_id` (required) + `router` (optional):

1. Load `data/{user_id}.json`
2. If `router` param provided → use that router
3. If not provided → use `default_router`
4. If no routers exist → return error message guiding user to add one
5. Special keyword `"all"` → query all of this user's routers

---

## Security

### Access Control

| Layer | Mechanism |
|-------|-----------|
| **Bot access** | `allowFrom` in config — only manually provisioned Telegram user IDs can interact |
| **Data isolation** | Per-user JSON files — MCP server only loads requesting user's data |
| **Write operations** | LLM-enforced confirmation before destructive actions |
| **Credentials** | Encrypted at rest (Fernet); never sent through LLM context after registration |
| **Network** | RouterOS API via tunnel; credentials stay server-side |
| **Container** | Docker; resource limits (1 CPU, 1GB RAM) |

### allowFrom — Paid Users Only

The `allowFrom` field in `config/config.json` is the access gate. It is **not** set to `["*"]`. Only explicitly listed Telegram user IDs can use the bot:

```json
{
  "channels": {
    "telegram": {
      "allowFrom": ["${TELEGRAM_USER_ID}"]
    }
  }
}
```

The `TELEGRAM_USER_ID` environment variable is set in `.env` on the VPS. To add more users, the admin adds their numeric Telegram IDs to this list and redeploys.

### Credential Storage

| Phase | Method | Detail |
|-------|--------|--------|
| Phase 1 (current) | Plain text in .env | Single user, for testing |
| Phase 2 (multi-router) | Plain text in per-user JSON | Functional but not secure |
| Phase 3 (encryption) | Fernet symmetric encryption | Passwords encrypted at rest |

### Credential Flow (credentials never touch the LLM after registration)

```
User: "Tambah router: host x.x.x.x port 8728 user admin pass secret"
  │
  ├─ LLM extracts params from user message
  ├─ LLM → MCP: register_router(user_id, name, host, port, user, pass)
  ├─ MCP: stores password in data/{user_id}.json (encrypted)
  ├─ MCP: tests connection → returns board info
  └─ LLM → User: "Router ditambahkan"

  Subsequently:
  User: "Cek CPU"
  ├─ LLM → MCP: get_system_info(user_id, router="UmmiNEW")
  ├─ MCP: loads credentials from data/{user_id}.json (server-side)
  ├─ MCP: connects to router, queries, returns data
  └─ LLM → User: "CPU 11%"

  Password goes: User message → LLM → MCP (one time only, during registration)
  After that: MCP reads from disk, LLM never sees the password again
```

### Tool Classification

| Category | Tools | Confirmation Required |
|----------|-------|----------------------|
| **Read** | get_system_info, list_interfaces, list_dhcp_leases, count_active_clients, list_firewall_*, list_arp_table, get_recent_logs, etc. | No |
| **Write** | add/remove hotspot users, add/remove IP, add/remove DNS, add/remove PPP secrets, add/remove queues, enable/disable interfaces, kick sessions, make DHCP static, etc. | Yes — confirm action + router name |
| **Admin** | register_router, remove_router, set_default_router | Yes — confirm action |
| **Dangerous** | run_routeros_query (raw API), run_system_script, reboot_router | Double confirmation — show the command first |

---

## Deployment

### Infrastructure

| Component | Detail |
|-----------|--------|
| **GitHub repo** | `codevjs/mikrotik-ai-agent` (private) |
| **VPS** | `103.67.244.215` |
| **Deploy path** | `/opt/mikrotik-ai-agent` |
| **Container runtime** | Docker Compose |

### CI/CD — GitHub Actions

On every push to `main`, GitHub Actions automatically deploys to the VPS:

```
Push to main → GitHub Actions → SSH to VPS → git pull → docker compose up --build --force-recreate
```

Workflow: `.github/workflows/deploy.yml`

```yaml
name: Deploy to VPS

on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Deploy to VPS
        uses: appleboy/ssh-action@v1
        with:
          host: ${{ secrets.VPS_HOST }}
          username: ${{ secrets.VPS_USER }}
          key: ${{ secrets.VPS_SSH_KEY }}
          script: |
            cd /opt/mikrotik-ai-agent
            git fetch origin && git reset --hard origin/main
            docker compose down || true
            docker compose up -d --build --force-recreate
```

### Docker Compose

Single service with resource limits:

- **Container name**: `mikrotik-agent`
- **Volumes**: nanobot data (named volume), skills (read-only mount), MCP server (read-only mount), user data (read-write)
- **Port**: `18790` (Nanobot web UI / Nano-UI)
- **Resources**: max 1 CPU, 1GB RAM
- **Restart policy**: `unless-stopped`

### Container Startup (entrypoint.sh)

1. Symlink skills into Nanobot workspace
2. Copy `config/config.json` to Nanobot config path
3. Copy `config/SOUL.md` to Nanobot workspace (personality always in sync with repo)
4. Start `nanobot gateway`

---

## Tech Stack

| Component | Technology | Why |
|-----------|-----------|-----|
| AI Agent | Nanobot (nanobot-ai) | Lightweight, MCP support, multi-channel, session isolation |
| LLM | `google/gemini-2.5-flash-lite-preview-09-2025` via OpenRouter | Cheap, fast, tool calling support |
| MCP Server | Python + FastMCP (stdio) | Standard protocol, auto-discovered by Nanobot |
| MCP Tools | 66 tools | Full RouterOS management coverage |
| RouterOS Client | librouteros | Mature Python library for RouterOS API v6/v7 |
| Messaging | Telegram (primary) | Built-in Nanobot channel support |
| Container | Docker + Docker Compose | Simple single-instance deployment |
| CI/CD | GitHub Actions + SSH | Auto-deploy on push to main |
| Data Storage | JSON files (per-user) | Simple, no DB dependency, easy to backup |
| Credential Encryption | cryptography (Fernet) | Standard symmetric encryption |
| Personality | config/SOUL.md | Casual Indonesian, short responses |

---

## File Structure

```
Mikrotik Ai Agent/
├── .github/
│   └── workflows/
│       └── deploy.yml                # CI/CD: auto-deploy to VPS on push to main
│
├── config/
│   ├── config.json                   # Nanobot config (LLM, Telegram, MCP server)
│   └── SOUL.md                       # Bot personality & communication style
│
├── mikrotik_mcp/
│   ├── server.py                     # MCP server — 66 tools + entry point
│   ├── registry.py                   # Per-user router CRUD + JSON persistence
│   └── requirements.txt              # Python dependencies
│
├── skills/
│   └── mikrotik/
│       └── SKILL.md                  # LLM context: tool reference, rules, examples
│
├── data/                             # Per-user router registries (gitignored)
│   ├── 86340875.json
│   ├── 12345678.json
│   └── ...
│
├── docs/
│   ├── ARCHITECTURE.md               # This file
│   ├── PHASES.md                     # Implementation phases
│   └── UI_PROMPT.md                  # Admin dashboard UI prompt (Google Stitch)
│
├── docker-compose.yml                # Single service deployment
├── Dockerfile                        # Python 3.11-slim + nanobot-ai + MCP deps
├── entrypoint.sh                     # Config setup + SOUL.md copy + nanobot start
├── .env                              # Instance credentials (gitignored)
├── .env.example                      # Template for .env
├── .gitignore
└── README.md
```

---

## Telegram Formatting Rules

The bot formats all responses using Telegram MarkdownV2 syntax. This is enforced via SKILL.md.

### Supported formatting:
- `*bold*`, `_italic_`, `` `inline code` ``, ` ```code block``` `
- Bullet points and numbered lists

### Tabular data (Telegram does not support Markdown tables):
```
📊 *System Info — UmmiNEW*

• Board: `hEX`
• Version: `6.49.8`
• CPU Load: `11%`
• Uptime: `6h48m`
```

### Characters that must be escaped in MarkdownV2:
`_`, `*`, `[`, `]`, `(`, `)`, `~`, `` ` ``, `>`, `#`, `+`, `-`, `=`, `|`, `{`, `}`, `.`, `!`

---

## Supported RouterOS Versions

| Version | Protocol | Support |
|---------|----------|---------|
| v6.x | Binary API (port 8728) | Full (via librouteros) |
| v7.x | Binary API (port 8728) | Full (via librouteros) |
| v7.x | REST API (port 443) | Not used — binary API is universal |

---

## Limitations & Known Constraints

1. **RouterOS API access required** — Winbox-only access is not sufficient
2. **Tunnel dependency** — Routers behind NAT need a tunnel service
3. **LLM tool calling** — Model must support function calling
4. **Password exposure during registration** — Password passes through LLM once during `register_router`; after that, MCP reads from disk
5. **No real-time streaming** — Router stats are polled on-demand
6. **Single LLM instance** — All users share the same model and rate limits
7. **Session memory is global** — Nanobot's MEMORY.md is shared; user data isolation is handled by the MCP server's per-user JSON files, not by Nanobot's memory system
8. **Manual user provisioning** — Admin must add Telegram user IDs to allowFrom and redeploy to grant access

---

## Future Considerations

- **Admin dashboard**: Web UI for managing users and viewing all routers (see docs/UI_PROMPT.md)
- **Rate limiting**: Per-user tool call limits to prevent abuse
- **Audit log**: Track who did what on which router
- **Webhook alerts**: Router-initiated alerts (e.g., "CPU > 90%") pushed to user
- **WhatsApp support**: Add as second channel
- **Per-user LLM keys**: Users bring their own OpenRouter/API keys for cost sharing
- **Dynamic user provisioning**: API/admin bot to add users without redeploying
