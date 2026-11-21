#!/usr/bin/env python3
"""
Jednorazowy skrypt migracji lokalnych danych FESTIVAL'S LIFE do Supabase.
Działa na czystym Pythonie 3 (bez pip install).

Użycie:
  1. Uzupełnij zmienne w pliku .env (lub ustaw je w terminalu).
  2. Uruchom: python scripts/migrate_to_supabase.py --data-dir ./festivals_life_local
"""

import argparse
import json
import os
import sys
import urllib.error
import urllib.request


def load_dotenv(env_path=".env"):
    if not os.path.exists(env_path):
        return
    with open(env_path, "r", encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if not line or line.startswith("#") or "=" not in line:
                continue
            k, v = line.split("=", 1)
            os.environ.setdefault(k.strip(), v.strip().strip('"').strip("'"))


def supabase_post(base_url, service_key, table, rows, on_conflict=None):
    if not rows:
        return 0
    url = f"{base_url.rstrip('/')}/rest/v1/{table}"
    if on_conflict:
        url += f"?on_conflict={on_conflict}"

    headers = {
        "apikey": service_key,
        "Authorization": f"Bearer {service_key}",
        "Content-Type": "application/json",
        "Prefer": "resolution=merge-duplicates,return=minimal" if on_conflict else "return=minimal",
    }

    batch_size = 50
    total = 0
    for i in range(0, len(rows), batch_size):
        chunk = rows[i:i + batch_size]
        req = urllib.request.Request(
            url,
            data=json.dumps(chunk, ensure_ascii=False).encode("utf-8"),
            headers=headers,
            method="POST",
        )
        try:
            with urllib.request.urlopen(req, timeout=30) as resp:
                if resp.status not in (200, 201, 204):
                    raise RuntimeError(f"HTTP {resp.status}")
                total += len(chunk)
        except urllib.error.HTTPError as e:
            err_body = e.read().decode("utf-8", errors="replace")
            raise RuntimeError(f"Supabase error on {table} (HTTP {e.code}): {err_body}") from e
    return total


def read_json(path, default):
    if not os.path.exists(path):
        return default
    with open(path, "r", encoding="utf-8") as f:
        return json.load(f)


def main():
    parser = argparse.ArgumentParser(description="Migracja FESTIVAL'S LIFE do Supabase")
    parser.add_argument("--data-dir", default=".", help="Folder z concerts_data.json itd.")
    parser.add_argument("--env", default=".env", help="Ścieżka do pliku .env")
    args = parser.parse_args()

    load_dotenv(args.env)

    base_url = os.environ.get("SUPABASE_URL", "").strip()
    service_key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY", "").strip()
    user_id = os.environ.get("TARGET_USER_ID", "").strip()

    if not base_url or not service_key or not user_id:
        print("BŁĄD: Ustaw SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY oraz TARGET_USER_ID w pliku .env!")
        sys.exit(1)

    d = args.data_dir
    concerts_raw = read_json(os.path.join(d, "concerts_data.json"), [])
    upcoming_raw = read_json(os.path.join(d, "upcoming_data.json"), [])
    events_meta_raw = read_json(os.path.join(d, "events_meta.json"), {})
    settings_raw = read_json(os.path.join(d, "settings.json"), {})
    coords_raw = read_json(os.path.join(d, "coords_cache.json"), {})

    # 1. Profile (Hometown)
    ht_coords = settings_raw.get("hometown_coords", [52.4064, 16.9252])
    profile_row = [{
        "id": user_id,
        "hometown": settings_raw.get("hometown", "Poznań"),
        "hometown_lat": float(ht_coords[0]),
        "hometown_lng": float(ht_coords[1]),
    }]
    supabase_post(base_url, service_key, "profiles", profile_row, on_conflict="id")
    print(f"[OK] Profil / Hometown: {profile_row[0]['hometown']}")

    # 2. Cities cache
    city_rows = [
        {"city": city, "lat": float(coords[0]), "lng": float(coords[1])}
        for city, coords in coords_raw.items()
        if isinstance(coords, list) and len(coords) == 2
    ]
    n_cities = supabase_post(base_url, service_key, "cities_cache", city_rows, on_conflict="city")
    print(f"[OK] Współrzędne miast (cities_cache): {n_cities}")

    # 3. Concerts
    concert_rows = []
    for c in concerts_raw:
        cena_val = c.get("cena")
        try:
            cena_num = float(cena_val) if cena_val not in (None, "") else None
        except ValueError:
            cena_num = None
        data_val = c.get("data") or None
        if data_val and len(str(data_val)) != 10:
            data_val = None
        concert_rows.append({
            "user_id": user_id,
            "rok": c.get("rok"),
            "event": c.get("event", ""),
            "artysta": c.get("artysta", ""),
            "data": data_val,
            "dzien": c.get("dzien", ""),
            "godzina": c.get("godzina", ""),
            "scena": c.get("scena", ""),
            "miejsce": c.get("miejsce", ""),
            "miasto": c.get("miasto", ""),
            "district": c.get("district", ""),
            "kraj": c.get("kraj", "Polska"),
            "gatunek": c.get("gatunek", ""),
            "podgatunek": c.get("podgatunek", ""),
            "kto": c.get("kto", "Razem"),
            "z_kim": c.get("z_kim", ""),
            "ocena": int(c.get("ocena") or 0),
            "cena": cena_num,
            "uwagi": c.get("uwagi", ""),
        })
    n_concerts = supabase_post(base_url, service_key, "concerts", concert_rows)
    print(f"[OK] Przeżyte koncerty (concerts): {n_concerts}")

    # 4. Upcoming
    upcoming_rows = []
    for u in upcoming_raw:
        cena_val = u.get("cena")
        try:
            cena_num = float(cena_val) if cena_val not in (None, "") else None
        except ValueError:
            cena_num = None
        upcoming_rows.append({
            "user_id": user_id,
            "rok": u.get("rok"),
            "event": u.get("event", ""),
            "artysta": u.get("artysta", ""),
            "data": u.get("data") or None,
            "dzien": u.get("dzien", ""),
            "godzina": u.get("godzina", ""),
            "miejsce": u.get("miejsce", ""),
            "miasto": u.get("miasto", ""),
            "kraj": u.get("kraj", "Polska"),
            "gatunek": u.get("gatunek", ""),
            "z_kim": u.get("z_kim", ""),
            "status_biletu": u.get("status_biletu", "Kupiony"),
            "cena": cena_num,
            "uwagi": u.get("uwagi", ""),
        })
    n_up = supabase_post(base_url, service_key, "upcoming_concerts", upcoming_rows)
    print(f"[OK] Nadchodzące koncerty (upcoming_concerts): {n_up}")

    # 5. Events Meta (line-upy)
    meta_rows = [
        {
            "user_id": user_id,
            "event_key": k,
            "poster_path": v.get("poster", ""),
            "photos": v.get("photos", []),
            "lineup": v.get("lineup", []),
        }
        for k, v in events_meta_raw.items()
    ]
    n_meta = supabase_post(base_url, service_key, "events_meta", meta_rows, on_conflict="user_id,event_key")
    print(f"[OK] Line-upy i metadane eventów (events_meta): {n_meta}")
    print("\nMigracja zakończona sukcesem!")


if __name__ == "__main__":
    main()
