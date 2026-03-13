# Iceland Earthquake Monitoring — Leaflet Edition

Real-time Iceland earthquake monitoring web application built as part of an MSc thesis at the University of Iceland (Háskóli Íslands).

Live demo: [pluto.cs.hi.is:9001](http://pluto.cs.hi.is:9001)

---

## Overview

Visualizes earthquakes across Iceland in near-real time, focusing on events with **M ≥ 2.7**. The backend continuously fetches and reconciles data from multiple sources, serving a merged dataset to an interactive Leaflet map.

This is the **Leaflet clone** of the original Google Maps version — no API key required.

---

## Stack

| Layer | Technology |
|---|---|
| Frontend | React 18 + Vite, react-leaflet 4 |
| Map tiles | OpenStreetMap · Esri World Imagery · CartoDB Dark Matter |
| Backend | Python 3, Flask, SQLAlchemy, APScheduler |
| Database | SQLite (WAL mode) |
| Tests | pytest (backend) · Vitest + Testing Library (frontend) |

---

## Data Sources

- **MPGV** — public earthquake listings scraped from [hraun.vedur.is/ja/Mpgv/](http://hraun.vedur.is/ja/Mpgv/)
- **Skjálftalísa API** — detailed event metadata from the Icelandic Met Office ([api.vedur.is](https://api.vedur.is/?urls.primaryName=Skj%C3%A1lftal%C3%ADsa))
- **EPOS API** — volcano data and ShakeMap information from [api.vedur.is (EPOS)](https://api.vedur.is/?urls.primaryName=EPOS)

### Reconciliation Algorithm

Each MPGV event is matched against Skjálftalísa records using three thresholds:

| Criterion | Threshold |
|---|---|
| Time difference | ≤ 2 seconds |
| Distance | < 10 km |
| Magnitude difference | < 3.0 |

When a unique match is found, the Skjálftalísa location and depth replace the MPGV values. Current coverage: **~81%** of MPGV events matched.

---

## Features

- Interactive map with earthquake markers sized and coloured by magnitude
- **Timeline colour mode** — shades markers by when the event occurred
- **Magnitude colour mode** — shades markers by seismic strength
- **Time window slider** — filter events by day / week / month / year
- **Magnitude filter** — slider to set a minimum magnitude threshold
- **Volcano overlay** — 33 Icelandic volcanoes with status and EPOS metadata
- **ShakeMap links** — info window shows a ShakeMap button for eligible events
- **Data export** — download the full merged catalogue as CSV
- Three map tile layers: roadmap, satellite, dark mode
- Scale control and coordinate grid overlay

---

## Project Structure

```
iceland-quake-monitoring-leaflet/
├── backend/
│   ├── app.py                  # Flask API, scheduler, SQLAlchemy models
│   ├── scrape.py               # MPGV HTML scraper
│   ├── skjalftalisa_client.py  # Skjálftalísa API client
│   ├── reconcile.py            # Merge algorithm (MPGV + Skjálftalísa)
│   ├── volcano_scraper.py      # EPOS volcano data
│   ├── data/                   # SQLite database (gitignored)
│   ├── venv/                   # Python virtualenv (gitignored)
│   └── tests/                  # 37 pytest tests
└── frontend/
    ├── src/
    │   ├── components/         # React components (Map, Slider, Scale, etc.)
    │   ├── api.js              # API calls to backend
    │   └── __tests__/          # Vitest component tests
    └── vite.config.js
```

---

## Running Locally

**Backend** (port 5001):
```bash
backend/venv/Scripts/python.exe backend/app.py
```

**Frontend** (port 5174):
```bash
cd frontend
npm install
npm run dev
```

Open [http://localhost:5174](http://localhost:5174).

> The frontend `api.js` points to `http://localhost:5001`. Both servers must be running.

---

## Running Tests

**Backend** (37 tests):
```bash
cd backend
python -m pytest tests/ -v
```

**Frontend**:
```bash
cd frontend
npm test
```

---

## Configuration

| Setting | Value |
|---|---|
| Magnitude filter | M ≥ 2.7 |
| Scheduler interval | Every 3 minutes |
| Reconcile: max distance | 10 km |
| Reconcile: max time diff | 2 seconds |
| Reconcile: max mag diff | 3.0 |
| DB location | `backend/data/earthquakes.db` |

---

## Credits

- Muhammad Faheem Sajjad
- Kristján Jónasson
- Esa Olavi Hyytia

University of Iceland · © 2025
