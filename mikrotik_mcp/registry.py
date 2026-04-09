"""
RouterRegistry — Per-user MikroTik router credential store.

Each Telegram user gets a JSON file in data_dir that holds their
registered routers plus a pointer to the "default" router.
Thread-safe via atomic writes (write-to-temp then rename).
"""

import json
import logging
import os
import tempfile
from copy import deepcopy
from datetime import datetime
from pathlib import Path

logger = logging.getLogger(__name__)


def _now() -> str:
    return datetime.utcnow().isoformat() + "Z"


def _empty_user(user_id: str) -> dict:
    return {
        "version": 1,
        "user_id": str(user_id),
        "default_router": None,
        "routers": {},
    }


class RouterRegistry:
    """Manages per-user router registrations stored as JSON files."""

    def __init__(self, data_dir: str = "/app/data"):
        self.data_dir = Path(data_dir)
        self.data_dir.mkdir(parents=True, exist_ok=True)

    # ── internal helpers ──────────────────────────────────────

    def _user_path(self, user_id: str) -> Path:
        """Return path to user's JSON file."""
        return self.data_dir / f"{user_id}.json"

    def _load(self, user_id: str) -> dict:
        """Load user data. Return empty template if file doesn't exist."""
        path = self._user_path(user_id)
        if not path.exists():
            return _empty_user(user_id)
        try:
            with open(path, "r", encoding="utf-8") as f:
                return json.load(f)
        except (json.JSONDecodeError, OSError) as exc:
            logger.error("Failed to load %s: %s", path, exc)
            return _empty_user(user_id)

    def _save(self, user_id: str, data: dict):
        """Atomic save — write to temp file then rename into place."""
        path = self._user_path(user_id)
        fd, tmp = tempfile.mkstemp(dir=self.data_dir, suffix=".tmp")
        try:
            with os.fdopen(fd, "w", encoding="utf-8") as f:
                json.dump(data, f, indent=2, ensure_ascii=False)
                f.flush()
                os.fsync(f.fileno())
            os.replace(tmp, path)
        except BaseException:
            # Clean up the temp file on any failure
            try:
                os.unlink(tmp)
            except OSError:
                pass
            raise

    # ── public API ────────────────────────────────────────────

    def has_routers(self, user_id: str) -> bool:
        """Check if user has any registered routers."""
        data = self._load(user_id)
        return bool(data["routers"])

    def list_routers(self, user_id: str) -> list[dict]:
        """List all routers for user (WITHOUT passwords). Include default marker."""
        data = self._load(user_id)
        default = data.get("default_router")
        result = []
        for name, info in data["routers"].items():
            entry = {k: v for k, v in info.items() if k != "password"}
            entry["name"] = name
            entry["is_default"] = (name == default)
            result.append(entry)
        return result

    def add_router(
        self,
        user_id: str,
        name: str,
        host: str,
        port: int,
        username: str,
        password: str,
        label: str = "",
        routeros_version: str = "",
        board: str = "",
    ) -> dict:
        """Add a router. Return status dict or error if name already exists."""
        data = self._load(user_id)

        if name in data["routers"]:
            return {"error": f"Router '{name}' already exists for this user."}

        now = _now()
        data["routers"][name] = {
            "host": host,
            "port": port,
            "username": username,
            "password": password,
            "label": label,
            "routeros_version": routeros_version,
            "board": board,
            "added_at": now,
            "last_seen": now,
        }

        # First router becomes the default automatically
        if len(data["routers"]) == 1:
            data["default_router"] = name

        self._save(user_id, data)
        logger.info("User %s added router '%s' (%s:%s)", user_id, name, host, port)
        return {"status": "ok", "message": f"Router '{name}' registered."}

    def remove_router(self, user_id: str, name: str) -> dict:
        """Remove router by name. Adjust default if needed."""
        data = self._load(user_id)

        if name not in data["routers"]:
            return {"error": f"Router '{name}' not found."}

        del data["routers"][name]

        # Fix up default pointer
        if data["default_router"] == name:
            remaining = list(data["routers"].keys())
            data["default_router"] = remaining[0] if remaining else None

        self._save(user_id, data)
        logger.info("User %s removed router '%s'", user_id, name)
        return {"status": "ok", "message": f"Router '{name}' removed."}

    def get_router(self, user_id: str, name: str) -> dict:
        """Get full router details (WITH password) for connection."""
        data = self._load(user_id)
        router = data["routers"].get(name)
        if router is None:
            return {"error": f"Router '{name}' not found."}
        result = deepcopy(router)
        result["name"] = name
        return result

    def set_default(self, user_id: str, name: str) -> dict:
        """Set default router for this user."""
        data = self._load(user_id)
        if name not in data["routers"]:
            return {"error": f"Router '{name}' not found."}
        data["default_router"] = name
        self._save(user_id, data)
        return {"status": "ok", "message": f"Default router set to '{name}'."}

    def get_default_name(self, user_id: str) -> str | None:
        """Get the name of the default router, or None."""
        data = self._load(user_id)
        default = data.get("default_router")
        # Guard against stale pointer
        if default and default in data["routers"]:
            return default
        return None

    def resolve(self, user_id: str, router_name: str | None = None) -> dict | list[dict]:
        """Resolve router name to connection details.

        - None   -> use default router
        - "all"  -> return list of ALL routers with credentials
        - name   -> return that specific router

        Raises ValueError if not found or user has no routers.
        """
        data = self._load(user_id)

        if not data["routers"]:
            raise ValueError("You have no registered routers. Use /addrouter first.")

        # Return all routers
        if router_name and router_name.lower() == "all":
            result = []
            for name, info in data["routers"].items():
                entry = deepcopy(info)
                entry["name"] = name
                result.append(entry)
            return result

        # Determine which router to use
        target = router_name
        if target is None:
            target = data.get("default_router")
            if not target or target not in data["routers"]:
                raise ValueError("No default router set. Specify a router name or set a default.")

        if target not in data["routers"]:
            available = ", ".join(data["routers"].keys())
            raise ValueError(f"Router '{target}' not found. Available: {available}")

        result = deepcopy(data["routers"][target])
        result["name"] = target
        return result

    def update_last_seen(
        self,
        user_id: str,
        name: str,
        routeros_version: str = "",
        board: str = "",
    ):
        """Update last_seen timestamp and optionally version/board."""
        data = self._load(user_id)
        router = data["routers"].get(name)
        if router is None:
            return  # silently skip — router may have been removed

        router["last_seen"] = _now()
        if routeros_version:
            router["routeros_version"] = routeros_version
        if board:
            router["board"] = board

        self._save(user_id, data)
