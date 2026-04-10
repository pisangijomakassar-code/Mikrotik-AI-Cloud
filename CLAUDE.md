# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

MikroTik AI Agent — a paid SaaS platform where each user gets a dedicated AI agent (powered by Nanobot) to manage their MikroTik routers via natural language over Telegram. The system follows a **1 Agent = 1 User** model with full data isolation.

Three Docker services: PostgreSQL 16, Next.js admin dashboard, Nanobot AI agent with Python MCP server.

## Build & Run

```bash
# Full stack (postgres + dashboard + agent)
docker compose up -d --build

# Rebuild individual services
docker compose build mikrotik-agent
docker compose build dashboard

# Dashboard dev mode (requires running postgres)
cd dashboard && npm run dev    # port 3000

# Database
npx prisma migrate dev         # from dashboard/
npx prisma db seed             # seed admin user
npx prisma generate            # regenerate client after schema changes
```

## Key Architecture

### Agent Runtime
- Nanobot runs as a gateway, creating one isolated agent per provisioned Telegram user
- Agent config: `config/config.json` (or `config.generated.json` from dashboard auto-provisioning)
- Personality: `config/SOUL.md` — casual Indonesian style, short responses
- Tool reference: `skills/mikrotik/SKILL.md` — the LLM reads this to know how to use MCP tools
- Periodic tasks: `config/HEARTBEAT.md` — health checks every 30min

### MCP Server (Python, `mikrotik_mcp/`)
- `server.py` — FastMCP server with 137 `@mcp.tool` functions, all requiring `user_id` parameter
- Registry selection at startup: if `DATABASE_URL` is set → `registry_pg.py` (PostgreSQL), else → `registry.py` (JSON files)
- `crypto.py` — Fernet encryption for router credentials (master key at `data/.master_key`)
- `health_server.py` — HTTP API on port 8080 for dashboard to query router data, also proxies LLM chat
- RouterOS connection via `librouteros` v4 (binary API, port 8728) — see `docs/LIBROUTEROS_V4_REFERENCE.md`

### Dashboard (Next.js 16, `dashboard/`)
- App Router with React 19, TypeScript strict, Tailwind + shadcn/ui
- Auth: NextAuth v5 (JWT-based)
- ORM: Prisma 7 with PostgreSQL adapter — schema at `dashboard/prisma/schema.prisma`
- Data fetching: TanStack Query hooks in `dashboard/hooks/`
- Auto-provisioning: when users are added via dashboard, it generates `config/config.generated.json` and the agent hot-reloads via inotifywait in `entrypoint.sh`
- **Important**: This uses Next.js 16 which has breaking changes from earlier versions. Read `node_modules/next/dist/docs/` before writing dashboard code.

### Data Storage
- **Production**: PostgreSQL (User, Router, ActivityLog, Subscription, TokenUsage, Invoice tables)
- Router credentials encrypted with Fernet at rest in `Router.passwordEnc` column
- MCP server reads/writes via `registry_pg.py` using psycopg2 directly (same DB as Prisma)
- **Legacy fallback**: JSON files in `data/{user_id}.json` when `DATABASE_URL` is not set

### Entrypoint Flow (`entrypoint.sh`)
1. Symlink skills → Nanobot workspace
2. Copy config (prefer `config.generated.json` over `config.json`)
3. Copy SOUL.md + HEARTBEAT.md
4. Start `health_server.py` (port 8080) in background
5. Start `nanobot gateway`
6. Watch `config.generated.json` for changes → hot-reload nanobot

## Conventions

- All MCP tools must accept `user_id` as first parameter for data isolation
- Router name resolution: `None` → default router, `"all"` → all routers, specific name → that router
- Write/destructive MCP tools must require confirmation (enforced via SKILL.md instructions to the LLM)
- Bot responses: casual Indonesian, 1-3 lines, never expose tool names or internal IDs
- Prisma tables use PascalCase with quoted identifiers (e.g., `"Router"`, `"User"`) — the MCP server's SQL must match
- **MCP tools MUST follow librouteros v4 API patterns** — read `docs/LIBROUTEROS_V4_REFERENCE.md` before writing/editing `server.py`. Key rules:
  - `select()` = field selection (like SQL SELECT), `where()` = filtering (like SQL WHERE)
  - Path creation: `api.path('ip', 'hotspot', 'user')` (separate args)
  - Find by name: `resource.select().where(Key('name') == value)` — NEVER pass conditions to `select()`

## CI/CD

Push to `main` → GitHub Actions (`deploy.yml`) → SSH to VPS → sequential Docker build → restart services. The workflow creates 2GB swap to prevent OOM on low-RAM VPS builds.

## Environment Variables

See `.env.example`. Key vars: `OPENROUTER_API_KEY`, `TELEGRAM_BOT_TOKEN`, `TELEGRAM_USER_ID`, `DB_PASSWORD`, `NEXTAUTH_SECRET`, `ADMIN_EMAIL`, `ADMIN_PASSWORD`, `VPS_HOST`.
