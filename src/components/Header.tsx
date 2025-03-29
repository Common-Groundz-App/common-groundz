
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
          <NeonButton variant="default" size="sm" className="hidden md:inline-flex">
            <Link to="/auth" className="flex items-center h-full w-full">Log In</Link>
          </NeonButton>
          <DefaultButton size="sm">
            <Link to="/auth?tab=signup">Sign Up</Link>
          </DefaultButton>
        </div>
      </div>
    </header>
  );
};

export default Header;
