# Run Doc — GBLRecover Preview

## Reproducing Uncommitted Artifacts

No `.env.local` file is needed. The frontend defaults to `VITE_API_URL=http://localhost:8000`.

Dependencies are already installed in `frontend/node_modules` and `backend/` uses system Python packages.

## Running the Servers

### Backend (FastAPI on port 8000)

```bash
cd backend
python3 -m uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```

### Frontend (Vite dev server on port 5173)

```bash
cd frontend
npx vite --host 127.0.0.1
```

### Demo Login

- **Admin**: `admin@camtel.cm` / `admin1234`
- **Agent**: `agent@camtel.cm` / `demo1234`

### Notes

- The backend uses in-memory JWT tokens (`ACCESS_TOKENS` dict). Restarting the backend invalidates all sessions — users must re-login.
- The database is PostgreSQL on `localhost:5433` (user: `postgres`, password: `postgres`, db: `gblrecover`).
- The frontend proxies API calls to `http://localhost:8000` (configured via `VITE_API_URL` env var, defaults to that).

### Data Volumes (from Excel)

| Table | Rows |
|-------|------|
| clients | 47 719 |
| comptes | 50 606 |
| factures | 293 502 |
| agences | 179 |
| centres | 18 |
| gestionnaires | 595 |
| paiements | 0 (not in Excel) |
