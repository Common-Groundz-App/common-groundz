/**
 * Slug rules shared by every path that creates or reparents entities.
 *
 * `entities.slug` is globally UNIQUE, so two providers offering the same-named
 * thing ("Classic Burger") would collide. The hierarchical rule
 * `parentSlug-childSlug` resolves that. Any new offering-creation flow MUST use
 * these helpers rather than re-implementing the rule inline.
 *
 * Plain TypeScript, no React, no Supabase.
 */

/**
 * Slugify a display name: NFKD transliteration, lowercase, alphanumerics and
 * single dashes.
 *
 * This is the canonical contract, mirrored in Postgres by
 * `public.slugify_entity_name()` (which uses `unaccent`). Any change here must
 * be made there too — `entitySlug.test.ts` pins the shared fixtures.
 * "Café Déjà Vu" -> "cafe-deja-vu", "Joe's Burgers" -> "joes-burgers".
 */
export function slugifyEntityName(name: string | null | undefined): string {
  return (name ?? '')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '') // strip combining diacritical marks
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .trim();
}

/**
 * Hierarchical slug for a child/offering: `parentSlug-childSlug`.
 * Falls back to slugifying the parent's name when the parent has no slug.
 */
export function buildHierarchicalSlug(
  parent: { slug?: string | null; name?: string | null },
  child: { name?: string | null }
): string {
  const parentSlug = parent.slug ? slugifyEntityName(parent.slug) : slugifyEntityName(parent.name);
  const childSlug = slugifyEntityName(child.name);
  return parentSlug ? `${parentSlug}-${childSlug}` : childSlug;
}
