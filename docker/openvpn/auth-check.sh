#!/bin/sh
# Verify OpenVPN username/password via-file.
# OpenVPN passes the path of a file containing username (line 1) and password (line 2)
# as the first argument to this script.
USERS_FILE=/config/users.txt
DEBUG_LOG=/config/auth-debug.log
CRED_FILE="$1"

if [ -z "$CRED_FILE" ] || [ ! -f "$CRED_FILE" ]; then
    echo "$(date) FAIL no cred file: '$CRED_FILE'" >> "$DEBUG_LOG"
    exit 1
fi

USER=$(sed -n '1p' "$CRED_FILE")
PASS=$(sed -n '2p' "$CRED_FILE")

if [ -z "$USER" ] || [ -z "$PASS" ]; then
    echo "$(date) FAIL empty user='$USER' pass_len=${#PASS}" >> "$DEBUG_LOG"
    exit 1
fi

PW_HASH=$(printf '%s' "$PASS" | sha256sum | cut -d' ' -f1)
EXPECTED=$(grep "^${USER}:" "$USERS_FILE" 2>/dev/null | head -1 | cut -d: -f2)

echo "$(date) user='$USER' pass_len=${#PASS} computed=$PW_HASH expected=$EXPECTED" >> "$DEBUG_LOG"

if [ "$PW_HASH" = "$EXPECTED" ]; then
    exit 0
fi
exit 1
