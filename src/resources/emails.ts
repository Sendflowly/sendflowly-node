import type { Sendflowly } from '../client'
import type { SendflowlyResponse } from '../types/response'
import type {
	AttachmentDownloadUrl,
	EmailDetail,
	EmailListItem,
	ListEmailsQuery,
	ListReceivedEmailsQuery,
	ReceivedAttachmentDownloadUrl,
	ReceivedEmailAttachment,
	ReceivedEmailDetail,
	ReceivedEmailListItem,
	SendEmailBatchRequest,
	SendEmailBatchResponse,
	SendEmailRequest,
	SendEmailResponse,
} from './emails.types'

/** Per-call options for email send operations. */
export interface SendOptions {
	/**
	 * Sent as the `Idempotency-Key` header. Required for the SDK to safely
	 * retry a `POST /v1/emails` request — without it, this method is never
	 * retried even on 5xx (would risk double-sends).
	 */
	idempotencyKey?: string
}

/**
 * Emails resource — wraps `/v1/emails/*` endpoints.
 *
 * Access via `sendflowly.emails`. Do not instantiate directly.
 */
export class Emails {
	constructor(private readonly client: Sendflowly) {}

	/**
	 * Send a single email. Returns `{ data: { id }, error: null }` on success.
	 *
	 * @example
	 * ```ts
	 * const { data, error } = await sendflowly.emails.send(
	 *   { from: 'hi@yourdomain.com', to: 'user@example.com', subject: 'Hello', html: '<p>Hi</p>' },
	 *   { idempotencyKey: 'order-1234' },
	 * )
	 * ```
	 */
	send(
		payload: SendEmailRequest,
		options: SendOptions = {},
	): Promise<SendflowlyResponse<SendEmailResponse>> {
		return this.client.post<SendEmailResponse>('/v1/emails', normalizeRecipients(payload), {
			...(options.idempotencyKey !== undefined ? { idempotencyKey: options.idempotencyKey } : {}),
		})
	}

	/**
	 * Send up to 100 emails in a single request. Each email is processed
	 * independently — partial failures are reported in the response's `results`
	 * array; the call itself succeeds with HTTP 200.
	 */
	sendBatch(
		payload: SendEmailBatchRequest,
		options: SendOptions = {},
	): Promise<SendflowlyResponse<SendEmailBatchResponse>> {
		const body: SendEmailBatchRequest = {
			...payload,
			emails: payload.emails.map(normalizeRecipients),
		}
		return this.client.post<SendEmailBatchResponse>('/v1/emails/batch', body, {
			...(options.idempotencyKey !== undefined ? { idempotencyKey: options.idempotencyKey } : {}),
		})
	}

	/**
	 * List emails for the authenticated organization. Paginated; the response
	 * includes a `pagination` field alongside `data`.
	 */
	list(query: ListEmailsQuery = {}): Promise<SendflowlyResponse<EmailListItem[]>> {
		// Cast: `ListEmailsQuery`'s named fields don't structurally match
		// `Record<string, primitive | undefined | null>` under `exactOptionalPropertyTypes`.
		// The runtime shape is identical — just satisfying the type system.
		return this.client.get<EmailListItem[]>('/v1/emails', {
			query: query as Record<string, string | number | boolean | undefined | null>,
		})
	}

	/** Get a single email by id, including body + event history. */
	get(id: string): Promise<SendflowlyResponse<EmailDetail>> {
		return this.client.get<EmailDetail>(`/v1/emails/${encodeURIComponent(id)}`)
	}

	/**
	 * Re-send a previously-sent email. Returns the id of the new email.
	 * This is `POST /v1/emails/:id/resend` and the server treats each call as
	 * a fresh send — pass `idempotencyKey` to make it safe to retry on the SDK side.
	 */
	resend(id: string, options: SendOptions = {}): Promise<SendflowlyResponse<SendEmailResponse>> {
		return this.client.post<SendEmailResponse>(
			`/v1/emails/${encodeURIComponent(id)}/resend`,
			undefined,
			{
				...(options.idempotencyKey !== undefined ? { idempotencyKey: options.idempotencyKey } : {}),
			},
		)
	}

	/**
	 * Get a time-limited pre-signed URL to download an attachment. The URL is
	 * opaque and short-lived — fetch it immediately; do not log or persist.
	 */
	downloadAttachment(
		emailId: string,
		attachmentId: string,
	): Promise<SendflowlyResponse<AttachmentDownloadUrl>> {
		return this.client.get<AttachmentDownloadUrl>(
			`/v1/emails/${encodeURIComponent(emailId)}/attachments/${encodeURIComponent(
				attachmentId,
			)}/download`,
		)
	}

	// ── Received (inbound) emails ─────────────────────────────────────────
	// The `email.received` webhook delivers metadata only; these methods are
	// how you fetch the content afterwards.

	/**
	 * List received (inbound) emails across the organization. Paginated.
	 * Pass `mailbox_id` to narrow to a single receiving mailbox.
	 *
	 * @example
	 * ```ts
	 * const { data } = await sendflowly.emails.listReceived({ page: 1 })
	 * ```
	 */
	listReceived(
		query: ListReceivedEmailsQuery = {},
	): Promise<SendflowlyResponse<ReceivedEmailListItem[]>> {
		return this.client.get<ReceivedEmailListItem[]>('/v1/emails/received', {
			query: query as Record<string, string | number | boolean | undefined | null>,
		})
	}

	/**
	 * Get one received email by id — full body (text + html), threading
	 * headers, verdicts, and attachment metadata. Typically called with the
	 * `email_id` from an `email.received` webhook payload.
	 */
	getReceived(id: string): Promise<SendflowlyResponse<ReceivedEmailDetail>> {
		return this.client.get<ReceivedEmailDetail>(`/v1/emails/received/${encodeURIComponent(id)}`)
	}

	/** List attachment metadata for a received email (no content). */
	listReceivedAttachments(id: string): Promise<SendflowlyResponse<ReceivedEmailAttachment[]>> {
		return this.client.get<ReceivedEmailAttachment[]>(
			`/v1/emails/received/${encodeURIComponent(id)}/attachments`,
		)
	}

	/**
	 * Get a time-limited pre-signed URL to download one attachment of a
	 * received email. The URL is opaque and short-lived — fetch it
	 * immediately; do not log or persist.
	 */
	downloadReceivedAttachment(
		emailId: string,
		attachmentId: string,
	): Promise<SendflowlyResponse<ReceivedAttachmentDownloadUrl>> {
		return this.client.get<ReceivedAttachmentDownloadUrl>(
			`/v1/emails/received/${encodeURIComponent(emailId)}/attachments/${encodeURIComponent(
				attachmentId,
			)}/download`,
		)
	}
}

/**
 * Normalize recipient fields (`to`, `cc`, `bcc`, `reply_to`) from
 * `string | string[]` to `string[]`. The API requires arrays; this is the
 * SDK's one ergonomic deviation from the wire format.
 */
function normalizeRecipients(req: SendEmailRequest): SendEmailRequest {
	const out: SendEmailRequest = { ...req, to: toArray(req.to) }
	if (req.cc !== undefined) out.cc = toArray(req.cc)
	if (req.bcc !== undefined) out.bcc = toArray(req.bcc)
	if (req.reply_to !== undefined) out.reply_to = toArray(req.reply_to)
	return out
}

function toArray(value: string | string[]): string[] {
	return Array.isArray(value) ? value : [value]
}
