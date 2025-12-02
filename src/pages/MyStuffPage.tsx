import React from 'react';
import { VerticalTubelightNavbar } from '@/components/ui/vertical-tubelight-navbar';
import { BottomNavigation } from '@/components/navigation/BottomNavigation';
import MyStuffContent from '@/components/mystuff/MyStuffContent';

const MyStuffPage = () => {
  return (
    <div className="min-h-screen flex w-full">
      {/* Desktop Side Navigation */}
      <div className="hidden xl:block flex-shrink-0">
        <VerticalTubelightNavbar initialActiveTab="My Stuff" />
      </div>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col">
        <MyStuffContent />
      </div>

      {/* Mobile Bottom Navigation */}
      <div className="xl:hidden">
        <BottomNavigation />
      </div>
    </div>
  );
};

export default MyStuffPage;
