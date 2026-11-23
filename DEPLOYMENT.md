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
- **Brute-Force Lockout, Monitoring & Rate Limiting**: Sliding-window per-IP rate limits on `/api/auth/*` and `/api/*`; 5 consecutive failed logins trigger a 15-minute account lock with persistent `login_attempts` logging (`/api/auth/login-attempts`), audit trail, and security notification.
- **MFA (TOTP RFC 6238)**: 6-digit authenticator app verification enrollable in **Synchronization Center → MFA & Session Security**.
- **At-Rest Field Encryption**: AES-256-GCM encryption for SMTP passwords, device API keys, TOTP MFA secrets, and notification tokens.
- **Session & Device Control**: SHA-256 hashed Bearer tokens held strictly in client memory, active session listing, one-click remote session revocation, and Company Device + Company Code security enforcement.
- **Granular Role-Based Access Control (RBAC) & Scoping**: Server-side enforcement of role privileges (`view`, `create`, `edit`, `delete`, `approve`, `export`, `manage`) plus self/department scoping on HR, Attendance, Leave, Scheduling, Payroll, Finance, Backups, and Admin routes.
- **ZKTeco K40 Real-Time Biometric Integration**: Supports direct TCP port `4370` (`CMD_STARTENROLL` / `CMD_REG_EVENT`), ADMS HTTP Push (`/iclock/cdata`), LAN Bridge script, and local hardware WebAuthn fingerprint readers with live scanner status indicators (`connecting` → `scanning` → `success` / `error`) and automated Attendance Check-In / Check-Out recording.

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

---

### 8. Render Deployment & Firebase Authorized Domains
When hosting the application on **Render** (e.g. `https://<your-service>.onrender.com`):
1. **Render Environment Variables**:
   - Set `NODE_ENV=production` and `PORT=3000`.
   - Attach a Render Persistent Disk (e.g. mounted at `/var/data`) and set `DATA_DIR=/var/data` so `sevensunday.db`, backups, and keys survive redeploys.
   - Set `APP_ENCRYPTION_KEY` to a 32+ byte secret (`openssl rand -hex 32`).
   - Set `VITE_RENDER_DOMAIN=<your-service>.onrender.com` before running `npm run build` so `src/lib/firebase.ts` includes your exact Render hostname in `FIREBASE_DOMAIN_WHITELIST`.
   - Keep `VITE_FIREBASE_AUTH_DOMAIN` unset (defaulting to `gen-lang-client-0397627314.firebaseapp.com`), **or** only set `VITE_FIREBASE_AUTH_DOMAIN=<your-service>.onrender.com` with `VITE_FIREBASE_USE_CUSTOM_AUTH_DOMAIN=true` if Render reverse-proxies `/__/auth/*` to Firebase Hosting.
2. **Firebase Console → Authorized Domains (Required for Google Sign-In on Render)**:
   - Open [Firebase Console Authentication Settings](https://console.firebase.google.com/project/gen-lang-client-0397627314/authentication/settings).
   - Under **Authorized domains**, click **Add domain** and add `<your-service>.onrender.com` (and any custom corporate domain such as `portal.sevensundayethiopia.com`).

