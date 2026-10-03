import { findEntityByApiRef } from '@/services/recommendation/entityOperations';
import { createEntityQuick } from '@/services/enhancedEntityService';
import type { Entity } from '@/services/recommendation/types';

export interface ExternalEntityInput {
  name: string;
  venue?: string;
  description?: string;
  image_url?: string | null;
  api_source: string;
  api_ref: string;
  metadata?: Record<string, unknown>;
}

/**
 * Shared "existing or create" for external search results (composer + review form).
 *
 * The database guarantees one entity per (api_source, api_ref) via the unique
 * index `entities_api_source_ref_idx`. If two saves race, the loser's insert
 * fails; we then re-read and return the winner instead of failing. If the
 * re-read finds nothing, the create genuinely failed and we return null.
 */
export const findOrCreateExternalEntity = async (
  input: ExternalEntityInput,
  entityType: string,
): Promise<Entity | null> => {
  const existing = await findEntityByApiRef(input.api_source, input.api_ref);
  if (existing) return existing;

  const created = await createEntityQuick(
    {
      name: input.name,
      venue: input.venue,
      description: input.description,
      image_url: input.image_url ?? null,
      api_source: input.api_source,
      api_ref: input.api_ref,
      metadata: input.metadata || {},
    } as any,
    entityType as any,
  );
  if (created) return created as Entity;

  // Conflict recovery: another save may have won the unique index.
  return findEntityByApiRef(input.api_source, input.api_ref);
};
