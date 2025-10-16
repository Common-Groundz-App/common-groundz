-- ============================================
-- COMPREHENSIVE CATEGORY TAXONOMY MIGRATION
-- Final standardized structure for all entity types
-- ============================================

-- ============================================
-- PHASE 1: FOOD - Merge & Add Categories
-- ============================================

-- Delete "Cafés & Hangouts" (0 entities)
DELETE FROM categories 
WHERE name = 'Cafés & Hangouts' 
AND entity_type = 'food';

-- Get parent ID for Food, Beverages & Dining
DO $$
DECLARE
  food_parent_id UUID;
BEGIN
  SELECT id INTO food_parent_id
  FROM categories
  WHERE name = 'Food, Beverages & Dining' 
  AND entity_type = 'food' 
  AND parent_id IS NULL;

  -- Add Street Food
  INSERT INTO categories (name, entity_type, parent_id, slug)
  VALUES ('Street Food', 'food', food_parent_id, 'street-food')
  ON CONFLICT DO NOTHING;

  -- Add Bars & Nightlife
  INSERT INTO categories (name, entity_type, parent_id, slug)
  VALUES ('Bars & Nightlife', 'food', food_parent_id, 'bars-nightlife')
  ON CONFLICT DO NOTHING;
END $$;

-- ============================================
-- PHASE 2: PLACE - Add Missing Categories
-- ============================================

DO $$
DECLARE
  place_parent_id UUID;
BEGIN
  SELECT id INTO place_parent_id
  FROM categories
  WHERE name = 'Places' 
  AND entity_type = 'place' 
  AND parent_id IS NULL;

  -- Add Parks & Nature
  INSERT INTO categories (name, entity_type, parent_id, slug)
  VALUES ('Parks & Nature', 'place', place_parent_id, 'parks-nature')
  ON CONFLICT DO NOTHING;

  -- Add Neighborhoods
  INSERT INTO categories (name, entity_type, parent_id, slug)
  VALUES ('Neighborhoods', 'place', place_parent_id, 'neighborhoods')
  ON CONFLICT DO NOTHING;
END $$;

-- ============================================
-- PHASE 3: APP - Complete Restructuring
-- ============================================

DO $$
DECLARE
  apps_parent_id UUID;
  old_productivity_id UUID;
BEGIN
  -- Get Apps & Software parent
  SELECT id INTO apps_parent_id
  FROM categories
  WHERE name = 'Apps & Software' 
  AND entity_type = 'app' 
  AND parent_id IS NULL;

  -- Get old Productivity Tools parent
  SELECT id INTO old_productivity_id
  FROM categories
  WHERE name = 'Productivity Tools' 
  AND entity_type = 'app' 
  AND parent_id IS NULL;

  -- Move all children of "Productivity Tools" to "Apps & Software"
  UPDATE categories
  SET parent_id = apps_parent_id
  WHERE parent_id = old_productivity_id;

  -- Delete old "Productivity Tools" parent
  DELETE FROM categories WHERE id = old_productivity_id;

  -- Rename "Design & Creativity Tools" to "Design & Creativity Apps"
  UPDATE categories
  SET name = 'Design & Creativity Apps',
      slug = 'design-creativity-apps'
  WHERE name = 'Design & Creativity Tools' 
  AND entity_type = 'app';

  -- Move and rename "Mental Health Tools" to "Mental Health Apps"
  UPDATE categories
  SET name = 'Mental Health Apps',
      slug = 'mental-health-apps',
      parent_id = apps_parent_id
  WHERE name = 'Mental Health Tools' 
  AND entity_type = 'app';

  -- Move and rename "Travel Apps" to "Travel & Navigation Apps"
  UPDATE categories
  SET name = 'Travel & Navigation Apps',
      slug = 'travel-navigation-apps',
      parent_id = apps_parent_id
  WHERE name = 'Travel Apps' 
  AND entity_type = 'app';

  -- Ensure "Productivity Apps" exists (renamed from old structure)
  INSERT INTO categories (name, entity_type, parent_id, slug)
  VALUES ('Productivity Apps', 'app', apps_parent_id, 'productivity-apps')
  ON CONFLICT DO NOTHING;

  -- Add new subcategories
  INSERT INTO categories (name, entity_type, parent_id, slug)
  VALUES 
    ('Education & Learning Apps', 'app', apps_parent_id, 'education-learning-apps'),
    ('Shopping & Deals Apps', 'app', apps_parent_id, 'shopping-deals-apps'),
    ('Utilities & System Tools', 'app', apps_parent_id, 'utilities-system-tools')
  ON CONFLICT DO NOTHING;
END $$;

-- ============================================
-- PHASE 4: BOOK - Add Genre Subcategories (with proper slug generation)
-- ============================================

DO $$
DECLARE
  book_parent_id UUID;
  genre_name TEXT;
  genre_slug TEXT;
BEGIN
  SELECT id INTO book_parent_id
  FROM categories
  WHERE name = 'Books & Literature' 
  AND entity_type = 'book' 
  AND parent_id IS NULL;

  -- Array of genres
  FOREACH genre_name IN ARRAY ARRAY[
    'Fiction',
    'Non-Fiction',
    'Biography & Memoir',
    'Self-Help & Personal Growth',
    'Science & Technology',
    'History',
    'Business & Finance',
    'Children''s & Young Adult'
  ]
  LOOP
    -- Generate proper slug
    genre_slug := TRIM(BOTH '-' FROM regexp_replace(LOWER(genre_name), '[^a-z0-9]+', '-', 'g'));
    
    INSERT INTO categories (name, entity_type, parent_id, slug)
    VALUES (genre_name, 'book', book_parent_id, genre_slug)
    ON CONFLICT DO NOTHING;
  END LOOP;
END $$;

-- ============================================
-- PHASE 5: MOVIE - Add Genre Subcategories (with proper slug generation)
-- ============================================

DO $$
DECLARE
  movie_parent_id UUID;
  genre_name TEXT;
  genre_slug TEXT;
BEGIN
  SELECT id INTO movie_parent_id
  FROM categories
  WHERE name = 'Movies' 
  AND entity_type = 'movie' 
  AND parent_id IS NULL;

  -- Array of genres
  FOREACH genre_name IN ARRAY ARRAY[
    'Action',
    'Comedy',
    'Drama',
    'Thriller',
    'Documentary',
    'Sci-Fi & Fantasy',
    'Romance',
    'Crime & Mystery',
    'Horror',
    'Animation'
  ]
  LOOP
    -- Generate proper slug
    genre_slug := TRIM(BOTH '-' FROM regexp_replace(LOWER(genre_name), '[^a-z0-9]+', '-', 'g'));
    
    INSERT INTO categories (name, entity_type, parent_id, slug)
    VALUES (genre_name, 'movie', movie_parent_id, genre_slug)
    ON CONFLICT DO NOTHING;
  END LOOP;
END $$;

-- ============================================
-- PHASE 6: TV SHOW - Add Genre Subcategories (with proper slug generation)
-- ============================================

DO $$
DECLARE
  tv_parent_id UUID;
  genre_name TEXT;
  genre_slug TEXT;
BEGIN
  SELECT id INTO tv_parent_id
  FROM categories
  WHERE name = 'TV Shows' 
  AND entity_type = 'tv_show' 
  AND parent_id IS NULL;

  -- Array of genres
  FOREACH genre_name IN ARRAY ARRAY[
    'Drama Series',
    'Comedy Series',
    'Reality TV',
    'Documentary Series',
    'Crime Series',
    'Animated Series',
    'Mini Series'
  ]
  LOOP
    -- Generate proper slug
    genre_slug := TRIM(BOTH '-' FROM regexp_replace(LOWER(genre_name), '[^a-z0-9]+', '-', 'g'));
    
    INSERT INTO categories (name, entity_type, parent_id, slug)
    VALUES (genre_name, 'tv_show', tv_parent_id, genre_slug)
    ON CONFLICT DO NOTHING;
  END LOOP;
END $$;

-- ============================================
-- PHASE 7: EVENT - Add Subcategories
-- ============================================

DO $$
DECLARE
  event_parent_id UUID;
BEGIN
  SELECT id INTO event_parent_id
  FROM categories
  WHERE name = 'Events & Experiences' 
  AND entity_type = 'event' 
  AND parent_id IS NULL;

  INSERT INTO categories (name, entity_type, parent_id, slug)
  VALUES 
    ('Concerts & Live Music', 'event', event_parent_id, 'concerts-live-music'),
    ('Sports Events', 'event', event_parent_id, 'sports-events'),
    ('Festivals & Cultural Events', 'event', event_parent_id, 'festivals-cultural-events'),
    ('Exhibitions & Fairs', 'event', event_parent_id, 'exhibitions-fairs'),
    ('Workshops & Meetups', 'event', event_parent_id, 'workshops-meetups')
  ON CONFLICT DO NOTHING;
END $$;

-- ============================================
-- PHASE 8: EXPERIENCE - Add Wellness Parent & Restructure
-- ============================================

DO $$
DECLARE
  wellness_parent_id UUID;
  outdoor_parent_id UUID;
  yoga_meditation_id UUID;
BEGIN
  -- Create "Wellness Experiences" parent
  INSERT INTO categories (name, entity_type, parent_id, slug, description)
  VALUES ('Wellness Experiences', 'experience', NULL, 'wellness-experiences', 'Wellness and mindfulness activities')
  ON CONFLICT DO NOTHING
  RETURNING id INTO wellness_parent_id;

  -- If already exists, get the ID
  IF wellness_parent_id IS NULL THEN
    SELECT id INTO wellness_parent_id
    FROM categories
    WHERE name = 'Wellness Experiences' 
    AND entity_type = 'experience' 
    AND parent_id IS NULL;
  END IF;

  -- Find existing "Yoga & Meditation" category
  SELECT id INTO yoga_meditation_id
  FROM categories
  WHERE name = 'Yoga & Meditation' 
  AND entity_type = 'experience';

  -- Move existing "Yoga & Meditation" under "Wellness Experiences"
  IF yoga_meditation_id IS NOT NULL THEN
    UPDATE categories
    SET parent_id = wellness_parent_id
    WHERE id = yoga_meditation_id;
  ELSE
    -- If doesn't exist, create it
    INSERT INTO categories (name, entity_type, parent_id, slug)
    VALUES ('Yoga & Meditation', 'experience', wellness_parent_id, 'yoga-meditation')
    ON CONFLICT DO NOTHING;
  END IF;

  -- Add "Retreats & Wellness" under "Wellness Experiences"
  INSERT INTO categories (name, entity_type, parent_id, slug)
  VALUES ('Retreats & Wellness', 'experience', wellness_parent_id, 'retreats-wellness')
  ON CONFLICT DO NOTHING;

  -- Get Outdoor Activities parent
  SELECT id INTO outdoor_parent_id
  FROM categories
  WHERE name = 'Outdoor Activities' 
  AND entity_type = 'experience';

  -- Ensure Outdoor Activities is a primary (no parent)
  UPDATE categories
  SET parent_id = NULL
  WHERE id = outdoor_parent_id;

  -- Add "Nature & Hiking" under "Outdoor Activities" if not exists
  INSERT INTO categories (name, entity_type, parent_id, slug)
  VALUES ('Nature & Hiking', 'experience', outdoor_parent_id, 'nature-hiking')
  ON CONFLICT DO NOTHING;
END $$;

-- ============================================
-- PHASE 9: SERVICE - Complete Restructuring
-- ============================================

DO $$
DECLARE
  health_wellness_id UUID;
  home_services_id UUID;
  local_services_id UUID;
  professional_services_id UUID;
  travel_transport_id UUID;
BEGIN
  -- Get existing parent IDs
  SELECT id INTO health_wellness_id
  FROM categories
  WHERE name = 'Health & Wellness' 
  AND entity_type = 'service' 
  AND parent_id IS NULL;

  SELECT id INTO local_services_id
  FROM categories
  WHERE name = 'Local Services' 
  AND entity_type = 'service' 
  AND parent_id IS NULL;

  SELECT id INTO travel_transport_id
  FROM categories
  WHERE name = 'Travel & Transportation' 
  AND entity_type = 'service' 
  AND parent_id IS NULL;

  -- Rename "Home & Living" to "Home Services"
  UPDATE categories
  SET name = 'Home Services',
      slug = 'home-services'
  WHERE name = 'Home & Living' 
  AND entity_type = 'service';

  SELECT id INTO home_services_id
  FROM categories
  WHERE name = 'Home Services' 
  AND entity_type = 'service' 
  AND parent_id IS NULL;

  -- Create "Professional Services" parent
  INSERT INTO categories (name, entity_type, parent_id, slug)
  VALUES ('Professional Services', 'service', NULL, 'professional-services')
  ON CONFLICT DO NOTHING
  RETURNING id INTO professional_services_id;

  IF professional_services_id IS NULL THEN
    SELECT id INTO professional_services_id
    FROM categories
    WHERE name = 'Professional Services' 
    AND entity_type = 'service' 
    AND parent_id IS NULL;
  END IF;

  -- Add subcategories
  INSERT INTO categories (name, entity_type, parent_id, slug)
  VALUES 
    ('Clinics & Doctors', 'service', health_wellness_id, 'clinics-doctors'),
    ('Cleaning & Repairs', 'service', home_services_id, 'cleaning-repairs'),
    ('Delivery & Errands', 'service', local_services_id, 'delivery-errands'),
    ('Consulting & Legal', 'service', professional_services_id, 'consulting-legal'),
    ('Airlines', 'service', travel_transport_id, 'airlines'),
    ('Trains & Buses', 'service', travel_transport_id, 'trains-buses')
  ON CONFLICT DO NOTHING;
END $$;

-- ============================================
-- PHASE 10: COURSE - Add Missing Categories
-- ============================================

DO $$
DECLARE
  course_parent_id UUID;
BEGIN
  SELECT id INTO course_parent_id
  FROM categories
  WHERE name = 'Courses & Education' 
  AND entity_type = 'course' 
  AND parent_id IS NULL;

  INSERT INTO categories (name, entity_type, parent_id, slug)
  VALUES 
    ('Finance & Investing', 'course', course_parent_id, 'finance-investing'),
    ('Health & Wellness Courses', 'course', course_parent_id, 'health-wellness-courses')
  ON CONFLICT DO NOTHING;
END $$;

-- ============================================
-- PHASE 11: GAME - Complete Rebuild
-- ============================================

DO $$
DECLARE
  game_parent_id UUID;
  genre_name TEXT;
  genre_slug TEXT;
BEGIN
  -- Get Games parent
  SELECT id INTO game_parent_id
  FROM categories
  WHERE name = 'Games' 
  AND entity_type = 'game' 
  AND parent_id IS NULL;

  -- Delete ALL existing game subcategories
  DELETE FROM categories
  WHERE entity_type = 'game' 
  AND parent_id = game_parent_id;

  -- Insert exact 6 new genres
  FOREACH genre_name IN ARRAY ARRAY[
    'Action & Adventure',
    'Strategy & Puzzle',
    'Sports & Racing',
    'RPG & Fantasy',
    'Casual & Mobile',
    'Multiplayer & Online'
  ]
  LOOP
    genre_slug := TRIM(BOTH '-' FROM regexp_replace(LOWER(genre_name), '[^a-z0-9]+', '-', 'g'));
    
    INSERT INTO categories (name, entity_type, parent_id, slug)
    VALUES (genre_name, 'game', game_parent_id, genre_slug);
  END LOOP;
END $$;

-- ============================================
-- PHASE 12: BRAND - Create Complete New Structure
-- ============================================

DO $$
DECLARE
  brand_name TEXT;
  brand_slug TEXT;
BEGIN
  FOREACH brand_name IN ARRAY ARRAY[
    'Beauty & Personal Care Brands',
    'Fashion & Lifestyle Brands',
    'Electronics & Tech Brands',
    'Food & Beverage Brands',
    'Health & Wellness Brands',
    'Home & Living Brands',
    'Travel & Hospitality Brands',
    'Education & Learning Brands',
    'Sports & Fitness Brands',
    'Automotive & Mobility Brands',
    'Media & Entertainment Brands',
    'Financial & Business Brands',
    'Others (Brands)'
  ]
  LOOP
    brand_slug := TRIM(BOTH '-' FROM regexp_replace(LOWER(brand_name), '[^a-z0-9]+', '-', 'g'));
    
    INSERT INTO categories (name, entity_type, parent_id, slug)
    VALUES (brand_name, 'brand', NULL, brand_slug)
    ON CONFLICT DO NOTHING;
  END LOOP;
END $$;

-- ============================================
-- PHASE 13: PROFESSIONAL - Create Complete New Structure
-- ============================================

DO $$
DECLARE
  prof_name TEXT;
  prof_slug TEXT;
BEGIN
  FOREACH prof_name IN ARRAY ARRAY[
    'Creators & Influencers',
    'Coaches & Mentors',
    'Consultants & Freelancers',
    'Medical Professionals',
    'Beauty & Wellness Experts',
    'Fitness Trainers',
    'Service Providers',
    'Artists & Designers',
    'Educators & Instructors',
    'Technical Experts',
    'Entrepreneurs & Founders',
    'Others (Professionals)'
  ]
  LOOP
    prof_slug := TRIM(BOTH '-' FROM regexp_replace(LOWER(prof_name), '[^a-z0-9]+', '-', 'g'));
    
    INSERT INTO categories (name, entity_type, parent_id, slug)
    VALUES (prof_name, 'professional', NULL, prof_slug)
    ON CONFLICT DO NOTHING;
  END LOOP;
END $$;

-- ============================================
-- VERIFICATION: Final Category Counts
-- ============================================

DO $$
DECLARE
  total_categories INTEGER;
  app_count INTEGER;
  book_count INTEGER;
  brand_count INTEGER;
  course_count INTEGER;
  event_count INTEGER;
  experience_count INTEGER;
  food_count INTEGER;
  game_count INTEGER;
  movie_count INTEGER;
  place_count INTEGER;
  product_count INTEGER;
  professional_count INTEGER;
  service_count INTEGER;
  tv_count INTEGER;
  others_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO total_categories FROM categories;
  SELECT COUNT(*) INTO app_count FROM categories WHERE entity_type = 'app';
  SELECT COUNT(*) INTO book_count FROM categories WHERE entity_type = 'book';
  SELECT COUNT(*) INTO brand_count FROM categories WHERE entity_type = 'brand';
  SELECT COUNT(*) INTO course_count FROM categories WHERE entity_type = 'course';
  SELECT COUNT(*) INTO event_count FROM categories WHERE entity_type = 'event';
  SELECT COUNT(*) INTO experience_count FROM categories WHERE entity_type = 'experience';
  SELECT COUNT(*) INTO food_count FROM categories WHERE entity_type = 'food';
  SELECT COUNT(*) INTO game_count FROM categories WHERE entity_type = 'game';
  SELECT COUNT(*) INTO movie_count FROM categories WHERE entity_type = 'movie';
  SELECT COUNT(*) INTO place_count FROM categories WHERE entity_type = 'place';
  SELECT COUNT(*) INTO product_count FROM categories WHERE entity_type = 'product';
  SELECT COUNT(*) INTO professional_count FROM categories WHERE entity_type = 'professional';
  SELECT COUNT(*) INTO service_count FROM categories WHERE entity_type = 'service';
  SELECT COUNT(*) INTO tv_count FROM categories WHERE entity_type = 'tv_show';
  SELECT COUNT(*) INTO others_count FROM categories WHERE entity_type = 'others';

  RAISE NOTICE '=== FINAL CATEGORY TAXONOMY ===';
  RAISE NOTICE 'Total categories: %', total_categories;
  RAISE NOTICE '';
  RAISE NOTICE 'Categories by entity_type:';
  RAISE NOTICE '  app: %', app_count;
  RAISE NOTICE '  book: %', book_count;
  RAISE NOTICE '  brand: %', brand_count;
  RAISE NOTICE '  course: %', course_count;
  RAISE NOTICE '  event: %', event_count;
  RAISE NOTICE '  experience: %', experience_count;
  RAISE NOTICE '  food: %', food_count;
  RAISE NOTICE '  game: %', game_count;
  RAISE NOTICE '  movie: %', movie_count;
  RAISE NOTICE '  place: %', place_count;
  RAISE NOTICE '  product: %', product_count;
  RAISE NOTICE '  professional: %', professional_count;
  RAISE NOTICE '  service: %', service_count;
  RAISE NOTICE '  tv_show: %', tv_count;
  RAISE NOTICE '  others: %', others_count;
  RAISE NOTICE '';
  RAISE NOTICE '✅ Comprehensive category taxonomy migration complete!';
END $$;