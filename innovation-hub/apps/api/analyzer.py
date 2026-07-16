import os
import zipfile
import tempfile
import shutil
import json
import httpx
from typing import Optional

async def _query_gemini_models(api_key: str, prompt: str) -> str:
    models = ["gemini-2.5-flash", "gemini-3.5-flash", "gemini-1.5-flash", "gemini-1.0-pro", "gemini-pro"]
    last_err = None
    async with httpx.AsyncClient(timeout=60) as c:
        for model in models:
            url = f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent?key={api_key}"
            try:
                r = await c.post(url, json={"contents": [{"parts": [{"text": prompt}]}]})
                if r.status_code == 200:
                    return r.json()["candidates"][0]["content"]["parts"][0]["text"].strip()
                else:
                    last_err = f"HTTP {r.status_code}: {r.text}"
            except Exception as ex:
                last_err = str(ex)
        raise Exception(f"Gemini API failed during codebase analysis. Last error: {last_err}")

async def analyze_and_audit_zip_codebase(zip_path: str, api_key: str) -> dict:
    """
    Extracts ZIP file, scans structures/key configuration files, 
    audits codebase with Gemini for security, and generates a Dockerfile.
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
        
        # Scan file list recursively
        all_files = []
        for root, _, files in os.walk(temp_dir):
            for file in files:
                rel_path = os.path.relpath(os.path.join(root, file), temp_dir)
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
                    filepath = os.path.join(temp_dir, f)
                    try:
                        with open(filepath, "r", encoding="utf-8", errors="ignore") as fobj:
                            found_key_files[f] = fobj.read(4000) # Read first 4KB
                    except Exception:
                        pass
        
        # Build file list and contents string
        file_list_str = "\n".join(all_files[:100])
        contents_str = ""
        for f, content in found_key_files.items():
            contents_str += f"=== File: {f} ===\n{content}\n\n"

        prompt = f"""You are a senior devops and security auditor.
Analyze the following web application codebase structure and configuration files.

1. **Security Audit**: Scan for:
   - Command injection vulnerabilities or shells (e.g. exec, subprocess.Popen without shell=False, eval).
   - Infinite loops, CPU exhaustion patterns, or storage overload logic.
   - Remote code execution (RCE) hooks, malicious file writes, or credential stealing.
   - Flag the decision as "flag" if unsafe, otherwise "approve".
2. **Framework & Tech Stack Detection**: Determine if it's React/Vite, Node.js, Python FastAPI/Flask, static HTML, etc.
3. **Container Port**: Detect the listening port of the app (default to 80 for static, 8000 for Python, 3000/5000/8080 for Node).
4. **Dockerfile Generation**: Generate a single-container multi-stage Dockerfile that builds and runs this application cleanly. Ensure dependencies are installed. Ensure dynamic configuration files are handled.

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
            result = json.loads(cleaned)
            return {
                "decision": result.get("decision", "flag"),
                "reason": result.get("reason", "Failed to parse security reason."),
                "tech_stack": result.get("tech_stack", "Unknown"),
                "container_port": int(result.get("container_port") or 80),
                "dockerfile": result.get("dockerfile", "")
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
