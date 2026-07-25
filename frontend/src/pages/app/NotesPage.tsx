import { useEffect, useMemo, useState } from 'react';
import { notesApi, partiesApi } from '../../api';
import type { Party, WorkspaceNote } from '../../types';
import { useAuth } from '../../auth/AuthContext';
import {
  Alert,
  Button,
  DataTable,
  Field,
  PageHeader,
  useFormSubmit,
} from '../../components/ui';
import { StickyNote, Pin } from 'lucide-react';

export function NotesPage() {
  const { user } = useAuth();
  const canEdit =
    user?.role === 'CLIENT_ADMIN' ||
    user?.role === 'BILLING_OPERATOR' ||
    user?.role === 'ACCOUNTANT';
  const [notes, setNotes] = useState<WorkspaceNote[]>([]);
  const [parties, setParties] = useState<Party[]>([]);
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [partyId, setPartyId] = useState('');
  const [remindAt, setRemindAt] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [q, setQ] = useState('');
  const [pinFilter, setPinFilter] = useState<'' | 'pinned' | 'unpinned'>('');
  const [partyFilter, setPartyFilter] = useState('');
  const [remindFilter, setRemindFilter] = useState<
    '' | 'has' | 'none' | 'overdue'
  >('');
  const [loading, setLoading] = useState(true);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return notes.filter((n) => {
      if (pinFilter === 'pinned' && !n.pinned) return false;
      if (pinFilter === 'unpinned' && n.pinned) return false;
      if (partyFilter === '__none__' && n.partyId) return false;
      if (
        partyFilter &&
        partyFilter !== '__none__' &&
        n.partyId !== partyFilter
      ) {
        return false;
      }
      if (remindFilter === 'has' && !n.remindAt) return false;
      if (remindFilter === 'none' && n.remindAt) return false;
      if (remindFilter === 'overdue') {
        if (!n.remindAt) return false;
        const d = new Date(n.remindAt);
        d.setHours(0, 0, 0, 0);
        if (d >= today) return false;
      }
      if (!needle) return true;
      return (
        n.title.toLowerCase().includes(needle) ||
        n.body.toLowerCase().includes(needle) ||
        (n.party?.name ?? '').toLowerCase().includes(needle)
      );
    });
  }, [notes, q, pinFilter, partyFilter, remindFilter]);

  const load = () => {
    setLoading(true);
    void Promise.all([
      notesApi.list().then(setNotes).catch(() => setNotes([])),
      partiesApi.list().then(setParties).catch(() => setParties([])),
    ]).finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
  }, []);

  const { busy, error, success, handle } = useFormSubmit(async () => {
    await notesApi.create({
      title,
      body,
      partyId: partyId || undefined,
      remindAt: remindAt || undefined,
    });
    setTitle('');
    setBody('');
    setPartyId('');
    setRemindAt('');
    setShowForm(false);
    load();
  });

  return (
    <>
      <PageHeader
        icon={<StickyNote size={22} />}
        title="Notes"
        subtitle="Professional follow-ups linked to parties"
        actions={
          canEdit ? (
            <Button onClick={() => setShowForm((v) => !v)}>
              {showForm ? 'Hide' : 'New note'}
            </Button>
          ) : null
        }
      />

      {showForm && canEdit ? (
        <div className="panel">
          {error ? <Alert>{error}</Alert> : null}
          {success ? <Alert variant="success">{success}</Alert> : null}
          <form className="form-stack" onSubmit={(e) => void handle(e)}>
            <Field label="Title" htmlFor="n-t">
              <input
                id="n-t"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                required
              />
            </Field>
            <Field label="Details" htmlFor="n-b">
              <textarea
                id="n-b"
                rows={4}
                value={body}
                onChange={(e) => setBody(e.target.value)}
              />
            </Field>
            <div className="grid-2">
              <Field label="Party (optional)" htmlFor="n-p">
                <select
                  id="n-p"
                  value={partyId}
                  onChange={(e) => setPartyId(e.target.value)}
                >
                  <option value="">—</option>
                  {parties.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Remind on" htmlFor="n-r">
                <input
                  id="n-r"
                  type="date"
                  value={remindAt}
                  onChange={(e) => setRemindAt(e.target.value)}
                />
              </Field>
            </div>
            <Button type="submit" disabled={busy}>
              {busy ? 'Saving…' : 'Save note'}
            </Button>
          </form>
        </div>
      ) : null}

      <div className="panel">
        <div className="filter-bar">
          <Field label="Search" htmlFor="note-q" className="filter-grow">
            <input
              id="note-q"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Title, body, party…"
            />
          </Field>
          <Field label="Pinned" htmlFor="note-pin">
            <select
              id="note-pin"
              value={pinFilter}
              onChange={(e) =>
                setPinFilter(e.target.value as '' | 'pinned' | 'unpinned')
              }
            >
              <option value="">All</option>
              <option value="pinned">Pinned</option>
              <option value="unpinned">Unpinned</option>
            </select>
          </Field>
          <Field label="Party" htmlFor="note-party">
            <select
              id="note-party"
              value={partyFilter}
              onChange={(e) => setPartyFilter(e.target.value)}
            >
              <option value="">All parties</option>
              <option value="__none__">No party</option>
              {parties.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Reminder" htmlFor="note-rem">
            <select
              id="note-rem"
              value={remindFilter}
              onChange={(e) =>
                setRemindFilter(
                  e.target.value as '' | 'has' | 'none' | 'overdue',
                )
              }
            >
              <option value="">All</option>
              <option value="has">Has reminder</option>
              <option value="none">No reminder</option>
              <option value="overdue">Overdue</option>
            </select>
          </Field>
          <div className="filter-bar-actions">
            <Button
              variant="secondary"
              onClick={() => {
                setQ('');
                setPinFilter('');
                setPartyFilter('');
                setRemindFilter('');
              }}
            >
              Reset
            </Button>
          </div>
        </div>
        <p className="filter-meta">
          Showing {filtered.length} of {notes.length} notes
        </p>
        {loading ? (
          <p className="muted">Loading…</p>
        ) : (
          <DataTable
            columns={[
              { key: 'pin', label: '' },
              { key: 'title', label: 'Title' },
              { key: 'party', label: 'Party' },
              { key: 'remind', label: 'Remind' },
              { key: 'actions', label: '' },
            ]}
            rows={filtered.map((n) => ({
              id: n.id,
              cells: {
                pin: n.pinned ? <Pin size={14} aria-label="Pinned" /> : '',
                title: (
                  <div>
                    <strong>{n.title}</strong>
                    {n.body ? (
                      <div className="muted" style={{ whiteSpace: 'pre-wrap' }}>
                        {n.body.slice(0, 160)}
                        {n.body.length > 160 ? '…' : ''}
                      </div>
                    ) : null}
                  </div>
                ),
                party: n.party?.name ?? '—',
                remind: n.remindAt
                  ? new Date(n.remindAt).toLocaleDateString('en-IN')
                  : '—',
                actions: canEdit ? (
                  <div className="inline-actions">
                    <Button
                      variant="secondary"
                      onClick={() =>
                        void notesApi
                          .update(n.id, { pinned: !n.pinned })
                          .then(load)
                      }
                    >
                      {n.pinned ? 'Unpin' : 'Pin'}
                    </Button>
                    <Button
                      variant="secondary"
                      onClick={() => void notesApi.remove(n.id).then(load)}
                    >
                      Delete
                    </Button>
                  </div>
                ) : null,
              },
            }))}
            emptyText="No notes match these filters."
          />
        )}
      </div>
    </>
  );
}
