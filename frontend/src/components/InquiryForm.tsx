import { useEffect, useState, type FormEvent } from 'react';
import { publicApi } from '../api';
import { Alert, Button, Field } from './ui';

export function InquiryForm({
  idPrefix,
  submitLabel = 'Send inquiry',
  onSuccess,
  initialMessage = '',
}: {
  idPrefix: string;
  submitLabel?: string;
  onSuccess?: () => void;
  initialMessage?: string;
}) {
  const [name, setName] = useState('');
  const [businessName, setBusinessName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState(initialMessage);

  useEffect(() => {
    if (initialMessage) setMessage(initialMessage);
  }, [initialMessage]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const submitInquiry = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    setBusy(true);
    try {
      const res = await publicApi.createInquiry({
        name,
        businessName,
        phone,
        email,
        message,
      });
      setSuccess(res.message);
      setName('');
      setBusinessName('');
      setPhone('');
      setEmail('');
      setMessage('');
      onSuccess?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not submit inquiry');
    } finally {
      setBusy(false);
    }
  };

  return (
    <form className="landing-form" onSubmit={(e) => void submitInquiry(e)}>
      {error ? <Alert>{error}</Alert> : null}
      {success ? <Alert variant="success">{success}</Alert> : null}
      <div className="grid-2">
        <Field label="Your name" htmlFor={`${idPrefix}-name`}>
          <input
            id={`${idPrefix}-name`}
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            maxLength={120}
            autoComplete="name"
          />
        </Field>
        <Field label="Business name" htmlFor={`${idPrefix}-biz`}>
          <input
            id={`${idPrefix}-biz`}
            value={businessName}
            onChange={(e) => setBusinessName(e.target.value)}
            required
            maxLength={160}
            autoComplete="organization"
          />
        </Field>
        <Field label="Phone" htmlFor={`${idPrefix}-phone`}>
          <input
            id={`${idPrefix}-phone`}
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            required
            maxLength={20}
            autoComplete="tel"
          />
        </Field>
        <Field label="Email" htmlFor={`${idPrefix}-email`}>
          <input
            id={`${idPrefix}-email`}
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            maxLength={160}
            autoComplete="email"
          />
        </Field>
      </div>
      <Field label="How can we help?" htmlFor={`${idPrefix}-msg`}>
        <textarea
          id={`${idPrefix}-msg`}
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          required
          minLength={10}
          maxLength={2000}
          rows={4}
          placeholder="Tell us about your GST billing needs…"
        />
      </Field>
      <Button type="submit" disabled={busy}>
        {busy ? 'Sending…' : submitLabel}
      </Button>
    </form>
  );
}
