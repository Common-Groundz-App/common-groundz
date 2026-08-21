/**
 * Provider / Offering relationship registry.
 *
 * Provider and offering are ROLES, not entity types. They describe how an entity
 * is being used in a relationship. Nothing here is added to the Supabase
 * `entity_type` enum (which stays at 15 canonical values).
 *
 * `entities.parent_id` remains a GENERIC parent/child edge. Provider -> offering
 * is one *semantic use* of it. Therefore this registry validates offering
 * operations only — it must never be used as a blanket guard on every reparent.
 * An unregistered pair means "not an offering relationship", NOT "invalid data".
 *
 * Plain TypeScript, no React. Phase 0 builds the data layer only; components are
 * wired to it in Phase 1 (labels, context lines, "add an offering" affordances).
 */

import type { CanonicalEntityType } from './entityType';

export interface OfferingRelationship {
  /** The entity type acting as provider (the parent). */
  provider: CanonicalEntityType;
  /** The entity type acting as offering (the child). */
  offering: CanonicalEntityType;
  /** Plural label for the child section, e.g. "Dishes". */
  offeringPlural: string;
  /** Singular label used in create affordances, e.g. "Dish". */
  offeringSingular: string;
  /** Connector used in an offering's context line: "Classic Burger" **at** "Truffles". */
  verb: string;
}

/**
 * Live relationships only. Adding a new relationship is one row here plus its
 * questionnaire entry — no component edits. Modelled many-to-many on purpose:
 * one offering type may have several provider types (e.g. `service`).
 */
export const OFFERING_RELATIONSHIPS: readonly OfferingRelationship[] = [
  {
    provider: 'brand',
    offering: 'product',
    offeringPlural: 'Products',
    offeringSingular: 'Product',
    verb: 'by',
  },
  {
    provider: 'place',
    offering: 'food',
    offeringPlural: 'Dishes',
    offeringSingular: 'Dish',
    verb: 'at',
  },
];

/** Is this type the provider of at least one registered relationship? */
export function isProviderType(type: CanonicalEntityType): boolean {
  return OFFERING_RELATIONSHIPS.some((r) => r.provider === type);
}

/** Is this type the offering of at least one registered relationship? */
export function isOfferingType(type: CanonicalEntityType): boolean {
  return OFFERING_RELATIONSHIPS.some((r) => r.offering === type);
}

/** Offering types that may be created under a given provider type. */
export function getOfferingTypesFor(provider: CanonicalEntityType): CanonicalEntityType[] {
  return OFFERING_RELATIONSHIPS.filter((r) => r.provider === provider).map((r) => r.offering);
}

/** Provider types that may host a given offering type. */
export function getProviderTypesFor(offering: CanonicalEntityType): CanonicalEntityType[] {
  return OFFERING_RELATIONSHIPS.filter((r) => r.offering === offering).map((r) => r.provider);
}

/** Look up the relationship for a pair, or `null` when it is not an offering pair. */
export function getOfferingRelationship(
  provider: CanonicalEntityType,
  offering: CanonicalEntityType
): OfferingRelationship | null {
  return (
    OFFERING_RELATIONSHIPS.find((r) => r.provider === provider && r.offering === offering) ?? null
  );
}

/** Is this a registered provider -> offering pair? */
export function isValidOfferingPair(
  provider: CanonicalEntityType,
  offering: CanonicalEntityType
): boolean {
  return getOfferingRelationship(provider, offering) !== null;
}

/**
 * Guard for offering-CREATION paths only. Never call this from generic
 * reparenting code — non-offering hierarchy edges (variants, editions,
 * chain -> location, series -> book) must stay legal.
 */
export function assertValidOfferingPair(
  provider: CanonicalEntityType,
  offering: CanonicalEntityType
): OfferingRelationship {
  const relationship = getOfferingRelationship(provider, offering);
  if (!relationship) {
    throw new Error(
      `Not a registered offering relationship: ${provider} -> ${offering}. ` +
        `Register the pair in OFFERING_RELATIONSHIPS, or use a generic parent/child edge instead.`
    );
  }
  return relationship;
}

/**
 * Section heading for a provider's children of a given offering type.
 * Returns `null` when the pair is not an offering relationship, so callers can
 * fall back to generic copy instead of mislabelling.
 */
export function getOfferingSectionLabel(
  provider: CanonicalEntityType,
  offering: CanonicalEntityType
): string | null {
  return getOfferingRelationship(provider, offering)?.offeringPlural ?? null;
}

/** Connector for an offering context line ("at", "by", "from"), or `null`. */
export function getOfferingContextVerb(
  provider: CanonicalEntityType,
  offering: CanonicalEntityType
): string | null {
  return getOfferingRelationship(provider, offering)?.verb ?? null;
}
