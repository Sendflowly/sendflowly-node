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

describe('webhooks.create', () => {
	it('POSTs to /v1/webhooks and returns WebhookWithSecret (one-time reveal)', async () => {
		const fetch = vi.fn().mockResolvedValueOnce(
			jsonResponse(
				{
					data: {
						id: 'wh_abc',
						url: 'https://example.com/wh',
						secret: 'whsec_one_time_only_secret_value_base64',
						events: ['delivery', 'bounce'],
						domainIds: null,
						status: 'active',
						createdAt: '2026-05-26T00:00:00Z',
					},
				},
				{ status: 201 },
			),
		)
		const { data, error } = await makeSDK(fetch).webhooks.create({
			url: 'https://example.com/wh',
			events: ['delivery', 'bounce'],
		})

		expect(error).toBeNull()
		expect(data?.id).toBe('wh_abc')
		// Critical: the secret IS in the response on create
		expect(data?.secret).toBe('whsec_one_time_only_secret_value_base64')

		const [url, init] = fetch.mock.calls[0]
		expect(url).toBe('https://api.sendflowly.test/v1/webhooks')
		expect(init.method).toBe('POST')
	})

	it('forwards optional domain_ids in snake_case', async () => {
		const fetch = vi.fn().mockResolvedValueOnce(jsonResponse({ data: { id: 'wh_1' } }))
		await makeSDK(fetch).webhooks.create({
			url: 'https://example.com/wh',
			events: ['delivery'],
			domain_ids: ['dom_uuid_1', 'dom_uuid_2'],
		})
		const body = JSON.parse(fetch.mock.calls[0][1].body)
		expect(body).toEqual({
			url: 'https://example.com/wh',
			events: ['delivery'],
			domain_ids: ['dom_uuid_1', 'dom_uuid_2'],
		})
	})

	it('surfaces validation errors as { error }', async () => {
		const fetch = vi
			.fn()
			.mockResolvedValueOnce(
				jsonResponse(
					{ error: { code: 'VALIDATION_ERROR', message: 'Must be a valid URL' } },
					{ status: 400 },
				),
			)
		const { data, error } = await makeSDK(fetch).webhooks.create({
			url: 'not-a-url',
			events: ['delivery'],
		})
		expect(data).toBeNull()
		expect(error?.code).toBe('VALIDATION_ERROR')
	})
})

describe('webhooks.list', () => {
	it('GETs /v1/webhooks with query params + returns pagination', async () => {
		const fetch = vi.fn().mockResolvedValueOnce(
			jsonResponse({
				data: [{ id: 'wh_1' }, { id: 'wh_2' }],
				pagination: { total: 2, page: 1, page_size: 20, total_pages: 1 },
			}),
		)
		const result = await makeSDK(fetch).webhooks.list({ page: 1, page_size: 20 })

		expect(result.error).toBeNull()
		expect(result.data).toHaveLength(2)
		if (result.error === null) {
			expect(result.pagination?.total).toBe(2)
		}
		// biome-ignore lint/style/noNonNullAssertion: test asserts call happened
		const url = new URL(fetch.mock.calls[0]![0])
		expect(url.pathname).toBe('/v1/webhooks')
		expect(url.searchParams.get('page')).toBe('1')
	})

	it('list items have no `secret` field (API scrubs it)', async () => {
		const fetch = vi.fn().mockResolvedValueOnce(
			jsonResponse({
				data: [{ id: 'wh_1', url: 'https://x.com/wh', events: ['delivery'], status: 'active' }],
				pagination: { total: 1, page: 1, page_size: 20, total_pages: 1 },
			}),
		)
		const result = await makeSDK(fetch).webhooks.list()
		expect(result.error).toBeNull()
		// Verifies the Webhook type doesn't expose secret (compile-time check)
		// At runtime the API doesn't include the field; the test just confirms
		// the SDK doesn't somehow inject it.
		expect((result.data?.[0] as unknown as { secret?: string }).secret).toBeUndefined()
	})
})

describe('webhooks.get', () => {
	it('GETs /v1/webhooks/:id and returns Webhook (no secret)', async () => {
		const fetch = vi.fn().mockResolvedValueOnce(
			jsonResponse({
				data: {
					id: 'wh_1',
					url: 'https://example.com/wh',
					events: ['delivery', 'open'],
					domainIds: null,
					status: 'active',
					failureCount: 0,
					lastDeliveredAt: '2026-05-26T00:00:00Z',
					lastFailedAt: null,
					createdAt: '2026-05-01T00:00:00Z',
				},
			}),
		)
		const { data, error } = await makeSDK(fetch).webhooks.get('wh_1')
		expect(error).toBeNull()
		expect(data?.id).toBe('wh_1')
		// Compile-time: data should NOT have a `secret` field per the Webhook type.
		// Runtime: the API doesn't include it.
		expect((data as unknown as { secret?: string }).secret).toBeUndefined()
		expect(fetch.mock.calls[0]?.[0]).toBe('https://api.sendflowly.test/v1/webhooks/wh_1')
	})

	it('returns NOT_FOUND for non-existent webhook', async () => {
		const fetch = vi
			.fn()
			.mockResolvedValueOnce(
				jsonResponse(
					{ error: { code: 'NOT_FOUND', message: 'Webhook not found' } },
					{ status: 404 },
				),
			)
		const { data, error } = await makeSDK(fetch).webhooks.get('wh_missing')
		expect(data).toBeNull()
		expect(error?.code).toBe('NOT_FOUND')
	})
})

describe('webhooks.update', () => {
	it('PATCHes /v1/webhooks/:id with a partial body', async () => {
		const fetch = vi
			.fn()
			.mockResolvedValueOnce(jsonResponse({ data: { id: 'wh_1', status: 'inactive' } }))
		const { data, error } = await makeSDK(fetch).webhooks.update('wh_1', {
			status: 'inactive',
		})

		expect(error).toBeNull()
		expect(data?.status).toBe('inactive')

		const [url, init] = fetch.mock.calls[0]
		expect(url).toBe('https://api.sendflowly.test/v1/webhooks/wh_1')
		expect(init.method).toBe('PATCH')
		expect(JSON.parse(init.body)).toEqual({ status: 'inactive' })
	})

	it('allows null domain_ids explicitly (clears the filter)', async () => {
		const fetch = vi
			.fn()
			.mockResolvedValueOnce(jsonResponse({ data: { id: 'wh_1', domainIds: null } }))
		await makeSDK(fetch).webhooks.update('wh_1', { domain_ids: null })
		const body = JSON.parse(fetch.mock.calls[0][1].body)
		expect(body).toEqual({ domain_ids: null })
	})

	it('can update url + events + status together', async () => {
		const fetch = vi.fn().mockResolvedValueOnce(jsonResponse({ data: { id: 'wh_1' } }))
		await makeSDK(fetch).webhooks.update('wh_1', {
			url: 'https://new-host.example.com/wh',
			events: ['delivery', 'bounce', 'complaint'],
			status: 'active',
		})
		const body = JSON.parse(fetch.mock.calls[0][1].body)
		expect(body).toEqual({
			url: 'https://new-host.example.com/wh',
			events: ['delivery', 'bounce', 'complaint'],
			status: 'active',
		})
	})
})

describe('webhooks.delete', () => {
	it('DELETEs /v1/webhooks/:id and returns { id }', async () => {
		const fetch = vi.fn().mockResolvedValueOnce(jsonResponse({ data: { id: 'wh_1' } }))
		const { data, error } = await makeSDK(fetch).webhooks.delete('wh_1')
		expect(error).toBeNull()
		expect(data).toEqual({ id: 'wh_1' })

		const [url, init] = fetch.mock.calls[0]
		expect(url).toBe('https://api.sendflowly.test/v1/webhooks/wh_1')
		expect(init.method).toBe('DELETE')
	})
})

describe('webhooks.test', () => {
	it('POSTs /v1/webhooks/:id/test and returns delivery result', async () => {
		const fetch = vi
			.fn()
			.mockResolvedValueOnce(
				jsonResponse({ data: { success: true, statusCode: 200, duration: 134 } }),
			)
		const { data, error } = await makeSDK(fetch).webhooks.test('wh_1')

		expect(error).toBeNull()
		expect(data?.success).toBe(true)
		expect(data?.statusCode).toBe(200)
		expect(data?.duration).toBeGreaterThan(0)

		const [url, init] = fetch.mock.calls[0]
		expect(url).toBe('https://api.sendflowly.test/v1/webhooks/wh_1/test')
		expect(init.method).toBe('POST')
	})

	it('returns success: false + statusCode null on network failure to endpoint', async () => {
		const fetch = vi
			.fn()
			.mockResolvedValueOnce(
				jsonResponse({ data: { success: false, statusCode: null, duration: 30000 } }),
			)
		const { data, error } = await makeSDK(fetch).webhooks.test('wh_1')
		expect(error).toBeNull()
		expect(data?.success).toBe(false)
		expect(data?.statusCode).toBeNull()
	})
})

describe('webhooks — id URL encoding', () => {
	it('encodes path-param ids that contain special characters', async () => {
		const fetch = vi.fn().mockResolvedValueOnce(jsonResponse({ data: { id: 'wh-1' } }))
		await makeSDK(fetch).webhooks.get('wh/with/slashes')
		expect(fetch.mock.calls[0]?.[0]).toBe(
			'https://api.sendflowly.test/v1/webhooks/wh%2Fwith%2Fslashes',
		)
	})
})
