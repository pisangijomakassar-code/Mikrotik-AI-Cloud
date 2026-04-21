"""Fernet symmetric encryption for router credentials."""
import os
from pathlib import Path
from cryptography.fernet import Fernet


class CredentialStore:
    def __init__(self, key_path: str = "/app/data/.master_key"):
        """Load or auto-generate encryption key."""
        self.key_path = Path(key_path)
        self._fernet = self._load_or_create_key()

    def _load_or_create_key(self) -> Fernet:
        """Load existing key or generate new one."""
        if self.key_path.exists():
            key = self.key_path.read_bytes().strip()
        else:
            key = Fernet.generate_key()
            self.key_path.parent.mkdir(parents=True, exist_ok=True)
            self.key_path.write_bytes(key)
            self.key_path.chmod(0o600)
        return Fernet(key)

    def encrypt(self, plaintext: str) -> str:
        """Encrypt plaintext → base64 token string."""
        return self._fernet.encrypt(plaintext.encode()).decode()

    def decrypt(self, token: str) -> str:
        """Decrypt base64 token → plaintext string.

        Falls back to returning the token as-is when it is not a valid
        Fernet ciphertext (e.g. a password stored in plain-text directly
        in the database by the Next.js dashboard before this fix).
        """
        try:
            return self._fernet.decrypt(token.encode()).decode()
        except Exception:
            # Not a valid Fernet token — treat as plain-text password
            return token

    def is_encrypted(self, value) -> bool:
        """Return True when value looks like a Fernet ciphertext."""
        if isinstance(value, dict):
            return value.get("encrypted") is True
        if isinstance(value, str):
            # Fernet tokens always start with 'gAAAAA' (base64-url of version byte)
            return value.startswith("gAAAAA")
        return False
