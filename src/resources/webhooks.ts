import type { Sendflowly } from '../client'
import type { SendflowlyResponse } from '../types/response'
import type {
	CreateWebhookRequest,
	ListWebhooksQuery,
	UpdateWebhookRequest,
	Webhook,
	WebhookDeleteResult,
	WebhookTestResult,
	WebhookWithSecret,
} from './webhooks.types'

/**
 * Webhooks CRUD resource — wraps `/v1/webhooks/*` endpoints.
 *
 * Access via `sendflowly.webhooks`. Do not instantiate directly.
 *
 * This is the **management** API: create, list, update, delete, test
 * webhook endpoints registered on your org. For **verifying** incoming
 * webhook payloads from Sendflowly to your server, see the separate
 * sub-path import:
 *
 * ```ts
 * import { verifyWebhook } from '@sendflowly/sdk/webhooks'
 * ```
 *
 * The two surfaces are intentionally split so webhook-receiver-only
 * consumers can tree-shake away the HTTP client they don't need.
 */
export class Webhooks {
	constructor(private readonly client: Sendflowly) {}

	/**
	 * Create a new webhook endpoint.
	 *
	 * **The HMAC signing secret is returned in `data.secret` and is the
	 * ONLY time it's exposed.** Store it immediately in your env config /
	 * secret manager — there's no re-reveal endpoint. Subsequent `get()`
	 * and `list()` calls omit the secret field by design.
	 *
	 * @example
	 * ```ts
	 * const { data, error } = await sendflowly.webhooks.create({
	 *   url: 'https://example.com/webhooks/sendflowly',
	 *   events: ['email.sent', 'email.bounced'],
	 * })
	 * if (data) {
	 *   await saveToSecretManager('SENDFLOWLY_WEBHOOK_SECRET', data.secret)
	 *   console.log('Webhook id:', data.id)
	 * }
	 * ```
	 */
	create(payload: CreateWebhookRequest): Promise<SendflowlyResponse<WebhookWithSecret>> {
		return this.client.post<WebhookWithSecret>('/v1/webhooks', payload)
	}

	/**
	 * List webhook endpoints for the authenticated organization.
	 * Paginated. Each item omits the secret (use the value captured at creation).
	 */
	list(query: ListWebhooksQuery = {}): Promise<SendflowlyResponse<Webhook[]>> {
		// Cast: `ListWebhooksQuery`'s named fields don't structurally match
		// `Record<string, primitive | undefined | null>` under `exactOptionalPropertyTypes`.
		return this.client.get<Webhook[]>('/v1/webhooks', {
			query: query as Record<string, string | number | boolean | undefined | null>,
		})
	}

	/** Get a single webhook by id. The secret is NOT included — use the value captured at creation. */
	get(id: string): Promise<SendflowlyResponse<Webhook>> {
		return this.client.get<Webhook>(`/v1/webhooks/${encodeURIComponent(id)}`)
	}

	/**
	 * Update one or more fields of a webhook endpoint. Pass only the fields
	 * you want to change. Passing `domain_ids: null` explicitly clears the
	 * domain filter (i.e., re-subscribes to all domains in the org).
	 */
	update(id: string, body: UpdateWebhookRequest): Promise<SendflowlyResponse<Webhook>> {
		return this.client.patch<Webhook>(`/v1/webhooks/${encodeURIComponent(id)}`, body)
	}

	/**
	 * Delete a webhook endpoint. Pending deliveries in flight may still
	 * attempt the URL; no new events are queued.
	 */
	delete(id: string): Promise<SendflowlyResponse<WebhookDeleteResult>> {
		return this.client.delete<WebhookDeleteResult>(`/v1/webhooks/${encodeURIComponent(id)}`)
	}

	/**
	 * Send a synthetic test event to the webhook URL. Returns the response
	 * status code, duration, and a success flag (true for 2xx).
	 *
	 * Useful for verifying the endpoint is reachable + your signature
	 * verification logic accepts our test payload — without waiting for a
	 * real email event to fire.
	 */
	test(id: string): Promise<SendflowlyResponse<WebhookTestResult>> {
		return this.client.post<WebhookTestResult>(`/v1/webhooks/${encodeURIComponent(id)}/test`)
	}
}
