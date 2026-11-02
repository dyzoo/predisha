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
