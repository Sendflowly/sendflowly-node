/**
 * Framework-level error codes the Sendflowly API emits in the
 * `{ error: { code } }` response envelope.
 *
 * Kept in sync with `STANDARD_API_ERROR_CODES` in `@sendflowly/shared/constants`.
 * Defined locally rather than imported so the published SDK has no workspace
 * dependencies — see the plan's discussion of why workspace imports cross the
 * dts-resolution boundary unreliably.
 */
type StandardApiErrorCode =
	| 'VALIDATION_ERROR'
	| 'UNAUTHORIZED'
	| 'FORBIDDEN'
	| 'NOT_FOUND'
	| 'CONFLICT'
	| 'RATE_LIMITED'
	| 'INTERNAL_ERROR'

/**
 * Code attached to a failed Sendflowly response.
 *
 * Three sources of codes:
 * - **Standard API codes** — framework-level codes the API always emits
 *   (`UNAUTHORIZED`, `NOT_FOUND`, etc.). Listed in the type above.
 * - **SDK-synthetic codes** — created by the SDK when the failure happens
 *   around the HTTP call rather than from the API itself (`NETWORK_ERROR`,
 *   `TIMEOUT_ERROR`).
 * - **Domain-specific codes** — strings the API emits for specific domains
 *   (`SES_SEND_FAILED`, `BILLING_NOT_CONFIGURED`, etc.). Pass through as
 *   strings; the `(string & {})` keeps autocomplete on the known codes
 *   while still accepting any string at the type level.
 */
// The `(string & {})` member preserves IDE autocomplete on the named union
// members above while still accepting any string at the type level. It's the
// idiomatic TS escape hatch for "literal union OR any string." Biome's
// current ruleset does not flag this pattern.
export type SendflowlyErrorCode =
	| StandardApiErrorCode
	| 'NETWORK_ERROR'
	| 'TIMEOUT_ERROR'
	| (string & {})

export interface SendflowlyError {
	/** Machine-readable code. See {@link SendflowlyErrorCode}. */
	code: SendflowlyErrorCode
	/** Human-readable message from the API or the SDK. Safe to display to developers; do NOT show to end users. */
	message: string
	/** HTTP status code if the failure happened during/after the response. `null` for pre-flight/network failures. */
	statusCode: number | null
	/** Value of the `X-Request-Id` response header. Quote this in support tickets. */
	requestId: string | null
}
