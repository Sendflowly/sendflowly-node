import type { Sendflowly } from '../client'
import type { SendflowlyResponse } from '../types/response'
import type {
	CreateDomainRequest,
	Domain,
	DomainDeleteResult,
	DomainDetail,
	DomainWithDns,
	ListDomainsQuery,
	UpdateTlsPolicyRequest,
	UpdateTrackingRequest,
} from './domains.types'

/**
 * Domains resource — wraps `/v1/domains/*` endpoints.
 *
 * Access via `sendflowly.domains`. Do not instantiate directly.
 *
 * Domains are the sending identities Sendflowly verifies against AWS SES.
 * Each org has one or more sending domains; emails sent via `emails.send()`
 * must have a `from` address matching a verified domain.
 */
export class Domains {
	constructor(private readonly client: Sendflowly) {}

	/**
	 * Create a new sending domain. The response includes the DNS records you
	 * need to add at your DNS provider for the domain to verify.
	 *
	 * @example
	 * ```ts
	 * const { data, error } = await sendflowly.domains.create({
	 *   domain: 'mail.example.com',
	 *   region: 'eu-central-1',
	 * })
	 * if (data) {
	 *   for (const rec of data.dnsRecords) {
	 *     console.log(`${rec.type} ${rec.name} → ${rec.value}`)
	 *   }
	 * }
	 * ```
	 */
	create(payload: CreateDomainRequest): Promise<SendflowlyResponse<DomainWithDns>> {
		return this.client.post<DomainWithDns>('/v1/domains', payload)
	}

	/**
	 * List sending domains for the authenticated organization.
	 * Paginated; the response includes a `pagination` field alongside `data`.
	 */
	list(query: ListDomainsQuery = {}): Promise<SendflowlyResponse<Domain[]>> {
		// Cast: `ListDomainsQuery`'s named fields don't structurally match
		// `Record<string, primitive | undefined | null>` under `exactOptionalPropertyTypes`.
		return this.client.get<Domain[]>('/v1/domains', {
			query: query as Record<string, string | number | boolean | undefined | null>,
		})
	}

	/**
	 * Get a single domain by id, including current DNS verification status,
	 * DMARC status, and the list of expected DNS records.
	 */
	get(id: string): Promise<SendflowlyResponse<DomainDetail>> {
		return this.client.get<DomainDetail>(`/v1/domains/${encodeURIComponent(id)}`)
	}

	/**
	 * Re-check the domain's DKIM/SPF DNS records against the live DNS state.
	 * Used after you've added the records at your DNS provider, to confirm
	 * Sendflowly can see them. Returns the updated detail object.
	 */
	verify(id: string): Promise<SendflowlyResponse<DomainDetail>> {
		return this.client.post<DomainDetail>(`/v1/domains/${encodeURIComponent(id)}/verify`)
	}

	/**
	 * Re-check the domain's INBOUND MX record. Separate from `verify()` because
	 * inbound (receiving) is an opt-in feature; the MX record check is gated
	 * behind enabling inbound receiving on the domain.
	 */
	verifyInboundMx(id: string): Promise<SendflowlyResponse<DomainDetail>> {
		return this.client.post<DomainDetail>(`/v1/domains/${encodeURIComponent(id)}/verify-inbound-mx`)
	}

	/**
	 * Master switch for click + open tracking on this domain. Disabling
	 * removes tracking pixels and link rewriting from all subsequent sends.
	 */
	updateTracking(id: string, body: UpdateTrackingRequest): Promise<SendflowlyResponse<Domain>> {
		return this.client.patch<Domain>(`/v1/domains/${encodeURIComponent(id)}/tracking`, body)
	}

	/**
	 * Change the TLS policy for this domain's outbound sends.
	 * `opportunistic` (default) attempts TLS but falls back to plaintext.
	 * `enforced` requires TLS or fails delivery — use for sensitive emails.
	 */
	updateTlsPolicy(id: string, body: UpdateTlsPolicyRequest): Promise<SendflowlyResponse<Domain>> {
		return this.client.patch<Domain>(`/v1/domains/${encodeURIComponent(id)}/tls-policy`, body)
	}

	/**
	 * Delete a domain. Existing sends from this domain are preserved in your
	 * logs; only future sends are affected. Returns a `{ id, deleted: true }`
	 * confirmation envelope.
	 */
	delete(id: string): Promise<SendflowlyResponse<DomainDeleteResult>> {
		return this.client.delete<DomainDeleteResult>(`/v1/domains/${encodeURIComponent(id)}`)
	}
}
