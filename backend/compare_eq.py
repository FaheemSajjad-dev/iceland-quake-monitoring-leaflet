# backend/compare_eq.py
from __future__ import annotations

import os
import sys
from datetime import datetime, timedelta
from math import radians, sin, cos, asin

# Make "backend" importable
BASE_DIR = os.path.dirname(__file__)
sys.path.insert(0, BASE_DIR)

from app import app, Earthquake, EarthquakeSRaw, EarthquakeMerged  # type: ignore


def hav_km(a_lat: float, a_lon: float, b_lat: float, b_lon: float) -> float:
    """Haversine distance (km)."""
    R = 6371.0
    p1, p2 = radians(a_lat), radians(b_lat)
    dlat = radians(b_lat - a_lat)
    dlon = radians(b_lon - a_lon)
    x = sin(dlat / 2) ** 2 + cos(p1) * cos(p2) * sin(dlon / 2) ** 2
    return 2 * R * asin(min(1.0, x ** 0.5))


# —— target event you gave ——
TARGET_DT = "2022-06-23 22:12:06"
TARGET_LAT = 64.6527
TARGET_LON = -20.33587


def main() -> None:
    with app.app_context():
        print("=== MPGV (table: Earthquake) at exact time ===")
        v_rows = Earthquake.query.filter(Earthquake.date_time == TARGET_DT).all()
        for q in v_rows:
            print({
                "date_time": q.date_time,
                "lat": q.latitude,
                "lon": q.longitude,
                "depth_km": q.depth,
                "Mw_mean": q.mw_mean,
            })
        if not v_rows:
            print("No MPGV row at that exact second.")

        print("\n=== Skjálftalísa candidates ±5 min, within 60 km ===")
        t0 = datetime.strptime(TARGET_DT, "%Y-%m-%d %H:%M:%S")
        tmin = (t0 - timedelta(minutes=5)).strftime("%Y-%m-%d %H:%M:%S")
        tmax = (t0 + timedelta(minutes=5)).strftime("%Y-%m-%d %H:%M:%S")

        s_rows = (
            EarthquakeSRaw.query
            .filter(EarthquakeSRaw.date_time >= tmin,
                    EarthquakeSRaw.date_time <= tmax)
            .all()
        )

        candidates = []
        for s in s_rows:
            dkm = hav_km(TARGET_LAT, TARGET_LON, s.latitude, s.longitude)
            if dkm <= 60:
                dt_sec = abs(
                    (t0 - datetime.strptime(s.date_time, "%Y-%m-%d %H:%M:%S"))
                    .total_seconds()
                )
                candidates.append({
                    "event_id": s.event_id,
                    "date_time": s.date_time,
                    "lat": s.latitude,
                    "lon": s.longitude,
                    "depth_km": s.depth,
                    "mag": s.magnitude,
                    "dist_km": round(dkm, 2),
                    "dt_sec": int(dt_sec),
                })

        for c in sorted(candidates, key=lambda r: (r["dist_km"], r["dt_sec"]))[:5]:
            print(c)
        if not candidates:
            print("No Skjálftalísa events within window/thresholds.")

        print("\n=== Merged table (table: EarthquakeMerged) at same time ===")
        m_rows = EarthquakeMerged.query.filter(EarthquakeMerged.date_time == TARGET_DT).all()
        for r in m_rows:
            print({
                "date_time": r.date_time,
                "lat": r.latitude,
                "lon": r.longitude,
                "depth_km": r.depth,
                "Mw": r.mw_mean,
                "status": r.status,
                "match_dt_sec": r.match_dt_sec,
                "match_dist_km": r.match_dist_km,
            })
        if not m_rows:
            print("No merged row at that time.")


if __name__ == "__main__":
    main()