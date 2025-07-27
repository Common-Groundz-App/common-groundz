
import React from 'react';
import { Star } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { PhotosSection } from './PhotosSection';
import { Entity } from '@/services/recommendation/types';

export const EntityTabsContent: React.FC<{ entity?: Entity }> = ({ entity }) => {
  return (
    <Tabs defaultValue="overview" className="mb-8">
      <TabsList className="grid w-full grid-cols-4">
        <TabsTrigger value="overview">Overview</TabsTrigger>
        <TabsTrigger value="photos">Photos & Videos</TabsTrigger>
        <TabsTrigger value="products">Products</TabsTrigger>
        <TabsTrigger value="posts">Posts</TabsTrigger>
      </TabsList>
      <TabsContent value="overview" className="mt-6">
        <Card>
          <CardContent className="p-6">
            <h3 className="font-semibold mb-4">Company Overview</h3>
            <p className="text-gray-600 leading-relaxed">
              Cosmix is a leading health and wellness brand that has been at the forefront of providing 
              science-backed nutrition solutions for over a decade. Founded with the mission to make 
              premium supplements accessible to everyone, we focus on quality, transparency, and innovation.
            </p>
          </CardContent>
        </Card>
      </TabsContent>
      <TabsContent value="products" className="mt-6">
        <Card>
          <CardContent className="p-6">
            <h3 className="font-semibold mb-4">Featured Products</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="border rounded-lg p-4">
                <h4 className="font-medium">Whey Protein Isolate</h4>
                <p className="text-sm text-gray-600">Premium quality protein powder</p>
                <div className="flex items-center gap-1 mt-2">
                  <Star className="w-4 h-4 fill-yellow-400 text-yellow-400" />
                  <span className="text-sm">4.5 (234 reviews)</span>
                </div>
              </div>
              <div className="border rounded-lg p-4">
                <h4 className="font-medium">Complete Multivitamin</h4>
                <p className="text-sm text-gray-600">Essential vitamins and minerals</p>
                <div className="flex items-center gap-1 mt-2">
                  <Star className="w-4 h-4 fill-yellow-400 text-yellow-400" />
                  <span className="text-sm">4.3 (189 reviews)</span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </TabsContent>
      <TabsContent value="photos" className="mt-6">
        {entity && <PhotosSection entity={entity} />}
      </TabsContent>
      <TabsContent value="posts" className="mt-6">
        <Card>
          <CardContent className="p-6">
            <h3 className="font-semibold mb-4">Latest Posts</h3>
            <div className="space-y-4">
              <div className="border-b pb-4">
                <h4 className="font-medium mb-2">New Product Launch: Plant-Based Protein</h4>
                <p className="text-sm text-gray-600">We're excited to announce our latest addition to the Cosmix family...</p>
                <span className="text-xs text-gray-400">2 days ago</span>
              </div>
              <div className="border-b pb-4">
                <h4 className="font-medium mb-2">The Science Behind Whey Protein</h4>
                <p className="text-sm text-gray-600">Understanding the benefits and optimal usage of whey protein...</p>
                <span className="text-xs text-gray-400">1 week ago</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </TabsContent>
    </Tabs>
  );
};
