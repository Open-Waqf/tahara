# Fiqh Engine Governance & Sources

This document outlines the governance structure for the religious calculation engine used in Tahara. All implementations must adhere to the citations and processes defined herein to ensure accuracy and transparency (Amanah).

## 1. Primary Sources (Citations)

The Tahara engine is a mathematical implementation of the specific limits defined in the following recognized classical texts:

| Madhhab | Primary Source Text | Key Rule Thresholds |
| :--- | :--- | :--- |
| **Hanafi** | *Mukhtasar al-Quduri* | Max 10 days (240h), Min 3 days (72h), Min Tuhr 15 days. |
| **Shafi'i** | *Minhaj al-Talibin* (Imam al-Nawawi) | Max 15 days (360h), Min 1 day (24h), Min Tuhr 15 days. |
| **Maliki** | *Mukhtasar Khalil* | Max 15 days (General) or Habit + 3 days (Mu'tada), No Min, Min Tuhr 15 days. |
| **Hanbali** | *Zad al-Mustaqni'* | Max 15 days, Min 1 day (24h), Min Tuhr 13 days. |

## 2. Decision Making & Disagreements

1. **Standardization:** In cases of differing opinions within a Madhhab (ikhtilaf), Tahara defaults to the *Mashhur* (most well-known) or *Mu'tamad* (relied-upon) position of the school to provide a stable baseline for users.
2. **Review Board:** Changes to the `rules.js` logic require a code review against the cited source text.
3. **Scholar Consultation:** For complex edge cases, the project consults with qualified graduates of recognized Islamic institutions.

## 3. Transparency (Open Audit)

All logic is exposed in `www/engine.js` and `www/rules.js`. Independent scholars and developers are encouraged to audit the mathematical implementation against the cited sources using the public Test-Vector Corpus (`tests/fiqh-vectors.json`).
