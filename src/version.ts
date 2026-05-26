// Version is imported from package.json so a single source of truth (the
// Changesets-managed package.json version) flows through to the User-Agent
// header. tsdown inlines the JSON at build time, so this is not a runtime
// file read.
import { version } from '../package.json'

export const VERSION: string = version
