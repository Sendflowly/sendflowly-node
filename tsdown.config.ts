import { defineConfig } from 'tsdown'

export default defineConfig({
	entry: ['src/index.ts', 'src/webhooks/index.ts'],
	format: ['esm', 'cjs'],
	// `resolve: true` inlines types from workspace deps (@sendflowly/shared) so
	// the published .d.mts/.d.cts files are standalone — no workspace dep at
	// runtime. We tried `eager: true` for re-exports across workspace boundaries
	// but it caused a V8 OOM crash; instead the SDK defines its own copies of
	// any types it needs to re-export (e.g. PaginationMeta).
	dts: { resolve: true },
	sourcemap: true,
	clean: true,
	target: 'es2022',
	treeshake: true,
	unbundle: false,
})
