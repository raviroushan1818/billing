import { useRef, useState } from 'react';
import { Download, Upload } from 'lucide-react';
import { Alert, Button } from './ui';
import { getStoredToken, ApiError, clearAuth } from '../api/client';

const API_BASE = import.meta.env.VITE_API_URL ?? '/api';

export type ImportSummary = {
  created: number;
  updated: number;
  errors: Array<{ row: number; message: string }>;
};

type Props = {
  templatePath: string;
  importPath: string;
  templateName: string;
  onImported?: (result: ImportSummary) => void;
};

export function CsvImportControls({
  templatePath,
  importPath,
  templateName,
  onImported,
}: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<ImportSummary | null>(null);
  const [error, setError] = useState<string | null>(null);

  const downloadTemplate = async () => {
    setError(null);
    try {
      const token = getStoredToken();
      const res = await fetch(`${API_BASE}${templatePath}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      });
      if (res.status === 401) {
        clearAuth();
        window.dispatchEvent(new Event('billing:unauthorized'));
      }
      if (!res.ok) throw new Error('Failed to download template');
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = templateName;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Download failed');
    }
  };

  const upload = async (file: File) => {
    setBusy(true);
    setError(null);
    setResult(null);
    try {
      const token = getStoredToken();
      const body = new FormData();
      body.append('file', file);
      const res = await fetch(`${API_BASE}${importPath}`, {
        method: 'POST',
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
        body,
      });
      if (res.status === 401) {
        clearAuth();
        window.dispatchEvent(new Event('billing:unauthorized'));
      }
      if (!res.ok) {
        let message = res.statusText;
        try {
          const data = await res.json();
          message = Array.isArray(data.message)
            ? data.message.join(', ')
            : (data.message ?? message);
        } catch {
          /* ignore */
        }
        throw new ApiError(res.status, message);
      }
      const summary = (await res.json()) as ImportSummary;
      setResult(summary);
      onImported?.(summary);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Import failed');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="csv-import">
      <div className="btn-group">
        <Button type="button" variant="secondary" onClick={() => void downloadTemplate()}>
          <Download size={14} /> CSV template
        </Button>
        <Button
          type="button"
          variant="secondary"
          disabled={busy}
          onClick={() => inputRef.current?.click()}
        >
          <Upload size={14} /> {busy ? 'Importing…' : 'Import CSV'}
        </Button>
      </div>
      <input
        ref={inputRef}
        type="file"
        accept=".csv,text/csv"
        hidden
        onChange={(e) => {
          const file = e.target.files?.[0];
          e.target.value = '';
          if (file) void upload(file);
        }}
      />
      {error ? <Alert>{error}</Alert> : null}
      {result ? (
        <Alert variant={result.errors.length ? 'info' : 'success'}>
          Imported: {result.created} created, {result.updated} updated
          {result.errors.length
            ? ` · ${result.errors.length} row error(s)${
                result.errors[0]
                  ? ` (row ${result.errors[0].row}: ${result.errors[0].message})`
                  : ''
              }`
            : ''}
        </Alert>
      ) : null}
    </div>
  );
}
