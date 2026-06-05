#!/usr/bin/env python3
"""
Client Troubleshooting Agent — dijalankan di LAPTOP CLIENT.

Agent kecil ini connect OUTBOUND ke cloud (health_server :8080), long-poll buat
ambil perintah diagnostik dari AI agent, jalanin perintah dari ALLOWLIST, lalu
kirim balik hasilnya. Niru cara TeamViewer nembus NAT — client TIDAK perlu buka
port apa pun, cukup bisa akses internet keluar.

TRANSPARANSI + KONTROL (biar klien bisa pantau):
  - Tiap perintah ditampilkan jelas di console: ALASAN dari AI, aksi apa, target
    apa, lalu hasilnya. Klien yang di depan laptop bisa lihat agent "mikir &
    kerja" secara real-time.
  - Mode APPROVAL (default ON): tiap perintah HARUS disetujui klien (ketik y)
    sebelum dijalankan. Kalau ditolak / timeout → perintah TIDAK jalan dan AI
    dikasih tahu. Ini ngejamin agent gak kerja di luar kemauan klien / halu.
    Untuk deployment headless (tanpa orang di depan), pakai --no-approval.

Keamanan:
  - Cuma jalanin perintah dari ALLOWLIST. Aksi yang mengubah state butuh
    --allow-actions. Argumen host/service divalidasi ketat; subprocess TANPA
    shell (anti command injection).

Cara pakai:
    python3 agent.py \
        --cloud-url https://agent.domain-lo.com \
        --token  <DEVICE_TOKEN_RAHASIA> \
        --user-id 86340875

Env var alternatif: CLOUD_URL, DEVICE_TOKEN, USER_ID, ALLOW_ACTIONS=1, NO_APPROVAL=1
"""

import argparse
import json
import os
import platform
import queue
import re
import socket
import subprocess
import sys
import threading
import time
import urllib.error
import urllib.request
from datetime import datetime

AGENT_VERSION = "0.2.0"

# Cap output biar gak banjir + hemat token LLM.
MAX_OUTPUT_CHARS = 6000

# Host/IP yang valid buat ping/traceroute/dns (anti injection).
_HOST_RE = re.compile(r"^[A-Za-z0-9._:-]{1,253}$")
# Nama service yang valid.
_SERVICE_RE = re.compile(r"^[A-Za-z0-9._ -]{1,64}$")

IS_WIN = platform.system() == "Windows"
IS_MAC = platform.system() == "Darwin"

# Label aksi yang gampang dibaca klien (buat tampilan console).
ACTION_LABELS = {
    "system_info": "Lihat info sistem",
    "network_config": "Lihat konfigurasi jaringan",
    "ping": "Ping ke host",
    "traceroute": "Traceroute ke host",
    "dns_lookup": "Cek DNS sebuah host",
    "route_table": "Lihat tabel routing",
    "arp_table": "Lihat tabel ARP",
    "list_processes": "Lihat daftar proses",
    "service_status": "Cek status service",
    "netstat": "Lihat port/koneksi (netstat)",
    "connectivity_check": "Cek konektivitas (gateway/internet/DNS)",
    "flush_dns": "FLUSH DNS cache",
    "renew_dhcp": "RELEASE + RENEW DHCP (ambil IP baru)",
    "restart_service": "RESTART sebuah service",
}


def _trim(s: str) -> str:
    if s is None:
        return ""
    if len(s) > MAX_OUTPUT_CHARS:
        return s[:MAX_OUTPUT_CHARS] + f"\n…(dipotong, total {len(s)} char)"
    return s


def _run(cmd: list[str], timeout: int = 30) -> dict:
    """Jalanin perintah TANPA shell, return {ok, stdout, stderr, code}."""
    try:
        p = subprocess.run(
            cmd,
            capture_output=True,
            text=True,
            timeout=timeout,
            stdin=subprocess.DEVNULL,
        )
        return {
            "ok": p.returncode == 0,
            "code": p.returncode,
            "stdout": _trim(p.stdout),
            "stderr": _trim(p.stderr),
            "cmd": " ".join(cmd),
        }
    except FileNotFoundError:
        return {"ok": False, "error": f"perintah tidak tersedia: {cmd[0]}"}
    except subprocess.TimeoutExpired:
        return {"ok": False, "error": f"timeout setelah {timeout}s", "cmd": " ".join(cmd)}
    except Exception as e:
        return {"ok": False, "error": str(e)}


def _valid_host(host: str) -> bool:
    return bool(host) and bool(_HOST_RE.match(host))


# ── Action handlers (read-only) ──────────────────────────────────────────────

def _a_system_info(_params):
    info = {
        "hostname": socket.gethostname(),
        "os": platform.system(),
        "osVersion": platform.platform(),
        "arch": platform.machine(),
        "pythonVersion": platform.python_version(),
        "agentVersion": AGENT_VERSION,
    }
    if IS_WIN:
        info["detail"] = _run(["systeminfo"], timeout=40)
    elif IS_MAC:
        info["uptime"] = _run(["uptime"])
        info["detail"] = _run(["system_profiler", "SPHardwareDataType"], timeout=40)
    else:
        info["uptime"] = _run(["uptime"])
        info["detail"] = _run(["sh", "-c", "cat /etc/os-release; echo; free -h; echo; nproc"])
    return info


def _a_network_config(_params):
    if IS_WIN:
        return _run(["ipconfig", "/all"])
    if IS_MAC:
        return {"ifconfig": _run(["ifconfig"]), "route": _run(["netstat", "-rn"])}
    return {
        "ip_addr": _run(["ip", "addr"]),
        "ip_route": _run(["ip", "route"]),
        "dns": _run(["cat", "/etc/resolv.conf"]),
    }


def _a_ping(params):
    host = params.get("host", "")
    if not _valid_host(host):
        return {"ok": False, "error": "host tidak valid"}
    count = str(min(int(params.get("count", 4) or 4), 10))
    if IS_WIN:
        return _run(["ping", "-n", count, host], timeout=40)
    return _run(["ping", "-c", count, host], timeout=40)


def _a_traceroute(params):
    host = params.get("host", "")
    if not _valid_host(host):
        return {"ok": False, "error": "host tidak valid"}
    if IS_WIN:
        return _run(["tracert", "-d", "-h", "15", host], timeout=80)
    cmd = "traceroute" if not IS_MAC else "traceroute"
    return _run([cmd, "-n", "-m", "15", host], timeout=80)


def _a_dns_lookup(params):
    host = params.get("host", "")
    if not _valid_host(host):
        return {"ok": False, "error": "host tidak valid"}
    if IS_WIN:
        return _run(["nslookup", host], timeout=20)
    # nslookup ada di mac/linux; fallback ke getent kalau gak ada.
    res = _run(["nslookup", host], timeout=20)
    if not res.get("ok") and "tidak tersedia" in res.get("error", ""):
        res = _run(["getent", "hosts", host], timeout=20)
    return res


def _a_route_table(_params):
    if IS_WIN:
        return _run(["route", "print"])
    if IS_MAC:
        return _run(["netstat", "-rn"])
    return _run(["ip", "route"])


def _a_arp_table(_params):
    return _run(["arp", "-a"]) if IS_WIN else _run(["ip", "neigh"]) if not IS_MAC else _run(["arp", "-a"])


def _a_list_processes(_params):
    if IS_WIN:
        return _run(["tasklist"], timeout=30)
    # top 20 by cpu
    return _run(["sh", "-c", "ps -eo pid,pcpu,pmem,comm --sort=-pcpu | head -n 21"])


def _a_service_status(params):
    name = params.get("name", "")
    if not _SERVICE_RE.match(name or ""):
        return {"ok": False, "error": "nama service tidak valid"}
    if IS_WIN:
        return _run(["sc", "query", name], timeout=20)
    if IS_MAC:
        return _run(["launchctl", "list", name], timeout=20)
    return _run(["systemctl", "status", name, "--no-pager"], timeout=20)


def _a_netstat(_params):
    if IS_WIN:
        return _run(["netstat", "-ano"], timeout=30)
    if IS_MAC:
        return _run(["netstat", "-an"], timeout=30)
    # ss lebih modern; fallback netstat
    res = _run(["ss", "-tulpn"], timeout=30)
    if not res.get("ok") and "tidak tersedia" in res.get("error", ""):
        res = _run(["netstat", "-tulpn"], timeout=30)
    return res


def _a_connectivity_check(_params):
    """Diagnosa cepat 'internet mati/lemot'."""
    out = {}
    # 1) gateway
    if IS_WIN:
        gw = _run(["powershell", "-NoProfile", "-Command",
                   "(Get-NetRoute -DestinationPrefix '0.0.0.0/0' | "
                   "Select-Object -First 1 -ExpandProperty NextHop)"], timeout=20)
        gw_ip = (gw.get("stdout") or "").strip().splitlines()[-1].strip() if gw.get("ok") else ""
    else:
        gw = _run(["sh", "-c", "ip route | awk '/default/{print $3; exit}'"]) if not IS_MAC \
            else _run(["sh", "-c", "route -n get default | awk '/gateway/{print $2}'"])
        gw_ip = (gw.get("stdout") or "").strip()
    out["gateway"] = gw_ip or "(tidak ketemu)"
    if _valid_host(gw_ip):
        out["pingGateway"] = _a_ping({"host": gw_ip, "count": 3})
    # 2) internet (8.8.8.8)
    out["pingInternet"] = _a_ping({"host": "8.8.8.8", "count": 3})
    # 3) DNS resolve
    out["dns"] = _a_dns_lookup({"host": "google.com"})
    # ringkasan
    out["summary"] = {
        "gatewayReachable": out.get("pingGateway", {}).get("ok", False),
        "internetReachable": out.get("pingInternet", {}).get("ok", False),
        "dnsWorks": out.get("dns", {}).get("ok", False),
    }
    return out


# ── Action handlers (mengubah state — butuh --allow-actions) ─────────────────

def _a_flush_dns(_params):
    if IS_WIN:
        return _run(["ipconfig", "/flushdns"])
    if IS_MAC:
        return _run(["dscacheutil", "-flushcache"])
    # systemd-resolved
    res = _run(["resolvectl", "flush-caches"])
    if not res.get("ok") and "tidak tersedia" in res.get("error", ""):
        res = _run(["systemd-resolve", "--flush-caches"])
    return res


def _a_renew_dhcp(_params):
    if IS_WIN:
        rel = _run(["ipconfig", "/release"], timeout=40)
        ren = _run(["ipconfig", "/renew"], timeout=40)
        return {"release": rel, "renew": ren}
    if IS_MAC:
        return _run(["sh", "-c", "ipconfig set en0 DHCP"], timeout=40)
    return _run(["sh", "-c", "dhclient -r && dhclient"], timeout=40)


def _a_restart_service(params):
    name = params.get("name", "")
    if not _SERVICE_RE.match(name or ""):
        return {"ok": False, "error": "nama service tidak valid"}
    if IS_WIN:
        _run(["net", "stop", name], timeout=40)
        return _run(["net", "start", name], timeout=40)
    if IS_MAC:
        return {"ok": False, "error": "restart service belum didukung di macOS"}
    return _run(["systemctl", "restart", name], timeout=40)


READONLY_ACTIONS = {
    "system_info": _a_system_info,
    "network_config": _a_network_config,
    "ping": _a_ping,
    "traceroute": _a_traceroute,
    "dns_lookup": _a_dns_lookup,
    "route_table": _a_route_table,
    "arp_table": _a_arp_table,
    "list_processes": _a_list_processes,
    "service_status": _a_service_status,
    "netstat": _a_netstat,
    "connectivity_check": _a_connectivity_check,
}

ACTION_ACTIONS = {
    "flush_dns": _a_flush_dns,
    "renew_dhcp": _a_renew_dhcp,
    "restart_service": _a_restart_service,
}

# Aksi yang mengubah state (buat penandaan visual di console).
STATE_CHANGING = set(ACTION_ACTIONS)


class Agent:
    def __init__(self, cloud_url, token, user_id, allow_actions, poll_wait,
                 require_approval=True, approval_timeout=60):
        self.cloud_url = cloud_url.rstrip("/")
        self.token = token
        self.user_id = str(user_id)
        self.allow_actions = allow_actions
        self.poll_wait = poll_wait
        self.require_approval = require_approval
        self.approval_timeout = approval_timeout
        self.registered = False
        self._has_tty = bool(getattr(sys.stdin, "isatty", lambda: False)())
        self._input_q: "queue.Queue[str]" = queue.Queue()
        if self.require_approval and self._has_tty:
            threading.Thread(target=self._stdin_loop, daemon=True).start()

    # ── HTTP ────────────────────────────────────────────────────────────
    def _post(self, path, body, timeout):
        data = json.dumps(body).encode()
        req = urllib.request.Request(
            f"{self.cloud_url}{path}", data=data, method="POST",
            headers={"Content-Type": "application/json"},
        )
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            return json.loads(resp.read())

    def register(self):
        res = self._post("/client-agent/register", {
            "token": self.token,
            "userId": self.user_id,
            "hostname": socket.gethostname(),
            "os": platform.system(),
            "osVersion": platform.platform(),
            "agentVersion": AGENT_VERSION,
            "allowActions": self.allow_actions,
        }, timeout=20)
        self.registered = bool(res.get("ok"))
        return res

    def poll(self):
        url = f"{self.cloud_url}/client-agent/poll/{self.token}?wait={int(self.poll_wait)}"
        with urllib.request.urlopen(url, timeout=self.poll_wait + 15) as resp:
            return json.loads(resp.read())

    def submit(self, command_id, result):
        return self._post("/client-agent/result", {
            "commandId": command_id, "result": result,
        }, timeout=20)

    # ── Console rendering (biar klien bisa pantau) ──────────────────────
    @staticmethod
    def _ts():
        return datetime.now().strftime("%H:%M:%S")

    def _render_request(self, command):
        action = command.get("action", "")
        params = command.get("params", {}) or {}
        reason = command.get("reason", "") or "(tidak disebutkan)"
        label = ACTION_LABELS.get(action, action)
        tgt = " ".join(f"{k}={v}" for k, v in params.items()) or "-"
        danger = "  ⚠️ MENGUBAH STATE" if action in STATE_CHANGING else ""
        print("\n" + "─" * 60)
        print(f"[{self._ts()}] 🤖 Agent minta jalanin: {label}{danger}")
        print(f"   Alasan : {reason}")
        print(f"   Aksi   : {action}")
        print(f"   Target : {tgt}")

    def _render_result(self, result):
        ok = result.get("ok")
        if result.get("denied"):
            print(f"[{self._ts()}] ⛔ DITOLAK — perintah tidak dijalankan.")
        elif ok:
            data = result.get("data", {})
            summary = data.get("summary") if isinstance(data, dict) else None
            if summary:
                print(f"[{self._ts()}] ✔ Selesai — {summary}")
            else:
                print(f"[{self._ts()}] ✔ Selesai (ok).")
        else:
            print(f"[{self._ts()}] ✖ Gagal — {result.get('error', 'unknown')}")
        print("─" * 60)

    # ── Approval gate ───────────────────────────────────────────────────
    def _stdin_loop(self):
        try:
            for line in sys.stdin:
                self._input_q.put(line.strip())
        except Exception:
            pass

    def _ask_approval(self):
        """Tanya klien y/n dengan timeout. Return True/False (disetujui?)."""
        if not self._has_tty:
            # Headless tapi approval ON → auto-tolak (aman).
            print(f"[{self._ts()}] ⛔ Tidak ada terminal interaktif — auto-tolak. "
                  f"(pakai --no-approval untuk mode headless)")
            return False
        # Buang input basi sebelum nanya.
        try:
            while True:
                self._input_q.get_nowait()
        except queue.Empty:
            pass
        print(f"   Izinkan? ketik 'y' lalu Enter (auto-tolak {self.approval_timeout}s) > ",
              end="", flush=True)
        try:
            ans = self._input_q.get(timeout=self.approval_timeout)
        except queue.Empty:
            print(f"\n[{self._ts()}] ⏳ Tidak ada jawaban — auto-tolak.")
            return False
        ok = ans.strip().lower() in ("y", "ya", "yes", "ok", "lanjut", "iya")
        print(f"[{self._ts()}] {'✅ Disetujui — menjalankan…' if ok else '🚫 Ditolak klien.'}")
        return ok

    # ── Eksekusi ────────────────────────────────────────────────────────
    def execute(self, command):
        action = command.get("action", "")
        params = command.get("params", {}) or {}

        self._render_request(command)

        # Resolve handler + cek izin allowlist dulu (sebelum minta approval).
        handler = READONLY_ACTIONS.get(action)
        if handler is None:
            handler = ACTION_ACTIONS.get(action)
            if handler is not None and not self.allow_actions:
                res = {"ok": False, "error": f"action '{action}' butuh --allow-actions (default read-only)"}
                self._render_result(res)
                return res
        if handler is None:
            res = {"ok": False, "error": f"action tidak dikenal/tidak diizinkan: {action}"}
            self._render_result(res)
            return res

        # Gerbang approval (kalau ON, semua perintah butuh izin klien).
        if self.require_approval:
            if not self._ask_approval():
                res = {"ok": False, "denied": True,
                       "error": "ditolak oleh pemilik laptop (tidak disetujui)"}
                self._render_result(res)
                return res

        try:
            out = handler(params)
            res = {"ok": True, "action": action, "data": out}
        except Exception as e:
            res = {"ok": False, "action": action, "error": str(e)}
        self._render_result(res)
        return res

    # ── Main loop ───────────────────────────────────────────────────────
    def run(self):
        mode = "read-only" if not self.allow_actions else "actions ON"
        appr = "APPROVAL tiap perintah" if self.require_approval else "auto (tanpa approval)"
        print(f"[agent] start v{AGENT_VERSION} → {self.cloud_url}")
        print(f"[agent] host={socket.gethostname()} · mode={mode} · {appr}")
        if self.require_approval and not self._has_tty:
            print("[agent] ⚠️  approval ON tapi tidak ada terminal interaktif — "
                  "semua perintah akan AUTO-TOLAK. Pakai --no-approval untuk headless.")
        backoff = 2
        while True:
            try:
                if not self.registered:
                    reg = self.register()
                    if not reg.get("ok"):
                        print(f"[agent] register gagal: {reg}")
                        time.sleep(backoff)
                        continue
                    print(f"[{self._ts()}] [agent] registered ✓ — nunggu perintah…")
                res = self.poll()
                if res.get("needRegister"):
                    self.registered = False
                    continue
                for command in res.get("commands", []):
                    result = self.execute(command)
                    self.submit(command.get("id"), result)
                backoff = 2  # reset setelah sukses
            except urllib.error.URLError as e:
                print(f"[agent] koneksi error: {e} — retry {backoff}s")
                self.registered = False
                time.sleep(backoff)
                backoff = min(backoff * 2, 60)
            except KeyboardInterrupt:
                print("\n[agent] stop.")
                return
            except Exception as e:
                print(f"[agent] error tak terduga: {e} — retry {backoff}s")
                time.sleep(backoff)
                backoff = min(backoff * 2, 60)


def main():
    ap = argparse.ArgumentParser(description="Client Troubleshooting Agent")
    ap.add_argument("--cloud-url", default=os.environ.get("CLOUD_URL", ""),
                    help="URL health_server cloud, mis. https://agent.domain.com")
    ap.add_argument("--token", default=os.environ.get("DEVICE_TOKEN", ""),
                    help="device token rahasia (dibagikan operator)")
    ap.add_argument("--user-id", default=os.environ.get("USER_ID", ""),
                    help="Telegram user ID pemilik device")
    ap.add_argument("--allow-actions",
                    action="store_true",
                    default=os.environ.get("ALLOW_ACTIONS", "") in ("1", "true", "yes"),
                    help="izinkan aksi yang mengubah state (flush dns, renew dhcp, restart service)")
    ap.add_argument("--no-approval",
                    action="store_true",
                    default=os.environ.get("NO_APPROVAL", "") in ("1", "true", "yes"),
                    help="matikan approval (untuk mode headless tanpa orang di depan laptop)")
    ap.add_argument("--approval-timeout", type=int, default=60,
                    help="detik nunggu approval sebelum auto-tolak (default 60)")
    ap.add_argument("--poll-wait", type=int, default=25, help="durasi long-poll (detik)")
    args = ap.parse_args()

    missing = [n for n, v in [("--cloud-url", args.cloud_url),
                              ("--token", args.token),
                              ("--user-id", args.user_id)] if not v]
    if missing:
        print(f"ERROR: argumen wajib belum diisi: {', '.join(missing)}", file=sys.stderr)
        ap.print_help()
        sys.exit(2)

    Agent(
        cloud_url=args.cloud_url,
        token=args.token,
        user_id=args.user_id,
        allow_actions=args.allow_actions,
        poll_wait=args.poll_wait,
        require_approval=not args.no_approval,
        approval_timeout=args.approval_timeout,
    ).run()


if __name__ == "__main__":
    main()
