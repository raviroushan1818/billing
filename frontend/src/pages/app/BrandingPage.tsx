import { useEffect, useState } from 'react';
import { brandingApi } from '../../api';
import { ImageUploadField } from '../../components/ImageUploadField';
import { InvoicePreview } from '../../components/InvoicePreview';
import { RichTextEditor } from '../../components/RichTextEditor';
import {
  Alert,
  Button,
  Field,
  PageHeader,
  useFormSubmit,
} from '../../components/ui';
import { Palette } from 'lucide-react';

const THEMES = [
  { id: 'CLASSIC' as const, label: 'Classic', hint: 'Double-rule formal' },
  { id: 'MODERN' as const, label: 'Modern', hint: 'Colored header bar' },
  { id: 'COMPACT' as const, label: 'Compact', hint: 'Dense print layout' },
  { id: 'BOLD' as const, label: 'Bold', hint: 'Strong accent title' },
];

export function BrandingPage() {
  const [loading, setLoading] = useState(true);
  const [headerHtml, setHeaderHtml] = useState('');
  const [footerHtml, setFooterHtml] = useState('');
  const [primaryColor, setPrimaryColor] = useState('#0d7377');
  const [invoiceTitle, setInvoiceTitle] = useState('TAX INVOICE');
  const [showGstin, setShowGstin] = useState(true);
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [bannerUrl, setBannerUrl] = useState<string | null>(null);
  const [logoWidthPx, setLogoWidthPx] = useState(72);
  const [bannerHeightPx, setBannerHeightPx] = useState(100);
  const [invoiceTheme, setInvoiceTheme] = useState<
    'CLASSIC' | 'MODERN' | 'COMPACT' | 'BOLD'
  >('CLASSIC');
  const [logoAlign, setLogoAlign] = useState<'LEFT' | 'CENTER' | 'RIGHT'>(
    'LEFT',
  );
  const [headerMode, setHeaderMode] = useState<'COMPOSED' | 'LETTERHEAD'>(
    'COMPOSED',
  );
  const [uploadBusy, setUploadBusy] = useState<'logo' | 'banner' | null>(null);

  useEffect(() => {
    brandingApi
      .get()
      .then((b) => {
        setHeaderHtml(b.headerHtml ?? '');
        setFooterHtml(b.footerHtml ?? '');
        setPrimaryColor(b.primaryColor ?? '#0d7377');
        setInvoiceTitle(b.invoiceTitle ?? 'TAX INVOICE');
        setShowGstin(b.showGstin ?? true);
        setLogoUrl(b.logoUrl ?? null);
        setBannerUrl(b.bannerUrl ?? null);
        setLogoWidthPx(b.logoWidthPx ?? 72);
        setBannerHeightPx(b.bannerHeightPx ?? 100);
        setInvoiceTheme(b.invoiceTheme ?? 'CLASSIC');
        setLogoAlign(b.logoAlign ?? 'LEFT');
        setHeaderMode(b.headerMode ?? 'COMPOSED');
      })
      .catch(() => undefined)
      .finally(() => setLoading(false));
  }, []);

  const { busy, error, success, setError, setSuccess, handle } = useFormSubmit(
    async () => {
      const b = await brandingApi.update({
        headerHtml,
        footerHtml,
        primaryColor,
        invoiceTitle,
        showGstin,
        logoWidthPx,
        bannerHeightPx,
        invoiceTheme,
        logoAlign,
        headerMode,
      });
      setLogoUrl(b.logoUrl ?? null);
      setBannerUrl(b.bannerUrl ?? null);
      setSuccess('Branding saved.');
    },
  );

  const applyAsset = (b: {
    logoUrl?: string | null;
    bannerUrl?: string | null;
  }) => {
    setLogoUrl(b.logoUrl ?? null);
    setBannerUrl(b.bannerUrl ?? null);
  };

  if (loading) {
    return <p className="muted">Loading branding…</p>;
  }

  return (
    <>
      <PageHeader
        icon={<Palette size={22} />}
        title="Branding"
        subtitle="Choose letterhead image or compose logo + company text, then pick a professional layout theme"
      />

      <div className="branding-layout">
        <div className="panel">
          {error ? <Alert>{error}</Alert> : null}
          {success ? <Alert variant="success">{success}</Alert> : null}
          <form
            className="form-stack"
            onSubmit={(e) => {
              void handle(e);
            }}
          >
            <Field label="Invoice header style" htmlFor="header-mode">
              <div className="mode-picker" id="header-mode">
                <button
                  type="button"
                  className={`mode-card${headerMode === 'COMPOSED' ? ' active' : ''}`}
                  onClick={() => setHeaderMode('COMPOSED')}
                >
                  <strong>Compose logo + text</strong>
                  <span>
                    Upload a logo, align it, and write company details with the
                    editor.
                  </span>
                </button>
                <button
                  type="button"
                  className={`mode-card${headerMode === 'LETTERHEAD' ? ' active' : ''}`}
                  onClick={() => setHeaderMode('LETTERHEAD')}
                >
                  <strong>Upload letterhead banner</strong>
                  <span>
                    Use a full-width designed letterhead image as the invoice
                    top.
                  </span>
                </button>
              </div>
            </Field>

            <div className="grid-2">
              <Field label="Invoice title" htmlFor="inv-title">
                <input
                  id="inv-title"
                  value={invoiceTitle}
                  onChange={(e) => setInvoiceTitle(e.target.value)}
                  placeholder="TAX INVOICE"
                />
              </Field>
              <Field label="Primary color" htmlFor="color">
                <input
                  id="color"
                  type="color"
                  value={primaryColor}
                  onChange={(e) => setPrimaryColor(e.target.value)}
                />
              </Field>
            </div>

            <Field label="Invoice layout theme" htmlFor="inv-theme">
              <div className="theme-picker" id="inv-theme">
                {THEMES.map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    className={`theme-chip${invoiceTheme === t.id ? ' active' : ''}`}
                    onClick={() => setInvoiceTheme(t.id)}
                    title={t.hint}
                  >
                    {t.label}
                  </button>
                ))}
              </div>
              <p className="field-hint">
                Themes style the title bar, tables, and totals on preview and
                PDF.
              </p>
            </Field>

            {headerMode === 'COMPOSED' ? (
              <>
                <div className="grid-2">
                  <Field label="Logo width (px)" htmlFor="logo-w">
                    <input
                      id="logo-w"
                      type="number"
                      min={40}
                      max={200}
                      value={logoWidthPx}
                      onChange={(e) =>
                        setLogoWidthPx(Number(e.target.value) || 72)
                      }
                    />
                  </Field>
                  <Field label="Logo / header align" htmlFor="logo-align">
                    <select
                      id="logo-align"
                      value={logoAlign}
                      onChange={(e) =>
                        setLogoAlign(
                          e.target.value as 'LEFT' | 'CENTER' | 'RIGHT',
                        )
                      }
                    >
                      <option value="LEFT">Left</option>
                      <option value="CENTER">Center</option>
                      <option value="RIGHT">Right</option>
                    </select>
                  </Field>
                </div>

                <ImageUploadField
                  label="Company logo"
                  hint="Shown with your header text. JPEG/PNG/WebP/SVG, up to 2MB"
                  variant="logo"
                  previewUrl={logoUrl}
                  busy={uploadBusy === 'logo'}
                  onUpload={async (file) => {
                    setUploadBusy('logo');
                    setError(null);
                    try {
                      applyAsset(await brandingApi.uploadLogo(file));
                      setSuccess('Logo uploaded.');
                    } finally {
                      setUploadBusy(null);
                    }
                  }}
                  onRemove={async () => {
                    setUploadBusy('logo');
                    setError(null);
                    try {
                      applyAsset(await brandingApi.removeLogo());
                      setSuccess('Logo removed.');
                    } finally {
                      setUploadBusy(null);
                    }
                  }}
                />

                <Field label="Header text" htmlFor="header-editor">
                  <RichTextEditor
                    id="header-editor"
                    value={headerHtml}
                    onChange={setHeaderHtml}
                    placeholder="Company name, address, contact details…"
                  />
                </Field>
              </>
            ) : (
              <>
                <Field label="Letterhead height (px)" htmlFor="banner-h">
                  <input
                    id="banner-h"
                    type="number"
                    min={40}
                    max={240}
                    value={bannerHeightPx}
                    onChange={(e) =>
                      setBannerHeightPx(Number(e.target.value) || 100)
                    }
                  />
                </Field>
                <ImageUploadField
                  label="Letterhead / banner image"
                  hint="Wide designed header (company letterhead). Replaces logo + text on invoices."
                  variant="banner"
                  previewUrl={bannerUrl}
                  busy={uploadBusy === 'banner'}
                  onUpload={async (file) => {
                    setUploadBusy('banner');
                    setError(null);
                    try {
                      applyAsset(await brandingApi.uploadBanner(file));
                      setSuccess('Letterhead uploaded.');
                    } finally {
                      setUploadBusy(null);
                    }
                  }}
                  onRemove={async () => {
                    setUploadBusy('banner');
                    setError(null);
                    try {
                      applyAsset(await brandingApi.removeBanner());
                      setSuccess('Letterhead removed.');
                    } finally {
                      setUploadBusy(null);
                    }
                  }}
                />
                {!bannerUrl ? (
                  <Alert>
                    Upload a letterhead image to use this mode. Until then,
                    preview falls back to compose layout.
                  </Alert>
                ) : null}
              </>
            )}

            <label className="field">
              <span className="field-label">
                <input
                  type="checkbox"
                  checked={showGstin}
                  onChange={(e) => setShowGstin(e.target.checked)}
                  style={{ width: 'auto', marginRight: '0.5rem' }}
                />
                Show GSTIN on invoice header
              </span>
            </label>

            <Field label="Footer text" htmlFor="footer-editor">
              <RichTextEditor
                id="footer-editor"
                value={footerHtml}
                onChange={setFooterHtml}
                placeholder="Terms, bank details, thank-you note…"
              />
            </Field>

            <Button type="submit" disabled={busy || !!uploadBusy}>
              {busy ? 'Saving…' : 'Save branding'}
            </Button>
          </form>
        </div>

        <InvoicePreview
          invoiceTitle={invoiceTitle}
          primaryColor={primaryColor}
          showGstin={showGstin}
          headerHtml={headerHtml}
          footerHtml={footerHtml}
          logoUrl={logoUrl}
          bannerUrl={bannerUrl}
          logoWidthPx={logoWidthPx}
          bannerHeightPx={bannerHeightPx}
          logoAlign={logoAlign}
          invoiceTheme={invoiceTheme}
          headerMode={headerMode}
        />
      </div>
    </>
  );
}
