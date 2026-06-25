# HTTPS Setup Guide

The video call feature uses `navigator.mediaDevices.getUserMedia`, which requires a **secure context**:
- **HTTPS** — works
- **`http://localhost`** — works (browsers treat localhost as secure)
- **HTTP on a non-localhost IP/domain** — blocked by the browser

## Option A: Caddy (automatic TLS with Let's Encrypt)

### 1. DNS
Point a domain (e.g., `dashboard.example.com`) to `161.97.126.84`.

### 2. Install Caddy
```bash
apt install -y debian-keyring debian-archive-keyring apt-transport-https curl
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' | tee /etc/apt/sources.list.d/caddy-stable.list
apt update
apt install caddy
```

### 3. Configure Caddy
Create `/etc/caddy/Caddyfile`:
```
dashboard.example.com {
    reverse_proxy localhost:7503
    reverse_proxy /api/* localhost:7500
}
```

```bash
systemctl restart caddy
```

Caddy automatically provisions a Let's Encrypt certificate — no manual cert management.

### 4. Update Frontend Env
Change `VITE_API_URL` in `docker-compose.yml` to point to your domain, then rebuild:
```bash
docker compose build frontend && docker stop ag-dashboard-frontend && docker rm ag-dashboard-frontend && docker compose up -d --no-deps frontend
```

## Option B: Self-Signed Certificate (no domain needed)

### 1. Generate Certificate
```bash
mkdir -p /etc/ssl/private /etc/ssl/certs
openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
  -keyout /etc/ssl/private/selfsigned.key \
  -out /etc/ssl/certs/selfsigned.crt \
  -subj "/CN=161.97.126.84"
```

### 2. Install Nginx
```bash
apt install -y nginx
```

### 3. Configure Nginx
Create `/etc/nginx/sites-available/ag-dashboard`:
```nginx
server {
    listen 443 ssl;
    server_name 161.97.126.84;

    ssl_certificate /etc/ssl/certs/selfsigned.crt;
    ssl_certificate_key /etc/ssl/private/selfsigned.key;

    location / {
        proxy_pass http://localhost:7503;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }

    location /api/ {
        proxy_pass http://localhost:7500;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }

    location /socket.io/ {
        proxy_pass http://localhost:7500;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
    }
}

server {
    listen 80;
    server_name 161.97.126.84;
    return 301 https://$host$request_uri;
}
```

### 4. Enable Site
```bash
ln -sf /etc/nginx/sites-available/ag-dashboard /etc/nginx/sites-enabled/
nginx -t && systemctl restart nginx
```

### 5. Browser Warning
Users must accept the self-signed certificate warning on first visit (`https://161.97.126.84`).
