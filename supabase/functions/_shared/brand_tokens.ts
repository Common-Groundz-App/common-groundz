// Plan v10 — token extraction for safe ILIKE prefix matching.
// "AXIS-Y" → ["axis","y"], "H&M" → ["h","m"], "A1" → ["a1"].
// Computed after punctuation cleanup so short-token guard behaves
// correctly. Mirror at: src/utils/brandTokens.ts. Keep both in sync.
export function brandTokens(s: string): string[] {
  if (typeof s !== "string") return [];
  return s
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .split(/\s+/)
    .filter(Boolean);
}
