# MikroTik AI Agent — Cloudflare Tunnel Setup (RouterOS 7+)
# Paste this entire script into the MikroTik terminal (New Terminal in Winbox)
#
# Prerequisites:
#   - RouterOS 7.x on x86 or aarch64 (RB5009, CCR2004, CHR)
#   - Container package installed (download from mikrotik.com/download)
#   - Device rebooted after enabling container mode
#
# This sets up cloudflared as a Docker container that creates a secure
# outbound-only tunnel — no port forwarding required on your router/modem.

# Step 1: Enable container mode (requires reboot — skip if already done)
/system/device-mode/update container=yes
# After running this line, the router will request a reboot.
# Reboot and re-run the rest of this script.

# Step 2: Create a virtual ethernet interface for the container
/interface/veth add name=veth-saas address=172.28.0.2/24 gateway=172.28.0.1 comment="MikroTik AI Agent container interface"

# Step 3: Create a bridge for the container
/interface/bridge add name=br-saas comment="MikroTik AI Agent bridge"
/interface/bridge/port add bridge=br-saas interface=veth-saas

# Step 4: Assign IP to bridge (so container can reach internet via NAT)
/ip/address add address=172.28.0.1/24 interface=br-saas

# Step 5: Add NAT masquerade for container traffic
/ip/firewall/nat add chain=srcnat out-interface-list=WAN src-address=172.28.0.0/24 action=masquerade comment="Container NAT for MikroTik AI Agent"

# Step 6: Create the cloudflared container
/container/add \
  remote-image=cloudflare/cloudflared:latest \
  interface=veth-saas \
  cmd="tunnel run --token __TOKEN__" \
  logging=yes \
  dns=1.1.1.1 \
  comment="MikroTik AI Agent Tunnel (rt-__ROUTER_ID__)"

# Step 7: Start the container
# Wait a moment for the image to download, then run:
/container/start [find comment~"MikroTik AI Agent Tunnel"]

# Verify: /container/print — status should become "running" after ~30 seconds
# To check logs: /container/shell [find comment~"MikroTik AI Agent Tunnel"]
