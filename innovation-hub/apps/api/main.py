"""
Analytics Transformation Hub — local demo backend (FastAPI + SQLite).

Role logic:
- Register -> always 'viewer'. Roles are granted ONLY by an admin in the admin center.
- Seeded admin account: email 'admin', password 'admin'.
- Everyone can: use the idea canvas, view the roadmap, and SUBMIT a tool for review.
- A submitted tool is 'pending' until the committee approves / requests changes / declines (with a note).
- On approval the tool goes live, is assigned to its submitter, and that person becomes a 'product_owner'.

Run:  uvicorn main:app --reload --port 8000
"""
import os
import secrets
import re
import time
import base64
import tempfile
from urllib.parse import urljoin
import datetime as dt
import json
import threading
from typing import Optional, List

import jwt
import httpx
from passlib.context import CryptContext
from fastapi import FastAPI, Depends, HTTPException, Header, Response, Request
from fastapi.responses import HTMLResponse, FileResponse
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from sqlalchemy import Column, JSON, delete, TEXT
from sqlmodel import SQLModel, Field, Session, create_engine, select

SECRET = os.environ.get("HUB_SECRET", "dev-demo-secret-change-me")
ALGO = "HS256"

DB_URL = os.environ.get("DATABASE_URL")
if not DB_URL:
    DB_PATH = os.path.join(os.path.dirname(__file__), "hub.db")
    DB_URL = f"sqlite:///{DB_PATH}"

if "sqlite" in DB_URL:
    engine = create_engine(DB_URL, connect_args={"check_same_thread": False})
else:
    engine = create_engine(DB_URL)

pwd = CryptContext(schemes=["pbkdf2_sha256"], deprecated="auto")
OLLAMA_URL = os.environ.get("OLLAMA_URL", "http://localhost:11434")
OLLAMA_MODEL = os.environ.get("OLLAMA_MODEL", "llama3.2")
ROLES = ("waiting", "viewer", "product_owner", "committee", "approver", "admin")


# ----------------------------------------------------------------- models
class User(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    email: str = Field(index=True, unique=True)
    name: str = ""
    role: str = "viewer"
    department: str = ""
    password_hash: str = ""
    ai_provider: str = "local"
    ai_key: str = ""
    ai_model: Optional[str] = "llama3.2"
    ai_credits: int = Field(default=5)
    ai_usage: int = Field(default=0)
    created_at: float = Field(default_factory=lambda: time.time())


class Tool(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    owner_id: int = 0
    owner: str = ""
    name: str = ""
    category: str = "IX Suite"
    status: str = "pilot"
    problem: str = ""
    capabilities: List[str] = Field(default=[], sa_column=Column(JSON))
    delivers: str = ""
    benefits: str = ""
    tags: List[str] = Field(default=[], sa_column=Column(JSON))
    impact: str = ""
    roi: float = 0
    sample: str = ""
    configs: str = ""
    timeline: List[dict] = Field(default=[], sa_column=Column(JSON))
    review_status: str = "pending"   # pending | approved | changes | declined
    review_note: str = ""
    review_history: List[dict] = Field(default=[], sa_column=Column(JSON))
    implementation_status: str = "already_implemented"  # already_implemented | not_yet_implemented | 3rd_party_resale
    department: str = ""
    idea_id: Optional[int] = None
    votes: int = 0
    voters: List[int] = Field(default=[], sa_column=Column(JSON))
    demo_url: str = ""               # weblink demo (browser-in-browser)
    video_url: str = ""              # video file/link
    ppt_url: str = ""                # pitch deck link (viewed inline)
    has_demo: bool = False
    demo_html: str = ""
    account: str = ""
    img_url: str = ""
    badges: List[dict] = Field(default=[], sa_column=Column(JSON))
    notes: List[dict] = Field(default=[], sa_column=Column(JSON))
    featured: bool = Field(default=False)
    sort_order: int = Field(default=0)
    achieved_through: str = ""
    edit_history: List[dict] = Field(default=[], sa_column=Column(JSON))
    time_to_deploy: str = ""
    success_stories: List[dict] = Field(default=[], sa_column=Column(JSON))
    co_owners: List[dict] = Field(default=[], sa_column=Column(JSON))
    demo_type: str = Field(default="html") # html | container | url
    demo_zip_url: str = Field(default="")
    demo_container_status: str = Field(default="stopped") # stopped | building | build_failed | running | security_flagged
    demo_container_port: Optional[int] = Field(default=None)
    demo_container_build_logs: str = Field(default="", sa_column=Column(TEXT))
    demo_security_report: str = Field(default="", sa_column=Column(TEXT))
    review_comments: List[dict] = Field(default=[], sa_column=Column(JSON))
    created_at: float = Field(default_factory=lambda: time.time())


class GlobalApiKey(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    provider: str = "gemini" # gemini | openai
    key_value: str
    label: str = ""
    is_active: bool = True
    requests_count: int = 0
    daily_requests_count: int = 0
    daily_limit: int = 1000
    last_used_date: str = ""
    created_at: float = Field(default_factory=lambda: time.time())


class ActivityLog(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    user_id: int = Field(index=True)
    user_name: str = ""
    page: str = ""
    duration_seconds: int = 0
    created_at: float = Field(default_factory=lambda: time.time())


class AIAuditLog(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    user_id: int = Field(index=True)
    user_name: str = ""
    prompt: str = ""
    response: str = ""
    provider: str = ""
    api_key_used: str = ""
    latency_seconds: float = 0.0
    prompt_chars: int = 0
    response_chars: int = 0
    created_at: float = Field(default_factory=lambda: time.time())


class CatalogSearchLog(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    user_id: int = Field(index=True)
    user_name: str = ""
    query: str = ""
    created_at: float = Field(default_factory=lambda: time.time())


class ProductViewLog(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    user_id: int = Field(index=True)
    user_name: str = ""
    tool_id: int = Field(index=True)
    tool_name: str = ""
    created_at: float = Field(default_factory=lambda: time.time())


class ActionClickLog(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    user_id: int = Field(index=True)
    user_name: str = ""
    action_type: str = "" # e.g. "adopt_click", "demo_launch", "deck_view"
    tool_id: int = Field(index=True)
    tool_name: str = ""
    created_at: float = Field(default_factory=lambda: time.time())


class SubmissionFunnelLog(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    user_id: int = Field(index=True)
    user_name: str = ""
    action: str = "" # "start_draft" | "submit" | "discard"
    draft_id: str = ""
    created_at: float = Field(default_factory=lambda: time.time())



class SponsorRequest(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    tool_id: int = 0
    tool_name: str = ""
    owner_id: int = 0
    user_id: int = 0
    user_name: str = ""
    kind: str = "adopt"   # adopt | sponsor
    note: str = ""
    created_at: float = Field(default_factory=lambda: time.time())


class Idea(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    owner_id: int = 0
    owner: str = ""
    name: str = "Untitled idea"
    status: str = "draft"            # draft | proposed | approved | changes | declined
    canvas: dict = Field(default={}, sa_column=Column(JSON))
    scores: dict = Field(default={}, sa_column=Column(JSON))
    review_note: str = ""
    review_history: List[dict] = Field(default=[], sa_column=Column(JSON))
    decided_by: str = ""
    votes: int = 0
    voters: List[int] = Field(default=[], sa_column=Column(JSON))
    notes: List[dict] = Field(default=[], sa_column=Column(JSON))
    review_comments: List[dict] = Field(default=[], sa_column=Column(JSON))
    voc_id: Optional[int] = None
    team: str = ""
    tool_id: Optional[int] = None
    created_at: float = Field(default_factory=lambda: time.time())
    updated_at: float = Field(default_factory=lambda: time.time())

class VocIssue(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    owner_id: int = 0
    owner_name: str = ""
    title: str = ""
    problem_statement: str = ""
    department: str = ""
    votes: int = 0
    voters: List[int] = Field(default=[], sa_column=Column(JSON))
    status: str = "open"
    client: str = ""
    created_at: float = Field(default_factory=lambda: time.time())



class Invitation(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    email: str = Field(unique=True, index=True)
    token: str = Field(unique=True, index=True)
    role: str = "viewer"
    created_at: float = Field(default_factory=lambda: time.time())
    expires_at: float
    status: str = "pending"  # pending | accepted


class Setting(SQLModel, table=True):
    key: str = Field(primary_key=True)
    value: str = ""


class ChatMessage(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    user_id: int = Field(index=True)
    sender: str
    text: str
    created_at: float = Field(default_factory=lambda: time.time())


class ChatMessageIn(BaseModel):
    sender: str
    text: str


# ----------------------------------------------------------------- schemas
class RegisterIn(BaseModel):
    email: str
    password: str
    name: str = ""
    department: str = ""
    token: Optional[str] = None


class LoginIn(BaseModel):
    email: str
    password: str


class AIKeyIn(BaseModel):
    ai_provider: str
    ai_key: str
    ai_model: Optional[str] = "llama3.2"


class ChangePasswordIn(BaseModel):
    current_password: str
    new_password: str


class AIGenerateIn(BaseModel):
    prompt: str
    model: Optional[str] = None


class ReviewIn(BaseModel):
    decision: str    # approve | changes | decline
    note: str = ""


class RoleIn(BaseModel):
    role: str


class AdminPasswordResetIn(BaseModel):
    password: str


class InviteIn(BaseModel):
    email: str
    role: str


class SponsorIn(BaseModel):
    kind: str = "adopt"
    note: str = ""


# ----------------------------------------------------------------- app
app = FastAPI(title="Analytics Transformation Hub — demo API")
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173", "http://127.0.0.1:5173",
        "http://localhost:5174", "http://127.0.0.1:5174",
        "http://localhost:5175", "http://127.0.0.1:5175",
        "http://localhost:3000", "http://127.0.0.1:3000",
    ],
    allow_origin_regex="https?://(localhost|127\\.0\\.0\\.1)(:\\d+)?",
    allow_credentials=True, allow_methods=["*"], allow_headers=["*"],
)

@app.exception_handler(Exception)
async def _unhandled_exception(request: Request, exc: Exception):
    # Unhandled exceptions bypass CORSMiddleware, so the browser reports an
    # opaque "Failed to fetch". Return the real error with CORS headers instead.
    from fastapi.responses import JSONResponse
    headers = {}
    origin = request.headers.get("origin")
    if origin:
        headers["Access-Control-Allow-Origin"] = origin
        headers["Access-Control-Allow-Credentials"] = "true"
    return JSONResponse(status_code=500, content={"detail": f"{type(exc).__name__}: {exc}"}, headers=headers)


def get_session():
    with Session(engine) as s:
        yield s


def make_token(user: User) -> str:
    payload = {"sub": str(user.id), "role": user.role, "exp": dt.datetime.utcnow() + dt.timedelta(days=7)}
    return jwt.encode(payload, SECRET, algorithm=ALGO)


def current_user(authorization: str = Header(default=""), s: Session = Depends(get_session)) -> User:
    if not authorization.startswith("Bearer "):
        raise HTTPException(401, "Missing token")
    try:
        data = jwt.decode(authorization.split(" ", 1)[1], SECRET, algorithms=[ALGO])
    except jwt.PyJWTError:
        raise HTTPException(401, "Invalid token")
    user = s.get(User, int(data["sub"]))
    if not user:
        raise HTTPException(401, "Unknown user")
    return user


def optional_user(authorization: str = Header(default=""), s: Session = Depends(get_session)) -> Optional[User]:
    if not authorization.startswith("Bearer "):
        return None
    try:
        data = jwt.decode(authorization.split(" ", 1)[1], SECRET, algorithms=[ALGO])
    except jwt.PyJWTError:
        return None
    return s.get(User, int(data["sub"]))



def is_owner_or_co_owner(obj, user: User) -> bool:
    if getattr(obj, "owner_id", None) == user.id:
        return True
    co_owners = getattr(obj, "co_owners", None)
    if co_owners and isinstance(co_owners, list):
        user_email = user.email.lower().strip()
        user_name = user.name.lower().strip()
        for co in co_owners:
            co_email = co.get("email", "").lower().strip()
            co_name = co.get("name", "").lower().strip()
            if (co_email and co_email == user_email) or (co_name and co_name == user_name):
                return True
    return False


def require(*roles):
    def dep(u: User = Depends(current_user)) -> User:
        if u.role not in roles:
            raise HTTPException(403, f"Requires role: {', '.join(roles)}")
        return u
    return dep


def public_user(u: User) -> dict:
    daily_count = 0
    try:
        today_start = dt.datetime.combine(dt.date.today(), dt.time.min).timestamp()
        with Session(engine) as s:
            daily_count = len(s.exec(
                select(AIAuditLog)
                .where(AIAuditLog.user_id == u.id)
                .where(AIAuditLog.created_at >= today_start)
            ).all())
    except Exception:
        pass

    return {
        "id": u.id,
        "email": u.email,
        "name": u.name,
        "role": u.role,
        "department": getattr(u, "department", ""),
        "ai_provider": u.ai_provider,
        "has_ai_key": bool(u.ai_key),
        "ai_model": getattr(u, "ai_model", "llama3.2"),
        "ai_credits": u.ai_credits,
        "ai_usage": u.ai_usage,
        "daily_usage": daily_count
    }


def public_tool(t: Tool) -> dict:
    d = t.dict()
    d.pop("demo_html", None)
    return d


def public_idea(i: Idea, s: Session) -> dict:
    d = i.dict()
    owner_user = s.get(User, i.owner_id)
    d["owner_email"] = owner_user.email if owner_user else ""
    return d


# Old proxy routes removed in favor of the upgraded path-prefix proxy at the bottom of the file


@app.get("/api/uploads/{filename}")
def get_upload(filename: str):
    file_path = os.path.join("uploads", filename)
    if not os.path.exists(file_path):
        raise HTTPException(status_code=404, detail="File not found")
    return FileResponse(file_path)


@app.get("/auth/invites/validate")
def validate_invite(token: str, s: Session = Depends(get_session)):
    inv = s.exec(select(Invitation).where(Invitation.token == token)).first()
    if not inv:
        raise HTTPException(400, "Invitation code is invalid.")
    if inv.status != "pending":
        raise HTTPException(400, "Invitation code has already been used.")
    if inv.expires_at < time.time():
        raise HTTPException(400, "Invitation code has expired.")
    return {"email": inv.email, "role": inv.role}


# ----------------------------------------------------------------- auth
@app.post("/auth/register")
def register(body: RegisterIn, s: Session = Depends(get_session)):
    email = body.email.lower().strip()
    if not email.endswith("@concentrix.com"):
        raise HTTPException(400, "Registration is restricted to @concentrix.com email addresses.")
    
    password = body.password
    if len(password) < 8:
        raise HTTPException(400, "Password must be at least 8 characters long.")
    if not re.search(r"[A-Z]", password):
        raise HTTPException(400, "Password must contain at least one uppercase letter.")
    if not re.search(r"[a-z]", password):
        raise HTTPException(400, "Password must contain at least one lowercase letter.")
    if not re.search(r"\d", password):
        raise HTTPException(400, "Password must contain at least one digit.")
    if not re.search(r"[!@#$%^&*(),.?\":{}|<>]", password):
        raise HTTPException(400, "Password must contain at least one special character.")

    if s.exec(select(User).where(User.email == email)).first():
        raise HTTPException(400, "Email already registered")

    invite_role = None
    if body.token:
        inv = s.exec(select(Invitation).where(Invitation.token == body.token)).first()
        if not inv:
            raise HTTPException(400, "Invitation token is invalid.")
        if inv.status != "pending":
            raise HTTPException(400, "Invitation token has already been used.")
        if inv.expires_at < time.time():
            raise HTTPException(400, "Invitation token has expired.")
        if inv.email != email:
            raise HTTPException(400, "Invitation token email mismatch.")
        invite_role = inv.role
        inv.status = "accepted"
        s.add(inv)

    role = invite_role if invite_role else "waiting"
    
    u = User(email=email, name=body.name or email.split("@")[0], role=role,
             department=body.department or "", password_hash=pwd.hash(body.password))
    s.add(u); s.commit(); s.refresh(u)

    if role == "waiting":
        return {
            "waiting": True,
            "message": "You're officially on the waitlist! We'll keep you updated and let you know the moment the Concentrix Marketplace is ready for you to explore."
        }

    return {"token": make_token(u), "user": public_user(u)}


@app.post("/auth/login")
def login(body: LoginIn, s: Session = Depends(get_session)):
    u = s.exec(select(User).where(User.email == body.email.lower().strip())).first()
    if not u or not pwd.verify(body.password, u.password_hash):
        raise HTTPException(401, "Invalid email or password")
    if u.role == "waiting":
        raise HTTPException(403, "Your account is on the waitlist pending administrator approval.")
    return {"token": make_token(u), "user": public_user(u)}


@app.get("/auth/me")
def me(u: User = Depends(current_user)):
    return public_user(u)


@app.put("/me/aikey")
def set_aikey(body: AIKeyIn, u: User = Depends(current_user), s: Session = Depends(get_session)):
    u.ai_provider = body.ai_provider
    u.ai_key = body.ai_key
    if body.ai_model:
        u.ai_model = body.ai_model
    s.add(u); s.commit()
    return public_user(u)


@app.put("/me/password")
def change_password(body: ChangePasswordIn, u: User = Depends(current_user), s: Session = Depends(get_session)):
    if not pwd.verify(body.current_password, u.password_hash):
        raise HTTPException(400, "Current password is incorrect.")
        
    password = body.new_password
    if len(password) < 8:
        raise HTTPException(400, "New password must be at least 8 characters long.")
    if not re.search(r"[A-Z]", password):
        raise HTTPException(400, "New password must contain at least one uppercase letter.")
    if not re.search(r"[a-z]", password):
        raise HTTPException(400, "New password must contain at least one lowercase letter.")
    if not re.search(r"\d", password):
        raise HTTPException(400, "New password must contain at least one digit.")
    if not re.search(r"[!@#$%^&*(),.?\":{}|<>]", password):
        raise HTTPException(400, "New password must contain at least one special character.")
        
    u.password_hash = pwd.hash(password)
    s.add(u); s.commit()
    return public_user(u)


# ----------------------------------------------------------------- tools
@app.get("/tools")
def list_tools(s: Session = Depends(get_session)):
    rows = s.exec(select(Tool).where(Tool.review_status == "approved").order_by(Tool.created_at.desc())).all()
    return [public_tool(t) for t in rows]


@app.get("/my/tools")
def my_tools(u: User = Depends(current_user), s: Session = Depends(get_session)):
    rows = s.exec(select(Tool).order_by(Tool.created_at.desc())).all()
    filtered = [t for t in rows if is_owner_or_co_owner(t, u)]
    return [public_tool(t) for t in filtered]


@app.get("/review/tools")
def review_tools(u: User = Depends(require("committee", "approver", "admin")), s: Session = Depends(get_session)):
    rows = s.exec(select(Tool).where(Tool.review_status.in_(["pending", "changes"])).order_by(Tool.created_at)).all()
    return [public_tool(t) for t in rows]

@app.get("/archive/tools")
def archive_tools(u: User = Depends(require("committee", "approver", "admin")), s: Session = Depends(get_session)):
    rows = s.exec(select(Tool).where(Tool.review_status.in_(["declined", "changes"])).order_by(Tool.created_at.desc())).all()
    return [public_tool(t) for t in rows]


def save_uploaded_ppt_as_pdf(ppt_data_url: str) -> str:
    if not ppt_data_url or not ppt_data_url.startswith("data:"):
        return ppt_data_url
        
    parts = ppt_data_url.split(",", 1)
    if len(parts) != 2:
        return ppt_data_url
        
    header, base64_data = parts
    is_pdf = "pdf" in header
    is_ppt = "presentation" in header or "powerpoint" in header
    
    if not is_pdf and not is_ppt:
        return ppt_data_url
        
    try:
        os.makedirs("uploads", exist_ok=True)
        file_bytes = base64.b64decode(base64_data)
        if len(file_bytes) > 5 * 1024 * 1024:
            raise HTTPException(400, "File size exceeds the 5MB limit.")
        filename = f"deck_{int(time.time() * 1000)}.pdf"
        target_pdf_path = os.path.join("uploads", filename)
        
        if is_pdf:
            with open(target_pdf_path, "wb") as f:
                f.write(file_bytes)
        else:
            with tempfile.NamedTemporaryFile(suffix=".pptx", delete=False) as temp_pptx:
                temp_pptx.write(file_bytes)
                temp_pptx_path = temp_pptx.name
                
            abs_pptx = os.path.abspath(temp_pptx_path)
            abs_pdf = os.path.abspath(target_pdf_path)
            
            import win32com.client
            import pythoncom
            
            pythoncom.CoInitialize()
            powerpoint = win32com.client.Dispatch("Powerpoint.Application")
            powerpoint.Visible = 1
            
            deck = powerpoint.Presentations.Open(abs_pptx, WithWindow=False)
            deck.SaveAs(abs_pdf, 32)  # 32 = PpSaveAsPDF
            deck.Close()
            powerpoint.Quit()
            
            try:
                os.remove(temp_pptx_path)
            except Exception:
                pass
                
        return f"/api/uploads/{filename}"
        
    except Exception as e:
        print("Save PPT as PDF error:", e)
        return ppt_data_url


def save_uploaded_file(data_url: str, prefix: str) -> str:
    if not data_url or not data_url.startswith("data:"):
        return data_url
        
    parts = data_url.split(",", 1)
    if len(parts) != 2:
        return data_url
        
    header, base64_data = parts
    
    # Try to determine file extension
    ext = "bin"
    if "image/jpeg" in header or "image/jpg" in header:
        ext = "jpg"
    elif "image/png" in header:
        ext = "png"
    elif "image/gif" in header:
        ext = "gif"
    elif "image/svg" in header:
        ext = "svg"
    elif "video/mp4" in header:
        ext = "mp4"
    elif "video/quicktime" in header:
        ext = "mov"
    elif "application/pdf" in header:
        ext = "pdf"
    elif "text/html" in header:
        ext = "html"
    elif "application/zip" in header:
        ext = "zip"
    elif "application/octet-stream" in header:
        ext = "bin"
    else:
        try:
            mime = header.split(";")[0].split(":")[1]
            ext = mime.split("/")[1]
        except Exception:
            pass

    try:
        os.makedirs("uploads", exist_ok=True)
        file_bytes = base64.b64decode(base64_data)
        limit = 50 * 1024 * 1024 if prefix == "demo_zip" else 5 * 1024 * 1024
        if len(file_bytes) > limit:
            raise HTTPException(400, f"File size exceeds the {limit // (1024*1024)}MB limit.")
        filename = f"{prefix}_{int(time.time() * 1000)}.{ext}"
        target_path = os.path.join("uploads", filename)
        
        with open(target_path, "wb") as f:
            f.write(file_bytes)
            
        return f"/api/uploads/{filename}"
        
    except Exception as e:
        print(f"Save file {prefix} error:", e)
        return data_url
def process_tool_files(body: dict):
    import json
    # 1. Handle ppt_url
    ppt_url = body.get("ppt_url", "")
    if ppt_url and ppt_url.startswith("data:"):
        body["ppt_url"] = save_uploaded_ppt_as_pdf(ppt_url)
        
    # 2. Handle img_url
    img_url = body.get("img_url", "")
    if img_url and img_url.startswith("data:"):
        body["img_url"] = save_uploaded_file(img_url, "img")
        
    # 3. Handle configs
    configs = body.get("configs", "")
    if configs and configs.startswith("data:"):
        body["configs"] = save_uploaded_file(configs, "config")
        
    # 4. Handle video_url
    video_url = body.get("video_url", "")
    if video_url and video_url.startswith("data:"):
        body["video_url"] = save_uploaded_file(video_url, "video")
        
    # 5. Handle sample
    sample = body.get("sample", "")
    if sample:
        if sample.startswith("data:"):
            body["sample"] = save_uploaded_file(sample, "sample")
        elif sample.startswith("["):
            try:
                files = json.loads(sample)
                updated = False
                for f in files:
                    if f.get("data", "").startswith("data:"):
                        f["data"] = save_uploaded_file(f["data"], "sample")
                        updated = True
                if updated:
                    body["sample"] = json.dumps(files)
            except Exception as e:
                print("Failed to process multiple samples:", e)

    # 6. Handle success_stories
    success_stories = body.get("success_stories", [])
    if isinstance(success_stories, list):
        updated = False
        for story in success_stories:
            file_url = story.get("file_url", "")
            if file_url.startswith("data:"):
                if "application/vnd.openxmlformats-officedocument.presentationml.presentation" in file_url or file_url.endswith(".pptx"):
                    story["file_url"] = save_uploaded_ppt_as_pdf(file_url)
                else:
                    story["file_url"] = save_uploaded_file(file_url, "story")
                updated = True
        if updated:
            body["success_stories"] = success_stories

    # 7. Handle demo_zip_url
    demo_zip_url = body.get("demo_zip_url", "")
    if demo_zip_url and demo_zip_url.startswith("data:"):
        body["demo_zip_url"] = save_uploaded_file(demo_zip_url, "demo_zip")


def _update_tool_db_local(tool_id: int, updates: dict):
    with Session(engine) as session:
        t = session.get(Tool, tool_id)
        if t:
            for k, v in updates.items():
                setattr(t, k, v)
            session.add(t); session.commit()

def auto_trigger_container_build_if_needed(tool: Tool, session: Session):
    if getattr(tool, "demo_type", "html") == "container" and getattr(tool, "demo_zip_url", ""):
        status = getattr(tool, "demo_container_status", "stopped")
        if status in ("stopped", "build_failed", "security_flagged"):
            cfg = get_ai_audit_config(session)
            api_key = get_gemini_api_key(session)
            if cfg["ai_enabled"] and cfg["provider"] == "gemini" and not api_key:
                tool.demo_container_status = "build_failed"
                tool.demo_container_build_logs = "Build cancelled: Gemini API key is not configured. Add a key, switch to a local model, or disable the AI audit in Admin settings."
                session.add(tool); session.commit()
                return
                
            def run_analysis_and_build():
                import asyncio
                import json
                try:
                    from analyzer import analyze_and_audit_zip_codebase
                    zip_path = tool.demo_zip_url.lstrip("/")
                    if zip_path.startswith("api/"):
                        zip_path = zip_path[4:]
                        
                    _update_tool_db_local(tool.id, {
                        "demo_container_status": "building",
                        "demo_container_build_logs": "Analyzing ZIP codebase and running AI security audit...\n"
                    })
                    
                    loop = asyncio.new_event_loop()
                    asyncio.set_event_loop(loop)
                    audit = loop.run_until_complete(analyze_and_audit_zip_codebase(
                        zip_path, api_key or "",
                        ai_enabled=cfg["ai_enabled"], provider=cfg["provider"],
                        local_url=cfg["local_url"], local_model=cfg["local_model"],
                    ))
                    loop.close()
                    
                    _update_tool_db_local(tool.id, {"demo_security_report": json.dumps(audit)})
                    
                    if audit["decision"] == "flag":
                        _update_tool_db_local(tool.id, {
                            "demo_container_status": "security_flagged",
                            "demo_container_build_logs": f"Codebase flagged by AI security audit: {audit['reason']}"
                        })
                        return
                        
                    from container_manager import build_and_run_demo_container
                    build_and_run_demo_container(
                        db_url=DB_URL,
                        tool_id=tool.id,
                        zip_path=zip_path,
                        dockerfile_content=audit["dockerfile"],
                        container_port=audit["container_port"]
                    )
                except Exception as e:
                    _update_tool_db_local(tool.id, {
                        "demo_container_status": "build_failed",
                        "demo_container_build_logs": f"Audit pipeline failed: {str(e)}"
                    })
                    
            import threading
            t = threading.Thread(target=run_analysis_and_build)
            t.daemon = True
            t.start()


@app.post("/tools")
def create_tool(body: dict, u: User = Depends(current_user), s: Session = Depends(get_session)):
    process_tool_files(body)
        
    t = Tool(owner_id=u.id, owner=body.get("owner") or u.name, review_status="pending")
    for k in ("name", "category", "status", "problem", "delivers", "benefits", "impact", "sample", "configs",
              "implementation_status", "department", "idea_id", "demo_url", "video_url", "ppt_url", "account", "img_url", "achieved_through", "sort_order", "time_to_deploy", "success_stories",
              "demo_type", "demo_zip_url"):
        if k in body:
            setattr(t, k, body[k])
    t.capabilities = body.get("capabilities", []) or []
    t.tags = body.get("tags", []) or []
    t.timeline = body.get("timeline", []) or []
    t.notes = body.get("notes", []) or []
    t.roi = float(body.get("roi") or 0)
    t.demo_html = body.get("demo_html", "") or ""
    t.has_demo = bool(t.demo_html or t.demo_url or t.demo_zip_url)
    t.badges = body.get("badges", []) or []
    
    t.edit_history = [{
        "editor_id": u.id,
        "editor_name": u.name,
        "timestamp": time.time(),
        "note": "Initial product submission",
        "changed_fields": ["created"]
    }]

    s.add(t); s.commit(); s.refresh(t)
    auto_trigger_container_build_if_needed(t, s)
    notify_teams(s, f"🛠️ New tool submitted: {t.name}",
                 [f"**Owner:** {t.owner or u.name}",
                  f"**Category:** {t.category or 'Uncategorized'}",
                  f"**ROI claim:** ${t.roi:,.0f}/yr" if t.roi else "**ROI claim:** none",
                  f"**Problem:** {(t.problem or '')[:200]}"],
                 "/review")
    return public_tool(t)


@app.get("/tools/{tool_id}")
def get_tool(tool_id: int, u: Optional[User] = Depends(optional_user), s: Session = Depends(get_session)):
    t = s.get(Tool, tool_id)
    if not t: raise HTTPException(404, "Not found")
    if t.review_status != "approved":
        if not u: raise HTTPException(401, "Authentication required for pending tools")
        if not is_owner_or_co_owner(t, u) and u.role not in ("committee", "approver", "admin"):
            raise HTTPException(403, "Access denied")
    return public_tool(t)


@app.patch("/tools/{tool_id}")
def update_tool(tool_id: int, body: dict, u: User = Depends(current_user), s: Session = Depends(get_session)):
    process_tool_files(body)

    t = s.get(Tool, tool_id)
    if not t: raise HTTPException(404, "Not found")
    if not is_owner_or_co_owner(t, u) and u.role not in ("committee", "approver", "admin"):
        raise HTTPException(403, "Only the owner or an admin/committee can edit this tool")
        
    changed = []
    for k in ("name", "category", "status", "problem", "delivers", "benefits", "impact", "owner", "sample", "configs",
              "implementation_status", "department", "idea_id", "demo_url", "video_url", "ppt_url", "account", "img_url", "featured", "achieved_through", "sort_order", "time_to_deploy", "success_stories",
              "demo_type", "demo_zip_url"):
        if k in body and body[k] != getattr(t, k):
            changed.append(k)
            
    if "capabilities" in body and body["capabilities"] != t.capabilities: changed.append("capabilities")
    if "tags" in body and body["tags"] != t.tags: changed.append("tags")
    if "timeline" in body and body["timeline"] != t.timeline: changed.append("timeline")
    if "roi" in body and float(body["roi"] or 0) != t.roi: changed.append("roi")
    if "demo_html" in body and body["demo_html"] != t.demo_html: changed.append("demo_html")
    if "badges" in body and body["badges"] != t.badges: changed.append("badges")

    for k in ("name", "category", "status", "problem", "delivers", "benefits", "impact", "owner", "sample", "configs",
              "implementation_status", "department", "idea_id", "demo_url", "video_url", "ppt_url", "account", "img_url", "featured", "achieved_through", "sort_order", "time_to_deploy", "success_stories",
              "demo_type", "demo_zip_url"):
        if k in body: setattr(t, k, body[k])
    if "capabilities" in body: t.capabilities = body["capabilities"] or []
    if "tags" in body: t.tags = body["tags"] or []
    if "timeline" in body: t.timeline = body["timeline"] or []
    if "notes" in body: t.notes = body["notes"] or []
    if "roi" in body: t.roi = float(body["roi"] or 0)
    if "demo_html" in body: t.demo_html = body["demo_html"] or ""
    if "badges" in body: t.badges = body["badges"] or []
    if "co_owners" in body: t.co_owners = body["co_owners"] or []
    t.has_demo = bool(t.demo_html or t.demo_url or t.demo_zip_url)
    
    # If the tool is in "changes" or "declined" review status and the owner edits it,
    # it is automatically resubmitted to the review queue (review_status = "pending").
    if is_owner_or_co_owner(t, u) and t.review_status in ("changes", "declined"):
        t.review_status = "pending"
        changed.append("review_status")
        
    if changed or body.get("edit_note"):
        history = list(t.edit_history or [])
        history.append({
            "editor_id": u.id,
            "editor_name": u.name,
            "timestamp": time.time(),
            "note": body.get("edit_note") or "Details updated",
            "changed_fields": changed
        })
        t.edit_history = history
        
    s.add(t); s.commit(); s.refresh(t)
    auto_trigger_container_build_if_needed(t, s)
    return public_tool(t)


@app.delete("/tools/{tool_id}/logs/{log_index}")
def delete_tool_log(tool_id: int, log_index: int, u: User = Depends(current_user), s: Session = Depends(get_session)):
    if u.role != "admin":
        raise HTTPException(403, "Only admins can delete change logs")
    t = s.get(Tool, tool_id)
    if not t: raise HTTPException(404, "Not found")
    
    history = list(t.edit_history or [])
    if 0 <= log_index < len(history):
        history.pop(log_index)
        t.edit_history = history
        s.add(t); s.commit(); s.refresh(t)
    else:
        raise HTTPException(400, "Invalid log index")
        
    return public_tool(t)


@app.post("/tools/{tool_id}/review")
def review_tool(tool_id: int, body: ReviewIn, u: User = Depends(require("committee", "approver", "admin")), s: Session = Depends(get_session)):
    t = s.get(Tool, tool_id)
    if not t: raise HTTPException(404, "Not found")
    
    history = list(t.review_history or [])
    
    if u.role == "committee":
        history.append({"reviewer_id": u.id, "reviewer_name": u.name, "decision": body.decision, "note": body.note, "timestamp": time.time()})
        t.review_history = history
    elif u.role in ("approver", "admin"):
        t.review_note = body.note
        if body.decision == "approve":
            t.review_status = "approved"
            owner = s.get(User, t.owner_id)
            if owner and owner.role == "viewer":      # submitter becomes a product owner
                owner.role = "product_owner"; s.add(owner)
        elif body.decision == "changes":
            t.review_status = "changes"
        elif body.decision == "decline":
            t.review_status = "declined"
        else:
            raise HTTPException(400, "decision must be approve | changes | decline")
        history.append({"reviewer_id": u.id, "reviewer_name": u.name, "decision": body.decision, "note": body.note, "timestamp": time.time(), "final": True})
        t.review_history = history

    s.add(t); s.commit(); s.refresh(t)
    return public_tool(t)


@app.delete("/tools/{tool_id}")
def delete_tool(tool_id: int, u: User = Depends(current_user), s: Session = Depends(get_session)):
    t = s.get(Tool, tool_id)
    if not t: raise HTTPException(404, "Not found")
    if not is_owner_or_co_owner(t, u) and u.role != "admin":
        raise HTTPException(403, "Only the owner or an admin can delete this tool")
    if t.demo_type == "container":
        try:
            from container_manager import stop_and_remove_demo_container
            stop_and_remove_demo_container(t.id)
        except Exception as ex:
            print("Failed to stop container on tool deletion:", ex)
    s.delete(t); s.commit()
    return {"ok": True}


@app.get("/tools/{tool_id}/demo")
def tool_demo(tool_id: int, s: Session = Depends(get_session)):
    t = s.get(Tool, tool_id)
    return {"demo_html": t.demo_html}


def get_ai_audit_config(s: Session) -> dict:
    """AI audit settings: enabled toggle, provider (gemini | local), local server details."""
    rows = {r.key: r.value for r in s.exec(select(Setting)).all()}
    return {
        "ai_enabled": rows.get("ai_audit_enabled", "true") != "false",
        "provider": rows.get("ai_audit_provider", "gemini"),
        "local_url": rows.get("local_model_url", "http://localhost:11434"),
        "local_model": rows.get("local_model_name", "llama3.2"),
    }


def notify_teams(s: Session, title: str, lines: list, link_path: str = "") -> bool:
    """Post an Adaptive Card to the Teams channel webhook (Workflows app).
    Fire-and-forget in a background thread. Returns False if no webhook configured."""
    row = s.get(Setting, "teams_webhook_url")
    url = (row.value if row else "").strip()
    if not url:
        return False
    base_row = s.get(Setting, "app_base_url")
    base = (base_row.value if base_row else "").strip().rstrip("/")

    card = {
        "$schema": "http://adaptivecards.io/schemas/adaptive-card.json",
        "type": "AdaptiveCard",
        "version": "1.4",
        "body": [
            {"type": "TextBlock", "size": "Medium", "weight": "Bolder", "text": title, "wrap": True},
            *[{"type": "TextBlock", "text": l, "wrap": True, "spacing": "Small"} for l in lines],
        ],
    }
    if base and link_path:
        card["actions"] = [{"type": "Action.OpenUrl", "title": "Open in Marketplace", "url": f"{base}{link_path}"}]
    payload = {
        "type": "message",
        "attachments": [{"contentType": "application/vnd.microsoft.card.adaptive", "content": card}],
    }

    def _send():
        try:
            r = httpx.post(url, json=payload, timeout=10)
            if r.status_code >= 300:
                print(f"Teams notify failed: HTTP {r.status_code}: {r.text[:300]}")
        except Exception as e:
            print(f"Teams notify failed: {e}")

    threading.Thread(target=_send, daemon=True).start()
    return True


@app.post("/admin/teams-test")
def teams_test(u: User = Depends(require("admin")), s: Session = Depends(get_session)):
    ok = notify_teams(s, "✅ Marketplace → Teams is connected",
                      ["This is a test notification. New idea and tool submissions will appear here."],
                      "/review")
    if not ok:
        raise HTTPException(400, "No Teams webhook URL configured. Paste the workflow URL in Admin settings first.")
    return {"ok": True}


def get_gemini_api_key(s: Session) -> Optional[str]:
    # Check global active gemini key
    key = s.exec(select(GlobalApiKey).where(GlobalApiKey.is_active == True).where(GlobalApiKey.provider == "gemini")).first()
    if key:
        return key.key_value
    # Fallback to any active key
    key_any = s.exec(select(GlobalApiKey).where(GlobalApiKey.is_active == True)).first()
    if key_any:
        return key_any.key_value
    # Env fallback
    env_key = os.environ.get("GEMINI_API_KEY")
    if env_key:
        return env_key
    return None


@app.get("/tools/{tool_id}/demo/raw", response_class=HTMLResponse)
@app.get("/api/tools/{tool_id}/demo/raw", response_class=HTMLResponse)
def tool_demo_raw(tool_id: int, s: Session = Depends(get_session)):
    t = s.get(Tool, tool_id)
    if not t:
        return HTMLResponse("<h3>Tool not found</h3>", status_code=404)
        
    import json
    d_type = getattr(t, "demo_type", "html")
    if d_type == "container":
        status = getattr(t, "demo_container_status", "stopped")
        port = getattr(t, "demo_container_port", None)
        if status == "running" and port:
            from fastapi.responses import RedirectResponse
            return RedirectResponse(url=f"/api/tools/{tool_id}/demo/proxy/")
        elif status == "sleeping":
            from container_manager import wake_container
            if wake_container(tool_id):
                t.demo_container_status = "running"
                s.add(t); s.commit()
                return HTMLResponse(
                    "<div style='font-family:sans-serif;padding:40px;text-align:center;color:#475569'>"
                    "<h3>Waking up the demo…</h3><p>It was asleep to save resources. One moment.</p></div>"
                    "<meta http-equiv='refresh' content='2'>"
                )
            return HTMLResponse("<h3>Demo is asleep and failed to wake. Try 'Run AI Audit & Rebuild' in the review center.</h3>")
        elif status == "building":
            return HTMLResponse("<h3>Live demo is currently building. Please wait a few seconds and refresh...</h3>")
        elif status == "build_failed":
            logs = getattr(t, "demo_container_build_logs", "")
            return HTMLResponse(f"<h3>Build failed.</h3><pre style='background:#f4f4f5;padding:12px;border:1px solid #e4e4e7;border-radius:6px;overflow:auto;max-height:400px;'>{logs}</pre>")
        elif status == "security_flagged":
            report_str = getattr(t, "demo_security_report", "")
            try:
                report = json.loads(report_str)
                reason = report.get("reason", "Codebase flagged by AI security check.")
            except Exception:
                reason = report_str or "Codebase flagged by AI security check."
            return HTMLResponse(f"<div style='color:#ef4444;font-weight:bold;margin-bottom:8px;'>Security Flagged:</div><pre style='background:#fef2f2;color:#991b1b;padding:12px;border:1px solid #fee2e2;border-radius:6px;'>{reason}</pre>")
        else:
            return HTMLResponse(f"<h3>Live demo status: {status}</h3>")
            
    elif d_type == "url":
        if not t.demo_url:
            return HTMLResponse("<h3>No URL provided for this live demo.</h3>", status_code=404)
        from fastapi.responses import RedirectResponse
        return RedirectResponse(url=t.demo_url)
        
    else: # html
        if not t.demo_html:
            return HTMLResponse("<h3>No HTML demo available for this tool.</h3>", status_code=404)
        return HTMLResponse(content=t.demo_html)


@app.api_route("/api/tools/{tool_id}/demo/proxy/{path:path}", methods=["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS", "HEAD"])
async def proxy_container_demo(tool_id: int, path: str, request: Request, s: Session = Depends(get_session)):
    t = s.get(Tool, tool_id)
    if not t:
        raise HTTPException(404, "Tool not found")
    if getattr(t, "demo_type", "html") != "container" or not getattr(t, "demo_container_port", None):
        raise HTTPException(400, "Container demo is not running")

    from container_manager import touch
    touch(tool_id)  # keeps the idle-sleep watcher from stopping an in-use demo

    target_url = f"http://127.0.0.1:{t.demo_container_port}/{path}"
    
    query_params = dict(request.query_params)
    if query_params:
        from urllib.parse import urlencode
        target_url += "?" + urlencode(query_params)
        
    body = await request.body()
    
    headers = {}
    for k, v in request.headers.items():
        if k.lower() not in ("host", "connection", "keep-alive"):
            headers[k] = v
            
    try:
        async with httpx.AsyncClient(timeout=15.0, follow_redirects=False) as client:
            resp = await client.request(
                method=request.method,
                url=target_url,
                headers=headers,
                content=body
            )
            
            resp_headers = dict(resp.headers)
            for key in list(resp_headers.keys()):
                if key.lower() in ("x-frame-options", "content-security-policy", "content-length"):
                    resp_headers.pop(key)

            content = resp.content
            # Vite/CRA builds reference assets with root-absolute paths (/assets/...).
            # Rewrite them in HTML so they stay under this proxy prefix.
            if "text/html" in resp.headers.get("content-type", ""):
                prefix = f"/api/tools/{tool_id}/demo/proxy"
                html = content.decode("utf-8", errors="ignore")
                html = re.sub(r'((?:src|href|action)=")/(?!/)', rf'\1{prefix}/', html)
                content = html.encode("utf-8")

            return Response(
                content=content,
                status_code=resp.status_code,
                headers=resp_headers
            )
    except Exception as e:
        raise HTTPException(502, f"Failed to connect to containerized demo: {e}")


@app.post("/tools/{tool_id}/demo/build")
async def trigger_demo_build(tool_id: int, u: User = Depends(current_user), s: Session = Depends(get_session)):
    t = s.get(Tool, tool_id)
    if not t: raise HTTPException(404, "Tool not found")
    if not is_owner_or_co_owner(t, u) and u.role != "admin":
        raise HTTPException(403, "Access denied")
    if not t.demo_zip_url:
        raise HTTPException(400, "No ZIP file uploaded for containerized demo")
        
    cfg = get_ai_audit_config(s)
    api_key = get_gemini_api_key(s)
    if cfg["ai_enabled"] and cfg["provider"] == "gemini" and not api_key:
        raise HTTPException(500, "Gemini API key is not configured. Please add an active Gemini key in the Admin settings, or switch the AI audit to a local model / disable it.")

    # Run analyzer
    zip_path = t.demo_zip_url.lstrip("/") # uploads/demo_zip_xxx.zip
    # Support relative path if starts with api/
    if zip_path.startswith("api/"):
        zip_path = zip_path[4:]

    # Respond immediately and run the audit + build in the background: the
    # Gemini audit alone can take minutes, and holding the HTTP request open
    # that long gets the connection dropped ("Failed to fetch").
    tool_id_val = t.id
    first_step = "[1/4] Build queued. Starting AI security audit...\n" if cfg["ai_enabled"] else "[1/4] Build queued. AI audit disabled — using heuristic stack detection...\n"
    t.demo_container_status = "building"
    t.demo_container_build_logs = first_step
    s.add(t); s.commit()

    def run_audit_and_build():
        import asyncio
        def log_fail(msg):
            # ponytail: failure history lives in build_logs (appended, capped at 20KB); separate table if it ever needs querying
            stamp = dt.datetime.utcnow().strftime("%Y-%m-%d %H:%M:%S UTC")
            with Session(engine) as bs:
                bt = bs.get(Tool, tool_id_val)
                if bt:
                    bt.demo_container_status = "build_failed"
                    bt.demo_container_build_logs = (
                        (bt.demo_container_build_logs or "") + f"\n=== Failure @ {stamp} ===\n{msg}\n"
                    )[-20000:]
                    bs.add(bt); bs.commit()
        try:
            from analyzer import analyze_and_audit_zip_codebase
            loop = asyncio.new_event_loop()
            asyncio.set_event_loop(loop)
            audit = loop.run_until_complete(analyze_and_audit_zip_codebase(
                zip_path, api_key or "",
                ai_enabled=cfg["ai_enabled"], provider=cfg["provider"],
                local_url=cfg["local_url"], local_model=cfg["local_model"],
            ))
            loop.close()

            _update_tool_db_local(tool_id_val, {"demo_security_report": json.dumps(audit)})

            if audit["decision"] == "flag":
                _update_tool_db_local(tool_id_val, {
                    "demo_container_status": "security_flagged",
                    "demo_container_build_logs": f"[2/4] AI audit FLAGGED the codebase. Build blocked.\nReason: {audit['reason']}\n"
                })
                return

            _update_tool_db_local(tool_id_val, {
                "demo_container_build_logs": f"[2/4] AI audit passed ({audit['tech_stack']}). Dockerfile generated.\n[3/4] Starting Docker build...\n"
            })

            from container_manager import build_and_run_demo_container
            build_and_run_demo_container(
                db_url=DB_URL,
                tool_id=tool_id_val,
                zip_path=zip_path,
                dockerfile_content=audit["dockerfile"],
                container_port=audit["container_port"]
            )
        except Exception as e:
            log_fail(f"[2/4] AI audit failed: {e}")

    threading.Thread(target=run_audit_and_build, daemon=True).start()
    return {"ok": True, "detail": "Build pipeline started. Watch the container status and build logs for progress."}


REVIEWER_ROLES = ("committee", "approver", "admin")

@app.post("/tools/{tool_id}/review-comments")
def add_tool_review_comment(tool_id: int, body: dict, u: User = Depends(current_user), s: Session = Depends(get_session)):
    if u.role not in REVIEWER_ROLES:
        raise HTTPException(403, "Reviewers only")
    t = s.get(Tool, tool_id)
    if not t: raise HTTPException(404, "Tool not found")
    text = (body.get("text") or "").strip()
    if not text: raise HTTPException(400, "Comment text is required")
    comments = list(t.review_comments or [])
    comments.append({"author": u.name or u.email, "text": text, "ts": time.time()})
    t.review_comments = comments
    s.add(t); s.commit()
    return {"ok": True, "review_comments": comments}


@app.post("/ideas/{idea_id}/review-comments")
def add_idea_review_comment(idea_id: int, body: dict, u: User = Depends(current_user), s: Session = Depends(get_session)):
    if u.role not in REVIEWER_ROLES:
        raise HTTPException(403, "Reviewers only")
    i = s.get(Idea, idea_id)
    if not i: raise HTTPException(404, "Idea not found")
    text = (body.get("text") or "").strip()
    if not text: raise HTTPException(400, "Comment text is required")
    comments = list(i.review_comments or [])
    comments.append({"author": u.name or u.email, "text": text, "ts": time.time()})
    i.review_comments = comments
    s.add(i); s.commit()
    return {"ok": True, "review_comments": comments}


@app.get("/review/digest")
def review_digest(u: User = Depends(current_user), s: Session = Depends(get_session)):
    """Markdown summary of everything pending review — for sharing with the committee."""
    if u.role not in REVIEWER_ROLES:
        raise HTTPException(403, "Reviewers only")
    tools = s.exec(select(Tool).where(Tool.review_status.in_(["pending", "changes"])).order_by(Tool.created_at)).all()
    ideas = s.exec(select(Idea).where(Idea.status == "proposed").order_by(Idea.created_at)).all()

    today = dt.date.today().isoformat()
    lines = [f"# Pending Review Digest — {today}", ""]
    lines.append(f"**{len(tools)} tool(s)** and **{len(ideas)} idea(s)** awaiting a decision.")
    lines.append("")

    if tools:
        lines.append("## Tools")
        for t in tools:
            demo = "container demo" if t.demo_type == "container" else ("web demo" if t.demo_type == "url" else ("HTML demo" if t.has_demo else "no demo"))
            if t.demo_type == "container":
                demo += f" ({t.demo_container_status})"
            roi = f"${t.roi:,.0f}/yr" if t.roi else "no ROI claim"
            age_days = int((time.time() - (t.created_at or time.time())) / 86400)
            comments = len(t.review_comments or [])
            lines.append(f"- **{t.name}** ({t.category or 'uncategorized'}) — by {t.owner or 'unknown'}, {roi}, {demo}, "
                         f"waiting {age_days}d, {comments} reviewer comment(s)"
                         + (f" — status: {t.review_status}" if t.review_status != "pending" else ""))
            if t.problem:
                lines.append(f"  - Problem: {t.problem[:180]}")
        lines.append("")

    if ideas:
        lines.append("## Ideas")
        for i in ideas:
            age_days = int((time.time() - (i.created_at or time.time())) / 86400)
            comments = len(i.review_comments or [])
            lines.append(f"- **{i.name}** — by {i.owner or 'unknown'}, {i.votes} vote(s), waiting {age_days}d, {comments} reviewer comment(s)")

    if not tools and not ideas:
        lines.append("_Nothing pending. All caught up!_")

    return {"markdown": "\n".join(lines), "tool_count": len(tools), "idea_count": len(ideas)}


@app.post("/review/ai-digest")
async def review_ai_digest(u: User = Depends(current_user), s: Session = Depends(get_session)):
    """Generates an AI executive digest of all pending tools and ideas using Gemini/OpenAI."""
    if u.role not in REVIEWER_ROLES:
        raise HTTPException(403, "Reviewers only")
        
    tools = s.exec(select(Tool).where(Tool.review_status.in_(["pending", "changes"])).order_by(Tool.created_at)).all()
    ideas = s.exec(select(Idea).where(Idea.status == "proposed").order_by(Idea.created_at)).all()
    
    input_lines = []
    if tools:
        input_lines.append("Tools Awaiting Review:")
        for t in tools:
            roi_str = f"${t.roi:,.0f}/yr" if t.roi else "no ROI claimed"
            input_lines.append(f"- Name: {t.name} | Category: {t.category} | Owner: {t.owner} | ROI: {roi_str}")
            input_lines.append(f"  Problem: {t.problem}")
            if t.capabilities:
                input_lines.append(f"  Capabilities: {t.capabilities}")
            input_lines.append(f"  Review Status: {t.review_status}")
    if ideas:
        input_lines.append("Proposed Ideas:")
        for i in ideas:
            input_lines.append(f"- Title: {i.name} | Owner: {i.owner} | Votes: {i.votes}")
            if getattr(i, "description", None):
                input_lines.append(f"  Description: {i.description}")
                
    data_str = "\n".join(input_lines) if (tools or ideas) else "No pending items."
    
    prompt = f"""You are the Executive Innovation Assistant. Act as a seasoned chief of staff creating a comprehensive, detailed, and highly informative executive summary for the innovation board.
Read the list of pending submissions (tools and ideas awaiting review) and produce a high-impact, professional weekly cadence board Executive Digest.

Guidelines:
1. Start with a header:
   "🚀 **Weekly Innovation Board Digest - {dt.date.today().isoformat()}**"
   followed by a brief 1-2 sentence overview of overall pending activity (e.g. "We currently have {len(tools)} tool(s) and {len(ideas)} idea(s) awaiting review. Please find the detailed executive summaries and recommended actions below.")
2. Group the items into:
   - **🎯 Tools Awaiting Approval**: For each tool, provide its name, owner, department, and a detailed summary of its features, core value (what specific problem it solves, its main technical capabilities/deliverables), estimated ROI/savings, and a clear board Recommendation (e.g. "Approve for Pilot", "Schedule Demo", "Return to Owner for Info").
   - **💡 Community Ideas**: For each idea, provide its name, owner, community votes/engagement level, a thorough description of its intent and features, and recommended next steps/actions.
3. CRITICAL: Do NOT consolidate or group distinct submissions under generic categories. Every single submission must be detailed individually by name so the board knows exactly what it is reviewing and approving.
4. For each submission, do NOT overly condense the original description or problem statement. You must be descriptive and thorough, providing a detailed breakdown (typically 4-6 sentences or multiple clear bullet points per item) that highlights its unique features, technical flavor, and how it functions. If the input data has specific details, make sure to include them in the summary.
5. Keep the formatting clean, professional, and well-spaced with clear paragraph separations.

Pending Submissions List:
{data_str}
"""

    start_time = time.time()
    
    def record_usage(prompt_str, response_str, provider_name, key_label, key_used_val):
        latency = time.time() - start_time
        u.ai_usage += 1
        s.add(u)
        audit = AIAuditLog(
            user_id=u.id,
            user_name=u.name or u.email,
            prompt="[AI Executive Digest Generation]",
            response=response_str[:500] + "...",
            provider=provider_name,
            api_key_used=key_label or "key",
            latency_seconds=round(latency, 2),
            prompt_chars=len(prompt_str),
            response_chars=len(response_str)
        )
        s.add(audit)
        s.commit()

    provider = u.ai_provider or "local"
    personal_key = u.ai_key
    res_text = None
    via = None
    
    if u.role == "admin" and provider != "local" and personal_key:
        try:
            if provider == "gemini":
                res_text = await _gemini(personal_key, prompt)
                record_usage(prompt, res_text, "gemini", "Personal Key", personal_key)
                via = "personal gemini"
            elif provider == "openai":
                res_text = await _openai(personal_key, prompt)
                record_usage(prompt, res_text, "openai", "Personal Key", personal_key)
                via = "personal openai"
        except Exception as e:
            print(f"AI Digest: Personal key failed, trying global pool. Error: {e}")
            
    if not res_text:
        global_keys = s.exec(select(GlobalApiKey).where(GlobalApiKey.is_active == True).order_by(GlobalApiKey.id)).all()
        today_str = time.strftime("%Y-%m-%d")
        for gkey in global_keys:
            if gkey.last_used_date != today_str:
                gkey.last_used_date = today_str
                gkey.daily_requests_count = 0
                s.add(gkey)
                s.commit()
            if gkey.daily_requests_count >= getattr(gkey, "daily_limit", 1000):
                continue
            try:
                if gkey.provider == "gemini":
                    res_text = await _gemini(gkey.key_value, prompt)
                    gkey.requests_count += 1
                    gkey.daily_requests_count += 1
                    s.add(gkey)
                    record_usage(prompt, res_text, "gemini", gkey.label or f"Global Key {gkey.id}", gkey.key_value)
                    via = f"global {gkey.label or 'key'}"
                    break
                elif gkey.provider == "openai":
                    res_text = await _openai(gkey.key_value, prompt)
                    gkey.requests_count += 1
                    gkey.daily_requests_count += 1
                    s.add(gkey)
                    record_usage(prompt, res_text, "openai", gkey.label or f"Global Key {gkey.id}", gkey.key_value)
                    via = f"global {gkey.label or 'key'}"
                    break
            except Exception as e:
                print(f"AI Digest: Global key {gkey.label} failed. Error: {e}")
                
    if not res_text:
        try:
            model = getattr(u, "ai_model", None) or OLLAMA_MODEL
            res_text = await _ollama(model, prompt)
            via = f"local ({model})"
        except Exception as e:
            raise HTTPException(502, f"AI generation failed. Key pool exhausted, and local model is offline. Error: {e}")
            
    return {"digest": res_text, "via": via}


@app.post("/tools/{tool_id}/vote")
def vote_tool(tool_id: int, u: User = Depends(current_user), s: Session = Depends(get_session)):
    t = s.get(Tool, tool_id)
    if not t: raise HTTPException(404, "Not found")
    voters = list(t.voters or [])
    voters = [v for v in voters if v != u.id] if u.id in voters else voters + [u.id]
    t.voters = voters; t.votes = len(voters)
    s.add(t); s.commit(); s.refresh(t)
    return public_tool(t)


@app.post("/tools/{tool_id}/sponsor")
def sponsor_tool(tool_id: int, body: SponsorIn, u: User = Depends(current_user), s: Session = Depends(get_session)):
    t = s.get(Tool, tool_id)
    if not t: raise HTTPException(404, "Not found")
    r = SponsorRequest(tool_id=t.id, tool_name=t.name, owner_id=t.owner_id,
                       user_id=u.id, user_name=u.name, kind=body.kind, note=body.note)
    s.add(r); s.commit(); s.refresh(r)
    return r.dict()


class CoOwnerIn(BaseModel):
    email: str

@app.post("/tools/{tool_id}/co-owners")
def add_co_owner(tool_id: int, body: CoOwnerIn, u: User = Depends(current_user), s: Session = Depends(get_session)):
    t = s.get(Tool, tool_id)
    if not t:
        raise HTTPException(404, "Tool not found")
    if not is_owner_or_co_owner(t, u) and u.role != "admin":
        raise HTTPException(403, "Access denied")
    target_email = body.email.strip().lower()
    co_user = s.exec(select(User).where(User.email == target_email)).first()
    if not co_user:
        raise HTTPException(404, f"User with email '{body.email}' not found")
    
    co_owners = list(t.co_owners or [])
    if any(c.get("email", "").lower().strip() == target_email for c in co_owners):
        return {"ok": True, "message": "Already a co-owner"}
        
    co_owners.append({"email": co_user.email, "name": co_user.name or co_user.email})
    t.co_owners = co_owners
    s.add(t)
    
    # Send a notification to the co-owner
    r = SponsorRequest(
        tool_id=t.id,
        tool_name=t.name,
        owner_id=u.id,  # assigner
        user_id=co_user.id,  # target user
        user_name=u.name or u.email,
        kind="co_owner",
        note=f"You have been assigned as a co-owner of this tool by {u.name or u.email}."
    )
    s.add(r)
    s.commit()
    return {"ok": True}

@app.get("/alerts")
def alerts(u: User = Depends(current_user), s: Session = Depends(get_session)):
    rows = s.exec(select(SponsorRequest).order_by(SponsorRequest.created_at.desc())).all()
    if u.role != "admin":
        rows = [r for r in rows if r.owner_id == u.id or (r.user_id == u.id and r.kind == "co_owner")]
    return [r.dict() for r in rows]


# ----------------------------------------------------------------- ideas
@app.get("/ideas")
def list_ideas(s: Session = Depends(get_session)):
    rows = s.exec(select(Idea).order_by(Idea.updated_at.desc())).all()
    return [public_idea(i, s) for i in rows]


@app.get("/my/ideas")
def my_ideas(u: User = Depends(current_user), s: Session = Depends(get_session)):
    rows = s.exec(select(Idea).where(Idea.owner_id == u.id).order_by(Idea.updated_at.desc())).all()
    return [public_idea(i, s) for i in rows]


@app.get("/review/ideas")
def review_ideas(u: User = Depends(require("committee", "approver", "admin")), s: Session = Depends(get_session)):
    rows = s.exec(select(Idea).where(Idea.status.in_(["proposed", "changes"])).order_by(Idea.updated_at)).all()
    return [public_idea(i, s) for i in rows]

@app.get("/archive/ideas")
def archive_ideas(u: User = Depends(require("committee", "approver", "admin")), s: Session = Depends(get_session)):
    rows = s.exec(select(Idea).where(Idea.status.in_(["declined", "changes"])).order_by(Idea.updated_at.desc())).all()
    return [public_idea(i, s) for i in rows]


@app.post("/ideas")
def save_idea(body: dict, u: User = Depends(current_user), s: Session = Depends(get_session)):
    iid = body.get("id")
    if isinstance(iid, str) and (iid.startswith("tab-") or iid == "default"):
        iid = None
    elif iid:
        try:
            iid = int(iid)
        except ValueError:
            iid = None

    i = s.get(Idea, iid) if iid else None
    if iid and not i:
        raise HTTPException(404, "Not found")
    if not i:
        i = Idea(owner_id=u.id, owner=u.name)
    i.name = body.get("name", i.name)
    i.canvas = body.get("canvas", i.canvas)
    i.scores = body.get("scores", i.scores)
    i.notes = body.get("notes", i.notes) or []
    if "voc_id" in body: i.voc_id = body["voc_id"]
    if "team" in body: i.team = body["team"]
    if "tool_id" in body: i.tool_id = body["tool_id"]
    was_proposed = i.status == "proposed"
    if "status" in body:
        i.status = body["status"]   # 'draft' on save, 'proposed' on submit
        if body["status"] == "proposed":
            routing = s.get(Setting, "idea_routing")
            if routing and routing.value == "voice_of_clients":
                i.status = "approved"
                i.decided_by = "Auto-routed"
    i.updated_at = time.time()
    s.add(i); s.commit(); s.refresh(i)
    if i.status == "proposed" and not was_proposed:
        problem = (i.canvas or {}).get("problemStatement", "") or ""
        notify_teams(s, f"💡 New idea submitted: {i.name}",
                     [f"**Owner:** {i.owner or u.name}",
                      f"**Problem:** {problem[:200]}" if problem else "Submitted for committee review."],
                     "/review")
    return public_idea(i, s)


@app.post("/ideas/{idea_id}/vote")
def vote_idea(idea_id: int, u: User = Depends(current_user), s: Session = Depends(get_session)):
    i = s.get(Idea, idea_id)
    if not i: raise HTTPException(404, "Not found")
    voters = list(i.voters or [])
    voters = [v for v in voters if v != u.id] if u.id in voters else voters + [u.id]
    i.voters = voters; i.votes = len(voters)
    s.add(i); s.commit(); s.refresh(i)
    return public_idea(i, s)


@app.post("/ideas/{idea_id}/review")
def review_idea(idea_id: int, body: ReviewIn, u: User = Depends(require("committee", "approver", "admin")), s: Session = Depends(get_session)):
    i = s.get(Idea, idea_id)
    if not i: raise HTTPException(404, "Not found")

    history = list(i.review_history or [])
    if u.role == "committee":
        history.append({"reviewer_id": u.id, "reviewer_name": u.name, "decision": body.decision, "note": body.note, "timestamp": time.time()})
        i.review_history = history
    elif u.role in ("approver", "admin"):
        i.review_note = body.note
        i.decided_by = u.name
        i.status = {"approve": "approved", "changes": "changes", "decline": "declined"}.get(body.decision)
        if not i.status:
            raise HTTPException(400, "decision must be approve | changes | decline")
        history.append({"reviewer_id": u.id, "reviewer_name": u.name, "decision": body.decision, "note": body.note, "timestamp": time.time(), "final": True})
        i.review_history = history

    i.updated_at = time.time()
    s.add(i); s.commit(); s.refresh(i)
    return public_idea(i, s)

# ----------------------------------------------------------------- VOC
@app.get("/voc")
def get_vocs(u: User = Depends(current_user), s: Session = Depends(get_session)):
    rows = s.exec(select(VocIssue).order_by(VocIssue.created_at.desc())).all()
    if u.role not in ("admin", "committee", "approver"):
        results = []
        for r in rows:
            d = r.dict()
            d["client"] = "Confidential" if d.get("client") else ""
            results.append(d)
        return results
    return [r.dict() for r in rows]

@app.post("/voc")
def create_voc(body: dict, u: User = Depends(current_user), s: Session = Depends(get_session)):
    v = VocIssue(
        owner_id=u.id, owner_name=u.name,
        title=body.get("title", ""),
        problem_statement=body.get("problem_statement", ""),
        department=body.get("department", ""),
        client=body.get("client", "")
    )

    s.add(v); s.commit(); s.refresh(v)
    return v.dict()

@app.patch("/voc/{voc_id}")
def update_voc(voc_id: int, body: dict, u: User = Depends(current_user), s: Session = Depends(get_session)):
    v = s.get(VocIssue, voc_id)
    if not v: raise HTTPException(404, "Not found")
    if v.owner_id != u.id and u.role != "admin":
        raise HTTPException(403, "Access denied")
    if "title" in body: v.title = body["title"]
    if "problem_statement" in body: v.problem_statement = body["problem_statement"]
    if "department" in body: v.department = body["department"]
    if "status" in body: v.status = body["status"]
    if "client" in body: v.client = body["client"]

    s.add(v); s.commit(); s.refresh(v)
    return v.dict()

@app.delete("/voc/{voc_id}")
def delete_voc(voc_id: int, u: User = Depends(current_user), s: Session = Depends(get_session)):
    v = s.get(VocIssue, voc_id)
    if not v: raise HTTPException(404, "Not found")
    if v.owner_id != u.id and u.role != "admin":
        raise HTTPException(403, "Access denied")
    s.delete(v)
    s.commit()
    return {"ok": True}

@app.post("/voc/{voc_id}/vote")
def vote_voc(voc_id: int, u: User = Depends(current_user), s: Session = Depends(get_session)):
    v = s.get(VocIssue, voc_id)
    if not v: raise HTTPException(404, "Not found")
    voters = list(v.voters or [])
    voters = [vt for vt in voters if vt != u.id] if u.id in voters else voters + [u.id]
    v.voters = voters; v.votes = len(voters)
    s.add(v); s.commit(); s.refresh(v)
    return v.dict()



@app.delete("/ideas/{idea_id}")
def delete_idea(idea_id: int, u: User = Depends(current_user), s: Session = Depends(get_session)):
    i = s.get(Idea, idea_id)
    if not i: raise HTTPException(404, "Not found")
    if i.owner_id != u.id and u.role != "admin":
        raise HTTPException(403, "Access denied")
    s.delete(i)
    s.commit()
    return {"ok": True}


@app.get("/admin/users")
def admin_users(u: User = Depends(require("admin")), s: Session = Depends(get_session)):
    return [public_user(x) for x in s.exec(select(User).where(User.role != "waiting").order_by(User.created_at)).all()]


@app.post("/admin/invites")
def create_invite(body: InviteIn, u: User = Depends(require("admin")), s: Session = Depends(get_session)):
    email = body.email.lower().strip()
    if not email.endswith("@concentrix.com"):
        raise HTTPException(400, "Invitation email must be a @concentrix.com address.")
    if body.role not in ROLES:
        raise HTTPException(400, f"Role must be one of {ROLES}")
        
    existing_user = s.exec(select(User).where(User.email == email)).first()
    if existing_user:
        raise HTTPException(400, "A user with this email is already registered.")
        
    old_inv = s.exec(select(Invitation).where(Invitation.email == email)).first()
    if old_inv:
        s.delete(old_inv)
        
    token = secrets.token_urlsafe(32)
    expires_at = time.time() + (7 * 24 * 3600)
    
    inv = Invitation(email=email, token=token, role=body.role, expires_at=expires_at)
    s.add(inv); s.commit(); s.refresh(inv)
    return {"token": inv.token, "email": inv.email, "role": inv.role}


@app.get("/admin/invites")
def list_invites(u: User = Depends(require("admin")), s: Session = Depends(get_session)):
    return s.exec(select(Invitation).order_by(Invitation.created_at.desc())).all()


@app.delete("/admin/invites/{invite_id}")
def delete_invite(invite_id: int, u: User = Depends(require("admin")), s: Session = Depends(get_session)):
    inv = s.get(Invitation, invite_id)
    if not inv: raise HTTPException(404, "Invitation not found")
    s.delete(inv); s.commit()
    return {"ok": True}


@app.put("/admin/users/{user_id}/role")
def admin_set_role(user_id: int, body: RoleIn, u: User = Depends(require("admin")), s: Session = Depends(get_session)):
    if body.role not in ROLES:
        raise HTTPException(400, f"role must be one of {ROLES}")
    target = s.get(User, user_id)
    if not target: raise HTTPException(404, "Not found")
    target.role = body.role
    s.add(target); s.commit()
    return public_user(target)


@app.put("/admin/users/{user_id}/password")
def admin_reset_password(user_id: int, body: AdminPasswordResetIn, u: User = Depends(require("admin")), s: Session = Depends(get_session)):
    target = s.get(User, user_id)
    if not target: raise HTTPException(404, "Not found")
    
    password = body.password
    if len(password) < 8:
        raise HTTPException(400, "Password must be at least 8 characters long.")
    if not re.search(r"[A-Z]", password):
        raise HTTPException(400, "Password must contain at least one uppercase letter.")
    if not re.search(r"[a-z]", password):
        raise HTTPException(400, "Password must contain at least one lowercase letter.")
    if not re.search(r"\d", password):
        raise HTTPException(400, "Password must contain at least one digit.")
    if not re.search(r"[!@#$%^&*(),.?\":{}|<>]", password):
        raise HTTPException(400, "Password must contain at least one special character.")
        
    target.password_hash = pwd.hash(password)
    s.add(target); s.commit()
    return public_user(target)


@app.get("/admin/users/waitlist")
def admin_waitlist(u: User = Depends(require("admin")), s: Session = Depends(get_session)):
    return [public_user(x) for x in s.exec(select(User).where(User.role == "waiting").order_by(User.created_at)).all()]


@app.post("/admin/users/{user_id}/approve")
def admin_approve_user(user_id: int, body: RoleIn, u: User = Depends(require("admin")), s: Session = Depends(get_session)):
    if body.role not in ROLES or body.role == "waiting":
        raise HTTPException(400, "Must approve to a valid active role.")
    target = s.get(User, user_id)
    if not target: raise HTTPException(404, "User not found")
    if target.role != "waiting":
        raise HTTPException(400, "User is already approved.")
    target.role = body.role
    s.add(target); s.commit()
    return public_user(target)


@app.delete("/admin/users/{user_id}/decline")
def admin_decline_user(user_id: int, u: User = Depends(require("admin")), s: Session = Depends(get_session)):
    target = s.get(User, user_id)
    if not target: raise HTTPException(404, "User not found")
    if target.role != "waiting":
        raise HTTPException(400, "Cannot decline an already approved user.")
    s.delete(target); s.commit()
    return {"ok": True}


@app.delete("/admin/users/{user_id}")
def admin_delete_user(user_id: int, u: User = Depends(require("admin")), s: Session = Depends(get_session)):
    target = s.get(User, user_id)
    if not target: raise HTTPException(404, "User not found")
    if target.id == u.id:
        raise HTTPException(400, "You cannot delete your own admin account.")
    s.delete(target); s.commit()
    return {"ok": True}


@app.get("/admin/backup")
def get_backup(u: User = Depends(require("admin")), s: Session = Depends(get_session)):
    tools_all = s.exec(select(Tool)).all()
    ideas_all = s.exec(select(Idea)).all()
    
    # We serialize full Tool/Idea dicts, including demo_html
    return {
        "format": "ai-tool-catalog",
        "version": 1,
        "exportedAt": time.time(),
        "tools": [t.dict() for t in tools_all],
        "ideas": [i.dict() for i in ideas_all],
    }


@app.post("/admin/backup")
def restore_backup(body: dict, u: User = Depends(require("admin")), s: Session = Depends(get_session)):
    if body.get("format") != "ai-tool-catalog":
        raise HTTPException(400, "Invalid backup format")
    
    # Clear tables
    s.execute(conn_block := s.connection())
    conn_block.execute(conn_block.dialect.dataset_execute("DELETE FROM tool") if hasattr(conn_block.dialect, "dataset_execute") else "DELETE FROM tool")
    s.execute("DELETE FROM idea")
    
    for t_data in body.get("tools", []):
        t_data.pop("created_at", None)
        t = Tool(**t_data)
        s.add(t)
    
    for i_data in body.get("ideas", []):
        i_data.pop("created_at", None)
        i_data.pop("updated_at", None)
        i = Idea(**i_data)
        s.add(i)
    
    s.commit()
    return {"ok": True}


@app.get("/admin/settings")
def get_settings(u: User = Depends(require("admin")), s: Session = Depends(get_session)):
    rows = s.exec(select(Setting)).all()
    return {r.key: r.value for r in rows}


@app.post("/admin/settings")
def update_settings(body: dict, u: User = Depends(require("admin")), s: Session = Depends(get_session)):
    for k, v in body.items():
        row = s.get(Setting, k)
        if not row:
            row = Setting(key=k)
        row.value = str(v)
        s.add(row)
    s.commit()
    return {"ok": True}


@app.get("/chat/messages")
def get_chat_messages(u: User = Depends(current_user), s: Session = Depends(get_session)):
    rows = s.exec(select(ChatMessage).where(ChatMessage.user_id == u.id).order_by(ChatMessage.created_at)).all()
    return [{"sender": r.sender, "text": r.text} for r in rows]


@app.post("/chat/messages")
def add_chat_message(body: ChatMessageIn, u: User = Depends(current_user), s: Session = Depends(get_session)):
    msg = ChatMessage(user_id=u.id, sender=body.sender, text=body.text)
    s.add(msg)
    s.commit()
    s.refresh(msg)
    return {"sender": msg.sender, "text": msg.text}


@app.delete("/chat/messages")
def clear_chat_messages(u: User = Depends(current_user), s: Session = Depends(get_session)):
    s.exec(delete(ChatMessage).where(ChatMessage.user_id == u.id))
    s.commit()
    return {"ok": True}


# ----------------------------------------------------------------- AI
@app.get("/ai/status")
async def ai_status():
    try:
        async with httpx.AsyncClient(timeout=2) as c:
            r = await c.get(f"{OLLAMA_URL}/api/tags")
            models = [m["name"] for m in r.json().get("models", [])]
            return {"local_available": True, "models": models, "default_model": OLLAMA_MODEL}
    except Exception:
        return {"local_available": False, "models": [], "default_model": OLLAMA_MODEL}


@app.post("/ai/generate")
async def ai_generate(body: AIGenerateIn, u: User = Depends(current_user), s: Session = Depends(get_session)):
    # Enforce the DAILY AI credit limit for normal users (admins exempt).
    # Counted from today's audit log so it genuinely resets at midnight —
    # u.ai_usage stays as a lifetime total for stats only.
    if u.role != "admin":
        today_start = dt.datetime.combine(dt.date.today(), dt.time.min).timestamp()
        used_today = len(s.exec(
            select(AIAuditLog)
            .where(AIAuditLog.user_id == u.id)
            .where(AIAuditLog.created_at >= today_start)
        ).all())
        if used_today >= u.ai_credits:
            raise HTTPException(403, f"You have used all {u.ai_credits} daily AI credits ({used_today}/{u.ai_credits}). They reset at midnight, or ask an admin to raise your limit.")

    prompt = body.prompt
    start_time = time.time()
    
    def record_usage(prompt_str, response_str, provider_name, key_label, key_used_val):
        latency = time.time() - start_time
        u.ai_usage += 1
        s.add(u)
        
        # If prompt is a chat prompt with guidelines, strip them and only save user's final message
        clean_prompt = prompt_str
        if "Conversation history:" in prompt_str and "User:" in prompt_str:
            parts = prompt_str.split("User:")
            if len(parts) > 1:
                clean_prompt = parts[-1].split("AI Matchmaker:")[0].strip()
        elif "Instructions:" in prompt_str:
            # Fallback split for structured prompts
            parts = prompt_str.split("User:")
            if len(parts) > 1:
                clean_prompt = parts[-1].strip()
                
        masked_key = ""
        if key_used_val:
            masked_key = key_used_val[:4] + "..." + key_used_val[-4:] if len(key_used_val) > 8 else "..."
        
        audit = AIAuditLog(
            user_id=u.id,
            user_name=u.name or u.email,
            prompt=clean_prompt,
            response=response_str,
            provider=provider_name,
            api_key_used=f"{key_label} ({masked_key})" if key_label else masked_key,
            latency_seconds=round(latency, 2),
            prompt_chars=len(clean_prompt),
            response_chars=len(response_str)
        )
        s.add(audit)
        s.commit()

    provider = u.ai_provider or "local"
    personal_key = u.ai_key
    
    # Normal users can ONLY use the global keys pool. Only Admin setting key is evaluated here.
    if u.role == "admin" and provider != "local" and personal_key:
        try:
            if provider == "gemini":
                res = await _gemini(personal_key, prompt)
                record_usage(prompt, res, "gemini", "Personal Key", personal_key)
                return {"text": res, "via": "personal gemini"}
            elif provider == "openai":
                res = await _openai(personal_key, prompt)
                record_usage(prompt, res, "openai", "Personal Key", personal_key)
                return {"text": res, "via": "personal openai"}
        except Exception as e:
            print(f"Personal key ({provider}) failed, falling back to global keys pool. Error: {e}")

    global_keys = s.exec(select(GlobalApiKey).where(GlobalApiKey.is_active == True).order_by(GlobalApiKey.id)).all()
    today_str = time.strftime("%Y-%m-%d")
    
    for gkey in global_keys:
        # Reset daily usage count if a new day has arrived
        if gkey.last_used_date != today_str:
            gkey.last_used_date = today_str
            gkey.daily_requests_count = 0
            s.add(gkey)
            s.commit()
            
        # Check if the daily limit is reached
        if gkey.daily_requests_count >= getattr(gkey, "daily_limit", 1000):
            print(f"Global key '{gkey.label}' has reached its daily limit of {gkey.daily_limit}. Skipping.")
            continue
            
        try:
            if gkey.provider == "gemini":
                res = await _gemini(gkey.key_value, prompt)
                gkey.requests_count += 1
                gkey.daily_requests_count += 1
                s.add(gkey)
                record_usage(prompt, res, "gemini", gkey.label or f"Global Key {gkey.id}", gkey.key_value)
                return {"text": res, "via": f"global {gkey.label or 'key'}"}
            elif gkey.provider == "openai":
                res = await _openai(gkey.key_value, prompt)
                gkey.requests_count += 1
                gkey.daily_requests_count += 1
                s.add(gkey)
                record_usage(prompt, res, "openai", gkey.label or f"Global Key {gkey.id}", gkey.key_value)
                return {"text": res, "via": f"global {gkey.label or 'key'}"}
        except Exception as e:
            print(f"Global key {gkey.label or gkey.id} failed. Error: {e}")
            continue

    try:
        model = getattr(u, "ai_model", None) or OLLAMA_MODEL
        res = await _ollama(body.model or model, prompt)
        record_usage(prompt, res, "local", "Ollama", "")
        return {"text": res, "via": f"local ({model})"}
    except Exception as e:
        raise HTTPException(502, f"AI generation failed. Personal and all global keys in the pool failed/exhausted, and local model is offline. Latent error: {e}")


async def _ollama(model: str, prompt: str) -> str:
    async with httpx.AsyncClient(timeout=120) as c:
        try:
            # Auto-fallback to any available pulled model if the requested one is missing
            tags_resp = await c.get(f"{OLLAMA_URL}/api/tags")
            available = [m["name"] for m in tags_resp.json().get("models", [])]
            if available and model not in available:
                model = available[0]
        except Exception:
            pass

        try:
            r = await c.post(f"{OLLAMA_URL}/api/generate", json={"model": model, "prompt": prompt, "stream": False})
        except httpx.ConnectError:
            raise HTTPException(503, "Local model not running. Start it with `ollama serve` and `ollama pull llama3.2`.")
        if r.status_code == 404:
            raise HTTPException(503, f"Model '{model}' not found. Pull it with `ollama pull {model}`.")
        return r.json().get("response", "").strip()


async def _gemini(key: str, prompt: str) -> str:
    # Try gemini-2.5-flash first, fallback to gemini-3.5-flash, gemini-1.5-flash, then gemini-1.0-pro (or gemini-pro)
    models = ["gemini-3.1-flash-lite","gemini-2.5-flash", "gemini-3.5-flash", "gemini-1.5-flash", "gemini-1.0-pro", "gemini-pro"]
    last_err = None
    async with httpx.AsyncClient(timeout=60) as c:
        for model in models:
            url = f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent?key={key}"
            try:
                r = await c.post(url, json={"contents": [{"parts": [{"text": prompt}]}]})
                if r.status_code == 200:
                    return r.json()["candidates"][0]["content"]["parts"][0]["text"].strip()
                else:
                    # Capture status text/error for debugging/logging
                    last_err = f"HTTP {r.status_code}: {r.text}"
            except Exception as ex:
                last_err = str(ex)
        raise Exception(f"Gemini API failed for all fallback models. Last error: {last_err}")


async def _openai(key: str, prompt: str) -> str:
    async with httpx.AsyncClient(timeout=60) as c:
        r = await c.post("https://api.openai.com/v1/chat/completions",
                         headers={"Authorization": f"Bearer {key}"},
                         json={"model": "gpt-4o-mini", "messages": [{"role": "user", "content": prompt}]})
        r.raise_for_status()
        return r.json()["choices"][0]["message"]["content"].strip()


# ----------------------------------------------------------------- tracking & analytics / global keys / credits

class TrackActivityIn(BaseModel):
    page: str
    seconds: int

@app.post("/me/track-activity")
def track_activity(body: TrackActivityIn, u: User = Depends(current_user), s: Session = Depends(get_session)):
    one_hour_ago = time.time() - 3600
    log = s.exec(
        select(ActivityLog)
        .where(ActivityLog.user_id == u.id)
        .where(ActivityLog.page == body.page)
        .where(ActivityLog.created_at >= one_hour_ago)
        .order_by(ActivityLog.created_at.desc())
    ).first()
    
    if log:
        log.duration_seconds += body.seconds
        log.created_at = time.time()
        s.add(log)
    else:
        log = ActivityLog(
            user_id=u.id,
            user_name=u.name or u.email,
            page=body.page,
            duration_seconds=body.seconds
        )
        s.add(log)
    s.commit()
    return {"ok": True}


class TrackSearchIn(BaseModel):
    query: str

@app.post("/catalog/track-search")
def track_search(body: TrackSearchIn, u: User = Depends(current_user), s: Session = Depends(get_session)):
    if not body.query.strip():
        return {"ok": True}
    log = CatalogSearchLog(
        user_id=u.id,
        user_name=u.name or u.email,
        query=body.query.strip()
    )
    s.add(log)
    s.commit()
    return {"ok": True}


@app.post("/tools/{tool_id}/track-view")
def track_tool_view(tool_id: int, u: User = Depends(current_user), s: Session = Depends(get_session)):
    t = s.get(Tool, tool_id)
    if not t:
        raise HTTPException(404, "Tool not found")
    log = ProductViewLog(
        user_id=u.id,
        user_name=u.name or u.email,
        tool_id=tool_id,
        tool_name=t.name
    )
    s.add(log)
    s.commit()
    return {"ok": True}


class TrackActionIn(BaseModel):
    action_type: str

@app.post("/tools/{tool_id}/track-action")
def track_tool_action(tool_id: int, body: TrackActionIn, u: User = Depends(current_user), s: Session = Depends(get_session)):
    t = s.get(Tool, tool_id)
    if not t:
        raise HTTPException(404, "Tool not found")
    log = ActionClickLog(
        user_id=u.id,
        user_name=u.name or u.email,
        action_type=body.action_type,
        tool_id=tool_id,
        tool_name=t.name
    )
    s.add(log)
    s.commit()
    return {"ok": True}


class TrackFunnelIn(BaseModel):
    action: str
    draft_id: str

@app.post("/funnel/track-submission")
def track_submission_funnel(body: TrackFunnelIn, u: User = Depends(current_user), s: Session = Depends(get_session)):
    log = SubmissionFunnelLog(
        user_id=u.id,
        user_name=u.name or u.email,
        action=body.action,
        draft_id=body.draft_id
    )
    s.add(log)
    s.commit()
    return {"ok": True}


@app.get("/admin/analytics")
def get_analytics(start_time: Optional[float] = None, end_time: Optional[float] = None, u: User = Depends(require("admin")), s: Session = Depends(get_session)):
    query_start = None
    if start_time is not None:
        actual_end = end_time if end_time is not None else time.time()
        duration = actual_end - start_time
        query_start = start_time - duration

    # 1. Activity Logs
    stmt_act = select(ActivityLog)
    if query_start is not None:
        stmt_act = stmt_act.where(ActivityLog.created_at >= query_start)
    if end_time is not None:
        stmt_act = stmt_act.where(ActivityLog.created_at <= end_time)
    activity_rows = s.exec(stmt_act).all()

    time_spent = {}
    for r in activity_rows:
        key = (r.user_id, r.user_name, r.page)
        time_spent[key] = time_spent.get(key, 0) + r.duration_seconds
    
    time_spent_aggregated = [
        {"user_id": k[0], "user_name": k[1], "page": k[2], "minutes": round(v / 60, 1)}
        for k, v in time_spent.items()
    ]

    # 2. Search Logs
    stmt_search = select(CatalogSearchLog)
    if query_start is not None:
        stmt_search = stmt_search.where(CatalogSearchLog.created_at >= query_start)
    if end_time is not None:
        stmt_search = stmt_search.where(CatalogSearchLog.created_at <= end_time)
    search_rows = s.exec(stmt_search).all()

    queries = {}
    for r in search_rows:
        q = r.query.lower().strip()
        queries[q] = queries.get(q, 0) + 1
    popular_searches = sorted(
        [{"query": k, "count": v} for k, v in queries.items()],
        key=lambda x: x["count"],
        reverse=True
    )[:50]

    search_logs_detailed = [
        {
            "user_id": r.user_id,
            "user_name": r.user_name,
            "query": r.query,
            "created_at": r.created_at
        }
        for r in search_rows[:2000]
    ]

    # 3. View Logs
    stmt_view = select(ProductViewLog)
    if query_start is not None:
        stmt_view = stmt_view.where(ProductViewLog.created_at >= query_start)
    if end_time is not None:
        stmt_view = stmt_view.where(ProductViewLog.created_at <= end_time)
    view_rows = s.exec(stmt_view).all()

    views = {}
    for r in view_rows:
        if r.tool_name not in views:
            views[r.tool_name] = {"count": 0, "viewers": set()}
        views[r.tool_name]["count"] += 1
        if r.user_name:
            views[r.tool_name]["viewers"].add(r.user_name)
    top_visited = sorted(
        [
            {"tool_name": k, "count": v["count"], "viewers": list(v["viewers"])} 
            for k, v in views.items()
        ],
        key=lambda x: x["count"],
        reverse=True
    )[:50]

    # 4. Action Click Logs
    stmt_click = select(ActionClickLog)
    if query_start is not None:
        stmt_click = stmt_click.where(ActionClickLog.created_at >= query_start)
    if end_time is not None:
        stmt_click = stmt_click.where(ActionClickLog.created_at <= end_time)
    stmt_click = stmt_click.order_by(ActionClickLog.created_at.desc())
    click_rows = s.exec(stmt_click).all()

    action_clicks = [
        {
            "user_id": r.user_id,
            "user_name": r.user_name,
            "action_type": r.action_type,
            "tool_name": r.tool_name,
            "created_at": r.created_at
        }
        for r in click_rows[:2000]
    ]

    # 5. Funnel Logs
    stmt_funnel = select(SubmissionFunnelLog)
    if query_start is not None:
        stmt_funnel = stmt_funnel.where(SubmissionFunnelLog.created_at >= query_start)
    if end_time is not None:
        stmt_funnel = stmt_funnel.where(SubmissionFunnelLog.created_at <= end_time)
    stmt_funnel = stmt_funnel.order_by(SubmissionFunnelLog.created_at.desc())
    funnel_rows = s.exec(stmt_funnel).all()

    funnel_logs = [
        {
            "user_id": r.user_id,
            "user_name": r.user_name,
            "action": r.action,
            "draft_id": r.draft_id,
            "created_at": r.created_at
        }
        for r in funnel_rows[:2000]
    ]

    # 6. AI Audit Logs
    stmt_audit = select(AIAuditLog)
    if query_start is not None:
        stmt_audit = stmt_audit.where(AIAuditLog.created_at >= query_start)
    if end_time is not None:
        stmt_audit = stmt_audit.where(AIAuditLog.created_at <= end_time)
    stmt_audit = stmt_audit.order_by(AIAuditLog.created_at.desc())
    audit_rows = s.exec(stmt_audit).all()

    ai_audit_logs = [
        {
            "user_id": r.user_id,
            "user_name": r.user_name,
            "prompt": r.prompt,
            "response": r.response,
            "provider": r.provider,
            "api_key_used": r.api_key_used,
            "latency_seconds": r.latency_seconds,
            "prompt_chars": r.prompt_chars,
            "response_chars": r.response_chars,
            "created_at": r.created_at
        }
        for r in audit_rows[:2000]
    ]

    activity_logs = [
        {
            "user_id": r.user_id,
            "user_name": r.user_name,
            "page": r.page,
            "duration_seconds": r.duration_seconds,
            "created_at": r.created_at
        }
        for r in activity_rows[:5000]
    ]

    view_logs = [
        {
            "user_id": r.user_id,
            "user_name": r.user_name,
            "tool_name": r.tool_name,
            "created_at": r.created_at
        }
        for r in view_rows[:2000]
    ]

    return {
        "time_spent": time_spent_aggregated,
        "popular_searches": popular_searches,
        "search_logs": search_logs_detailed,
        "top_visited": top_visited,
        "action_clicks": action_clicks,
        "funnel_logs": funnel_logs,
        "ai_audit_logs": ai_audit_logs,
        "activity_logs": activity_logs,
        "view_logs": view_logs
    }





@app.get("/admin/keys")
@app.get("/admin/api-keys")
def get_global_api_keys(u: User = Depends(require("admin")), s: Session = Depends(get_session)):
    keys = s.exec(select(GlobalApiKey).order_by(GlobalApiKey.id)).all()
    today_str = time.strftime("%Y-%m-%d")
    result = []
    for k in keys:
        # A new day means the daily counter is stale — reset it here too, not
        # only in /ai/generate, so the admin view is correct before first use
        if k.last_used_date != today_str:
            k.last_used_date = today_str
            k.daily_requests_count = 0
            s.add(k); s.commit()
        val = k.key_value
        masked = val[:4] + "..." + val[-4:] if len(val) > 8 else "..."
        result.append({
            "id": k.id,
            "provider": k.provider,
            "label": k.label,
            "description": k.label,
            "is_active": k.is_active,
            "request_count": k.requests_count,
            "requests_count": k.requests_count,
            "daily_requests_count": k.daily_requests_count,
            "daily_limit": k.daily_limit,
            "last_used_date": k.last_used_date,
            "key_value": val,
            "key_value_masked": masked,
            "created_at": k.created_at
        })
    return result


class GlobalApiKeyIn(BaseModel):
    provider: Optional[str] = "gemini"
    key_value: str
    label: Optional[str] = ""
    description: Optional[str] = ""


@app.post("/admin/keys")
@app.post("/admin/api-keys")
def add_global_api_key(body: GlobalApiKeyIn, u: User = Depends(require("admin")), s: Session = Depends(get_session)):
    if not body.key_value.strip():
        raise HTTPException(400, "Key value cannot be empty")
    provider = body.provider or "gemini"
    lbl = body.label.strip() or body.description.strip() or f"Global {provider.upper()} Key"
    gkey = GlobalApiKey(
        provider=provider,
        key_value=body.key_value.strip(),
        label=lbl,
        is_active=True
    )
    s.add(gkey)
    s.commit()
    s.refresh(gkey)
    return {"ok": True, "id": gkey.id, "description": gkey.label, "is_active": gkey.is_active}


@app.delete("/admin/keys/{key_id}")
@app.delete("/admin/api-keys/{key_id}")
def delete_global_api_key(key_id: int, u: User = Depends(require("admin")), s: Session = Depends(get_session)):
    gkey = s.get(GlobalApiKey, key_id)
    if not gkey:
        raise HTTPException(404, "Not found")
    s.delete(gkey)
    s.commit()
    return {"ok": True}


@app.put("/admin/keys/{key_id}/toggle")
@app.put("/admin/api-keys/{key_id}/toggle")
def toggle_global_api_key(key_id: int, u: User = Depends(require("admin")), s: Session = Depends(get_session)):
    gkey = s.get(GlobalApiKey, key_id)
    if not gkey:
        raise HTTPException(404, "Not found")
    gkey.is_active = not gkey.is_active
    s.add(gkey)
    s.commit()
    s.refresh(gkey)
    return {"ok": True, "is_active": gkey.is_active}


class UserCreditsIn(BaseModel):
    credits: int

@app.put("/admin/users/{user_id}/credits")
def update_user_credits(user_id: int, body: UserCreditsIn, u: User = Depends(require("admin")), s: Session = Depends(get_session)):
    target_user = s.get(User, user_id)
    if not target_user:
        raise HTTPException(404, "User not found")
    target_user.ai_credits = max(0, body.credits)
    s.add(target_user)
    s.commit()
    return {"ok": True, "ai_credits": target_user.ai_credits}


class KeyLimitIn(BaseModel):
    daily_limit: int

@app.put("/admin/keys/{key_id}/limit")
def update_key_limit(key_id: int, body: KeyLimitIn, u: User = Depends(require("admin")), s: Session = Depends(get_session)):
    gkey = s.get(GlobalApiKey, key_id)
    if not gkey:
        raise HTTPException(404, "API Key not found")
    gkey.daily_limit = max(0, body.daily_limit)
    s.add(gkey)
    s.commit()
    return {"ok": True, "daily_limit": gkey.daily_limit}

@app.put("/admin/users/{user_id}/refresh-usage")
def refresh_user_usage(user_id: int, u: User = Depends(require("admin")), s: Session = Depends(get_session)):
    target_user = s.get(User, user_id)
    if not target_user:
        raise HTTPException(404, "User not found")
    target_user.ai_usage = 0
    s.add(target_user)
    s.commit()
    return public_user(target_user)


# ----------------------------------------------------------------- startup / migrate / seed
def migrate():
    if "sqlite" not in str(engine.url):
        return
    with engine.begin() as conn:
        conn.exec_driver_sql("CREATE TABLE IF NOT EXISTS setting (key VARCHAR PRIMARY KEY, value VARCHAR)")
        tcols = [r[1] for r in conn.exec_driver_sql("PRAGMA table_info(tool)").fetchall()]
        for col, ddl in [("sample", "VARCHAR DEFAULT ''"), ("timeline", "JSON DEFAULT '[]'"),
                         ("notes", "JSON DEFAULT '[]'"),
                         ("review_status", "VARCHAR DEFAULT 'approved'"), ("review_note", "VARCHAR DEFAULT ''"),
                         ("implementation_status", "VARCHAR DEFAULT 'implemented'"),
                         ("votes", "INTEGER DEFAULT 0"), ("voters", "JSON DEFAULT '[]'"),
                         ("demo_url", "VARCHAR DEFAULT ''"), ("video_url", "VARCHAR DEFAULT ''"), ("ppt_url", "VARCHAR DEFAULT ''"),
                         ("demo_html", "TEXT DEFAULT ''"), ("has_demo", "BOOLEAN DEFAULT 0"),
                         ("account", "VARCHAR DEFAULT ''"), ("img_url", "VARCHAR DEFAULT ''"),
                         ("badges", "JSON DEFAULT '[]'"), ("featured", "BOOLEAN DEFAULT 0"),
                         ("edit_history", "JSON DEFAULT '[]'"), ("sort_order", "INTEGER DEFAULT 0"),
                         ("time_to_deploy", "VARCHAR DEFAULT ''"), ("success_stories", "JSON DEFAULT '[]'"),
                         ("co_owners", "JSON DEFAULT '[]'"),
                         ("demo_type", "VARCHAR DEFAULT 'html'"),
                         ("demo_zip_url", "VARCHAR DEFAULT ''"),
                         ("demo_container_status", "VARCHAR DEFAULT 'stopped'"),
                         ("demo_container_port", "INTEGER DEFAULT NULL"),
                         ("demo_container_build_logs", "TEXT DEFAULT ''"),
                         ("demo_security_report", "TEXT DEFAULT ''"),
                         ("review_comments", "JSON DEFAULT '[]'")]:
            if tcols and col not in tcols:
                conn.exec_driver_sql(f"ALTER TABLE tool ADD COLUMN {col} {ddl}")
        icols = [r[1] for r in conn.exec_driver_sql("PRAGMA table_info(idea)").fetchall()]
        for col, ddl in [("review_note", "VARCHAR DEFAULT ''"), ("decided_by", "VARCHAR DEFAULT ''"),
                         ("votes", "INTEGER DEFAULT 0"), ("voters", "JSON DEFAULT '[]'"),
                         ("notes", "JSON DEFAULT '[]'"),
                         ("review_comments", "JSON DEFAULT '[]'")]:
            if icols and col not in icols:
                conn.exec_driver_sql(f"ALTER TABLE idea ADD COLUMN {col} {ddl}")
        
        ucols = [r[1] for r in conn.exec_driver_sql("PRAGMA table_info(user)").fetchall()]
        for col, ddl in [("ai_model", "VARCHAR DEFAULT 'llama3.2'"), ("department", "VARCHAR DEFAULT ''"),
                         ("ai_credits", "INTEGER DEFAULT 5"), ("ai_usage", "INTEGER DEFAULT 0")]:
            if ucols and col not in ucols:
                conn.exec_driver_sql(f"ALTER TABLE user ADD COLUMN {col} {ddl}")

        gcols = [r[1] for r in conn.exec_driver_sql("PRAGMA table_info(globalapikey)").fetchall()]
        for col, ddl in [("daily_requests_count", "INTEGER DEFAULT 0"),
                         ("daily_limit", "INTEGER DEFAULT 1000"),
                         ("last_used_date", "VARCHAR DEFAULT ''")]:
            if gcols and col not in gcols:
                conn.exec_driver_sql(f"ALTER TABLE globalapikey ADD COLUMN {col} {ddl}")


def seed():
    with Session(engine) as s:
        if not s.exec(select(Setting).where(Setting.key == "idea_routing")).first():
            s.add(Setting(key="idea_routing", value="committee"))
            s.commit()
        if not s.exec(select(User).where(User.email == "admin")).first():
            s.add(User(email="admin", name="Admin", role="admin", password_hash=pwd.hash("admin")))
            s.commit()
        samples = [
            dict(name="Parallax 3.0", owner="Data Viz Guild", category="Innovations Hub", status="active",
                 roi=120000, impact="Saved 60 hrs/mo", problem="Analysts rebuild the same scrolling narrative dashboards by hand for every readout.",
                 tags=["dashboards", "storytelling"], capabilities=["Scrollytelling", "Templated readouts"], implementation_status="implemented",
                 badges=[{"title": "Top Tool", "img_url": ""}], featured=True),
            dict(name="Performance Engine", owner="Ops Analytics", category="Innovations Hub", status="implemented",
                 roi=250000, impact="Cut reporting from 3 days to 2 hrs", problem="Monthly performance packs are assembled manually across five disconnected sources.",
                 tags=["kpi", "automation"], capabilities=["Auto KPI packs", "Source merge"], implementation_status="implemented",
                 badges=[], featured=True),
            dict(name="Process Mining Engine", owner="Transformation", category="Innovations Hub", status="pilot",
                 roi=90000, impact="Surfaced 12 bottlenecks", problem="No visibility into where work actually stalls inside long operational processes.",
                 tags=["process", "bottlenecks"], capabilities=["Activity logs", "Bottleneck detection"], implementation_status="implemented",
                 badges=[]),
            dict(name="Sentiment Analyzer Pro", owner="CX Analytics Team", category="IX Suite", status="active",
                 roi=150000, impact="Reduced negative sentiment calls by 18%", problem="Feedback from Concentrix calls is unstructured and sentiment isn't tracked over time.",
                 tags=["cx", "sentiment", "concentrix"], capabilities=["Real-time transcript analysis", "Customer sentiment indexing"],
                 account="Concentrix", implementation_status="implemented", delivers="A dashboard showing customer sentiment trends and performance correlations.", benefits="Increases CSAT by up to 12%.",
                 badges=[{"title": "Verified Demo", "img_url": ""}, {"title": "GDPR Compliant", "img_url": ""}], featured=True),
            dict(name="Predictive Inventory Optimizer", owner="Demand Forecasting Squad", category="Tech Infusion", status="pilot",
                 roi=95000, impact="Estimated $95K savings in warehouse costs", problem="Warehouse overstocking at client locations costs over $100K annually due to poor demand prediction.",
                 tags=["forecasting", "inventory", "optimization"], capabilities=["Time-series forecasting", "Safety stock calculations"],
                 account="AT&T", implementation_status="not_implemented", delivers="Weekly inventory recommendations and safety stock alerts.", benefits="Lowers storage overhead by 22%.",
                 badges=[]),
            dict(name="Contract Auditing AI", owner="Procurement Intelligence", category="Innovations Hub", status="active",
                 roi=180000, impact="Saves 120 hours of legal review per audit", problem="Auditing hundreds of supplier contracts for legal compliance takes weeks of manual work.",
                 tags=["compliance", "audit", "contracts"], capabilities=["Contract clause extraction", "Compliance scanning"],
                 account="Google Cloud", implementation_status="third_party", delivers="Compliance report showing flagged clauses and missing SLAs.", benefits="Cuts contract review times by 85%.",
                 badges=[{"title": "SOC2 Verified", "img_url": ""}])
        ]
        if not s.exec(select(Setting).where(Setting.key == "seeded_tools")).first():
            for d in samples:
                s.add(Tool(owner_id=0, review_status="approved", **d))
            s.add(Setting(key="seeded_tools", value="true"))
            s.commit()


@app.on_event("startup")
def on_start():
    SQLModel.metadata.create_all(engine)
    migrate()
    seed()
    from container_manager import start_idle_watcher
    start_idle_watcher(DB_URL)


ACTIVE_PROXY_TARGET = None

@app.get("/api/proxy")
async def web_proxy(url: str):
    """Simple reverse proxy that strips frame-blocking headers and injects <base href>"""
    global ACTIVE_PROXY_TARGET
    if not url:
        raise HTTPException(status_code=400, detail="Missing url parameter")
    
    # Reject non-http URLs
    if not url.startswith("http://") and not url.startswith("https://"):
        raise HTTPException(status_code=400, detail="Only http/https URLs are supported")
    
    from urllib.parse import urlparse
    parsed = urlparse(url)
    ACTIVE_PROXY_TARGET = f"{parsed.scheme}://{parsed.netloc}"
    
    try:
        async with httpx.AsyncClient(follow_redirects=True, verify=False, timeout=15.0) as client:
            headers = {
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
                "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
                "Accept-Language": "en-US,en;q=0.9",
            }
            resp = await client.get(url, headers=headers)
            content_type = resp.headers.get("content-type", "text/html")
            
            if "text/html" in content_type:
                html = resp.text
                
                # Determine base URL (the final URL after redirects)
                final_url = str(resp.url)
                parsed_final = urlparse(final_url)
                base_url = f"{parsed_final.scheme}://{parsed_final.netloc}/"
                ACTIVE_PROXY_TARGET = base_url.rstrip("/")
                
                # Inject <base href>
                base_tag = f'<base href="{base_url}" />'
                if "<head>" in html:
                    html = html.replace("<head>", f"<head>\n{base_tag}", 1)
                elif "<HEAD>" in html:
                    html = html.replace("<HEAD>", f"<HEAD>\n{base_tag}", 1)
                elif "<html" in html.lower():
                    html = base_tag + "\n" + html
                else:
                    html = base_tag + "\n" + html
                
                # Strip frame-busters
                html = re.sub(r"if\s*\(\s*(?:window\.)?top\s*!==?\s*(?:window\.)?self\s*\)\s*\{[^}]*\}", "", html)
                html = re.sub(r"if\s*\(\s*(?:window\.)?parent\s*!==?\s*(?:window\.)?self\s*\)\s*\{[^}]*\}", "", html)
                
                response = HTMLResponse(content=html, status_code=200)
            else:
                response = Response(content=resp.content, status_code=resp.status_code, media_type=content_type)
            
            response.headers["Access-Control-Allow-Origin"] = "*"
            for h in list(response.headers.keys()):
                if h.lower() in ("x-frame-options", "content-security-policy", "content-security-policy-report-only"):
                    del response.headers[h]
            return response
            
    except Exception as e:
        error_html = f"<html><body><h3>Proxy Error</h3><p>{str(e)}</p></body></html>"
        return HTMLResponse(content=error_html, status_code=200)

@app.get("/")
def root():
    return {"ok": True, "service": "Analytics Transformation Hub demo API"}

@app.api_route("/{path:path}", methods=["GET", "POST", "PUT", "DELETE", "OPTIONS", "HEAD", "PATCH"])
async def catch_all_proxy(path: str, request: Request):
    """
    Transparently proxies missing assets (like /assets/...) to the ACTIVE_PROXY_TARGET.
    This is required for SPAs that request modules using absolute root paths.
    """
    global ACTIVE_PROXY_TARGET
    if not ACTIVE_PROXY_TARGET:
        raise HTTPException(status_code=404, detail="Not found")
        
    target_url = f"{ACTIVE_PROXY_TARGET}/{path}"
    query_params = str(request.query_params)
    if query_params:
        target_url += f"?{query_params}"
        
    try:
        async with httpx.AsyncClient(follow_redirects=True, verify=False, timeout=15.0) as client:
            headers = dict(request.headers)
            headers.pop("host", None)
            headers.pop("referer", None)
            headers["User-Agent"] = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36"
            
            resp = await client.request(
                method=request.method,
                url=target_url,
                headers=headers,
                content=await request.body()
            )
            
            response = Response(
                content=resp.content,
                status_code=resp.status_code,
                media_type=resp.headers.get("content-type", "")
            )
            response.headers["Access-Control-Allow-Origin"] = "*"
            return response
    except Exception as e:
        raise HTTPException(status_code=502, detail=str(e))

