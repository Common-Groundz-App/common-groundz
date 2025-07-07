
import React from 'react';
import { Link } from 'react-router-dom';
import { ChevronRight, Home } from 'lucide-react';
import { Breadcrumb, BreadcrumbList, BreadcrumbItem, BreadcrumbLink, BreadcrumbPage, BreadcrumbSeparator } from '@/components/ui/breadcrumb';
import { Entity } from '@/services/recommendation/types';

interface EntityParentBreadcrumbProps {
  currentEntity: Entity;
  parentEntity?: Entity | null;
  isLoading?: boolean;
}

export const EntityParentBreadcrumb: React.FC<EntityParentBreadcrumbProps> = ({
  currentEntity,
  parentEntity,
  isLoading = false
}) => {
  if (isLoading) {
    return (
      <div className="animate-pulse">
        <div className="h-4 bg-muted rounded w-48"></div>
      </div>
    );
  }

  // If no parent, don't show breadcrumb
  if (!parentEntity) {
    return null;
  }

  return (
    <Breadcrumb className="mb-4">
      <BreadcrumbList>
        <BreadcrumbItem>
          <BreadcrumbLink asChild>
            <Link to="/" className="flex items-center gap-1">
              <Home className="h-3 w-3" />
              Home
            </Link>
          </BreadcrumbLink>
        </BreadcrumbItem>
        <BreadcrumbSeparator />
        
        <BreadcrumbItem>
          <BreadcrumbLink asChild>
            <Link 
              to={`/entity/${parentEntity.slug || parentEntity.id}`}
              className="hover:text-foreground transition-colors"
            >
              {parentEntity.name}
            </Link>
          </BreadcrumbLink>
        </BreadcrumbItem>
        <BreadcrumbSeparator />
        
        <BreadcrumbItem>
          <BreadcrumbPage className="font-medium">
            {currentEntity.name}
          </BreadcrumbPage>
        </BreadcrumbItem>
      </BreadcrumbList>
    </Breadcrumb>
  );
};
