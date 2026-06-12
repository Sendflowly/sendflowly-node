import { describe, expect, it, vi } from 'vitest'
import { Sendflowly } from '../../src'
import { jsonResponse } from '../helpers'

function makeSDK(fetch: typeof globalThis.fetch): Sendflowly {
	return new Sendflowly('sk_test_key', {
		baseUrl: 'https://api.sendflowly.test',
		maxRetries: 0,
		fetch,
	})
}

describe('suppressions.list', () => {
	it('GETs /v1/suppressions with query params + returns pagination', async () => {
		const fetch = vi.fn().mockResolvedValueOnce(
			jsonResponse({
				data: [
					{
						id: 'sup_1',
						email_address: 'bouncy@example.com',
						reason: 'hard_bounce',
						bounce_count: 3,
						last_bounce_at: '2026-05-20T00:00:00Z',
						created_at: '2026-05-01T00:00:00Z',
					},
				],
				pagination: { total: 1, page: 1, page_size: 20, total_pages: 1 },
			}),
		)
		const result = await makeSDK(fetch).suppressions.list({
			reason: 'hard_bounce',
			search: 'bouncy',
			page_size: 50,
		})

		expect(result.error).toBeNull()
		expect(result.data).toHaveLength(1)
		expect(result.data?.[0].reason).toBe('hard_bounce')

		// biome-ignore lint/style/noNonNullAssertion: test asserts call happened
		const url = new URL(fetch.mock.calls[0]![0])
		expect(url.pathname).toBe('/v1/suppressions')
		expect(url.searchParams.get('reason')).toBe('hard_bounce')
		expect(url.searchParams.get('search')).toBe('bouncy')
		expect(url.searchParams.get('page_size')).toBe('50')
	})

	it('works with no query params', async () => {
		const fetch = vi.fn().mockResolvedValueOnce(
			jsonResponse({
				data: [],
				pagination: { total: 0, page: 1, page_size: 20, total_pages: 0 },
			}),
		)
		await makeSDK(fetch).suppressions.list()
		// biome-ignore lint/style/noNonNullAssertion: test asserts call happened
		const url = new URL(fetch.mock.calls[0]![0])
		expect(url.search).toBe('')
	})
})

describe('suppressions.add', () => {
	it('POSTs to /v1/suppressions with default reason "manual"', async () => {
		const fetch = vi.fn().mockResolvedValueOnce(
			jsonResponse(
				{
					data: {
						id: 'sup_new',
						email_address: 'user@example.com',
						reason: 'manual',
						bounce_count: 0,
						last_bounce_at: null,
						created_at: '2026-05-26T00:00:00Z',
					},
				},
				{ status: 201 },
			),
		)
		const { data, error } = await makeSDK(fetch).suppressions.add({
			email_address: 'user@example.com',
		})

		expect(error).toBeNull()
		expect(data?.id).toBe('sup_new')
		expect(data?.reason).toBe('manual')

		const [url, init] = fetch.mock.calls[0]
		expect(url).toBe('https://api.sendflowly.test/v1/suppressions')
		expect(init.method).toBe('POST')
		expect(JSON.parse(init.body)).toEqual({ email_address: 'user@example.com' })
	})

	it('accepts an explicit reason', async () => {
		const fetch = vi.fn().mockResolvedValueOnce(jsonResponse({ data: { id: 'sup_1' } }))
		await makeSDK(fetch).suppressions.add({
			email_address: 'spam@example.com',
			reason: 'complaint',
		})
		const body = JSON.parse(fetch.mock.calls[0][1].body)
		expect(body).toEqual({ email_address: 'spam@example.com', reason: 'complaint' })
	})

	it('surfaces validation errors as { error }', async () => {
		const fetch = vi
			.fn()
			.mockResolvedValueOnce(
				jsonResponse(
					{ error: { code: 'VALIDATION_ERROR', message: 'Invalid email format' } },
					{ status: 400 },
				),
			)
		const { data, error } = await makeSDK(fetch).suppressions.add({ email_address: 'not-an-email' })
		expect(data).toBeNull()
		expect(error?.code).toBe('VALIDATION_ERROR')
	})
})

describe('suppressions.bulkAdd', () => {
	it('POSTs to /v1/suppressions/bulk and returns { created, duplicates }', async () => {
		const fetch = vi
			.fn()
			.mockResolvedValueOnce(jsonResponse({ data: { created: 8, duplicates: 2 } }, { status: 201 }))
		const { data, error } = await makeSDK(fetch).suppressions.bulkAdd({
			suppressions: [
				{ email_address: 'a@example.com' },
				{ email_address: 'b@example.com', reason: 'complaint' },
				{ email_address: 'c@example.com', reason: 'manual' },
			],
		})

		expect(error).toBeNull()
		expect(data).toEqual({ created: 8, duplicates: 2 })

		const [url, init] = fetch.mock.calls[0]
		expect(url).toBe('https://api.sendflowly.test/v1/suppressions/bulk')
		expect(init.method).toBe('POST')
		const body = JSON.parse(init.body)
		expect(body.suppressions).toHaveLength(3)
	})
})

describe('suppressions.check', () => {
	it('GETs /v1/suppressions/check?email_address=... and returns { suppressed, reason }', async () => {
		const fetch = vi.fn().mockResolvedValueOnce(
			jsonResponse({
				data: {
					email_address: 'bouncy@example.com',
					suppressed: true,
					reason: 'hard_bounce',
				},
			}),
		)
		const { data, error } = await makeSDK(fetch).suppressions.check('bouncy@example.com')

		expect(error).toBeNull()
		expect(data?.suppressed).toBe(true)
		expect(data?.reason).toBe('hard_bounce')

		// biome-ignore lint/style/noNonNullAssertion: test asserts call happened
		const url = new URL(fetch.mock.calls[0]![0])
		expect(url.pathname).toBe('/v1/suppressions/check')
		expect(url.searchParams.get('email_address')).toBe('bouncy@example.com')
	})

	it('returns suppressed: false + reason: null when address is not on the list', async () => {
		const fetch = vi.fn().mockResolvedValueOnce(
			jsonResponse({
				data: {
					email_address: 'fresh@example.com',
					suppressed: false,
					reason: null,
				},
			}),
		)
		const { data, error } = await makeSDK(fetch).suppressions.check('fresh@example.com')
		expect(error).toBeNull()
		expect(data?.suppressed).toBe(false)
		expect(data?.reason).toBeNull()
	})

	it('URL-encodes email addresses with special characters', async () => {
		const fetch = vi.fn().mockResolvedValueOnce(
			jsonResponse({
				data: { email_address: 'user+tag@example.com', suppressed: false, reason: null },
			}),
		)
		await makeSDK(fetch).suppressions.check('user+tag@example.com')
		// biome-ignore lint/style/noNonNullAssertion: test asserts call happened
		const url = new URL(fetch.mock.calls[0]![0])
		// The query string encodes + as %2B
		expect(url.searchParams.get('email_address')).toBe('user+tag@example.com')
		expect(url.search).toContain('user%2Btag%40example.com')
	})
})

describe('suppressions.delete', () => {
	it('DELETEs /v1/suppressions/:id and returns { id, deleted: true }', async () => {
		const fetch = vi
			.fn()
			.mockResolvedValueOnce(jsonResponse({ data: { id: 'sup_1', deleted: true } }))
		const { data, error } = await makeSDK(fetch).suppressions.delete('sup_1')

		expect(error).toBeNull()
		expect(data).toEqual({ id: 'sup_1', deleted: true })

		const [url, init] = fetch.mock.calls[0]
		expect(url).toBe('https://api.sendflowly.test/v1/suppressions/sup_1')
		expect(init.method).toBe('DELETE')
	})
})
