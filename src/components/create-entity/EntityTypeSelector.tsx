import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { EntityType } from '@/services/recommendation/types';
import {
  Package, MapPin, BookOpen, Film, Monitor, GraduationCap,
  Smartphone, Gamepad2, Compass, Building2
} from 'lucide-react';

interface EntityTypeSelectorProps {
  selectedType: EntityType | null;
  onTypeSelect: (type: EntityType) => void;
}

const ENTITY_TYPES = [
  {
    type: EntityType.Product,
    label: 'Product',
    description: 'Physical or digital products',
    icon: Package,
    examples: ['Electronics', 'Clothing', 'Home goods'],
    color: 'bg-blue-50 border-blue-200 hover:bg-blue-100 dark:bg-blue-950 dark:border-blue-800'
  },
  {
    type: EntityType.Place,
    label: 'Place',
    description: 'Locations and venues',
    icon: MapPin,
    examples: ['Restaurants', 'Hotels', 'Attractions'],
    color: 'bg-green-50 border-green-200 hover:bg-green-100 dark:bg-green-950 dark:border-green-800'
  },
  {
    type: EntityType.Book,
    label: 'Book',
    description: 'Books and publications',
    icon: BookOpen,
    examples: ['Novels', 'Non-fiction', 'Textbooks'],
    color: 'bg-purple-50 border-purple-200 hover:bg-purple-100 dark:bg-purple-950 dark:border-purple-800'
  },
  {
    type: EntityType.Movie,
    label: 'Movie',
    description: 'Films and documentaries',
    icon: Film,
    examples: ['Blockbusters', 'Indies', 'Documentaries'],
    color: 'bg-red-50 border-red-200 hover:bg-red-100 dark:bg-red-950 dark:border-red-800'
  },
  {
    type: EntityType.TvShow,
    label: 'TV Show',
    description: 'Television series',
    icon: Monitor,
    examples: ['Series', 'Mini-series', 'Shows'],
    color: 'bg-orange-50 border-orange-200 hover:bg-orange-100 dark:bg-orange-950 dark:border-orange-800'
  },
  {
    type: EntityType.Course,
    label: 'Course',
    description: 'Educational content',
    icon: GraduationCap,
    examples: ['Online courses', 'Workshops', 'Training'],
    color: 'bg-indigo-50 border-indigo-200 hover:bg-indigo-100 dark:bg-indigo-950 dark:border-indigo-800'
  },
  {
    type: EntityType.App,
    label: 'App',
    description: 'Mobile and web applications',
    icon: Smartphone,
    examples: ['Mobile apps', 'Web apps', 'Software'],
    color: 'bg-teal-50 border-teal-200 hover:bg-teal-100 dark:bg-teal-950 dark:border-teal-800'
  },
  {
    type: EntityType.Game,
    label: 'Game',
    description: 'Video games and board games',
    icon: Gamepad2,
    examples: ['Video games', 'Board games', 'Mobile games'],
    color: 'bg-pink-50 border-pink-200 hover:bg-pink-100 dark:bg-pink-950 dark:border-pink-800'
  },
  {
    type: EntityType.Experience,
    label: 'Experience',
    description: 'Activities and experiences',
    icon: Compass,
    examples: ['Events', 'Tours', 'Activities'],
    color: 'bg-yellow-50 border-yellow-200 hover:bg-yellow-100 dark:bg-yellow-950 dark:border-yellow-800'
  },
  {
    type: EntityType.Brand,
    label: 'Brand',
    description: 'Companies and organizations',
    icon: Building2,
    examples: ['Companies', 'Organizations', 'Brands'],
    color: 'bg-gray-50 border-gray-200 hover:bg-gray-100 dark:bg-gray-950 dark:border-gray-800'
  }
];

export function EntityTypeSelector({ selectedType, onTypeSelect }: EntityTypeSelectorProps) {
  return (
    <div className="space-y-6">
      <div className="text-center">
        <h2 className="text-xl font-semibold text-foreground mb-2">
          What type of entity are you adding?
        </h2>
        <p className="text-muted-foreground">
          Choose the category that best describes what you want to add
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {ENTITY_TYPES.map((entityType) => {
          const Icon = entityType.icon;
          const isSelected = selectedType === entityType.type;
          
          return (
            <Card
              key={entityType.type}
              className={`cursor-pointer transition-all duration-200 ${
                isSelected
                  ? 'ring-2 ring-primary border-primary bg-primary/5'
                  : entityType.color
              }`}
              onClick={() => onTypeSelect(entityType.type)}
            >
              <CardContent className="p-4">
                <div className="flex items-start gap-3">
                  <div className={`p-2 rounded-lg ${
                    isSelected ? 'bg-primary text-primary-foreground' : 'bg-background'
                  }`}>
                    <Icon className="w-5 h-5" />
                  </div>
                  
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="font-medium text-foreground">
                        {entityType.label}
                      </h3>
                      {isSelected && (
                        <Badge variant="default" className="text-xs">
                          Selected
                        </Badge>
                      )}
                    </div>
                    
                    <p className="text-sm text-muted-foreground mb-2">
                      {entityType.description}
                    </p>
                    
                    <div className="flex flex-wrap gap-1">
                      {entityType.examples.map((example) => (
                        <span
                          key={example}
                          className="text-xs px-2 py-1 bg-muted rounded-md text-muted-foreground"
                        >
                          {example}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {selectedType && (
        <div className="text-center p-4 bg-primary/10 rounded-lg">
          <p className="text-sm text-foreground">
            Great choice! You're adding a <strong>{ENTITY_TYPES.find(t => t.type === selectedType)?.label.toLowerCase()}</strong> to the platform.
          </p>
        </div>
      )}
    </div>
  );
}