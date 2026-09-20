import os
import secrets
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent

HOST = "127.0.0.1"  # Bound strictly to localhost
PORT = 8765

TOKEN_FILE = BASE_DIR / "auth_token.txt"

def get_or_create_token() -> str:
    """Generates a secure 32-character hexadecimal token if not already present."""
    if TOKEN_FILE.exists():
        token = TOKEN_FILE.read_text(encoding="utf-8").strip()
        if len(token) >= 16:
            return token

    # Generate new random cryptographic token
    new_token = secrets.token_hex(24)
    try:
        TOKEN_FILE.write_text(new_token, encoding="utf-8")
    except Exception as e:
        print(f"Warning: Could not write token file: {e}")
    return new_token

AUTH_TOKEN = get_or_create_token()

# Rate limiting
MAX_REQUESTS_PER_MINUTE = 120
ALLOWED_ORIGIN_PREFIXES = [
    "chrome-extension://",
    "http://127.0.0.1",
    "http://localhost"
]
