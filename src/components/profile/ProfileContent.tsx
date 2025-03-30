
import React, { useState } from 'react';
import { User } from '@supabase/supabase-js';
import { Card, CardContent } from '@/components/ui/card';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Plus, MapPin, Calendar, Users } from 'lucide-react';
import { AspectRatio } from '@/components/ui/aspect-ratio';

interface ProfileContentProps {
  user: User | null;
}

const ProfileContent: React.FC<ProfileContentProps> = ({ user }) => {
  const [activeTab, setActiveTab] = useState('recommendations');

  if (!user) {
    return (
      <div className="text-center py-12">
        <h2 className="text-2xl font-bold mb-4">Please sign in to view your profile</h2>
      </div>
    );
  }

  // Get user initials for the avatar fallback
  const getInitials = () => {
    if (user.email) {
      return user.email.substring(0, 2).toUpperCase();
    }
    return "U";
  };

  return (
    <div className="space-y-8">
      {/* Cover and Profile Image */}
      <div className="relative">
        <div className="rounded-xl overflow-hidden shadow-md">
          <AspectRatio ratio={3 / 1}>
            <img 
              src="https://images.unsplash.com/photo-1516450360452-9312f5463400?q=80&w=1470&auto=format&fit=crop" 
              alt="Cover" 
              className="w-full h-full object-cover"
            />
          </AspectRatio>
        </div>
        
        <div className="absolute bottom-0 transform translate-y-1/2 left-8">
          <Avatar className="h-24 w-24 border-4 border-background">
            <AvatarImage src="https://images.unsplash.com/photo-1492633423870-43d1cd2775eb?&w=128&h=128&dpr=2&q=80" alt={user.email || "User"} />
            <AvatarFallback className="text-2xl">{getInitials()}</AvatarFallback>
          </Avatar>
        </div>
      </div>
      
      {/* Profile Info & Actions */}
      <div className="pt-16 pb-4 md:flex md:items-center md:justify-between">
        <div className="space-y-2">
          <h1 className="text-2xl font-bold">{user.email?.split('@')[0] || "User"}</h1>
          <div className="flex flex-wrap gap-2 text-sm text-muted-foreground">
            <div className="flex items-center gap-1">
              <MapPin size={16} />
              <span>San Francisco, CA</span>
            </div>
            <div className="flex items-center gap-1">
              <Calendar size={16} />
              <span>Joined March 2023</span>
            </div>
            <div className="flex items-center gap-1">
              <Users size={16} />
              <span>45 connections</span>
            </div>
          </div>
        </div>
        <div className="mt-4 md:mt-0 flex gap-2">
          <Button size="sm" variant="outline">Edit Profile</Button>
          <Button size="sm">Share Profile</Button>
        </div>
      </div>
      
      {/* Tabs and Content */}
      <div>
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="mb-6 bg-background border-b w-full justify-start rounded-none px-0 h-auto">
            <TabsTrigger 
              value="recommendations" 
              className="rounded-none data-[state=active]:border-b-2 data-[state=active]:border-primary data-[state=active]:bg-transparent px-4 py-2"
            >
              Recommendations <Badge className="ml-2 bg-primary">12</Badge>
            </TabsTrigger>
            <TabsTrigger 
              value="collections" 
              className="rounded-none data-[state=active]:border-b-2 data-[state=active]:border-primary data-[state=active]:bg-transparent px-4 py-2"
            >
              Collections <Badge className="ml-2">5</Badge>
            </TabsTrigger>
            <TabsTrigger 
              value="activity" 
              className="rounded-none data-[state=active]:border-b-2 data-[state=active]:border-primary data-[state=active]:bg-transparent px-4 py-2"
            >
              Activity
            </TabsTrigger>
          </TabsList>

          <TabsContent value="recommendations" className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {/* Example recommendation cards */}
              {[1, 2, 3, 4, 5].map((item) => (
                <Card key={item} className="card-hover overflow-hidden">
                  <div className="relative">
                    <AspectRatio ratio={3/2}>
                      <img 
                        src={`https://picsum.photos/seed/${item}/500/300`} 
                        alt="Recommendation" 
                        className="w-full h-full object-cover"
                      />
                    </AspectRatio>
                    <div className="absolute top-2 right-2">
                      <Badge className="bg-black/70 text-white">COMM GROUNDZ</Badge>
                    </div>
                  </div>
                  <CardContent className="p-4">
                    <h3 className="font-bold">Recommendation #{item}</h3>
                    <p className="text-sm text-muted-foreground">A brief description of this recommendation.</p>
                  </CardContent>
                </Card>
              ))}
              
              {/* Add new recommendation card */}
              <Card className="flex items-center justify-center h-full min-h-[200px] border-dashed card-hover cursor-pointer">
                <div className="text-center p-6">
                  <div className="mx-auto mb-2 bg-muted h-12 w-12 rounded-full flex items-center justify-center">
                    <Plus className="h-6 w-6 text-muted-foreground" />
                  </div>
                  <h3 className="font-medium">Add Recommendation</h3>
                  <p className="text-sm text-muted-foreground mt-1">Share something you love</p>
                </div>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="collections" className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {/* Add collection card */}
              <Card className="flex items-center justify-center h-full min-h-[200px] border-dashed card-hover cursor-pointer">
                <div className="text-center p-6">
                  <div className="mx-auto mb-2 bg-muted h-12 w-12 rounded-full flex items-center justify-center">
                    <Plus className="h-6 w-6 text-muted-foreground" />
                  </div>
                  <h3 className="font-medium">Create Collection</h3>
                  <p className="text-sm text-muted-foreground mt-1">Curate your recommendations</p>
                </div>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="activity">
            <div className="text-center py-12">
              <h3 className="text-lg font-medium mb-2">No recent activity</h3>
              <p className="text-muted-foreground">Your activity will appear here</p>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default ProfileContent;
