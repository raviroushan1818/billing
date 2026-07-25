import { useEffect, useState } from 'react';
import { gstApi } from '../../api';
import type { GstSettings } from '../../types';
import {
  Alert,
  Button,
  Field,
  PageHeader,
  useFormSubmit,
} from '../../components/ui';
import { Settings } from 'lucide-react';

const INDIAN_STATES: Array<{ code: string; name: string }> = [
  { code: '01', name: 'Jammu & Kashmir' },
  { code: '02', name: 'Himachal Pradesh' },
  { code: '03', name: 'Punjab' },
  { code: '04', name: 'Chandigarh' },
  { code: '05', name: 'Uttarakhand' },
  { code: '06', name: 'Haryana' },
  { code: '07', name: 'Delhi' },
  { code: '08', name: 'Rajasthan' },
  { code: '09', name: 'Uttar Pradesh' },
  { code: '10', name: 'Bihar' },
  { code: '11', name: 'Sikkim' },
  { code: '12', name: 'Arunachal Pradesh' },
  { code: '13', name: 'Nagaland' },
  { code: '14', name: 'Manipur' },
  { code: '15', name: 'Mizoram' },
  { code: '16', name: 'Tripura' },
  { code: '17', name: 'Meghalaya' },
  { code: '18', name: 'Assam' },
  { code: '19', name: 'West Bengal' },
  { code: '20', name: 'Jharkhand' },
  { code: '21', name: 'Odisha' },
  { code: '22', name: 'Chhattisgarh' },
  { code: '23', name: 'Madhya Pradesh' },
  { code: '24', name: 'Gujarat' },
  { code: '27', name: 'Maharashtra' },
  { code: '29', name: 'Karnataka' },
  { code: '32', name: 'Kerala' },
  { code: '33', name: 'Tamil Nadu' },
  { code: '36', name: 'Telangana' },
  { code: '37', name: 'Andhra Pradesh' },
];

export function GstSettingsPage() {
  const [loading, setLoading] = useState(true);
  const [gstin, setGstin] = useState('');
  const [legalName, setLegalName] = useState('');
  const [tradeName, setTradeName] = useState('');
  const [addressLine1, setAddressLine1] = useState('');
  const [addressLine2, setAddressLine2] = useState('');
  const [city, setCity] = useState('');
  const [state, setState] = useState('');
  const [stateCode, setStateCode] = useState('');
  const [pincode, setPincode] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [eInvoiceEnabled, setEInvoiceEnabled] = useState(false);

  useEffect(() => {
    gstApi
      .getSettings()
      .then((s: GstSettings) => {
        setGstin(s.gstin ?? '');
        setLegalName(s.legalName);
        setTradeName(s.tradeName ?? '');
        setAddressLine1(s.addressLine1);
        setAddressLine2(s.addressLine2 ?? '');
        setCity(s.city);
        setState(s.state);
        setStateCode(s.stateCode);
        setPincode(s.pincode);
        setEmail(s.email ?? '');
        setPhone(s.phone ?? '');
        setEInvoiceEnabled(!!s.eInvoiceEnabled);
      })
      .catch(() => undefined)
      .finally(() => setLoading(false));
  }, []);

  const { busy, error, success, handle } = useFormSubmit(async () => {
    await gstApi.updateSettings({
      gstin: gstin || undefined,
      legalName,
      tradeName: tradeName || undefined,
      addressLine1,
      addressLine2: addressLine2 || undefined,
      city,
      state,
      stateCode,
      pincode,
      email: email || undefined,
      phone: phone || undefined,
      eInvoiceEnabled,
    });
  });

  const onStateChange = (code: string) => {
    setStateCode(code);
    const found = INDIAN_STATES.find((s) => s.code === code);
    if (found) setState(found.name);
  };

  if (loading) {
    return <p className="muted">Loading GST settings…</p>;
  }

  return (
    <>
      <PageHeader
        icon={<Settings size={22} />}
        title="GST Settings"
        subtitle="Legal entity details for tax invoices"
      />

      <div className="panel">
        {error ? <Alert>{error}</Alert> : null}
        {success ? <Alert variant="success">Settings saved.</Alert> : null}
        <form
          className="form-stack"
          onSubmit={(e) => {
            void handle(e);
          }}
        >
          <div className="grid-2">
            <Field label="GSTIN" htmlFor="gstin">
              <input
                id="gstin"
                value={gstin}
                onChange={(e) => setGstin(e.target.value.toUpperCase())}
                placeholder="22AAAAA0000A1Z5"
              />
            </Field>
            <Field label="Legal name" htmlFor="legal">
              <input
                id="legal"
                value={legalName}
                onChange={(e) => setLegalName(e.target.value)}
                required
              />
            </Field>
            <Field label="Trade name" htmlFor="trade">
              <input
                id="trade"
                value={tradeName}
                onChange={(e) => setTradeName(e.target.value)}
              />
            </Field>
            <Field label="Email" htmlFor="gst-email">
              <input
                id="gst-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </Field>
            <Field label="Phone" htmlFor="gst-phone">
              <input
                id="gst-phone"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
              />
            </Field>
          </div>
          <Field label="Address line 1" htmlFor="addr1">
            <input
              id="addr1"
              value={addressLine1}
              onChange={(e) => setAddressLine1(e.target.value)}
              required
            />
          </Field>
          <Field label="Address line 2" htmlFor="addr2">
            <input
              id="addr2"
              value={addressLine2}
              onChange={(e) => setAddressLine2(e.target.value)}
            />
          </Field>
          <div className="grid-3">
            <Field label="City" htmlFor="city">
              <input
                id="city"
                value={city}
                onChange={(e) => setCity(e.target.value)}
                required
              />
            </Field>
            <Field label="State code" htmlFor="stateCode">
              <select
                id="stateCode"
                value={stateCode}
                onChange={(e) => onStateChange(e.target.value)}
                required
              >
                <option value="">Select</option>
                {INDIAN_STATES.map((s) => (
                  <option key={s.code} value={s.code}>
                    {s.code} — {s.name}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Pincode" htmlFor="pin">
              <input
                id="pin"
                value={pincode}
                onChange={(e) => setPincode(e.target.value)}
                required
                maxLength={6}
              />
            </Field>
          </div>
          <label className="field">
            <span className="field-label">
              <input
                type="checkbox"
                checked={eInvoiceEnabled}
                onChange={(e) => setEInvoiceEnabled(e.target.checked)}
                style={{ width: 'auto', marginRight: '0.5rem' }}
              />
              Enable e-Invoice (IRN) integration
            </span>
          </label>
          <Button type="submit" disabled={busy}>
            {busy ? 'Saving…' : 'Save settings'}
          </Button>
        </form>
      </div>
    </>
  );
}
