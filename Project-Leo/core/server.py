#!/usr/bin/env python3
"""Project Leo - Local Network File Manager"""

import os, json, mimetypes, socket, shutil, time, zipfile, io, threading
import hashlib, secrets, sys
from http.server import HTTPServer, BaseHTTPRequestHandler
from socketserver import ThreadingMixIn
from urllib.parse import urlparse, unquote, parse_qs

PORT = 8000
ROOT_FOLDER = "D:/"

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
# Static files (index.html, app.css, app.js) live in the same folder as server.py
# When the project is structured as core/server.py, BASE_DIR = core/ automatically.
ROOT = os.path.normpath(os.path.abspath(ROOT_FOLDER))
ROOT_PREFIX = ROOT if ROOT.endswith(os.sep) else ROOT + os.sep
CURRENT_DRIVE = ROOT_FOLDER.split(":")[0].upper() + ":" if ":" in ROOT_FOLDER else ROOT_FOLDER

# ── Authentication ────────────────────────────────────────────
# Credentials set at startup via CMD prompt
AUTH_USER = ""
AUTH_HASH = ""  # SHA-256 hex of password

# Sessions: token -> {"ip": str, "expires": float|None}
# expires=None means session-only (no remember me)
SESSIONS = {}
SESSIONS_LOCK = threading.Lock()
SESSION_LIFETIME = 8 * 3600  # 8 hours for "remember me" sessions

def hash_password(pw):
    return hashlib.sha256(pw.encode("utf-8")).hexdigest()

def make_token():
    return secrets.token_hex(32)  # 64 char hex token

def create_session(ip, remember):
    token = make_token()
    expires = time.time() + SESSION_LIFETIME if remember else None
    with SESSIONS_LOCK:
        SESSIONS[token] = {"ip": ip, "expires": expires}
    return token

def validate_session(token, ip):
    if not token:
        return False
    with SESSIONS_LOCK:
        s = SESSIONS.get(token)
        if not s:
            return False
        if s["ip"] != ip:
            return False  # IP mismatch — block stolen tokens
        if s["expires"] is not None and time.time() > s["expires"]:
            del SESSIONS[token]
            return False
        return True

def revoke_session(token):
    with SESSIONS_LOCK:
        SESSIONS.pop(token, None)

def read_password_win(prompt):
    """Read password char-by-char using msvcrt — works in all Windows terminals including .bat"""
    import msvcrt
    sys.stdout.write(prompt)
    sys.stdout.flush()
    pw = []
    while True:
        ch = msvcrt.getwch()
        if ch in ('\r', '\n'):   # Enter pressed
            sys.stdout.write('\n')
            sys.stdout.flush()
            break
        elif ch == '\x03':       # Ctrl+C
            sys.stdout.write('\n')
            raise KeyboardInterrupt
        elif ch == '\x08':       # Backspace
            if pw:
                pw.pop()
                sys.stdout.write('\b \b')
                sys.stdout.flush()
        elif ch == '\x00' or ch == '\xe0':  # Special key prefix — consume next char
            msvcrt.getwch()
        elif ord(ch) >= 32:      # Printable character
            pw.append(ch)
            sys.stdout.write('*')
            sys.stdout.flush()
    return ''.join(pw)

def read_password(prompt):
    """Cross-platform password reader — uses msvcrt on Windows, getpass elsewhere."""
    if sys.platform == "win32":
        try:
            return read_password_win(prompt)
        except Exception:
            pass  # fall through to getpass
    try:
        import getpass as _gp
        return _gp.getpass(prompt)
    except Exception:
        # Last resort: plain input (password visible)
        return input(prompt)

def setup_credentials():
    """Ask user to set username and password at startup via CMD."""
    global AUTH_USER, AUTH_HASH
    Y="\033[93m"; G="\033[92m"; C="\033[96m"; W="\033[97m"; R="\033[0m"; B="\033[1m"
    print(f"\n  {Y}{B}🔐 Security Setup{R}")
    print(f"  {W}Set your login credentials for Project Leo.{R}\n")
    while True:
        user = input(f"  {C}Username: {R}").strip()
        if len(user) >= 3:
            break
        print(f"  \033[91mUsername must be at least 3 characters.\033[0m")
    while True:
        pw1 = read_password(f"  {C}Password: {R}")
        if len(pw1) < 6:
            print(f"  \033[91mPassword must be at least 6 characters.\033[0m")
            continue
        pw2 = read_password(f"  {C}Confirm Password: {R}")
        if pw1 != pw2:
            print(f"  \033[91mPasswords do not match. Try again.\033[0m")
            continue
        break
    AUTH_USER = user
    AUTH_HASH = hash_password(pw1)
    print(f"\n  {G}{B}✓ Credentials set! Starting server...{R}\n")

def set_root(drive_letter):
    """Switch active root to a new drive letter (e.g. 'C:')"""
    global ROOT, ROOT_PREFIX, CURRENT_DRIVE
    new_root_folder = drive_letter.rstrip("/\\") + "/"
    ROOT = os.path.normpath(os.path.abspath(new_root_folder))
    ROOT_PREFIX = ROOT if ROOT.endswith(os.sep) else ROOT + os.sep
    CURRENT_DRIVE = drive_letter.rstrip("/\\").upper()
    if not CURRENT_DRIVE.endswith(":"): CURRENT_DRIVE += ":"

def get_drives():
    """Return list of available drives with disk usage"""
    drives = []
    if os.name == "nt":
        import string
        for letter in string.ascii_uppercase:
            path = letter + ":\\"
            if os.path.exists(path):
                try:
                    du = shutil.disk_usage(path)
                    drives.append({
                        "letter": letter + ":",
                        "path": path,
                        "total": du.total,
                        "used": du.used,
                        "free": du.free,
                        "active": (letter + ":") == CURRENT_DRIVE
                    })
                except:
                    drives.append({"letter": letter + ":", "path": path,
                                   "total": 0, "used": 0, "free": 0,
                                   "active": (letter + ":") == CURRENT_DRIVE})
    else:
        # Non-Windows: just return root
        try:
            du = shutil.disk_usage("/")
            drives.append({"letter": "/", "path": "/", "total": du.total,
                            "used": du.used, "free": du.free, "active": True})
        except: pass
    return drives

# Extended MIME types for cross-browser compatibility
EXTRA_MIMES = {
    ".mp4": "video/mp4", ".mkv": "video/x-matroska", ".webm": "video/webm",
    ".avi": "video/x-msvideo", ".mov": "video/quicktime", ".m4v": "video/mp4",
    ".3gp": "video/3gpp", ".mp3": "audio/mpeg", ".m4a": "audio/mp4",
    ".aac": "audio/aac", ".ogg": "audio/ogg", ".flac": "audio/flac",
    ".wav": "audio/wav", ".pdf": "application/pdf",
    ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".png": "image/png",
    ".gif": "image/gif", ".webp": "image/webp", ".svg": "image/svg+xml",
    ".bmp": "image/bmp",
}

def get_mime(path):
    ext = os.path.splitext(path)[1].lower()
    return EXTRA_MIMES.get(ext) or mimetypes.guess_type(path)[0] or "application/octet-stream"

def safe_path(rel):
    rel = rel.strip("/\\").replace("/", os.sep).replace("\\", os.sep)
    full = os.path.normpath(os.path.join(ROOT, rel)) if rel else ROOT
    if full == ROOT or full.startswith(ROOT_PREFIX):
        return full
    return None

def banner():
    Y="\033[93m"; O="\033[33m"; W="\033[97m"; G="\033[92m"
    C="\033[96m"; M="\033[95m"; DIM="\033[2m"; R="\033[0m"; B="\033[1m"
    ip = get_ip()
    art = f"""
{Y}{B}
  ██████╗ ██████╗  ██████╗      ██╗███████╗ ██████╗████████╗
  ██╔══██╗██╔══██╗██╔═══██╗     ██║██╔════╝██╔════╝╚══██╔══╝
  ██████╔╝██████╔╝██║   ██║     ██║█████╗  ██║        ██║
  ██╔═══╝ ██╔══██╗██║   ██║██   ██║██╔══╝  ██║        ██║
  ██║     ██║  ██║╚██████╔╝╚█████╔╝███████╗╚██████╗   ██║
  ╚═╝     ╚═╝  ╚═════╝  ╚════╝ ╚══════╝ ╚═════╝   ╚═╝
{R}{O}{B}               ██╗     ███████╗ ██████╗
               ██║     ██╔════╝██╔═══██╗
               ██║     █████╗  ██║   ██║
               ██║     ██╔══╝  ██║   ██║
               ███████╗███████╗╚██████╔╝
               ╚══════╝╚══════╝ ╚═════╝  {C}v1.0{R}
"""
    sep  = f"{DIM}{Y}{'═'*62}{R}"
    sep2 = f"{DIM}{O}{'─'*62}{R}"
    print(art)
    print(sep)
    print(f"{Y}{B}  {'Project Leo — Local Network File Manager':^58}{R}")
    print(sep)
    print()
    def row(icon, label, value, vc=W):
        print(f"  {O}{icon}{R}  {DIM}{W}{label:<14}{R}  {vc}{B}{value}{R}")
    def fmt(b):
        if not b: return "?"
        for u, s in [(1<<40,"TB"),(1<<30,"GB"),(1<<20,"MB"),(1<<10,"KB")]:
            if b >= u: return f"{b/u:.1f} {s}"
        return f"{b} B"
    row("◆", "PC Access",    f"http://127.0.0.1:{PORT}", C)
    row("◆", "Mobile Access",f"http://{ip}:{PORT}", G)
    row("◆", "Active Drive", CURRENT_DRIVE, Y)
    # Show all detected drives with free space
    drives = get_drives()
    if drives:
        parts = []
        for d in drives:
            marker = f"{Y}*{R}{B}" if d["active"] else ""
            free_str = f"({fmt(d['free'])} free)" if d["total"] > 0 else "(no info)"
            parts.append(f"{marker}{d['letter']}{W}{DIM} {free_str}{R}")
        print(f"  {O}◆{R}  {DIM}{W}{'All Drives':<14}{R}  {B}{'  '.join(parts)}{R}")
    print()
    print(sep2)
    print(f"  {DIM}{W}Open browser → {C}http://{ip}:{PORT}{R}")
    print(f"  {DIM}{W}Press {Y}Ctrl+C{W} to stop{R}")
    print(sep2)
    print()
    import sys
    for msg in ["  Initializing...  ", "  Loading files... ", "  Almost ready!   "]:
        sys.stdout.write(f"\r{G}{B}{msg}{R}"); sys.stdout.flush(); time.sleep(0.35)
    print(f"\r{G}{B}  ✓ Server LIVE on port {PORT}!{' '*20}{R}\n")
    print(f"{DIM}{Y}{'═'*62}{R}")
    print(f"  {DIM}{W}Request Log:{R}")
    print(f"{DIM}{Y}{'═'*62}{R}")


class LeoHandler(BaseHTTPRequestHandler):

    def get_client_ip(self):
        """Get real client IP, respecting X-Forwarded-For if present."""
        fwd = self.headers.get("X-Forwarded-For", "")
        if fwd:
            return fwd.split(",")[0].strip()
        return self.client_address[0]

    def get_token(self):
        """Get token from: 1) X-Leo-Token header, 2) Cookie, 3) ?tok= query param."""
        # 1. Header — used by JS fetch calls
        t = self.headers.get("X-Leo-Token", "")
        if t: return t
        # 2. Cookie — used by browser page navigations (GET /, GET /app.js, etc.)
        for part in self.headers.get("Cookie", "").split(";"):
            part = part.strip()
            if part.startswith("leo_session="):
                t = part[len("leo_session="):].strip()
                if t: return t
        # 3. Query param — used by media URLs (/api/view?tok=..., /api/thumb?tok=...)
        qs = parse_qs(urlparse(self.path).query)
        return qs.get("tok", [""])[0] or qs.get("token", [""])[0]

    def auth_check(self):
        """Return True if authenticated, else send 401 JSON and return False."""
        if validate_session(self.get_token(), self.get_client_ip()):
            return True
        self.send_json({"error": "Unauthorized", "auth": False}, 401)
        return False

    def serve_login(self):
        """Serve the login page."""
        path = os.path.join(BASE_DIR, "login.html")
        if not os.path.isfile(path):
            self.send_response(200)
            self.send_header("Content-Type", "text/html; charset=utf-8")
            self.send_header("Cache-Control", "no-cache")
            self.end_headers()
            self.wfile.write(b"<h1>Login page missing</h1>"); return
        with open(path, "rb") as f:
            body = f.read()
        self.send_response(200)
        self.send_header("Content-Type", "text/html; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", "no-cache, no-store, must-revalidate")
        self.end_headers()
        try: self.wfile.write(body); self.wfile.flush()
        except: pass

    def log_message(self, fmt, *args):
        C="\033[96m"; G="\033[92m"; Y="\033[93m"; R="\033[0m"; DIM="\033[2m"
        status = args[1] if len(args) > 1 else "?"
        sc = G if status.startswith("2") else Y if status.startswith("3") else "\033[91m"
        print(f"  {DIM}{C}{self.address_string():<16}{R}  {sc}{args[0]}{R}")

    def send_json(self, data, status=200):
        body = json.dumps(data, ensure_ascii=False).encode()
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Access-Control-Allow-Origin", "*")
        self.end_headers()
        try: self.wfile.write(body); self.wfile.flush()
        except: pass

    def do_OPTIONS(self):
        self.send_response(200)
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET,POST,DELETE,PATCH")
        self.send_header("Access-Control-Allow-Headers", "Content-Type,X-Filename,X-New-Name")
        self.end_headers()

    def serve_static(self, filename, mime):
        path = os.path.join(BASE_DIR, filename)
        if not os.path.isfile(path):
            self.send_json({"error": "Not found"}, 404); return
        with open(path, "rb") as f:
            body = f.read()
        self.send_response(200)
        self.send_header("Content-Type", mime)
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", "no-cache")
        self.end_headers()
        try:
            for i in range(0, len(body), 8192):
                self.wfile.write(body[i:i+8192])
            self.wfile.flush()
        except: pass

    def do_GET(self):
        parsed = urlparse(self.path)
        p = unquote(parsed.path)

        # ── Login page — always public ────────────────────────────────────────
        if p == "/login" or p == "/login.html":
            self.serve_login(); return

        # ── Static assets for login page — always public ──────────────────────
        if p in ("/app.css", "/login.css"):
            self.serve_static("app.css", "text/css; charset=utf-8"); return

        # ── Auth check for all other routes ───────────────────────────────────
        token = self.get_token()
        ip = self.get_client_ip()
        if not validate_session(token, ip):
            # Browser page request with no valid session → serve login page
            if not p.startswith("/api/") and p not in ("/app.js",):
                self.serve_login(); return
            # API or JS requests without auth → 401
            self.send_json({"error": "Unauthorized", "auth": False}, 401); return

        # ── Static files (authenticated) ──────────────────────────────────────
        if p == "/" or p == "/index.html":
            self.serve_static("index.html", "text/html; charset=utf-8"); return
        if p == "/app.js":
            self.serve_static("app.js", "application/javascript; charset=utf-8"); return

        # ── API ───────────────────────────────────────────────────────────────
        if p.startswith("/api/myip"):
            self.send_json({"ip": self.get_client_ip()})
            return

        if p.startswith("/api/info"):
            disk = {"total":0,"used":0,"free":0}
            try:
                import shutil as _sh
                du = _sh.disk_usage(ROOT)
                disk = {"total": du.total, "used": du.used, "free": du.free}
            except: pass
            self.send_json({"hostname": socket.gethostname(), "ip": get_ip(),
                            "port": PORT, "drive": CURRENT_DRIVE, "root": ROOT, "disk": disk})
            return

        if p.startswith("/api/drives"):
            self.send_json({"drives": get_drives()})
            return

        if p.startswith("/api/files"):
            rel = parse_qs(parsed.query).get("path", [""])[0]
            full = safe_path(rel)
            if full is None:
                self.send_json({"error": "Access denied"}, 403); return
            try:
                items = []
                for name in sorted(os.listdir(full)):
                    fp = os.path.join(full, name)
                    try:
                        st = os.stat(fp); isd = os.path.isdir(fp)
                        items.append({"name": name, "is_dir": isd,
                                      "size": 0 if isd else st.st_size,
                                      "modified": st.st_mtime})
                    except: pass
                self.send_json({"path": rel, "items": items})
            except Exception as e:
                self.send_json({"error": str(e)}, 500)
            return

        if p.startswith("/api/thumb"):
            rel = parse_qs(parsed.query).get("path", [""])[0]
            full = safe_path(rel)
            if full is None or not os.path.isfile(full):
                self.send_json({"error": "Not found"}, 404); return
            ext = full.rsplit(".", 1)[-1].lower()
            if ext not in ["jpg","jpeg","png","gif","webp","bmp"]:
                self.send_json({"error": "Not an image"}, 400); return
            try:
                from PIL import Image
                import io as _io
                img = Image.open(full); img.thumbnail((300, 300))
                buf = _io.BytesIO()
                img.convert("RGB").save(buf, format="JPEG", quality=70, optimize=True)
                body = buf.getvalue()
                self.send_response(200)
                self.send_header("Content-Type", "image/jpeg")
                self.send_header("Content-Length", str(len(body)))
                self.send_header("Cache-Control", "max-age=86400")
                self.send_header("Access-Control-Allow-Origin", "*")
                self.end_headers()
                try: self.wfile.write(body); self.wfile.flush()
                except: pass
            except ImportError:
                mime = get_mime(full)
                self.send_response(200)
                self.send_header("Content-Type", mime)
                self.send_header("Content-Length", str(os.path.getsize(full)))
                self.send_header("Cache-Control", "max-age=86400")
                self.send_header("Access-Control-Allow-Origin", "*")
                self.end_headers()
                try:
                    with open(full, "rb") as f: shutil.copyfileobj(f, self.wfile, 65536)
                    self.wfile.flush()
                except: pass
            except Exception as e:
                self.send_json({"error": str(e)}, 500)
            return

        if p.startswith("/api/view"):
            rel = parse_qs(parsed.query).get("path", [""])[0]
            full = safe_path(rel)
            if full is None or not os.path.isfile(full):
                self.send_json({"error": "Not found"}, 404); return
            mime = get_mime(full)
            size = os.path.getsize(full)
            rh = self.headers.get("Range")
            # Firefox REQUIRES Accept-Ranges on EVERY response (200 and 206)
            # and sends "Range: bytes=0-" on the very first request for video.
            # We cap chunk size so Firefox doesn't time out waiting for huge files.
            # 2 MB is enough for metadata + first frame (used by thumbnail generator).
            # Explicit range requests with end byte (seeking) get up to 8 MB.
            MAX_CHUNK = 8 * 1024 * 1024  # 8 MB default
            if rh:
                try:
                    _rng = rh.strip().replace("bytes=", "").split("-")
                    if _rng[0] == "0" and (len(_rng) < 2 or not _rng[1]):
                        MAX_CHUNK = 2 * 1024 * 1024  # bytes=0- → metadata probe, cap at 2 MB
                except: pass
            try:
                if rh:
                    start, end = 0, size - 1
                    try:
                        rng = rh.strip().replace("bytes=", "").split("-")
                        if rng[0]: start = int(rng[0])
                        if len(rng) > 1 and rng[1]: end = int(rng[1])
                    except: pass
                    # Cap end so we never send more than MAX_CHUNK per request
                    end = min(end, size - 1, start + MAX_CHUNK - 1)
                    length = end - start + 1
                    self.send_response(206)
                    self.send_header("Content-Type", mime)
                    self.send_header("Content-Range", f"bytes {start}-{end}/{size}")
                    self.send_header("Content-Length", str(length))
                    self.send_header("Accept-Ranges", "bytes")
                    self.send_header("Access-Control-Allow-Origin", "*")
                    self.send_header("Cache-Control", "no-cache")
                    self.end_headers()
                    with open(full, "rb") as f:
                        f.seek(start)
                        rem = length
                        while rem > 0:
                            chunk = f.read(min(65536, rem))
                            if not chunk: break
                            try: self.wfile.write(chunk)
                            except: return
                            rem -= len(chunk)
                else:
                    # No Range header — send full file but always advertise Accept-Ranges
                    self.send_response(200)
                    self.send_header("Content-Type", mime)
                    self.send_header("Content-Length", str(size))
                    self.send_header("Accept-Ranges", "bytes")
                    self.send_header("Access-Control-Allow-Origin", "*")
                    self.send_header("Cache-Control", "no-cache")
                    self.end_headers()
                    with open(full, "rb") as f:
                        while True:
                            chunk = f.read(65536)
                            if not chunk: break
                            try: self.wfile.write(chunk)
                            except: return
                try: self.wfile.flush()
                except: pass
            except: pass
            return

        if p.startswith("/api/download"):
            rel = parse_qs(parsed.query).get("path", [""])[0]
            full = safe_path(rel)
            if full is None:
                self.send_json({"error": "Not found"}, 404); return
            # Single file — progressive with Range support
            if os.path.isfile(full):
                mime = get_mime(full)
                size = os.path.getsize(full)
                fname = os.path.basename(full)
                rh = self.headers.get("Range")
                try:
                    if rh:
                        start, end = 0, size - 1
                        rng = rh.replace("bytes=", "").split("-")
                        if rng[0]: start = int(rng[0])
                        if len(rng) > 1 and rng[1]: end = int(rng[1])
                        end = min(end, size - 1); length = end - start + 1
                        self.send_response(206)
                        self.send_header("Content-Type", mime)
                        self.send_header("Content-Range", f"bytes {start}-{end}/{size}")
                        self.send_header("Content-Length", str(length))
                        self.send_header("Accept-Ranges", "bytes")
                        self.send_header("Content-Disposition", f'attachment; filename="{fname}"')
                        self.send_header("Access-Control-Allow-Origin", "*")
                        self.end_headers()
                        with open(full, "rb") as f:
                            f.seek(start); rem = length
                            while rem > 0:
                                chunk = f.read(min(65536, rem))
                                if not chunk: break
                                try: self.wfile.write(chunk)
                                except: return
                                rem -= len(chunk)
                    else:
                        self.send_response(200)
                        self.send_header("Content-Type", mime)
                        self.send_header("Content-Length", str(size))
                        self.send_header("Accept-Ranges", "bytes")
                        self.send_header("Content-Disposition", f'attachment; filename="{fname}"')
                        self.send_header("Access-Control-Allow-Origin", "*")
                        self.end_headers()
                        with open(full, "rb") as f:
                            while True:
                                chunk = f.read(65536)
                                if not chunk: break
                                try: self.wfile.write(chunk)
                                except: return
                    try: self.wfile.flush()
                    except: pass
                except: pass
            # Folder → zip on the fly
            elif os.path.isdir(full):
                folder_name = os.path.basename(full) or "folder"
                buf = io.BytesIO()
                with zipfile.ZipFile(buf, "w", zipfile.ZIP_DEFLATED) as zf:
                    for root_dir, dirs, files in os.walk(full):
                        for file in files:
                            fp = os.path.join(root_dir, file)
                            arcname = os.path.relpath(fp, os.path.dirname(full))
                            try: zf.write(fp, arcname)
                            except: pass
                zip_bytes = buf.getvalue()
                self.send_response(200)
                self.send_header("Content-Type", "application/zip")
                self.send_header("Content-Length", str(len(zip_bytes)))
                self.send_header("Content-Disposition", f'attachment; filename="{folder_name}.zip"')
                self.send_header("Access-Control-Allow-Origin", "*")
                self.end_headers()
                try: self.wfile.write(zip_bytes); self.wfile.flush()
                except: pass
            else:
                self.send_json({"error": "Not found"}, 404)
            return

        self.send_json({"error": "Not found"}, 404)

    def do_POST(self):
        parsed = urlparse(self.path)
        p = unquote(parsed.path)

        # ── Login — public endpoint ───────────────────────────────────────────
        if p.startswith("/api/login"):
            try:
                body = self.rfile.read(int(self.headers.get("Content-Length", 0)))
                data = json.loads(body.decode())
                username = data.get("username", "").strip()
                password = data.get("password", "")
                remember = bool(data.get("remember", False))
                ip = self.get_client_ip()
                if username == AUTH_USER and hash_password(password) == AUTH_HASH:
                    token = create_session(ip, remember)
                    Y="\033[93m"; G="\033[92m"; R="\033[0m"; DIM="\033[2m"; C="\033[96m"
                    print(f"  {G}✓ Login:{R} {C}{username}{R} {DIM}from {ip}{R}")
                    # Send response with Set-Cookie so browser page navigations work
                    resp = json.dumps({"success": True, "token": token}, ensure_ascii=False).encode()
                    cookie = f"leo_session={token}; Path=/; HttpOnly; SameSite=Strict"
                    self.send_response(200)
                    self.send_header("Content-Type", "application/json")
                    self.send_header("Content-Length", str(len(resp)))
                    self.send_header("Set-Cookie", cookie)
                    self.send_header("Access-Control-Allow-Origin", "*")
                    self.end_headers()
                    try: self.wfile.write(resp); self.wfile.flush()
                    except: pass
                else:
                    print(f"  \033[91m✗ Failed login from {ip}\033[0m")
                    self.send_json({"error": "Invalid username or password"}, 401)
            except Exception as e:
                self.send_json({"error": str(e)}, 500)
            return

        # ── Logout — clears session + cookie ─────────────────────────────────
        if p.startswith("/api/logout"):
            token = self.get_token()
            revoke_session(token)
            # Expire the cookie
            resp = json.dumps({"success": True}).encode()
            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self.send_header("Content-Length", str(len(resp)))
            self.send_header("Set-Cookie", "leo_session=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0")
            self.send_header("Access-Control-Allow-Origin", "*")
            self.end_headers()
            try: self.wfile.write(resp); self.wfile.flush()
            except: pass
            return

        # ── All other POST endpoints require auth ─────────────────────────────
        if not self.auth_check(): return

        if p.startswith("/api/upload"):
            rel = parse_qs(parsed.query).get("path", [""])[0]
            full_dir = safe_path(rel)
            if full_dir is None:
                self.send_json({"error": "Access denied"}, 403); return
            clen = int(self.headers.get("Content-Length", 0))
            fname = unquote(self.headers.get("X-Filename", "upload.bin"))
            dest_path = os.path.normpath(os.path.join(full_dir, fname.replace("/", os.sep).replace("\\", os.sep)))
            if not (dest_path == ROOT or dest_path.startswith(ROOT_PREFIX)):
                self.send_json({"error": "Access denied"}, 403); return
            try:
                os.makedirs(os.path.dirname(dest_path), exist_ok=True)
                with open(dest_path, "wb") as f:
                    rem = clen
                    while rem > 0:
                        chunk = self.rfile.read(min(65536, rem))
                        if not chunk: break
                        f.write(chunk); rem -= len(chunk)
                self.send_json({"success": True, "file": fname})
            except Exception as e:
                self.send_json({"error": str(e)}, 500)
            return

        if p.startswith("/api/zip"):
            # ── Streaming ZIP: compress in background thread, stream to browser ──
            try:
                body = self.rfile.read(int(self.headers.get("Content-Length", 0)))
                data = json.loads(body.decode())
                items = data.get("items", [])
                zip_name = data.get("name", "download") + ".zip"

                # Validate all paths first
                valid = []
                for rel in items:
                    full = safe_path(rel)
                    if full and os.path.exists(full):
                        valid.append((rel, full))

                if not valid:
                    self.send_json({"error": "No valid items"}, 400); return

                # Build zip in memory so we know the exact size → Content-Length header
                # This lets the browser show real download progress (e.lengthComputable = true)
                buf = io.BytesIO()
                with zipfile.ZipFile(buf, "w", zipfile.ZIP_DEFLATED) as zf:
                    for rel, full in valid:
                        if os.path.isfile(full):
                            arcname = os.path.basename(full)
                            try: zf.write(full, arcname)
                            except: pass
                        elif os.path.isdir(full):
                            base = os.path.basename(full)
                            for root_dir, dirs, files in os.walk(full):
                                for file in files:
                                    fp = os.path.join(root_dir, file)
                                    arcname = os.path.join(base, os.path.relpath(fp, full))
                                    try: zf.write(fp, arcname)
                                    except: pass
                zip_bytes = buf.getvalue()

                self.send_response(200)
                self.send_header("Content-Type", "application/zip")
                self.send_header("Content-Disposition", f'attachment; filename="{zip_name}"')
                self.send_header("Content-Length", str(len(zip_bytes)))
                self.send_header("Access-Control-Allow-Origin", "*")
                self.send_header("Cache-Control", "no-cache")
                self.end_headers()

                # Stream to client in chunks
                try:
                    for i in range(0, len(zip_bytes), 65536):
                        self.wfile.write(zip_bytes[i:i+65536])
                    self.wfile.flush()
                except: pass

            except Exception as e:
                try: self.send_json({"error": str(e)}, 500)
                except: pass
            return

        if p.startswith("/api/mkdir"):
            rel = parse_qs(parsed.query).get("path", [""])[0]
            full = safe_path(rel)
            if full is None:
                self.send_json({"error": "Access denied"}, 403); return
            try: os.makedirs(full, exist_ok=True); self.send_json({"success": True})
            except Exception as e: self.send_json({"error": str(e)}, 500)
            return

        if p.startswith("/api/move"):
            try:
                body = self.rfile.read(int(self.headers.get("Content-Length", 0)))
                data = json.loads(body.decode())
                items = data.get("items", []); dest_rel = data.get("dest", "")
                dest_full = safe_path(dest_rel)
                if not dest_full or not os.path.isdir(dest_full):
                    self.send_json({"error": "Invalid destination"}, 400); return
                moved, errors = 0, []
                for rel in items:
                    src = safe_path(rel)
                    if not src or not os.path.exists(src):
                        errors.append(rel); continue
                    dst = os.path.join(dest_full, os.path.basename(src))
                    try: shutil.move(src, dst); moved += 1
                    except Exception as e: errors.append(str(e))
                self.send_json({"success": True, "moved": moved, "errors": errors})
            except Exception as e:
                self.send_json({"error": str(e)}, 500)
            return

        if p.startswith("/api/delete_bulk"):
            try:
                body = self.rfile.read(int(self.headers.get("Content-Length", 0)))
                data = json.loads(body.decode())
                items = data.get("items", [])
                deleted, errors = 0, []
                for rel in items:
                    full = safe_path(rel)
                    if not full:
                        errors.append(rel); continue
                    try:
                        if os.path.isfile(full): os.remove(full)
                        elif os.path.isdir(full): shutil.rmtree(full)
                        deleted += 1
                    except Exception as e: errors.append(str(e))
                self.send_json({"success": True, "deleted": deleted, "errors": errors})
            except Exception as e:
                self.send_json({"error": str(e)}, 500)
            return

        if p.startswith("/api/setdrive"):
            try:
                body = self.rfile.read(int(self.headers.get("Content-Length", 0)))
                data = json.loads(body.decode())
                drive = data.get("drive", "").strip()
                if not drive:
                    self.send_json({"error": "No drive specified"}, 400); return
                drive_path = drive.rstrip("/\\") + "\\"
                if not os.path.exists(drive_path):
                    self.send_json({"error": f"Drive {drive} not found"}, 404); return
                set_root(drive)
                disk = {"total":0,"used":0,"free":0}
                try:
                    du = shutil.disk_usage(ROOT)
                    disk = {"total": du.total, "used": du.used, "free": du.free}
                except: pass
                self.send_json({"success": True, "drive": CURRENT_DRIVE, "disk": disk})
            except Exception as e:
                self.send_json({"error": str(e)}, 500)
            return

        self.send_json({"error": "Not found"}, 404)

    def do_PATCH(self):
        parsed = urlparse(self.path)
        p = unquote(parsed.path)
        if not self.auth_check(): return
        if p.startswith("/api/rename"):
            rel = parse_qs(parsed.query).get("path", [""])[0]
            new_name = unquote(self.headers.get("X-New-Name", ""))
            full = safe_path(rel)
            if full is None or not new_name:
                self.send_json({"error": "Invalid"}, 400); return
            new_full = os.path.join(os.path.dirname(full), new_name)
            try: os.rename(full, new_full); self.send_json({"success": True})
            except Exception as e: self.send_json({"error": str(e)}, 500)
            return
        self.send_json({"error": "Not found"}, 404)

    def do_DELETE(self):
        parsed = urlparse(self.path)
        p = unquote(parsed.path)
        if not self.auth_check(): return
        if p.startswith("/api/delete"):
            rel = parse_qs(parsed.query).get("path", [""])[0]
            full = safe_path(rel)
            if full is None:
                self.send_json({"error": "Access denied"}, 403); return
            try:
                if os.path.isfile(full): os.remove(full)
                elif os.path.isdir(full): shutil.rmtree(full)
                self.send_json({"success": True})
            except Exception as e: self.send_json({"error": str(e)}, 500)
            return
        self.send_json({"error": "Not found"}, 404)


class ThreadedHTTPServer(ThreadingMixIn, HTTPServer):
    """Handles each request in a separate thread — allows concurrent downloads + streaming"""
    daemon_threads = True


def get_ip():
    try:
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        s.connect(("8.8.8.8", 80)); ip = s.getsockname()[0]; s.close(); return ip
    except: return "127.0.0.1"


if __name__ == "__main__":
    if sys.platform == "win32":
        os.system("color")
        try:
            import ctypes
            ctypes.windll.kernel32.SetConsoleMode(ctypes.windll.kernel32.GetStdHandle(-11), 7)
        except: pass
    setup_credentials()
    banner()
    server = ThreadedHTTPServer(("0.0.0.0", PORT), LeoHandler)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        Y="\033[93m"; R="\033[0m"; B="\033[1m"
        print(f"\n\n  {Y}{B}◆ Project Leo — Bye! 🦁{R}\n")