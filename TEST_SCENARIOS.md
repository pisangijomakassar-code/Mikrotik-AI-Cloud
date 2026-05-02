# Test Scenarios — Voucher & Hotspot Flow

Skenario E2E + integrasi untuk modul **Hotspot Profile**, **Generate Voucher**,
**Setting Voucher (Bot)**, dan **Cetak Voucher**. Tiap skenario punya:

- **ID** unik
- **Tujuan** singkat
- **Prasyarat** state yang diperlukan
- **Langkah** yang bisa dieksekusi
- **Hasil yang diharapkan**
- **Mode**: 🟢 Auto (Playwright/curl) atau 🟡 Manual (perlu device fisik) atau 🔵 Hybrid
- **Snippet** template kode jika auto

> Doc ini juga dipakai sebagai template bagi AI agent (Claude/Copilot) untuk
> meng-orkestrasi auto-test. Jaga formatnya konsisten supaya parsing mudah.

## Daftar Isi

1. [Setup & Prasyarat Umum](#setup--prasyarat-umum)
2. [Modul Hotspot Profile (PROF)](#modul-hotspot-profile-prof)
3. [Reference: Expired Mode di Mikhmon](#reference-expired-mode-di-mikhmon)
4. [Modul Generate Voucher (VG)](#modul-generate-voucher-vg)
5. [Modul Setting Voucher Bot (VS)](#modul-setting-voucher-bot-vs)
6. [Modul Cetak Voucher (VP)](#modul-cetak-voucher-vp)
7. [Modul Reseller (RES)](#modul-reseller-res)
8. [Integrasi Mikhmon Compat (MK)](#integrasi-mikhmon-compat-mk)
9. [End-to-End Flow (E2E)](#end-to-end-flow-e2e)
10. [Cleanup & Teardown](#cleanup--teardown)

---

## Setup & Prasyarat Umum

### Environment variables

```bash
# .env.test
E2E_BASE_URL=http://localhost:3001          # atau prod URL
E2E_EMAIL=admin@local.com
E2E_PASSWORD=admin123
E2E_TELEGRAM_ID=000000000                   # user_id untuk hit agent API langsung
E2E_AGENT_URL=http://localhost:8080         # health_server.py agent
E2E_ROUTER_NAME=ummi                        # nama router yang sudah terhubung
E2E_RESELLER_NAME=Mustafa                   # reseller yang sudah ada (atau dibuat di SETUP-02)
E2E_DB_CONTAINER=mikrotik-db                # buat verifikasi langsung ke postgres
```

### Fixtures yang diperlukan

| ID        | Type     | Konten                                                                                |
|-----------|----------|---------------------------------------------------------------------------------------|
| SETUP-01  | Router   | Router `ummi` dengan `dnsHotspot=...`, `hotspotName=...`, online ke RouterOS API.     |
| SETUP-02  | Reseller | Reseller `Mustafa` dengan `discount=50`, `voucherGroup=default`.                      |
| SETUP-03  | Profile  | Profil dummy (akan dibuat & dihapus di test) — pastikan tidak konflik nama.           |

### Quick health check

```bash
# Agent health
curl -s -m 5 ${E2E_AGENT_URL}/health
# Expected: {"status": "ok"}

# Dashboard auth (manual login session in Playwright)
curl -s -o /dev/null -w "%{http_code}\n" ${E2E_BASE_URL}/login
# Expected: 200

# Router resolve
docker exec ${E2E_DB_CONTAINER} psql -U mikrotik -d mikrotik -c \
  "SELECT name, host FROM \"Router\" WHERE name='${E2E_ROUTER_NAME}';"
```

---

## Modul Hotspot Profile (PROF)

### PROF-01 — Buat profil Mikbotam-style validity 5m

**Tujuan**: Verifikasi profil hotspot dibuat dengan on-login script Mikhmon-compatible header.

**Prasyarat**: SETUP-01 router online.

**Mode**: 🟢 Auto

**Langkah & Snippet**:

```bash
# 1. Buat profil via API agent
curl -s -X POST ${E2E_AGENT_URL}/hotspot-profile/${E2E_TELEGRAM_ID} \
  -H "Content-Type: application/json" \
  -d '{
    "name": "test-prof-5m",
    "router": "'"${E2E_ROUTER_NAME}"'",
    "rateLimit": "1M/1M",
    "sharedUsers": 1,
    "validity": "5m",
    "lockUser": false,
    "transparentProxy": false
  }'
# Expected: {"status": "ok"}

# 2. Verifikasi profil ada di RouterOS dengan on-login Mikhmon-compat
curl -s ${E2E_AGENT_URL}/hotspot-profile/${E2E_TELEGRAM_ID}/test-prof-5m \
  | python -c "
import sys, json
p = json.load(sys.stdin)
assert p['validity'] == '5m', f'validity got {p[\"validity\"]}'
assert p['lockUser'] is False
assert ':put (\",remc,0,5m,0,,Disable,\");' in p['onLogin']
assert 'system scheduler add' in p['onLogin']
print('OK')
"
```

**Hasil yang diharapkan**: Profil ada di MikroTik, header `:put (",remc,0,5m,0,,Disable,")` terdeteksi, body script punya `system scheduler add`.

---

### PROF-02 — Update profil ganti validity & lock user

**Tujuan**: Update flow regenerate on-login script saat validity/lockUser diubah.

**Prasyarat**: PROF-01 sudah dibuat.

**Mode**: 🟢 Auto

```bash
curl -s -X POST ${E2E_AGENT_URL}/hotspot-profile/${E2E_TELEGRAM_ID}/test-prof-5m \
  -H "Content-Type: application/json" \
  -d '{"validity": "2m", "lockUser": true}'
# Expected: {"status": "ok"}

# Verifikasi script ter-regenerate
curl -s ${E2E_AGENT_URL}/hotspot-profile/${E2E_TELEGRAM_ID}/test-prof-5m \
  | python -c "
import sys, json
p = json.load(sys.stdin)
assert p['validity'] == '2m'
assert p['lockUser'] is True
assert ':put (\",remc,0,2m,0,,Enable,\");' in p['onLogin']
assert 'set mac-address=' in p['onLogin'], 'lock user MAC binding line missing'
print('OK')
"
```

---

### PROF-03 — Mode None: profil tanpa expiry

**Tujuan**: Buat profil dengan Expired Mode = None — backend skip on-login script.

**Mode**: 🟢 Auto

```bash
curl -s -X POST ${E2E_AGENT_URL}/hotspot-profile/${E2E_TELEGRAM_ID} \
  -H "Content-Type: application/json" \
  -d '{
    "name": "test-prof-noexpiry",
    "router": "'"${E2E_ROUTER_NAME}"'",
    "rateLimit": "1M/1M",
    "validity": "",
    "lockUser": false
  }'

# Verifikasi: on-login kosong
curl -s ${E2E_AGENT_URL}/hotspot-profile/${E2E_TELEGRAM_ID}/test-prof-noexpiry \
  | python -c "
import sys, json
p = json.load(sys.stdin)
assert p['onLogin'] == '', f'on-login should be empty, got: {p[\"onLogin\"][:50]}'
print('OK')
"
```

---

### PROF-04 — Scheduler fire setelah validity habis

**Tujuan**: Verifikasi scheduler benar-benar fire dan menghapus user setelah `interval` lewat.

**Prasyarat**: PROF-01 (validity 5m). User test dibuat via VG-01.

**Mode**: 🔵 Hybrid (perlu wait waktu kalender)

> **Catatan implementasi**: Project ini pakai **pattern Mikbotam** — 1 scheduler
> per-user, fire **sekali**, langsung **remove user**. Beda dengan Mikhmon yang
> pakai expiry-datetime di `comment` + `bgservice` periodic check (lihat
> [Reference: Expired Mode di Mikhmon](#reference-expired-mode-di-mikhmon)
> untuk detail dan behavior per-mode).

```bash
# 1. Buat dummy user dengan profil ini
curl -s -X POST ${E2E_AGENT_URL}/hotspot-user/${E2E_TELEGRAM_ID} \
  -H "Content-Type: application/json" \
  -d '{"username":"vc-test-fire","password":"vc-test-fire","profile":"test-prof-5m"}'

# 2. Simulasi login pertama via direct scheduler add (mempercepat test)
docker exec mikrotik-agent python3 -c "
import sys
sys.path.insert(0, '/app/mikrotik_mcp')
from server import registry, connect_router
conn = registry.resolve('${E2E_TELEGRAM_ID}', '${E2E_ROUTER_NAME}')
with connect_router(conn['host'], conn['port'], conn['username'], conn['password']) as api:
    api.path('system','scheduler').add(
        name='vc-test-fire', disabled='no', interval='2m',
        **{'start-date': 'apr/29/2026', 'start-time': '00:00:00'},
        **{'on-event': '[/ip hotspot user remove [find where name=vc-test-fire]];[/sys sch re [find where name=vc-test-fire]]'},
    )
"

# 3. Tunggu 2.5 menit (scheduler interval=2m)
sleep 150

# 4. Verifikasi user & scheduler hilang
docker exec mikrotik-agent python3 -c "
import sys
sys.path.insert(0, '/app/mikrotik_mcp')
from server import registry, connect_router
conn = registry.resolve('${E2E_TELEGRAM_ID}', '${E2E_ROUTER_NAME}')
with connect_router(conn['host'], conn['port'], conn['username'], conn['password']) as api:
    users = [u for u in api.path('ip','hotspot','user') if u['name']=='vc-test-fire']
    sched = [s for s in api.path('system','scheduler') if s['name']=='vc-test-fire']
    assert len(users) == 0, 'user should be removed'
    assert len(sched) == 0, 'scheduler should remove itself'
    print('OK')
"
```

**Hasil yang diharapkan**: Setelah 2 menit, user dan scheduler keduanya hilang dari RouterOS.

---

### Reference: Expired Mode di Mikhmon

Mikhmon V3 ([adduserprofile.php#L60-L85](https://github.com/laksa19/mikhmonv3/blob/master/hotspot/adduserprofile.php))
mendukung **5 mode** voucher expired. Berikut behavior tiap mode saat masa
berlaku habis:

| Code   | Label              | On-event action saat expired                                | User di RouterOS    | Record? |
|--------|--------------------|-------------------------------------------------------------|---------------------|---------|
| `rem`  | Remove             | `/ip hotspot user remove <user>`                            | **Hilang**          | ❌      |
| `remc` | Remove & Record    | Sama dengan `rem` + `/system script add` saat login pertama | **Hilang**          | ✅      |
| `ntf`  | Notice             | `/ip hotspot user set limit-uptime=1s <user>`               | Tetap ada, **disable** (next login langsung kena uptime habis) | ❌ |
| `ntfc` | Notice & Record    | Sama dengan `ntf` + record                                  | Tetap ada, **disable** | ✅   |
| `0`    | No Expiry (NoExp)  | (tidak ada on-login script, voucher tidak hangus)           | Tetap ada selamanya | ❌      |

**Mekanisme detail Mikhmon (beda dengan Mikbotam)**:

1. **Saat login pertama** (`on-login` di profil):
   - Bikin `/sys sch add name=$user interval=<validity>` — temporary, hanya
     untuk dapat `next-run` datetime
   - Tulis `next-run` datetime ke `comment` field user (e.g. `apr/30/2026 12:34:56`)
   - `/sys sch remove [find where name=$user]` — scheduler dihapus, comment
     menyimpan expiry
   - Kalau mode `remc`/`ntfc`: tambah `/system script add name="..." comment=mikhmon`
     untuk transaction log
   - Kalau Lock User=Enable: `/ip hotspot user set mac-address=$mac`

2. **Saat expiry check** (`bgservice` — scheduler global per-profil):
   ```
   :foreach i in [/ip hotspot user find where profile="<profile>"] do={
     :local comment [/ip hotspot user get $i comment]
     # parse expiry datetime dari comment
     :if (expired) do={
       [/ip hotspot user <mode> $i]   # remove ATAU set limit-uptime=1s
       [/ip hotspot active remove [find where user=$name]]
     }
   }
   ```
   - Scheduler ini di-set per-profil dengan `name="<profile>service"` dan
     interval rutin (biasanya 1m).
   - Iterasi semua user dalam profil, parse comment, kalau expired → execute
     `<mode>` action.

**Pattern project ini (Mikbotam)**: 1 scheduler per-user dengan
`name=$user`, `interval=<validity>`, fire SEKALI saat validity habis.
On-event langsung `remove user` + `remove active session` + `remove cookie` +
`remove scheduler itself`. Tidak ada bgservice, tidak ada comment-based
expiry, tidak ada mode notice/record.

**Implikasi untuk test**:

- Project ini hanya men-support mode **`Remove`** (equiv ke Mikhmon `rem`).
- Mode `Notice` (user di-disable, tidak hapus) **belum di-support** di
  generator on-login. Kalau perlu di future, perlu tambah branch di
  `_build_mikbotam_on_login` di `mikrotik_mcp/health_server.py`.
- Mode `Record` (logging ke `/system script`) **tidak relevan** karena kita
  punya PostgreSQL untuk transaction history (`VoucherBatch` table).

**Test untuk mode lain (kalau mau di-extend di masa depan)**:

| ID       | Mode        | Verify                                                             |
|----------|-------------|--------------------------------------------------------------------|
| PROF-04a | `rem`       | (sudah dicover PROF-04) — user hilang setelah validity              |
| PROF-04b | `ntf`       | User tetap ada di `/ip hotspot user` setelah validity, tapi `limit-uptime=1s` (next login langsung kick) |
| PROF-04c | `remc`      | Sama dengan `rem` plus 1 entry baru di `/system script` (comment=mikhmon) saat login pertama |
| PROF-04d | `ntfc`      | Sama dengan `ntf` plus record                                       |
| PROF-04e | `0` / NoExp | Tidak ada `on-login` script. User tetap ada selamanya               |

---

## Modul Generate Voucher (VG)

### VG-01 — Generate via direct profile (skip Jenis Voucher)

**Tujuan**: Generate voucher tanpa harus simpan VoucherType, langsung pilih profile.

**Prasyarat**: PROF-01 atau profil existing.

**Mode**: 🟢 Auto

```bash
curl -s -X POST ${E2E_AGENT_URL}/generate-vouchers/${E2E_TELEGRAM_ID} \
  -H "Content-Type: application/json" \
  -d '{
    "profile": "test-prof-5m",
    "count": 3,
    "prefix": "T-",
    "router_name": "'"${E2E_ROUTER_NAME}"'",
    "password_length": 4,
    "username_length": 4,
    "typeChar": "Random 1234",
    "typeLogin": "Username = Password",
    "limitUptime": "",
    "price_per_unit": 3000,
    "discount": 0,
    "markUp": 0
  }' \
  | python -c "
import sys, json
r = json.load(sys.stdin)
assert r['status'] == 'ok'
assert r['count'] == 3
assert all(v['username'].startswith('T-') for v in r['vouchers'])
assert all(len(v['username']) == 6 for v in r['vouchers'])  # 'T-' + 4 chars
assert all(v['username'] == v['password'] for v in r['vouchers'])  # typeLogin
print('OK', r['vouchers'])
"
```

---

### VG-02 — Generate dengan reseller (auto-fill diskon)

**Tujuan**: Reseller dipilih → diskon 50% auto-fill → batch tersimpan dengan resellerId.

**Prasyarat**: SETUP-02 reseller `Mustafa` exist.

**Mode**: 🟢 Auto (Playwright UI)

```typescript
// e2e/voucher-generate.spec.ts
test('VG-02 generate dengan reseller auto-diskon', async ({ page }) => {
  await login(page)
  await page.goto(`${BASE}/vouchers`)

  // Pick reseller Mustafa
  await page.getByRole('combobox').filter({ hasText: 'Admin / Tanpa Reseller' }).click()
  await page.getByRole('option', { name: 'Mustafa' }).click()

  // Verify diskon auto-fill 50
  await expect(page.locator('input[type="number"]').nth(1)).toHaveValue('50')
})
```

---

### VG-03 — Generate batch persist ke PostgreSQL

**Tujuan**: VoucherBatch tersimpan dengan resellerId, harga, markUp, dll.

**Mode**: 🟢 Auto

```bash
# Setelah VG-01 atau VG-02:
docker exec ${E2E_DB_CONTAINER} psql -U mikrotik -d mikrotik -c '
SELECT profile, count, "pricePerUnit", "hargaEndUser", "markUp", "resellerId"
FROM "VoucherBatch"
ORDER BY "createdAt" DESC LIMIT 1;
'
# Expected: profile=test-prof-5m count=3 pricePerUnit=3000 hargaEndUser=3000 markUp=0 resellerId=NULL
```

---

## Modul Setting Voucher Bot (VS)

### VS-01 — Save VoucherType tidak menyentuh MikroTik

**Tujuan**: Save di /settings/vouchers cuma upsert ke PostgreSQL, no API call ke RouterOS.

**Mode**: 🟢 Auto

```bash
# 1. Snapshot router profile state
BEFORE=$(docker exec mikrotik-agent python3 -c "
import sys; sys.path.insert(0, '/app/mikrotik_mcp')
from server import registry, connect_router
conn = registry.resolve('${E2E_TELEGRAM_ID}', None)
with connect_router(conn['host'], conn['port'], conn['username'], conn['password']) as api:
    print(len(list(api.path('ip','hotspot','user','profile'))))
")

# 2. Buat VoucherType via dashboard API
curl -s -X POST ${E2E_BASE_URL}/api/voucher-types \
  -b "${SESSION_COOKIE}" \
  -H "Content-Type: application/json" \
  -d '{
    "namaVoucher": "Test Auto",
    "profile": "test-prof-5m",
    "harga": 3000,
    "markUp": 500,
    "prefix": "TA-",
    "panjangKarakter": 6,
    "typeChar": "Random abcd2345",
    "typeLogin": "Username = Password"
  }'

# 3. Verifikasi profile count tidak berubah
AFTER=$(...same as BEFORE...)
[[ "$BEFORE" == "$AFTER" ]] && echo "OK no router change"
```

---

### VS-02 — VoucherType muncul di dropdown Generate Voucher

**Tujuan**: Setelah save, VoucherType langsung muncul di /vouchers dropdown.

**Mode**: 🟢 Auto (Playwright)

```typescript
test('VS-02 voucher type muncul di generate dropdown', async ({ page }) => {
  await login(page)
  await page.goto(`${BASE}/vouchers`)
  await page.getByRole('combobox').filter({ hasText: 'auto-fill' }).click()
  await expect(page.getByRole('option', { name: /Test Auto/ })).toBeVisible()
})
```

---

## Modul Cetak Voucher (VP)

### VP-01 — Fetch latest batch & render

**Tujuan**: Mode "Terbaru" ambil 1 batch terakhir + render preview.

**Mode**: 🟢 Auto (Playwright)

```typescript
test('VP-01 latest batch render preview', async ({ page }) => {
  await login(page)
  await page.goto(`${BASE}/vouchers/print`)
  await page.getByRole('button', { name: 'Tampilkan Preview' }).click()
  await expect(page.locator('.vc')).toHaveCount(/\d+/, { timeout: 5000 })
  // Toast confirm
  await expect(page.getByText(/voucher siap cetak/)).toBeVisible()
})
```

---

### VP-02 — Filter custom date range

**Tujuan**: Mode "Custom" filter berdasarkan date from/to.

**Mode**: 🟢 Auto

```bash
curl -s "${E2E_BASE_URL}/api/vouchers/print?mode=custom&from=2026-01-01&to=2026-04-29" \
  -b "${SESSION_COOKIE}" \
  | python -c "
import sys, json
r = json.load(sys.stdin)
assert r['mode'] == 'custom'
assert all('2026-' in b['createdAt'] for b in r['batches'])
print('OK', len(r['batches']), 'batches')
"
```

---

### VP-03 — Dynamic perPage 10–100 → grid auto-derive

**Tujuan**: Input perPage menghasilkan cols/rows sesuai algoritma A4.

**Mode**: 🟢 Auto (unit test)

```typescript
import { describe, it, expect } from "vitest"
import { computeGrid } from "@/app/(dashboard)/vouchers/print/page"

describe('computeGrid', () => {
  it.each([
    [20, 4, 5],
    [40, 5, 8],
    [80, 8, 10],
    [100, 8, 13],
  ])('perPage=%i → cols=%i rows=%i', (n, cols, rows) => {
    const g = computeGrid(n)
    expect(g.cols).toBe(cols)
    expect(g.rows).toBe(rows)
  })
})
```

---

### VP-04 — Harga prioritas: sellPrice → hargaEndUser → pricePerUnit

**Tujuan**: Voucher Mikhmon-import tampil pakai sellPrice; voucher dashboard pakai hargaEndUser.

**Mode**: 🟢 Auto

```bash
# Periksa response API termasuk profile sellPrice
curl -s "${E2E_BASE_URL}/api/vouchers/print?mode=latest" -b "${SESSION_COOKIE}" \
  | python -c "
import sys, json
r = json.load(sys.stdin)
b = r['batches'][0]
print(f'profile={b[\"profile\"]} hargaEndUser={b[\"hargaEndUser\"]} pricePerUnit={b[\"pricePerUnit\"]}')
"

# Plus profile sellPrice
curl -s "${E2E_BASE_URL}/api/hotspot/profiles" -b "${SESSION_COOKIE}" \
  | python -c "
import sys, json
ps = json.load(sys.stdin)
for p in ps:
    if p.get('sellPrice', 0) > 0:
        print(f'{p[\"name\"]}: modal={p[\"modalPrice\"]} sell={p[\"sellPrice\"]}')
"
```

---

### VP-05 — Tipe Thermal mode

**Tujuan**: Toggle ke Thermal mode → @page size berubah ke 58mm, layout 1 voucher per strip.

**Mode**: 🟢 Auto

```typescript
test('VP-05 thermal mode', async ({ page }) => {
  await login(page)
  await page.goto(`${BASE}/vouchers/print`)
  await page.getByRole('combobox').filter({ hasText: 'Kartu A4' }).click()
  await page.getByRole('option', { name: /Thermal/ }).click()
  await page.getByRole('button', { name: 'Tampilkan Preview' }).click()
  // Thermal sheet should be visible
  await expect(page.locator('.thermal-sheet')).toBeVisible()
  await expect(page.locator('.thermal-card').first()).toBeVisible()
})
```

---

## Modul Reseller (RES)

### RES-01 — Tambah reseller baru

```bash
curl -s -X POST ${E2E_BASE_URL}/api/resellers \
  -b "${SESSION_COOKIE}" \
  -H "Content-Type: application/json" \
  -d '{"name":"E2E-Test","whatsapp":"6280000000","discount":20,"voucherGroup":"default"}'
```

### RES-02 — Diskon auto-fill di Generate Voucher

Lihat VG-02.

---

## Integrasi Mikhmon Compat (MK)

### MK-01 — Mikhmon UI baca profil kita dengan benar

**Tujuan**: Profil yang kita buat (header `:put (",remc,0,1d,0,,Disable,")`) terbaca rapi di Mikhmon UI dengan kolom Expired Mode = "Remove & Record" dan Validity = "1d".

**Mode**: 🟡 Manual (perlu Mikhmon installed & connected ke RouterOS yang sama)

**Langkah**:
1. Buka Mikhmon UI
2. Connect ke router yang sama (UmmiNEW/ummi)
3. Menu **Hotspot → User Profile**
4. Verifikasi profil "1jam"/"12jam"/"24jam" muncul dengan:
   - Kolom "Expired Mode" = `Remove & Record`
   - Kolom "Validity" = `1h` / `12h` / `1d`

### MK-02 — Parse profil Mikhmon-asli di dashboard kita

**Tujuan**: Profil yang dibuat via Mikhmon UI (e.g. "3K 12H", "5rb") parsed dengan benar di kita.

**Mode**: 🟢 Auto

```bash
curl -s "${E2E_AGENT_URL}/hotspot-profiles/${E2E_TELEGRAM_ID}" \
  | python -c "
import sys, json
data = json.load(sys.stdin)
expected = {
    '3K 12H':    {'validity': '12h', 'modalPrice': 2500, 'sellPrice': 3000},
    '5rb':       {'validity': '1d',  'modalPrice': 4000, 'sellPrice': 5000},
    'New-5K-1d': {'validity': '1d',  'modalPrice': 4000, 'sellPrice': 5000},
}
for p in data['profiles']:
    if p['name'] in expected:
        e = expected[p['name']]
        for k, v in e.items():
            assert p[k] == v, f'{p[\"name\"]}.{k}: expected {v}, got {p[k]}'
print('OK Mikhmon parser')
"
```

---

## End-to-End Flow (E2E)

### E2E-01 — Full flow: profile → voucher type → generate → print

**Tujuan**: Skenario lengkap dari setup profile sampai cetak voucher.

**Mode**: 🟢 Auto (Playwright + curl + DB)

**Langkah**:

1. **Setup profil** (PROF-01 atau via UI)
2. **Buat VoucherType** (VS-01) — opsional kalau pakai direct profile
3. **Generate 3 voucher** (VG-01 atau VG-02)
4. **Buka Cetak Voucher** (VP-01)
5. **Verifikasi tampilan**: 3 voucher tampil dengan validity, harga, reseller (kalau ada)
6. **Verifikasi data konsisten**:
   - VoucherBatch DB row exists
   - User di MikroTik exists dengan profile yang benar
   - Profile di MikroTik punya on-login script yang valid

**Snippet kombinasi**:

```typescript
test('E2E-01 full flow', async ({ page, request }) => {
  // 1. Buat profil via API
  await request.post(`${AGENT}/hotspot-profile/${TGID}`, {
    data: { name: "e2e-1h", validity: "1h", rateLimit: "1M/1M", router: ROUTER }
  })

  // 2. Generate 3 voucher
  const gen = await request.post(`${AGENT}/generate-vouchers/${TGID}`, {
    data: {
      profile: "e2e-1h", count: 3, prefix: "E-",
      password_length: 4, username_length: 4,
      router_name: ROUTER, price_per_unit: 1000,
    }
  })
  const result = await gen.json()
  expect(result.count).toBe(3)

  // 3. UI check di Cetak Voucher
  await login(page)
  await page.goto(`${BASE}/vouchers/print`)
  await page.getByRole('button', { name: 'Tampilkan Preview' }).click()
  await expect(page.locator('.vc')).toHaveCount(3)
  for (const v of result.vouchers) {
    await expect(page.getByText(v.username).first()).toBeVisible()
  }

  // 4. Cleanup (lihat Cleanup section)
  await cleanupBatch(result.vouchers)
})
```

---

### E2E-02 — Profile expiry full flow (real device, manual)

**Mode**: 🟡 Manual

**Langkah**:
1. Buat profil "test-realdevice" validity=5m
2. Generate 1 voucher
3. Connect HP ke SSID hotspot
4. Login dengan voucher
5. Buka Winbox → System → Scheduler. Verifikasi scheduler bernama sama dengan username muncul
6. Tunggu 5 menit
7. Verifikasi user & scheduler hilang dari RouterOS

---

### E2E-03 — Mikhmon ↔ Dashboard interop

**Mode**: 🟡 Manual

**Langkah**:
1. Buat profil "interop" via dashboard kita (validity=1d)
2. Buka Mikhmon UI → Hotspot → User Profile → cari "interop"
3. Verifikasi: Expired Mode = "Remove & Record", Validity = "1d", Lock = "Disable"
4. Edit di Mikhmon (ubah harga jadi 7500)
5. Refresh dashboard /vouchers/print → cek voucher baru dari profil interop tampil "Rp 7.500"

---

## Cleanup & Teardown

### Per-test cleanup

```bash
# Hapus profil test
for p in test-prof-5m test-prof-noexpiry test-mode-none e2e-1h interop; do
  curl -s -X DELETE "${E2E_AGENT_URL}/hotspot-profile/${E2E_TELEGRAM_ID}/${p}" || true
done

# Hapus user dengan prefix test (T-, E-, TA-)
docker exec mikrotik-agent python3 -c "
import sys; sys.path.insert(0, '/app/mikrotik_mcp')
from server import registry, connect_router
conn = registry.resolve('${E2E_TELEGRAM_ID}', None)
with connect_router(conn['host'], conn['port'], conn['username'], conn['password']) as api:
    res = api.path('ip','hotspot','user')
    for u in list(res):
        if u['name'].startswith(('T-','E-','TA-','vc-test-')):
            res.remove(u['.id'])
"

# Hapus VoucherBatch test
docker exec ${E2E_DB_CONTAINER} psql -U mikrotik -d mikrotik -c '
DELETE FROM "VoucherBatch" WHERE profile LIKE '"'"'test-%'"'"' OR profile = '"'"'e2e-1h'"'"';
'
```

### Convention

- Semua resource test pakai prefix `test-` atau `e2e-` untuk easy cleanup.
- Reseller test pakai prefix `E2E-`.
- Avoid menyentuh resource production (3K 12H, 5rb, Trial, dll) — hanya read-only verify.

---

## Cara AI Agent menjalankan ini

1. **Baca file ini** sebagai reference template.
2. **Pilih scope** test berdasarkan task (e.g. "test cetak voucher" → jalankan VP-01..VP-05).
3. **Setup env** dari `Setup & Prasyarat Umum` section.
4. **Eksekusi snippet** sesuai mode (curl untuk API, Playwright untuk UI, docker exec untuk DB).
5. **Cleanup** setelah selesai (penting!).
6. **Report** hasil ke user dengan format:
   - ✅ ID-XX passed
   - ❌ ID-XX failed: <reason>
   - 🟡 ID-XX manual (skipped)

### Convention untuk reproducibility

- Semua snippet harus self-contained (env vars di awal section).
- Assertion eksplisit (`assert ...`, `expect(...)`) supaya pass/fail jelas.
- Output cleanup harus idempotent (`|| true`, `IF EXISTS`, dll).

---

## Versi & maintenance

| Versi | Tanggal     | Catatan                                                                  |
|-------|-------------|--------------------------------------------------------------------------|
| 1.0   | 2026-04-29  | Initial — covers PROF, VG, VS, VP, RES, MK, E2E modules.                 |

Update doc ini saat:
- Ada modul baru (tambah section)
- API contract berubah (update snippets)
- Skenario kritis baru ditemukan saat development
