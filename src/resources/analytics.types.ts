// Types for the Analytics resource. Mirrors `/v1/analytics/*` endpoints.
//
// Analytics endpoints use a slightly different response envelope than the
// rest of the API: `{ data, meta: { range } }` where `range` describes the
// actual date window the server used (which may be narrower than the one
// you requested if your plan has a retention limit). The SDK surfaces
// `meta` on its `SendflowlyResponse` and the analytics methods cast it to
// the typed `AnalyticsResponseMeta` shape.

/** Aggregate period for `analytics.overview()`. Closed set. */
export type AnalyticsPeriod = '7d' | '15d' | '30d' | '90d'

/**
 * Describes the actual date range the server used for the response.
 *
 * If `clamped` is `true`, the server narrowed your requested range to the
 * plan's retention window — `from` will be later than `requested_from`. Treat
 * `clamped: true` as a soft warning in your UI (e.g., "showing the last N
 * days available on your plan; upgrade for longer history").
 */
export interface AnalyticsRangeMeta {
	/** ISO date `YYYY-MM-DD` — actual range start used. */
	from: string
	/** ISO date `YYYY-MM-DD` — actual range end used. */
	to: string
	/** ISO date `YYYY-MM-DD` — what the caller asked for. */
	requested_from: string
	/** True when the server reduced the range due to plan retention. */
	clamped: boolean
	retention_days: number
	plan: string
}

/** Meta envelope returned alongside `data` on all analytics endpoints. */
export interface AnalyticsResponseMeta {
	range: AnalyticsRangeMeta
}

/** Query parameters for `analytics.overview()`. */
export interface AnalyticsOverviewQuery {
	/** Aggregate window. Defaults to `'30d'` if omitted. */
	period?: AnalyticsPeriod
	/** Scope to a single sending domain. Omit for all domains in the org. */
	domain_id?: string
}

/**
 * Aggregate counters + rates across the requested period.
 *
 * Rates are pre-computed by the server as fractions (0.0 to 1.0, NOT
 * percentages). Multiply by 100 to display as a percentage.
 */
export interface AnalyticsOverview {
	sent: number
	delivered: number
	bounced: number
	complained: number
	opened: number
	clicked: number
	rejected: number
	delayed: number
	failed: number
	/** Bounce subtype breakdown — sums to `bounced`. */
	bounced_transient: number
	bounced_permanent: number
	bounced_undetermined: number
	/** delivered / sent. `0` when sent is 0. */
	delivery_rate: number
	/** bounced / sent. */
	bounce_rate: number
	/** complained / sent. */
	complaint_rate: number
	/** opened / delivered. */
	open_rate: number
	/** clicked / delivered. */
	click_rate: number
}

/** Query parameters for `analytics.daily()`. */
export interface AnalyticsDailyQuery {
	/** ISO 8601 date or datetime (`YYYY-MM-DD` or with time + offset). */
	from: string
	/** ISO 8601 date or datetime. */
	to: string
	domain_id?: string
}

/** Per-day breakdown — one item per calendar day in the requested range. */
export interface AnalyticsDailyPoint {
	/** ISO date `YYYY-MM-DD`. */
	date: string
	sent: number
	delivered: number
	bounced: number
	complained: number
	opened: number
	clicked: number
	rejected: number
	delayed: number
	failed: number
	bounced_transient: number
	bounced_permanent: number
	bounced_undetermined: number
}
