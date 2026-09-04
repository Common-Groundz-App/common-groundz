/**
 * Emits the SQL parity check for the recommendation resolver.
 *
 * The cases are NOT written here. They are read verbatim from the one shared
 * fixture that the Vitest suite also imports:
 *
 *   src/services/review/__fixtures__/recommendationTruthTable.json
 *
 * The generated statement feeds every resolverCase to
 * public.resolve_review_recommendation and reports mismatches plus the case
 * count, so a truncated or silently skipped fixture fails instead of passing.
 *
 * Usage:  node scripts/build-recommendation-parity-sql.mjs
 * Then run the printed statement as the postgres role (EXECUTE on the resolver
 * is intentionally postgres-only).
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const fixturePath = resolve(
  here,
  '../src/services/review/__fixtures__/recommendationTruthTable.json',
);
const fixture = JSON.parse(readFileSync(fixturePath, 'utf8'));

if (fixture.resolverCases.length !== fixture.expectedResolverCaseCount) {
  throw new Error(
    `Fixture case count mismatch: ${fixture.resolverCases.length} vs declared ${fixture.expectedResolverCaseCount}`,
  );
}

// Only the fields the SQL resolver takes, so the payload stays small; the
// values themselves are untouched fixture data.
const payload = {
  declared: fixture.expectedResolverCaseCount,
  cases: fixture.resolverCases.map((c, i) => ({
    i,
    e: c.envelope,
    c: c.category,
    l: c.latestIntent,
    r: c.effectiveRating,
    x: c.expected,
  })),
};

const literal = JSON.stringify(payload).replaceAll("'", "''");

process.stdout.write(`with fixture as (select '${literal}'::jsonb f),
cases as (
  select (c->>'i')::int idx,
         case when jsonb_typeof(c->'e')='null' then null else c->'e' end env,
         c->>'c' cat,
         c->>'l' latest,
         case when jsonb_typeof(c->'r')='null' then null else (c->>'r')::numeric end rating,
         c->'x' expected
  from fixture, jsonb_array_elements(f->'cases') c
),
run as (
  select idx, expected, public.resolve_review_recommendation(env, cat, latest, rating) actual from cases
),
bad as (
  select idx, expected, actual from run
  where actual->'intent' is distinct from expected->'intent'
     or actual->>'source' is distinct from expected->>'source'
     or (actual->>'is_recommended')::bool is distinct from (expected->>'isRecommended')::bool
)
select (select count(*) from cases) case_count,
       (select (f->>'declared')::int from fixture) declared_count,
       (select count(*) from bad) mismatches,
       coalesce((select jsonb_agg(jsonb_build_object('idx',idx,'expected',expected,'actual',actual)) from bad),'[]'::jsonb) failures;
`);
