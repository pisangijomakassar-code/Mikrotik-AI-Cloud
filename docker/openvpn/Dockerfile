FROM alpine:3.19

RUN apk add --no-cache openvpn openssl bash

COPY server.conf /etc/openvpn/server.conf
COPY auth-check.sh /etc/openvpn/auth-check.sh
COPY entrypoint.sh /entrypoint.sh

RUN sed -i 's/\r//' /etc/openvpn/auth-check.sh /entrypoint.sh && \
    chmod +x /etc/openvpn/auth-check.sh /entrypoint.sh

VOLUME ["/config"]
EXPOSE 1194/tcp

ENTRYPOINT ["/entrypoint.sh"]
