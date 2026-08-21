import { describe, it, expect } from 'vitest';
import {
  CANONICAL_ENTITY_TYPES,
  isCanonicalEntityType,
  parseEntityType,
  parseEntityTypeAtBoundary,
  LEGACY_ENTITY_TYPE_ALIASES,
} from '../entityType';
import {
  OFFERING_RELATIONSHIPS,
  isProviderType,
  isOfferingType,
  isValidOfferingPair,
  assertValidOfferingPair,
  getOfferingTypesFor,
  getProviderTypesFor,
  getOfferingSectionLabel,
  getOfferingContextVerb,
} from '../entityRelationshipRegistry';

describe('canonical entity types', () => {
  it('has exactly the 15 canonical values', () => {
    expect(CANONICAL_ENTITY_TYPES).toHaveLength(15);
    expect([...CANONICAL_ENTITY_TYPES].sort()).toEqual(
      [
        'app',
        'book',
        'brand',
        'course',
        'event',
        'experience',
        'food',
        'game',
        'movie',
        'others',
        'place',
        'product',
        'professional',
        'service',
        'tv_show',
      ].sort()
    );
  });

  it('parses and round-trips every canonical value', () => {
    for (const type of CANONICAL_ENTITY_TYPES) {
      expect(parseEntityType(type)).toBe(type);
      expect(isCanonicalEntityType(type)).toBe(true);
    }
  });

  it('is case- and whitespace-tolerant', () => {
    expect(parseEntityType(' TV_Show ')).toBe('tv_show');
  });

  it('returns null for unknown input and never falls back to product or place', () => {
    for (const bad of ['', 'widget', 'tv', 'travel', 'unsupported', null, undefined, 42, {}]) {
      const parsed = parseEntityType(bad as unknown);
      expect(parsed).toBeNull();
      expect(parsed).not.toBe('product');
      expect(parsed).not.toBe('place');
    }
  });

  it('rejects legacy aliases in the strict parser', () => {
    for (const legacy of Object.keys(LEGACY_ENTITY_TYPE_ALIASES)) {
      expect(parseEntityType(legacy)).toBeNull();
    }
  });

  it('resolves legacy aliases only at the boundary, and never to a legacy value', () => {
    expect(parseEntityTypeAtBoundary('tv')).toBe('tv_show');
    expect(parseEntityTypeAtBoundary('activity')).toBe('experience');
    expect(parseEntityTypeAtBoundary('drink')).toBe('food');
    expect(parseEntityTypeAtBoundary('travel')).toBe('place');
    expect(parseEntityTypeAtBoundary('people')).toBe('professional');
    for (const resolved of Object.values(LEGACY_ENTITY_TYPE_ALIASES)) {
      expect(isCanonicalEntityType(resolved)).toBe(true);
    }
    expect(parseEntityTypeAtBoundary('widget')).toBeNull();
  });

  it('never maps service or professional to product', () => {
    expect(parseEntityType('service')).toBe('service');
    expect(parseEntityType('professional')).toBe('professional');
    expect(parseEntityTypeAtBoundary('service')).toBe('service');
    expect(parseEntityTypeAtBoundary('professional')).toBe('professional');
  });

  it('does not map music or art to product', () => {
    expect(parseEntityTypeAtBoundary('music')).toBe('others');
    expect(parseEntityTypeAtBoundary('art')).toBe('others');
  });
});

describe('offering relationship registry', () => {
  it('only references canonical types', () => {
    for (const r of OFFERING_RELATIONSHIPS) {
      expect(isCanonicalEntityType(r.provider)).toBe(true);
      expect(isCanonicalEntityType(r.offering)).toBe(true);
    }
  });

  it('recognises the two live offering pairs', () => {
    expect(isValidOfferingPair('brand', 'product')).toBe(true);
    expect(isValidOfferingPair('place', 'food')).toBe(true);
  });

  it('treats unregistered pairs as not-an-offering-pair', () => {
    expect(isValidOfferingPair('place', 'product')).toBe(false);
    expect(isValidOfferingPair('book', 'book')).toBe(false);
    expect(() => assertValidOfferingPair('place', 'product')).toThrow(/offering relationship/i);
  });

  it('identifies provider and offering roles', () => {
    expect(isProviderType('brand')).toBe(true);
    expect(isProviderType('place')).toBe(true);
    expect(isProviderType('book')).toBe(false);
    expect(isOfferingType('food')).toBe(true);
    expect(isOfferingType('product')).toBe(true);
    expect(isOfferingType('brand')).toBe(false);
  });

  it('lists offerings per provider and providers per offering', () => {
    expect(getOfferingTypesFor('place')).toEqual(['food']);
    expect(getOfferingTypesFor('brand')).toEqual(['product']);
    expect(getOfferingTypesFor('movie')).toEqual([]);
    expect(getProviderTypesFor('product')).toEqual(['brand']);
    expect(getProviderTypesFor('food')).toEqual(['place']);
  });

  it('supplies relationship-derived vocabulary', () => {
    expect(getOfferingSectionLabel('place', 'food')).toBe('Dishes');
    expect(getOfferingSectionLabel('brand', 'product')).toBe('Products');
    expect(getOfferingSectionLabel('place', 'product')).toBeNull();
    expect(getOfferingContextVerb('place', 'food')).toBe('at');
    expect(getOfferingContextVerb('brand', 'product')).toBe('by');
    expect(getOfferingContextVerb('movie', 'book')).toBeNull();
  });

  it('does not restrict generic (non-offering) parent/child edges', () => {
    // The registry answers "is this an offering pair?" — it is not a guard on
    // every parent_id edge. A generic edge is simply "not an offering".
    expect(isValidOfferingPair('brand', 'brand')).toBe(false);
    expect(() => isValidOfferingPair('brand', 'brand')).not.toThrow();
  });
});
