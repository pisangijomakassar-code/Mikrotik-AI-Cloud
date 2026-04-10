# MikroTik AI Agent

AI-powered MikroTik router management platform. Manage your routers through natural language via Telegram, WhatsApp, or a web dashboard.

## Features

- **127 MCP Tools** — Full Winbox-equivalent coverage: system, interfaces, DHCP, firewall, hotspot, PPP/VPN, queues, routing, wireless, and more
- **Natural Language Control** — "berapa client online?" instead of CLI commands
- **Multi-User SaaS** — Paid access, admin provisions users via dashboard
- **Multi-Router** — Each user can manage multiple MikroTik routers
- **Admin Dashboard** — Next.js web UI with user management, router monitoring, activity logs, and chat interface
- **Real-time Health Check** — CPU, memory, client count, online/offline status
- **Encrypted Credentials** — Router passwords encrypted at rest (Fernet)
- **Write Confirmation** — Destructive actions require explicit user approval
- **Anti-Hallucination** — All data comes from MCP tool calls, never guessed
- **Auto-Provisioning** — Dashboard auto-updates nanobot config on user changes
- **CI/CD** — GitHub Actions auto-deploy to VPS on push

## Quick Start

### Prerequisites

- Docker & Docker Compose
- Telegram bot token ([@BotFather](https://t.me/BotFather))
- OpenRouter API key ([openrouter.ai](https://openrouter.ai/keys))
- MikroTik router with API access enabled (port 8728)

### Deploy

```bash
git clone https://github.com/codevjs/mikrotik-ai-agent.git
cd mikrotik-ai-agent

# Configure
cp .env.example .env
nano .env  # fill in credentials

# Deploy (3 services: PostgreSQL + Dashboard + Agent)
docker compose up -d --build

# Access dashboard
open http://your-server:3000
```

### Environment Variables

| Variable | Description |
|----------|-------------|
| `OPENROUTER_API_KEY` | LLM API key from OpenRouter |
| `TELEGRAM_BOT_TOKEN` | Bot token from @BotFather |
| `TELEGRAM_USER_ID` | Admin Telegram numeric user ID |
| `DB_PASSWORD` | PostgreSQL password |
| `NEXTAUTH_SECRET` | Dashboard auth secret |
| `ADMIN_EMAIL` | Dashboard admin email |
| `ADMIN_PASSWORD` | Dashboard admin password |

## Architecture

```
┌──────────────────────────────────────────────────┐
│              Admin Dashboard (Next.js)            │
│         http://your-server:3000                   │
│  Users | Routers | Logs | Chat | Settings         │
└─────────────────────┬────────────────────────────┘
                      │ PostgreSQL
┌─────────────────────┼────────────────────────────┐
│              Nanobot AI Agent                     │
│         Telegram / WhatsApp Bot                   │
│                                                   │
│    ┌──────────────────────────────────────┐       │
│    │    MikroTik MCP Server (127 tools)   │       │
│    │    librouteros → RouterOS API        │       │
│    └──────────────────┬───────────────────┘       │
└─────────────────────┬────────────────────────────┘
                      │
        ┌─────────────┼─────────────┐
        ▼             ▼             ▼
   MikroTik A    MikroTik B    MikroTik C
```

## MCP Tools (127 total)

| Category | Tools | Examples |
|----------|-------|---------|
| **System** | 15 | info, health, clock, packages, license, reboot |
| **Interfaces** | 10 | list, enable/disable, bridge, VLAN, bonding, tunnels |
| **Wireless** | 4 | interfaces, clients, security profiles, access list |
| **IP** | 7 | addresses, routes, pools, services, cloud DDNS |
| **DNS** | 4 | settings, static entries CRUD |
| **DHCP** | 7 | servers, leases, clients, count, make static |
| **Firewall** | 13 | filter, NAT, mangle, address lists, raw — full CRUD |
| **Hotspot** | 18 | users, profiles, active, servers, kick, search, count, enable/disable |
| **PPP/VPN** | 9 | secrets, profiles, active, L2TP/PPTP/SSTP, kick |
| **Queue** | 7 | simple, tree, types — full CRUD |
| **Routing** | 6 | static routes, OSPF, BGP, filters |
| **Monitoring** | 8 | netwatch, SNMP, UPnP, logs, health check, IP accounting |
| **Tunnels** | 4 | EoIP, GRE, IPIP, bonding |
| **Advanced** | 5 | backup, export, CAPsMAN, IPv6, raw API query |
| **Router Mgmt** | 5 | register, remove, list, set default, test connection |

## Admin Dashboard

Web-based admin panel at `http://your-server:3000`:

- **Dashboard** — Overview stats, activity feed, router health
- **Users** — Add/remove users, manage Telegram access
- **Routers** — Monitor all routers with real-time status
- **Chat** — Chat with AI agent directly from browser (with image upload)
- **Logs** — Filterable activity logs
- **Settings** — LLM config, provisioning, system management

### User Management

```bash
# Add user via script
./scripts/add-user.sh 12345678 "Pak Budi"

# Or add via dashboard UI
# Dashboard → Users → Add User
```

## Tech Stack

| Component | Technology |
|-----------|-----------|
| AI Agent | [Nanobot](https://github.com/HKUDS/nanobot) v0.1.5 |
| LLM | Google Gemini 2.5 Flash via [OpenRouter](https://openrouter.ai) |
| MCP Server | Python + [FastMCP](https://github.com/jlowin/fastmcp) |
| RouterOS Client | [librouteros](https://github.com/luqasz/librouteros) |
| Dashboard | Next.js 16 + React 19 + Tailwind + shadcn/ui |
| Database | PostgreSQL 16 + Prisma 7 |
| Auth | NextAuth v5 |
| Data Fetching | TanStack Query |
| Messaging | Telegram (WhatsApp supported via Nanobot) |
| Deployment | Docker Compose + GitHub Actions CI/CD |

## Project Structure

```
mikrotik-ai-agent/
├── .github/workflows/deploy.yml    # CI/CD pipeline
├── dashboard/                       # Next.js admin dashboard
│   ├── app/                        # Pages (login, dashboard, users, routers, chat, logs, settings)
│   ├── components/                 # React components + shadcn/ui
│   ├── hooks/                      # TanStack Query hooks
│   ├── lib/                        # Auth, DB, services, provisioner
│   ├── prisma/                     # Database schema
│   └── Dockerfile
├── mikrotik_mcp/                    # MCP server (Python)
│   ├── server.py                   # 127 tools
│   ├── registry.py                 # JSON-based router registry
│   ├── registry_pg.py              # PostgreSQL-based router registry
│   └── crypto.py                   # Fernet password encryption
├── config/
│   ├── config.json                 # Nanobot configuration
│   ├── SOUL.md                     # Agent personality & rules
│   └── HEARTBEAT.md                # Periodic health check tasks
├── skills/mikrotik/
│   └── SKILL.md                    # LLM tool reference (127 tools)
├── scripts/                         # Admin scripts (add/remove/list users)
├── docker-compose.yml               # 3 services: postgres + dashboard + agent
├── Dockerfile                       # Nanobot agent container
└── .env.example
```

## Supported RouterOS

| Version | Protocol | Status |
|---------|----------|--------|
| v6.x | Binary API (port 8728) | Supported |
| v7.x | Binary API (port 8728) | Supported |

## Roadmap

- [x] Phase 1: Single router agent
- [x] Phase 2: Multi-user, multi-router
- [x] Phase 3: Comprehensive tools (127 tools)
- [x] Phase 4: Communication style + safety rules
- [x] Phase 5: CI/CD + VPS deployment
- [x] Phase 6: Encrypted credentials
- [x] Phase 7: Admin user management scripts
- [x] Phase 8: Monitoring & alerts
- [x] Phase 9: Admin dashboard (Next.js + PostgreSQL)
- [x] Phase 10: Chat interface with image upload
- [ ] Phase 11: Per-user billing integration
- [ ] Phase 12: Mobile app

## License

MIT
