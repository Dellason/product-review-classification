import { useEffect, useSyncExternalStore } from "react";
import { THEME_KEY, applyTheme, storedChoice, systemTheme, type Theme } from "./theme";

// <html data-theme> is the single source of truth; the no-flash script sets it
// before first paint and this button only reads and flips it.
function subscribe(onChange: () => void) {
  const observer = new MutationObserver(onChange);
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
  return () => observer.disconnect();
}
const current = () => (document.documentElement.dataset.theme === "dark" ? "dark" : "light") as Theme;

export default function ThemeToggle() {
  const theme = useSyncExternalStore(subscribe, current);

  // Keep following the system until the visitor picks a theme.
  useEffect(() => {
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const follow = () => { if (storedChoice() === "system") applyTheme(systemTheme()); };
    follow();
    mq.addEventListener("change", follow);
    return () => mq.removeEventListener("change", follow);
  }, []);

  const next: Theme = theme === "dark" ? "light" : "dark";
  const label = `Switch to ${next} theme`;

  function toggle() {
    const root = document.documentElement;
    root.classList.add("theme-anim");
    window.setTimeout(() => root.classList.remove("theme-anim"), 320);
    applyTheme(next);
    try { localStorage.setItem(THEME_KEY, next); } catch { /* applies for this page only */ }
  }

  // Shows the theme it switches to: a sun while dark, a moon while light.
  return (
    <button type="button" className="theme-toggle" onClick={toggle} aria-label={label} title={label}>
      {theme === "dark" ? (
        <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
          <circle cx="12" cy="12" r="4.2" />
          <path d="M12 2.5v2.2M12 19.3v2.2M2.5 12h2.2M19.3 12h2.2M5.3 5.3l1.6 1.6M17.1 17.1l1.6 1.6M5.3 18.7l1.6-1.6M17.1 6.9l1.6-1.6" />
        </svg>
      ) : (
        <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round">
          <path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z" />
        </svg>
      )}
    </button>
  );
}
