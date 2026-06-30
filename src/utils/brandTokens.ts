// Plan v10 — token extraction (browser mirror of supabase/functions/_shared/brand_tokens.ts).
export function brandTokens(s: string): string[] {
  if (typeof s !== 'string') return [];
  return s
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .split(/\s+/)
    .filter(Boolean);
}
