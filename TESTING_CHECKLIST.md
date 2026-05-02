# 📋 Testing Checklist - Reports & Mikhmon Import Fix

## ✅ Changes Made

### 1. **Reports Page UI Enhancement**
- ✓ Added month picker (`<input type="month">`) as primary filter
- ✓ Moved custom date range to collapsible section
- ✓ Added `handleMonthChange()` function to auto-set from/to dates
- **File**: `dashboard/app/(dashboard)/reports/page.tsx`

### 2. **Mikhmon Import - Grouping Fix**
- ✓ Changed grouping from `(owner, profile)` → `(month_from_date, profile)`
- ✓ Date month extracted from script name: "2025-01-15" → "2025-01"
- ✓ Source field now includes month: `mikhmon_import:2025-01`
- **File**: `mikrotik_mcp/health_server.py` lines 1291-1357

### 3. **VoucherDB - Timestamp Support**
- ✓ Added `created_at` parameter to `save_batch()`
- ✓ Defaults to current time if not provided (backward compatible)
- ✓ Mikhmon import passes date from script as `created_at`
- **File**: `mikrotik_mcp/voucher_db.py` line 67-78

### 4. **Cleanup Script**
- ✓ Created script to delete old Mikhmon batches
- **File**: `dashboard/scripts/cleanup-mikhmon.ts`

---

## 🧪 Test Plan

### Pre-Test Setup
```bash
# 1. Build dashboard
cd dashboard && npm run build

# 2. Restart services
docker-compose down && docker-compose up -d --build

# 3. Clean old data
npx tsx scripts/cleanup-mikhmon.ts

# 4. Re-import Mikhmon from dashboard
# Navigate to: Hotspot → Import Mikhmon → Click Import
```

---

## 📊 Test Scenarios

### TEST 1: Month Picker Functionality ✓
**Location**: Reports page → "Pilih Bulan" dropdown

**Steps**:
1. Open Reports page
2. See "Pilih Bulan" dropdown with current month selected
3. Change to different month (e.g., Jan 2025)
4. Click "Tampilkan"
5. Check table data updates with new month's data

**Expected Result**:
- ✓ Month selector visible and functional
- ✓ Data changes when month changes
- ✓ Totals reflect selected month only

**Acceptance Criteria**:
```
Example: If selecting Jan 2025:
  - Shows only Jan 2025 batches
  - Total Revenue ≠ Total Revenue of Feb 2025
  - Per-batch data matches date in batch
```

---

### TEST 2: Date Filter Still Works (Backward Compatibility) ✓
**Location**: Reports page → "Tanggal Custom (opsional)" section

**Steps**:
1. Click details to expand custom date range
2. Set custom from/to dates
3. Click "Tampilkan"
4. Verify data updates to match custom range

**Expected Result**:
- ✓ Custom date range filter works
- ✓ Overrides month selection
- ✓ Allows precise filtering

---

### TEST 3: Per-Month Totals Are Correct ✓
**Location**: Reports page → "Voucher Terjual" table

**Verify for each month**:
```
Column Headers: Tanggal | Router | Profil | Jumlah | Harga/Voucher | Total | Reseller | Sumber

For each row:
  Total = Jumlah × Harga/Voucher ✓
  
Example:
  2025-01-15 | RT01 | default | 42 | 2,500 | 105,000 | - | mikhmon_import:2025-01
  
  Verify: 42 × 2,500 = 105,000 ✓
```

**Acceptance Criteria**:
- ✓ All rows: `Total = Jumlah × Harga/Voucher`
- ✓ No data corruption or duplication
- ✓ Source field shows correct month tag

---

### TEST 4: Summary Totals Match Filtered Data ✓
**Location**: Reports page → Summary cards at top

**Steps**:
1. Select month (Jan 2025)
2. Note "Total Penjualan" value
3. Manually sum all "Total" values in table
4. Verify they match

**Expected Result**:
- ✓ Summary card total = Sum of filtered batches
- ✓ No double-counting
- ✓ No missing data

**Formula Verification**:
```
Summary "Total Penjualan" = SUM(batches where createdAt in selected month)
```

---

### TEST 5: Reseller Filter Works With Month Filter ✓
**Location**: Reports page → "Filter Reseller" dropdown (if resellers exist)

**Steps**:
1. Select a month
2. Select a specific reseller
3. Click "Tampilkan"
4. Verify only that reseller's batches appear

**Expected Result**:
- ✓ Month + Reseller filters work together
- ✓ Data reflects both filters

---

### TEST 6: Multiple Months Have Different Data ✓
**Verification Test** (Critical!)

Compare data across months:
```
Month        | Total Vouchers | Total Revenue
2025-01      | 160           | Rp 1,200,000
2025-02      | 145           | Rp 980,000
2025-03      | 128           | Rp 856,000

✓ PASS if all totals are DIFFERENT
✗ FAIL if all months show same total (indicates grouping still broken)
```

---

## 🔍 Verification Queries

If you need to verify data in database:

```sql
-- Check batch grouping by month
SELECT 
  "createdAt"::date as date,
  "profile",
  COUNT(*) as batch_count,
  SUM("count") as total_vouchers,
  SUM("totalCost") as total_revenue,
  "source"
FROM "VoucherBatch"
WHERE "source" LIKE 'mikhmon_import:%'
GROUP BY "createdAt"::date, "profile", "source"
ORDER BY "createdAt" DESC;

-- Check for duplicates
SELECT "source", COUNT(*) as cnt
FROM "VoucherBatch"
WHERE "source" LIKE 'mikhmon_import:%'
GROUP BY "source"
HAVING COUNT(*) > 1;
```

---

## ❌ Known Issues / Edge Cases

### Issue: "Still seeing same total for all months"
**Cause**: Old data still in database (not re-imported with new code)
**Solution**: 
1. Run cleanup script: `npx tsx scripts/cleanup-mikhmon.ts`
2. Re-import from dashboard
3. Verify `createdAt` in database uses actual date from scripts

### Issue: "Month picker not visible"
**Cause**: UI changes not applied
**Solution**:
1. Verify changes in `reports/page.tsx`
2. Run `npm run build`
3. Restart dev server

### Issue: "Custom date range not working"
**Cause**: May need to deselect month first
**Solution**: Click on custom date fields (automatically clears month)

---

## 📝 Test Results Template

Use this to record results:

```
Date: ___________
Tested By: ___________

TEST 1: Month Picker Functionality
  [ ] Pass  [ ] Fail  
  Notes: _______________

TEST 2: Date Filter Backward Compatibility
  [ ] Pass  [ ] Fail
  Notes: _______________

TEST 3: Per-Month Totals Correct
  [ ] Pass  [ ] Fail
  Notes: _______________

TEST 4: Summary Totals Match
  [ ] Pass  [ ] Fail
  Notes: _______________

TEST 5: Reseller Filter Works
  [ ] Pass  [ ] Fail
  Notes: _______________

TEST 6: Multiple Months Have Different Data
  [ ] Pass  [ ] Fail
  Notes: _______________

Overall: [ ] ALL PASS  [ ] PARTIAL  [ ] FAIL
```

---

## 🚀 After Testing

If all tests pass:
1. Clean up test data if needed
2. Run full scenario tests
3. Deploy to production

If any test fails:
1. Check database for bad data
2. Review code changes
3. Consult error logs in `mikrotik_mcp/`
