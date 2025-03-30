
import React from 'react';
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

interface ProfileHeaderProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
}

const ProfileHeader = ({ activeTab, onTabChange }: ProfileHeaderProps) => {
  return (
    <div className="mb-6 flex justify-between items-center">
      <Tabs value={activeTab} onValueChange={onTabChange}>
        <TabsList>
          <TabsTrigger value="portfolio">Portfolio</TabsTrigger>
          <TabsTrigger value="availability">Availability</TabsTrigger>
          <TabsTrigger value="reviews">Reviews</TabsTrigger>
        </TabsList>
      </Tabs>
    </div>
  );
};

export default ProfileHeader;
