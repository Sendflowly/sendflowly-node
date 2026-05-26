// Types for the Domains resource. Mirrors the wire shapes returned by
// the API's `/v1/domains/*` endpoints.
//
// Field-case convention here is **camelCase** on the wire (unlike emails,
// which uses snake_case). This matches how the domain DTOs are mapped in
// `apps/api/src/domains/sending-domains/dto/domain.dto.ts`. Inputs use
// snake_case where the API's Zod validator does (`return_path`, `tls_policy`).
//
// Canonical sources kept in sync with:
//   - apps/api/src/domains/sending-domains/domain.routes.ts
//   - packages/shared/src/validators/domain.validator.ts
//   - packages/shared/src/types/domain.types.ts

/**
 * Region a sending domain lives in. Read-side accepts all supported regions;
 * create-time the API only accepts a subset (`AVAILABLE_REGIONS`) — passing
 * an unavailable region returns a validation error with the current list.
 */
export type Region =
	| 'us-east-1'
	| 'eu-central-1'
	| 'ap-southeast-1'
	// `(string & {})` preserves IDE autocomplete on the named members while accepting any string
	| (string & {})

/**
 * TLS policy controlling whether SES requires encryption to receiving servers.
 * `opportunistic` = attempt TLS, fall back to plaintext (recommended).
 * `enforced` = require TLS or fail delivery (use for sensitive sends).
 */
export type TlsPolicy = 'opportunistic' | 'enforced'

/**
 * Domain verification status as reported by the API.
 *
 * - `pending` — created, awaiting first DNS check
 * - `verifying` — DNS records detected, awaiting SES confirmation
 * - `verified` — fully verified and ready to send
 * - `failed` — DNS records missing or mismatched
 */
export type DomainStatus =
	| 'pending'
	| 'verifying'
	| 'verified'
	| 'failed'
	// `(string & {})` preserves IDE autocomplete on the named members while accepting any string
	| (string & {})

/**
 * Argument to `sendflowly.domains.create()`.
 *
 * Field-case is snake_case to match the API's input validator. Outputs from
 * create/list/get/etc. use camelCase per the wire format — that's not a bug,
 * it mirrors the API's actual asymmetry.
 */
export interface CreateDomainRequest {
	/** Apex or subdomain to verify (e.g. `mail.example.com`). 3-255 chars, valid DNS shape. */
	domain: string
	/** AWS region the domain's SES identity will live in. */
	region: Region
	/** Custom subdomain for the SES Return-Path (bounce-handling). Defaults to `mail`. Lowercase alphanumeric + hyphens, no edge hyphens. */
	return_path?: string
	/** Defaults to `opportunistic`. */
	tls_policy?: TlsPolicy
}

/** Query parameters for `sendflowly.domains.list()`. All optional. */
export interface ListDomainsQuery {
	/** 1-indexed page. Default 1. */
	page?: number
	/** Default 20, max 100. */
	page_size?: number
	status?: DomainStatus
}

/** Body for `sendflowly.domains.updateTracking()`. */
export interface UpdateTrackingRequest {
	/** Master toggle for both click and open tracking on this domain. */
	enabled: boolean
}

/** Body for `sendflowly.domains.updateTlsPolicy()`. */
export interface UpdateTlsPolicyRequest {
	tls_policy: TlsPolicy
}

/**
 * A single DNS record the user needs to configure to verify the domain.
 * `purpose` indicates which feature the record powers.
 */
export interface DnsRecord {
	type: 'CNAME' | 'TXT' | 'MX'
	name: string
	value: string
	priority?: number
	purpose: 'DKIM' | 'SPF' | 'MX' | 'INBOUND_MX'
	/** Verification status of this specific record. Present after a check has run. */
	status?: 'verified' | 'missing' | 'mismatch' | 'pending'
	/** Free-form diagnostic message when status is `missing`/`mismatch`. */
	diagnostic?: string
	/** What we actually found at this DNS name (when checked + non-empty). */
	found?: string | null
}

export interface DnsProviderInfo {
	/** DNS provider name we detected, or null if unknown. */
	provider: string | null
	nameservers: string[]
}

export interface DmarcStatus {
	status: 'found' | 'missing'
	/** Current DMARC TXT record value, if found. */
	value?: string
	diagnostic?: string
}

/**
 * Base domain object. Returned by `list()` and `updateTracking()`/`updateTlsPolicy()`.
 *
 * Never includes secret fields (DKIM private key, SES tenant name, etc.) —
 * those are server-side internal and stripped by the API's Output DTO.
 */
export interface Domain {
	id: string
	domain: string
	region: Region
	status: DomainStatus
	returnPathSubdomain: string
	clickTrackingEnabled: boolean
	openTrackingEnabled: boolean
	tlsPolicy: TlsPolicy
	inboundMxVerified: boolean
	/** ISO 8601 timestamp the domain was first verified. Null until verification succeeds. */
	verifiedAt: string | null
	/** ISO 8601 timestamp of the last verification attempt (success or failure). */
	lastCheckedAt: string | null
	createdAt: string
	updatedAt: string
}

/** Returned by `create()` — includes the DNS records the user needs to add to verify. */
export interface DomainWithDns extends Domain {
	dnsRecords: DnsRecord[]
	dnsProvider: DnsProviderInfo
}

/** Returned by `get()` and `verify()` / `verifyInboundMx()` — full status. */
export interface DomainDetail extends DomainWithDns {
	dmarcStatus: DmarcStatus
}

/** Returned by `delete()` — confirmation envelope. */
export interface DomainDeleteResult {
	id: string
	deleted: true
}
