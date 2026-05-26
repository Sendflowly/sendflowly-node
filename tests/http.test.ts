import { describe, expect, it, vi } from 'vitest'
import { HttpClient } from '../src/http'
import { jsonResponse, mockFetchSequence, textResponse } from './helpers'

function makeClient(
	fetch: typeof globalThis.fetch,
	overrides: Partial<{ maxRetries: number; timeout: number }> = {},
) {
	return new HttpClient({
		apiKey: 'sk_test_key',
		baseUrl: 'https://api.sendflowly.test',
		timeout: overrides.timeout ?? 5_000,
		maxRetries: overrides.maxRetries ?? 2,
		fetch,
		userAgent: 'sendflowly-sdk/test',
	})
}

describe('HttpClient — headers', () => {
	it('attaches Bearer auth, User-Agent, and Accept headers', async () => {
		const fetch = vi.fn().mockResolvedValueOnce(jsonResponse({ data: { ok: true } }))
		const client = makeClient(fetch)

		await client.get('/v1/ping')

		const [, init] = fetch.mock.calls[0]
		const headers = init.headers as Headers
		expect(headers.get('authorization')).toBe('Bearer sk_test_key')
		expect(headers.get('user-agent')).toBe('sendflowly-sdk/test')
		expect(headers.get('accept')).toBe('application/json')
	})

	it('omits Content-Type on GET requests', async () => {
		const fetch = vi.fn().mockResolvedValueOnce(jsonResponse({ data: {} }))
		await makeClient(fetch).get('/v1/ping')
		const headers = fetch.mock.calls[0][1].headers as Headers
		expect(headers.get('content-type')).toBeNull()
	})

	it('sets Content-Type on POST requests with a body', async () => {
		const fetch = vi.fn().mockResolvedValueOnce(jsonResponse({ data: { id: '1' } }))
		await makeClient(fetch).post('/v1/x', { foo: 'bar' })
		const headers = fetch.mock.calls[0][1].headers as Headers
		expect(headers.get('content-type')).toBe('application/json')
	})

	it('sends Idempotency-Key header when supplied', async () => {
		const fetch = vi.fn().mockResolvedValueOnce(jsonResponse({ data: { id: '1' } }))
		await makeClient(fetch).post('/v1/x', { foo: 'bar' }, { idempotencyKey: 'order-42' })
		const headers = fetch.mock.calls[0][1].headers as Headers
		expect(headers.get('idempotency-key')).toBe('order-42')
	})

	it('lets caller headers be overridden by SDK headers (security: Authorization)', async () => {
		const fetch = vi.fn().mockResolvedValueOnce(jsonResponse({ data: {} }))
		await makeClient(fetch).get('/v1/ping', {
			headers: { Authorization: 'Bearer evil', 'X-My-Header': 'keep-me' },
		})
		const headers = fetch.mock.calls[0][1].headers as Headers
		expect(headers.get('authorization')).toBe('Bearer sk_test_key') // SDK wins
		expect(headers.get('x-my-header')).toBe('keep-me') // non-conflicting kept
	})
})

describe('HttpClient — URL building', () => {
	it('combines baseUrl + path correctly', async () => {
		const fetch = vi.fn().mockResolvedValueOnce(jsonResponse({ data: {} }))
		await makeClient(fetch).get('/v1/emails/em_123')
		expect(fetch.mock.calls[0][0]).toBe('https://api.sendflowly.test/v1/emails/em_123')
	})

	it('prepends slash if the caller forgot one', async () => {
		const fetch = vi.fn().mockResolvedValueOnce(jsonResponse({ data: {} }))
		await makeClient(fetch).get('v1/x')
		expect(fetch.mock.calls[0][0]).toBe('https://api.sendflowly.test/v1/x')
	})

	it('serializes query string parameters and skips undefined/null', async () => {
		const fetch = vi.fn().mockResolvedValueOnce(jsonResponse({ data: [] }))
		await makeClient(fetch).get('/v1/emails', {
			query: { page: 2, page_size: 50, status: 'sent', api_key_id: undefined, foo: null },
		})
		const url = new URL(fetch.mock.calls[0][0])
		expect(url.searchParams.get('page')).toBe('2')
		expect(url.searchParams.get('page_size')).toBe('50')
		expect(url.searchParams.get('status')).toBe('sent')
		expect(url.searchParams.has('api_key_id')).toBe(false)
		expect(url.searchParams.has('foo')).toBe(false)
	})
})

describe('HttpClient — success envelope parsing', () => {
	it('unwraps the API `{ data }` envelope', async () => {
		const fetch = vi.fn().mockResolvedValueOnce(jsonResponse({ data: { id: 'em_1' } }))
		const result = await makeClient(fetch).post<{ id: string }>('/v1/emails', { foo: 1 })
		expect(result.error).toBeNull()
		expect(result.data).toEqual({ id: 'em_1' })
	})

	it('surfaces pagination when present in the envelope', async () => {
		const fetch = vi.fn().mockResolvedValueOnce(
			jsonResponse({
				data: [{ id: 'em_1' }, { id: 'em_2' }],
				pagination: { total: 2, page: 1, page_size: 20, total_pages: 1 },
			}),
		)
		const result = await makeClient(fetch).get<Array<{ id: string }>>('/v1/emails')
		expect(result.error).toBeNull()
		expect(result.data).toHaveLength(2)
		if (result.error === null) {
			expect(result.pagination).toEqual({ total: 2, page: 1, page_size: 20, total_pages: 1 })
		}
	})

	it('returns headers as a plain object including x-request-id', async () => {
		const fetch = vi
			.fn()
			.mockResolvedValueOnce(jsonResponse({ data: {} }, { headers: { 'x-request-id': 'req_abc' } }))
		const result = await makeClient(fetch).get('/v1/x')
		expect(result.headers['x-request-id']).toBe('req_abc')
	})
})

describe('HttpClient — error envelope parsing', () => {
	it('maps API error envelope to SendflowlyError with code + requestId', async () => {
		const fetch = vi
			.fn()
			.mockResolvedValueOnce(
				jsonResponse(
					{ error: { code: 'VALIDATION_ERROR', message: 'subject is required' } },
					{ status: 400, headers: { 'x-request-id': 'req_v1' } },
				),
			)
		const result = await makeClient(fetch).post('/v1/emails', {})
		expect(result.data).toBeNull()
		expect(result.error).toEqual({
			code: 'VALIDATION_ERROR',
			message: 'subject is required',
			statusCode: 400,
			requestId: 'req_v1',
		})
	})

	it.each([
		[401, 'UNAUTHORIZED'],
		[403, 'FORBIDDEN'],
		[404, 'NOT_FOUND'],
		[409, 'CONFLICT'],
		[400, 'VALIDATION_ERROR'],
		[422, 'VALIDATION_ERROR'],
		[429, 'RATE_LIMITED'],
		[500, 'INTERNAL_ERROR'],
		[502, 'INTERNAL_ERROR'],
	])('falls back to status-based code (%i → %s) when API envelope lacks code', async (status, code) => {
		const fetch = vi
			.fn()
			.mockResolvedValueOnce(textResponse('Server returned non-JSON', { status }))
		// 5xx would normally retry — disable retries so this test stays focused on code mapping.
		const result = await makeClient(fetch, { maxRetries: 0 }).get('/v1/x')
		expect(result.error?.code).toBe(code)
		expect(result.error?.statusCode).toBe(status)
	})

	it('handles JSON-shaped body that does NOT match the envelope', async () => {
		const fetch = vi.fn().mockResolvedValueOnce(jsonResponse({ random: 'json' }, { status: 500 }))
		const result = await makeClient(fetch, { maxRetries: 0 }).get('/v1/x')
		expect(result.error?.code).toBe('INTERNAL_ERROR')
		expect(result.error?.statusCode).toBe(500)
	})

	it('surfaces parse failure on non-JSON success body', async () => {
		const fetch = vi.fn().mockResolvedValueOnce(textResponse('not-json', { status: 200 }))
		const result = await makeClient(fetch).get('/v1/x')
		expect(result.error?.code).toBe('INTERNAL_ERROR')
		expect(result.error?.message).toMatch(/parse/i)
	})
})

describe('HttpClient — retry policy', () => {
	it('retries 5xx on GET (idempotent method)', async () => {
		const fetch = mockFetchSequence(
			jsonResponse({}, { status: 502 }),
			jsonResponse({ data: { id: '1' } }),
		)
		const result = await makeClient(fetch).get<{ id: string }>('/v1/x')
		expect(result.error).toBeNull()
		expect(result.data).toEqual({ id: '1' })
		expect(fetch).toHaveBeenCalledTimes(2)
	})

	it('does NOT retry on POST without idempotencyKey (would risk double-send)', async () => {
		const fetch = mockFetchSequence(
			jsonResponse({}, { status: 503 }),
			jsonResponse({ data: { id: 'should_not_reach' } }),
		)
		const result = await makeClient(fetch).post('/v1/emails', { from: 'x' })
		expect(result.error?.statusCode).toBe(503)
		expect(fetch).toHaveBeenCalledTimes(1)
	})

	it('DOES retry POST when idempotencyKey is supplied', async () => {
		const fetch = mockFetchSequence(
			jsonResponse({}, { status: 503 }),
			jsonResponse({ data: { id: 'em_1' } }),
		)
		const result = await makeClient(fetch).post(
			'/v1/emails',
			{ from: 'x' },
			{ idempotencyKey: 'key1' },
		)
		expect(result.error).toBeNull()
		expect(fetch).toHaveBeenCalledTimes(2)
	})

	it('does NOT retry on 4xx (non-retriable)', async () => {
		const fetch = mockFetchSequence(
			jsonResponse({ error: { code: 'NOT_FOUND', message: 'x' } }, { status: 404 }),
			jsonResponse({ data: {} }),
		)
		const result = await makeClient(fetch).get('/v1/x')
		expect(result.error?.code).toBe('NOT_FOUND')
		expect(fetch).toHaveBeenCalledTimes(1)
	})

	it('retries on 429 and respects Retry-After header (clamped via short timeout test)', async () => {
		const fetch = mockFetchSequence(
			jsonResponse({}, { status: 429, headers: { 'retry-after': '0' } }), // 0 seconds → instant
			jsonResponse({ data: { ok: true } }),
		)
		const result = await makeClient(fetch).get('/v1/x')
		expect(result.error).toBeNull()
		expect(fetch).toHaveBeenCalledTimes(2)
	})

	it('stops retrying after maxRetries and returns the final error', async () => {
		const fetch = mockFetchSequence(
			jsonResponse({}, { status: 503 }),
			jsonResponse({}, { status: 503 }),
			jsonResponse({}, { status: 503 }),
		)
		const result = await makeClient(fetch, { maxRetries: 2 }).get('/v1/x')
		expect(result.error?.statusCode).toBe(503)
		expect(fetch).toHaveBeenCalledTimes(3) // initial + 2 retries
	})

	it('retries on network error (fetch rejects) for GET', async () => {
		const fetch = mockFetchSequence(
			new TypeError('fetch failed'),
			jsonResponse({ data: { ok: true } }),
		)
		const result = await makeClient(fetch).get('/v1/x')
		expect(result.error).toBeNull()
		expect(fetch).toHaveBeenCalledTimes(2)
	})

	it('returns NETWORK_ERROR when all retries fail with fetch rejection', async () => {
		const fetch = mockFetchSequence(
			new TypeError('fetch failed'),
			new TypeError('fetch failed'),
			new TypeError('fetch failed'),
		)
		const result = await makeClient(fetch, { maxRetries: 2 }).get('/v1/x')
		expect(result.error?.code).toBe('NETWORK_ERROR')
		expect(result.error?.statusCode).toBeNull()
	})
})

describe('HttpClient — timeout + abort', () => {
	it('returns TIMEOUT_ERROR when fetch never resolves within timeout', async () => {
		const fetch = vi.fn().mockImplementation(
			(_url: string, init: RequestInit) =>
				new Promise((_resolve, reject) => {
					init.signal?.addEventListener('abort', () => {
						const err = new Error('aborted')
						err.name = 'AbortError'
						reject(err)
					})
				}),
		)
		// 50ms timeout, no retries — must time out and surface synthetic code.
		const client = makeClient(fetch, { timeout: 50, maxRetries: 0 })
		const result = await client.get('/v1/x')
		expect(result.error?.code).toBe('TIMEOUT_ERROR')
		expect(result.error?.message).toMatch(/50ms/)
	})

	it('honors caller-provided AbortSignal and does NOT retry on user abort', async () => {
		const fetch = vi.fn().mockImplementation(
			(_url: string, init: RequestInit) =>
				new Promise((_resolve, reject) => {
					init.signal?.addEventListener('abort', () => {
						const err = new Error('aborted')
						err.name = 'AbortError'
						reject(err)
					})
				}),
		)
		const controller = new AbortController()
		const client = makeClient(fetch, { maxRetries: 2 }) // retries enabled
		const promise = client.get('/v1/x', { signal: controller.signal })
		controller.abort()
		const result = await promise
		expect(result.error?.code).toBe('NETWORK_ERROR')
		expect(result.error?.message).toMatch(/aborted by caller/i)
		expect(fetch).toHaveBeenCalledTimes(1) // user-abort never retries
	})
})
