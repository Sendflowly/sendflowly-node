import { describe, expect, it, vi } from 'vitest'
import { Sendflowly } from '../../src'
import type { AnalyticsResponseMeta } from '../../src/resources/analytics.types'
import { jsonResponse } from '../helpers'

function makeSDK(fetch: typeof globalThis.fetch): Sendflowly {
	return new Sendflowly('sk_test_key', {
		baseUrl: 'https://api.sendflowly.test',
		maxRetries: 0,
		fetch,
	})
}

const sampleOverviewData = {
	sent: 1000,
	delivered: 968,
	bounced: 22,
	complained: 1,
	opened: 412,
	clicked: 89,
	rejected: 5,
	delayed: 4,
	failed: 0,
	bounced_transient: 15,
	bounced_permanent: 6,
	bounced_undetermined: 1,
	delivery_rate: 0.968,
	bounce_rate: 0.022,
	complaint_rate: 0.001,
	open_rate: 0.4256,
	click_rate: 0.0919,
}

const sampleRangeMeta = {
	from: '2026-04-26',
	to: '2026-05-26',
	requested_from: '2026-04-26',
	clamped: false,
	retention_days: 90,
	plan: 'pro',
}

describe('analytics.overview', () => {
	it('GETs /v1/analytics/overview with period + returns AnalyticsOverview', async () => {
		const fetch = vi
			.fn()
			.mockResolvedValueOnce(
				jsonResponse({ data: sampleOverviewData, meta: { range: sampleRangeMeta } }),
			)
		const result = await makeSDK(fetch).analytics.overview({ period: '30d' })

		expect(result.error).toBeNull()
		expect(result.data?.delivery_rate).toBeCloseTo(0.968)
		expect(result.data?.sent).toBe(1000)

		// biome-ignore lint/style/noNonNullAssertion: test asserts call happened
		const url = new URL(fetch.mock.calls[0]![0])
		expect(url.pathname).toBe('/v1/analytics/overview')
		expect(url.searchParams.get('period')).toBe('30d')
	})

	it('works with no query params (server defaults to 30d)', async () => {
		const fetch = vi
			.fn()
			.mockResolvedValueOnce(
				jsonResponse({ data: sampleOverviewData, meta: { range: sampleRangeMeta } }),
			)
		await makeSDK(fetch).analytics.overview()
		// biome-ignore lint/style/noNonNullAssertion: test asserts call happened
		const url = new URL(fetch.mock.calls[0]![0])
		expect(url.search).toBe('')
	})

	it('scopes to a single domain when domain_id is supplied', async () => {
		const fetch = vi
			.fn()
			.mockResolvedValueOnce(
				jsonResponse({ data: sampleOverviewData, meta: { range: sampleRangeMeta } }),
			)
		await makeSDK(fetch).analytics.overview({ period: '7d', domain_id: 'dom_uuid' })
		// biome-ignore lint/style/noNonNullAssertion: test asserts call happened
		const url = new URL(fetch.mock.calls[0]![0])
		expect(url.searchParams.get('period')).toBe('7d')
		expect(url.searchParams.get('domain_id')).toBe('dom_uuid')
	})

	it('exposes meta.range from the API envelope (passes through SendflowlyResponse.meta)', async () => {
		const fetch = vi
			.fn()
			.mockResolvedValueOnce(
				jsonResponse({ data: sampleOverviewData, meta: { range: sampleRangeMeta } }),
			)
		const result = await makeSDK(fetch).analytics.overview({ period: '30d' })

		expect(result.error).toBeNull()
		if (result.error === null) {
			const meta = result.meta as AnalyticsResponseMeta | undefined
			expect(meta?.range.from).toBe('2026-04-26')
			expect(meta?.range.clamped).toBe(false)
			expect(meta?.range.plan).toBe('pro')
		}
	})

	it('surfaces clamped range (plan retention narrowed the request)', async () => {
		const fetch = vi.fn().mockResolvedValueOnce(
			jsonResponse({
				data: sampleOverviewData,
				meta: {
					range: {
						from: '2026-05-19',
						to: '2026-05-26',
						requested_from: '2026-02-26',
						clamped: true,
						retention_days: 7,
						plan: 'starter',
					},
				},
			}),
		)
		const result = await makeSDK(fetch).analytics.overview({ period: '90d' })

		expect(result.error).toBeNull()
		if (result.error === null) {
			const meta = result.meta as AnalyticsResponseMeta | undefined
			expect(meta?.range.clamped).toBe(true)
			expect(meta?.range.retention_days).toBe(7)
			expect(meta?.range.requested_from).toBe('2026-02-26')
		}
	})
})

describe('analytics.daily', () => {
	it('GETs /v1/analytics/daily with from + to + returns AnalyticsDailyPoint[]', async () => {
		const fetch = vi.fn().mockResolvedValueOnce(
			jsonResponse({
				data: [
					{
						date: '2026-05-24',
						sent: 100,
						delivered: 96,
						bounced: 4,
						complained: 0,
						opened: 42,
						clicked: 8,
						rejected: 0,
						delayed: 0,
						failed: 0,
						bounced_transient: 3,
						bounced_permanent: 1,
						bounced_undetermined: 0,
					},
					{ date: '2026-05-25', sent: 0, delivered: 0, bounced: 0 },
				],
				meta: { range: sampleRangeMeta },
			}),
		)
		const result = await makeSDK(fetch).analytics.daily({
			from: '2026-05-24',
			to: '2026-05-25',
		})

		expect(result.error).toBeNull()
		expect(result.data).toHaveLength(2)
		expect(result.data?.[0].date).toBe('2026-05-24')
		expect(result.data?.[0].delivered).toBe(96)

		// biome-ignore lint/style/noNonNullAssertion: test asserts call happened
		const url = new URL(fetch.mock.calls[0]![0])
		expect(url.pathname).toBe('/v1/analytics/daily')
		expect(url.searchParams.get('from')).toBe('2026-05-24')
		expect(url.searchParams.get('to')).toBe('2026-05-25')
	})

	it('accepts ISO datetime + scopes by domain', async () => {
		const fetch = vi
			.fn()
			.mockResolvedValueOnce(jsonResponse({ data: [], meta: { range: sampleRangeMeta } }))
		await makeSDK(fetch).analytics.daily({
			from: '2026-05-01T00:00:00Z',
			to: '2026-05-26T23:59:59Z',
			domain_id: 'dom_uuid',
		})
		// biome-ignore lint/style/noNonNullAssertion: test asserts call happened
		const url = new URL(fetch.mock.calls[0]![0])
		expect(url.searchParams.get('from')).toBe('2026-05-01T00:00:00Z')
		expect(url.searchParams.get('to')).toBe('2026-05-26T23:59:59Z')
		expect(url.searchParams.get('domain_id')).toBe('dom_uuid')
	})

	it('returns VALIDATION_ERROR for invalid date strings', async () => {
		const fetch = vi
			.fn()
			.mockResolvedValueOnce(
				jsonResponse(
					{ error: { code: 'VALIDATION_ERROR', message: 'Invalid date format' } },
					{ status: 400 },
				),
			)
		const { data, error } = await makeSDK(fetch).analytics.daily({
			from: 'not-a-date',
			to: '2026-05-26',
		})
		expect(data).toBeNull()
		expect(error?.code).toBe('VALIDATION_ERROR')
	})
})

describe('HttpClient — meta passthrough (regression guard for the response envelope change)', () => {
	it('non-analytics endpoints with no meta in response do NOT get a meta field', async () => {
		const fetch = vi.fn().mockResolvedValueOnce(jsonResponse({ data: { id: 'em_1' } }))
		const result = await makeSDK(fetch).emails.get('em_1')
		expect(result.error).toBeNull()
		if (result.error === null) {
			// meta is absent (not undefined-stamped) when the response didn't include it.
			expect('meta' in result).toBe(false)
		}
	})

	it('list responses with pagination but no meta still work', async () => {
		const fetch = vi.fn().mockResolvedValueOnce(
			jsonResponse({
				data: [{ id: 'em_1' }],
				pagination: { total: 1, page: 1, page_size: 20, total_pages: 1 },
			}),
		)
		const result = await makeSDK(fetch).emails.list()
		expect(result.error).toBeNull()
		if (result.error === null) {
			expect(result.pagination?.total).toBe(1)
			expect('meta' in result).toBe(false)
		}
	})
})
