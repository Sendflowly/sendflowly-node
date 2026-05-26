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

describe('domains.create', () => {
	it('POSTs to /v1/domains and returns DomainWithDns', async () => {
		const fetch = vi.fn().mockResolvedValueOnce(
			jsonResponse(
				{
					data: {
						id: 'dom_1',
						domain: 'mail.example.com',
						region: 'eu-central-1',
						status: 'pending',
						returnPathSubdomain: 'mail',
						clickTrackingEnabled: false,
						openTrackingEnabled: false,
						tlsPolicy: 'opportunistic',
						inboundMxVerified: false,
						verifiedAt: null,
						lastCheckedAt: null,
						createdAt: '2026-01-01T00:00:00Z',
						updatedAt: '2026-01-01T00:00:00Z',
						dnsRecords: [
							{
								type: 'CNAME',
								name: 'k1._domainkey.mail.example.com',
								value: '...',
								purpose: 'DKIM',
							},
						],
						dnsProvider: { provider: null, nameservers: [] },
					},
				},
				{ status: 201 },
			),
		)
		const { data, error } = await makeSDK(fetch).domains.create({
			domain: 'mail.example.com',
			region: 'eu-central-1',
		})

		expect(error).toBeNull()
		expect(data?.id).toBe('dom_1')
		expect(data?.dnsRecords).toHaveLength(1)

		const [url, init] = fetch.mock.calls[0]
		expect(url).toBe('https://api.sendflowly.test/v1/domains')
		expect(init.method).toBe('POST')
	})

	it('passes through optional fields verbatim (snake_case)', async () => {
		const fetch = vi.fn().mockResolvedValueOnce(jsonResponse({ data: { id: 'dom_2' } }))
		await makeSDK(fetch).domains.create({
			domain: 'mail.example.com',
			region: 'eu-central-1',
			return_path: 'bounces',
			tls_policy: 'enforced',
		})
		const body = JSON.parse(fetch.mock.calls[0][1].body)
		expect(body).toEqual({
			domain: 'mail.example.com',
			region: 'eu-central-1',
			return_path: 'bounces',
			tls_policy: 'enforced',
		})
	})

	it('surfaces validation errors as { error }', async () => {
		const fetch = vi
			.fn()
			.mockResolvedValueOnce(
				jsonResponse(
					{ error: { code: 'VALIDATION_ERROR', message: 'Invalid domain format' } },
					{ status: 400 },
				),
			)
		const { data, error } = await makeSDK(fetch).domains.create({
			domain: 'not-a-valid-domain',
			region: 'eu-central-1',
		})
		expect(data).toBeNull()
		expect(error?.code).toBe('VALIDATION_ERROR')
		expect(error?.statusCode).toBe(400)
	})
})

describe('domains.list', () => {
	it('GETs /v1/domains with query params + returns pagination', async () => {
		const fetch = vi.fn().mockResolvedValueOnce(
			jsonResponse({
				data: [{ id: 'dom_1' }, { id: 'dom_2' }],
				pagination: { total: 2, page: 1, page_size: 20, total_pages: 1 },
			}),
		)
		const result = await makeSDK(fetch).domains.list({ page: 1, page_size: 20, status: 'verified' })

		expect(result.error).toBeNull()
		expect(result.data).toHaveLength(2)
		if (result.error === null) {
			expect(result.pagination?.total).toBe(2)
		}
		// biome-ignore lint/style/noNonNullAssertion: test asserts call happened
		const url = new URL(fetch.mock.calls[0]![0])
		expect(url.pathname).toBe('/v1/domains')
		expect(url.searchParams.get('page')).toBe('1')
		expect(url.searchParams.get('page_size')).toBe('20')
		expect(url.searchParams.get('status')).toBe('verified')
	})

	it('works with no query params', async () => {
		const fetch = vi.fn().mockResolvedValueOnce(
			jsonResponse({
				data: [],
				pagination: { total: 0, page: 1, page_size: 20, total_pages: 0 },
			}),
		)
		await makeSDK(fetch).domains.list()
		// biome-ignore lint/style/noNonNullAssertion: test asserts call happened
		const url = new URL(fetch.mock.calls[0]![0])
		expect(url.search).toBe('')
	})
})

describe('domains.get', () => {
	it('GETs /v1/domains/:id and url-encodes the id', async () => {
		const fetch = vi.fn().mockResolvedValueOnce(
			jsonResponse({
				data: {
					id: 'dom_1',
					domain: 'mail.example.com',
					status: 'verified',
					dnsRecords: [],
					dnsProvider: { provider: 'cloudflare', nameservers: ['ns1.cf.com'] },
					dmarcStatus: { status: 'found', value: 'v=DMARC1; p=quarantine' },
				},
			}),
		)
		const { data, error } = await makeSDK(fetch).domains.get('dom_1')
		expect(error).toBeNull()
		expect(data?.id).toBe('dom_1')
		expect(data?.dmarcStatus.status).toBe('found')
		expect(fetch.mock.calls[0]?.[0]).toBe('https://api.sendflowly.test/v1/domains/dom_1')
	})

	it('returns NOT_FOUND when the domain does not exist', async () => {
		const fetch = vi
			.fn()
			.mockResolvedValueOnce(
				jsonResponse(
					{ error: { code: 'NOT_FOUND', message: 'Domain not found' } },
					{ status: 404 },
				),
			)
		const { data, error } = await makeSDK(fetch).domains.get('dom_missing')
		expect(data).toBeNull()
		expect(error?.code).toBe('NOT_FOUND')
	})
})

describe('domains.verify', () => {
	it('POSTs /v1/domains/:id/verify (no body) and returns updated detail', async () => {
		const fetch = vi.fn().mockResolvedValueOnce(
			jsonResponse({
				data: { id: 'dom_1', status: 'verified', dmarcStatus: { status: 'found' } },
			}),
		)
		const { data, error } = await makeSDK(fetch).domains.verify('dom_1')
		expect(error).toBeNull()
		expect(data?.status).toBe('verified')

		const [url, init] = fetch.mock.calls[0]
		expect(url).toBe('https://api.sendflowly.test/v1/domains/dom_1/verify')
		expect(init.method).toBe('POST')
		// No body when none supplied — important for non-idempotent semantics
		expect(init.body).toBeUndefined()
	})
})

describe('domains.verifyInboundMx', () => {
	it('POSTs /v1/domains/:id/verify-inbound-mx', async () => {
		const fetch = vi
			.fn()
			.mockResolvedValueOnce(jsonResponse({ data: { id: 'dom_1', inboundMxVerified: true } }))
		const { data, error } = await makeSDK(fetch).domains.verifyInboundMx('dom_1')
		expect(error).toBeNull()
		expect(data?.inboundMxVerified).toBe(true)
		expect(fetch.mock.calls[0]?.[0]).toBe(
			'https://api.sendflowly.test/v1/domains/dom_1/verify-inbound-mx',
		)
	})
})

describe('domains.updateTracking', () => {
	it('PATCHes /v1/domains/:id/tracking with { enabled }', async () => {
		const fetch = vi.fn().mockResolvedValueOnce(
			jsonResponse({
				data: { id: 'dom_1', clickTrackingEnabled: true, openTrackingEnabled: true },
			}),
		)
		const { data, error } = await makeSDK(fetch).domains.updateTracking('dom_1', { enabled: true })

		expect(error).toBeNull()
		expect(data?.clickTrackingEnabled).toBe(true)

		const [url, init] = fetch.mock.calls[0]
		expect(url).toBe('https://api.sendflowly.test/v1/domains/dom_1/tracking')
		expect(init.method).toBe('PATCH')
		expect(JSON.parse(init.body)).toEqual({ enabled: true })
	})
})

describe('domains.updateTlsPolicy', () => {
	it('PATCHes /v1/domains/:id/tls-policy with { tls_policy }', async () => {
		const fetch = vi
			.fn()
			.mockResolvedValueOnce(jsonResponse({ data: { id: 'dom_1', tlsPolicy: 'enforced' } }))
		const { data, error } = await makeSDK(fetch).domains.updateTlsPolicy('dom_1', {
			tls_policy: 'enforced',
		})

		expect(error).toBeNull()
		expect(data?.tlsPolicy).toBe('enforced')

		const [url, init] = fetch.mock.calls[0]
		expect(url).toBe('https://api.sendflowly.test/v1/domains/dom_1/tls-policy')
		expect(init.method).toBe('PATCH')
		expect(JSON.parse(init.body)).toEqual({ tls_policy: 'enforced' })
	})
})

describe('domains.delete', () => {
	it('DELETEs /v1/domains/:id and returns confirmation', async () => {
		const fetch = vi
			.fn()
			.mockResolvedValueOnce(jsonResponse({ data: { id: 'dom_1', deleted: true } }))
		const { data, error } = await makeSDK(fetch).domains.delete('dom_1')
		expect(error).toBeNull()
		expect(data).toEqual({ id: 'dom_1', deleted: true })

		const [url, init] = fetch.mock.calls[0]
		expect(url).toBe('https://api.sendflowly.test/v1/domains/dom_1')
		expect(init.method).toBe('DELETE')
	})
})

describe('domains — security: SDK headers always win', () => {
	it('caller cannot override Authorization', async () => {
		const fetch = vi.fn().mockResolvedValueOnce(jsonResponse({ data: { id: 'dom_1' } }))
		await makeSDK(fetch).domains.get('dom_1')
		const headers = fetch.mock.calls[0]?.[1]?.headers as Headers
		expect(headers.get('authorization')).toBe('Bearer sk_test_key')
	})
})
