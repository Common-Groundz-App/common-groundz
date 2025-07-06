
import { supabase } from '@/integrations/supabase/client';

export interface EntityProduct {
  id: string;
  entity_id: string;
  name: string;
  image_url?: string;
  price?: string;
  buy_link?: string;
  description?: string;
  created_at: string;
  updated_at: string;
}

export interface CreateEntityProductData {
  entity_id: string;
  name: string;
  image_url?: string;
  price?: string;
  buy_link?: string;
  description?: string;
}

export const createEntityProduct = async (data: CreateEntityProductData): Promise<EntityProduct> => {
  const { data: product, error } = await supabase
    .from('entity_products')
    .insert(data)
    .select()
    .single();

  if (error) {
    console.error('Error creating entity product:', error);
    throw error;
  }

  return product;
};

export const getEntityProducts = async (entityId: string): Promise<EntityProduct[]> => {
  const { data, error } = await supabase
    .from('entity_products')
    .select('*')
    .eq('entity_id', entityId)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error fetching entity products:', error);
    throw error;
  }

  return data || [];
};

export const updateEntityProduct = async (
  id: string, 
  updates: Partial<CreateEntityProductData>
): Promise<EntityProduct> => {
  const { data: product, error } = await supabase
    .from('entity_products')
    .update(updates)
    .eq('id', id)
    .select()
    .single();

  if (error) {
    console.error('Error updating entity product:', error);
    throw error;
  }

  return product;
};

export const deleteEntityProduct = async (id: string): Promise<void> => {
  const { error } = await supabase
    .from('entity_products')
    .delete()
    .eq('id', id);

  if (error) {
    console.error('Error deleting entity product:', error);
    throw error;
  }
};
