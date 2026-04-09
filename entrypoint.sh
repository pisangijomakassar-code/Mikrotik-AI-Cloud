#!/bin/bash
set -e

# Setup nanobot config dir and skills
mkdir -p /root/.nanobot/skills
# -n treats existing symlink as file (prevents mikrotik/mikrotik double path)
ln -sfn /app/skills/mikrotik /root/.nanobot/skills/mikrotik

# Use generated config (from dashboard) if available, else template
if [ -f /app/config/config.generated.json ]; then
    cp /app/config/config.generated.json /root/.nanobot/config.json
else
    cp /app/config/config.json /root/.nanobot/config.json
fi

# Always overwrite SOUL.md to keep personality in sync with repo
cp /app/config/SOUL.md /root/.nanobot/workspace/SOUL.md 2>/dev/null || true
cp /app/config/HEARTBEAT.md /root/.nanobot/workspace/HEARTBEAT.md 2>/dev/null || true

echo "[entrypoint] Config + SOUL.md + HEARTBEAT.md applied, starting nanobot..."
exec nanobot "$@"
