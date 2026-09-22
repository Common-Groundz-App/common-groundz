/**
 * Groups 0A/0B/1 close-out: direct regression coverage for the two
 * use-entity-search creation write paths (external result + URL metadata).
 *
 * Same contract as the service paths: a real image is persisted, no usable
 * image persists `image_url: null` exactly, exact registered legacy
 * placeholders persist null, and legitimate Unsplash images are preserved.
 */
import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';

const insertCalls: Array<{ table: string; payload: any }> = [];
let urlMetadata: any = {};

vi.mock('@/integrations/supabase/client', () => {
  const makeResult = (row: any) => {
    const thenable: any = {
      select: () => thenable,
      limit: () => thenable,
      eq: () => thenable,
      maybeSingle: async () => ({ data: row, error: null }),
      single: async () => ({ data: row, error: null }),
      then: (onFulfilled: any, onRejected: any) =>
        Promise.resolve({ data: row ? [row] : [], error: null }).then(onFulfilled, onRejected),
    };
    return thenable;
  };

  return {
    supabase: {
      from: (table: string) => ({
        insert: (payload: any) => {
          const flat = Array.isArray(payload) ? payload[0] : payload;
          insertCalls.push({ table, payload: flat });
          return makeResult({ id: 'inserted-id', ...flat });
        },
        select: () => makeResult(null),
        update: () => ({ eq: async () => ({ error: null }) }),
      }),
      auth: {
        getSession: async () => ({ data: { session: null }, error: null }),
        getUser: async () => ({ data: { user: { id: 'user-1' } }, error: null }),
      },
      functions: {
        invoke: vi.fn(async () => ({ data: { metadata: urlMetadata }, error: null })),
      },
    },
  };
});

vi.mock('@/utils/imageUtils', () => ({
  saveExternalImageToStorage: vi.fn(async () => null),
  isValidImageUrl: () => true,
  isGooglePlacesImage: () => false,
}));

vi.mock('@/services/storageService', () => ({
  ensureBucketPolicies: vi.fn(async () => true),
}));

vi.mock('@/services/recommendation/entityOperations', () => ({
  findEntityByApiRef: vi.fn(async () => null),
}));

vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({ toast: vi.fn() }),
}));

import { useEntitySearch } from '@/hooks/use-entity-search';

const REAL_IMAGE = 'https://cdn.example.com/photos/real-product.jpg';
const REGISTERED_PLACEHOLDER = 'https://images.unsplash.com/photo-1544716278-ca5e3f4abd8c?w=400';
const LEGITIMATE_UNSPLASH = 'https://images.unsplash.com/photo-1700000000000-abcdefabcdef?w=400';

const expectExplicitNullImage = (payload: any) => {
  expect(Object.prototype.hasOwnProperty.call(payload, 'image_url')).toBe(true);
  expect(payload.image_url).toBeNull();
  expect(payload.image_url).not.toBe('');
  expect(payload.image_url).not.toBeUndefined();
};

beforeEach(() => {
  insertCalls.length = 0;
  urlMetadata = {};
  vi.clearAllMocks();
});

const renderSearch = () => renderHook(() => useEntitySearch('product' as any)).result;

describe('createEntityFromExternal write path', () => {
  const create = async (imageUrl: string | null) => {
    const result = renderSearch();
    await result.current.createEntityFromExternal({
      name: 'External entity',
      image_url: imageUrl,
      metadata: {},
    });
    expect(insertCalls).toHaveLength(1);
    return insertCalls[0].payload;
  };

  it('persists a valid real image unchanged', async () => {
    expect((await create(REAL_IMAGE)).image_url).toBe(REAL_IMAGE);
  });

  it('persists image_url: null when there is no image', async () => {
    expectExplicitNullImage(await create(null));
  });

  it('persists image_url: null for an exact registered legacy placeholder', async () => {
    expectExplicitNullImage(await create(REGISTERED_PLACEHOLDER));
  });

  it('preserves a legitimate Unsplash image that is not registered', async () => {
    expect((await create(LEGITIMATE_UNSPLASH)).image_url).toBe(LEGITIMATE_UNSPLASH);
  });
});

describe('createEntityFromUrl write path', () => {
  const create = async (imageUrl: string | null) => {
    urlMetadata = { title: 'From URL', og_image: imageUrl, description: null };
    const result = renderSearch();
    await result.current.createEntityFromUrl('https://example.com/item');
    expect(insertCalls).toHaveLength(1);
    return insertCalls[0].payload;
  };

  it('persists a valid real image unchanged', async () => {
    expect((await create(REAL_IMAGE)).image_url).toBe(REAL_IMAGE);
  });

  it('persists image_url: null when there is no image', async () => {
    expectExplicitNullImage(await create(null));
  });

  it('persists image_url: null for an exact registered legacy placeholder', async () => {
    expectExplicitNullImage(await create(REGISTERED_PLACEHOLDER));
  });

  it('preserves a legitimate Unsplash image that is not registered', async () => {
    expect((await create(LEGITIMATE_UNSPLASH)).image_url).toBe(LEGITIMATE_UNSPLASH);
  });
});
