# Billing and Entitlements

- Live billing disabled by default
- Stripe/other providers only enabled after explicit approval
- Hosted checkout, webhook signature verification
- Entitlements enforced server-side
- No card data stored

## Free preview

- `UserFreePreview` stores at most one record per user (`userId` is unique).
- A free, non-demo account may consume one saved prediction preview. The claim is attached only
  after the slip is persisted, so a failed model response does not burn the preview.
- `GET|POST /api/free-preview/claim` reports or records the claim; a used account receives `409`
  when it tries to claim again.
- Demo mode is unlimited for review. Premium and admin accounts are unlimited.
- `POST /api/predictions/build` returns `402` with `FREE_PREVIEW_USED` when a free account has no
  preview left. Entitlement checks never trust client-supplied flags.
