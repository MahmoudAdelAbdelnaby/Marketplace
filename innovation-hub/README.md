# Analytics AI Hub — local working demo

A self-contained local demo: React (Vite) frontend + FastAPI/SQLite backend.
No cloud needed. Simple register/login, local SQL persistence, and an AI
feature that uses a local Ollama model or your own pasted cloud key.

## Run it (two terminals)

**1. Backend** (FastAPI + SQLite, port 8000)
```bash
cd innovation-hub/apps/api
# first time only: python -m venv .venv && .venv/Scripts/python -m pip install -r requirements.txt
.venv/Scripts/python -m uvicorn main:app --port 8000
```

**2. Frontend** (Vite, port 5173)
```bash
cd innovation-hub/apps/web
npm install   # first time only
npm run dev
```
Open http://localhost:5173

## Notes
- **Accounts**: register on first screen. The **first account becomes Admin**; others pick a role (Viewer / Product Owner / Committee). Data lives in `apps/api/hub.db` (SQLite). Delete that file to reset.
- **AI**: Settings → AI provider. "Local model" calls **Ollama**; enable it with `ollama serve` then `ollama pull llama3.2`. Or pick Gemini/OpenAI and paste a key. Keys are stored in the local DB (demo only — not production-secure).
- **What's wired**: register/login (JWT), catalog (list/add) from SQLite, AI provider settings + test, the Innovation Opportunity Canvas (Idea Pipeline) with the structured map + completeness scoring. Tool detail/demos and idea persistence to the backend are the next steps.
- This is the local-demo path; the GCP/Postgres/Entra production design is in `../PRD_Innovation_Hub_FULL.md`.
