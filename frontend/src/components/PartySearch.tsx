import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Search, X } from 'lucide-react';
import { partiesApi } from '../api';
import type { Party } from '../types';
import { readPartyMeta } from '../utils/partyMeta';

function highlight(text: string, term: string): ReactNode {
  const t = term.trim();
  if (!t || !text) return text;
  const i = text.toLowerCase().indexOf(t.toLowerCase());
  if (i < 0) return text;
  return (
    <>
      {text.slice(0, i)}
      <mark>{text.slice(i, i + t.length)}</mark>
      {text.slice(i + t.length)}
    </>
  );
}

function demographics(p: Party): string {
  const meta = readPartyMeta(p.customFields as Record<string, unknown> | undefined);
  const age = meta.age ? `${meta.age}${meta.ageUnit === 'M' ? 'm' : 'y'}` : '';
  const gender = meta.gender ? meta.gender.charAt(0).toUpperCase() : '';
  return [age, gender].filter(Boolean).join(' / ');
}

/**
 * Type-ahead search over saved parties by name, phone, ID (UHID etc.) or GSTIN.
 * Arrow keys + Enter select; Esc closes.
 */
export function PartySearch({
  partyLabel,
  partyIdLabel,
  selected,
  onSelect,
  onClear,
}: {
  /** e.g. "Patient Name" */
  partyLabel: string;
  /** e.g. "UHID" */
  partyIdLabel: string;
  selected: Party | null;
  onSelect: (p: Party) => void;
  onClear: () => void;
}) {
  const noun = partyLabel.replace(/\s*name$/i, '').trim() || 'party';
  const [q, setQ] = useState('');
  const [results, setResults] = useState<Party[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [active, setActive] = useState(0);
  const seq = useRef(0);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const term = q.trim();
    if (term.length < 2) {
      setResults([]);
      setLoading(false);
      return;
    }
    const mine = ++seq.current;
    setLoading(true);
    const timer = window.setTimeout(() => {
      partiesApi
        .search(term)
        .then((rows) => {
          if (mine !== seq.current) return; // a newer search superseded this one
          setResults(rows);
          setActive(0);
        })
        .catch(() => {
          if (mine === seq.current) setResults([]);
        })
        .finally(() => {
          if (mine === seq.current) setLoading(false);
        });
    }, 250);
    return () => window.clearTimeout(timer);
  }, [q]);

  const choose = (p: Party) => {
    onSelect(p);
    setQ('');
    setResults([]);
    setOpen(false);
  };

  if (selected) {
    const demo = demographics(selected);
    return (
      <div className="party-selected">
        <div className="party-selected-main">
          <span className="party-selected-tag">Existing {noun.toLowerCase()}</span>
          <strong>{selected.name}</strong>
          <span className="muted">
            {[
              selected.externalId ? `${partyIdLabel} ${selected.externalId}` : '',
              selected.phone ?? '',
              demo,
            ]
              .filter(Boolean)
              .join(' · ')}
          </span>
        </div>
        <button
          type="button"
          className="btn btn-ghost"
          onClick={() => {
            onClear();
            window.setTimeout(() => inputRef.current?.focus(), 0);
          }}
        >
          <X size={14} /> Change
        </button>
      </div>
    );
  }

  const term = q.trim();
  const showPanel = open && term.length >= 2;

  return (
    <div className="party-search">
      <div className="party-search-box">
        <Search size={16} aria-hidden="true" />
        <input
          ref={inputRef}
          type="search"
          role="combobox"
          aria-expanded={showPanel}
          aria-controls="party-search-list"
          aria-label={`Find existing ${noun.toLowerCase()}`}
          placeholder={`Find existing ${noun.toLowerCase()} — type name, phone, ${partyIdLabel} or GSTIN`}
          value={q}
          autoComplete="off"
          spellCheck={false}
          onChange={(e) => {
            setQ(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onBlur={() => window.setTimeout(() => setOpen(false), 150)}
          onKeyDown={(e) => {
            if (e.key === 'ArrowDown') {
              e.preventDefault();
              setOpen(true);
              setActive((i) => Math.min(i + 1, results.length - 1));
            } else if (e.key === 'ArrowUp') {
              e.preventDefault();
              setActive((i) => Math.max(i - 1, 0));
            } else if (e.key === 'Enter') {
              if (showPanel && results[active]) {
                e.preventDefault();
                choose(results[active]);
              }
            } else if (e.key === 'Escape') {
              setOpen(false);
            }
          }}
        />
        {loading ? <span className="party-search-spin" aria-hidden="true" /> : null}
      </div>
      {showPanel ? (
        <div className="party-search-panel" id="party-search-list" role="listbox">
          {results.length ? (
            results.map((p, i) => {
              const demo = demographics(p);
              return (
                <button
                  key={p.id}
                  type="button"
                  role="option"
                  aria-selected={i === active}
                  className={i === active ? 'active' : undefined}
                  onMouseDown={(e) => e.preventDefault()}
                  onMouseEnter={() => setActive(i)}
                  onClick={() => choose(p)}
                >
                  <span className="party-opt-name">{highlight(p.name, term)}</span>
                  <span className="party-opt-meta">
                    {p.externalId ? (
                      <span>
                        {partyIdLabel} {highlight(p.externalId, term)}
                      </span>
                    ) : null}
                    {p.phone ? <span>{highlight(p.phone, term)}</span> : null}
                    {demo ? <span>{demo}</span> : null}
                    {p.gstin ? <span>GSTIN {highlight(p.gstin, term)}</span> : null}
                    {p.address ? <span className="party-opt-addr">{p.address}</span> : null}
                  </span>
                </button>
              );
            })
          ) : loading ? (
            <div className="party-search-empty">Searching…</div>
          ) : (
            <div className="party-search-empty">
              No saved {noun.toLowerCase()} matches “{term}”. Fill in the details below to
              bill a new {noun.toLowerCase()}.
            </div>
          )}
        </div>
      ) : null}
    </div>
  );
}
