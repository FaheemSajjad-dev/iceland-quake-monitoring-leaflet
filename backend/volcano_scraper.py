import os
import re
import time
import sqlite3
from typing import List, Dict, Optional
import unicodedata
import requests

BASE = "https://api.epos-iceland.is"
ENDPOINTS = {
    "status": "/v1/volcano/general-information/volcanoes-status",
    "catalog": "/v1/volcano/general-information/list-of-volcanoes",
    "eruptions": "/v1/volcano/general-information/list-of-eruptions",
}

# URL
def _get_json(url: str, timeout: int = 25):
    for i in range(3):
        try:
            r = requests.get(url, timeout=timeout)
            r.raise_for_status()
            return r.json()
        except Exception as e:
            if i == 2:
                print(f"[ERROR] GET {url} failed: {e}")
                return None
            time.sleep(0.7 * (i + 1))
    return None

# ---------- utils ----------
def _norm_name(s: str) -> str:
    """lowercase, strip spaces, remove accents and non-letters for stable matching."""
    if not s:
        return ""
    s = unicodedata.normalize("NFKD", s)
    s = "".join(ch for ch in s if not unicodedata.combining(ch))
    s = re.sub(r"[^a-zA-Z0-9]+", "", s).lower()
    return s

def _ft(m):
    try:
        return float(m) * 3.28084 if m is not None else None
    except Exception:
        return None

# ------------------ fetch and merge ----------------#

def fetch_and_merge() -> List[Dict]:
    """
    Fetch volcanoes from EPOS API and normalize to our database schema.
    Uses 'height' as elevation in meters.
    """
    url_catalog = BASE + ENDPOINTS["catalog"]
    catalog = _get_json(url_catalog) or []

    merged = []
    for v in (catalog if isinstance(catalog, list) else catalog.get("data", [])):
        name = v.get("name") or v.get("volcano_name") or v.get("system_name") or v.get("title")
        lat = v.get("latitude") or v.get("lat_dd") or v.get("lat")
        lon = v.get("longitude") or v.get("lon_dd") or v.get("lon")
        if not name or lat is None or lon is None:
            continue

        height = v.get("height") or v.get("elevation") or v.get("elevation_m")
        try:
            height = float(height) if height not in (None, "", "NaN") else None
        except Exception:
            height = None

        merged.append({
            "name": name.strip(),
            "description": v.get("area") or "No additional information available.",
            "elevation_m": height,
            "elevation_ft": _ft(height),
            "latitude": float(lat),
            "longitude": float(lon),
            "last_eruption": None,  # not available from this endpoint
        })

    print(f"[OK] Loaded {len(merged)} volcanoes from EPOS catalog with 'height' as elevation.")
    return merged

# ---------- db ----------
def save_volcanoes_to_db(volcanoes: List[Dict], db_path: Optional[str] = None) -> bool:
    if db_path is None:
        current_file_path = os.path.dirname(os.path.abspath(__file__))
        db_dir = os.path.join(current_file_path, "data")
        os.makedirs(db_dir, exist_ok=True)
        db_path = os.path.join(db_dir, "earthquakes.db")

    conn = sqlite3.connect(db_path)
    cur = conn.cursor()
    cur.execute("""
    CREATE TABLE IF NOT EXISTS volcano (
        id INTEGER PRIMARY KEY,
        name TEXT NOT NULL,
        description TEXT,
        elevation_m FLOAT,
        elevation_ft FLOAT,
        latitude FLOAT,
        longitude FLOAT,
        last_eruption TEXT,
        UNIQUE(name, latitude, longitude)
    )
    """)
    cur.execute("DELETE FROM volcano")

    count = 0
    for v in volcanoes:
        try:
            cur.execute("""
                INSERT OR REPLACE INTO volcano
                (name, description, elevation_m, elevation_ft, latitude, longitude, last_eruption)
                VALUES (?, ?, ?, ?, ?, ?, ?)
            """, (
                v["name"],
                v.get("description"),
                v.get("elevation_m"),
                v.get("elevation_ft"),
                v["latitude"],
                v["longitude"],
                v.get("last_eruption"),
            ))
            count += 1
        except Exception as e:
            print(f"[WARN] skipped {v.get('name')}: {e}")
    conn.commit()
    conn.close()
    print(f"[DB] Saved {count} volcano rows to {db_path}.")
    return True

def refresh_volcanoes(db_path: Optional[str] = None):
    rows = fetch_and_merge()
    if not rows:
        print("[ERROR] No volcanoes loaded.")
        return False
    return save_volcanoes_to_db(rows, db_path)

if __name__ == "__main__":
    refresh_volcanoes()