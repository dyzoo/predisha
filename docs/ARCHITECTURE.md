# Architecture

- Next.js App Router with TypeScript (strict)
- PostgreSQL + Prisma
- Server-side auth and entitlements
- Provider abstractions for sports data and billing
- Prediction engine with leakage-safe validation

## Prediction slip flow

1. `POST /api/predictions/build` validates the stake/risk request and loads stored fixture analyses.
2. Free non-demo accounts are checked against `UserFreePreview` before the model runs.
3. `buildPredictionSlip` ranks selections; the result includes a probability vector for every 1X2
   outcome.
4. Signed-in builds are persisted as `PredictionSlip` plus immutable `PredictionSlipSelection`
   snapshots (probabilities, model version, kickoff UTC).
5. The first free slip is attached to `UserFreePreview`, consuming the account's single preview.
6. `GET /api/predictions/history` and `/history` recompute settlement from fixture scores, persist
   `WON`/`LOST`/`VOID`/`PENDING`, and show Brier scores without hiding misses.

Pure settlement rules live in `src/lib/predictions/history-settlement.ts`; database reads and writes
live in `src/lib/predictions/history.ts`.

## Sandbox betting workspace (`/bet`)

- Isolated from subscriptions: `BetWallet` holds play money only, and no payment provider is called.
- `src/lib/bet/*` owns odds generation, catalog filtering, wallet ledger entries, ticket placement,
  settlement, promos, share codes and arcade games.
- `/api/bet/*` handlers require an authenticated session, same-origin mutations and rate limits.
- Odds are model-implied (`BOOK_MARGIN = 0.06`) and frozen at placement; stale prices are rejected
  instead of silently accepted.
- Security headers for `/bet` and `/api/bet` are configured in `next.config.ts`.
