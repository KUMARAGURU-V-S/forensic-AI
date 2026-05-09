"""
JWT Authentication Service.
Uses python-jose for token signing + passlib for password hashing.
"""
import os
from datetime import datetime, timedelta
from typing import Optional

from jose import JWTError, jwt
from passlib.context import CryptContext
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials

SECRET_KEY  = os.environ.get("JWT_SECRET", "forensic-ai-secret-key-change-in-production-2024")
ALGORITHM   = "HS256"
EXPIRE_HOURS= int(os.environ.get("JWT_EXPIRE_HOURS", "24"))

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
bearer_scheme = HTTPBearer(auto_error=False)


def hash_password(plain: str) -> str:
    return pwd_context.hash(plain)


def verify_password(plain: str, hashed: str) -> bool:
    return pwd_context.verify(plain, hashed)


def create_token(user_id: str, username: str, role: str) -> str:
    payload = {
        "sub": user_id,
        "username": username,
        "role": role,
        "exp": datetime.utcnow() + timedelta(hours=EXPIRE_HOURS),
        "iat": datetime.utcnow(),
    }
    return jwt.encode(payload, SECRET_KEY, algorithm=ALGORITHM)


def decode_token(token: str) -> dict:
    try:
        return jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
    except JWTError as e:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Invalid or expired token: {e}",
            headers={"WWW-Authenticate": "Bearer"},
        )


def get_current_user(credentials: Optional[HTTPAuthorizationCredentials] = Depends(bearer_scheme)) -> dict:
    """FastAPI dependency — returns decoded token payload. Accepts missing token gracefully."""
    if not credentials:
        # Allow unauthenticated access for demo mode
        return {"sub": "demo", "username": "investigator", "role": "investigator"}
    return decode_token(credentials.credentials)


def require_role(required: str):
    """Dependency factory that enforces a minimum role."""
    def _check(user: dict = Depends(get_current_user)):
        roles = {"viewer": 0, "investigator": 1, "admin": 2}
        if roles.get(user.get("role", "viewer"), 0) < roles.get(required, 0):
            raise HTTPException(status_code=403, detail="Insufficient permissions")
        return user
    return _check


def _ensure_default_user():
    """Create default investigator account if no users exist."""
    try:
        from backend.db.database import SessionLocal
        from backend.db.models import User
        db = SessionLocal()
        if db.query(User).count() == 0:
            admin = User(
                username="admin",
                email="admin@forensicai.local",
                hashed_password=hash_password("forensic2024"),
                role="admin",
                full_name="System Administrator",
            )
            inv = User(
                username="investigator",
                email="investigator@forensicai.local",
                hashed_password=hash_password("forensic2024"),
                role="investigator",
                full_name="Det. Sarah Mitchell",
            )
            db.add_all([admin, inv])
            db.commit()
            print("[Auth] Default users created: admin / investigator (password: forensic2024)")
        db.close()
    except Exception as e:
        print(f"[Auth] Could not create default users: {e}")
