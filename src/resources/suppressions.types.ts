// Types for the Suppressions resource. Mirrors `/v1/suppressions/*` endpoints.
//
// Wire convention on this resource: **snake_case throughout** (both inputs
// AND outputs). Same as `emails` — these come from Drizzle rows that pass
// through to the wire without a DTO transform. `email_address`,
// `bounce_count`, `last_bounce_at`, `created_at` etc.

/**
 * Why an email is on the suppression list.
 *
 * - `manual` — added explicitly by the org (e.g. user requested removal)
 * - `hard_bounce` — auto-added after SES reported a permanent bounce
 * - `complaint` — auto-added after a recipient marked our email as spam
 */
export type SuppressionReason = 'manual' | 'hard_bounce' | 'complaint'

/** A single entry on the org's suppression list. */
export interface Suppression {
	id: string
	email_address: string
	reason: SuppressionReason
	/** Lifetime count of bounces against this address. `0` for manually-added entries that never bounced. */
	bounce_count: number
	/** ISO 8601 datetime of the most recent bounce. `null` if never bounced. */
	last_bounce_at: string | null
	/** ISO 8601 datetime the suppression was created. */
	created_at: string
}

/** Argument to `sendflowly.suppressions.add()`. */
export interface AddSuppressionRequest {
	email_address: string
	/** Defaults to `'manual'` if omitted. */
	reason?: SuppressionReason
}

/** Argument to `sendflowly.suppressions.bulkAdd()`. */
export interface BulkAddSuppressionsRequest {
	/** 1-1000 entries per request. Duplicates within the batch + against existing suppressions are silently deduped. */
	suppressions: AddSuppressionRequest[]
}

/** Returned by `suppressions.bulkAdd()` — counts only, not the per-entry results. */
export interface BulkAddSuppressionsResult {
	/** Number of new suppression rows actually inserted. */
	created: number
	/** Number of entries that were already on the list (no row inserted). */
	duplicates: number
}

/** Query parameters for `sendflowly.suppressions.list()`. */
export interface ListSuppressionsQuery {
	page?: number
	page_size?: number
	/** Substring search across the `email_address` column. */
	search?: string
	reason?: SuppressionReason
}

/**
 * Returned by `suppressions.check(email)` — a small fast-lookup response.
 * Always returns a result; `suppressed: false` means not on the list.
 */
export interface SuppressionCheckResult {
	email_address: string
	suppressed: boolean
	/** The suppression reason if `suppressed` is true; `null` otherwise. */
	reason: SuppressionReason | null
}

/** Returned by `sendflowly.suppressions.delete()` — confirmation envelope. */
export interface SuppressionDeleteResult {
	id: string
	deleted: true
}
