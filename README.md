# Indian Multi-Tenant Billing SaaS

Enterprise billing for hospitals, schools, commercial, clinics, retail, and generic businesses — Indian GST, split payments (Cash / UPI / Card), branded tax invoices, SuperAdmin client provisioning.

**Domain:** `https://billing.indiansoftwareservices.com`  
**Stack:** NestJS + Prisma + Postgres + React/Vite + Docker + nginx  
**Location:** `/opt/billing` (sibling of SchoolERP; separate DB and containers)

## Features

- SuperAdmin creates tenants with Client IDs (`CLI-XXXXXXXX`) and business profiles
- Profile-driven labels (UHID / Admission No / Customer Code) and invoice titles
- GST: CGST/SGST/IGST, HSN/SAC, B2B/B2C, FY bill numbers (`INV-{FY}-{seq}`)
- Split payments with validation (sum must equal grand total)
- Brand templates (header/footer/logo) + PDF via Puppeteer
- Storage: Google Cloud Storage when configured, else local disk
- E-invoice columns + `NullEinvoiceProvider` until GSP credentials are supplied
- Reports: day book, collections by mode, GSTR-1 JSON export
- Credit / debit notes, void, audit log, throttling

## Roles

| Role | Scope |
|------|--------|
| SUPER_ADMIN | Platform — Client ID `PLATFORM` |
| CLIENT_ADMIN | Tenant settings, users, branding, GST |
| BILLING_OPERATOR | Create / print bills |
| ACCOUNTANT | Reports, void, CN/DN |
| VIEWER | Read-only |

## Quick start (local)

```bash
cd /opt/billing
cp .env.example .env
# edit JWT_SECRET, passwords

docker compose up postgres -d

cd backend
# Node 22+ required, or use Docker:
docker run --rm -v "$PWD":/app -w /app --network host \
  -e DATABASE_URL=postgresql://billing:billing@127.0.0.1:5434/billing \
  -e JWT_SECRET=dev-secret \
  node:22-bookworm-slim bash -c \
  "apt-get update -qq && apt-get install -y -qq openssl >/dev/null && npm ci && npx prisma migrate deploy && npx prisma db seed"

# Or with host Node:
export DATABASE_URL=postgresql://billing:billing@localhost:5434/billing
export JWT_SECRET=dev-secret
npm ci && npx prisma migrate deploy && npx prisma db seed
npm run start:dev
```

Frontend:

```bash
cd /opt/billing/frontend
npm ci && npm run dev
```

**Default SuperAdmin login**

- Client ID: `PLATFORM`
- Email: `admin@indiansoftwareservices.com` (or `SEED_SUPERADMIN_EMAIL`)
- Password: from `SEED_SUPERADMIN_PASSWORD` (see `.env.example`)

## Production deploy

```bash
cd /opt/billing
cp .env.example .env   # fill secrets + GCS if ready
docker compose -f docker-compose.prod.yml --env-file .env up -d --build
```

Containers: `billing-postgres`, `billing-backend`, `billing-frontend` on network `billing_prod`.

### Nginx + TLS

1. Point DNS `billing.indiansoftwareservices.com` A/AAAA to this server.
2. Include [`deploy/nginx/billing.conf`](deploy/nginx/billing.conf) in the edge nginx (same pattern as SchoolERP).
3. Issue cert:

```bash
certbot certonly --webroot -w /var/www/certbot \
  -d billing.indiansoftwareservices.com
```

4. Reload nginx. Ensure the edge proxy can reach `billing_prod` (connect networks if needed):

```bash
docker network connect billing_prod <edge-nginx-container>
```

### Google Cloud Storage

Set in `.env`:

```
STORAGE_DRIVER=gcs
GCS_PROJECT_ID=...
GCS_BUCKET=...
GCS_CLIENT_EMAIL=...
GCS_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
```

Leave unset to use local uploads volume (`STORAGE_DRIVER=local`).

### E-invoice

`EINVOICE_PROVIDER=null` stores payload and sets status; wire a real GSP later without schema changes.

## API overview

| Area | Prefix |
|------|--------|
| Auth | `POST /api/auth/login`, `GET /api/auth/me` |
| Platform | `/api/platform/tenants` |
| Tenant | `/api/tenants/me`, `/api/tenants/users` |
| Masters | `/api/parties`, `/api/items`, `/api/gst/settings` |
| Billing | `/api/invoices`, finalize / void / print |
| Branding | `/api/branding` |
| Reports | `/api/reports/day-book`, `/collections`, `/gstr1` |

## Tests

```bash
cd /opt/billing/backend && npm test
```

Includes GST helpers and tenant-isolation contract tests.

## Out of scope (Phase 1)

- Live IRP/GSTN push (adapter stub only)
- Tally / double-entry accounting
- Pharmacy stock / EMR
- Native mobile apps
