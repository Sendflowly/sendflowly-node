import type { SendflowlyError, SendflowlyErrorCode } from './types/errors'
import type { PaginationMeta, SendflowlyResponse } from './types/response'

// API envelope shapes. Mirrors the corresponding types in
// `@sendflowly/shared/types/api-responses.ts` but defined locally so the
// published SDK has no workspace dependencies.
interface ApiSuccessEnvelope {
	data: unknown
}
interface ApiPaginatedEnvelope {
	data: unknown
	pagination: PaginationMeta
}
interface ApiErrorEnvelope {
	error: { code: string; message: string; details?: unknown }
}

/** Configuration passed to `HttpClient` at construction time. */
export interface HttpClientConfig {
	apiKey: string
	baseUrl: string
	timeout: number
	maxRetries: number
	fetch: typeof globalThis.fetch
	userAgent: string
}

/** Per-call options. All optional. */
export interface RequestOptions {
	/**
	 * Sent as the `Idempotency-Key` header. Required to retry a POST safely —
	 * without it, POST requests are never retried (would risk double-sends).
	 */
	idempotencyKey?: string
	/** Caller-provided abort signal. Composed with the SDK's internal timeout signal. */
	signal?: AbortSignal
	/** Extra headers, merged on top of SDK-provided headers. Cannot override `Authorization`. */
	headers?: HeadersInit
	/** Query string parameters. `undefined` values are skipped. */
	query?: Record<string, string | number | boolean | undefined | null>
}

const RETRIABLE_STATUS = new Set([408, 429, 500, 502, 503, 504])
const IDEMPOTENT_METHODS = new Set(['GET', 'PUT', 'DELETE'])

/**
 * Low-level HTTP transport. Owned privately by `Sendflowly`; resources never
 * import this directly — they call public methods on the `Sendflowly` instance.
 *
 * Exposed here for direct unit testing in isolation from the main class.
 *
 * @internal
 */
export class HttpClient {
	readonly #config: HttpClientConfig

	constructor(config: HttpClientConfig) {
		this.#config = config
	}

	get<T>(path: string, options?: RequestOptions): Promise<SendflowlyResponse<T>> {
		return this.request<T>('GET', path, undefined, options)
	}

	post<T>(path: string, body?: unknown, options?: RequestOptions): Promise<SendflowlyResponse<T>> {
		return this.request<T>('POST', path, body, options)
	}

	patch<T>(path: string, body: unknown, options?: RequestOptions): Promise<SendflowlyResponse<T>> {
		return this.request<T>('PATCH', path, body, options)
	}

	put<T>(path: string, body: unknown, options?: RequestOptions): Promise<SendflowlyResponse<T>> {
		return this.request<T>('PUT', path, body, options)
	}

	delete<T>(
		path: string,
		body?: unknown,
		options?: RequestOptions,
	): Promise<SendflowlyResponse<T>> {
		return this.request<T>('DELETE', path, body, options)
	}

	async request<T>(
		method: string,
		path: string,
		body: unknown,
		options: RequestOptions = {},
	): Promise<SendflowlyResponse<T>> {
		const url = this.#buildUrl(path, options.query)
		const headers = this.#buildHeaders(method, options)
		// Conditional spread instead of `body: ... | undefined` because
		// `exactOptionalPropertyTypes` rejects undefined-valued optional fields.
		const init: RequestInit =
			body !== undefined ? { method, headers, body: JSON.stringify(body) } : { method, headers }

		// Retry policy: idempotent methods always retry; POST only retries when
		// the caller supplied an idempotency key. This is the single most
		// important safety property of this client — never retry a POST that
		// the server might re-execute.
		const canRetry =
			IDEMPOTENT_METHODS.has(method) || (method === 'POST' && options.idempotencyKey !== undefined)

		return this.#requestWithRetry<T>(url, init, options.signal, canRetry)
	}

	#buildUrl(path: string, query?: RequestOptions['query']): string {
		const url = new URL(path.startsWith('/') ? path : `/${path}`, this.#config.baseUrl)
		if (query) {
			for (const [key, value] of Object.entries(query)) {
				if (value !== undefined && value !== null) {
					url.searchParams.set(key, String(value))
				}
			}
		}
		return url.toString()
	}

	#buildHeaders(method: string, options: RequestOptions): Headers {
		const headers = new Headers(options.headers ?? {})
		// SDK-controlled headers always win — set them AFTER user headers so
		// callers can't override Authorization, Accept, etc.
		headers.set('Authorization', `Bearer ${this.#config.apiKey}`)
		headers.set('User-Agent', this.#config.userAgent)
		headers.set('Accept', 'application/json')
		if (method !== 'GET' && method !== 'DELETE') {
			headers.set('Content-Type', 'application/json')
		}
		if (options.idempotencyKey) {
			headers.set('Idempotency-Key', options.idempotencyKey)
		}
		return headers
	}

	async #requestWithRetry<T>(
		url: string,
		init: RequestInit,
		userSignal: AbortSignal | undefined,
		canRetry: boolean,
	): Promise<SendflowlyResponse<T>> {
		const attempts = canRetry ? this.#config.maxRetries + 1 : 1
		let lastResponse: Response | null = null

		for (let attempt = 0; attempt < attempts; attempt++) {
			const timeoutController = new AbortController()
			const timeoutId = setTimeout(() => timeoutController.abort(), this.#config.timeout)

			const signal = userSignal
				? composeSignals(userSignal, timeoutController.signal)
				: timeoutController.signal

			try {
				const response = await this.#config.fetch(url, { ...init, signal })
				clearTimeout(timeoutId)
				lastResponse = response

				if (response.ok) {
					return await this.#parseSuccess<T>(response)
				}

				if (canRetry && RETRIABLE_STATUS.has(response.status) && attempt < attempts - 1) {
					await sleep(backoff(attempt, response.headers.get('retry-after')))
					continue
				}

				return await this.#parseError<T>(response)
			} catch (err) {
				clearTimeout(timeoutId)
				const aborted = err instanceof Error && err.name === 'AbortError'

				// User-initiated abort never retries — caller wanted to stop.
				if (aborted && userSignal?.aborted) {
					return syntheticError<T>('NETWORK_ERROR', 'Request aborted by caller', lastResponse)
				}

				// Timeout or network error — retry if eligible.
				if (canRetry && attempt < attempts - 1) {
					await sleep(backoff(attempt))
					continue
				}

				if (aborted) {
					return syntheticError<T>(
						'TIMEOUT_ERROR',
						`Request timed out after ${this.#config.timeout}ms`,
						lastResponse,
					)
				}
				const message = err instanceof Error ? err.message : 'Network request failed'
				return syntheticError<T>('NETWORK_ERROR', message, lastResponse)
			}
		}

		/* c8 ignore next 2 — unreachable: loop above always returns or continues */
		return syntheticError<T>('NETWORK_ERROR', 'Request failed', lastResponse)
	}

	async #parseSuccess<T>(response: Response): Promise<SendflowlyResponse<T>> {
		const headers = headersToObject(response.headers)
		let json: unknown
		try {
			json = await response.json()
		} catch {
			return {
				data: null,
				error: {
					code: 'INTERNAL_ERROR',
					message: 'Failed to parse API response as JSON',
					statusCode: response.status,
					requestId: response.headers.get('x-request-id'),
				},
				headers,
			}
		}

		// Unwrap the `{ data, pagination? }` envelope into the SDK's response shape.
		if (isSuccessEnvelope(json)) {
			if ('pagination' in json && json.pagination !== undefined) {
				const list = json as ApiPaginatedEnvelope
				return {
					data: list.data as T,
					error: null,
					headers,
					pagination: list.pagination,
				}
			}
			return { data: (json as ApiSuccessEnvelope).data as T, error: null, headers }
		}

		// Some endpoints (e.g., 204 No Content) may return empty/unwrapped — pass through.
		return { data: json as T, error: null, headers }
	}

	async #parseError<T>(response: Response): Promise<SendflowlyResponse<T>> {
		const headers = headersToObject(response.headers)
		const requestId = response.headers.get('x-request-id')
		let envelope: unknown
		try {
			envelope = await response.json()
		} catch {
			// fall through — envelope undefined
		}

		const apiErr = isErrorEnvelope(envelope) ? envelope.error : null
		const error: SendflowlyError = {
			code: (apiErr?.code as SendflowlyErrorCode) ?? statusToCode(response.status),
			message: apiErr?.message ?? response.statusText ?? 'Request failed',
			statusCode: response.status,
			requestId,
		}
		return { data: null, error, headers }
	}
}

function headersToObject(headers: Headers): Record<string, string> {
	const obj: Record<string, string> = {}
	headers.forEach((value, key) => {
		obj[key] = value
	})
	return obj
}

function isSuccessEnvelope(value: unknown): value is ApiSuccessEnvelope {
	return typeof value === 'object' && value !== null && 'data' in value
}

function isErrorEnvelope(value: unknown): value is ApiErrorEnvelope {
	return (
		typeof value === 'object' &&
		value !== null &&
		'error' in value &&
		typeof (value as { error: unknown }).error === 'object'
	)
}

function statusToCode(status: number): SendflowlyErrorCode {
	if (status === 401) return 'UNAUTHORIZED'
	if (status === 403) return 'FORBIDDEN'
	if (status === 404) return 'NOT_FOUND'
	if (status === 409) return 'CONFLICT'
	if (status === 400 || status === 422) return 'VALIDATION_ERROR'
	if (status === 429) return 'RATE_LIMITED'
	return 'INTERNAL_ERROR'
}

function syntheticError<T>(
	code: SendflowlyErrorCode,
	message: string,
	response: Response | null,
): SendflowlyResponse<T> {
	return {
		data: null,
		error: {
			code,
			message,
			statusCode: response?.status ?? null,
			requestId: response?.headers.get('x-request-id') ?? null,
		},
		headers: response ? headersToObject(response.headers) : {},
	}
}

const BACKOFF_BASE_MS = 250
const BACKOFF_MAX_MS = 30_000

function backoff(attempt: number, retryAfter?: string | null): number {
	if (retryAfter) {
		const seconds = Number.parseInt(retryAfter, 10)
		if (Number.isFinite(seconds) && seconds > 0) {
			return Math.min(seconds * 1000, BACKOFF_MAX_MS)
		}
	}
	// Full jitter: random(0, base * 2^attempt), capped at 30s.
	// Better than fixed exponential under load — spreads retries across the window
	// instead of slamming the server at predictable intervals.
	return Math.random() * Math.min(BACKOFF_BASE_MS * 2 ** attempt, BACKOFF_MAX_MS)
}

function sleep(ms: number): Promise<void> {
	return new Promise((resolve) => setTimeout(resolve, ms))
}

/**
 * Combine two abort signals into one. The returned signal fires when EITHER
 * input signal fires. Used to compose caller signal + SDK timeout signal.
 *
 * `AbortSignal.any([...])` is the platform API but not available in Node < 20.6.
 * This polyfill keeps us compatible with all our runtime targets.
 */
function composeSignals(a: AbortSignal, b: AbortSignal): AbortSignal {
	if (typeof AbortSignal !== 'undefined' && typeof AbortSignal.any === 'function') {
		return AbortSignal.any([a, b])
	}
	const controller = new AbortController()
	const onAbort = (): void => controller.abort()
	if (a.aborted || b.aborted) {
		controller.abort()
	} else {
		a.addEventListener('abort', onAbort, { once: true })
		b.addEventListener('abort', onAbort, { once: true })
	}
	return controller.signal
}
