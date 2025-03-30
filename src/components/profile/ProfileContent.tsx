
import React, { useState } from 'react';
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Card, CardContent } from "@/components/ui/card";
import { AspectRatio } from "@/components/ui/aspect-ratio";
import { CircleBadge } from "@/components/profile/CircleBadge";
import { Badge } from "@/components/ui/badge";

// Mock data for recommendations
const mockRecommendations = [
  {
    id: 1,
    title: "Mountain Sunrise View",
    category: "Travel",
    score: 4.9,
    circleCertified: true,
    reason: "Breathtaking views and peaceful atmosphere",
    image: "/lovable-uploads/a9d5589a-01ed-4fc1-84ba-67233d6d9412.png"
  },
  {
    id: 2,
    title: "Ocean Blue Waters",
    category: "Travel",
    score: 4.7,
    circleCertified: true,
    reason: "Crystal clear water and amazing marine life",
    image: "/lovable-uploads/a9d5589a-01ed-4fc1-84ba-67233d6d9412.png"
  },
  {
    id: 3,
    title: "Mountain Range",
    category: "Travel",
    score: 4.8,
    circleCertified: false,
    reason: "Majestic views and great hiking trails",
    image: "/lovable-uploads/a9d5589a-01ed-4fc1-84ba-67233d6d9412.png"
  },
  {
    id: 4,
    title: "Winter Landscape",
    category: "Photography",
    score: 4.6,
    circleCertified: false,
    reason: "Perfect lighting and composition",
    image: "/lovable-uploads/a9d5589a-01ed-4fc1-84ba-67233d6d9412.png"
  },
];

const EmptyState = () => (
  <div className="flex flex-col items-center justify-center py-12">
    <h3 className="text-xl font-medium mb-4">Looks like you haven't recommended anything yet.</h3>
    <button className="bg-brand-orange text-white px-4 py-2 rounded-md flex items-center">
      <span className="mr-2">+</span>
      Add Your First Recommendation
    </button>
  </div>
);

const ProfileContent = () => {
  const [activeTab, setActiveTab] = useState("recommendations");
  
  return (
    <div>
      <Tabs defaultValue="recommendations" className="w-full">
        <TabsList className="grid grid-cols-3 mb-6">
          <TabsTrigger value="recommendations">Recommendations</TabsTrigger>
          <TabsTrigger value="updates">Updates</TabsTrigger>
          <TabsTrigger value="liked">Liked Items</TabsTrigger>
        </TabsList>
        
        <TabsContent value="recommendations">
          {mockRecommendations.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-2 gap-4">
              {mockRecommendations.map((item) => (
                <Card key={item.id} className="overflow-hidden card-hover">
                  <div className="relative">
                    <AspectRatio ratio={16/9}>
                      <img
                        src={item.image}
                        alt={item.title}
                        className="object-cover w-full h-full"
                      />
                    </AspectRatio>
                    {item.circleCertified && (
                      <div className="absolute top-2 right-2">
                        <CircleBadge />
                      </div>
                    )}
                    <div className="absolute bottom-2 right-2">
                      <div className="bg-black/70 text-white px-2 py-1 rounded-full text-sm flex items-center">
                        <span className="text-brand-orange mr-1">★</span>
                        {item.score}
                      </div>
                    </div>
                  </div>
                  <CardContent className="p-4">
                    <h3 className="font-semibold text-lg">{item.title}</h3>
                    <div className="flex items-center mb-2">
                      <Badge variant="secondary" className="text-xs">
                        {item.category}
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground line-clamp-2">{item.reason}</p>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <EmptyState />
          )}
        </TabsContent>
        
        <TabsContent value="updates">
          <EmptyState />
        </TabsContent>
        
        <TabsContent value="liked">
          <EmptyState />
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default ProfileContent;
