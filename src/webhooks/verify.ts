import { Webhook, WebhookVerificationError } from 'svix'

/**
 * Options for {@link verifyWebhook}.
 */
export interface VerifyWebhookOptions {
	/**
	 * Raw request body as a string. **Must be the exact bytes the server signed**
	 * — do NOT pre-parse or re-stringify JSON. If your framework gave you a
	 * parsed object, you cannot verify; route the body as text or buffer.
	 */
	payload: string
	/**
	 * Webhook headers. Accepts either:
	 * - A Web `Headers` instance (from `Request.headers`, `c.req.raw.headers`, etc.)
	 * - A plain `Record<string, string | string[] | undefined>` (Node `IncomingMessage.headers`, etc.)
	 *
	 * The verifier looks for the Standard Webhooks header set first
	 * (`svix-id`, `svix-timestamp`, `svix-signature`) and falls back to the
	 * alternate `webhook-*` naming convention.
	 */
	headers: Headers | Record<string, string | string[] | undefined>
	/**
	 * Endpoint secret from the Sendflowly dashboard. Typically prefixed
	 * `whsec_…`. Treat as confidential — never log or expose to client code.
	 */
	secret: string
}

/**
 * Verify a Sendflowly webhook signature and return the parsed event payload.
 *
 * Throws `WebhookVerificationError` (re-exported from this module) when the
 * signature does not match, the timestamp is outside the tolerance window
 * (~5 minutes by default per Standard Webhooks spec), or the headers are
 * missing/malformed.
 *
 * @example
 * ```ts
 * import { verifyWebhook, WebhookVerificationError } from '@sendflowly/sdk/webhooks'
 *
 * app.post('/webhooks/sendflowly', async (req) => {
 *   const payload = await req.text() // raw bytes, NOT pre-parsed JSON
 *   try {
 *     const event = verifyWebhook({
 *       payload,
 *       headers: req.headers,
 *       secret: process.env.SENDFLOWLY_WEBHOOK_SECRET!,
 *     })
 *     // event is typed `unknown` by default — narrow with a generic for safety:
 *     //   const event = verifyWebhook<MyEventUnion>({ ... })
 *     await handle(event)
 *     return new Response('ok')
 *   } catch (err) {
 *     if (err instanceof WebhookVerificationError) {
 *       return new Response('invalid signature', { status: 400 })
 *     }
 *     throw err
 *   }
 * })
 * ```
 *
 * @typeParam TPayload - The expected shape of the parsed event payload. Defaults to `unknown`.
 *                       Provide a discriminated union of your event types for compile-time safety.
 */
export function verifyWebhook<TPayload = unknown>(options: VerifyWebhookOptions): TPayload {
	const svixHeaders = extractSvixHeaders(options.headers)
	const webhook = new Webhook(options.secret)
	return webhook.verify(options.payload, svixHeaders) as TPayload
}

interface SvixHeaders {
	'svix-id': string
	'svix-timestamp': string
	'svix-signature': string
}

function extractSvixHeaders(input: VerifyWebhookOptions['headers']): SvixHeaders {
	const get = (key: string): string | null => {
		if (input instanceof Headers) {
			return input.get(key)
		}
		const value = input[key]
		if (Array.isArray(value)) return value[0] ?? null
		if (typeof value === 'string') return value
		return null
	}

	const id = get('svix-id') ?? get('webhook-id')
	const timestamp = get('svix-timestamp') ?? get('webhook-timestamp')
	const signature = get('svix-signature') ?? get('webhook-signature')

	if (!id || !timestamp || !signature) {
		throw new WebhookVerificationError(
			'Missing required webhook headers. Expected svix-id (or webhook-id), svix-timestamp, svix-signature.',
		)
	}

	return {
		'svix-id': id,
		'svix-timestamp': timestamp,
		'svix-signature': signature,
	}
}

export { WebhookVerificationError } from 'svix'
