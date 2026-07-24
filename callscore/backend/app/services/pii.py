"""
Respondent PII encryption at rest (Bible Part 9). Fernet-encrypts phone
numbers using CONSENT_ENCRYPTION_KEY. Fail-closed on write: if the key is
unset, imports refuse to store plaintext numbers rather than silently
violating the Bible. Reads degrade gracefully (a wrong key shows the
value as unreadable, not a crash).
"""
import base64
import hashlib

from cryptography.fernet import Fernet, InvalidToken

from app.core import config

_PREFIX = "enc::"


def _fernet() -> Fernet | None:
    key = config.CONSENT_ENCRYPTION_KEY
    if not key:
        return None
    # Accept any passphrase: derive a urlsafe 32-byte Fernet key from it.
    digest = hashlib.sha256(key.encode()).digest()
    return Fernet(base64.urlsafe_b64encode(digest))


def encryption_available() -> bool:
    return _fernet() is not None


def encrypt_pii(value: str | None) -> str | None:
    if value is None or value == "":
        return value
    f = _fernet()
    if f is None:
        raise RuntimeError(
            "CONSENT_ENCRYPTION_KEY is not set — refusing to store respondent "
            "PII in plaintext (Bible Part 9)."
        )
    return _PREFIX + f.encrypt(value.encode()).decode()


def decrypt_pii(value: str | None) -> str | None:
    if not value or not value.startswith(_PREFIX):
        return value  # legacy/plaintext rows pass through unchanged
    f = _fernet()
    if f is None:
        return "•• encrypted ••"
    try:
        return f.decrypt(value[len(_PREFIX):].encode()).decode()
    except (InvalidToken, Exception):
        return "•• unreadable ••"
