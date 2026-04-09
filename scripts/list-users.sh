#!/bin/bash
# List all users of the MikroTik AI Agent
# Usage: ./scripts/list-users.sh

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

echo "=== MikroTik AI Agent Users ==="
echo ""

python3 -c "
import json, os

# Load allowFrom
with open('$CONFIG_FILE') as f:
    c = json.load(f)
allow = c.get('channels',{}).get('telegram',{}).get('allowFrom',[])

print(f'Allowed users ({len(allow)}):')
print()

for uid in allow:
    if uid == '\${TELEGRAM_USER_ID}':
        uid_display = uid + ' (env var)'
    else:
        uid_display = uid

    # Check if user has data
    data_file = os.path.join('$DATA_DIR', f'{uid}.json')
    if os.path.exists(data_file):
        with open(data_file) as f:
            d = json.load(f)
        routers = list(d.get('routers', {}).keys())
        default = d.get('default_router', '')
        print(f'  {uid_display}')
        print(f'    Routers ({len(routers)}): {\", \".join(routers)}')
        print(f'    Default: {default}')
    else:
        print(f'  {uid_display} (no routers registered)')
    print()
"
