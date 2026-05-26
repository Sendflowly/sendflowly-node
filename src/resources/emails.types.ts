// Types for the Emails resource. Mirrors the wire shapes accepted/returned by
// the API's `/v1/emails/*` endpoints. Field names are snake_case to match the
// API verbatim — no normalization layer between the SDK and the wire.
//
// Canonical sources (kept in sync — see comment on each type):
//   - Request shapes:  packages/shared/src/validators/email.validator.ts
//   - Response shapes: apps/api/src/domains/emails/dto/*.dto.ts +
//                     packages/db/src/schema/email.schema.ts

/**
 * Status values an email can be in. Mirrors `EMAIL_STATUSES` in
 * `packages/shared/src/constants/email-events.ts`.
 */
export type EmailStatus =
	| 'queued'
	| 'scheduled'
	| 'sent'
	| 'delivered'
	| 'delivery_delayed'
	| 'bounced'
	| 'complained'
	| 'rejected'
	| 'canceled'
	| 'failed'

/**
 * Event types the API records against a sent email. Mirrors
 * `EMAIL_EVENT_TYPES` in shared.
 */
export type EmailEventType =
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

export interface Attachment {
	filename: string
	/** Base-64 encoded file content. The total of all attachments cannot exceed 10 MB. */
	content: string
	/** MIME type. Defaults to `application/octet-stream` if omitted. */
	content_type?: string
}

/**
 * Argument to `sendflowly.emails.send()`.
 *
 * Recipient fields (`to`, `cc`, `bcc`, `reply_to`) accept either a single
 * address string or an array — the SDK normalizes to an array before sending.
 * All other fields are passed to the API exactly as-is.
 */
export interface SendEmailRequest {
	/** Sender. Must be from a verified domain. e.g. `"Acme <noreply@yourdomain.com>"` or `noreply@yourdomain.com`. */
	from: string
	/** Recipient address(es). Up to 50 per email. */
	to: string | string[]
	cc?: string | string[]
	bcc?: string | string[]
	reply_to?: string | string[]
	subject?: string
	html?: string
	text?: string
	tags?: Record<string, string>
	attachments?: Attachment[]
	template_id?: string
	variables?: Record<string, string>
	/** RFC 2822 Message-ID for threading. Either bare (`id@host`) or angle-bracket (`<id@host>`) form. */
	in_reply_to?: string
	/** Whitespace-separated RFC 2822 Message-IDs. */
	references?: string
}

export interface SendEmailResponse {
	id: string
}

export interface SendEmailBatchRequest {
	emails: SendEmailRequest[]
	idempotency_key?: string
}

export interface BatchEmailResult {
	index: number
	id?: string
	error?: { code: string; message: string }
}

export interface SendEmailBatchResponse {
	results: BatchEmailResult[]
	succeeded: number
	failed: number
}

/** Query parameters for `sendflowly.emails.list()`. All optional. */
export interface ListEmailsQuery {
	/** 1-indexed page number. Default 1. */
	page?: number
	/** Default 20, max 100. */
	page_size?: number
	status?: EmailStatus
	api_key_id?: string
	from_domain?: string
	search?: string
	/** ISO 8601 datetime with offset. */
	date_from?: string
	/** ISO 8601 datetime with offset. */
	date_to?: string
}

export interface EmailListItem {
	id: string
	organization_id: string
	domain_id: string
	api_key_id: string | null
	ses_message_id: string | null
	from_address: string
	to_addresses: string[]
	cc_addresses: string[] | null
	bcc_addresses: string[] | null
	reply_to: string[] | null
	subject: string | null
	status: EmailStatus
	tags: Record<string, string> | null
	in_reply_to: string | null
	references: string | null
	conversation_id: string | null
	message_id_header: string | null
	created_at: string
	sent_at: string | null
	delivered_at: string | null
	/** Joined from the api_keys table. `null` for sends not tied to an API key. */
	api_key_name: string | null
	/** Count of attachments stored for this email. */
	attachment_count: number
}

export interface EmailEvent {
	id: string
	email_id: string
	event_type: EmailEventType
	bounce_type: string | null
	bounce_sub_type: string | null
	complaint_feedback_type: string | null
	diagnostic_code: string | null
	user_agent: string | null
	ip_address: string | null
	link_url: string | null
	timestamp: string
	created_at: string
}

/** Returned by `sendflowly.emails.get(id)` — includes the email body + event history. */
export interface EmailDetail extends EmailListItem {
	html_body: string | null
	text_body: string | null
	events: EmailEvent[]
}

export interface AttachmentDownloadUrl {
	/** Time-limited pre-signed S3 URL. Treat as opaque; do not log or persist. */
	url: string
}
