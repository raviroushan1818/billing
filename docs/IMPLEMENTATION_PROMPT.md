# Implementation prompt — India pricing, payments, notes

Copy-paste agent brief for finishing or extending this work.

## Goal

Ship India-priced subscription catalog (Starter/Growth/Business/Enterprise), Platform Admin full control of plans + subscriptions + Razorpay credentials (or manual UPI), tenant checkout, landing pricing, Credit/Debit Notes UI, and Workspace Notes.

## Seed prices (excl. GST)

| Code | Monthly | Annual | Users | Invoices/yr |
|------|---------|--------|-------|-------------|
| STARTER | 199 | 1999 | 2 | 1200 |
| GROWTH | 349 | 3499 | 5 | 6000 |
| BUSINESS | 599 | 5999 | 15 | 25000 |
| ENTERPRISE | custom | custom | custom | custom |

Trial: 14 days on Growth limits. Manual payment always available; Razorpay when Platform Admin enables gateway with encrypted keys.

## Phases

0. This doc  
1. Prisma models + migration + seed plans  
2. Platform plans/subs/payment-settings/analytics APIs  
3. Public plans + payment-mode; tenant billing checkout + Razorpay webhook  
4. Enforce trial/maxInvoices on invoice create  
5. Platform Admin UI (Plans, Subscriptions, Gateway)  
6. Tenant Billing page  
7. Landing pricing  
8. Credit/Debit Notes UI + Workspace Notes  
9. Deploy + SOP  
10. **Phase 2:** stock, partial payments/receivables, audit UI, change password, feature gates, HTTP e-invoice provider, ads playbook (`docs/ADS_PLAYBOOK.md`)
11. **Phase 3:** multi-godown + transfers, purchase bills (stock in), e-way stub, POS counter billing

## Phase 3 API

- `GET|POST /api/godowns`, `PATCH /api/godowns/:id`
- `GET /api/inventory/stock?godownId=`, `POST /api/inventory/transfer`
- `POST /api/inventory/items/:itemId/godowns/:godownId/adjust`
- `GET|POST /api/purchases`, `POST /api/purchases/:id/void`
- `GET|POST /api/eway`, `POST /api/eway/:id/cancel`

Feature gates: purchases/godowns need `stock` (Business+); e-way needs `eway` (Business+); POS UI is Growth+.

## SOP

1. Manual: customer pays UPI → Admin assigns subscription with `paymentRef`.  
2. Razorpay: Admin → Payment Gateway → paste Key ID/Secret/Webhook secret → Enable → tenant pays on Billing page.

## User documentation

- In-app: **Help** (`/app/help`) — interactive guide + new-user checklist  
- Repo: [`docs/USER_GUIDE.md`](USER_GUIDE.md)  
- Marketing site: landing section `#guide`
