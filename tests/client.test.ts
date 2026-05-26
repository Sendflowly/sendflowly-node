import { describe, expect, it } from 'vitest'
import { Sendflowly, VERSION } from '../src'

describe('Sendflowly constructor', () => {
	it('exposes the package version', () => {
		expect(VERSION).toMatch(/^\d+\.\d+\.\d+/)
	})

	it('accepts an API key and default baseUrl', () => {
		const sf = new Sendflowly('sk_live_xxx')
		expect(sf).toBeInstanceOf(Sendflowly)
		expect(sf.emails).toBeDefined()
	})

	it('throws on missing API key', () => {
		expect(() => new Sendflowly('')).toThrow(/missing API key/i)
	})

	it('throws on null/undefined API key (defensive)', () => {
		// @ts-expect-error — exercising runtime validation
		expect(() => new Sendflowly(undefined)).toThrow(/missing API key/i)
		// @ts-expect-error — exercising runtime validation
		expect(() => new Sendflowly(null)).toThrow(/missing API key/i)
	})

	it('rejects non-string API keys (e.g., accidentally passed a number)', () => {
		// @ts-expect-error — exercising runtime validation
		expect(() => new Sendflowly(12345)).toThrow(/missing API key/i)
	})

	it('rejects http:// for non-localhost hosts', () => {
		expect(() => new Sendflowly('sk_test', { baseUrl: 'http://api.example.com' })).toThrow(
			/must use https/i,
		)
	})

	it('allows http://localhost for development', () => {
		expect(() => new Sendflowly('sk_test', { baseUrl: 'http://localhost:3000' })).not.toThrow()
		expect(() => new Sendflowly('sk_test', { baseUrl: 'http://127.0.0.1:3000' })).not.toThrow()
	})

	it('rejects malformed baseUrl', () => {
		expect(() => new Sendflowly('sk_test', { baseUrl: 'not-a-url' })).toThrow(/invalid baseUrl/i)
	})

	it('rejects unsupported protocols (ws://, ftp://)', () => {
		expect(() => new Sendflowly('sk_test', { baseUrl: 'ws://api.example.com' })).toThrow(
			/protocol must be https/i,
		)
	})

	it('eagerly constructs the emails resource', () => {
		const sf = new Sendflowly('sk_test')
		expect(sf.emails).toBeDefined()
		expect(typeof sf.emails.send).toBe('function')
		expect(typeof sf.emails.list).toBe('function')
	})
})
