
import React from 'react';
import NavBarComponent from '@/components/NavBarComponent';
import { EntityPreviewToggle } from '@/components/entity/EntityPreviewToggle';
import { EntityHeader } from './components/EntityHeader';
import { TrustSummary } from './components/TrustSummary';
import { ReviewsFeed } from './components/ReviewsFeed';
import { TabsNavigation } from './components/TabsNavigation';
import { InfoDiscovery } from './components/InfoDiscovery';

const EntityV4 = () => {
  return (
    <div className="min-h-screen flex flex-col bg-background">
      <NavBarComponent />
      
      {/* Version Toggle */}
      <EntityPreviewToggle />
      
      {/* Main Content */}
      <div className="flex-1 pt-16">
        <div className="container max-w-7xl mx-auto px-4 py-8">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Main Content Area */}
            <div className="lg:col-span-2 space-y-8">
              {/* Section 1: Header & Primary Actions */}
              <EntityHeader />
              
              {/* Section 2: Trust & Review Summary */}
              <TrustSummary />
              
              {/* Section 4: Tabs Navigation */}
              <TabsNavigation />
              
              {/* Section 3: Reviews & Social Proof */}
              <ReviewsFeed />
            </div>
            
            {/* Section 5: Info & Discovery Sidebar */}
            <div className="lg:col-span-1">
              <InfoDiscovery />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default EntityV4;
