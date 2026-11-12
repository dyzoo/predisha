# Operations

- Scheduled jobs for sync, prediction generation, evaluation
- Provider health monitoring
- Admin audit logs
- Graceful degradation on provider failures

## Prediction history

- Apply schema changes with `npm run db:push` (or `npm run db:migrate`) before deploying history
  features. The tables are `PredictionSlip`, `PredictionSlipSelection`, and `UserFreePreview`.
- Settlement runs lazily when `/history` or `GET /api/predictions/history` is read; no background job
  is required yet. If history volume grows, move settlement into the scheduled evaluation job.
- History queries are capped at 25 slips per user. Check query time and add pagination before raising
  the cap.
- Free-preview claims and saved slips are per user; deleting a user cascades to both.

## Sandbox betting workspace

- Apply the bet tables (`BetWallet`, `BetTransaction`, `BetTicket`, `BetShareCode`, `BetPromoClaim`,
  `BetGameRound`, `BetAviatorBet`) with `npm run db:push` or `npm run db:migrate` before deploying
  `/bet`.
- Smoke-test accounts use the `bet-smoke-` email prefix. Delete them (cascades to wallets, tickets,
  games and share codes) after end-to-end checks.
- Share codes expire after 24 hours. Expired codes are pruned by the share loader query; add a cron
  cleanup if volume grows.
