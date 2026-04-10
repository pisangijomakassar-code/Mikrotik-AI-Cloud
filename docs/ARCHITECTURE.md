# MikroTik AI Agent — Architecture

## Overview

AI-powered MikroTik router management service. Each paid user gets their own dedicated AI agent — powered by [Nanobot](https://github.com/nanobot-ai/nanobot) — to monitor and manage their MikroTik routers using natural language via Telegram.

**Core concept: 1 User = 1 Agent.** Every user interacts with their own personal AI agent that knows their routers, remembers their conversation history, and operates independently from other users' agents. Nanobot serves as the agent runtime, providing session isolation, LLM orchestration, and MCP tool execution per user.

## Core Principle

```
1 Nanobot Gateway → N Agents (1 per user) → Each Agent manages N Routers
```

- **1 Agent = 1 User** — every provisioned user has their own dedicated AI agent with isolated context, memory, and router data
- **Nanobot as agent runtime** — Nanobot provides the agent framework: session isolation, LLM orchestration, MCP tool routing, and conversation memory per user
- **Single deployment** — one Docker container runs the Nanobot gateway, which spawns and manages individual user agents
- **Paid access** — admin manually provisions users after payment
- **Conversational setup** — once granted access, users self-register their routers via chat with their personal agent
- **Full isolation** — Agent A cannot access Agent B's routers, conversation history, or data

---

## Business Model

This is a **paid access service**, not a public/free bot.

1. **Payment** — User pays for access (handled outside the system)
2. **Provisioning** — Admin adds the user's Telegram numeric ID to the `allowFrom` list in `config/config.json` and redeploys. This effectively creates a new agent for the user.
3. **Self-service onboarding** — Once provisioned, the user messages the Telegram bot and their personal agent guides them through registering their MikroTik routers
4. **Usage** — User manages their routers through natural language chat with their dedicated agent

Users cannot access the bot unless their Telegram ID is explicitly listed in `allowFrom`. There is no self-registration or public access. Each provisioned user gets their own isolated agent.

---

## Agent Model — 1 Agent per User

Nanobot is the AI agent runtime. It does not serve users directly as a shared chatbot — instead, it creates and manages **one dedicated agent per user**.

### What is an Agent?

An agent is an isolated AI assistant instance that belongs to a single user. Each agent has:

| Property        | Scope                                                                   |
| --------------- | ----------------------------------------------------------------------- |
| **Session**     | Isolated — Agent A's conversation is invisible to Agent B               |
| **Memory**      | Per-user — each agent remembers its own user's context                  |
| **Router data** | Isolated — PostgreSQL rows scoped by `userId` FK, encrypted credentials |
| **LLM context** | Separate — each agent gets its own conversation thread                  |
| **Personality** | Shared — all agents share the same SOUL.md personality                  |
| **Skills**      | Shared — all agents use the same SKILL.md tool instructions             |
| **MCP tools**   | Shared — all agents access the same 137 tools, but scoped by `user_id`  |

### How it works

```
User A sends message
  → Nanobot identifies User A (Telegram ID)
  → Nanobot routes to Agent A (User A's dedicated agent)
  → Agent A processes using its own session/memory
  → Agent A calls MCP tools with user_id = User A
  → MCP loads only User A's router data
  → Agent A responds to User A
```

### Why 1:1?

- **Privacy** — users never see each other's data or conversations
- **Context** — each agent builds up context about its user's specific routers and habits
- **Reliability** — one user's heavy usage doesn't pollute another user's agent context
- **Simplicity** — the MCP server only needs to scope by `user_id`, no complex multi-tenant logic

### Shared vs. Isolated

```
SHARED (one copy for all agents):          ISOLATED (one copy per agent):
├── LLM model (Gemini 2.5 Flash)          ├── Conversation session
├── SOUL.md (personality)                  ├── Conversation memory
├── SKILL.md (tool instructions)           ├── Router data (PostgreSQL rows, encrypted)
├── MCP Server (137 tools)                 └── LLM context window
├── PostgreSQL database
└── Docker containers
```

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
└──────────────┬───────────────────────────┬─────────────────────┘
               │                           │
               ▼                           ▼
                                                    ┌──────────────────────┐
                                                    │  ADMIN DASHBOARD     │
                                                    │  (Next.js, port 3000)│
                                                    │                      │
                                                    │  Chat → :8900       │
                                                    │  Health → :8080     │
                                                    └──────────┬───────────┘
                                                               │
┌────────────────────────────────────────────────────────────────┐
│                  NANOBOT GATEWAY (agent runtime)               │
│                                                                │
│  Nanobot manages one dedicated AI agent per user.              │
│  Each agent has its own session, memory, and context.          │
│                                                                │
│  ┌─────────────────────────┐  ┌─────────────────────────┐     │
│  │   AGENT A (User A)      │  │   AGENT B (User B)      │     │
│  │                         │  │                         │     │
│  │  Session: isolated      │  │  Session: isolated      │     │
│  │  Memory:  per-user      │  │  Memory:  per-user      │     │
│  │  Context: User A only   │  │  Context: User B only   │     │
│  │  Routers: UmmiNEW,      │  │  Routers: Warnet        │     │
│  │           Kantor        │  │                         │     │
│  └────────────┬────────────┘  └────────────┬────────────┘     │
│               │                            │                   │
│  ┌────────────┴────────────────────────────┴────────────┐     │
│  │               SHARED INFRASTRUCTURE                   │     │
│  │                                                       │     │
│  │  ┌────────────┐  ┌────────────────────────────────┐  │     │
│  │  │    LLM     │  │   Skills & Personality          │  │     │
│  │  │  Gemini    │  │   - mikrotik-admin (SKILL.md)  │  │     │
│  │  │  2.5 Flash │  │   - SOUL.md (personality)       │  │     │
│  │  │  OpenRouter│  │                                 │  │     │
│  │  └────────────┘  └────────────────────────────────┘  │     │
│  └──────────────────────────────────────────────────────┘     │
│                                                                │
│  ┌────────────────────────────────────────────────────────┐   │
│  │              MikroTik MCP Server (137 tools)             │   │
│  │                                                         │   │
│  │  All tools scoped to user_id — each agent can only      │   │
│  │  access its own user's router data.                     │   │
│  │                                                         │   │
│  │  ┌───────────────────────────────────────────────────┐ │   │
│  │  │     Per-User Router Registry (PostgreSQL)          │ │   │
│  │  │                                                    │ │   │
│  │  │  "Router" table (credentials Fernet-encrypted)    │ │   │
│  │  │  ├── User A (telegramId: 86340875)                │ │   │
│  │  │  │   ├── UmmiNEW   → id30.tunnel.my.id:12065     │ │   │
│  │  │  │   └── Kantor    → office.tunnel.my.id:8728    │ │   │
│  │  │  │                                                │ │   │
│  │  │  ├── User B (telegramId: 12345678)                │ │   │
│  │  │  │   └── Warnet    → warnet.tunnel.my.id:8728    │ │   │
│  │  │  │                                                │ │   │
│  │  │  └── (Legacy fallback: data/*.json for local dev) │ │   │
│  │  └───────────────────────────────────────────────────┘ │   │
│  │                                                         │   │
│  │  Tools (100+ total, all scoped to user_id):               │   │
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
               │                            │
               ▼                            ▼
      ┌──────────────┐ ┌──────────────┐ ┌──────────────┐
      │  MikroTik A  │ │  MikroTik B  │ │  MikroTik C  │
      │  Agent A     │ │  Agent A     │ │  Agent B     │
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

User messages the bot. Nanobot creates a dedicated agent for the user. The agent detects they have no routers and guides them through registration.

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

### Read Query (agent-scoped)

```
User A: "Berapa client online di Kantor?"
  │
  ├─ Nanobot → Route to Agent A (user_id = 86340875)
  ├─ Agent A → MCP: count_active_clients(user_id="86340875", router="Kantor")
  ├─ MCP → Registry: load data/86340875.json → find "Kantor"
  ├─ MCP → RouterOS API: connect office.tunnel.my.id:8728
  ├─ MCP → Agent A: {active_clients: 15}
  └─ Agent A → User A: "15 user online di Kantor"
```

### Agent Isolation

```
Agent A (User A): "List routers"  →  sees: UmmiNEW, Kantor
Agent B (User B): "List routers"  →  sees: Warnet
```

Agent A cannot see or access Agent B's routers. Each agent only has access to its own user's data, enforced by the MCP server loading only the requesting agent's user registry file.

### Write Operation (with confirmation)

```
User A: "Hapus user hotspot tamu di UmmiNEW"
  │
  ├─ Agent A: detect destructive action → ask confirmation
  ├─ Agent A → User A: "Mau hapus user hotspot tamu di UmmiNEW nih, lanjut? (ya/tidak)"
  ├─ User A: "ya"
  ├─ Agent A → MCP: remove_hotspot_user(user_id=..., router="UmmiNEW", username="tamu")
  └─ Agent A → User A: "User tamu udah dihapus dari UmmiNEW"
```

---

## Per-User Router Registry

### Storage: PostgreSQL (Production)

Router data is stored in PostgreSQL, shared with the admin dashboard via Prisma. The MCP server accesses the same database directly using `psycopg2` (`registry_pg.py`).

**Database tables** (Prisma schema at `dashboard/prisma/schema.prisma`):

```
"User" table:
  id, email, name, telegramId, role, status, isProvisioned, ...

"Router" table:
  id, name, host, port, username, passwordEnc (Fernet-encrypted),
  label, routerosVersion, board, isDefault, addedAt, lastSeen, userId (FK → User)

"ActivityLog" table:
  id, timestamp, action, tool, status, durationMs, details, userId, routerId
```

**Unique constraints**: `(userId, name)` on Router — each user's routers must have unique names.

**Example data relationship**:
```
User (telegramId: "86340875")
  ├── Router: UmmiNEW  → id30.tunnel.my.id:12065  (isDefault: true)
  └── Router: Kantor   → office.tunnel.my.id:8728  (isDefault: false)

User (telegramId: "12345678")
  └── Router: Warnet   → warnet.tunnel.my.id:8728  (isDefault: true)
```

### Registry Implementation

The MCP server selects the registry backend at startup (`server.py`):

```python
if DATABASE_URL:
    from registry_pg import RouterRegistryPG
    registry = RouterRegistryPG(database_url=DATABASE_URL)  # Production
else:
    from registry import RouterRegistry
    registry = RouterRegistry(data_dir=DATA_DIR)             # Legacy fallback (JSON files)
```

`RouterRegistryPG` uses a threaded connection pool (1-10 connections) and speaks directly to the same PostgreSQL database that the dashboard manages via Prisma. Both share the same `"User"` and `"Router"` tables with PascalCase quoted identifiers.

### Credential Encryption

All router passwords are encrypted with **Fernet symmetric encryption** before storage:

```
Registration: password → crypto.encrypt() → stored as passwordEnc in "Router" table
Connection:   passwordEnc → crypto.decrypt() → used for RouterOS API login (server-side only)
```

- Master key auto-generated at first run, stored at `data/.master_key` (chmod 600)
- Implementation: `mikrotik_mcp/crypto.py` using `cryptography.fernet.Fernet`
- Both `registry_pg.py` (PostgreSQL) and `registry.py` (JSON) use the same `CredentialStore`

### Legacy: JSON File Registry (Fallback)

When `DATABASE_URL` is not set, the system falls back to per-user JSON files in `data/{user_id}.json`. This mode is only used for local development without a database.

### How user_id Reaches MCP Tools

Each agent is bound to a specific user via Nanobot's session system. When a Telegram message arrives, Nanobot identifies the user by their numeric Telegram ID and routes the message to that user's agent. The agent knows its user's identity from the session context. The skill (SKILL.md) instructs the agent to always pass `user_id` when calling MCP tools, ensuring data isolation at the tool level.

```
SKILL.md:
  "IMPORTANT: For every MCP tool call, you MUST include the user_id
   parameter. The user_id is the Telegram user ID of the person
   you're chatting with. You can find it in the session context."
```

### Router Selection Logic

All query tools accept `user_id` (required) + `router` (optional):

1. Look up `User` by `telegramId`, then load their `Router` records from PostgreSQL
2. If `router` param provided → use that router
3. If not provided → use the router where `isDefault = true`
4. If no routers exist → return error message guiding user to add one
5. Special keyword `"all"` → query all of this user's routers

---

## Security

### Access Control

| Layer                | Mechanism                                                                        |
| -------------------- | -------------------------------------------------------------------------------- |
| **Bot access**       | `allowFrom` in config — only manually provisioned Telegram user IDs can interact |
| **Data isolation**   | PostgreSQL with per-user scoping — MCP server queries only the requesting user's routers via `telegramId → userId` |
| **Write operations** | LLM-enforced confirmation before destructive actions                             |
| **Credentials**      | Encrypted at rest (Fernet); never sent through LLM context after registration    |
| **Network**          | RouterOS API via tunnel; credentials stay server-side                            |
| **Database**         | PostgreSQL with Prisma ORM (dashboard) + psycopg2 (MCP server)                  |
| **Container**        | Docker Compose; 3 services with resource limits                                  |

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

The initial admin's `TELEGRAM_USER_ID` is set in `.env`. Additional users are provisioned via the admin dashboard, which auto-generates `config.generated.json` with the updated `allowFrom` list. The agent hot-reloads on config change — no manual redeploy required.

### Credential Storage (Current: PostgreSQL + Fernet)

Router passwords are **Fernet-encrypted at rest** in the `"Router".passwordEnc` column in PostgreSQL. The encryption key (`data/.master_key`) is auto-generated on first run and stored with `chmod 600`.

| Layer | Detail |
| ----- | ------ |
| **At rest** | Fernet-encrypted in PostgreSQL `passwordEnc` column |
| **In transit (internal)** | Decrypted server-side by MCP server only when connecting to RouterOS |
| **LLM exposure** | Password passes through LLM **once** during `register_router` call, never again |
| **Master key** | `data/.master_key` — auto-generated, `chmod 600`, shared between JSON and PG registries |

### Credential Flow (credentials never touch the LLM after registration)

```
User: "Tambah router: host x.x.x.x port 8728 user admin pass secret"
  │
  ├─ Agent extracts params from user message
  ├─ Agent → MCP: register_router(user_id, name, host, port, user, pass)
  ├─ MCP: encrypts password with Fernet → stores in PostgreSQL "Router" table
  ├─ MCP: tests connection → returns board info
  └─ Agent → User: "Router ditambahkan"

  Subsequently:
  User: "Cek CPU"
  ├─ Agent → MCP: get_system_info(user_id, router="UmmiNEW")
  ├─ MCP: loads encrypted credentials from PostgreSQL → decrypts server-side
  ├─ MCP: connects to router via RouterOS API, queries, returns data
  └─ Agent → User: "CPU 11%"

  Password goes: User message → Agent → MCP (one time only, during registration)
  After that: MCP reads from PostgreSQL, Agent/LLM never sees the password again
```

### Tool Classification

| Category      | Tools                                                                                                                                                                | Confirmation Required                        |
| ------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------- |
| **Read**      | get*system_info, list_interfaces, list_dhcp_leases, count_active_clients, list_firewall*\*, list_arp_table, get_recent_logs, etc.                                    | No                                           |
| **Write**     | add/remove hotspot users, add/remove IP, add/remove DNS, add/remove PPP secrets, add/remove queues, enable/disable interfaces, kick sessions, make DHCP static, etc. | Yes — confirm action + router name           |
| **Admin**     | register_router, remove_router, set_default_router                                                                                                                   | Yes — confirm action                         |
| **Dangerous** | run_routeros_query (raw API), run_system_script, reboot_router                                                                                                       | Double confirmation — show the command first |

---

## Deployment

### Infrastructure

| Component             | Detail                                |
| --------------------- | ------------------------------------- |
| **GitHub repo**       | `codevjs/mikrotik-ai-agent` (private) |
| **VPS**               | `103.67.244.215`                      |
| **Deploy path**       | `/opt/mikrotik-ai-agent`              |
| **Container runtime** | Docker Compose                        |

### CI/CD — GitHub Actions

On every push to `main`, GitHub Actions automatically deploys to the VPS:

```
Push to main → GitHub Actions → SSH to VPS → git pull → docker compose up --build --force-recreate
```

Workflow: `.github/workflows/deploy.yml`

Key steps:
1. **Swap creation** — Creates 2GB swap on first run to prevent OOM during Docker builds on low-RAM VPS
2. **Git pull** — Fetch and reset to `origin/main` (handles fresh clone, existing repo, or corrupted state)
3. **Stop all containers** — Free RAM for build phase
4. **Sequential builds** — Build agent first, then dashboard (with `--max-old-space-size=512`) to limit peak RAM
5. **Ordered startup** — Start `postgres` → wait 10s → `dashboard` → wait 5s → `mikrotik-agent`
6. **Prisma migrations** — Run `prisma migrate deploy` after dashboard is up
7. **Timeout** — 30-minute command timeout for slow VPS builds

### Docker Compose

Three services on a shared internal network:

| Service | Container | Resources | Purpose |
| ------- | --------- | --------- | ------- |
| `postgres` | `mikrotik-db` | 128MB RAM | PostgreSQL 16 — shared database for dashboard + MCP server |
| `dashboard` | `mikrotik-dashboard` | 256MB RAM | Next.js admin UI — port 3000 |
| `mikrotik-agent` | `mikrotik-agent` | 1 CPU, 512MB RAM | Nanobot gateway (port 8900) + MCP server + health API (port 8080) |

- **Volumes**: `pgdata` (PostgreSQL data), `nanobot-data` (agent state), config/skills/MCP/docs (bind mounts), Docker socket (dashboard only)
- **Restart policy**: `unless-stopped` (all services)
- **Health check**: PostgreSQL readiness check; dashboard and agent depend on it
- **Docker socket**: Dashboard mounts `/var/run/docker.sock` for container management during provisioning
- **PostgreSQL tuning**: Custom low-RAM config (`shared_buffers=32MB`, `max_connections=20`, `work_mem=2MB`) for 128MB container
- **Internal ports**: Agent exposes two services on the internal network — health API (8080) for router data queries, and nanobot gateway API (8900) for OpenAI-compatible `/v1/chat/completions` used by dashboard chat

### Container Startup (entrypoint.sh)

1. Symlink skills into Nanobot workspace
2. Copy config: prefer `config.generated.json` (from dashboard auto-provisioning) over `config.json`
3. Copy `config/SOUL.md` + `config/HEARTBEAT.md` to Nanobot workspace
4. Start `health_server.py` in background (port 8080 — HTTP API for dashboard)
5. Start `nanobot gateway` — agent runtime that spawns per-user agents on demand
6. Watch `config.generated.json` for changes → hot-reload nanobot process (graceful SIGTERM + restart)

---

## Tech Stack

| Component             | Technology                                                    | Why                                                             |
| --------------------- | ------------------------------------------------------------- | --------------------------------------------------------------- |
| Agent Runtime         | Nanobot (nanobot-ai)                                          | 1 agent per user, MCP support, multi-channel, session isolation |
| LLM                   | Google Gemini 2.5 Flash via OpenRouter                         | Fast, tool calling support, cost-effective                      |
| MCP Server            | Python + FastMCP (stdio)                                      | Standard protocol, auto-discovered by Nanobot                   |
| MCP Tools             | 137 tools                                                     | Full RouterOS management coverage                               |
| RouterOS Client       | librouteros                                                   | Mature Python library for RouterOS API v6/v7                    |
| Database              | PostgreSQL 16 + Prisma 7                                      | Shared between dashboard and MCP server, relational integrity   |
| Dashboard             | Next.js 16 + React 19 + Tailwind + shadcn/ui                 | Admin UI with user/router management, chat, logs                |
| Auth                  | NextAuth v5                                                   | JWT-based dashboard authentication                              |
| Messaging             | Telegram (primary)                                            | Built-in Nanobot channel support                                |
| Container             | Docker Compose (3 services)                                   | PostgreSQL + Dashboard + Agent on shared network                |
| CI/CD                 | GitHub Actions + SSH                                          | Auto-deploy on push to main                                     |
| Credential Encryption | cryptography (Fernet)                                         | Passwords encrypted at rest in PostgreSQL                       |
| Personality           | config/SOUL.md                                                | Casual Indonesian, short responses                              |

---

## File Structure

```
Mikrotik Ai Agent/
├── .github/
│   └── workflows/
│       └── deploy.yml                # CI/CD: auto-deploy to VPS on push to main
│
├── config/
│   ├── config.json                   # Nanobot config template (LLM, Telegram, MCP)
│   ├── config.generated.json         # Auto-generated by dashboard (runtime, gitignored)
│   ├── SOUL.md                       # Bot personality & communication style
│   └── HEARTBEAT.md                  # Periodic health check tasks
│
├── dashboard/                        # Next.js 16 admin web UI
│   ├── app/                          # Pages: dashboard, users, routers, chat, logs, settings
│   ├── components/                   # React components (shadcn/ui)
│   ├── hooks/                        # TanStack Query hooks
│   ├── lib/                          # Auth (NextAuth), DB (Prisma), services
│   ├── prisma/
│   │   └── schema.prisma             # Database schema (User, Router, ActivityLog, etc.)
│   ├── Dockerfile                    # Multi-stage Node.js 20 build
│   └── package.json
│
├── mikrotik_mcp/
│   ├── server.py                     # MCP server — 137 tools + entry point
│   ├── registry_pg.py                # PostgreSQL registry (production)
│   ├── registry.py                   # JSON registry (legacy fallback)
│   ├── crypto.py                     # Fernet encryption for credentials
│   ├── health_server.py              # HTTP API (port 8080) for dashboard
│   └── requirements.txt              # Python dependencies
│
├── skills/
│   └── mikrotik/
│       └── SKILL.md                  # LLM context: 137-tool reference, rules, examples
│
├── scripts/
│   ├── add-user.sh                   # Add Telegram ID to allowFrom
│   ├── remove-user.sh                # Remove Telegram ID from allowFrom
│   ├── list-users.sh                 # List provisioned users
│   └── migrate-json-to-pg.py         # One-time JSON→PostgreSQL migration
│
├── data/                             # Runtime data (gitignored)
│   └── .master_key                   # Fernet encryption key (auto-generated)
│
├── docs/
│   ├── ARCHITECTURE.md               # This file
│   ├── API_REFERENCE.md              # All 137 MCP tools documented
│   ├── ADMIN_GUIDE.md                # Deployment & user management guide
│   ├── USER_GUIDE.md                 # User onboarding guide
│   └── PHASES.md                     # Implementation phases
│
├── docker-compose.yml                # 3 services: postgres + dashboard + agent
├── Dockerfile                        # Python 3.11-slim + nanobot-ai + MCP deps
├── entrypoint.sh                     # Config setup + health server + nanobot + hot-reload
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

| Version | Protocol               | Support                            |
| ------- | ---------------------- | ---------------------------------- |
| v6.x    | Binary API (port 8728) | Full (via librouteros)             |
| v7.x    | Binary API (port 8728) | Full (via librouteros)             |
| v7.x    | REST API (port 443)    | Not used — binary API is universal |

---

## Limitations & Known Constraints

1. **RouterOS API access required** — Winbox-only access is not sufficient
2. **Tunnel dependency** — Routers behind NAT need a tunnel service
3. **LLM tool calling** — Model must support function calling
4. **Password exposure during registration** — Password passes through LLM once during `register_router`; after that, MCP reads encrypted credentials from PostgreSQL
5. **No real-time streaming** — Router stats are polled on-demand
6. **Single LLM instance** — All users share the same model and rate limits
7. **Shared personality & skills** — All agents share the same SOUL.md personality and SKILL.md instructions; per-agent customization is not yet supported
8. **User provisioning** — Admin provisions users via dashboard UI or scripts; dashboard auto-generates config and agent hot-reloads

---

## Future Considerations

- **Per-user billing**: Token usage tracking and subscription management (Phase 11 — schema ready)
- **Mobile app**: Native mobile interface (Phase 12)
- **Rate limiting**: Per-user tool call limits to prevent abuse
- **Webhook alerts**: Router-initiated alerts (e.g., "CPU > 90%") pushed to user
- **WhatsApp support**: Add as second channel (Nanobot supports it)
- **Per-user LLM keys**: Users bring their own OpenRouter/API keys for cost sharing
