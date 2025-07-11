
import React from 'react';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';

export const TabsNavigation = () => {
  const scrollToSection = (sectionId: string) => {
    const element = document.getElementById(sectionId);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth' });
    }
  };

  return (
    <div className="sticky top-20 z-10 bg-background py-4 border-b">
      <Tabs defaultValue="overview" className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger 
            value="overview" 
            onClick={() => scrollToSection('overview')}
          >
            Overview
          </TabsTrigger>
          <TabsTrigger 
            value="products" 
            onClick={() => scrollToSection('products')}
          >
            Products
          </TabsTrigger>
          <TabsTrigger 
            value="posts" 
            onClick={() => scrollToSection('posts')}
          >
            Posts
          </TabsTrigger>
        </TabsList>
        
        {/* Content sections will be handled by the parent component */}
        <TabsContent value="overview" className="sr-only">Overview content</TabsContent>
        <TabsContent value="products" className="sr-only">Products content</TabsContent>
        <TabsContent value="posts" className="sr-only">Posts content</TabsContent>
      </Tabs>
    </div>
  );
};
