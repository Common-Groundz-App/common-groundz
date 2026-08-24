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

import { parseEntityType, type CanonicalEntityType } from './entityType';

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

// ---------------------------------------------------------------------------
// Phase 1: Centralized child-section presentation (single source of truth)
// ---------------------------------------------------------------------------

/** Label for children that do not form a registered provider→offering pair. */
export const GENERIC_CHILDREN_LABEL = 'Related';
/** Aggregate label for a mixed set where EVERY group is a registered offering. */
export const MIXED_OFFERINGS_LABEL = 'Offerings';

export interface ChildPresentationGroup<T> {
  /** Canonical child type for the group, or `null` for the unregistered catch-all. */
  type: CanonicalEntityType | null;
  /** Display label for the group: registry plural ("Products"/"Dishes") or "Related". */
  label: string;
  /** True when the group came from a registered provider→offering pair. */
  registered: boolean;
  children: T[];
}

export type ChildPresentationMode = 'none' | 'single' | 'mixed';

export interface ChildPresentation<T> {
  /**
   * - `none`: no children — callers hide the section/tab entirely.
   * - `single`: exactly one group — `label` is that group's label.
   * - `mixed`: multiple groups — `label` is the aggregate:
   *   "Offerings" when every group is registered, otherwise "Related".
   *   Callers MUST render `groups` separately to keep distinct nouns.
   */
  mode: ChildPresentationMode;
  /** Section/tab label, or `null` when `mode === 'none'`. */
  label: string | null;
  /** Groups in stable order: registered groups in registry order, generic last. */
  groups: ChildPresentationGroup<T>[];
  totalCount: number;
}

/**
 * THE one place that decides how a provider's child entities are labelled.
 *
 * Rules (Phase 1 contract — components must not reimplement):
 * - A child group gets the registry noun ("Products", "Dishes") ONLY when the
 *   (provider type, child type) pair is registered. Everything else is "Related".
 * - Distinct child types stay as distinct groups — never flattened into one
 *   noun, and never labelled "Products" generically.
 * - Aggregate tab/section label for mixed sets: "Offerings" if all groups are
 *   registered offerings, "Related" if any generic group is present.
 *
 * `relationships` is injectable for tests; production callers use the default.
 */
export function getChildPresentation<T extends { type?: unknown }>(
  providerType: unknown,
  children: readonly T[] | null | undefined,
  relationships: readonly OfferingRelationship[] = OFFERING_RELATIONSHIPS
): ChildPresentation<T> {
  const list = (children ?? []).filter((c): c is T => c != null);
  if (list.length === 0) {
    return { mode: 'none', label: null, groups: [], totalCount: 0 };
  }

  const provider = parseEntityType(providerType);
  const byOfferingType = new Map<CanonicalEntityType, T[]>();
  const generic: T[] = [];

  for (const child of list) {
    const childType = parseEntityType(child?.type);
    const registered =
      provider !== null &&
      childType !== null &&
      relationships.some((r) => r.provider === provider && r.offering === childType);

    if (registered && childType) {
      const bucket = byOfferingType.get(childType) ?? [];
      bucket.push(child);
      byOfferingType.set(childType, bucket);
    } else {
      generic.push(child);
    }
  }

  // Stable order: registered groups follow registry order, generic group trails.
  const groups: ChildPresentationGroup<T>[] = [];
  for (const rel of relationships) {
    if (provider !== rel.provider) continue;
    const bucket = byOfferingType.get(rel.offering);
    if (bucket && bucket.length > 0) {
      groups.push({ type: rel.offering, label: rel.offeringPlural, registered: true, children: bucket });
    }
  }
  if (generic.length > 0) {
    groups.push({ type: null, label: GENERIC_CHILDREN_LABEL, registered: false, children: generic });
  }

  if (groups.length === 1) {
    return { mode: 'single', label: groups[0].label, groups, totalCount: list.length };
  }

  const aggregateLabel = generic.length > 0 ? GENERIC_CHILDREN_LABEL : MIXED_OFFERINGS_LABEL;
  return { mode: 'mixed', label: aggregateLabel, groups, totalCount: list.length };
}

/**
 * Short provider→offering context line for a child entity header,
 * e.g. "Dish at Truffles". Returns `null` for unregistered pairs so callers
 * show nothing rather than mislabelling a generic parent/child edge.
 */
export function getOfferingContextLine(
  providerType: unknown,
  offeringType: unknown
): { singular: string; verb: string } | null {
  const provider = parseEntityType(providerType);
  const offering = parseEntityType(offeringType);
  if (!provider || !offering) return null;
  const relationship = getOfferingRelationship(provider, offering);
  if (!relationship) return null;
  return { singular: relationship.offeringSingular, verb: relationship.verb };
}
