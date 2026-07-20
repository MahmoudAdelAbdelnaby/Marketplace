import os
import re
import zipfile
import tempfile
import shutil
import json
import httpx
from typing import Optional

async def _list_usable_models(c: httpx.AsyncClient, api_key: str) -> list:
    """Ask the API which models this key can actually call, preferring cheap/fast ones."""
    r = await c.get(f"https://generativelanguage.googleapis.com/v1beta/models?key={api_key}&pageSize=100")
    r.raise_for_status()
    names = [
        m["name"].split("/")[-1]
        for m in r.json().get("models", [])
        if "generateContent" in m.get("supportedGenerationMethods", [])
    ]
    # Prefer flash > pro > anything, newest first (list order is roughly newest-first already)
    names.sort(key=lambda n: (0 if "flash" in n else 1 if "pro" in n else 2))
    return names

async def _query_local_model(base_url: str, model: str, prompt: str) -> str:
    """Query an OpenAI-compatible local server (Ollama, LM Studio, llama.cpp)."""
    url = base_url.rstrip("/") + "/v1/chat/completions"
    async with httpx.AsyncClient(timeout=300) as c:  # local models are slow
        r = await c.post(url, json={
            "model": model,
            "messages": [{"role": "user", "content": prompt}],
            "temperature": 0,
        })
        if r.status_code != 200:
            raise Exception(f"Local model server {url} -> HTTP {r.status_code}: {r.text[:500]}")
        return r.json()["choices"][0]["message"]["content"].strip()

def find_project_root(extract_dir: str) -> str:
    """ZIPs made by zipping a folder (Windows right-click) nest everything one
    level down. If extraction yields a single directory, that's the project root."""
    entries = [e for e in os.listdir(extract_dir) if e != "__MACOSX"]
    if len(entries) == 1 and os.path.isdir(os.path.join(extract_dir, entries[0])):
        return os.path.join(extract_dir, entries[0])
    return extract_dir

def _sanitize_dockerfile(df: str) -> str:
    """Enforce critical Dockerfile rules the model may ignore.
    ponytail: fix the two failure modes seen in practice; extend as new ones appear."""
    # --production / --omit=dev skips devDependencies (vite etc.) and breaks builds
    df = re.sub(r"(npm (?:install|ci))(?:\s+--(?:production|omit=dev))+", r"\1", df)
    # Ancient node images (<=18) can't run modern build tooling
    df = re.sub(r"FROM node:1[0-8](?:[\w.]*)?(?:-[\w.]+)?", "FROM node:20-alpine", df)
    # Blank lines inside RUN `... && \` continuations are a dockerfile parse error
    df = re.sub(r"\\[ \t]*\n([ \t]*\n)+", "\\\\\n", df)
    return df

def _lenient_json_loads(text: str) -> dict:
    """Parse model output that is almost-JSON. Local models often emit
    backtick-quoted multiline strings and trailing commas."""
    try:
        return json.loads(text)
    except Exception:
        pass
    # Backtick-quoted values -> proper JSON strings (unescape \" the model added first)
    fixed = re.sub(r"`([\s\S]*?)`", lambda m: json.dumps(m.group(1).replace('\\"', '"')), text)
    # Trailing commas before } or ]
    fixed = re.sub(r",\s*([}\]])", r"\1", fixed)
    return json.loads(fixed)

def _heuristic_result(all_files: list, found_key_files: dict) -> dict:
    """No-AI fallback: detect the stack from files and use a canned Dockerfile."""
    # ponytail: naive stack detection (node/python/static); extend cases as real submissions demand
    names = [f.replace("\\", "/").split("/")[-1] for f in all_files]
    if "package.json" in names:
        return {
            "decision": "approve",
            "reason": "AI audit disabled. Heuristic build: Node project detected (package.json).",
            "tech_stack": "Node.js (heuristic)",
            "container_port": 80,
            "dockerfile": (
                # package.json copied first so Docker caches the npm install
                # layer — rebuilds only reinstall when dependencies change
                "FROM node:20-alpine AS build\nWORKDIR /app\nCOPY package*.json ./\n"
                "RUN npm install\nCOPY . .\nRUN npm run build\n"
                "FROM nginx:alpine\nCOPY --from=build /app/dist /usr/share/nginx/html\n"
            ),
        }
    if "requirements.txt" in names:
        entry = "main:app" if "main.py" in names else "app:app"
        return {
            "decision": "approve",
            "reason": "AI audit disabled. Heuristic build: Python project detected (requirements.txt).",
            "tech_stack": "Python (heuristic)",
            "container_port": 8000,
            "dockerfile": (
                "FROM python:3.11-slim\nWORKDIR /app\nCOPY requirements.txt ./\n"
                "RUN pip install --no-cache-dir -r requirements.txt uvicorn\nCOPY . .\n"
                f"CMD [\"python\", \"-m\", \"uvicorn\", \"{entry}\", \"--host\", \"0.0.0.0\", \"--port\", \"8000\"]\n"
            ),
        }
    return {
        "decision": "approve",
        "reason": "AI audit disabled. Heuristic build: treating as static site.",
        "tech_stack": "Static HTML (heuristic)",
        "container_port": 80,
        "dockerfile": "FROM nginx:alpine\nCOPY . /usr/share/nginx/html\n",
    }

async def _query_gemini_models(api_key: str, prompt: str) -> str:
    last_err = None
    async with httpx.AsyncClient(timeout=60) as c:
        try:
            models = (await _list_usable_models(c, api_key))[:4]
        except Exception as ex:
            models = ["gemini-2.5-flash", "gemini-2.0-flash"]
            last_err = f"ListModels failed ({ex}), falling back to defaults"
        if not models:
            raise Exception("Gemini API key has no models supporting generateContent. Check the key's restrictions in Google AI Studio.")
        for model in models:
            url = f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent?key={api_key}"
            try:
                r = await c.post(url, json={"contents": [{"parts": [{"text": prompt}]}]})
                if r.status_code == 200:
                    return r.json()["candidates"][0]["content"]["parts"][0]["text"].strip()
                else:
                    last_err = f"{model} -> HTTP {r.status_code}: {r.text[:500]}"
            except Exception as ex:
                last_err = str(ex)
        raise Exception(f"Gemini API failed during codebase analysis. Models tried: {', '.join(models)}. Last error: {last_err}")

async def analyze_and_audit_zip_codebase(
    zip_path: str,
    api_key: str = "",
    ai_enabled: bool = True,
    provider: str = "gemini",
    local_url: str = "http://localhost:11434",
    local_model: str = "llama3.2",
    custom_prompt: str = "",
) -> dict:
    """
    Extracts ZIP file, scans structures/key configuration files,
    audits codebase with the configured AI (Gemini or a local OpenAI-compatible
    server), and generates a Dockerfile. With ai_enabled=False, skips the AI
    entirely and uses heuristic stack detection with a canned Dockerfile.
    """
    if not os.path.exists(zip_path):
        return {
            "decision": "flag",
            "reason": "ZIP file not found on disk.",
            "tech_stack": "Unknown",
            "container_port": 80,
            "dockerfile": ""
        }

    temp_dir = tempfile.mkdtemp()
    try:
        # Extract files safely
        with zipfile.ZipFile(zip_path, 'r') as ref:
            ref.extractall(temp_dir)
        scan_root = find_project_root(temp_dir)

        # Scan file list recursively
        all_files = []
        for root, _, files in os.walk(scan_root):
            for file in files:
                rel_path = os.path.relpath(os.path.join(root, file), scan_root)
                # Ignore heavy or hidden folders
                if any(p in rel_path.replace("\\", "/").split("/") for p in ("node_modules", ".git", ".venv", "venv", "__pycache__", "dist", "build")):
                    continue
                all_files.append(rel_path)
                if len(all_files) >= 150: # Limit list size
                    break
        
        # Find key configuration/entrypoint files
        key_files = ["package.json", "requirements.txt", "main.py", "app.py", "server.js", "index.js", "index.html", "vite.config.js", "wsgi.py"]
        found_key_files = {}
        
        for kf in key_files:
            # Look for exact or matching suffix
            for f in all_files:
                if f.replace("\\", "/").endswith(kf):
                    filepath = os.path.join(scan_root, f)
                    try:
                        with open(filepath, "r", encoding="utf-8", errors="ignore") as fobj:
                            found_key_files[f] = fobj.read(4000) # Read first 4KB
                    except Exception:
                        pass
        
        if not ai_enabled:
            return _heuristic_result(all_files, found_key_files)

        # Build file list and contents string
        file_list_str = "\n".join(all_files[:100])
        contents_str = ""
        for f, content in found_key_files.items():
            contents_str += f"=== File: {f} ===\n{content}\n\n"

        if custom_prompt and custom_prompt.strip():
            prompt = f"{custom_prompt.strip()}\n\nCodebase File List:\n{file_list_str}\n\nKey Configurations:\n{contents_str}"
        else:
            prompt = f"""You are a senior devops and security auditor.
Analyze the following web application codebase structure and configuration files.

1. **Security Audit**: Scan for:
   - Command injection vulnerabilities or shells (e.g. exec, subprocess.Popen without shell=False, eval).
   - Infinite loops, CPU exhaustion patterns, or storage overload logic.
   - Remote code execution (RCE) hooks, malicious file writes, or credential stealing.
   - Flag the decision as "flag" if unsafe, otherwise "approve".
2. **Framework & Tech Stack Detection**: Determine if it's React/Vite, Node.js, Python FastAPI/Flask, static HTML, etc.
3. **Container Port**: Detect the listening port of the app (default to 80 for static, 8000 for Python, 3000/5000/8080 for Node).
4. **Dockerfile Generation**: Generate a single-container multi-stage Dockerfile that builds and runs this application cleanly. Ensure dependencies are installed. Ensure dynamic configuration files are handled. Use production builds — NEVER dev servers like `npm run dev` or `vite`. The server must listen on 0.0.0.0 (not localhost) so the mapped port is reachable; for frontend-only apps serve the built output with nginx. Copy dependency manifests (package*.json, requirements.txt) and install dependencies BEFORE copying the rest of the source, so Docker layer caching skips reinstalling on rebuilds. In build stages install ALL dependencies (plain `npm install` — never `--production`/`--omit=dev`, build tools like vite are devDependencies). Keep the Dockerfile MINIMAL — under 15 instructions. Do NOT generate config files with echo/printf/heredoc chains; stock image defaults are fine (nginx already serves /usr/share/nginx/html on port 80). No gzip tuning, cache headers, healthchecks, or other production niceties — this is a demo.

Codebase File List:
{file_list_str}

Key Configurations and Entrypoint Contents:
{contents_str}

Return your response EXACTLY as a JSON object, with no markdown formatting or triple backticks. Use this schema:
{{
  "decision": "approve" | "flag",
  "reason": "Brief summary of decision and security analysis.",
  "tech_stack": "e.g. React + FastAPI",
  "container_port": 8000,
  "dockerfile": "Dockerfile text here (use double quotes inside or escape properly)"
}}
"""
        if provider == "local":
            response_text = await _query_local_model(local_url, local_model, prompt)
        else:
            response_text = await _query_gemini_models(api_key, prompt)
        
        # Clean markdown wrappers if returned
        cleaned = response_text.strip()
        if cleaned.startswith("```"):
            lines = cleaned.split("\n")
            if lines[0].startswith("```json") or lines[0].startswith("```"):
                lines = lines[1:]
            if lines and lines[-1].strip() == "```":
                lines = lines[:-1]
            cleaned = "\n".join(lines).strip()
            
        try:
            result = _lenient_json_loads(cleaned)
            return {
                "decision": result.get("decision", "flag"),
                "reason": result.get("reason", "Failed to parse security reason."),
                "tech_stack": result.get("tech_stack", "Unknown"),
                "container_port": int(result.get("container_port") or 80),
                "dockerfile": _sanitize_dockerfile(result.get("dockerfile", ""))
            }
        except Exception as e:
            return {
                "decision": "flag",
                "reason": f"AI response was not valid JSON: {cleaned}. Error: {e}",
                "tech_stack": "Unknown",
                "container_port": 80,
                "dockerfile": ""
            }

    finally:
        shutil.rmtree(temp_dir, ignore_errors=True)
