FROM python:3.11-slim AS base

WORKDIR /app

# System deps
RUN apt-get update && apt-get install -y --no-install-recommends \
    git curl gettext-base inotify-tools && \
    rm -rf /var/lib/apt/lists/*

# Docker CLI static binary (docker.io package tidak include binary di Debian 13)
# dpkg returns amd64/arm64 tapi Docker URL pakai x86_64/aarch64
RUN DPKG_ARCH=$(dpkg --print-architecture) && \
    case "$DPKG_ARCH" in \
      amd64) DOCKER_ARCH=x86_64 ;; \
      arm64) DOCKER_ARCH=aarch64 ;; \
      *) DOCKER_ARCH=$DPKG_ARCH ;; \
    esac && \
    curl -fsSL "https://download.docker.com/linux/static/stable/${DOCKER_ARCH}/docker-27.5.1.tgz" \
      -o /tmp/docker.tgz && \
    tar -xz --strip-components=1 -C /usr/local/bin -f /tmp/docker.tgz docker/docker && \
    rm /tmp/docker.tgz && \
    chmod +x /usr/local/bin/docker && \
    docker --version

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

RUN sed -i 's/\r//' /app/entrypoint.sh && chmod +x /app/entrypoint.sh

ENTRYPOINT ["/app/entrypoint.sh"]
CMD ["serve", "--port", "18790", "--host", "0.0.0.0"]
