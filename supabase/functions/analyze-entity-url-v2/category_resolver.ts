// Phase 8: Conservative root-level category resolver.
//
// Snapshot staleness policy:
//   - `categories_snapshot.json` is a hand-curated, root-level-only mapping.
//   - It contains pure JSON only. NO comments. NO header.
//   - Entries whose `category_id` cannot be verified as currently valid in the
//     production `categories` table store `category_id: null` and only carry a
//     human-readable `matched_category_name`. We never emit an unverified ID.
//   - On a miss we return `{ category_id: null, matched_category_name: null }`
//     and the caller MUST preserve `predictions.suggested_category_path`.
//   - To add a new root: verify the live `category_id`, add the entry, update
//     README.md with the verification date, and add a test fixture below.
//   - No fuzzy matching, no subcategories, no live DB calls in this phase.

import snapshot from "./categories_snapshot.json" with { type: "json" };

export interface ResolvedCategory {
  category_id: string | null;
  matched_category_name: string | null;
}

interface SnapshotEntry {
  category_id: string | null;
  matched_category_name: string | null;
}

const SNAPSHOT = snapshot as Record<string, SnapshotEntry>;

// Lowercase suggested_category_path values that we treat as root-equivalent
// to a known canonical type. Conservative; expand only with verified intent.
const PATH_ALIASES: Record<string, string> = {
  "product": "product",
  "products": "product",
  "book": "book",
  "books": "book",
  "books.book": "book",
  "movie": "movie",
  "movies": "movie",
  "video.movie": "movie",
  "tvseries": "tv_show",
  "tvseason": "tv_show",
  "tvepisode": "tv_show",
  "tv_show": "tv_show",
  "video.tv_show": "tv_show",
  "video.episode": "tv_show",
  "course": "course",
  "courses": "course",
  "softwareapplication": "app",
  "mobileapplication": "app",
  "webapplication": "app",
  "app": "app",
  "apps": "app",
  "videogame": "game",
  "game": "game",
  "games": "game",
  "recipe": "food",
  "food": "food",
  "restaurant": "place",
  "localbusiness": "place",
  "hotel": "place",
  "place": "place",
  "places": "place",
};

export interface ResolveCategoryArgs {
  type: string | null;
  suggested_category_path: string | null;
}

export function resolveCategory(args: ResolveCategoryArgs): ResolvedCategory {
  const miss: ResolvedCategory = { category_id: null, matched_category_name: null };

  // 1) try suggested_category_path → alias → snapshot
  if (args.suggested_category_path) {
    const key = args.suggested_category_path.trim().toLowerCase();
    const aliased = PATH_ALIASES[key];
    if (aliased && SNAPSHOT[aliased]) {
      return {
        category_id: SNAPSHOT[aliased].category_id ?? null,
        matched_category_name: SNAPSHOT[aliased].matched_category_name ?? null,
      };
    }
  }

  // 2) fall back to canonical type
  if (args.type) {
    const key = args.type.trim().toLowerCase();
    if (SNAPSHOT[key]) {
      return {
        category_id: SNAPSHOT[key].category_id ?? null,
        matched_category_name: SNAPSHOT[key].matched_category_name ?? null,
      };
    }
  }

  return miss;
}
