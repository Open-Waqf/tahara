# Test-Vector Corpus: Public Audit Guide

Tahara uses a synthetic Test-Vector Corpus to ensure that its mathematical engine accurately reflects the rules of each Madhhab. This document explains how we verify our logic.

## 1. What is a "Vector"?
A vector is a specific "user scenario" consisting of:
1. **Input:** A history of timestamps and states (Hayd/Purity).
2. **Context:** A "Current Time" (the moment the user opens the app).
3. **Expected Output:** The specific Fiqh state (e.g., "Warning: Limit Reached") that the engine must return according to the source text.

## 2. Accessing the Corpus
The raw data used for automated testing is located at:
`tests/fiqh-vectors.json`

## 3. Key Scenarios Covered
We maintain vectors for critical edge cases, including:
* **The 10-Day Threshold (Hanafi):** Ensuring a warning triggers exactly at 240 hours.
* **The 15-Day Threshold (Shafi'i):** Ensuring a warning triggers exactly at 360 hours.
* **The 1-Day Minimum (Hanbali/Shafi'i):** Ensuring bleeding shorter than 24 hours is not counted as Hayd in those schools.
* **Prediction Truncation:** Verifying that the engine ignores days exceeding the maximum limit when calculating a user's statistical average.

## 4. Auditing the Engine
To audit the engine, scholars can compare the `Expected` results in the JSON file against the cited classical sources in `GOVERNANCE.md`. If a discrepancy is found, an issue should be opened for immediate review by the maintainers.
