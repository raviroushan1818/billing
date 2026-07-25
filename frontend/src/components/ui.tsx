import { useState, type FormEvent, type ReactNode } from 'react';

export function PageHeader({
  title,
  subtitle,
  actions,
  icon,
}: {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
  icon?: ReactNode;
}) {
  return (
    <header className="page-header">
      <div className="page-header-text">
        <h1>
          {icon ? <span className="page-header-icon">{icon}</span> : null}
          {title}
        </h1>
        {subtitle ? <p className="page-subtitle">{subtitle}</p> : null}
      </div>
      {actions ? <div className="page-actions">{actions}</div> : null}
    </header>
  );
}

export function Alert({
  variant = 'error',
  children,
}: {
  variant?: 'error' | 'success' | 'info';
  children: ReactNode;
}) {
  return <div className={`alert alert-${variant}`}>{children}</div>;
}

export function Field({
  label,
  htmlFor,
  hint,
  className,
  children,
}: {
  label: string;
  htmlFor?: string;
  hint?: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <label className={`field${className ? ` ${className}` : ''}`} htmlFor={htmlFor}>
      <span className="field-label">{label}</span>
      {children}
      {hint ? <span className="field-hint">{hint}</span> : null}
    </label>
  );
}

export function Button({
  variant = 'primary',
  type = 'button',
  disabled,
  onClick,
  children,
}: {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  type?: 'button' | 'submit' | 'reset';
  disabled?: boolean;
  onClick?: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type={type}
      className={`btn btn-${variant}`}
      disabled={disabled}
      onClick={onClick}
    >
      {children}
    </button>
  );
}

export function DataTable({
  columns,
  rows,
  emptyText = 'No records found.',
}: {
  columns: Array<{ key: string; label: string; align?: 'left' | 'right' }>;
  rows: Array<{ id: string; cells: Record<string, ReactNode> }>;
  emptyText?: string;
}) {
  if (!rows.length) {
    return <p className="empty-state">{emptyText}</p>;
  }
  return (
    <div className="table-wrap">
      <table className="data-table">
        <thead>
          <tr>
            {columns.map((c) => (
              <th key={c.key} className={c.align === 'right' ? 'num' : undefined}>
                {c.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.id}>
              {columns.map((c) => (
                <td key={c.key} className={c.align === 'right' ? 'num' : undefined}>
                  {row.cells[c.key]}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function StatusBadge({ status }: { status: string }) {
  const upper = status.toUpperCase();
  const cls =
    upper === 'ACTIVE' ||
    upper === 'FINALIZED' ||
    upper === 'PAID' ||
    upper === 'GENERATED' ||
    upper === 'SUCCESS'
      ? 'badge-success'
      : upper === 'DRAFT' ||
          upper === 'TRIAL' ||
          upper === 'PARTIAL' ||
          upper === 'PAST_DUE' ||
          upper === 'PENDING'
        ? 'badge-warn'
        : upper === 'VOID' ||
            upper === 'SUSPENDED' ||
            upper === 'UNPAID' ||
            upper === 'CANCELLED' ||
            upper === 'CANCELED' ||
            upper === 'FAILED' ||
            upper === 'EXPIRED'
          ? 'badge-muted'
          : 'badge-info';
  return <span className={`badge ${cls}`}>{status}</span>;
}

export function useFormSubmit(
  onSubmit: () => Promise<void>,
  successMessage = 'Saved successfully',
) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const handle = async (e?: FormEvent) => {
    e?.preventDefault();
    setError(null);
    setSuccess(null);
    setBusy(true);
    try {
      await onSubmit();
      setSuccess(successMessage);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Request failed');
    } finally {
      setBusy(false);
    }
  };

  return { busy, error, success, setError, setSuccess, handle };
}
