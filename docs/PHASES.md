# MikroTik AI Agent — Implementation Phases

## Phase Overview

| Phase | Name | Status |
|-------|------|--------|
| 1 | Single Router Agent | ✅ Done |
| 2 | Multi-Router + Multi-User | ✅ Done |
| 3 | Comprehensive RouterOS Tools | ✅ Done |
| 4 | Write Confirmation + Communication Style | ✅ Done |
| 5 | CI/CD + VPS Deployment | ✅ Done |
| 6 | Encrypted Credentials | 📋 Planned |
| 7 | Admin User Management | 📋 Planned |
| 8 | WhatsApp Channel | 📋 Planned |
| 9 | Monitoring & Alerts | 📋 Planned |
| 10 | Admin Dashboard (Web UI) | 📋 Planned |

---

## Phase 1: Single Router Agent ✅

**Status: COMPLETE (2026-04-09)**

### Deliverables
- 20 initial MCP tools
- Nanobot Docker deployment
- Telegram channel
- Single router connection test passed

---

## Phase 2: Multi-Router + Multi-User ✅

**Status: COMPLETE (2026-04-09)**

### Deliverables
- Per-user router registry (`data/{user_id}.json`)
- `registry.py` with atomic writes, password stripping
- `server.py` refactored: all tools accept `user_id` + router params
- New tools: `list_routers`, `register_router`, `remove_router`, `set_default_router`, `test_connection`
- Self-service router onboarding via chat
- `SKILL.md` with onboarding flow, `user_id` rules, router selection
- Migration seed data for existing user

---

## Phase 3: Comprehensive RouterOS Tools ✅

**Status: COMPLETE (2026-04-09)**

### Deliverables
- Expanded from 26 to **66 MCP tools**
- New categories: kick/disconnect, interface mgmt, firewall address lists, IP/DHCP/DNS management, PPP/VPN, system health/reboot/scripts, queue management
- All tools follow `user_id` + router pattern

---

## Phase 4: Write Confirmation + Communication Style ✅

**Status: COMPLETE (2026-04-09)**

### Deliverables
- `SKILL.md` safety rules: single confirm for write ops, double confirm for dangerous ops
- `SOUL.md`: casual/gaul Indonesian, 1-3 line responses, never expose tool names
- Telegram MarkdownV2 formatting rules
- `config/SOUL.md` persisted via `entrypoint.sh`

---

## Phase 5: CI/CD + VPS Deployment ✅

**Status: COMPLETE (2026-04-09)**

### Deliverables
- GitHub private repo: `codevjs/mikrotik-ai-agent`
- GitHub Actions CI/CD: auto-deploy on push to main
- VPS: `103.67.244.215`, Docker Compose, `--force-recreate`
- SSH deploy key authentication

---

## Phase 6: Encrypted Credentials

**Status: PLANNED**

### Goal
Encrypt router passwords at rest.

### Deliverables
- `crypto.py` with Fernet encryption
- Passwords encrypted at rest in `data/*.json`
- Auto-generated master key

### New File: `mikrotik_mcp/crypto.py`

```python
from cryptography.fernet import Fernet

class CredentialStore:
    def __init__(self, key_path: str = "/app/data/.master_key"):
        """Load or auto-generate encryption key."""
    
    def encrypt(self, plaintext: str) -> str:
        """Encrypt -> base64 string for JSON storage."""
    
    def decrypt(self, ciphertext: str) -> str:
        """base64 string -> decrypt -> plaintext."""
```

### Key Management
- Auto-generated on first boot at `data/.master_key`
- Backed up in Docker volume
- If lost: all users must re-enter passwords

### Dependencies
```
cryptography>=42.0
```

---

## Phase 7: Admin User Management

**Status: PLANNED**

### Goal
Script to add/remove users from `allowFrom`.

### Deliverables
- Business model: paid access, manual provisioning
- Admin adds Telegram user ID after payment

---

## Phase 8: WhatsApp Channel

**Status: PLANNED**

### Goal
Add WhatsApp as alternative messaging channel alongside Telegram.

### Deliverables
- Add Node.js to Dockerfile
- WhatsApp config in `config.json`
- QR code scan for login

### Dockerfile Change
```dockerfile
RUN curl -fsSL https://deb.nodesource.com/setup_20.x | bash - && \
    apt-get install -y nodejs
```

### Config Addition
```json
{
  "channels": {
    "telegram": { ... },
    "whatsapp": {
      "enabled": true,
      "allowFrom": ["+628xxxxxxxxxx"]
    }
  }
}
```

### Setup
```bash
docker compose exec mikrotik-agent nanobot channels login whatsapp
# Scan QR code with phone
docker compose restart mikrotik-agent
```

---

## Phase 9: Monitoring & Alerts

**Status: PLANNED**

### Goal
Proactive health monitoring via cron + heartbeat. Agent periodically checks routers and alerts users if something is wrong.

### Deliverables
- `check_all_routers_health` tool
- `HEARTBEAT.md` periodic checks
- Cron scheduled reports
- Alert conditions: unreachable, CPU>80%, memory>90%, unexpected reboot

### Alert Conditions

| Condition | Severity | Action |
|-----------|----------|--------|
| Router unreachable | Critical | Immediate notification |
| CPU > 80% sustained | Warning | Notification |
| Memory > 90% | Warning | Notification |
| Unexpected reboot | Alert | Notification + show uptime |
| Client count spike | Info | Summary in daily report |

### New MCP Tool
```python
@mcp.tool()
def check_all_routers_health(user_id: str) -> list[dict]:
    """Check connectivity and basic health of all user's routers.
    Returns status, CPU, memory, uptime for each router."""
```

---

## Phase 10: Admin Dashboard (Web UI)

**Status: PLANNED**

### Goal
Web-based admin dashboard for managing users, routers, and monitoring.

### Deliverables
- React + TypeScript + Tailwind + shadcn/ui
- User management, router overview, activity logs
- Settings, backup/restore
- Connects to Nanobot API or direct data reading

---

## Summary: What Changes Per Phase

| File | Ph.1 ✅ | Ph.2 ✅ | Ph.3 ✅ | Ph.4 ✅ | Ph.5 ✅ | Ph.6 | Ph.7 | Ph.8 | Ph.9 | Ph.10 |
|------|---------|---------|---------|---------|---------|------|------|------|------|-------|
| `server.py` | ✅ | ✏️ Major | ✏️ Major | — | — | — | — | — | ✏️ | — |
| `registry.py` | — | ✨ New | — | — | — | ✏️ | — | — | — | — |
| `crypto.py` | — | — | — | — | — | ✨ New | — | — | — | — |
| `SKILL.md` | ✅ | ✏️ | ✏️ | ✏️ | — | — | — | — | ✏️ | — |
| `SOUL.md` | — | — | — | ✨ New | — | — | — | — | — | — |
| `config.json` | ✅ | ✏️ | — | — | — | — | ✏️ | ✏️ | — | — |
| `Dockerfile` | ✅ | — | — | — | — | ✏️ | — | ✏️ | — | — |
| `docker-compose.yml` | ✅ | ✏️ | — | — | — | — | — | — | — | — |
| `.env` | ✅ | ✏️ | — | — | — | — | — | — | — | — |
| `entrypoint.sh` | — | — | — | ✨ New | — | — | — | — | — | — |
| `.github/workflows/` | — | — | — | — | ✨ New | — | — | — | — | — |
| `HEARTBEAT.md` | — | — | — | — | — | — | — | — | ✨ New | — |
| Web UI (React app) | — | — | — | — | — | — | — | — | — | ✨ New |

Legend: ✅ exists, ✨ new file, ✏️ modified, — no change
