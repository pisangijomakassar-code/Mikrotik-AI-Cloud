#!/bin/bash
# MikroTik AI Agent — Cloudflare Tunnel Installer
# Run on a Raspberry Pi or Linux device on the SAME network as your MikroTik router.
# Usage: curl -sSL https://your-dashboard-url/api/tunnels/ROUTER_ID/script | sudo bash
#        OR: sudo bash install-cloudflared.sh
#
# This installs cloudflared and sets it up as a systemd service.
# No port forwarding required — creates an outbound-only tunnel.

set -euo pipefail

# ── Configuration ────────────────────────────────────────────────────────────
TUNNEL_TOKEN="${TUNNEL_TOKEN:-__TOKEN__}"  # Injected by dashboard API
ROUTER_ID="${ROUTER_ID:-__ROUTER_ID__}"

# ── Helpers ───────────────────────────────────────────────────────────────────
info()  { echo "[INFO]  $*"; }
warn()  { echo "[WARN]  $*" >&2; }
error() { echo "[ERROR] $*" >&2; exit 1; }

check_root() {
    if [[ "$EUID" -ne 0 ]]; then
        error "This script must be run as root (use: sudo bash $0)"
    fi
}

detect_arch() {
    local machine
    machine=$(uname -m)
    case "$machine" in
        x86_64)          echo "amd64" ;;
        aarch64|arm64)   echo "arm64" ;;
        armv7l|armv6l)   echo "arm" ;;
        *)               error "Unsupported architecture: $machine" ;;
    esac
}

install_cloudflared() {
    local arch
    arch=$(detect_arch)
    local download_url="https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-${arch}"

    if command -v cloudflared &>/dev/null; then
        info "cloudflared already installed: $(cloudflared --version)"
        return
    fi

    info "Downloading cloudflared for ${arch}..."
    curl -sSL "$download_url" -o /usr/local/bin/cloudflared
    chmod +x /usr/local/bin/cloudflared
    info "cloudflared installed: $(cloudflared --version)"
}

install_service() {
    info "Creating systemd service..."
    cat > /etc/systemd/system/cloudflared-mikrotik.service <<EOF
[Unit]
Description=MikroTik AI Agent Tunnel (cloudflared)
Documentation=https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
User=nobody
ExecStart=/usr/local/bin/cloudflared tunnel run --token ${TUNNEL_TOKEN}
Restart=always
RestartSec=5
Environment=NO_AUTOUPDATE=true
StandardOutput=journal
StandardError=journal

[Install]
WantedBy=multi-user.target
EOF

    systemctl daemon-reload
    systemctl enable cloudflared-mikrotik
    systemctl start cloudflared-mikrotik
    info "Service started. Check status: systemctl status cloudflared-mikrotik"
}

uninstall() {
    info "Uninstalling cloudflared tunnel service..."
    systemctl stop cloudflared-mikrotik 2>/dev/null || true
    systemctl disable cloudflared-mikrotik 2>/dev/null || true
    rm -f /etc/systemd/system/cloudflared-mikrotik.service
    systemctl daemon-reload
    rm -f /usr/local/bin/cloudflared
    info "Uninstalled."
}

# ── Main ─────────────────────────────────────────────────────────────────────
main() {
    if [[ "${1:-}" == "--uninstall" ]]; then
        check_root
        uninstall
        exit 0
    fi

    check_root

    if [[ "$TUNNEL_TOKEN" == "__TOKEN__" ]]; then
        error "No tunnel token provided. Get the script from your dashboard or set TUNNEL_TOKEN env var."
    fi

    info "Installing MikroTik AI Agent tunnel for router: ${ROUTER_ID}"
    install_cloudflared
    install_service

    echo ""
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo "  Tunnel installed successfully!"
    echo "  Router ID: ${ROUTER_ID}"
    echo ""
    echo "  Check status:  systemctl status cloudflared-mikrotik"
    echo "  View logs:     journalctl -u cloudflared-mikrotik -f"
    echo "  Uninstall:     sudo bash $0 --uninstall"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
}

main "$@"
