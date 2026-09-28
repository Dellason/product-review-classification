import { useMemo, type ReactNode } from "react";
import type { Model } from "./model";
import { count, type Overview } from "./data";

// Wrap the parts of a raw value that cleaning had to fix.
function flag(key: string, value: string | number | null): ReactNode {
  if (value === null) return <span className="bad">null</span>;
  const text = JSON.stringify(value);
  if (key === "user_id" && String(value).startsWith("#oc-")) return <><span className="bad">"#oc-</span>{text.slice(5)}</>;
  if (key === "rating") return <span className="bad">{text}</span>;
  if (key === "review_body") {
    return text.split(/(<br \/>)/).map((part, i) => (part === "<br />" ? <span key={i} className="bad">{part}</span> : part));
  }
  return text;
}

export default function Mess({ overview, model }: { overview: Overview; model: Model }) {
  const known = useMemo(() => new Set(model.terms), [model]);
  const raw = overview.rawExample;
  const clean = overview.cleanExample;
  const keys = ["review_id", "product_id", "user_id", "review_title", "review_date", "rating", "helpful_votes", "total_votes", "review_body"];
  const readings = overview.dashedDateReadings;

  return (
    <div style={{ display: "grid", gap: 24 }}>
      <div className="grid-2">
        <div className="panel" style={{ display: "grid", gap: 10, alignContent: "start" }}>
          <p className="chart-title">One review as it arrived</p>
          <p className="chart-sub" style={{ margin: 0 }}>Merged from the two JSON files on <code>review_id</code>. Marked: what had to change.</p>
          <div className="code-block">
            {"{\n"}
            {keys.filter(k => k in raw).map(k => <span key={k}>{`  "${k}": `}{flag(k, raw[k])}{",\n"}</span>)}
            {"}"}
          </div>
        </div>
        <div className="panel" style={{ display: "grid", gap: 10, alignContent: "start" }}>
          <p className="chart-title">The same review, cleaned</p>
          <table className="data">
            <tbody>
              <tr><th>User</th><td><code>{String(clean.user_id)}</code></td><td className="muted">prefix removed</td></tr>
              <tr><th>Rating</th><td>{String(clean.rating)}</td><td className="muted">stars counted</td></tr>
              <tr><th>Date</th><td>{String(clean.review_date)}</td><td className="muted">parsed</td></tr>
              <tr><th>Title</th><td>{String(clean.review_title)}</td><td className="muted">title case, punctuation gone</td></tr>
            </tbody>
          </table>
          <p className="small muted" style={{ marginTop: 6 }}>What the model actually reads: lowercase letters only, split into words. Crossed-out words aren't in its vocabulary, mostly common words like “the”.</p>
          <div className="tokens">
            {(clean.model_text as string[]).map((t, i) => <span key={i} className={known.has(t) ? "" : "dropped"}>{t}</span>)}
            <span className="dropped" style={{ textDecoration: "none" }}>…</span>
          </div>
        </div>
      </div>

      <div className="grid-2">
        <div className="panel">
          <p className="chart-title" style={{ marginBottom: 12 }}>What cleaning fixed across {count(overview.reviews)} reviews</p>
          <ul className="fixes">
            <li><b>{count(overview.htmlBodies)}</b><span>review bodies contained HTML such as <code>&lt;br /&gt;</code>, stripped to plain text.</span></li>
            <li><b>{count(overview.missingBodies)}</b><span>reviews arrived with no body text. They stay in the data as empty reviews.</span></li>
            <li><b>{overview.specialUsers}</b><span>user IDs carried an <code>#oc-</code> prefix marking special accounts; the prefix was removed.</span></li>
            <li><b>{overview.numericProducts}</b><span>product IDs had lost their leading B, like <code>{overview.numericProductExample}</code>. It was put back.</span></li>
            <li><b>{count(overview.reviews)}</b><span>ratings arrived as strings of stars, <code>"*"</code> to <code>"*****"</code>, and became the numbers 1 to 5.</span></li>
          </ul>
        </div>
        <div className="panel" style={{ display: "grid", gap: 12, alignContent: "start" }}>
          <p className="chart-title">Four ways to write a date</p>
          <table className="data">
            <thead><tr><th>Written as</th><th className="num">Reviews</th></tr></thead>
            <tbody>{Object.entries(overview.dateFormats).map(([f, n]) => <tr key={f}><td><code>{f}</code></td><td className="num">{count(n)}</td></tr>)}</tbody>
          </table>
          <p className="small muted">
            The dashed dates are a trap. {count(readings.monthFirstOnly)} can only be month-first and {count(readings.dayFirstOnly)} only day-first, so the file mixes both.
            The other {count(readings.either)} fit either reading, so their day and month can't be known for sure. The year is never in doubt, and the year is all the analysis used.
          </p>
        </div>
      </div>
    </div>
  );
}
