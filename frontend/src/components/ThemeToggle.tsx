import { Moon, Sun, Palette } from 'lucide-react';
import { useTheme, type ThemeMode } from '../theme/ThemeContext';

export function ThemeToggle() {
  const { mode, accent, setMode, setAccent } = useTheme();

  const cycle = () => {
    const order: ThemeMode[] = ['light', 'dark', 'custom'];
    const next = order[(order.indexOf(mode) + 1) % order.length];
    setMode(next);
  };

  return (
    <div className="theme-toggle">
      <button
        type="button"
        className="btn btn-ghost"
        onClick={cycle}
        title={`Theme: ${mode}`}
      >
        {mode === 'dark' ? (
          <Moon size={16} />
        ) : mode === 'custom' ? (
          <Palette size={16} />
        ) : (
          <Sun size={16} />
        )}
        <span className="theme-toggle-label">{mode}</span>
      </button>
      {mode === 'custom' ? (
        <input
          type="color"
          value={accent}
          onChange={(e) => setAccent(e.target.value)}
          title="Accent color"
          aria-label="Accent color"
        />
      ) : null}
    </div>
  );
}
