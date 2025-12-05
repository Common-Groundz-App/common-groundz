import React, { useState } from 'react';
import { TubelightTabs, TabsContent } from '@/components/ui/tubelight-tabs';
import { Package, ListChecks, Sparkles } from 'lucide-react';
import MyStuffFilters from './MyStuffFilters';
import MyStuffItemsGrid from './MyStuffItemsGrid';
import MyStuffRoutinesSection from './MyStuffRoutinesSection';
import JourneyRecommendationsSection from './JourneyRecommendationsSection';

const MyStuffContent = () => {
  const [activeTab, setActiveTab] = useState('items');
  const [statusFilter, setStatusFilter] = useState('all');
  const [sortBy, setSortBy] = useState('recent');

  const tabItems = [
    {
      value: 'items',
      label: 'My Items',
      icon: Package
    },
    {
      value: 'routines',
      label: 'Routines',
      icon: ListChecks
    },
    {
      value: 'suggestions',
      label: 'Suggestions',
      icon: Sparkles
    }
  ];

  return (
    <div className="w-full">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-3xl font-bold mb-2">My Stuff</h1>
        <p className="text-muted-foreground">Manage your inventory and routines</p>
      </div>

      {/* Tabs */}
      <TubelightTabs 
        defaultValue={activeTab} 
        onValueChange={setActiveTab}
        items={tabItems}
        className="w-full"
      >
        <TabsContent value="items" className="mt-6">
          <MyStuffFilters 
            statusFilter={statusFilter}
            sortBy={sortBy}
            onStatusFilterChange={setStatusFilter}
            onSortByChange={setSortBy}
          />
          <MyStuffItemsGrid 
            statusFilter={statusFilter}
            sortBy={sortBy}
          />
        </TabsContent>

        <TabsContent value="routines" className="mt-6">
          <MyStuffRoutinesSection />
        </TabsContent>

        <TabsContent value="suggestions" className="mt-6">
          <JourneyRecommendationsSection />
        </TabsContent>
      </TubelightTabs>
    </div>
  );
};

export default MyStuffContent;
