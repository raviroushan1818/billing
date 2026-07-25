import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';

export type ThemeMode = 'light' | 'dark' | 'custom';

type ThemeState = {
  mode: ThemeMode;
  accent: string;
  setMode: (mode: ThemeMode) => void;
  setAccent: (accent: string) => void;
};

const STORAGE_KEY = 'billing_theme';
const ThemeContext = createContext<ThemeState | null>(null);

function applyTheme(mode: ThemeMode, accent: string) {
  const root = document.documentElement;
  root.setAttribute('data-theme', mode === 'custom' ? 'custom' : mode);
  root.style.setProperty('--theme-accent', accent);
  if (mode === 'custom') {
    root.style.setProperty('--color-teal', accent);
    root.style.setProperty('--color-teal-light', accent);
  } else {
    root.style.removeProperty('--color-teal');
    root.style.removeProperty('--color-teal-light');
  }
}

function loadStored(): { mode: ThemeMode; accent: string } {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { mode: 'light', accent: '#0d7377' };
    const parsed = JSON.parse(raw) as { mode?: ThemeMode; accent?: string };
    return {
      mode: parsed.mode ?? 'light',
      accent: parsed.accent ?? '#0d7377',
    };
  } catch {
    return { mode: 'light', accent: '#0d7377' };
  }
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const initial = loadStored();
  const [mode, setModeState] = useState<ThemeMode>(initial.mode);
  const [accent, setAccentState] = useState(initial.accent);

  useEffect(() => {
    applyTheme(mode, accent);
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ mode, accent }));
  }, [mode, accent]);

  const setMode = useCallback((m: ThemeMode) => setModeState(m), []);
  const setAccent = useCallback((a: string) => setAccentState(a), []);

  const value = useMemo(
    () => ({ mode, accent, setMode, setAccent }),
    [mode, accent, setMode, setAccent],
  );

  return (
    <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
  );
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used within ThemeProvider');
  return ctx;
}
