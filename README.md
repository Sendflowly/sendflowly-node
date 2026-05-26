# @sendflowly/sdk

Official TypeScript SDK for the [Sendflowly](https://sendflowly.com) email API.

```bash
pnpm add @sendflowly/sdk@beta
# or: npm i, yarn add, bun add
```

> 🧪 We're in beta. The surface may change between releases. Pin an exact
> version (`@sendflowly/sdk@0.1.0-beta.0`) for production until 1.0.

## Quickstart

```ts
import { Sendflowly } from '@sendflowly/sdk'

const sendflowly = new Sendflowly('sk_live_...')

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

Network errors (DNS, connection refused) come back the same way with synthetic codes (`NETWORK_ERROR`, `TIMEOUT_ERROR`) — only programming errors at construction (missing API key, invalid `baseUrl`) throw.

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

## Sending email

```ts
// Single email — recipient fields accept either a string or array
await sendflowly.emails.send({
  from: 'Acme <hi@yourdomain.com>',
  to: 'user@example.com',        // or ['a@example.com', 'b@example.com']
  cc: 'cc@example.com',
  bcc: ['bcc@example.com'],
  reply_to: 'support@yourdomain.com',
  subject: 'Welcome',
  html: '<p>Welcome!</p>',
  text: 'Welcome!',
  tags: { campaign: 'welcome-flow' },
  attachments: [{ filename: 'receipt.pdf', content: '<base64...>', content_type: 'application/pdf' }],
})

// With idempotency — safe to retry on the SDK side, the API deduplicates
await sendflowly.emails.send(payload, { idempotencyKey: `order-${orderId}` })

// Batch (up to 100 at a time)
await sendflowly.emails.sendBatch({
  emails: [/* SendEmailRequest, ... */],
})
```

## Reading emails

```ts
// List with pagination — pagination metadata is on the response object
const { data, error, pagination } = await sendflowly.emails.list({
  page: 1,
  page_size: 50,
  status: 'sent',
  date_from: '2026-01-01T00:00:00Z',
})

// Single email — includes body + event history
const detail = await sendflowly.emails.get('em_123')

// Resend a previously-sent email
const resent = await sendflowly.emails.resend('em_123', { idempotencyKey: 'resend-1' })

// Short-lived signed URL to download an attachment
const att = await sendflowly.emails.downloadAttachment('em_123', 'att_1')
```

## Verifying webhooks

Webhook verification ships as a separate sub-path so receiver-only consumers (e.g., a tiny Cloudflare Worker) tree-shake away the email client:

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
    // event is typed `unknown` — provide a generic for compile-time safety:
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

Signatures follow the [Standard Webhooks](https://www.standardwebhooks.com/) spec. Verification is delegated to the `svix` reference implementation — constant-time, audited, and used by Resend / Polar / Clerk / Cal.com.

## Configuration

```ts
new Sendflowly('sk_live_...', {
  baseUrl: 'https://api.sendflowly.com',  // override for self-hosted
  timeout: 30_000,                         // ms, default 30s
  maxRetries: 2,                           // 5xx + 429 + network errors, idempotent only
  fetch: globalThis.fetch,                 // override (testing, custom runtimes)
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

All request and response shapes are typed. Hover any method or option for IDE-level docs. Re-exported types:

```ts
import type {
  SendEmailRequest, SendEmailResponse,
  EmailListItem, EmailDetail,
  ListEmailsQuery, EmailStatus,
  PaginationMeta,
  SendflowlyError, SendflowlyResponse,
} from '@sendflowly/sdk'
```

## Links

- 📖 [Full documentation](https://docs.sendflowly.com/sdk) *(coming soon — M2.3)*
- 🔑 [Get an API key](https://app.sendflowly.com/api-keys)
- 🐛 [Report a bug](https://github.com/Sendflowly/sendflowly-node/issues)
- 💬 [Discussions](https://github.com/Sendflowly/sendflowly-node/discussions)

## License

[MIT](./LICENSE)
