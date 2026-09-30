// The notebook's TF-IDF + logistic regression, run in the browser.
//
// The notebook lowercases text and deletes every character that isn't a-z or
// whitespace, then scikit-learn keeps tokens of two or more letters. So each
// whitespace-separated chunk of the original text becomes at most one token,
// which lets every word the reader typed be coloured by its own contribution.

export type Head = { intercept: number; weights: number[] };

export type Model = {
  terms: string[];
  idf: number[];
  documentFrequency: number[];
  sentiment: Head;
  helpfulness: Head;
};

export type Chunk = {
  text: string;
  term: string | null;
  /** Change to each head's log-odds from this one occurrence. */
  sentiment: number;
  helpfulness: number;
};

export type Reading = {
  chunks: Chunk[];
  sentiment: number;
  helpfulness: number;
  known: number;
  words: number;
};

const sigmoid = (z: number) => 1 / (1 + Math.exp(-z));

export const tokenOf = (chunk: string) => {
  const t = chunk.toLowerCase().replace(/[^a-z]/g, "");
  return t.length >= 2 ? t : null;
};

export function makeReader(model: Model) {
  const index = new Map(model.terms.map((t, i) => [t, i]));

  return function read(text: string): Reading {
    const parts = text.split(/(\s+)/).filter(Boolean);
    const counts = new Map<number, number>();
    let words = 0;
    for (const part of parts) {
      if (/^\s+$/.test(part)) continue;
      const token = tokenOf(part);
      if (!token) continue;
      words++;
      const i = index.get(token);
      if (i !== undefined) counts.set(i, (counts.get(i) ?? 0) + 1);
    }

    let norm = 0;
    for (const [i, c] of counts) norm += (c * model.idf[i]) ** 2;
    norm = Math.sqrt(norm);

    let s = model.sentiment.intercept;
    let h = model.helpfulness.intercept;
    const chunks: Chunk[] = parts.map(part => {
      const token = /^\s+$/.test(part) ? null : tokenOf(part);
      const i = token ? index.get(token) : undefined;
      if (i === undefined || !norm) return { text: part, term: null, sentiment: 0, helpfulness: 0 };
      const x = model.idf[i] / norm;
      const cs = model.sentiment.weights[i] * x;
      const ch = model.helpfulness.weights[i] * x;
      s += cs;
      h += ch;
      return { text: part, term: token, sentiment: cs, helpfulness: ch };
    });

    const known = [...counts.values()].reduce((a, b) => a + b, 0);
    return { chunks, sentiment: sigmoid(s), helpfulness: sigmoid(h), known, words };
  };
}
