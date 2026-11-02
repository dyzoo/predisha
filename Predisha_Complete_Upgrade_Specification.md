# Predisha --- Complete Upgrade Specification for the Coding Agent

**Purpose:** Upgrade the existing Predisha football prediction platform
to provide broader fixture coverage, configurable prediction generation,
transparent odds/probability analysis, better explanations, reliable
performance evaluation, and a polished user experience.

**Important:** This is an upgrade to an existing application, not a
rebuild. Read the repository and existing `ARCHITECTURE_AND_MODEL.md`
before changing code. Preserve existing working integrations, database
connections, API contracts, authentication, subscription rules, UI
fields, layouts, animations, fonts, and design identity unless a change
is necessary and explained.

------------------------------------------------------------------------

## 1. Product positioning and boundaries

Predisha is an AI-assisted football prediction and analysis platform. It
helps users discover, compare and understand statistically evaluated
football predictions.

Predisha is **not a bookmaker**. It must not receive or hold betting
funds, provide betting wallets, place or settle bets, or claim
guaranteed wins or profits. Users independently decide whether to use an
external betting provider. Any stake entered in Predisha is a calculator
input only.

Suggested positioning:

> Predisha helps users discover, compare and understand statistically
> evaluated football predictions, with transparent probabilities,
> potential odds and risk analysis.

The competitive advantage should be reliable coverage, useful market
analysis, transparent explanations, measured historical performance and
excellent UX---not promises of winning.

## 2. Existing architecture to preserve

The existing project documentation describes: - `football-data.org`
integration. - An OpenFootball adapter skeleton. - Elo and Poisson
prediction logic. - Data-quality checks and chronological feature
handling. - Model versioning and evaluation. - An AI explanation layer
separate from statistical calculations. - Builder functions such as
`buildPredictionSlip` and `scoreOption`. - Conservative, Balanced and
Aggressive risk profiles. - A configurable maximum number of
selections. - Free previews, subscriptions, prediction history and
match-analysis transparency.

Verify the actual implementation before changing it. Preserve the
separation: - **Data providers:** retrieve and normalize source data. -
**Statistical engine:** calculate probabilities from verified data. -
**Builder:** filter, rank and combine eligible options. - **AI
explanation layer:** explain stored statistical outputs; it does not
calculate or override probabilities. - **UI:** present actual backend
data, not invented values or fake progress.

Do not replace a working statistical model with an unrelated AI-only
prediction approach.

## 3. Priority One: diagnose the eight-game limitation

The current application reportedly produces only eight games when
generation is requested. Find the exact cause before changing the limit.
Do not simply change `8` to `20`.

Search and trace: - `maxSelections`, `maxGames`, `maxMatches`,
`limit`. - `.slice(0, 8)` and similar truncation. - Database query
limits such as `take: 8`. - API response limits and pagination
defaults. - Frontend list limits. - Risk-profile configuration. -
`buildPredictionSlip` and `scoreOption`. - Fixture discovery date ranges
and competition filters. - Data-quality thresholds and candidate-ranking
logic. - Duplicate removal. - Generation-job limits, timeouts and
provider rate limits.

Trace the complete pipeline:

`Fixture discovery → Normalization → Deduplication → Data enrichment → Quality validation → Statistical analysis → Market evaluation → Candidate filtering → Risk scoring → Combination optimization → Persistence → API response → UI rendering`

### Diagnostic report required

Record actual counts at every stage: 1. Fixtures returned by each
provider. 2. Fixtures discovered. 3. Unique fixtures after
deduplication. 4. Fixtures successfully enriched. 5. Fixtures analysed.
6. Options passing quality checks. 7. Options rejected, grouped by
reason. 8. Options selected by the builder. 9. Results returned by the
API. 10. Results rendered by the UI.

Distinguish: - **Discovered:** found from data providers. -
**Analysed:** processed by the model. - **Eligible:** passed data and
quality rules. - **Selected:** included in a prediction set. -
**Displayed:** returned and rendered.

The system must be capable of analysing and presenting more than eight
eligible fixtures when they exist. Never add weak predictions just to
reach a target. If a user requests twelve and only seven qualify, return
seven and explain the shortfall.

## 4. Configurable prediction builder

Provide these target-count presets:

  Preset                                     Target count
  ---------- --------------------------------------------
  Short                                              2--4
  Standard                                           5--8
  Extended                                          9--12
  Custom       User-defined within server-enforced limits

These are targets, not guarantees. The actual count depends on eligible
options.

Allow users to configure: - Date or prediction period. -
Competition/league or all available competitions. - Supported market
types. - Risk profile: Conservative, Balanced or Aggressive. - Selection
count. - Minimum individual model probability. - Maximum permitted
data/quality risk. - Optional target combined-odds range, only when
reliable odds data exists.

Keep the default experience simple. Place advanced options in an
expandable section.

### Risk profiles

**Conservative:** stricter quality and probability thresholds; prefer
stronger data; may return fewer selections.

**Balanced:** balance probability, data quality and user preferences.

**Aggressive:** allow more speculative eligible options, with clear
uncertainty warnings. Aggressive must never be described as more likely
to win.

Explain what each profile changes. Do not silently override user
settings.

## 5. Improve the prediction pipeline

Implement or refine these separate stages:

1.  Fixture discovery.
2.  Fixture normalization into a canonical internal format.
3.  Deduplication using provider IDs and robust matching---not team
    names alone.
4.  Data enrichment.
5.  Data-quality and freshness validation.
6.  Statistical analysis using the existing validated Elo/Poisson
    components where appropriate.
7.  Market evaluation.
8.  Candidate filtering.
9.  Risk scoring.
10. Combination construction/optimization.
11. AI explanation generation from stored outputs.
12. Persistence and API delivery.

Each stage should return structured data and meaningful rejection/error
reasons.

For each fixture or prediction, retain relevant source/provider
identifiers, source timestamps, analysis time, model version, quality
status, missing-data indicators and rejection reasons.

Do not invent missing statistics. If data is insufficient, mark the
option unavailable or apply an explicit tested quality rule.

## 6. Data providers and coverage

Review the existing `football-data.org` integration and OpenFootball
adapter. Before adding or completing a provider, verify: - API terms and
licensing. - Commercial-use restrictions. - Attribution requirements. -
Rate limits. - Competition and fixture coverage. - Update frequency and
historical-data availability.

Do not scrape or redistribute data contrary to provider terms. Normalize
providers behind a common adapter interface. Keep provider-specific code
out of the prediction engine.

Retain source identifiers and timestamps. Handle duplicate fixtures
across providers carefully.

## 7. More useful prediction markets

Do not limit analysis to match winner if the model and data can support
other markets.

Potential markets: - Full-time result: Home / Draw / Away. - Double
chance. - Over/Under goals at supported thresholds. - Both Teams to
Score (BTTS). - Other markets only when there is a defensible
statistical method and sufficient data.

Calculate each market using its own validated method. Do not reuse one
market's probability as another market's probability. Apply
market-specific quality rules and explain uncertainty. Never display a
market just because it is popular.

## 8. Odds and value analysis

Users want more visibility into potential odds. Distinguish bookmaker
prices from model probabilities.

If a licensed, reliable odds source is available: - Store
provider/bookmaker, market, selection, decimal odds, retrieval timestamp
and source. - Track stale prices. - Handle missing prices gracefully. -
Never fabricate bookmaker odds.

For decimal odds:

`Raw implied probability = 1 / decimal odds`

When all outcomes for a market are available, calculate bookmaker
overround and margin-adjusted implied probabilities using a documented
method.

Display separately: - Model-estimated probability. - Raw implied
probability. - Margin-adjusted implied probability, where calculable. -
Difference between model and market estimates. - Odds provider and
timestamp. - Data-quality/uncertainty status.

A difference between model and market probability is only a disagreement
between estimates. It is not proof of value, profitability or a winning
bet. If using the phrase "potential value signal," explain that model
error and market movement remain possible.

An odds target is a preference, not a promise. If no eligible
combination meets it, explain that rather than adding weak selections.

## 9. Combination mathematics and calculator

Multiplying individual probabilities assumes independence:

`Approximate combined probability = p1 × p2 × ... × pn`

Football selections can be correlated, especially selections from the
same match or related markets. Therefore: - Do not present
multiplication as an exact combined probability unless independence is
justified. - Without a validated joint-probability model, label it
**independence-based approximation** or show it as unavailable. - Detect
obvious same-match/related-market combinations and warn or restrict them
using explicit rules. - Do not claim a correlation adjustment unless it
is implemented and tested.

Where inputs exist, show separately: - Number of selections. -
Individual model probabilities. - Approximate combined probability and
assumptions. - Combined decimal odds from actual sourced prices. -
User-entered stake. - Potential gross return. - Potential net return.

For decimal odds:

`Potential gross return = stake × combined decimal odds`

`Potential net return = potential gross return − stake`

These are hypothetical calculator outputs only. Predisha does not accept
or place bets. If odds are missing or stale, do not calculate a fake
combined price or return.

## 10. AI Match Analyst

Improve the AI explanation layer so users can understand the statistical
output. It may explain: - Why an option passed or failed selection
rules. - Which verified data points influenced the output. - Why a
quality status is low. - Why a fixture was excluded. - Differences
between eligible options. - What a probability means. - Assumptions
behind combined probabilities. - Why odds are unavailable or stale.

It must use saved, verified fixture/model data; distinguish facts from
interpretation; cite model version and analysis time where useful; admit
missing data; and never invent injuries, line-ups, news, form or
head-to-head statistics.

AI must never generate its own probability, overwrite the statistical
engine, or guarantee outcomes/profit. AI explains; the validated engine
calculates.

## 11. UX and interface

Preserve Predisha's existing dark, premium, neon-lime visual direction
and design system. Extend it rather than replacing it with a generic
template.

### Dashboard

Make clear: - Today's and upcoming fixtures. - Available prediction
sets. - Free previews. - Subscription status/access. - Recent prediction
history. - Performance summary where evaluated data exists. - Clear
actions to generate or explore predictions.

Do not display unsupported statistics.

### Generation workspace

Use a simple workflow: 1. Select date/period. 2. Select competitions or
all available. 3. Select markets. 4. Choose risk profile. 5. Choose
selection count. 6. Optionally set odds preferences. 7. Review and
generate.

Explain that selection count is a target and results depend on eligible
fixtures.

### Real progress

Show genuine backend progress: - Discovering fixtures. - Enriching
data. - Checking quality. - Analysing matches. - Evaluating markets. -
Building combinations. - Saving results.

Display actual counts from the backend. Example values such as "36
discovered, 29 analysed, 17 eligible, 12 rejected, 8 selected" are
illustrative only; never hardcode or simulate them.

Handle empty days, provider errors, rate limits, partial data, no
eligible options, timeouts, retries and duplicate requests.

### Prediction cards

Show match, competition, kick-off time in the user's local timezone,
market/outcome, model probability, quality/risk indicator with
explanation, odds only when sourced/current, short explanation and a
link to detailed analysis.

Keep cards scannable and responsive. Do not use colour alone to
communicate status.

### Detailed match analysis

Include match information, verified team data, model output, data
source/freshness, model version, analysis timestamp, quality checks,
limitations, selection rationale and odds comparison where available. Do
not show empty decorative charts or unsupported metrics.

### History

Preserve generated sets with creation date, fixture date, selections,
model version, odds snapshot (if available), result status and
evaluation assumptions. Use statuses such as pending, won, lost, void
and unavailable. Do not rewrite historical model outputs when the model
changes.

## 12. Performance centre

Build or improve a performance centre based on completed, verifiable
outcomes.

Potential metrics: - Number of predictions evaluated. - Date range,
competitions and markets. - Model version. - Pending, void and
unavailable outcomes. - Correct/incorrect outcomes. - Brier score. - Log
loss. - Calibration information. - Sample size and limitations.

Use correct definitions and consistent evaluation rules. Exclude
pending/void outcomes from ordinary completed-outcome metrics. Do not
selectively show only wins. Clearly state the sample and date range.
Past performance does not guarantee future results.

If the current database lacks required historical information, do not
invent metrics. Add a safe migration and begin collecting data
prospectively.

## 13. Database and auditability

Inspect existing schemas before proposing migrations. Preserve existing
data and reuse entities where appropriate.

The data model should be able to retain: - Canonical fixture and
provider identifiers. - Provider/source and update timestamps. -
Competition/team references. - Data-quality results. - Model
name/version. - Reproducible model input snapshot or references. -
Market and selection. - Individual probability. - Explanation
metadata. - Odds source, price and timestamp. - Builder settings and
risk profile. - Selected count and exclusion reasons. - Combined odds
and probability assumptions. - Generation timestamp. - Final outcome and
evaluation status.

Historical records must remain interpretable after model updates. Use
migrations with recovery/rollback guidance where practical. Keep API
keys server-side in environment variables.

## 14. Performance, reliability and security

-   Avoid unnecessary repeated provider requests.
-   Cache with explicit freshness rules.
-   Respect rate limits and retry guidance.
-   Paginate large fixture lists.
-   Avoid loading all historical matches in one request.
-   Use controlled background processing if generation is too slow.
-   Prevent duplicate jobs and fixture records.
-   Validate generation settings server-side.
-   Enforce authentication and subscriptions server-side.
-   Ensure free-preview restrictions cannot be bypassed through client
    requests.
-   Rate-limit expensive generation and AI endpoints.
-   Log useful errors without exposing secrets.
-   Keep API response types consistent.
-   Implement loading, empty, error and retry states.
-   Test mobile performance.
-   Do not add infrastructure unless necessary; explain cost and
    operational impact first.

## 15. Testing and acceptance criteria

### Eight-game issue

-   Exact root cause is documented with file paths.
-   More than eight eligible fixtures can be analysed when available.
-   Pagination/API limits do not unexpectedly truncate results.
-   UI renders the returned results.
-   Weak options are never added just to reach a target.
-   Exclusion reasons are understandable.

### Builder

-   Short, Standard, Extended and Custom work.
-   Server validates invalid/excessive counts.
-   Risk profiles follow documented rules.
-   Partial results are explained.
-   No accidental duplicate selections.
-   User filters are respected.

### Statistics

-   Existing Elo/Poisson calculations remain tested.
-   Probabilities remain within valid bounds.
-   Market calculations are tested independently.
-   Missing data is handled safely.
-   Chronological rules prevent future-data leakage in backtests.
-   Model versions and inputs are traceable.
-   AI cannot alter statistical outputs.

### Odds/calculator

-   Invalid decimal odds are rejected.
-   Implied probability and margin calculations are tested.
-   Stale/missing odds are handled.
-   Gross/net return calculations are correct.
-   Combined-probability assumptions are labelled.
-   Correlation warnings/restrictions work.
-   No fake odds or guaranteed-return claims appear.

### UX/reliability

-   Progress uses actual backend status/counts.
-   Empty, error, timeout and retry states work.
-   Desktop/mobile layouts are tested.
-   Existing authentication, subscription, history and payment flows
    remain functional.
-   Secrets are not exposed in browser bundles or logs.

Run unit, integration and end-to-end tests where available, plus lint,
type checks and production build. Report checks that could not be run;
never claim unexecuted tests passed.

## 16. Implementation phases

**Phase 1 --- Audit and fixture coverage** - Read docs and inspect
repository. - Trace the eight-game cap end to end. - Diagnose provider
coverage, filters, pagination and builder limits. - Add diagnostic
counts and exclusion reasons. - Fix the actual cause without weakening
quality rules.

Deliverable: root-cause report, code changes and tests proving the
system can process more than eight eligible fixtures when available.

**Phase 2 --- Builder and market filters** - Add selection targets and
transparent risk profiles. - Add supported market filters. - Explain
partial results.

Deliverable: configurable, quality-aware builder.

**Phase 3 --- Odds and probability transparency** - Verify/add a
suitable licensed odds provider. - Store source and timestamps. - Add
implied-probability comparison and safe calculator. - Label
combined-probability assumptions and correlation risks.

Deliverable: transparent odds/probability layer.

**Phase 4 --- UX** - Improve generation workspace and real progress. -
Improve cards, analysis, history and mobile layouts. - Preserve existing
design system.

Deliverable: coherent prediction-generation experience.

**Phase 5 --- Performance and AI analyst** - Improve outcome tracking
and model evaluation. - Add performance centre. - Improve verified-data
explanations. - Add tests.

Deliverable: transparent performance and match-analysis experience.

## 17. Required coding-agent workflow

Before implementation, report: 1. Repository architecture summary. 2.
Current prediction-generation flow. 3. Exact cause of the eight-game
limitation, with file paths and code references. 4. Existing data
providers and their actual coverage/limitations. 5. Existing model
calculations and where they run. 6. Relevant database entities. 7.
Phased implementation plan, affected files and migrations.

After each phase, report: - Files created/modified. - What changed and
why. - Database migrations. - Tests run and actual results. - Known
limitations. - Required environment variables/provider credentials. -
Manual setup steps.

Do not stop after writing a plan if implementation was requested.
Proceed phase by phase, pausing only for external credentials, licensing
decisions, destructive operations or genuine user approval.

## 18. Master prompt

You are a senior full-stack engineer, football data engineer and applied
machine-learning engineer working on the existing Predisha platform.

Read this entire specification and all relevant repository documentation
before changing code. Upgrade the existing application; do not rebuild
it.

The immediate issue is that generation currently produces only eight
games. Do not assume a single hardcoded limit is responsible. Trace
provider coverage, fixture discovery, normalization, deduplication,
enrichment, quality filters, model analysis, market eligibility, builder
settings, database limits, API pagination and frontend rendering. Report
the exact cause with file paths and code references.

Then implement the phases in this document: 1. Diagnose and fix the
eight-game limitation without lowering quality standards. 2. Add Short,
Standard, Extended and Custom selection targets and transparent risk
profiles. 3. Evaluate additional markets only when model and data
support them. 4. Integrate real odds only after verifying licensing,
reliability, rate limits and attribution. 5. Add transparent
implied-probability comparison and hypothetical calculator outputs. 6.
Handle correlated selections responsibly; do not call independence
multiplication an exact combined probability. 7. Improve generation
workflow, genuine progress, cards, detailed analysis, history and mobile
UX. 8. Improve model evaluation and AI explanations using verified saved
data.

Preserve existing functionality, database connections, API contracts,
authentication, subscription logic, fields, animations, fonts,
integrations and the dark premium neon-lime design direction unless a
necessary change is explained.

Use existing Elo/Poisson components where appropriate. Keep providers,
statistical calculations, builder, AI explanations and UI separate.
Preserve historical model versions and source data.

Never force weak predictions to satisfy a count. If twelve are requested
and seven pass quality checks, return seven and explain why. Use actual
backend counts, never fake progress. Never fabricate odds, statistics or
news.

Predisha is not a bookmaker. Do not add wallets, deposits, bet
placement, settlement or custody of funds. Stake is only a calculator
input. Never promise wins or profits.

Start by auditing the repository and returning the architecture summary,
complete generation flow, exact cause of the eight-game limitation and
Phase 1 plan. Then proceed with Phase 1. Add tests, run lint/type
checks/build, and report exactly what passed or failed.

## 19. Product language

Prefer: - Model-estimated probability - Potential odds - Market-implied
probability - Data quality - Risk indicator - Historical model
performance - Hypothetical gross return - Independence-based
approximation - No eligible selections found

Avoid: - Guaranteed win - Sure odds - 100% prediction - Risk-free
profit - Guaranteed income - This bet will win - AI knows the result

**Final principle:** Predisha should help users make better-informed
decisions by showing what the model estimates, what data supports it,
what remains uncertain, and how the platform has performed over a
clearly defined historical sample.
