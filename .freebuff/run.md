# Preview — GBLRecover Full Stack

## How to reproduce uncommitted artifacts

1. Copy `frontend/.env` from the main checkout (or create from `frontend/.env.example`):
   ```
   VITE_API_URL=http://localhost:8000
   VITE_API_PREFIX=/api/v1
   ```

2. Ensure `node_modules` is installed in `frontend/`:
   ```
   cd frontend && npm install
   ```

## How to run the servers

### Backend (FastAPI + PostgreSQL)
The backend and PostgreSQL may already be running as systemd user services:
```bash
systemctl --user status gblrecover-postgres gblrecover-backend
```
If not:
```bash
cd backend
uvicorn app.main:app --host 0.0.0.0 --port 8000
```
PostgreSQL runs on port 5433 (user `postgres`, password `postgres`, db `gblrecover`).

### Frontend (Vite dev server)
```bash
cd frontend
npx vite --host 0.0.0.0 --port 5173 --strictPort
```
- Default port: 5173. Adjust `--port` if taken.
- Frontend connects to backend at `http://localhost:8000`.
- Demo credentials: `admin@camtel.cm` / `admin1234` or `agent@camtel.cm` / `demo1234`.

### Endpoints
| Service | URL |
|---------|-----|
| Frontend | http://localhost:5173 |
| Backend  | http://localhost:8000 |
| Backend /status | http://localhost:8000/status |
| DB Health | http://localhost:8000/health/db |
