
import React from 'react';
import { cn } from '@/lib/utils';
import { Entity } from '@/services/recommendation/types';
import { Book, Clapperboard, MapPin, ShoppingBag, Utensils } from 'lucide-react';

interface EntityBadgeProps {
  entity: Entity;
  className?: string;
  onClick?: () => void;
}

export const EntityBadge: React.FC<EntityBadgeProps> = ({ entity, className, onClick }) => {
  const getEntityTypeColor = (type: string): string => {
    switch(type) {
      case 'book': return 'bg-blue-50 text-blue-800 hover:bg-blue-100 dark:bg-blue-900 dark:text-blue-300 dark:hover:bg-blue-800';
      case 'movie': return 'bg-purple-50 text-purple-800 hover:bg-purple-100 dark:bg-purple-900 dark:text-purple-300 dark:hover:bg-purple-800';
      case 'place': return 'bg-green-50 text-green-800 hover:bg-green-100 dark:bg-green-900 dark:text-green-300 dark:hover:bg-green-800';
      case 'product': return 'bg-yellow-50 text-yellow-800 hover:bg-yellow-100 dark:bg-yellow-900 dark:text-yellow-300 dark:hover:bg-yellow-800';
      case 'food': return 'bg-red-50 text-red-800 hover:bg-red-100 dark:bg-red-900 dark:text-red-300 dark:hover:bg-red-800';
      default: return '';
    }
  };

  const getEntityIcon = (type: string) => {
    switch(type) {
      case 'book': return <Book className="w-3.5 h-3.5" />;
      case 'movie': return <Clapperboard className="w-3.5 h-3.5" />; // Changed from Film to Clapperboard
      case 'place': return <MapPin className="w-3.5 h-3.5" />; // Changed from Home to MapPin
      case 'product': return <ShoppingBag className="w-3.5 h-3.5" />;
      case 'food': return <Utensils className="w-3.5 h-3.5" />;
      default: return null;
    }
  };

  return (
    <div
      className={cn(
        "inline-flex items-center gap-1.5 px-3 py-1 rounded-full", 
        "border border-transparent shadow-sm",
        "font-medium text-sm transition-all duration-200",
        onClick ? "cursor-pointer transform hover:scale-105 hover:bg-opacity-90" : "",
        getEntityTypeColor(entity.type), 
        className
      )}
      onClick={onClick}
      title={entity.name}
      role={onClick ? "button" : undefined}
    >
      {getEntityIcon(entity.type)}
      {entity.name}
    </div>
  );
};

export default EntityBadge;
