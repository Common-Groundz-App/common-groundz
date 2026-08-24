import { describe, expect, it } from 'vitest';
import {
  GENERIC_CHILDREN_LABEL,
  MIXED_OFFERINGS_LABEL,
  getChildPresentation,
  getOfferingContextLine,
  type OfferingRelationship,
} from '../entityRelationshipRegistry';

const child = (type: string, id = `${type}-${Math.random().toString(36).slice(2, 8)}`) => ({ id, type });

describe('getChildPresentation', () => {
  it('returns mode "none" for empty children, so callers hide the section', () => {
    expect(getChildPresentation('brand', [])).toEqual({
      mode: 'none',
      label: null,
      groups: [],
      totalCount: 0,
    });
    expect(getChildPresentation('brand', null).mode).toBe('none');
  });

  it('labels brand -> product children as "Products" (Cosmix regression)', () => {
    const children = [child('product'), child('product'), child('product')];
    const result = getChildPresentation('brand', children);
    expect(result.mode).toBe('single');
    expect(result.label).toBe('Products');
    expect(result.groups).toHaveLength(1);
    expect(result.groups[0]).toMatchObject({ type: 'product', registered: true });
    expect(result.groups[0].children).toHaveLength(3);
    expect(result.totalCount).toBe(3);
  });

  it('labels place -> food children as "Dishes" (Truffles regression)', () => {
    const result = getChildPresentation('place', [child('food'), child('food')]);
    expect(result.mode).toBe('single');
    expect(result.label).toBe('Dishes');
    expect(result.groups[0]).toMatchObject({ type: 'food', registered: true });
  });

  it('falls back to "Related" for unregistered pairs — never a wrong noun', () => {
    const result = getChildPresentation('place', [child('product')]);
    expect(result.mode).toBe('single');
    expect(result.label).toBe(GENERIC_CHILDREN_LABEL);
    expect(result.groups[0]).toMatchObject({ type: null, registered: false });
  });

  it('falls back to "Related" for unknown child types', () => {
    const result = getChildPresentation('brand', [child('hovercraft')]);
    expect(result.label).toBe(GENERIC_CHILDREN_LABEL);
    expect(result.groups[0].registered).toBe(false);
  });

  it('falls back to "Related" for unknown parent types', () => {
    const result = getChildPresentation('hovercraft', [child('product')]);
    expect(result.label).toBe(GENERIC_CHILDREN_LABEL);
  });

  it('aggregates as "Related" when any generic group is present, preserving distinct groups', () => {
    const children = [child('food'), child('food'), child('book')];
    const result = getChildPresentation('place', children);
    expect(result.mode).toBe('mixed');
    expect(result.label).toBe(GENERIC_CHILDREN_LABEL);
    expect(result.groups).toHaveLength(2);
    expect(result.groups[0]).toMatchObject({ type: 'food', label: 'Dishes', registered: true });
    expect(result.groups[0].children).toHaveLength(2);
    expect(result.groups[1]).toMatchObject({ type: null, label: GENERIC_CHILDREN_LABEL, registered: false });
    expect(result.groups[1].children).toHaveLength(1);
    expect(result.totalCount).toBe(3);
  });

  it('aggregates as "Offerings" only when EVERY group is a registered offering', () => {
    const testRelationships: OfferingRelationship[] = [
      { provider: 'brand', offering: 'product', offeringPlural: 'Products', offeringSingular: 'Product', verb: 'by' },
      { provider: 'brand', offering: 'service', offeringPlural: 'Services', offeringSingular: 'Service', verb: 'by' },
    ];
    const children = [child('product'), child('service')];
    const result = getChildPresentation('brand', children, testRelationships);
    expect(result.mode).toBe('mixed');
    expect(result.label).toBe(MIXED_OFFERINGS_LABEL);
    expect(result.groups.map((g) => g.label)).toEqual(['Products', 'Services']);
    expect(result.groups.every((g) => g.registered)).toBe(true);
  });

  it('keeps registered group order stable (registry order, generic last)', () => {
    const testRelationships: OfferingRelationship[] = [
      { provider: 'brand', offering: 'product', offeringPlural: 'Products', offeringSingular: 'Product', verb: 'by' },
      { provider: 'brand', offering: 'service', offeringPlural: 'Services', offeringSingular: 'Service', verb: 'by' },
    ];
    // Pass children in reverse order of the registry to prove ordering is stable.
    const children = [child('book'), child('service'), child('product')];
    const result = getChildPresentation('brand', children, testRelationships);
    expect(result.groups.map((g) => g.label)).toEqual(['Products', 'Services', GENERIC_CHILDREN_LABEL]);
  });
});

describe('getOfferingContextLine', () => {
  it('returns singular + verb for registered pairs ("Dish at …")', () => {
    expect(getOfferingContextLine('place', 'food')).toEqual({ singular: 'Dish', verb: 'at' });
    expect(getOfferingContextLine('brand', 'product')).toEqual({ singular: 'Product', verb: 'by' });
  });

  it('returns null for unregistered pairs so nothing is mislabelled', () => {
    expect(getOfferingContextLine('place', 'product')).toBeNull();
    expect(getOfferingContextLine('brand', 'food')).toBeNull();
    expect(getOfferingContextLine(null, 'food')).toBeNull();
    expect(getOfferingContextLine('place', undefined)).toBeNull();
  });
});
