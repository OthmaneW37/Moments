"""Auth — hashing de mot de passe (stdlib) + tokens JWT."""
import hashlib
import os
import secrets
from datetime import datetime, timedelta, timezone

import jwt
from fastapi import Header, HTTPException

from .config import DATA_DIR
from .db import get_conn

# Clé secrète : env `MOMENTS_SECRET` en priorité (recommandé en prod pour ne pas
# invalider les sessions à chaque redéploiement), sinon fichier local persistant.
_SECRET_FILE = DATA_DIR / "secret.key"
if os.environ.get("MOMENTS_SECRET"):
    SECRET_KEY = os.environ["MOMENTS_SECRET"].strip()
else:
    if not _SECRET_FILE.exists():
        _SECRET_FILE.write_text(secrets.token_hex(32))
    SECRET_KEY = _SECRET_FILE.read_text().strip()

ALGO = "HS256"
TOKEN_DAYS = 30


# ---------- Mots de passe (PBKDF2, stdlib — pas de dépendance) ----------

def hash_password(password: str) -> str:
    salt = secrets.token_hex(16)
    dk = hashlib.pbkdf2_hmac("sha256", password.encode(), bytes.fromhex(salt), 200_000)
    return f"{salt}${dk.hex()}"


def verify_password(password: str, stored: str) -> bool:
    try:
        salt, hex_dk = stored.split("$")
        dk = hashlib.pbkdf2_hmac("sha256", password.encode(), bytes.fromhex(salt), 200_000)
        return secrets.compare_digest(dk.hex(), hex_dk)
    except (ValueError, TypeError):
        return False


# ---------- JWT ----------

def create_token(user_id: int) -> str:
    payload = {
        "sub": str(user_id),
        "exp": datetime.now(timezone.utc) + timedelta(days=TOKEN_DAYS),
    }
    return jwt.encode(payload, SECRET_KEY, algorithm=ALGO)


def current_user(authorization: str | None = Header(default=None)) -> dict:
    """Dépendance FastAPI : renvoie l'utilisateur connecté ou 401."""
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(401, "Non connecté")
    try:
        payload = jwt.decode(authorization[7:], SECRET_KEY, algorithms=[ALGO])
        user_id = int(payload["sub"])
    except (jwt.PyJWTError, KeyError, ValueError):
        raise HTTPException(401, "Session invalide ou expirée")

    with get_conn() as conn:
        row = conn.execute(
            "SELECT id, username, display_name, emoji, city, is_private, created_at "
            "FROM users WHERE id = ?",
            (user_id,),
        ).fetchone()
    if row is None:
        raise HTTPException(401, "Compte introuvable")
    return dict(row)
