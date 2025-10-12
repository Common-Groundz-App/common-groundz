-- Migration 1: Add entity_type column to categories
ALTER TABLE public.categories 
ADD COLUMN IF NOT EXISTS entity_type entity_type NULL;

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_categories_entity_type 
ON public.categories(entity_type) 
WHERE entity_type IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_categories_parent_type 
ON public.categories(parent_id, entity_type);

-- Backfill existing categories
UPDATE public.categories SET entity_type = 'product' 
WHERE slug IN ('skincare', 'makeup-cosmetics', 'haircare') AND entity_type IS NULL;

UPDATE public.categories SET entity_type = 'food' 
WHERE slug IN ('restaurants-dining', 'cafes-hangouts') AND entity_type IS NULL;

UPDATE public.categories SET entity_type = 'place' 
WHERE slug IN ('hotels-accommodations', 'cities-destinations') AND entity_type IS NULL;

UPDATE public.categories SET entity_type = 'movie' 
WHERE slug IN ('action-movies', 'drama-movies') AND entity_type IS NULL;