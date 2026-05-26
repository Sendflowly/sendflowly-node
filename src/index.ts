export { Sendflowly, type SendflowlyOptions } from './client'
export type { RequestOptions } from './http'
export { Domains } from './resources/domains'
export type {
	CreateDomainRequest,
	DmarcStatus,
	DnsProviderInfo,
	DnsRecord,
	Domain,
	DomainDeleteResult,
	DomainDetail,
	DomainStatus,
	DomainWithDns,
	ListDomainsQuery,
	Region,
	TlsPolicy,
	UpdateTlsPolicyRequest,
	UpdateTrackingRequest,
} from './resources/domains.types'
export { Emails, type SendOptions } from './resources/emails'
export type {
	Attachment,
	AttachmentDownloadUrl,
	BatchEmailResult,
	EmailDetail,
	EmailEvent,
	EmailEventType,
	EmailListItem,
	EmailStatus,
	ListEmailsQuery,
	SendEmailBatchRequest,
	SendEmailBatchResponse,
	SendEmailRequest,
	SendEmailResponse,
} from './resources/emails.types'
export type {
	PaginationMeta,
	SendflowlyError,
	SendflowlyErrorCode,
	SendflowlyResponse,
} from './types'
export { VERSION } from './version'
