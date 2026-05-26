import type { Sendflowly } from '../client'
import type { SendflowlyResponse } from '../types/response'
import type {
	AddSuppressionRequest,
	BulkAddSuppressionsRequest,
	BulkAddSuppressionsResult,
	ListSuppressionsQuery,
	Suppression,
	SuppressionCheckResult,
	SuppressionDeleteResult,
} from './suppressions.types'

/**
 * Suppressions resource — wraps `/v1/suppressions/*` endpoints.
 *
 * Access via `sendflowly.suppressions`. Do not instantiate directly.
 *
 * The suppression list is your org's per-recipient block list. Addresses
 * on the list will NOT receive email — sends to them are silently dropped
 * by the API at submission time. Addresses are added automatically on
 * hard bounces and complaints; you can also add/remove manually.
 */
export class Suppressions {
	constructor(private readonly client: Sendflowly) {}

	/**
	 * List suppressed addresses. Paginated. Supports substring search and
	 * filtering by reason (`'manual'` / `'hard_bounce'` / `'complaint'`).
	 *
	 * @example
	 * ```ts
	 * const { data } = await sendflowly.suppressions.list({
	 *   reason: 'hard_bounce',
	 *   page_size: 100,
	 * })
	 * ```
	 */
	list(query: ListSuppressionsQuery = {}): Promise<SendflowlyResponse<Suppression[]>> {
		// Cast: `ListSuppressionsQuery`'s named fields don't structurally match
		// `Record<string, primitive | undefined | null>` under `exactOptionalPropertyTypes`.
		return this.client.get<Suppression[]>('/v1/suppressions', {
			query: query as Record<string, string | number | boolean | undefined | null>,
		})
	}

	/**
	 * Add a single address to the suppression list. `reason` defaults to
	 * `'manual'` — typically used when a user explicitly requests removal.
	 * Hard bounces and complaints are added automatically by the API; you
	 * don't need to call this for them.
	 */
	add(payload: AddSuppressionRequest): Promise<SendflowlyResponse<Suppression>> {
		return this.client.post<Suppression>('/v1/suppressions', payload)
	}

	/**
	 * Add up to 1000 addresses in a single request. Useful for importing a
	 * pre-existing block list. Duplicates (within the batch or against
	 * existing entries) are silently deduped — the response includes
	 * `created` (newly added) and `duplicates` (skipped) counts.
	 *
	 * @example
	 * ```ts
	 * const { data } = await sendflowly.suppressions.bulkAdd({
	 *   suppressions: [
	 *     { email_address: 'a@example.com', reason: 'manual' },
	 *     { email_address: 'b@example.com' },  // defaults to 'manual'
	 *   ],
	 * })
	 * console.log(`Added ${data?.created}, skipped ${data?.duplicates}`)
	 * ```
	 */
	bulkAdd(
		payload: BulkAddSuppressionsRequest,
	): Promise<SendflowlyResponse<BulkAddSuppressionsResult>> {
		return this.client.post<BulkAddSuppressionsResult>('/v1/suppressions/bulk', payload)
	}

	/**
	 * Check whether an email address is currently suppressed. Fast lookup —
	 * always returns a result.
	 *
	 * @example
	 * ```ts
	 * const { data } = await sendflowly.suppressions.check('user@example.com')
	 * if (data?.suppressed) {
	 *   console.log(`Reason: ${data.reason}`)
	 * }
	 * ```
	 */
	check(emailAddress: string): Promise<SendflowlyResponse<SuppressionCheckResult>> {
		return this.client.get<SuppressionCheckResult>('/v1/suppressions/check', {
			query: { email_address: emailAddress },
		})
	}

	/**
	 * Remove an address from the suppression list. The address can receive
	 * email again immediately after. Note that auto-added entries (hard
	 * bounces, complaints) may be re-added by future events; removing them
	 * is a manual override.
	 */
	delete(id: string): Promise<SendflowlyResponse<SuppressionDeleteResult>> {
		return this.client.delete<SuppressionDeleteResult>(`/v1/suppressions/${encodeURIComponent(id)}`)
	}
}
