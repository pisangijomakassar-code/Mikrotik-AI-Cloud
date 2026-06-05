"""
Client Agent Relay — jembatan antara AI agent (di cloud) dan agent kecil yang
jalan di laptop client untuk remote troubleshooting.

Pola kerjanya niru cara TeamViewer/AnyDesk nembus NAT: laptop client TIDAK perlu
buka port. Agent di laptop client yang nelpon keluar (outbound HTTPS) ke
health_server (:8080), long-poll buat ambil perintah diagnostik, jalanin perintah
dari allowlist, lalu kirim balik hasilnya.

State relay disimpan in-memory di proses health_server (1 proses, dipakai bareng
semua request). Kalau health_server restart, device tinggal re-register pas poll
berikutnya — self-healing.

Trust model:
  - Tiap device punya `device_token` (rahasia, dibagikan operator saat install).
  - Saat register, device klaim `user_id` pemiliknya. MCP tools cuma bisa lihat &
    perintah device yang user_id-nya cocok. Token = rahasia per-customer.
  - Endpoint internal (dipanggil MCP server) dilindungi X-Agent-Token (AGENT_TOKEN),
    sama kayak endpoint sensitif lain di health_server.
  - Eksekusi perintah final-nya divalidasi di SISI CLIENT (allowlist). Walau cloud
    dikompromi, client cuma jalanin diagnostik yang diizinkan.
"""

import threading
import time
import uuid


# Device dianggap offline kalau gak poll/register dalam sekian detik.
DEVICE_TIMEOUT = 90

# Default timeout (detik) nunggu hasil sebuah perintah dari client.
DEFAULT_COMMAND_TIMEOUT = 45


class ClientAgentRelay:
    def __init__(self):
        self._lock = threading.Lock()
        # token -> device dict {token, userId, hostname, os, osVersion,
        #                        agentVersion, allowActions, lastSeen}
        self._devices: dict[str, dict] = {}
        # token -> list[command dict] yang belum diambil client
        self._queues: dict[str, list[dict]] = {}
        # token -> threading.Event buat bangunin long-poll saat ada cmd baru
        self._poll_events: dict[str, threading.Event] = {}
        # commandId -> {"event": Event, "result": dict|None}
        self._pending: dict[str, dict] = {}

    # ── Device lifecycle ────────────────────────────────────────────────

    def register(
        self,
        token: str,
        user_id: str,
        hostname: str = "",
        os_name: str = "",
        os_version: str = "",
        agent_version: str = "",
        allow_actions: bool = False,
    ) -> dict:
        """Daftarkan / refresh sebuah device. Idempotent."""
        if not token or not user_id:
            raise ValueError("token dan user_id wajib")
        now = time.time()
        with self._lock:
            self._devices[token] = {
                "token": token,
                "userId": str(user_id),
                "hostname": hostname,
                "os": os_name,
                "osVersion": os_version,
                "agentVersion": agent_version,
                "allowActions": bool(allow_actions),
                "lastSeen": now,
            }
            self._queues.setdefault(token, [])
            self._poll_events.setdefault(token, threading.Event())
        return {"ok": True, "device": self._public_device(self._devices[token])}

    def _touch(self, token: str) -> None:
        dev = self._devices.get(token)
        if dev:
            dev["lastSeen"] = time.time()

    @staticmethod
    def _public_device(dev: dict) -> dict:
        """Buang token sebelum dikirim keluar (token itu rahasia)."""
        online = (time.time() - dev["lastSeen"]) <= DEVICE_TIMEOUT
        return {
            "hostname": dev.get("hostname", ""),
            "os": dev.get("os", ""),
            "osVersion": dev.get("osVersion", ""),
            "agentVersion": dev.get("agentVersion", ""),
            "allowActions": dev.get("allowActions", False),
            "online": online,
            "lastSeenSecondsAgo": round(time.time() - dev["lastSeen"]),
        }

    def list_devices(self, user_id: str, online_only: bool = True) -> list[dict]:
        user_id = str(user_id)
        with self._lock:
            out = []
            for dev in self._devices.values():
                if dev["userId"] != user_id:
                    continue
                pub = self._public_device(dev)
                if online_only and not pub["online"]:
                    continue
                out.append(pub)
            return out

    def _resolve_token(self, user_id: str, device: str | None) -> tuple[str | None, str | None]:
        """Cari token device milik user. device=None/'' → kalau cuma 1 device online,
        pakai itu. Return (token, error_msg)."""
        user_id = str(user_id)
        with self._lock:
            owned = [
                d for d in self._devices.values()
                if d["userId"] == user_id
                and (time.time() - d["lastSeen"]) <= DEVICE_TIMEOUT
            ]
        if not owned:
            return None, "tidak ada device client yang online untuk user ini"
        if device:
            matches = [d for d in owned if d.get("hostname", "").lower() == device.lower()]
            if not matches:
                names = ", ".join(d.get("hostname", "?") for d in owned) or "(none)"
                return None, f"device '{device}' tidak ditemukan/offline. Online: {names}"
            return matches[0]["token"], None
        if len(owned) == 1:
            return owned[0]["token"], None
        names = ", ".join(d.get("hostname", "?") for d in owned)
        return None, f"ada beberapa device online ({names}) — sebutkan nama device-nya"

    # ── Command dispatch (dipanggil sisi MCP via HTTP) ──────────────────

    def enqueue_and_wait(
        self,
        user_id: str,
        device: str | None,
        action: str,
        params: dict | None = None,
        timeout: float = DEFAULT_COMMAND_TIMEOUT,
    ) -> dict:
        """Antrekan 1 perintah ke device dan tunggu hasilnya (blocking, max timeout)."""
        token, err = self._resolve_token(user_id, device)
        if err:
            return {"ok": False, "error": err}

        command_id = uuid.uuid4().hex
        command = {
            "id": command_id,
            "action": action,
            "params": params or {},
            "createdAt": time.time(),
        }
        result_event = threading.Event()
        with self._lock:
            self._pending[command_id] = {"event": result_event, "result": None}
            self._queues.setdefault(token, []).append(command)
            poll_event = self._poll_events.setdefault(token, threading.Event())
        poll_event.set()  # bangunin long-poll yang lagi nunggu

        got = result_event.wait(timeout=timeout)
        with self._lock:
            entry = self._pending.pop(command_id, None)
            # Kalau timeout, copot juga command dari antrian biar gak dijalanin telat.
            q = self._queues.get(token, [])
            self._queues[token] = [c for c in q if c["id"] != command_id]
        if not got or entry is None or entry["result"] is None:
            return {"ok": False, "error": f"timeout — device gak balas dalam {int(timeout)}s"}
        return entry["result"]

    # ── Endpoint yang dipanggil agent di laptop client ──────────────────

    def poll(self, token: str, wait: float = 25.0, max_batch: int = 1) -> dict:
        """Long-poll: kembalikan perintah pending untuk device. Kalau kosong,
        tunggu sampai `wait` detik atau sampai ada cmd baru."""
        with self._lock:
            if token not in self._devices:
                return {"ok": False, "error": "device belum register", "needRegister": True}
            self._touch(token)
            poll_event = self._poll_events.setdefault(token, threading.Event())

        deadline = time.time() + wait
        while True:
            with self._lock:
                q = self._queues.get(token, [])
                if q:
                    batch = q[:max_batch]
                    self._queues[token] = q[max_batch:]
                    if not self._queues[token]:
                        poll_event.clear()
                    self._touch(token)
                    return {"ok": True, "commands": batch}
                poll_event.clear()
            remaining = deadline - time.time()
            if remaining <= 0:
                return {"ok": True, "commands": []}
            poll_event.wait(timeout=min(remaining, 5))

    def submit_result(self, command_id: str, result: dict) -> dict:
        """Terima hasil eksekusi dari client, bangunin caller yang nunggu."""
        with self._lock:
            entry = self._pending.get(command_id)
            if entry is None:
                # Caller udah timeout / gak ada — abaikan.
                return {"ok": True, "stale": True}
            entry["result"] = result
            entry["event"].set()
        return {"ok": True}


# Singleton dipakai health_server.
_relay: ClientAgentRelay | None = None


def get_relay() -> ClientAgentRelay:
    global _relay
    if _relay is None:
        _relay = ClientAgentRelay()
    return _relay
