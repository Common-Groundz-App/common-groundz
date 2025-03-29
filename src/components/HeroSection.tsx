
import React, { useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Star, Book, Film, Sun, Heart } from 'lucide-react';
import GlowElements from './GlowElements';
import { motion } from "framer-motion";
import { Glow } from '@/components/ui/glow';

const HeroSection = () => {
  const [titleNumber, setTitleNumber] = useState(0);
  const titles = useMemo(
    () => ["you trust", "like you"],
    []
  );

  useEffect(() => {
    const timeoutId = setTimeout(() => {
      if (titleNumber === titles.length - 1) {
        setTitleNumber(0);
      } else {
        setTitleNumber(titleNumber + 1);
      }
    }, 2500);
    return () => clearTimeout(timeoutId);
  }, [titleNumber, titles]);

  return (
    <section className="pt-36 pb-16 md:pt-44 md:pb-24 relative overflow-hidden">
      <div className="container mx-auto px-4">
        <div className="flex flex-col items-center text-center mb-16 relative">
          <GlowElements />
          <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold mb-6 leading-tight max-w-4xl relative z-10">
            Recommendations from{" "}
            <span className="relative inline-block overflow-hidden pb-2">
              <span className="invisible">people you trust</span>
              {titles.map((title, index) => (
                <motion.span
                  key={index}
                  className="absolute inset-0 text-primary whitespace-nowrap"
                  initial={{ opacity: 0, y: "50px" }}
                  transition={{ type: "spring", stiffness: 50 }}
                  animate={
                    titleNumber === index
                      ? {
                          y: 0,
                          opacity: 1,
                        }
                      : {
                          y: titleNumber > index ? -80 : 80,
                          opacity: 0,
                        }
                  }
                >
                  people {title}
                </motion.span>
              ))}
            </span>
          </h1>
          <p className="text-xl text-muted-foreground mb-8 max-w-2xl relative z-10">
            Discover the best books, movies, products, and more - recommended by your friends, family, and trusted circle.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 relative z-10">
            <Button size="lg" className="px-8">Get Started</Button>
            <Button size="lg" variant="outline" className="px-8">Learn More</Button>
          </div>
        </div>
        
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 animate-fade-in relative z-10" style={{
          animationDelay: '0.2s'
        }}>
          <CategoryCard icon={<Book className="h-10 w-10 text-brand-orange" />} title="Books" description="Find your next great read" className="bg-brand-orange/10" />
          <CategoryCard icon={<Film className="h-10 w-10 text-brand-blue" />} title="Movies" description="What to watch next" className="bg-brand-blue/10" />
          <CategoryCard icon={<Sun className="h-10 w-10 text-brand-teal" />} title="Products" description="Genuine product reviews" className="bg-brand-teal/10" />
          <CategoryCard icon={<div className="relative">
              <Star className="h-10 w-10 text-primary" />
              <Heart className="h-5 w-5 text-primary absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2" />
            </div>} title="And More" description="Any recommendation" className="bg-primary/10" />
        </div>
      </div>
      
      {/* Brand color orange glow at the bottom */}
      <Glow variant="bottom" className="opacity-80" />
    </section>
  );
};

interface CategoryCardProps {
  icon: React.ReactNode;
  title: string;
  description: string;
  className?: string;
}

const CategoryCard = ({
  icon,
  title,
  description,
  className
}: CategoryCardProps) => {
  return (
    <div className={`p-6 rounded-lg card-hover ${className}`}>
      <div className="mb-4">{icon}</div>
      <h3 className="font-bold text-lg mb-1">{title}</h3>
      <p className="text-sm text-muted-foreground">{description}</p>
    </div>
  );
};

export default HeroSection;
