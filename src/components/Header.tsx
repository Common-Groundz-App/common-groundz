
import React from 'react';
import { Button as DefaultButton } from '@/components/ui/button';
import { Button as NeonButton } from '@/components/ui/neon-button';
import { Link } from 'react-router-dom';
import { Star, Heart } from 'lucide-react';

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
          <Link to="/auth" className="hidden md:inline-flex">
            <DefaultButton 
              variant="outline" 
              size="sm"
              className="border-primary/30 hover:bg-primary/5 text-primary"
            >
              Sign In
            </DefaultButton>
          </Link>
          <Link to="/auth?tab=signup">
            <DefaultButton 
              size="sm" 
              className="bg-primary hover:bg-primary/90"
            >
              Sign Up
            </DefaultButton>
          </Link>
        </div>
      </div>
    </header>
  );
};

export default Header;
