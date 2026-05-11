// Platform-owned subdomains that must never be treated as tenant slugs.
// Any new Strondis service subdomain must be added here.
const RESERVED_SUBDOMAINS = new Set([
  'app', 'admin', 'guard', 'api', 'www', 'landing', 'mail', 'status', 'docs',
])

/**
 * Extracts the tenant slug from the current hostname.
 * - Production: parses the subdomain from {slug}.strondis.com
 * - Reserved platform subdomains (app, admin, guard, api …) return null
 * - Local dev: reads VITE_DEV_TENANT_SLUG env var (e.g. "acme-security")
 * - Returns null when running on localhost without the env var set
 */
export function getSubdomainSlug(): string | null {
  const hostname = window.location.hostname

  if (hostname === 'localhost' || hostname === '127.0.0.1') {
    return (import.meta.env.VITE_DEV_TENANT_SLUG as string | undefined) || null
  }

  const match = hostname.match(/^([a-z0-9-]+)\.strondis\.com$/)
  if (!match) return null

  const slug = match[1]
  if (RESERVED_SUBDOMAINS.has(slug)) return null

  return slug
}
