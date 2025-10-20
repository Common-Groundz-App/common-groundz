// Simplified entity config for edge function use
// This is a subset of the full config needed for AI prompt generation

export type FieldType = 'text' | 'number' | 'textarea' | 'tags' | 'select' | 'multi-select' | 'url' | 'email' | 'phone';

export interface EntityFieldConfig {
  key: string;
  label: string;
  type: FieldType;
  storageColumn?: string;
  options?: string[];
  required?: boolean;
}

export interface EntityTypeConfig {
  fields: EntityFieldConfig[];
}

// Simplified entity type configurations for AI extraction
export const entityTypeConfig: Record<string, EntityTypeConfig> = {
  book: {
    fields: [
      { key: 'authors', label: 'Authors', type: 'tags', required: true },
      { key: 'isbn', label: 'ISBN', type: 'text' },
      { key: 'publication_year', label: 'Publication Year', type: 'number', required: true },
      { key: 'languages', label: 'Languages', type: 'tags' },
      { key: 'publisher', label: 'Publisher', type: 'text' },
      { key: 'page_count', label: 'Page Count', type: 'number' },
      { key: 'format', label: 'Format', type: 'select', options: ['Hardcover', 'Paperback', 'eBook', 'Audiobook'] },
    ]
  },
  movie: {
    fields: [
      { key: 'release_year', label: 'Release Year', type: 'number', required: true },
      { key: 'director', label: 'Director', type: 'text' },
      { key: 'cast', label: 'Cast', type: 'tags' },
      { key: 'runtime', label: 'Runtime', type: 'text' },
      { key: 'genres', label: 'Genres', type: 'tags' },
      { key: 'content_rating', label: 'Content Rating', type: 'select', options: ['G', 'PG', 'PG-13', 'R', 'NC-17', 'Not Rated'] },
      { key: 'imdb_id', label: 'IMDb ID', type: 'text' },
    ]
  },
  tv_show: {
    fields: [
      { key: 'release_year', label: 'Release Year', type: 'number', required: true },
      { key: 'network', label: 'Network/Platform', type: 'text' },
      { key: 'seasons', label: 'Number of Seasons', type: 'number' },
      { key: 'episodes', label: 'Total Episodes', type: 'number' },
      { key: 'cast', label: 'Cast', type: 'tags' },
      { key: 'genres', label: 'Genres', type: 'tags' },
      { key: 'content_rating', label: 'Content Rating', type: 'select', options: ['TV-Y', 'TV-Y7', 'TV-G', 'TV-PG', 'TV-14', 'TV-MA'] },
      { key: 'status', label: 'Status', type: 'select', options: ['Ongoing', 'Ended', 'Cancelled', 'Upcoming'] },
    ]
  },
  place: {
    fields: [
      { key: 'location_type', label: 'Location Type', type: 'select', options: ['Indoor', 'Outdoor', 'Mixed'] },
      { key: 'accessibility', label: 'Accessibility Features', type: 'multi-select', options: ['Wheelchair Accessible', 'Pet Friendly', 'Parking Available', 'Public Transit'] },
      { key: 'price_range', label: 'Price Range', type: 'select', options: ['$', '$$', '$$$', '$$$$'] },
      { key: 'atmosphere', label: 'Atmosphere', type: 'multi-select', options: ['Casual', 'Formal', 'Family-Friendly', 'Romantic', 'Lively', 'Quiet'] },
    ]
  },
  food: {
    fields: [
      { key: 'cuisines', label: 'Cuisines', type: 'tags' },
      { key: 'dietary_tags', label: 'Dietary Options', type: 'multi-select', options: ['Vegetarian', 'Vegan', 'Gluten-Free', 'Halal', 'Kosher', 'Dairy-Free', 'Nut-Free'] },
      { key: 'ingredients', label: 'Key Ingredients', type: 'tags' },
      { key: 'price_range', label: 'Price Range', type: 'select', options: ['$', '$$', '$$$', '$$$$'] },
      { key: 'meal_type', label: 'Meal Type', type: 'multi-select', options: ['Breakfast', 'Brunch', 'Lunch', 'Dinner', 'Snack', 'Dessert'] },
    ]
  },
  product: {
    fields: [
      { key: 'brand', label: 'Brand', type: 'text' },
      { key: 'price', label: 'Price', type: 'text' },
      { key: 'currency', label: 'Currency', type: 'select', options: ['USD', 'EUR', 'GBP', 'CAD', 'AUD'] },
      { key: 'characteristics', label: 'Product Characteristics', type: 'multi-select', options: ['Cruelty-Free', 'Vegan', 'Organic', 'Hypoallergenic', 'Eco-Friendly', 'Sustainable'] },
      { key: 'color', label: 'Color/Variant', type: 'text' },
      { key: 'size', label: 'Size', type: 'text' },
      { key: 'material', label: 'Material', type: 'text' },
    ]
  },
  app: {
    fields: [
      { key: 'platform', label: 'Platform', type: 'multi-select', required: true, options: ['iOS', 'Android', 'Web', 'Windows', 'macOS', 'Linux'] },
      { key: 'developer', label: 'Developer', type: 'text' },
      { key: 'version', label: 'Version', type: 'text' },
      { key: 'app_store_link', label: 'App Store Link', type: 'url' },
      { key: 'play_store_link', label: 'Google Play Link', type: 'url' },
      { key: 'pricing_model', label: 'Pricing Model', type: 'select', options: ['Free', 'Paid', 'Freemium', 'Subscription'] },
      { key: 'size', label: 'App Size', type: 'text' },
    ]
  },
  game: {
    fields: [
      { key: 'platform', label: 'Platform', type: 'multi-select', required: true, options: ['PC', 'PlayStation', 'Xbox', 'Nintendo Switch', 'Mobile', 'VR'] },
      { key: 'genre', label: 'Genre', type: 'tags' },
      { key: 'developer', label: 'Developer', type: 'text' },
      { key: 'publisher', label: 'Publisher', type: 'text' },
      { key: 'release_year', label: 'Release Year', type: 'number' },
      { key: 'esrb_rating', label: 'ESRB Rating', type: 'select', options: ['E', 'E10+', 'T', 'M', 'AO', 'RP'] },
      { key: 'multiplayer', label: 'Multiplayer', type: 'select', options: ['Single-player', 'Multiplayer', 'Co-op', 'Both'] },
    ]
  },
  course: {
    fields: [
      { key: 'instructor', label: 'Instructor', type: 'text', required: true },
      { key: 'platform', label: 'Platform', type: 'select', options: ['Coursera', 'Udemy', 'edX', 'LinkedIn Learning', 'Skillshare', 'Pluralsight', 'Other'] },
      { key: 'duration', label: 'Duration', type: 'text' },
      { key: 'language', label: 'Language', type: 'text' },
      { key: 'level', label: 'Level', type: 'select', required: true, options: ['Beginner', 'Intermediate', 'Advanced', 'All Levels'] },
      { key: 'certificate', label: 'Certificate Available', type: 'select', options: ['Yes', 'No', 'Paid'] },
      { key: 'pricing', label: 'Pricing', type: 'select', options: ['Free', 'Paid', 'Subscription', 'Audit Available'] },
    ]
  },
  experience: {
    fields: [
      { key: 'duration', label: 'Duration', type: 'text' },
      { key: 'location_type', label: 'Location Type', type: 'select', options: ['Indoor', 'Outdoor', 'Mixed'] },
      { key: 'group_size', label: 'Group Size', type: 'text' },
      { key: 'price_range', label: 'Price Range', type: 'select', options: ['$', '$$', '$$$', '$$$$'] },
      { key: 'accessibility', label: 'Accessibility', type: 'multi-select', options: ['Wheelchair Accessible', 'All Ages', 'Age Restrictions', 'Physical Fitness Required'] },
      { key: 'whats_included', label: "What's Included", type: 'tags' },
    ]
  },
  brand: {
    fields: [
      { key: 'industry', label: 'Industry', type: 'select', required: true, options: ['Fashion', 'Technology', 'Food & Beverage', 'Beauty', 'Automotive', 'Entertainment', 'Health & Wellness', 'Finance', 'Retail', 'Sports', 'Media', 'Education', 'Travel', 'Other'] },
      { key: 'founded_year', label: 'Founded Year', type: 'number' },
      { key: 'headquarters', label: 'Headquarters', type: 'text' },
      { key: 'brand_values', label: 'Brand Values', type: 'multi-select', options: ['Sustainable', 'Eco-Friendly', 'Ethical', 'Innovative', 'Luxury', 'Affordable', 'Inclusive', 'Local', 'Artisan', 'Family-Owned'] },
      { key: 'product_categories', label: 'Product Categories', type: 'tags' },
      { key: 'parent_company', label: 'Parent Company', type: 'text' },
      { key: 'tagline', label: 'Tagline', type: 'text' },
    ]
  },
  event: {
    fields: [
      { key: 'event_type', label: 'Event Type', type: 'select', required: true, options: ['Conference', 'Concert', 'Festival', 'Workshop', 'Sports', 'Exhibition', 'Networking', 'Webinar', 'Meetup', 'Competition', 'Other'] },
      { key: 'start_date', label: 'Start Date', type: 'text', required: true },
      { key: 'end_date', label: 'End Date', type: 'text' },
      { key: 'venue', label: 'Venue', type: 'text' },
      { key: 'organizer', label: 'Organizer', type: 'text' },
      { key: 'ticket_price', label: 'Ticket Price Range', type: 'select', options: ['Free', '$', '$$', '$$$', '$$$$'] },
      { key: 'format', label: 'Event Format', type: 'select', options: ['In-Person', 'Virtual', 'Hybrid'] },
      { key: 'capacity', label: 'Capacity', type: 'text' },
      { key: 'age_restriction', label: 'Age Restriction', type: 'select', options: ['All Ages', '18+', '21+', 'Kids Only', 'Family-Friendly'] },
    ]
  },
  service: {
    fields: [
      { key: 'service_category', label: 'Service Category', type: 'select', required: true, options: ['Home Services', 'Professional Services', 'Creative Services', 'Health & Wellness', 'Education', 'Technology', 'Transportation', 'Financial', 'Legal', 'Marketing', 'Consulting', 'Other'] },
      { key: 'provider_name', label: 'Provider/Company Name', type: 'text' },
      { key: 'service_areas', label: 'Service Areas', type: 'tags' },
      { key: 'pricing_model', label: 'Pricing Model', type: 'select', options: ['Hourly Rate', 'Fixed Price', 'Subscription', 'Quote-Based', 'Free Consultation', 'Package Deals'] },
      { key: 'years_in_business', label: 'Years in Business', type: 'number' },
      { key: 'certifications', label: 'Certifications', type: 'tags' },
      { key: 'insurance', label: 'Insurance', type: 'select', options: ['Licensed & Insured', 'Licensed', 'Bonded', 'N/A'] },
    ]
  },
  professional: {
    fields: [
      { key: 'profession', label: 'Profession', type: 'text', required: true },
      { key: 'specialty', label: 'Specialty/Focus', type: 'text' },
      { key: 'years_experience', label: 'Years of Experience', type: 'number' },
      { key: 'education', label: 'Education', type: 'tags' },
      { key: 'certifications', label: 'Certifications', type: 'tags' },
      { key: 'languages_spoken', label: 'Languages Spoken', type: 'tags' },
      { key: 'consultation_fee', label: 'Consultation Fee', type: 'text' },
      { key: 'availability', label: 'Availability', type: 'text' },
    ]
  }
};
