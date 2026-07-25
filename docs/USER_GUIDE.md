# User guide — ISS GST Billing

Professional handbook for workspace owners, billing operators, and accountants.

Live in-app copy: **App → Help** (`/app/help`).

---

## 1. New user — first 15 minutes

1. Sign in with **Client ID**, email, and password.
2. Open **GST Settings** — verify GSTIN, legal name, address, state code, FY start.
3. Open **Branding** — logo / letterhead so PDFs look correct immediately.
4. Add a few **Parties** and **Items** (or CSV import).
5. Create one **New Bill**, finalize with Cash/UPI, print once.
6. Invite team members under **Users** (Owner only).
7. Change password under **Account**.

---

## 2. Daily billing

| Screen | Purpose |
|--------|---------|
| New Bill | Full GST invoice with party search, lines, payments |
| POS | Fast counter / walk-in checkout |
| Bills | Search, print, share, void, partial payments, credit/debit notes |

**Rules**

- Finalized bills are immutable — void or use credit/debit notes.
- Soft delete → Recycle Bin; permanent empty is Owner-only.
- UPI needs Ref ID; Card needs last 4 digits.

---

## 3. Masters

- **Parties** — customers with GSTIN / phone / external ID.
- **Items** — HSN, rate, GST%, barcode; enable **Track stock** when needed.
- CSV import available when the plan includes it.

---

## 4. Inventory & purchases (Business+)

- **Godowns** — locations, stock by godown, transfers.
- **Purchases** — vendor bills; tracked items increase stock at the chosen godown.
- Sales (New Bill / POS) pick a **godown per line** (or default) and deduct stock from that location.
- **ITC** — purchases with vendor GSTIN auto-mark input tax credit; see Reports → Purchase ITC.

---

## 5. E-way

- Generate against a **finalized** invoice (vehicle, transporter, route).
- Default: stub demo number (`EWAY_PROVIDER=stub`).
- Live: set `EWAY_PROVIDER=http`, `EWAY_API_URL`, optional `EWAY_API_KEY` to your GSP/NIC bridge.

---

## 6. Reports & receivables

- Day book, collections by mode, GSTR-style export.
- Receivables / ageing for unpaid balances; record partial payments on the bill.

---

## 7. Roles

| Role | Typical access |
|------|----------------|
| Owner (Client Admin) | Settings, users, billing, recycle bin |
| Billing Operator | Bills, POS, day-to-day ops |
| Accountant | Bills, reports, voids, notes |
| Viewer | Read-only |

---

## 8. Subscription

Owners manage plan under **Billing**. Trial uses Growth limits. Upgrade for stock, e-way, higher invoice caps, and more seats. Pay via manual UPI or Razorpay when enabled by Platform Admin.

---

## 9. Support

Include your **Client ID** when contacting Indian Software Services. Public enquiries are accepted from the marketing site form.
