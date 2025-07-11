
import React from 'react';
import NavBarComponent from '@/components/NavBarComponent';
import { EntityPreviewToggle } from '@/components/entity/EntityPreviewToggle';

const EntityV4 = () => {
  return (
    <div className="min-h-screen flex flex-col">
      <NavBarComponent />
      
      {/* Version Toggle */}
      <EntityPreviewToggle />
      
      {/* Minimal content area - just navigation for now */}
      <div className="flex-1 pt-16">
        <div className="container max-w-6xl mx-auto py-8 px-4">
          <div className="text-center text-muted-foreground">
            <h1 className="text-2xl font-bold mb-4">Entity V4</h1>
            <p>Navigation-only version - ready for future development</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default EntityV4;
