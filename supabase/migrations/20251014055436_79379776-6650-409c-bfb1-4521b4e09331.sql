-- Migration: Assign entity_types to ACTUAL categories in database
-- This corrects the previous migration which targeted non-existent category names

-- ============================================
-- PRODUCT CATEGORIES
-- ============================================
UPDATE categories SET entity_type = 'product'
WHERE entity_type IS NULL AND name IN (
  'Apparel & Accessories',
  'Beauty & Personal Care',
  'Clothing',
  'Electronics & Gadgets',
  'Fashion Accessories',
  'Footwear',
  'Fragrances',
  'Furniture',
  'Home Decor',
  'Home & Living',
  'Jewelry & Watches',
  'Kitchenware',
  'Laptops & Tablets',
  'Mobile Phones',
  'Cameras & Optics',
  'Smart Devices',
  'Audio & Video',
  'Gaming Consoles',
  'Fitness Equipment',
  'Bags & Luggage',
  'Travel Accessories',
  'Storage & Organization',
  'Cleaning Supplies',
  'Hygiene & Sanitation',
  'Personal Hygiene',
  'Food Items',
  'Beverages',
  'Alcoholic Beverages',
  'Desserts & Snacks',
  'Supplements',
  'Sleep Aids'
);

-- ============================================
-- FOOD CATEGORIES
-- ============================================
UPDATE categories SET entity_type = 'food'
WHERE entity_type IS NULL AND name IN (
  'Food, Beverages & Dining',
  'Restaurants & Cafés',
  'Cafés & Hangouts'
);

-- ============================================
-- PLACE CATEGORIES
-- ============================================
UPDATE categories SET entity_type = 'place'
WHERE entity_type IS NULL AND name IN (
  'Hotels & Stays',
  'Tourist Attractions',
  'Places'
);

-- ============================================
-- MOVIE CATEGORIES
-- ============================================
UPDATE categories SET entity_type = 'movie'
WHERE entity_type IS NULL AND name = 'Movies';

-- ============================================
-- TV SHOW CATEGORIES
-- ============================================
UPDATE categories SET entity_type = 'tv_show'
WHERE entity_type IS NULL AND name = 'TV Shows';

-- ============================================
-- BOOK CATEGORIES
-- ============================================
UPDATE categories SET entity_type = 'book'
WHERE entity_type IS NULL AND name = 'Books & Literature';

-- ============================================
-- GAME CATEGORIES
-- ============================================
UPDATE categories SET entity_type = 'game'
WHERE entity_type IS NULL AND name IN (
  'Games',
  'Board Games',
  'Console Games',
  'PC Games',
  'Mobile Games',
  'Party Games'
);

-- ============================================
-- APP CATEGORIES
-- ============================================
UPDATE categories SET entity_type = 'app'
WHERE entity_type IS NULL AND name IN (
  'Apps & Software',
  'Social Apps',
  'Health & Fitness Apps',
  'Finance & Budgeting Apps',
  'Travel Apps',
  'Productivity Tools',
  'Design & Creativity Tools',
  'Mental Health Tools'
);

-- ============================================
-- COURSE CATEGORIES
-- ============================================
UPDATE categories SET entity_type = 'course'
WHERE entity_type IS NULL AND name IN (
  'Courses & Education',
  'Language Learning',
  'Programming',
  'Design & Creativity',
  'Marketing & Business'
);

-- ============================================
-- SERVICE CATEGORIES
-- ============================================
UPDATE categories SET entity_type = 'service'
WHERE entity_type IS NULL AND name IN (
  'Local Services',
  'Health & Wellness',
  'Fitness & Wellness',
  'Travel & Transportation',
  'Airlines',
  'Trains & Buses'
);

-- ============================================
-- EXPERIENCE CATEGORIES
-- ============================================
UPDATE categories SET entity_type = 'experience'
WHERE entity_type IS NULL AND name IN (
  'Travel Experiences',
  'Outdoor Activities',
  'Sports & Recreation',
  'Team Sports',
  'Water Sports',
  'Fitness & Exercise',
  'Yoga & Meditation'
);

-- ============================================
-- EVENT CATEGORIES
-- ============================================
UPDATE categories SET entity_type = 'event'
WHERE entity_type IS NULL AND name = 'Events & Experiences';