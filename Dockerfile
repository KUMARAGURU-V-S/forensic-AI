# ── Stage 1: Build React frontend ──────────────────────────────
FROM node:20-alpine AS frontend-builder

WORKDIR /frontend
COPY frontend/package.json frontend/package-lock.json* ./
RUN npm install

COPY frontend/ ./
RUN npm run build

# ── Stage 2: Python + Nginx + Supervisor runtime ────────────────
FROM python:3.11-slim

RUN apt-get update && apt-get install -y \
    nginx \
    supervisor \
    && rm -rf /var/lib/apt/lists/*

RUN useradd -m -u 1000 user
ENV HOME=/home/user PATH=/home/user/.local/bin:$PATH

WORKDIR $HOME/app

COPY backend/requirements.txt ./
RUN pip install --no-cache-dir --upgrade -r requirements.txt

COPY --chown=user backend/ ./backend/
COPY --chown=user langgraph-agents/ ./langgraph-agents/
COPY --from=frontend-builder /frontend/dist ./frontend/dist/

COPY --chown=user nginx.conf /etc/nginx/nginx.conf
COPY --chown=user supervisord.conf /etc/supervisor/conf.d/supervisord.conf

RUN mkdir -p /var/log/nginx /var/lib/nginx/body /run /tmp \
    && chown -R user:user /var/log/nginx /var/lib/nginx /run /etc/nginx /tmp

USER user

EXPOSE 7860

CMD ["/usr/bin/supervisord", "-c", "/etc/supervisor/conf.d/supervisord.conf"]
