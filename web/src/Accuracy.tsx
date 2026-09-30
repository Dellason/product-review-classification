import { useMemo, useState } from "react";
import { scaleLinear } from "d3-scale";
import { useWidth } from "./charts";
import { count, pct, type Evaluation, type TreeNode } from "./data";

type TaskName = "sentiment" | "helpfulness";

function confusion(prob: number[], label: number[], t: number) {
  let tp = 0, fp = 0, tn = 0, fn = 0;
  prob.forEach((p, i) => {
    const yes = p >= t;
    if (yes && label[i]) tp++; else if (yes) fp++; else if (label[i]) fn++; else tn++;
  });
  const precision = tp / (tp + fp || 1), recall = tp / (tp + fn || 1);
  return { tp, fp, tn, fn, precision, recall, accuracy: (tp + tn) / prob.length, f1: (2 * precision * recall) / (precision + recall || 1) };
}

function Curve({ prob, label, threshold }: { prob: number[]; label: number[]; threshold: number }) {
  const [frame, width] = useWidth(320);
  const height = 200, left = 36, bottom = 28, top = 8, right = 10;
  const points = useMemo(() => Array.from({ length: 99 }, (_, i) => confusion(prob, label, (i + 1) / 100)), [prob, label]);
  const x = scaleLinear().domain([0, 1]).range([left, width - right]);
  const y = scaleLinear().domain([Math.min(...points.map(p => p.precision)) - 0.02, 1]).range([height - bottom, top]);
  const now = confusion(prob, label, threshold);
  const path = points.map((p, i) => `${i ? "L" : "M"}${x(p.recall)},${y(p.precision)}`).join("");
  return (
    <div className="chart-frame" ref={frame}>
      <svg className="chart" width={width} height={height} viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Precision against recall across thresholds">
        <g className="grid">{[0.25, 0.5, 0.75, 1].map(t => <line key={t} x1={x(t)} x2={x(t)} y1={top} y2={height - bottom} />)}</g>
        {[0, 0.5, 1].map(t => <text key={t} x={x(t)} y={height - 10} textAnchor="middle">{pct(t)}</text>)}
        
        <text x={left - 6} y={top + 8} textAnchor="end">{pct(1)}</text>
        <text x={left - 6} y={height - bottom} textAnchor="end">{pct(y.domain()[0])}</text>
        <path d={path} fill="none" stroke="var(--violet)" strokeWidth={2} />
        <circle cx={x(now.recall)} cy={y(now.precision)} r={6} fill="var(--violet)" stroke="var(--paper-raised)" strokeWidth={2} />
      </svg>
    </div>
  );
}

function Branch({ node, word, uses, depth, yes }: { node: TreeNode; word?: string; uses?: boolean; depth: number; yes: string }) {
  return (
    <div style={{ marginLeft: depth ? 18 : 0, borderLeft: depth ? "1px solid var(--rule)" : undefined, paddingLeft: depth ? 12 : 0, display: "grid", gap: 8 }}>
      <div className="tree-node">
        <div className="row" style={{ justifyContent: "space-between" }}>
          <span>
            {word ? <>{uses ? "Uses" : "Doesn't use"} <span className="tree-split">“{word}”</span></> : <>All {count(node.samples)} training reviews</>}
          </span>
          <span className="muted">{count(node.samples)} reviews · {pct(node.positive)} {yes}</span>
        </div>
        <div className="bar-mini" aria-hidden="true"><i style={{ width: pct(node.positive) }} /></div>
      </div>
      {node.term && node.absent && node.present && (
        <>
          <Branch node={node.present} word={node.term} uses depth={depth + 1} yes={yes} />
          <Branch node={node.absent} word={node.term} uses={false} depth={depth + 1} yes={yes} />
        </>
      )}
    </div>
  );
}

export default function Accuracy({ evaluation }: { evaluation: Evaluation }) {
  const [task, setTask] = useState<TaskName>("sentiment");
  const [threshold, setThreshold] = useState(0.5);
  const e = evaluation[task];
  const m = useMemo(() => confusion(e.test.probability, e.test.label, threshold), [e, threshold]);
  const [yes, no] = task === "sentiment" ? ["Positive", "Negative"] : ["Helpful", "Unhelpful"];
  const cell = (n: number, good: boolean) => ({
    background: good ? `color-mix(in srgb, var(--violet) ${12 + (n / e.test.label.length) * 60}%, transparent)` : `rgb(var(--neg-mark) / ${0.08 + (n / e.test.label.length) * 0.8})`,
  });

  return (
    <div style={{ display: "grid", gap: 24 }}>
      <div className="row" style={{ justifyContent: "space-between" }}>
        <div className="segmented" role="group" aria-label="Task">
          <button type="button" aria-pressed={task === "sentiment"} onClick={() => { setTask("sentiment"); setThreshold(0.5); }}>Positive or negative?</button>
          <button type="button" aria-pressed={task === "helpfulness"} onClick={() => { setTask("helpfulness"); setThreshold(0.5); }}>Helpful or not?</button>
        </div>
        <span className="small muted">Scored on {count(e.test.label.length)} reviews held out from training.</span>
      </div>

      {task === "helpfulness" && e.majorityAccuracy !== undefined && (
        <div className="callout">
          <b>The honest baseline.</b> {pct(e.majorityAccuracy, 1)} of held-out reviews are helpful, so guessing “helpful” every time is already {pct(e.majorityAccuracy, 1)} accurate.
          The model reaches {pct(e.logistic.accuracy, 1)}: a real but small gain, and why its recall sits near 99%. Raise the threshold to make it earn each “helpful”.
        </div>
      )}

      <div className="grid-2">
        <div className="panel" style={{ display: "grid", gap: 16, alignContent: "start" }}>
          <label style={{ display: "grid", gap: 6 }}>
            <span className="row" style={{ justifyContent: "space-between" }}>
              <span className="small muted">Call it {yes.toLowerCase()} when the model is at least</span>
              <b style={{ fontSize: "var(--step-1)" }}>{pct(threshold)} sure</b>
            </span>
            <input type="range" min={0.05} max={0.95} step={0.01} value={threshold} onChange={ev => setThreshold(Number(ev.target.value))} />
          </label>
          <div className="matrix" role="table" aria-label="Confusion matrix">
            <span />
            <span className="axis small" role="columnheader">Predicted {yes.toLowerCase()}</span>
            <span className="axis small" role="columnheader">Predicted {no.toLowerCase()}</span>
            <span className="axis small" role="rowheader">Actually {yes.toLowerCase()}</span>
            <div className="cell" style={cell(m.tp, true)} role="cell"><b>{count(m.tp)}</b>right</div>
            <div className="cell" style={cell(m.fn, false)} role="cell"><b>{count(m.fn)}</b>missed</div>
            <span className="axis small" role="rowheader">Actually {no.toLowerCase()}</span>
            <div className="cell" style={cell(m.fp, false)} role="cell"><b>{count(m.fp)}</b>false alarms</div>
            <div className="cell" style={cell(m.tn, true)} role="cell"><b>{count(m.tn)}</b>right</div>
          </div>
          <div className="stats" aria-live="polite">
            <div className="stat"><b>{pct(m.accuracy, 1)}</b><span>accuracy</span></div>
            <div className="stat"><b>{pct(m.precision, 1)}</b><span>precision</span></div>
            <div className="stat"><b>{pct(m.recall, 1)}</b><span>recall</span></div>
            <div className="stat"><b>{m.f1.toFixed(3)}</b><span>F1</span></div>
          </div>
        </div>
        <div className="panel" style={{ display: "grid", gap: 14, alignContent: "start" }}>
          <p className="chart-title">The trade-off you're sliding along</p>
          <p className="chart-sub" style={{ margin: 0 }}>A higher threshold makes each “{yes.toLowerCase()}” more trustworthy (precision) but catches fewer of them (recall).</p>
          <Curve prob={e.test.probability} label={e.test.label} threshold={threshold} />
          <p className="small muted" style={{ marginTop: -6 }}>Across: recall. Up: precision. The dot is your threshold.</p>
          <table className="data">
            <thead><tr><th>At the default 50%</th><th className="num">Accuracy</th><th className="num">F1</th></tr></thead>
            <tbody>
              <tr><td>Logistic regression</td><td className="num">{pct(e.logistic.accuracy, 1)}</td><td className="num">{e.logistic.f1.toFixed(3)}</td></tr>
              <tr><td>Decision tree, depth 10</td><td className="num">{pct(e.tree.accuracy, 1)}</td><td className="num">{e.tree.f1.toFixed(3)}</td></tr>
              {e.majorityAccuracy !== undefined && <tr><td>Always “helpful”</td><td className="num">{pct(e.majorityAccuracy, 1)}</td><td className="num">—</td></tr>}
            </tbody>
          </table>
        </div>
      </div>

      <div className="panel" style={{ display: "grid", gap: 12 }}>
        <p className="chart-title">How the decision tree reads, three questions deep</p>
        <p className="chart-sub" style={{ margin: 0 }}>
          The tree asks about one word at a time. Its first questions are sensible, but with 5,000 words and only ten questions per review it misses most of what the review says.
          The bars show the share of each group that is {yes.toLowerCase()}.
        </p>
        <Branch node={e.treeTop} depth={0} yes={yes.toLowerCase()} />
      </div>
    </div>
  );
}
