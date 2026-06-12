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

describe('emails.send', () => {
	it('POSTs to /v1/emails and returns { id }', async () => {
		const fetch = vi
			.fn()
			.mockResolvedValueOnce(jsonResponse({ data: { id: 'em_abc' } }, { status: 201 }))
		const sf = makeSDK(fetch)

		const { data, error } = await sf.emails.send({
			from: 'hi@example.com',
			to: 'user@example.com',
			subject: 'Hello',
			html: '<p>Hi</p>',
		})

		expect(error).toBeNull()
		expect(data).toEqual({ id: 'em_abc' })

		const [url, init] = fetch.mock.calls[0]
		expect(url).toBe('https://api.sendflowly.test/v1/emails')
		expect(init.method).toBe('POST')
	})

	it('normalizes single-string recipients to arrays before sending', async () => {
		const fetch = vi.fn().mockResolvedValueOnce(jsonResponse({ data: { id: 'em_1' } }))
		await makeSDK(fetch).emails.send({
			from: 'hi@example.com',
			to: 'one@example.com',
			cc: 'two@example.com',
			bcc: 'three@example.com',
			reply_to: 'four@example.com',
			text: 'hi',
		})

		const body = JSON.parse(fetch.mock.calls[0][1].body)
		expect(body.to).toEqual(['one@example.com'])
		expect(body.cc).toEqual(['two@example.com'])
		expect(body.bcc).toEqual(['three@example.com'])
		expect(body.reply_to).toEqual(['four@example.com'])
	})

	it('passes through array recipients unchanged', async () => {
		const fetch = vi.fn().mockResolvedValueOnce(jsonResponse({ data: { id: 'em_1' } }))
		await makeSDK(fetch).emails.send({
			from: 'hi@example.com',
			to: ['a@example.com', 'b@example.com'],
			text: 'hi',
		})
		const body = JSON.parse(fetch.mock.calls[0][1].body)
		expect(body.to).toEqual(['a@example.com', 'b@example.com'])
	})

	it('forwards idempotencyKey as a header', async () => {
		const fetch = vi.fn().mockResolvedValueOnce(jsonResponse({ data: { id: 'em_1' } }))
		await makeSDK(fetch).emails.send(
			{ from: 'hi@example.com', to: 'user@example.com', text: 'hi' },
			{ idempotencyKey: 'order-99' },
		)
		const headers = fetch.mock.calls[0][1].headers as Headers
		expect(headers.get('idempotency-key')).toBe('order-99')
	})

	it('surfaces a 400 validation error in the response (no throw)', async () => {
		const fetch = vi
			.fn()
			.mockResolvedValueOnce(
				jsonResponse(
					{ error: { code: 'VALIDATION_ERROR', message: 'from is required' } },
					{ status: 400, headers: { 'x-request-id': 'req_v_1' } },
				),
			)
		const { data, error } = await makeSDK(fetch).emails.send({
			// Empty string is valid TS but invalid per API validation — exercises
			// the runtime error path (server returns 400 VALIDATION_ERROR).
			from: '',
			to: 'user@example.com',
			text: 'hi',
		})
		expect(data).toBeNull()
		expect(error).toEqual({
			code: 'VALIDATION_ERROR',
			message: 'from is required',
			statusCode: 400,
			requestId: 'req_v_1',
		})
	})

	it('does NOT retry on 5xx when no idempotencyKey supplied', async () => {
		const fetch = vi.fn().mockResolvedValueOnce(jsonResponse({}, { status: 502 }))
		const sf = new Sendflowly('sk_test', {
			baseUrl: 'https://api.sendflowly.test',
			maxRetries: 3, // retries enabled, but POST without key still shouldn't retry
			fetch,
		})
		const { error } = await sf.emails.send({
			from: 'hi@example.com',
			to: 'user@example.com',
			text: 'hi',
		})
		expect(error?.statusCode).toBe(502)
		expect(fetch).toHaveBeenCalledTimes(1)
	})
})

describe('emails.sendBatch', () => {
	it('POSTs to /v1/emails/batch and normalizes recipients in each email', async () => {
		const fetch = vi.fn().mockResolvedValueOnce(
			jsonResponse({
				data: {
					results: [
						{ index: 0, id: 'em_a' },
						{ index: 1, id: 'em_b' },
					],
					succeeded: 2,
					failed: 0,
				},
			}),
		)
		const { data, error } = await makeSDK(fetch).emails.sendBatch({
			emails: [
				{ from: 'a@example.com', to: 'x@example.com', text: '1' },
				{ from: 'b@example.com', to: ['y@example.com'], text: '2' },
			],
		})
		expect(error).toBeNull()
		expect(data?.succeeded).toBe(2)
		expect(fetch.mock.calls[0][0]).toBe('https://api.sendflowly.test/v1/emails/batch')
		const body = JSON.parse(fetch.mock.calls[0][1].body)
		expect(body.emails[0].to).toEqual(['x@example.com'])
		expect(body.emails[1].to).toEqual(['y@example.com'])
	})
})

describe('emails.list', () => {
	it('GETs /v1/emails with query params and returns pagination', async () => {
		const fetch = vi.fn().mockResolvedValueOnce(
			jsonResponse({
				data: [{ id: 'em_1' }, { id: 'em_2' }],
				pagination: { total: 2, page: 1, page_size: 20, total_pages: 1 },
			}),
		)
		const result = await makeSDK(fetch).emails.list({ page: 1, page_size: 20, status: 'sent' })

		expect(result.error).toBeNull()
		expect(result.data).toHaveLength(2)
		if (result.error === null) {
			expect(result.pagination?.total).toBe(2)
		}
		// biome-ignore lint/style/noNonNullAssertion: test asserts call happened
		const url = new URL(fetch.mock.calls[0]![0])
		expect(url.pathname).toBe('/v1/emails')
		expect(url.searchParams.get('page')).toBe('1')
		expect(url.searchParams.get('status')).toBe('sent')
	})

	it('works with no query params', async () => {
		const fetch = vi.fn().mockResolvedValueOnce(
			jsonResponse({
				data: [],
				pagination: { total: 0, page: 1, page_size: 20, total_pages: 0 },
			}),
		)
		await makeSDK(fetch).emails.list()
		// biome-ignore lint/style/noNonNullAssertion: test asserts call happened
		const url = new URL(fetch.mock.calls[0]![0])
		expect(url.search).toBe('')
	})
})

describe('emails.get', () => {
	it('GETs /v1/emails/:id and url-encodes the id', async () => {
		const fetch = vi.fn().mockResolvedValueOnce(
			jsonResponse({
				data: {
					id: 'em_1',
					htmlBody: '<p>hi</p>',
					textBody: 'hi',
					events: [],
				},
			}),
		)
		const { data, error } = await makeSDK(fetch).emails.get('em_1')
		expect(error).toBeNull()
		expect(data?.id).toBe('em_1')
		// biome-ignore lint/style/noNonNullAssertion: test asserts call happened
		expect(fetch.mock.calls[0]![0]).toBe('https://api.sendflowly.test/v1/emails/em_1')
	})

	it('returns NOT_FOUND error when the email does not exist', async () => {
		const fetch = vi
			.fn()
			.mockResolvedValueOnce(
				jsonResponse({ error: { code: 'NOT_FOUND', message: 'Email not found' } }, { status: 404 }),
			)
		const { data, error } = await makeSDK(fetch).emails.get('em_missing')
		expect(data).toBeNull()
		expect(error?.code).toBe('NOT_FOUND')
		expect(error?.statusCode).toBe(404)
	})
})

describe('emails.resend', () => {
	it('POSTs /v1/emails/:id/resend and returns new id', async () => {
		const fetch = vi
			.fn()
			.mockResolvedValueOnce(jsonResponse({ data: { id: 'em_new' } }, { status: 201 }))
		const { data, error } = await makeSDK(fetch).emails.resend('em_old', {
			idempotencyKey: 'resend-1',
		})
		expect(error).toBeNull()
		expect(data?.id).toBe('em_new')
		const [url, init] = fetch.mock.calls[0]
		expect(url).toBe('https://api.sendflowly.test/v1/emails/em_old/resend')
		expect(init.method).toBe('POST')
		expect((init.headers as Headers).get('idempotency-key')).toBe('resend-1')
	})
})

describe('emails.downloadAttachment', () => {
	it('GETs the attachment download URL endpoint', async () => {
		const fetch = vi
			.fn()
			.mockResolvedValueOnce(
				jsonResponse({ data: { url: 'https://s3.example/signed-url?token=abc' } }),
			)
		const { data, error } = await makeSDK(fetch).emails.downloadAttachment('em_1', 'att_2')
		expect(error).toBeNull()
		expect(data?.url).toContain('s3.example')
		// biome-ignore lint/style/noNonNullAssertion: test asserts call happened
		expect(fetch.mock.calls[0]![0]).toBe(
			'https://api.sendflowly.test/v1/emails/em_1/attachments/att_2/download',
		)
	})
})
