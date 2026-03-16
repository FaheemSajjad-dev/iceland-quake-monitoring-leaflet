# Security Considerations

This document lists security-relevant items that should be reviewed before deploying MPGV Monitor as a public-facing production service. It is intended for the team at the Icelandic Meteorological Office (IMO) who will take ownership of the application.

---

## 1. Flask Debug Mode

**File:** `backend/app.py`, line 477

```python
app.run(debug=True, port=5001)
```

**Risk:** When `debug=True`, Flask exposes an interactive debugger in the browser on any unhandled exception. An attacker who can trigger an error can execute arbitrary Python code on the server.

**Fix:** Set `debug=False` for production, or use an environment variable:

```python
app.run(debug=os.environ.get("FLASK_DEBUG", "false").lower() == "true", port=5001)
```

In production, use gunicorn instead of `app.run()` entirely — gunicorn ignores the debug flag.

**Severity:** Critical

---

## 2. CORS (Cross-Origin Resource Sharing)

**File:** `backend/app.py`, line 31

```python
CORS(app)
```

**Risk:** This allows **any origin** to call the API. During development this is convenient, but in production it means any website on the internet can make requests to the backend.

**Fix:** Restrict to the production frontend origin:

```python
CORS(app, origins=["https://your-production-domain.vedur.is"])
```

Or remove CORS entirely if the frontend and backend are served from the same origin behind a reverse proxy (the recommended production setup).

**Severity:** Medium

---

## 3. Unprotected Write Endpoints

The following endpoints trigger server-side operations and are currently accessible without authentication:

| Endpoint | Method | Action |
|---|---|---|
| `/reconcile` | POST | Reruns the full reconciliation algorithm |
| `/scrape-volcanoes` | GET | Triggers a live scrape of the EPOS volcano API |

**Risk:** Anyone who can reach the backend can trigger expensive operations, potentially causing load spikes or redundant database writes.

**Fix (pick one):**
- Restrict these endpoints to `localhost` only (reject requests where `request.remote_addr` is not `127.0.0.1`)
- Add a simple API key check via an `Authorization` header or query parameter
- Remove them entirely in production — the scheduler already handles all ingestion automatically

**Severity:** Low–Medium (read-only data, but allows abuse)

---

## 4. No Rate Limiting

The API has no rate limiting on any endpoint. A single client can make unlimited requests to `/earthquakes`, `/volcanoes`, `/earthquakes_csv`, etc.

**Fix:** Add rate limiting at the reverse proxy level (nginx `limit_req`) or with Flask-Limiter:

```python
from flask_limiter import Limiter
limiter = Limiter(app, default_limits=["60 per minute"])
```

**Severity:** Low (unlikely to be targeted, but good practice)

---

## 5. SQLite Database File Permissions

**File:** `backend/data/earthquakes.db`

**Risk:** If the server's file permissions are too open, other users on the same machine could read or modify the database.

**Fix:** Ensure the database file and its directory are readable/writable only by the application user:

```bash
chmod 700 backend/data/
chmod 600 backend/data/earthquakes.db
```

**Severity:** Low (depends on server environment)

---

## 6. No HTTPS Enforcement

The application does not enforce HTTPS. In development this is expected, but in production all traffic should be encrypted.

**Fix:** Terminate TLS at the reverse proxy (nginx or Apache) and redirect HTTP → HTTPS. The Flask application itself does not need to handle TLS.

**Severity:** Medium (especially if deployed on a public IP)

---

## 7. Frontend API URL Detection

**File:** `frontend/src/api.js`, lines 4–6

```javascript
const isLocalDev = window.location.hostname === "localhost"
    || window.location.hostname === "127.0.0.1";
export const API_URL = isLocalDev ? "http://localhost:5001" : "";
```

**Risk:** None in practice — this correctly uses an empty base URL in production (same-origin requests). Included here for awareness: if the production hostname ever matches `localhost` (e.g. server-side rendering), requests would incorrectly target port 5001.

**Severity:** Informational

---

## 8. No Secret Key Configured

Flask requires a `SECRET_KEY` for session management and CSRF protection. The application currently does not set one because it has no login or session features. If authentication is added in the future, a secret key must be configured:

```python
app.config["SECRET_KEY"] = os.environ.get("FLASK_SECRET_KEY", "change-me-in-production")
```

**Severity:** Informational (no sessions currently used)

---

## Summary — Action Priority

| Priority | Item | Action |
|---|---|---|
| **Critical** | Debug mode | Set `debug=False` or use gunicorn |
| **Medium** | CORS | Restrict to production origin or remove |
| **Medium** | HTTPS | Terminate TLS at reverse proxy |
| **Low–Medium** | Write endpoints | Protect `/reconcile` and `/scrape-volcanoes` |
| **Low** | Rate limiting | Add at proxy or application level |
| **Low** | DB permissions | `chmod 700` the data directory |
| **Info** | Secret key | Only needed if sessions/auth are added |
| **Info** | API URL detection | No action needed |

---

*Last updated: 2026-03-16*
