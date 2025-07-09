
import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { 
  Breadcrumb, 
  BreadcrumbList, 
  BreadcrumbItem, 
  BreadcrumbLink, 
  BreadcrumbSeparator, 
  BreadcrumbPage 
} from '@/components/ui/breadcrumb';
import { ArrowLeft, Home } from 'lucide-react';
import { Entity } from '@/services/recommendation/types';

interface EntityV3HeaderProps {
  entity: Entity;
}

export const EntityV3Header: React.FC<EntityV3HeaderProps> = ({ entity }) => {
  const navigate = useNavigate();

  const handleBack = () => {
    navigate(-1);
  };

  return (
    <div className="lg:col-span-2 py-4 border-b border-border">
      <div className="flex items-center justify-between mb-4">
        <Button
          variant="ghost"
          onClick={handleBack}
          className="flex items-center gap-2"
        >
          <ArrowLeft className="h-4 w-4" />
          Back
        </Button>
        
        <div className="text-sm text-muted-foreground">
          V3 Preview
        </div>
      </div>
      
      <Breadcrumb>
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink href="/explore" className="flex items-center gap-1">
              <Home className="h-4 w-4" />
              Explore
            </BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbLink href="/explore">
              {entity.type.charAt(0).toUpperCase() + entity.type.slice(1)}s
            </BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbPage>{entity.name}</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>
    </div>
  );
};
