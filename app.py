#!/usr/bin/env python3
"""
FESTIVAL'S LIFE v3 — Lokalny serwer dashboardu koncertowego
Uruchom: python app.py (lub dwuklik na start_windows.bat / start_mac.command)
Brak wymaganych zewnętrznych bibliotek — działa na czystym Pythonie 3!
"""

import argparse
import base64
import datetime
import json
import mimetypes
import os
import re
import shutil
import socket
import threading
import urllib.parse
import uuid
import webbrowser
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DATA_FILE = os.path.join(BASE_DIR, "concerts_data.json")
UPCOMING_FILE = os.path.join(BASE_DIR, "upcoming_data.json")
EVENTS_META_FILE = os.path.join(BASE_DIR, "events_meta.json")
SETTINGS_FILE = os.path.join(BASE_DIR, "settings.json")
COORDS_FILE = os.path.join(BASE_DIR, "coords_cache.json")
HTML_FILE = os.path.join(BASE_DIR, "index.html")
UPLOAD_DIR = os.path.join(BASE_DIR, "uploads")
BACKUP_DIR = os.path.join(BASE_DIR, "backups")

DATA_LOCK = threading.Lock()

DEFAULT_SETTINGS = {
    "hometown": "Poznań",
    "hometown_coords": [52.4064, 16.9252],
}


def ensure_files():
    os.makedirs(UPLOAD_DIR, exist_ok=True)
    defaults = [
        (DATA_FILE, []),
        (UPCOMING_FILE, []),
        (EVENTS_META_FILE, {}),
        (SETTINGS_FILE, DEFAULT_SETTINGS),
        (COORDS_FILE, {}),
    ]
    for path, default_val in defaults:
        if not os.path.exists(path):
            _write_json_atomic(path, default_val)


def _write_json_atomic(path, payload):
    tmp_path = path + ".tmp"
    with open(tmp_path, "w", encoding="utf-8") as f:
        json.dump(payload, f, ensure_ascii=False, indent=2)
    os.replace(tmp_path, path)


def _read_json(path, default_val):
    ensure_files()
    try:
        with open(path, "r", encoding="utf-8") as f:
            return json.load(f)
    except Exception:
        return default_val


def create_backup():
    if not os.path.exists(DATA_FILE):
        return
    os.makedirs(BACKUP_DIR, exist_ok=True)
    ts = datetime.datetime.now().strftime("%Y%m%d_%H%M%S")
    dst = os.path.join(BACKUP_DIR, f"concerts_backup_{ts}.json")
    shutil.copy2(DATA_FILE, dst)
    backups = sorted(
        [os.path.join(BACKUP_DIR, name) for name in os.listdir(BACKUP_DIR) if name.endswith(".json")]
    )
    for old in backups[:-25]:
        try:
            os.remove(old)
        except OSError:
            pass


def load_concerts():
    with DATA_LOCK:
        data = _read_json(DATA_FILE, [])
        changed = False
        max_id = max((int(r.get("id", 0)) for r in data if isinstance(r.get("id"), int)), default=0)
        for r in data:
            if not isinstance(r.get("id"), int):
                max_id += 1
                r["id"] = max_id
                changed = True
        if changed:
            _write_json_atomic(DATA_FILE, data)
        return data


def save_concerts(data, backup=False):
    with DATA_LOCK:
        if backup:
            create_backup()
        _write_json_atomic(DATA_FILE, data)


def load_upcoming():
    with DATA_LOCK:
        return _read_json(UPCOMING_FILE, [])


def save_upcoming(data):
    with DATA_LOCK:
        _write_json_atomic(UPCOMING_FILE, data)


def load_events_meta():
    with DATA_LOCK:
        return _read_json(EVENTS_META_FILE, {})


def save_events_meta(meta):
    with DATA_LOCK:
        _write_json_atomic(EVENTS_META_FILE, meta)


def load_settings():
    with DATA_LOCK:
        data = _read_json(SETTINGS_FILE, DEFAULT_SETTINGS)
        if not isinstance(data, dict):
            return dict(DEFAULT_SETTINGS)
        return {**DEFAULT_SETTINGS, **data}


def save_settings(settings):
    with DATA_LOCK:
        _write_json_atomic(SETTINGS_FILE, settings)


def load_coords():
    with DATA_LOCK:
        return _read_json(COORDS_FILE, {})


def save_coords(coords_map):
    with DATA_LOCK:
        _write_json_atomic(COORDS_FILE, coords_map)


class FestivalHandler(BaseHTTPRequestHandler):
    def log_message(self, format, *args):
        ts = datetime.datetime.now().strftime("%H:%M:%S")
        print(f"[{ts}] {self.address_string()} - {format % args}")

    def _send_json(self, obj, status=200):
        body = json.dumps(obj, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        self.wfile.write(body)

    def _send_file(self, path, content_type=None):
        if not os.path.exists(path) or not os.path.isfile(path):
            self.send_error(404, "File not found")
            return
        if not content_type:
            content_type, _ = mimetypes.guess_type(path)
            content_type = content_type or "application/octet-stream"
        with open(path, "rb") as f:
            content = f.read()
        self.send_response(200)
        self.send_header("Content-Type", content_type)
        self.send_header("Content-Length", str(len(content)))
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        self.wfile.write(content)

    def _read_json_body(self):
        length = int(self.headers.get("Content-Length", 0))
        if length <= 0:
            return None
        raw = self.rfile.read(length)
        return json.loads(raw.decode("utf-8"))

    def do_GET(self):
        parsed = urllib.parse.urlparse(self.path)
        path = parsed.path

        if path in ("/", "/index.html"):
            self._send_file(HTML_FILE, "text/html; charset=utf-8")
            return

        if path.startswith("/uploads/"):
            fname = os.path.basename(urllib.parse.unquote(path[len("/uploads/"):]))
            target = os.path.join(UPLOAD_DIR, fname)
            self._send_file(target)
            return

        if path == "/api/status":
            self._send_json({
                "ok": True,
                "mode": "local_python_v3",
                "count": len(load_concerts()),
                "upcoming_count": len(load_upcoming()),
            })
            return

        if path == "/api/bootstrap" or path == "/api/concerts":
            self._send_json({
                "concerts": load_concerts(),
                "upcoming": load_upcoming(),
                "events_meta": load_events_meta(),
                "settings": load_settings(),
                "coords": load_coords(),
            })
            return

        self.send_error(404, "Not found")

    def do_POST(self):
        parsed = urllib.parse.urlparse(self.path)
        path = parsed.path

        try:
            payload = self._read_json_body()
        except Exception as exc:
            self._send_json({"error": f"Invalid JSON: {exc}"}, status=400)
            return

        # --- CONCERTS ---
        if path == "/api/concerts":
            if not isinstance(payload, dict):
                self._send_json({"error": "Expected concert object"}, status=400)
                return
            concerts = load_concerts()
            next_id = max((int(c.get("id", 0)) for c in concerts), default=0) + 1
            payload["id"] = next_id
            concerts.append(payload)
            save_concerts(concerts, backup=False)
            self._send_json({"ok": True, "concert": payload, "count": len(concerts)}, status=201)
            return

        if path == "/api/concerts/bulk":
            if not isinstance(payload, list):
                self._send_json({"error": "Expected list of concerts"}, status=400)
                return
            cleaned = []
            for idx, item in enumerate(payload, start=1):
                if isinstance(item, dict):
                    item["id"] = idx
                    cleaned.append(item)
            save_concerts(cleaned, backup=True)
            self._send_json({"ok": True, "count": len(cleaned)})
            return

        # --- UPCOMING CONCERTS ---
        if path == "/api/upcoming":
            if not isinstance(payload, dict):
                self._send_json({"error": "Expected upcoming object"}, status=400)
                return
            items = load_upcoming()
            next_id = max((int(c.get("id", 0)) for c in items), default=0) + 1
            payload["id"] = next_id
            items.append(payload)
            save_upcoming(items)
            self._send_json({"ok": True, "item": payload}, status=201)
            return

        if path.startswith("/api/upcoming/") and path.endswith("/complete"):
            try:
                uid = int(path.split("/")[-2])
            except ValueError:
                self._send_json({"error": "Invalid id"}, status=400)
                return
            items = load_upcoming()
            target = next((x for x in items if int(x.get("id", -1)) == uid), None)
            if not target:
                self._send_json({"error": "Not found"}, status=404)
                return
            concerts = load_concerts()
            next_id = max((int(c.get("id", 0)) for c in concerts), default=0) + 1
            new_concert = {
                "id": next_id,
                "rok": target.get("rok"),
                "event": target.get("event", ""),
                "artysta": target.get("artysta", ""),
                "data": target.get("data", ""),
                "dzien": target.get("dzien", ""),
                "godzina": target.get("godzina", ""),
                "scena": target.get("scena", ""),
                "miejsce": target.get("miejsce", ""),
                "miasto": target.get("miasto", ""),
                "district": target.get("district", ""),
                "kraj": target.get("kraj", ""),
                "gatunek": target.get("gatunek", ""),
                "podgatunek": target.get("podgatunek", ""),
                "kto": target.get("kto", "Razem"),
                "z_kim": target.get("z_kim", ""),
                "uwagi": target.get("uwagi", ""),
                "ocena": target.get("ocena", 0),
                "cena": target.get("cena", ""),
            }
            concerts.append(new_concert)
            save_concerts(concerts, backup=False)
            save_upcoming([x for x in items if int(x.get("id", -1)) != uid])
            self._send_json({"ok": True, "concert": new_concert})
            return

        # --- EVENTS META (POSTERS, PHOTOS, LINEUPS) ---
        if path == "/api/events_meta":
            if not isinstance(payload, dict) or "key" not in payload or "meta" not in payload:
                self._send_json({"error": "Expected {key, meta}"}, status=400)
                return
            meta_all = load_events_meta()
            meta_all[str(payload["key"])] = payload["meta"]
            save_events_meta(meta_all)
            self._send_json({"ok": True})
            return

        # --- IMAGE UPLOAD (POSTERS & EVENT PHOTOS) ---
        if path == "/api/upload":
            if not isinstance(payload, dict) or "data_url" not in payload:
                self._send_json({"error": "Expected {filename, data_url}"}, status=400)
                return
            data_url = str(payload["data_url"])
            match = re.match(r"^data:image/([a-zA-Z0-9+.-]+);base64,(.+)$", data_url, re.DOTALL)
            if not match:
                self._send_json({"error": "Unsupported image format"}, status=400)
                return
            ext = match.group(1).lower().replace("jpeg", "jpg")
            if ext not in ("jpg", "png", "webp", "gif"):
                ext = "jpg"
            raw_bytes = base64.b64decode(match.group(2))
            prefix = re.sub(r"[^a-zA-Z0-9_-]+", "_", str(payload.get("prefix", "img")))[:28]
            fname = f"{prefix}_{uuid.uuid4().hex[:10]}.{ext}"
            os.makedirs(UPLOAD_DIR, exist_ok=True)
            with open(os.path.join(UPLOAD_DIR, fname), "wb") as f:
                f.write(raw_bytes)
            self._send_json({"ok": True, "url": f"/uploads/{fname}", "filename": fname}, status=201)
            return

        # --- SETTINGS (HOMETOWN) ---
        if path == "/api/settings":
            if not isinstance(payload, dict):
                self._send_json({"error": "Expected settings dict"}, status=400)
                return
            cur = load_settings()
            cur.update(payload)
            save_settings(cur)
            self._send_json({"ok": True, "settings": cur})
            return

        # --- COORDS CACHE ---
        if path == "/api/coords":
            if not isinstance(payload, dict) or "city" not in payload or "coords" not in payload:
                self._send_json({"error": "Expected {city, coords}"}, status=400)
                return
            coords = load_coords()
            coords[str(payload["city"]).strip()] = payload["coords"]
            save_coords(coords)
            self._send_json({"ok": True})
            return

        self.send_error(404, "Not found")

    def do_PUT(self):
        parsed = urllib.parse.urlparse(self.path)
        path = parsed.path

        try:
            payload = self._read_json_body()
        except Exception as exc:
            self._send_json({"error": str(exc)}, status=400)
            return

        if path.startswith("/api/concerts/"):
            try:
                cid = int(path.split("/")[-1])
            except ValueError:
                self._send_json({"error": "Invalid id"}, status=400)
                return
            concerts = load_concerts()
            for i, c in enumerate(concerts):
                if int(c.get("id", -1)) == cid:
                    payload["id"] = cid
                    concerts[i] = payload
                    save_concerts(concerts, backup=False)
                    self._send_json({"ok": True, "concert": payload})
                    return
            self._send_json({"error": "Concert not found"}, status=404)
            return

        if path.startswith("/api/upcoming/"):
            try:
                uid = int(path.split("/")[-1])
            except ValueError:
                self._send_json({"error": "Invalid id"}, status=400)
                return
            items = load_upcoming()
            for i, c in enumerate(items):
                if int(c.get("id", -1)) == uid:
                    payload["id"] = uid
                    items[i] = payload
                    save_upcoming(items)
                    self._send_json({"ok": True, "item": payload})
                    return
            self._send_json({"error": "Upcoming not found"}, status=404)
            return

        self.send_error(404, "Not found")

    def do_DELETE(self):
        parsed = urllib.parse.urlparse(self.path)
        path = parsed.path

        if path.startswith("/api/concerts/"):
            try:
                cid = int(path.split("/")[-1])
            except ValueError:
                self._send_json({"error": "Invalid id"}, status=400)
                return
            concerts = load_concerts()
            new_concerts = [c for c in concerts if int(c.get("id", -1)) != cid]
            if len(new_concerts) == len(concerts):
                self._send_json({"error": "Concert not found"}, status=404)
                return
            save_concerts(new_concerts, backup=True)
            self._send_json({"ok": True, "count": len(new_concerts)})
            return

        if path.startswith("/api/upcoming/"):
            try:
                uid = int(path.split("/")[-1])
            except ValueError:
                self._send_json({"error": "Invalid id"}, status=400)
                return
            items = load_upcoming()
            new_items = [c for c in items if int(c.get("id", -1)) != uid]
            save_upcoming(new_items)
            self._send_json({"ok": True, "count": len(new_items)})
            return

        if path.startswith("/api/upload/"):
            fname = os.path.basename(urllib.parse.unquote(path[len("/api/upload/"):]))
            target = os.path.join(UPLOAD_DIR, fname)
            if os.path.exists(target):
                try:
                    os.remove(target)
                except OSError:
                    pass
            self._send_json({"ok": True})
            return

        self.send_error(404, "Not found")


def find_free_port(preferred=5050):
    for port in range(preferred, preferred + 20):
        with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
            try:
                s.bind(("127.0.0.1", port))
                return port
            except OSError:
                continue
    return 0


def main():
    parser = argparse.ArgumentParser(description="FESTIVAL'S LIFE v3 — Lokalny serwer dashboardu")
    parser.add_argument("--port", type=int, default=5050, help="Port serwera (domyślnie 5050)")
    parser.add_argument("--no-browser", action="store_true", help="Nie otwieraj automatycznie przeglądarki")
    args = parser.parse_args()

    ensure_files()
    port = find_free_port(args.port)
    server = ThreadingHTTPServer(("127.0.0.1", port), FestivalHandler)
    url = f"http://127.0.0.1:{port}"

    print("=" * 64)
    print("  FESTIVAL'S LIFE v3 — Lokalny Dashboard Koncertowy")
    print(f"  Adres:       {url}")
    print(f"  Koncerty:    {len(load_concerts())} (przeżyte) | {len(load_upcoming())} (nadchodzące)")
    print(f"  Hometown:    {load_settings().get('hometown', 'Poznań')}")
    print(f"  Zdjęcia:     {UPLOAD_DIR}")
    print("  Zatrzymaj:   Ctrl + C")
    print("=" * 64)

    if not args.no_browser:
        threading.Timer(0.6, lambda: webbrowser.open(url)).start()

    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nZamykanie serwera... Do zobaczenia pod sceną!")
        server.server_close()


if __name__ == "__main__":
    main()
