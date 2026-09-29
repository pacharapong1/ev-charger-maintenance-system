/**
 * Runs before paint, in the document head, to set the theme class on <html>.
 *
 * Without this, a user with dark mode enabled would see a white flash on every
 * load: React only hydrates after the first paint, so any class applied from a
 * client component arrives too late. This blocking script is the standard fix.
 *
 * Keep it in sync with components/theme/ThemeToggle.tsx.
 */
const THEME_SCRIPT = `(function(){try{var t=localStorage.getItem('evchargeops-theme');var m=window.matchMedia('(prefers-color-scheme: dark)').matches;var d=t==='dark'||(t!=='light'&&m);document.documentElement.classList.toggle('dark',d);document.documentElement.style.colorScheme=d?'dark':'light';}catch(e){}})();`;

export default function ThemeScript() {
  return <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} suppressHydrationWarning />;
}
