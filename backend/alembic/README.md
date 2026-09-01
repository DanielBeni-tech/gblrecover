Alembic setup for GBLRecover backend

Usage:

1. Activate the backend virtualenv:

```bash
source backend/.venv/bin/activate
```

2. Ensure `DATABASE_URL` is set or edit `backend/alembic.ini` to include a valid `sqlalchemy.url`.

3. Run migrations:

```bash
alembic -c backend/alembic.ini upgrade head
```

Notes:
- The initial revision `0001_initial_schema.py` executes `database/schema.sql` as a baseline.
- Review the generated SQL before running in production.
