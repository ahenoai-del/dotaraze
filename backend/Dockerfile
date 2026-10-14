FROM python:3.12-slim
ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1
WORKDIR /app
COPY backend/requirements-lock.txt requirements.txt
RUN pip install --no-cache-dir -r requirements.txt && useradd --create-home --uid 10001 dotarise
COPY --chown=dotarise:dotarise backend/ .
USER dotarise
CMD ["sh", "-c", "exec uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8000} --workers 1 --no-proxy-headers --no-access-log"]
