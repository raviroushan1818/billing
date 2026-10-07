import { actorDisplayName } from '../auth/roles';
import { brandingApi, tenantApi } from '../api';
import type { Invoice, InvoicePayment } from '../types';
import {
  formatDate,
  formatDateTime,
  formatInr,
  PAYMENT_MODE_LABEL,
  round2,
  toNum,
} from './format';
import { withPrintChrome } from './printInvoice';

const ONES = [
  '', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine',
  'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen',
  'Seventeen', 'Eighteen', 'Nineteen',
];
const TENS = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

function twoDigits(n: number): string {
  if (n < 20) return ONES[n];
  return `${TENS[Math.floor(n / 10)]}${n % 10 ? ` ${ONES[n % 10]}` : ''}`;
}

function threeDigits(n: number): string {
  const h = Math.floor(n / 100);
  const rest = n % 100;
  return [h ? `${ONES[h]} Hundred` : '', rest ? twoDigits(rest) : '']
    .filter(Boolean)
    .join(' ');
}

/** Indian numbering: 12,34,567.50 → "Twelve Lakh Thirty Four Thousand ... Rupees and Fifty Paise Only" */
export function amountInWords(value: number): string {
  const rupees = Math.floor(Math.abs(value));
  const paise = Math.round((Math.abs(value) - rupees) * 100);
  const parts: string[] = [];
  const crore = Math.floor(rupees / 1_00_00_000);
  const lakh = Math.floor((rupees % 1_00_00_000) / 1_00_000);
  const thousand = Math.floor((rupees % 1_00_000) / 1000);
  const rest = rupees % 1000;
  if (crore) parts.push(`${threeDigits(crore)} Crore`);
  if (lakh) parts.push(`${twoDigits(lakh)} Lakh`);
  if (thousand) parts.push(`${twoDigits(thousand)} Thousand`);
  if (rest) parts.push(threeDigits(rest));
  const words = parts.length ? parts.join(' ') : 'Zero';
  return `Rupees ${words}${paise ? ` and ${twoDigits(paise)} Paise` : ''} Only`;
}

function esc(value: unknown): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function reference(p: InvoicePayment): string {
  if (p.mode === 'UPI' && p.upiRefId) return `UPI ref ${p.upiRefId}`;
  if (p.mode === 'CARD' && p.cardLast4) return `Card •••• ${p.cardLast4}`;
  return '';
}

/** Paid to date including this payment (reversed entries excluded). */
function paidToDate(invoice: Invoice, payment: InvoicePayment): number {
  const live = (invoice.payments ?? [])
    .filter((p) => !p.reversedAt)
    .sort((a, b) => (a.paidAt ?? '').localeCompare(b.paidAt ?? ''));
  let sum = 0;
  for (const p of live) {
    sum = round2(sum + toNum(p.amount));
    if (p.id === payment.id) break;
  }
  return sum;
}

type Seller = { name: string; address: string; gstin: string; logoUrl: string };

async function loadSeller(invoice: Invoice): Promise<Seller> {
  const [brand, tenant] = await Promise.all([
    brandingApi.get().catch(() => null),
    tenantApi.me().catch(() => null),
  ]);
  return {
    name: invoice.sellerLegalName || tenant?.name || '',
    address: invoice.sellerAddress || '',
    gstin: invoice.sellerGstin || '',
    logoUrl: brand?.logoUrl || '',
  };
}

function receiptHtml(invoice: Invoice, payment: InvoicePayment, seller: Seller): string {
  const amount = toNum(payment.amount);
  const balanceAfter = payment.reversedAt ? null : toNum(payment.balanceAfter);
  const settled = balanceAfter != null && balanceAfter <= 0.01;
  const ref = reference(payment);
  const row = (label: string, value: string) =>
    value ? `<tr><th>${esc(label)}</th><td>${value}</td></tr>` : '';

  return `<!DOCTYPE html>
<html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Receipt ${esc(payment.receiptNo ?? '')}</title>
<style>
  @page { margin: 8mm; }
  * { box-sizing: border-box; }
  body { margin: 0; background: #f3f4f6; color: #111827;
    font: 13px/1.45 system-ui, -apple-system, 'Segoe UI', sans-serif; }
  .r { position: relative; max-width: 420px; margin: 16px auto; background: #fff;
    border: 1px solid #e5e7eb; border-radius: 10px; padding: 20px 22px; overflow: hidden; }
  .head { text-align: center; border-bottom: 1px dashed #d1d5db; padding-bottom: 12px; }
  .head img { max-height: 56px; max-width: 160px; margin-bottom: 6px; }
  .biz { font-size: 16px; font-weight: 700; }
  .muted { color: #6b7280; font-size: 12px; }
  h1 { margin: 14px 0 2px; text-align: center; font-size: 14px; letter-spacing: .14em; }
  .no { text-align: center; font-family: ui-monospace, Menlo, Consolas, monospace; }
  .amt { margin: 14px 0 4px; text-align: center; font-size: 26px; font-weight: 800; }
  .words { text-align: center; font-size: 12px; color: #374151; font-style: italic; }
  table { width: 100%; border-collapse: collapse; margin-top: 14px; }
  th, td { padding: 5px 0; vertical-align: top; border-bottom: 1px solid #f3f4f6; }
  th { text-align: left; font-weight: 500; color: #6b7280; width: 42%; }
  td { text-align: right; }
  .settled { margin-top: 12px; padding: 8px; border-radius: 6px; text-align: center;
    background: #ecfdf3; color: #067647; font-weight: 600; }
  .due { margin-top: 12px; padding: 8px; border-radius: 6px; text-align: center;
    background: #fffaeb; color: #b54708; font-weight: 600; }
  .void { margin-top: 12px; padding: 8px; border-radius: 6px; text-align: center;
    background: #fef3f2; color: #b42318; font-weight: 600; }
  .stamp { position: absolute; top: 42%; left: 50%; transform: translate(-50%,-50%) rotate(-18deg);
    font-size: 44px; font-weight: 900; color: rgba(180,35,24,.16); border: 5px solid rgba(180,35,24,.16);
    padding: 4px 14px; border-radius: 8px; pointer-events: none; white-space: nowrap; }
  .foot { margin-top: 16px; padding-top: 10px; border-top: 1px dashed #d1d5db;
    display: flex; justify-content: space-between; gap: 12px; font-size: 12px; }
  .sign { text-align: right; }
  .sign .line { margin-top: 26px; border-top: 1px solid #9ca3af; padding-top: 2px; }
  @media print { body { background: #fff; } .r { margin: 0 auto; border: 0; } }
</style></head>
<body><div class="r">
  ${payment.reversedAt ? '<div class="stamp">REVERSED</div>' : ''}
  <div class="head">
    ${seller.logoUrl ? `<img src="${esc(seller.logoUrl)}" alt="">` : ''}
    <div class="biz">${esc(seller.name)}</div>
    ${seller.address ? `<div class="muted">${esc(seller.address)}</div>` : ''}
    ${seller.gstin ? `<div class="muted">GSTIN: ${esc(seller.gstin)}</div>` : ''}
  </div>
  <h1>PAYMENT RECEIPT</h1>
  <div class="no">${esc(payment.receiptNo ?? '')}</div>
  <div class="amt">${esc(formatInr(amount))}</div>
  <div class="words">${esc(amountInWords(amount))}</div>
  <table>
    ${row('Received on', esc(formatDateTime(payment.paidAt)))}
    ${row('Received from', `${esc(invoice.partyName)}${invoice.partyPhone ? `<br><span class="muted">${esc(invoice.partyPhone)}</span>` : ''}`)}
    ${row('Against bill', `${esc(invoice.billNo)}<br><span class="muted">dated ${esc(formatDate(invoice.invoiceDate))}</span>`)}
    ${row('Bill amount', esc(formatInr(invoice.grandTotal)))}
    ${row('Payment mode', esc(PAYMENT_MODE_LABEL[payment.mode] ?? payment.mode))}
    ${row('Reference', esc(ref))}
    ${payment.reversedAt ? '' : row('Paid to date', esc(formatInr(paidToDate(invoice, payment))))}
    ${balanceAfter == null ? '' : row('Balance due', esc(formatInr(balanceAfter)))}
    ${row('Note', esc(payment.notes ?? ''))}
  </table>
  ${
    payment.reversedAt
      ? `<div class="void">This payment was reversed on ${esc(formatDateTime(payment.reversedAt))}${
          payment.reversalReason ? ` — ${esc(payment.reversalReason)}` : ''
        }. This receipt is not valid.</div>`
      : settled
        ? '<div class="settled">Bill fully settled — no balance due</div>'
        : `<div class="due">Balance of ${esc(formatInr(balanceAfter ?? 0))} remains due</div>`
  }
  <div class="foot">
    <div class="muted">Received by ${esc(actorDisplayName(payment.receivedBy))}<br>Computer-generated receipt</div>
    <div class="sign"><div class="line">Authorised signatory</div></div>
  </div>
</div></body></html>`;
}

/** Opens a printable receipt for one payment in a new tab. */
export async function openPaymentReceipt(
  invoice: Invoice,
  payment: InvoicePayment,
): Promise<void> {
  // Open synchronously so popup blockers allow it.
  const win = window.open('about:blank', '_blank');
  if (!win) throw new Error('Allow pop-ups for this site to print receipts');
  win.document.write(
    '<!DOCTYPE html><title>Preparing receipt…</title><body style="font-family:sans-serif;padding:24px">Preparing receipt…</body>',
  );
  win.document.close();
  try {
    const seller = await loadSeller(invoice);
    win.document.open();
    win.document.write(withPrintChrome(receiptHtml(invoice, payment, seller)));
    win.document.close();
    win.focus();
  } catch (err) {
    win.close();
    throw err;
  }
}

function waNumber(phone?: string | null): string {
  const digits = (phone ?? '').replace(/\D/g, '');
  if (digits.length === 10) return `91${digits}`;
  if (digits.length === 11 && digits.startsWith('0')) return `91${digits.slice(1)}`;
  return digits;
}

/** Opens WhatsApp with a payment confirmation message for the customer. */
export async function sendReceiptOnWhatsapp(
  invoice: Invoice,
  payment: InvoicePayment,
): Promise<void> {
  const win = window.open('about:blank', '_blank');
  const seller = await loadSeller(invoice).catch(() => null);
  const balance = toNum(payment.balanceAfter);
  const ref = reference(payment);
  const lines = [
    `*Payment received* ✅`,
    ``,
    `Receipt: ${payment.receiptNo ?? '—'}`,
    `Bill: ${invoice.billNo} (dated ${formatDate(invoice.invoiceDate)})`,
    `Amount: *${formatInr(payment.amount)}* by ${PAYMENT_MODE_LABEL[payment.mode] ?? payment.mode}${ref ? ` (${ref})` : ''}`,
    `Received on: ${formatDateTime(payment.paidAt)}`,
    balance <= 0.01
      ? `Balance due: ${formatInr(0)} — bill fully settled.`
      : `Balance due: *${formatInr(balance)}*`,
    ``,
    `Thank you${seller?.name ? ` — ${seller.name}` : ''}`,
  ];
  const phone = waNumber(invoice.partyPhone);
  const url = `https://wa.me/${phone}?text=${encodeURIComponent(lines.join('\n'))}`;
  if (win) win.location.href = url;
  else window.open(url, '_blank');
}
