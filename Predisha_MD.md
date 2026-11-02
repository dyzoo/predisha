# OpenFootball + Professional Prediction Engine & AI Upgrade

**Purpose:** Incrementally improve the credibility, statistical quality, transparency, and auditability of an existing AI football prediction platform.

**Project context:** The platform already uses Next.js/Vercel, has integrated football-data.org, and already generates predictions. This document extends that system; it is not a rebuild specification.

## 1. Non-negotiable instructions

- Inspect the existing repository, data pipeline, prediction logic, database, AI integration, routes, and UI before changing anything.
- Preserve working authentication, subscriptions, payments, database connections, routes, layouts, fonts, animations, and existing integrations.
- Do not replace the current prediction model until a new model has been evaluated against it and explicitly approved.
- Never fabricate fixtures, results, statistics, odds, injuries, lineups, probabilities, or sources.
- Never use an LLM to generate or modify numerical probabilities.
- Never use information that became available after a historical match's kickoff when backtesting that match.
- If data is inadequate, return an explicit no-prediction/insufficient-data state.
- Before schema changes, explain migration risks and how existing records will be preserved.

## 2. OpenFootball: what it is and how to use it

OpenFootball is a community-maintained collection of football data projects. Its repositories publish structured football information, including fixtures and results for selected competitions and seasons. The `football.json` repository provides JSON datasets that may be useful for historical data imports and model evaluation.

Official resources:
- Main project: https://github.com/openfootball
- Football JSON datasets: https://github.com/openfootball/football.json
- World football data project: https://github.com/openfootball/world

OpenFootball is **not** a guaranteed real-time API, bookmaker-odds service, injury feed, lineup provider, or complete global football database. Coverage, season depth, update frequency, and completeness vary. Use it as a supplementary historical source, not as a replacement for the existing football-data.org integration.

### 2.1 Appropriate uses

Subject to coverage and licence verification, use OpenFootball for:
- Backfilling historical fixtures and final scores.
- Supplementing historical training and evaluation datasets.
- Cross-checking selected historical records against another source.
- Building reproducible historical datasets for backtesting.

Do not use it as the source for live scores, current bookmaker odds, injuries, suspensions, confirmed lineups, xG, shots, possession, or team news unless a particular dataset demonstrably contains the field and its provenance is verified.

### 2.2 Licence and commercial-use review — mandatory

Before importing data into production or using it to train a commercial model:

1. Inspect the exact repository's current `LICENSE`, `README`, and any data-specific attribution or usage terms.
2. Verify that the licence applies to the actual dataset files, not merely the repository's code.
3. Record repository URL, file path, commit/revision, retrieval date, licence, attribution requirements, and intended use.
4. Confirm that commercial display, storage, aggregation, and model-training uses are permitted.
5. If rights are unclear, do not use that dataset in production or commercial training. Keep the adapter disabled and seek permission or another properly licensed source.

Do not assume public GitHub availability means unrestricted commercial use, public-domain status, or permission for AI training.

### 2.3 Integration design

Create an isolated adapter/importer. Adapt the paths to the existing repository conventions; do not force a new architecture.

```text
src/lib/football-data/
  providers/
    football-data-org/
    openfootball/
  normalization/
    team-matcher.ts
    competition-matcher.ts
    fixture-normalizer.ts
  sync/
    sync-service.ts
    source-priority.ts
    data-quality.ts
```

OpenFootball may be implemented as a versioned file importer rather than a live API client. It must:
- Import only configured, approved competition/season files.
- Validate file format and required fields.
- Be safe to rerun without creating duplicates.
- Produce inserted/updated/skipped/rejected row counts.
- Record the source revision and importer/parser version.
- Preserve source provenance.
- Never silently overwrite a more authoritative current record.

### 2.4 Normalization and conflict handling

- Use stable internal team and competition IDs.
- Store provider-specific IDs and aliases separately.
- Normalize timestamps to UTC while retaining source timestamp/timezone metadata where available.
- Normalize season identifiers and match statuses explicitly.
- Do not merge teams based only on approximate name similarity.
- Send uncertain matches to a review queue or leave them unmatched.
- Preserve original source names where useful.
- Retain conflicting observations from multiple providers.
- Define documented field-level source precedence; do not blindly overwrite records.
- Mark unresolved material conflicts and exclude affected records from high-confidence predictions/training.

Every imported/synchronized record should retain as appropriate:
`sourceProvider`, `sourceRecordId`, `sourceFilePath`, `sourceRevision`, `retrievedAt`, `sourceUpdatedAt`, `importedAt`, `parserVersion`, `dataQualityStatus`, and `isEligibleForTraining`.

## 3. Professional statistical prediction engine

The prediction engine must be a reproducible statistical service, not arbitrary rules or AI guesses. It should calculate probabilities from information available before kickoff, record the model/data snapshot, explain insufficient data, and be evaluated on unseen historical matches.

### 3.1 Recommended foundation: Elo + Poisson

Start with an interpretable model before adding complex machine learning.

**Elo ratings** estimate relative team strength. A basic expected-score form is:

```text
ExpectedHome = 1 / (1 + 10 ^ ((AwayRating - HomeRating - HomeAdvantage) / 400))
ExpectedAway = 1 - ExpectedHome
NewRating = OldRating + K * (ActualScore - ExpectedScore)
```

For football, explicitly define how wins, draws, and losses map to actual scores. Document:
- Draw handling.
- Home advantage and neutral venues.
- New-team initialization.
- Competition strength differences.
- Rating carryover between seasons.
- Parameter tuning using training data only.

Track rating history so historical predictions can be reproduced. Elo is a team-strength feature; it is not automatically a probability for every betting market.

**Poisson goal model** estimates expected goals for each team from attack strength, defensive strength, league scoring averages, and home advantage.

```text
P(X = k) = (lambda ^ k * exp(-lambda)) / k!
```

Where `lambda` is the team's expected goals. Define attack/defence strengths consistently, smooth small samples, and document the calculation. Build a joint scoreline distribution over a suitable goal range, including a tail bucket if needed.

Derive supported markets from the distribution:
- Home win / draw / away win (1X2).
- Supported over/under goal lines.
- Both teams to score.
- Correct-score estimates only if clearly labelled as low-probability outcomes.

Do not display markets that have not been validated.

**Combining Elo and Poisson:** Use Elo as a feature or a validated adjustment. Do not combine model outputs with arbitrary weights. Compare a simple baseline, Elo, Poisson, and combined model using out-of-sample results. Select based on calibration and performance, not attractive picks.

### 3.2 Feature engineering

Use only fields actually present in reliable source data:
- Recent form with a defined window and time decay.
- Home/away performance splits.
- Goals scored and conceded.
- Opponent strength.
- Rest days.
- Current-season performance.
- Appropriate previous-season carryover.
- Competition scoring averages.
- Neutral venue flag.
- Team rating difference.
- Sample size and data coverage.

Potential future features, only with a suitable licensed source:
- Injuries/suspensions.
- Confirmed lineups and player availability.
- xG and shot quality.
- Travel distance and schedule congestion.
- Weather and pitch conditions.

Missing values must remain missing or use a documented fallback. Never infer injuries, lineups, xG, or odds from unrelated data. Record when each feature became available. Never use post-match statistics in a pre-match prediction.

### 3.3 Recent form

Do not rely only on a W-D-L sequence. Where enough data exists, calculate:
- Points per match.
- Goals scored/conceded per match.
- Home/away split.
- Opponent-adjusted performance.
- Recency-weighted form.

Display the number of matches and time period used. Warn about small samples. Recent form is evidence, not proof of a future result.

### 3.4 Prediction eligibility and quality gates

Before publishing a prediction, verify:
- Fixture is valid and upcoming.
- Kickoff time is valid.
- Both teams resolve to internal IDs.
- Competition and season are identified.
- Historical sample meets a configurable minimum.
- Required features are available.
- Data freshness is within a documented threshold.
- No unresolved material source conflict exists.
- Model version is active and passed evaluation.
- Fixture is not completed, abandoned, or otherwise ineligible.

If checks fail, return explicit statuses such as `INSUFFICIENT_DATA`, `STALE_DATA`, `UNSUPPORTED_COMPETITION`, or `DATA_CONFLICT`. Explain why. Do not silently substitute another fixture or display invented confidence.

## 4. Backtesting, calibration, and model governance

A serious platform must measure probability quality, not merely show picks.

### 4.1 Chronological backtesting

Simulate what the system would have known at each historical kickoff:
1. Select only records available before kickoff.
2. Build features as of that timestamp.
3. Generate a prediction with a recorded model version.
4. Save the complete probability distribution.
5. Compare with the verified final result after the match.
6. Aggregate performance over a meaningful sample.

Use chronological train/validation/test periods and preferably walk-forward evaluation. Do not randomly shuffle matches across time if that leaks future information.

### 4.2 Required metrics

**Brier score:** measures squared error of probabilistic forecasts; lower is better. For binary outcomes:

```text
Brier = (predicted_probability - actual_outcome) ^ 2
```

Use the multiclass form for 1X2 and document the calculation.

**Log loss:** penalizes confident incorrect forecasts heavily; lower is better. Apply documented probability clipping only to avoid numerical errors.

**Calibration:** group predictions into probability bands and compare mean predicted probability with observed frequency. Require adequate sample sizes and show uncertainty where appropriate.

**Baseline comparison:** compare with competition historical home/draw/away rates and other defensible baselines.

Do not claim a model is good solely because its raw win-pick accuracy is high. Accuracy ignores probability quality and class imbalance.

### 4.3 Model release gates

Before activating a model:
- Run chronological backtesting.
- Compare with the existing production model and a baseline.
- Review Brier score, log loss, and calibration.
- Review by competition and market.
- Check sample sizes and uncertainty.
- Check data leakage.
- Record evaluation dates, dataset revision, and model version.
- Require explicit admin/deployment approval.

If it does not provide a defensible improvement, keep the existing model.

### 4.4 Prediction lifecycle and auditability

For every published prediction, retain:
- Fixture ID, market, selection.
- Full probability distribution.
- Model name/version.
- Feature/data snapshot reference.
- Prediction timestamp.
- Data freshness/quality status.
- Odds value, source, and timestamp if applicable.
- Verified final result and evaluation status.

Use explicit states such as `PENDING`, `WON`, `LOST`, `VOID`, and `NOT_EVALUATED`. Settle only after a verified final result. Handle postponed, abandoned, cancelled, and rescheduled fixtures explicitly.

Do not delete losing predictions or rewrite published predictions after results. Corrections must be auditable revisions.

### 4.5 Transparent performance page

Consider showing:
- Total evaluated predictions.
- Date range, competitions, markets, and model version.
- Brier score and log loss where meaningful.
- Calibration information.
- Results by market and competition.
- Pending/unsettled count.
- Data limitations and exclusions.

Define hit-rate calculations precisely. Disclose void handling. Never advertise guaranteed wins, guaranteed profit, or risk-free returns.

## 5. AI: explanation layer, not prediction authority

### 5.1 Separate responsibilities

**Statistical service**
- Calculates probabilities.
- Selects eligible markets.
- Applies data-quality gates.
- Produces uncertainty and metadata.
- Is deterministic and testable.

**AI explanation service**
- Explains verified model output.
- Summarizes supplied statistics.
- Presents supporting and opposing factors.
- Identifies missing information and uncertainty.
- Never changes numerical probabilities.

AI must not invent team news, injuries, lineups, form, statistics, odds, or sources; create probabilities when none were supplied; upgrade poor data to high confidence; hide contradictions; or call any outcome guaranteed.

### 5.2 Structured AI input

Send validated structured data, not a vague instruction to predict a match. Example only:

```json
{
  "fixture": {
    "homeTeam": "Team A",
    "awayTeam": "Team B",
    "competition": "Example League",
    "kickoffUtc": "2026-11-10T18:00:00Z"
  },
  "data": {
    "sourceProviders": ["football-data.org"],
    "retrievedAt": "2026-11-10T10:00:00Z",
    "qualityStatus": "GOOD",
    "homeMatchesUsed": 12,
    "awayMatchesUsed": 12,
    "missingFeatures": ["confirmed_lineups", "injury_data"]
  },
  "model": {
    "name": "elo-poisson",
    "version": "1.2.0",
    "homeWinProbability": 0.48,
    "drawProbability": 0.27,
    "awayWinProbability": 0.25,
    "expectedHomeGoals": 1.55,
    "expectedAwayGoals": 1.05
  }
}
```

These are illustrative values, not a real fixture or forecast. Production values must come from verified records and the actual model.

### 5.3 Structured AI output

Validate output with Zod or the existing schema validator. Suggested contract:

```ts
interface MatchExplanation {
  summary: string;
  supportingFactors: string[];
  opposingFactors: string[];
  dataLimitations: string[];
  uncertaintyNote: string;
  modelSelectionReference: string;
}
```

Do not allow the AI to return new probabilities, odds, or a different recommended market unless those values are independently generated and validated by the statistical service.

If AI output is invalid, unavailable, or times out, show the statistical analysis without the AI explanation.

### 5.4 Suggested AI system instruction

```text
You are the explanation layer of a football statistical analysis platform.
You do not predict match outcomes independently. Explain only the verified
fixture data, statistics, probabilities, model outputs, and limitations
supplied in the request.

1. Never invent facts, injuries, lineups, odds, statistics, probabilities,
   sources, or match context.
2. Never change or increase supplied model probabilities.
3. Distinguish measured facts from model estimates.
4. Explain supporting and opposing factors.
5. Mention missing or stale data when supplied.
6. Never use "guaranteed win", "sure bet", "risk-free", "fixed match",
   or "certain outcome".
7. If evidence is insufficient or contradictory, say so.
8. Never claim to have searched the internet or checked live news unless
   a verified search tool actually supplied that information.
9. Keep explanations concise, neutral, and understandable.
10. Return only the requested structured output.
```

### 5.5 AI provider abstraction and reliability

Keep the AI provider replaceable. Adapt to current code conventions. Requirements:
- Server-side API keys only.
- Timeouts and bounded retries.
- Cache by fixture ID + model version + feature snapshot hash.
- Invalidate cache when underlying data changes.
- Track token usage and estimated cost.
- Avoid sending personal user information.
- Graceful fallback if AI is unavailable.
- Review provider privacy, data-retention, and commercial terms.

## 6. Professional match-analysis experience

Improve existing screens; do not replace the current design system.

Where data exists, a match analysis should include:

**Match header**
- Teams, competition, season.
- Kickoff in user's local timezone.
- Fixture status.
- Last data update.

**Model outlook**
- Home/draw/away probabilities.
- Expected goals if produced by the active model.
- Model name/version.
- Label probabilities as estimates, not guarantees.
- Ensure 1X2 probabilities sum to approximately 100%, allowing documented rounding.

**Evidence**
- Recent results with dates/opponents.
- Home/away splits.
- Goals scored/conceded.
- Sample size.
- Opponent strength where available.
- Missing-data indicators.

**Market analysis**
- Market and selection.
- Model probability.
- Data coverage and eligibility.
- Short explanation.
- Risk/uncertainty note.

**AI explanation**
- Neutral summary.
- Supporting factors.
- Opposing factors.
- Missing information.
- Clear indication that AI is explaining the statistical model.

**Transparency panel: “How this analysis was generated”**
- Data providers.
- Last refresh time.
- Historical matches used.
- Model name/version.
- Prediction timestamp.
- Missing features.
- Odds source: API, user-entered, or unavailable.

Never show missing statistics as zero. Never imply user-entered odds came from a bookmaker API.

## 7. Prediction builder and stake calculations

The platform is an analysis/subscription service. It does not accept or hold betting funds and does not place wagers. A stake is a user-entered calculation input only.

If the existing builder supports combinations:
- Use only valid, supported model outputs.
- Explain that combinations increase uncertainty.
- Do not multiply probabilities as if selections are independent unless independence is justified.
- For correlated selections, do not calculate combined probability without a validated joint model.
- Do not select combinations merely to reach an attractive return target.
- Never fabricate odds.

If actual decimal odds are supplied:

```text
Potential gross return = stake × combined decimal odds
Potential net profit = potential gross return - stake
```

Label calculations illustrative and before fees/taxes. If odds are unavailable, do not show a fabricated return. Do not call stake input a deposit, wallet balance, or funds held by the platform.

## 8. Database and service boundaries

Inspect existing Prisma/database models before changing them. Reuse existing entities. Potential concepts, only if missing:
- Data source/import run/provider record/data conflict.
- Model version/evaluation/metric.
- Feature snapshot.
- Prediction/selection/outcome/revision.

Potential metadata includes model version, fixture ID, market, selection, probability, creation timestamp, feature snapshot, data quality status, evaluation status, and settlement timestamp.

Suggested service boundaries:
- `footballDataSyncService`
- `openFootballImportService`
- `fixtureNormalizationService`
- `dataQualityService`
- `featureEngineeringService`
- `eloRatingService`
- `poissonPredictionService`
- `predictionEvaluationService`
- `predictionPublishingService`
- `aiExplanationService`

Adapt endpoint names to existing conventions. Protect admin import/evaluation/model activation endpoints. Add authorization, validation, pagination, rate limits, and structured errors.

## 9. Security and operations

- Keep provider and AI credentials server-side.
- Validate external responses before storage.
- Add timeouts, bounded retries, and rate limits.
- Make imports/sync idempotent.
- Log failures without logging secrets or unnecessary personal data.
- Prevent users from modifying published probabilities or prediction records.
- Protect admin actions and keep an audit trail.
- Safely render AI output as untrusted text.
- Add a kill switch for a model or market.
- Do not publish when critical data-quality or model checks fail.

## 10. Testing requirements

**OpenFootball**
- Valid file parses.
- Invalid/incomplete files are rejected with useful reports.
- Re-import creates no duplicates.
- Team aliases resolve safely.
- Unmatched teams are not silently merged.
- Conflicts are flagged.
- Provenance is recorded.

**Prediction engine**
- Elo updates are chronological.
- Poisson calculations are valid.
- Scoreline distribution is normalized appropriately.
- 1X2 probabilities sum to approximately 1.
- No future information enters historical forecasts.
- Missing data triggers explicit fallback/no-prediction.
- Unsupported competitions are rejected.
- Same inputs/model version produce reproducible results.
- Evaluation metrics pass known-value tests.

**AI**
- Cannot modify model probabilities.
- Discloses missing data.
- Includes opposing factors when supplied.
- Invalid JSON is rejected safely.
- AI outage does not break statistical analysis.
- Prompt injection in external text cannot override system rules.
- No unnecessary personal data is sent.

**Prediction lifecycle**
- Published predictions are immutable except audited revisions.
- Results settle only after verified final scores.
- Postponed/abandoned fixtures are handled.
- Performance reports exclude pending predictions and disclose void handling.

**Regression**
- Existing login, signup, subscriptions, payments, routes, responsive UI, animations, and user data continue working.
- Existing tests and type checks pass.
- Add integration and end-to-end tests for new behaviour.

## 11. Implementation milestones

### Milestone 0 — Repository audit (no code changes)
Report current stack, football-data.org integration, prediction generation path, schema, AI provider, UI routes, subscription gates, test coverage, and risks.

### Milestone 1 — Data quality and provenance
Audit current data; add source metadata, freshness, quality checks, and sync/import reports where missing.

### Milestone 2 — OpenFootball adapter
Verify exact dataset licence and commercial suitability. Configure approved datasets only. Implement parser, importer, normalization, deduplication, dry-run report. Do not activate unapproved data in production.

### Milestone 3 — Statistical model hardening
Document current logic. Improve or add Elo/Poisson only where justified. Add quality gates, model versioning, and reproducibility. Compare with current model before activation.

### Milestone 4 — Backtesting and evaluation
Implement chronological evaluation, Brier score, log loss, calibration, and baseline comparison. Require approval before changing production default.

### Milestone 5 — AI explanation hardening
Separate AI explanation from probability generation. Add structured validated input/output, prompt constraints, timeouts, caching, and fallback.

### Milestone 6 — Professional analysis UI
Improve existing screens with freshness, sample size, model version, probabilities, limitations, and explanation. Preserve existing visual language and responsive behaviour.

### Milestone 7 — Monitoring and release
Add logs/alerts, performance reporting, regression tests, and deployment documentation. Report remaining external dependencies.

## 12. OpenCode implementation instruction

```text
Read this entire document and the existing project specifications before
making changes.

This is an incremental quality upgrade to an existing working AI football
predictions platform. It already integrates football-data.org and already
generates predictions.

Do not rebuild the platform or replace working features, database connections,
authentication, subscription logic, routes, UI, animations, fonts, or
integrations.

First inspect the repository and report:
1. How football-data.org is integrated.
2. How predictions are currently generated.
3. Existing database models and prediction records.
4. Existing AI integration.
5. Gaps against this specification.
6. A safe implementation plan and migration risks.

Then implement the milestones one at a time.

Prioritize data provenance and quality; a properly licensed OpenFootball
historical-data adapter; a reproducible Elo/Poisson model or justified
improvements to the existing model; chronological backtesting; Brier score,
log loss and calibration; model versioning; prediction traceability; and
AI explanations grounded strictly in verified model output.

Do not activate a new model merely because it has been implemented. Compare
it with the current production model and a baseline using chronological
out-of-sample evaluation. Report results and wait for approval before
changing the production default.

Do not import OpenFootball data into production or use it for commercial
training until the exact dataset licence and intended use have been checked.
Never fabricate data, odds, probabilities, team news, injuries, lineups, or
historical results.

AI may explain statistical outputs but must never invent or modify
probabilities. If AI is unavailable, preserve statistical analysis.

Before database migrations, explain changes and risks. Preserve existing
data. Run tests, type checks, and regression checks after each milestone.

At completion, report files changed, database changes, tests and results,
model evaluation results, licensing decisions, environment variables,
scheduled jobs, unfinished work, and external dependencies.
```

## 13. Definition of done

The upgrade is complete only when:
- Existing functionality remains intact.
- OpenFootball is used only after licence review.
- Imported data is normalized, deduplicated, and traceable.
- Data freshness and quality are visible.
- The prediction engine is reproducible and versioned.
- Backtesting is chronological and free from future-data leakage.
- Brier score, log loss, calibration, and baselines are available.
- AI explanations are grounded in structured model output.
- AI failure does not prevent valid statistical analysis.
- Users can understand how an analysis was generated and what is missing.
- Predictions and outcomes are auditable.
- No guaranteed outcomes or profits are promised.
- Tests and type checks pass.
- Licensing, API, hosting, and deployment requirements are documented.

**Product principle:** Make the platform credible through evidence, measurable model performance, transparent limitations, and reproducible analysis—not exaggerated confidence scores or persuasive AI-generated language.
