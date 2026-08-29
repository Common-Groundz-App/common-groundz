// Phase 2.3 — unit tests for the exact-identity classifier.
import {
  assertEquals,
} from 'https://deno.land/std@0.224.0/assert/mod.ts';
import {
  classifyEntity,
  normalizeIdentityName,
  normalizeWebsiteUrl,
} from './exactIdentity.ts';

Deno.test('same api_ref with matching type -> exact', () => {
  const cls = classifyEntity(
    { name: 'Burger', type: 'food', apiSource: 'google_places', apiRef: 'abc' },
    { id: '1', type: 'food', api_source: 'google_places', api_ref: 'abc' },
  );
  assertEquals(cls, 'exact');
});

Deno.test('same api_ref with conflicting type -> conflict (never merged)', () => {
  const cls = classifyEntity(
    { name: 'Burger', type: 'food', apiSource: 'google_places', apiRef: 'abc' },
    { id: '1', type: 'place', api_source: 'google_places', api_ref: 'abc' },
  );
  assertEquals(cls, 'conflict');
});

Deno.test('blank api identity values are ignored', () => {
  const cls = classifyEntity(
    { name: 'Burger', type: 'food', apiSource: '  ', apiRef: '' },
    { id: '1', type: 'food', api_source: '', api_ref: '' },
  );
  assertEquals(cls, null);
});

Deno.test('same website + same type -> exact', () => {
  const cls = classifyEntity(
    { name: 'Axis-Y Toner', type: 'product', websiteUrl: 'https://www.example.com/products/toner/' },
    { id: '1', type: 'product', website_url: 'https://example.com/products/toner' },
  );
  assertEquals(cls, 'exact');
});

Deno.test('same website + different type -> possible, not merged', () => {
  const cls = classifyEntity(
    { name: 'Thing', type: 'product', websiteUrl: 'https://example.com/' },
    { id: '1', type: 'brand', website_url: 'https://example.com' },
  );
  assertEquals(cls, 'possible');
});

Deno.test('same dish under the same place -> exact', () => {
  const cls = classifyEntity(
    { name: 'Classic Burger', type: 'food', parentId: 'p1' },
    { id: '1', name: 'classic  burger', type: 'food', parent_id: 'p1' },
  );
  assertEquals(cls, 'exact');
});

Deno.test('same dish name under a DIFFERENT place -> not a duplicate', () => {
  const cls = classifyEntity(
    { name: 'Classic Burger', type: 'food', parentId: 'p1' },
    { id: '1', name: 'Classic Burger', type: 'food', parent_id: 'p2' },
  );
  assertEquals(cls, null);
});

Deno.test('two standalone "Central Cafe" places -> possible, never exact', () => {
  const cls = classifyEntity(
    { name: 'Central Cafe', type: 'place' },
    { id: '1', name: 'Central Café', type: 'place' },
  );
  assertEquals(cls, 'possible');
});

Deno.test('"Classic Burger" vs "Classic Cheese Burger" -> not a duplicate', () => {
  const cls = classifyEntity(
    { name: 'Classic Burger', type: 'food', parentId: 'p1' },
    { id: '1', name: 'Classic Cheese Burger', type: 'food', parent_id: 'p1' },
  );
  assertEquals(cls, null);
});

Deno.test('non-ASCII names normalize to empty and NEVER merge', () => {
  assertEquals(normalizeIdentityName('東京'), '');
  assertEquals(normalizeIdentityName('大阪'), '');
  const cls = classifyEntity(
    { name: '東京', type: 'food', parentId: 'p1' },
    { id: '1', name: '大阪', type: 'food', parent_id: 'p1' },
  );
  assertEquals(cls, null);
});

Deno.test('punctuation-only names normalize to empty and never merge', () => {
  assertEquals(normalizeIdentityName('!!!'), '');
  const cls = classifyEntity(
    { name: '!!!', type: 'food', parentId: 'p1' },
    { id: '1', name: '???', type: 'food', parent_id: 'p1' },
  );
  assertEquals(cls, null);
});

Deno.test('normalizeWebsiteUrl strips www, case and trailing slashes', () => {
  assertEquals(
    normalizeWebsiteUrl('HTTPS://WWW.Example.COM/products/x/'),
    'https://example.com/products/x',
  );
  assertEquals(normalizeWebsiteUrl('not a url'), null);
  assertEquals(normalizeWebsiteUrl(''), null);
});
