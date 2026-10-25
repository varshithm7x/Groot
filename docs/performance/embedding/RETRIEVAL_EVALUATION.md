# OpenOnyx Broadened Retrieval Evaluation Report

This report documents the decoupled evaluation of OpenOnyx's retrieval engine against a fixed benchmark dataset from the 582-note real vault (`/home/varshith/VOLT/Engineers`).

---

## 1. Evaluation Methodology & Motivation

Standard RAG evaluations that combine title and body searches into a single aggregate recall metric often mask weaknesses: a model or lexical ranker can easily achieve 95%+ recall if queries match keywords in the document title or filename, while failing to retrieve documents when the user asks about an internal paragraph concept.

To provide an honest, regression-proof measurement, this evaluation enforces:

1. **Title Retrieval Recall**: Evaluates lookup when the user's question is formulated around the note's subject or title terms.
2. **Body-Content Retrieval Recall**: Evaluates deep semantic and lexical retrieval where queries are constructed from internal sentences with **zero token overlap** with the target note's title or filename.
3. **Ranking Quality (MRR & Hits@k)**: Measures whether the target note is ranked at position 1 (Hit@1), top 3 (Hit@3), or top 5 (Hit@5), alongside Mean Reciprocal Rank ($MRR = \frac{1}{|Q|}\sum \frac{1}{\text{rank}_i}$).
4. **Query Latency**: Measures median and p95 latency under real full-vault search conditions (582 notes).
5. **Fixed Evaluation Dataset**: Queries and target mappings are permanently pinned in [`tests/fixtures/retrieval-evaluation-dataset.json`](file:///home/varshith/VOLT/notework/tests/fixtures/retrieval-evaluation-dataset.json) to allow deterministic comparisons for future architecture or model iterations.

---

## 2. Empirical Evaluation Results

Evaluated against the 582-note real vault on 30 deterministic test items across 60 independent query executions:

| Metric | Title Retrieval | Body-Content Retrieval | Combined / Notes |
|---|---|---|---|
| **Query Type** | Note subject & title terms | Deep body paragraphs (0 title overlap) | Clean separation |
| **Recall@Adaptive (Top Passages)** | **100.0%** (30/30) | **86.7%** (26/30) | High coverage across both |
| **Hit@1 (Top Rank)** | **90.0%** (27/30) | **73.3%** (22/30) | Ground truth at rank 1 |
| **Hit@3 (Top 3)** | **96.7%** (29/30) | **83.3%** (25/30) | Highly concentrated in top 3 |
| **Hit@5 (Top 5)** | **100.0%** (30/30) | **86.7%** (26/30) | 100% of title hits in top 5 |
| **Mean Reciprocal Rank (MRR)** | **0.934** | **0.786** | High ranking fidelity |
| **Query Latency (Median)** | **183.9 ms** | **183.4 ms** | Sub-200ms interactive response |
| **Query Latency (p95)** | **210.0 ms** | **201.2 ms** | Strictly bounded under 220ms |
| **Query Latency (Mean)** | **186.1 ms** | **185.0 ms** | Uniform execution time |

---

## 3. Analysis & Key Takeaways

1. **Title Query Dominance (MRR 0.934)**:
   - When users query with concepts appearing in the document title or filename, the ranking engine places the target document at rank 1 in **90.0%** of cases and in the top 3 in **96.7%** of cases.
2. **Robust Deep-Content Retrieval (Recall 86.7%, MRR 0.786)**:
   - Even when queries share zero common words with the document title, **86.7%** of queries successfully retrieve the target document, and **73.3%** place it at rank 1. This demonstrates that multi-segment passage indexing and semantic scoring successfully locate internal knowledge without title crutches.
3. **Consistent Interactive Latency**:
   - Query latency across all 582 notes is virtually identical between title and body queries (~183 ms median, ~205 ms p95), remaining well within the interactive 250ms threshold.

---

## 4. Reproducing the Evaluation

To reproduce these metrics on demand:

```bash
# Generate / refresh the deterministic dataset if needed:
node scripts/generate-retrieval-dataset.mjs

# Run the complete retrieval evaluation suite:
OO_EVAL_VAULT=/home/varshith/VOLT/Engineers npx vitest run tests/e2e/retrieval-evaluation-suite.test.ts
```
