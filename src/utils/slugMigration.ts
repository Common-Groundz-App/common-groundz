/**
 * Migration utility for ensuring all entities have slugs
 */

import { supabase } from '@/integrations/supabase/client';

/**
 * Generate a slug from a name string
 */
function generateSlug(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '') // Remove non-alphanumeric characters except spaces and hyphens
    .replace(/\s+/g, '-') // Replace spaces with hyphens
    .replace(/-+/g, '-') // Replace multiple hyphens with single hyphen
    .replace(/^-|-$/g, ''); // Remove leading/trailing hyphens
}

/**
 * Check if slug already exists for another entity
 */
async function isSlugUnique(slug: string, entityId: string): Promise<boolean> {
  const { data, error } = await supabase
    .from('entities')
    .select('id')
    .eq('slug', slug)
    .neq('id', entityId)
    .limit(1);

  if (error) {
    console.error('Error checking slug uniqueness:', error);
    return false;
  }

  return data.length === 0;
}

/**
 * Generate a unique slug for an entity
 */
async function generateUniqueSlug(name: string, entityId: string): Promise<string> {
  let baseSlug = generateSlug(name);
  let slug = baseSlug;
  let counter = 1;

  // If base slug is unique, use it
  if (await isSlugUnique(slug, entityId)) {
    return slug;
  }

  // Otherwise, append numbers until we find a unique one
  while (!(await isSlugUnique(slug, entityId))) {
    slug = `${baseSlug}-${counter}`;
    counter++;
  }

  return slug;
}

/**
 * Migrate entities without slugs to have slugs
 */
export async function migrateEntitySlugs(): Promise<void> {
  console.log('Starting entity slug migration...');

  // Fetch entities without slugs
  const { data: entities, error } = await supabase
    .from('entities')
    .select('id, name, slug')
    .or('slug.is.null,slug.eq.')
    .eq('is_deleted', false)
    .limit(100); // Process in batches

  if (error) {
    console.error('Error fetching entities for migration:', error);
    throw error;
  }

  if (!entities || entities.length === 0) {
    console.log('No entities need slug migration');
    return;
  }

  console.log(`Found ${entities.length} entities needing slugs`);

  // Process each entity
  for (const entity of entities) {
    try {
      const slug = await generateUniqueSlug(entity.name, entity.id);
      
      const { error: updateError } = await supabase
        .from('entities')
        .update({ slug })
        .eq('id', entity.id);

      if (updateError) {
        console.error(`Error updating slug for entity ${entity.id}:`, updateError);
      } else {
        console.log(`Generated slug "${slug}" for entity "${entity.name}"`);
      }
    } catch (error) {
      console.error(`Error processing entity ${entity.id}:`, error);
    }
  }

  console.log('Entity slug migration completed');
}

/**
 * Run migration if needed (can be called from admin panel or during app initialization)
 */
export async function runSlugMigrationIfNeeded(): Promise<void> {
  try {
    // Check if there are entities without slugs
    const { data, error } = await supabase
      .from('entities')
      .select('id')
      .or('slug.is.null,slug.eq.')
      .eq('is_deleted', false)
      .limit(1);

    if (error) {
      console.error('Error checking for entities needing migration:', error);
      return;
    }

    if (data && data.length > 0) {
      console.log('Entities found without slugs, running migration...');
      await migrateEntitySlugs();
    }
  } catch (error) {
    console.error('Error in slug migration check:', error);
  }
}
