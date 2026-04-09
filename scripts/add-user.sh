#!/bin/bash
# Add a user to the MikroTik AI Agent
# Usage: ./scripts/add-user.sh <telegram_user_id> [name]
# Example: ./scripts/add-user.sh 12345678 "Pak Budi"

set -e

TELEGRAM_USER_ID=$1
USER_NAME=${2:-"User $1"}

if [ -z "$TELEGRAM_USER_ID" ]; then
    echo "Usage: ./scripts/add-user.sh <telegram_user_id> [name]"
    echo "Example: ./scripts/add-user.sh 12345678 'Pak Budi'"
    exit 1
fi

# Determine if running on VPS or local
if [ -f /opt/mikrotik-ai-agent/config/config.json ]; then
    CONFIG_FILE=/opt/mikrotik-ai-agent/config/config.json
    APP_DIR=/opt/mikrotik-ai-agent
elif [ -f config/config.json ]; then
    CONFIG_FILE=config/config.json
    APP_DIR=.
else
    echo "Error: config/config.json not found"
    exit 1
fi

# Check if user already exists in allowFrom
if python3 -c "
import json
with open('$CONFIG_FILE') as f:
    c = json.load(f)
allow = c.get('channels',{}).get('telegram',{}).get('allowFrom',[])
exit(0 if '$TELEGRAM_USER_ID' in allow else 1)
" 2>/dev/null; then
    echo "User $TELEGRAM_USER_ID already exists in allowFrom"
    exit 0
fi

# Add user to allowFrom
python3 -c "
import json
with open('$CONFIG_FILE', 'r') as f:
    c = json.load(f)
allow = c.setdefault('channels',{}).setdefault('telegram',{}).setdefault('allowFrom',[])
allow.append('$TELEGRAM_USER_ID')
with open('$CONFIG_FILE', 'w') as f:
    json.dump(c, f, indent=2)
print('Added $TELEGRAM_USER_ID to allowFrom')
"

echo "User added: $USER_NAME (ID: $TELEGRAM_USER_ID)"
echo ""
echo "Next steps:"
echo "  1. Commit and push: git add config/config.json && git commit -m 'feat: add user $USER_NAME' && git push"
echo "  2. Or restart manually: cd $APP_DIR && docker compose restart mikrotik-agent"
echo "  3. User can now message the Telegram bot to register their routers"
