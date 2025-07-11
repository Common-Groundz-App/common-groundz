
import React from 'react';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';

export const TabsNavigation = () => {
  const scrollToSection = (sectionId: string) => {
    const element = document.getElementById(sectionId);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth' });
    }
  };

  return (
    <div className="sticky top-20 z-10 bg-background/80 backdrop-blur-sm py-4 -mx-4 px-4 border-b">
      <Tabs defaultValue="overview" className="w-full">
        <TabsList className="grid w-full max-w-md grid-cols-3">
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
      </Tabs>
    </div>
  );
};
