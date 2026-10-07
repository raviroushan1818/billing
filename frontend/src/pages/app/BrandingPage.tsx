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
import type { InvoiceTheme, PrintFormat } from '../../types';
import { Palette } from 'lucide-react';

const THEMES: Array<{ id: InvoiceTheme; label: string; hint: string }> = [
  { id: 'CLASSIC', label: 'Classic', hint: 'Double-rule formal A4' },
  { id: 'MODERN', label: 'Modern', hint: 'Colored header bar' },
  { id: 'COMPACT', label: 'Compact', hint: 'Dense print layout' },
  { id: 'BOLD', label: 'Bold', hint: 'Strong accent title' },
  { id: 'GST', label: 'GST Formal', hint: 'Indian GST boxed layout' },
];

const PRINT_FORMATS: Array<{
  id: PrintFormat;
  label: string;
  hint: string;
}> = [
  { id: 'A4', label: 'A4', hint: 'Standard office / PDF' },
  { id: 'THERMAL_80', label: 'Thermal 80mm', hint: 'Retail POS printers' },
  { id: 'THERMAL_58', label: 'Thermal 58mm', hint: 'Compact receipt printers' },
];

const FONT_PRESETS: Array<{ px: number; label: string }> = [
  { px: 10, label: 'Small' },
  { px: 12, label: 'Regular' },
  { px: 14, label: 'Large' },
  { px: 16, label: 'XL' },
];

const DOC_TYPES = [
  { id: 'TAX_INVOICE' as const, label: 'Tax Invoice' },
  { id: 'CREDIT_NOTE' as const, label: 'Credit Note' },
  { id: 'DEBIT_NOTE' as const, label: 'Debit Note' },
];

function isThermalFormat(format: PrintFormat): boolean {
  return format === 'THERMAL_80' || format === 'THERMAL_58';
}

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
  const [fontSizePx, setFontSizePx] = useState(12);
  const [invoiceTheme, setInvoiceTheme] = useState<InvoiceTheme>('CLASSIC');
  const [printFormat, setPrintFormat] = useState<PrintFormat>('A4');
  const [previewDocType, setPreviewDocType] = useState<
    'TAX_INVOICE' | 'CREDIT_NOTE' | 'DEBIT_NOTE'
  >('TAX_INVOICE');
  const [logoAlign, setLogoAlign] = useState<'LEFT' | 'CENTER' | 'RIGHT'>(
    'LEFT',
  );
  const [headerMode, setHeaderMode] = useState<'COMPOSED' | 'LETTERHEAD'>(
    'COMPOSED',
  );
  const [uploadBusy, setUploadBusy] = useState<'logo' | 'banner' | null>(null);

  const thermal = isThermalFormat(printFormat);

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
        setFontSizePx(b.fontSizePx ?? 12);
        setInvoiceTheme(b.invoiceTheme ?? 'CLASSIC');
        setPrintFormat(b.printFormat ?? 'A4');
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
        fontSizePx,
        invoiceTheme,
        logoAlign,
        headerMode: thermal ? 'COMPOSED' : headerMode,
        printFormat,
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
        subtitle="Configure A4 invoice templates or thermal receipt layout for Indian GST billing"
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
            <Field label="Default print format" htmlFor="print-format">
              <div className="theme-picker" id="print-format">
                {PRINT_FORMATS.map((f) => (
                  <button
                    key={f.id}
                    type="button"
                    className={`theme-chip${printFormat === f.id ? ' active' : ''}`}
                    onClick={() => setPrintFormat(f.id)}
                    title={f.hint}
                  >
                    {f.label}
                  </button>
                ))}
              </div>
              <p className="field-hint">
                {thermal
                  ? 'Thermal mode shows receipt options below. A4 templates stay saved for office printing.'
                  : 'A4 mode shows full invoice templates. You can still print thermal from the Bills list.'}
              </p>
            </Field>

            <Field label="Preview bill type" htmlFor="preview-doc">
              <div className="theme-picker" id="preview-doc">
                {DOC_TYPES.map((d) => (
                  <button
                    key={d.id}
                    type="button"
                    className={`theme-chip${previewDocType === d.id ? ' active' : ''}`}
                    onClick={() => setPreviewDocType(d.id)}
                  >
                    {d.label}
                  </button>
                ))}
              </div>
            </Field>

            {thermal ? (
              <div className="branding-mode-banner branding-mode-thermal">
                <strong>Thermal receipt settings</strong>
                <p>
                  Compact layout for {printFormat === 'THERMAL_58' ? '58mm' : '80mm'}{' '}
                  printers — logo, shop name, GSTIN, and footer. Letterhead and
                  A4 themes are not used on thermal prints.
                </p>
              </div>
            ) : (
              <div className="branding-mode-banner branding-mode-a4">
                <strong>A4 invoice settings</strong>
                <p>
                  Full-page templates for tax invoices, credit notes, and debit
                  notes. Choose a theme, header style, and colours below.
                </p>
              </div>
            )}

            {!thermal ? (
              <>
                <Field label="Invoice header style" htmlFor="header-mode">
                  <div className="mode-picker" id="header-mode">
                    <button
                      type="button"
                      className={`mode-card${headerMode === 'COMPOSED' ? ' active' : ''}`}
                      onClick={() => setHeaderMode('COMPOSED')}
                    >
                      <strong>Compose logo + text</strong>
                      <span>
                        Upload a logo, align it, and write company details with
                        the editor.
                      </span>
                    </button>
                    <button
                      type="button"
                      className={`mode-card${headerMode === 'LETTERHEAD' ? ' active' : ''}`}
                      onClick={() => setHeaderMode('LETTERHEAD')}
                    >
                      <strong>Upload letterhead banner</strong>
                      <span>
                        Use a full-width designed letterhead image as the
                        invoice top.
                      </span>
                    </button>
                  </div>
                </Field>

                <div className="grid-2">
                  <Field
                    label="Tax invoice title"
                    htmlFor="inv-title"
                    hint="Credit / Debit notes use fixed Indian titles automatically."
                  >
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

                <Field label="Invoice templates" htmlFor="inv-theme">
                  <div
                    className="theme-picker theme-picker-cards"
                    id="inv-theme"
                  >
                    {THEMES.map((t) => (
                      <button
                        key={t.id}
                        type="button"
                        className={`theme-card${invoiceTheme === t.id ? ' active' : ''}`}
                        onClick={() => setInvoiceTheme(t.id)}
                      >
                        <span className="theme-card-swatch" data-theme={t.id} />
                        <strong>{t.label}</strong>
                        <span>{t.hint}</span>
                      </button>
                    ))}
                  </div>
                  <p className="field-hint">
                    Templates style A4 tax invoices, credit notes, and debit
                    notes.
                  </p>
                </Field>
              </>
            ) : (
              <Field
                label="Receipt title"
                htmlFor="inv-title"
                hint="Shown on thermal tax invoices. Credit / Debit notes use fixed titles."
              >
                <input
                  id="inv-title"
                  value={invoiceTitle}
                  onChange={(e) => setInvoiceTitle(e.target.value)}
                  placeholder="TAX INVOICE"
                />
              </Field>
            )}

            <Field
              label="Theme font size"
              htmlFor="font-size"
              hint="Body text on printed invoices and receipts. Titles scale with this size."
            >
              <div className="font-size-control">
                <input
                  id="font-size"
                  type="range"
                  min={10}
                  max={16}
                  step={1}
                  value={fontSizePx}
                  onChange={(e) =>
                    setFontSizePx(Number(e.target.value) || 12)
                  }
                />
                <strong>{fontSizePx}px</strong>
              </div>
              <div className="theme-picker" style={{ marginTop: '0.5rem' }}>
                {FONT_PRESETS.map((p) => (
                  <button
                    key={p.px}
                    type="button"
                    className={`theme-chip${fontSizePx === p.px ? ' active' : ''}`}
                    onClick={() => setFontSizePx(p.px)}
                  >
                    {p.label}
                  </button>
                ))}
              </div>
            </Field>

            {thermal || headerMode === 'COMPOSED' ? (
              <>
                {!thermal ? (
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
                ) : null}

                <ImageUploadField
                  label={thermal ? 'Receipt logo (optional)' : 'Company logo'}
                  hint={
                    thermal
                      ? 'Small logo centered on the receipt. JPEG/PNG/WebP/SVG, up to 2MB'
                      : 'Shown with your header text. JPEG/PNG/WebP/SVG, up to 2MB'
                  }
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

                <Field
                  label={thermal ? 'Shop name & address' : 'Header text'}
                  htmlFor="header-editor"
                  hint={
                    thermal
                      ? 'First line is used as the shop name on the receipt.'
                      : undefined
                  }
                >
                  <RichTextEditor
                    id="header-editor"
                    value={headerHtml}
                    onChange={setHeaderHtml}
                    placeholder={
                      thermal
                        ? 'Shop name, address, phone…'
                        : 'Company name, address, contact details…'
                    }
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
                  hint="Wide designed header (company letterhead). Replaces logo + text on A4 invoices."
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
                {thermal
                  ? 'Show GSTIN on receipt'
                  : 'Show GSTIN on invoice header'}
              </span>
            </label>

            <Field
              label={thermal ? 'Receipt footer' : 'Footer text'}
              htmlFor="footer-editor"
            >
              <RichTextEditor
                id="footer-editor"
                value={footerHtml}
                onChange={setFooterHtml}
                placeholder={
                  thermal
                    ? 'Thank you, return policy, WhatsApp number…'
                    : 'Terms, bank details, thank-you note…'
                }
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
          fontSizePx={fontSizePx}
          logoAlign={logoAlign}
          invoiceTheme={invoiceTheme}
          headerMode={thermal ? 'COMPOSED' : headerMode}
          printFormat={printFormat}
          documentType={previewDocType}
        />
      </div>
    </>
  );
}
