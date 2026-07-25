import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import puppeteer from 'puppeteer';
import { StorageService } from '../storage/storage.service';
import { PrismaService } from '../prisma/prisma.service';
import { BrandingService } from '../branding/branding.service';
import { MediaPurpose } from '@prisma/client';
import { InvoicePrintData } from '../einvoice/einvoice.provider';

@Injectable()
export class PdfService {
  private readonly logger = new Logger(PdfService.name);

  constructor(
    private readonly config: ConfigService,
    private readonly storage: StorageService,
    private readonly prisma: PrismaService,
    private readonly branding: BrandingService,
  ) {}

  renderHtml(
    data: InvoicePrintData,
    assets: { logoUrl: string | null; bannerUrl: string | null } = {
      logoUrl: null,
      bannerUrl: null,
    },
  ): string {
    const color = data.brand.primaryColor ?? '#0f4c81';
    const title = data.brand.invoiceTitle ?? 'TAX INVOICE';
    const sellerAddress = data.sellerAddress ?? '';
    const logoW = data.brand.logoWidthPx ?? 72;
    const bannerH = data.brand.bannerHeightPx ?? 100;
    const align = (data.brand.logoAlign ?? 'LEFT').toString().toLowerCase();
    const theme = (data.brand.invoiceTheme ?? 'CLASSIC').toString().toLowerCase();
    const headerMode = (
      (data.brand as { headerMode?: string }).headerMode ?? 'COMPOSED'
    )
      .toString()
      .toUpperCase();
    const isLetterhead = headerMode === 'LETTERHEAD' && !!assets.bannerUrl;

    const linesHtml = data.lines
      .map(
        (l) => `
      <tr>
        <td>${l.lineNo}</td>
        <td>${escapeHtml(l.description)}</td>
        <td>${l.hsnSac ?? ''}</td>
        <td class="num">${Number(l.qty)}</td>
        <td class="num">${fmt(l.rate)}</td>
        <td class="num">${fmt(l.taxableValue)}</td>
        <td class="num">${Number(l.gstRate)}%</td>
        <td class="num">${fmt(l.lineTotal)}</td>
      </tr>`,
      )
      .join('');

    const paymentsHtml = data.payments
      .map(
        (p) =>
          `<tr><td>${p.mode}</td><td class="num">${fmt(p.amount)}</td><td>${p.upiRefId ?? ''}</td></tr>`,
      )
      .join('');

    const brandBlock = isLetterhead
      ? `<div class="letterhead"><img src="${escapeAttr(assets.bannerUrl!)}" alt="Letterhead"/></div>`
      : `<div class="brand-row align-${align}">
          ${
            assets.logoUrl
              ? `<img class="logo" src="${escapeAttr(assets.logoUrl)}" alt="Logo"/>`
              : ''
          }
          <div class="brand-copy">${data.brand.headerHtml || ''}</div>
        </div>`;

    return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8"/>
  <style>
    * { box-sizing: border-box; }
    body {
      font-family: "Segoe UI", Arial, Helvetica, sans-serif;
      font-size: 12px;
      color: #1a2332;
      margin: 0;
      padding: 28px;
      line-height: 1.45;
    }
    .sheet { max-width: 800px; margin: 0 auto; }
    .header { margin-bottom: 18px; padding-bottom: 14px; }
    .letterhead { margin: 0 0 14px; }
    .letterhead img {
      width: 100%;
      height: ${bannerH}px;
      object-fit: cover;
      object-position: center top;
      display: block;
    }
    .brand-row {
      display: flex;
      gap: 14px;
      align-items: flex-start;
      margin-bottom: 10px;
    }
    .brand-row.align-left { justify-content: flex-start; text-align: left; }
    .brand-row.align-center {
      flex-direction: column;
      align-items: center;
      text-align: center;
    }
    .brand-row.align-right {
      flex-direction: row-reverse;
      justify-content: flex-start;
      text-align: right;
    }
    .brand-row.align-center .brand-copy,
    .brand-row.align-right .brand-copy { flex: 0 1 auto; width: 100%; }
    .logo { width: ${logoW}px; height: ${logoW}px; object-fit: contain; flex-shrink: 0; }
    .brand-copy { flex: 1; min-width: 0; }
    .brand-copy p, .brand-copy h1, .brand-copy h2, .brand-copy h3 { margin: 0 0 4px; }
    .title-bar {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
      margin: 10px 0 12px;
    }
    .align-center + .title-bar, .header.mode-letterhead .title-bar { justify-content: center; }
    .align-right + .title-bar { justify-content: flex-end; }
    h1.title {
      color: ${color};
      margin: 0;
      font-size: 20px;
      letter-spacing: 0.06em;
      font-weight: 700;
    }
    .meta-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 8px 20px;
      margin-bottom: 14px;
      padding: 10px 12px;
      background: #f7f9fc;
      border: 1px solid #e2e8f0;
      border-radius: 6px;
    }
    .party-box {
      border: 1px solid #e2e8f0;
      border-left: 3px solid ${color};
      border-radius: 6px;
      padding: 10px 12px;
      margin-bottom: 14px;
      background: #fff;
    }
    .party-box .label {
      font-size: 10px;
      text-transform: uppercase;
      letter-spacing: 0.06em;
      color: #64748b;
      margin-bottom: 4px;
    }
    table.items { width: 100%; border-collapse: collapse; margin-top: 4px; }
    table.items th, table.items td {
      border: 1px solid #d8e0ea;
      padding: 7px 8px;
      text-align: left;
    }
    table.items th {
      background: #f1f5f9;
      font-size: 11px;
      text-transform: uppercase;
      letter-spacing: 0.03em;
      color: #334155;
    }
    .num { text-align: right; }
    .totals-wrap { display: flex; justify-content: flex-end; margin-top: 12px; }
    table.totals { width: 280px; border-collapse: collapse; }
    table.totals td { padding: 5px 8px; border: none; }
    table.totals .label { text-align: right; color: #475569; }
    table.totals tr.grand td {
      border-top: 2px solid ${color};
      padding-top: 8px;
      font-size: 13px;
    }
    .footer-block {
      margin-top: 22px;
      padding-top: 12px;
      border-top: 1px dashed #cbd5e1;
      font-size: 11px;
      color: #475569;
    }
    .footer-block p { margin: 0 0 4px; }
    ${themeStyles(theme, color)}
  </style>
</head>
<body class="theme-${theme}">
  <div class="sheet">
    <div class="header mode-${isLetterhead ? 'letterhead' : 'composed'}">
      ${brandBlock}
      <div class="title-bar"><h1 class="title">${escapeHtml(title)}</h1></div>
      <div class="meta-grid">
        <div><strong>Bill No:</strong> ${escapeHtml(data.billNo)}</div>
        <div><strong>Date:</strong> ${data.invoiceDate.toISOString().slice(0, 10)}</div>
        ${
          data.brand.showGstin && data.sellerGstin
            ? `<div><strong>GSTIN:</strong> ${escapeHtml(data.sellerGstin)}</div>`
            : '<div></div>'
        }
        <div>${escapeHtml(data.sellerLegalName ?? '')}</div>
        <div style="grid-column: 1 / -1">${escapeHtml(sellerAddress)}</div>
      </div>
    </div>
    <div class="party-box">
      <div class="label">Bill To</div>
      <strong>${escapeHtml(data.partyName)}</strong><br/>
      ${data.partyPhone ? `Phone: ${escapeHtml(data.partyPhone)}<br/>` : ''}
      ${data.partyGstin ? `GSTIN: ${escapeHtml(data.partyGstin)}<br/>` : ''}
      ${data.partyAddress ? escapeHtml(data.partyAddress) : ''}
    </div>
    <table class="items">
      <thead>
        <tr>
          <th>#</th><th>Description</th><th>HSN</th><th>Qty</th><th>Rate</th>
          <th>Taxable</th><th>GST%</th><th>Total</th>
        </tr>
      </thead>
      <tbody>${linesHtml}</tbody>
    </table>
    <div class="totals-wrap">
      <table class="totals">
        <tr><td class="label">Taxable</td><td class="num">${fmt(data.taxableAmount)}</td></tr>
        <tr><td class="label">CGST</td><td class="num">${fmt(data.cgstAmount)}</td></tr>
        <tr><td class="label">SGST</td><td class="num">${fmt(data.sgstAmount)}</td></tr>
        <tr><td class="label">IGST</td><td class="num">${fmt(data.igstAmount)}</td></tr>
        <tr class="grand"><td class="label"><strong>Grand Total</strong></td><td class="num"><strong>${fmt(data.grandTotal)}</strong></td></tr>
      </table>
    </div>
    ${
      data.payments.length
        ? `<h3 style="margin:18px 0 6px;font-size:12px;color:#64748b;text-transform:uppercase;letter-spacing:0.05em">Payments</h3>
           <table class="items"><thead><tr><th>Mode</th><th>Amount</th><th>Ref</th></tr></thead><tbody>${paymentsHtml}</tbody></table>`
        : ''
    }
    <div class="footer-block">${data.brand.footerHtml || ''}</div>
  </div>
</body>
</html>`;
  }

  async buildInvoiceHtml(data: InvoicePrintData): Promise<string> {
    const [logoUrl, bannerUrl] = await Promise.all([
      this.branding.resolveMediaUrl(data.brand.logoGcsKey),
      this.branding.resolveMediaUrl(data.brand.letterhead),
    ]);
    return this.renderHtml(data, { logoUrl, bannerUrl });
  }

  async generateInvoicePdf(
    data: InvoicePrintData,
    tenantId: string,
    html?: string,
  ): Promise<{ gcsKey: string; publicPath?: string; signedUrl?: string }> {
    const invoiceHtml = html ?? (await this.buildInvoiceHtml(data));
    const executablePath = this.config.get<string>('PUPPETEER_EXECUTABLE_PATH');

    const browser = await puppeteer.launch({
      headless: true,
      executablePath: executablePath || undefined,
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    });

    try {
      const page = await browser.newPage();
      await page.setContent(invoiceHtml, { waitUntil: 'load' });
      const buffer = Buffer.from(
        await page.pdf({ format: 'A4', printBackground: true }),
      );

      const uploaded = await this.storage.uploadForPurpose(
        tenantId,
        MediaPurpose.INVOICE_PDF,
        buffer,
        'application/pdf',
        `${data.billNo}.pdf`,
      );

      await this.prisma.invoice.update({
        where: { id: data.id },
        data: {
          pdfGcsKey: uploaded.gcsKey,
          printedAt: new Date(),
        },
      });

      return uploaded;
    } finally {
      await browser.close().catch((err) => {
        this.logger.warn(`Failed to close browser: ${err}`);
      });
    }
  }
}

function fmt(value: { toString(): string } | number): string {
  return Number(value).toFixed(2);
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function escapeAttr(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

function themeStyles(theme: string, color: string): string {
  switch (theme) {
    case 'modern':
      return `
        .header {
          background: linear-gradient(135deg, ${color} 0%, ${color}cc 100%);
          color: #fff;
          padding: 18px 16px 14px;
          border-radius: 10px;
          border: none;
        }
        .header .title { color: #fff; }
        .header .meta-grid {
          background: rgba(255,255,255,0.12);
          border-color: rgba(255,255,255,0.2);
          color: #fff;
        }
        .header .brand-copy, .header .brand-copy * { color: #fff !important; }
        .letterhead img { border-radius: 8px; }
        table.items th { background: ${color}; color: #fff; border-color: ${color}; }
        .party-box { border-left-color: ${color}; }
      `;
    case 'compact':
      return `
        body { font-size: 10px; padding: 16px; }
        h1.title { font-size: 14px; }
        .meta-grid { padding: 6px 8px; gap: 4px 12px; }
        table.items th, table.items td { padding: 3px 5px; }
        .letterhead img { height: 56px !important; }
        .logo { max-width: 48px !important; max-height: 48px !important; }
        .party-box { padding: 6px 8px; margin-bottom: 8px; }
      `;
    case 'bold':
      return `
        .header {
          border-bottom: 4px solid ${color};
          padding-bottom: 12px;
        }
        h1.title {
          font-size: 26px;
          text-transform: uppercase;
          letter-spacing: 0.12em;
        }
        .title-bar {
          background: ${color};
          color: #fff;
          padding: 10px 14px;
          margin: 12px -4px 14px;
          border-radius: 4px;
        }
        .title-bar .title { color: #fff; }
        table.items th {
          background: ${color};
          color: #fff;
          border-color: ${color};
        }
        table.totals tr.grand td {
          background: ${color}12;
        }
        .party-box {
          border: 2px solid ${color};
          border-left-width: 6px;
        }
      `;
    default: // classic
      return `
        .header {
          border-bottom: 2px solid ${color};
          border-top: 3px double ${color};
          padding-top: 10px;
        }
        h1.title { border-bottom: 1px solid ${color}33; padding-bottom: 6px; display: inline-block; }
        table.items thead th { border-bottom: 2px solid ${color}; }
      `;
  }
}
