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

/** Slugify a display name: lowercase, alphanumerics and single dashes. */
export function slugifyEntityName(name: string | null | undefined): string {
  return (name ?? '')
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
