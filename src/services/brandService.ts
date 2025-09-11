import { supabase } from '@/integrations/supabase/client';
import { Entity, EntityType } from '@/services/recommendation/types';

export interface CreateBrandData {
  name: string;
  description?: string;
  image_url?: string;
  website_url?: string;
}

export const createBrand = async (
  brandData: CreateBrandData,
  userId?: string | null
): Promise<Entity | null> => {
  try {
    console.log('🏢 Creating brand:', brandData);
    
    const { data: brand, error } = await supabase
      .from('entities')
      .insert({
        name: brandData.name.trim(),
        type: EntityType.Brand,
        description: brandData.description?.trim() || `Brand: ${brandData.name}`,
        image_url: brandData.image_url,
        website_url: brandData.website_url,
        created_by: userId || null,
        user_created: Boolean(userId),
        approval_status: userId ? 'pending' : 'approved',
        metadata: {
          entity_source: 'user_created_brand'
        }
      })
      .select()
      .single();
    
    if (error) {
      console.error('❌ Error creating brand:', error);
      return null;
    }
    
    console.log('✅ Brand created successfully:', brand);
    return brand as Entity;
  } catch (error) {
    console.error('❌ Error in createBrand:', error);
    return null;
  }
};