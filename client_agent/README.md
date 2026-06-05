# Client Troubleshooting Agent

Agent kecil yang dijalankan di **laptop/PC client** supaya AI agent (lewat
Telegram) bisa melakukan **remote troubleshooting** — niru cara TeamViewer
nembus NAT, tapi berbasis tool diagnostik yang ke-audit, bukan screen-sharing.

## Kenapa begini (bukan TeamViewer)?

- **Client gak perlu buka port.** Agent yang nelpon keluar (outbound HTTPS),
  jadi aman lewat NAT/firewall — sama seperti cara TeamViewer connect.
- **AI yang ngerjain, bukan manusia melototin layar.** Cocok untuk diagnosa
  otomatis: cek koneksi, ping, DNS, routing, service, dll.
- **Aman & terbatas.** Agent cuma menjalankan perintah dari _allowlist_. Walau
  sisi cloud dikompromi, agent gak akan menjalankan perintah sembarangan.

## Cara kerja

```
Laptop client                     Cloud (health_server :8080)        AI agent
  agent.py  ──register──────────►  /client-agent/register
  agent.py  ──long-poll─────────►  /client-agent/poll/<token>   ◄── client_* tools
  agent.py  ──hasil eksekusi────►  /client-agent/result              (server.py)
```

1. Agent register + long-poll ke cloud (outbound).
2. AI agent memanggil tool `client_*` → cloud antrekan perintah.
3. Agent ambil perintah, validasi terhadap allowlist, jalankan, kirim balik hasil.

## Instalasi

Butuh **Python 3.9+** (tidak butuh dependency eksternal — pakai stdlib saja).

```bash
python3 agent.py \
  --cloud-url https://agent.domain-anda.com \
  --token     <DEVICE_TOKEN_RAHASIA> \
  --user-id   86340875
```

Atau lewat environment variable: `CLOUD_URL`, `DEVICE_TOKEN`, `USER_ID`,
`ALLOW_ACTIONS=1`.

| Argumen | Wajib | Keterangan |
|---|---|---|
| `--cloud-url` | ✅ | URL health_server cloud (mis. `https://agent.domain.com`) |
| `--token` | ✅ | Device token rahasia, dibagikan operator per device |
| `--user-id` | ✅ | Telegram user ID pemilik device |
| `--allow-actions` | — | Izinkan aksi yang mengubah state (default: **read-only**) |
| `--poll-wait` | — | Durasi long-poll, detik (default 25) |

### Jalan sebagai service

**Linux (systemd)** — `/etc/systemd/system/troubleshoot-agent.service`:

```ini
[Unit]
Description=Client Troubleshooting Agent
After=network-online.target

[Service]
ExecStart=/usr/bin/python3 /opt/troubleshoot-agent/agent.py
Environment=CLOUD_URL=https://agent.domain-anda.com
Environment=DEVICE_TOKEN=ganti-dengan-token-rahasia
Environment=USER_ID=86340875
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
```

```bash
sudo systemctl enable --now troubleshoot-agent
```

**Windows** — daftarkan via Task Scheduler (trigger: At startup) atau jalankan
`pythonw.exe agent.py ...` lewat shortcut di folder Startup.

## Allowlist perintah

**Read-only (selalu aktif):**
`system_info`, `network_config`, `connectivity_check`, `ping`, `traceroute`,
`dns_lookup`, `route_table`, `arp_table`, `list_processes`, `service_status`,
`netstat`.

**Mengubah state (hanya dengan `--allow-actions`):**
`flush_dns`, `renew_dhcp`, `restart_service`.

Semua perintah dijalankan **tanpa shell** (arg list) dan argumen `host`/`service`
divalidasi ketat (anti command injection). Tidak ada eksekusi perintah arbitrer.

## Keamanan

- `--token` adalah **rahasia per-device**. Jangan commit / sebar. Siapa pun yang
  punya token + tahu URL cloud bisa mengaku sebagai device itu.
- Default **read-only**. Aktifkan `--allow-actions` hanya bila perlu.
- Agent tidak pernah membuka port; semua koneksi outbound.
- Disarankan jalankan dengan user non-admin bila memungkinkan (beberapa aksi
  seperti restart service butuh privilege lebih tinggi).
