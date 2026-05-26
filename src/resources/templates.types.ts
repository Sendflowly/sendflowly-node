// Types for the Templates resource. Mirrors `/v1/templates/*` endpoints.
//
// Wire conventions on this resource are intentionally MIXED on the input
// side (documented in the API's validator):
//   - `html_body` + `text_body` are snake_case — these predate the M2e
//     template-builder refactor and have legacy clients depending on the names
//   - `designJson` + `previewText` are camelCase — newer fields added at a
//     time when the team had switched conventions; the API just kept both
// Output side is fully camelCase. The SDK mirrors this asymmetry exactly
// rather than papering over it.
//
// Canonical sources:
//   - apps/api/src/domains/templates/template.routes.ts (mounts)
//   - packages/shared/src/validators/template.validator.ts (input shape)
//   - apps/api/src/domains/templates/dto/*.ts (output shapes)
//   - packages/shared/src/types/template.types.ts (cross-cutting types)

/**
 * The kind of value a template variable expects. Used by the builder UI
 * for input hints; the actual substitution at send time is still string
 * interpolation regardless of the declared type.
 */
export type TemplateVariableType = 'string' | 'number' | 'boolean' | 'url'

/**
 * A declared variable on a template. Variables are declared up front
 * (not discovered by regex at send time). `fallback` is interpolated when
 * a `sendflowly.emails.send()` call's `variables` map omits this key.
 *
 * The API accepts a legacy `string[]` shape too (each entry becomes
 * `{ name, type: 'string' }`), but the SDK only exposes the canonical
 * typed form. If you need to send legacy `string[]`, cast through `unknown`.
 */
export interface TemplateVariable {
	name: string
	type: TemplateVariableType
	/** Default value used at send time when this variable isn't supplied. Max 500 chars. */
	fallback?: string
}

/**
 * Argument to `sendflowly.templates.create()`. Note the mixed casing on
 * `html_body` / `text_body` (legacy snake_case) vs `designJson` / `previewText`
 * (newer camelCase) — see file-level comment.
 */
export interface CreateTemplateRequest {
	/** Display name shown in the dashboard + APIs. 1-100 chars. */
	name: string
	/** Default subject line. Supports `{{ variable_name }}` substitution. 1-500 chars. */
	subject: string
	html_body?: string
	text_body?: string
	variables?: TemplateVariable[]
	/**
	 * Opaque builder-state object — the dashboard's template builder owns the
	 * shape. The API just round-trips it through `jsonb`. Pass whatever your
	 * builder emits; pass `null` to clear.
	 */
	designJson?: Record<string, unknown> | null
	/** Inbox-preview text (the bit that shows next to the subject in most clients). Max 500 chars. */
	previewText?: string | null
}

/**
 * Body for `sendflowly.templates.update()`. Same shape as create but all
 * fields are optional — pass only what changes.
 */
export type UpdateTemplateRequest = Partial<CreateTemplateRequest>

/** Query parameters for `sendflowly.templates.list()`. */
export interface ListTemplatesQuery {
	/** 1-indexed page. Default 1. */
	page?: number
	/** Default 20, max 100. */
	page_size?: number
}

/**
 * Lightweight list-row representation. Omits the heavy body / design fields
 * for fast listing. Use `templates.get(id)` for the full record.
 */
export interface TemplateListItem {
	id: string
	name: string
	subject: string
	variables: TemplateVariable[] | null
	createdAt: string
	updatedAt: string
}

/**
 * Full template record returned by `create()`, `get()`, and `update()`.
 *
 * `htmlBody` / `textBody` are nullable for templates that exclusively use
 * the visual builder (where the source-of-truth is `designJson`, and HTML
 * is regenerated on demand).
 */
export interface Template {
	id: string
	name: string
	subject: string
	htmlBody: string | null
	textBody: string | null
	variables: TemplateVariable[] | null
	designJson: Record<string, unknown> | null
	previewText: string | null
	createdAt: string
	updatedAt: string
}

/** Returned by `sendflowly.templates.delete()` — confirmation envelope. */
export interface TemplateDeleteResult {
	id: string
}
