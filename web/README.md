# Read between the stars

An interactive site for the product review classification project. The notebook's TF-IDF and logistic-regression models run in the browser, so visitors can type a review and watch every word the model knows pull it towards positive or negative.

**Live:** https://jjmensah.github.io/enam_portfolio/lab/reviews/, served from the portfolio's `public/lab/reviews/`. Run `scripts/sync_lab.sh reviews product-review-classification` in `enam_portfolio` to publish a new build.

## Sections

| Section | What it does |
| --- | --- |
| Composer | Type or pick a real review. Words are highlighted in place by their pull on sentiment or helpfulness, with both probabilities and a check against your own star rating. |
| Three stars, decoded | How positive each rating group reads, and a browser of real three-star reviews the model never trained on. |
| Vocabulary | All 5,000 words by frequency and weight, with look-up. |
| Accuracy | A threshold slider over the held-out predictions with a live confusion matrix and precision–recall curve, the decision tree's first three questions, and the always-helpful baseline. |
| Cleaning | A raw record next to its cleaned form, the fixes across the dataset, the ambiguous dates, and the tokens the model actually sees. |

## Run it

```bash
npm ci
npm run dev          # http://localhost:5173
npm run build        # static site in dist/
npm run test:model   # the browser model must match scikit-learn
```

## Rebuild the data

`public/data/` is generated from `../data/raw/`. The script repeats the notebook, reproduces its scores, and exports the vocabulary, both weight vectors, held-out predictions and the review samples:

```bash
pip install pandas scikit-learn beautifulsoup4
npm run data
npm run test:model
```

`test:model` runs `src/model.ts` over 300 held-out reviews and fails if any probability differs from Python's by more than 0.002. The last run's largest difference was 0.0005, which is rounding.

## Stack

React, TypeScript and Vite. Charts are hand-drawn SVG using `d3-scale`. Literata, Instrument Sans and JetBrains Mono are bundled locally.
