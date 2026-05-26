// Types for the Webhooks CRUD resource. Mirrors `/v1/webhooks/*` endpoints.
//
// IMPORTANT: this is the management API (create / list / update / delete /
// test webhook endpoints). For verifying *incoming* webhook payloads from
// Sendflowly to your server, see the separate sub-path import:
//
//   import { verifyWebhook } from '@sendflowly/sdk/webhooks'
//
// The split is deliberate: webhook-receiver-only consumers (e.g., a tiny
// Cloudflare Worker that just validates inbound webhook payloads) can
// tree-shake away the entire HTTP client they don't need.
//
// Wire conventions match `domains`: snake_case input fields where the API's
// Zod validator does (`domain_ids`), camelCase output fields. Field-case
// fidelity to the API; no client-side normalization.

/**
 * Event types a webhook endpoint can subscribe to. Mirrors the API's
 * `WEBHOOK_EVENTS` constant, which equals `EMAIL_EVENT_TYPES`.
 *
 * Defined locally (not imported from `emails.types`) so webhook events can
 * evolve independently if the API ever adds webhook-specific events
 * (e.g., `endpoint.created`).
 */
export type WebhookEvent =
	| 'send'
	| 'delivery'
	| 'delivery_delay'
	| 'bounce'
	| 'complaint'
	| 'open'
	| 'click'
	| 'reject'
	| 'rendering_failure'
	| 'suppressed'
	// `(string & {})` preserves IDE autocomplete on the known events while accepting future additions
	| (string & {})

export type WebhookStatus = 'active' | 'inactive'

/** Argument to `sendflowly.webhooks.create()`. */
export interface CreateWebhookRequest {
	/** HTTPS URL Sendflowly will POST events to. Max 2048 chars. */
	url: string
	/** At least one event. Duplicates are deduped server-side. */
	events: WebhookEvent[]
	/**
	 * Restrict this webhook to events from specific sending domains. Omit
	 * (or pass `null`) for "all domains in the org". UUIDs as strings.
	 */
	domain_ids?: string[]
}

/**
 * Returned by `sendflowly.webhooks.create()` — **the only time the signing
 * secret is exposed**.
 *
 * Subsequent `get()` / `list()` calls do NOT include the `secret` field —
 * the API's Output DTO scrubs it. There is no re-reveal endpoint. Store
 * this value immediately (in your env config / secret manager) when the
 * promise resolves. If lost, delete the webhook and create a new one.
 *
 * (See security audit H8 — 2026-04-23.)
 */
export interface WebhookWithSecret {
	id: string
	url: string
	/** **One-time reveal.** HMAC signing key — feed this into `verifyWebhook()` on incoming requests. */
	secret: string
	events: string[]
	domainIds: string[] | null
	status: WebhookStatus
	/** ISO 8601 datetime. */
	createdAt: string
}

/** Standard webhook representation — NO secret field. Returned by `list()`, `get()`, `update()`. */
export interface Webhook {
	id: string
	url: string
	events: string[]
	domainIds: string[] | null
	status: WebhookStatus
	/** Count of consecutive delivery failures. Reset on successful delivery. `null` if never attempted. */
	failureCount: number | null
	/** ISO 8601 datetime of the most recent successful delivery. `null` until the first success. */
	lastDeliveredAt: string | null
	/** ISO 8601 datetime of the most recent failed delivery. `null` until the first failure. */
	lastFailedAt: string | null
	/** ISO 8601 datetime. */
	createdAt: string
}

/** Query parameters for `sendflowly.webhooks.list()`. */
export interface ListWebhooksQuery {
	/** 1-indexed page. Default 1. */
	page?: number
	/** Default 20, max 100. */
	page_size?: number
}

/** Body for `sendflowly.webhooks.update()`. All fields optional — pass only what you want to change. */
export interface UpdateWebhookRequest {
	url?: string
	events?: WebhookEvent[]
	status?: WebhookStatus
	/** Pass `null` explicitly to clear the domain filter (i.e., subscribe to all domains). */
	domain_ids?: string[] | null
}

/** Returned by `sendflowly.webhooks.delete()` — confirmation envelope. */
export interface WebhookDeleteResult {
	id: string
}

/** Returned by `sendflowly.webhooks.test()` — the result of attempting one synthetic delivery. */
export interface WebhookTestResult {
	/** Whether the test delivery returned a 2xx response from your endpoint. */
	success: boolean
	/** HTTP status code your endpoint returned. `null` if the request failed before getting a response (DNS error, timeout, etc.). */
	statusCode: number | null
	/** Total request duration in milliseconds. */
	duration: number
}
