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
  logoAlign?: 'LEFT' | 'CENTER' | 'RIGHT';
  invoiceTheme?: 'CLASSIC' | 'MODERN' | 'COMPACT' | 'BOLD';
  headerMode?: 'COMPOSED' | 'LETTERHEAD';
  sampleGstin?: string;
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
  logoAlign = 'LEFT',
  invoiceTheme = 'CLASSIC',
  headerMode = 'COMPOSED',
  sampleGstin = '29AAAAA0000A1Z5',
}: Props) {
  const align = logoAlign.toLowerCase();
  const theme = invoiceTheme.toLowerCase();
  const useLetterhead = headerMode === 'LETTERHEAD' && !!bannerUrl;

  return (
    <div className="invoice-preview">
      <div className="invoice-preview-label">
        Live preview · {theme}
        {useLetterhead ? ' · letterhead' : ' · composed'}
      </div>
      <div
        className={`invoice-preview-sheet theme-${theme} mode-${useLetterhead ? 'letterhead' : 'composed'}`}
        style={{ ['--preview-accent' as string]: primaryColor }}
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
                __html: headerHtml || '<p class="muted">Company name &amp; address</p>',
              }}
            />
          </div>
        )}

        <div className={`inv-title-bar align-${align}`}>
          <h2 className="inv-title">{invoiceTitle || 'TAX INVOICE'}</h2>
        </div>

        <div className="inv-meta-grid">
          <div>
            <strong>Bill No:</strong> INV-SAMPLE-001
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
        <div className="inv-total">Grand Total: ₹1,180.00</div>
        <div
          className="inv-footer-html"
          dangerouslySetInnerHTML={{
            __html: footerHtml || '<p class="muted">Footer / terms</p>',
          }}
        />
      </div>
    </div>
  );
}
