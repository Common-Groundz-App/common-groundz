import { supabase } from '@/integrations/supabase/client';

export interface SlugResolution {
  found: boolean;
  entity?: any;
  suggestion?: string;
  originalSlug: string;
}

/**
 * Resolves entity slugs with fallback strategies for changed slugs
 */
export const resolveEntitySlug = async (slug: string): Promise<SlugResolution> => {
  console.log('🔍 Resolving entity slug:', slug);
  
  try {
    // First, try exact slug match
    const { data: exactMatch, error: exactError } = await supabase
      .from('entities')
      .select('*')
      .eq('slug', slug)
      .eq('is_deleted', false)
      .single();

    if (exactMatch && !exactError) {
      console.log('✅ Found exact slug match:', exactMatch.name);
      return {
        found: true,
        entity: exactMatch,
        originalSlug: slug
      };
    }

    // If no exact match, try to find entities with similar names
    console.log('🔄 No exact match, searching for similar entities...');
    
    // Extract base name from slug (remove numbers and hyphens)
    const baseName = slug
      .replace(/-\d+$/, '') // Remove trailing number like "-1"
      .replace(/-/g, ' ') // Replace hyphens with spaces
      .trim();

    console.log('🔍 Searching for base name:', baseName);

    const { data: similarEntities, error: similarError } = await supabase
      .from('entities')
      .select('*')
      .ilike('name', `%${baseName}%`)
      .eq('is_deleted', false)
      .limit(5);

    if (similarEntities && similarEntities.length > 0 && !similarError) {
      console.log('📋 Found similar entities:', similarEntities.map(e => ({ name: e.name, slug: e.slug })));
      
      // Return the first similar entity as suggestion
      return {
        found: false,
        suggestion: similarEntities[0].slug,
        originalSlug: slug
      };
    }

    // No matches found
    console.log('❌ No entity found for slug:', slug);
    return {
      found: false,
      originalSlug: slug
    };

  } catch (error) {
    console.error('🚨 Error resolving entity slug:', error);
    return {
      found: false,
      originalSlug: slug
    };
  }
};

/**
 * Check if entity exists in search results (for "Already on Groundz")
 */
export const checkEntityExistsInSearch = async (searchTerm: string): Promise<boolean> => {
  try {
    const { data, error } = await supabase
      .from('entities')
      .select('id, name, slug')
      .or(`name.ilike.%${searchTerm}%, slug.ilike.%${searchTerm}%`)
      .eq('is_deleted', false)
      .limit(1);

    return !error && data && data.length > 0;
  } catch (error) {
    console.error('Error checking entity existence:', error);
    return false;
  }
};