import { describe, expect, it } from 'vitest';
import { CANONICAL_ENTITY_TYPES } from '@/services/entityType';
import {
  getEntityFallbackIcon,
  getPersistableEntityImageUrl,
  isKnownLegacyEntityPlaceholderUrl,
} from './entityImageFallback';

describe('entity image fallback contract', () => {
  it('defines an icon for every canonical type and a neutral unknown type', () => {
    for (const type of CANONICAL_ENTITY_TYPES) {
      expect(getEntityFallbackIcon(type)).toBeTypeOf('object');
    }
    expect(getEntityFallbackIcon('unknown')).toBe(getEntityFallbackIcon(null));
  });

  it('recognizes exact legacy placeholder identities despite query variation', () => {
    expect(isKnownLegacyEntityPlaceholderUrl(
      'https://images.unsplash.com/photo-1560769629-975ec94e6a86?auto=format&w=1200',
    )).toBe(true);
    expect(isKnownLegacyEntityPlaceholderUrl(
      'https://images.unsplash.com/photo-1560769629-975ec94e6a86?crop=faces&q=40',
    )).toBe(true);
  });

  it('preserves legitimate Unsplash and stored images', () => {
    const legitimate = 'https://images.unsplash.com/photo-a-real-entity-photo?auto=format';
    const stored = 'https://example.supabase.co/storage/v1/object/public/entity/image.jpg';
    expect(isKnownLegacyEntityPlaceholderUrl(legitimate)).toBe(false);
    expect(getPersistableEntityImageUrl(legitimate)).toBe(legitimate);
    expect(getPersistableEntityImageUrl(stored)).toBe(stored);
  });

  it('rejects only empty or exact known placeholder values for persistence', () => {
    expect(getPersistableEntityImageUrl(undefined)).toBeNull();
    expect(getPersistableEntityImageUrl('  ')).toBeNull();
    expect(getPersistableEntityImageUrl(
      'https://images.unsplash.com/photo-1495446815901-a7297e633e8d',
    )).toBeNull();
  });
});