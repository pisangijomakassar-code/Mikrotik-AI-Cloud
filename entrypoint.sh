#!/bin/bash
set -e

# Setup nanobot config dir and skills
mkdir -p /root/.nanobot/skills
# -n treats existing symlink as file (prevents mikrotik/mikrotik double path)
ln -sfn /app/skills/mikrotik /root/.nanobot/skills/mikrotik

# Copy config template (nanobot resolves ${VAR} natively)
cp /app/config/config.json /root/.nanobot/config.json

# Always overwrite SOUL.md to keep personality in sync with repo
cp /app/config/SOUL.md /root/.nanobot/workspace/SOUL.md 2>/dev/null || true
cp /app/config/HEARTBEAT.md /root/.nanobot/workspace/HEARTBEAT.md 2>/dev/null || true

echo "[entrypoint] Config + SOUL.md + HEARTBEAT.md applied, starting nanobot..."
exec nanobot "$@"
