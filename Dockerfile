FROM python:3.11-slim AS base

WORKDIR /app

# System deps (gettext-base provides envsubst; docker.io provides CLI for VPN management)
RUN apt-get update && apt-get install -y --no-install-recommends \
    git curl gettext-base inotify-tools docker.io && \
    rm -rf /var/lib/apt/lists/*

# Install cloudflared (for tunnel manager)
RUN ARCH=$(dpkg --print-architecture) && \
    curl -sSL "https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-${ARCH}" \
    -o /usr/local/bin/cloudflared && \
    chmod +x /usr/local/bin/cloudflared

# Install nanobot
RUN pip install --no-cache-dir nanobot-ai

# Install MikroTik MCP server deps
COPY mikrotik_mcp/requirements.txt /app/mikrotik_mcp/requirements.txt
RUN pip install --no-cache-dir -r /app/mikrotik_mcp/requirements.txt

# Copy project files
COPY mikrotik_mcp/ /app/mikrotik_mcp/
COPY skills/ /app/skills/
COPY config/ /app/config/
COPY entrypoint.sh /app/entrypoint.sh

RUN chmod +x /app/entrypoint.sh

ENTRYPOINT ["/app/entrypoint.sh"]
CMD ["gateway"]
