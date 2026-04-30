#!/bin/sh
# Verify OpenVPN username/password via-env.
# health_server.py stores credentials as: username:sha256(password)
USERS_FILE=/config/users.txt
USER="$username"
PASS="$password"

if [ -z "$USER" ] || [ -z "$PASS" ]; then
    exit 1
fi

PW_HASH=$(echo -n "$PASS" | sha256sum | cut -d' ' -f1)

if grep -qF "${USER}:${PW_HASH}" "$USERS_FILE" 2>/dev/null; then
    exit 0
fi
exit 1
