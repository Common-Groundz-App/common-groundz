import { describe, it, expect } from 'vitest';
import { slugifyEntityName, buildHierarchicalSlug } from '../entitySlug';

describe('entity slug rules', () => {
  it('slugifies names safely', () => {
    expect(slugifyEntityName("Truffles' Café & Bar")).toBe('truffles-cafe-bar');
    expect(slugifyEntityName(null)).toBe('');
  });

  // Parity fixtures shared with public.slugify_entity_name() in Postgres.
  // If these change, update the SQL function in the same migration.
  it('matches the Postgres slugify_entity_name contract', () => {
    expect(slugifyEntityName('Café Déjà Vu')).toBe('cafe-deja-vu');
    expect(slugifyEntityName("Joe's Burgers")).toBe('joes-burgers');
    expect(slugifyEntityName('  Spaced   Out  ')).toBe('spaced-out');
    expect(slugifyEntityName('Ünïcödé Àccents')).toBe('unicode-accents');
    expect(slugifyEntityName('東京')).toBe('');
    expect(slugifyEntityName('!!!')).toBe('');
  });

  it('generates a hierarchical slug for a place -> food offering', () => {
    expect(
      buildHierarchicalSlug({ slug: 'truffles', name: 'Truffles' }, { name: 'Classic Burger' })
    ).toBe('truffles-classic-burger');
  });

  it('keeps same-named dishes under different places from colliding', () => {
    const a = buildHierarchicalSlug({ slug: 'truffles' }, { name: 'Classic Burger' });
    const b = buildHierarchicalSlug({ slug: 'hard-rock-cafe' }, { name: 'Classic Burger' });
    expect(a).not.toBe(b);
  });

  it('falls back to the parent name when the parent has no slug', () => {
    expect(buildHierarchicalSlug({ name: 'Nike Inc' }, { name: 'Pegasus 43' })).toBe(
      'nike-inc-pegasus-43'
    );
  });
});
