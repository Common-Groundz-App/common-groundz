import { supabase } from '@/integrations/supabase/client';
import { Entity, EntityType } from '@/services/recommendation/types';
import { uploadEntityImage } from '@/services/entityImageService';

export interface CreateBrandData {
  name: string;
  description?: string;
  image_url?: string;
  image_file?: File;
  website_url?: string;
}

export const checkBrandExists = async (name: string): Promise<Entity | null> => {
  try {
    const { data, error } = await supabase
      .from('entities')
      .select('*')
      .eq('type', EntityType.Brand)
      .ilike('name', name.trim())
      .eq('is_deleted', false)
      .limit(1)
      .maybeSingle();

    if (error) {
      console.error('❌ Error checking brand existence:', error);
      return null;
    }

    return data as Entity;
  } catch (error) {
    console.error('❌ Error in checkBrandExists:', error);
    return null;
  }
};

export const createBrand = async (
  brandData: CreateBrandData,
  userId?: string | null
): Promise<Entity | null> => {
  try {
    console.log('🏢 Creating brand:', brandData);
    
    let imageUrl = brandData.image_url;
    
    // Handle image file upload if provided
    if (brandData.image_file && userId) {
      console.log('📸 Uploading brand image file...');
      const uploadResult = await uploadEntityImage(brandData.image_file, userId);
      if (uploadResult.success && uploadResult.url) {
        imageUrl = uploadResult.url;
        console.log('✅ Brand image uploaded:', uploadResult.url);
      } else {
        console.warn('⚠️ Image upload failed:', uploadResult.error);
      }
    }
    
    const { data: brand, error } = await supabase
      .from('entities')
      .insert({
        name: brandData.name.trim(),
        type: EntityType.Brand,
        description: brandData.description?.trim() || `Brand: ${brandData.name}`,
        image_url: imageUrl,
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