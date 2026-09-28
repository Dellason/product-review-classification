import { useMemo, useState } from "react";
import { scaleLinear, scaleLog } from "d3-scale";
import { useTip, useWidth } from "./charts";
import type { Head } from "./Highlighted";
import type { Model } from "./model";
import { count } from "./data";

export default function Vocabulary({ model, trained }: { model: Model; trained: number }) {
  const [head, setHead] = useState<Head>("sentiment");
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState("delicious");
  const [frame, width] = useWidth(720);
  const { setTip, view } = useTip();

  const words = useMemo(() => model.terms.map((term, i) => ({
    term, df: model.documentFrequency[i], s: model.sentiment.weights[i], h: model.helpfulness.weights[i],
  })), [model]);
  const w = (x: { s: number; h: number }) => (head === "sentiment" ? x.s : x.h);
  const ranked = useMemo(() => [...words].sort((a, b) => head === "sentiment" ? b.s - a.s : b.h - a.h), [words, head]);

  const height = 380, left = 40, right = 12, top = 12, bottom = 34;
  const x = scaleLog().domain([Math.min(...words.map(d => d.df)), Math.max(...words.map(d => d.df))]).range([left, width - right]);
  const extent = Math.max(...words.map(d => Math.abs(w(d))));
  const y = scaleLinear().domain([-extent, extent]).range([height - bottom, top]);

  const match = query.trim().toLowerCase().replace(/[^a-z]/g, "");
  const found = match ? words.find(d => d.term === match) : undefined;
  const suggestions = match && !found ? words.filter(d => d.term.startsWith(match)).slice(0, 8) : [];
  const current = found ?? words.find(d => d.term === selected)!;
  const rank = ranked.findIndex(d => d.term === current.term) + 1;
  // Label the strongest words, nudging each one clear of labels already placed.
  const placed: { term: string; x: number; y: number }[] = [];
  for (const d of [...ranked.slice(0, 6), ...ranked.slice(-6)]) {
    const px = x(d.df) + 5;
    let py = y(w(d));
    const step = w(d) >= 0 ? -12 : 12;
    while (placed.some(p => Math.abs(p.y - py) < 12 && Math.abs(p.x - px) < 70)) py += step;
    placed.push({ term: d.term, x: px, y: py });
  }

  function onMove(e: React.MouseEvent<SVGSVGElement>) {
    const box = e.currentTarget.getBoundingClientRect();
    const mx = e.clientX - box.left, my = e.clientY - box.top;
    let best = null, dist = 144;
    for (const d of words) {
      const dd = (x(d.df) - mx) ** 2 + (y(w(d)) - my) ** 2;
      if (dd < dist) { dist = dd; best = d; }
    }
    setTip(best ? { x: x(best.df), y: y(w(best)), body: <><b>{best.term}</b> · weight {w(best).toFixed(2)}<br />in {count(best.df)} reviews</> } : null);
  }

  function onClick(e: React.MouseEvent<SVGSVGElement>) {
    const box = e.currentTarget.getBoundingClientRect();
    const mx = e.clientX - box.left, my = e.clientY - box.top;
    let best = null, dist = 144;
    for (const d of words) {
      const dd = (x(d.df) - mx) ** 2 + (y(w(d)) - my) ** 2;
      if (dd < dist) { dist = dd; best = d; }
    }
    if (best) { setSelected(best.term); setQuery(""); }
  }

  return (
    <div className="grid-2 grid-vocab">
      <div className="panel">
        <div className="row" style={{ justifyContent: "space-between", marginBottom: 8 }}>
          <div>
            <p className="chart-title">All {count(words.length)} words the model knows</p>
            <p className="chart-sub" style={{ marginBottom: 0 }}>Across: how many reviews use the word. Up and down: which way it pushes.</p>
          </div>
          <div className="segmented" role="group" aria-label="Weight shown">
            <button type="button" aria-pressed={head === "sentiment"} onClick={() => setHead("sentiment")}>Sentiment</button>
            <button type="button" aria-pressed={head === "helpfulness"} onClick={() => setHead("helpfulness")}>Helpfulness</button>
          </div>
        </div>
        <div className="chart-frame" ref={frame}>
          <svg className="chart" width={width} height={height} viewBox={`0 0 ${width} ${height}`} role="img"
            aria-label={`Scatter of ${words.length} words by how often they appear and their ${head} weight`}
            onMouseMove={onMove} onMouseLeave={() => setTip(null)} onClick={onClick} style={{ cursor: "crosshair" }}>
            <g className="grid">{[10, 100, 1000].map(t => <line key={t} x1={x(t)} x2={x(t)} y1={top} y2={height - bottom} />)}</g>
            <line x1={left} x2={width - right} y1={y(0)} y2={y(0)} stroke="var(--ink-soft)" strokeOpacity={0.5} />
            {[10, 100, 1000].map(t => <text key={t} x={x(t)} y={height - 14} textAnchor="middle">{count(t)} reviews</text>)}
            <text x={left} y={top + 4}>pushes {head === "sentiment" ? "positive" : "helpful"}</text>
            <text x={left} y={height - bottom - 6}>pushes {head === "sentiment" ? "negative" : "unhelpful"}</text>
            {words.map(d => (
              <circle key={d.term} cx={x(d.df)} cy={y(w(d))} r={2.4}
                fill={w(d) >= 0 ? "var(--pos)" : "var(--neg)"} opacity={0.18 + Math.min(0.7, Math.abs(w(d)) / extent)} />
            ))}
            {placed.map(p => <text key={p.term} x={p.x} y={p.y} dy="0.35em" className="strong">{p.term}</text>)}
            <circle cx={x(current.df)} cy={y(w(current))} r={7} fill="none" stroke="var(--ink)" strokeWidth={2} />
          </svg>
          {view}
        </div>
      </div>

      <div style={{ display: "grid", gap: 16, alignContent: "start" }}>
        <label style={{ display: "grid", gap: 6 }}>
          <span className="small muted">Look up a word</span>
          <input type="search" value={query} placeholder="try “stale”, “kids” or “shipping”" onChange={e => setQuery(e.target.value)} />
        </label>
        {suggestions.length > 0 && (
          <div className="chips">{suggestions.map(s => <button key={s.term} type="button" className="chip" onClick={() => { setSelected(s.term); setQuery(""); }}>{s.term}</button>)}</div>
        )}
        {match && !found && !suggestions.length && (
          <p className="small muted" role="status">“{match}” isn't one of the 5,000 words, so the model ignores it. Common words like “the” and rare words were left out.</p>
        )}
        <div className="panel" style={{ display: "grid", gap: 10 }} aria-live="polite">
          <p style={{ fontFamily: "var(--serif)", fontSize: "var(--step-2)", fontWeight: 600 }}>{current.term}</p>
          <div className="stats" style={{ gridTemplateColumns: "repeat(2, minmax(0, 1fr))" }}>
            <div className="stat"><b style={{ color: current.s >= 0 ? "var(--pos)" : "var(--neg)" }}>{current.s >= 0 ? "+" : "−"}{Math.abs(current.s).toFixed(2)}</b><span>sentiment weight</span></div>
            <div className="stat"><b style={{ color: current.h >= 0 ? "var(--pos)" : "var(--neg)" }}>{current.h >= 0 ? "+" : "−"}{Math.abs(current.h).toFixed(2)}</b><span>helpfulness weight</span></div>
          </div>
          <p className="small muted">
            Used in {count(current.df)} of {count(trained)} reviews. It ranks {count(rank)} of {count(words.length)} for {head === "sentiment" ? "positivity" : "helpfulness"}.
            Its pull on a review is this weight times the word's TF-IDF score, so it counts most in short reviews.
          </p>
        </div>
      </div>
    </div>
  );
}
