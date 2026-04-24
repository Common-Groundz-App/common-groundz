/**
 * Search ranking utilities
 *
 * Pipeline:
 *   raw results → dedupeResults → scoreResult → sort within category
 *   → rankCategories → applyExactMatchOverride → softCollapse → render
 *
 * ## Spec (canonical query expectations)
 *
 *  - "malika biryani"           → exact "Mallika Biryani" near-match wins row 0,
 *                                 score must be ≥ 60. Override fires.
 *  - "Mallika, Biryani!"        → punctuation stripped by shared normalize();
 *                                 normalized equality fires unconditionally.
 *  - "malika briyani"           → transposed letters, Levenshtein = 2,
 *                                 within threshold for len=8 → near-match override.
 *  - "ram"                      → query length 3, threshold = 1. "cream"/"ramen"
 *                                 are NOT near-matches (distance > 1). No false hijack.
 *  - "art"                      → no fuzzy hijack of "cart"/"smart" (distance > 1).
 *  - "inception" exact          → normalized equality → row 0 of Movies category.
 *  - "interstellar" vs "intersteller" → length 12, threshold = 3, distance = 1 → match.
 *  - 40+ char titles            → Levenshtein skipped; substring scoring still applies.
 *  - Same place from Places + Food APIs → dedupeResults() collapses to one entry,
 *                                         keeping the higher-scoring side.
 *
 * No external dependencies. All functions are pure.
 */

// ============================================================
// Shared normalization — used by EVERY ranking function.
// Prevents "exact match doesn't fire because dedupe stripped a
// comma but scoring didn't" drift.
// ============================================================
export const normalize = (str: string): string =>
  (str || '')
    .toLowerCase()
    .replace(/[^\w\s]/g, '') // strip punctuation
    .replace(/\s+/g, ' ')    // collapse whitespace
    .trim();

// ============================================================
// Levenshtein distance (iterative DP, ~O(m*n) time, O(n) space)
// Inline implementation — no third-party dep.
// ============================================================
export function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;

  let prev = new Array(b.length + 1);
  let curr = new Array(b.length + 1);
  for (let j = 0; j <= b.length; j++) prev[j] = j;

  for (let i = 1; i <= a.length; i++) {
    curr[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const cost = a.charCodeAt(i - 1) === b.charCodeAt(j - 1) ? 0 : 1;
      curr[j] = Math.min(
        curr[j - 1] + 1,      // insertion
        prev[j] + 1,          // deletion
        prev[j - 1] + cost,   // substitution
      );
    }
    [prev, curr] = [curr, prev];
  }
  return prev[b.length];
}

/**
 * Adaptive threshold by query length.
 * Short queries are strict to avoid false positives ("ram" → "cream").
 */
export function levenshteinThreshold(query: string): number {
  const len = (query || '').trim().length;
  if (len <= 4) return 1;
  if (len <= 8) return 2;
  return 3;
}

/**
 * Near-match check with shared normalization, length guard, and
 * adaptive threshold.
 */
export function isNearMatch(a: string, b: string): boolean {
  const na = normalize(a);
  const nb = normalize(b);
  if (!na || !nb) return false;
  // Skip Levenshtein on very long strings — substring scoring handles them.
  if (na.length > 40 || nb.length > 40) return false;
  return levenshtein(na, nb) <= levenshteinThreshold(nb);
}

// ============================================================
// Scoring (0–100)
// ============================================================
export interface ScorableResult {
  name?: string;
  venue?: string;
  type?: string;
  api_source?: string;
  api_ref?: string;
  id?: string;
  // Local entities may carry these:
  popularity_score?: number | null;
  trending_score?: number | null;
  is_verified?: boolean | null;
  image_url?: string | null;
  description?: string | null;
  [key: string]: any;
}

/**
 * Score a single result 0–100 against a query.
 *  - exact normalized name match: 100
 *  - name starts with query:        80
 *  - query is whole-word inside name: 65
 *  - query is substring of name:     50
 *  - near-match (Levenshtein):       45
 *  - venue contains query:           30
 *  - description contains query:     15
 *  - else:                            5 (presence-only)
 *
 * Then apply small bonuses (verified, popularity, trending).
 * Hard cap at 100.
 */
export function scoreResult(result: ScorableResult, query: string): number {
  const q = normalize(query);
  if (!q) return 0;
  const name = normalize(result.name || '');
  const venue = normalize(result.venue || '');
  const desc = normalize(result.description || '');

  let base = 5;

  if (name && name === q) {
    base = 100;
  } else if (name.startsWith(q)) {
    base = 80;
  } else if (name && new RegExp(`(^|\\s)${escapeRegex(q)}(\\s|$)`).test(name)) {
    base = 65;
  } else if (name.includes(q)) {
    base = 50;
  } else if (isNearMatch(name, q)) {
    base = 45;
  } else if (venue.includes(q)) {
    base = 30;
  } else if (desc.includes(q)) {
    base = 15;
  }

  // Lightweight bonuses
  let bonus = 0;
  if (result.is_verified) bonus += 4;
  const pop = Number(result.popularity_score) || 0;
  if (pop > 0) bonus += Math.min(6, Math.round(pop / 20));
  const trend = Number(result.trending_score) || 0;
  if (trend > 0) bonus += Math.min(4, Math.round(trend / 25));

  return Math.min(100, base + bonus);
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// ============================================================
// Cross-category visual deduplication
// Same name + venue across categories → keep highest score.
// ============================================================
export function dedupeResults<T extends ScorableResult>(
  results: T[],
  query: string,
): T[] {
  const bestByKey = new Map<string, { item: T; score: number }>();
  for (const r of results) {
    if (!r) continue;
    const key = `${normalize(r.name || '')}|${normalize(r.venue || '')}`;
    if (!key || key === '|') continue;
    const score = scoreResult(r, query);
    const existing = bestByKey.get(key);
    if (!existing || score > existing.score) {
      bestByKey.set(key, { item: r, score });
    }
  }
  return Array.from(bestByKey.values()).map((v) => v.item);
}

// ============================================================
// Category ranking
// ============================================================
export interface RankedCategory<T> {
  key: string;
  items: T[];
  topScore: number;
}

/**
 * Sort items within each category by score (desc), then sort
 * categories themselves by their top-result score (desc).
 */
export function rankCategories<T extends ScorableResult>(
  categories: Record<string, T[]>,
  query: string,
): RankedCategory<T>[] {
  const ranked: RankedCategory<T>[] = [];
  for (const [key, items] of Object.entries(categories)) {
    if (!items || items.length === 0) continue;
    const sorted = [...items].sort(
      (a, b) => scoreResult(b, query) - scoreResult(a, query),
    );
    const topScore = sorted.length ? scoreResult(sorted[0], query) : 0;
    ranked.push({ key, items: sorted, topScore });
  }
  ranked.sort((a, b) => b.topScore - a.topScore);
  return ranked;
}

// ============================================================
// Exact-match override
// Pulls a confidently-matching result to row 0 of category 0.
// ============================================================

/**
 * Override gate:
 *   - normalized equality        → always
 *   - near-match (within threshold) AND score ≥ 60 → conditional
 */
export function shouldOverride(
  result: ScorableResult,
  query: string,
): boolean {
  const nq = normalize(query);
  const nn = normalize(result.name || '');
  if (!nq || !nn) return false;
  if (nn === nq) return true;
  if (isNearMatch(nn, nq) && scoreResult(result, query) >= 60) return true;
  return false;
}

/**
 * Scan all ranked categories for the best override candidate (highest
 * score among those that pass `shouldOverride`). If found, move it to
 * row 0 of its category and float that category to position 0.
 */
export function applyExactMatchOverride<T extends ScorableResult>(
  ranked: RankedCategory<T>[],
  query: string,
): RankedCategory<T>[] {
  let bestCatIdx = -1;
  let bestItemIdx = -1;
  let bestScore = -1;

  for (let ci = 0; ci < ranked.length; ci++) {
    const cat = ranked[ci];
    for (let ii = 0; ii < cat.items.length; ii++) {
      const item = cat.items[ii];
      if (!shouldOverride(item, query)) continue;
      const s = scoreResult(item, query);
      if (s > bestScore) {
        bestScore = s;
        bestCatIdx = ci;
        bestItemIdx = ii;
      }
    }
  }

  if (bestCatIdx === -1) return ranked;

  // Move winning item to row 0 of its category.
  const cat = ranked[bestCatIdx];
  if (bestItemIdx > 0) {
    const winner = cat.items[bestItemIdx];
    const newItems = [winner, ...cat.items.filter((_, i) => i !== bestItemIdx)];
    ranked[bestCatIdx] = { ...cat, items: newItems, topScore: bestScore };
  }
  // Float winning category to position 0.
  if (bestCatIdx > 0) {
    const winnerCat = ranked[bestCatIdx];
    const rest = ranked.filter((_, i) => i !== bestCatIdx);
    return [winnerCat, ...rest];
  }
  return ranked;
}

// ============================================================
// Soft collapse — always show 1–2 results per category, even
// when weak. Avoids the "false empty" feel.
// ============================================================
export interface CollapsedCategory<T> {
  key: string;
  visible: T[];
  hidden: T[];
  /**
   * Full ranked list — same array reference as the ranked source from
   * `rankCategories`. Treat as READ-ONLY. Mutating this (sort/push/splice)
   * will silently break the invariant that `visible` and `hidden` are
   * exact prefixes/suffixes of `allItems`, causing expand/collapse drift.
   */
  allItems: T[];
  topScore: number;
}

export function softCollapse<T extends ScorableResult>(
  ranked: RankedCategory<T>[],
): CollapsedCategory<T>[] {
  return ranked.map((cat) => {
    const items = cat.items; // already sorted by rankCategories — DO NOT re-sort or copy
    let visibleCount: number;
    if (cat.topScore >= 50) visibleCount = 5;          // strong
    else if (cat.topScore >= 30) visibleCount = 3;     // medium
    else visibleCount = Math.min(2, items.length);     // weak (1–2)
    return {
      key: cat.key,
      visible: items.slice(0, visibleCount),
      hidden: items.slice(visibleCount),
      allItems: items, // SAME reference — guarantees prefix consistency
      topScore: cat.topScore,
    };
  });
}
