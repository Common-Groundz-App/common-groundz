import { describe, it, expect } from 'vitest';
import { EntityType } from '../recommendation/types';
import {
  getCanonicalType,
  getEntityTypeLabel,
  getEntityTypeIcon,
  getEntityTypeFallbackImage,
  isValidEntityType,
  getActiveEntityTypes,
} from '../entityTypeHelpers';
import { CANONICAL_ENTITY_TYPES } from '../entityType';
import { mapStringToEntityType, mapEntityTypeToString } from '@/hooks/feed/api/types';

describe('deprecated entity types are gone', () => {
  it('the EntityType enum holds only the 15 canonical values', () => {
    const values = Object.values(EntityType);
    expect(values).toHaveLength(15);
    expect([...values].sort()).toEqual([...CANONICAL_ENTITY_TYPES].sort());
    for (const legacy of ['tv', 'activity', 'music', 'art', 'drink', 'travel']) {
      expect(values).not.toContain(legacy);
    }
  });

  it('isValidEntityType accepts canonical values only', () => {
    for (const t of CANONICAL_ENTITY_TYPES) expect(isValidEntityType(t)).toBe(true);
    for (const legacy of ['tv', 'activity', 'music', 'art', 'drink', 'travel', 'widget']) {
      expect(isValidEntityType(legacy)).toBe(false);
    }
  });

  it('getActiveEntityTypes returns all canonical types', () => {
    expect(getActiveEntityTypes()).toHaveLength(15);
  });
});

describe('display-only normalization', () => {
  it('resolves legacy aliases for rendering without producing a legacy value', () => {
    expect(getCanonicalType('tv')).toBe(EntityType.TVShow);
    expect(getCanonicalType('activity')).toBe(EntityType.Experience);
    expect(getCanonicalType('drink')).toBe(EntityType.Food);
    expect(getCanonicalType('travel')).toBe(EntityType.Place);
  });

  it('degrades unknown types to the explicitly generic type, never product or place', () => {
    expect(getCanonicalType('widget')).toBe(EntityType.Others);
    expect(getCanonicalType('')).toBe(EntityType.Others);
    expect(getCanonicalType('widget')).not.toBe(EntityType.Product);
    expect(getCanonicalType('widget')).not.toBe(EntityType.Place);
  });

  it('has a label, icon and fallback image for every canonical type', () => {
    for (const t of CANONICAL_ENTITY_TYPES) {
      expect(getEntityTypeLabel(t)).toBeTruthy();
      expect(getEntityTypeIcon(t)).toBeTruthy();
      expect(getEntityTypeFallbackImage(t)).toMatch(/^https?:\/\//);
    }
  });
});

describe('string <-> enum boundary', () => {
  it('round-trips every canonical value', () => {
    for (const t of CANONICAL_ENTITY_TYPES) {
      const parsed = mapStringToEntityType(t);
      expect(parsed).not.toBeNull();
      expect(mapEntityTypeToString(parsed!)).toBe(t);
    }
  });

  it('returns null for unknown strings instead of defaulting to product', () => {
    expect(mapStringToEntityType('widget')).toBeNull();
    expect(mapStringToEntityType('')).toBeNull();
  });

  it('accepts legacy aliases on the way in only', () => {
    expect(mapStringToEntityType('tv')).toBe(EntityType.TVShow);
    expect(mapStringToEntityType('people')).toBe(EntityType.Professional);
    for (const t of CANONICAL_ENTITY_TYPES) {
      expect(['tv', 'activity', 'music', 'art', 'drink', 'travel']).not.toContain(
        mapEntityTypeToString(t as unknown as EntityType)
      );
    }
  });
});

describe('legacy data shapes still render (shape-based, never row IDs)', () => {
  type ReviewShape = { category: string; entity: { type: string } | null };

  const render = (r: ReviewShape) => ({
    badgeType: getCanonicalType(r.entity?.type ?? r.category),
    label: getEntityTypeLabel(r.entity?.type ?? r.category),
  });

  it('tolerates a review with no entity', () => {
    expect(render({ category: 'food', entity: null })).toEqual({
      badgeType: EntityType.Food,
      label: 'Food',
    });
  });

  it('tolerates food-on-place (dish reviewed on a restaurant)', () => {
    expect(render({ category: 'food', entity: { type: 'place' } }).badgeType).toBe(EntityType.Place);
  });

  it('tolerates product-on-brand', () => {
    expect(render({ category: 'product', entity: { type: 'brand' } }).badgeType).toBe(
      EntityType.Brand
    );
  });
});
