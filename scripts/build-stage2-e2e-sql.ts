/**
 * Phase 3C Stage 2 — end-to-end materialization harness (SQL generator).
 *
 * The payloads below are produced by the REAL persistence layer
 * (`buildQuestionnairePatch` + `mergeReviewMetadata`) — never hand-written JSON.
 * This script only serializes what the review form would send into SQL, so the
 * database trigger sees exactly the metadata the client produces.
 *
 * Run: `bun scripts/build-stage2-e2e-sql.ts`
 */
import {
  buildQuestionnairePatch,
  readQuestionnaireEnvelope,
  QUESTIONNAIRE_METADATA_KEY,
} from '../src/components/profile/reviews/questionnaire/envelope';
import { mergeReviewMetadata } from '../src/components/profile/reviews/questionnaire/metadata';
import { QUESTIONNAIRE_REGISTRY } from '../src/components/profile/reviews/questionnaire/registry';

const USER_ID = 'ff397c4b-dcb1-4154-8dd5-d3ec573502d3';
const ENTITY_ID = '9f1997f1-1ce7-47a0-9b39-918d7c99cc38';
const CATEGORY = 'brand';
const config = QUESTIONNAIRE_REGISTRY.brand;

/** Unrelated root metadata that must survive every save byte-identical. */
const ROOT_METADATA = { provenance: { source: 'stage2_e2e' }, unrelated_key: [1, 2, 3] };

interface Save {
  /** Metadata currently stored on the row (what the form loaded). */
  stored: Record<string, unknown>;
  choices: Record<string, string>;
  touched: string[];
}

function applySave({ stored, choices, touched }: Save): Record<string, unknown> | undefined {
  const read = readQuestionnaireEnvelope(stored, CATEGORY);
  const patch = buildQuestionnairePatch({
    read,
    category: CATEGORY,
    config,
    choices,
    curated: {},
    touchedFieldIds: new Set(touched),
  });
  const metadataPatch: Record<string, unknown> = {};
  const removeKeys: string[] = [];
  if (patch.action === 'write') metadataPatch[QUESTIONNAIRE_METADATA_KEY] = patch.envelope;
  if (patch.action === 'remove') removeKeys.push(QUESTIONNAIRE_METADATA_KEY);
  return mergeReviewMetadata(
    stored,
    Object.keys(metadataPatch).length > 0 ? metadataPatch : undefined,
    removeKeys,
  );
}

interface Case {
  key: string;
  rating: number;
  /** Successive saves, oldest first. */
  saves: Omit<Save, 'stored'>[];
  expectation: string;
}

const cases: Case[] = [
  {
    key: 'case1_rating1_yes',
    rating: 1,
    saves: [{ choices: { would_recommend: 'yes' }, touched: ['would_recommend'] }],
    expectation: 'is_recommended = true (envelope beats rating 1)',
  },
  {
    key: 'case2_rating5_no',
    rating: 5,
    saves: [{ choices: { would_recommend: 'no' }, touched: ['would_recommend'] }],
    expectation: 'is_recommended = false (envelope beats rating 5)',
  },
  {
    key: 'case3_rating5_maybe',
    rating: 5,
    saves: [{ choices: { would_recommend: 'maybe' }, touched: ['would_recommend'] }],
    expectation: 'is_recommended = false (maybe is explicit, not recommending)',
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
    expectation: 'answer removed, envelope kept, rating fallback -> is_recommended = true',
  },
  {
    key: 'case5_clear_last_answer',
    rating: 3,
    saves: [
      { choices: { would_recommend: 'yes' }, touched: ['would_recommend'] },
      { choices: {}, touched: ['would_recommend'] },
    ],
    expectation: 'metadata.questionnaire absent entirely, rating 3 -> is_recommended = false',
  },
  {
    key: 'case6_unrelated_edit_no_envelope',
    rating: 5,
    saves: [{ choices: {}, touched: [] }],
    expectation: 'no envelope ever created, rating 5 -> is_recommended = true',
  },
];

const lit = (value: unknown) => `'${JSON.stringify(value).replace(/'/g, "''")}'::jsonb`;

const statements: string[] = [];
statements.push(`DELETE FROM public.reviews WHERE title LIKE 'STAGE2_E2E_%';`);

for (const c of cases) {
  const title = `STAGE2_E2E_${c.key}`;
  let stored: Record<string, unknown> = { ...ROOT_METADATA };
  statements.push(
    `INSERT INTO public.reviews (user_id, entity_id, title, category, rating, visibility, metadata) ` +
      `VALUES ('${USER_ID}', '${ENTITY_ID}', '${title}', '${CATEGORY}', ${c.rating}, 'private', ${lit(stored)});`,
  );
  c.saves.forEach((save, i) => {
    const next = applySave({ ...save, stored }) ?? {};
    stored = next;
    const headline = `${title} save ${i + 1}`;
    statements.push(
      `UPDATE public.reviews SET metadata = ${lit(next)}, subtitle = '${headline}' WHERE title = '${title}';`,
    );
  });
  statements.push(`-- expect: ${c.expectation}`);
}

console.log(statements.join('\n'));
