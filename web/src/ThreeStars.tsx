import { useMemo, useState } from "react";
import { scaleLinear } from "d3-scale";
import { useTip, useWidth } from "./charts";
import Highlighted from "./Highlighted";
import type { Reading } from "./model";
import { count, pct, type NeutralCard, type Reviews } from "./data";

const BINS = 20;

function histogram(values: number[]) {
  const bins = new Array(BINS).fill(0);
  for (const v of values) bins[Math.min(BINS - 1, Math.floor(v * BINS))]++;
  return bins.map(b => b / values.length);
}

function Distributions({ reviews }: { reviews: Reviews }) {
  const [frame, width] = useWidth();
  const { setTip, view } = useTip();
  const groups = [
    { name: "1–2 stars", values: reviews.negativeProbability, color: "var(--neg)" },
    { name: "3 stars", values: reviews.neutralProbability, color: "var(--violet)" },
    { name: "4–5 stars", values: reviews.positiveProbability, color: "var(--pos)" },
  ].map(g => ({ ...g, bins: histogram(g.values) }));
  const rowH = 70, gap = 18, left = 74, top = 6, bottom = 26;
  const height = top + groups.length * (rowH + gap) - gap + bottom;
  const x = scaleLinear().domain([0, 1]).range([left, width - 8]);
  const peak = Math.max(...groups.flatMap(g => g.bins));
  const y = scaleLinear().domain([0, peak]).range([0, rowH]);
  const bw = (x(1) - x(0)) / BINS;

  return (
    <div className="chart-frame" ref={frame}>
      <svg className="chart" width={width} height={height} viewBox={`0 0 ${width} ${height}`} role="img"
        aria-label="How likely the model thinks reviews are positive, for 1–2, 3 and 4–5 star reviews">
        <line x1={x(0.5)} x2={x(0.5)} y1={top} y2={height - bottom + 4} stroke="var(--ink-soft)" strokeDasharray="3 3" />
        {groups.map((g, gi) => {
          const base = top + gi * (rowH + gap) + rowH;
          return (
            <g key={g.name}>
              <text x={0} y={base - rowH / 2} dy="0.35em" className="strong">{g.name}</text>
              <text x={0} y={base - rowH / 2 + 15} dy="0.35em">{count(g.values.length)} reviews</text>
              <line x1={left} x2={width - 8} y1={base} y2={base} stroke="var(--rule)" />
              {g.bins.map((b, i) => (
                <rect key={i} x={x(i / BINS) + 1} y={base - y(b)} width={bw - 2} height={y(b)} rx={2} fill={g.color}
                  opacity={0.85}
                  onMouseEnter={() => setTip({ x: x(i / BINS) + bw / 2, y: base - y(b), body: <>{g.name}: {pct(b, 1)} of reviews<br />read {pct(i / BINS)}–{pct((i + 1) / BINS)} positive</> })}
                  onMouseLeave={() => setTip(null)} />
              ))}
            </g>
          );
        })}
        {[0, 0.25, 0.5, 0.75, 1].map(t => <text key={t} x={x(t)} y={height - 6} textAnchor="middle">{pct(t)}</text>)}
      </svg>
      {view}
    </div>
  );
}

function Card({ card, read }: { card: NeutralCard; read: (t: string) => Reading }) {
  const [open, setOpen] = useState(false);
  const reading = useMemo(() => read(card.body), [read, card.body]);
  const long = card.body.length > 520;
  const p = card.probability;
  return (
    <article className="panel card">
      <div className="row" style={{ justifyContent: "space-between" }}>
        <span className="small muted">3 stars · {card.date.slice(0, 4)}</span>
        <span className="small"><b style={{ color: p >= 0.5 ? "var(--pos)" : "var(--neg)" }}>{pct(p >= 0.5 ? p : 1 - p, Math.abs(p - 0.5) < 0.05 ? 1 : 0)} {p >= 0.5 ? "positive" : "negative"}</b></span>
      </div>
      <h3>{card.title || "Untitled review"}</h3>
      <div className={`text ${long && !open ? "clipped" : ""}`}><Highlighted chunks={reading.chunks} /></div>
      {long && <button type="button" className="linklike" onClick={() => setOpen(o => !o)} aria-expanded={open}>{open ? "Show less" : "Read the whole review"}</button>}
    </article>
  );
}

type View = "negative" | "fence" | "positive";

export default function ThreeStars({ reviews, read }: { reviews: Reviews; read: (t: string) => Reading }) {
  const [view, setView] = useState<View>("fence");
  const [page, setPage] = useState(0);
  const sorted = useMemo(() => [...reviews.neutralSample].sort((a, b) => a.probability - b.probability), [reviews]);
  const pool = view === "negative" ? sorted : view === "positive" ? [...sorted].reverse()
    : [...sorted].sort((a, b) => Math.abs(a.probability - 0.5) - Math.abs(b.probability - 0.5));
  const shown = pool.slice(page * 3, page * 3 + 3);
  const positive = reviews.neutralProbability.filter(p => p >= 0.5).length;

  return (
    <div style={{ display: "grid", gap: 28 }}>
      <div className="grid-2">
        <div className="panel">
          <p className="chart-title">How positive each group reads</p>
          <p className="chart-sub">The model's chance that a review is positive, by star rating. The dashed line is where its verdict flips. One-, two-, four- and five-star groups include the reviews it trained on; no three-star review was used in training.</p>
          <Distributions reviews={reviews} />
        </div>
        <div style={{ display: "grid", gap: 16, alignContent: "start" }}>
          <div className="stats" style={{ gridTemplateColumns: "repeat(2, minmax(0, 1fr))" }}>
            <div className="stat"><b>{count(positive)}</b><span>three-star reviews read as positive</span></div>
            <div className="stat"><b>{count(reviews.neutralProbability.length - positive)}</b><span>read as negative</span></div>
          </div>
          <p className="muted">
            Ones and twos pile up on the left, fours and fives on the right. Three-star reviews spread across the whole range: the middle rating hides
            opinions that the words give away. Browse them below; the marks show which words tipped each one.
          </p>
          <div className="segmented" role="group" aria-label="Which three-star reviews to show">
            {([["negative", "Most negative"], ["fence", "On the fence"], ["positive", "Most positive"]] as const).map(([v, label]) => (
              <button key={v} type="button" aria-pressed={view === v} onClick={() => { setView(v); setPage(0); }}>{label}</button>
            ))}
          </div>
          <div className="row">
            <button type="button" className="button ghost" onClick={() => setPage(p => (p + 1) % 10)}>Show three more</button>
            <span className="small muted">From a sample of {reviews.neutralSample.length} of the {count(reviews.neutralProbability.length)} three-star reviews.</span>
          </div>
        </div>
      </div>
      <div className="cards">{shown.map(c => <Card key={c.id} card={c} read={read} />)}</div>
    </div>
  );
}
