import React, { useState } from 'react';
import { TubelightTabs, TabsContent } from '@/components/ui/tubelight-tabs';
import { Package, ListChecks } from 'lucide-react';
import MyStuffFilters from './MyStuffFilters';
import MyStuffItemsGrid from './MyStuffItemsGrid';
import MyStuffRoutinesSection from './MyStuffRoutinesSection';

const MyStuffContent = () => {
  const [activeTab, setActiveTab] = useState('items');

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
    }
  ];

  return (
    <div className="w-full max-w-7xl mx-auto px-4 py-6 pb-20 xl:pb-6">
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
          <MyStuffFilters />
          <MyStuffItemsGrid />
        </TabsContent>

        <TabsContent value="routines" className="mt-6">
          <MyStuffRoutinesSection />
        </TabsContent>
      </TubelightTabs>
    </div>
  );
};

export default MyStuffContent;
