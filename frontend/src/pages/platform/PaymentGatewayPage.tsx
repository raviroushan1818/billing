import { useEffect, useState } from 'react';
import { platformApi } from '../../api';
import type { PaymentSettings } from '../../types';
import {
  Alert,
  Button,
  Field,
  PageHeader,
  useFormSubmit,
} from '../../components/ui';

export function PaymentGatewayPage() {
  const [settings, setSettings] = useState<PaymentSettings | null>(null);
  const [gatewayEnabled, setGatewayEnabled] = useState(false);
  const [razorpayKeyId, setKeyId] = useState('');
  const [razorpayKeySecret, setKeySecret] = useState('');
  const [razorpayWebhookSecret, setWebhookSecret] = useState('');
  const [manualUpiId, setUpi] = useState('');
  const [manualBankDetails, setBank] = useState('');
  const [clearSecret, setClearSecret] = useState(false);
  const [clearWebhook, setClearWebhook] = useState(false);

  const load = () => {
    void platformApi.getPaymentSettings().then((s) => {
      setSettings(s);
      setGatewayEnabled(s.gatewayEnabled);
      setKeyId(s.razorpayKeyId ?? '');
      setUpi(s.manualUpiId ?? '');
      setBank(s.manualBankDetails ?? '');
      setKeySecret('');
      setWebhookSecret('');
      setClearSecret(false);
      setClearWebhook(false);
    });
  };

  useEffect(() => {
    load();
  }, []);

  const { busy, error, success, handle } = useFormSubmit(async () => {
    await platformApi.updatePaymentSettings({
      gatewayEnabled,
      razorpayKeyId: razorpayKeyId || null,
      razorpayKeySecret: clearSecret
        ? ''
        : razorpayKeySecret
          ? razorpayKeySecret
          : undefined,
      razorpayWebhookSecret: clearWebhook
        ? ''
        : razorpayWebhookSecret
          ? razorpayWebhookSecret
          : undefined,
      manualUpiId: manualUpiId || null,
      manualBankDetails: manualBankDetails || null,
    });
    load();
  });

  return (
    <>
      <PageHeader
        title="Payment gateway"
        subtitle="Enable Razorpay with your keys, or keep manual UPI/NEFT activation"
      />

      <div className="panel">
        {error ? <Alert>{error}</Alert> : null}
        {success ? <Alert variant="success">{success}</Alert> : null}
        {settings ? (
          <p className="muted">
            Status:{' '}
            <strong>
              {settings.gatewayEnabled && settings.hasKeySecret
                ? 'Razorpay ready'
                : 'Manual mode'}
            </strong>
            {settings.hasKeySecret ? ' · Key secret saved' : ''}
            {settings.hasWebhookSecret ? ' · Webhook secret saved' : ''}
          </p>
        ) : null}

        <form className="form-stack" onSubmit={(e) => void handle(e)}>
          <label>
            <input
              type="checkbox"
              checked={gatewayEnabled}
              onChange={(e) => setGatewayEnabled(e.target.checked)}
            />{' '}
            Enable Razorpay gateway
          </label>

          <Field label="Razorpay Key ID" htmlFor="rz-key">
            <input
              id="rz-key"
              value={razorpayKeyId}
              onChange={(e) => setKeyId(e.target.value)}
              placeholder="rzp_live_…"
              autoComplete="off"
            />
          </Field>
          <Field
            label="Razorpay Key Secret (leave blank to keep)"
            htmlFor="rz-sec"
          >
            <input
              id="rz-sec"
              type="password"
              value={razorpayKeySecret}
              onChange={(e) => setKeySecret(e.target.value)}
              autoComplete="new-password"
            />
          </Field>
          <label>
            <input
              type="checkbox"
              checked={clearSecret}
              onChange={(e) => setClearSecret(e.target.checked)}
            />{' '}
            Clear key secret
          </label>
          <Field
            label="Webhook secret (leave blank to keep)"
            htmlFor="rz-wh"
          >
            <input
              id="rz-wh"
              type="password"
              value={razorpayWebhookSecret}
              onChange={(e) => setWebhookSecret(e.target.value)}
              autoComplete="new-password"
            />
          </Field>
          <label>
            <input
              type="checkbox"
              checked={clearWebhook}
              onChange={(e) => setClearWebhook(e.target.checked)}
            />{' '}
            Clear webhook secret
          </label>

          <h3>Manual payment instructions</h3>
          <Field label="UPI ID" htmlFor="upi">
            <input
              id="upi"
              value={manualUpiId}
              onChange={(e) => setUpi(e.target.value)}
              placeholder="business@upi"
            />
          </Field>
          <Field label="Bank / NEFT details" htmlFor="bank">
            <textarea
              id="bank"
              rows={4}
              value={manualBankDetails}
              onChange={(e) => setBank(e.target.value)}
            />
          </Field>

          <p className="muted">
            Webhook URL:{' '}
            <code>/api/billing/webhooks/razorpay</code>
          </p>

          <Button type="submit" disabled={busy}>
            {busy ? 'Saving…' : 'Save payment settings'}
          </Button>
        </form>
      </div>
    </>
  );
}
