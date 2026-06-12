import type { Sendflowly } from '../client'
import type { SendflowlyResponse } from '../types/response'
import type {
	AnalyticsDailyPoint,
	AnalyticsDailyQuery,
	AnalyticsOverview,
	AnalyticsOverviewQuery,
	AnalyticsResponseMeta,
} from './analytics.types'

/**
 * Analytics resource — wraps `/v1/analytics/*` endpoints.
 *
 * Access via `sendflowly.analytics`. Do not instantiate directly.
 *
 * Read-only resource. Returns aggregate sending statistics for your org,
 * either as a single period rollup (`overview()`) or per-day breakdown
 * (`daily()`). Both methods include a `meta.range` field describing the
 * actual date window the server used — check `meta.range.clamped` to detect
 * when your plan's retention limit narrowed your requested range.
 *
 * @example
 * ```ts
 * const result = await sendflowly.analytics.overview({ period: '7d' })
 * if (result.error === null) {
 *   console.log(`Delivery rate: ${(result.data.delivery_rate * 100).toFixed(1)}%`)
 *   const meta = result.meta as AnalyticsResponseMeta | undefined
 *   if (meta?.range.clamped) {
 *     console.warn(`Range clamped to ${meta.range.retention_days}-day retention`)
 *   }
 * }
 * ```
 */
export class Analytics {
	constructor(private readonly client: Sendflowly) {}

	/**
	 * Aggregate stats across the requested period. Defaults to `'30d'` when
	 * `period` is omitted. Optionally scope to a single sending domain.
	 *
	 * The response's `meta.range` (cast to `AnalyticsResponseMeta`) tells you
	 * the actual window the server used. If `meta.range.clamped` is true, the
	 * server narrowed your requested range to the plan's retention limit.
	 */
	overview(query: AnalyticsOverviewQuery = {}): Promise<SendflowlyResponse<AnalyticsOverview>> {
		return this.client.get<AnalyticsOverview>('/v1/analytics/overview', {
			query: query as unknown as Record<string, string | number | boolean | undefined | null>,
		})
	}

	/**
	 * Per-day breakdown of sending stats between `from` and `to` (inclusive).
	 * Both dates accept either `YYYY-MM-DD` or full ISO 8601 datetime with
	 * offset. Optionally scope to a single sending domain.
	 *
	 * Same meta contract as `overview()` — check `meta.range.clamped` to
	 * detect retention narrowing.
	 */
	daily(query: AnalyticsDailyQuery): Promise<SendflowlyResponse<AnalyticsDailyPoint[]>> {
		return this.client.get<AnalyticsDailyPoint[]>('/v1/analytics/daily', {
			query: query as unknown as Record<string, string | number | boolean | undefined | null>,
		})
	}
}

// Re-export for convenient consumer casting of the meta field.
export type { AnalyticsResponseMeta }
