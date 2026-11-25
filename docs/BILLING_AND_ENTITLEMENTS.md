# Billing and Entitlements

- Live billing provider: Settlo Pay (mobile money) behind the `BillingProvider` abstraction
- Live billing requires `BILLING_LIVE_ENABLED=true` and either `BILLING_PROVIDER=settlopay` (real mobile-money payments) or `BILLING_PROVIDER=manual` with `BILLING_TEST_MODE=true` (test activation); checkout stays disabled while no provider is configured
- Mobile-money prompt checkout, signed webhooks reconciled against the provider status API
- Entitlements enforced server-side
- No card data stored

## Settlo Pay integration

- Checkout starts a mobile-money collection through `POST https://api.settlopay.co.tz/v1/payments` with the E.164 phone, a whole-TZS amount object, `merchant_reference` as the idempotency key, and `Settlo-Version: 2026-04-29`.
- The returned `pi_…` payment id is recorded on the billing event ledger (`BillingEvent.providerEventId`) together with the buyer context captured at checkout. The short `ref` is never stored.
- `POST /api/webhooks/settlopay` verifies the `Settlo-Signature` HMAC over the raw body with `SETTLO_WEBHOOK_SECRET`, ignores stale timestamps, deduplicates on `Settlo-Event-Id`, re-reads the payment by its `pi_…` id, and then applies the status idempotently. Succeeded payments grant the premium subscription; failed payments mark it unpaid.
- `POST /api/billing/confirm` re-reads an in-flight payment from the Settlo Pay status endpoint and applies the event. The checkout UI polls this endpoint after sending the mobile-money prompt, so subscriptions still activate when a webhook cannot reach the app.
- The provider abstraction (`src/lib/billing/provider.ts`) maps Settlo Pay states to the internal subscription model. The app never handles raw card data.

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
