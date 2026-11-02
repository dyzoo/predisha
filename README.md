# Predisha — AI Sports Predictions Platform

An international sports analytics subscription platform. Predisha does **not** accept bets, hold
betting funds, or operate as a bookmaker. A high model probability is never a guaranteed result.

## Stack

- Next.js 16 App Router, React 19, strict TypeScript, Tailwind CSS v4
- PostgreSQL + Prisma 6
- Custom database-backed sessions (bcrypt password hashing, httpOnly cookie)
- Provider abstraction for sports data and future billing integration
- Elo + Poisson 1X2 prediction engine with leakage-safe features and evaluation metrics

## Setup

```bash
npm install
cp .env.example .env.local
```

Set at least `DATABASE_URL` and a long random `AUTH_SECRET` in `.env.local`.

```bash
npm run db:generate
npm run db:push
npm run db:seed
npm run dev
```

Open `http://localhost:3000`. With `SPORTS_DATA_PROVIDER=demo` (the default outside production),
the app shows clearly labelled fictional fixtures and illustrative probabilities. Demo data is never
presented as real forecasting.

### Create an admin

Set `ADMIN_EMAIL` and `ADMIN_PASSWORD` (12+ characters) before `npm run db:seed`. The seed script
also creates subscription plans only when billing amounts and provider IDs are configured. Nothing
is hardcoded and no fake payment succeeds.

### Development test accounts

Outside production, `npm run db:seed` also creates verified test accounts with varied access. The
shared password defaults to `PredishaTest123!` and can be changed with `SEED_USER_PASSWORD`. Set
`SEED_DEMO_USERS=false` to skip them.

| Email | Access |
| --- | --- |
| `admin@predisha.test` | Admin role (full access) |
| `premium@predisha.test` | Active monthly subscription |
| `trial@predisha.test` | Trialing weekly subscription |
| `free@predisha.test` | Free account, preview unused |
| `preview@predisha.test` | Free account, preview already used |
| `pastdue@predisha.test` | Past-due subscription |
| `canceled@predisha.test` | Canceled subscription |
| `unpaid@predisha.test` | Unpaid subscription |

These accounts skip email verification for local testing only. Never enable demo seeding in
production with a shared password.

## Scripts

| Command | Purpose |
| --- | --- |
| `npm run dev` | Development server |
| `npm run build` / `npm start` | Production build and server |
| `npm run lint` | ESLint |
| `npm test` | Vitest unit tests |
| `npm run db:generate` | Generate Prisma client |
| `npm run db:push` | Push schema to the configured database |
| `npm run db:migrate` | Create/apply development migrations |
| `npm run db:seed` | Seed admin, demo accounts (outside production) and configured plans |

## API

Public, read-only:

- `GET /api/sports`, `/api/competitions`, `/api/fixtures`, `/api/fixtures/:id`
- `GET /api/fixtures/:id/analysis`
- `GET /api/predictions` (free previews are limited outside demo mode)
- `GET /api/results`, `/api/plans`

Account:

- `POST /api/auth/sign-up`, `/api/auth/sign-in`, `/api/auth/sign-out`
- `GET /api/me`
- `GET|POST /api/saved-fixtures`, `DELETE /api/saved-fixtures/:fixtureId`
- `POST /api/predictions/build` (persists the slip for signed-in users)
- `GET /api/predictions/history` (own slips only)
- `GET|POST /api/free-preview/claim` (one preview per free account)

Admin:

- `POST /api/admin/sync`
- `PATCH /api/admin/users/:userId` (role and subscription access, audit-logged)

## Prediction slips and history

Signed-in builds are stored in `PredictionSlip` and `PredictionSlipSelection` with the exact
probabilities, model version, and kickoff timestamp used at build time. They appear at `/history`
and are available from `GET /api/predictions/history`.

- A free account gets **one** saved preview. Demo mode is unlimited and clearly labelled; premium and
  admin accounts are unlimited.
- Settlement uses the fixture's final score: a wrong selection makes the slip `LOST` immediately,
  unresolved fixtures keep it `PENDING`, and postponed/cancelled fixtures make it `VOID`.
- Brier scores are stored per selection and averaged per slip. Later data changes do not rewrite a
  saved slip.
- The public `/results` metrics are recomputed from the stored dataset and are separate from saved
  user slips.

## Safety and limitations

- Live sports data and live billing are disabled until credentials and provider approval exist.
  Missing inputs produce an honest unavailable state; the app never fabricates results.
- Password reset email is not configured. The reset page states this rather than faking delivery.
- Demo fixtures are fictional and labelled in the UI and API metadata.
- Authentication rate limiting is in-memory and should be replaced with a shared store before
  horizontal scaling.
- `src/components/auth-shell.tsx` calls JSON auth endpoints with same-origin checks. Sessions are
  stored in the `Session` table and validated server-side on every request.

## Documentation

- [Architecture](docs/ARCHITECTURE.md)
- [Prediction Methodology](docs/PREDICTION_METHODOLOGY.md)
- [Billing and Entitlements](docs/BILLING_AND_ENTITLEMENTS.md)
- [Operations](docs/OPERATIONS.md)
