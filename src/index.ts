export { Sendflowly, type SendflowlyOptions } from './client'
export type { RequestOptions } from './http'
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
