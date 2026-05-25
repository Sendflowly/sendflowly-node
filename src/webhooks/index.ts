// Sendflowly SDK — webhook verifier sub-path entry.
//
// Importing from `@sendflowly/sdk/webhooks` instead of the main entry lets
// webhook-only consumers tree-shake away the HTTP client and only pay for
// signature verification.

// Re-export svix's `Webhook` class as an escape hatch for advanced users who
// need direct access (custom timestamp tolerance, manual signature creation
// for testing, etc.). Most users should call `verifyWebhook()`.
export { Webhook } from 'svix'
export {
	type VerifyWebhookOptions,
	verifyWebhook,
	WebhookVerificationError,
} from './verify'
