/**
 * Phase 3C Stage 2 — end-to-end materialization harness (SQL generator).
 *
 * Every `metadata` value below is produced by `buildReviewMetadataForSave`, the
 * ONE function `ReviewForm` calls on submit. Nothing here hand-writes a
 * `metadata.questionnaire` object, so a bug in the Stage 2 patch builder fails
 * this harness instead of hiding behind literal JSON.
 *
 * What is genuinely proven: real save-path metadata -> reviews.metadata ->
 * database trigger -> reviews.is_recommended.
 * What is NOT proven here: the browser -> supabase-js -> RLS network hop (this
 * project uses an external Supabase with no obtainable test session).
 *
 * Fixtures use explicit per-run UUIDs and a run token; cleanup deletes those
 * exact ids only — never a title prefix match.
 *
 * Run: `bun scripts/build-stage2-e2e-sql.ts`
 */
import { randomUUID } from 'node:crypto';
import { readQuestionnaireEnvelope } from '../src/components/profile/reviews/questionnaire/envelope';
import { buildReviewMetadataForSave } from '../src/components/profile/reviews/questionnaire/saveMetadata';
import { QUESTIONNAIRE_REGISTRY } from '../src/components/profile/reviews/questionnaire/registry';

const USER_ID = 'ff397c4b-dcb1-4154-8dd5-d3ec573502d3';
const ENTITY_ID = '9f1997f1-1ce7-47a0-9b39-918d7c99cc38';
const CATEGORY = 'brand';
const config = QUESTIONNAIRE_REGISTRY.brand;
const RUN_TOKEN = process.env.STAGE2_RUN_TOKEN ?? randomUUID();

/** Unrelated root metadata that must survive every save byte-identical. */
const ROOT_METADATA = {
  provenance: { source: 'stage2_e2e' },
  unrelated_key: [1, 2, 3],
  stage2_run_token: RUN_TOKEN,
};

interface Save {
  choices: Record<string, string>;
  touched: string[];
}

function applySave(stored: Record<string, unknown>, save: Save): Record<string, unknown> {
  const read = readQuestionnaireEnvelope(stored, CATEGORY);
  const { metadata } = buildReviewMetadataForSave({
    storedMetadata: stored,
    config,
    category: CATEGORY,
    questionnaireWritable: true,
    effectiveEnvelope: read,
    storedEnvelope: read,
    choices: save.choices,
    curated: {},
    touchedFieldIds: new Set(save.touched),
    foodTags: [],
    questionnaireReset: false,
  });
  return metadata ?? {};
}

interface Case {
  key: string;
  rating: number;
  /** Successive saves, oldest first. */
  saves: Save[];
  /** Expected `reviews.is_recommended` after the last save. */
  expectedRecommended: boolean;
  /** Expected presence of `metadata.questionnaire` after the last save. */
  expectEnvelope: boolean;
  note: string;
}

const cases: Case[] = [
  {
    key: 'case1_rating1_yes',
    rating: 1,
    saves: [{ choices: { would_recommend: 'yes' }, touched: ['would_recommend'] }],
    expectedRecommended: true,
    expectEnvelope: true,
    note: 'envelope beats rating 1',
  },
  {
    key: 'case2_rating5_no',
    rating: 5,
    saves: [{ choices: { would_recommend: 'no' }, touched: ['would_recommend'] }],
    expectedRecommended: false,
    expectEnvelope: true,
    note: 'envelope beats rating 5',
  },
  {
    key: 'case3_rating5_maybe',
    rating: 5,
    saves: [{ choices: { would_recommend: 'maybe' }, touched: ['would_recommend'] }],
    expectedRecommended: false,
    expectEnvelope: true,
    note: 'maybe is explicit, not recommending',
  },
  {
    key: 'case4_clear_would_recommend',
    rating: 5,
    saves: [
      {
        choices: { would_recommend: 'no', repeat_intent: 'yes' },
        touched: ['would_recommend', 'repeat_intent'],
      },
      { choices: { repeat_intent: 'yes' }, touched: ['would_recommend'] },
    ],
    expectedRecommended: true,
    expectEnvelope: true,
    note: 'answer removed, envelope kept, rating fallback',
  },
  {
    key: 'case5_clear_last_answer',
    rating: 3,
    saves: [
      { choices: { would_recommend: 'yes' }, touched: ['would_recommend'] },
      { choices: {}, touched: ['would_recommend'] },
    ],
    expectedRecommended: false,
    expectEnvelope: false,
    note: 'envelope removed entirely, rating 3 fallback',
  },
  {
    key: 'case6_unrelated_edit_no_envelope',
    rating: 5,
    saves: [{ choices: {}, touched: [] }],
    expectedRecommended: true,
    expectEnvelope: false,
    note: 'headline-only edit never creates an envelope',
  },
];

const lit = (value: unknown) => `'${JSON.stringify(value).replace(/'/g, "''")}'::jsonb`;
const sq = (value: string) => `'${value.replace(/'/g, "''")}'`;

const write: string[] = [];
const rows: string[] = [];
const ids: string[] = [];

for (const c of cases) {
  const id = randomUUID();
  ids.push(id);
  const title = `STAGE2_E2E ${c.key} ${RUN_TOKEN}`;
  let stored: Record<string, unknown> = { ...ROOT_METADATA };
  write.push(
    `INSERT INTO public.reviews (id, user_id, entity_id, title, category, rating, visibility, metadata) ` +
      `VALUES ('${id}', '${USER_ID}', '${ENTITY_ID}', ${sq(title)}, '${CATEGORY}', ${c.rating}, 'private', ${lit(stored)});`,
  );
  c.saves.forEach((save, i) => {
    stored = applySave(stored, save);
    write.push(
      `UPDATE public.reviews SET metadata = ${lit(stored)}, subtitle = ${sq(`save ${i + 1}`)} WHERE id = '${id}';`,
    );
  });
  rows.push(
    `('${id}'::uuid, ${sq(c.key)}, ${c.expectedRecommended}, ${c.expectEnvelope}, ${sq(c.note)})`,
  );
}

const assertions = `WITH expected(id, case_key, expect_recommended, expect_envelope, note) AS (
  VALUES
    ${rows.join(',\n    ')}
)
SELECT
  e.case_key,
  e.note,
  r.rating,
  r.is_recommended,
  r.metadata ? 'questionnaire' AS has_envelope,
  jsonb_typeof(r.metadata #> '{questionnaire,version}') AS version_type,
  r.metadata #>> '{questionnaire,version}' AS version_value,
  r.metadata #>> '{questionnaire,type}' = r.category AS type_matches_category,
  jsonb_typeof(r.metadata #> '{questionnaire,answers}') AS answers_type,
  r.metadata #>> '{questionnaire,answers,would_recommend}' AS stored_intent,
  (r.metadata -> 'provenance') = '{"source":"stage2_e2e"}'::jsonb
    AND (r.metadata -> 'unrelated_key') = '[1,2,3]'::jsonb
    AND (r.metadata #>> '{stage2_run_token}') = ${sq(RUN_TOKEN)} AS root_metadata_intact,
  CASE
    WHEN r.id IS NULL THEN 'FAIL: fixture row missing'
    WHEN r.is_recommended IS DISTINCT FROM e.expect_recommended THEN 'FAIL: is_recommended'
    WHEN (r.metadata ? 'questionnaire') IS DISTINCT FROM e.expect_envelope THEN 'FAIL: envelope presence'
    WHEN e.expect_envelope AND jsonb_typeof(r.metadata #> '{questionnaire,version}') <> 'number' THEN 'FAIL: version not numeric'
    WHEN e.expect_envelope AND (r.metadata #>> '{questionnaire,version}') <> '1' THEN 'FAIL: version value'
    WHEN e.expect_envelope AND (r.metadata #>> '{questionnaire,type}') <> r.category THEN 'FAIL: type <> category'
    WHEN e.expect_envelope AND jsonb_typeof(r.metadata #> '{questionnaire,answers}') <> 'object' THEN 'FAIL: answers not object'
    WHEN NOT (
      (r.metadata -> 'provenance') = '{"source":"stage2_e2e"}'::jsonb
      AND (r.metadata -> 'unrelated_key') = '[1,2,3]'::jsonb
      AND (r.metadata #>> '{stage2_run_token}') = ${sq(RUN_TOKEN)}
    ) THEN 'FAIL: root metadata mutated'
    ELSE 'PASS'
  END AS result
FROM expected e
LEFT JOIN public.reviews r ON r.id = e.id
ORDER BY e.case_key;`;

const cleanup = `DELETE FROM public.reviews WHERE id IN (${ids.map((i) => `'${i}'`).join(', ')});`;
const cleanupCheck = `SELECT count(*) AS remaining_fixture_rows FROM public.reviews WHERE id IN (${ids
  .map((i) => `'${i}'`)
  .join(', ')}) OR metadata #>> '{stage2_run_token}' = ${sq(RUN_TOKEN)};`;

console.log(`-- run token: ${RUN_TOKEN}`);
console.log('-- ==== 1. WRITE (run with run_sql) ====');
console.log(write.join('\n'));
console.log('\n-- ==== 2. ASSERT (run with read_query) ====');
console.log(assertions);
console.log('\n-- ==== 3. CLEANUP (run with run_sql) ====');
console.log(cleanup);
console.log('\n-- ==== 4. CLEANUP CHECK (run with read_query) ====');
console.log(cleanupCheck);
