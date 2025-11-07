export type FieldType = 'text' | 'number' | 'textarea' | 'tags' | 'select' | 'multi-select' | 'url' | 'email' | 'phone';

export interface EntityFieldConfig {
  key: string;
  label: string;
  type: FieldType;
  storageColumn?: 'metadata' | 'authors' | 'isbn' | 'publication_year' | 'cast_crew' | 'ingredients' | 'nutritional_info' | 'specifications' | 'price_info' | 'languages' | 'external_ratings';
  options?: string[];
  placeholder?: string;
  required?: boolean;
  helpText?: string;
}

export interface EntityTypeConfig {
  showTabs: ('basic' | 'contact' | 'hours' | 'details')[];
  hideTabs: ('basic' | 'contact' | 'hours' | 'details')[];
  requiredFields: string[];
  fields: EntityFieldConfig[];
  fieldGroups?: {
    title: string;
    icon?: string;
    fields: string[]; // Field keys that belong to this group
  }[];
}

export const entityTypeConfig: Record<string, EntityTypeConfig> = {
  book: {
    showTabs: ['basic', 'details'],
    hideTabs: ['contact', 'hours'],
    requiredFields: ['authors', 'publication_year'],
    fields: [
      { key: 'authors', label: 'Authors', type: 'tags', storageColumn: 'authors', required: true, placeholder: 'Add author names' },
      { key: 'isbn', label: 'ISBN', type: 'text', storageColumn: 'isbn', placeholder: 'ISBN-10 or ISBN-13' },
      { key: 'publication_year', label: 'Publication Year', type: 'number', storageColumn: 'publication_year', required: true },
      { key: 'languages', label: 'Languages', type: 'tags', storageColumn: 'languages', placeholder: 'Add languages' },
      { key: 'publisher', label: 'Publisher', type: 'text', storageColumn: 'metadata', placeholder: 'Publisher name' },
      { key: 'page_count', label: 'Page Count', type: 'number', storageColumn: 'metadata' },
      { key: 'format', label: 'Format', type: 'select', storageColumn: 'metadata', options: ['Hardcover', 'Paperback', 'eBook', 'Audiobook'] },
    ],
    fieldGroups: [
      { title: '📚 Book Details', icon: '📚', fields: ['authors', 'isbn', 'publication_year', 'languages'] },
      { title: '📖 Publishing Info', icon: '📖', fields: ['publisher', 'page_count', 'format'] },
    ]
  },

  movie: {
    showTabs: ['basic', 'details'],
    hideTabs: ['contact', 'hours'],
    requiredFields: ['release_year'],
    fields: [
      { key: 'release_year', label: 'Release Year', type: 'number', storageColumn: 'publication_year', required: true },
      { key: 'director', label: 'Director', type: 'text', storageColumn: 'cast_crew', placeholder: 'Director name' },
      { key: 'cast', label: 'Cast', type: 'tags', storageColumn: 'cast_crew', placeholder: 'Add cast members' },
      { key: 'runtime', label: 'Runtime', type: 'text', storageColumn: 'cast_crew', placeholder: 'e.g., 120 minutes' },
      { key: 'genres', label: 'Genres', type: 'tags', storageColumn: 'metadata', placeholder: 'Add genres' },
      { key: 'content_rating', label: 'Content Rating', type: 'select', storageColumn: 'metadata', options: ['G', 'PG', 'PG-13', 'R', 'NC-17', 'Not Rated'] },
      { key: 'imdb_id', label: 'IMDb ID', type: 'text', storageColumn: 'metadata', placeholder: 'tt1234567' },
    ],
    fieldGroups: [
      { title: '🎬 Cast & Crew', icon: '🎬', fields: ['director', 'cast', 'runtime'] },
      { title: '📊 Movie Details', icon: '📊', fields: ['release_year', 'genres', 'content_rating', 'imdb_id'] },
    ]
  },

  tv_show: {
    showTabs: ['basic', 'details'],
    hideTabs: ['contact', 'hours'],
    requiredFields: ['release_year'],
    fields: [
      { key: 'release_year', label: 'Release Year', type: 'number', storageColumn: 'publication_year', required: true },
      { key: 'network', label: 'Network/Platform', type: 'text', storageColumn: 'cast_crew', placeholder: 'e.g., Netflix, HBO' },
      { key: 'seasons', label: 'Number of Seasons', type: 'number', storageColumn: 'cast_crew' },
      { key: 'episodes', label: 'Total Episodes', type: 'number', storageColumn: 'cast_crew' },
      { key: 'cast', label: 'Cast', type: 'tags', storageColumn: 'cast_crew', placeholder: 'Add cast members' },
      { key: 'genres', label: 'Genres', type: 'tags', storageColumn: 'metadata', placeholder: 'Add genres' },
      { key: 'content_rating', label: 'Content Rating', type: 'select', storageColumn: 'metadata', options: ['TV-Y', 'TV-Y7', 'TV-G', 'TV-PG', 'TV-14', 'TV-MA'] },
      { key: 'status', label: 'Status', type: 'select', storageColumn: 'metadata', options: ['Ongoing', 'Ended', 'Cancelled', 'Upcoming'] },
    ],
    fieldGroups: [
      { title: '📺 Show Details', icon: '📺', fields: ['release_year', 'network', 'seasons', 'episodes', 'status'] },
      { title: '🎭 Cast & Info', icon: '🎭', fields: ['cast', 'genres', 'content_rating'] },
    ]
  },

  place: {
    showTabs: ['basic', 'contact', 'hours', 'details'],
    hideTabs: [],
    requiredFields: [],
    fields: [
      { key: 'location_type', label: 'Location Type', type: 'select', storageColumn: 'metadata', options: ['Indoor', 'Outdoor', 'Mixed'] },
      { key: 'accessibility', label: 'Accessibility Features', type: 'multi-select', storageColumn: 'metadata', options: ['Wheelchair Accessible', 'Pet Friendly', 'Parking Available', 'Public Transit'] },
      { key: 'price_range', label: 'Price Range', type: 'select', storageColumn: 'metadata', options: ['$', '$$', '$$$', '$$$$'] },
      { key: 'atmosphere', label: 'Atmosphere', type: 'multi-select', storageColumn: 'metadata', options: ['Casual', 'Formal', 'Family-Friendly', 'Romantic', 'Lively', 'Quiet'] },
    ],
    fieldGroups: [
      { title: '📍 Place Details', icon: '📍', fields: ['location_type', 'price_range', 'atmosphere'] },
      { title: '♿ Accessibility', icon: '♿', fields: ['accessibility'] },
    ]
  },

  food: {
    showTabs: ['basic', 'contact', 'hours', 'details'],
    hideTabs: [],
    requiredFields: [],
    fields: [
      { key: 'cuisines', label: 'Cuisines', type: 'tags', storageColumn: 'metadata', placeholder: 'e.g., Italian, Mexican' },
      { key: 'dietary_tags', label: 'Dietary Options', type: 'multi-select', storageColumn: 'metadata', options: ['Vegetarian', 'Vegan', 'Gluten-Free', 'Halal', 'Kosher', 'Dairy-Free', 'Nut-Free'] },
      { key: 'ingredients', label: 'Key Ingredients', type: 'tags', storageColumn: 'ingredients', placeholder: 'Add ingredients' },
      { key: 'price_range', label: 'Price Range', type: 'select', storageColumn: 'metadata', options: ['$', '$$', '$$$', '$$$$'] },
      { key: 'meal_type', label: 'Meal Type', type: 'multi-select', storageColumn: 'metadata', options: ['Breakfast', 'Brunch', 'Lunch', 'Dinner', 'Snack', 'Dessert'] },
    ],
    fieldGroups: [
      { title: '🍽️ Food Details', icon: '🍽️', fields: ['cuisines', 'meal_type', 'price_range'] },
      { title: '🥗 Dietary Info', icon: '🥗', fields: ['dietary_tags', 'ingredients'] },
    ]
  },

  product: {
    showTabs: ['basic', 'details'],
    hideTabs: ['contact', 'hours'],
    requiredFields: [],
    fields: [
      { key: 'brand', label: 'Brand', type: 'text', storageColumn: 'metadata', placeholder: 'Brand name' },
      { key: 'price', label: 'Price', type: 'text', storageColumn: 'price_info', placeholder: 'e.g., $29.99' },
      { key: 'currency', label: 'Currency', type: 'select', storageColumn: 'price_info', options: ['USD', 'EUR', 'GBP', 'CAD', 'AUD'] },
      { key: 'characteristics', label: 'Product Characteristics', type: 'multi-select', storageColumn: 'metadata', options: ['Cruelty-Free', 'Vegan', 'Organic', 'Hypoallergenic', 'Eco-Friendly', 'Sustainable'] },
      { key: 'color', label: 'Color/Variant', type: 'text', storageColumn: 'specifications', placeholder: 'e.g., Blue' },
      { key: 'size', label: 'Size', type: 'text', storageColumn: 'specifications', placeholder: 'e.g., Medium' },
      { key: 'material', label: 'Material', type: 'text', storageColumn: 'specifications', placeholder: 'e.g., Cotton' },
    ],
    fieldGroups: [
      { title: '🏷️ Product Info', icon: '🏷️', fields: ['brand', 'price', 'currency', 'characteristics'] },
      { title: '📏 Specifications', icon: '📏', fields: ['color', 'size', 'material'] },
    ]
  },

  app: {
    showTabs: ['basic', 'details'],
    hideTabs: ['contact', 'hours'],
    requiredFields: ['platform'],
    fields: [
      { key: 'platform', label: 'Platform', type: 'multi-select', storageColumn: 'specifications', required: true, options: ['iOS', 'Android', 'Web', 'Windows', 'macOS', 'Linux'] },
      { key: 'developer', label: 'Developer', type: 'text', storageColumn: 'metadata', placeholder: 'Developer name' },
      { key: 'version', label: 'Version', type: 'text', storageColumn: 'specifications', placeholder: 'e.g., 2.0.1' },
      { key: 'app_store_link', label: 'App Store Link', type: 'url', storageColumn: 'metadata', placeholder: 'iOS App Store URL' },
      { key: 'play_store_link', label: 'Google Play Link', type: 'url', storageColumn: 'metadata', placeholder: 'Google Play URL' },
      { key: 'pricing_model', label: 'Pricing Model', type: 'select', storageColumn: 'price_info', options: ['Free', 'Paid', 'Freemium', 'Subscription'] },
      { key: 'size', label: 'App Size', type: 'text', storageColumn: 'specifications', placeholder: 'e.g., 50 MB' },
    ],
    fieldGroups: [
      { title: '📱 App Info', icon: '📱', fields: ['platform', 'developer', 'version', 'pricing_model'] },
      { title: '🔗 Links & Details', icon: '🔗', fields: ['app_store_link', 'play_store_link', 'size'] },
    ]
  },

  game: {
    showTabs: ['basic', 'details'],
    hideTabs: ['contact', 'hours'],
    requiredFields: ['platform'],
    fields: [
      { key: 'platform', label: 'Platform', type: 'multi-select', storageColumn: 'specifications', required: true, options: ['PC', 'PlayStation', 'Xbox', 'Nintendo Switch', 'Mobile', 'VR'] },
      { key: 'genre', label: 'Genre', type: 'tags', storageColumn: 'metadata', placeholder: 'e.g., RPG, FPS, Strategy' },
      { key: 'developer', label: 'Developer', type: 'text', storageColumn: 'metadata', placeholder: 'Developer studio' },
      { key: 'publisher', label: 'Publisher', type: 'text', storageColumn: 'metadata', placeholder: 'Publisher name' },
      { key: 'release_year', label: 'Release Year', type: 'number', storageColumn: 'publication_year' },
      { key: 'esrb_rating', label: 'ESRB Rating', type: 'select', storageColumn: 'metadata', options: ['E', 'E10+', 'T', 'M', 'AO', 'RP'] },
      { key: 'multiplayer', label: 'Multiplayer', type: 'select', storageColumn: 'specifications', options: ['Single-player', 'Multiplayer', 'Co-op', 'Both'] },
    ],
    fieldGroups: [
      { title: '🎮 Game Details', icon: '🎮', fields: ['platform', 'genre', 'release_year', 'esrb_rating'] },
      { title: '🏢 Developer Info', icon: '🏢', fields: ['developer', 'publisher', 'multiplayer'] },
    ]
  },

  course: {
    showTabs: ['basic', 'details'],
    hideTabs: ['contact', 'hours'],
    requiredFields: ['instructor', 'level'],
    fields: [
      { key: 'instructor', label: 'Instructor', type: 'text', storageColumn: 'metadata', required: true, placeholder: 'Instructor name' },
      { key: 'platform', label: 'Platform', type: 'select', storageColumn: 'metadata', options: ['Coursera', 'Udemy', 'edX', 'LinkedIn Learning', 'Skillshare', 'Pluralsight', 'Other'] },
      { key: 'duration', label: 'Duration', type: 'text', storageColumn: 'specifications', placeholder: 'e.g., 6 weeks, 20 hours' },
      { key: 'language', label: 'Language', type: 'text', storageColumn: 'languages', placeholder: 'Course language' },
      { key: 'level', label: 'Level', type: 'select', storageColumn: 'metadata', required: true, options: ['Beginner', 'Intermediate', 'Advanced', 'All Levels'] },
      { key: 'certificate', label: 'Certificate Available', type: 'select', storageColumn: 'metadata', options: ['Yes', 'No', 'Paid'] },
      { key: 'pricing', label: 'Pricing', type: 'select', storageColumn: 'price_info', options: ['Free', 'Paid', 'Subscription', 'Audit Available'] },
    ],
    fieldGroups: [
      { title: '🎓 Course Details', icon: '🎓', fields: ['instructor', 'platform', 'duration', 'language'] },
      { title: '📚 Course Info', icon: '📚', fields: ['level', 'certificate', 'pricing'] },
    ]
  },

  experience: {
    showTabs: ['basic', 'contact', 'hours', 'details'],
    hideTabs: [],
    requiredFields: [],
    fields: [
      { key: 'duration', label: 'Duration', type: 'text', storageColumn: 'specifications', placeholder: 'e.g., 2 hours, Full day' },
      { key: 'location_type', label: 'Location Type', type: 'select', storageColumn: 'metadata', options: ['Indoor', 'Outdoor', 'Mixed'] },
      { key: 'group_size', label: 'Group Size', type: 'text', storageColumn: 'specifications', placeholder: 'e.g., Max 10 people' },
      { key: 'price_range', label: 'Price Range', type: 'select', storageColumn: 'metadata', options: ['$', '$$', '$$$', '$$$$'] },
      { key: 'accessibility', label: 'Accessibility', type: 'multi-select', storageColumn: 'metadata', options: ['Wheelchair Accessible', 'All Ages', 'Age Restrictions', 'Physical Fitness Required'] },
      { key: 'whats_included', label: "What's Included", type: 'tags', storageColumn: 'specifications', placeholder: 'e.g., Equipment, Guide' },
    ],
    fieldGroups: [
      { title: '🎪 Experience Details', icon: '🎪', fields: ['duration', 'location_type', 'group_size', 'price_range'] },
      { title: '✨ Additional Info', icon: '✨', fields: ['accessibility', 'whats_included'] },
    ]
  },

  brand: {
    showTabs: ['basic', 'contact', 'details'],
    hideTabs: ['hours'],
    requiredFields: ['industry'],
    fields: [
      { key: 'industry', label: 'Industry', type: 'select', storageColumn: 'metadata', required: true, options: ['Fashion', 'Technology', 'Food & Beverage', 'Beauty', 'Automotive', 'Entertainment', 'Health & Wellness', 'Finance', 'Retail', 'Sports', 'Media', 'Education', 'Travel', 'Other'] },
      { key: 'founded_year', label: 'Founded Year', type: 'number', storageColumn: 'publication_year', placeholder: 'e.g., 1998' },
      { key: 'headquarters', label: 'Headquarters', type: 'text', storageColumn: 'metadata', placeholder: 'City, Country' },
      { key: 'brand_values', label: 'Brand Values', type: 'multi-select', storageColumn: 'metadata', options: ['Sustainable', 'Eco-Friendly', 'Ethical', 'Innovative', 'Luxury', 'Affordable', 'Inclusive', 'Local', 'Artisan', 'Family-Owned'] },
      { key: 'product_categories', label: 'Product Categories', type: 'tags', storageColumn: 'metadata', placeholder: 'e.g., Shoes, Electronics, Apparel' },
      { key: 'parent_company', label: 'Parent Company', type: 'text', storageColumn: 'metadata', placeholder: 'If applicable' },
      { key: 'tagline', label: 'Tagline', type: 'text', storageColumn: 'metadata', placeholder: 'Brand slogan or motto' },
      { key: 'social_links', label: 'Social Media Links', type: 'tags', storageColumn: 'metadata', placeholder: 'e.g., @instagram, linkedin.com/company/...', helpText: 'Add social media handles or profile URLs' },
      { key: 'target_audience', label: 'Target Audience', type: 'tags', storageColumn: 'metadata', placeholder: 'e.g., Students, Professionals, Families', helpText: 'Who is this brand primarily for?' },
    ],
    fieldGroups: [
      { title: '🏢 Brand Info', icon: '🏢', fields: ['industry', 'founded_year', 'headquarters', 'parent_company'] },
      { title: '💎 Brand Identity', icon: '💎', fields: ['brand_values', 'product_categories', 'tagline', 'social_links', 'target_audience'] },
    ]
  },

  event: {
    showTabs: ['basic', 'contact', 'details'],
    hideTabs: ['hours'],
    requiredFields: ['event_type', 'start_date'],
    fields: [
      { key: 'event_type', label: 'Event Type', type: 'select', storageColumn: 'metadata', required: true, options: ['Conference', 'Concert', 'Festival', 'Workshop', 'Sports', 'Exhibition', 'Networking', 'Webinar', 'Meetup', 'Competition', 'Other'] },
      { key: 'start_date', label: 'Start Date', type: 'text', storageColumn: 'metadata', required: true, placeholder: 'e.g., June 15, 2024 or 2024-06-15', helpText: 'Can be specific date or flexible description' },
      { key: 'end_date', label: 'End Date', type: 'text', storageColumn: 'metadata', placeholder: 'e.g., June 17, 2024 or 2024-06-17' },
      { key: 'venue', label: 'Venue', type: 'text', storageColumn: 'metadata', placeholder: 'Location or platform name' },
      { key: 'organizer', label: 'Organizer', type: 'text', storageColumn: 'metadata', placeholder: 'Event organizer name' },
      { key: 'ticket_price', label: 'Ticket Price Range', type: 'select', storageColumn: 'price_info', options: ['Free', '$', '$$', '$$$', '$$$$'] },
      { key: 'format', label: 'Event Format', type: 'select', storageColumn: 'metadata', options: ['In-Person', 'Virtual', 'Hybrid'] },
      { key: 'capacity', label: 'Capacity', type: 'text', storageColumn: 'specifications', placeholder: 'e.g., 500 attendees' },
      { key: 'age_restriction', label: 'Age Restriction', type: 'select', storageColumn: 'metadata', options: ['All Ages', '18+', '21+', 'Kids Only', 'Family-Friendly'] },
    ],
    fieldGroups: [
      { title: '🎟️ Event Details', icon: '🎟️', fields: ['event_type', 'start_date', 'end_date', 'venue', 'format'] },
      { title: '📋 Event Info', icon: '📋', fields: ['organizer', 'ticket_price', 'capacity', 'age_restriction'] },
    ]
  },

  service: {
    showTabs: ['basic', 'contact', 'hours', 'details'],
    hideTabs: [],
    requiredFields: ['service_category'],
    fields: [
      { key: 'service_category', label: 'Service Category', type: 'select', storageColumn: 'metadata', required: true, options: ['Home Services', 'Professional Services', 'Creative Services', 'Health & Wellness', 'Education', 'Technology', 'Transportation', 'Financial', 'Legal', 'Marketing', 'Consulting', 'Other'] },
      { key: 'provider_name', label: 'Provider/Company Name', type: 'text', storageColumn: 'metadata', placeholder: 'Business or individual name' },
      { key: 'service_areas', label: 'Service Areas', type: 'tags', storageColumn: 'metadata', placeholder: 'Cities or regions served' },
      { key: 'pricing_model', label: 'Pricing Model', type: 'select', storageColumn: 'price_info', options: ['Hourly Rate', 'Fixed Price', 'Subscription', 'Quote-Based', 'Free Consultation', 'Package Deals'] },
      { key: 'years_in_business', label: 'Years in Business', type: 'number', storageColumn: 'metadata', placeholder: 'e.g., 10' },
      { key: 'certifications', label: 'Certifications', type: 'tags', storageColumn: 'metadata', placeholder: 'Professional certifications' },
      { key: 'insurance', label: 'Insurance', type: 'select', storageColumn: 'metadata', options: ['Licensed & Insured', 'Licensed', 'Bonded', 'N/A'] },
    ],
    fieldGroups: [
      { title: '💼 Service Info', icon: '💼', fields: ['service_category', 'provider_name', 'service_areas', 'pricing_model'] },
      { title: '✅ Credentials', icon: '✅', fields: ['years_in_business', 'certifications', 'insurance'] },
    ]
  },

  professional: {
    showTabs: ['basic', 'contact', 'details'],
    hideTabs: ['hours'],
    requiredFields: ['profession'],
    fields: [
      { key: 'profession', label: 'Profession', type: 'text', storageColumn: 'metadata', required: true, placeholder: 'e.g., Therapist, Lawyer, Doctor' },
      { key: 'specialty', label: 'Specialty/Focus', type: 'text', storageColumn: 'metadata', placeholder: 'Area of expertise' },
      { key: 'years_experience', label: 'Years of Experience', type: 'number', storageColumn: 'metadata' },
      { key: 'education', label: 'Education', type: 'tags', storageColumn: 'metadata', placeholder: 'Degrees and institutions' },
      { key: 'certifications', label: 'Certifications', type: 'tags', storageColumn: 'metadata', placeholder: 'Professional certifications' },
      { key: 'languages_spoken', label: 'Languages Spoken', type: 'tags', storageColumn: 'languages', placeholder: 'Languages offered' },
      { key: 'consultation_fee', label: 'Consultation Fee', type: 'text', storageColumn: 'price_info', placeholder: 'e.g., $150/hour' },
      { key: 'availability', label: 'Availability', type: 'text', storageColumn: 'metadata', placeholder: 'e.g., Weekdays, Evenings' },
    ],
    fieldGroups: [
      { title: '👔 Professional Info', icon: '👔', fields: ['profession', 'specialty', 'years_experience', 'languages_spoken'] },
      { title: '🎓 Credentials', icon: '🎓', fields: ['education', 'certifications', 'consultation_fee', 'availability'] },
    ]
  },

  others: {
    showTabs: ['basic', 'contact', 'hours', 'details'],
    hideTabs: [],
    requiredFields: [],
    fields: [],
    fieldGroups: []
  }
};
