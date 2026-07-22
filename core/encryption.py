import os
import base64
from cryptography.fernet import Fernet
from cryptography.hazmat.primitives import hashes
from cryptography.hazmat.primitives.kdf.pbkdf2 import PBKDF2HMAC
from core.config import settings


def _get_encryption_key() -> bytes:
    """
    Get or generate encryption key for app passwords.
    In production, this should be set via environment variable APP_ENCRYPTION_KEY.
    """
    key = os.environ.get("APP_ENCRYPTION_KEY")
    if key:
        # Use provided key (must be 32 url-safe base64-encoded bytes)
        return base64.urlsafe_b64decode(key.encode())
    
    # For development, generate a key from JWT_SECRET (not ideal for production)
    # In production, always set APP_ENCRYPTION_KEY environment variable
    kdf = PBKDF2HMAC(
        algorithm=hashes.SHA256(),
        length=32,
        salt=b'job_easy_salt',  # In production, use a proper random salt
        iterations=100000,
    )
    key = base64.urlsafe_b64encode(kdf.derive(settings.JWT_SECRET.encode()))
    return key


def encrypt_app_password(password: str) -> str:
    """
    Encrypt an app password for storage.
    
    Args:
        password: The plaintext app password
        
    Returns:
        Encrypted password as base64 string
    """
    key = _get_encryption_key()
    fernet = Fernet(key)
    encrypted = fernet.encrypt(password.encode())
    return base64.urlsafe_b64encode(encrypted).decode()


def decrypt_app_password(encrypted_password: str) -> str:
    """
    Decrypt an app password for use in email sending.
    
    Args:
        encrypted_password: The encrypted password (base64 string)
        
    Returns:
        The plaintext password
    """
    key = _get_encryption_key()
    fernet = Fernet(key)
    encrypted_bytes = base64.urlsafe_b64decode(encrypted_password.encode())
    decrypted = fernet.decrypt(encrypted_bytes)
    return decrypted.decode()


def mask_email(email: str) -> str:
    """
    Mask an email address for display in admin views.
    
    Args:
        email: The email address to mask
        
    Returns:
        Masked email (e.g., j***@example.com)
    """
    if '@' not in email:
        return email
    
    local, domain = email.split('@', 1)
    if len(local) <= 2:
        masked_local = '*' * len(local)
    else:
        masked_local = local[0] + '*' * (len(local) - 2) + local[-1]
    
    return f"{masked_local}@{domain}"
