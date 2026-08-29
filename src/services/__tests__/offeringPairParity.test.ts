/**
 * Phase 2.3 — parity test.
 *
 * `create_entity_subject` (SQL) enforces the provider→offering allow-list at
 * creation time; `entityRelationshipRegistry` (TS) drives the UI. These must
 * never drift apart, and the Deno mirror in `_shared/offeringPairs.ts` must
 * match too. This test fails loudly if any of the three disagree.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { OFFERING_RELATIONSHIPS } from '@/services/entityRelationshipRegistry';

const MIGRATIONS_DIR = join(__dirname, '../../../supabase/migrations');

function loadCreateEntitySubjectSql(): string {
  const file = readdirSync(MIGRATIONS_DIR)
    .filter((f) => f.endsWith('.sql'))
    .map((f) => join(MIGRATIONS_DIR, f))
    .map((p) => [p, readFileSync(p, 'utf8')] as const)
    .find(([, sql]) => sql.includes('create_entity_subject'));
  if (!file) throw new Error('Migration containing create_entity_subject not found');
  return file[1];
}

describe('SQL ↔ registry offering-pair parity', () => {
  const sql = loadCreateEntitySubjectSql();

  it('every registry pair is enforced by the SQL allow-list', () => {
    for (const rel of OFFERING_RELATIONSHIPS) {
      const needle = `v_parent.type = '${rel.provider}' AND v_type = '${rel.offering}'`;
      expect(
        sql.includes(needle),
        `SQL allow-list is missing (${rel.provider} → ${rel.offering})`,
      ).toBe(true);
    }
  });

  it('the Deno edge-function mirror matches the registry exactly', () => {
    const mirror = readFileSync(
      join(__dirname, '../../../supabase/functions/_shared/offeringPairs.ts'),
      'utf8',
    );
    const mirrorPairs = [
      ...mirror.matchAll(/provider:\s*'([a-z_]+)',\s*offering:\s*'([a-z_]+)'/g),
    ].map((m) => `${m[1]}→${m[2]}`);
    const registryPairs = OFFERING_RELATIONSHIPS.map((r) => `${r.provider}→${r.offering}`);
    expect(mirrorPairs.sort()).toEqual([...registryPairs].sort());
  });

  it('the SQL allow-list contains no pairs the registry does not know', () => {
    const matches = [
      ...sql.matchAll(/v_parent\.type = '([a-z_]+)' AND v_type = '([a-z_]+)'/g),
    ].map((m) => `${m[1]}→${m[2]}`);
    expect(matches.length).toBeGreaterThan(0);
    const registryPairs = new Set(
      OFFERING_RELATIONSHIPS.map((r) => `${r.provider}→${r.offering}`),
    );
    for (const pair of matches) {
      expect(registryPairs.has(pair), `SQL allows unknown pair ${pair}`).toBe(true);
    }
  });
});
