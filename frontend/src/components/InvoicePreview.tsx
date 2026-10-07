import type { InvoiceTheme, PrintFormat } from '../types';

type PreviewDocType = 'TAX_INVOICE' | 'CREDIT_NOTE' | 'DEBIT_NOTE';

type Props = {
  invoiceTitle: string;
  primaryColor: string;
  showGstin: boolean;
  headerHtml: string;
  footerHtml: string;
  logoUrl: string | null;
  bannerUrl: string | null;
  logoWidthPx?: number;
  bannerHeightPx?: number;
  fontSizePx?: number;
  logoAlign?: 'LEFT' | 'CENTER' | 'RIGHT';
  invoiceTheme?: InvoiceTheme;
  headerMode?: 'COMPOSED' | 'LETTERHEAD';
  printFormat?: PrintFormat;
  documentType?: PreviewDocType;
  sampleGstin?: string;
};

const DOC_TITLES: Record<PreviewDocType, string> = {
  TAX_INVOICE: 'TAX INVOICE',
  CREDIT_NOTE: 'CREDIT NOTE',
  DEBIT_NOTE: 'DEBIT NOTE',
};

export function InvoicePreview({
  invoiceTitle,
  primaryColor,
  showGstin,
  headerHtml,
  footerHtml,
  logoUrl,
  bannerUrl,
  logoWidthPx = 72,
  bannerHeightPx = 100,
  fontSizePx = 12,
  logoAlign = 'LEFT',
  invoiceTheme = 'CLASSIC',
  headerMode = 'COMPOSED',
  printFormat = 'A4',
  documentType = 'TAX_INVOICE',
  sampleGstin = '29AAAAA0000A1Z5',
}: Props) {
  const align = logoAlign.toLowerCase();
  const theme = invoiceTheme.toLowerCase();
  const useLetterhead = headerMode === 'LETTERHEAD' && !!bannerUrl;
  const isThermal =
    printFormat === 'THERMAL_80' || printFormat === 'THERMAL_58';
  const title =
    documentType === 'TAX_INVOICE'
      ? invoiceTitle || 'TAX INVOICE'
      : DOC_TITLES[documentType];
  const sampleNo =
    documentType === 'CREDIT_NOTE'
      ? 'CN-SAMPLE-001'
      : documentType === 'DEBIT_NOTE'
        ? 'DN-SAMPLE-001'
        : 'INV-SAMPLE-001';

  if (isThermal) {
    const shopName =
      headerHtml
        .replace(/<br\s*\/?>/gi, ' ')
        .replace(/<\/p>/gi, ' ')
        .replace(/<[^>]+>/g, ' ')
        .replace(/\s+/g, ' ')
        .trim()
        .split(/\s{2,}|\n/)[0]
        ?.slice(0, 80) || 'Your Business Name';
    const footerText = footerHtml
      .replace(/<br\s*\/?>/gi, ' ')
      .replace(/<\/p>/gi, ' ')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();

    return (
      <div className="invoice-preview">
        <div className="invoice-preview-label">
          Thermal preview · {printFormat === 'THERMAL_58' ? '58mm' : '80mm'} ·{' '}
          {DOC_TITLES[documentType].toLowerCase()}
        </div>
        <div
          className={`invoice-thermal-sheet thermal-${printFormat === 'THERMAL_58' ? '58' : '80'}`}
          style={{
            fontSize: `${printFormat === 'THERMAL_58' ? Math.max(9, fontSizePx - 2) : Math.max(10, fontSizePx - 1)}px`,
          }}
        >
          {logoUrl ? (
            <img className="thermal-logo" src={logoUrl} alt="" />
          ) : null}
          <div className="thermal-shop">{shopName}</div>
          {showGstin ? (
            <div className="thermal-muted">GSTIN: {sampleGstin}</div>
          ) : null}
          <div className="thermal-title">{title}</div>
          <div className="thermal-rule" />
          <div className="thermal-row">
            <span>Bill</span>
            <span>{sampleNo}</span>
          </div>
          <div className="thermal-row">
            <span>Date</span>
            <span>{new Date().toISOString().slice(0, 10)}</span>
          </div>
          <div className="thermal-rule" />
          <strong>Sample Customer</strong>
          <div className="thermal-muted">9876543210</div>
          <div className="thermal-rule" />
          <div className="thermal-item">
            <div>Sample service</div>
            <div className="thermal-row">
              <span>1 x 1000.00</span>
              <span>1180.00</span>
            </div>
            <div className="thermal-muted">GST 18%</div>
          </div>
          <div className="thermal-rule" />
          <div className="thermal-row">
            <span>Taxable</span>
            <span>1000.00</span>
          </div>
          <div className="thermal-row">
            <span>CGST</span>
            <span>90.00</span>
          </div>
          <div className="thermal-row">
            <span>SGST</span>
            <span>90.00</span>
          </div>
          <div className="thermal-row thermal-grand">
            <span>TOTAL</span>
            <span>₹1,180.00</span>
          </div>
          <div className="thermal-rule" />
          <div className="thermal-muted thermal-center">Thank you</div>
          {footerText ? (
            <div className="thermal-muted thermal-center" style={{ marginTop: 6 }}>
              {footerText.slice(0, 120)}
            </div>
          ) : null}
        </div>
      </div>
    );
  }

  return (
    <div className="invoice-preview">
      <div className="invoice-preview-label">
        Live preview · {theme}
        {useLetterhead ? ' · letterhead' : ' · composed'} · A4 ·{' '}
        {DOC_TITLES[documentType].toLowerCase()}
      </div>
      <div
        className={`invoice-preview-sheet theme-${theme} mode-${useLetterhead ? 'letterhead' : 'composed'}`}
        style={{
          ['--preview-accent' as string]: primaryColor,
          ['--preview-font-size' as string]: `${fontSizePx}px`,
          fontSize: `${fontSizePx}px`,
        }}
      >
        {useLetterhead ? (
          <div className="inv-letterhead" style={{ height: bannerHeightPx }}>
            <img src={bannerUrl!} alt="" style={{ height: bannerHeightPx }} />
          </div>
        ) : (
          <div className={`inv-brand-row align-${align}`}>
            {logoUrl ? (
              <img
                className="inv-logo"
                src={logoUrl}
                alt="Logo"
                style={{ width: logoWidthPx, height: logoWidthPx }}
              />
            ) : null}
            <div
              className="inv-header-html"
              dangerouslySetInnerHTML={{
                __html:
                  headerHtml ||
                  '<p class="muted">Company name &amp; address</p>',
              }}
            />
          </div>
        )}

        <div className={`inv-title-bar align-${align}`}>
          <h2 className="inv-title">{title}</h2>
        </div>

        <div className="inv-meta-grid">
          <div>
            <strong>Bill No:</strong> {sampleNo}
          </div>
          <div>
            <strong>Date:</strong> {new Date().toISOString().slice(0, 10)}
          </div>
          {showGstin ? (
            <div>
              <strong>GSTIN:</strong> {sampleGstin}
            </div>
          ) : (
            <div />
          )}
          <div className="muted">Your company details</div>
        </div>

        <div className="inv-party">
          <div className="inv-party-label">Bill To</div>
          <strong>Sample Customer</strong>
          <br />
          Phone: 9876543210
        </div>

        <table className="inv-table">
          <thead>
            <tr>
              <th>#</th>
              <th>Description</th>
              <th>Qty</th>
              <th>Amount</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>1</td>
              <td>Sample service</td>
              <td>1</td>
              <td>₹1,180.00</td>
            </tr>
          </tbody>
        </table>

        <div className="inv-totals">
          <div>
            <span>Grand Total</span>
            <strong>₹1,180.00</strong>
          </div>
        </div>

        <div
          className="inv-footer-html"
          dangerouslySetInnerHTML={{
            __html: footerHtml || '<p class="muted">Terms &amp; conditions</p>',
          }}
        />
      </div>
    </div>
  );
}
