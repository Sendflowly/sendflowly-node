import type { SendflowlyError } from './errors'

/**
 * Pagination metadata returned alongside list responses.
 *
 * Field names are snake_case to match the API wire format exactly — no
 * normalization, so the response shape in your code matches what you see in
 * the browser DevTools or `curl` output.
 *
 * Kept structurally identical to `PaginationMeta` in `@sendflowly/shared/types`
 * but defined locally here so the published SDK has no workspace dependency.
 */
export interface PaginationMeta {
	total: number
	page: number
	page_size: number
	total_pages: number
}

/**
 * Every SDK call resolves to this shape. The `data` / `error` fields are a
 * discriminated union: exactly one is non-null. TypeScript narrows the type
 * automatically after an `if (error)` check, so no `!` non-null assertions
 * are needed at call sites.
 *
 * For paginated endpoints, `pagination` is present alongside `data`. Single-
 * resource endpoints omit it.
 *
 * @example
 * ```ts
 * const { data, error } = await sf.emails.send({ ... })
 * if (error) {
 *   console.error(`[${error.requestId}] ${error.code}: ${error.message}`)
 *   return
 * }
 * console.log(`Sent: ${data.id}`) // data is typed, no '!' needed
 * ```
 */
export type SendflowlyResponse<T> =
	| {
			data: T
			error: null
			headers: Record<string, string>
			pagination?: PaginationMeta
			/**
			 * Endpoint-specific metadata returned alongside `data`. Currently only
			 * the `analytics.*` endpoints populate this (with `{ range: ... }`
			 * describing the actual date window used by the server, including a
			 * `clamped` flag if it was reduced due to plan retention). Typed as
			 * `unknown` here because the shape varies per endpoint; resource
			 * methods cast to the appropriate typed shape when needed.
			 */
			meta?: unknown
	  }
	| {
			data: null
			error: SendflowlyError
			headers: Record<string, string>
	  }
