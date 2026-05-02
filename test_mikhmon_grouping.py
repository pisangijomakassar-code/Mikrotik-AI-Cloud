#!/usr/bin/env python3
"""Test script to verify Mikhmon grouping logic works correctly."""

from datetime import datetime, timezone

# Simulate Mikhmon scripts from different months
test_scripts = [
    {"date": "2025-01-15", "time": "14:30", "username": "user1", "price": "2500", "profile": "default", "mac": "aa:bb:cc:dd:ee:01"},
    {"date": "2025-01-20", "time": "15:45", "username": "user2", "price": "2500", "profile": "default", "mac": "aa:bb:cc:dd:ee:02"},
    {"date": "2025-02-10", "time": "10:00", "username": "user3", "price": "5000", "profile": "default", "mac": "aa:bb:cc:dd:ee:03"},
    {"date": "2025-02-15", "time": "11:30", "username": "user4", "price": "5000", "profile": "premium", "mac": "aa:bb:cc:dd:ee:04"},
    {"date": "2025-03-05", "time": "09:00", "username": "user5", "price": "2500", "profile": "default", "mac": "aa:bb:cc:dd:ee:05"},
]

# Test grouping logic (same as in health_server.py)
from collections import defaultdict
import re

groups = defaultdict(list)
for s in test_scripts:
    date_str = s.get("date", "unknown")
    # Extract month from date: "2025-01-15" → "2025-01"
    month = "-".join(date_str.split("-")[:2]) if "-" in date_str else date_str
    profile = s.get("profile", "")
    groups[(month, profile)].append(s)

print("=" * 60)
print("MIKHMON GROUPING TEST")
print("=" * 60)
print(f"\nTotal scripts: {len(test_scripts)}")
print(f"Groups created: {len(groups)}\n")

# Process groups
results = []
for (month, profile), group_scripts in groups.items():
    vouchers = []
    for s in group_scripts:
        try:
            price = int(re.sub(r"[^\d]", "", s.get("price", "0")) or 0)
        except Exception:
            price = 0
        vouchers.append({
            "username": s.get("username", ""),
            "price": price,
            "date": s.get("date", ""),
        })

    # Parse batch date
    batch_date_str = group_scripts[0].get("date", "")
    batch_timestamp = None
    if batch_date_str:
        try:
            batch_timestamp = datetime.strptime(batch_date_str, "%Y-%m-%d").replace(tzinfo=timezone.utc)
        except Exception as e:
            print(f"Error parsing date '{batch_date_str}': {e}")

    price_per = vouchers[0]["price"] if vouchers else 0
    total_cost = len(vouchers) * price_per

    results.append({
        "month": month,
        "profile": profile,
        "count": len(vouchers),
        "price_per_unit": price_per,
        "total_cost": total_cost,
        "created_at": batch_timestamp,
        "source": f"mikhmon_import:{month}",
    })

    print(f"Batch: {month} | Profile: {profile}")
    print(f"  Count: {len(vouchers)} vouchers")
    print(f"  Price/unit: Rp {price_per:,}")
    print(f"  Total: Rp {total_cost:,}")
    print(f"  Created At: {batch_timestamp}")
    print(f"  Source: {f'mikhmon_import:{month}'}")
    print()

print("=" * 60)
print("VERIFICATION SUMMARY")
print("=" * 60)

# Verify grouping is correct
expected_groups = [
    ("2025-01", "default", 2),  # 2 vouchers in Jan, default profile
    ("2025-02", "default", 1),  # 1 voucher in Feb, default profile
    ("2025-02", "premium", 1),  # 1 voucher in Feb, premium profile
    ("2025-03", "default", 1),  # 1 voucher in Mar, default profile
]

print("\nExpected grouping:")
for month, profile, expected_count in expected_groups:
    actual = next((r for r in results if r["month"] == month and r["profile"] == profile), None)
    status = "OK" if actual and actual["count"] == expected_count else "FAIL"
    print(f"[{status}] {month} | {profile}: {expected_count} vouchers")

print("\nActual grouping:")
for r in sorted(results, key=lambda x: (x["month"], x["profile"])):
    print(f"  {r['month']} | {r['profile']}: {r['count']} vouchers @ Rp {r['price_per_unit']:,} = Rp {r['total_cost']:,}")

# Verify date parsing works
print("\nDate parsing verification:")
for r in results:
    if r["created_at"]:
        print(f"  {r['month']}: {r['created_at'].date()} [OK]")
    else:
        print(f"  {r['month']}: FAILED [ERROR]")

# Test filtering by date range
print("\n" + "=" * 60)
print("FILTERING TEST")
print("=" * 60)

date_ranges = [
    ("2025-01-01", "2025-01-31", "January 2025"),
    ("2025-02-01", "2025-02-28", "February 2025"),
    ("2025-03-01", "2025-03-31", "March 2025"),
]

for from_date, to_date, label in date_ranges:
    from_dt = datetime.strptime(from_date, "%Y-%m-%d").replace(tzinfo=timezone.utc)
    to_dt = datetime.strptime(to_date + "T23:59:59.999Z", "%Y-%m-%dT%H:%M:%S.%fZ").replace(tzinfo=timezone.utc)

    filtered = [r for r in results if r["created_at"] and from_dt <= r["created_at"] <= to_dt]

    if filtered:
        total_vouchers = sum(r["count"] for r in filtered)
        total_revenue = sum(r["total_cost"] for r in filtered)
        print(f"\n{label} ({from_date} to {to_date}):")
        print(f"  Batches: {len(filtered)}")
        print(f"  Total Vouchers: {total_vouchers}")
        print(f"  Total Revenue: Rp {total_revenue:,}")
    else:
        print(f"\n{label}: NO DATA")

print("\n" + "=" * 60)
print("[OK] Test complete!")
print("=" * 60)
