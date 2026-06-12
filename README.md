# @sendflowly/sdk

Official TypeScript SDK for the [Sendflowly](https://sendflowly.com) email API.

```bash
pnpm add @sendflowly/sdk@beta
# or: npm i / yarn add / bun add
```

> 🧪 **Beta**. Surface may change between minor releases. Pin a specific
> version (`@sendflowly/sdk@0.1.0-beta.6`) for production until `1.0`.

---

## Quickstart

```ts
import { Sendflowly } from '@sendflowly/sdk'

const sendflowly = new Sendflowly(process.env.SENDFLOWLY_API_KEY!)

const { data, error } = await sendflowly.emails.send({
  from: 'hi@yourdomain.com',
  to: 'user@example.com',
  subject: 'Hello',
  html: '<p>Hi from Sendflowly</p>',
})

if (error) {
  // error is fully typed: { code, message, statusCode, requestId }
  console.error(`[${error.requestId}] ${error.code}: ${error.message}`)
  return
}

console.log(`Sent: ${data.id}`)
```

## Why `{ data, error }`

Every SDK call returns a discriminated union — exactly one of `data` or `error` is non-null on every response. TypeScript narrows the type after `if (error)`, so you never need `data!` or `try/catch` to handle API-level errors (4xx, 5xx, rate limits).

Network errors (DNS, connection refused, timeouts) come back the same way with synthetic codes (`NETWORK_ERROR`, `TIMEOUT_ERROR`) — only programming errors at construction (missing API key, invalid `baseUrl`) throw.

## Supported runtimes

Server-side only. Verified against:

| Runtime | Minimum |
|---|---|
| Node.js | 20 |
| Bun | 1.x |
| Deno | 1.40+ |
| Cloudflare Workers | latest |
| Vercel Edge | latest |

**No browser build.** Your API key must never enter a frontend bundle — if you need to send email from a user-facing app, send the request from your server and let this SDK handle it.

---

## Resources

The SDK covers all `/v1/*` endpoints. Six resources accessible via `sendflowly.<name>`:

| Resource | Methods |
|---|---|
| [`emails`](#emails) | send, sendBatch, list, get, resend, downloadAttachment |
| [`domains`](#domains) | create, list, get, verify, verifyInboundMx, updateTracking, updateTlsPolicy, delete |
| [`webhooks`](#webhooks-management) | create, list, get, update, delete, test |
| [`templates`](#templates) | create, list, get, update, delete |
| [`suppressions`](#suppressions) | list, add, bulkAdd, check, delete |
| [`analytics`](#analytics) | overview, daily |

Plus a tree-shakable [webhook signature verifier](#verifying-incoming-webhooks) at `@sendflowly/sdk/webhooks`.

---

## Emails

```ts
// Single send — recipient fields accept string OR string[]
const { data, error } = await sendflowly.emails.send({
  from: 'Acme <hi@yourdomain.com>',
  to: 'user@example.com',
  cc: ['cc@example.com'],
  bcc: 'bcc@example.com',
  reply_to: 'support@yourdomain.com',
  subject: 'Welcome',
  html: '<p>Welcome!</p>',
  text: 'Welcome!',
  tags: { campaign: 'welcome-flow' },
  attachments: [
    { filename: 'receipt.pdf', content: '<base64>', content_type: 'application/pdf' },
  ],
})

// Idempotency — safe to retry; the API deduplicates
await sendflowly.emails.send(payload, { idempotencyKey: `order-${orderId}` })

// Batch — up to 100 per call
await sendflowly.emails.sendBatch({ emails: [/* ... */] })

// Read
const list = await sendflowly.emails.list({ page: 1, page_size: 50, status: 'sent' })
const detail = await sendflowly.emails.get('em_123')      // body + events
const resent = await sendflowly.emails.resend('em_123', { idempotencyKey: 'resend-1' })
const att = await sendflowly.emails.downloadAttachment('em_123', 'att_1')

// Received (inbound) — pair with an `email.received` webhook subscription.
// The webhook delivers metadata only; fetch content with these:
const inbox = await sendflowly.emails.listReceived({ page: 1 })
const msg = await sendflowly.emails.getReceived('inb_123')             // text/html body + verdicts
const atts = await sendflowly.emails.listReceivedAttachments('inb_123')
const file = await sendflowly.emails.downloadReceivedAttachment('inb_123', 'att_1')
```

## Domains

```ts
// Create — response includes the DNS records you need to add at your registrar
const { data } = await sendflowly.domains.create({
  domain: 'mail.example.com',
  region: 'eu-central-1',
  return_path: 'bounces',         // optional, defaults to 'mail'
  tls_policy: 'opportunistic',     // or 'enforced'
})
if (data) {
  for (const rec of data.dnsRecords) {
    console.log(`${rec.type} ${rec.name} → ${rec.value} (${rec.purpose})`)
  }
}

await sendflowly.domains.list({ status: 'verified' })
await sendflowly.domains.get('dom_xxx')                            // full detail + DMARC status

// Re-check DNS after you've added the records
await sendflowly.domains.verify('dom_xxx')
await sendflowly.domains.verifyInboundMx('dom_xxx')                // separate gate for inbound

// Tracking + TLS toggle
await sendflowly.domains.updateTracking('dom_xxx', { enabled: true })
await sendflowly.domains.updateTlsPolicy('dom_xxx', { tls_policy: 'enforced' })

await sendflowly.domains.delete('dom_xxx')
```

## Webhooks management

```ts
// Create — secret is returned ONCE, save it immediately
const { data } = await sendflowly.webhooks.create({
  url: 'https://your-app.com/webhooks/sendflowly',
  events: ['delivery', 'bounce', 'complaint'],
  domain_ids: ['dom_xxx'],          // optional — scope to specific domains
})
if (data) {
  await secretManager.store('SENDFLOWLY_WEBHOOK_SECRET', data.secret)
  console.log(`Webhook ${data.id} created`)
}

await sendflowly.webhooks.list()
await sendflowly.webhooks.get('wh_xxx')

// Partial update — pass only what changes. domain_ids: null clears the filter.
await sendflowly.webhooks.update('wh_xxx', { status: 'inactive' })
await sendflowly.webhooks.update('wh_xxx', { domain_ids: null })

// Synthetic delivery to test the endpoint
const { data: result } = await sendflowly.webhooks.test('wh_xxx')
console.log(`success=${result?.success} status=${result?.statusCode} ${result?.duration}ms`)

await sendflowly.webhooks.delete('wh_xxx')
```

> Webhook CRUD and webhook signature verification are intentionally split.
> See [Verifying incoming webhooks](#verifying-incoming-webhooks) below for
> the verifier sub-path.

## Templates

```ts
// Templates support {{ variable_name }} substitution with declared types + fallbacks
const { data } = await sendflowly.templates.create({
  name: 'Welcome',
  subject: 'Welcome to {{ company_name }}, {{ first_name }}!',
  html_body: '<p>Hi {{ first_name }}. Thanks for joining {{ company_name }}.</p>',
  variables: [
    { name: 'first_name',  type: 'string' },
    { name: 'company_name', type: 'string', fallback: 'our app' },
  ],
  // Optional: builder state for the visual editor + inbox preview line
  designJson: { /* opaque — owned by the dashboard builder */ },
  previewText: 'Glad to have you on board.',
})

// Use in a send — fallbacks apply when variables are missing from the request
await sendflowly.emails.send({
  from: 'hi@yourdomain.com',
  to: 'user@example.com',
  template_id: data!.id,
  variables: { first_name: 'Alex' },  // company_name uses fallback
})

// Browse + edit
await sendflowly.templates.list()                                  // lightweight rows (no body)
await sendflowly.templates.get('tpl_xxx')                          // full detail
await sendflowly.templates.update('tpl_xxx', { subject: 'New subject' })
await sendflowly.templates.delete('tpl_xxx')
```

## Suppressions

The suppression list is your org's per-recipient block list. Sends to suppressed addresses are silently dropped at submission time. Hard bounces + complaints are added automatically; you only need to manually `add()` user-requested removals.

```ts
// Single add (reason defaults to 'manual')
await sendflowly.suppressions.add({ email_address: 'user@example.com' })

// Bulk import — up to 1000 per call. Duplicates are silently deduped.
const { data } = await sendflowly.suppressions.bulkAdd({
  suppressions: oldBlockList.map((email) => ({ email_address: email })),
})
console.log(`Added ${data?.created}, skipped ${data?.duplicates}`)

// Fast lookup — never 404s
const { data: status } = await sendflowly.suppressions.check('someone@example.com')
if (status?.suppressed) {
  console.log(`Suppressed because: ${status.reason}`)  // 'manual' | 'hard_bounce' | 'complaint'
}

await sendflowly.suppressions.list({ reason: 'hard_bounce', page_size: 100 })
await sendflowly.suppressions.delete('sup_xxx')
```

## Analytics

Read-only stats. Both methods include a `meta.range` field describing the actual date window the server used — check `meta.range.clamped` to detect when plan retention narrowed your request.

```ts
import type { AnalyticsResponseMeta } from '@sendflowly/sdk'

// Aggregate stats for the period (defaults to '30d')
const result = await sendflowly.analytics.overview({ period: '30d' })
if (result.error === null) {
  const { sent, delivered, delivery_rate, open_rate, click_rate } = result.data
  console.log(`Sent ${sent} / ${(delivery_rate * 100).toFixed(1)}% delivered`)
  console.log(`Opens ${(open_rate * 100).toFixed(1)}%, clicks ${(click_rate * 100).toFixed(1)}%`)

  // Detect plan-retention clamping
  const meta = result.meta as AnalyticsResponseMeta | undefined
  if (meta?.range.clamped) {
    console.warn(`Showing last ${meta.range.retention_days} days only`)
  }
}

// Per-day breakdown
const { data } = await sendflowly.analytics.daily({
  from: '2026-05-01',
  to: '2026-05-26',
  domain_id: 'dom_xxx',        // optional scope
})
for (const day of data ?? []) {
  console.log(`${day.date}: ${day.sent} sent, ${day.delivered} delivered, ${day.bounced} bounced`)
}
```

Rates are pre-computed fractions (`0.0`-`1.0`), not percentages. Multiply by 100 to display.

---

## Verifying incoming webhooks

Webhook signature verification ships as a separate sub-path so receiver-only consumers (e.g., a tiny Cloudflare Worker that just validates inbound payloads) tree-shake away the entire HTTP client.

```ts
import { verifyWebhook, WebhookVerificationError } from '@sendflowly/sdk/webhooks'

export async function handler(request: Request) {
  const payload = await request.text() // raw bytes — do NOT pre-parse JSON

  try {
    const event = verifyWebhook({
      payload,
      headers: request.headers,
      secret: process.env.SENDFLOWLY_WEBHOOK_SECRET!,
    })
    // event is `unknown` by default — narrow with a generic for safety:
    //   verifyWebhook<MyEventUnion>({ ... })
    await handle(event)
    return new Response('ok')
  } catch (err) {
    if (err instanceof WebhookVerificationError) {
      return new Response('invalid signature', { status: 400 })
    }
    throw err
  }
}
```

Signatures follow the [Standard Webhooks](https://www.standardwebhooks.com/) spec. Verification is delegated to the `svix` reference implementation — constant-time, audited, used in production by Resend / Polar / Clerk / Cal.com.

---

## Configuration

```ts
new Sendflowly('sk_live_...', {
  baseUrl: 'https://api.sendflowly.com',  // override for self-hosted
  timeout: 30_000,                         // ms, default 30s
  maxRetries: 2,                           // 5xx + 429 + network errors, idempotent only
  fetch: globalThis.fetch,                 // override for testing / custom runtimes
  userAgent: 'my-app/1.0',                 // appended to default SDK UA
})
```

**Retry policy.** The SDK retries on 5xx, 429, and network errors — but **only** for idempotent calls (GET / PUT / DELETE, and POST when `idempotencyKey` is supplied). POST without an idempotency key is never retried regardless of `maxRetries`. Honors `Retry-After`.

## Error codes

The `error.code` field is one of:

- **Standard API codes**: `VALIDATION_ERROR`, `UNAUTHORIZED`, `FORBIDDEN`, `NOT_FOUND`, `CONFLICT`, `RATE_LIMITED`, `INTERNAL_ERROR`
- **SDK-synthetic codes**: `NETWORK_ERROR`, `TIMEOUT_ERROR`
- **Domain-specific codes** the API may emit (e.g., `SES_SEND_FAILED`, `BILLING_NOT_CONFIGURED`) — passed through as strings

Quote `error.requestId` in support tickets.

## Type safety

All request and response shapes are typed. Hover any method or option for IDE-level docs. Re-exported types you can import directly:

```ts
import type {
  // Core
  SendflowlyResponse, SendflowlyError, SendflowlyErrorCode, PaginationMeta,
  // Emails
  SendEmailRequest, SendEmailResponse, EmailListItem, EmailDetail,
  ListEmailsQuery, EmailStatus, EmailEventType,
  // Domains
  Domain, DomainDetail, DomainWithDns, DnsRecord, ListDomainsQuery,
  CreateDomainRequest, UpdateTrackingRequest, UpdateTlsPolicyRequest,
  Region, TlsPolicy, DomainStatus,
  // Webhooks (management)
  Webhook, WebhookWithSecret, WebhookEvent, WebhookStatus, WebhookTestResult,
  CreateWebhookRequest, UpdateWebhookRequest, ListWebhooksQuery,
  // Templates
  Template, TemplateListItem, TemplateVariable, TemplateVariableType,
  CreateTemplateRequest, UpdateTemplateRequest, ListTemplatesQuery,
  // Suppressions
  Suppression, SuppressionReason, SuppressionCheckResult,
  AddSuppressionRequest, BulkAddSuppressionsRequest, BulkAddSuppressionsResult,
  ListSuppressionsQuery,
  // Analytics
  AnalyticsOverview, AnalyticsDailyPoint, AnalyticsPeriod,
  AnalyticsRangeMeta, AnalyticsResponseMeta,
  AnalyticsOverviewQuery, AnalyticsDailyQuery,
} from '@sendflowly/sdk'
```

## Links

- 📖 [Full documentation](https://docs.sendflowly.com/sdk) *(coming soon — M2.3)*
- 🔑 [Get an API key](https://app.sendflowly.com/api-keys)
- 🐛 [Report a bug](https://github.com/Sendflowly/sendflowly-node/issues)
- 💬 [Discussions](https://github.com/Sendflowly/sendflowly-node/discussions)

## License

[MIT](./LICENSE)
