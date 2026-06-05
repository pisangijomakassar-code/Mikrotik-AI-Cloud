# Handoff — Remote Client Troubleshooting

Catatan konteks untuk melanjutkan pekerjaan fitur **remote troubleshooting laptop
client** di sesi berikutnya.

- **Branch:** `claude/remote-troubleshooting-teamviewer-e1iWa`
- **PR:** #1 (draft) — https://github.com/pisangijomakassar-code/Mikrotik-AI-Cloud/pull/1
- **Status:** ✅ implementasi inti selesai, semua test lulus, sudah di-push.

## Apa & kenapa

TeamViewer/AnyDesk **tidak bisa** dipakai langsung sebagai perantara Claude/LLM
(berbasis teks & tool, gak punya "mata" buat GUI). Solusinya: agent kecil di
laptop client yang connect **outbound** ke cloud (nembus NAT seperti TeamViewer)
dan mengekspos **tool diagnostik** yang dipanggil AI agent (Telegram).

Keputusan user: **Opsi B (agent MCP custom)**, **AI otomatis**, cross-platform.
Untuk visibilitas: **console terminal** + **mode approval** (klien setujui tiap
perintah).

## Arsitektur

```
Laptop client ──outbound HTTPS──► health_server :8080 ◄──HTTP localhost── MCP tools (server.py)
 client_agent/agent.py            client_agent_relay.py        dipanggil AI (Telegram)
```

health_server (8080) & MCP server (server.py, stdio) = **proses terpisah**, jadi
relay state hidup di health_server; MCP tools akses via HTTP localhost.

## Berkas yang dibuat/diubah

| Berkas | Status | Isi |
|---|---|---|
| `client_agent/agent.py` | baru | Agent laptop client (cross-platform). Long-poll, allowlist tanpa shell, **console feed + gerbang approval**, default read-only. |
| `client_agent/README.md` | baru | Panduan instalasi (systemd/Task Scheduler), penjelasan approval. |
| `mikrotik_mcp/client_agent_relay.py` | baru | Relay in-memory: registry device + antrian + sinkronisasi hasil + `reason`. |
| `mikrotik_mcp/health_server.py` | diubah | Endpoint `/client-agent/{register,poll,result,devices,command}`. |
| `mikrotik_mcp/server.py` | diubah | 14 MCP tools `list_client_devices` + `client_*` (semua punya param `reason`). |
| `skills/mikrotik/SKILL.md` | diubah | Dok tools + aturan konfirmasi + wajib `reason` + anti-halu. |
| `docs/REMOTE_CLIENT_TROUBLESHOOTING.md` | baru | Arsitektur, endpoint, keamanan, transparansi/approval. |

## Keamanan / guardrail

- Allowlist di **sisi client** = otoritas final (cloud dikompromi pun aman).
- Argumen host/service divalidasi (anti command injection); subprocess tanpa shell.
- Device token rahasia per-device; MCP hanya lihat/perintah device dgn user_id cocok.
- Endpoint internal `/client-agent/command` dilindungi `X-Agent-Token` (`AGENT_TOKEN`).
- Default **read-only**; aksi state-changing butuh `--allow-actions`.
- **Approval default ON**: tiap perintah disetujui klien (`y`); timeout/non-TTY →
  auto-tolak; pre-typed input dibuang. Penolakan → `{denied:true}` ke AI.
- SKILL melarang AI mengklaim hasil palsu (anti-halu).

## Test (semua lulus, dijalankan tanpa stack penuh)

- py_compile semua berkas.
- Unit relay: enqueue/poll/submit lintas thread, isolasi user, timeout, device ambigu.
- Executor agent: allowlist, gating aksi, **injection diblokir**, action tak dikenal ditolak.
- End-to-end: `agent.py` asli (subprocess) ↔ relay ↔ kontrak MCP.
- Approval: y=jalan, n=tolak, timeout→auto-tolak, non-TTY→auto-tolak, pre-typed dibuang.

Catatan: `librouteros` & `mcp` tidak terpasang di sandbox, jadi `health_server`
penuh belum di-import-run; endpoint diuji via server HTTP mini yang memetakan
route ke relay (kontrak wire identik).

## TODO / langkah lanjut (belum dikerjakan)

1. **UI dashboard**: generate device token + lihat device online (sekarang manual).
   Kemungkinan butuh tabel `ClientDevice` di Prisma + halaman Next.js.
2. **Approval via Telegram**: tombol approve di Telegram biar klien gak harus di
   depan laptop (alternatif console).
3. **Persistensi relay**: saat ini in-memory (self-healing via re-register). Untuk
   skala besar / multi-instance, pindah ke DB/Redis — titik ekstensi jelas di
   `client_agent_relay.py`.
4. **Integrasi entrypoint/Docker**: relay sudah otomatis aktif via health_server
   (tidak perlu proses tambahan). Pastikan `AGENT_TOKEN` di-set di env produksi.
5. **Pantau PR #1**: belum di-subscribe untuk auto-respond review/CI.

## Cara resume cepat

```bash
git checkout claude/remote-troubleshooting-teamviewer-e1iWa
git pull origin claude/remote-troubleshooting-teamviewer-e1iWa
# lihat PR #1 untuk konteks lengkap
```
