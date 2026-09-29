'use client';

import { useEffect, useState } from 'react';
import { Toaster as SonnerToaster } from 'sonner';

/**
 * Toast host, mounted once in the root layout.
 *
 * The sonner theme is driven by the same `dark` class the rest of the app uses,
 * rather than by its own internal state, so toasts can never render light while
 * the page behind them is dark. The class is only read after mount because it is
 * applied by the inline ThemeScript before React exists, which would otherwise
 * disagree with the server rendered markup.
 */
export default function Toaster() {
  const [isDark, setIsDark] = useState(false);

  useEffect(() => {
    const root = document.documentElement;
    const sync = () => setIsDark(root.classList.contains('dark'));
    sync();

    // Observes the class so a toast raised after the user flips the theme still
    // picks up the right palette.
    const observer = new MutationObserver(sync);
    observer.observe(root, { attributes: true, attributeFilter: ['class'] });

    return () => observer.disconnect();
  }, []);

  return (
    <SonnerToaster
      theme={isDark ? 'dark' : 'light'}
      position="top-right"
      closeButton
      richColors
      // Long enough to read an error, short enough not to cover the form.
      duration={4000}
      // 3 keeps a burst of validation errors from filling the whole screen.
      visibleToasts={3}
    />
  );
}
