/**
 * Groups 0A/0B/1 close-out: direct regression coverage for the changed entity
 * creation write paths.
 *
 * Contract under test (per approved plan):
 * - a valid real image is persisted as-is;
 * - no usable image  -> `image_url: null` exactly (never '', whitespace,
 *   undefined, or an omitted field);
 * - an exact registered legacy placeholder -> `image_url: null`;
 * - a legitimate Unsplash image that is NOT registered -> preserved;
 * - an existing entity is reused with no image write at all;
 * - a failed lookup never clears an existing valid image.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Entity } from '@/services/recommendation/types';

type Row = Record<string, unknown>;

const insertCalls: Array<{ table: string; payload: Row }> = [];
const updateCalls: Array<{ table: string; payload: Row }> = [];
let existingEntityRow: Row | null = null;

vi.mock('@/integrations/supabase/client', () => {
  interface QueryResult {
    select: () => QueryResult;
    limit: () => QueryResult;
    eq: () => QueryResult;
    order: () => QueryResult;
    maybeSingle: () => Promise<{ data: Row | null; error: null }>;
    single: () => Promise<{ data: Row | null; error: null }>;
    then: (
      onFulfilled: (value: { data: Row[]; error: null }) => unknown,
      onRejected?: (reason: unknown) => unknown,
    ) => Promise<unknown>;
  }

  const makeResult = (row: Row | null): QueryResult => {
    const result: QueryResult = {
      select: () => result,
      limit: () => result,
      eq: () => result,
      order: () => result,
      maybeSingle: async () => ({ data: row, error: null }),
      single: async () => ({ data: row, error: null }),
      then: (onFulfilled, onRejected) =>
        Promise.resolve({ data: row ? [row] : [], error: null }).then(onFulfilled, onRejected),
    };
    return result;
  };

  const from = (table: string) => ({
    insert: (payload: Row | Row[]) => {
      const flat = Array.isArray(payload) ? payload[0] : payload;
      insertCalls.push({ table, payload: flat });
      return makeResult({ id: 'new-entity-id', slug: 'new-entity', ...flat });
    },
    update: (payload: Row) => ({
      eq: async () => {
        updateCalls.push({ table, payload });
        return { data: null, error: null };
      },
    }),
    select: () => makeResult(existingEntityRow),
  });

  return {
    supabase: {
      from,
      auth: {
        getUser: async () => ({ data: { user: { id: 'user-1' } }, error: null }),
        getSession: async () => ({ data: { session: null }, error: null }),
      },
      functions: { invoke: vi.fn(async () => ({ data: null, error: null })) },
    },
  };
});

vi.mock('@/utils/imageUtils', () => ({
  saveExternalImageToStorage: vi.fn(async () => null),
  isValidImageUrl: () => true,
  isGooglePlacesImage: () => false,
}));

vi.mock('@/services/cachedPhotoService', () => ({
  cachedPhotoService: { getEntityPhotos: vi.fn(async () => []) },
}));

vi.mock('@/utils/imageRefresh', () => ({ deferEntityImageRefresh: vi.fn() }));

// Lets the basic-insert fallback inside createEntity be exercised on demand while
// still testing the real createEntityQuick implementation elsewhere.
let forceQuickFailure = false;

vi.mock('@/services/enhancedEntityService', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/services/enhancedEntityService')>();
  return {
    ...actual,
    createEntityQuick: async (...args: Parameters<typeof actual.createEntityQuick>) =>
      forceQuickFailure ? null : actual.createEntityQuick(...args),
    queueEntityForEnrichment: vi.fn(async () => true),
  };
});

const REAL_IMAGE = 'https://cdn.example.com/photos/real-product.jpg';
const REGISTERED_PLACEHOLDER = 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=400';
const LEGITIMATE_UNSPLASH = 'https://images.unsplash.com/photo-1700000000000-abcdefabcdef?w=400';

const expectExplicitNullImage = (payload: Row) => {
  expect(Object.prototype.hasOwnProperty.call(payload, 'image_url')).toBe(true);
  expect(payload.image_url).toBeNull();
  expect(payload.image_url).not.toBe('');
  expect(payload.image_url).not.toBeUndefined();
};

beforeEach(() => {
  insertCalls.length = 0;
  updateCalls.length = 0;
  existingEntityRow = null;
  forceQuickFailure = false;
  vi.clearAllMocks();
});

describe('createEntityQuick write path', () => {
  const create = async (imageUrl: string | null) => {
    const { createEntityQuick } = await import('@/services/enhancedEntityService');
    await createEntityQuick(
      { name: 'Quick entity', image_url: imageUrl, metadata: {} },
      'product',
    );
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

describe('createEntity basic-insert fallback write path', () => {
  const create = async (imageUrl: string | null) => {
    forceQuickFailure = true;
    const { createEntity } = await import('@/services/recommendation/entityOperations');
    const draft = {
      name: 'Fallback entity',
      type: 'product',
      venue: null,
      description: null,
      image_url: imageUrl,
      api_source: null,
      api_ref: null,
      metadata: {},
      website_url: null,
    } as unknown as Parameters<typeof createEntity>[0];

    await createEntity(draft);
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

describe('existing entity reuse', () => {
  it('reuses the existing entity without writing any image', async () => {
    existingEntityRow = {
      id: 'existing-1',
      name: 'Existing entity',
      image_url: REAL_IMAGE,
      last_enriched_at: new Date().toISOString(),
      data_quality_score: 90,
    };

    const { findOrCreateEntity } = await import('@/services/recommendation/entityOperations');
    const result: Entity | null = await findOrCreateEntity(
      'Existing entity',
      'product',
      'amazon',
      'ASIN123',
      null,
      null,
      null,
    );

    expect(result?.id).toBe('existing-1');
    expect(result?.image_url).toBe(REAL_IMAGE);
    expect(insertCalls).toHaveLength(0);
    expect(updateCalls).toHaveLength(0);
  });
});

describe('failed lookup never clears an existing valid image', () => {
  it('keeps the stored image when the new candidate is unusable', async () => {
    const { validateImageUrlForStorage } = await import('@/utils/entityImageUtils');

    expect(validateImageUrlForStorage(null, undefined, REAL_IMAGE)).toBe(REAL_IMAGE);
    expect(validateImageUrlForStorage('', undefined, REAL_IMAGE)).toBe(REAL_IMAGE);
    expect(validateImageUrlForStorage(REGISTERED_PLACEHOLDER, undefined, REAL_IMAGE)).toBe(REAL_IMAGE);
    expect(validateImageUrlForStorage(null, undefined, null)).toBeNull();
  });
});
