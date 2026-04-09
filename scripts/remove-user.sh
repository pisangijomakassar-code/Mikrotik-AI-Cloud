#!/bin/bash
# Remove a user from the MikroTik AI Agent
# Usage: ./scripts/remove-user.sh <telegram_user_id>

set -e

TELEGRAM_USER_ID=$1

if [ -z "$TELEGRAM_USER_ID" ]; then
    echo "Usage: ./scripts/remove-user.sh <telegram_user_id>"
    exit 1
fi

# Find config
if [ -f /opt/mikrotik-ai-agent/config/config.json ]; then
    CONFIG_FILE=/opt/mikrotik-ai-agent/config/config.json
    DATA_DIR=/opt/mikrotik-ai-agent/data
elif [ -f config/config.json ]; then
    CONFIG_FILE=config/config.json
    DATA_DIR=data
else
    echo "Error: config/config.json not found"
    exit 1
fi

# Remove from allowFrom
python3 -c "
import json
with open('$CONFIG_FILE', 'r') as f:
    c = json.load(f)
allow = c.get('channels',{}).get('telegram',{}).get('allowFrom',[])
if '$TELEGRAM_USER_ID' in allow:
    allow.remove('$TELEGRAM_USER_ID')
    with open('$CONFIG_FILE', 'w') as f:
        json.dump(c, f, indent=2)
    print('Removed $TELEGRAM_USER_ID from allowFrom')
else:
    print('User $TELEGRAM_USER_ID not found in allowFrom')
"

# Optionally remove user data
if [ -f "$DATA_DIR/$TELEGRAM_USER_ID.json" ]; then
    echo "User data file found: $DATA_DIR/$TELEGRAM_USER_ID.json"
    read -p "Delete user data? (y/N) " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        rm "$DATA_DIR/$TELEGRAM_USER_ID.json"
        echo "User data deleted"
    fi
fi

echo "User removed: $TELEGRAM_USER_ID"
echo "Restart to apply: docker compose restart mikrotik-agent"
