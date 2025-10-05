-- Add new entity types to the entity_type enum
ALTER TYPE entity_type ADD VALUE IF NOT EXISTS 'event';
ALTER TYPE entity_type ADD VALUE IF NOT EXISTS 'service';
ALTER TYPE entity_type ADD VALUE IF NOT EXISTS 'professional';
ALTER TYPE entity_type ADD VALUE IF NOT EXISTS 'others';