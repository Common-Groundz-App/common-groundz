
import React from 'react';
import { Button } from '@/components/ui/button';
import { Link } from 'react-router-dom';
import { Star, Heart, Compass } from 'lucide-react';

const Header = () => {
  return (
    <header className="fixed top-0 left-0 right-0 bg-background/90 backdrop-blur-sm z-50 border-b">
      <div className="container mx-auto px-4 py-3 flex items-center justify-between">
        <div className="flex items-center">
          <Link to="/" className="flex items-center gap-2 text-xl font-bold text-primary">
            <div className="relative">
              <Star className="h-6 w-6 text-primary" />
              <Heart className="h-3 w-3 text-primary absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2" />
            </div>
            <span>Common Groundz</span>
          </Link>
        </div>
        <div className="flex items-center space-x-3">
          <Button size="sm" variant="ghost" className="hidden md:inline-flex">
            <Link to="/entity/the-office" className="flex items-center gap-1">
              <Compass className="h-4 w-4" />
              <span>Explore</span>
            </Link>
          </Button>
          <Button size="sm" className="hidden md:inline-flex bg-secondary hover:bg-secondary/90 text-secondary-foreground">
            <Link to="/auth">Sign In</Link>
          </Button>
          <Button size="sm" className="bg-primary hover:bg-primary/90">
            <Link to="/auth?tab=signup">Sign Up</Link>
          </Button>
        </div>
      </div>
    </header>
  );
};

export default Header;
