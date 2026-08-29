// Phase 2.3 — the ONE server-side exact-identity classifier for review-subject
// creation. Used by `check-entity-duplicates` for advisory classification; the
// authoritative recheck lives in SQL inside `create_entity_subject` and must
// implement the same rules (parity-tested).
//
// Rules:
//  1. same non-empty (api_source, api_ref):
//       same canonical type  -> 'exact'
//       different type       -> 'conflict' (data-integrity signal, never merged)
//  2. same normalized website_url:
//       same canonical type  -> 'exact'
//       different type       -> 'possible' (never merged across types)
//  3. offering: same parent_id + same type + same NON-EMPTY normalized name
//                            -> 'exact'
//  Everything else, including standalone same-name matches, is at most
//  'possible'. Returns `null` when the rows are not duplicates at all.
//
// The empty-normalization rule is load-bearing: '東京' and '大阪' both normalize
// to '' and must NEVER merge. An empty normalized name carries no identity.

import { normalizeBrandName } from './brand_normalize.ts';

export type DuplicateClass = 'exact' | 'possible' | 'conflict';

export interface SubjectIdentityInput {
  name: string;
  type: string;
  parentId?: string | null;
  apiSource?: string | null;
  apiRef?: string | null;
  websiteUrl?: string | null;
}

export interface ExistingEntityIdentity {
  id: string;
  name?: string | null;
  type?: string | null;
  parent_id?: string | null;
  api_source?: string | null;
  api_ref?: string | null;
  website_url?: string | null;
}

/** Identity name normalization. '' means "no name identity available". */
export function normalizeIdentityName(s: string): string {
  return normalizeBrandName(s);
}

/** Lowercase, host+path, trailing slashes stripped. null on blank/invalid. */
export function normalizeWebsiteUrl(url?: string | null): string | null {
  if (!url) return null;
  try {
    const u = new URL(url);
    const host = u.hostname.replace(/^www\./, '').toLowerCase();
    let path = u.pathname.replace(/\/+$/, '');
    if (path === '') path = '/';
    return `${u.protocol}//${host}${path}`;
  } catch {
    return null;
  }
}

function nonblank(v?: string | null): string | null {
  const t = (v ?? '').trim();
  return t === '' ? null : t;
}

/**
 * Classify one existing entity against the subject the user wants to create.
 * Standalone name-only matches are 'possible' by construction — never 'exact'.
 */
export function classifyEntity(
  input: SubjectIdentityInput,
  existing: ExistingEntityIdentity,
): DuplicateClass | null {
  if (!existing || !existing.id) return null;

  const type = (input.type ?? '').trim().toLowerCase();
  const exType = (existing.type ?? '').trim().toLowerCase();

  // 1) External reference — strongest signal.
  const apiSource = nonblank(input.apiSource);
  const apiRef = nonblank(input.apiRef);
  if (
    apiSource && apiRef &&
    nonblank(existing.api_source) === apiSource &&
    nonblank(existing.api_ref) === apiRef
  ) {
    return exType === type ? 'exact' : 'conflict';
  }

  // 2) Website identity requires the same canonical type.
  const web = normalizeWebsiteUrl(input.websiteUrl);
  const exWeb = normalizeWebsiteUrl(existing.website_url);
  if (web && exWeb && web === exWeb) {
    return exType === type ? 'exact' : 'possible';
  }

  // 3) Offering identity: provider + type + non-empty normalized name.
  const parentId = input.parentId ?? null;
  const norm = normalizeIdentityName(input.name ?? '');
  const exNorm = normalizeIdentityName(existing.name ?? '');
  if (parentId && existing.parent_id === parentId && exType === type && norm !== '' && norm === exNorm) {
    return 'exact';
  }

  // Standalone name-only: possible, never exact.
  if (!parentId && exType === type && norm !== '' && norm === exNorm) {
    return 'possible';
  }

  return null;
}
