import React from 'react';
import { useParams } from 'react-router-dom';
import NavBarComponent from '@/components/NavBarComponent';
import { EntityPreviewToggle } from '@/components/entity/EntityPreviewToggle';

export const EntityV3 = () => {
  const { slug } = useParams<{ slug: string }>();

  return (
    <div className="min-h-screen bg-background">
      {/* Top Navigation */}
      <NavBarComponent />
      
      {/* Version Toggle */}
      <EntityPreviewToggle />
      
      {/* Main Content */}
      <div className="pt-16">
        <div className="container mx-auto px-4 py-8">
          <div className="text-center">
            <h1 className="text-4xl font-bold text-foreground mb-4">
              Entity V3 - Beta
            </h1>
            <p className="text-muted-foreground text-lg mb-8">
              Coming soon: A redesigned entity experience
            </p>
            <p className="text-sm text-muted-foreground">
              Entity: {slug}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default EntityV3;