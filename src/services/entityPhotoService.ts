import { supabase } from '@/integrations/supabase/client';

export interface EntityPhoto {
  id: string;
  entity_id: string;
  user_id: string;
  url: string;
  caption?: string;
  alt_text?: string;
  category: string;
  status: 'pending' | 'approved' | 'rejected';
  file_size?: number;
  width?: number;
  height?: number;
  content_type?: string;
  created_at: string;
  updated_at: string;
  username?: string;
}

export interface EntityPhotoUploadResult {
  success: boolean;
  photo?: EntityPhoto;
  error?: string;
}

export const PHOTO_CATEGORIES = [
  { value: 'general', label: 'General' },
  { value: 'interior', label: 'Interior' },
  { value: 'exterior', label: 'Exterior' },
  { value: 'menu', label: 'Menu' },
  { value: 'atmosphere', label: 'Atmosphere' },
  { value: 'food', label: 'Food & Drinks' },
  { value: 'events', label: 'Events' },
  { value: 'staff', label: 'Staff' },
  { value: 'amenities', label: 'Amenities' }
];

export const uploadEntityPhoto = async (
  file: File,
  entityId: string,
  userId: string,
  category: string = 'general',
  caption?: string,
  altText?: string
): Promise<EntityPhotoUploadResult> => {
  try {
    // Generate unique filename
    const timestamp = Date.now();
    const fileExtension = file.name.split('.').pop();
    const fileName = `${userId}/entity-photos/${entityId}_${timestamp}.${fileExtension}`;

    console.log('Uploading entity photo:', fileName);

    // Upload file to Supabase storage
    const { data, error } = await supabase.storage
      .from('entity-images')
      .upload(fileName, file, {
        cacheControl: '3600',
        upsert: false
      });

    if (error) {
      console.error('Upload error:', error);
      return { success: false, error: error.message };
    }

    // Get public URL
    const { data: publicUrlData } = supabase.storage
      .from('entity-images')
      .getPublicUrl(fileName);

    // Get image dimensions
    const dimensions = await getImageDimensions(file);

    // Save photo metadata to database
    const { data: photoData, error: dbError } = await supabase
      .from('entity_photos')
      .insert({
        entity_id: entityId,
        user_id: userId,
        url: publicUrlData.publicUrl,
        caption,
        alt_text: altText,
        category,
        file_size: file.size,
        width: dimensions.width,
        height: dimensions.height,
        content_type: file.type,
        status: 'approved' // Auto-approve for now
      })
      .select()
      .single();

    if (dbError) {
      console.error('Database error:', dbError);
      // Clean up uploaded file
      await supabase.storage.from('entity-images').remove([fileName]);
      return { success: false, error: dbError.message };
    }

    console.log('Entity photo uploaded successfully:', publicUrlData.publicUrl);

    return {
      success: true,
      photo: {
        ...photoData,
        status: photoData.status as 'pending' | 'approved' | 'rejected'
      }
    };
  } catch (error) {
    console.error('Entity photo upload error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
};

export const fetchEntityPhotos = async (entityId: string): Promise<EntityPhoto[]> => {
  try {
    const { data, error } = await supabase
      .from('entity_photos')
      .select('*')
      .eq('entity_id', entityId)
      .eq('status', 'approved')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching entity photos:', error);
      return [];
    }

    if (!data) return [];

    // Get user profiles separately
    const userIds = [...new Set(data.map(photo => photo.user_id))];
    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, username')
      .in('id', userIds);

    const profileMap = new Map(profiles?.map(p => [p.id, p.username]) || []);

    return data.map(photo => ({
      ...photo,
      status: photo.status as 'pending' | 'approved' | 'rejected',
      username: profileMap.get(photo.user_id) || 'Anonymous'
    }));
  } catch (error) {
    console.error('Error fetching entity photos:', error);
    return [];
  }
};

export const updateEntityPhoto = async (
  photoId: string,
  updates: Partial<Pick<EntityPhoto, 'caption' | 'alt_text' | 'category'>>
): Promise<boolean> => {
  try {
    const { error } = await supabase
      .from('entity_photos')
      .update(updates)
      .eq('id', photoId);

    if (error) {
      console.error('Error updating entity photo:', error);
      return false;
    }

    return true;
  } catch (error) {
    console.error('Error updating entity photo:', error);
    return false;
  }
};

export const deleteEntityPhoto = async (photoId: string): Promise<boolean> => {
  try {
    // Get photo details first to delete from storage
    const { data: photo, error: fetchError } = await supabase
      .from('entity_photos')
      .select('url')
      .eq('id', photoId)
      .single();

    if (fetchError) {
      console.error('Error fetching photo for deletion:', fetchError);
      return false;
    }

    // Extract file path from URL
    const url = new URL(photo.url);
    const filePath = url.pathname.split('/storage/v1/object/public/entity-images/')[1];

    // Delete from storage
    const { error: storageError } = await supabase.storage
      .from('entity-images')
      .remove([filePath]);

    if (storageError) {
      console.error('Error deleting from storage:', storageError);
    }

    // Delete from database
    const { error: dbError } = await supabase
      .from('entity_photos')
      .delete()
      .eq('id', photoId);

    if (dbError) {
      console.error('Error deleting from database:', dbError);
      return false;
    }

    return true;
  } catch (error) {
    console.error('Error deleting entity photo:', error);
    return false;
  }
};

// Helper function to get image dimensions
const getImageDimensions = (file: File): Promise<{ width: number; height: number }> => {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      resolve({ width: img.width, height: img.height });
    };
    img.onerror = () => {
      resolve({ width: 0, height: 0 });
    };
    img.src = URL.createObjectURL(file);
  });
};