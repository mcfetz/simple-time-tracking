# Stage 1: Build Frontend
FROM node:20-alpine AS frontend-builder
WORKDIR /app/frontend
COPY frontend/package*.json ./
RUN npm ci
COPY frontend ./

# Set API base URL for production build (relative path for same-origin)
ENV VITE_API_BASE_URL=/api
RUN npm run build

# Stage 2: Build Backend & Runner
FROM python:3.12-slim
WORKDIR /app

# Install system dependencies
# gcc and libffi-dev are sometimes needed for python crypto/cffi packages
RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc \
    libffi-dev \
    && rm -rf /var/lib/apt/lists/*

# Install Python dependencies
# Convert pyproject.toml deps to requirements format
RUN pip install --no-cache-dir \
    alembic>=1.18.4 \
    bcrypt>=5.0.0 \
    email-validator>=2.3.0 \
    fastapi>=0.128.7 \
    passlib[bcrypt]>=1.7.4 \
    pydantic-settings>=2.12.0 \
    python-jose[cryptography]>=3.5.0 \
    python-multipart>=0.0.22 \
    pywebpush>=2.3.0 \
    sqlalchemy>=2.0.46 \
    uvicorn[standard]>=0.40.0 \
    gunicorn

# Copy backend source
COPY backend/app /app/app
COPY backend/alembic /app/alembic
COPY backend/alembic.ini /app/alembic.ini

# Copy frontend build
COPY --from=frontend-builder /app/frontend/dist /app/frontend_dist

# Set default environment variables for production
ENV TT_ENV="prod"
ENV TT_BASE_URL="http://localhost:5000"
ENV TT_PUBLIC_APP_URL="http://localhost:5000"
ENV TT_FRONTEND_DIR="/app/frontend_dist"
ENV TT_SQLITE_PATH="/app/data/app.db"
ENV TT_JWT_SECRET_KEY="change-me-in-production"
ENV TT_COOKIE_SECURE="false"
ENV TT_COOKIE_SAMESITE="lax"
ENV TT_VAPID_PUBLIC_KEY=""
ENV TT_VAPID_PRIVATE_KEY=""
ENV TT_VAPID_SUBJECT="mailto:admin@example.com"
ENV TT_SMTP_HOST=""
ENV TT_SMTP_PORT="25"
ENV TT_SMTP_FROM=""
ENV TT_SMTP_USER=""
ENV TT_SMTP_PASSWORD=""
ENV TT_SMTP_STARTTLS="false"
ENV TT_SMTP_USE_TLS="false"

# Create directories for data
RUN mkdir -p /app/data && chmod 777 /app/data

EXPOSE 5000

# Create an entrypoint script
RUN echo '#!/bin/sh\n\
set -e\n\
echo "Running database migrations..."\n\
cd /app\n\
alembic upgrade head\n\
echo "Starting backend..."\n\
exec gunicorn -w 4 -b 0.0.0.0:5000 -k uvicorn.workers.UvicornWorker "app.main:app"\n\
' > /app/entrypoint.sh && chmod +x /app/entrypoint.sh

CMD ["/app/entrypoint.sh"]
