# Flutter Mobile App — Master Build Prompt (Antigravity)

> **How to use:** Copy everything from the line `=== COPY START ===` through `=== COPY END ===` into Antigravity (or any coding agent).  
> Production API base: `https://billing.indiansoftwareservices.com/api`  
> Existing web app: React/Vite SPA against the same NestJS + Prisma + Postgres backend.  
> **Do not invent endpoints.** Use only the catalog in this prompt. Mirror web behaviour.

---

=== COPY START ===

# ROLE

You are a senior Flutter engineer building a **production-grade multi-tenant GST billing mobile app (India)** that consumes an **existing NestJS REST API**. The web product already works. Your job is to ship a **compatible Flutter client** (Android + iOS) that reuses the same backend, auth, roles, money math, and business rules — **no parallel backend, no fake APIs**.

# PRODUCT

**Indian Softwares Services — GST Billing SaaS**

- Multi-tenant billing for shops / clinics / generic businesses
- Tax invoices, credit/debit notes, partial payments / dues, parties, items, godowns/stock, purchases, e-way (optional), notes, reports
- Feature flags per subscription plan (`stock`, `partialPay`, `eway`, `pos`, `whatsapp`, `csvImport`, `notes`, `creditNotes`, `smtp`)
- Roles: `CLIENT_ADMIN`, `BILLING_OPERATOR`, `ACCOUNTANT`, `VIEWER` (mobile is **tenant staff only** — do **not** build SUPER_ADMIN / platform console)

# NON-NEGOTIABLES

1. **Base URL:** configurable `API_BASE` default `https://billing.indiansoftwareservices.com/api`
2. **Auth:** `POST /auth/login` with `{ clientId, email, password }` → store `accessToken` securely (flutter_secure_storage). Every authenticated call: `Authorization: Bearer <token>`
3. **Tenant isolation:** JWT carries `tenantId` — **never** send tenant headers; never hardcode tenant IDs
4. **Money:** Request bodies use JSON **numbers**. Response Prisma Decimals often arrive as **strings** — parse safely (`num.tryParse` / custom `Money` helper). Display with Indian format `₹` and 2 decimals
5. **Validation:** Backend uses `forbidNonWhitelisted` — unknown JSON keys → 400. Match DTO field names exactly
6. **Roles & features:** Gate screens/actions with role + `GET /billing/features`
7. **Offline:** Phase 1–3 online-only. Later: queue print/share and cache masters (parties/items) optionally
8. **Do not** implement platform admin, Razorpay webhooks, or GSP e-invoice provider UI beyond what the API returns
9. **Architecture:** Clean layered Flutter — `data` (API/DTOs) → `domain` (use-cases) → `presentation` (Riverpod or Bloc). Prefer **Riverpod + go_router + dio**
10. **UX:** Material 3, dark/light, professional billing look (teal/navy like web). No purple AI-slop theme. Large tap targets for POS-like bill entry

# TECH STACK (required)

| Layer | Choice |
|-------|--------|
| Flutter | Stable 3.24+ |
| State | Riverpod 2.x |
| Routing | go_router |
| HTTP | dio + interceptors (auth, 401→logout, logging in debug) |
| Models | freezed + json_serializable (or Dart records + manual fromJson) |
| Secure storage | flutter_secure_storage |
| Forms | reactive_forms or Formz |
| PDF/Print | open `signedUrl` / WebView HTML from print API; share_plus |
| Intl | intl (en_IN currency) |
| Env | `--dart-define=API_BASE=...` |

# APP INFORMATION ARCHITECTURE

```
Splash → Login (clientId + email + password)
  → Shell (bottom nav / adaptive navigation)
      Overview: Dashboard
      Billing: New Bill | POS (if feature) | Bills
      Masters: Parties | Items | Godowns (if stock)
      Ops: Purchases | E-way (if feature) | Notes (if feature)
      Insights: Reports | Receivables
      Account: Profile | Change password | Subscription/features (read) | Privacy policy (open https://billing.indiansoftwareservices.com/privacy) | Contact us (open https://billing.indiansoftwareservices.com/contact) | Logout
```

Hide menu items the role/feature cannot use.

On login and Account screens, link **Privacy policy** and **Contact us** to the hosted web URLs above (external browser / in-app WebView). Do not re-implement those pages in Flutter.

# USER FLOWS (implement exactly)

## A. Login
1. User enters **Client ID** (tenant code, uppercased by server), email, password
2. `POST /auth/login`
3. Persist token + user snapshot
4. Call `GET /auth/me`, `GET /tenants/me`, `GET /billing/features`, `GET /billing/subscription` in parallel
5. Route to Dashboard

## B. Create tax invoice (New Bill)
1. Search party: `GET /parties/search?q=`
2. Search/add lines from `GET /items/search?q=` or free-text line (+ optional save-to-catalog via `POST /items`)
3. Optional godown per line if stock feature: `GET /godowns`
4. Payments: CASH / UPI / CARD; UPI requires `upiRefId`; CARD requires `cardLast4` (4 digits)
5. Partial pay allowed if feature `partialPay` — amountPaid ≤ grandTotal; set dueDate when balance due
6. `POST /invoices` with `finalize: true` (or false for draft)
7. On success → Bill detail; optional `POST /invoices/:id/print` → open PDF/HTML

## C. Bills register
1. `GET /invoices?from=&to=&status=&paymentStatus=&documentType=&q=&partyId=`
2. Open detail `GET /invoices/:id`
3. Draft → edit via `PATCH /invoices/:id` then finalize
4. Record payment `POST /invoices/:id/payments`
5. Void (Admin/Accountant) `POST /invoices/:id/void` `{ reason }`
6. Soft delete / recycle bin flows as per roles

## D. POS (feature `pos`)
Fast cart: barcode/name search items → charge one payment mode → `POST /invoices` finalize true, notes `"POS sale"`

## E. Stock (feature `stock`)
Godowns CRUD, stock table, transfer `POST /inventory/transfer`, adjust stock on items

## F. Purchases
Create vendor bill with lines → stock in; void reverses per backend

## G. Reports
Day book, collections by mode, receivables; GSTR-1 / ITC for Admin/Accountant

---

# PHASED DELIVERY PLAN

Ship in phases. Each phase must be **demoable**, with tests for API models and critical use-cases. Do not skip phase gates.

## Phase 0 — Project foundation (Day 1)
- Flutter project, flavors `dev`/`prod`
- dio client, secure token store, 401 handler
- Theme (light/dark), typography, `Money` + `InrFormat` utils
- go_router auth redirect
- Health check `GET /health`
- **Gate:** Login screen UI + successful token store against real API

## Phase 1 — Auth & shell
- Login, logout, change password
- `/auth/me`, `/tenants/me`, profile labels from profile-config
- Role-aware drawer/bottom nav
- Feature flags service
- Account screen
- **Gate:** Operator can log in and see empty Dashboard with correct menus

## Phase 2 — Masters
- Parties: list/search/create/edit (CSV import can be Phase 5)
- Items: list/search/create/edit; stock adjust dialog if `trackStock`
- Godowns + stock list + transfer if `stock`
- **Gate:** Create party + item + godown end-to-end

## Phase 3 — Invoicing core (MVP)
- New Bill (full line editor, payments, partial due, due date)
- Bills list with professional filters
- Bill detail: print, share email (if configured), WhatsApp if feature
- Draft edit `PATCH /invoices/:id`
- Record payment
- Void + soft delete (role-gated)
- **Gate:** Raise finalized invoice, print HTML/PDF, record partial payment

## Phase 4 — POS + receivables UX
- POS screen
- Receivables report + deep-link to bill
- Dashboard today summary (reuse invoices list + collections)
- Credit/debit notes if feature `creditNotes`
- **Gate:** POS sale + due collection from mobile

## Phase 5 — Purchases, e-way, notes, reports
- Purchases list/create/void
- E-way list/create/cancel (feature `eway`)
- Notes CRUD (feature `notes`)
- Reports: day-book, collections-by-mode, gstr1, itc
- Recycle bin
- CSV import (optional; file_picker)
- **Gate:** Full ops parity for daily shop use

## Phase 6 — Hardening
- Error mapping (ApiException from Nest messages)
- Retry/timeouts, pagination if lists grow
- Accessibility, tablet layouts
- Integration tests against staging
- App Store / Play compliance (privacy, permissions)
- Performance: image/logo caching if branding used
- **Gate:** Release candidate

---

# COMPLETE API CATALOG (mobile-relevant)

Base: `{API_BASE}` = `https://billing.indiansoftwareservices.com/api`  
Headers: `Content-Type: application/json` + `Authorization: Bearer <token>` (except public)

## Public / health
| Method | Path | Auth | Notes |
|--------|------|------|-------|
| GET | `/health` | no | `{ status, timestamp }` |
| GET | `/public/plans` | no | subscription plans |
| GET | `/public/payment-mode` | no | razorpay \| manual |
| POST | `/public/inquiries` | no | lead form (optional in app) |

## Auth
| Method | Path | Body / query | Roles |
|--------|------|--------------|-------|
| POST | `/auth/login` | `{ clientId, email, password }` → `{ accessToken, user }` | public |
| GET | `/auth/me` | — | JWT |
| POST | `/auth/change-password` | `{ currentPassword, newPassword }` | JWT |

**User object:** `id, email, firstName, lastName, role, tenantId, clientId, tenantName, profileType`

## Tenant
| Method | Path | Notes | Roles |
|--------|------|-------|-------|
| GET | `/tenants/me` | tenant + profileConfig | all |
| GET | `/tenants/profile-config` | labels | all |
| PATCH | `/tenants/profile-config` | `{ invoiceTitle?, partyLabel?, partyIdLabel?, customFieldSchema? }` | CLIENT_ADMIN |
| GET | `/tenants/users` | team | CLIENT_ADMIN |
| POST | `/tenants/users` | `{ email, password, firstName, lastName, role?, phone? }` | CLIENT_ADMIN |
| PATCH | `/tenants/users/:id` | `{ role?, isActive?, firstName?, lastName?, phone? }` | CLIENT_ADMIN |

## Billing (tenant)
| Method | Path | Notes | Roles |
|--------|------|-------|-------|
| GET | `/billing/features` | boolean map | all |
| GET | `/billing/subscription` | plan + usage | all |
| POST | `/billing/checkout` | `{ planId, billingCycle: MONTHLY\|YEARLY }` | CLIENT_ADMIN |
| POST | `/billing/checkout/verify` | Razorpay verify | CLIENT_ADMIN |

**Feature keys:** `whatsapp, csvImport, smtp, stock, partialPay, creditNotes, notes, eway, pos`

## GST settings
| Method | Path | Roles |
|--------|------|-------|
| GET | `/gst/settings` | all |
| PUT | `/gst/settings` | CLIENT_ADMIN |

## Parties
| Method | Path | Notes | Roles |
|--------|------|-------|-------|
| GET | `/parties` | `?all=true` inactive too | all |
| GET | `/parties/search` | `?q=&take=` | all |
| GET | `/parties/:id` | | all |
| POST | `/parties` | create | Admin, Operator |
| PATCH | `/parties/:id` | update | Admin, Operator |
| DELETE | `/parties/:id` | | Admin, Operator |
| GET | `/parties/import/template` | CSV | Admin, Operator |
| POST | `/parties/import` | multipart `file` | Admin, Operator |

**Party fields:** `name` required; optional `phone, email, address, city, state, stateCode, pincode, gstin, externalId, referredBy, customFields, isActive`

## Items
| Method | Path | Notes | Roles |
|--------|------|-------|-------|
| GET | `/items` | `?all=true` | all |
| GET | `/items/search` | `?q=&take=` | all |
| GET | `/items/:id` | | all |
| POST | `/items` | create | Admin, Operator |
| PATCH | `/items/:id` | no stockQty | Admin, Operator |
| DELETE | `/items/:id` | | Admin, Operator |
| POST | `/items/:id/stock` | `{ qtyDelta, note? }` feature stock | Admin, Operator |
| GET | `/items/:id/movements` | | all |
| GET/POST | `/items/import/template`, `/items/import` | feature csvImport | Admin, Operator |

**Item fields:** `name, rate` required; optional `description, hsnSac, unit, gstRate, barcode, trackStock, stockQty` (create only)

## Invoices
| Method | Path | Notes | Roles |
|--------|------|-------|-------|
| GET | `/invoices` | filters below | all |
| GET | `/invoices/:id` | include lines, payments, actors | all |
| POST | `/invoices` | create (± finalize) | Admin, Operator |
| PATCH | `/invoices/:id` | **DRAFT only** update | Admin, Operator |
| PATCH/POST | `/invoices/:id/finalize` | deducts stock if TAX_INVOICE | Admin, Operator |
| PATCH/POST | `/invoices/:id/void` | `{ reason }` | Admin, Accountant |
| POST | `/invoices/:id/payments` | add payment | Admin, Op, Acc |
| POST | `/invoices/credit-notes` | + `referenceInvoiceId` | Admin, Op, Acc |
| POST | `/invoices/debit-notes` | + `referenceInvoiceId` | Admin, Op, Acc |
| DELETE | `/invoices/:id` | soft delete | Admin, Op, Acc |
| POST | `/invoices/:id/restore` | | Admin, Op, Acc |
| DELETE | `/invoices/:id/permanent` | | CLIENT_ADMIN |
| GET | `/invoices/recycle-bin` | | Admin, Op, Acc |
| POST | `/invoices/recycle-bin/empty` | | CLIENT_ADMIN |
| POST | `/invoices/:id/print` | `{ html, gcsKey?, publicPath?, signedUrl? }` | all |
| POST | `/invoices/:id/share/email` | `{ to, message? }` | Admin, Operator |
| POST | `/invoices/:id/share/whatsapp` | `{ toE164, message? }` feature whatsapp | Admin, Operator |

**List query:** `from, to, status, paymentStatus, documentType, q, partyId, fy`  
**status:** `DRAFT|FINALIZED|VOID`  
**paymentStatus:** `UNPAID|PARTIAL|PAID`  
**documentType:** `TAX_INVOICE|CREDIT_NOTE|DEBIT_NOTE`

**Create / update draft body:**
```json
{
  "partyId": "uuid?",
  "partyName": "string",
  "partyPhone": "string?",
  "partyAddress": "string?",
  "partyGstin": "string?",
  "partyStateCode": "string?",
  "partyExternalId": "string?",
  "referredBy": "string?",
  "placeOfSupply": "string?",
  "supplyType": "B2B|B2C|B2CL?",
  "reverseCharge": false,
  "invoiceDate": "YYYY-MM-DD?",
  "dueDate": "YYYY-MM-DD?",
  "notes": "string?",
  "discountAmount": 0,
  "lines": [
    {
      "itemId": "uuid?",
      "description": "string",
      "hsnSac": "string?",
      "unit": "NOS?",
      "qty": 1,
      "rate": 0,
      "discount": 0,
      "gstRate": 18,
      "godownId": "uuid?"
    }
  ],
  "payments": [
    {
      "mode": "CASH|UPI|CARD",
      "amount": 0,
      "upiRefId": "string?",
      "cardLast4": "1234?",
      "notes": "string?"
    }
  ],
  "finalize": true
}
```
Notes: `qty` is integer ≥ 1 on invoices. Payment total cannot exceed grand total. Draft create does **not** deduct stock; finalize / create finalized TAX_INVOICE does.

**Add payment body:** `{ "mode": "CASH|UPI|CARD", "amount": 0.01, "upiRefId?", "cardLast4?", "notes?" }`

## Purchases
| Method | Path | Roles |
|--------|------|-------|
| GET | `/purchases` | all |
| GET | `/purchases/:id` | all |
| POST | `/purchases` | Admin, Op, Acc |
| POST | `/purchases/:id/void` | Admin, Acc |

**Create:**
```json
{
  "vendorId": "uuid?",
  "vendorName": "string",
  "vendorGstin": "string?",
  "vendorPhone": "string?",
  "godownId": "uuid?",
  "billDate": "YYYY-MM-DD?",
  "notes": "string?",
  "interstate": false,
  "lines": [
    {
      "itemId": "uuid?",
      "description": "string",
      "hsnSac": "string?",
      "unit": "string?",
      "qty": 1,
      "rate": 0,
      "gstRate": 18
    }
  ]
}
```

## Godowns & inventory
| Method | Path | Body / query | Roles |
|--------|------|--------------|-------|
| GET | `/godowns` | | all |
| POST | `/godowns` | `{ name, code?, address?, isDefault? }` | Admin, Op |
| PATCH | `/godowns/:id` | `{ name?, code?, address?, isDefault?, isActive? }` | Admin, Op |
| GET | `/inventory/stock` | `?godownId=` | all |
| POST | `/inventory/transfer` | `{ itemId, fromGodownId, toGodownId, qty, note? }` | Admin, Op |
| POST | `/inventory/items/:itemId/godowns/:godownId/adjust` | `{ qtyDelta, note? }` | Admin, Op |

## E-way (feature `eway`)
| Method | Path | Roles |
|--------|------|-------|
| GET | `/eway` | all |
| GET | `/eway/:id` | all |
| POST | `/eway` | Admin, Op, Acc |
| POST | `/eway/:id/cancel` | Admin, Acc `{ reason? }` |

**Create:** `{ invoiceId, fromPlace?, toPlace?, transporterName?, transporterId?, vehicleNo?, distanceKm?, documentValue? }`

## Notes (feature `notes`)
| Method | Path | Roles |
|--------|------|-------|
| GET | `/notes` | `?partyId=` | all |
| GET | `/notes/:id` | all |
| POST | `/notes` | `{ title, body?, partyId?, invoiceId?, pinned?, remindAt? }` | Admin, Op, Acc |
| PATCH | `/notes/:id` | same optional | Admin, Op, Acc |
| DELETE | `/notes/:id` | Admin, Op |

## Reports
| Method | Path | Query | Roles |
|--------|------|-------|-------|
| GET | `/reports/day-book` | `from, to` | all |
| GET | `/reports/collections` | `from, to` | all |
| GET | `/reports/collections-by-mode` | `from, to` | all |
| GET | `/reports/receivables` | — | all |
| GET | `/reports/gstr1` | `from, to` | Admin, Acc |
| GET | `/reports/itc` | `from?, to?` | Admin, Acc, Viewer |

## Audit (optional mobile)
| Method | Path | Roles |
|--------|------|-------|
| GET | `/audit?take=` | typically Admin |

## Branding / integrations (optional Phase 6+)
| Method | Path | Roles |
|--------|------|-------|
| GET/PUT | `/branding`, `/branding/template` | Admin for write |
| POST/DELETE | `/branding/logo`, `/branding/banner` | Admin |
| GET/PUT | `/integrations` | Admin |
| POST | `/integrations/test-email` | Admin |

## OUT OF SCOPE for mobile v1
- `/platform/**` SUPER_ADMIN console
- Razorpay webhook endpoint
- Direct GSP/NIC e-invoice credentials UI beyond GST settings fields

---

# ROLE MATRIX (enforce in UI)

| Action | CLIENT_ADMIN | BILLING_OPERATOR | ACCOUNTANT | VIEWER |
|--------|:---:|:---:|:---:|:---:|
| Create/edit/finalize invoice | ✓ | ✓ | | |
| Void invoice | ✓ | | ✓ | |
| Add payment | ✓ | ✓ | ✓ | |
| Soft delete / restore | ✓ | ✓ | ✓ | |
| Permanent delete / empty bin | ✓ | | | |
| Parties/items write | ✓ | ✓ | | |
| Stock / godown write | ✓ | ✓ | | |
| Purchases create | ✓ | ✓ | ✓ | |
| Purchase void | ✓ | | ✓ | |
| E-way create | ✓ | ✓ | ✓ | |
| E-way cancel | ✓ | | ✓ | |
| Notes write | ✓ | ✓ | ✓ | |
| Notes delete | ✓ | ✓ | | |
| Users / GST settings write | ✓ | | | |
| Reports (basic) | ✓ | ✓ | ✓ | ✓ |
| GSTR-1 | ✓ | | ✓ | |

---

# ERROR HANDLING

Nest returns JSON like `{ statusCode, message, error }` — `message` may be string or string[].  
Map to user-friendly snackbars. Special cases:
- 401 → clear token → Login
- 403 → “You don’t have permission”
- Insufficient stock → show exact backend message
- Payment exceeds total → show backend message

---

# DATA PARSING RULES

```dart
double money(dynamic v) {
  if (v == null) return 0;
  if (v is num) return v.toDouble();
  return double.tryParse(v.toString()) ?? 0;
}
```
Serialize request amounts as numbers, not strings.  
Dates: send `YYYY-MM-DD` for date-only fields.

---

# ACCEPTANCE CRITERIA (release)

1. Login with real tenant clientId works against production/staging API
2. Create party, item, raise tax invoice with GST split, print bill
3. Partial payment updates `paymentStatus` and receivables
4. Draft edit via PATCH works; finalize deducts stock when tracked
5. Role VIEWER cannot create invoices (UI + API)
6. Feature-gated menus respect `/billing/features`
7. No crashes on Decimal-as-string fields
8. Dark mode usable for shop floor
9. Phases 0–3 complete = MVP store-internal build; 0–5 = feature parity for daily ops

---

# IMPLEMENTATION ORDER FOR THE AGENT

1. Scaffold Flutter app + dio + secure storage + theme
2. Implement AuthRepository + Login + Shell
3. Generate/write DTOs for Party, Item, Invoice, Payment, Godown matching this catalog
4. Build Parties + Items
5. Build New Bill + Bills list/detail (Phase 3 MVP)
6. Continue phases 4–6 without changing API contracts
7. After each phase: write a short CHANGELOG and manual test checklist

When unsure about a field, **read this catalog again** — do not invent endpoints. If something is missing, implement a graceful “not available on mobile yet” empty state rather than mocking the backend.

# DEFINITION OF DONE PER SCREEN

- Loading, empty, error, success states
- Pull-to-refresh on lists
- Filters where the web app has them (bills, parties, items, etc.)
- Confirm dialogs for void/delete/cancel
- Amounts formatted `en_IN`

Start now with **Phase 0 + Phase 1**.

=== COPY END ===

---

## Quick reference for humans

| Item | Value |
|------|--------|
| API | `https://billing.indiansoftwareservices.com/api` |
| Login | `POST /api/auth/login` `{ clientId, email, password }` |
| Auth header | `Authorization: Bearer <accessToken>` |
| Privacy policy (web + app WebView / external browser) | `https://billing.indiansoftwareservices.com/privacy` |
| Contact us (enquiry form) | `https://billing.indiansoftwareservices.com/contact` |
| Web parity target | `/opt/billing/frontend` screens under `/app/*` |
| Backend source | `/opt/billing/backend/src/**/*.controller.ts` |

After Antigravity finishes Phase 3, verify against a real tenant: create invoice → print → record partial payment → check Bills filters.
