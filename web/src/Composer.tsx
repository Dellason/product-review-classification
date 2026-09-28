import { useLayoutEffect, useMemo, useRef, useState } from "react";
import Highlighted, { type Head } from "./Highlighted";
import type { Reading } from "./model";
import { pct, type Example } from "./data";

function Stars({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  return (
    <div className="stars" role="radiogroup" aria-label="Your star rating">
      {[1, 2, 3, 4, 5].map(n => (
        <button key={n} type="button" role="radio" aria-checked={value === n} aria-label={`${n} star${n > 1 ? "s" : ""}`}
          onClick={() => onChange(value === n ? 0 : n)}>
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M12 2.8l2.8 5.8 6.3.9-4.6 4.4 1.1 6.3L12 17.2l-5.6 3 1.1-6.3-4.6-4.4 6.3-.9z"
              fill={n <= value ? "var(--violet)" : "none"} stroke="var(--violet)" strokeWidth="1.6" strokeLinejoin="round" />
          </svg>
        </button>
      ))}
    </div>
  );
}

function Meter({ label, value, left, right, diverging = true }: {
  label: string; value: number; left: string; right: string; diverging?: boolean;
}) {
  return (
    <div className="meter">
      <div className="meter-head"><span>{label}</span><b>{pct(value)}</b></div>
      <div className={`meter-track ${diverging ? "" : "plain"}`} role="meter" aria-label={label}
        aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(value * 100)}>
        <span className="mid" />
        <i style={{ left: `${value * 100}%` }} />
      </div>
      <div className="meter-scale"><span>{left}</span><span>{right}</span></div>
    </div>
  );
}

function agreement(stars: number, reading: Reading) {
  const lean = reading.sentiment >= 0.5 ? "positive" : "negative";
  if (!reading.known) return "Start typing. The model knows 5,000 words.";
  if (!stars) return "Give it a star rating too, and see whether the model agrees with you.";
  if (stars === 3) return `Three stars is the one rating the model never trained on. It hears a ${lean} review.`;
  const yours = stars >= 4 ? "positive" : "negative";
  return yours === lean
    ? `Your ${stars} stars and your words agree.`
    : `You gave ${stars} star${stars > 1 ? "s" : ""}, but your words read as ${lean}.`;
}

export default function Composer({ read, examples, helpfulShare }: {
  read: (text: string) => Reading;
  examples: Example[];
  helpfulShare: number;
}) {
  const [text, setText] = useState(examples[0]?.body ?? "");
  const [stars, setStars] = useState(examples[0]?.rating ?? 0);
  const [head, setHead] = useState<Head>("sentiment");
  const area = useRef<HTMLTextAreaElement>(null);
  const reading = useMemo(() => read(text), [read, text]);

  // Grow with the text so the textarea never scrolls away from its highlights.
  useLayoutEffect(() => {
    const el = area.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  }, [text]);

  const ranked = reading.chunks.filter(c => c.term).map(c => ({ term: c.term!, v: c[head] }));
  const merged = [...ranked.reduce((m, r) => m.set(r.term, (m.get(r.term) ?? 0) + r.v), new Map<string, number>())];
  const up = merged.filter(([, v]) => v > 0).sort((a, b) => b[1] - a[1]).slice(0, 4);
  const down = merged.filter(([, v]) => v < 0).sort((a, b) => a[1] - b[1]).slice(0, 4);
  const [upLabel, downLabel] = head === "sentiment" ? ["Pushing positive", "Pushing negative"] : ["Sounds helpful", "Sounds unhelpful"];

  return (
    <div className="grid-hero">
      <div style={{ display: "grid", gap: 14 }}>
        <div className="composer">
          <div className="composer-top">
            <Stars value={stars} onChange={setStars} />
            <div className="segmented" role="group" aria-label="Highlight words by">
              <button type="button" aria-pressed={head === "sentiment"} onClick={() => setHead("sentiment")}>Sentiment</button>
              <button type="button" aria-pressed={head === "helpfulness"} onClick={() => setHead("helpfulness")}>Helpfulness</button>
            </div>
          </div>
          <div className="composer-body">
            <div className="mirror" aria-hidden="true">
              <Highlighted chunks={reading.chunks} head={head} />{text.endsWith("\n") ? "​" : ""}
            </div>
            <textarea ref={area} value={text} onChange={e => setText(e.target.value)} spellCheck={false}
              aria-label="Your review" placeholder="Write a product review, or pick a real one below." />
          </div>
          <div className="composer-foot">
            <span>The model recognises {reading.known} of your {reading.words} words.</span>
            <span className="legend">
              <span><i className="swatch" style={{ background: "rgb(var(--pos-mark) / 0.55)" }} />{head === "sentiment" ? "positive" : "helpful"}</span>
              <span><i className="swatch" style={{ background: "rgb(var(--neg-mark) / 0.55)" }} />{head === "sentiment" ? "negative" : "unhelpful"}</span>
            </span>
          </div>
        </div>
        <div className="chips" aria-label="Real reviews to try">
          {examples.map(ex => (
            <button key={ex.label} type="button" className="chip" onClick={() => { setText(ex.body); setStars(ex.rating); }}>{ex.label}</button>
          ))}
          <button type="button" className="chip" onClick={() => { setText(""); setStars(0); area.current?.focus(); }}>Write your own</button>
        </div>
      </div>

      <div className="panel verdict" aria-live="polite">
        <p className="verdict-line">
          {reading.known ? <>Reads as <b>{reading.sentiment >= 0.5 ? "positive" : "negative"}</b></> : "Nothing to read yet"}
        </p>
        <Meter label="Chance it's positive" value={reading.sentiment} left="negative" right="positive" />
        <p className="agree">{agreement(stars, reading)}</p>
        <Meter label="Chance readers find it helpful" value={reading.helpfulness} left="unhelpful" right="helpful" diverging={false} />
        <p className="small muted">{pct(helpfulShare)} of reviews in the data were voted helpful, so this model starts optimistic.</p>
        <div className="pushers">
          <div>
            <h3>{upLabel}</h3>
            <ul>{up.length ? up.map(([t, v]) => <li key={t}><span>{t}</span><span className="muted">+{v.toFixed(2)}</span></li>) : <li className="muted">none yet</li>}</ul>
          </div>
          <div>
            <h3>{downLabel}</h3>
            <ul>{down.length ? down.map(([t, v]) => <li key={t}><span>{t}</span><span className="muted">{v.toFixed(2)}</span></li>) : <li className="muted">none yet</li>}</ul>
          </div>
        </div>
      </div>
    </div>
  );
}
