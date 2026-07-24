FROM python:3.12-slim
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY . .
# Railway injects PORT; default to 8000 for local docker-compose.
# Migrations are idempotent (see app/db/migrate.py) so they run every boot.
CMD ["sh", "-c", "python -m app.db.migrate && uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8000}"]
