
import { Home, Star, Book, Film, Heart } from 'lucide-react';
import { TubelightNavBar } from "@/components/ui/tubelight-navbar";

export function TubelightNavBarDemo() {
  const navItems = [
    { name: 'Home', url: '/', icon: Home },
    { name: 'Books', url: '/books', icon: Book },
    { name: 'Movies', url: '/movies', icon: Film },
    { name: 'Favorites', url: '/favorites', icon: Heart }
  ];

  return (
    <div className="relative z-50">
      <TubelightNavBar items={navItems} demoMode={true} className="mb-20 sm:mb-0" />
    </div>
  );
}
