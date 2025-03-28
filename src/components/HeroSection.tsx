
import React from 'react';
import { Button } from '@/components/ui/button';
import { Star, Book, Film, Sun, CircleDot } from 'lucide-react';

const HeroSection = () => {
  return (
    <section className="pt-28 pb-16 md:pt-32 md:pb-24">
      <div className="container mx-auto px-4">
        <div className="flex flex-col md:flex-row items-center">
          <div className="md:w-1/2 mb-10 md:mb-0 md:pr-10 animate-fade-in">
            <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold mb-6 leading-tight">
              Recommendations from <span className="text-primary">people you trust</span>
            </h1>
            <p className="text-xl text-muted-foreground mb-8 max-w-lg">
              Discover the best books, movies, products, and more - recommended by your friends, family, and trusted circle.
            </p>
            <div className="flex flex-col sm:flex-row gap-4">
              <Button size="lg" className="px-8">Get Started</Button>
              <Button size="lg" variant="outline" className="px-8">Learn More</Button>
            </div>
          </div>
          <div className="md:w-1/2 relative animate-fade-in" style={{animationDelay: '0.2s'}}>
            <div className="grid grid-cols-2 gap-4">
              <CategoryCard 
                icon={<Book className="h-10 w-10 text-brand-orange" />}
                title="Books"
                description="Find your next great read"
                className="bg-brand-orange/10"
              />
              <CategoryCard 
                icon={<Film className="h-10 w-10 text-brand-blue" />}
                title="Movies"
                description="What to watch next"
                className="bg-brand-blue/10"
              />
              <CategoryCard 
                icon={<Sun className="h-10 w-10 text-brand-teal" />}
                title="Products"
                description="Genuine product reviews"
                className="bg-brand-teal/10"
              />
              <CategoryCard 
                icon={<div className="relative h-10 w-10">
                  <CircleDot className="h-10 w-10 text-primary absolute left-0 opacity-80" />
                  <CircleDot className="h-10 w-10 text-primary absolute left-2 top-1 opacity-80" />
                </div>}
                title="And More"
                description="Any recommendation"
                className="bg-primary/10"
              />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

interface CategoryCardProps {
  icon: React.ReactNode;
  title: string;
  description: string;
  className?: string;
}

const CategoryCard = ({ icon, title, description, className }: CategoryCardProps) => {
  return (
    <div className={`p-6 rounded-lg card-hover ${className}`}>
      <div className="mb-4">{icon}</div>
      <h3 className="font-bold text-lg mb-1">{title}</h3>
      <p className="text-sm text-muted-foreground">{description}</p>
    </div>
  );
};

export default HeroSection;
