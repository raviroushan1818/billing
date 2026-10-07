import { useCallback, useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { Menu, X } from 'lucide-react';

/** Off-canvas sidebar state for tablet/phone widths. */
export function useMobileNav() {
  const [open, setOpen] = useState(false);
  const { pathname } = useLocation();
  const close = useCallback(() => setOpen(false), []);

  // Navigating closes the drawer.
  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return { open, toggle: () => setOpen((v) => !v), close };
}

export function NavToggle({ open, onToggle }: { open: boolean; onToggle: () => void }) {
  return (
    <button
      type="button"
      className="nav-toggle"
      aria-label={open ? 'Close menu' : 'Open menu'}
      aria-expanded={open}
      aria-controls="app-sidebar"
      onClick={onToggle}
    >
      {open ? <X size={20} /> : <Menu size={20} />}
    </button>
  );
}

export function NavBackdrop({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <div
      className={`nav-backdrop${open ? ' open' : ''}`}
      aria-hidden="true"
      onClick={onClose}
    />
  );
}
