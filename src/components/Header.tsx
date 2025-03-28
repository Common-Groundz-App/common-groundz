
import React from 'react';
import { Button } from '@/components/ui/button';
import { Link } from 'react-router-dom';
import { Star, Heart, Home, Book, Film } from 'lucide-react';
import { TubelightNavBar } from '@/components/ui/tubelight-navbar';

const Header = () => {
  const navItems = [
    { name: 'Home', url: '/', icon: Home },
    { name: 'Books', url: '/books', icon: Book },
    { name: 'Movies', url: '/movies', icon: Film },
    { name: 'Favorites', url: '/favorites', icon: Heart }
  ];

  return (
    <>
      <header className="fixed top-0 left-0 right-0 bg-background/90 backdrop-blur-sm z-40 border-b">
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
          
          {/* Hide on mobile as we'll use the tubelight navbar on mobile */}
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
      
      {/* Tubelight navbar for mobile - move it outside the header for better positioning */}
      <div className="block md:hidden">
        <TubelightNavBar items={navItems} className="fixed bottom-0 left-0 right-0 z-50 mb-4" />
      </div>
    </>
  );
};

export default Header;
