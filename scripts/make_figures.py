"""Render the README and portfolio figures for the review classifiers.

Repeats the preparation and models from
notebooks/01_product_review_classification.ipynb, then writes PNGs to
assets/figures/. Run from anywhere:

    python scripts/make_figures.py
"""

import re
from pathlib import Path

import matplotlib.pyplot as plt
import numpy as np
import pandas as pd
from bs4 import BeautifulSoup
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import accuracy_score, f1_score, precision_score, recall_score
from sklearn.model_selection import train_test_split
from sklearn.tree import DecisionTreeClassifier

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "assets" / "figures"

SURFACE = "#fcfcfb"
INK = "#0b0b0b"
MUTED = "#52514e"
GRID = "#e4e3de"
LOGISTIC = "#2a78d6"
TREE = "#eb6834"
POSITIVE = "#2a78d6"
NEGATIVE = "#eb6834"

plt.rcParams.update({
    "figure.facecolor": SURFACE, "axes.facecolor": SURFACE,
    "savefig.facecolor": SURFACE, "font.family": "sans-serif",
    "font.sans-serif": ["Helvetica Neue", "Helvetica", "Arial", "DejaVu Sans"],
    "font.size": 11, "text.color": INK, "axes.labelcolor": MUTED,
    "xtick.color": MUTED, "ytick.color": MUTED, "axes.edgecolor": GRID,
    "axes.spines.top": False, "axes.spines.right": False,
    "axes.spines.left": False, "axes.grid": True, "axes.grid.axis": "y",
    "grid.color": GRID, "grid.linewidth": 0.8, "axes.axisbelow": True,
    "axes.titlesize": 15, "axes.titleweight": "medium", "axes.titlepad": 34,
    "axes.titlelocation": "left", "legend.frameon": False,
    "xtick.major.size": 0, "ytick.major.size": 0,
})


def load():
    raw = ROOT / "data" / "raw"
    scores = pd.read_json(raw / "review-scores.json")
    text = pd.read_json(raw / "review-text.json")
    df = text.merge(scores, on="review_id").set_index("review_id")
    df["rating"] = df["rating"].str.len()
    df["review_date"] = pd.to_datetime(df["review_date"], format="mixed")
    df["review_body"] = df["review_body"].apply(
        lambda html: BeautifulSoup(html, "html.parser").get_text(separator=" ")
        if isinstance(html, str) else "")
    df["review_body"] = df["review_body"].apply(
        lambda t: re.sub(r"[^a-z\s]", "", str(t).lower()))
    df["Sentiment"] = df["rating"].map({1: 0, 2: 0, 4: 1, 5: 1})
    df["Helpful"] = ((df["total_votes"] > 0)
                     & (df["helpful_votes"] / df["total_votes"].where(df["total_votes"] > 0) >= 0.5)
                     ).astype(int)
    return df


def scores(y_true, y_pred):
    return [accuracy_score(y_true, y_pred), precision_score(y_true, y_pred),
            recall_score(y_true, y_pred), f1_score(y_true, y_pred)]


def save(fig, name):
    fig.tight_layout()
    fig.savefig(OUT / name, dpi=200)
    plt.close(fig)


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    df = load()

    labelled = df.dropna(subset=["Sentiment"])
    neutral = df[df["Sentiment"].isna()]
    tfidf = TfidfVectorizer(max_features=5000, stop_words="english")
    X = tfidf.fit_transform(labelled["review_body"])
    X_train, X_test, y_train, y_test = train_test_split(
        X, labelled["Sentiment"], test_size=0.2, random_state=42)
    logistic = LogisticRegression(max_iter=1000).fit(X_train, y_train)
    tree = DecisionTreeClassifier(max_depth=10, random_state=42).fit(X_train, y_train)
    sentiment = {"Logistic regression": scores(y_test, logistic.predict(X_test)),
                 "Decision tree": scores(y_test, tree.predict(X_test))}
    neutral_pred = logistic.predict(tfidf.transform(neutral["review_body"]))
    words = pd.Series(logistic.coef_[0], index=tfidf.get_feature_names_out())

    Xh = tfidf.transform(df["review_body"])
    Xh_train, Xh_test, yh_train, yh_test = train_test_split(
        Xh, df["Helpful"], test_size=0.2, random_state=42)
    helpful = {
        "Logistic regression": scores(yh_test, LogisticRegression(max_iter=1000)
                                      .fit(Xh_train, yh_train).predict(Xh_test)),
        "Decision tree": scores(yh_test, DecisionTreeClassifier(max_depth=10, random_state=42)
                                .fit(Xh_train, yh_train).predict(Xh_test)),
    }

    ratings = df["rating"].value_counts().sort_index()
    fig, ax = plt.subplots(figsize=(10, 4.4))
    colours = [NEGATIVE, NEGATIVE, MUTED, POSITIVE, POSITIVE]
    ax.bar([f"{r} star" if r == 1 else f"{r} stars" for r in ratings.index], ratings.values, color=colours, width=0.6)
    for i, v in enumerate(ratings.values):
        ax.text(i, v + 120, f"{v:,}", ha="center", color=INK)
    ax.yaxis.set_major_formatter(plt.FuncFormatter(lambda v, _: f"{v:,.0f}"))
    ax.set_title(f"{len(df):,} reviews by star rating")
    ax.text(0, 1.02, "1–2 stars negative  ·  3 stars held out as neutral  ·  4–5 stars positive",
            transform=ax.transAxes, color=MUTED)
    save(fig, "rating-distribution.png")

    metrics = ["Accuracy", "Precision", "Recall", "F1"]
    fig, axes = plt.subplots(1, 2, figsize=(11, 4.6), sharey=True)
    for ax, (title, result) in zip(axes, (("Sentiment", sentiment), ("Helpfulness", helpful))):
        x = np.arange(len(metrics))
        for offset, (model, colour) in zip((-0.19, 0.19), ((("Logistic regression"), LOGISTIC),
                                                           ("Decision tree", TREE))):
            ax.bar(x + offset, result[model], 0.38, color=colour,
                   edgecolor=SURFACE, linewidth=1.5, label=model)
            for xi, v in zip(x + offset, result[model]):
                ax.text(xi, v + 0.015, f"{v:.2f}", ha="center", fontsize=9, color=INK)
        ax.set_xticks(x, metrics)
        ax.set_ylim(0, 1.08)
        ax.set_title(title)
    axes[0].legend(loc="lower left", ncols=2, bbox_to_anchor=(0, 1.0),
                   borderaxespad=0.2, handlelength=1.2)
    axes[0].set_title("Sentiment", pad=34)
    save(fig, "model-comparison.png")

    top = pd.concat([words.nsmallest(10), words.nlargest(10).iloc[::-1]])
    fig, ax = plt.subplots(figsize=(10, 6.4))
    ax.barh(top.index, top.values, color=[NEGATIVE if v < 0 else POSITIVE for v in top.values],
            height=0.62)
    ax.axvline(0, color=MUTED, linewidth=0.8)
    ax.grid(axis="x"); ax.grid(axis="y", visible=False)
    ax.set_title("Words that move the sentiment model most")
    ax.text(0, 1.02, "Logistic-regression weight per TF-IDF term  ·  left pushes negative, right pushes positive",
            transform=ax.transAxes, color=MUTED)
    ax.invert_yaxis()
    save(fig, "sentiment-words.png")

    pos = int((neutral_pred == 1).sum())
    neg = int((neutral_pred == 0).sum())
    fig, ax = plt.subplots(figsize=(10, 2.2))
    ax.barh([0], [pos], color=POSITIVE, height=0.5, edgecolor=SURFACE, linewidth=2)
    ax.barh([0], [neg], left=[pos], color=NEGATIVE, height=0.5, edgecolor=SURFACE, linewidth=2)
    ax.text(pos / 2, 0, f"{pos} read as positive", ha="center", va="center", color="white")
    ax.text(pos + neg / 2, 0, f"{neg} read as negative", ha="center", va="center", color="white")
    ax.set_title(f"What the model hears in {len(neutral):,} three-star reviews")
    ax.set_xlim(0, pos + neg)
    ax.axis("off")
    save(fig, "neutral-reclassified.png")

    for task, result in (("Sentiment", sentiment), ("Helpfulness", helpful)):
        print(task, {m: [round(v, 3) for v in s] for m, s in result.items()})
    print(f"Neutral: {pos} positive, {neg} negative")


if __name__ == "__main__":
    main()
