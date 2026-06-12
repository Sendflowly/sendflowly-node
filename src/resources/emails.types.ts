// Types for the Emails resource. Mirrors the wire shapes accepted/returned by
// the API's `/v1/emails/*` endpoints verbatim — no normalization layer
// between the SDK and the wire.
//
// Wire-case convention (the API is asymmetric, and the SDK mirrors it):
//   - REQUESTS (bodies + query params) are snake_case — they're parsed by
//     the API's Zod validators (`reply_to`, `page_size`, `api_key_id`).
//   - RESPONSES are camelCase — the API's Output DTOs return Drizzle
//     property names (`fromAddress`, `createdAt`, `attachmentCount`).
//
// Canonical sources (kept in sync — see comment on each type):
//   - Request shapes:  packages/shared/src/validators/email.validator.ts
//   - Response shapes: apps/api/src/domains/emails/dto/list-emails.dto.ts,
//                      get-email-detail.dto.ts, received-email.dto.ts

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

/**
 * One row from `sendflowly.emails.list()`. Mirrors the explicit column list
 * in `EmailRepository.listByOrg` — camelCase on the wire (see file header).
 */
export interface EmailListItem {
	id: string
	domainId: string
	apiKeyId: string | null
	/** Joined from the api_keys table. `null` for sends not tied to an API key. */
	apiKeyName: string | null
	/** AWS SES internal Message-ID — useful for cross-referencing SES console / CloudWatch. */
	sesMessageId: string | null
	fromAddress: string
	toAddresses: string[]
	ccAddresses: string[] | null
	bccAddresses: string[] | null
	replyTo: string[] | null
	subject: string | null
	status: EmailStatus
	tags: Record<string, string> | null
	/** ISO 8601 datetime. */
	createdAt: string
	sentAt: string | null
	deliveredAt: string | null
	/** Count of attachments stored for this email. */
	attachmentCount: number
}

/** One delivery-pipeline event in `EmailDetail.events`. */
export interface EmailEvent {
	id: string
	eventType: EmailEventType
	/** ISO 8601 datetime the event occurred (SES-reported). */
	timestamp: string
	bounceType: string | null
	bounceSubType: string | null
	diagnosticCode: string | null
	complaintFeedbackType: string | null
	ipAddress: string | null
	userAgent: string | null
	linkUrl: string | null
	/** ISO 8601 datetime the event was recorded. */
	createdAt: string
}

/** Attachment metadata in `EmailDetail.attachments`. */
export interface EmailDetailAttachment {
	id: string
	filename: string
	contentType: string
	/** Size in bytes. */
	size: number
}

/**
 * Returned by `sendflowly.emails.get(id)` — full body + event history +
 * attachment metadata.
 *
 * Deliberately NOT an extension of {@link EmailListItem}: the API's detail
 * DTO is a different projection (it omits `sesMessageId` / `apiKeyName` /
 * `attachmentCount` and adds body, threading headers, events, attachments).
 */
export interface EmailDetail {
	id: string
	fromAddress: string
	toAddresses: string[]
	ccAddresses: string[] | null
	bccAddresses: string[] | null
	replyTo: string[] | null
	subject: string | null
	status: EmailStatus
	htmlBody: string | null
	textBody: string | null
	apiKeyId: string | null
	domainId: string
	/** RFC 822 In-Reply-To header value, when the send threaded a reply. */
	inReplyTo: string | null
	/** RFC 822 References header value (space-separated message-ids, raw). */
	references: string | null
	tags: Record<string, string> | null
	sentAt: string | null
	deliveredAt: string | null
	createdAt: string
	events: EmailEvent[]
	attachments: EmailDetailAttachment[]
}

export interface AttachmentDownloadUrl {
	/** Time-limited pre-signed S3 URL. Treat as opaque; do not log or persist. */
	url: string
}

// ── Received (inbound) emails ────────────────────────────────────────────
// NOTE: these fields are camelCase because the API's received-email DTOs
// return camelCase verbatim (apps/api/src/domains/emails/dto/received-email.dto.ts).

export type ListReceivedEmailsQuery = {
	page?: number
	page_size?: number
	/** Narrow to one mailbox. Omit for all inbound across the org. */
	mailbox_id?: string
}

/** One row from `sendflowly.emails.listReceived()`. */
export interface ReceivedEmailListItem {
	id: string
	mailboxId: string
	fromAddress: string
	fromName: string | null
	toAddresses: string[]
	ccAddresses: string[] | null
	subject: string | null
	snippet: string | null
	/** RFC 822 Message-ID header. */
	messageId: string
	spamVerdict: string | null
	virusVerdict: string | null
	spfVerdict: string | null
	dkimVerdict: string | null
	dmarcVerdict: string | null
	sizeBytes: number
	attachmentCount: number
	receivedAt: string
}

export interface ReceivedEmailAttachment {
	id: string
	filename: string
	contentType: string
	sizeBytes: number
	/** Content-ID for inline (cid:) images; null for regular attachments. */
	contentId: string | null
}

/** Returned by `sendflowly.emails.getReceived(id)` — full content + attachments. */
export interface ReceivedEmailDetail extends Omit<ReceivedEmailListItem, 'attachmentCount'> {
	textBody: string | null
	htmlBody: string | null
	inReplyTo: string | null
	references: string[] | null
	attachments: ReceivedEmailAttachment[]
}

export interface ReceivedAttachmentDownloadUrl {
	/** Time-limited pre-signed S3 URL. Treat as opaque; do not log or persist. */
	url: string
	filename: string
}
