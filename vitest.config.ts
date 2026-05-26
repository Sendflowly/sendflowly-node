import { defineConfig } from 'vitest/config'

export default defineConfig({
	test: {
		environment: 'node',
		globals: false,
		include: ['tests/**/*.test.ts'],
		// Tests inject fetch per-instance via `new Sendflowly(..., { fetch })`
		// rather than monkey-patching globalThis. No setup file needed.
	},
})
