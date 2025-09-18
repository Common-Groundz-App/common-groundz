import { supabase } from "@/integrations/supabase/client";
import { Entity } from "@/services/recommendation/types";

export interface SlugResolutionResult {
  entity: Entity | null;
  currentSlug: string | null;
  wasRedirected: boolean;
  redirectFrom?: string;
}

/**
 * Resolve a slug by checking current entities first, then slug history
 * @param slug - The slug to resolve
 * @returns Resolution result with entity and redirect information
 */
export const resolveSlugWithHistory = async (slug: string): Promise<SlugResolutionResult> => {
  // First, try to find the entity by current slug
  const { data: currentEntity, error: currentError } = await supabase
    .from("entities")
    .select("*")
    .eq("slug", slug)
    .eq("is_deleted", false)
    .single();

  if (currentEntity && !currentError) {
    return {
      entity: {
        ...currentEntity,
        metadata: (currentEntity.metadata as Record<string, any>) || {}
      } as Entity,
      currentSlug: slug,
      wasRedirected: false,
    };
  }

  // If not found, check slug history for redirects
  const { data: slugHistory, error: historyError } = await supabase
    .from("entity_slug_history")
    .select(`
      entity_id,
      old_slug,
      entities!inner(*)
    `)
    .eq("old_slug", slug)
    .eq("entities.is_deleted", false)
    .single();

  if (slugHistory && !historyError && slugHistory.entities) {
    const entity = {
      ...slugHistory.entities,
      metadata: (slugHistory.entities.metadata as Record<string, any>) || {}
    } as Entity;
    return {
      entity,
      currentSlug: entity.slug,
      wasRedirected: true,
      redirectFrom: slug,
    };
  }

  // Entity not found in current slugs or history
  return {
    entity: null,
    currentSlug: null,
    wasRedirected: false,
  };
};

/**
 * Handle slug redirect by checking if a slug needs to redirect to current URL
 * @param slug - The slug to check
 * @returns Redirect information if redirect is needed
 */
export const handleSlugRedirect = async (slug: string): Promise<{
  shouldRedirect: boolean;
  redirectTo?: string;
  entity?: Entity;
}> => {
  const resolution = await resolveSlugWithHistory(slug);

  if (!resolution.entity) {
    return { shouldRedirect: false };
  }

  if (resolution.wasRedirected && resolution.currentSlug) {
    return {
      shouldRedirect: true,
      redirectTo: `/entity/${resolution.currentSlug}`,
      entity: resolution.entity,
    };
  }

  return {
    shouldRedirect: false,
    entity: resolution.entity,
  };
};

/**
 * Get redirect path for hierarchical URLs
 * @param parentSlug - Parent entity slug
 * @param childSlug - Child entity slug  
 * @returns Redirect information for hierarchical URLs
 */
export const handleHierarchicalRedirect = async (
  parentSlug: string,
  childSlug: string
): Promise<{
  shouldRedirect: boolean;
  redirectTo?: string;
  parentEntity?: Entity;
  childEntity?: Entity;
}> => {
  // Check if parent slug needs redirect
  const parentResolution = await resolveSlugWithHistory(parentSlug);
  if (!parentResolution.entity) {
    return { shouldRedirect: false };
  }

  // Check if child slug needs redirect
  const childResolution = await resolveSlugWithHistory(childSlug);
  if (!childResolution.entity) {
    return { shouldRedirect: false };
  }

  // Check if either slug was redirected
  const parentRedirected = parentResolution.wasRedirected;
  const childRedirected = childResolution.wasRedirected;

  if (parentRedirected || childRedirected) {
    const newParentSlug = parentResolution.currentSlug || parentSlug;
    const newChildSlug = childResolution.currentSlug || childSlug;
    
    return {
      shouldRedirect: true,
      redirectTo: `/entity/${newParentSlug}/${newChildSlug}`,
      parentEntity: parentResolution.entity,
      childEntity: childResolution.entity,
    };
  }

  return {
    shouldRedirect: false,
    parentEntity: parentResolution.entity,
    childEntity: childResolution.entity,
  };
};