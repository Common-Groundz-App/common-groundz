/**
 * Phase 3A — canonical review identity persistence.
 *
 * `reviews.title` = subject identity. `reviews.subtitle` = the user's headline.
 * `reviews.venue` = a compatibility SNAPSHOT of review context, not a question.
 *
 * Both values follow `subjectOrigin` so that merely opening and re-saving an
 * older review can never silently rewrite its stored identity.
 *
 * | Context                                        | title / venue          |
 * |------------------------------------------------|------------------------|
 * | new linked review (`entity-page`)              | derive from subject    |
 * | subject deliberately chosen (`user-selected`)  | derive from subject    |
 * | existing review, subject untouched (`loaded`)  | preserve stored values |
 * | legacy unlinked (`none` / no subject)          | preserve, editable     |
 *
 * Venue snapshot policy for a derived write:
 *  - offering with a resolved provider → provider name
 *  - `place` with a useful address/location → that address
 *  - any other standalone canonical type → empty
 *
 * Author, director, brand and manufacturer are NEVER written to `reviews.venue`
 * any more: those are entity facts and stay on the entity.
 *
 * Pure module: no React, no network.
 */
import type { CanonicalEntityType } from '@/services/entityType';

export type SubjectOrigin = 'none' | 'loaded' | 'entity-page' | 'user-selected';

export interface IdentitySubject {
  name?: string | null;
  type?: CanonicalEntityType | null;
  venue?: string | null;
  metadata?: { formatted_address?: string | null } | null;
}

export interface ResolveIdentityInput {
  subjectOrigin: SubjectOrigin;
  /** The linked subject, when there is one. */
  subject: IdentitySubject | null;
  /** Provider (parent) name resolved from the hierarchy, when applicable. */
  providerName?: string | null;
  /** Values currently stored on the review being edited. */
  storedTitle?: string | null;
  storedVenue?: string | null;
  /** Editable values used ONLY on the legacy-unlinked path. */
  legacyTitle?: string | null;
  legacyVenue?: string | null;
  /** True when this review has no linked subject at all. */
  isLegacyUnlinked: boolean;
}

export interface ReviewIdentity {
  title: string;
  venue: string;
  /** How the values were produced — useful for tests and telemetry. */
  source: 'derived' | 'preserved' | 'legacy-editable';
}

/** Venue snapshot for a DERIVED write. Never an author/director/brand. */
export function deriveVenueSnapshot(
  subject: IdentitySubject | null,
  providerName?: string | null,
): string {
  const provider = (providerName ?? '').trim();
  if (provider) return provider;

  if (subject?.type === 'place') {
    const address = (subject.metadata?.formatted_address ?? '').trim();
    if (address) return address;
    const venue = (subject.venue ?? '').trim();
    if (venue) return venue;
  }

  return '';
}

export function resolveReviewIdentity(input: ResolveIdentityInput): ReviewIdentity {
  const {
    subjectOrigin,
    subject,
    providerName,
    storedTitle,
    storedVenue,
    legacyTitle,
    legacyVenue,
    isLegacyUnlinked,
  } = input;

  if (isLegacyUnlinked) {
    return {
      title: (legacyTitle ?? storedTitle ?? '').trim(),
      venue: (legacyVenue ?? storedVenue ?? '').trim(),
      source: 'legacy-editable',
    };
  }

  const derives = subjectOrigin === 'user-selected' || subjectOrigin === 'entity-page';
  if (derives && subject) {
    return {
      title: (subject.name ?? '').trim(),
      venue: deriveVenueSnapshot(subject, providerName),
      source: 'derived',
    };
  }

  return {
    title: (storedTitle ?? '').trim(),
    venue: (storedVenue ?? '').trim(),
    source: 'preserved',
  };
}
