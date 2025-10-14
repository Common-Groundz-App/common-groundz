-- Migration: Clean up category hierarchy - fix cross-type parent-child relationships
-- This ensures categories only have parents of the same entity_type

-- ============================================
-- PHASE 1: Make Media Categories Primary
-- Remove parent relationship from Arts, Media & Entertainment (NULL type)
-- ============================================
UPDATE categories 
SET parent_id = NULL 
WHERE name IN (
  'Books & Literature',
  'Movies',
  'TV Shows',
  'Events & Experiences'
) AND entity_type IN ('book', 'movie', 'tv_show', 'event');

-- ============================================
-- PHASE 2: Reassign Food Category to Correct Parent
-- Move Cafés & Hangouts from Places to Food, Beverages & Dining
-- ============================================
UPDATE categories 
SET parent_id = (
  SELECT id FROM categories 
  WHERE name = 'Food, Beverages & Dining' 
  AND entity_type = 'food'
)
WHERE name = 'Cafés & Hangouts' 
AND entity_type = 'food';

-- ============================================
-- PHASE 3: Make Cross-Type Service Categories Primary
-- ============================================
UPDATE categories 
SET parent_id = NULL 
WHERE name IN (
  'Local Services',
  'Fitness & Wellness'
) AND entity_type = 'service';

-- ============================================
-- PHASE 4: Make Cross-Type App Categories Primary
-- ============================================
UPDATE categories 
SET parent_id = NULL 
WHERE name IN (
  'Travel Apps',
  'Mental Health Tools'
) AND entity_type = 'app';

-- ============================================
-- PHASE 5: Make Cross-Type Experience Primary
-- ============================================
UPDATE categories 
SET parent_id = NULL 
WHERE name = 'Travel Experiences' 
AND entity_type = 'experience';

-- ============================================
-- PHASE 6: Make Product Categories Primary
-- These products were incorrectly nested under food/service parents
-- ============================================
UPDATE categories 
SET parent_id = NULL 
WHERE entity_type = 'product' 
AND name IN (
  'Alcoholic Beverages',
  'Beverages',
  'Desserts & Snacks',
  'Food Items',
  'Fitness Equipment',
  'Hygiene & Sanitation',
  'Sleep Aids',
  'Supplements',
  'Travel Accessories'
);

-- Verification: Show categories that still have cross-type parents (should be empty)
DO $$
DECLARE
  cross_type_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO cross_type_count
  FROM categories c1
  LEFT JOIN categories c2 ON c1.parent_id = c2.id
  WHERE c1.parent_id IS NOT NULL 
    AND (c2.entity_type IS NULL OR c2.entity_type != c1.entity_type);
  
  IF cross_type_count > 0 THEN
    RAISE NOTICE 'Warning: % categories still have cross-type parents', cross_type_count;
  ELSE
    RAISE NOTICE 'Success: All category hierarchies are now clean';
  END IF;
END $$;