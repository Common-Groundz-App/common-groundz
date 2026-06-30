// Plan v10 — NAME equivalence for brand matching.
// "AXIS-Y", "Axis Y", "axis_y", "axisy", "axis.y" → "axisy".
// Mirror at: src/utils/brandNormalize.ts. Keep both in sync.
export function normalizeBrandName(s: string): string {
  if (typeof s !== "string") return "";
  return s.toLowerCase().normalize("NFKD").replace(/[^a-z0-9]/g, "");
}
