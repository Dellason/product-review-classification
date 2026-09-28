"""Build the JSON the website reads, from the raw review files.

Repeats notebooks/01_product_review_classification.ipynb step for step, then
exports what the browser needs to run the same models: the TF-IDF vocabulary
and both logistic-regression weight vectors, held-out predictions for the
threshold explorer, the top of the decision tree, and a sample of three-star
reviews with the model's reading. Writes web/public/data/*.json:

    python web/scripts/build_data.py
"""

import json
import re
from pathlib import Path

import numpy as np
import pandas as pd
from bs4 import BeautifulSoup
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import accuracy_score, f1_score, precision_score, recall_score
from sklearn.model_selection import train_test_split
from sklearn.tree import DecisionTreeClassifier

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / "web" / "public" / "data"

DATE_FORMATS = [
    ("2021/01/01", r"^\d{4}/\d{2}/\d{2}$"),
    ("2021-01-01", r"^\d{4}-\d{2}-\d{2}$"),
    ("01-01-2021", r"^\d{2}-\d{2}-\d{4}$"),
    ("01 Jan 2021", r"^\d{2} [A-Z][a-z]{2} \d{4}$"),
]


def html_to_text(html):
    if not isinstance(html, str):
        return ""
    return BeautifulSoup(html, "html.parser").get_text(separator=" ")


def clean_text(text):
    return re.sub(r"[^a-z\s]", "", str(text).lower())


def scores(y, p):
    return {"accuracy": round(accuracy_score(y, p), 4), "precision": round(precision_score(y, p), 4),
            "recall": round(recall_score(y, p), 4), "f1": round(f1_score(y, p), 4)}


def tree_top(tree, terms, depth=3):
    t = tree.tree_

    def node(i, d):
        value = t.value[i][0]
        share = float(value[1] / value.sum())
        out = {"samples": int(t.n_node_samples[i]), "positive": round(share, 3)}
        if d < depth and t.children_left[i] != -1:
            out["term"] = terms[t.feature[i]]
            out["threshold"] = round(float(t.threshold[i]), 4)
            out["absent"] = node(t.children_left[i], d + 1)
            out["present"] = node(t.children_right[i], d + 1)
        return out

    return node(0, 0)


def contributions(row, weights, terms, k=4):
    row = row.tocoo()
    parts = sorted(((weights[j] * v, terms[j]) for j, v in zip(row.col, row.data)), reverse=True)
    pos = [[w, round(c, 3)] for c, w in parts[:k] if c > 0]
    neg = [[w, round(c, 3)] for c, w in parts[::-1][:k] if c < 0]
    return pos, neg


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    raw = ROOT / "data" / "raw"
    scores_df = pd.DataFrame(json.loads((raw / "review-scores.json").read_text()))
    text_df = pd.DataFrame(json.loads((raw / "review-text.json").read_text()))
    raw_df = text_df.merge(scores_df, on="review_id")
    df = raw_df.copy().set_index("review_id")

    # Task 1 preparation, as in the notebook.
    numeric_products = int((~df["product_id"].str.contains("B")).sum())
    df.loc[~df["product_id"].str.contains("B"), "product_id"] = "B" + df["product_id"]
    special_users = int((~df["user_id"].str.startswith("A")).sum())
    df["user_id"] = df["user_id"].str.replace("#oc-", "", regex=False)
    df["rating"] = df["rating"].str.len()
    df["review_date"] = pd.to_datetime(df["review_date"], format="mixed")
    df["review_body"] = df["review_body"].apply(html_to_text)
    df["display"] = df["review_body"].str.split().str.join(" ")
    df["review_title"] = df["review_title"].str.strip().str.title().apply(
        lambda x: re.sub(r"[^a-zA-Z0-9\s]", "", x) if isinstance(x, str) else x)

    # Task 2: sentiment.
    df["Sentiment"] = df["rating"].map(lambda r: 1 if r >= 4 else (0 if r <= 2 else None))
    df["review_body"] = df["review_body"].apply(clean_text)
    train_df = df.dropna(subset=["Sentiment"])
    neutral = df[df["Sentiment"].isna()]
    tfidf = TfidfVectorizer(max_features=5000, stop_words="english")
    X = tfidf.fit_transform(train_df["review_body"])
    X_train, X_test, y_train, y_test = train_test_split(X, train_df["Sentiment"], test_size=0.2, random_state=42)
    sentiment_lr = LogisticRegression(max_iter=1000).fit(X_train, y_train)
    sentiment_tree = DecisionTreeClassifier(max_depth=10, random_state=42).fit(X_train, y_train)
    terms = tfidf.get_feature_names_out().tolist()

    # Task 3: helpfulness.
    df["Helpful"] = df.apply(lambda r: 1 if r["total_votes"] > 0 and r["helpful_votes"] / r["total_votes"] >= 0.5 else 0, axis=1)
    Xh = tfidf.transform(df["review_body"])
    Xh_train, Xh_test, yh_train, yh_test = train_test_split(Xh, df["Helpful"], test_size=0.2, random_state=42)
    helpful_lr = LogisticRegression(max_iter=1000).fit(Xh_train, yh_train)
    helpful_tree = DecisionTreeClassifier(max_depth=10, random_state=42).fit(Xh_train, yh_train)

    ws, wh = sentiment_lr.coef_[0], helpful_lr.coef_[0]
    model = {
        "terms": terms,
        "idf": [round(float(v), 5) for v in tfidf.idf_],
        "documentFrequency": np.asarray((X > 0).sum(axis=0)).ravel().tolist(),
        "sentiment": {"intercept": round(float(sentiment_lr.intercept_[0]), 6), "weights": [round(float(v), 5) for v in ws]},
        "helpfulness": {"intercept": round(float(helpful_lr.intercept_[0]), 6), "weights": [round(float(v), 5) for v in wh]},
    }
    (OUT / "model.json").write_text(json.dumps(model, separators=(",", ":")))

    s_prob = sentiment_lr.predict_proba(X_test)[:, 1]
    h_prob = helpful_lr.predict_proba(Xh_test)[:, 1]
    majority = float(max(yh_test.mean(), 1 - yh_test.mean()))
    evaluation = {
        "sentiment": {
            "test": {"probability": [round(float(p), 3) for p in s_prob], "label": [int(v) for v in y_test]},
            "logistic": scores(y_test, sentiment_lr.predict(X_test)),
            "tree": scores(y_test, sentiment_tree.predict(X_test)),
            "treeTop": tree_top(sentiment_tree, terms),
            "train": int(X_train.shape[0]),
        },
        "helpfulness": {
            "test": {"probability": [round(float(p), 3) for p in h_prob], "label": [int(v) for v in yh_test]},
            "logistic": scores(yh_test, helpful_lr.predict(Xh_test)),
            "tree": scores(yh_test, helpful_tree.predict(Xh_test)),
            "treeTop": tree_top(helpful_tree, terms),
            "majorityAccuracy": round(majority, 4),
            "train": int(Xh_train.shape[0]),
        },
    }
    (OUT / "evaluation.json").write_text(json.dumps(evaluation, separators=(",", ":")))

    X_neutral = tfidf.transform(neutral["review_body"])
    n_prob = sentiment_lr.predict_proba(X_neutral)[:, 1]
    rng = np.random.default_rng(42)
    order = np.argsort(n_prob)
    picks = sorted(set(np.concatenate([bucket[rng.choice(len(bucket), min(30, len(bucket)), replace=False)]
                                       for bucket in np.array_split(order, 10)])))
    cards = []
    for i in picks:
        r = neutral.iloc[i]
        pos, neg = contributions(X_neutral[i], ws, terms)
        cards.append({"id": neutral.index[i], "title": r["review_title"] if isinstance(r["review_title"], str) else "",
                      "body": r["display"], "date": r["review_date"].strftime("%Y-%m-%d"),
                      "probability": round(float(n_prob[i]), 3), "pushedPositive": pos, "pushedNegative": neg})
    all_probs = sentiment_lr.predict_proba(X)[:, 1]
    # Short real reviews for the "try one" buttons, including one whose words contradict its stars.
    everything = sentiment_lr.predict_proba(tfidf.transform(df["review_body"]))[:, 1]
    length = df["display"].str.len()
    short = (length >= 140) & (length <= 320)

    def pick(mask, key):
        rows = df[mask & short].assign(p=everything[(mask & short).to_numpy()])
        r = rows.loc[key(rows["p"])]
        return {"label": "", "rating": int(r["rating"]), "title": r["review_title"], "body": r["display"]}

    examples = [
        pick(df["rating"] == 5, lambda p: p.idxmax()) | {"label": "A five-star rave"},
        pick(df["rating"] == 1, lambda p: p.idxmin()) | {"label": "A one-star complaint"},
        pick(df["rating"] == 3, lambda p: (p - 0.5).abs().idxmin()) | {"label": "A three-star shrug"},
        pick(df["rating"] == 5, lambda p: p.idxmin()) | {"label": "Five stars, negative words"},
    ]
    reviews = {
        "examples": examples,
        "neutralProbability": [round(float(p), 3) for p in n_prob],
        "positiveProbability": [round(float(p), 3) for p, s in zip(all_probs, train_df["Sentiment"]) if s == 1],
        "negativeProbability": [round(float(p), 3) for p, s in zip(all_probs, train_df["Sentiment"]) if s == 0],
        "neutralSample": cards,
    }
    (OUT / "reviews.json").write_text(json.dumps(reviews, separators=(",", ":")))

    formats = {label: int(raw_df["review_date"].str.match(pattern).sum()) for label, pattern in DATE_FORMATS}
    # "01-02-2021" rows mix day-first and month-first; some fit only one reading.
    dashed = raw_df["review_date"][raw_df["review_date"].str.match(r"^\d{2}-\d{2}-\d{4}$")]
    day_ok = pd.to_datetime(dashed, format="%d-%m-%Y", errors="coerce").notna()
    month_ok = pd.to_datetime(dashed, format="%m-%d-%Y", errors="coerce").notna()
    date_readings = {"dayFirstOnly": int((day_ok & ~month_ok).sum()), "monthFirstOnly": int((month_ok & ~day_ok).sum()),
                     "either": int((day_ok & month_ok).sum())}
    messy = raw_df.set_index("review_id")
    overview = {
        "reviews": len(df), "products": int(df["product_id"].nunique()), "users": int(df["user_id"].nunique()),
        "ratings": {str(k): int(v) for k, v in df["rating"].value_counts().sort_index().items()},
        "years": {str(k): int(v) for k, v in df["review_date"].dt.year.value_counts().sort_index().items()},
        "missingBodies": int(raw_df["review_body"].isna().sum()),
        "htmlBodies": int(raw_df["review_body"].fillna("").str.contains("<").sum()),
        "numericProducts": numeric_products, "specialUsers": special_users,
        "dateFormats": formats, "dashedDateReadings": date_readings, "helpfulShare": round(float(df["Helpful"].mean()), 4),
        "rawExample": {k: (None if pd.isna(v) else v) for k, v in messy.loc["R136454"].to_dict().items()} | {"review_id": "R136454"},
        "cleanExample": {
            "product_id": df.loc["R136454", "product_id"], "user_id": df.loc["R136454", "user_id"],
            "rating": int(df.loc["R136454", "rating"]), "review_date": df.loc["R136454", "review_date"].strftime("%Y-%m-%d"),
            "review_title": df.loc["R136454", "review_title"], "review_body": df.loc["R136454", "display"],
            "model_text": df.loc["R136454", "review_body"].split()[:60],
        },
        "numericProductExample": messy.loc["R150493", "product_id"],
    }
    (OUT / "overview.json").write_text(json.dumps(overview, separators=(",", ":"), default=int))

    for name, e in evaluation.items():
        print(name, "logistic", e["logistic"], "tree", e["tree"])
    print("helpfulness majority baseline", evaluation["helpfulness"]["majorityAccuracy"])
    print(f"neutral: {(n_prob >= 0.5).sum()} positive, {(n_prob < 0.5).sum()} negative; sample {len(cards)}")


if __name__ == "__main__":
    main()
