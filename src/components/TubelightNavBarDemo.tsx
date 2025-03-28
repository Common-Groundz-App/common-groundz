
import { Home, Star, Book, Film, Heart } from 'lucide-react';
import { TubelightNavBar } from "@/components/ui/tubelight-navbar";

export function TubelightNavBarDemo() {
  const navItems = [
    { name: 'Home', url: '/', icon: Home },
    { name: 'Books', url: '/books', icon: Book },
    { name: 'Movies', url: '/movies', icon: Film },
    { name: 'Favorites', url: '/favorites', icon: Heart }
  ];

  // Using demoMode=true to avoid Router context requirement
  return <TubelightNavBar items={navItems} demoMode={true} />;
}
