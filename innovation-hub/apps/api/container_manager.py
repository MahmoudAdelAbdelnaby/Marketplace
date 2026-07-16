import os
import socket
import time
import zipfile
import tempfile
import shutil
import subprocess
import threading
from typing import Optional
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

# ---- Idle sleep: stop demo containers nobody is viewing -------------------
LAST_ACCESS = {}
IDLE_SECONDS = 2 * 3600  # ponytail: fixed 2h idle timeout; promote to a Setting if it ever needs tuning

def touch(tool_id: int):
    LAST_ACCESS[tool_id] = time.time()

def wake_container(tool_id: int) -> bool:
    """Restart a sleeping demo container. Fast — image and port mapping are kept."""
    res = subprocess.run(["docker", "start", f"demo-{tool_id}"], shell=True, capture_output=True, text=True)
    touch(tool_id)
    return res.returncode == 0

def _idle_watcher(db_url: str):
    engine = create_engine(db_url)
    Session = sessionmaker(bind=engine)
    while True:
        time.sleep(600)
        try:
            from main import Tool
            session = Session()
            running = session.query(Tool).filter(Tool.demo_container_status == "running").all()
            now = time.time()
            for t in running:
                last = LAST_ACCESS.get(t.id)
                if last is None:
                    # No access recorded since API start — grant a grace window
                    LAST_ACCESS[t.id] = now
                    continue
                if now - last > IDLE_SECONDS:
                    subprocess.run(["docker", "stop", f"demo-{t.id}"], shell=True,
                                   stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
                    t.demo_container_status = "sleeping"
                    session.commit()
            session.close()
        except Exception as e:
            print(f"Idle watcher error: {e}")

_watcher_started = False
def start_idle_watcher(db_url: str):
    global _watcher_started
    if _watcher_started:
        return
    _watcher_started = True
    threading.Thread(target=_idle_watcher, args=(db_url,), daemon=True).start()

def find_free_port(start=9000, end=9999) -> int:
    for port in range(start, end + 1):
        with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
            try:
                s.bind(("127.0.0.1", port))
                return port
            except OSError:
                continue
    raise Exception("No free ports available in range 9000-9999")

def _update_tool_db(db_url: str, tool_id: int, updates: dict):
    """Utility to safely update Tool state in the database from a separate thread."""
    engine = create_engine(db_url)
    Session = sessionmaker(bind=engine)
    session = Session()
    try:
        from main import Tool # Imported inside to avoid circular reference
        t = session.query(Tool).filter(Tool.id == tool_id).first()
        if t:
            for k, v in updates.items():
                setattr(t, k, v)
            session.commit()
    except Exception as e:
        print(f"Database update error in container manager: {e}")
    finally:
        session.close()

def _build_and_run_task(db_url: str, tool_id: int, zip_path: str, dockerfile_content: str, container_port: int):
    """Background task to extract ZIP, write Dockerfile, build image, and run container."""
    temp_dir = tempfile.mkdtemp()
    build_logs = ""
    
    _update_tool_db(db_url, tool_id, {
        "demo_container_status": "building",
        "demo_container_build_logs": "Starting build environment extraction...\n"
    })
    
    try:
        # 1. Extract ZIP; descend into a single wrapper folder if the ZIP was
        # made by zipping the project folder itself (matches analyzer's view)
        with zipfile.ZipFile(zip_path, 'r') as ref:
            ref.extractall(temp_dir)
        from analyzer import find_project_root
        build_ctx = find_project_root(temp_dir)

        # 2. Write Dockerfile
        dockerfile_path = os.path.join(build_ctx, "Dockerfile")
        with open(dockerfile_path, "w", encoding="utf-8") as df:
            df.write(dockerfile_content)
            
        # Fail fast with a clear message if the Docker daemon isn't running
        chk = subprocess.run(["docker", "info"], shell=True, capture_output=True, text=True)
        if chk.returncode != 0:
            build_logs += (
                "\nDocker daemon is not reachable — is Docker Desktop running?\n"
                "Start Docker Desktop, wait for it to say 'Engine running', then click 'Run AI Audit & Rebuild'.\n"
                f"Details: {(chk.stderr or chk.stdout or '').strip()[-500:]}\n"
            )
            _update_tool_db(db_url, tool_id, {
                "demo_container_status": "build_failed",
                "demo_container_build_logs": build_logs
            })
            return

        build_logs += "ZIP file extracted successfully.\nDockerfile generated.\nRunning docker build...\n"
        _update_tool_db(db_url, tool_id, {"demo_container_build_logs": build_logs})
        
        # 3. Docker build
        image_name = f"demo-{tool_id}"
        # Execute docker build capturing output line by line
        process = subprocess.Popen(
            ["docker", "build", "-t", image_name, "."],
            cwd=build_ctx,
            stdout=subprocess.PIPE,
            stderr=subprocess.STDOUT,
            text=True,
            shell=True # For Windows compatibility
        )
        
        while True:
            line = process.stdout.readline()
            if not line:
                break
            build_logs += line
            # Keep DB updated with stream of build logs
            _update_tool_db(db_url, tool_id, {"demo_container_build_logs": build_logs})
            
        process.wait()
        
        if process.returncode != 0:
            build_logs += f"\nDocker build failed with exit code: {process.returncode}\n"
            _update_tool_db(db_url, tool_id, {
                "demo_container_status": "build_failed",
                "demo_container_build_logs": build_logs
            })
            return
            
        build_logs += "\nDocker build succeeded!\nAllocating host port and starting container...\n"
        _update_tool_db(db_url, tool_id, {"demo_container_build_logs": build_logs})
        
        # 4. Stop and remove existing container
        container_name = f"demo-{tool_id}"
        subprocess.run(["docker", "stop", container_name], shell=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        subprocess.run(["docker", "rm", container_name], shell=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        
        # 5. Find free port
        host_port = find_free_port()
        
        # 6. Run container with limits
        # --memory="256m" caps RAM at 256 megabytes
        # --cpus="0.5" caps CPU usage at half a core
        run_cmd = [
            "docker", "run", "-d",
            "--name", container_name,
            "-p", f"127.0.0.1:{host_port}:{container_port}",
            "--memory", "256m",
            "--cpus", "0.5",
            "--restart", "unless-stopped",
            image_name
        ]
        
        run_res = subprocess.run(run_cmd, shell=True, capture_output=True, text=True)
        if run_res.returncode != 0:
            build_logs += f"\nDocker run failed: {run_res.stderr}\n"
            _update_tool_db(db_url, tool_id, {
                "demo_container_status": "build_failed",
                "demo_container_build_logs": build_logs
            })
            return
            
        # Remove dangling images left behind by previous rebuilds of this tag
        subprocess.run(["docker", "image", "prune", "-f"], shell=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)

        build_logs += f"\nContainer started successfully on local port {host_port}.\n"
        _update_tool_db(db_url, tool_id, {
            "demo_container_status": "running",
            "demo_container_port": host_port,
            "demo_container_build_logs": build_logs
        })
        
    except Exception as e:
        build_logs += f"\nUnexpected manager error: {str(e)}\n"
        _update_tool_db(db_url, tool_id, {
            "demo_container_status": "build_failed",
            "demo_container_build_logs": build_logs
        })
    finally:
        shutil.rmtree(temp_dir, ignore_errors=True)

def build_and_run_demo_container(db_url: str, tool_id: int, zip_path: str, dockerfile_content: str, container_port: int):
    """Launches build_and_run in a background thread."""
    t = threading.Thread(
        target=_build_and_run_task,
        args=(db_url, tool_id, zip_path, dockerfile_content, container_port)
    )
    t.daemon = True
    t.start()

def stop_and_remove_demo_container(tool_id: int):
    """Stops and cleans up the container for the tool."""
    container_name = f"demo-{tool_id}"
    subprocess.run(["docker", "stop", container_name], shell=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    subprocess.run(["docker", "rm", container_name], shell=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
