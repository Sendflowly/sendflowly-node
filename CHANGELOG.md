# @sendflowly/sdk

## 0.1.0-beta.1

### Patch Changes

- b2998c8: Validate the CI publish path end-to-end.

  No code changes — this changeset exists solely to trigger `sdk-release.yml`'s
  publish step against an already-existing package on npm. The first publish
  (`0.1.0-beta.0`) was bootstrapped manually from a laptop because CI kept
  hitting a `404 Not Found` we couldn't pin down. The most likely cause was
  the create-package gate on npm (which doesn't apply to subsequent updates
  of an existing package); shipping `0.1.0-beta.1` from CI tests that hypothesis.

  If this publish succeeds: the bootstrap is no longer needed; all future
  Phase 2 work ships via CI. If it 404s again: regenerate the granular npm
  token being extra careful about the "Bypass 2FA" + "All packages" settings,
  or remove `id-token: write` from the workflow permissions.

## 0.1.0-beta.0

### Minor Changes

- 93cb1b8: Initial beta release of the official Sendflowly TypeScript SDK.

  **Highlights**
  - `Sendflowly` client class with typed `{ data, error, headers }` responses for every call — no try/catch needed for API-level errors.
  - `emails` resource covering all `/v1/emails/*` endpoints: `send`, `sendBatch`, `list`, `get`, `resend`, `downloadAttachment`. Recipient fields accept `string | string[]` and normalize before send.
  - Webhook signature verification via the sub-path import `@sendflowly/sdk/webhooks` — built on the Standard Webhooks reference implementation (`svix`). Tree-shakable: webhook-only consumers do not pay for the email client.
  - Server-only universal runtime support: Node ≥ 20, Bun, Deno, Cloudflare Workers, Vercel Edge. No browser build (API keys must never enter a frontend bundle).
  - Built-in retry policy for idempotent calls (GET/PUT/DELETE + POST with `idempotencyKey`) with `Retry-After` and full-jitter exponential backoff. POST without an idempotency key is never retried.
  - Dual ESM + CJS output, dual `.d.mts` + `.d.cts` declarations, npm provenance attestations on every publish.
