# MikroTik AI Agent -- Admin Guide

Administration guide for the MikroTik AI Agent SaaS platform. Covers user management, deployment, monitoring, security, and troubleshooting.

---

## Table of Contents

- [Dashboard Access](#dashboard-access)
  - [Login URL and Credentials](#login-url-and-credentials)
  - [Dashboard Overview](#dashboard-overview)
- [User Management](#user-management)
  - [Adding New Users](#adding-new-users)
  - [Removing Users](#removing-users)
  - [Listing Users](#listing-users)
  - [User Provisioning Flow](#user-provisioning-flow)
- [Router Monitoring](#router-monitoring)
  - [Real-Time Health Checks](#real-time-health-checks)
  - [Activity Logs](#activity-logs)
  - [Alert Conditions](#alert-conditions)
- [System Administration](#system-administration)
  - [Architecture Overview](#architecture-overview)
  - [Docker Deployment](#docker-deployment)
  - [Environment Variables](#environment-variables)
  - [Updating the System](#updating-the-system)
  - [Database Management](#database-management)
  - [Backup and Recovery](#backup-and-recovery)
  - [Troubleshooting Common Issues](#troubleshooting-common-issues)
- [Security](#security)
  - [Password Encryption](#password-encryption)
  - [Access Control](#access-control)
  - [API Key Management](#api-key-management)
  - [Network Security](#network-security)

---

## Dashboard Access

### Login URL and Credentials

The admin dashboard is a Next.js web application accessible at:

```
http://your-server-ip:3000
```

For example: `http://103.67.244.215:3000`

**Default credentials** are set via environment variables in `.env`:

| Variable | Description |
|----------|-------------|
| `ADMIN_EMAIL` | Admin login email (default: `admin@mikrotik.local`) |
| `ADMIN_PASSWORD` | Admin login password (default: `admin123`) |

**Change the default password immediately after first login.**

### Dashboard Overview

The dashboard provides the following sections:

- **Dashboard** -- Overview stats, activity feed, router health summary
- **Users** -- Add/remove users, manage Telegram access
- **Routers** -- Monitor all registered routers with real-time status
- **Chat** -- Chat with the AI agent directly from the browser (supports image upload)
- **Logs** -- Filterable activity logs across all users
- **Settings** -- LLM configuration, provisioning, system management

---

## User Management

This is a **paid access service**. Users cannot self-register. The admin manually provisions each user after payment.

### Adding New Users

There are two methods for adding users:

#### Method 1: Via Dashboard (Recommended)

1. Log in to the dashboard at `http://your-server:3000`
2. Navigate to **Users**
3. Click **Add User**
4. Enter the user's Telegram numeric user ID and display name
5. Click **Save**

The dashboard automatically syncs the user list with the Nanobot configuration. No restart is required if auto-provisioning is enabled.

#### Method 2: Via Script

SSH into the server and run:

```bash
cd /opt/mikrotik-ai-agent
./scripts/add-user.sh <telegram_user_id> "<user_name>"
```

**Example:**
```bash
./scripts/add-user.sh 12345678 "Pak Budi"
```

This script:
1. Adds the Telegram user ID to the `allowFrom` list in `config/config.json`
2. Prints next steps (commit and push to trigger auto-deploy, or restart manually)

After adding via script, apply the changes:

```bash
# Option A: Restart the agent container
docker compose restart mikrotik-agent

# Option B: Commit and push to trigger CI/CD auto-deploy
git add config/config.json
git commit -m "feat: add user Pak Budi"
git push
```

#### Method 3: Manual Config Edit

Edit `config/config.json` directly:

```json
{
  "channels": {
    "telegram": {
      "allowFrom": ["86340875", "12345678", "NEW_USER_ID_HERE"]
    }
  }
}
```

Then restart:
```bash
docker compose restart mikrotik-agent
```

### Removing Users

#### Via Script

```bash
cd /opt/mikrotik-ai-agent
./scripts/remove-user.sh <telegram_user_id>
```

This script:
1. Removes the Telegram user ID from `allowFrom` in `config/config.json`
2. Optionally deletes the user's router data file (`data/<user_id>.json`)
3. Prints next steps

Apply changes by restarting or pushing to trigger CI/CD.

#### Via Dashboard

1. Navigate to **Users**
2. Find the user
3. Click **Remove**
4. Confirm the action

### Listing Users

#### Via Script

```bash
cd /opt/mikrotik-ai-agent
./scripts/list-users.sh
```

**Example output:**
```
=== MikroTik AI Agent Users ===

Allowed users (2):

  86340875
    Routers (2): UmmiNEW, Kantor
    Default: UmmiNEW

  12345678 (no routers registered)
```

#### Via Dashboard

Navigate to **Users** to see all provisioned users, their registered routers, and last activity.

### User Provisioning Flow

The complete flow from payment to active usage:

```
1. User pays for access (handled outside the system)
       |
2. Admin adds user's Telegram ID via dashboard or script
       |
3. System applies config (auto-sync or restart)
       |
4. User messages the Telegram bot
       |
5. Bot detects no routers → guides user through first router setup
       |
6. User provides router details (host, port, username, password)
       |
7. Bot tests connection and saves router
       |
8. User starts managing routers through natural language
```

**Key points:**
- Users cannot access the bot unless their Telegram ID is in the `allowFrom` list
- Once provisioned, users self-register their own routers via chat -- no admin involvement needed
- Each user's routers are isolated from other users
- Router credentials are encrypted at rest

---

## Router Monitoring

### Real-Time Health Checks

The dashboard provides real-time health monitoring for all registered routers across all users:

- **Online/Offline status** -- Whether the router is reachable
- **CPU load** -- Current CPU usage percentage
- **Memory usage** -- Used vs. total RAM
- **Active clients** -- Number of connected DHCP clients
- **Uptime** -- Time since last reboot
- **RouterOS version** -- Software version running on the router

The bot also supports health checks via chat:
```
cek semua router
```

### Activity Logs

The dashboard logs section tracks:
- User interactions with the bot
- Tool calls made (what was queried/changed)
- Router actions (read and write operations)
- Errors and connection failures

Logs are filterable by:
- User
- Router
- Time range
- Action type

### Alert Conditions

The health check system detects and reports the following conditions:

| Condition | Severity | Description |
|-----------|----------|-------------|
| Router unreachable | Critical | Cannot connect to the RouterOS API |
| CPU > 80% | Warning | Sustained high CPU load |
| Memory > 90% | Warning | Critical memory usage |
| Unexpected reboot | Alert | Short uptime indicating recent reboot |
| Client count spike | Info | Included in periodic reports |

Alerts appear in the health check results and are communicated via the Telegram bot when scheduled reports are configured.

---

## System Administration

### Architecture Overview

The system consists of three Docker services:

```
┌─────────────────────────────────────────────────┐
│         Admin Dashboard (Next.js)                │
│           Port 3000                              │
│  Users | Routers | Logs | Chat | Settings        │
└─────────────────┬───────────────────────────────┘
                  │ PostgreSQL
┌─────────────────┼───────────────────────────────┐
│          Nanobot AI Agent                        │
│           Telegram / Web Bot                     │
│  ┌──────────────────────────────────────┐       │
│  │  MikroTik MCP Server (137 tools)    │       │
│  │  librouteros → RouterOS API         │       │
│  └────────────────┬─────────────────────┘       │
└─────────────────┬───────────────────────────────┘
                  │
    ┌─────────────┼─────────────┐
    ▼             ▼             ▼
MikroTik A    MikroTik B    MikroTik C
```

| Service | Container | Port | Description |
|---------|-----------|------|-------------|
| PostgreSQL | `mikrotik-db` | 5432 (localhost only) | Database for dashboard |
| Dashboard | `mikrotik-dashboard` | 3000 | Next.js admin web UI |
| Agent | `mikrotik-agent` | 18790 | Nanobot + MCP server + Telegram bot |

### Docker Deployment

**Initial deployment:**

```bash
# Clone the repository
git clone https://github.com/codevjs/mikrotik-ai-agent.git
cd mikrotik-ai-agent

# Configure environment
cp .env.example .env
nano .env  # fill in all required variables

# Start all services
docker compose up -d --build
```

**Service management:**

```bash
# View running containers
docker compose ps

# View logs
docker compose logs -f mikrotik-agent
docker compose logs -f mikrotik-dashboard
docker compose logs -f postgres

# Restart a specific service
docker compose restart mikrotik-agent

# Stop all services
docker compose down

# Rebuild and restart (after code changes)
docker compose up -d --build --force-recreate
```

**Resource limits (defined in docker-compose.yml):**

| Service | CPU | Memory | Memory Reserved |
|---------|-----|--------|-----------------|
| PostgreSQL | -- | 128M | 64M |
| Dashboard | -- | 256M | 128M |
| Agent | 1 CPU | 512M | 256M |

### Environment Variables

All environment variables are set in the `.env` file:

| Variable | Required | Description | Example |
|----------|----------|-------------|---------|
| `OPENROUTER_API_KEY` | Yes | OpenRouter API key for LLM | `sk-or-v1-xxx` |
| `TELEGRAM_BOT_TOKEN` | Yes | Telegram bot token from @BotFather | `123456:ABCdef...` |
| `TELEGRAM_USER_ID` | Yes | Admin's Telegram numeric user ID | `86340875` |
| `DB_PASSWORD` | Yes | PostgreSQL password | `strong-random-password` |
| `NEXTAUTH_SECRET` | Yes | Session secret for dashboard auth | `openssl rand -base64 32` |
| `ADMIN_EMAIL` | No | Dashboard login email | `admin@mikrotik.local` |
| `ADMIN_PASSWORD` | No | Dashboard login password | `change-me` |
| `VPS_HOST` | No | Server hostname/IP for dashboard URL | `103.67.244.215` |

**Generating secrets:**
```bash
# Generate NEXTAUTH_SECRET
openssl rand -base64 32

# Generate DB_PASSWORD
openssl rand -base64 24
```

### Updating the System

#### Automatic (CI/CD)

The system is configured with GitHub Actions CI/CD. Pushing to the `main` branch automatically deploys to the VPS:

```
Push to main → GitHub Actions → SSH to VPS → git pull → docker compose up --build --force-recreate
```

The workflow is defined in `.github/workflows/deploy.yml`.

**To update:**
```bash
# Make changes locally
git add .
git commit -m "feat: your changes"
git push origin main
# Deployment happens automatically
```

#### Manual

SSH into the server and run:

```bash
cd /opt/mikrotik-ai-agent
git pull origin main
docker compose up -d --build --force-recreate
```

### Database Management

The system uses PostgreSQL 16 for the dashboard. The database is tuned for low-memory environments:

```
shared_buffers=32MB
work_mem=2MB
maintenance_work_mem=16MB
effective_cache_size=64MB
max_connections=20
```

**Access the database:**
```bash
# Connect via docker
docker compose exec postgres psql -U mikrotik -d mikrotik

# Or from the host (if port 5432 is bound to localhost)
psql -h 127.0.0.1 -U mikrotik -d mikrotik
```

**Database schema** is managed by Prisma (defined in `dashboard/prisma/`).

**Run migrations:**
```bash
docker compose exec dashboard npx prisma migrate deploy
```

### Backup and Recovery

#### Database Backup

```bash
# Create a backup
docker compose exec postgres pg_dump -U mikrotik mikrotik > backup_$(date +%Y%m%d).sql

# Restore from backup
cat backup_20260409.sql | docker compose exec -T postgres psql -U mikrotik mikrotik
```

#### User Data Backup

Router registry data is stored in `data/` (JSON files) or PostgreSQL depending on the configuration. Back up both:

```bash
# Backup user data files
cp -r /opt/mikrotik-ai-agent/data /opt/backups/data_$(date +%Y%m%d)

# Backup database
docker compose exec postgres pg_dump -U mikrotik mikrotik > /opt/backups/db_$(date +%Y%m%d).sql
```

#### Nanobot Data

Nanobot session data is stored in the `nanobot-data` Docker volume:

```bash
# Backup nanobot volume
docker run --rm -v mikrotik-ai-agent_nanobot-data:/data -v /opt/backups:/backup \
  alpine tar czf /backup/nanobot_$(date +%Y%m%d).tar.gz -C /data .
```

#### Full Recovery

```bash
# 1. Deploy fresh instance
git clone https://github.com/codevjs/mikrotik-ai-agent.git
cd mikrotik-ai-agent
cp .env.backup .env

# 2. Start services
docker compose up -d --build

# 3. Restore database
cat backup.sql | docker compose exec -T postgres psql -U mikrotik mikrotik

# 4. Restore user data
cp -r /opt/backups/data_latest/* data/

# 5. Restart agent to pick up data
docker compose restart mikrotik-agent
```

### Troubleshooting Common Issues

#### Bot not responding to messages

1. **Check the container is running:**
   ```bash
   docker compose ps mikrotik-agent
   ```

2. **Check the logs for errors:**
   ```bash
   docker compose logs -f mikrotik-agent --tail 100
   ```

3. **Verify Telegram bot token:**
   ```bash
   grep TELEGRAM_BOT_TOKEN .env
   ```

4. **Check if the user is in allowFrom:**
   ```bash
   cat config/config.json | python3 -c "import json,sys; print(json.load(sys.stdin)['channels']['telegram']['allowFrom'])"
   ```

#### Dashboard not loading

1. **Check the dashboard container:**
   ```bash
   docker compose logs -f mikrotik-dashboard --tail 100
   ```

2. **Verify the database is healthy:**
   ```bash
   docker compose exec postgres pg_isready -U mikrotik
   ```

3. **Check port 3000 is accessible:**
   ```bash
   curl -I http://localhost:3000
   ```

#### Router connection failures

1. **Test the connection manually:**
   ```bash
   # From inside the agent container
   docker compose exec mikrotik-agent python3 -c "
   import librouteros
   api = librouteros.connect(host='ROUTER_IP', port=8728, username='admin', password='pass', timeout=10)
   print(list(api.path('/system/identity')))
   api.close()
   "
   ```

2. **Check DNS resolution:**
   ```bash
   docker compose exec mikrotik-agent nslookup router.tunnel.my.id
   ```

3. **Verify the API service is enabled on the router** (via Winbox: IP > Services > api).

#### High memory usage

1. **Check container stats:**
   ```bash
   docker stats
   ```

2. **The agent container is limited to 512M.** If it exceeds this, it will be killed and restarted.

3. **Reduce concurrent users** or increase memory limits in `docker-compose.yml`.

#### LLM not responding / API errors

1. **Check the OpenRouter API key:**
   ```bash
   grep OPENROUTER_API_KEY .env
   ```

2. **Check OpenRouter status:** Visit https://openrouter.ai/status

3. **Check the model is available.** The configured model is set in `config/config.json`:
   ```bash
   cat config/config.json | python3 -c "import json,sys; print(json.load(sys.stdin)['agents']['defaults']['model'])"
   ```

---

## Security

### Password Encryption

Router passwords are encrypted at rest using Fernet symmetric encryption (from the `cryptography` Python package).

**How it works:**
1. A master encryption key is auto-generated on first boot and stored at `data/.master_key`
2. When a user registers a router, the password is encrypted before being saved to disk or database
3. When the MCP server needs to connect to a router, it decrypts the password in memory
4. The decrypted password is never logged, never sent to the LLM after initial registration

**Important:** If the master key file is lost, all stored passwords become unrecoverable. Users must re-register their routers. Back up `data/.master_key` along with your other backups.

**Encryption module:** `mikrotik_mcp/crypto.py`

### Access Control

Access is controlled at multiple layers:

| Layer | Mechanism | Detail |
|-------|-----------|--------|
| **Telegram bot** | `allowFrom` in config.json | Only listed Telegram user IDs can interact |
| **Dashboard** | NextAuth with admin email/password | Only the admin can access the web UI |
| **User data** | Per-user isolation | Each user's routers are stored separately; MCP server loads only the requesting user's data |
| **Write operations** | LLM-enforced confirmation | The bot always asks "lanjut? (ya/tidak)" before any destructive action |
| **Dangerous operations** | Double confirmation | Reboot, raw API, script execution require confirming twice |
| **Router credentials** | Encrypted at rest (Fernet) | Passwords never sent to LLM after registration |
| **Container** | Docker resource limits | CPU and memory limits prevent abuse |
| **Database** | Localhost-only port binding | PostgreSQL port 5432 is bound to 127.0.0.1 only |

**User IDs and allowFrom:**

The `allowFrom` field in `config/config.json` acts as the access gate:

```json
{
  "channels": {
    "telegram": {
      "allowFrom": ["86340875", "12345678"]
    }
  }
}
```

- `allowFrom` is **never** set to `["*"]` (wildcard)
- Only explicitly listed Telegram user IDs can use the bot
- Users must be manually provisioned by the admin

### API Key Management

**OpenRouter API Key:**
- Stored in `.env` file (not committed to git)
- Used by Nanobot to call the LLM
- Shared across all users
- Monitor usage at https://openrouter.ai/usage

**Telegram Bot Token:**
- Obtained from @BotFather on Telegram
- Stored in `.env` file
- Used by Nanobot to receive and send Telegram messages

**Best practices:**
- Rotate API keys periodically
- Monitor API usage for unexpected spikes
- Use environment variables, never hardcode keys in config files
- The `.env` file is in `.gitignore` and never committed

### Network Security

**Router API access:**
- The bot connects to routers via the binary API protocol on port 8728
- Connections are point-to-point between the bot server and each router
- If routers are behind NAT, use a tunnel service (e.g., `tunnel.my.id`) for access
- **Never expose port 8728 to the public internet** without proper firewall rules

**Dashboard access:**
- The dashboard runs on port 3000
- Consider placing it behind a reverse proxy (nginx) with SSL/TLS
- Restrict access by IP if possible

**Database access:**
- PostgreSQL port 5432 is bound to `127.0.0.1` only (not accessible from outside the server)
- Change the default `DB_PASSWORD` to a strong random value

**Deployment:**
- SSH access to the VPS uses key-based authentication (configured in GitHub Actions secrets)
- The Docker socket is mounted into the dashboard container for container management (use with caution)
