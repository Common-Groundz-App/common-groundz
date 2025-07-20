
import React from 'react';
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Card, CardContent } from "@/components/ui/card";
import { Entity } from '@/services/recommendation/types';

interface EntityTabsContentProps {
  entity: Entity;
}

export const EntityTabsContent: React.FC<EntityTabsContentProps> = ({ entity }) => {
  const featuredProducts = [
    {
      name: "Whey Protein Isolate",
      description: "Premium quality protein powder",
      rating: 4.5,
      reviewCount: 234
    },
    {
      name: "Complete Multivitamin",
      description: "Essential vitamins and minerals",
      rating: 4.3,
      reviewCount: 189
    }
  ];

  const latestPosts = [
    {
      title: "New Product Launch: Plant-Based Protein",
      excerpt: "We're excited to announce our latest addition to the Cosmix family...",
      date: "2 days ago"
    },
    {
      title: "The Science Behind Whey Protein",
      excerpt: "Understanding the benefits and optimal usage of whey protein...",
      date: "1 week ago"
    }
  ];

  return (
    <Tabs defaultValue="overview" className="mb-8">
      <TabsList className="grid w-full grid-cols-3">
        <TabsTrigger value="overview">Overview</TabsTrigger>
        <TabsTrigger value="products">Products</TabsTrigger>
        <TabsTrigger value="posts">Posts</TabsTrigger>
      </TabsList>
      
      <TabsContent value="overview" className="mt-6">
        <Card>
          <CardContent className="p-6">
            <h3 className="font-semibold mb-4">Company Overview</h3>
            <div className="space-y-4">
              <p className="text-gray-600 leading-relaxed">
                {entity.name} is a leading health and wellness brand that has been at the forefront of providing 
                science-backed nutrition solutions for over a decade. Founded with the mission to make 
                premium supplements accessible to everyone, we focus on quality, transparency, and innovation.
              </p>
              
              {entity.description && (
                <div>
                  <h4 className="font-medium mb-2">About {entity.name}</h4>
                  <p className="text-gray-600 leading-relaxed">{entity.description}</p>
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-6">
                <div>
                  <h4 className="font-medium mb-3">Our Mission</h4>
                  <p className="text-sm text-gray-600">
                    To empower individuals on their health journey by providing premium, 
                    science-backed nutritional supplements that deliver real results.
                  </p>
                </div>
                <div>
                  <h4 className="font-medium mb-3">Our Values</h4>
                  <ul className="text-sm text-gray-600 space-y-1">
                    <li>• Quality & Transparency</li>
                    <li>• Science-Based Formulations</li>
                    <li>• Customer-Centric Approach</li>
                    <li>• Sustainable Practices</li>
                  </ul>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </TabsContent>
      
      <TabsContent value="products" className="mt-6">
        <Card>
          <CardContent className="p-6">
            <h3 className="font-semibold mb-4">Featured Products</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {featuredProducts.map((product, index) => (
                <div key={index} className="border rounded-lg p-4 hover:shadow-md transition-shadow">
                  <h4 className="font-medium mb-2">{product.name}</h4>
                  <p className="text-sm text-gray-600 mb-3">{product.description}</p>
                  <div className="flex items-center gap-1">
                    <div className="w-4 h-4 bg-yellow-400 rounded" />
                    <span className="text-sm font-medium">{product.rating}</span>
                    <span className="text-sm text-gray-500">({product.reviewCount} reviews)</span>
                  </div>
                </div>
              ))}
            </div>
            
            <div className="mt-6 p-4 bg-blue-50 rounded-lg">
              <h4 className="font-medium text-blue-900 mb-2">Why Choose Our Products?</h4>
              <ul className="text-sm text-blue-800 space-y-1">
                <li>• Third-party tested for purity and potency</li>
                <li>• No artificial fillers or unnecessary additives</li>
                <li>• Manufactured in GMP-certified facilities</li>
                <li>• 100% satisfaction guarantee</li>
              </ul>
            </div>
          </CardContent>
        </Card>
      </TabsContent>
      
      <TabsContent value="posts" className="mt-6">
        <Card>
          <CardContent className="p-6">
            <h3 className="font-semibold mb-4">Latest Posts</h3>
            <div className="space-y-4">
              {latestPosts.map((post, index) => (
                <div key={index} className="border-b pb-4 last:border-b-0">
                  <h4 className="font-medium mb-2 hover:text-blue-600 cursor-pointer">
                    {post.title}
                  </h4>
                  <p className="text-sm text-gray-600 mb-2">{post.excerpt}</p>
                  <span className="text-xs text-gray-400">{post.date}</span>
                </div>
              ))}
            </div>
            
            <div className="mt-6 text-center">
              <button className="text-blue-600 hover:underline text-sm font-medium">
                View All Posts
              </button>
            </div>
          </CardContent>
        </Card>
      </TabsContent>
    </Tabs>
  );
};
