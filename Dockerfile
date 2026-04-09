FROM python:3.11-slim AS base

WORKDIR /app

# System deps (gettext-base provides envsubst)
RUN apt-get update && apt-get install -y --no-install-recommends \
    git curl gettext-base && \
    rm -rf /var/lib/apt/lists/*

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
