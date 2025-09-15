/**
 * Category system types for Phase 1 entity architecture
 */

export interface Category {
  id: string;
  name: string;
  description?: string;
  slug: string;
  parent_id?: string;
  created_at?: string;
  updated_at?: string;
}

export interface CategoryWithSubcategories extends Category {
  subcategories: Category[];
}

export interface CategoryHierarchy {
  id: string;
  name: string;
  description: string;
  slug: string;
  parent_id: string | null;
  parent_name: string | null;
  subcategories: {
    id: string;
    name: string;
    slug: string;
    description: string;
  }[];
}

// User creation data for entities
export interface EntityCreateData {
  name: string;
  description?: string;
  type: string;
  category_id?: string;
  parent_id?: string;
  image_url?: string;
  website_url?: string;
  venue?: string;
  user_created: boolean;
  created_by: string;
  approval_status: 'pending' | 'approved' | 'rejected';
}