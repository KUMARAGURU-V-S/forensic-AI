"""
Authentication Router — login, register, current user.
POST /auth/login     — returns JWT token
POST /auth/register  — create investigator account
GET  /auth/me        — current user info
"""
from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from typing import Optional
from backend.services.auth_service import (
    hash_password, verify_password, create_token, get_current_user
)

router = APIRouter()


class LoginRequest(BaseModel):
    username: str
    password: str


class RegisterRequest(BaseModel):
    username: str
    password: str
    email: Optional[str] = None
    full_name: Optional[str] = ""
    role: str = "investigator"


@router.post("/login")
def login(req: LoginRequest):
    """Authenticate and return JWT token."""
    user = _get_user_by_username(req.username)
    if not user:
        raise HTTPException(status_code=401, detail="Invalid username or password")
    if not verify_password(req.password, user["hashed_password"]):
        raise HTTPException(status_code=401, detail="Invalid username or password")
    if not user.get("is_active", True):
        raise HTTPException(status_code=403, detail="Account disabled")

    token = create_token(user["id"], user["username"], user["role"])
    return {
        "access_token": token,
        "token_type": "bearer",
        "user": {
            "id": user["id"],
            "username": user["username"],
            "full_name": user["full_name"],
            "role": user["role"],
            "email": user.get("email"),
        }
    }


@router.post("/register")
def register(req: RegisterRequest):
    """Register a new investigator account."""
    existing = _get_user_by_username(req.username)
    if existing:
        raise HTTPException(status_code=409, detail="Username already taken")
    user = _create_user(req.username, req.password, req.email or "", req.full_name or "", req.role)
    token = create_token(user["id"], user["username"], user["role"])
    return {"access_token": token, "token_type": "bearer", "user": {
        "id": user["id"], "username": user["username"],
        "full_name": user["full_name"], "role": user["role"],
    }}


@router.get("/me")
def me(current: dict = Depends(get_current_user)):
    """Return current authenticated user info."""
    # Fetch from DB for fresh data
    user = _get_user_by_id(current.get("sub", ""))
    if user:
        return {"id": user["id"], "username": user["username"],
                "full_name": user["full_name"], "role": user["role"], "email": user.get("email")}
    return {"id": current.get("sub"), "username": current.get("username"), "role": current.get("role")}


# ── DB Helpers ────────────────────────────────────────────────────────────────

def _get_user_by_username(username: str) -> Optional[dict]:
    try:
        from backend.db.database import SessionLocal
        from backend.db.models import User
        db = SessionLocal()
        u = db.query(User).filter(User.username == username).first()
        db.close()
        return _user_to_dict(u) if u else None
    except Exception:
        return None


def _get_user_by_id(user_id: str) -> Optional[dict]:
    try:
        from backend.db.database import SessionLocal
        from backend.db.models import User
        db = SessionLocal()
        u = db.query(User).filter(User.id == user_id).first()
        db.close()
        return _user_to_dict(u) if u else None
    except Exception:
        return None


def _create_user(username, password, email, full_name, role) -> dict:
    from backend.db.database import SessionLocal
    from backend.db.models import User
    db = SessionLocal()
    u = User(username=username, email=email or None,
             hashed_password=hash_password(password),
             role=role, full_name=full_name)
    db.add(u); db.commit()
    result = _user_to_dict(u)
    db.close()
    return result


def _user_to_dict(u) -> dict:
    return {"id": u.id, "username": u.username, "email": u.email,
            "hashed_password": u.hashed_password, "full_name": u.full_name,
            "role": u.role, "is_active": u.is_active}
