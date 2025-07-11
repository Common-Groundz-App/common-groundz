
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
        <div className="container max-w-7xl mx-auto px-4 py-6">
          {/* Two Column Layout */}
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
            {/* Main Content - Left Column */}
            <div className="lg:col-span-3 space-y-8">
              {/* Section 1: Header & Primary Actions */}
              <EntityHeader />
              
              {/* Section 2: Trust & Review Summary */}
              <TrustSummary />
              
              {/* Section 4: Tabs Navigation */}
              <TabsNavigation />
              
              {/* Section 3: Reviews & Social Proof */}
              <div id="overview">
                <ReviewsFeed />
              </div>
              
              {/* Products Section */}
              <div id="products" className="pt-8">
                <h2 className="text-2xl font-semibold mb-6">Products</h2>
                <div className="text-muted-foreground">Products section content will go here...</div>
              </div>
              
              {/* Posts Section */}
              <div id="posts" className="pt-8">
                <h2 className="text-2xl font-semibold mb-6">Posts</h2>
                <div className="text-muted-foreground">Posts section content will go here...</div>
              </div>
            </div>
            
            {/* Sidebar - Right Column */}
            <div className="lg:col-span-1">
              {/* Section 5: Info & Discovery */}
              <InfoDiscovery />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default EntityV4;
