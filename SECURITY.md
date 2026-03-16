# Security Considerations

Before handing this over to IMO for production deployment, the following things need to be addressed. Some are blocking, some are low priority but worth knowing about.

---

## 1. Flask Debug Mode

`backend/app.py`, line 477:

```python
app.run(debug=True, port=5001)
```

This needs to be turned off before going live. With `debug=True`, Flask exposes an interactive Python debugger in the browser on any unhandled exception — someone who can trigger an error gets arbitrary code execution on the server.

For production, either set `debug=False` or (better) use gunicorn instead of `app.run()` altogether:

```python
app.run(debug=os.environ.get("FLASK_DEBUG", "false").lower() == "true", port=5001)
```

```bash
gunicorn -b 0.0.0.0:5001 app:app --chdir backend
```

Gunicorn ignores the debug flag entirely, so this is the cleaner fix.

---

## 2. CORS

`backend/app.py`, line 31:

```python
CORS(app)
```

This lets any origin hit the API. Fine during development, but in production it means any website can make requests to the backend. Should be locked down to the production frontend:

```python
CORS(app, origins=["https://your-production-domain.vedur.is"])
```

Or dropped entirely if frontend and backend are behind the same reverse proxy (same origin, no CORS needed).

---

## 3. Unprotected Admin Endpoints

Two endpoints trigger server-side operations with no authentication:

| Endpoint | What it does |
|---|---|
| `POST /reconcile` | Reruns the full reconciliation algorithm |
| `GET /scrape-volcanoes` | Triggers a live EPOS API scrape |

Anyone who can reach the backend can call these. The simplest fix is to restrict them to `127.0.0.1` only, or just remove them — the scheduler handles all ingestion automatically in production anyway.

---

## 4. Rate Limiting

No rate limiting on any endpoint. Not likely to be targeted, but worth adding at the nginx level if this goes on a public IP:

```nginx
limit_req_zone $binary_remote_addr zone=api:10m rate=60r/m;
```

Or use Flask-Limiter if nginx isn't in the picture.

---

## 5. Database File Permissions

`backend/data/earthquakes.db` — make sure permissions are tight on the server:

```bash
chmod 700 backend/data/
chmod 600 backend/data/earthquakes.db
```

Only matters if there are other users on the same machine, but worth doing anyway.

---

## 6. HTTPS

The app doesn't enforce HTTPS (expected for local dev, not for production). TLS should be terminated at the reverse proxy; Flask doesn't need to handle it directly. Standard nginx setup with Let's Encrypt or an IMO cert is sufficient.

---

## 7. Frontend API URL Detection

`frontend/src/api.js`, lines 4–6:

```javascript
const isLocalDev = window.location.hostname === "localhost"
    || window.location.hostname === "127.0.0.1";
export const API_URL = isLocalDev ? "http://localhost:5001" : "";
```

No action needed — this correctly falls back to same-origin requests in production. Just noting it here so it doesn't look like a magic empty string to whoever reads the code next.

---

## 8. Secret Key

Flask needs a `SECRET_KEY` for sessions and CSRF. The app doesn't use either right now, so it's not an issue, but if auth gets added later:

```python
app.config["SECRET_KEY"] = os.environ.get("FLASK_SECRET_KEY", "change-me-in-production")
```
