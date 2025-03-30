
import React, { useState } from 'react';
import { User } from '@supabase/supabase-js';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Plus } from 'lucide-react';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import ProfileAbout from './ProfileAbout';
import ProfileStats from './ProfileStats';

interface ProfileContentProps {
  user: User | null;
}

const ProfileContent: React.FC<ProfileContentProps> = ({ user }) => {
  const [activeTab, setActiveTab] = useState('reviews');

  if (!user) {
    return (
      <div className="text-center py-12">
        <h2 className="text-2xl font-bold mb-4">Please sign in to view your profile</h2>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Left Column - About & Info */}
        <div className="space-y-6">
          {/* About section */}
          <ProfileAbout />
          
          {/* Stats section - follower counts */}
          <ProfileStats />
        </div>
        
        {/* Right Column - Content & Reviews */}
        <div className="md:col-span-2 space-y-6">
          {/* Content Tabs */}
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="border-b w-full justify-start rounded-none px-0 h-auto bg-transparent">
              <TabsTrigger 
                value="reviews" 
                className="rounded-none data-[state=active]:border-b-2 data-[state=active]:border-primary data-[state=active]:bg-transparent px-4 py-2"
              >
                Reviews
              </TabsTrigger>
              <TabsTrigger 
                value="saved" 
                className="rounded-none data-[state=active]:border-b-2 data-[state=active]:border-primary data-[state=active]:bg-transparent px-4 py-2"
              >
                Saved
              </TabsTrigger>
              <TabsTrigger 
                value="collections" 
                className="rounded-none data-[state=active]:border-b-2 data-[state=active]:border-primary data-[state=active]:bg-transparent px-4 py-2"
              >
                Collections
              </TabsTrigger>
              <TabsTrigger 
                value="connections" 
                className="rounded-none data-[state=active]:border-b-2 data-[state=active]:border-primary data-[state=active]:bg-transparent px-4 py-2"
              >
                Connections
              </TabsTrigger>
            </TabsList>

            {/* Reviews Tab Content */}
            <TabsContent value="reviews" className="space-y-6">
              <div className="flex justify-between items-center">
                <h2 className="text-xl font-bold">Recent Reviews</h2>
                <Button size="sm" className="rounded-full">
                  <Plus size={18} className="mr-1" />
                  Add Review
                </Button>
              </div>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {/* Review cards */}
                {[1, 2, 3].map((item) => (
                  <Card key={item} className="overflow-hidden hover:shadow-md transition-shadow cursor-pointer">
                    <div className="aspect-video relative">
                      <img 
                        src={`https://picsum.photos/seed/${item}/500/300`}
                        alt="Review" 
                        className="w-full h-full object-cover"
                      />
                    </div>
                    <CardContent className="p-4">
                      <h3 className="font-bold text-base line-clamp-1">Local Coffee Shop</h3>
                      <p className="text-sm text-muted-foreground line-clamp-2">Great atmosphere and amazing coffee. Perfect place to work or meet friends.</p>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </TabsContent>
            
            {/* Saved Tab Content */}
            <TabsContent value="saved">
              <div className="text-center py-12">
                <h3 className="text-lg font-medium mb-2">No saved places yet</h3>
                <p className="text-muted-foreground">Places you save will appear here</p>
              </div>
            </TabsContent>

            {/* Collections Tab Content */}
            <TabsContent value="collections">
              <div className="text-center py-12">
                <h3 className="text-lg font-medium mb-2">No collections yet</h3>
                <p className="text-muted-foreground">Create your first collection to organize your favorite places</p>
              </div>
            </TabsContent>

            {/* Connections Tab Content */}
            <TabsContent value="connections">
              <div className="text-center py-12">
                <h3 className="text-lg font-medium mb-2">No connections yet</h3>
                <p className="text-muted-foreground">Follow other users to see their activity</p>
              </div>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
};

export default ProfileContent;
