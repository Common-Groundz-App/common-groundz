/**
 * Allowed entity page versions
 */
const ALLOWED_VERSIONS = new Set(['1', '2', '3', '4']);

/**
 * Default version constant for reference
 */
export const DEFAULT_ENTITY_PAGE_VERSION = '4';

/**
 * Determines which entity page version to render based on URL parameters
 * and user permissions.
 * 
 * @param searchParams - URLSearchParams from useSearchParams()
 * @param isInternalUser - Whether user has @lovable.dev email (admin access)
 * @returns Version string: '1', '2', '3', or '4'
 */
export function getEntityPageVersion(
  searchParams: URLSearchParams, 
  isInternalUser: boolean
): '1' | '2' | '3' | '4' {
  // Get requested version from query params
  const vParam = searchParams.get('v');
  const previewParam = searchParams.get('preview');
  
  // Legacy support: ?preview=true used to mean V2
  const rawVersion = vParam || (previewParam === 'true' ? '2' : DEFAULT_ENTITY_PAGE_VERSION);
  
  // Validate against whitelist (protects against ?v=foo, ?v=<script>, etc.)
  const validatedVersion = ALLOWED_VERSIONS.has(rawVersion) 
    ? rawVersion as '1' | '2' | '3' | '4'
    : DEFAULT_ENTITY_PAGE_VERSION as '4';
  
  // Public users always get V4, internal users can override with validated version
  return isInternalUser ? validatedVersion : '4';
}
