# MikroTik AI Agent — SSTP VPN Tunnel Setup (RouterOS 6+)
# Paste this entire script into the MikroTik terminal (New Terminal in Winbox)
#
# This creates an outbound SSTP VPN connection to the AI Agent server.
# No port forwarding required — the router connects outward.
# Once connected, all router services become remotely manageable.
#
# SSTP uses TCP port 443 (HTTPS) — passes through virtually all firewalls.

# Step 1: Add SSTP client interface
/interface sstp-client add \
  name=tunnel-saas \
  connect-to=__VPN_HOST__:443 \
  user=__VPN_USER__ \
  password=__VPN_PASS__ \
  profile=default-encryption \
  add-default-route=no \
  disabled=no \
  comment="MikroTik AI Agent Tunnel"

# Step 2: Verify the tunnel is connecting
# Run this after ~10 seconds:
# /interface sstp-client print detail
# Status should show "connected" and have an IP address like 10.10.0.x

# Step 3: (Optional) Make tunnel survive reboots
# The SSTP client is already configured to start automatically.
# To verify: /interface sstp-client print — disabled=no means auto-start.

# To remove this tunnel later:
# /interface sstp-client remove [find name=tunnel-saas]
