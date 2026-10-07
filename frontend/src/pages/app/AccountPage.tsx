import { useEffect, useState } from 'react';
import { authApi, brandingApi } from '../../api';
import { useAuth } from '../../auth/AuthContext';
import {
  Alert,
  Button,
  Field,
  PageHeader,
  useFormSubmit,
} from '../../components/ui';
import type { InvoiceTheme, PrintFormat } from '../../types';
import { KeyRound, Printer } from 'lucide-react';
import { storeAuth, getStoredToken } from '../../api/client';

const PRINT_OPTIONS: Array<{ value: PrintFormat | ''; label: string }> = [
  { value: '', label: 'Company default' },
  { value: 'A4', label: 'A4 (office / PDF)' },
  { value: 'THERMAL_80', label: 'Thermal 80mm (POS)' },
  { value: 'THERMAL_58', label: 'Thermal 58mm (compact)' },
];

const THEME_OPTIONS: Array<{ value: InvoiceTheme | ''; label: string }> = [
  { value: '', label: 'Company default' },
  { value: 'CLASSIC', label: 'Classic' },
  { value: 'MODERN', label: 'Modern' },
  { value: 'COMPACT', label: 'Compact' },
  { value: 'BOLD', label: 'Bold' },
  { value: 'GST', label: 'GST Formal' },
];

export function AccountPage() {
  const { user, refreshUser } = useAuth();
  const [currentPassword, setCurrent] = useState('');
  const [newPassword, setNew] = useState('');
  const [confirm, setConfirm] = useState('');
  const [printFormat, setPrintFormat] = useState<PrintFormat | ''>('');
  const [invoiceTheme, setInvoiceTheme] = useState<InvoiceTheme | ''>('');
  const [companyDefaults, setCompanyDefaults] = useState<{
    printFormat: PrintFormat;
    invoiceTheme: InvoiceTheme;
  } | null>(null);

  useEffect(() => {
    setPrintFormat(user?.preferredPrintFormat ?? '');
    setInvoiceTheme(user?.preferredInvoiceTheme ?? '');
  }, [user]);

  useEffect(() => {
    void brandingApi
      .get()
      .then((b) => {
        setCompanyDefaults({
          printFormat: b.printFormat ?? 'A4',
          invoiceTheme: b.invoiceTheme ?? 'CLASSIC',
        });
      })
      .catch(() =>
        setCompanyDefaults({ printFormat: 'A4', invoiceTheme: 'CLASSIC' }),
      );
  }, []);

  const { busy, error, success, handle } = useFormSubmit(async () => {
    if (newPassword !== confirm) {
      throw new Error('New passwords do not match');
    }
    await authApi.changePassword(currentPassword, newPassword);
    setCurrent('');
    setNew('');
    setConfirm('');
  });

  const prefs = useFormSubmit(async () => {
    const updated = await authApi.updatePreferences({
      preferredPrintFormat: printFormat || null,
      preferredInvoiceTheme: invoiceTheme || null,
    });
    const token = getStoredToken();
    if (token) storeAuth(token, updated);
    await refreshUser();
  });

  return (
    <>
      <PageHeader
        icon={<KeyRound size={22} />}
        title="Account"
        subtitle="Password and your personal bill print preferences"
      />

      <div className="panel" style={{ maxWidth: 560 }}>
        <h2 className="panel-title">
          <Printer size={16} style={{ marginRight: 6, verticalAlign: -2 }} />
          My billing preferences
        </h2>
        <p className="muted" style={{ marginTop: 0 }}>
          Every user can choose their own print format and invoice template.
          These apply when you print bills. Leave as “Company default” to use
          the settings from Branding.
        </p>
        {prefs.error ? <Alert>{prefs.error}</Alert> : null}
        {prefs.success ? (
          <Alert variant="success">Preferences saved</Alert>
        ) : null}
        <form
          className="form-stack"
          onSubmit={(e) => {
            void prefs.handle(e);
          }}
        >
          <Field
            label="Print format"
            htmlFor="pref-print"
            hint={
              companyDefaults
                ? `Company default: ${companyDefaults.printFormat.replace('_', ' ')}`
                : undefined
            }
          >
            <select
              id="pref-print"
              value={printFormat}
              onChange={(e) =>
                setPrintFormat(e.target.value as PrintFormat | '')
              }
            >
              {PRINT_OPTIONS.map((o) => (
                <option key={o.label} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </Field>
          <Field
            label="Invoice template"
            htmlFor="pref-theme"
            hint={
              companyDefaults
                ? `Company default: ${companyDefaults.invoiceTheme}`
                : undefined
            }
          >
            <select
              id="pref-theme"
              value={invoiceTheme}
              onChange={(e) =>
                setInvoiceTheme(e.target.value as InvoiceTheme | '')
              }
            >
              {THEME_OPTIONS.map((o) => (
                <option key={o.label} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </Field>
          <Button type="submit" disabled={prefs.busy}>
            {prefs.busy ? 'Saving…' : 'Save preferences'}
          </Button>
        </form>
      </div>

      <div className="panel" style={{ maxWidth: 560, marginTop: '1rem' }}>
        <h2 className="panel-title">Change password</h2>
        {error ? <Alert>{error}</Alert> : null}
        {success ? (
          <Alert variant="success">Password updated successfully</Alert>
        ) : null}
        <form className="form-stack" onSubmit={(e) => void handle(e)}>
          <Field label="Current password" htmlFor="cur">
            <input
              id="cur"
              type="password"
              value={currentPassword}
              onChange={(e) => setCurrent(e.target.value)}
              required
              autoComplete="current-password"
            />
          </Field>
          <Field label="New password" htmlFor="np">
            <input
              id="np"
              type="password"
              value={newPassword}
              onChange={(e) => setNew(e.target.value)}
              required
              minLength={8}
              autoComplete="new-password"
            />
          </Field>
          <Field label="Confirm new password" htmlFor="cp">
            <input
              id="cp"
              type="password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              required
              minLength={8}
              autoComplete="new-password"
            />
          </Field>
          <Button type="submit" disabled={busy}>
            {busy ? 'Updating…' : 'Update password'}
          </Button>
        </form>
      </div>

      <div className="panel" style={{ maxWidth: 560, marginTop: '1rem' }}>
        <p className="muted" style={{ margin: 0 }}>
          Need help or want to review how we handle data?{' '}
          <a href="/contact" target="_blank" rel="noreferrer">
            Contact us
          </a>
          {' · '}
          <a href="/privacy" target="_blank" rel="noreferrer">
            Privacy policy
          </a>
        </p>
      </div>
    </>
  );
}
