import { useEffect, useMemo, useState } from 'react';
import { partiesApi } from '../../api';
import { useTenantProfile } from '../../hooks/useTenantProfile';
import type { Party } from '../../types';
import { CsvImportControls } from '../../components/CsvImportControls';
import {
  Alert,
  Button,
  DataTable,
  Field,
  PageHeader,
  useFormSubmit,
} from '../../components/ui';
import { UserSquare2 } from 'lucide-react';

export function PartiesPage() {
  const { partyLabel, partyIdLabel, showRefBy, showGstinProminent, showClassField } =
    useTenantProfile();
  const [parties, setParties] = useState<Party[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<Party | null>(null);

  const [name, setName] = useState('');
  const [externalId, setExternalId] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [address, setAddress] = useState('');
  const [gstin, setGstin] = useState('');
  const [refBy, setRefBy] = useState('');
  const [className, setClassName] = useState('');

  const [q, setQ] = useState('');
  const [gstFilter, setGstFilter] = useState<'' | 'yes' | 'no'>('');
  const [activeFilter, setActiveFilter] = useState<'' | 'active' | 'inactive'>(
    'active',
  );

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return parties.filter((p) => {
      if (activeFilter === 'active' && p.isActive === false) return false;
      if (activeFilter === 'inactive' && p.isActive !== false) return false;
      const hasGst = Boolean(p.gstin?.trim());
      if (gstFilter === 'yes' && !hasGst) return false;
      if (gstFilter === 'no' && hasGst) return false;
      if (!needle) return true;
      return (
        p.name.toLowerCase().includes(needle) ||
        (p.phone ?? '').toLowerCase().includes(needle) ||
        (p.email ?? '').toLowerCase().includes(needle) ||
        (p.gstin ?? '').toLowerCase().includes(needle) ||
        (p.externalId ?? '').toLowerCase().includes(needle) ||
        (p.address ?? '').toLowerCase().includes(needle) ||
        (p.referredBy ?? '').toLowerCase().includes(needle)
      );
    });
  }, [parties, q, gstFilter, activeFilter]);

  const load = () => {
    setLoading(true);
    partiesApi
      .list()
      .then(setParties)
      .catch(() => setParties([]))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
  }, []);

  const resetForm = () => {
    setEditing(null);
    setName('');
    setExternalId('');
    setPhone('');
    setEmail('');
    setAddress('');
    setGstin('');
    setRefBy('');
    setClassName('');
  };

  const startEdit = (p: Party) => {
    setEditing(p);
    setName(p.name);
    setExternalId(p.externalId ?? '');
    setPhone(p.phone ?? '');
    setEmail(p.email ?? '');
    setAddress(p.address ?? '');
    setGstin(p.gstin ?? '');
    setRefBy(p.referredBy ?? '');
    const cf = p.customFields as Record<string, string> | undefined;
    setClassName(cf?.class ?? '');
  };

  const { busy, error, success, handle } = useFormSubmit(async () => {
    const payload: Partial<Party> = {
      name: name.trim(),
      externalId: externalId || undefined,
      phone: phone || undefined,
      email: email || undefined,
      address: address || undefined,
      gstin: gstin || undefined,
      referredBy: refBy || undefined,
      customFields: showClassField && className ? { class: className } : {},
    };
    if (editing) {
      await partiesApi.update(editing.id, payload);
    } else {
      await partiesApi.create(payload);
    }
    resetForm();
    load();
  });

  const resetFilters = () => {
    setQ('');
    setGstFilter('');
    setActiveFilter('active');
  };

  return (
    <>
      <PageHeader
        icon={<UserSquare2 size={22} />}
        title="Parties"
        subtitle={`Manage ${partyLabel.toLowerCase()} records`}
        actions={
          <CsvImportControls
            templatePath="/parties/import/template"
            importPath="/parties/import"
            templateName="parties-template.csv"
            onImported={() => load()}
          />
        }
      />

      <div className="panel">
        <h2 className="panel-title">{editing ? 'Edit party' : 'Add party'}</h2>
        {error ? <Alert>{error}</Alert> : null}
        {success ? <Alert variant="success">{success}</Alert> : null}
        <form
          className="form-stack"
          onSubmit={(e) => {
            void handle(e);
          }}
        >
          <div className="grid-3">
            <Field label={partyIdLabel} htmlFor="p-ext">
              <input
                id="p-ext"
                value={externalId}
                onChange={(e) => setExternalId(e.target.value)}
              />
            </Field>
            <Field label={partyLabel} htmlFor="p-name">
              <input
                id="p-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
            </Field>
            <Field label="Phone" htmlFor="p-phone">
              <input
                id="p-phone"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
              />
            </Field>
            <Field label="Email" htmlFor="p-email">
              <input
                id="p-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </Field>
            {showRefBy ? (
              <Field label="Referred by" htmlFor="p-ref">
                <input
                  id="p-ref"
                  value={refBy}
                  onChange={(e) => setRefBy(e.target.value)}
                />
              </Field>
            ) : null}
            {showGstinProminent ? (
              <Field label="GSTIN" htmlFor="p-gst">
                <input
                  id="p-gst"
                  value={gstin}
                  onChange={(e) => setGstin(e.target.value.toUpperCase())}
                />
              </Field>
            ) : null}
            {showClassField ? (
              <Field label="Class" htmlFor="p-class">
                <input
                  id="p-class"
                  value={className}
                  onChange={(e) => setClassName(e.target.value)}
                />
              </Field>
            ) : null}
            <Field label="Address" htmlFor="p-addr">
              <input
                id="p-addr"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
              />
            </Field>
          </div>
          <div className="btn-group">
            <Button type="submit" disabled={busy}>
              {busy ? 'Saving…' : editing ? 'Update' : 'Create'}
            </Button>
            {editing ? (
              <Button type="button" variant="secondary" onClick={resetForm}>
                Cancel edit
              </Button>
            ) : null}
          </div>
        </form>
      </div>

      <div className="panel">
        <h2 className="panel-title">All parties</h2>
        <div className="filter-bar">
          <Field label="Search" htmlFor="party-q" className="filter-grow">
            <input
              id="party-q"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder={`Name, phone, ${partyIdLabel}, GSTIN…`}
            />
          </Field>
          <Field label="GSTIN" htmlFor="party-gst-f">
            <select
              id="party-gst-f"
              value={gstFilter}
              onChange={(e) =>
                setGstFilter(e.target.value as '' | 'yes' | 'no')
              }
            >
              <option value="">All</option>
              <option value="yes">With GSTIN</option>
              <option value="no">Without GSTIN</option>
            </select>
          </Field>
          <Field label="Status" htmlFor="party-active">
            <select
              id="party-active"
              value={activeFilter}
              onChange={(e) =>
                setActiveFilter(e.target.value as '' | 'active' | 'inactive')
              }
            >
              <option value="">All</option>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </select>
          </Field>
          <div className="filter-bar-actions">
            <Button variant="secondary" onClick={resetFilters}>
              Reset
            </Button>
          </div>
        </div>
        <p className="filter-meta">
          Showing {filtered.length} of {parties.length}
        </p>
        {loading ? (
          <p className="muted">Loading…</p>
        ) : (
          <DataTable
            columns={[
              { key: 'externalId', label: partyIdLabel },
              { key: 'name', label: partyLabel },
              { key: 'phone', label: 'Phone' },
              { key: 'gstin', label: 'GSTIN' },
              { key: 'actions', label: '' },
            ]}
            rows={filtered.map((p) => ({
              id: p.id,
              cells: {
                externalId: p.externalId ?? '—',
                name: p.name,
                phone: p.phone ?? '—',
                gstin: p.gstin ?? '—',
                actions: (
                  <Button variant="secondary" onClick={() => startEdit(p)}>
                    Edit
                  </Button>
                ),
              },
            }))}
            emptyText="No parties match these filters."
          />
        )}
      </div>
    </>
  );
}
