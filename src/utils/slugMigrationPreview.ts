import { supabase } from "@/integrations/supabase/client";

export interface MigrationPreviewResult {
  entity_id: string;
  entity_name: string;
  entity_type: string;
  current_slug: string;
  new_slug: string;
  parent_name: string | null;
  would_change: boolean;
}

export interface MigrationResult {
  updated_count: number;
  entities_processed: string[];
}

/**
 * Preview what changes would be made to entity slugs for hierarchical structure
 * @returns Array of entities showing current vs new slugs
 */
export const previewHierarchicalMigration = async (): Promise<{
  results: MigrationPreviewResult[];
  totalEntities: number;
  entitiesNeedingUpdate: number;
}> => {
  const { data, error } = await supabase.rpc("preview_hierarchical_migration");

  if (error) {
    console.error("Error previewing migration:", error);
    throw new Error(`Failed to preview migration: ${error.message}`);
  }

  const results = data || [];
  const entitiesNeedingUpdate = results.filter((r: MigrationPreviewResult) => r.would_change).length;

  return {
    results,
    totalEntities: results.length,
    entitiesNeedingUpdate,
  };
};

/**
 * Execute batch migration of entity slugs to hierarchical structure
 * @param batchSize - Number of entities to process in one batch (default: 50)
 * @returns Migration results showing what was updated
 */
export const batchMigrateHierarchicalSlugs = async (
  batchSize: number = 50
): Promise<MigrationResult> => {
  const { data, error } = await supabase.rpc("migrate_to_hierarchical_slugs", {
    batch_size: batchSize,
  });

  if (error) {
    console.error("Error running migration:", error);
    throw new Error(`Failed to run migration: ${error.message}`);
  }

  // The function returns a single row with updated_count and entities_processed
  const result = data?.[0];
  
  return {
    updated_count: result?.updated_count || 0,
    entities_processed: result?.entities_processed || [],
  };
};

/**
 * Validate migration results by checking for broken redirects
 * @returns Validation results
 */
export const validateMigrationResults = async (): Promise<{
  isValid: boolean;
  issues: string[];
  orphanedSlugs: number;
}> => {
  const issues: string[] = [];

  // Check for orphaned slug history entries (history pointing to deleted entities)
  const { data: orphanedSlugs, error: orphanedError } = await supabase
    .from("entity_slug_history")
    .select(`
      id,
      old_slug,
      entity_id,
      entities!inner(is_deleted)
    `)
    .eq("entities.is_deleted", true);

  if (orphanedError) {
    issues.push(`Error checking orphaned slugs: ${orphanedError.message}`);
  }

  const orphanedCount = orphanedSlugs?.length || 0;
  if (orphanedCount > 0) {
    issues.push(`Found ${orphanedCount} orphaned slug history entries pointing to deleted entities`);
  }

  // Check for duplicate current slugs
  const { data: duplicateSlugs, error: duplicateError } = await supabase
    .from("entities")
    .select("slug")
    .eq("is_deleted", false)
    .not("slug", "is", null);

  if (duplicateError) {
    issues.push(`Error checking duplicate slugs: ${duplicateError.message}`);
  } else if (duplicateSlugs) {
    const slugCounts = duplicateSlugs.reduce((acc: Record<string, number>, entity) => {
      if (entity.slug) {
        acc[entity.slug] = (acc[entity.slug] || 0) + 1;
      }
      return acc;
    }, {});

    const duplicates = Object.entries(slugCounts).filter(([_, count]) => count > 1);
    if (duplicates.length > 0) {
      issues.push(`Found ${duplicates.length} duplicate slugs: ${duplicates.map(([slug, count]) => `${slug} (${count} times)`).join(", ")}`);
    }
  }

  return {
    isValid: issues.length === 0,
    issues,
    orphanedSlugs: orphanedCount,
  };
};

/**
 * Get statistics about hierarchical slug migration readiness
 * @returns Statistics about current slug state
 */
export const getMigrationStatistics = async (): Promise<{
  totalEntities: number;
  entitiesWithSlugs: number;
  entitiesWithoutSlugs: number;
  parentChildRelationships: number;
  brandProductRelationships: number;
}> => {
  // Get total entities
  const { count: totalEntities } = await supabase
    .from("entities")
    .select("*", { count: "exact", head: true })
    .eq("is_deleted", false);

  // Get entities with slugs
  const { count: entitiesWithSlugs } = await supabase
    .from("entities")
    .select("*", { count: "exact", head: true })
    .eq("is_deleted", false)
    .not("slug", "is", null)
    .neq("slug", "");

  // Get entities without slugs
  const { count: entitiesWithoutSlugs } = await supabase
    .from("entities")
    .select("*", { count: "exact", head: true })
    .eq("is_deleted", false)
    .or("slug.is.null,slug.eq.");

  // Get parent-child relationships
  const { count: parentChildRelationships } = await supabase
    .from("entities")
    .select("*", { count: "exact", head: true })
    .eq("is_deleted", false)
    .not("parent_id", "is", null);

  // Get brand-product relationships specifically
  const { count: brandProductRelationships } = await supabase
    .from("entities")
    .select("*, parent:entities!parent_id(*)", { count: "exact", head: true })
    .eq("is_deleted", false)
    .eq("type", "product")
    .eq("entities.is_deleted", false)
    .eq("entities.type", "brand");

  return {
    totalEntities: totalEntities || 0,
    entitiesWithSlugs: entitiesWithSlugs || 0,
    entitiesWithoutSlugs: entitiesWithoutSlugs || 0,
    parentChildRelationships: parentChildRelationships || 0,
    brandProductRelationships: brandProductRelationships || 0,
  };
};