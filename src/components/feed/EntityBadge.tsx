
import React from 'react';
import { Badge } from '@/components/ui/badge';
import { Tag, Film, Book, Pizza, Coffee, Map, Briefcase, Music, Palette, Tv, Plane } from 'lucide-react';
import { cn } from '@/lib/utils';
import { EntityType } from '@/services/recommendation/types';

interface EntityBadgeProps {
  name: string;
  type?: string;
  className?: string;
}

const EntityBadge: React.FC<EntityBadgeProps> = ({ name, type, className }) => {
  const getIconByType = () => {
    switch (type) {
      case EntityType.Movie:
        return <Film size={14} />;
      case EntityType.Book:
        return <Book size={14} />;
      case EntityType.Food:
        return <Pizza size={14} />;
      case EntityType.Drink:
        return <Coffee size={14} />;
      case EntityType.Place:
        return <Map size={14} />;
      case EntityType.Product:
        return <Briefcase size={14} />;
      case EntityType.Music:
        return <Music size={14} />;
      case EntityType.Art:
        return <Palette size={14} />;
      case EntityType.TV:
        return <Tv size={14} />;
      case EntityType.Travel:
        return <Plane size={14} />;
      case EntityType.Activity:
        return <Tag size={14} />;
      default:
        return <Tag size={14} />;
    }
  };

  return (
    <Badge 
      variant="outline" 
      className={cn(
        "flex items-center gap-1 py-1 px-2 font-normal text-xs bg-muted/50", 
        className
      )}
    >
      {getIconByType()}
      <span className="truncate max-w-[150px]">{name}</span>
    </Badge>
  );
};

export default EntityBadge;
