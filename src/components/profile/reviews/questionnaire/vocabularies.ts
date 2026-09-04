/**
 * Phase 3C Stage 2 — curated tag vocabularies.
 *
 * Pure data. The single source of truth for the shipped vocabularies, and the
 * implementation of the FROZEN specification in
 * `docs/phase-3b-tag-vocabularies.md`. A registry lint test parses that document
 * and asserts this file matches it exactly (ids, sentiments and per-type counts).
 * Divergence is an implementation bug here, never a licence to edit the doc.
 *
 * Rules carried from the frozen spec:
 * - `value` is the STORED code and is immutable once shipped. Labels and emojis
 *   are presentation and may be reworded without a data migration.
 * - `sentiment` is registry metadata ONLY. It is never persisted.
 * - Tag identity is composite: `(type, field id, tag id)`. The same string in two
 *   vocabularies is two distinct tags.
 * - `food` has no generic `stood_out`; the existing Food Tags already are it.
 */

export type TagSentiment = 'positive' | 'neutral' | 'negative';

export interface CuratedTag {
  /** Stored code. Immutable. */
  value: string;
  label: string;
  emoji: string;
  /** Registry metadata only — never persisted. */
  sentiment: TagSentiment;
}

/** Selection caps for `CuratedTagSelector`. `FoodTagSelector` is exempt. */
export const CURATED_TAG_LIMITS = {
  maxCombined: 5,
  maxCustom: 3,
  maxCustomLength: 40,
} as const;

const STOOD_OUT_PLACE: readonly CuratedTag[] = [
  { value: 'great_ambience', label: 'Great ambience', emoji: '🕯️', sentiment: 'positive' },
  { value: 'good_service', label: 'Good service', emoji: '🙌', sentiment: 'positive' },
  { value: 'very_clean', label: 'Very clean', emoji: '✨', sentiment: 'positive' },
  { value: 'convenient_location', label: 'Convenient location', emoji: '📍', sentiment: 'positive' },
  { value: 'good_value', label: 'Good value', emoji: '💰', sentiment: 'positive' },
  { value: 'helpful_staff', label: 'Helpful staff', emoji: '💡', sentiment: 'positive' },
  { value: 'quiet', label: 'Quiet', emoji: '🤫', sentiment: 'neutral' },
  { value: 'crowded', label: 'Crowded', emoji: '👥', sentiment: 'neutral' },
  { value: 'hard_to_find', label: 'Hard to find', emoji: '🧭', sentiment: 'negative' },
  { value: 'long_wait', label: 'Long wait', emoji: '⏳', sentiment: 'negative' },
  { value: 'overpriced', label: 'Overpriced', emoji: '💸', sentiment: 'negative' },
  { value: 'poor_upkeep', label: 'Poorly maintained', emoji: '🧹', sentiment: 'negative' },
  { value: 'unhelpful_service', label: 'Unhelpful service', emoji: '🙃', sentiment: 'negative' },
];

const STOOD_OUT_PRODUCT: readonly CuratedTag[] = [
  { value: 'solid_build', label: 'Solid build', emoji: '🔨', sentiment: 'positive' },
  { value: 'easy_to_use', label: 'Easy to use', emoji: '👌', sentiment: 'positive' },
  { value: 'works_as_described', label: 'Works as described', emoji: '✅', sentiment: 'positive' },
  { value: 'durable', label: 'Durable', emoji: '🛡️', sentiment: 'positive' },
  { value: 'great_design', label: 'Great design', emoji: '🎨', sentiment: 'positive' },
  { value: 'packaging', label: 'Packaging', emoji: '📦', sentiment: 'neutral' },
  { value: 'learning_curve', label: 'Takes getting used to', emoji: '📈', sentiment: 'neutral' },
  { value: 'bulky', label: 'Bulky', emoji: '🧱', sentiment: 'neutral' },
  { value: 'stopped_working', label: 'Stopped working', emoji: '💥', sentiment: 'negative' },
  { value: 'flimsy', label: 'Feels flimsy', emoji: '🥀', sentiment: 'negative' },
  { value: 'not_as_described', label: 'Not as described', emoji: '❓', sentiment: 'negative' },
  { value: 'hard_to_clean', label: 'Hard to clean', emoji: '🧼', sentiment: 'negative' },
];

const STOOD_OUT_BRAND: readonly CuratedTag[] = [
  { value: 'consistent_quality', label: 'Consistent quality', emoji: '🎯', sentiment: 'positive' },
  { value: 'good_support', label: 'Good support', emoji: '🎧', sentiment: 'positive' },
  { value: 'honest_claims', label: 'Honest claims', emoji: '🤝', sentiment: 'positive' },
  { value: 'easy_returns', label: 'Easy returns', emoji: '↩️', sentiment: 'positive' },
  { value: 'wide_range', label: 'Wide range', emoji: '🧺', sentiment: 'positive' },
  { value: 'premium_pricing', label: 'Premium pricing', emoji: '💎', sentiment: 'neutral' },
  { value: 'limited_range', label: 'Limited range', emoji: '📉', sentiment: 'negative' },
  { value: 'inconsistent_quality', label: 'Inconsistent quality', emoji: '🎲', sentiment: 'negative' },
  { value: 'slow_support', label: 'Slow support', emoji: '🐢', sentiment: 'negative' },
  { value: 'misleading_claims', label: 'Misleading claims', emoji: '🚩', sentiment: 'negative' },
];

const STOOD_OUT_MOVIE: readonly CuratedTag[] = [
  { value: 'compelling_story', label: 'Compelling story', emoji: '📖', sentiment: 'positive' },
  { value: 'strong_acting', label: 'Strong acting', emoji: '🎭', sentiment: 'positive' },
  { value: 'striking_cinematography', label: 'Striking cinematography', emoji: '🎥', sentiment: 'positive' },
  { value: 'great_soundtrack', label: 'Great soundtrack', emoji: '🎵', sentiment: 'positive' },
  { value: 'strong_direction', label: 'Strong direction', emoji: '🎬', sentiment: 'positive' },
  { value: 'strong_ending', label: 'Strong ending', emoji: '🏁', sentiment: 'positive' },
  { value: 'memorable_visuals', label: 'Memorable visuals', emoji: '🖼️', sentiment: 'positive' },
  { value: 'slow_pacing', label: 'Slow pacing', emoji: '🐢', sentiment: 'neutral' },
  { value: 'heavy_themes', label: 'Heavy themes', emoji: '🌧️', sentiment: 'neutral' },
  { value: 'predictable', label: 'Predictable', emoji: '🔮', sentiment: 'negative' },
  { value: 'weak_writing', label: 'Weak writing', emoji: '✍️', sentiment: 'negative' },
  { value: 'overhyped', label: 'Overhyped', emoji: '📣', sentiment: 'negative' },
];

const STOOD_OUT_TV_SHOW: readonly CuratedTag[] = [
  { value: 'compelling_story', label: 'Compelling story', emoji: '📖', sentiment: 'positive' },
  { value: 'strong_acting', label: 'Strong acting', emoji: '🎭', sentiment: 'positive' },
  { value: 'binge_worthy', label: 'Binge-worthy', emoji: '🍿', sentiment: 'positive' },
  { value: 'strong_start', label: 'Strong start', emoji: '🚀', sentiment: 'positive' },
  { value: 'strong_finish', label: 'Sticks the landing', emoji: '🏁', sentiment: 'positive' },
  { value: 'slow_burn', label: 'Slow burn', emoji: '🕯️', sentiment: 'neutral' },
  { value: 'episodic', label: 'Watch in any order', emoji: '🔀', sentiment: 'neutral' },
  { value: 'heavy_themes', label: 'Heavy themes', emoji: '🌧️', sentiment: 'neutral' },
  { value: 'filler_episodes', label: 'Filler episodes', emoji: '🧵', sentiment: 'negative' },
  { value: 'drops_off_later', label: 'Drops off later', emoji: '📉', sentiment: 'negative' },
  { value: 'unresolved_ending', label: 'Unresolved ending', emoji: '❔', sentiment: 'negative' },
];

const STOOD_OUT_BOOK: readonly CuratedTag[] = [
  { value: 'strong_writing', label: 'Strong writing', emoji: '✍️', sentiment: 'positive' },
  { value: 'memorable_characters', label: 'Memorable characters', emoji: '🧑‍🤝‍🧑', sentiment: 'positive' },
  { value: 'insightful', label: 'Insightful', emoji: '💡', sentiment: 'positive' },
  { value: 'practical', label: 'Practical', emoji: '🛠️', sentiment: 'positive' },
  { value: 'hard_to_put_down', label: 'Hard to put down', emoji: '🔖', sentiment: 'positive' },
  { value: 'dense', label: 'Dense', emoji: '🧱', sentiment: 'neutral' },
  { value: 'long', label: 'Long', emoji: '📚', sentiment: 'neutral' },
  { value: 'technical', label: 'Technical', emoji: '🔬', sentiment: 'neutral' },
  { value: 'repetitive', label: 'Repetitive', emoji: '🔁', sentiment: 'negative' },
  { value: 'thin_on_substance', label: 'Thin on substance', emoji: '🫧', sentiment: 'negative' },
  { value: 'dated', label: 'Dated', emoji: '🕰️', sentiment: 'negative' },
];

const STOOD_OUT_GAME: readonly CuratedTag[] = [
  { value: 'engaging_gameplay', label: 'Engaging gameplay', emoji: '🎮', sentiment: 'positive' },
  { value: 'compelling_story', label: 'Compelling story', emoji: '📖', sentiment: 'positive' },
  { value: 'striking_visuals', label: 'Striking visuals', emoji: '🖼️', sentiment: 'positive' },
  { value: 'great_sound_design', label: 'Great sound design', emoji: '🎧', sentiment: 'positive' },
  { value: 'replayable', label: 'Replayable', emoji: '🔄', sentiment: 'positive' },
  { value: 'great_with_friends', label: 'Great with friends', emoji: '🧑‍🤝‍🧑', sentiment: 'positive' },
  { value: 'challenging', label: 'Challenging', emoji: '⚔️', sentiment: 'neutral' },
  { value: 'long_playtime', label: 'Long playtime', emoji: '⏱️', sentiment: 'neutral' },
  { value: 'steep_learning_curve', label: 'Steep learning curve', emoji: '📈', sentiment: 'neutral' },
  { value: 'buggy', label: 'Buggy', emoji: '🐛', sentiment: 'negative' },
  { value: 'grindy', label: 'Grindy', emoji: '⛏️', sentiment: 'negative' },
  { value: 'aggressive_monetisation', label: 'Pushy purchases', emoji: '💳', sentiment: 'negative' },
];

const STOOD_OUT_APP: readonly CuratedTag[] = [
  { value: 'easy_to_use', label: 'Easy to use', emoji: '👌', sentiment: 'positive' },
  { value: 'fast', label: 'Fast', emoji: '⚡', sentiment: 'positive' },
  { value: 'reliable', label: 'Reliable', emoji: '🛡️', sentiment: 'positive' },
  { value: 'good_design', label: 'Good design', emoji: '🎨', sentiment: 'positive' },
  { value: 'offline_support', label: 'Works offline', emoji: '📴', sentiment: 'positive' },
  { value: 'syncs_well', label: 'Syncs well', emoji: '🔄', sentiment: 'positive' },
  { value: 'feature_heavy', label: 'Feature-heavy', emoji: '🧰', sentiment: 'neutral' },
  { value: 'subscription_required', label: 'Subscription required', emoji: '🔐', sentiment: 'neutral' },
  { value: 'buggy', label: 'Buggy', emoji: '🐛', sentiment: 'negative' },
  { value: 'too_many_ads', label: 'Too many ads', emoji: '📢', sentiment: 'negative' },
  { value: 'battery_drain', label: 'Battery drain', emoji: '🔋', sentiment: 'negative' },
  { value: 'privacy_concerns', label: 'Privacy concerns', emoji: '🕵️', sentiment: 'negative' },
];

const STOOD_OUT_COURSE: readonly CuratedTag[] = [
  { value: 'clear_teaching', label: 'Clear teaching', emoji: '🧑‍🏫', sentiment: 'positive' },
  { value: 'well_structured', label: 'Well structured', emoji: '🧱', sentiment: 'positive' },
  { value: 'hands_on', label: 'Hands-on', emoji: '🛠️', sentiment: 'positive' },
  { value: 'good_materials', label: 'Good materials', emoji: '📄', sentiment: 'positive' },
  { value: 'responsive_instructor', label: 'Responsive instructor', emoji: '💬', sentiment: 'positive' },
  { value: 'fast_paced', label: 'Fast-paced', emoji: '🏃', sentiment: 'neutral' },
  { value: 'theory_heavy', label: 'Theory-heavy', emoji: '📐', sentiment: 'neutral' },
  { value: 'needs_prior_knowledge', label: 'Needs prior knowledge', emoji: '🔑', sentiment: 'neutral' },
  { value: 'outdated_content', label: 'Outdated content', emoji: '🕰️', sentiment: 'negative' },
  { value: 'shallow_coverage', label: 'Shallow coverage', emoji: '🫧', sentiment: 'negative' },
  { value: 'poor_audio_video', label: 'Poor audio/video', emoji: '🔇', sentiment: 'negative' },
];

const STOOD_OUT_SERVICE: readonly CuratedTag[] = [
  { value: 'on_time', label: 'On time', emoji: '⏰', sentiment: 'positive' },
  { value: 'quality_work', label: 'Quality work', emoji: '🏅', sentiment: 'positive' },
  { value: 'clear_pricing', label: 'Clear pricing', emoji: '🧾', sentiment: 'positive' },
  { value: 'good_communication', label: 'Good communication', emoji: '💬', sentiment: 'positive' },
  { value: 'left_it_tidy', label: 'Left it tidy', emoji: '🧽', sentiment: 'positive' },
  { value: 'easy_to_book', label: 'Easy to book', emoji: '📅', sentiment: 'positive' },
  { value: 'limited_availability', label: 'Limited availability', emoji: '🗓️', sentiment: 'neutral' },
  { value: 'delayed', label: 'Delayed', emoji: '🐌', sentiment: 'negative' },
  { value: 'surprise_charges', label: 'Surprise charges', emoji: '💸', sentiment: 'negative' },
  { value: 'rushed_work', label: 'Rushed work', emoji: '🌀', sentiment: 'negative' },
  { value: 'had_to_follow_up', label: 'Had to chase them', emoji: '🔁', sentiment: 'negative' },
];

const STOOD_OUT_PROFESSIONAL: readonly CuratedTag[] = [
  { value: 'knowledgeable', label: 'Knowledgeable', emoji: '💡', sentiment: 'positive' },
  { value: 'listens_well', label: 'Listens well', emoji: '👂', sentiment: 'positive' },
  { value: 'explains_clearly', label: 'Explains clearly', emoji: '🗣️', sentiment: 'positive' },
  { value: 'responsive', label: 'Responsive', emoji: '⚡', sentiment: 'positive' },
  { value: 'thorough', label: 'Thorough', emoji: '🔍', sentiment: 'positive' },
  { value: 'respects_time', label: 'Respects your time', emoji: '⏰', sentiment: 'positive' },
  { value: 'direct_style', label: 'Very direct', emoji: '➡️', sentiment: 'neutral' },
  { value: 'hard_to_book', label: 'Hard to book', emoji: '🗓️', sentiment: 'negative' },
  { value: 'slow_to_respond', label: 'Slow to respond', emoji: '🐢', sentiment: 'negative' },
  { value: 'unclear_communication', label: 'Unclear communication', emoji: '🌫️', sentiment: 'negative' },
  { value: 'didnt_follow_through', label: "Didn't follow through", emoji: '📆', sentiment: 'negative' },
];

const STOOD_OUT_EVENT: readonly CuratedTag[] = [
  { value: 'great_atmosphere', label: 'Great atmosphere', emoji: '🎉', sentiment: 'positive' },
  { value: 'well_organised', label: 'Well organised', emoji: '🗂️', sentiment: 'positive' },
  { value: 'good_venue', label: 'Good venue', emoji: '🏟️', sentiment: 'positive' },
  { value: 'good_lineup', label: 'Good lineup', emoji: '🎤', sentiment: 'positive' },
  { value: 'worth_the_price', label: 'Worth the price', emoji: '💰', sentiment: 'positive' },
  { value: 'loud', label: 'Loud', emoji: '🔊', sentiment: 'neutral' },
  { value: 'crowded', label: 'Crowded', emoji: '👥', sentiment: 'neutral' },
  { value: 'long_day', label: 'Long day', emoji: '🕗', sentiment: 'neutral' },
  { value: 'long_queues', label: 'Long queues', emoji: '⏳', sentiment: 'negative' },
  { value: 'poor_sound', label: 'Poor sound', emoji: '🔇', sentiment: 'negative' },
  { value: 'overpriced_extras', label: 'Overpriced extras', emoji: '💸', sentiment: 'negative' },
];

const STOOD_OUT_EXPERIENCE: readonly CuratedTag[] = [
  { value: 'memorable', label: 'Memorable', emoji: '🌟', sentiment: 'positive' },
  { value: 'well_organised', label: 'Well organised', emoji: '🧭', sentiment: 'positive' },
  { value: 'felt_safe', label: 'Felt safe', emoji: '🦺', sentiment: 'positive' },
  { value: 'scenic', label: 'Scenic', emoji: '🏞️', sentiment: 'positive' },
  { value: 'worth_the_price', label: 'Worth the price', emoji: '💰', sentiment: 'positive' },
  { value: 'physically_demanding', label: 'Physically demanding', emoji: '🥵', sentiment: 'neutral' },
  { value: 'weather_dependent', label: 'Weather dependent', emoji: '🌦️', sentiment: 'neutral' },
  { value: 'long_travel', label: 'Long travel to get there', emoji: '🚌', sentiment: 'neutral' },
  { value: 'rushed', label: 'Felt rushed', emoji: '⏩', sentiment: 'negative' },
  { value: 'touristy', label: 'Very touristy', emoji: '🎟️', sentiment: 'negative' },
  { value: 'poorly_run', label: 'Poorly run', emoji: '🌀', sentiment: 'negative' },
];

const STOOD_OUT_OTHERS: readonly CuratedTag[] = [
  { value: 'high_quality', label: 'High quality', emoji: '🏅', sentiment: 'positive' },
  { value: 'good_value', label: 'Good value', emoji: '💰', sentiment: 'positive' },
  { value: 'easy_to_use', label: 'Easy to use', emoji: '👌', sentiment: 'positive' },
  { value: 'good_support', label: 'Good support', emoji: '🎧', sentiment: 'positive' },
  { value: 'as_described', label: 'As described', emoji: '✅', sentiment: 'positive' },
  { value: 'niche', label: 'Niche', emoji: '🔎', sentiment: 'neutral' },
  { value: 'takes_effort', label: 'Takes effort', emoji: '🧗', sentiment: 'neutral' },
  { value: 'overpriced', label: 'Overpriced', emoji: '💸', sentiment: 'negative' },
  { value: 'unreliable', label: 'Unreliable', emoji: '⚠️', sentiment: 'negative' },
];

const BEST_FOR_PLACE: readonly CuratedTag[] = [
  { value: 'solo', label: 'Solo', emoji: '🚶', sentiment: 'neutral' },
  { value: 'couples', label: 'Couples', emoji: '💞', sentiment: 'neutral' },
  { value: 'family', label: 'Family', emoji: '👨‍👩‍👧', sentiment: 'neutral' },
  { value: 'friends', label: 'Friends', emoji: '🧑‍🤝‍🧑', sentiment: 'neutral' },
  { value: 'kids', label: 'Kids', emoji: '🧒', sentiment: 'neutral' },
  { value: 'work', label: 'Working', emoji: '💻', sentiment: 'neutral' },
  { value: 'celebrations', label: 'Celebrations', emoji: '🎂', sentiment: 'neutral' },
  { value: 'quick_stop', label: 'A quick stop', emoji: '⏱️', sentiment: 'neutral' },
];

const BEST_FOR_COURSE: readonly CuratedTag[] = [
  { value: 'complete_beginners', label: 'Complete beginners', emoji: '🌱', sentiment: 'neutral' },
  { value: 'some_experience', label: 'Some experience', emoji: '📗', sentiment: 'neutral' },
  { value: 'advanced', label: 'Advanced learners', emoji: '🎓', sentiment: 'neutral' },
  { value: 'career_switchers', label: 'Career switchers', emoji: '🔀', sentiment: 'neutral' },
  { value: 'interview_prep', label: 'Interview prep', emoji: '🎯', sentiment: 'neutral' },
  { value: 'refresher', label: 'A refresher', emoji: '🔁', sentiment: 'neutral' },
];

/**
 * Every curated vocabulary, keyed by tag-set name. `food` is deliberately ABSENT:
 * the existing `FoodTagSelector` owns its own 13-tag vocabulary and stays
 * regression-identical, exempt from the curated caps.
 */
export const CURATED_TAG_VOCABULARIES = {
  'stood_out:place': STOOD_OUT_PLACE,
  'stood_out:product': STOOD_OUT_PRODUCT,
  'stood_out:brand': STOOD_OUT_BRAND,
  'stood_out:movie': STOOD_OUT_MOVIE,
  'stood_out:tv_show': STOOD_OUT_TV_SHOW,
  'stood_out:book': STOOD_OUT_BOOK,
  'stood_out:game': STOOD_OUT_GAME,
  'stood_out:app': STOOD_OUT_APP,
  'stood_out:course': STOOD_OUT_COURSE,
  'stood_out:service': STOOD_OUT_SERVICE,
  'stood_out:professional': STOOD_OUT_PROFESSIONAL,
  'stood_out:event': STOOD_OUT_EVENT,
  'stood_out:experience': STOOD_OUT_EXPERIENCE,
  'stood_out:others': STOOD_OUT_OTHERS,
  'best_for:place': BEST_FOR_PLACE,
  'best_for:course': BEST_FOR_COURSE,
} as const satisfies Record<string, readonly CuratedTag[]>;

export type CuratedTagSet = keyof typeof CURATED_TAG_VOCABULARIES;

export function getCuratedVocabulary(tagSet: CuratedTagSet): readonly CuratedTag[] {
  return CURATED_TAG_VOCABULARIES[tagSet];
}

/** Label lookup for rendering stored codes. Unknown codes are NOT invented here. */
export function findCuratedTag(tagSet: CuratedTagSet, value: string): CuratedTag | undefined {
  return CURATED_TAG_VOCABULARIES[tagSet].find((t) => t.value === value);
}
