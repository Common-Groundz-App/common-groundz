-- Phase 1: Database Schema & Core System Migration
-- 1. Update entity_type enum with new 10 types
ALTER TYPE entity_type ADD VALUE IF NOT EXISTS 'tv_show';
ALTER TYPE entity_type ADD VALUE IF NOT EXISTS 'course';
ALTER TYPE entity_type ADD VALUE IF NOT EXISTS 'app';
ALTER TYPE entity_type ADD VALUE IF NOT EXISTS 'game';
ALTER TYPE entity_type ADD VALUE IF NOT EXISTS 'experience';
ALTER TYPE entity_type ADD VALUE IF NOT EXISTS 'brand';

-- 2. Add user creation & moderation fields to entities table
ALTER TABLE public.entities 
ADD COLUMN IF NOT EXISTS user_created BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS approval_status TEXT DEFAULT 'approved',
ADD COLUMN IF NOT EXISTS reviewed_by UUID,
ADD COLUMN IF NOT EXISTS reviewed_at TIMESTAMP WITH TIME ZONE;

-- Update existing entities to be marked as admin-created and approved
UPDATE public.entities 
SET user_created = false, approval_status = 'approved'
WHERE user_created IS NULL;

-- 3. Populate categories table with hierarchical structure
INSERT INTO public.categories (name, description, slug, parent_id) VALUES
-- Main Categories (parent_id = NULL)
('Apparel & Accessories', 'Clothing, footwear, fashion accessories, jewelry, and bags', 'apparel-accessories', NULL),
('Beauty & Personal Care', 'Skincare, haircare, makeup, fragrances, and personal hygiene', 'beauty-personal-care', NULL),
('Food, Beverages & Dining', 'Food items, beverages, restaurants, and dining experiences', 'food-beverages-dining', NULL),
('Electronics & Gadgets', 'Mobile phones, laptops, audio, cameras, and smart devices', 'electronics-gadgets', NULL),
('Arts, Media & Entertainment', 'Movies, TV shows, books, music, podcasts, and events', 'arts-media-entertainment', NULL),
('Health & Wellness', 'Supplements, fitness equipment, mental health tools, and wellness products', 'health-wellness', NULL),
('Home & Living', 'Furniture, home decor, kitchenware, and household items', 'home-living', NULL),
('Sports & Recreation', 'Fitness, team sports, outdoor activities, and recreational equipment', 'sports-recreation', NULL),
('Places', 'Cities, attractions, hotels, cafes, and local services', 'places', NULL),
('Apps & Software', 'Productivity tools, social apps, health apps, and software solutions', 'apps-software', NULL),
('Courses & Education', 'Online courses, educational content, and learning resources', 'courses-education', NULL),
('Games', 'PC games, console games, mobile games, and board games', 'games', NULL),
('Travel & Transportation', 'Airlines, transportation, travel accessories, and experiences', 'travel-transportation', NULL),
('Uncategorized', 'Items that do not fit into other categories', 'uncategorized', NULL)
ON CONFLICT (slug) DO NOTHING;

-- Get parent category IDs for subcategories
WITH parent_categories AS (
  SELECT id, slug FROM public.categories WHERE parent_id IS NULL
)
INSERT INTO public.categories (name, description, slug, parent_id) VALUES
-- Apparel & Accessories subcategories
('Clothing', 'Shirts, pants, dresses, and other clothing items', 'clothing', (SELECT id FROM parent_categories WHERE slug = 'apparel-accessories')),
('Footwear', 'Shoes, boots, sneakers, and sandals', 'footwear', (SELECT id FROM parent_categories WHERE slug = 'apparel-accessories')),
('Fashion Accessories', 'Belts, scarves, hats, and fashion accessories', 'fashion-accessories', (SELECT id FROM parent_categories WHERE slug = 'apparel-accessories')),
('Jewelry & Watches', 'Rings, necklaces, bracelets, and timepieces', 'jewelry-watches', (SELECT id FROM parent_categories WHERE slug = 'apparel-accessories')),
('Bags & Luggage', 'Handbags, backpacks, suitcases, and travel bags', 'bags-luggage', (SELECT id FROM parent_categories WHERE slug = 'apparel-accessories')),

-- Beauty & Personal Care subcategories
('Skincare', 'Cleansers, moisturizers, serums, and skincare products', 'skincare', (SELECT id FROM parent_categories WHERE slug = 'beauty-personal-care')),
('Haircare', 'Shampoos, conditioners, styling products, and hair treatments', 'haircare', (SELECT id FROM parent_categories WHERE slug = 'beauty-personal-care')),
('Makeup & Cosmetics', 'Foundation, lipstick, eyeshadow, and cosmetic products', 'makeup-cosmetics', (SELECT id FROM parent_categories WHERE slug = 'beauty-personal-care')),
('Fragrances', 'Perfumes, colognes, and scented products', 'fragrances', (SELECT id FROM parent_categories WHERE slug = 'beauty-personal-care')),
('Personal Hygiene', 'Toothpaste, deodorants, and personal care essentials', 'personal-hygiene', (SELECT id FROM parent_categories WHERE slug = 'beauty-personal-care')),

-- Food, Beverages & Dining subcategories
('Food Items', 'Groceries, snacks, and packaged food products', 'food-items', (SELECT id FROM parent_categories WHERE slug = 'food-beverages-dining')),
('Beverages', 'Non-alcoholic drinks, juices, and beverages', 'beverages', (SELECT id FROM parent_categories WHERE slug = 'food-beverages-dining')),
('Alcoholic Beverages', 'Wine, beer, spirits, and alcoholic drinks', 'alcoholic-beverages', (SELECT id FROM parent_categories WHERE slug = 'food-beverages-dining')),
('Restaurants & Cafés', 'Dining establishments, cafes, and food venues', 'restaurants-cafes', (SELECT id FROM parent_categories WHERE slug = 'food-beverages-dining')),
('Desserts & Snacks', 'Sweets, chocolates, and snack foods', 'desserts-snacks', (SELECT id FROM parent_categories WHERE slug = 'food-beverages-dining')),

-- Electronics & Gadgets subcategories
('Mobile Phones', 'Smartphones, tablets, and mobile devices', 'mobile-phones', (SELECT id FROM parent_categories WHERE slug = 'electronics-gadgets')),
('Laptops & Tablets', 'Computers, laptops, and tablet devices', 'laptops-tablets', (SELECT id FROM parent_categories WHERE slug = 'electronics-gadgets')),
('Audio & Video', 'Headphones, speakers, and audio-visual equipment', 'audio-video', (SELECT id FROM parent_categories WHERE slug = 'electronics-gadgets')),
('Cameras & Optics', 'Digital cameras, lenses, and photography equipment', 'cameras-optics', (SELECT id FROM parent_categories WHERE slug = 'electronics-gadgets')),
('Smart Devices', 'Smart home devices, IoT products, and connected gadgets', 'smart-devices', (SELECT id FROM parent_categories WHERE slug = 'electronics-gadgets')),
('Gaming Consoles', 'PlayStation, Xbox, Nintendo, and gaming hardware', 'gaming-consoles', (SELECT id FROM parent_categories WHERE slug = 'electronics-gadgets')),

-- Arts, Media & Entertainment subcategories
('Movies', 'Films, documentaries, and cinema content', 'movies', (SELECT id FROM parent_categories WHERE slug = 'arts-media-entertainment')),
('TV Shows', 'Television series, shows, and streaming content', 'tv-shows', (SELECT id FROM parent_categories WHERE slug = 'arts-media-entertainment')),
('Books & Literature', 'Novels, non-fiction, educational books, and literature', 'books-literature', (SELECT id FROM parent_categories WHERE slug = 'arts-media-entertainment')),
('Music & Albums', 'Songs, albums, artists, and musical content', 'music-albums', (SELECT id FROM parent_categories WHERE slug = 'arts-media-entertainment')),
('Podcasts', 'Audio shows, interviews, and podcast content', 'podcasts', (SELECT id FROM parent_categories WHERE slug = 'arts-media-entertainment')),
('Art & Crafts', 'Artwork, craft supplies, and creative materials', 'art-crafts', (SELECT id FROM parent_categories WHERE slug = 'arts-media-entertainment')),
('Events & Experiences', 'Concerts, exhibitions, and entertainment events', 'events-experiences', (SELECT id FROM parent_categories WHERE slug = 'arts-media-entertainment')),

-- Health & Wellness subcategories
('Supplements', 'Vitamins, protein powders, and health supplements', 'supplements', (SELECT id FROM parent_categories WHERE slug = 'health-wellness')),
('Fitness Equipment', 'Exercise machines, weights, and workout gear', 'fitness-equipment', (SELECT id FROM parent_categories WHERE slug = 'health-wellness')),
('Mental Health Tools', 'Meditation apps, therapy tools, and mental wellness', 'mental-health-tools', (SELECT id FROM parent_categories WHERE slug = 'health-wellness')),
('Sleep Aids', 'Pillows, mattresses, and sleep improvement products', 'sleep-aids', (SELECT id FROM parent_categories WHERE slug = 'health-wellness')),
('Hygiene & Sanitation', 'Hand sanitizers, cleaning products, and hygiene items', 'hygiene-sanitation', (SELECT id FROM parent_categories WHERE slug = 'health-wellness')),

-- Home & Living subcategories
('Furniture', 'Chairs, tables, beds, and home furniture', 'furniture', (SELECT id FROM parent_categories WHERE slug = 'home-living')),
('Home Decor', 'Wall art, decorative items, and home accessories', 'home-decor', (SELECT id FROM parent_categories WHERE slug = 'home-living')),
('Kitchenware', 'Cookware, utensils, and kitchen appliances', 'kitchenware', (SELECT id FROM parent_categories WHERE slug = 'home-living')),
('Storage & Organization', 'Storage boxes, organizers, and home organization', 'storage-organization', (SELECT id FROM parent_categories WHERE slug = 'home-living')),
('Cleaning Supplies', 'Detergents, cleaners, and household cleaning products', 'cleaning-supplies', (SELECT id FROM parent_categories WHERE slug = 'home-living')),

-- Sports & Recreation subcategories
('Fitness & Exercise', 'Gym equipment, workout gear, and fitness accessories', 'fitness-exercise', (SELECT id FROM parent_categories WHERE slug = 'sports-recreation')),
('Team Sports', 'Soccer, basketball, football, and team sport equipment', 'team-sports', (SELECT id FROM parent_categories WHERE slug = 'sports-recreation')),
('Outdoor Activities', 'Hiking, camping, and outdoor recreation gear', 'outdoor-activities', (SELECT id FROM parent_categories WHERE slug = 'sports-recreation')),
('Water Sports', 'Swimming, surfing, and aquatic sports equipment', 'water-sports', (SELECT id FROM parent_categories WHERE slug = 'sports-recreation')),
('Yoga & Meditation', 'Yoga mats, meditation cushions, and mindfulness tools', 'yoga-meditation', (SELECT id FROM parent_categories WHERE slug = 'sports-recreation')),

-- Places subcategories
('Cities & Destinations', 'Travel destinations, cities, and tourist locations', 'cities-destinations', (SELECT id FROM parent_categories WHERE slug = 'places')),
('Tourist Attractions', 'Museums, landmarks, and points of interest', 'tourist-attractions', (SELECT id FROM parent_categories WHERE slug = 'places')),
('Hotels & Stays', 'Hotels, hostels, and accommodation options', 'hotels-stays', (SELECT id FROM parent_categories WHERE slug = 'places')),
('Cafés & Hangouts', 'Coffee shops, casual dining, and social venues', 'cafes-hangouts', (SELECT id FROM parent_categories WHERE slug = 'places')),
('Local Services', 'Salons, clinics, repair shops, and local businesses', 'local-services', (SELECT id FROM parent_categories WHERE slug = 'places')),

-- Apps & Software subcategories
('Productivity Tools', 'Task managers, note-taking apps, and productivity software', 'productivity-tools', (SELECT id FROM parent_categories WHERE slug = 'apps-software')),
('Social Apps', 'Social media, messaging, and communication apps', 'social-apps', (SELECT id FROM parent_categories WHERE slug = 'apps-software')),
('Health & Fitness Apps', 'Workout apps, health trackers, and wellness software', 'health-fitness-apps', (SELECT id FROM parent_categories WHERE slug = 'apps-software')),
('Design & Creativity Tools', 'Photo editors, design software, and creative apps', 'design-creativity-tools', (SELECT id FROM parent_categories WHERE slug = 'apps-software')),
('Finance & Budgeting Apps', 'Banking apps, budgeting tools, and financial software', 'finance-budgeting-apps', (SELECT id FROM parent_categories WHERE slug = 'apps-software')),

-- Courses & Education subcategories
('Programming', 'Coding courses, software development, and tech education', 'programming', (SELECT id FROM parent_categories WHERE slug = 'courses-education')),
('Marketing & Business', 'Business courses, marketing training, and entrepreneurship', 'marketing-business', (SELECT id FROM parent_categories WHERE slug = 'courses-education')),
('Productivity & Lifestyle', 'Life skills, productivity training, and lifestyle courses', 'productivity-lifestyle', (SELECT id FROM parent_categories WHERE slug = 'courses-education')),
('Design & Creativity', 'Art courses, design training, and creative education', 'design-creativity', (SELECT id FROM parent_categories WHERE slug = 'courses-education')),
('Personal Growth', 'Self-improvement, mindfulness, and personal development', 'personal-growth', (SELECT id FROM parent_categories WHERE slug = 'courses-education')),
('Language Learning', 'Foreign language courses and language education', 'language-learning', (SELECT id FROM parent_categories WHERE slug = 'courses-education')),
('Fitness & Wellness', 'Yoga courses, fitness training, and wellness education', 'fitness-wellness', (SELECT id FROM parent_categories WHERE slug = 'courses-education')),

-- Games subcategories
('PC Games', 'Computer games, Steam games, and PC gaming', 'pc-games', (SELECT id FROM parent_categories WHERE slug = 'games')),
('Console Games', 'PlayStation, Xbox, Nintendo, and console gaming', 'console-games', (SELECT id FROM parent_categories WHERE slug = 'games')),
('Mobile Games', 'Smartphone games, tablet games, and mobile gaming', 'mobile-games', (SELECT id FROM parent_categories WHERE slug = 'games')),
('Board Games', 'Traditional games, card games, and tabletop gaming', 'board-games', (SELECT id FROM parent_categories WHERE slug = 'games')),
('Party Games', 'Group games, social games, and party entertainment', 'party-games', (SELECT id FROM parent_categories WHERE slug = 'games')),

-- Travel & Transportation subcategories
('Airlines', 'Flight services, airlines, and air travel', 'airlines', (SELECT id FROM parent_categories WHERE slug = 'travel-transportation')),
('Trains & Buses', 'Railway services, bus services, and ground transportation', 'trains-buses', (SELECT id FROM parent_categories WHERE slug = 'travel-transportation')),
('Travel Accessories', 'Luggage, travel gear, and travel essentials', 'travel-accessories', (SELECT id FROM parent_categories WHERE slug = 'travel-transportation')),
('Travel Apps', 'Booking apps, navigation tools, and travel software', 'travel-apps', (SELECT id FROM parent_categories WHERE slug = 'travel-transportation')),
('Travel Experiences', 'Tours, travel packages, and experiential travel', 'travel-experiences', (SELECT id FROM parent_categories WHERE slug = 'travel-transportation'))
ON CONFLICT (slug) DO NOTHING;

-- 4. Create category utility functions
CREATE OR REPLACE FUNCTION public.get_category_hierarchy()
RETURNS TABLE(
  id uuid,
  name text,
  description text,
  slug text,
  parent_id uuid,
  parent_name text,
  subcategories jsonb
) LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  RETURN QUERY
  WITH RECURSIVE category_tree AS (
    -- Get main categories
    SELECT 
      c.id,
      c.name,
      c.description,
      c.slug,
      c.parent_id,
      CAST(NULL AS text) as parent_name,
      0 as level
    FROM public.categories c
    WHERE c.parent_id IS NULL
    
    UNION ALL
    
    -- Get subcategories
    SELECT 
      c.id,
      c.name,
      c.description,
      c.slug,
      c.parent_id,
      p.name as parent_name,
      ct.level + 1
    FROM public.categories c
    JOIN category_tree ct ON c.parent_id = ct.id
    JOIN public.categories p ON c.parent_id = p.id
  ),
  main_with_subs AS (
    SELECT 
      main.id,
      main.name,
      main.description,
      main.slug,
      main.parent_id,
      main.parent_name,
      COALESCE(
        jsonb_agg(
          jsonb_build_object(
            'id', sub.id,
            'name', sub.name,
            'slug', sub.slug,
            'description', sub.description
          ) ORDER BY sub.name
        ) FILTER (WHERE sub.id IS NOT NULL),
        '[]'::jsonb
      ) as subcategories
    FROM category_tree main
    LEFT JOIN category_tree sub ON sub.parent_id = main.id
    WHERE main.level = 0
    GROUP BY main.id, main.name, main.description, main.slug, main.parent_id, main.parent_name
  )
  SELECT * FROM main_with_subs ORDER BY name;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_categories_by_parent(parent_uuid uuid DEFAULT NULL)
RETURNS TABLE(
  id uuid,
  name text,
  description text,
  slug text,
  parent_id uuid
) LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  RETURN QUERY
  SELECT 
    c.id,
    c.name,
    c.description,
    c.slug,
    c.parent_id
  FROM public.categories c
  WHERE c.parent_id = parent_uuid OR (parent_uuid IS NULL AND c.parent_id IS NULL)
  ORDER BY c.name;
END;
$$;

CREATE OR REPLACE FUNCTION public.search_categories(search_query text)
RETURNS TABLE(
  id uuid,
  name text,
  description text,
  slug text,
  parent_id uuid,
  parent_name text,
  match_type text
) LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  RETURN QUERY
  SELECT 
    c.id,
    c.name,
    c.description,
    c.slug,
    c.parent_id,
    p.name as parent_name,
    CASE 
      WHEN LOWER(c.name) LIKE LOWER(search_query || '%') THEN 'prefix'
      WHEN LOWER(c.name) LIKE LOWER('%' || search_query || '%') THEN 'contains'
      ELSE 'description'
    END as match_type
  FROM public.categories c
  LEFT JOIN public.categories p ON c.parent_id = p.id
  WHERE 
    LOWER(c.name) LIKE LOWER('%' || search_query || '%') OR
    LOWER(c.description) LIKE LOWER('%' || search_query || '%')
  ORDER BY 
    CASE 
      WHEN LOWER(c.name) LIKE LOWER(search_query || '%') THEN 1
      WHEN LOWER(c.name) LIKE LOWER('%' || search_query || '%') THEN 2
      ELSE 3
    END,
    c.name;
END;
$$;

-- 5. Update RLS policies for friction-free user experience
-- Update entities policies to allow user creation and immediate access
DROP POLICY IF EXISTS "Users can update their own non-deleted entities" ON public.entities;
DROP POLICY IF EXISTS "Authenticated users can insert entities" ON public.entities;

-- Allow users to create entities (immediately accessible)
CREATE POLICY "Users can create entities" ON public.entities
FOR INSERT 
WITH CHECK (auth.uid() IS NOT NULL);

-- Allow users to view all approved entities + their own entities regardless of status
CREATE POLICY "Users can view approved entities and their own" ON public.entities
FOR SELECT 
USING (
  (approval_status = 'approved' AND is_deleted = false) OR 
  (created_by = auth.uid() AND is_deleted = false)
);

-- Allow users to update their own entities (but not approval status)
CREATE POLICY "Users can update their own entities" ON public.entities
FOR UPDATE 
USING (created_by = auth.uid() AND is_deleted = false)
WITH CHECK (created_by = auth.uid() AND is_deleted = false);

-- Admin policies remain the same but add approval status management
CREATE POLICY "Admins can manage all entities" ON public.entities
FOR ALL
USING (is_admin_user((auth.jwt() ->> 'email'::text)))
WITH CHECK (is_admin_user((auth.jwt() ->> 'email'::text)));

-- 6. Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_entities_user_created ON public.entities(user_created);
CREATE INDEX IF NOT EXISTS idx_entities_approval_status ON public.entities(approval_status);
CREATE INDEX IF NOT EXISTS idx_entities_created_by ON public.entities(created_by);
CREATE INDEX IF NOT EXISTS idx_entities_type_approval ON public.entities(type, approval_status);
CREATE INDEX IF NOT EXISTS idx_categories_parent_id ON public.categories(parent_id);
CREATE INDEX IF NOT EXISTS idx_categories_slug ON public.categories(slug);

-- 7. Set default category for uncategorized entities
UPDATE public.entities 
SET category_id = (SELECT id FROM public.categories WHERE slug = 'uncategorized' LIMIT 1)
WHERE category_id IS NULL;

COMMENT ON COLUMN public.entities.user_created IS 'Flag indicating if entity was created by a user (true) or admin/API (false)';
COMMENT ON COLUMN public.entities.approval_status IS 'Moderation status: pending, approved, rejected';
COMMENT ON COLUMN public.entities.reviewed_by IS 'Admin user ID who reviewed this entity';
COMMENT ON COLUMN public.entities.reviewed_at IS 'Timestamp when entity was reviewed by admin';