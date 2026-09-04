/**
 * Phase 3C Stage 2 — registry lint.
 *
 * Parses the FROZEN specification `docs/phase-3b-tag-vocabularies.md` and asserts
 * the shipped vocabularies match it exactly: every tag id, every sentiment, and
 * the per-type tag count declared in each heading.
 *
 * Any divergence is an implementation bug in `vocabularies.ts` — never a licence
 * to edit the frozen document.
 */
import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  CURATED_TAG_VOCABULARIES,
  type CuratedTagSet,
  type TagSentiment,
} from '@/components/profile/reviews/questionnaire/vocabularies';

interface DocVocabulary {
  tagSet: string;
  declaredCount: number;
  tags: { value: string; sentiment: TagSentiment }[];
}

function parseFrozenDoc(): DocVocabulary[] {
  const file = path.resolve(process.cwd(), 'docs/phase-3b-tag-vocabularies.md');
  const lines = fs.readFileSync(file, 'utf8').split('\n');

  const out: DocVocabulary[] = [];
  let field: 'stood_out' | 'best_for' | null = null;
  let current: DocVocabulary | null = null;

  for (const line of lines) {
    const section = /^##\s+`(stood_out|best_for)`\s+vocabularies/.exec(line);
    if (section) {
      field = section[1] as 'stood_out' | 'best_for';
      current = null;
      continue;
    }
    if (/^##\s/.test(line) && !section) {
      field = null;
      current = null;
      continue;
    }
    const heading = /^###\s+([a-z_]+)\s+\((\d+)\)/.exec(line);
    if (heading && field) {
      current = {
        tagSet: `${field}:${heading[1]}`,
        declaredCount: Number(heading[2]),
        tags: [],
      };
      out.push(current);
      continue;
    }
    const row = /^\|\s*`([a-z0-9_]+)`\s*\|[^|]*\|[^|]*\|\s*(positive|neutral|negative)\s*\|/.exec(
      line,
    );
    if (row && current) {
      current.tags.push({ value: row[1], sentiment: row[2] as TagSentiment });
    }
  }
  return out;
}

const docVocabularies = parseFrozenDoc();

describe('curated tag vocabularies match the frozen specification', () => {
  it('parses the frozen document', () => {
    // 14 stood_out vocabularies (food has none) + 2 best_for vocabularies.
    expect(docVocabularies.length).toBe(16);
  });

  it('ships exactly the vocabularies the document declares', () => {
    expect(docVocabularies.map((v) => v.tagSet).sort()).toEqual(
      Object.keys(CURATED_TAG_VOCABULARIES).sort(),
    );
  });

  it('never ships a `stood_out:food` vocabulary', () => {
    expect(Object.keys(CURATED_TAG_VOCABULARIES)).not.toContain('stood_out:food');
  });

  for (const doc of docVocabularies) {
    describe(doc.tagSet, () => {
      const shipped = CURATED_TAG_VOCABULARIES[doc.tagSet as CuratedTagSet];

      it('matches the per-type count in the heading', () => {
        expect(doc.tags.length).toBe(doc.declaredCount);
        expect(shipped.length).toBe(doc.declaredCount);
      });

      it('matches every tag id, in order', () => {
        expect(shipped.map((t) => t.value)).toEqual(doc.tags.map((t) => t.value));
      });

      it('matches every sentiment', () => {
        expect(shipped.map((t) => `${t.value}:${t.sentiment}`)).toEqual(
          doc.tags.map((t) => `${t.value}:${t.sentiment}`),
        );
      });

      it('has unique ids and non-empty presentation', () => {
        expect(new Set(shipped.map((t) => t.value)).size).toBe(shipped.length);
        for (const tag of shipped) {
          expect(tag.label.trim().length).toBeGreaterThan(0);
          expect(tag.emoji.trim().length).toBeGreaterThan(0);
        }
      });
    });
  }
});
