#!/bin/sh
# Verify OpenVPN username/password via-env.
# health_server.py stores credentials as: username:sha256(password)
USERS_FILE=/config/users.txt
DEBUG_LOG=/config/auth-debug.log
USER="$username"
PASS="$password"

if [ -z "$USER" ] || [ -z "$PASS" ]; then
    echo "$(date) FAIL empty user='$USER' pass_len=${#PASS}" >> "$DEBUG_LOG"
    exit 1
fi

PW_HASH=$(echo -n "$PASS" | sha256sum | cut -d' ' -f1)
EXPECTED=$(grep "^${USER}:" "$USERS_FILE" 2>/dev/null | head -1 | cut -d: -f2)

echo "$(date) user='$USER' pass_len=${#PASS} computed=$PW_HASH expected=$EXPECTED" >> "$DEBUG_LOG"

if [ "$PW_HASH" = "$EXPECTED" ]; then
    exit 0
fi
exit 1
