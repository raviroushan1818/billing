import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { ChevronDown } from 'lucide-react';

export type ActionMenuItem = {
  label: string;
  onSelect: () => void;
  danger?: boolean;
  hidden?: boolean;
};

/**
 * "More ▾" dropdown for secondary row actions. Rendered in a portal with fixed
 * positioning so it is not clipped by scrollable table wrappers.
 */
export function ActionMenu({
  items,
  label = 'More',
}: {
  items: ActionMenuItem[];
  label?: string;
}) {
  const visible = items.filter((i) => !i.hidden);
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
  const btnRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    if (!open || !btnRef.current) return;
    const place = () => {
      const r = btnRef.current!.getBoundingClientRect();
      const menuH = menuRef.current?.offsetHeight ?? 0;
      const menuW = menuRef.current?.offsetWidth ?? 200;
      const below = r.bottom + 4 + menuH <= window.innerHeight;
      setPos({
        top: below ? r.bottom + 4 : Math.max(8, r.top - menuH - 4),
        left: Math.min(
          Math.max(8, r.right - menuW),
          window.innerWidth - menuW - 8,
        ),
      });
    };
    place();
    // Re-measure once the menu has rendered with its real size.
    const raf = requestAnimationFrame(place);
    return () => cancelAnimationFrame(raf);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      const t = e.target as Node;
      if (!menuRef.current?.contains(t) && !btnRef.current?.contains(t)) {
        setOpen(false);
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    const onScroll = () => setOpen(false);
    document.addEventListener('mousedown', onDown);
    window.addEventListener('keydown', onKey);
    window.addEventListener('resize', onScroll);
    window.addEventListener('scroll', onScroll, true);
    return () => {
      document.removeEventListener('mousedown', onDown);
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('resize', onScroll);
      window.removeEventListener('scroll', onScroll, true);
    };
  }, [open]);

  if (!visible.length) return null;

  return (
    <>
      <button
        ref={btnRef}
        type="button"
        className="btn btn-secondary action-menu-btn"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        {label} <ChevronDown size={14} />
      </button>
      {open
        ? createPortal(
            <div
              ref={menuRef}
              className="action-menu"
              role="menu"
              style={{
                top: pos?.top ?? -9999,
                left: pos?.left ?? -9999,
              }}
            >
              {visible.map((item) => (
                <button
                  key={item.label}
                  type="button"
                  role="menuitem"
                  className={item.danger ? 'danger' : undefined}
                  onClick={() => {
                    setOpen(false);
                    item.onSelect();
                  }}
                >
                  {item.label}
                </button>
              ))}
            </div>,
            document.body,
          )
        : null}
    </>
  );
}
