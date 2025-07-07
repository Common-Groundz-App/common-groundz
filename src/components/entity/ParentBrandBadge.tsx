
import React from 'react';
import { Badge } from '@/components/ui/badge';
import { Building2, Package } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Entity } from '@/services/recommendation/types';

interface ParentBrandBadgeProps {
  parentEntity: Entity;
  currentEntityName?: string;
}

export const ParentBrandBadge = ({ parentEntity, currentEntityName }: ParentBrandBadgeProps) => {
  return (
    <div className="flex items-center gap-2 mb-2">
      <Badge variant="outline" className="bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300">
        <Building2 className="h-3 w-3 mr-1" />
        Part of {parentEntity.name}
      </Badge>
      
      {currentEntityName && (
        <div className="flex items-center gap-1 text-sm text-muted-foreground">
          <Package className="h-3 w-3" />
          <span>Product by</span>
          <Link 
            to={`/entity/${parentEntity.slug || parentEntity.id}`}
            className="text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 font-medium"
          >
            {parentEntity.name}
          </Link>
        </div>
      )}
    </div>
  );
};
