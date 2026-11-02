# Prediction Methodology

- LLM used only for explanation, not probability generation
- Probabilities from statistical models (Elo/Poisson baselines)
- Only data available before prediction time used
- Probabilities validated to sum to ~1 and be in [0,1]
- Insufficient data returns no prediction

## Saved slips and settlement

- A saved slip snapshots the selected outcome, all three 1X2 probabilities, implied odds, model
  version, and kickoff UTC at build time.
- Each settled selection receives a multi-class Brier score:
  `(pH - yH)^2 + (pD - yD)^2 + (pA - yA)^2`, where the actual outcome has `y = 1`.
- Slip status: `LOST` as soon as any selection misses; otherwise `PENDING` while any fixture is
  unresolved; otherwise `VOID` if any fixture is postponed/cancelled; otherwise `WON`.
- ## Model governance

- Active model recorded in `ModelRegistry`. Before activation, run chronological backtest and compare with current production model and a simple baseline (historical home/draw/away rates).
- Activation requires explicit admin/deployment approval.
- Every prediction stores model version, feature/data snapshot, data-quality flags, and structured facts for auditability.
- Predictions are immutable after publication; corrections require audited revisions only.

## OpenFootball integration

- Adapter disabled by default (`OPENFOOTBALL_ENABLED=false`, `OPENFOOTBALL_LICENSE_CHECKED=false`).
- Before production use, verify exact dataset licence (repository `LICENSE`, data-specific terms, commercial-use permission) and record provenance metadata (`sourceProvider`, `sourceRevision`, `retrievedAt`, `parserVersion`).
- Import only approved competitions/seasons; validate format; reject invalid/incomplete files; record insert/update/skip/reject counts.
- Deduplicate by provider IDs and stable internal IDs; never silently merge approximate names.

Accuracy and Brier scores are descriptive, not a profitability claim. Small samples are noisy.
