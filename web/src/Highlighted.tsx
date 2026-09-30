import type { Chunk } from "./model";

export type Head = "sentiment" | "helpfulness";

// Marker strength follows the word's pull on the log-odds; faint pulls stay bare.
export function markStyle(value: number) {
  const strength = Math.min(1, Math.abs(value) / 0.5);
  if (strength < 0.06) return undefined;
  const alpha = (0.14 + strength * 0.5).toFixed(3);
  return { background: `rgb(var(--${value > 0 ? "pos" : "neg"}-mark) / ${alpha})` };
}

export default function Highlighted({ chunks, head = "sentiment" }: { chunks: Chunk[]; head?: Head }) {
  return (
    <>
      {chunks.map((c, i) => {
        const style = c.term ? markStyle(c[head]) : undefined;
        return style ? <span key={i} className="mark" style={style}>{c.text}</span> : <span key={i}>{c.text}</span>;
      })}
    </>
  );
}
