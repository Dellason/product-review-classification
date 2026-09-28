import { useEffect, useState, type ReactNode } from "react";

// Charts draw at their measured pixel width, so viewBox units are pixels and
// text keeps one size at every screen width.
export function useWidth(fallback = 560) {
  const [node, setNode] = useState<HTMLDivElement | null>(null);
  const [width, setWidth] = useState(fallback);
  useEffect(() => {
    if (!node) return;
    const observer = new ResizeObserver(([entry]) => setWidth(Math.max(260, Math.round(entry.contentRect.width))));
    observer.observe(node);
    return () => observer.disconnect();
  }, [node]);
  return [setNode, width] as const;
}

export type Tip = { x: number; y: number; body: ReactNode } | null;

export function useTip() {
  const [tip, setTip] = useState<Tip>(null);
  const view = tip && <div className="tooltip" style={{ left: tip.x, top: tip.y }}>{tip.body}</div>;
  return { setTip, view };
}
