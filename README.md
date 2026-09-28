# Product Review Classification

An end-to-end natural language processing project exploring customer reviews and using machine-learning models to classify review ratings.

## Project overview

This project combines review text with rating data, cleans and transforms the data, extracts text features with TF-IDF, and evaluates classification models.

## Workflow

```text
Raw review data
      |
      v
Data cleaning & preparation
      |
      v
Text preprocessing
      |
      v
TF-IDF feature extraction
      |
      v
Machine-learning models
      |
      v
Model evaluation & insights
```

## What this project explores

- Review and rating distributions
- Review-date patterns
- Text preprocessing and cleaning
- TF-IDF feature extraction
- Logistic regression classification
- Decision-tree classification
- Accuracy, precision, recall and F1 evaluation
- Relationships between review language and rating categories

## Repository structure

```text
.
├── notebooks/
│   └── 01_product_review_classification.ipynb
├── reviews/
│   ├── review-scores.json
│   └── review-text.json
├── reviews.csv
├── COMP47670 - Assignment 2.pdf
├── requirements.txt
└── .gitignore
```

The original raw review files and processed CSV remain in their current locations for now because they are large/binary data assets. The project structure above is documented deliberately so the data can be reorganised safely when the repository is migrated to its final portfolio layout.

## Tech stack

- Python
- Pandas
- NumPy
- Scikit-learn
- NLTK / text-processing tools
- Matplotlib
- Seaborn
- Jupyter

## Running the project

Install the dependencies:

```bash
pip install -r requirements.txt
```

Launch Jupyter and open:

```text
notebooks/01_product_review_classification.ipynb
```

## Portfolio direction

This is being developed as a standalone data-science portfolio project rather than an assignment submission.

The eventual web version will present the review dataset, NLP workflow, model evaluation and selected insights through an interactive interface.

The original assignment brief remains in the repository as reference material.
