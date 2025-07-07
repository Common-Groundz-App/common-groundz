
import React from 'react';
import { ChevronRight, Home } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Entity } from '@/services/recommendation/types';

interface EntityBreadcrumbProps {
  entity: Entity;
  parentEntity?: Entity | null;
}

export const EntityBreadcrumb: React.FC<EntityBreadcrumbProps> = ({ 
  entity, 
  parentEntity 
}) => {
  if (!parentEntity) return null;

  return (
    <nav className="flex items-center space-x-2 text-sm text-muted-foreground mb-4">
      <Link 
        to="/explore" 
        className="flex items-center hover:text-foreground transition-colors"
      >
        <Home className="h-4 w-4" />
      </Link>
      <ChevronRight className="h-4 w-4" />
      <Link 
        to={`/entity/${parentEntity.slug || parentEntity.id}`}
        className="hover:text-foreground transition-colors"
      >
        {parentEntity.name}
      </Link>
      <ChevronRight className="h-4 w-4" />
      <span className="text-foreground font-medium">{entity.name}</span>
    </nav>
  );
};
