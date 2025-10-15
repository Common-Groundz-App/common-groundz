-- Migration: Comprehensive Category Cleanup & Restructuring
-- Fix NULL entity types, remove duplicates, and restructure product categories

-- ============================================
-- PHASE 1: Delete Unused NULL Categories (0 entities affected)
-- ============================================
DELETE FROM categories WHERE id IN (
  '943d6aca-0e24-4786-bad4-5f3ea09e7c74', -- Art & Crafts
  '8a482c0f-054e-4e40-92e2-4eb354f04821', -- Music & Albums
  '1f3c5a66-b431-4703-8bbc-b1f34680ccbf', -- Podcasts
  'd32d0c87-0a14-4aac-857f-3adf1f76dd1f', -- Personal Growth
  '1d70ca25-c5e6-488e-8b4a-95c1e280f430'  -- Productivity & Lifestyle
);

-- Delete orphaned "Arts, Media & Entertainment" NULL parent
DELETE FROM categories 
WHERE id = '11e7005e-55d2-44df-8b6b-f6f3708ecc33' 
AND name = 'Arts, Media & Entertainment'
AND entity_type IS NULL;

-- ============================================
-- PHASE 2: Assign Entity Type to "Uncategorized" (165 entities preserved)
-- ============================================
UPDATE categories 
SET entity_type = 'others' 
WHERE id = 'f47565ec-5d6e-470d-9b76-6a08fc911204' 
AND name = 'Uncategorized'
AND entity_type IS NULL;

-- ============================================
-- PHASE 3: Remove Duplicate "Health & Wellness" (NULL version)
-- ============================================
DELETE FROM categories 
WHERE name = 'Health & Wellness' 
AND entity_type IS NULL;

-- ============================================
-- PHASE 4: Create New Product Parent Categories
-- ============================================

-- Create "Food & Beverage Products" parent
INSERT INTO categories (name, entity_type, parent_id, slug, description)
VALUES (
  'Food & Beverage Products',
  'product',
  NULL,
  'food-beverage-products',
  'All food and beverage related products'
);

-- Create "Health & Fitness Products" parent
INSERT INTO categories (name, entity_type, parent_id, slug, description)
VALUES (
  'Health & Fitness Products',
  'product',
  NULL,
  'health-fitness-products',
  'Health, wellness, and fitness related products'
);

-- ============================================
-- PHASE 5: Restructure Product Categories
-- ============================================

-- Move food/beverage products under "Food & Beverage Products"
UPDATE categories 
SET parent_id = (
  SELECT id FROM categories 
  WHERE name = 'Food & Beverage Products' 
  AND entity_type = 'product'
  AND parent_id IS NULL
)
WHERE entity_type = 'product' 
AND parent_id IS NULL
AND name IN (
  'Alcoholic Beverages',
  'Beverages',
  'Desserts & Snacks',
  'Food Items'
);

-- Move health/fitness products under "Health & Fitness Products"
UPDATE categories 
SET parent_id = (
  SELECT id FROM categories 
  WHERE name = 'Health & Fitness Products' 
  AND entity_type = 'product'
  AND parent_id IS NULL
)
WHERE entity_type = 'product' 
AND parent_id IS NULL
AND name IN (
  'Fitness Equipment',
  'Hygiene & Sanitation',
  'Sleep Aids',
  'Supplements'
);

-- ============================================
-- VERIFICATION: Check Results
-- ============================================
DO $$
DECLARE
  null_type_count INTEGER;
  duplicate_count INTEGER;
  product_primary_count INTEGER;
BEGIN
  -- Check for remaining NULL entity types
  SELECT COUNT(*) INTO null_type_count
  FROM categories
  WHERE entity_type IS NULL;
  
  -- Check for duplicate category names within same entity_type
  SELECT COUNT(*) INTO duplicate_count
  FROM (
    SELECT name, entity_type, COUNT(*) as cnt
    FROM categories
    WHERE entity_type IS NOT NULL
    GROUP BY name, entity_type
    HAVING COUNT(*) > 1
  ) duplicates;
  
  -- Count product primary categories (should be 7)
  SELECT COUNT(*) INTO product_primary_count
  FROM categories
  WHERE entity_type = 'product' AND parent_id IS NULL;
  
  RAISE NOTICE '=== MIGRATION RESULTS ===';
  RAISE NOTICE 'Categories with NULL entity_type: %', null_type_count;
  RAISE NOTICE 'Duplicate category names: %', duplicate_count;
  RAISE NOTICE 'Product primary categories: %', product_primary_count;
  
  IF null_type_count = 0 AND duplicate_count = 0 AND product_primary_count = 7 THEN
    RAISE NOTICE '✅ SUCCESS: All categories cleaned up and restructured!';
  ELSE
    RAISE WARNING '⚠️ Some issues may remain - please review';
  END IF;
END $$;