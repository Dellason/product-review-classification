// Checks that the browser model reproduces scikit-learn: every three-star
// review in reviews.json carries the probability Python computed for it.
//
//   npm run test:model
import { readFileSync } from "node:fs";
import { makeReader } from "../src/model.ts";

const load = name => JSON.parse(readFileSync(new URL(`../public/data/${name}`, import.meta.url)));
const read = makeReader(load("model.json"));
const { neutralSample } = load("reviews.json");

let worst = 0;
for (const card of neutralSample) {
  worst = Math.max(worst, Math.abs(read(card.body).sentiment - card.probability));
}
console.log(`${neutralSample.length} reviews, largest difference ${worst.toFixed(4)}`);
// Python rounds to 3 places and the weights are stored to 5.
if (worst > 0.002) {
  console.error("Browser model disagrees with scikit-learn.");
  process.exit(1);
}
