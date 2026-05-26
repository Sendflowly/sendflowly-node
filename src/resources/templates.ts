import type { Sendflowly } from '../client'
import type { SendflowlyResponse } from '../types/response'
import type {
	CreateTemplateRequest,
	ListTemplatesQuery,
	Template,
	TemplateDeleteResult,
	TemplateListItem,
	UpdateTemplateRequest,
} from './templates.types'

/**
 * Templates resource — wraps `/v1/templates/*` endpoints.
 *
 * Access via `sendflowly.templates`. Do not instantiate directly.
 *
 * Templates are pre-defined email bodies + subject lines with declared
 * variables. Reference one from `sendflowly.emails.send()` by `template_id`
 * and supply per-call `variables` to substitute into `{{ name }}` markers.
 */
export class Templates {
	constructor(private readonly client: Sendflowly) {}

	/**
	 * Create a new template.
	 *
	 * @example
	 * ```ts
	 * const { data, error } = await sendflowly.templates.create({
	 *   name: 'Welcome email',
	 *   subject: 'Welcome to {{ company_name }}, {{ first_name }}!',
	 *   html_body: '<p>Hi {{ first_name }}, welcome aboard.</p>',
	 *   variables: [
	 *     { name: 'company_name', type: 'string', fallback: 'our app' },
	 *     { name: 'first_name', type: 'string' },
	 *   ],
	 * })
	 * ```
	 */
	create(payload: CreateTemplateRequest): Promise<SendflowlyResponse<Template>> {
		return this.client.post<Template>('/v1/templates', payload)
	}

	/**
	 * List templates for the authenticated organization. Paginated.
	 * Returns lightweight list rows — `htmlBody` / `textBody` / `designJson` /
	 * `previewText` are omitted for speed. Use `get(id)` for full records.
	 */
	list(query: ListTemplatesQuery = {}): Promise<SendflowlyResponse<TemplateListItem[]>> {
		// Cast: `ListTemplatesQuery`'s named fields don't structurally match
		// `Record<string, primitive | undefined | null>` under `exactOptionalPropertyTypes`.
		return this.client.get<TemplateListItem[]>('/v1/templates', {
			query: query as Record<string, string | number | boolean | undefined | null>,
		})
	}

	/** Get the full template record by id, including body + design + preview text. */
	get(id: string): Promise<SendflowlyResponse<Template>> {
		return this.client.get<Template>(`/v1/templates/${encodeURIComponent(id)}`)
	}

	/**
	 * Partially update a template. Pass only the fields you want to change.
	 * Passing `designJson: null` or `previewText: null` explicitly clears them.
	 */
	update(id: string, body: UpdateTemplateRequest): Promise<SendflowlyResponse<Template>> {
		return this.client.patch<Template>(`/v1/templates/${encodeURIComponent(id)}`, body)
	}

	/**
	 * Delete a template. Existing emails that referenced this template are
	 * unaffected — they captured the rendered body at send time.
	 */
	delete(id: string): Promise<SendflowlyResponse<TemplateDeleteResult>> {
		return this.client.delete<TemplateDeleteResult>(`/v1/templates/${encodeURIComponent(id)}`)
	}
}
