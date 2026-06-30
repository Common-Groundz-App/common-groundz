// Plan v10 — SLUG equality (browser mirror of supabase/functions/_shared/brand_slug.ts).
export function slugifyBrandName(s: string): string {
  if (typeof s !== 'string') return '';
  return s
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/-{2,}/g, '-');
}
