// Plan v10 — NAME equivalence (browser mirror of supabase/functions/_shared/brand_normalize.ts).
export function normalizeBrandName(s: string): string {
  if (typeof s !== 'string') return '';
  return s.toLowerCase().normalize('NFKD').replace(/[^a-z0-9]/g, '');
}
