# Recent changes

Last updated: 2026-11-25

## Summary

Two changes were committed and pushed to `origin/master`:

- `9b68fef fix: restore full fixture sync and model eligibility`
- `3a3c2f1 fix: repair bet search and builder layout`

Working tree is clean.

## Fixture sync and prediction eligibility (`9b68fef`)

### Cause

The football-data.org sync exceeded the 10 requests/minute limit, leaving the database with only 2 fixtures and no finished history. The model then flagged every match with `LOW_SAMPLE`, `STALE_INPUT` or `MISSING_INPUT`, so prediction generation returned "No upcoming fixtures currently pass the model quality gates."

Other contributing issues:

- The provider hardcoded 10 competition codes while the configured token had access to 13.
- Date chunks used 9 days instead of the allowed 10, producing unnecessary requests.
- `getSportsDataset()` replaced stored fixtures with live fixtures, discarding stored history.
- Fixtures were upserted one-by-one inside Prisma transactions, which stalled the sync.

### Changes

- `src/lib/sports/football-data.ts`
  - Dynamic competition discovery from `/competitions`.
  - Request throttling, response caching, in-flight dedupe and 429 retry handling.
  - 10-day date chunks.
- `src/lib/sports/sync.ts`
  - One fixture fetch per sync with `-60d..+30d` window.
  - Batched `jsonb_to_recordset` SQL upserts for competitions, teams and fixtures.
- `src/lib/sports/service.ts`
  - Fresh provider fixtures now merge with stored fixtures instead of replacing them.

### Result

- Sync stored 927 fixtures and 188 teams.
- Dataset showed 662 fixtures and 366 scheduled fixtures with predictions.
- Cron schedule remains `/api/cron/sync` at `0 21 * * *` in `vercel.json`.

## Bet search and match detail (`3a3c2f1`)

### Changes

- `src/lib/bet/search.ts`
  - New normalized search helpers supporting accents, punctuation, team names, short names, competitions and `vs` match queries.
- `src/components/bet/sportsbook-browser.tsx`
  - Converted to a client component with instant suggestions while typing.
  - Suggestions link directly to `/bet/match/{fixtureId}`.
  - Added clear-search control and improved no-results messaging.
  - Kept native GET form submission as progressive enhancement.
- `src/app/bet/page.tsx` and `src/app/bet/sports/page.tsx`
  - Pass a stable timestamp from the catalog into the browser to keep EAT day filtering deterministic.
- `src/lib/bet/catalog.ts`
  - `getBetEvent()` now returns the matching `analysis` and dataset from the same fetch.
- `src/app/bet/match/[fixtureId]/page.tsx`
  - Added `Markets` and `STATS` jump links.
  - Added `MatchStatsTabs` with head-to-head, form, team stats and fixture lists.
  - Existing market accordion remains available under `Markets`.
- `src/lib/bet/search.test.ts`
  - Added tests for normalization, team/match matching and suggestion results.

## Builder responsive layout (`3a3c2f1`)

### Changes

- `src/app/(protected)/builder/page.tsx`
  - Reduced top/bottom padding on small screens and allowed the heading to wrap cleanly.
- `src/components/builder/bet-builder.tsx`
  - Responsive padding, typography and card spacing.
  - Removed fixed minimum heights that could clip content on short screens.
  - Added `min-w-0` and `break-words` where long team names or reasons could overflow.
  - Reduced mobile indentation in prediction selection details.

## Verification

- `npm test -- --run` — 185 tests passed.
- `npm run lint` — 0 errors; 4 pre-existing warnings.
- `npx tsc --noEmit` — passed.
- `npm run build` — passed.
