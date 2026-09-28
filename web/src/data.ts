import type { Model } from "./model";

export type Example = { label: string; rating: number; title: string; body: string };

export type NeutralCard = {
  id: string;
  title: string;
  body: string;
  date: string;
  probability: number;
  pushedPositive: [string, number][];
  pushedNegative: [string, number][];
};

export type Reviews = {
  examples: Example[];
  neutralProbability: number[];
  positiveProbability: number[];
  negativeProbability: number[];
  neutralSample: NeutralCard[];
};

export type Scores = { accuracy: number; precision: number; recall: number; f1: number };

export type TreeNode = {
  samples: number;
  positive: number;
  term?: string;
  threshold?: number;
  absent?: TreeNode;
  present?: TreeNode;
};

export type Task = {
  test: { probability: number[]; label: number[] };
  logistic: Scores;
  tree: Scores;
  treeTop: TreeNode;
  train: number;
  majorityAccuracy?: number;
};

export type Evaluation = { sentiment: Task; helpfulness: Task };

export type Overview = {
  reviews: number;
  products: number;
  users: number;
  ratings: Record<string, number>;
  years: Record<string, number>;
  missingBodies: number;
  htmlBodies: number;
  numericProducts: number;
  specialUsers: number;
  dateFormats: Record<string, number>;
  dashedDateReadings: { dayFirstOnly: number; monthFirstOnly: number; either: number };
  helpfulShare: number;
  rawExample: Record<string, string | number | null>;
  cleanExample: Record<string, string | number | string[]>;
  numericProductExample: string;
};

export type Data = { model: Model; reviews: Reviews; evaluation: Evaluation; overview: Overview };

export async function loadData(): Promise<Data> {
  const base = import.meta.env.BASE_URL;
  const get = <T,>(name: string) => fetch(`${base}data/${name}.json`).then(r => {
    if (!r.ok) throw new Error(name);
    return r.json() as Promise<T>;
  });
  const [model, reviews, evaluation, overview] = await Promise.all([
    get<Model>("model"), get<Reviews>("reviews"), get<Evaluation>("evaluation"), get<Overview>("overview"),
  ]);
  return { model, reviews, evaluation, overview };
}

export const pct = (p: number, digits = 0) => `${(p * 100).toFixed(digits)}%`;
export const count = (n: number) => n.toLocaleString("en-IE");
