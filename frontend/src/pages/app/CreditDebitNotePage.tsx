import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { invoicesApi } from '../../api';
import type { CreateInvoicePayload, Invoice } from '../../types';
import { toNum } from '../../utils/format';
import {
  Alert,
  Button,
  Field,
  PageHeader,
  useFormSubmit,
} from '../../components/ui';

export function CreditDebitNotePage() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const type = (params.get('type') === 'debit' ? 'debit' : 'credit') as
    | 'credit'
    | 'debit';
  const refId = params.get('ref') ?? '';

  const [refInvoice, setRefInvoice] = useState<Invoice | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [reason, setReason] = useState('');
  const [qtyFactor, setQtyFactor] = useState(1);

  useEffect(() => {
    if (!refId) {
      setLoadError('Open this page from a bill (Credit / Debit note action).');
      return;
    }
    void invoicesApi
      .get(refId)
      .then(setRefInvoice)
      .catch((e: Error) => setLoadError(e.message));
  }, [refId]);

  const { busy, error, success, handle } = useFormSubmit(async () => {
    if (!refInvoice) throw new Error('Reference invoice required');
    const lines = (refInvoice.lines ?? []).map((l) => ({
      itemId: l.itemId ?? undefined,
      description: l.description,
      hsnSac: l.hsnSac ?? undefined,
      qty: toNum(l.qty) * qtyFactor,
      rate: toNum(l.rate),
      discount: toNum(l.discount) * qtyFactor,
      gstRate: toNum(l.gstRate),
    }));
    let subtotal = 0;
    for (const l of lines) {
      const taxable = Math.round((Math.max(0, l.qty * l.rate - (l.discount ?? 0)) + Number.EPSILON) * 100) / 100;
      const tax = Math.round((taxable * l.gstRate) / 100 * 100) / 100;
      subtotal = Math.round((subtotal + taxable + tax) * 100) / 100;
    }
    const grandTotal = Math.round(subtotal);
    const payload: CreateInvoicePayload = {
      partyId: refInvoice.partyId ?? undefined,
      partyName: refInvoice.partyName,
      partyPhone: refInvoice.partyPhone ?? undefined,
      partyAddress: refInvoice.partyAddress ?? undefined,
      partyGstin: refInvoice.partyGstin ?? undefined,
      partyExternalId: refInvoice.partyExternalId ?? undefined,
      referenceInvoiceId: refInvoice.id,
      notes: reason || undefined,
      lines,
      payments: [{ mode: 'CASH', amount: grandTotal }],
    };

    const created =
      type === 'credit'
        ? await invoicesApi.createCreditNote(payload)
        : await invoicesApi.createDebitNote(payload);
    await invoicesApi.finalize(created.id);
    navigate(`/app/bills/${created.id}`);
  });

  return (
    <>
      <PageHeader
        title={type === 'credit' ? 'Credit note' : 'Debit note'}
        subtitle={
          refInvoice
            ? `Against ${refInvoice.billNo} · ${refInvoice.partyName}`
            : 'GST adjustment document'
        }
      />
      {loadError ? <Alert>{loadError}</Alert> : null}
      {error ? <Alert>{error}</Alert> : null}
      {success ? <Alert variant="success">{success}</Alert> : null}

      {refInvoice ? (
        <div className="panel">
          <form className="form-stack" onSubmit={(e) => void handle(e)}>
            <p>
              Original total:{' '}
              <strong>₹{toNum(refInvoice.grandTotal).toLocaleString('en-IN')}</strong>
            </p>
            <Field label="Reason / notes" htmlFor="cn-r">
              <textarea
                id="cn-r"
                rows={3}
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                required
              />
            </Field>
            <Field label="Quantity factor (1 = full, 0.5 = half)" htmlFor="cn-q">
              <input
                id="cn-q"
                type="number"
                min={0.01}
                max={1}
                step={0.01}
                value={qtyFactor}
                onChange={(e) => setQtyFactor(Number(e.target.value))}
              />
            </Field>
            <Button type="submit" disabled={busy}>
              {busy
                ? 'Creating…'
                : `Create & finalize ${type === 'credit' ? 'credit' : 'debit'} note`}
            </Button>
          </form>
        </div>
      ) : null}
    </>
  );
}
