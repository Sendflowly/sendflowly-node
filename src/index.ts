export { Sendflowly, type SendflowlyOptions } from './client'
export type { RequestOptions } from './http'
export { Analytics } from './resources/analytics'
export type {
	AnalyticsDailyPoint,
	AnalyticsDailyQuery,
	AnalyticsOverview,
	AnalyticsOverviewQuery,
	AnalyticsPeriod,
	AnalyticsRangeMeta,
	AnalyticsResponseMeta,
} from './resources/analytics.types'
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
export { Suppressions } from './resources/suppressions'
export type {
	AddSuppressionRequest,
	BulkAddSuppressionsRequest,
	BulkAddSuppressionsResult,
	ListSuppressionsQuery,
	Suppression,
	SuppressionCheckResult,
	SuppressionDeleteResult,
	SuppressionReason,
} from './resources/suppressions.types'
export { Templates } from './resources/templates'
export type {
	CreateTemplateRequest,
	ListTemplatesQuery,
	Template,
	TemplateDeleteResult,
	TemplateListItem,
	TemplateVariable,
	TemplateVariableType,
	UpdateTemplateRequest,
} from './resources/templates.types'
export { Webhooks } from './resources/webhooks'
export type {
	CreateWebhookRequest,
	ListWebhooksQuery,
	UpdateWebhookRequest,
	Webhook,
	WebhookDeleteResult,
	WebhookEvent,
	WebhookStatus,
	WebhookTestResult,
	WebhookWithSecret,
} from './resources/webhooks.types'
export type {
	PaginationMeta,
	SendflowlyError,
	SendflowlyErrorCode,
	SendflowlyResponse,
} from './types'
export { VERSION } from './version'
