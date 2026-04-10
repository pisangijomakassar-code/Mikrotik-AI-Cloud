# Plan: Integrated Multi-Port Tunnel Service (Cloudflare + SSTP VPN)

## Status: PLANNED (2026-04-11)

## Context

MikroTik AI Agent SaaS butuh akses ke router user — bukan hanya API (8728), tapi juga **Winbox, SSH, WebFig, API-SSL** — up to **5 port/service** per router. Router umumnya di belakang NAT. Tunnel service di-bundle sebagai **paid addon per-router**.

**Dual-method tunneling:**
- **Cloudflare Tunnel** — untuk RouterOS 7+ (cloudflared via Docker container di router)
- **SSTP VPN** — untuk RouterOS 6 (native SSTP client, semua port otomatis accessible)

**5 MikroTik services yang di-tunnel:**

| Service | Port | Kegunaan |
|---------|------|----------|
| API | 8728 | MCP server connection (librouteros) |
| Winbox | 8291 | MikroTik management app |
| SSH | 22 | Terminal access |
| WebFig | 80 | Web management interface |
| API-SSL | 8729 | Encrypted API connection |

---

## Arsitektur Overview

```
METHOD 1: CLOUDFLARE TUNNEL (RouterOS 7+)
┌─────────────────────┐     ┌──────────┐     ┌─────────────────────────────────┐
│ MikroTik (ROS 7+)   │     │Cloudflare│     │ mikrotik-agent container        │
│                     │     │  Edge    │     │                                 │
│ cloudflared ────────┼─────►         ◄─────┤ tunnel_manager.py               │
│ (container)         │     │          │     │  cloudflared access tcp ×5      │
│                     │     └──────────┘     │  → 127.0.0.1:19001 (API)       │
│ Ports exposed:      │                      │  → 127.0.0.1:19002 (Winbox)    │
│  8728 (API)         │                      │  → 127.0.0.1:19003 (SSH)       │
│  8291 (Winbox)      │                      │  → 127.0.0.1:19004 (WebFig)    │
│  22   (SSH)         │                      │  → 127.0.0.1:19005 (API-SSL)   │
│  80   (WebFig)      │                      │         │                       │
│  8729 (API-SSL)     │                      │  MCP server → 127.0.0.1:19001  │
└─────────────────────┘                      │  Dashboard → proxy all ports    │
                                              └─────────────────────────────────┘

METHOD 2: SSTP VPN (RouterOS 6) — ALL PORTS AUTOMATIC
┌─────────────────────┐                      ┌─────────────────────────────────┐
│ MikroTik (ROS 6)    │                      │ VPS                             │
│                     │                      │                                 │
│ SSTP Client ────────┼── TCP 443 outbound ─►│ SSTP Server (SoftEther)         │
│ (native built-in)   │   VPN IP: 10.10.0.x │                                 │
│                     │                      │ MCP server → 10.10.0.x:8728    │
│ ALL ports accessible│◄── via VPN tunnel ───│ Winbox    → 10.10.0.x:8291     │
│ via VPN IP:         │                      │ SSH       → 10.10.0.x:22       │
│  :8728, :8291, :22  │                      │ WebFig    → 10.10.0.x:80       │
│  :80, :8729         │                      │ API-SSL   → 10.10.0.x:8729     │
└─────────────────────┘                      └─────────────────────────────────┘
```

**Key difference:**
- **Cloudflare**: Perlu 1 `cloudflared access tcp` listener per port (5 processes per tunnel). More resource but granular.
- **SSTP VPN**: Semua port otomatis accessible via VPN IP. Simpler, no per-port config.

---

## Phase 1: Database Schema + Types

### 1.1 Prisma Schema
**File:** `dashboard/prisma/schema.prisma`

```prisma
enum TunnelMethod {
  CLOUDFLARE
  SSTP
}

enum TunnelStatus {
  PENDING
  CONNECTED
  DISCONNECTED
  ERROR
}

enum ConnectionMethod {
  DIRECT
  TUNNEL
}

model Tunnel {
  id                    String       @id @default(cuid())
  method                TunnelMethod
  status                TunnelStatus @default(PENDING)

  // Cloudflare-specific
  cloudflareTunnelId    String?      @unique
  cloudflareTunnelToken String?      // encrypted

  // SSTP-specific
  vpnUsername           String?
  vpnPassword           String?      // encrypted
  vpnAssignedIp         String?      // e.g. 10.10.0.5

  // Common
  routerLanIp           String       @default("192.168.88.1")
  lastConnectedAt       DateTime?
  createdAt             DateTime     @default(now())
  updatedAt             DateTime     @updatedAt

  routerId String @unique
  router   Router @relation(fields: [routerId], references: [id], onDelete: Cascade)
  ports    TunnelPort[]

  @@index([status])
  @@index([method])
}

model TunnelPort {
  id          String  @id @default(cuid())
  serviceName String  // "api" | "winbox" | "ssh" | "webfig" | "api-ssl"
  remotePort  Int     // port on router: 8728, 8291, 22, 80, 8729
  localPort   Int?    // server-side proxy port (Cloudflare only, e.g. 19001)
  hostname    String? // CF tunnel hostname for this port (Cloudflare only)
  enabled     Boolean @default(true)

  tunnelId String
  tunnel   Tunnel @relation(fields: [tunnelId], references: [id], onDelete: Cascade)

  @@unique([tunnelId, serviceName])
  @@index([tunnelId])
}
```

**Modify Router model:**
```prisma
model Router {
  // ... existing fields ...
  connectionMethod ConnectionMethod @default(DIRECT)
  tunnel           Tunnel?
}
```

**Default ports created per tunnel:**

| serviceName | remotePort | Selalu aktif? |
|-------------|------------|---------------|
| api | 8728 | Ya (required untuk MCP) |
| winbox | 8291 | Ya (default) |
| ssh | 22 | Optional |
| webfig | 80 | Optional |
| api-ssl | 8729 | Optional |

User bisa enable/disable port mana saja lewat dashboard (max 5).

### 1.2 Types
**File:** `dashboard/lib/types/index.ts`
```typescript
interface TunnelPort {
  id: string
  serviceName: 'api' | 'winbox' | 'ssh' | 'webfig' | 'api-ssl'
  remotePort: number
  localPort: number | null
  hostname: string | null
  enabled: boolean
}

interface Tunnel {
  id: string
  method: 'CLOUDFLARE' | 'SSTP'
  status: 'PENDING' | 'CONNECTED' | 'DISCONNECTED' | 'ERROR'
  routerLanIp: string
  ports: TunnelPort[]
  // ... CF/SSTP specific fields
}
```

### 1.3 Environment Variables
**File:** `.env.example`
```env
# Cloudflare Tunnel
CLOUDFLARE_ACCOUNT_ID=
CLOUDFLARE_API_TOKEN=
CLOUDFLARE_TUNNEL_DOMAIN=      # e.g. tunnel.yourdomain.com
CLOUDFLARE_ZONE_ID=

# SSTP VPN Server
SSTP_SERVER_HOST=              # VPS public IP/hostname
SSTP_VPN_SUBNET=10.10.0.0/24
SSTP_ADMIN_PASSWORD=
```

---

## Phase 2: Cloudflare Tunnel Service

### 2.1 Cloudflare API Service
**File baru:** `dashboard/lib/services/cloudflare-tunnel.service.ts`

```typescript
// Create tunnel with multi-port ingress
async function createCloudflareTunnel(
  routerId: string,
  routerLanIp: string,
  enabledPorts: { serviceName: string; remotePort: number }[]
): Promise<{ tunnelId: string; token: string }>

// CF tunnel ingress config for multi-port:
// {
//   "ingress": [
//     { "hostname": "api-{routerId}.tunnel.domain.com",    "service": "tcp://192.168.88.1:8728" },
//     { "hostname": "winbox-{routerId}.tunnel.domain.com", "service": "tcp://192.168.88.1:8291" },
//     { "hostname": "ssh-{routerId}.tunnel.domain.com",    "service": "tcp://192.168.88.1:22" },
//     { "hostname": "webfig-{routerId}.tunnel.domain.com", "service": "tcp://192.168.88.1:80" },
//     { "hostname": "apissl-{routerId}.tunnel.domain.com", "service": "tcp://192.168.88.1:8729" },
//     { "service": "http_status:404" }
//   ]
// }

// Per port → create DNS CNAME: {service}-{routerId}.tunnel.domain.com → {uuid}.cfargotunnel.com
```

### 2.2 Server-Side Tunnel Manager
**File baru:** `mikrotik_mcp/tunnel_manager.py`

Background service yang mengelola `cloudflared access tcp` processes:

```python
# Per tunnel, per enabled port → 1 cloudflared access process
# Example: tunnel with 3 enabled ports = 3 processes:
#   cloudflared access tcp --hostname api-clx1.tunnel.domain.com --listener 127.0.0.1:19001
#   cloudflared access tcp --hostname winbox-clx1.tunnel.domain.com --listener 127.0.0.1:19002
#   cloudflared access tcp --hostname ssh-clx1.tunnel.domain.com --listener 127.0.0.1:19003

# Port allocation: base 19000, each tunnel gets block of 5
# Tunnel 1: 19000-19004, Tunnel 2: 19005-19009, etc.
# Stored in TunnelPort.localPort
```

Features:
1. Startup: query DB → start all processes for CONNECTED tunnels
2. Monitor subprocess health, auto-restart
3. Periodic CF API check → update TunnelStatus
4. New tunnel events: watch for new TunnelPort records → start process
5. HTTP health endpoint on `:8081`

### 2.3 cloudflared in Docker Image
**File:** `Dockerfile` — tambah:
```dockerfile
RUN ARCH=$(dpkg --print-architecture) && \
    curl -sSL "https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-${ARCH}" \
    -o /usr/local/bin/cloudflared && chmod +x /usr/local/bin/cloudflared
```

---

## Phase 3: SSTP VPN Server

### 3.1 Docker Service
**File:** `docker-compose.yml` — tambah:
```yaml
sstp-vpn:
  image: siomiz/softethervpn
  container_name: mikrotik-vpn
  restart: unless-stopped
  cap_add:
    - NET_ADMIN
  ports:
    - "443:443"    # SSTP
    - "5555:5555"  # SoftEther admin (internal only ideally)
  environment:
    SPW: ${SSTP_ADMIN_PASSWORD}
    HPW: ${SSTP_ADMIN_PASSWORD}
  volumes:
    - vpn-data:/usr/vpnserver
  networks:
    internal:
    vpn:
      ipv4_address: 10.10.0.1

# Add vpn network
networks:
  internal:
    driver: bridge
  vpn:
    driver: bridge
    ipam:
      config:
        - subnet: 10.10.0.0/24
          gateway: 10.10.0.1

# mikrotik-agent joins vpn network too
mikrotik-agent:
  networks:
    - internal
    - vpn
```

### 3.2 SSTP Management Service
**File baru:** `dashboard/lib/services/sstp-tunnel.service.ts`

```typescript
// VPN user management via SoftEther vpncmd or JSON-RPC
async function createSstpTunnel(routerId: string): Promise<{ username: string; password: string; vpnIp: string }>
async function deleteSstpTunnel(vpnUsername: string): Promise<void>
async function getSstpStatus(vpnUsername: string): Promise<TunnelStatus>
```

**SSTP advantage:** Once VPN connected, ALL router ports are accessible via `vpnIp:anyPort`. Tidak perlu TunnelPort.localPort — semua port langsung via VPN IP.

### 3.3 RouterOS 6 Config Generator
```routeros
/interface sstp-client add \
  name=tunnel-saas \
  connect-to=vpn.yourdomain.com:443 \
  user=rt-{routerId} \
  password={vpnPassword} \
  profile=default-encryption \
  disabled=no \
  comment="MikroTik AI Agent Tunnel"
```

---

## Phase 4: API Routes

### 4.1 Tunnel CRUD
**Files baru:**
- `dashboard/app/api/tunnels/route.ts` — GET: list user's tunnels
- `dashboard/app/api/tunnels/[routerId]/route.ts` — GET: detail + ports, DELETE: remove
- `dashboard/app/api/tunnels/[routerId]/status/route.ts` — GET: live status (CF API / SoftEther)
- `dashboard/app/api/tunnels/[routerId]/setup/route.ts` — GET: setup instructions + credentials
- `dashboard/app/api/tunnels/[routerId]/script/route.ts` — GET: RouterOS config script
- `dashboard/app/api/tunnels/[routerId]/ports/route.ts` — PATCH: enable/disable ports

### 4.2 Modify Router Creation
**File:** `dashboard/app/api/routers/route.ts`

POST handler support:
```json
{
  "name": "RouterKantor",
  "username": "admin",
  "password": "xxx",
  "connectionMethod": "TUNNEL",
  "tunnelMethod": "CLOUDFLARE",
  "routerLanIp": "192.168.88.1",
  "enabledPorts": ["api", "winbox", "ssh"]
}
```

Flow:
1. Create Router (connectionMethod=TUNNEL)
2. Create Tunnel + TunnelPort records
3. Call CF API / SoftEther sesuai method
4. Return setup instructions

### 4.3 Web Access Proxy Routes (for Winbox/SSH/WebFig from dashboard)
- `dashboard/app/api/tunnels/[routerId]/proxy/webfig/route.ts` — HTTP proxy ke WebFig
- WebSocket proxy untuk SSH terminal (via xterm.js) — future enhancement

---

## Phase 5: Registry + MCP Server Changes

### 5.1 Modify Registry
**File:** `mikrotik_mcp/registry_pg.py`

Modify `_all_routers()` SQL to JOIN Tunnel + TunnelPort:
```sql
SELECT r.*,
  r."connectionMethod" as connection_method,
  t."method" as tunnel_method,
  t."vpnAssignedIp" as tunnel_vpn_ip,
  t."status" as tunnel_status,
  tp."localPort" as tunnel_api_local_port
FROM "Router" r
LEFT JOIN "Tunnel" t ON t."routerId" = r.id
LEFT JOIN "TunnelPort" tp ON tp."tunnelId" = t.id AND tp."serviceName" = 'api'
WHERE r."userId" = %s
```

Modify `_router_to_connection()`:
```python
def _router_to_connection(self, r: dict) -> dict:
    host = r["host"]
    port = r["port"]

    if r.get("connection_method") == "TUNNEL":
        method = r.get("tunnel_method")
        if method == "CLOUDFLARE" and r.get("tunnel_api_local_port"):
            host = "127.0.0.1"
            port = r["tunnel_api_local_port"]
        elif method == "SSTP" and r.get("tunnel_vpn_ip"):
            host = r["tunnel_vpn_ip"]
            port = 8728

    return {"name": r["name"], "host": host, "port": port, ...}
```

### 5.2 Entrypoint
**File:** `entrypoint.sh` — tambah:
```bash
python3 /app/mikrotik_mcp/tunnel_manager.py &
```

---

## Phase 6: Dashboard UI

### 6.1 Enhanced Add Router Dialog
**File:** `dashboard/components/add-router-dialog.tsx` — multi-step wizard

**Step 1:** Connection method selector
- "Direct Connection" — punya public IP
- "Cloudflare Tunnel (RouterOS 7+)" — Docker container
- "VPN Tunnel / SSTP (RouterOS 6)" — native

**Step 2 (Direct):** host, port, username, password (unchanged)

**Step 2 (Tunnel):**
- Router name, username, password
- Router LAN IP (default 192.168.88.1)
- Port selection checkboxes:
  - [x] API (8728) — always on, required
  - [x] Winbox (8291) — default on
  - [ ] SSH (22)
  - [ ] WebFig (80)
  - [ ] API-SSL (8729)

**Step 3:** → Tunnel Setup Wizard

### 6.2 Tunnel Setup Wizard
**File baru:** `dashboard/components/tunnel-setup-wizard.tsx`

Shows setup instructions based on method:

**Cloudflare (ROS 7+):**
```
1. SSH ke router, enable container package
2. Jalankan command:
   /container add remote-image=cloudflare/cloudflared:latest \
     cmd="tunnel run --token eyJhIj..." interface=veth1 logging=yes

Status: ● Menunggu koneksi... [Refresh]

Setelah connected, port berikut akan aktif:
  ✅ API (8728)     — untuk AI Agent
  ✅ Winbox (8291)  — untuk management  
  ✅ SSH (22)       — untuk terminal
```

**SSTP (ROS 6):**
```
1. Buka terminal MikroTik (Winbox/WebFig)
2. Paste script:
   /interface sstp-client add name=tunnel-saas \
     connect-to=vpn.domain.com:443 user=rt-xxx password=yyy \
     profile=default-encryption disabled=no

Status: ● Menunggu koneksi... [Refresh]

Setelah connected, SEMUA port router accessible:
  ✅ API, Winbox, SSH, WebFig, API-SSL
```

### 6.3 Tunnel Status + Port Info
**File baru:** `dashboard/components/tunnel-status-badge.tsx`
**File baru:** `dashboard/components/tunnel-port-list.tsx`

Komponen yang menampilkan:
- Overall tunnel status (connected/pending/disconnected)
- Per-port status dan connection info
- Untuk Cloudflare: "Winbox: connect ke api-xxx.tunnel.domain.com via cloudflared access"
- Untuk SSTP: "Winbox: 10.10.0.5:8291 (via VPN)"

### 6.4 Router Grid Enhancement
**File:** `dashboard/components/router-grid.tsx`

Tambah tunnel badge + port count indicator: "3/5 ports tunneled"

### 6.5 React Query Hooks
**File baru:** `dashboard/hooks/use-tunnels.ts`
- `useTunnelStatus(routerId)` — poll status + ports
- `useTunnelSetup(routerId)` — setup instructions
- `useCreateTunnel()`, `useDeleteTunnel()`, `useUpdateTunnelPorts()`

---

## Phase 7: Scripts + Config

### 7.1 Cloudflare — RouterOS 7 Container Script
**File baru:** `scripts/cloudflared-ros7.rsc` (template, token injected via API)
```routeros
# Enable container mode (requires reboot if first time)
/system/device-mode/update container=yes

# Create veth interface for container
/interface/veth add name=veth-tunnel address=172.17.0.2/24 gateway=172.17.0.1

# Add container
/container add remote-image=cloudflare/cloudflared:latest \
  interface=veth-tunnel \
  cmd="tunnel run --token __TOKEN__" \
  logging=yes \
  comment="MikroTik AI Agent Tunnel"

# Start container
/container start 0
```

### 7.2 SSTP — RouterOS 6 Config Script
**File baru:** `scripts/sstp-ros6.rsc` (template)
```routeros
/interface sstp-client add \
  name=tunnel-saas \
  connect-to=__VPN_HOST__:443 \
  user=__VPN_USER__ \
  password=__VPN_PASS__ \
  profile=default-encryption \
  disabled=no \
  comment="MikroTik AI Agent Tunnel"
```

### 7.3 Companion Device Fallback (Raspberry Pi)
**File baru:** `scripts/install-cloudflared.sh`

Bash script: detect arch → install cloudflared → setup systemd → start. Untuk user yang prefer companion device.

---

## File Summary

| Action | File | Phase |
|--------|------|-------|
| MODIFY | `dashboard/prisma/schema.prisma` | 1 |
| MODIFY | `.env.example` | 1 |
| MODIFY | `dashboard/lib/types/index.ts` | 1 |
| CREATE | `dashboard/lib/services/cloudflare-tunnel.service.ts` | 2 |
| CREATE | `mikrotik_mcp/tunnel_manager.py` | 2 |
| MODIFY | `Dockerfile` | 2 |
| MODIFY | `docker-compose.yml` | 3 |
| CREATE | `dashboard/lib/services/sstp-tunnel.service.ts` | 3 |
| CREATE | `dashboard/app/api/tunnels/route.ts` | 4 |
| CREATE | `dashboard/app/api/tunnels/[routerId]/route.ts` | 4 |
| CREATE | `dashboard/app/api/tunnels/[routerId]/status/route.ts` | 4 |
| CREATE | `dashboard/app/api/tunnels/[routerId]/setup/route.ts` | 4 |
| CREATE | `dashboard/app/api/tunnels/[routerId]/script/route.ts` | 4 |
| CREATE | `dashboard/app/api/tunnels/[routerId]/ports/route.ts` | 4 |
| MODIFY | `dashboard/app/api/routers/route.ts` | 4 |
| MODIFY | `mikrotik_mcp/registry_pg.py` | 5 |
| MODIFY | `entrypoint.sh` | 5 |
| MODIFY | `dashboard/components/add-router-dialog.tsx` | 6 |
| CREATE | `dashboard/components/tunnel-setup-wizard.tsx` | 6 |
| CREATE | `dashboard/components/tunnel-status-badge.tsx` | 6 |
| CREATE | `dashboard/components/tunnel-port-list.tsx` | 6 |
| MODIFY | `dashboard/components/router-grid.tsx` | 6 |
| CREATE | `dashboard/hooks/use-tunnels.ts` | 6 |
| CREATE | `scripts/cloudflared-ros7.rsc` | 7 |
| CREATE | `scripts/sstp-ros6.rsc` | 7 |
| CREATE | `scripts/install-cloudflared.sh` | 7 |

---

## Existing Code to Reuse

| Pattern | File | Reuse |
|---------|------|-------|
| psycopg2 DB access | `mikrotik_mcp/registry_pg.py` | tunnel_manager.py queries |
| Fernet encryption | `mikrotik_mcp/crypto.py` | encrypt tokens/passwords |
| Health server bg process | `mikrotik_mcp/health_server.py` | tunnel_manager pattern |
| API route proxy | `dashboard/app/api/routers/health/route.ts` | tunnel API routes |
| React Query hooks | `dashboard/hooks/use-routers.ts` | use-tunnels.ts |
| Add router dialog | `dashboard/components/add-router-dialog.tsx` | wizard base |

---

## Analisa Scalability & Worth Assessment

### Resource Usage Per Method

**Cloudflare Tunnel — Server-side cost per router:**
- Setiap port yang di-tunnel butuh 1 `cloudflared access tcp` process
- Per process: ~15-30MB RAM, minimal CPU (idle mostly)
- 1 router × 3 ports = 3 processes = ~60-90MB RAM
- 1 router × 5 ports = 5 processes = ~100-150MB RAM

**SSTP VPN — Server-side cost per router:**
- SoftEther handles semua VPN session dalam 1 process
- Per VPN session: ~1-2MB RAM overhead
- 1 router = 1 VPN session = ~2MB RAM
- Semua port otomatis accessible tanpa extra process

### Proyeksi Scalability

| Jumlah Router | Cloudflare (3 port/router) | SSTP VPN | RAM VPS Total |
|---------------|---------------------------|----------|---------------|
| 10 routers | 30 processes, ~450MB | 10 sessions, ~20MB | ~500MB |
| 50 routers | 150 processes, ~2.5GB | 50 sessions, ~100MB | ~2.6GB |
| 100 routers | 300 processes, ~4.5GB | 100 sessions, ~200MB | ~4.7GB |
| 500 routers | 1500 processes, ~22GB | 500 sessions, ~1GB | ~23GB |
| 1000 routers | 3000 processes, ~45GB ⚠️ | 1000 sessions, ~2GB | ~47GB ⚠️ |

### Cloudflare API Limits

| Resource | Free Tier Limit | Impact |
|----------|----------------|--------|
| Tunnels per account | ~1000 | Max ~1000 routers per CF account |
| DNS records per zone | 3500 | 1000 routers × 3 ports = 3000 records (OK) |
| API rate limit | 1200 req/5min | Status polling perlu di-throttle |

### Bottleneck Analysis

**< 100 routers (Small ISP, early stage):**
- Kedua method viable
- VPS 4GB RAM cukup untuk Cloudflare + SSTP campuran
- **Verdict: Worth it ✅** — biaya rendah, nilai tinggi

**100-500 routers (Medium scale):**
- Cloudflare mulai berat (2.5-22GB RAM untuk processes)
- SSTP tetap ringan (~100MB-1GB)
- **Rekomendasi:** Encourage user pakai SSTP, limit Cloudflare port ke 2-3
- **Verdict: Worth it ✅** — tapi butuh VPS lebih besar (8-16GB)

**500-1000+ routers (Large scale):**
- Cloudflare approach TIDAK scalable tanpa arsitektur baru
- SSTP tetap viable (SoftEther tested untuk 1000+ concurrent)
- **Opsi mitigasi:**
  - Shard: multiple VPS, distribute tunnels
  - Limit Cloudflare: hanya port API, sisanya harus SSTP
  - Switch ke Cloudflare WARP routing (arsitektur berbeda, future)
- **Verdict: Perlu re-architect Cloudflare ⚠️, SSTP masih OK ✅**

### Cost Analysis (VPS)

| Scale | VPS Spec Needed | Estimated Cost/month |
|-------|----------------|---------------------|
| 10 routers | 2 vCPU, 2GB RAM | ~$10-15 |
| 50 routers | 2 vCPU, 4GB RAM | ~$20-30 |
| 100 routers | 4 vCPU, 8GB RAM | ~$40-60 |
| 500 routers | 8 vCPU, 32GB RAM | ~$100-200 |

### Revenue Projection (jika addon Rp 25.000-50.000/router/bulan)

| Scale | Revenue/month | VPS Cost | Profit Margin |
|-------|--------------|----------|---------------|
| 10 routers | Rp 250K-500K | ~Rp 200K | ~50-60% |
| 50 routers | Rp 1.25M-2.5M | ~Rp 400K | ~70-85% |
| 100 routers | Rp 2.5M-5M | ~Rp 800K | ~70-85% |
| 500 routers | Rp 12.5M-25M | ~Rp 2.5M | ~80-90% |

### Kesimpulan Worth Assessment

**Worth it? YES ✅** dengan catatan:

1. **Revenue per router tinggi** — biaya tunnel (Cloudflare gratis, SSTP server ~$0.2/router) jauh di bawah pricing addon. Margin 70-90%.

2. **Competitive advantage** — Kompetitor (MikBotAM, Mikhmon) tidak provide tunneling. Ini differentiator kuat.

3. **Scalability strategy:**
   - Phase 1 (0-100 routers): Single VPS, mix Cloudflare + SSTP
   - Phase 2 (100-500): Favor SSTP, Cloudflare limit 2 ports
   - Phase 3 (500+): Multiple VPS sharding, SSTP primary

4. **SSTP lebih scalable** tapi Cloudflare lebih "premium feel" — keduanya punya tempat di product lineup.

5. **Risk mitigation:** Cloudflare gratis tapi bisa change terms. SSTP self-hosted = full control. Dual-method = resilient.

---

## Verification

1. **Schema:** `npx prisma migrate dev` sukses, Tunnel + TunnelPort tables exist
2. **Cloudflare multi-port flow:**
   - Add router (Cloudflare, 3 ports: api+winbox+ssh)
   - RouterOS 7: paste container script → cloudflared running
   - Dashboard: status CONNECTED, 3 ports active
   - MCP: `librouteros.connect("127.0.0.1", 19001)` sukses
   - Winbox: accessible via tunnel hostname
   - SSH: accessible via tunnel hostname
3. **SSTP multi-port flow:**
   - Add router (SSTP)
   - RouterOS 6: paste SSTP client config → VPN connected
   - Dashboard: status CONNECTED, all 5 ports accessible
   - MCP: `librouteros.connect("10.10.0.x", 8728)` sukses
   - Winbox: `10.10.0.x:8291` accessible
   - SSH: `10.10.0.x:22` accessible
4. **Port management:** Enable/disable ports → processes start/stop correctly
5. **Cleanup:** Delete router → tunnel + DNS/VPN user + all ports cleaned up
6. **Resilience:** cloudflared/VPN offline → DISCONNECTED → reconnect → auto-recovery
7. **Max ports:** Cannot enable > 5 ports (validated)
8. **Concurrent:** Multiple users, multiple routers, mixed methods — all work
9. **Docker:** `docker compose up` → all services healthy (postgres, dashboard, agent, sstp-vpn)
