#!/usr/bin/env python3
"""Ashveil game server: serves the game and keeps cloud saves.

Run from the game folder (Python 3.8+, nothing to install):

    python3 server.py                  # http://0.0.0.0:6767
    python3 server.py --port 8000 --data ~/ashveil-saves

The game files are served as-is (no build step). Cloud saves are stored as one
JSON file per account in the data folder, which is kept OUTSIDE the game folder
so `git pull` never touches it and it is never served to browsers.
Default data folder: ~/.local/share/ashveil  (or set ASHVEIL_DATA).

API (all JSON):
  GET  /api/ping                      -> {"ok": true, "app": "ashveil"}
  POST /api/register {name, password} -> {"name", "token"}   create an account
  POST /api/login    {name, password} -> {"name", "token"}
  POST /api/logout   (token)          -> {"ok": true}
  GET  /api/save     (token)          -> {"rev", "updatedAt", "save"}
  PUT  /api/save     (token) {baseRev, save, force?} -> {"rev", "updatedAt"} or 409 if another device saved first
The token goes in the header "Authorization: Bearer <token>".
"""
import argparse
import hashlib
import hmac
import json
import os
import re
import secrets
import sys
import tempfile
import threading
import time
from http import HTTPStatus
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import urlsplit, unquote

ROOT = Path(__file__).resolve().parent
NAME_RE = re.compile(r"^[A-Za-z0-9_-]{2,20}$")
MAX_BODY = 1024 * 1024  # a save is normally well under 100 KB
MAX_TOKENS = 8  # signed-in devices per account
PBKDF2_ROUNDS = 200_000
MAX_ACCOUNTS = 500

lock = threading.Lock()
fails = {}  # name -> [count, first_fail_time]
creations = {}  # ip -> [timestamps]


def now_ms():
    return int(time.time() * 1000)


def hash_pw(password, salt):
    return hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), salt, PBKDF2_ROUNDS).hex()


def token_hash(token):
    return hashlib.sha256(token.encode("utf-8")).hexdigest()


class Store:
    """One JSON file per account: <data>/users/<name in lower case>.json"""

    def __init__(self, root):
        self.dir = Path(root).expanduser().resolve() / "users"
        self.dir.mkdir(parents=True, exist_ok=True)
        try:
            os.chmod(self.dir, 0o700)
        except OSError:
            pass
        if self.dir == ROOT or ROOT in self.dir.parents:
            print("warning: the save folder is inside the game folder; move it with --data", file=sys.stderr)

    def path(self, name):
        return self.dir / (name.lower() + ".json")

    def load(self, name):
        try:
            with open(self.path(name), "r", encoding="utf-8") as f:
                return json.load(f)
        except FileNotFoundError:
            return None

    def write(self, user):
        p = self.path(user["name"])
        fd, tmp = tempfile.mkstemp(dir=self.dir, prefix=".tmp-")
        try:
            with os.fdopen(fd, "w", encoding="utf-8") as f:
                json.dump(user, f, separators=(",", ":"))
            os.replace(tmp, p)  # atomic: a crash never leaves half a save
        except BaseException:
            try:
                os.unlink(tmp)
            except OSError:
                pass
            raise

    def count(self):
        return sum(1 for _ in self.dir.glob("*.json"))

    def by_token(self, token):
        """Find the account a token belongs to. Tokens look like '<name>.<random>'."""
        if not token or "." not in token:
            return None
        name = token.split(".", 1)[0]
        if not NAME_RE.match(name):
            return None
        user = self.load(name)
        if not user:
            return None
        th = token_hash(token)
        for t in user.get("tokens", []):
            if hmac.compare_digest(t["h"], th):
                return user
        return None


class Handler(SimpleHTTPRequestHandler):
    server_version = "Ashveil"
    store = None

    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(ROOT), **kwargs)

    def client_ip(self):
        """The visitor's address. Behind a reverse proxy on this machine (nginx, Caddy, a Cloudflare
        or Tailscale tunnel) every request comes from 127.0.0.1, so trust the address the proxy passes on."""
        peer = self.client_address[0]
        if peer in ("127.0.0.1", "::1") or peer.startswith("::ffff:127."):
            for h in ("CF-Connecting-IP", "X-Real-IP"):
                v = self.headers.get(h, "").strip()
                if v:
                    return v[:64]
            xff = self.headers.get("X-Forwarded-For", "")
            if xff.strip():
                return xff.split(",")[-1].strip()[:64]  # the entry our own proxy added
        return peer

    # ---------------------------------------------------------------- static files
    def send_head(self):
        path = unquote(urlsplit(self.path).path)
        parts = [p for p in path.split("/") if p]
        # never serve hidden files (.git, ...) or the server itself
        if any(p.startswith(".") for p in parts) or (parts and parts[0] == "server.py"):
            self.send_error(HTTPStatus.NOT_FOUND)
            return None
        return super().send_head()

    def end_headers(self):
        if not self.path.startswith("/api/"):
            # let the browser re-check files so a `git pull` shows up on the next reload
            self.send_header("Cache-Control", "no-cache")
        self.send_header("X-Content-Type-Options", "nosniff")
        super().end_headers()

    def log_message(self, fmt, *args):
        # keep the log short: API calls and errors only
        msg = fmt % args
        if self.path.startswith("/api/") or " 4" in msg or " 5" in msg:
            sys.stderr.write("%s %s %s\n" % (time.strftime("%Y-%m-%d %H:%M:%S"), self.client_ip(), msg))

    # ---------------------------------------------------------------- API plumbing
    def do_GET(self):
        if self.path.startswith("/api/"):
            return self.api("GET")
        return super().do_GET()

    def do_HEAD(self):
        if self.path.startswith("/api/"):
            return self.reply(405, {"error": "Method not allowed"})
        return super().do_HEAD()

    def do_POST(self):
        return self.api("POST")

    def do_PUT(self):
        return self.api("PUT")

    def reply(self, code, data):
        body = json.dumps(data).encode("utf-8")
        self.send_response(code)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        self.wfile.write(body)

    def body(self):
        try:
            n = int(self.headers.get("Content-Length", "0"))
        except ValueError:
            n = -1
        if n < 0 or n > MAX_BODY:
            return None
        raw = self.rfile.read(n) if n else b"{}"
        try:
            data = json.loads(raw.decode("utf-8"))
        except (ValueError, UnicodeDecodeError):
            return None
        return data if isinstance(data, dict) else None

    def token(self):
        h = self.headers.get("Authorization", "")
        return h[7:].strip() if h.startswith("Bearer ") else ""

    def api(self, method):
        route = urlsplit(self.path).path[len("/api/"):]
        if not route.startswith(("ping", "register", "login", "logout", "save")):
            return self.reply(404, {"error": "Unknown request"})
        try:
            if route == "ping" and method == "GET":
                return self.reply(200, {"ok": True, "app": "ashveil", "version": 1})
            data = {} if method == "GET" else self.body()
            if data is None:
                return self.reply(400, {"error": "Bad request"})
            if route in ("register", "login") and method == "POST":
                return self.sign_in(data, route == "register")
            with lock:
                user = self.store.by_token(self.token())
                if not user:
                    return self.reply(401, {"error": "Please sign in again"})
                if route == "logout" and method == "POST":
                    th = token_hash(self.token())
                    user["tokens"] = [t for t in user.get("tokens", []) if t["h"] != th]
                    self.store.write(user)
                    return self.reply(200, {"ok": True})
                if route == "save" and method == "GET":
                    return self.reply(200, {"rev": user.get("rev", 0), "updatedAt": user.get("updatedAt", 0), "save": user.get("save")})
                if route == "save" and method == "PUT":
                    save = data.get("save")
                    if not isinstance(save, dict) or save.get("v") != 1 or not isinstance(save.get("heroes"), dict):
                        return self.reply(400, {"error": "That is not an Ashveil save"})
                    rev = user.get("rev", 0)
                    if not data.get("force") and data.get("baseRev") != rev:
                        return self.reply(409, {"error": "Another device saved first", "rev": rev, "updatedAt": user.get("updatedAt", 0)})
                    user["save"] = save
                    user["rev"] = rev + 1
                    user["updatedAt"] = now_ms()
                    self.store.write(user)
                    return self.reply(200, {"rev": user["rev"], "updatedAt": user["updatedAt"]})
            return self.reply(405, {"error": "Method not allowed"})
        except Exception as e:  # keep the server up whatever happens
            sys.stderr.write("error: %r\n" % (e,))
            return self.reply(500, {"error": "Server error"})

    def sign_in(self, data, create):
        name = str(data.get("name", "")).strip()
        password = str(data.get("password", ""))
        if not NAME_RE.match(name):
            return self.reply(400, {"error": "Name: 2-20 letters, numbers, - or _"})
        if not 4 <= len(password) <= 64:
            return self.reply(400, {"error": "Password: 4 to 64 characters"})
        key = name.lower()
        t = time.time()
        with lock:
            f = fails.get(key)
            if f and f[0] >= 5 and t - f[1] < 600:
                return self.reply(429, {"error": "Too many wrong passwords. Try again in 10 minutes."})
            user = self.store.load(key)
            if create:
                if user:
                    return self.reply(409, {"error": "That name is taken. Sign in instead, or pick another name."})
                ip = self.client_ip()
                recent = [x for x in creations.get(ip, []) if t - x < 3600]
                if len(recent) >= 10 or self.store.count() >= MAX_ACCOUNTS:
                    return self.reply(429, {"error": "Too many new accounts. Try again later."})
                creations[ip] = recent + [t]
                salt = secrets.token_bytes(16)
                user = {"name": key, "display": name, "salt": salt.hex(), "pw": hash_pw(password, salt),
                        "tokens": [], "rev": 0, "updatedAt": 0, "save": None, "created": now_ms()}
            else:
                if not user or not hmac.compare_digest(user["pw"], hash_pw(password, bytes.fromhex(user["salt"]))):
                    if not f or t - f[1] >= 600:
                        f = [0, t]
                    f[0] += 1
                    fails[key] = f
                    return self.reply(401, {"error": "Wrong name or password"})
                fails.pop(key, None)
            token = key + "." + secrets.token_urlsafe(24)
            user["tokens"] = (user.get("tokens", []) + [{"h": token_hash(token), "t": now_ms()}])[-MAX_TOKENS:]
            self.store.write(user)
        return self.reply(200, {"name": user.get("display", key), "token": token})


def main():
    ap = argparse.ArgumentParser(description="Serve Ashveil with cloud saves.")
    ap.add_argument("--host", default=os.environ.get("ASHVEIL_HOST", "0.0.0.0"))
    ap.add_argument("--port", type=int, default=int(os.environ.get("ASHVEIL_PORT", "6767")))
    ap.add_argument("--data", default=os.environ.get("ASHVEIL_DATA", "~/.local/share/ashveil"),
                    help="folder for cloud saves (kept outside the game folder)")
    args = ap.parse_args()
    Handler.store = Store(args.data)
    Handler.extensions_map = dict(SimpleHTTPRequestHandler.extensions_map, **{
        ".js": "text/javascript", ".mjs": "text/javascript", ".json": "application/json",
        ".webmanifest": "application/manifest+json", ".css": "text/css", ".png": "image/png",
    })
    httpd = ThreadingHTTPServer((args.host, args.port), Handler)
    httpd.daemon_threads = True
    print("Ashveil on http://%s:%d  (saves in %s)" % (args.host, args.port, Handler.store.dir.parent), flush=True)
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        pass


if __name__ == "__main__":
    main()
