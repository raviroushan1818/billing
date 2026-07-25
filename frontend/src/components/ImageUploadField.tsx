import { useRef, useState, type ChangeEvent } from 'react';
import { ImagePlus, Trash2 } from 'lucide-react';
import { Button } from './ui';

type Props = {
  label: string;
  hint?: string;
  variant: 'logo' | 'banner';
  previewUrl: string | null;
  busy?: boolean;
  onUpload: (file: File) => Promise<void>;
  onRemove: () => Promise<void>;
};

export function ImageUploadField({
  label,
  hint,
  variant,
  previewUrl,
  busy,
  onUpload,
  onRemove,
}: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [localError, setLocalError] = useState<string | null>(null);

  const pick = () => inputRef.current?.click();

  const handleChange = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setLocalError(null);
    if (!file.type.startsWith('image/')) {
      setLocalError('Please choose an image file (JPEG, PNG, WebP, or SVG).');
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      setLocalError('Image must be 2MB or smaller.');
      return;
    }
    try {
      await onUpload(file);
    } catch (err) {
      setLocalError(err instanceof Error ? err.message : 'Upload failed');
    }
  };

  return (
    <div className="image-upload">
      <div className="image-upload-header">
        <span className="field-label">{label}</span>
        {hint ? <span className="field-hint">{hint}</span> : null}
      </div>
      <div className={`image-upload-preview ${variant}`}>
        {previewUrl ? (
          <img src={previewUrl} alt={label} />
        ) : (
          <div className="image-upload-empty">
            <ImagePlus size={22} />
            <span>No {variant} yet</span>
          </div>
        )}
      </div>
      <div className="btn-group">
        <Button type="button" variant="secondary" onClick={pick} disabled={busy}>
          {busy ? 'Uploading…' : previewUrl ? 'Replace' : 'Upload'}
        </Button>
        {previewUrl ? (
          <Button
            type="button"
            variant="ghost"
            disabled={busy}
            onClick={() => {
              void onRemove().catch((err) => {
                setLocalError(
                  err instanceof Error ? err.message : 'Remove failed',
                );
              });
            }}
          >
            <Trash2 size={14} /> Remove
          </Button>
        ) : null}
      </div>
      {localError ? <p className="field-error">{localError}</p> : null}
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/svg+xml"
        hidden
        onChange={(e) => {
          void handleChange(e);
        }}
      />
    </div>
  );
}
