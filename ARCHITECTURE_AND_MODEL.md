# Predisha System Architecture & Model

## 1. Overview

Predisha is an AI-assisted sports analytics subscription platform built on Next.js App Router + TypeScript (strict). It provides transparent statistical predictions (Elo + Poisson baseline), a prediction builder (slip generator), historical evaluation, user accounts/subscriptions, and an optional third-party bookmaker link layer. The platform does **not** accept bets, hold funds, or operate as a bookmaker.

## 2. Technology Stack

- **Runtime / Framework:** Next.js 16.4.3 (App Router), React, TypeScript (strict)
- **Styling:** Tailwind CSS, custom design tokens (`--background`, `--surface`, `--accent`)
- **Database:** PostgreSQL (Prisma ORM)
- **Authentication:** Auth.js / next-auth v5 beta (email, session, secure cookies)
- **Validation:** Zod (API inputs, schemas)
- **Charts / Charts Lib:** Recharts available; probability bars implemented with CSS progress bars
- **Testing:** Vitest + React Testing Library (unit), Playwright referenced
- **Deployment:** Vercel

## 3. Database Schema (Prisma)

Key entities:

- `User` / `Account` / `Session` / `VerificationToken`
- `UserPreference`, `SavedFixture`, `UserFreePreview`
- `Sport`, `Competition`, `Team`, `Fixture`, `TeamMatchStat`
- `Prediction` (fixtureId, market, modelVersion, generatedAt, inputDataAsOf, status, dataQualityFlags, structuredFacts, explanation) + `PredictionOutcome` + `PredictionEvaluation`
- `PredictionSlip` (user stake, currency, risk, odds, implications, combined probability, potential/net return, status, brierScore) + `PredictionSlipSelection`
- `SubscriptionPlan` / `Subscription` / `BillingEvent`
- `OutboundProviderLink`, `AdminAuditLog`, `SyncJob`

M1 provenance fields added to `Fixture`: `sourceProvider`, `sourceFilePath`, `sourceRevision`, `retrievedAt`, `sourceUpdatedAt`, `importedAt`, `parserVersion`, `dataQualityStatus`, `isEligibleForTraining`.

## 4. Data Pipeline & Sports Data

### 4.1 Provider Strategy
- Primary: `football-data.org` (configured via adapter interface).
- Supplementary: `openfootball` (community JSON datasets) — **adapter disabled by default** (`OPENFOOTBALL_ENABLED=false`) until exact dataset licence and commercial suitability is verified.

### 4.2 Adapter Architecture
```
src/lib/sports/
  demo/              // demo adapter (used when DB empty / health demo mode)
  provider/          // interface + types (Fixture, Team, Competition, Sport)
  providers/openfootball/
    config.ts        // licence guard
    parser.ts        // JSON parser (placeholder until verified)
    normalization.ts // normalize to internal IDs, UTC, provenance
    importer.ts      // idempotent import with insert/update/skip/reject counts
  service.ts         // getSportsDataset, buildMatchAnalyses, getMatchAnalysis
  view-model.ts      // toMatchView, formatMatchTime
  data-quality.ts    // evaluateFixtureQuality, provenance tracking
```

### 4.3 Sync & Quality Gates
- `SyncJob` records sync runs (PENDING, RUNNING, SUCCEEDED, FAILED).
- Fixtures must pass data-quality checks: `MISSING_SOURCE`, `STALE_INPUT` (>21 days), `LOW_SAMPLE`, `INELIGIBLE_STATUS` (postponed/cancelled/abandoned).
- Only fixtures passing gates are eligible for prediction and ranking.

## 5. Prediction Engine (Statistical)

### 5.1 Model Foundation: Elo + Poisson
- **Elo Ratings:** Relative team strength with home advantage (`MODEL_CONFIG.homeAdvantageElo = 70`), k-factor (`24`), initial rating `1500`.
- **Poisson Goal Model:** Expected goals derived from attack/defence strengths, league average (`1.35`), home/away factors, and Elo adjustment (`clamp(1 + eloDifference/800, 0.55, 1.65)`).
- **Market Derivation:** 1X2, Double Chance, Over/Under thresholds, BTTS — derived from joint scoreline distribution (`maxGoals = 8`).

### 5.2 Leakage Prevention
- `buildMatchFeatures` uses only `FINISHED` fixtures with `kickoffUtc < asOf` (strict chronological split).
- Target fixture excluded from feature calculation.
- `predictMatch` returns `null` if `MISSING_INPUT`, `LOW_SAMPLE` (<3 matches), or `STALE_INPUT` present.

### 5.3 Model Registry & Versioning
- `MODEL_VERSION = 'elo-poisson-0.1.0'`
- `ModelRegistry` tracks active model, config, approval status, and evaluation summary.
- Every `Prediction` records `modelVersion`, `structuredFacts` (Elo, form, goals, adjustments), `dataQualityFlags`, `inputDataAsOf`.

### 5.4 Validation
- `validatePrediction`: probabilities finite, in [0,1], sum to ~1 (`abs(sum - 1) < 1e-6`), expected goals finite.

### 5.5 Backtesting & Evaluation
- `backtest.ts`: chronological split framework (activated once dataset validated).
- Metrics: Brier score, log loss, calibration by probability bucket, accuracy (secondary).
- `evaluatePrediction` calculates Brier and log loss for finished fixtures.
- `PredictionEvaluation` stored per prediction; `PredictionSlip` settlement updates `slipId` selections with `actualOutcome`, `correct`, `brierScore`.

## 6. AI Layer

### 6.1 Separation of Responsibilities
- **Statistical Service (`engine.ts`):** Calculates probabilities, selects eligible markets, applies quality gates, produces deterministic output.
- **AI Explanation Service (`src/lib/ai/explanation-service.ts`):** Explains verified statistics only; never invents probabilities, injuries, odds, or sources; never modifies model output.

### 6.2 Structured Contracts
```ts
interface StructuredAIInput {
  fixture: { homeTeam, awayTeam, competition, kickoffUtc }
  data: { sourceProviders, retrievedAt, qualityStatus, homeMatchesUsed, awayMatchesUsed, missingFeatures }
  model: { name, version, probabilities, expectedGoals }
}
interface StructuredAIOutput {
  summary, supportingFactors, opposingFactors, dataLimitations, uncertaintyNote, modelSelectionReference
}
```
- Input validated against schema; output validated (`validateAIOutput`).
- System instruction prohibits guaranteed outcomes, fabricated claims, probability changes, unverified internet claims.
- Fallback: if AI unavailable/invalid, statistical analysis shown without explanation.

## 7. Prediction Builder / Slip Flow

### 7.1 User Journey
1. User selects risk profile (`conservative`, `balanced`, `aggressive`) — defines target/minimum probabilities and max selections.
2. `POST /api/predictions/build` validates stake (positive, finite, max 1B), risk, optional user odds (`min 1`, max 1M), currency.
3. `buildPredictionSlip` filters eligible fixtures (SCHEDULED, quality flags pass), scores options (`scoreOption`), selects top `maxSelections`, and builds `BuilderResult`.
4. Combined decimal odds = product of implied odds; combined probability = product of individual probabilities; potential return = `stake * usedOdds`; net profit = return - stake.
5. Free preview: `freePreviewUsed` tracked via `UserFreePreview`; one preview per account unless premium.
6. Slip saved to `PredictionSlip` + `PredictionSlipSelection` with snapshot (immutable after build).
7. Image export: `slip-image.ts` renders PNG with selection details, probability bars, model confidence, risk profile, and responsible-use message.

### 7.2 Slip Download & Share
- `handleDownload`: creates `<a>` with data URL from `renderSlipImage`.
- `handleShare`: uses Web Share API (files + text) or clipboard fallback.

## 8. Authentication & Entitlements

- `next-auth` session + JWT cookie; email verification available.
- `canViewPremium(viewer)`: checks `Subscription.status` and `plan` features server-side.
- `canUseFreePreview`: one preview per non-premium user; tracked in `UserFreePreview` linked to `PredictionSlip`.
- Rate limits on `/api/predictions/build` (12/min per client key).
- Admin routes protected server-side (`/admin/*`, `/api/admin/*`, `/api/cron/*`) — never hidden-only.

## 9. Subscription & Billing

- `SubscriptionPlan`: weekly/monthly intervals; amount stored as integer minor units (`amountMinor`) with ISO currency.
- `BillingProvider` abstraction: hosted checkout, portal session, webhook verification, cancellation.
- **Live billing disabled** (`BILLING_LIVE_ENABLED=false`) until provider approval confirmed for jurisdiction/business model (spec warning).
- `BillingEvent`: unique provider event IDs processed idempotently; webhook signatures verified with raw body.

## 10. Routes / Information Architecture

Public:
- `/`, `/matches`, `/matches/[matchId]`, `/predictions`, `/results`, `/sports/[sport]`, `/leagues/[leagueId]`, `/pricing`, `/about`, `/methodology`, `/responsible-use`, `/terms`, `/privacy`, `/cookies`, `/refund-policy`

Account (authenticated):
- `/sign-in`, `/sign-up`, `/forgot-password`, `/dashboard`, `/saved`, `/settings/*`, `/builder`, `/history`

Admin (server-protected):
- `/admin`, `/admin/data-health`, `/admin/predictions`, `/admin/users`, `/admin/subscriptions`, `/admin/settings`, `/api/admin/*`, `/api/cron/sync`

API endpoints include `GET /api/fixtures`, `/api/predictions`, `/api/results`, `/api/plan`, protected `POST /api/predictions/build`, `POST /api/free-preview/claim`, protected billing endpoints (`/api/billing/checkout`, `/api/billing/portal` — disabled), webhook routes (`/api/webhooks/[provider]`).

## 11. UI & Design System

- Dark premium sports analytics theme; restrained neon-lime accent (`#C8FF43`).
- Tokens: Background `#101318`, Surface `#1D232C`, Elevated `#252C36`, Main text `#F5F7FA`, Muted `#A5AFBD`, Border `rgba(255,255,255,0.09)`.
- Accessible: `prefers-reduced-motion`, keyboard navigation, visible focus, semantic HTML, touch targets, text alternatives for charts, reduced-motion mode support.
- Responsive: desktop sidebar/top nav, mobile bottom bar; match cards, probability bars, skeleton loaders, empty/error/retry states.

## 12. Security & Compliance

- Secrets server-side (`DATABASE_URL`, `AUTH_SECRET`, provider keys in `.env`); `.env.example` has placeholders only.
- Input validation with Zod; ORM-safe queries; CSRF/SSRF/open-redirect protections; CSP/secure headers.
- No raw card data stored; hosted checkout only.
- Admin audit logs (`AdminAuditLog`) for sensitive actions.
- Age eligibility and responsible-use messaging present; no gambling-related marketing to minors.

## 13. Milestones Completed

Per `Predisha_MD.md` (622 lines):

- **M0 Audit:** Completed; stack reported; database schema inspected; existing features documented.
- **M1 Data Quality & Provenance:** Schema updated (`Fixture` provenance fields); `src/lib/sports/data-quality.ts` service created.
- **M2 OpenFootball Adapter:** Skeleton adapter (`config.ts`, `parser.ts`, `normalization.ts`, `importer.ts`) with licence guards (`enabled=false`, `licenseChecked=false`) until verification.
- **M3 Statistical Model Hardening:** `model-registry.ts` added; `MODEL_VERSION` tracked; reproducibility enforced (only pre-match data, chronological features).
- **M4 Backtesting & Evaluation:** `backtest.ts` skeleton created; Brier/log-loss evaluation present in `engine.ts` and `PredictionEvaluation` model.
- **M5 AI Explanation Hardening:** `src/lib/ai/explanation-service.ts` with structured contracts (`StructuredAIInput`, `StructuredAIOutput`), validation, system instruction constraints, probability-change prohibition, graceful fallback.
- **M6 Professional Analysis UI:** Transparency panel added to `/matches/[matchId]` (model version, data freshness, historical matches used, prediction timestamp, missing features, odds source, dataset mode); existing input snapshot preserved.
- **M7 Monitoring & Release:** `docs/PREDICTION_METHODOLOGY.md` updated with model governance and OpenFootball licence notes; `data-quality.test.ts` regression test added.

## 14. Unfinished / Required Approvals Before Launch

- **OpenFootball Licence:** Verify repository `LICENSE`, data-specific terms, commercial-use permission, attribution; only then set `OPENFOOTBALL_ENABLED=true`.
- **New Model Activation:** Any new model must pass chronological backtest, compare with current production and baseline, then receive admin approval before changing default.
- **AI Provider Configuration:** Server-side keys, caching by fixture/model/snapshot, timeout/retry, cost tracking required before full deployment.
- **Live Billing:** Remain disabled (`BILLING_LIVE_ENABLED=false`) until payment provider approves exact business model, entity, jurisdiction, and target markets.
- **Migration Safety:** Any schema changes must explain risks and preserve existing records; migrations must be added via Prisma.
- **Tests:** Integration tests (provider sync, prediction persistence/evaluation, webhook grants/revokes, premium boundary) and E2E tests (browse/filter, auth, preview boundary, provider test-mode checkout) must be completed before launch.

## 15. Key Files Added / Changed

- Schema: `prisma/schema.prisma` (Fixture provenance fields)
- Service: `src/lib/sports/data-quality.ts`
- Adapter: `src/lib/sports/providers/openfootball/*`
- Registry: `src/lib/predictions/model-registry.ts`
- Backtest: `src/lib/predictions/backtest.ts`
- AI: `src/lib/ai/explanation-service.ts`
- UI: `src/app/(public)/matches/[matchId]/page.tsx` (transparency panel)
- Docs: `docs/PREDICTION_METHODOLOGY.md`
- Tests: `src/lib/sports/data-quality.test.ts`
