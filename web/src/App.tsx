import { useEffect, useMemo, useState } from "react";
import Composer from "./Composer";
import ThreeStars from "./ThreeStars";
import Vocabulary from "./Vocabulary";
import Accuracy from "./Accuracy";
import Mess from "./Mess";
import ThemeToggle from "./ThemeToggle";
import { makeReader } from "./model";
import { count, loadData, type Data } from "./data";

const PORTFOLIO = "https://jjmensah.github.io/enam_portfolio/";
const CASE_STUDY = `${PORTFOLIO}projects/product-review-classification/`;

export default function App() {
  const [data, setData] = useState<Data | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    loadData().then(setData).catch(() => setFailed(true));
  }, []);

  const read = useMemo(() => (data ? makeReader(data.model) : null), [data]);

  if (failed) return <div className="loading">The model could not be loaded. Refresh the page to try again.</div>;
  if (!data || !read) return <div className="loading">Loading the model and 15,375 reviews…</div>;
  const { overview, reviews, evaluation, model } = data;

  return (
    <>
      <a className="skip" href="#main">Skip to the review box</a>
      <div className="bar">
        <header className="wrap topbar">
          <a className="brand" href="#main">Read between the stars</a>
          <div className="topbar-end">
            <nav aria-label="Sections">
              <a href="#three-stars">Three stars</a>
              <a href="#words">Words</a>
              <a href="#accuracy">Accuracy</a>
              <a href="#cleaning">Cleaning</a>
            </nav>
            <ThemeToggle />
          </div>
        </header>
      </div>

      <main id="main">
        <section className="wrap hero" aria-labelledby="title">
          <div style={{ display: "grid", gap: 14 }}>
            <h1 id="title">Write a review. Watch the model read it.</h1>
            <p className="lede">
              A model trained on {count(overview.reviews)} food reviews runs in this page. Every word it knows lights up as you type:
              blue pulls towards positive, orange towards negative.
            </p>
          </div>
          <Composer read={read} examples={reviews.examples} helpfulShare={overview.helpfulShare} />
        </section>

        <section id="three-stars" className="section" aria-labelledby="three-title">
          <div className="wrap">
            <div className="section-head">
              <span className="kicker">Three stars, decoded</span>
              <h2 id="three-title">What does a three-star review mean?</h2>
              <p>
                Three stars could be “fine” or “disappointed”. The model never trained on them, so it had to decide from the words alone.
                It read {count(reviews.neutralProbability.filter(p => p >= 0.5).length)} of {count(reviews.neutralProbability.length)} as positive.
              </p>
            </div>
            <ThreeStars reviews={reviews} read={read} />
          </div>
        </section>

        <section id="words" className="section" aria-labelledby="words-title">
          <div className="wrap">
            <div className="section-head">
              <span className="kicker">The vocabulary</span>
              <h2 id="words-title">5,000 words, each with a verdict</h2>
              <p>
                The model is a weighted list of words. <i>Great</i>, <i>best</i> and <i>delicious</i> pull hardest towards positive; <i>money</i>, <i>worst</i> and
                <i> disappointed</i> towards negative. Words like <i>ingredient</i> and <i>changed</i> lean negative too, the language of a recipe that got worse.
              </p>
            </div>
            <Vocabulary model={model} trained={evaluation.sentiment.train + evaluation.sentiment.test.label.length} />
          </div>
        </section>

        <section id="accuracy" className="section" aria-labelledby="accuracy-title">
          <div className="wrap">
            <div className="section-head">
              <span className="kicker">How good is it, really?</span>
              <h2 id="accuracy-title">Test it on reviews it never saw</h2>
              <p>
                Logistic regression beat a decision tree on both tasks: sentiment F1 {evaluation.sentiment.logistic.f1.toFixed(3)} against {evaluation.sentiment.tree.f1.toFixed(3)}.
                Move the threshold to see what each score trades away.
              </p>
            </div>
            <Accuracy evaluation={evaluation} />
          </div>
        </section>

        <section id="cleaning" className="section" aria-labelledby="cleaning-title">
          <div className="wrap">
            <div className="section-head">
              <span className="kicker">Before any model</span>
              <h2 id="cleaning-title">The data arrived messy</h2>
              <p>
                Two JSON files covering {count(overview.products)} products and {count(overview.users)} reviewers from 2021 to 2025. Before a word could be counted,
                IDs, ratings, dates and HTML all needed fixing.
              </p>
            </div>
            <Mess overview={overview} model={model} />
          </div>
        </section>
      </main>

      <footer className="wrap footer">
        <p>
          Data preparation and models by <a href={PORTFOLIO}>Jessica Mawuenam Dellason</a>, for UCD's COMP47670 module.
          {" "}<a href={CASE_STUDY}>The full write-up</a> covers the notebook and results.
        </p>
        <p>The page runs the notebook's TF-IDF and logistic-regression models directly in your browser; nothing you type leaves it.</p>
      </footer>
    </>
  );
}
