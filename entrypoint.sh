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
python3 /app/mikrotik_mcp/health_server.py &

# Start reseller bot (if configured)
python3 /app/mikrotik_mcp/reseller_bot.py &

# --- Hot reload: watch config changes and restart nanobot process only ---
NANOBOT_PID=0

start_nanobot() {
    echo "[entrypoint] Starting nanobot $*..."
    nanobot "$@" &
    NANOBOT_PID=$!
    echo "[entrypoint] nanobot started (PID $NANOBOT_PID)"
}

reload_nanobot() {
    echo "[entrypoint] Config change detected, reloading nanobot..."
    # Copy fresh config
    if [ -f /app/config/config.generated.json ]; then
        cp /app/config/config.generated.json /root/.nanobot/config.json
        echo "[entrypoint] config.json updated from config.generated.json"
    fi
    # Gracefully stop nanobot
    if [ $NANOBOT_PID -ne 0 ] && kill -0 $NANOBOT_PID 2>/dev/null; then
        echo "[entrypoint] Stopping nanobot (PID $NANOBOT_PID)..."
        kill -TERM $NANOBOT_PID
        # Wait up to 10s for graceful shutdown
        for i in $(seq 1 10); do
            if ! kill -0 $NANOBOT_PID 2>/dev/null; then
                break
            fi
            sleep 1
        done
        # Force kill if still running
        if kill -0 $NANOBOT_PID 2>/dev/null; then
            echo "[entrypoint] Force killing nanobot..."
            kill -9 $NANOBOT_PID 2>/dev/null || true
        fi
    fi
    # Restart
    start_nanobot "$@"
}

# Watch config file for changes in background
watch_config() {
    local nanobot_args=("$@")
    echo "[entrypoint] Watching /app/config/config.generated.json for changes..."
    while true; do
        # inotifywait blocks until a modify/create event occurs
        inotifywait -q -e modify,create /app/config/config.generated.json 2>/dev/null
        echo "[entrypoint] Config file change detected!"
        # Small debounce - wait for writes to settle
        sleep 2
        reload_nanobot "${nanobot_args[@]}"
    done
}

# Trap signals for clean shutdown
cleanup() {
    echo "[entrypoint] Shutting down..."
    if [ $NANOBOT_PID -ne 0 ] && kill -0 $NANOBOT_PID 2>/dev/null; then
        kill -TERM $NANOBOT_PID
        wait $NANOBOT_PID 2>/dev/null
    fi
    exit 0
}
trap cleanup SIGTERM SIGINT

echo "[entrypoint] Config + SOUL.md + HEARTBEAT.md applied, health server started"

# Start nanobot
start_nanobot "$@"

# Start config watcher in background
watch_config "$@" &
WATCHER_PID=$!

# Wait for nanobot process — if it dies unexpectedly, restart it
while true; do
    if ! kill -0 $NANOBOT_PID 2>/dev/null; then
        echo "[entrypoint] nanobot exited unexpectedly, restarting in 3s..."
        sleep 3
        start_nanobot "$@"
    fi
    sleep 5
done
