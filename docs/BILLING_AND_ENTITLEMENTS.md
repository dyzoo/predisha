# Billing and Entitlements

- Live billing provider: HarakaPay (USSD push) behind the `BillingProvider` abstraction
- Live billing requires `BILLING_LIVE_ENABLED=true` and either `BILLING_PROVIDER=harakapay` (real USSD payments) or `BILLING_PROVIDER=manual` with `BILLING_TEST_MODE=true` (test activation); checkout stays disabled while no provider is configured
- USSD push checkout, webhook events confirmed against the provider status API
- Entitlements enforced server-side
- No card data stored

## HarakaPay integration

- Checkout starts a USSD push through `POST https://harakapay.net/api/v1/collect` with the customer phone, the amount in TZS and the `X-API-Key` header.
- The returned HarakaPay order id is recorded on the billing event ledger (`BillingEvent.providerEventId`) together with the buyer context captured at checkout.
- `POST /api/webhooks/harakapay` applies the reported status idempotently; completed payments grant the premium subscription and failed payments mark it unpaid. HarakaPay does not sign its callbacks, so unsigned events are confirmed through `GET /api/v1/status/{order_id}` before being trusted. If a signature header is present and `HARAKAPAY_WEBHOOK_SECRET` is set, the raw body HMAC-SHA256 signature is verified first.
- `POST /api/billing/confirm` re-checks an in-flight HarakaPay order through the status API and applies the event. The checkout UI polls this endpoint after sending the USSD push, so subscriptions still activate when a webhook cannot reach the app (for example when `APP_URL` is localhost).
- The provider abstraction (`src/lib/billing/provider.ts`) maps HarakaPay orders to the internal subscription model. The app never handles raw card data.

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
