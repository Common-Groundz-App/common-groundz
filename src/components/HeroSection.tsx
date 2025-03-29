
import React from 'react';
import { Button } from '@/components/ui/button';
import { Book, Film, Sun, Heart, Star, ArrowRightIcon } from 'lucide-react';
import { HeroSection as HeroUI } from '@/components/ui/hero-section';
import { Icons } from '@/components/ui/icons';

const HeroSection = () => {
  return (
    <HeroUI
      badge={{
        text: "Discover your next favorite thing",
        action: {
          text: "Learn how",
          href: "#features",
        },
      }}
      title="Recommendations from people you trust"
      description="Discover the best books, movies, products, and more - recommended by your friends, family, and trusted circle."
      actions={[
        {
          text: "Get Started",
          href: "#",
          variant: "default",
        },
        {
          text: "Learn More",
          href: "#features",
          variant: "glow",
        },
      ]}
      image={{
        light: "https://images.unsplash.com/photo-1482938289607-e9573fc25ebb",
        dark: "https://images.unsplash.com/photo-1482938289607-e9573fc25ebb",
        alt: "A beautiful landscape with recommendations",
      }}
    />
  );
};

export default HeroSection;
