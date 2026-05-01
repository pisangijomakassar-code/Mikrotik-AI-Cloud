#!/bin/sh
# Verify OpenVPN username/password via-file.
# OpenVPN passes the path of a file containing username (line 1) and password (line 2)
# as the first argument to this script.
#
# SECURITY: Hanya log event FAIL tanpa hash; jangan log password atau hash-nya.
USERS_FILE=/config/users.txt
DEBUG_LOG=/config/auth-debug.log
CRED_FILE="$1"

if [ -z "$CRED_FILE" ] || [ ! -f "$CRED_FILE" ]; then
    echo "$(date) FAIL no cred file" >> "$DEBUG_LOG"
    exit 1
fi

USER=$(sed -n '1p' "$CRED_FILE")
PASS=$(sed -n '2p' "$CRED_FILE")

if [ -z "$USER" ] || [ -z "$PASS" ]; then
    # Tidak log USER karena bisa probe valid usernames; cuma log fakta empty
    echo "$(date) FAIL empty creds" >> "$DEBUG_LOG"
    exit 1
fi

PW_HASH=$(printf '%s' "$PASS" | sha256sum | cut -d' ' -f1)
EXPECTED=$(grep "^${USER}:" "$USERS_FILE" 2>/dev/null | head -1 | cut -d: -f2)

if [ -n "$EXPECTED" ] && [ "$PW_HASH" = "$EXPECTED" ]; then
    # Sukses: tidak perlu log apapun (verbose log = noise + risk)
    exit 0
fi

# Failure: log username (dibutuhkan utk debug brute force) tapi NEVER log hash
echo "$(date) FAIL user=${USER}" >> "$DEBUG_LOG"
exit 1
