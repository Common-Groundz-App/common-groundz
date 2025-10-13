-- Migration: Assign entity_types to categories
-- This will make CategorySelector work properly for all entity types

-- ============================================
-- FOOD CATEGORIES (17 categories)
-- ============================================
UPDATE categories SET entity_type = 'food'
WHERE name IN (
  'African',
  'American',
  'Asian',
  'Bakery & Desserts',
  'Breakfast & Brunch',
  'Chinese',
  'European',
  'Fast Food',
  'Indian',
  'Italian',
  'Japanese',
  'Korean',
  'Latin American',
  'Mediterranean',
  'Mexican',
  'Middle Eastern',
  'Thai'
);

-- ============================================
-- PLACE CATEGORIES (20 categories)
-- ============================================
UPDATE categories SET entity_type = 'place'
WHERE name IN (
  'Accommodation',
  'Airport',
  'Amusement Park',
  'Art Gallery',
  'Beach',
  'Campground',
  'Casino',
  'Church',
  'Historic Site',
  'Library',
  'Monument',
  'Mountain',
  'Museum',
  'National Park',
  'Nature Reserve',
  'Observatory',
  'Park',
  'Shopping Mall',
  'Stadium',
  'Zoo & Aquarium'
);

-- ============================================
-- MOVIE CATEGORIES (11 categories)
-- ============================================
UPDATE categories SET entity_type = 'movie'
WHERE name IN (
  'Action',
  'Animation',
  'Comedy',
  'Crime',
  'Documentary',
  'Drama',
  'Fantasy',
  'Horror',
  'Romance',
  'Sci-Fi',
  'Thriller'
);

-- ============================================
-- TV SHOW CATEGORIES (9 categories)
-- ============================================
UPDATE categories SET entity_type = 'tv_show'
WHERE name IN (
  'Animated Series',
  'Comedy Series',
  'Crime Series',
  'Documentary Series',
  'Drama Series',
  'Fantasy Series',
  'Reality TV',
  'Sci-Fi Series',
  'Thriller Series'
);

-- ============================================
-- BOOK CATEGORIES (6 categories)
-- ============================================
UPDATE categories SET entity_type = 'book'
WHERE name IN (
  'Biography',
  'Fiction',
  'History',
  'Non-Fiction',
  'Science',
  'Self-Help'
);

-- ============================================
-- GAME CATEGORIES (4 categories)
-- ============================================
UPDATE categories SET entity_type = 'game'
WHERE name IN (
  'Board Game',
  'Card Game',
  'Puzzle Game',
  'Video Game'
);

-- ============================================
-- SERVICE CATEGORIES (4 categories)
-- ============================================
UPDATE categories SET entity_type = 'service'
WHERE name IN (
  'Financial Service',
  'Healthcare Service',
  'Legal Service',
  'Professional Service'
);

-- ============================================
-- APP CATEGORIES (3 categories)
-- ============================================
UPDATE categories SET entity_type = 'app'
WHERE name IN (
  'Mobile App',
  'Productivity App',
  'Social App'
);

-- ============================================
-- EXPERIENCE CATEGORIES (1 category)
-- ============================================
UPDATE categories SET entity_type = 'experience'
WHERE name = 'Adventure Experience';

-- ============================================
-- EVENT CATEGORIES (1 category)
-- ============================================
UPDATE categories SET entity_type = 'event'
WHERE name = 'Concert';

-- ============================================
-- COURSE CATEGORIES (1 category)
-- ============================================
UPDATE categories SET entity_type = 'course'
WHERE name = 'Online Course';