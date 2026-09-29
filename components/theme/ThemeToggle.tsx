'use client';

import { useEffect, useState } from 'react';
import { Moon, Sun } from 'lucide-react';

const STORAGE_KEY = 'evchargeops-theme';

type Theme = 'light' | 'dark';

/**
 * Dark mode toggle.
 *
 * Mounted state starts as null so the server and the first client render agree.
 * The real theme is read after mount from the class that ThemeScript already put
 * on <html>, which avoids both a hydration mismatch and a flash of the wrong
 * icon. The button is sized to stay stable across the swap so the header does
 * not shift.
 */
export default function ThemeToggle() {
  const [theme, setTheme] = useState<Theme | null>(null);

  useEffect(() => {
    setTheme(document.documentElement.classList.contains('dark') ? 'dark' : 'light');
  }, []);

  function toggle() {
    const next: Theme = theme === 'dark' ? 'light' : 'dark';
    setTheme(next);

    const root = document.documentElement;
    root.classList.toggle('dark', next === 'dark');
    // Tells the browser to render native controls (scrollbars, date inputs) in
    // the matching palette, which the class alone does not control.
    root.style.colorScheme = next;

    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // Private browsing or a blocked storage partition. The theme still
      // applies for this page view; it just will not persist.
    }
  }

  const isDark = theme === 'dark';

  return (
    <button
      type="button"
      onClick={toggle}
      className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-line bg-surface text-ink-muted transition-colors hover:bg-surface-sunken hover:text-ink dark:border-slate-700 dark:bg-slate-800/60 dark:text-slate-400 dark:hover:bg-slate-700/60 dark:hover:text-slate-100"
      title={isDark ? 'เปลี่ยนเป็นโหมดสว่าง' : 'เปลี่ยนเป็นโหมดมืด'}
      aria-label={isDark ? 'เปลี่ยนเป็นโหมดสว่าง' : 'เปลี่ยนเป็นโหมดมืด'}
    >
      {/* Rendered only once the theme is known, so the icon never disagrees
          with the class on <html> during hydration. */}
      {theme === null ? null : isDark ? (
        <Sun className="h-4 w-4" aria-hidden="true" />
      ) : (
        <Moon className="h-4 w-4" aria-hidden="true" />
      )}
    </button>
  );
}
