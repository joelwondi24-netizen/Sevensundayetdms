# Seven Sunday Ethiopia Manufacturing & Trading PLC
## Production Deployment, Security & Recovery Guide

### 1. System Architecture
- **Frontend**: React 19, TypeScript, Tailwind CSS v4, Vite (`npm run build` outputs `dist/`).
- **Backend**: Node.js + Express + WebSockets (`ws`) serving both REST API (`/api/*`), real-time sync (`/ws`), and static SPA assets (`server.ts`).
- **Database**: SQLite in WAL mode (`data/sevensunday.db`) with foreign-key enforcement, indexed tenant queries, AES-256-GCM encrypted secret columns, and automated online backups (`data/backups/`).

---

### 2. Environment Configuration
Copy `.env.example` to `.env` and configure production values:
1. Set `NODE_ENV=production` and `PORT=3000`.
2. Set `APP_ENCRYPTION_KEY` to a high-entropy 32+ byte secret (e.g. `openssl rand -hex 32`).
3. Configure corporate SMTP (`SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM`) either via environment variables or inside **System Administration → Backup, Reset & SMTP** (stored AES-256-GCM encrypted).
4. Optional: Set `GOOGLE_CLIENT_ID` if enabling verified Google Identity Services ID-token authentication.

---

### 3. Build & Run
```bash
npm install
npm run lint
npm run build
NODE_ENV=production npx tsx server.ts
```

---

### 4. HTTPS / TLS Reverse Proxy (Recommended for Production)
Run the Node.js server behind Nginx or Caddy with TLS 1.2/1.3 termination:
```nginx
server {
    listen 443 ssl http2;
    server_name portal.sevensundayethiopia.com;

    ssl_certificate /etc/letsencrypt/live/portal.sevensundayethiopia.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/portal.sevensundayethiopia.com/privkey.pem;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header X-Forwarded-Host $host;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    }
}
```

---

### 5. Security Safeguards Enabled
- **Password Hashing**: Node `crypto.scryptSync` (N=16384, r=8, p=1) with 16-byte random salt and `crypto.timingSafeEqual`.
- **Brute-Force Lockout & Rate Limiting**: Sliding-window per-IP rate limits on `/api/auth/*` and `/api/*`; 5 consecutive failed logins trigger a 15-minute account lock with audit & security notification.
- **MFA (TOTP RFC 6238)**: 6-digit authenticator app verification enrollable in **Synchronization Center → MFA & Session Security**.
- **At-Rest Field Encryption**: AES-256-GCM encryption for SMTP passwords, device API keys, TOTP MFA secrets, and notification tokens.
- **Session & Device Control**: SHA-256 hashed Bearer tokens held strictly in client memory, active session listing, and one-click remote session revocation.
- **Role-Based Access Control (RBAC)**: Server-side role & module/action enforcement across HR, Salary, Payroll, Finance, Backups, and Admin routes.

---

### 6. Automated Backups & Disaster Recovery
- **Automated Snapshots**: `server.ts` executes atomic SQLite online backups (`db.backup`) into `data/backups/` every 6 hours, retaining the 15 most recent snapshots.
- **Manual Snapshots & JSON Export**: Trigger on-demand `.db` snapshots or download full JSON dumps from **Synchronization Center** or **Company Administration**.
- **Restore Procedure**:
  1. Stop the server cleanly.
  2. Copy a verified snapshot from `data/backups/sevensunday-*.db` to `data/sevensunday.db` (removing stale `-wal`/`-shm` files if present).
  3. Restart the server and verify integrity via `/api/health`.

---

### 7. Scaling to PostgreSQL & Redis (Multi-Instance)
For multi-region or multi-node deployments:
1. Provision managed PostgreSQL 16+ and Redis 7+.
2. Export existing tenant data via `/api/backup/export` and import into PostgreSQL tables preserving `tenant_id` partitioning.
3. Move `auth_sessions` and rate-limiter buckets to Redis (`EX` TTL keys) for shared multi-instance session validation.
