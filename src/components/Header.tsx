
import React from 'react';
import { Button } from '@/components/ui/button';
import { Link } from 'react-router-dom';
import { Coffee } from 'lucide-react';

const Header = () => {
  return (
    <header className="fixed top-0 left-0 right-0 bg-background/90 backdrop-blur-sm z-50 border-b">
      <div className="container mx-auto px-4 py-3 flex items-center justify-between">
        <div className="flex items-center">
          <Link to="/" className="flex items-center gap-2 text-xl font-bold text-primary">
            <Coffee className="h-6 w-6" />
            <span>Common Groundz</span>
          </Link>
        </div>
        <nav className="hidden md:flex space-x-6">
          <a href="#features" className="text-foreground/80 hover:text-primary transition-colors">Features</a>
          <a href="#testimonials" className="text-foreground/80 hover:text-primary transition-colors">Testimonials</a>
        </nav>
        <div className="flex items-center space-x-3">
          <Button variant="outline" size="sm" className="hidden md:inline-flex">Log In</Button>
          <Button size="sm">Sign Up</Button>
        </div>
      </div>
    </header>
  );
};

export default Header;
