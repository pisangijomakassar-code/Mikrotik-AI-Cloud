# Remote Client Troubleshooting

Fitur untuk melakukan troubleshooting **laptop/PC client** dari jarak jauh lewat
AI agent (Telegram) — alternatif TeamViewer/AnyDesk yang **berbasis tool** dan
ke-audit, bukan screen-sharing visual.

## Kenapa bukan TeamViewer langsung?

Claude/LLM agent berbasis **teks & tool** — tidak punya "mata" untuk melihat
layar GUI maupun mouse/keyboard virtual. TeamViewer/AnyDesk justru sebaliknya:
tool visual untuk manusia. Jadi LLM tidak bisa menyetir sesi TeamViewer.

Solusinya: agent kecil di laptop client yang mengekspos **tool diagnostik**
(cek koneksi, ping, DNS, routing, service) dan connect balik ke cloud secara
outbound (nembus NAT, seperti cara TeamViewer connect). AI memanggil tool-tool
itu untuk mendiagnosa.

## Arsitektur

```
┌─────────────────┐   outbound HTTPS    ┌──────────────────────┐   HTTP localhost   ┌───────────────┐
│  Laptop Client  │ ──register/poll───► │ health_server :8080   │ ◄── client_* tools │  MCP server   │
│  agent.py       │ ◄──perintah──────── │ client_agent_relay.py │                    │  (server.py)  │
│  (allowlist)    │ ──hasil eksekusi──► │ (antrian in-memory)   │                    │  AI/Telegram  │
└─────────────────┘                     └──────────────────────┘                    └───────────────┘
```

Komponen:

| Berkas | Peran |
|---|---|
| `client_agent/agent.py` | Agent di laptop client. Long-poll, jalankan perintah allowlist, kirim hasil. |
| `mikrotik_mcp/client_agent_relay.py` | Relay in-memory di proses `health_server`: registry device + antrian perintah + sinkronisasi hasil. |
| `mikrotik_mcp/health_server.py` | Endpoint HTTP `/client-agent/*` (register, poll, result, devices, command). |
| `mikrotik_mcp/server.py` | MCP tools `list_client_devices`, `client_*` — thin HTTP client ke `:8080`. |

Catatan proses: `health_server` (port 8080) dan MCP server (`server.py`, stdio di
proses nanobot) adalah **proses terpisah**. Karena itu relay state hidup di
`health_server`, dan MCP tools mengaksesnya via HTTP localhost — pola yang sama
dipakai dashboard.

## Alur perintah

1. AI agent memanggil tool, mis. `client_connectivity_check(user_id, device)`.
2. MCP tool `POST http://127.0.0.1:8080/client-agent/command` (header
   `X-Agent-Token`).
3. Relay meng-enqueue perintah ke antrian device tsb, lalu **blok menunggu**
   hasil (default 45s).
4. Agent client (sedang long-poll) menerima perintah, memvalidasi terhadap
   allowlist, menjalankannya tanpa shell, lalu `POST /client-agent/result`.
5. Relay membangunkan caller, hasil dikembalikan ke MCP tool → AI → user.

## Endpoint HTTP (`health_server` :8080)

| Method & Path | Pemanggil | Keterangan |
|---|---|---|
| `POST /client-agent/register` | agent client | Daftar/refresh device. Body: `{token, userId, hostname, os, ...}` |
| `GET /client-agent/poll/<token>?wait=25` | agent client | Long-poll perintah berikutnya |
| `POST /client-agent/result` | agent client | Kirim hasil. Body: `{commandId, result}` |
| `GET /client-agent/devices/<user_id>` | dashboard/MCP | List device online milik user |
| `POST /client-agent/command` | MCP server (internal) | Enqueue + tunggu hasil. **Wajib `X-Agent-Token`** |

## Model keamanan

- **Device token** = rahasia per-device, dibagikan operator saat instalasi.
  Saat register, device mengklaim `user_id` pemiliknya; MCP tools hanya melihat &
  memerintah device dengan `user_id` cocok.
- **Endpoint internal** `/client-agent/command` dilindungi `X-Agent-Token`
  (env `AGENT_TOKEN`), sama seperti endpoint sensitif lain di health_server.
- **Allowlist di sisi client** adalah otoritas final: walau cloud dikompromi,
  agent hanya menjalankan diagnostik yang diizinkan. Argumen `host`/`service`
  divalidasi ketat, subprocess tanpa shell (anti command injection).
- **Default read-only.** Aksi yang mengubah state (`flush_dns`, `renew_dhcp`,
  `restart_service`) hanya aktif dengan `--allow-actions`, dan di layer SKILL
  ditandai wajib konfirmasi (single/double).

## Keterbatasan & catatan operasional

- Relay bersifat **in-memory** — jika `health_server` restart, koneksi device
  hilang tetapi agent otomatis re-register pada poll berikutnya (self-healing).
- Device dianggap **offline** bila tidak poll/register dalam 90 detik.
- Untuk produksi skala besar, relay bisa dipindah ke DB/Redis agar tahan restart
  dan multi-instance — lihat `client_agent_relay.py` (titik ekstensi jelas).

## Setup singkat di laptop client

Lihat `client_agent/README.md` untuk detail (systemd / Task Scheduler).

```bash
python3 client_agent/agent.py \
  --cloud-url https://agent.domain-anda.com \
  --token <DEVICE_TOKEN> \
  --user-id <TELEGRAM_USER_ID>
```
