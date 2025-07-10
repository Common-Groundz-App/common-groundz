
import React from 'react';
import { ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { EntityParentBreadcrumb } from '@/components/entity/EntityParentBreadcrumb';
import { Entity } from '@/services/recommendation/types';
import { cn } from '@/lib/utils';

interface EntityV3HeaderProps {
  entity: Entity;
  parentEntity?: Entity | null;
  isLoading?: boolean;
  className?: string;
}

export const EntityV3Header: React.FC<EntityV3HeaderProps> = ({
  entity,
  parentEntity,
  isLoading = false,
  className
}) => {
  const navigate = useNavigate();

  const handleGoBack = () => {
    navigate(-1);
  };

  if (isLoading) {
    return (
      <div className={cn("col-span-full space-y-4", className)}>
        <div className="animate-pulse">
          <div className="h-10 bg-muted rounded w-32 mb-4"></div>
          <div className="h-8 bg-muted rounded w-64"></div>
        </div>
      </div>
    );
  }

  return (
    <div className={cn("col-span-full space-y-4", className)}>
      {/* Back Button */}
      <div className="flex items-center justify-between">
        <Button
          variant="ghost"
          size="sm"
          onClick={handleGoBack}
          className="gap-2 text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          Back
        </Button>
      </div>

      {/* Breadcrumb Navigation */}
      <EntityParentBreadcrumb
        currentEntity={entity}
        parentEntity={parentEntity}
        isLoading={false}
      />

      {/* Entity Title */}
      <div className="space-y-2">
        <h1 className="text-2xl md:text-3xl font-bold text-foreground">
          {entity.name}
        </h1>
        {entity.description && (
          <p className="text-muted-foreground text-sm md:text-base line-clamp-2">
            {entity.description}
          </p>
        )}
      </div>
    </div>
  );
};
