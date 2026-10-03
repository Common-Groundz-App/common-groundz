import { describe, it, expect, vi, beforeEach } from 'vitest';

const h = vi.hoisted(() => ({ find: vi.fn(), create: vi.fn() }));
vi.mock('@/services/recommendation/entityOperations', () => ({ findEntityByApiRef: h.find }));
vi.mock('@/services/enhancedEntityService', () => ({ createEntityQuick: h.create }));

import { findOrCreateExternalEntity } from '../externalEntityImport';

const input = { name: 'Toy Story 5', api_source: 'tmdb', api_ref: '123' };

describe('findOrCreateExternalEntity', () => {
  beforeEach(() => { h.find.mockReset(); h.create.mockReset(); });

  it('reuses an existing entity without creating', async () => {
    h.find.mockResolvedValueOnce({ id: 'e1' });
    expect(await findOrCreateExternalEntity(input, 'movie')).toEqual({ id: 'e1' });
    expect(h.create).not.toHaveBeenCalled();
  });

  it('creates when missing', async () => {
    h.find.mockResolvedValueOnce(null);
    h.create.mockResolvedValueOnce({ id: 'new' });
    expect(await findOrCreateExternalEntity(input, 'movie')).toEqual({ id: 'new' });
  });

  it('recovers the winner when a concurrent save took the unique slot', async () => {
    h.find.mockResolvedValueOnce(null).mockResolvedValueOnce({ id: 'winner' });
    h.create.mockResolvedValueOnce(null);
    expect(await findOrCreateExternalEntity(input, 'movie')).toEqual({ id: 'winner' });
  });

  it('returns null on a genuine failure', async () => {
    h.find.mockResolvedValue(null);
    h.create.mockResolvedValueOnce(null);
    expect(await findOrCreateExternalEntity(input, 'movie')).toBeNull();
  });
});
