# MikroTik AI Agent — Implementation Phases

## Phase Overview

| Phase | Name | Status | Key Change |
|-------|------|--------|------------|
| 1 | Single Router Agent | ✅ Done | 1 user, 1 router, basic tools |
| 2 | Multi-Router + Multi-User | 📋 Planned | Per-user router registry, self-service onboarding |
| 3 | Encrypted Credentials | 📋 Planned | Passwords encrypted at rest |
| 4 | Write Confirmation | 📋 Planned | LLM-enforced approval for destructive ops |
| 5 | WhatsApp Channel | 📋 Planned | Add WhatsApp as messaging channel |
| 6 | Monitoring & Alerts | 📋 Planned | Heartbeat checks, cron reports, alerts |

---

## Phase 1: Single Router Agent ✅

**Status: COMPLETE (2026-04-09)**

### What was built
- MikroTik MCP server with 20 tools
- Nanobot Docker deployment
- Telegram channel
- OpenRouter + Gemini 3.1 Flash Lite
- Connection to MikroTik hEX v6.49.8 via tunnel

### Verified
- [x] All 20 MCP tools tested (10/10 passed)
- [x] Nanobot gateway: 0 errors
- [x] Telegram channel: enabled
- [x] MCP tools: auto-discovered and registered

---

## Phase 2: Multi-Router + Multi-User

**Status: PLANNED**

### Goal
Transform from single-user/single-router to a multi-user platform where each user self-registers and adds their own routers via chat.

### User Stories

**New user onboarding:**
```
User: /start
Bot:  Halo! Saya belum punya router MikroTik untuk akun Anda.
      Silakan kirim detail router:
      - Nama (bebas)
      - Host/domain
      - Port API (biasanya 8728)
      - Username
      - Password
```

**Add additional router:**
```
User: Tambah router baru: Kantor, host office.example.com, port 8728,
      user admin, pass rahasia
Bot:  🔄 Testing koneksi... ✅ Router "Kantor" ditambahkan.
```

**Cross-router operations:**
```
User: Bandingkan CPU semua router
Bot:  📊 UmmiNEW: 11% | Kantor: 5%
```

### New Files

#### `mikrotik_mcp/registry.py`

```python
class RouterRegistry:
    """Per-user router storage backed by JSON files.
    
    Storage: data/{user_id}.json
    Each user has isolated access to their own routers only.
    """
    
    def __init__(self, data_dir: str = "/app/data"):
        self.data_dir = data_dir
    
    def load_user(self, user_id: str) -> dict:
        """Load a user's router registry from disk."""
    
    def save_user(self, user_id: str, data: dict):
        """Persist a user's router registry to disk."""
    
    def add_router(self, user_id, name, host, port, username, password, label=""):
        """Register a router for this user. Test connection first."""
    
    def remove_router(self, user_id, name):
        """Remove a router from this user's registry."""
    
    def get_router(self, user_id, name) -> dict:
        """Get a specific router's connection details."""
    
    def list_routers(self, user_id) -> list[dict]:
        """List all routers for this user (without passwords)."""
    
    def set_default(self, user_id, name):
        """Set this user's default router."""
    
    def resolve(self, user_id, router_name=None) -> dict:
        """Resolve to connection details.
        router_name=None → default router
        router_name="all" → all routers
        """
    
    def has_routers(self, user_id) -> bool:
        """Check if user has any registered routers."""
```

### Modified Files

#### `mikrotik_mcp/server.py` — Major refactor

Changes:
- Import and use `RouterRegistry` instead of global env vars
- All existing tools get `user_id: str` + optional `router: str` params
- New tools: `list_routers`, `register_router`, `remove_router`, `set_default_router`, `test_connection`
- `connect_router()` takes credentials from registry instead of env

```python
# Before (Phase 1)
@mcp.tool()
def get_system_info() -> dict:
    rows = _query_path("/system/resource")
    ...

# After (Phase 2)
@mcp.tool()
def get_system_info(user_id: str, router: str = "") -> dict:
    """Get router system info. 
    Args:
        user_id: Telegram user ID (required)
        router: Router name. Empty = default router.
    """
    conn = registry.resolve(user_id, router or None)
    rows = _query_path("/system/resource", connection=conn)
    ...
```

#### `skills/mikrotik/SKILL.md` — Updated for multi-user

Add:
- User onboarding flow instructions
- `user_id` passing rules for all tool calls
- Multi-router command examples
- New tool documentation (register_router, etc.)

#### `config/config.json`

Remove `MIKROTIK_*` env vars from MCP server config:
```json
{
  "tools": {
    "mcpServers": {
      "mikrotik": {
        "command": "python",
        "args": ["/app/mikrotik_mcp/server.py"],
        "env": {
          "DATA_DIR": "/app/data"
        }
      }
    }
  }
}
```

#### `docker-compose.yml`

Add data volume:
```yaml
volumes:
  - nanobot-data:/root/.nanobot
  - ./data:/app/data           # Per-user router registries
```

#### `.env`

Remove:
```diff
- MIKROTIK_HOST=id30.tunnel.my.id
- MIKROTIK_PORT=12065
- MIKROTIK_USER=Ejen4li
- MIKROTIK_PASS=b0b0ypetir!
```

#### `.gitignore`

Add:
```
data/
```

### Migration from Phase 1

On first boot of Phase 2, if `MIKROTIK_*` env vars exist and `data/` is empty:
1. Create `data/86340875.json` (your Telegram user ID)
2. Seed with the existing router config
3. Log migration message

---

## Phase 3: Encrypted Credentials

**Status: PLANNED**

### Goal
Encrypt router passwords at rest.

### New File: `mikrotik_mcp/crypto.py`

```python
from cryptography.fernet import Fernet

class CredentialStore:
    def __init__(self, key_path: str = "/app/data/.master_key"):
        """Load or auto-generate encryption key."""
    
    def encrypt(self, plaintext: str) -> str:
        """Encrypt → base64 string for JSON storage."""
    
    def decrypt(self, ciphertext: str) -> str:
        """base64 string → decrypt → plaintext."""
```

### Changes to `registry.py`

```python
# Password stored as:
"password": {"encrypted": true, "value": "gAAAA...base64..."}

# Decrypted on-the-fly when connecting:
def get_router(self, user_id, name):
    router = self._load(user_id)["routers"][name]
    router["password"] = self.crypto.decrypt(router["password"]["value"])
    return router
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

## Phase 4: Write Confirmation

**Status: PLANNED**

### Goal
Ensure destructive operations require explicit user approval. Implemented via SKILL.md prompt engineering (no code changes).

### Changes to `skills/mikrotik/SKILL.md`

```markdown
## Safety Rules (MANDATORY — NEVER SKIP)

### Write operations — ALWAYS confirm first:
Before executing ANY of these tools, you MUST:
1. State EXACTLY what you will do and which router
2. Ask: "Lanjutkan? (ya/tidak)"
3. WAIT for user response
4. Only proceed if user says: ya, yes, ok, lanjut, proceed

Write tools:
- register_router, remove_router, set_default_router
- add_hotspot_user, remove_hotspot_user
- run_routeros_query

### Read operations — no confirmation needed:
- get_system_info, list_*, count_*, get_recent_logs
- list_routers, test_connection
```

---

## Phase 5: WhatsApp Channel

**Status: PLANNED**

### Goal
Add WhatsApp as alternative messaging channel alongside Telegram.

### Prerequisites
- Node.js ≥ 18 in Docker image
- WhatsApp account for QR scan

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

## Phase 6: Monitoring & Alerts

**Status: PLANNED**

### Goal
Proactive health monitoring via cron + heartbeat. Agent periodically checks routers and alerts users if something is wrong.

### 6a: Heartbeat Checks

Edit `HEARTBEAT.md` in workspace:
```markdown
## Periodic Tasks (every 30 minutes)
- [ ] For each user with registered routers, check connectivity
- [ ] If a router is unreachable, notify the user via Telegram
- [ ] If CPU > 80% or memory > 90%, warn the user
```

### 6b: Cron Scheduled Reports

User-initiated:
```
User: Setiap jam 8 pagi, kirim ringkasan semua router
Bot:  ✅ Jadwal dibuat: 08:00 setiap hari — laporan status router
```

Uses Nanobot's built-in cron system.

### 6c: Alert Conditions

| Condition | Severity | Action |
|-----------|----------|--------|
| Router unreachable | 🔴 Critical | Immediate notification |
| CPU > 80% sustained | 🟡 Warning | Notification |
| Memory > 90% | 🟡 Warning | Notification |
| Unexpected reboot | 🟠 Alert | Notification + show uptime |
| Client count spike | ℹ️ Info | Summary in daily report |

### New MCP Tool
```python
@mcp.tool()
def check_all_routers_health(user_id: str) -> list[dict]:
    """Check connectivity and basic health of all user's routers.
    Returns status, CPU, memory, uptime for each router."""
```

---

## Summary: What Changes Per Phase

| File | Ph.1 ✅ | Ph.2 | Ph.3 | Ph.4 | Ph.5 | Ph.6 |
|------|--------|------|------|------|------|------|
| `server.py` | ✅ | ✏️ Major | — | — | — | ✏️ |
| `registry.py` | — | ✨ New | ✏️ | — | — | — |
| `crypto.py` | — | — | ✨ New | — | — | — |
| `SKILL.md` | ✅ | ✏️ | — | ✏️ | — | ✏️ |
| `config.json` | ✅ | ✏️ | — | — | ✏️ | — |
| `Dockerfile` | ✅ | — | ✏️ | — | ✏️ | — |
| `docker-compose.yml` | ✅ | ✏️ | — | — | — | — |
| `.env` | ✅ | ✏️ | — | — | ✏️ | — |

Legend: ✅ exists, ✨ new file, ✏️ modified, — no change
