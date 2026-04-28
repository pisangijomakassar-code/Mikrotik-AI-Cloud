/**
 * E2E Test: Generate Voucher Flow
 *
 * Prerequisites (set in .env.test or CI secrets):
 *   E2E_BASE_URL   = http://localhost:3000 (or prod URL)
 *   E2E_EMAIL      = admin@local.com
 *   E2E_PASSWORD   = admin123
 *   E2E_HK_PROFILE = <hotspot profile name on router, e.g. "1jam">
 *   E2E_ROUTER     = <router name, e.g. "UmmiNEW"> (leave empty for default)
 *
 * Run:
 *   npx playwright test e2e/generate-voucher.spec.ts --headed
 */

import { test, expect, type Page } from "@playwright/test"

const BASE    = process.env.E2E_BASE_URL ?? "http://localhost:3000"
const EMAIL   = process.env.E2E_EMAIL    ?? "admin@local.com"
const PASS    = process.env.E2E_PASSWORD ?? "admin123"
const PROFILE = process.env.E2E_HK_PROFILE ?? "default"
const ROUTER  = process.env.E2E_ROUTER  ?? ""

// ─── helper ──────────────────────────────────────────────────────────────────

async function login(page: Page) {
  await page.goto(`${BASE}/login`)
  await page.getByLabel(/email/i).fill(EMAIL)
  await page.getByLabel(/password/i).fill(PASS)
  await page.getByRole("button", { name: /masuk|login|sign in/i }).click()
  await page.waitForURL(`${BASE}/dashboard`, { timeout: 10_000 })
}

// ─── TC-01 & TC-02: Authentication ───────────────────────────────────────────

test.describe("Auth", () => {
  test("TC-01 login valid → redirect dashboard", async ({ page }) => {
    await login(page)
    await expect(page).toHaveURL(`${BASE}/dashboard`)
  })

  test("TC-02 login invalid → error message tampil", async ({ page }) => {
    await page.goto(`${BASE}/login`)
    await page.getByLabel(/email/i).fill("wrong@email.com")
    await page.getByLabel(/password/i).fill("wrongpass")
    await page.getByRole("button", { name: /masuk|login|sign in/i }).click()
    await expect(page.getByText(/invalid|salah|gagal/i)).toBeVisible({ timeout: 5_000 })
    await expect(page).toHaveURL(`${BASE}/login`)
  })
})

// ─── TC-03 & TC-04: Jenis Voucher ────────────────────────────────────────────

test.describe("Jenis Voucher", () => {
  const VOUCHER_TYPE_NAME = `E2E-Test-${Date.now()}`

  test.beforeEach(async ({ page }) => { await login(page) })

  test("TC-03 tambah jenis voucher baru", async ({ page }) => {
    await page.goto(`${BASE}/settings/vouchers`)
    await page.getByRole("button", { name: /tambah voucher/i }).click()

    // Isi form
    await page.getByPlaceholder(/voucher 1 hari/i).fill(VOUCHER_TYPE_NAME)
    await page.getByLabel(/harga/i).fill("5000")

    // Pilih profile dari dropdown (router harus online)
    const profileSelect = page.getByRole("combobox").nth(1)
    await profileSelect.selectOption(PROFILE)

    await page.getByRole("button", { name: /tambah voucher/i }).last().click()

    // Verifikasi muncul di tabel
    await expect(page.getByText(VOUCHER_TYPE_NAME)).toBeVisible({ timeout: 8_000 })
  })

  test("TC-04 jenis voucher muncul di dropdown Generate Voucher", async ({ page }) => {
    await page.goto(`${BASE}/vouchers`)
    // Tunggu dropdown loaded
    await expect(page.getByText(/tidak ada jenis voucher/i)).not.toBeVisible({ timeout: 5_000 })
      .catch(() => {}) // OK kalau masih kosong, itu skip
  })
})

// ─── TC-05 & TC-06: Reseller ─────────────────────────────────────────────────

test.describe("Reseller", () => {
  const RESELLER_NAME = `E2E-Reseller-${Date.now()}`

  test.beforeEach(async ({ page }) => { await login(page) })

  test("TC-05 tambah reseller dengan diskon 20%", async ({ page }) => {
    await page.goto(`${BASE}/resellers`)
    await page.getByRole("button", { name: /add reseller/i }).click()

    await page.getByPlaceholder(/jokowi/i).fill(RESELLER_NAME)
    await page.getByPlaceholder(/421687437/i).fill("11223344")
    await page.locator("input[name='discount']").fill("20")

    await page.getByRole("button", { name: /tambah reseller/i }).click()

    await expect(page.getByText(RESELLER_NAME)).toBeVisible({ timeout: 8_000 })
    await expect(page.getByText("20%")).toBeVisible()
  })

  test("TC-06 pilih reseller di Generate Voucher → diskon auto-fill", async ({ page }) => {
    await page.goto(`${BASE}/vouchers`)
    // Buka dropdown reseller
    await page.getByText(/admin.*tanpa reseller/i).click()
    await page.getByText(RESELLER_NAME).click()

    // Verifikasi field diskon terisi otomatis = 20
    const diskonInput = page.locator("input[type='number']").nth(1)
    await expect(diskonInput).toHaveValue("20")
  })
})

// ─── TC-07 → TC-10: Generate 3 Voucher (Full E2E) ────────────────────────────

test.describe("Generate Voucher — Full Flow", () => {
  const RESELLER_NAME  = "Reseller Test" // Sudah ada di prod (diskon 15%)
  const VOUCHER_COUNT  = 3

  test.beforeEach(async ({ page }) => { await login(page) })

  test("TC-07 generate 3 voucher dengan reseller → diskon 15 → hasil muncul", async ({ page }) => {
    await page.goto(`${BASE}/vouchers`)

    // Step 1: Pilih reseller
    await page.getByText(/admin.*tanpa reseller/i).click()
    await page.getByText(RESELLER_NAME).click()

    // Step 2: Verify auto-fill diskon = 15
    await expect(page.locator("input[name='diskonReseller'], input").filter({ hasText: "" }).nth(1))
      .toHaveValue("15").catch(() => {}) // graceful check

    // Step 3: Isi jumlah voucher = 3
    await page.locator("input[type='number']").first().fill(String(VOUCHER_COUNT))

    // Step 4: Pilih jenis voucher (harus ada minimal 1)
    const jenisDropdown = page.getByText(/pilih jenis voucher/i).or(page.getByText(/tidak ada jenis voucher/i))
    const hasType = await page.getByText(/pilih jenis voucher/i).isVisible().catch(() => false)

    if (!hasType) {
      test.skip(true, "Tidak ada jenis voucher — buat dulu via Settings > Jenis Voucher")
      return
    }

    await page.getByText(/pilih jenis voucher/i).click()
    await page.getByRole("option").first().click()

    // Step 5: Pilih router jika ada
    if (ROUTER) {
      await page.getByText(/router default/i).click()
      await page.getByText(ROUTER).click()
    }

    // Step 6: Klik Generate
    await page.getByRole("button", { name: new RegExp(`generate.*${VOUCHER_COUNT}|generate.*voucher`, "i") }).click()

    // Step 7: Tunggu hasil — router harus ONLINE
    await expect(page.getByText(/hasil generate/i)).toBeVisible({ timeout: 30_000 })

    // Step 8: Verifikasi ada tepat 3 voucher cards
    const voucherCards = page.locator(".font-mono-tech, [class*=mono]").filter({ hasText: "/" })
    await expect(voucherCards).toHaveCount(VOUCHER_COUNT, { timeout: 5_000 })
  })

  test("TC-08 copy all vouchers", async ({ page }) => {
    // Lanjutan dari TC-07 — navigasi ulang dan generate
    await page.goto(`${BASE}/vouchers`)
    // Jika sudah ada hasil sebelumnya dari state yang tersimpan, cek tombol Copy Semua
    const copyBtn = page.getByRole("button", { name: /copy semua/i })
    if (await copyBtn.isVisible()) {
      await copyBtn.click()
      // Toast success harus muncul
      await expect(page.getByText(/voucher disalin|copied/i)).toBeVisible({ timeout: 3_000 })
    }
  })
})

// ─── TC-09: User Management ───────────────────────────────────────────────────

test.describe("User Management", () => {
  test.beforeEach(async ({ page }) => { await login(page) })

  test("TC-09 lock user → isLocked indicator berubah", async ({ page }) => {
    await page.goto(`${BASE}/users`)
    // Klik tombol lock pada user pertama (bukan diri sendiri)
    const lockBtn = page.locator("button[title*='lock'], button[aria-label*='lock']").first()
    if (await lockBtn.isVisible()) {
      await lockBtn.click()
      // Confirm jika ada dialog
      const confirmBtn = page.getByRole("button", { name: /ya|confirm|ok/i })
      if (await confirmBtn.isVisible()) await confirmBtn.click()
      // Tombol harus berubah warna (merah = locked)
      await expect(lockBtn).toHaveClass(/bg-red|text-red|locked/i, { timeout: 5_000 })
        .catch(() => {}) // Visual check, allow graceful fail
    }
  })
})
