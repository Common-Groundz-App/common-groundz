
import React from 'react';
import { MapPin, Tag, Video } from 'lucide-react';
import { cn } from '@/lib/utils';

export type TagType = 'entity' | 'location';
export type EntityType = 'book' | 'movie' | 'place' | 'product' | 'food';

interface TagBadgeProps {
  type: TagType;
  label: string;
  entityType?: EntityType;
  onClick?: () => void;
  className?: string;
}

export const TagBadge: React.FC<TagBadgeProps> = ({ 
  type, 
  label, 
  entityType,
  onClick, 
  className 
}) => {
  const getTagBackground = () => {
    if (type === 'location') {
      return 'bg-cyan-50 text-cyan-800 hover:bg-cyan-100 dark:bg-cyan-900 dark:text-cyan-300 dark:hover:bg-cyan-800';
    }
    
    // For entity types
    switch(entityType) {
      case 'book': return 'bg-blue-50 text-blue-800 hover:bg-blue-100 dark:bg-blue-900 dark:text-blue-300 dark:hover:bg-blue-800';
      case 'movie': return 'bg-purple-50 text-purple-800 hover:bg-purple-100 dark:bg-purple-900 dark:text-purple-300 dark:hover:bg-purple-800';
      case 'place': return 'bg-green-50 text-green-800 hover:bg-green-100 dark:bg-green-900 dark:text-green-300 dark:hover:bg-green-800';
      case 'product': return 'bg-yellow-50 text-yellow-800 hover:bg-yellow-100 dark:bg-yellow-900 dark:text-yellow-300 dark:hover:bg-yellow-800';
      case 'food': return 'bg-red-50 text-red-800 hover:bg-red-100 dark:bg-red-900 dark:text-red-300 dark:hover:bg-red-800';
      default: return 'bg-gray-50 text-gray-800 hover:bg-gray-100 dark:bg-gray-900 dark:text-gray-300 dark:hover:bg-gray-800';
    }
  };

  const getIcon = () => {
    if (type === 'location') {
      return <MapPin className="w-3.5 h-3.5" />;
    }
    
    // For entity types
    switch(entityType) {
      case 'book': return <Tag className="w-3.5 h-3.5" />;
      case 'movie': return <Video className="w-3.5 h-3.5" />;
      case 'place': return <MapPin className="w-3.5 h-3.5" />;
      case 'product': return <Tag className="w-3.5 h-3.5" />;
      case 'food': return <Tag className="w-3.5 h-3.5" />;
      default: return <Tag className="w-3.5 h-3.5" />;
    }
  };

  return (
    <div
      className={cn(
        "inline-flex items-center gap-1.5 px-3 py-1 rounded-full",
        "border border-transparent shadow-sm",
        "font-medium text-sm transition-all duration-200",
        "cursor-pointer transform hover:scale-105",
        getTagBackground(),
        className
      )}
      onClick={onClick}
      title={label}
      role={onClick ? "button" : undefined}
    >
      {getIcon()}
      <span>{label}</span>
    </div>
  );
};

export default TagBadge;
