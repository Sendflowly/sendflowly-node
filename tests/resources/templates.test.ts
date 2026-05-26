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

describe('templates.create', () => {
	it('POSTs to /v1/templates and returns the full Template detail', async () => {
		const fetch = vi.fn().mockResolvedValueOnce(
			jsonResponse(
				{
					data: {
						id: 'tpl_1',
						name: 'Welcome',
						subject: 'Hi {{ first_name }}',
						htmlBody: '<p>Hi {{ first_name }}</p>',
						textBody: 'Hi {{ first_name }}',
						variables: [{ name: 'first_name', type: 'string' }],
						designJson: null,
						previewText: null,
						createdAt: '2026-05-26T00:00:00Z',
						updatedAt: '2026-05-26T00:00:00Z',
					},
				},
				{ status: 201 },
			),
		)
		const { data, error } = await makeSDK(fetch).templates.create({
			name: 'Welcome',
			subject: 'Hi {{ first_name }}',
			html_body: '<p>Hi {{ first_name }}</p>',
			text_body: 'Hi {{ first_name }}',
			variables: [{ name: 'first_name', type: 'string' }],
		})

		expect(error).toBeNull()
		expect(data?.id).toBe('tpl_1')
		expect(data?.variables).toEqual([{ name: 'first_name', type: 'string' }])

		const [url, init] = fetch.mock.calls[0]
		expect(url).toBe('https://api.sendflowly.test/v1/templates')
		expect(init.method).toBe('POST')
	})

	it('mixed casing on inputs: snake_case html_body/text_body + camelCase designJson/previewText', async () => {
		const fetch = vi.fn().mockResolvedValueOnce(jsonResponse({ data: { id: 'tpl_1' } }))
		await makeSDK(fetch).templates.create({
			name: 'Mixed',
			subject: 'Subject',
			html_body: '<p>html</p>',
			text_body: 'text',
			designJson: { foo: 'bar' },
			previewText: 'Preview text shown next to subject',
		})
		const body = JSON.parse(fetch.mock.calls[0][1].body)
		expect(body).toEqual({
			name: 'Mixed',
			subject: 'Subject',
			html_body: '<p>html</p>',
			text_body: 'text',
			designJson: { foo: 'bar' },
			previewText: 'Preview text shown next to subject',
		})
	})

	it('forwards typed variables with fallback', async () => {
		const fetch = vi.fn().mockResolvedValueOnce(jsonResponse({ data: { id: 'tpl_1' } }))
		await makeSDK(fetch).templates.create({
			name: 'With fallback',
			subject: 'Hi',
			text_body: 'hi',
			variables: [
				{ name: 'first_name', type: 'string', fallback: 'there' },
				{ name: 'company_name', type: 'string' },
				{ name: 'order_count', type: 'number', fallback: '0' },
				{ name: 'is_premium', type: 'boolean' },
				{ name: 'unsubscribe_url', type: 'url' },
			],
		})
		const body = JSON.parse(fetch.mock.calls[0][1].body)
		expect(body.variables).toHaveLength(5)
		expect(body.variables[0]).toEqual({ name: 'first_name', type: 'string', fallback: 'there' })
	})

	it('surfaces validation errors as { error }', async () => {
		const fetch = vi
			.fn()
			.mockResolvedValueOnce(
				jsonResponse(
					{ error: { code: 'VALIDATION_ERROR', message: 'name is required' } },
					{ status: 400 },
				),
			)
		const { data, error } = await makeSDK(fetch).templates.create({
			// Empty string is valid TS but invalid per API validation — exercises
			// the runtime error path (server returns 400 VALIDATION_ERROR).
			name: '',
			subject: 'x',
		})
		expect(data).toBeNull()
		expect(error?.code).toBe('VALIDATION_ERROR')
	})
})

describe('templates.list', () => {
	it('GETs /v1/templates with query params + pagination', async () => {
		const fetch = vi.fn().mockResolvedValueOnce(
			jsonResponse({
				data: [
					{ id: 'tpl_1', name: 'Welcome' },
					{ id: 'tpl_2', name: 'Reset' },
				],
				pagination: { total: 2, page: 1, page_size: 20, total_pages: 1 },
			}),
		)
		const result = await makeSDK(fetch).templates.list({ page: 1, page_size: 50 })

		expect(result.error).toBeNull()
		expect(result.data).toHaveLength(2)
		if (result.error === null) {
			expect(result.pagination?.total).toBe(2)
		}
		// biome-ignore lint/style/noNonNullAssertion: test asserts call happened
		const url = new URL(fetch.mock.calls[0]![0])
		expect(url.pathname).toBe('/v1/templates')
		expect(url.searchParams.get('page_size')).toBe('50')
	})

	it('works with no query params', async () => {
		const fetch = vi.fn().mockResolvedValueOnce(
			jsonResponse({
				data: [],
				pagination: { total: 0, page: 1, page_size: 20, total_pages: 0 },
			}),
		)
		await makeSDK(fetch).templates.list()
		// biome-ignore lint/style/noNonNullAssertion: test asserts call happened
		const url = new URL(fetch.mock.calls[0]![0])
		expect(url.search).toBe('')
	})

	it('list items omit body / design fields (API serves lightweight rows)', async () => {
		const fetch = vi.fn().mockResolvedValueOnce(
			jsonResponse({
				data: [{ id: 'tpl_1', name: 'Welcome', subject: 'Hi', variables: null }],
				pagination: { total: 1, page: 1, page_size: 20, total_pages: 1 },
			}),
		)
		const result = await makeSDK(fetch).templates.list()
		expect(result.error).toBeNull()
		// Compile-time check: TemplateListItem doesn't have these fields.
		// Runtime: API doesn't include them.
		const item = result.data?.[0] as unknown as Record<string, unknown>
		expect(item.htmlBody).toBeUndefined()
		expect(item.textBody).toBeUndefined()
	})
})

describe('templates.get', () => {
	it('GETs /v1/templates/:id and returns full Template detail', async () => {
		const fetch = vi.fn().mockResolvedValueOnce(
			jsonResponse({
				data: {
					id: 'tpl_1',
					name: 'Welcome',
					subject: 'Hi',
					htmlBody: '<p>html</p>',
					textBody: 'text',
					variables: [],
					designJson: { blocks: [] },
					previewText: 'Inbox preview',
					createdAt: '2026-05-01T00:00:00Z',
					updatedAt: '2026-05-26T00:00:00Z',
				},
			}),
		)
		const { data, error } = await makeSDK(fetch).templates.get('tpl_1')

		expect(error).toBeNull()
		expect(data?.htmlBody).toBe('<p>html</p>')
		expect(data?.designJson).toEqual({ blocks: [] })
		expect(fetch.mock.calls[0]?.[0]).toBe('https://api.sendflowly.test/v1/templates/tpl_1')
	})

	it('returns NOT_FOUND for non-existent template', async () => {
		const fetch = vi
			.fn()
			.mockResolvedValueOnce(
				jsonResponse(
					{ error: { code: 'NOT_FOUND', message: 'Template not found' } },
					{ status: 404 },
				),
			)
		const { data, error } = await makeSDK(fetch).templates.get('tpl_missing')
		expect(data).toBeNull()
		expect(error?.code).toBe('NOT_FOUND')
	})
})

describe('templates.update', () => {
	it('PATCHes /v1/templates/:id with partial body', async () => {
		const fetch = vi
			.fn()
			.mockResolvedValueOnce(jsonResponse({ data: { id: 'tpl_1', name: 'Renamed' } }))
		const { data, error } = await makeSDK(fetch).templates.update('tpl_1', { name: 'Renamed' })

		expect(error).toBeNull()
		expect(data?.name).toBe('Renamed')

		const [url, init] = fetch.mock.calls[0]
		expect(url).toBe('https://api.sendflowly.test/v1/templates/tpl_1')
		expect(init.method).toBe('PATCH')
		expect(JSON.parse(init.body)).toEqual({ name: 'Renamed' })
	})

	it('allows null designJson explicitly to clear the builder state', async () => {
		const fetch = vi
			.fn()
			.mockResolvedValueOnce(jsonResponse({ data: { id: 'tpl_1', designJson: null } }))
		await makeSDK(fetch).templates.update('tpl_1', { designJson: null })
		expect(JSON.parse(fetch.mock.calls[0][1].body)).toEqual({ designJson: null })
	})

	it('can update body + variables + previewText together', async () => {
		const fetch = vi.fn().mockResolvedValueOnce(jsonResponse({ data: { id: 'tpl_1' } }))
		await makeSDK(fetch).templates.update('tpl_1', {
			html_body: '<p>new</p>',
			variables: [{ name: 'name', type: 'string', fallback: 'friend' }],
			previewText: 'New preview',
		})
		const body = JSON.parse(fetch.mock.calls[0][1].body)
		expect(body).toEqual({
			html_body: '<p>new</p>',
			variables: [{ name: 'name', type: 'string', fallback: 'friend' }],
			previewText: 'New preview',
		})
	})
})

describe('templates.delete', () => {
	it('DELETEs /v1/templates/:id and returns { id }', async () => {
		const fetch = vi.fn().mockResolvedValueOnce(jsonResponse({ data: { id: 'tpl_1' } }))
		const { data, error } = await makeSDK(fetch).templates.delete('tpl_1')
		expect(error).toBeNull()
		expect(data).toEqual({ id: 'tpl_1' })

		const [url, init] = fetch.mock.calls[0]
		expect(url).toBe('https://api.sendflowly.test/v1/templates/tpl_1')
		expect(init.method).toBe('DELETE')
	})
})
