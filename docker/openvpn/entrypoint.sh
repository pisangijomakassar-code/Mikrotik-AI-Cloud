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

FORWARDS_FILE=/config/forwards.txt
touch "$FORWARDS_FILE"

# Enable IP forwarding
echo 1 > /proc/sys/net/ipv4/ip_forward 2>/dev/null || true

# Setup base NAT rules (MASQUERADE outbound traffic on tun0 for return packets)
iptables -t nat -C POSTROUTING -o tun0 -j MASQUERADE 2>/dev/null || \
    iptables -t nat -A POSTROUTING -o tun0 -j MASQUERADE

# Restore port forwards from /config/forwards.txt (one rule per line: <publicPort>:<vpnIp>:<destPort>)
while IFS=: read -r PUB_PORT VPN_IP DEST_PORT; do
    [ -z "$PUB_PORT" ] && continue
    iptables -t nat -C PREROUTING -p tcp --dport "$PUB_PORT" -j DNAT --to-destination "$VPN_IP:$DEST_PORT" 2>/dev/null || \
        iptables -t nat -A PREROUTING -p tcp --dport "$PUB_PORT" -j DNAT --to-destination "$VPN_IP:$DEST_PORT"
    iptables -C FORWARD -p tcp -d "$VPN_IP" --dport "$DEST_PORT" -j ACCEPT 2>/dev/null || \
        iptables -A FORWARD -p tcp -d "$VPN_IP" --dport "$DEST_PORT" -j ACCEPT
done < "$FORWARDS_FILE"

echo "[ovpn] Starting OpenVPN server on port 1194/tcp..."
exec openvpn --config /etc/openvpn/server.conf
