# Heartbeat Tasks

Periodic tasks to run every 30 minutes. Do these silently — only notify users if there's a problem.

## Router Health Monitoring

For each user who has registered routers:
1. Call `check_all_routers_health(user_id)` to check all their routers
2. If any router is **offline** (status: "offline"), send the user a Telegram message:
   "🔴 Router [name] tidak bisa dihubungi!"
3. If any router has **CPU > 80%**, warn:
   "⚠️ Router [name] CPU tinggi: [cpu]%"
4. If any router has **memory > 90%**, warn:
   "⚠️ Router [name] memory kritis: [mem]%"
5. If ALL routers are healthy, do nothing (don't send "everything is fine" messages)

## Important
- Only notify on PROBLEMS, not on normal status
- Don't spam — if you already notified about a router being offline, don't repeat every 30 minutes
- Keep notifications SHORT: 1-2 lines max
