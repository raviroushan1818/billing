import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
  type ReactNode,
} from 'react';
import { Button, Field } from './ui';

type AlertOpts = {
  title?: string;
  message: string;
  variant?: 'info' | 'success' | 'danger';
  confirmLabel?: string;
};

type ConfirmOpts = {
  title?: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
};

type PromptOpts = {
  title?: string;
  message?: string;
  label?: string;
  placeholder?: string;
  defaultValue?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  required?: boolean;
  multiline?: boolean;
  inputType?: 'text' | 'email' | 'tel';
  options?: Array<{ value: string; label: string }>;
  danger?: boolean;
};

type DialogApi = {
  alert: (opts: AlertOpts | string) => Promise<void>;
  confirm: (opts: ConfirmOpts | string) => Promise<boolean>;
  prompt: (opts: PromptOpts | string) => Promise<string | null>;
};

type DialogState =
  | {
      kind: 'alert';
      opts: AlertOpts;
      resolve: (value: void) => void;
    }
  | {
      kind: 'confirm';
      opts: ConfirmOpts;
      resolve: (value: boolean) => void;
    }
  | {
      kind: 'prompt';
      opts: PromptOpts;
      resolve: (value: string | null) => void;
    };

const DialogContext = createContext<DialogApi | null>(null);

function normalizeAlert(opts: AlertOpts | string): AlertOpts {
  return typeof opts === 'string' ? { message: opts } : opts;
}

function normalizeConfirm(opts: ConfirmOpts | string): ConfirmOpts {
  return typeof opts === 'string' ? { message: opts } : opts;
}

function normalizePrompt(opts: PromptOpts | string): PromptOpts {
  return typeof opts === 'string' ? { message: opts, label: opts } : opts;
}

export function DialogProvider({ children }: { children: ReactNode }) {
  const [dialog, setDialog] = useState<DialogState | null>(null);
  const [promptValue, setPromptValue] = useState('');
  const [promptError, setPromptError] = useState<string | null>(null);
  const inputRef = useRef<
    HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement | null
  >(null);

  const close = useCallback(() => {
    setDialog(null);
    setPromptValue('');
    setPromptError(null);
  }, []);

  const api = useMemo<DialogApi>(
    () => ({
      alert(opts) {
        const normalized = normalizeAlert(opts);
        return new Promise<void>((resolve) => {
          setDialog({ kind: 'alert', opts: normalized, resolve });
        });
      },
      confirm(opts) {
        const normalized = normalizeConfirm(opts);
        return new Promise<boolean>((resolve) => {
          setDialog({ kind: 'confirm', opts: normalized, resolve });
        });
      },
      prompt(opts) {
        const normalized = normalizePrompt(opts);
        setPromptValue(normalized.defaultValue ?? '');
        setPromptError(null);
        return new Promise<string | null>((resolve) => {
          setDialog({ kind: 'prompt', opts: normalized, resolve });
        });
      },
    }),
    [],
  );

  useEffect(() => {
    if (!dialog) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        if (dialog.kind === 'alert') {
          dialog.resolve();
          close();
        } else if (dialog.kind === 'confirm') {
          dialog.resolve(false);
          close();
        } else {
          dialog.resolve(null);
          close();
        }
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [dialog, close]);

  useEffect(() => {
    if (dialog?.kind === 'prompt') {
      const t = window.setTimeout(() => inputRef.current?.focus(), 30);
      return () => window.clearTimeout(t);
    }
  }, [dialog]);

  const submitPrompt = (e?: FormEvent) => {
    e?.preventDefault();
    if (!dialog || dialog.kind !== 'prompt') return;
    const trimmed = promptValue.trim();
    if (dialog.opts.required !== false && !trimmed) {
      setPromptError('This field is required');
      return;
    }
    dialog.resolve(trimmed);
    close();
  };

  return (
    <DialogContext.Provider value={api}>
      {children}
      {dialog ? (
        <div
          className="dialog-backdrop"
          role="presentation"
          onMouseDown={(e) => {
            if (e.target !== e.currentTarget) return;
            if (dialog.kind === 'alert') {
              dialog.resolve();
              close();
            } else if (dialog.kind === 'confirm') {
              dialog.resolve(false);
              close();
            } else {
              dialog.resolve(null);
              close();
            }
          }}
        >
          <div
            className={`dialog-card dialog-${dialog.kind}${
              (dialog.kind === 'confirm' && dialog.opts.danger) ||
              (dialog.kind === 'prompt' && dialog.opts.danger)
                ? ' dialog-danger'
                : ''
            }`}
            role="dialog"
            aria-modal="true"
            aria-labelledby="dialog-title"
          >
            {dialog.kind === 'alert' ? (
              <>
                <div className="dialog-header">
                  <h2 id="dialog-title">
                    {dialog.opts.title ??
                      (dialog.opts.variant === 'success'
                        ? 'Success'
                        : dialog.opts.variant === 'danger'
                          ? 'Notice'
                          : 'Notice')}
                  </h2>
                </div>
                <p className="dialog-message">{dialog.opts.message}</p>
                <div className="dialog-actions">
                  <Button
                    variant={
                      dialog.opts.variant === 'danger' ? 'danger' : 'primary'
                    }
                    onClick={() => {
                      dialog.resolve();
                      close();
                    }}
                  >
                    {dialog.opts.confirmLabel ?? 'OK'}
                  </Button>
                </div>
              </>
            ) : null}

            {dialog.kind === 'confirm' ? (
              <>
                <div className="dialog-header">
                  <h2 id="dialog-title">
                    {dialog.opts.title ??
                      (dialog.opts.danger ? 'Please confirm' : 'Confirm')}
                  </h2>
                </div>
                <p className="dialog-message">{dialog.opts.message}</p>
                <div className="dialog-actions">
                  <Button
                    variant="secondary"
                    onClick={() => {
                      dialog.resolve(false);
                      close();
                    }}
                  >
                    {dialog.opts.cancelLabel ?? 'Cancel'}
                  </Button>
                  <Button
                    variant={dialog.opts.danger ? 'danger' : 'primary'}
                    onClick={() => {
                      dialog.resolve(true);
                      close();
                    }}
                  >
                    {dialog.opts.confirmLabel ??
                      (dialog.opts.danger ? 'Confirm' : 'Continue')}
                  </Button>
                </div>
              </>
            ) : null}

            {dialog.kind === 'prompt' ? (
              <form
                onSubmit={(e) => {
                  submitPrompt(e);
                }}
              >
                <div className="dialog-header">
                  <h2 id="dialog-title">
                    {dialog.opts.title ?? 'Enter details'}
                  </h2>
                </div>
                {dialog.opts.message ? (
                  <p className="dialog-message">{dialog.opts.message}</p>
                ) : null}
                <Field
                  label={dialog.opts.label ?? 'Value'}
                  htmlFor="dialog-prompt-input"
                >
                  {dialog.opts.options?.length ? (
                    <select
                      id="dialog-prompt-input"
                      ref={(el) => {
                        inputRef.current = el;
                      }}
                      value={promptValue}
                      onChange={(e) => {
                        setPromptValue(e.target.value);
                        setPromptError(null);
                      }}
                    >
                      {dialog.opts.options.map((o) => (
                        <option key={o.value} value={o.value}>
                          {o.label}
                        </option>
                      ))}
                    </select>
                  ) : dialog.opts.multiline ? (
                    <textarea
                      id="dialog-prompt-input"
                      ref={(el) => {
                        inputRef.current = el;
                      }}
                      value={promptValue}
                      placeholder={dialog.opts.placeholder}
                      rows={3}
                      onChange={(e) => {
                        setPromptValue(e.target.value);
                        setPromptError(null);
                      }}
                    />
                  ) : (
                    <input
                      id="dialog-prompt-input"
                      ref={(el) => {
                        inputRef.current = el;
                      }}
                      type={dialog.opts.inputType ?? 'text'}
                      value={promptValue}
                      placeholder={dialog.opts.placeholder}
                      onChange={(e) => {
                        setPromptValue(e.target.value);
                        setPromptError(null);
                      }}
                    />
                  )}
                </Field>
                {promptError ? (
                  <p className="dialog-error">{promptError}</p>
                ) : null}
                <div className="dialog-actions">
                  <Button
                    variant="secondary"
                    type="button"
                    onClick={() => {
                      dialog.resolve(null);
                      close();
                    }}
                  >
                    {dialog.opts.cancelLabel ?? 'Cancel'}
                  </Button>
                  <Button
                    variant={dialog.opts.danger ? 'danger' : 'primary'}
                    type="submit"
                  >
                    {dialog.opts.confirmLabel ?? 'Submit'}
                  </Button>
                </div>
              </form>
            ) : null}
          </div>
        </div>
      ) : null}
    </DialogContext.Provider>
  );
}

export function useDialog(): DialogApi {
  const ctx = useContext(DialogContext);
  if (!ctx) {
    throw new Error('useDialog must be used within DialogProvider');
  }
  return ctx;
}
