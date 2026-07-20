import secrets
from datetime import datetime, timedelta, timezone
import hashlib
import bcrypt  # Use native bcrypt directly

from jose import jwt
from core.config import settings

def _get_clean_prehash(password: str) -> bytes:
    """
    Hashes any password down to deterministic bytes for native bcrypt compatibility.
    """
    return hashlib.sha256(password.encode("utf-8")).digest()


def _get_legacy_prehash(password: str) -> bytes:
    return hashlib.sha256(password.encode("utf-8")).hexdigest().encode("utf-8")

def hash_password(password: str) -> str:
    # 1. Get clean 64-byte hex representation
    prehashed = _get_clean_prehash(password)
    # 2. Generate salt and hash natively
    salt = bcrypt.gensalt()
    hashed = bcrypt.hashpw(prehashed, salt)
    # 3. Decode to standard string for database storage
    return hashed.decode("utf-8")

def verify_password(plain_password: str, hashed_password: str) -> bool:
    try:
        prehashed = _get_clean_prehash(plain_password)
        stored_hash = hashed_password.encode("utf-8")
        if bcrypt.checkpw(prehashed, stored_hash):
            return True
        return bcrypt.checkpw(_get_legacy_prehash(plain_password), stored_hash)
    except Exception:
        return False

def generate_5_digit_code() -> str:
    return "".join(secrets.choice("0123456789") for _ in range(5))

def generate_token_id() -> str:
    return secrets.token_urlsafe(32)

def create_access_token(data: dict) -> str:
    to_encode = data.copy()
    # Note: Using timezone-aware or UTC dates depending on your settings library configuration
    expire = datetime.now(timezone.utc) + timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode.update({"exp": expire, "token_type": "access"})
    return jwt.encode(to_encode, settings.JWT_SECRET, algorithm=settings.JWT_ALGORITHM)

def create_refresh_token(data: dict) -> str:
    to_encode = data.copy()
    expire = datetime.now(timezone.utc) + timedelta(days=settings.REFRESH_TOKEN_EXPIRE_DAYS)
    to_encode.update({"exp": expire, "token_type": "refresh"})
    return jwt.encode(to_encode, settings.JWT_SECRET, algorithm=settings.JWT_ALGORITHM)

def create_password_reset_token(email: str, token_id: str) -> str:
    expire = datetime.now(timezone.utc) + timedelta(
        minutes=settings.PASSWORD_RESET_TOKEN_EXPIRE_MINUTES
    )
    to_encode = {
        "sub": email,
        "jti": token_id,
        "exp": expire,
        "token_type": "password_reset",
    }
    return jwt.encode(to_encode, settings.JWT_SECRET, algorithm=settings.JWT_ALGORITHM)
