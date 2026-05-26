import { HttpClient, type RequestOptions } from './http'
import { Domains } from './resources/domains'
import { Emails } from './resources/emails'
import type { SendflowlyResponse } from './types/response'
import { VERSION } from './version'

const DEFAULT_BASE_URL = 'https://api.sendflowly.com'
const DEFAULT_TIMEOUT_MS = 30_000
const DEFAULT_MAX_RETRIES = 2

export interface SendflowlyOptions {
	/**
	 * Override the API base URL. Useful for self-hosted deployments or pointing
	 * at a staging environment. Must be `https://` unless the host is
	 * `localhost` or `127.0.0.1`.
	 *
	 * @default 'https://api.sendflowly.com'
	 */
	baseUrl?: string
	/**
	 * Per-request timeout in milliseconds. The request is aborted (and retried,
	 * if eligible) when it elapses.
	 *
	 * @default 30_000
	 */
	timeout?: number
	/**
	 * Maximum retries on 5xx/429/network errors. Set to `0` to disable retries.
	 * Non-idempotent POST requests without an `idempotencyKey` are NEVER retried
	 * regardless of this setting.
	 *
	 * @default 2
	 */
	maxRetries?: number
	/**
	 * Custom `fetch` implementation. Defaults to `globalThis.fetch`. Override
	 * for testing (e.g., `vitest-fetch-mock`) or unusual runtimes.
	 */
	fetch?: typeof globalThis.fetch
	/**
	 * Appended to the SDK's default User-Agent, in the form
	 * `sendflowly-sdk/<version> <userAgent>`. Use this to identify your app
	 * in our logs.
	 */
	userAgent?: string
}

/**
 * Sendflowly SDK client.
 *
 * @example
 * ```ts
 * import { Sendflowly } from '@sendflowly/sdk'
 *
 * const sendflowly = new Sendflowly('sk_live_...')
 *
 * const { data, error } = await sendflowly.emails.send({
 *   from: 'hi@yourdomain.com',
 *   to: 'user@example.com',
 *   subject: 'Hello',
 *   html: '<p>Hi</p>',
 * })
 *
 * if (error) {
 *   console.error(`[${error.requestId}] ${error.code}: ${error.message}`)
 *   return
 * }
 * console.log(`Sent: ${data.id}`)
 * ```
 */
export class Sendflowly {
	readonly #http: HttpClient

	// Resources are eagerly constructed. Object init is cheap; lazy getters
	// would buy nothing in return for added complexity. Each resource holds
	// a reference back to `this` and dispatches calls through the public
	// transport methods (post/get/etc.) below.
	readonly emails: Emails
	readonly domains: Domains

	constructor(apiKey: string, options: SendflowlyOptions = {}) {
		if (!apiKey || typeof apiKey !== 'string') {
			throw new Error(
				'Sendflowly: missing API key. Pass it to the constructor: `new Sendflowly("sk_live_...")`.',
			)
		}

		const baseUrl = options.baseUrl ?? DEFAULT_BASE_URL
		assertValidBaseUrl(baseUrl)

		const userAgent = options.userAgent
			? `sendflowly-sdk/${VERSION} ${options.userAgent}`
			: `sendflowly-sdk/${VERSION}`

		this.#http = new HttpClient({
			apiKey,
			baseUrl,
			timeout: options.timeout ?? DEFAULT_TIMEOUT_MS,
			maxRetries: options.maxRetries ?? DEFAULT_MAX_RETRIES,
			fetch: options.fetch ?? globalThis.fetch.bind(globalThis),
			userAgent,
		})

		this.emails = new Emails(this)
		this.domains = new Domains(this)
	}

	get<T>(path: string, options?: RequestOptions): Promise<SendflowlyResponse<T>> {
		return this.#http.get<T>(path, options)
	}

	post<T>(path: string, body?: unknown, options?: RequestOptions): Promise<SendflowlyResponse<T>> {
		return this.#http.post<T>(path, body, options)
	}

	patch<T>(path: string, body: unknown, options?: RequestOptions): Promise<SendflowlyResponse<T>> {
		return this.#http.patch<T>(path, body, options)
	}

	put<T>(path: string, body: unknown, options?: RequestOptions): Promise<SendflowlyResponse<T>> {
		return this.#http.put<T>(path, body, options)
	}

	delete<T>(
		path: string,
		body?: unknown,
		options?: RequestOptions,
	): Promise<SendflowlyResponse<T>> {
		return this.#http.delete<T>(path, body, options)
	}
}

function assertValidBaseUrl(baseUrl: string): void {
	let url: URL
	try {
		url = new URL(baseUrl)
	} catch {
		throw new Error(`Sendflowly: invalid baseUrl "${baseUrl}" — must be a valid URL.`)
	}
	if (url.protocol !== 'https:' && url.protocol !== 'http:') {
		throw new Error(
			`Sendflowly: invalid baseUrl "${baseUrl}" — protocol must be https:// (or http:// for localhost).`,
		)
	}
	const isLocalhost = url.hostname === 'localhost' || url.hostname === '127.0.0.1'
	if (url.protocol === 'http:' && !isLocalhost) {
		throw new Error(
			`Sendflowly: baseUrl "${baseUrl}" must use https://. http:// is only allowed for localhost.`,
		)
	}
}
