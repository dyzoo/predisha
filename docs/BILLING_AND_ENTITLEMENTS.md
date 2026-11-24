# Billing and Entitlements

- Live billing provider: SettloPay (mobile money) behind the `BillingProvider` abstraction
- Live billing requires `BILLING_LIVE_ENABLED=true` and `BILLING_PROVIDER=settlopay` (real mobile-money payments) or `BILLING_PROVIDER=manual` with `BILLING_TEST_MODE=true` (test activation); checkout stays disabled while no provider is configured
- Mobile-money checkout, webhook events confirmed against the provider status API
- Entitlements enforced server-side
- No card data stored

## SettloPay integration

- Configure `SETTLO_API_KEY`, `SETTLO_BASE_URL`, `SETTLO_API_VERSION`, `SETTLO_WEBHOOK_SECRET` and `SETTLO_WEBHOOK_URL` before enabling `BILLING_PROVIDER=settlopay`.
- Checkout starts a mobile-money collection through the SettloPay API with the customer phone and the amount in TZS, authenticated with `SETTLO_API_KEY`.
- The returned SettloPay payment id is recorded on the billing event ledger (`BillingEvent.providerEventId`) together with the buyer context captured at checkout.
- `POST /api/webhooks/settlopay` applies the reported status idempotently; the public URL `https://spotionebet.co.tz/webhooks/settlo` is rewritten to this route. Confirmed payments grant the premium subscription and failed, blocked or lost-chargeback payments mark it unpaid. Each request must include a `Settlo-Signature` header containing an HMAC-SHA256 signature over `t.rawBody` using `SETTLO_WEBHOOK_SECRET`, accepted within a five-minute tolerance; `Settlo-Event-Id` is used for deduplication.
- Payment state is confirmed with `GET /v1/payments/{id}` before fulfilment, so a forged or stale callback cannot activate a subscription.
- `POST /api/billing/confirm` re-checks an in-flight SettloPay payment through the status API and applies the event. The checkout UI polls this endpoint after sending the mobile-money prompt, so subscriptions still activate when a webhook cannot reach the app (for example when `APP_URL` is localhost).
- The provider abstraction (`src/lib/billing/provider.ts`) maps SettloPay payments to the internal subscription model. The app never handles raw card data.
- SettloPay has no sandbox; test keys still move real money. Use `BILLING_PROVIDER=manual` with `BILLING_TEST_MODE=true` for non-charging test activations.

## Test activation

- `BILLING_PROVIDER=manual` plus `BILLING_TEST_MODE=true` lets a signed-in user activate a plan immediately without a real payment. Manual activation is refused in production unless `BILLING_TEST_MODE=true` is set explicitly.
- Manual activation writes a `manual.activated` entry to the billing event ledger and sets the subscription to `ACTIVE`, so the normal entitlement rules apply.

## Free preview

- `UserFreePreview` stores at most one record per user (`userId` is unique).
- A free, non-demo account may consume one saved prediction preview. The claim is attached only
  after the slip is persisted, so a failed model response does not burn the preview.
- `GET|POST /api/free-preview/claim` reports or records the claim; a used account receives `409`
  when it tries to claim again.
- Demo mode is unlimited for review. Premium and admin accounts are unlimited.
- `POST /api/predictions/build` returns `402` with `FREE_PREVIEW_USED` when a free account has no
  preview left. Entitlement checks never trust client-supplied flags.
