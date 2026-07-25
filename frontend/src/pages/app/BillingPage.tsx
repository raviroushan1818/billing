import { useEffect, useState } from 'react';
import { billingApi, publicApi } from '../../api';
import type { SubscriptionPlan } from '../../types';
import { useAuth } from '../../auth/AuthContext';
import {
  Alert,
  Button,
  PageHeader,
} from '../../components/ui';
import { CreditCard } from 'lucide-react';

declare global {
  interface Window {
    Razorpay?: new (options: Record<string, unknown>) => {
      open: () => void;
    };
  }
}

function loadRazorpayScript(): Promise<void> {
  return new Promise((resolve, reject) => {
    if (window.Razorpay) {
      resolve();
      return;
    }
    const s = document.createElement('script');
    s.src = 'https://checkout.razorpay.com/v1/checkout.js';
    s.onload = () => resolve();
    s.onerror = () => reject(new Error('Failed to load Razorpay'));
    document.body.appendChild(s);
  });
}

export function BillingPage() {
  const { user } = useAuth();
  const isOwner = user?.role === 'CLIENT_ADMIN';
  const [plans, setPlans] = useState<SubscriptionPlan[]>([]);
  const [cycle, setCycle] = useState<'MONTHLY' | 'YEARLY'>('YEARLY');
  const [data, setData] = useState<Awaited<
    ReturnType<typeof billingApi.subscription>
  > | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [manualMsg, setManualMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = () => {
    void billingApi
      .subscription()
      .then(setData)
      .catch((e: Error) => setError(e.message));
    void publicApi.listPlans().then(setPlans).catch(() => setPlans([]));
  };

  useEffect(() => {
    load();
  }, []);

  const pay = async (plan: SubscriptionPlan) => {
    if (!isOwner) {
      setError('Only Owner can change the subscription.');
      return;
    }
    if (plan.isCustom) {
      setError('Enterprise plans require Platform Admin. Use Enquiry.');
      return;
    }
    setBusy(true);
    setError(null);
    setSuccess(null);
    setManualMsg(null);
    try {
      const checkout = await billingApi.checkout({
        planId: plan.id,
        billingCycle: cycle,
      });
      if (checkout.mode === 'manual') {
        setManualMsg(
          [
            checkout.instructions?.message,
            checkout.instructions?.upiId
              ? `UPI: ${checkout.instructions.upiId}`
              : null,
            checkout.instructions?.bankDetails,
            `Amount: ₹${checkout.amountInr} for ${plan.name} (${cycle})`,
          ]
            .filter(Boolean)
            .join('\n'),
        );
        return;
      }
      await loadRazorpayScript();
      if (!window.Razorpay || !checkout.razorpayOrderId || !checkout.keyId) {
        throw new Error('Razorpay unavailable');
      }
      const rzp = new window.Razorpay({
        key: checkout.keyId,
        amount: checkout.amountPaise,
        currency: checkout.currency ?? 'INR',
        name: 'Indian Software Services',
        description: `${plan.name} · ${cycle}`,
        order_id: checkout.razorpayOrderId,
        handler: async (response: {
          razorpay_order_id: string;
          razorpay_payment_id: string;
          razorpay_signature: string;
        }) => {
          try {
            await billingApi.verify({
              orderId: response.razorpay_order_id,
              paymentId: response.razorpay_payment_id,
              signature: response.razorpay_signature,
            });
            setSuccess('Payment successful. Plan activated.');
            load();
          } catch (e) {
            setError(e instanceof Error ? e.message : 'Verify failed');
          }
        },
      });
      rzp.open();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Checkout failed');
    } finally {
      setBusy(false);
    }
  };

  const sub = data?.subscription;
  const usage = data?.usage;

  return (
    <>
      <PageHeader
        icon={<CreditCard size={22} />}
        title="Billing"
        subtitle="Your plan, usage, and upgrades"
      />
      {error ? <Alert>{error}</Alert> : null}
      {success ? <Alert variant="success">{success}</Alert> : null}
      {manualMsg ? (
        <Alert variant="success">
          <pre style={{ whiteSpace: 'pre-wrap', margin: 0, fontFamily: 'inherit' }}>
            {manualMsg}
          </pre>
        </Alert>
      ) : null}

      <div className="panel">
        <h2 className="panel-title">Current plan</h2>
        {data ? (
          <div className="grid-2">
            <div>
              <div className="muted">Plan</div>
              <strong>
                {sub?.plan?.name ?? data.tenant.planCode} ({data.tenant.status})
              </strong>
            </div>
            <div>
              <div className="muted">Subscription</div>
              <strong>{sub?.status ?? '—'}</strong>
              {sub ? (
                <div className="muted">
                  Ends {new Date(sub.endsAt).toLocaleDateString('en-IN')}
                </div>
              ) : null}
            </div>
            <div>
              <div className="muted">Users</div>
              <strong>
                {usage?.users ?? 0} / {data.tenant.maxUsers}
              </strong>
            </div>
            <div>
              <div className="muted">Invoices</div>
              <strong>
                {usage?.invoices ?? 0} / {data.tenant.maxInvoices}
              </strong>
            </div>
            <div>
              <div className="muted">Payment mode</div>
              <strong>
                {data.paymentMode.mode === 'razorpay'
                  ? 'Online (Razorpay)'
                  : 'Manual (UPI / admin)'}
              </strong>
            </div>
          </div>
        ) : (
          <p className="muted">Loading…</p>
        )}
      </div>

      <div className="panel">
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            gap: 12,
            flexWrap: 'wrap',
          }}
        >
          <h2 className="panel-title" style={{ margin: 0 }}>
            Upgrade
          </h2>
          <div>
            <Button
              variant={cycle === 'YEARLY' ? undefined : 'secondary'}
              onClick={() => setCycle('YEARLY')}
            >
              Yearly
            </Button>{' '}
            <Button
              variant={cycle === 'MONTHLY' ? undefined : 'secondary'}
              onClick={() => setCycle('MONTHLY')}
            >
              Monthly
            </Button>
          </div>
        </div>
        <div className="grid-2" style={{ marginTop: '1rem' }}>
          {plans
            .filter((p) => !p.isCustom)
            .map((p) => {
              const price =
                cycle === 'YEARLY' ? p.priceYearlyInr : p.priceMonthlyInr;
              const feats = Array.isArray(p.features) ? p.features : [];
              return (
                <div key={p.id} className="panel" style={{ margin: 0 }}>
                  <h3>{p.name}</h3>
                  <p className="muted">{p.description}</p>
                  <p>
                    <strong>₹{price.toLocaleString('en-IN')}</strong>
                    <span className="muted">
                      {' '}
                      / {cycle === 'YEARLY' ? 'year' : 'month'} + GST
                    </span>
                  </p>
                  <ul>
                    {feats.slice(0, 6).map((f) => (
                      <li key={String(f)}>{String(f)}</li>
                    ))}
                  </ul>
                  <Button
                    disabled={busy || !isOwner}
                    onClick={() => void pay(p)}
                  >
                    {busy ? '…' : isOwner ? 'Choose plan' : 'Owner only'}
                  </Button>
                </div>
              );
            })}
        </div>
      </div>
    </>
  );
}
