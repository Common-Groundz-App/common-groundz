
import React from 'react';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { Entity } from '@/services/recommendation/types';
import { Book, Film, Home, ShoppingBag, Utensils } from 'lucide-react';

interface EntityBadgeProps {
  entity: Entity;
  className?: string;
}

export const EntityBadge: React.FC<EntityBadgeProps> = ({ entity, className }) => {
  const getEntityTypeColor = (type: string): string => {
    switch(type) {
      case 'book': return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300';
      case 'movie': return 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-300';
      case 'place': return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300';
      case 'product': return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300';
      case 'food': return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300';
      default: return '';
    }
  };

  const getEntityIcon = (type: string) => {
    switch(type) {
      case 'book': return <Book size={12} className="text-blue-700 dark:text-blue-400" />;
      case 'movie': return <Film size={12} className="text-purple-700 dark:text-purple-400" />;
      case 'place': return <Home size={12} className="text-green-700 dark:text-green-400" />;
      case 'product': return <ShoppingBag size={12} className="text-yellow-700 dark:text-yellow-400" />;
      case 'food': return <Utensils size={12} className="text-red-700 dark:text-red-400" />;
      default: return null;
    }
  };

  return (
    <Badge
      className={cn(
        "font-normal flex items-center gap-1.5", 
        getEntityTypeColor(entity.type), 
        className
      )}
      variant="outline"
    >
      {getEntityIcon(entity.type)}
      {entity.name}
    </Badge>
  );
};

export default EntityBadge;
