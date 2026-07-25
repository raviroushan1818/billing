import { useEffect, useState } from 'react';
import { platformApi } from '../../api';
import type { SubscriptionPlan, Tenant, TenantSubscription } from '../../types';
import {
  Alert,
  Button,
  DataTable,
  Field,
  PageHeader,
  StatusBadge,
  useFormSubmit,
} from '../../components/ui';

export function SubscriptionsPage() {
  const [subs, setSubs] = useState<TenantSubscription[]>([]);
  const [plans, setPlans] = useState<SubscriptionPlan[]>([]);
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [filter, setFilter] = useState('');
  const [showAssign, setShowAssign] = useState(false);

  const [tenantId, setTenantId] = useState('');
  const [planId, setPlanId] = useState('');
  const [billingCycle, setBillingCycle] = useState<'MONTHLY' | 'YEARLY'>(
    'YEARLY',
  );
  const [paymentRef, setPaymentRef] = useState('');
  const [notes, setNotes] = useState('');

  const load = () => {
    void platformApi
      .listSubscriptions(filter ? { status: filter } : undefined)
      .then(setSubs)
      .catch(() => setSubs([]));
    void platformApi.listPlans().then(setPlans).catch(() => setPlans([]));
    void platformApi.listTenants().then(setTenants).catch(() => setTenants([]));
  };

  useEffect(() => {
    load();
  }, [filter]);

  const { busy, error, success, handle } = useFormSubmit(async () => {
    await platformApi.assignSubscription(tenantId, {
      planId,
      billingCycle,
      paymentRef: paymentRef || undefined,
      notes: notes || undefined,
      status: 'ACTIVE',
    });
    setShowAssign(false);
    setPaymentRef('');
    setNotes('');
    load();
  });

  return (
    <>
      <PageHeader
        title="Subscriptions"
        subtitle="Assign, renew, or suspend tenant plans"
        actions={
          <Button onClick={() => setShowAssign((v) => !v)}>
            {showAssign ? 'Hide' : 'Assign plan'}
          </Button>
        }
      />

      <div className="panel" style={{ marginBottom: '1rem' }}>
        <Field label="Filter status" htmlFor="f-status">
          <select
            id="f-status"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
          >
            <option value="">All active-ish</option>
            <option value="TRIAL">Trial</option>
            <option value="ACTIVE">Active</option>
            <option value="EXPIRED">Expired</option>
            <option value="CANCELLED">Cancelled</option>
            <option value="PAST_DUE">Past due</option>
          </select>
        </Field>
      </div>

      {showAssign ? (
        <div className="panel">
          <h2 className="panel-title">Assign / change subscription</h2>
          {error ? <Alert>{error}</Alert> : null}
          {success ? <Alert variant="success">{success}</Alert> : null}
          <form className="form-stack" onSubmit={(e) => void handle(e)}>
            <div className="grid-2">
              <Field label="Tenant" htmlFor="s-t">
                <select
                  id="s-t"
                  value={tenantId}
                  onChange={(e) => setTenantId(e.target.value)}
                  required
                >
                  <option value="">Select…</option>
                  {tenants
                    .filter((t) => t.clientId !== 'PLATFORM')
                    .map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.name} ({t.clientId})
                      </option>
                    ))}
                </select>
              </Field>
              <Field label="Plan" htmlFor="s-p">
                <select
                  id="s-p"
                  value={planId}
                  onChange={(e) => setPlanId(e.target.value)}
                  required
                >
                  <option value="">Select…</option>
                  {plans
                    .filter((p) => p.isActive)
                    .map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name} (₹{p.priceYearlyInr}/yr)
                      </option>
                    ))}
                </select>
              </Field>
              <Field label="Billing cycle" htmlFor="s-c">
                <select
                  id="s-c"
                  value={billingCycle}
                  onChange={(e) =>
                    setBillingCycle(e.target.value as 'MONTHLY' | 'YEARLY')
                  }
                >
                  <option value="YEARLY">Yearly</option>
                  <option value="MONTHLY">Monthly</option>
                </select>
              </Field>
              <Field label="Payment ref (UTR)" htmlFor="s-r">
                <input
                  id="s-r"
                  value={paymentRef}
                  onChange={(e) => setPaymentRef(e.target.value)}
                />
              </Field>
            </div>
            <Field label="Notes" htmlFor="s-n">
              <input
                id="s-n"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
              />
            </Field>
            <Button type="submit" disabled={busy}>
              {busy ? 'Saving…' : 'Assign & activate'}
            </Button>
          </form>
        </div>
      ) : null}

      <div className="panel">
        <DataTable
          columns={[
            { key: 'tenant', label: 'Tenant' },
            { key: 'plan', label: 'Plan' },
            { key: 'cycle', label: 'Cycle' },
            { key: 'status', label: 'Status' },
            { key: 'ends', label: 'Ends' },
            { key: 'amount', label: 'Amount' },
            { key: 'actions', label: '' },
          ]}
          rows={subs.map((s) => ({
            id: s.id,
            cells: {
              tenant: s.tenant
                ? `${s.tenant.name} (${s.tenant.clientId})`
                : s.tenantId,
              plan: s.plan?.code ?? s.planId,
              cycle: s.billingCycle,
              status: <StatusBadge status={s.status} />,
              ends: new Date(s.endsAt).toLocaleDateString('en-IN'),
              amount: `₹${s.amountInr}`,
              actions: (
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  <Button
                    variant="secondary"
                    onClick={() =>
                      void platformApi
                        .updateSubscription(s.id, { extendDays: 30 })
                        .then(load)
                    }
                  >
                    +30d
                  </Button>
                  <Button
                    variant="secondary"
                    onClick={() =>
                      void platformApi
                        .updateSubscription(s.id, { extendDays: 365 })
                        .then(load)
                    }
                  >
                    +1y
                  </Button>
                  {s.status !== 'CANCELLED' ? (
                    <Button
                      variant="secondary"
                      onClick={() =>
                        void platformApi
                          .updateSubscription(s.id, { status: 'CANCELLED' })
                          .then(load)
                      }
                    >
                      Cancel
                    </Button>
                  ) : null}
                </div>
              ),
            },
          }))}
        />
      </div>
    </>
  );
}
