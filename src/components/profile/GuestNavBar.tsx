import React from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';

const GuestNavBar: React.FC = () => {
  return (
    <header className="sticky top-0 z-50 w-full border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="max-w-7xl mx-auto flex h-14 items-center justify-between px-4 sm:px-6">
        <Link to="/" className="flex items-center gap-2 font-bold text-lg text-foreground">
          Common Groundz
        </Link>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" asChild>
            <Link to="/auth">Log In</Link>
          </Button>
          <Button size="sm" asChild>
            <Link to="/auth?tab=signup">Sign Up</Link>
          </Button>
        </div>
      </div>
    </header>
  );
};

export default GuestNavBar;
