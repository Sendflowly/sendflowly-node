import { Webhook } from 'svix'
import { describe, expect, it } from 'vitest'
import { verifyWebhook, WebhookVerificationError } from '../../src/webhooks/verify'

// A valid base64-encoded test secret. svix's `Webhook` class requires this
// shape (it base64-decodes internally before HMAC).
const TEST_SECRET = 'whsec_MfKQ9r8GKYqrTwjUPD8ILPZIo2LaLaSw'

/**
 * Produce a signed Standard Webhooks header trio for a given payload.
 * Used by tests to simulate what our API's webhook delivery system emits.
 */
function signPayload(payload: string, secret: string = TEST_SECRET) {
	const wh = new Webhook(secret)
	const id = `msg_${Math.random().toString(36).slice(2)}`
	const timestampDate = new Date()
	const signature = wh.sign(id, timestampDate, payload)
	const timestamp = String(Math.floor(timestampDate.getTime() / 1000))
	return { id, timestamp, signature }
}

describe('verifyWebhook — happy path', () => {
	it('verifies a valid signature and returns the parsed JSON payload', () => {
		const payload = JSON.stringify({ type: 'email.sent', data: { id: 'em_1' } })
		const { id, timestamp, signature } = signPayload(payload)

		const result = verifyWebhook({
			payload,
			headers: {
				'svix-id': id,
				'svix-timestamp': timestamp,
				'svix-signature': signature,
			},
			secret: TEST_SECRET,
		})

		expect(result).toEqual({ type: 'email.sent', data: { id: 'em_1' } })
	})

	it('returns the payload typed via the TPayload generic', () => {
		interface EmailSent {
			type: 'email.sent'
			data: { id: string }
		}
		const payload = JSON.stringify({ type: 'email.sent', data: { id: 'em_typed' } })
		const headers = signPayload(payload)

		const result = verifyWebhook<EmailSent>({
			payload,
			headers: {
				'svix-id': headers.id,
				'svix-timestamp': headers.timestamp,
				'svix-signature': headers.signature,
			},
			secret: TEST_SECRET,
		})
		// `result` is typed as EmailSent — compile-time check that the field access works
		expect(result.type).toBe('email.sent')
		expect(result.data.id).toBe('em_typed')
	})

	it('accepts a Web Headers instance', () => {
		const payload = JSON.stringify({ ok: true })
		const { id, timestamp, signature } = signPayload(payload)

		const headers = new Headers({
			'svix-id': id,
			'svix-timestamp': timestamp,
			'svix-signature': signature,
		})

		const result = verifyWebhook({ payload, headers, secret: TEST_SECRET })
		expect(result).toEqual({ ok: true })
	})

	it('accepts header dicts with mixed case (Web Headers normalizes)', () => {
		const payload = JSON.stringify({ ok: true })
		const { id, timestamp, signature } = signPayload(payload)

		const headers = new Headers()
		headers.set('Svix-Id', id)
		headers.set('Svix-Timestamp', timestamp)
		headers.set('Svix-Signature', signature)

		const result = verifyWebhook({ payload, headers, secret: TEST_SECRET })
		expect(result).toEqual({ ok: true })
	})

	it('accepts the alternate `webhook-*` header naming (Standard Webhooks spec)', () => {
		const payload = JSON.stringify({ ok: true })
		const { id, timestamp, signature } = signPayload(payload)

		const result = verifyWebhook({
			payload,
			headers: {
				'webhook-id': id,
				'webhook-timestamp': timestamp,
				'webhook-signature': signature,
			},
			secret: TEST_SECRET,
		})
		expect(result).toEqual({ ok: true })
	})

	it('handles Node IncomingMessage-style headers (string | string[])', () => {
		const payload = JSON.stringify({ ok: true })
		const { id, timestamp, signature } = signPayload(payload)

		// Node's `req.headers` types each header as `string | string[] | undefined`.
		// We should pluck the first array entry.
		const result = verifyWebhook({
			payload,
			headers: {
				'svix-id': [id],
				'svix-timestamp': timestamp,
				'svix-signature': [signature, 'unused-extra'],
			},
			secret: TEST_SECRET,
		})
		expect(result).toEqual({ ok: true })
	})
})

describe('verifyWebhook — rejection paths', () => {
	it('throws WebhookVerificationError when the payload is tampered with', () => {
		const original = JSON.stringify({ type: 'email.sent', id: 'em_1' })
		const { id, timestamp, signature } = signPayload(original)

		const tampered = JSON.stringify({ type: 'email.sent', id: 'em_EVIL' })

		expect(() =>
			verifyWebhook({
				payload: tampered,
				headers: {
					'svix-id': id,
					'svix-timestamp': timestamp,
					'svix-signature': signature,
				},
				secret: TEST_SECRET,
			}),
		).toThrow(WebhookVerificationError)
	})

	it('throws when verified with the wrong secret', () => {
		const payload = JSON.stringify({ ok: true })
		const { id, timestamp, signature } = signPayload(payload, TEST_SECRET)

		// Different secret with the same valid-base64 shape — svix requires the
		// `whsec_…` body to base64-decode cleanly before HMAC, so the test
		// secret can't just be any string.
		const wrongSecret = 'whsec_AbCdEf0123456789XyZpQrSt+/uvWxYzABcdef='

		expect(() =>
			verifyWebhook({
				payload,
				headers: {
					'svix-id': id,
					'svix-timestamp': timestamp,
					'svix-signature': signature,
				},
				secret: wrongSecret,
			}),
		).toThrow(WebhookVerificationError)
	})

	it('throws WebhookVerificationError with a clear message when headers are missing', () => {
		expect(() =>
			verifyWebhook({
				payload: '{}',
				headers: {},
				secret: TEST_SECRET,
			}),
		).toThrow(/Missing required webhook headers/)
	})

	it('throws when only some headers are present (id only)', () => {
		expect(() =>
			verifyWebhook({
				payload: '{}',
				headers: { 'svix-id': 'msg_x' },
				secret: TEST_SECRET,
			}),
		).toThrow(WebhookVerificationError)
	})

	it('throws when only some headers are present (signature only)', () => {
		expect(() =>
			verifyWebhook({
				payload: '{}',
				headers: { 'svix-signature': 'v1,nopes' },
				secret: TEST_SECRET,
			}),
		).toThrow(WebhookVerificationError)
	})

	it('throws on an old timestamp (outside default 5-minute tolerance)', () => {
		const payload = JSON.stringify({ ok: true })
		const wh = new Webhook(TEST_SECRET)
		const id = 'msg_old'
		const oldDate = new Date(Date.now() - 10 * 60 * 1000) // 10 minutes ago
		const signature = wh.sign(id, oldDate, payload)
		const timestamp = String(Math.floor(oldDate.getTime() / 1000))

		expect(() =>
			verifyWebhook({
				payload,
				headers: {
					'svix-id': id,
					'svix-timestamp': timestamp,
					'svix-signature': signature,
				},
				secret: TEST_SECRET,
			}),
		).toThrow(WebhookVerificationError)
	})

	it('throws on a malformed signature header', () => {
		const payload = JSON.stringify({ ok: true })
		const { id, timestamp } = signPayload(payload)

		expect(() =>
			verifyWebhook({
				payload,
				headers: {
					'svix-id': id,
					'svix-timestamp': timestamp,
					'svix-signature': 'not-a-real-signature',
				},
				secret: TEST_SECRET,
			}),
		).toThrow(WebhookVerificationError)
	})
})

describe('verifyWebhook — security properties', () => {
	it('does NOT verify if signature is a substring/prefix attack on a valid one', () => {
		const payload = JSON.stringify({ ok: true })
		const { id, timestamp, signature } = signPayload(payload)
		// Drop the last char of the signature — would pass a substring/prefix
		// comparison but must fail constant-time equality.
		const truncated = signature.slice(0, -1)

		expect(() =>
			verifyWebhook({
				payload,
				headers: {
					'svix-id': id,
					'svix-timestamp': timestamp,
					'svix-signature': truncated,
				},
				secret: TEST_SECRET,
			}),
		).toThrow(WebhookVerificationError)
	})

	it('source code uses no `===` against signature values (defense check: delegates to svix)', () => {
		// This is a meta-check: we delegate signature comparison to svix's
		// `Webhook.verify()` which uses constant-time crypto. The SDK code
		// must never do its own `===` comparison on signatures. If somebody
		// adds one, this test will need updating — and the change should be
		// scrutinized in code review.
		//
		// We assert by inspecting that our wrapper has no signature comparison
		// of its own — all the heavy lifting is in `webhook.verify(...)`.
		// (Soft assertion; a determined committer can defeat this. The real
		// defense is review discipline.)
		expect(verifyWebhook.toString()).not.toMatch(/===\s*signature|signature\s*===/)
	})
})
