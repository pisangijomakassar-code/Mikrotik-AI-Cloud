#!/bin/bash
set -e

PKI_DIR=/config/pki
CCD_DIR=/config/ccd
USERS_FILE=/config/users.txt

if [ ! -f "$PKI_DIR/ca.crt" ]; then
    echo "[ovpn] First run — initialising PKI..."
    mkdir -p "$PKI_DIR"

    # CA key + self-signed cert (10-year validity)
    openssl genrsa -out "$PKI_DIR/ca.key" 2048
    openssl req -new -x509 -days 3650 -key "$PKI_DIR/ca.key" \
        -out "$PKI_DIR/ca.crt" \
        -subj "/CN=MikroTik-AI-Agent-CA/O=MikroTik-AI-Agent"

    # Server key + CSR + cert signed by CA
    openssl genrsa -out "$PKI_DIR/server.key" 2048
    openssl req -new -key "$PKI_DIR/server.key" \
        -out "$PKI_DIR/server.csr" \
        -subj "/CN=mikrotik-ai-agent-server"
    openssl x509 -req -days 3650 \
        -in "$PKI_DIR/server.csr" \
        -CA "$PKI_DIR/ca.crt" -CAkey "$PKI_DIR/ca.key" -CAcreateserial \
        -out "$PKI_DIR/server.crt"

    # DH params — fast via DSA parametrisation (accepted by OpenVPN 2.4+)
    echo "[ovpn] Generating DH params (this may take ~30s)..."
    openssl dhparam -dsaparam -out "$PKI_DIR/dh.pem" 2048

    echo "[ovpn] PKI initialised."
fi

mkdir -p "$CCD_DIR"
touch "$USERS_FILE"

# Enable IP forwarding
echo 1 > /proc/sys/net/ipv4/ip_forward 2>/dev/null || true

echo "[ovpn] Starting OpenVPN server on port 1194/tcp..."
exec openvpn --config /etc/openvpn/server.conf
