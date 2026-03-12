from __future__ import annotations

import os
import sys
import logging
import threading

import csv
import io
import math
import requests

from datetime import datetime, timedelta, timezone

from flask import Flask, jsonify, request, make_response
from flask_cors import CORS
from flask_sqlalchemy import SQLAlchemy
from apscheduler.schedulers.background import BackgroundScheduler

# Optional: gzip responses if Flask-Compress is installed
try:
    from flask_compress import Compress  # pip install Flask-Compress
except Exception:  # noqa: BLE001
    Compress = None

# -----------------------------------------------------------------------------
# App & DB setup
# -----------------------------------------------------------------------------
app = Flask(__name__)
CORS(app)
if Compress:
    Compress(app)

# quiet down apscheduler logs
logging.getLogger("apscheduler").setLevel(logging.WARNING)

CURRENT_FILE_PATH = os.path.dirname(os.path.abspath(__file__))
DB_DIR = os.path.join(CURRENT_FILE_PATH, "data")
os.makedirs(DB_DIR, exist_ok=True)
DB_PATH = os.path.join(DB_DIR, "earthquakes.db")
print(f"Using database at: {DB_PATH}")

app.config["SQLALCHEMY_DATABASE_URI"] = f"sqlite:///{DB_PATH}"
app.config["SQLALCHEMY_TRACK_MODIFICATIONS"] = False
app.config["SQLALCHEMY_ENGINE_OPTIONS"] = {"pool_size": 5, "pool_recycle": 280}

db = SQLAlchemy(app)

# Enable faster, safer writes with SQLite WAL mode (when app starts)
with app.app_context():
    try:
        db.session.execute(db.text("PRAGMA journal_mode=WAL;"))
        db.session.execute(db.text("PRAGMA synchronous=NORMAL;"))
        db.session.commit()
    except Exception:
        # non-fatal if PRAGMAs aren't supported in some env
        db.session.rollback()

# -----------------------------------------------------------------------------
# Models
# -----------------------------------------------------------------------------
class Earthquake(db.Model):
    """MPGV source table (v)."""
    id = db.Column(db.Integer, primary_key=True)
    date_time = db.Column(db.String, nullable=False)       # 'YYYY-MM-DD HH:MM:SS' UTC
    latitude = db.Column(db.Float, nullable=False)
    longitude = db.Column(db.Float, nullable=False)
    depth = db.Column(db.Float, nullable=False)
    mw_mean = db.Column(db.Float, nullable=False)
    __table_args__ = (
        db.UniqueConstraint("date_time", "latitude", "longitude", name="unique_earthquake_entry"),
    )


class Volcano(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String, nullable=False)
    description = db.Column(db.Text)
    elevation_m = db.Column(db.Float)
    elevation_ft = db.Column(db.Float)
    latitude = db.Column(db.Float, nullable=False)
    longitude = db.Column(db.Float, nullable=False)
    last_eruption = db.Column(db.String)
    __table_args__ = (
        db.UniqueConstraint("name", "latitude", "longitude", name="unique_volcano_entry"),
    )


class EarthquakeSRaw(db.Model):
    """Skjálftalísa raw table (s)."""
    __tablename__ = "earthquake_s_raw"
    id = db.Column(db.Integer, primary_key=True)
    event_id = db.Column(db.String, unique=True, nullable=False)  # IMO id
    date_time = db.Column(db.String, index=True, nullable=False)  # 'YYYY-MM-DD HH:MM:SS' UTC
    latitude = db.Column(db.Float, nullable=False)
    longitude = db.Column(db.Float, nullable=False)
    depth = db.Column(db.Float)                                   # km
    magnitude = db.Column(db.Float)                                # optional

    def __repr__(self) -> str:
        return f"<SRaw event_id={self.event_id} Mw={self.magnitude} lat={self.latitude} lon={self.longitude}>"


class EarthquakeMerged(db.Model):
    """Display table (merged v⊕s per matching rules)."""
    __tablename__ = "earthquake_merged"
    id = db.Column(db.Integer, primary_key=True)
    date_time = db.Column(db.String, index=True, nullable=False)  # keep MPGV time
    latitude = db.Column(db.Float, nullable=False)                 # from S when matched, else V
    longitude = db.Column(db.Float, nullable=False)
    depth = db.Column(db.Float)                                    # from S when matched, else V
    mw_mean = db.Column(db.Float, nullable=False)                  # from V

    # provenance / diagnostics
    status = db.Column(db.String, nullable=False)   # 'matched' | 'v_only'
    v_src_key = db.Column(db.String)                # optional for diagnostics
    s_event_id = db.Column(db.String)
    match_dt_sec = db.Column(db.Float)
    match_dist_km = db.Column(db.Float)
    match_dm = db.Column(db.Float)

# --- ShakeMap link cache table ---------------------------------------------
class ShakeMapLink(db.Model):
    __tablename__ = "shakemap_links"
    # primary key: your catalog datetime string (same as EarthquakeMerged.date_time)
    dt = db.Column(db.String, primary_key=True)

    url_view_file = db.Column(db.String)
    origin_time   = db.Column(db.String)

    sm_lat  = db.Column(db.Float)
    sm_lon  = db.Column(db.Float)
    sm_mag  = db.Column(db.Float)
    sm_depth= db.Column(db.Float)

    dt_sec  = db.Column(db.Float)   # |Δt| seconds to chosen shakemap
    dist_km = db.Column(db.Float)   # distance to chosen shakemap
    dm      = db.Column(db.Float)   # Mw_v - M_shakemap

    status  = db.Column(db.String)  # "valid" | "no_candidate" | "no_valid" | "error"
    note    = db.Column(db.String)

# -----------------------------------------------------------------------------
# DB init
# -----------------------------------------------------------------------------
def create_tables() -> None:
    with app.app_context():
        db.create_all()

create_tables()

_scheduler = None
_scheduler_lock = threading.Lock()
_scheduler_started = False

# -----------------------------------------------------------------------------
# Scheduled job
# -----------------------------------------------------------------------------
def scheduled_scrape() -> None:
    """
    Every 3 minutes:
      1) Scrape MPGV (updates Earthquake)
      2) Reconcile (write EarthquakeMerged)
    """
    with app.app_context():
        # avoid circular imports
        sys.path.append(CURRENT_FILE_PATH)
        from scrape import scrape_all_earthquake_data
        from reconcile import match_and_merge

        # Step 1: scrape MPGV (already filtered at Mw >= 2.7 in scrape.py)
        scrape_all_earthquake_data()

        # Step 2: reconcile v & s into merged
        end = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M:%S")
        start = "2020-06-01 00:00:00"
        match_and_merge(start, end, min_mag=2.7)

def start_background_services() -> None:
    global _scheduler, _scheduler_started

    if os.environ.get("DISABLE_SCHEDULER") or _scheduler_started:
        return

    with _scheduler_lock:
        if _scheduler_started:
            return

        _scheduler = BackgroundScheduler(coalesce=True, misfire_grace_time=60)
        _scheduler.add_job(scheduled_scrape, "interval", minutes=3, max_instances=1)
        _scheduler.start()
        _scheduler_started = True


@app.before_request
def ensure_background_services() -> None:
    if not app.debug or os.environ.get("WERKZEUG_RUN_MAIN") == "true":
        start_background_services()

# -----------------------------------------------------------------------------
# Routes
# -----------------------------------------------------------------------------
@app.route("/", methods=["GET"])
def home():
    return jsonify({"message": "Iceland Earthquake Monitoring API is running!"})


@app.route("/earthquakes", methods=["GET"])
def get_earthquake_data():
    """
    Returns merged earthquake data.
    - default: ALL data (to preserve existing frontend behavior)
    - optional: ?days=NN to limit to recent window
    - optional: ?days=all explicitly returns all
    """
    days_param = (request.args.get("days") or "all").strip().lower()

    with app.app_context():
        q = EarthquakeMerged.query

        if days_param != "all":
            try:
                days = int(days_param)
                cutoff = (datetime.now(timezone.utc) - timedelta(days=days)).strftime("%Y-%m-%d %H:%M:%S")
                q = q.filter(EarthquakeMerged.date_time >= cutoff)
            except ValueError:
                # bad days param -> fallback to ALL
                pass

        rows = q.order_by(EarthquakeMerged.date_time.desc()).all()

        return jsonify([
            {
                "Date-time": r.date_time,
                "Latitude":  r.latitude,
                "Longitude": r.longitude,
                "Depth":     r.depth,
                "Mw_mean":   r.mw_mean,
                "status":    r.status
            } for r in rows
        ])

@app.route("/earthquakes_csv", methods=["GET"])
def get_earthquake_data_csv():
    """
    Download merged earthquake data as CSV.

    Mirrors /earthquakes default behaviour:
      - uses EarthquakeMerged (polished, Mw >= 2.7)
      - by default returns ALL data (2020-06-01 → now)
      - optional: ?days=NN to limit to recent window
    """
    days_param = (request.args.get("days") or "all").strip().lower()

    with app.app_context():
        q = EarthquakeMerged.query

        if days_param != "all":
            try:
                days = int(days_param)
                cutoff = (
                    datetime.now(timezone.utc) - timedelta(days=days)
                ).strftime("%Y-%m-%d %H:%M:%S")
                q = q.filter(EarthquakeMerged.date_time >= cutoff)
            except ValueError:
                # bad days param -> fallback to ALL
                pass

        rows = q.order_by(EarthquakeMerged.date_time.asc()).all()

        output = io.StringIO()
        writer = csv.writer(output)

        # Header: polished fields shown on the web map
        writer.writerow(["Date-time", "Latitude", "Longitude", "Depth_km", "Mw_mean", "status"])

        for r in rows:
            writer.writerow([
                r.date_time,
                f"{r.latitude:.4f}" if r.latitude is not None else "",
                f"{r.longitude:.4f}" if r.longitude is not None else "",
                f"{r.depth:.2f}" if r.depth is not None else "",
                f"{r.mw_mean:.2f}" if r.mw_mean is not None else "",
                r.status or "",
            ])

        csv_data = output.getvalue()
        response = make_response(csv_data)
        response.headers["Content-Type"] = "text/csv; charset=utf-8"
        response.headers["Content-Disposition"] = (
            "attachment; filename=iceland_earthquakes_merged.csv"
        )
        return response

@app.route('/scrape-volcanoes', methods=['GET'])
def scrape_volcanoes():
    """Fetch and save live volcano data from EPOS Iceland API (discovered automatically)."""
    try:
        sys.path.append(CURRENT_FILE_PATH)
        from volcano_scraper import refresh_volcanoes
        ok = refresh_volcanoes(DB_PATH)
        if ok:
            return jsonify({"message": "EPOS volcanoes fetched and saved.", "source": "epos"})
        return jsonify({"message": "No volcano data was found from EPOS API.", "source": "none"}), 502
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route('/volcanoes', methods=['GET'])
def get_volcano_data():
    """Returns volcano data from the database as JSON."""
    with app.app_context():
        volcanoes = Volcano.query.all()
        return jsonify([
            {
                "name": v.name,
                "description": v.description,
                "elevation_m": v.elevation_m,
                "elevation_ft": v.elevation_ft,
                "latitude": v.latitude,
                "longitude": v.longitude,
                "last_eruption": v.last_eruption
            }
            for v in volcanoes
        ])


@app.route("/reconcile", methods=["POST"])
def run_reconcile():
    """
    Manual trigger to run the reconcile (useful for a button in your UI or Postman).
    """
    from reconcile import match_and_merge
    end = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M:%S")
    start = "2020-06-01 00:00:00"
    match_and_merge(start, end, min_mag=2.7)
    return jsonify({"message": "Reconcile completed"}), 200


@app.route("/health", methods=["GET"])
def health():
    """
    Quick stats to verify the pipeline is healthy.
    """
    with app.app_context():
        return jsonify({
            "MPGV": Earthquake.query.count(),
            "Skjalftalisa": EarthquakeSRaw.query.count(),
            "Merged": EarthquakeMerged.query.count(),
        })


# --- Simple EPOS shakemap lookup for one event -------------------------------
def _km_distance(lat1, lon1, lat2, lon2):
    # quick haversine (km)
    R = 6371.0
    p1, p2 = math.radians(lat1), math.radians(lat2)
    dlat = p2 - p1
    dlon = math.radians(lon2 - lon1)
    a = math.sin(dlat/2)**2 + math.cos(p1)*math.cos(p2)*math.sin(dlon/2)**2
    return 2 * R * math.asin(min(1, math.sqrt(a)))

@app.route("/shakemap_lookup", methods=["GET"])
def shakemap_lookup():
    """
    Query EPOS /seismic/shakemaps around the event time/loc and return a view URL if found.
    Params: dt=YYYY-MM-DD HH:MM:SS, lat=..., lon=...
    """
    dt_str = (request.args.get("dt") or "").strip()
    lat = request.args.get("lat", type=float)
    lon = request.args.get("lon", type=float)
    if not dt_str or lat is None or lon is None:
        return jsonify({"found": False, "reason": "missing parameters"}), 400

    # parse event time (treat as UTC)
    try:
        # support both "YYYY-MM-DD HH:MM:SS" and ISO "YYYY-MM-DDTHH:MM:SS"
        dt_str_norm = dt_str.replace("T", " ")
        evt_dt = datetime.strptime(dt_str_norm[:19], "%Y-%m-%d %H:%M:%S").replace(tzinfo=timezone.utc)
    except Exception:
        return jsonify({"found": False, "reason": "bad dt format"}), 400

    # search window & Iceland bbox
    window = timedelta(hours=6)  # generous to be safe
    start_time = (evt_dt - window).strftime("%Y-%m-%dT%H:%M:%S")
    end_time   = (evt_dt + window).strftime("%Y-%m-%dT%H:%M:%S")
    bbox = "62.8,-25.0,67.0,-12.5"

    url = (
        "https://api.epos-iceland.is/v1/seismic/shakemaps"
        f"?start_time={start_time}&end_time={end_time}&bbox={bbox}"
    )

    try:
        r = requests.get(url, timeout=20)
        r.raise_for_status()
        items = r.json() if isinstance(r.json(), list) else []
    except Exception as e:
        return jsonify({"found": False, "reason": f"fetch error: {e}"}), 502

    # pick the closest in time+space with simple thresholds
    best = None
    best_score = 1e18
    for it in items:
        try:
            ot = it.get("origin_time") or ""
            ot_norm = ot.replace("T", " ").replace("Z", "")
            dt = datetime.strptime(ot_norm[:19], "%Y-%m-%d %H:%M:%S").replace(tzinfo=timezone.utc)
            dmin = abs((dt - evt_dt).total_seconds()) / 60.0
            dkm = _km_distance(lat, lon, float(it["latitude"]), float(it["longitude"]))
            # combine; time weighs more than distance here
            score = dmin * 3 + dkm
            if score < best_score:
                best_score = score
                best = {**it, "dmin": dmin, "dkm": dkm}
        except Exception:
            continue

    # only accept if reasonably close
    if not best:
        return jsonify({"found": False})
    if best["dmin"] > 180 or best["dkm"] > 200:
        return jsonify({"found": False})

    view_url = (best.get("url_view_file") or "").strip()
    if not view_url:
        return jsonify({"found": False})

    return jsonify({
        "found": True,
        "url": view_url,
        "origin_time": best.get("origin_time"),
        "minutes_diff": round(best["dmin"], 1),
        "distance_km": round(best["dkm"], 1),
    })


# --- Return validated ShakeMap URL for an event -----------------------------
@app.route("/shakemap/<dt>", methods=["GET"])
def shakemap(dt):
    link = ShakeMapLink.query.get(dt)
    if not link or link.status != "valid":
        return {"available": False}, 200
    return {
        "available": True,
        "url": link.url_view_file,
        "dt_sec": link.dt_sec,
        "dist_km": link.dist_km,
        "dm": link.dm
    }, 200


# -----------------------------------------------------------------------------
# Entrypoint
# -----------------------------------------------------------------------------
if __name__ == "__main__":
    print(f"Starting server with database at: {DB_PATH}")
    start_background_services()
    app.run(debug=True)
