# @sendflowly/sdk

## 0.1.0-beta.6

### Minor Changes

- 07f9ac7: Add the `analytics` resource — the final Phase 2 resource. SDK now covers all 6 v1 resources (emails, domains, webhooks, templates, suppressions, analytics).

  `sendflowly.analytics` exposes the two `/v1/analytics/*` endpoints:
  - `analytics.overview({ period?, domain_id? })` — aggregate counters + rates across the requested period (`'7d' | '15d' | '30d' | '90d'`, defaults to `'30d'`). Returns `AnalyticsOverview` with `sent`, `delivered`, `bounced`, `opened`, `clicked`, plus pre-computed `delivery_rate`, `bounce_rate`, `open_rate`, `click_rate`, etc. Rates are fractions (0.0-1.0), not percentages.
  - `analytics.daily({ from, to, domain_id? })` — per-day breakdown between two dates (ISO `YYYY-MM-DD` or full ISO datetime).

  **Important — meta envelope**: analytics responses include a `{ range }` meta field describing the actual date window the server used. The server may "clamp" your requested range to your plan's retention limit; check `meta.range.clamped` to detect this:

  ```ts
  const result = await sf.analytics.overview({ period: "90d" });
  if (result.error === null) {
    const meta = result.meta as AnalyticsResponseMeta | undefined;
    if (meta?.range.clamped) {
      console.warn(
        `Showing last ${meta.range.retention_days} days (plan retention limit)`,
      );
    }
  }
  ```

  **SDK infrastructure change**: `SendflowlyResponse<T>` now includes an optional `meta?: unknown` field on the success variant. Backward-compatible — endpoints that don't return meta in the API envelope produce responses without a `meta` field (the property is structurally absent, not undefined-stamped). Resource methods that DO use meta (currently only analytics) cast at the boundary to a typed shape.

  Also exports: `AnalyticsOverview`, `AnalyticsDailyPoint`, `AnalyticsRangeMeta`, `AnalyticsResponseMeta`, `AnalyticsPeriod`, plus the two query input types.

## 0.1.0-beta.5

### Minor Changes

- d866037: Add the `suppressions` resource. Fourth Phase 2 resource.

  `sendflowly.suppressions` exposes the five `/v1/suppressions/*` endpoints:
  - `suppressions.list({ page?, page_size?, search?, reason? })` — paginated listing with substring search + reason filter
  - `suppressions.add({ email_address, reason? })` — add a single address (reason defaults to `'manual'`)
  - `suppressions.bulkAdd({ suppressions: [...] })` — add up to 1000 entries at once; returns `{ created, duplicates }` counts (dedupes silently)
  - `suppressions.check(emailAddress)` — fast lookup; always returns `{ suppressed, reason }` (never 404s)
  - `suppressions.delete(id)` — remove from the list

  **Suppression reasons** are the closed set `'manual' | 'hard_bounce' | 'complaint'`. `hard_bounce` and `complaint` entries are added automatically by the API as bounce/complaint events arrive — you only need to manually `add()` for `'manual'` cases (e.g., user requested removal).

  Wire convention: snake_case throughout (input AND output) — same as `emails`, because suppression rows pass through from Drizzle to the wire without a DTO transform. `email_address`, `bounce_count`, `last_bounce_at`, `created_at` etc.

  Also exports: `Suppression`, `SuppressionReason`, `SuppressionCheckResult`, `BulkAddSuppressionsResult`, `SuppressionDeleteResult`, plus the three request/query input types.

## 0.1.0-beta.4

### Minor Changes

- 9d5d15e: Add the `templates` CRUD resource. Third Phase 2 resource.

  `sendflowly.templates` exposes the five `/v1/templates/*` endpoints:
  - `templates.create({ name, subject, html_body?, text_body?, variables?, designJson?, previewText? })`
  - `templates.list({ page?, page_size? })` — returns lightweight rows (omits body/design fields)
  - `templates.get(id)` — full detail including body + design + preview text
  - `templates.update(id, body)` — partial update
  - `templates.delete(id)` — returns `{ id }`

  **Variables are typed:** the SDK exposes the canonical `TemplateVariable[]` shape (`{ name, type, fallback? }`) where `type` is `'string' | 'number' | 'boolean' | 'url'`. Variables declared up-front get default values via the optional `fallback` field, used at send time when `sendflowly.emails.send()`'s `variables` map omits the key. The API also accepts a legacy `string[]` shape for backwards compat, but the SDK only exposes the new typed form.

  **Mixed input casing is intentional** (mirrors the API's validator exactly): `html_body` + `text_body` are snake_case (legacy), `designJson` + `previewText` are camelCase (newer additions). All response fields are camelCase. The SDK doesn't normalize — what you type matches what's on the wire matches what you read.

  **`designJson` is intentionally typed as `Record<string, unknown> | null`** — the API treats it as opaque JSONB owned by the dashboard's template builder. Pass whatever your builder emits; cast to your specific builder type if needed.

  Also exports: `Template`, `TemplateListItem`, `TemplateVariable`, `TemplateVariableType`, `TemplateDeleteResult`, plus the three request/query input types.

## 0.1.0-beta.3

### Minor Changes

- dce51db: Add the `webhooks` CRUD resource. Second Phase 2 resource shipped (after `domains`).

  `sendflowly.webhooks` exposes the six `/v1/webhooks/*` management endpoints:
  - `webhooks.create({ url, events, domain_ids? })` — create a new webhook endpoint. **The HMAC signing secret is returned ONCE in the response and never again** — store it immediately; there is no re-reveal endpoint. The SDK type `WebhookWithSecret` makes the one-time-only nature explicit (returned only by `create()`; subsequent reads return the `Webhook` type without the field).
  - `webhooks.list({ page?, page_size? })` — paginated listing; no secret in responses
  - `webhooks.get(id)` — fetch a single webhook by id
  - `webhooks.update(id, body)` — partial update; pass any subset of `url`, `events`, `status`, `domain_ids`. Passing `domain_ids: null` explicitly clears the domain filter.
  - `webhooks.delete(id)` — delete an endpoint
  - `webhooks.test(id)` — send a synthetic test event to the endpoint URL and report success / status code / duration

  This resource is the **management** API (configure webhook endpoints). For **verifying** incoming webhook payloads from Sendflowly to your server, use the separate sub-path import:

  ```ts
  import { verifyWebhook } from "@sendflowly/sdk/webhooks";
  ```

  The two surfaces are intentionally split so webhook-receiver-only consumers (e.g., a Cloudflare Worker that just validates inbound payloads) can tree-shake away the entire HTTP client.

  Also exports: `Webhook`, `WebhookWithSecret`, `WebhookEvent`, `WebhookStatus`, `WebhookTestResult`, `WebhookDeleteResult`, plus the four request/query input types.

## 0.1.0-beta.2

### Minor Changes

- d5389cc: Add the `domains` resource. The first Phase 2 expansion of the SDK surface.

  `sendflowly.domains` exposes all eight `/v1/domains/*` endpoints:
  - `domains.create({ domain, region, return_path?, tls_policy? })` — register a new sending domain; returns the DNS records you need to configure
  - `domains.list({ page?, page_size?, status? })` — paginated listing
  - `domains.get(id)` — full detail including DNS verification status, DMARC status, DNS records
  - `domains.verify(id)` — re-check DKIM/SPF after adding DNS records
  - `domains.verifyInboundMx(id)` — re-check the INBOUND MX record (for receiving)
  - `domains.updateTracking(id, { enabled })` — toggle click + open tracking
  - `domains.updateTlsPolicy(id, { tls_policy })` — switch between `opportunistic` and `enforced`
  - `domains.delete(id)` — remove a domain

  Field-case convention on this resource is camelCase for response fields (matching how the API's domain DTOs are serialized) and snake_case for input fields (`return_path`, `tls_policy`) — exactly mirroring the API's wire format. No client-side renaming or normalization.

  The `/v1/domains/:id/mailboxes` endpoint is intentionally deferred to a future
  `mailboxes` resource — it returns Mailbox-shaped data that doesn't belong to the
  domains-management surface.

  Also exports related types: `Domain`, `DomainWithDns`, `DomainDetail`,
  `DnsRecord`, `DnsProviderInfo`, `DmarcStatus`, `Region`, `TlsPolicy`,
  `DomainStatus`, and the four request/query input types.

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
