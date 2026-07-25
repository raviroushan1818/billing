import { useEffect, useState } from 'react';
import { platformApi } from '../../api';
import type { PlatformInquiry } from '../../types';
import {
  Alert,
  Button,
  DataTable,
  PageHeader,
  StatusBadge,
} from '../../components/ui';

export function InquiriesPage() {
  const [rows, setRows] = useState<PlatformInquiry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<'ALL' | 'NEW' | 'READ'>('ALL');

  const load = () => {
    setLoading(true);
    setError(null);
    platformApi
      .listInquiries(filter === 'ALL' ? undefined : filter)
      .then(setRows)
      .catch((e) => {
        setError(e instanceof Error ? e.message : 'Failed to load inquiries');
        setRows([]);
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
  }, [filter]);

  const markRead = async (id: string) => {
    try {
      setError(null);
      await platformApi.updateInquiryStatus(id, 'READ');
      load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Update failed');
    }
  };

  return (
    <>
      <PageHeader
        title="Demo inquiries"
        subtitle="Leads from the public GST billing landing page"
        actions={
          <div className="inline-actions">
            {(['ALL', 'NEW', 'READ'] as const).map((f) => (
              <Button
                key={f}
                variant={filter === f ? 'primary' : 'secondary'}
                onClick={() => setFilter(f)}
              >
                {f === 'ALL' ? 'All' : f === 'NEW' ? 'New' : 'Read'}
              </Button>
            ))}
          </div>
        }
      />

      {error ? <Alert>{error}</Alert> : null}

      <div className="panel">
        {loading ? (
          <p className="muted">Loading…</p>
        ) : (
          <DataTable
            emptyText="No inquiries yet."
            columns={[
              { key: 'when', label: 'Received' },
              { key: 'name', label: 'Name' },
              { key: 'business', label: 'Business' },
              { key: 'contact', label: 'Contact' },
              { key: 'message', label: 'Message' },
              { key: 'status', label: 'Status' },
              { key: 'actions', label: '' },
            ]}
            rows={rows.map((r) => ({
              id: r.id,
              cells: {
                when: new Date(r.createdAt).toLocaleString(),
                name: r.name,
                business: r.businessName,
                contact: (
                  <div className="actor-cell">
                    <span>{r.email}</span>
                    <span className="muted">{r.phone}</span>
                  </div>
                ),
                message: (
                  <span title={r.message}>
                    {r.message.length > 80
                      ? `${r.message.slice(0, 80)}…`
                      : r.message}
                  </span>
                ),
                status: (
                  <StatusBadge status={r.status === 'NEW' ? 'TRIAL' : 'ACTIVE'} />
                ),
                actions:
                  r.status === 'NEW' ? (
                    <Button
                      variant="secondary"
                      onClick={() => void markRead(r.id)}
                    >
                      Mark read
                    </Button>
                  ) : (
                    '—'
                  ),
              },
            }))}
          />
        )}
      </div>
    </>
  );
}
