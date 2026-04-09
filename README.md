# MikroTik AI Agent

AI-powered MikroTik router management via Telegram. Chat with your router using natural language.

## Features

- **Natural Language Control** — Ask "berapa client yang online?" instead of memorizing CLI commands
- **Multi-User** — Each Telegram user registers their own routers
- **Multi-Router** — One user can manage multiple MikroTik routers
- **Self-Service Onboarding** — Users add routers via chat conversation
- **23 MCP Tools** — System info, interfaces, DHCP, firewall, hotspot, ARP, logs, and more
- **Write Confirmation** — Destructive actions require user approval
- **Docker Deployment** — Single container, auto-deploy via GitHub Actions

## Quick Start

### Prerequisites

- Docker & Docker Compose
- Telegram bot token (from [@BotFather](https://t.me/BotFather))
- OpenRouter API key (free at [openrouter.ai](https://openrouter.ai/keys))
- MikroTik router with API access enabled (port 8728)

### Deploy

```bash
git clone https://github.com/codevjs/mikrotik-ai-agent.git
cd mikrotik-ai-agent

# Configure
cp .env.example .env
nano .env  # fill in your credentials

# Run
docker compose up -d --build

# Check logs
docker compose logs -f
```

### Environment Variables

| Variable | Description |
|----------|-------------|
| `OPENROUTER_API_KEY` | LLM API key from OpenRouter |
| `TELEGRAM_BOT_TOKEN` | Bot token from @BotFather |
| `TELEGRAM_USER_ID` | Your Telegram numeric user ID (or `*` for all users) |

## Usage

Once running, chat with your Telegram bot:

```
You: /start
Bot: Halo! Saya belum punya router untuk akun Anda.
     Silakan kirim detail router MikroTik Anda...

You: Nama: Kantor, Host: router.example.com, Port: 8728,
     User: admin, Pass: rahasia123
Bot: Mengecek koneksi... Router "Kantor" berhasil ditambahkan!
     Board: hEX | RouterOS: 6.49.8

You: Berapa client yang online?
Bot: Router Kantor: 36 client aktif

You: Tampilkan firewall rules
Bot: [firewall rules table]

You: Buat user hotspot: tamu, password guest123
Bot: Anda yakin ingin membuat user hotspot 'tamu'
     di router Kantor? (ya/tidak)
You: ya
Bot: User hotspot 'tamu' berhasil dibuat
```

## Available Tools

### Router Management
| Command | Description |
|---------|-------------|
| Add router | Register a new MikroTik router |
| Remove router | Unregister a router |
| List routers | Show all your routers |
| Set default | Change default router |

### Monitoring
| Command | Description |
|---------|-------------|
| System info | CPU, memory, uptime, board, version |
| Interfaces | All interfaces with traffic stats |
| DHCP leases | Connected clients (IP, MAC, hostname) |
| Active clients | Quick client count |
| ARP table | All devices seen by router |
| Firewall rules | Filter and NAT rules |
| Recent logs | System log entries |

### Hotspot Management
| Command | Description |
|---------|-------------|
| Hotspot users | List all user accounts |
| Active sessions | Currently connected users |
| Add user | Create new hotspot account |
| Remove user | Delete hotspot account |

### Advanced
| Command | Description |
|---------|-------------|
| Raw API query | Query any RouterOS API path |
| Compare routers | Cross-router comparisons |

## Architecture

```
Telegram User
     |
     v
Nanobot Gateway (AI Agent + LLM)
     |
     v
MikroTik MCP Server (23 tools)
     |
     v
Per-User Router Registry (data/{user_id}.json)
     |
     v
MikroTik Routers (via RouterOS API)
```

## Tech Stack

| Component | Technology |
|-----------|-----------|
| AI Agent | [Nanobot](https://github.com/HKUDS/nanobot) v0.1.5 |
| LLM | Google Gemma 4 31B IT via [OpenRouter](https://openrouter.ai) |
| MCP Server | Python + [FastMCP](https://github.com/jlowin/fastmcp) |
| RouterOS Client | [librouteros](https://github.com/luqasz/librouteros) |
| Messaging | Telegram (WhatsApp planned) |
| Deployment | Docker + GitHub Actions CI/CD |

## Project Structure

```
mikrotik-ai-agent/
├── .github/workflows/deploy.yml  # CI/CD pipeline
├── mikrotik_mcp/
│   ├── server.py                  # MCP server (23 tools)
│   ├── registry.py                # Per-user router storage
│   └── requirements.txt
├── config/
│   └── config.json                # Nanobot config template
├── skills/mikrotik/
│   └── SKILL.md                   # LLM context and rules
├── data/                          # Per-user router registries (gitignored)
├── docs/
│   ├── ARCHITECTURE.md            # System architecture
│   └── PHASES.md                  # Implementation roadmap
├── Dockerfile
├── docker-compose.yml
├── entrypoint.sh
└── .env.example
```

## Supported RouterOS Versions

| Version | Protocol | Status |
|---------|----------|--------|
| v6.x | Binary API (port 8728) | Supported |
| v7.x | Binary API (port 8728) | Supported |

## CI/CD

Push to `main` branch triggers automatic deployment to VPS via GitHub Actions.

```
git push origin main  →  GitHub Actions  →  SSH deploy  →  docker compose up
```

## Roadmap

See [docs/PHASES.md](docs/PHASES.md) for the full implementation roadmap.

- [x] Phase 1: Single router agent
- [x] Phase 2: Multi-user, multi-router
- [ ] Phase 3: Encrypted credentials
- [ ] Phase 4: Write confirmation enforcement
- [ ] Phase 5: WhatsApp channel
- [ ] Phase 6: Monitoring & alerts

## License

MIT
