# MikroTik AI Agent -- User Guide

Complete guide for managing your MikroTik routers through the Telegram bot using natural language.

---

## Table of Contents

- [Getting Started](#getting-started)
  - [Accessing the Bot](#accessing-the-bot)
  - [First-Time Setup](#first-time-setup)
  - [Understanding Responses](#understanding-responses)
- [Router Management](#router-management)
  - [Adding a Router](#adding-a-router)
  - [Adding Multiple Routers](#adding-multiple-routers)
  - [Setting a Default Router](#setting-a-default-router)
  - [Removing a Router](#removing-a-router)
  - [Listing Your Routers](#listing-your-routers)
- [Daily Operations](#daily-operations)
  - [System Status](#system-status)
  - [Monitoring Clients](#monitoring-clients)
  - [Interfaces and Traffic](#interfaces-and-traffic)
  - [Firewall Rules](#firewall-rules)
  - [Viewing Logs](#viewing-logs)
  - [Health Check Across All Routers](#health-check-across-all-routers)
- [Hotspot Management](#hotspot-management)
  - [Viewing Hotspot Users and Profiles](#viewing-hotspot-users-and-profiles)
  - [Creating Individual Hotspot Users](#creating-individual-hotspot-users)
  - [Generating Bulk Vouchers](#generating-bulk-vouchers)
  - [Managing User Profiles](#managing-user-profiles)
  - [Enabling and Disabling Users](#enabling-and-disabling-users)
  - [Searching for Users](#searching-for-users)
  - [Bulk Operations](#bulk-operations)
  - [Cleaning Up Expired and Disabled Users](#cleaning-up-expired-and-disabled-users)
  - [Viewing Voucher Statistics](#viewing-voucher-statistics)
- [PPP/VPN Management](#pppvpn-management)
  - [Viewing PPP Users and Connections](#viewing-ppp-users-and-connections)
  - [Adding and Removing PPP Secrets](#adding-and-removing-ppp-secrets)
  - [Kicking Active Sessions](#kicking-active-sessions)
- [Firewall Management](#firewall-management)
  - [Viewing Rules](#viewing-rules)
  - [Adding and Removing Filter Rules](#adding-and-removing-filter-rules)
  - [NAT Rules](#nat-rules)
  - [Enabling and Disabling Rules](#enabling-and-disabling-rules)
  - [Address Lists](#address-lists)
- [Queue and Bandwidth Management](#queue-and-bandwidth-management)
  - [Viewing Queues](#viewing-queues)
  - [Adding and Removing Bandwidth Limits](#adding-and-removing-bandwidth-limits)
  - [Queue Tree](#queue-tree)
- [Advanced Features](#advanced-features)
  - [Raw RouterOS API Queries](#raw-routeros-api-queries)
  - [Cross-Router Health Check](#cross-router-health-check)
  - [Router Backup](#router-backup)
  - [Scheduled Tasks](#scheduled-tasks)
  - [DNS Management](#dns-management)
  - [Static Routes](#static-routes)
- [Tips and Tricks](#tips-and-tricks)
  - [Common Commands Cheat Sheet](#common-commands-cheat-sheet)
  - [Best Practices](#best-practices)
  - [Troubleshooting](#troubleshooting)

---

## Getting Started

### Accessing the Bot

The MikroTik AI Agent is a Telegram bot. To access it:

1. **Get access from the admin.** This is a paid service. After payment, the admin will provision your Telegram account.
2. **Find the bot on Telegram.** Search for the bot username provided by the admin (e.g., `@MikrotikAgentBot`).
3. **Start a conversation.** Send `/start` or any message to begin.

You must be using the Telegram account associated with the numeric user ID that the admin provisioned. Unauthorized users cannot interact with the bot.

### First-Time Setup

When you message the bot for the first time, it will detect that you have no routers registered and guide you through adding one.

**What you need:**
- A friendly name for your router (e.g., "Kantor", "Warnet", "RumahUtama")
- The router's hostname or IP address (e.g., `192.168.1.1` or `router.example.com`)
- The RouterOS API port (default: `8728`)
- A RouterOS username with API access
- The password for that username

**Example first interaction:**

```
You:   /start

Bot:   Halo! Gue asisten MikroTik lo.
       Belum ada router yang terdaftar nih.
       Kirim detail router: nama, host, port, username, password.

You:   Nama: Kantor
       Host: 192.168.1.1
       Port: 8728
       User: admin
       Pass: rahasia123

Bot:   Router Kantor ditambahkan, hEX v6.49.8, uptime 6j48m
```

The bot will test the connection before saving. If it fails, you will receive an error message with details.

**Important:** Make sure RouterOS API access is enabled on your router. In Winbox, go to **IP > Services** and ensure the `api` service is enabled on port `8728`.

### Understanding Responses

The bot communicates in casual Indonesian by default. If you write in English, it replies in English.

**Responses are short and data-focused:**
```
📊 Kantor
• Board: `hEX` · v`6.49.8`
• CPU: `11%` · RAM: `211/256 MB`
• Uptime: `6j 48m`
```

**Write operations always require confirmation:**
```
You:   hapus user hotspot tamu
Bot:   mau hapus user hotspot 'tamu' di Kantor? (ya/tidak)
You:   ya
Bot:   user hotspot 'tamu' udah dihapus
```

Dangerous operations (reboot, raw API queries, running scripts) require **double confirmation**.

---

## Router Management

### Adding a Router

Send the router details to the bot in any format. The bot understands natural language.

**Examples:**
```
tambah router Warnet, host warnet.tunnel.my.id, port 8728, user admin, pass secret123
```
```
register router baru:
nama: CafeWifi
host: 10.0.0.1
port: 8728
username: api_user
password: mypassword
```

The bot will:
1. Ask you to confirm the details.
2. Test the connection to the router.
3. Save the router if the connection succeeds.
4. Report the board name, RouterOS version, and identity.

Your first router automatically becomes the **default router** -- all commands target it unless you specify otherwise.

### Adding Multiple Routers

Simply add more routers the same way. The bot keeps track of all your routers.

```
You:   tambah router Rumah, host rumah.tunnel.my.id, port 8728, user admin, pass pass456
Bot:   Router Rumah ditambahkan.
       Punya 3 router: Kantor (default), Warnet, Rumah
```

### Setting a Default Router

When you have multiple routers, commands target the default router unless you specify one. To change the default:

```
You:   set default router ke Warnet
Bot:   Default router diubah ke Warnet? (ya/tidak)
You:   ya
Bot:   Default router sekarang Warnet
```

### Removing a Router

```
You:   hapus router Rumah
Bot:   Hapus router Rumah? (ya/tidak)
You:   ya
Bot:   Router Rumah dihapus
```

### Listing Your Routers

```
You:   list router
Bot:   Router kamu (3):
       1. Kantor (default) — hEX v6.49.8
       2. Warnet — RB750Gr3 v7.14
       3. Rumah — hAP ac2 v7.14
```

---

## Daily Operations

### System Status

Check CPU load, memory usage, uptime, and board information.

```
You:   cek status router
You:   berapa CPU sekarang?
You:   info sistem Kantor
```

**Example response:**
```
📊 Kantor
• Board: `hEX` · v`6.49.8`
• CPU: `11%` · RAM: `211/256 MB`
• Uptime: `6j 48m`
```

**Other system commands:**
```
cek jam router              → router date/time
cek hardware health         → voltage, temperature
cek routerboard info        → serial number, firmware
cek lisensi                 → license level
list paket yang terinstall  → installed packages
list user RouterOS          → RouterOS login accounts
```

### Monitoring Clients

**Count active clients:**
```
You:   berapa client online?
Bot:   👥 34 user online di Kantor
```

**List DHCP leases (all connected clients):**
```
You:   list client DHCP
Bot:   👥 Active Clients — Kantor (34 total)
       1. 10.10.8.18 — Infinix-HOT-60i (B6:00:D0:44:76:13)
       2. 10.10.8.178 — android-be1b2d283 (38:29:5A:13:A5:81)
       ...
```

**List wireless clients:**
```
You:   siapa aja yang konek wifi?
```

**List ARP table (all devices seen by router):**
```
You:   list ARP table
```

**Targeting a specific router:**
```
You:   berapa client online di Warnet?
You:   list DHCP leases di semua router
```

### Interfaces and Traffic

**List all interfaces:**
```
You:   list interface
```

**Check traffic on a specific interface:**
```
You:   cek traffic di ether1
```

**List VLANs, bridges, tunnels:**
```
You:   list VLAN
You:   list bridge port
You:   list EoIP tunnel
```

### Firewall Rules

**View filter rules:**
```
You:   list firewall filter
```

**View NAT rules:**
```
You:   list NAT
```

**View mangle rules:**
```
You:   list mangle
```

**View address lists:**
```
You:   list address list
```

### Viewing Logs

```
You:   tampilkan log terakhir
You:   show last 20 logs
```

By default, the bot returns the 50 most recent log entries. You can request a specific count.

### Health Check Across All Routers

Get a quick overview of all your routers at once:

```
You:   cek semua router
You:   health check all routers

Bot:   🟢 Kantor — online · CPU `8%` · `34 client`
       🟢 Warnet — online · CPU `3%` · `12 client`
       🔴 Rumah — OFFLINE (unreachable)
```

---

## Hotspot Management

The bot provides Mikhmon-like hotspot management capabilities directly from Telegram.

### Viewing Hotspot Users and Profiles

**Count hotspot users (fast, no full listing):**
```
You:   berapa user hotspot?
Bot:   📊 Kantor: 450 total (420 enabled, 30 disabled)
```

**List all hotspot users (warning: can be slow if 1000+ users):**
```
You:   list user hotspot
```

**View active/online hotspot sessions:**
```
You:   siapa aja yang online di hotspot?
You:   count active hotspot
```

**View hotspot user profiles (rate limit templates):**
```
You:   list profil hotspot
Bot:   📋 Hotspot Profiles — Kantor
       • default — unlimited
       • 5rb — rate: 1M/2M
       • 10rb — rate: 2M/4M
       • Free — rate: 512k/512k
```

**Get detailed info about a specific user:**
```
You:   detail user hotspot tamu01
Bot:   📋 tamu01
       • Profile: 5rb
       • Uptime used: 2h30m / 3h limit
       • Data: 150 MB in / 50 MB out
       • Status: enabled
```

### Creating Individual Hotspot Users

```
You:   buat user hotspot baru, username: tamu01, password: 123456, profile: 5rb

Bot:   Buat user hotspot 'tamu01' dengan profile '5rb' di Kantor? (ya/tidak)

You:   ya

Bot:   ✅ user hotspot 'tamu01' dibuat (profile: 5rb)
```

### Generating Bulk Vouchers

Generate multiple voucher users at once, like Mikhmon:

```
You:   generate 20 voucher profile 5rb

Bot:   Generate 20 voucher hotspot profile '5rb' di Kantor? (ya/tidak)

You:   ya

Bot:   ✅ 20 voucher dibuat (profile: 5rb)
       1. v8k3m2 / a9x7p1
       2. v5n1q4 / b3r8w6
       3. v2j6t9 / c4y2m8
       ...
```

**Advanced voucher generation:**
```
generate 50 voucher profile 10rb, prefix VIP, limit uptime 3h, limit data 1G, comment "Batch April"
```

Parameters you can customize:
- **count** -- how many vouchers (max 100 per batch)
- **profile** -- which rate limit profile
- **prefix** -- username prefix (e.g., "VIP" produces "VIPa3k8m2")
- **username_length** -- random part length (default: 6)
- **password_length** -- password length (default: 6)
- **limit_uptime** -- time limit per user (e.g., "1h", "3h", "1d")
- **limit_bytes_total** -- data limit per user (e.g., "100M", "1G")
- **comment** -- comment attached to all generated users

### Managing User Profiles

**Create a new profile:**
```
You:   buat profil hotspot Premium, rate limit 5M/10M, shared users 2, session timeout 8h

Bot:   Buat profile hotspot 'Premium'? (ya/tidak)

You:   ya

Bot:   ✅ profile 'Premium' dibuat (rate: 5M/10M, shared: 2)
```

**Update an existing profile:**
```
You:   ubah rate limit profil 5rb jadi 2M/3M
```

**Remove a profile:**
```
You:   hapus profil hotspot Trial
```

Note: You cannot remove a profile that still has users assigned to it. Reassign or remove those users first.

### Enabling and Disabling Users

**Disable (suspend) a user without deleting:**
```
You:   disable user hotspot tamu01
Bot:   Disable user hotspot 'tamu01' di Kantor? (ya/tidak)
You:   ya
Bot:   ✅ user hotspot 'tamu01' di-disable
```

**Re-enable a disabled user:**
```
You:   enable user hotspot tamu01
```

### Searching for Users

Search by exact or partial username match:

```
You:   cari user hotspot tamu
Bot:   📋 Hasil pencarian 'tamu':
       1. tamu01 — profile: 5rb — enabled
       2. tamu02 — profile: 5rb — disabled
       3. tamuvip — profile: Premium — enabled
```

### Bulk Operations

**Enable multiple users at once:**
```
You:   enable user hotspot tamu01, tamu02, tamu03
```

**Disable multiple users:**
```
You:   disable user hotspot tamu01, tamu02, tamu03
```

**Remove multiple users:**
```
You:   hapus user hotspot tamu01, tamu02, tamu03
```

### Cleaning Up Expired and Disabled Users

**Remove all disabled users (cleanup):**
```
You:   hapus semua user hotspot yang disabled

Bot:   ⚠️ Ini akan menghapus SEMUA user hotspot yang disabled di Kantor. Tidak bisa di-undo!
       Lanjut? (ya/tidak)

You:   ya

Bot:   ✅ 30 user disabled dihapus
```

**Remove expired users (exceeded uptime or data limits):**
```
You:   cleanup user hotspot yang expired

Bot:   ⚠️ Ini akan menghapus user hotspot yang sudah melewati limit uptime/data.
       Lanjut? (ya/tidak)

You:   ya

Bot:   ✅ 15 user expired dihapus
```

### Viewing Voucher Statistics

Get a Mikhmon-like dashboard of user counts per profile:

```
You:   statistik voucher hotspot

Bot:   📊 Hotspot Stats — Kantor
       • Total: 450 users
       • Enabled: 420
       • Disabled: 30
       • Per profile:
         - 5rb: 200
         - 10rb: 150
         - Free: 80
         - Premium: 20
```

---

## PPP/VPN Management

### Viewing PPP Users and Connections

**List all PPP secrets (user accounts):**
```
You:   list user PPP
```

**List active PPP/VPN connections:**
```
You:   siapa yang konek VPN sekarang?
```

**View PPP profiles:**
```
You:   list profil PPP
```

**Check VPN server config:**
```
You:   cek L2TP server
You:   cek PPTP server
You:   cek SSTP server
```

### Adding and Removing PPP Secrets

**Add a PPP user:**
```
You:   tambah user PPP: nama vpn_budi, password pass123, service l2tp, profile default

Bot:   Tambah PPP secret 'vpn_budi' (service=l2tp)? (ya/tidak)

You:   ya

Bot:   ✅ PPP secret 'vpn_budi' dibuat
```

**Remove a PPP user:**
```
You:   hapus user PPP vpn_budi
```

### Kicking Active Sessions

```
You:   kick session VPN yang aktif [session_id]
```

You need the session ID from listing active sessions first. The bot will ask for confirmation before disconnecting.

---

## Firewall Management

### Viewing Rules

```
You:   list firewall filter
You:   list NAT rules
You:   list mangle rules
You:   list firewall raw
You:   list active connections
```

### Adding and Removing Filter Rules

**Add a firewall filter rule:**
```
You:   tambah firewall rule: chain forward, action drop, protocol tcp, dst port 445, comment "Block SMB"

Bot:   Tambah firewall filter rule (chain=forward, action=drop, port 445)? (ya/tidak)

You:   ya

Bot:   ✅ firewall filter rule ditambahkan
```

**Remove a filter rule:**
```
You:   hapus firewall rule [rule_id]
```

You can get rule IDs by listing the firewall rules first.

### NAT Rules

**Add a NAT rule (e.g., port forwarding):**
```
You:   tambah NAT rule: chain dstnat, action dst-nat, protocol tcp, dst port 8080, to-addresses 192.168.1.100, to-ports 80

Bot:   Tambah NAT rule (chain=dstnat, action=dst-nat)? (ya/tidak)

You:   ya

Bot:   ✅ NAT rule ditambahkan
```

**Remove a NAT rule:**
```
You:   hapus NAT rule [rule_id]
```

### Enabling and Disabling Rules

Instead of deleting rules, you can temporarily disable them:

```
You:   disable firewall rule [rule_id]
You:   enable firewall rule [rule_id]
You:   disable NAT rule [rule_id]
You:   enable NAT rule [rule_id]
```

### Address Lists

**View address lists:**
```
You:   list address list
```

**Add an IP to an address list:**
```
You:   tambah IP 192.168.1.100 ke address list "blocked" dengan timeout 1h

Bot:   Tambah 192.168.1.100 ke address list 'blocked'? (ya/tidak)

You:   ya

Bot:   ✅ 192.168.1.100 ditambahkan ke address list 'blocked'
```

**Remove from address list:**
```
You:   hapus entry [entry_id] dari address list
```

---

## Queue and Bandwidth Management

### Viewing Queues

```
You:   list simple queue
You:   list queue tree
You:   list queue types
```

### Adding and Removing Bandwidth Limits

**Add a simple queue (bandwidth limit):**
```
You:   buat simple queue: nama "limit-john", target 192.168.1.100/32, max limit 5M/10M

Bot:   Buat simple queue 'limit-john' (target=192.168.1.100/32, limit=5M/10M)? (ya/tidak)

You:   ya

Bot:   ✅ simple queue 'limit-john' dibuat
```

**Remove a simple queue:**
```
You:   hapus simple queue [queue_id]
```

**Enable/disable a queue (without deleting):**
```
You:   disable queue [queue_id]
You:   enable queue [queue_id]
```

### Queue Tree

Queue tree entries can be viewed but not created through the bot (use Winbox for complex queue tree setups):

```
You:   list queue tree
```

---

## Advanced Features

### Raw RouterOS API Queries

For features not covered by the built-in tools, you can query any RouterOS API path directly:

```
You:   query /ip/proxy

Bot:   ⚠️ Raw API query ke path /ip/proxy di Kantor.
       Ini langsung akses RouterOS API. Lanjut? (ya/tidak)

You:   ya

Bot:   Yakin nih? Ini bakal query /ip/proxy. Yakin? (ya/tidak)

You:   ya

Bot:   [results from the router]
```

**Examples of API paths you can query:**
- `/ip/proxy` -- proxy settings
- `/ip/socks` -- SOCKS proxy
- `/certificate` -- certificates
- `/system/note` -- system notes
- `/interface/ethernet` -- ethernet settings
- `/ip/traffic-flow` -- traffic flow config

### Cross-Router Health Check

Get status of all your routers in one command:

```
You:   cek semua router
You:   health check all

Bot:   🟢 Kantor — online · CPU `8%` · `34 client`
       🟢 Warnet — online · CPU `3%` · `12 client`
       🔴 Rumah — OFFLINE
```

Alerts are included for high CPU (>80%) or critical memory (>90%).

### Router Backup

Create a backup file on the router:

```
You:   backup router Kantor

Bot:   Buat backup di router Kantor? (ya/tidak)

You:   ya

Bot:   ✅ backup dibuat: backup.backup (tersimpan di filesystem router)
```

The backup file is stored on the router itself. Download it via Winbox or FTP.

You can also try exporting the config as text:

```
You:   export config router Kantor
```

Note: Full `/export` may not be available via the API on all RouterOS versions. The bot will provide a summary of key sections as a fallback.

### Scheduled Tasks

**View scheduled tasks on the router:**
```
You:   list scheduler
```

**Add a scheduled task:**
```
You:   tambah scheduler: nama auto-backup, on-event "/system backup save name=auto", start-time 00:00:00, interval 1d
```

**Remove a scheduled task:**
```
You:   hapus scheduler auto-backup
```

### DNS Management

**View DNS settings:**
```
You:   cek DNS settings
```

**List static DNS entries:**
```
You:   list DNS static
```

**Add a static DNS entry:**
```
You:   tambah DNS static: server.local -> 192.168.1.100
```

**Remove a static DNS entry:**
```
You:   hapus DNS static [entry_id]
```

### Static Routes

**View routing table:**
```
You:   list routes
```

**Add a static route:**
```
You:   tambah route: destination 10.0.0.0/8, gateway 192.168.1.1
```

**Remove a static route:**
```
You:   hapus route [route_id]
```

---

## Tips and Tricks

### Common Commands Cheat Sheet

| What you want | What to say |
|---------------|-------------|
| System status | `cek status`, `info router`, `cek CPU` |
| Client count | `berapa client online?` |
| DHCP clients | `list DHCP lease`, `list client` |
| Hotspot users | `list user hotspot`, `count user hotspot` |
| Active hotspot | `siapa online di hotspot?` |
| Create user | `buat user hotspot [name] [password] [profile]` |
| Generate vouchers | `generate 20 voucher profile 5rb` |
| Delete user | `hapus user hotspot [name]` |
| Firewall rules | `list firewall`, `list NAT` |
| Interface list | `list interface` |
| Traffic check | `cek traffic ether1` |
| Router health | `cek semua router` |
| Logs | `tampilkan log` |
| Backup | `backup router` |
| Reboot | `reboot router` (double confirmation required) |

### Best Practices

1. **Enable the API service on your router.** In Winbox: IP > Services > enable `api` on port 8728. Do NOT expose port 8728 to the public internet.

2. **Use a dedicated RouterOS user for API access.** Create a separate user with `api` group permissions rather than using your main admin account.

3. **Use tunnels for remote routers.** If your router is behind NAT, set up a tunnel service (e.g., `tunnel.my.id`) so the bot can reach it.

4. **Use `count` commands instead of `list` for large datasets.** If you have 1000+ hotspot users, use `count user hotspot` instead of `list user hotspot` to avoid slow responses.

5. **Use profiles for hotspot rate limits.** Create profiles like "5rb", "10rb", "Premium" and assign users to them rather than setting individual limits.

6. **Generate vouchers in batches of 100 or less.** The bot limits bulk generation to 100 per request to prevent abuse.

7. **Clean up regularly.** Use `hapus user expired` and `hapus user disabled` periodically to keep your hotspot user list manageable.

8. **Specify the router name when you have multiple routers.** E.g., `cek CPU Kantor` instead of just `cek CPU` to avoid ambiguity.

### Troubleshooting

**"Router ga bisa dihubungi" / "Connection failed"**
- Check that the router is powered on and connected to the network.
- Verify the API service is enabled (IP > Services > api).
- Check that the port is correct (default: 8728).
- If using a tunnel, verify the tunnel is active.
- Check firewall rules on the router -- make sure the API port is not blocked.

**"User not found"**
- Usernames are case-sensitive. Check the exact spelling.
- Use the search function: `cari user hotspot [partial_name]`.

**"Profile not found"**
- List available profiles first: `list profil hotspot`.
- Profile names are case-sensitive.

**Bot does not respond**
- Your Telegram ID may not be provisioned. Contact the admin.
- The bot service may be down. Contact the admin.

**Slow responses**
- Listing all hotspot users on a router with 1000+ users can be slow. Use `count` instead.
- The router may have high CPU load or a slow connection.

**"Connection timeout"**
- The router is taking too long to respond. Try again later.
- Check the tunnel/network connection between the bot server and the router.

---

## Language Support

The bot defaults to **casual Indonesian (bahasa gaul)**. If you write in English, it will reply in English. You can switch languages at any time by simply writing in your preferred language.

## Confirmation Rules

| Operation Type | Confirmation |
|----------------|-------------|
| Read-only (view info, list data) | No confirmation needed |
| Write operations (add/remove/enable/disable) | Single confirmation: "lanjut? (ya/tidak)" |
| Dangerous operations (reboot, raw API, run scripts) | Double confirmation |

To confirm: reply with `ya`, `yes`, `ok`, `lanjut`, `gas`, `sure`, `proceed`, or `oke`.

## Supported RouterOS Versions

| Version | Support |
|---------|---------|
| RouterOS v6.x | Fully supported |
| RouterOS v7.x | Fully supported |

The bot uses the binary API protocol on port 8728, which is available on both v6 and v7.
