#!/bin/bash
set -e

# Setup nanobot config dir and skills
mkdir -p /root/.nanobot/skills
ln -sfn /app/skills/mikrotik /root/.nanobot/skills/mikrotik

# Use generated config (from dashboard) if available, else template
if [ -f /app/config/config.generated.json ]; then
    cp /app/config/config.generated.json /root/.nanobot/config.json
else
    cp /app/config/config.json /root/.nanobot/config.json
fi

# Always overwrite SOUL.md and HEARTBEAT.md
cp /app/config/SOUL.md /root/.nanobot/workspace/SOUL.md 2>/dev/null || true
cp /app/config/HEARTBEAT.md /root/.nanobot/workspace/HEARTBEAT.md 2>/dev/null || true

# Start health API server in background (port 8080, for dashboard to query router data)
python /app/mikrotik_mcp/health_server.py &

echo "[entrypoint] Config + SOUL.md + HEARTBEAT.md applied, health server started, starting nanobot..."
exec nanobot "$@"
