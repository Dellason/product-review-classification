// Light/dark theme, shared with the portfolio: same origin, same storage key,
// so a choice made on either carries over. The no-flash script in index.html
// is a copy of resolve() and apply(); keep them in step.

export const THEME_KEY = "jmd-theme";

export type Theme = "light" | "dark";

export function storedChoice(): Theme | "system" {
  try {
    const v = localStorage.getItem(THEME_KEY);
    if (v === "light" || v === "dark") return v;
  } catch {
    /* storage unavailable: follow the system */
  }
  return "system";
}

export const systemTheme = (): Theme =>
  window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";

export function applyTheme(theme: Theme) {
  const root = document.documentElement;
  root.dataset.theme = theme;
  root.style.colorScheme = theme;
  const paper = getComputedStyle(root).getPropertyValue("--paper").trim();
  document.querySelector('meta[name="theme-color"]')?.setAttribute("content", paper);
}
