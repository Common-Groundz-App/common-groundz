// Plan v10 — SLUG equality. Hyphen-preserving — matches DB convention "axis-y".
// "AXIS-Y", "Axis Y", "axis_y", "axis y", "Axis--Y" → "axis-y".
// Mirror at: src/utils/brandSlug.ts. Keep both in sync.
export function slugifyBrandName(s: string): string {
  if (typeof s !== "string") return "";
  return s
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-{2,}/g, "-");
}
