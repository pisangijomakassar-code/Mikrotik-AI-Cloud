#!/bin/bash
set -e

# Setup nanobot config dir and skills
mkdir -p /root/.nanobot/skills
# -n treats existing symlink as file (prevents mikrotik/mikrotik double path)
ln -sfn /app/skills/mikrotik /root/.nanobot/skills/mikrotik

# Copy config template (nanobot resolves ${VAR} natively)
cp /app/config/config.json /root/.nanobot/config.json

echo "[entrypoint] Config copied, starting nanobot..."
exec nanobot "$@"
