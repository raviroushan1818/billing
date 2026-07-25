import { useEffect, useState } from 'react';
import { platformApi } from '../../api';
import type { BillingAnalytics, SubscriptionPlan } from '../../types';
import {
  Alert,
  Button,
  DataTable,
  Field,
  PageHeader,
  useFormSubmit,
} from '../../components/ui';

function featuresText(f: SubscriptionPlan['features']): string {
  if (Array.isArray(f)) return f.join('\n');
  return '';
}

export function PlansPage() {
  const [plans, setPlans] = useState<SubscriptionPlan[]>([]);
  const [analytics, setAnalytics] = useState<BillingAnalytics | null>(null);
  const [editing, setEditing] = useState<SubscriptionPlan | null>(null);
  const [showForm, setShowForm] = useState(false);

  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [priceMonthlyInr, setPriceMonthly] = useState(199);
  const [priceYearlyInr, setPriceYearly] = useState(1999);
  const [maxUsers, setMaxUsers] = useState(2);
  const [maxInvoices, setMaxInvoices] = useState(1200);
  const [features, setFeatures] = useState('');
  const [isPublic, setIsPublic] = useState(true);
  const [isActive, setIsActive] = useState(true);
  const [isCustom, setIsCustom] = useState(false);
  const [sortOrder, setSortOrder] = useState(0);

  const load = () => {
    void platformApi.listPlans().then(setPlans).catch(() => setPlans([]));
    void platformApi
      .billingAnalytics()
      .then(setAnalytics)
      .catch(() => setAnalytics(null));
  };

  useEffect(() => {
    load();
  }, []);

  const resetForm = () => {
    setEditing(null);
    setCode('');
    setName('');
    setDescription('');
    setPriceMonthly(199);
    setPriceYearly(1999);
    setMaxUsers(2);
    setMaxInvoices(1200);
    setFeatures('');
    setIsPublic(true);
    setIsActive(true);
    setIsCustom(false);
    setSortOrder(0);
  };

  const openEdit = (p: SubscriptionPlan) => {
    setEditing(p);
    setShowForm(true);
    setCode(p.code);
    setName(p.name);
    setDescription(p.description ?? '');
    setPriceMonthly(p.priceMonthlyInr);
    setPriceYearly(p.priceYearlyInr);
    setMaxUsers(p.maxUsers);
    setMaxInvoices(p.maxInvoices);
    setFeatures(featuresText(p.features));
    setIsPublic(p.isPublic ?? true);
    setIsActive(p.isActive ?? true);
    setIsCustom(p.isCustom ?? false);
    setSortOrder(p.sortOrder ?? 0);
  };

  const { busy, error, success, handle } = useFormSubmit(async () => {
    const payload = {
      code: code.toUpperCase().trim(),
      name,
      description,
      priceMonthlyInr,
      priceYearlyInr,
      maxUsers,
      maxInvoices,
      features: features
        .split('\n')
        .map((s) => s.trim())
        .filter(Boolean),
      isPublic,
      isActive,
      isCustom,
      sortOrder,
    };
    if (editing) {
      await platformApi.updatePlan(editing.id, payload);
    } else {
      await platformApi.createPlan(payload);
    }
    resetForm();
    setShowForm(false);
    load();
  });

  return (
    <>
      <PageHeader
        title="Subscription plans"
        subtitle="India pricing catalog — edit anytime"
        actions={
          <Button
            onClick={() => {
              resetForm();
              setShowForm((v) => !v);
            }}
          >
            {showForm ? 'Hide form' : 'New plan'}
          </Button>
        }
      />

      {analytics ? (
        <div className="panel" style={{ marginBottom: '1rem' }}>
          <div className="grid-2" style={{ gap: '1rem' }}>
            <div>
              <div className="muted">MRR</div>
              <strong>₹{analytics.mrrInr.toLocaleString('en-IN')}</strong>
            </div>
            <div>
              <div className="muted">ARR</div>
              <strong>₹{analytics.arrInr.toLocaleString('en-IN')}</strong>
            </div>
            <div>
              <div className="muted">Active paid</div>
              <strong>{analytics.activePaid}</strong>
            </div>
            <div>
              <div className="muted">Trials / expiring 7d</div>
              <strong>
                {analytics.trials} / {analytics.expiringIn7Days}
              </strong>
            </div>
          </div>
        </div>
      ) : null}

      {showForm ? (
        <div className="panel">
          <h2 className="panel-title">
            {editing ? `Edit ${editing.code}` : 'Create plan'}
          </h2>
          {error ? <Alert>{error}</Alert> : null}
          {success ? <Alert variant="success">{success}</Alert> : null}
          <form className="form-stack" onSubmit={(e) => void handle(e)}>
            <div className="grid-2">
              <Field label="Code" htmlFor="p-code">
                <input
                  id="p-code"
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  required
                  disabled={Boolean(editing)}
                />
              </Field>
              <Field label="Name" htmlFor="p-name">
                <input
                  id="p-name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                />
              </Field>
              <Field label="Monthly ₹" htmlFor="p-m">
                <input
                  id="p-m"
                  type="number"
                  min={0}
                  value={priceMonthlyInr}
                  onChange={(e) => setPriceMonthly(Number(e.target.value))}
                />
              </Field>
              <Field label="Yearly ₹" htmlFor="p-y">
                <input
                  id="p-y"
                  type="number"
                  min={0}
                  value={priceYearlyInr}
                  onChange={(e) => setPriceYearly(Number(e.target.value))}
                />
              </Field>
              <Field label="Max users" htmlFor="p-u">
                <input
                  id="p-u"
                  type="number"
                  min={1}
                  value={maxUsers}
                  onChange={(e) => setMaxUsers(Number(e.target.value))}
                />
              </Field>
              <Field label="Max invoices" htmlFor="p-i">
                <input
                  id="p-i"
                  type="number"
                  min={1}
                  value={maxInvoices}
                  onChange={(e) => setMaxInvoices(Number(e.target.value))}
                />
              </Field>
            </div>
            <Field label="Description" htmlFor="p-d">
              <input
                id="p-d"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </Field>
            <Field label="Features (one per line)" htmlFor="p-f">
              <textarea
                id="p-f"
                rows={4}
                value={features}
                onChange={(e) => setFeatures(e.target.value)}
              />
            </Field>
            <div className="grid-2">
              <label>
                <input
                  type="checkbox"
                  checked={isPublic}
                  onChange={(e) => setIsPublic(e.target.checked)}
                />{' '}
                Public on landing
              </label>
              <label>
                <input
                  type="checkbox"
                  checked={isActive}
                  onChange={(e) => setIsActive(e.target.checked)}
                />{' '}
                Active
              </label>
              <label>
                <input
                  type="checkbox"
                  checked={isCustom}
                  onChange={(e) => setIsCustom(e.target.checked)}
                />{' '}
                Custom / Enterprise
              </label>
              <Field label="Sort order" htmlFor="p-s">
                <input
                  id="p-s"
                  type="number"
                  value={sortOrder}
                  onChange={(e) => setSortOrder(Number(e.target.value))}
                />
              </Field>
            </div>
            <Button type="submit" disabled={busy}>
              {busy ? 'Saving…' : editing ? 'Update plan' : 'Create plan'}
            </Button>
          </form>
        </div>
      ) : null}

      <div className="panel">
        <DataTable
          columns={[
            { key: 'code', label: 'Code' },
            { key: 'name', label: 'Name' },
            { key: 'price', label: 'Price' },
            { key: 'limits', label: 'Limits' },
            { key: 'flags', label: 'Flags' },
            { key: 'actions', label: '' },
          ]}
          rows={plans.map((p) => ({
            id: p.id,
            cells: {
              code: <code>{p.code}</code>,
              name: p.name,
              price: (
                <>
                  ₹{p.priceMonthlyInr}/mo · ₹{p.priceYearlyInr}/yr
                </>
              ),
              limits: `${p.maxUsers} users · ${p.maxInvoices} inv`,
              flags: [
                p.isActive ? 'Active' : 'Off',
                p.isPublic ? 'Public' : 'Hidden',
                p.isCustom ? 'Custom' : null,
              ]
                .filter(Boolean)
                .join(' · '),
              actions: (
                <div style={{ display: 'flex', gap: 8 }}>
                  <Button variant="secondary" onClick={() => openEdit(p)}>
                    Edit
                  </Button>
                  {p.isActive ? (
                    <Button
                      variant="secondary"
                      onClick={() =>
                        void platformApi.deactivatePlan(p.id).then(load)
                      }
                    >
                      Deactivate
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
