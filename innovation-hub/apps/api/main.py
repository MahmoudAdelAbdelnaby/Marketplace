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
from typing import Optional, List

import jwt
import httpx
from passlib.context import CryptContext
from fastapi import FastAPI, Depends, HTTPException, Header, Response, Request
from fastapi.responses import HTMLResponse, FileResponse
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from sqlalchemy import Column, JSON, delete
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
    achieved_through: str = ""
    edit_history: List[dict] = Field(default=[], sa_column=Column(JSON))
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


class AIGenerateIn(BaseModel):
    prompt: str
    model: Optional[str] = None


class ReviewIn(BaseModel):
    decision: str    # approve | changes | decline
    note: str = ""


class RoleIn(BaseModel):
    role: str


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


def require(*roles):
    def dep(u: User = Depends(current_user)) -> User:
        if u.role not in roles:
            raise HTTPException(403, f"Requires role: {', '.join(roles)}")
        return u
    return dep


def public_user(u: User) -> dict:
    return {"id": u.id, "email": u.email, "name": u.name, "role": u.role,
            "department": getattr(u, "department", ""),
            "ai_provider": u.ai_provider, "has_ai_key": bool(u.ai_key),
            "ai_model": getattr(u, "ai_model", "llama3.2")}


def public_tool(t: Tool) -> dict:
    d = t.dict()
    d.pop("demo_html", None)
    return d


def public_idea(i: Idea) -> dict:
    return i.dict()


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


# ----------------------------------------------------------------- tools
@app.get("/tools")
def list_tools(s: Session = Depends(get_session)):
    rows = s.exec(select(Tool).where(Tool.review_status == "approved").order_by(Tool.created_at.desc())).all()
    return [public_tool(t) for t in rows]


@app.get("/my/tools")
def my_tools(u: User = Depends(current_user), s: Session = Depends(get_session)):
    rows = s.exec(select(Tool).where(Tool.owner_id == u.id).order_by(Tool.created_at.desc())).all()
    return [public_tool(t) for t in rows]


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
        if len(file_bytes) > 5 * 1024 * 1024:
            raise HTTPException(400, "File size exceeds the 5MB limit.")
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


@app.post("/tools")
def create_tool(body: dict, u: User = Depends(current_user), s: Session = Depends(get_session)):
    process_tool_files(body)
        
    t = Tool(owner_id=u.id, owner=body.get("owner") or u.name, review_status="pending")
    for k in ("name", "category", "status", "problem", "delivers", "benefits", "impact", "sample", "configs",
              "implementation_status", "department", "idea_id", "demo_url", "video_url", "ppt_url", "account", "img_url", "achieved_through"):

        if k in body: setattr(t, k, body[k] or getattr(t, k))
    t.capabilities = body.get("capabilities", []) or []
    t.tags = body.get("tags", []) or []
    t.timeline = body.get("timeline", []) or []
    t.notes = body.get("notes", []) or []
    t.roi = float(body.get("roi") or 0)
    t.demo_html = body.get("demo_html", "") or ""
    t.has_demo = bool(t.demo_html or t.demo_url)
    t.badges = body.get("badges", []) or []
    
    t.edit_history = [{
        "editor_id": u.id,
        "editor_name": u.name,
        "timestamp": time.time(),
        "note": "Initial product submission",
        "changed_fields": ["created"]
    }]
    
    s.add(t); s.commit(); s.refresh(t)
    return public_tool(t)


@app.get("/tools/{tool_id}")
def get_tool(tool_id: int, u: Optional[User] = Depends(current_user), s: Session = Depends(get_session)):
    t = s.get(Tool, tool_id)
    if not t: raise HTTPException(404, "Not found")
    if t.review_status != "approved":
        if not u: raise HTTPException(401, "Authentication required for pending tools")
        if t.owner_id != u.id and u.role not in ("committee", "approver", "admin"):
            raise HTTPException(403, "Access denied")
    return public_tool(t)


@app.patch("/tools/{tool_id}")
def update_tool(tool_id: int, body: dict, u: User = Depends(current_user), s: Session = Depends(get_session)):
    process_tool_files(body)

    t = s.get(Tool, tool_id)
    if not t: raise HTTPException(404, "Not found")
    if t.owner_id != u.id and u.role not in ("committee", "approver", "admin"):
        raise HTTPException(403, "Only the owner or an admin/committee can edit this tool")
        
    changed = []
    for k in ("name", "category", "status", "problem", "delivers", "benefits", "impact", "owner", "sample", "configs",
              "implementation_status", "department", "idea_id", "demo_url", "video_url", "ppt_url", "account", "img_url", "featured", "achieved_through"):
        if k in body and body[k] != getattr(t, k):
            changed.append(k)
            
    if "capabilities" in body and body["capabilities"] != t.capabilities: changed.append("capabilities")
    if "tags" in body and body["tags"] != t.tags: changed.append("tags")
    if "timeline" in body and body["timeline"] != t.timeline: changed.append("timeline")
    if "roi" in body and float(body["roi"] or 0) != t.roi: changed.append("roi")
    if "demo_html" in body and body["demo_html"] != t.demo_html: changed.append("demo_html")
    if "badges" in body and body["badges"] != t.badges: changed.append("badges")

    for k in ("name", "category", "status", "problem", "delivers", "benefits", "impact", "owner", "sample", "configs",
              "implementation_status", "department", "idea_id", "demo_url", "video_url", "ppt_url", "account", "img_url", "featured", "achieved_through"):

        if k in body: setattr(t, k, body[k])
    if "capabilities" in body: t.capabilities = body["capabilities"] or []
    if "tags" in body: t.tags = body["tags"] or []
    if "timeline" in body: t.timeline = body["timeline"] or []
    if "notes" in body: t.notes = body["notes"] or []
    if "roi" in body: t.roi = float(body["roi"] or 0)
    if "demo_html" in body: t.demo_html = body["demo_html"] or ""
    if "badges" in body: t.badges = body["badges"] or []
    t.has_demo = bool(t.demo_html or t.demo_url)
    
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
    if t.owner_id != u.id and u.role != "admin":
        raise HTTPException(403, "Only the owner or an admin can delete this tool")
    s.delete(t); s.commit()
    return {"ok": True}


@app.get("/tools/{tool_id}/demo")
def tool_demo(tool_id: int, s: Session = Depends(get_session)):
    t = s.get(Tool, tool_id)
    return {"demo_html": t.demo_html}


@app.get("/tools/{tool_id}/demo/raw", response_class=HTMLResponse)
def tool_demo_raw(tool_id: int, s: Session = Depends(get_session)):
    t = s.get(Tool, tool_id)
    if not t or not t.demo_html:
        return HTMLResponse("<h3>No HTML demo available for this tool.</h3>", status_code=404)
    return HTMLResponse(content=t.demo_html)


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


@app.get("/alerts")
def alerts(u: User = Depends(current_user), s: Session = Depends(get_session)):
    rows = s.exec(select(SponsorRequest).order_by(SponsorRequest.created_at.desc())).all()
    if u.role != "admin":
        rows = [r for r in rows if r.owner_id == u.id]
    return [r.dict() for r in rows]


# ----------------------------------------------------------------- ideas
@app.get("/ideas")
def list_ideas(s: Session = Depends(get_session)):
    rows = s.exec(select(Idea).order_by(Idea.updated_at.desc())).all()
    return [public_idea(i) for i in rows]


@app.get("/my/ideas")
def my_ideas(u: User = Depends(current_user), s: Session = Depends(get_session)):
    rows = s.exec(select(Idea).where(Idea.owner_id == u.id).order_by(Idea.updated_at.desc())).all()
    return [public_idea(i) for i in rows]


@app.get("/review/ideas")
def review_ideas(u: User = Depends(require("committee", "approver", "admin")), s: Session = Depends(get_session)):
    rows = s.exec(select(Idea).where(Idea.status.in_(["proposed", "changes"])).order_by(Idea.updated_at)).all()
    return [public_idea(i) for i in rows]

@app.get("/archive/ideas")
def archive_ideas(u: User = Depends(require("committee", "approver", "admin")), s: Session = Depends(get_session)):
    rows = s.exec(select(Idea).where(Idea.status.in_(["declined", "changes"])).order_by(Idea.updated_at.desc())).all()
    return [public_idea(i) for i in rows]


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
    if "status" in body:
        i.status = body["status"]   # 'draft' on save, 'proposed' on submit
        if body["status"] == "proposed":
            routing = s.get(Setting, "idea_routing")
            if routing and routing.value == "voice_of_clients":
                i.status = "approved"
                i.decided_by = "Auto-routed"
    i.updated_at = time.time()
    s.add(i); s.commit(); s.refresh(i)
    return public_idea(i)


@app.post("/ideas/{idea_id}/vote")
def vote_idea(idea_id: int, u: User = Depends(current_user), s: Session = Depends(get_session)):
    i = s.get(Idea, idea_id)
    if not i: raise HTTPException(404, "Not found")
    voters = list(i.voters or [])
    voters = [v for v in voters if v != u.id] if u.id in voters else voters + [u.id]
    i.voters = voters; i.votes = len(voters)
    s.add(i); s.commit(); s.refresh(i)
    return public_idea(i)


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
    return public_idea(i)

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
async def ai_generate(body: AIGenerateIn, u: User = Depends(current_user)):
    provider = u.ai_provider or "local"
    model = getattr(u, "ai_model", None) or OLLAMA_MODEL
    try:
        if provider == "gemini" and u.ai_key:
            return {"text": await _gemini(u.ai_key, body.prompt), "via": "gemini"}
        if provider == "openai" and u.ai_key:
            return {"text": await _openai(u.ai_key, body.prompt), "via": "openai"}
        return {"text": await _ollama(body.model or model, body.prompt), "via": f"local ({model})"}
    except httpx.HTTPError as e:
        raise HTTPException(502, f"AI request failed: {e}")


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
    url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key={key}"
    async with httpx.AsyncClient(timeout=60) as c:
        r = await c.post(url, json={"contents": [{"parts": [{"text": prompt}]}]})
        r.raise_for_status()
        return r.json()["candidates"][0]["content"]["parts"][0]["text"].strip()


async def _openai(key: str, prompt: str) -> str:
    async with httpx.AsyncClient(timeout=60) as c:
        r = await c.post("https://api.openai.com/v1/chat/completions",
                         headers={"Authorization": f"Bearer {key}"},
                         json={"model": "gpt-4o-mini", "messages": [{"role": "user", "content": prompt}]})
        r.raise_for_status()
        return r.json()["choices"][0]["message"]["content"].strip()


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
                         ("edit_history", "JSON DEFAULT '[]'")]:
            if tcols and col not in tcols:
                conn.exec_driver_sql(f"ALTER TABLE tool ADD COLUMN {col} {ddl}")
        icols = [r[1] for r in conn.exec_driver_sql("PRAGMA table_info(idea)").fetchall()]
        for col, ddl in [("review_note", "VARCHAR DEFAULT ''"), ("decided_by", "VARCHAR DEFAULT ''"),
                         ("votes", "INTEGER DEFAULT 0"), ("voters", "JSON DEFAULT '[]'"),
                         ("notes", "JSON DEFAULT '[]'")]:
            if icols and col not in icols:
                conn.exec_driver_sql(f"ALTER TABLE idea ADD COLUMN {col} {ddl}")
        
        ucols = [r[1] for r in conn.exec_driver_sql("PRAGMA table_info(user)").fetchall()]
        for col, ddl in [("ai_model", "VARCHAR DEFAULT 'llama3.2'"), ("department", "VARCHAR DEFAULT ''")]:
            if ucols and col not in ucols:
                conn.exec_driver_sql(f"ALTER TABLE user ADD COLUMN {col} {ddl}")


def seed():
    with Session(engine) as s:
        if not s.exec(select(Setting).where(Setting.key == "idea_routing")).first():
            s.add(Setting(key="idea_routing", value="committee"))
            s.commit()
        if not s.exec(select(User).where(User.email == "admin")).first():
            s.add(User(email="admin", name="Admin", role="admin", password_hash=pwd.hash("admin")))
            s.commit()
        samples = [
            dict(name="Parallax 3.0", owner="Data Viz Guild", category="Visualization", status="active",
                 roi=120000, impact="Saved 60 hrs/mo", problem="Analysts rebuild the same scrolling narrative dashboards by hand for every readout.",
                 tags=["dashboards", "storytelling"], capabilities=["Scrollytelling", "Templated readouts"], implementation_status="implemented",
                 badges=[{"title": "Top Tool", "img_url": ""}], featured=True),
            dict(name="Performance Engine", owner="Ops Analytics", category="Analytics", status="implemented",
                 roi=250000, impact="Cut reporting from 3 days to 2 hrs", problem="Monthly performance packs are assembled manually across five disconnected sources.",
                 tags=["kpi", "automation"], capabilities=["Auto KPI packs", "Source merge"], implementation_status="implemented",
                 badges=[], featured=True),
            dict(name="Process Mining Engine", owner="Transformation", category="Process", status="pilot",
                 roi=90000, impact="Surfaced 12 bottlenecks", problem="No visibility into where work actually stalls inside long operational processes.",
                 tags=["process", "bottlenecks"], capabilities=["Activity logs", "Bottleneck detection"], implementation_status="implemented",
                 badges=[]),
            dict(name="Sentiment Analyzer Pro", owner="CX Analytics Team", category="CX & Feedback", status="active",
                 roi=150000, impact="Reduced negative sentiment calls by 18%", problem="Feedback from Concentrix calls is unstructured and sentiment isn't tracked over time.",
                 tags=["cx", "sentiment", "concentrix"], capabilities=["Real-time transcript analysis", "Customer sentiment indexing"],
                 account="Concentrix", implementation_status="implemented", delivers="A dashboard showing customer sentiment trends and performance correlations.", benefits="Increases CSAT by up to 12%.",
                 badges=[{"title": "Verified Demo", "img_url": ""}, {"title": "GDPR Compliant", "img_url": ""}], featured=True),
            dict(name="Predictive Inventory Optimizer", owner="Demand Forecasting Squad", category="Supply Chain", status="pilot",
                 roi=95000, impact="Estimated $95K savings in warehouse costs", problem="Warehouse overstocking at client locations costs over $100K annually due to poor demand prediction.",
                 tags=["forecasting", "inventory", "optimization"], capabilities=["Time-series forecasting", "Safety stock calculations"],
                 account="AT&T", implementation_status="not_implemented", delivers="Weekly inventory recommendations and safety stock alerts.", benefits="Lowers storage overhead by 22%.",
                 badges=[]),
            dict(name="Contract Auditing AI", owner="Procurement Intelligence", category="Legal & Finance", status="active",
                 roi=180000, impact="Saves 120 hours of legal review per audit", problem="Auditing hundreds of supplier contracts for legal compliance takes weeks of manual work.",
                 tags=["compliance", "audit", "contracts"], capabilities=["Contract clause extraction", "Compliance scanning"],
                 account="Google Cloud", implementation_status="third_party", delivers="Compliance report showing flagged clauses and missing SLAs.", benefits="Cuts contract review times by 85%.",
                 badges=[{"title": "SOC2 Verified", "img_url": ""}])
        ]
        for d in samples:
            existing = s.exec(select(Tool).where(Tool.name == d["name"])).first()
            if not existing:
                s.add(Tool(owner_id=0, review_status="approved", **d))
            else:
                existing.badges = d.get("badges", [])
                s.add(existing)
        s.commit()


@app.on_event("startup")
def on_start():
    SQLModel.metadata.create_all(engine)
    migrate()
    seed()


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

