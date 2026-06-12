import { type Mock, vi } from 'vitest'

/**
 * Build a `Response` with JSON body for use in mocked `fetch` returns.
 * Defaults to 200 OK with `content-type: application/json` so the SDK's
 * envelope parser is happy.
 */
export function jsonResponse(
	body: unknown,
	init: { status?: number; headers?: Record<string, string> } = {},
): Response {
	const headers = new Headers({
		'content-type': 'application/json',
		'x-request-id': 'req_test_default',
		...init.headers,
	})
	return new Response(JSON.stringify(body), {
		status: init.status ?? 200,
		headers,
	})
}

/**
 * Build a `Response` with a non-JSON body (e.g., to simulate a server that
 * returned HTML on a 500). Forces the SDK's parse-fallback path.
 */
export function textResponse(
	body: string,
	init: { status?: number; headers?: Record<string, string> } = {},
): Response {
	return new Response(body, {
		status: init.status ?? 200,
		headers: new Headers({ 'content-type': 'text/plain', ...init.headers }),
	})
}

/**
 * Build a chain of mocked fetch responses, in order. The first call returns
 * the first response, the second returns the second, etc.
 */
export function mockFetchSequence(
	...responses: Array<Response | (() => Response) | Error>
): Mock<typeof globalThis.fetch> {
	const fn = vi.fn<typeof globalThis.fetch>()
	for (const r of responses) {
		if (r instanceof Error) {
			fn.mockRejectedValueOnce(r)
		} else if (typeof r === 'function') {
			fn.mockImplementationOnce(async () => r())
		} else {
			fn.mockResolvedValueOnce(r)
		}
	}
	return fn
}
