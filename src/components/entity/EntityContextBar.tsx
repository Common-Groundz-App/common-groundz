
import React from 'react';
import { Badge } from '@/components/ui/badge';
import { MapPin } from 'lucide-react';
import { cn } from '@/lib/utils';

interface EntityContextBarProps {
  entity?: {
    id: string;
    name: string;
    type: string;
    venue?: string | null;
  };
  category?: string;
  venue?: string | null;
  className?: string;
}

export const EntityContextBar: React.FC<EntityContextBarProps> = ({
  entity,
  category,
  venue,
  className
}) => {
  const getCategoryColor = (category: string) => {
    const colors: Record<string, string> = {
      'Food': 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300',
      'Drink': 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-300',
      'Activity': 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300',
      'Product': 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300',
      'Book': 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300',
      'Movie': 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-300',
      'TV': 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900 dark:text-indigo-300',
      'Music': 'bg-pink-100 text-pink-800 dark:bg-pink-900 dark:text-pink-300',
      'Art': 'bg-violet-100 text-violet-800 dark:bg-violet-900 dark:text-violet-300',
      'Place': 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-300',
      'Travel': 'bg-teal-100 text-teal-800 dark:bg-teal-900 dark:text-teal-300',
    };
    return colors[category] || 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200';
  };

  const displayVenue = venue || entity?.venue;

  return (
    <div className={cn("flex flex-wrap items-center gap-2", className)}>
      {entity && (
        <Badge variant="outline" className="bg-violet-100 text-violet-800 dark:bg-violet-900 dark:text-violet-200 font-medium">
          {entity.name}
        </Badge>
      )}
      
      {category && (
        <Badge className={cn("font-normal", getCategoryColor(category))} variant="outline">
          {category}
        </Badge>
      )}
      
      {displayVenue && (
        <div className="flex items-center gap-1 text-sm text-muted-foreground">
          <MapPin className="h-3 w-3" />
          <span>{displayVenue}</span>
        </div>
      )}
    </div>
  );
};
