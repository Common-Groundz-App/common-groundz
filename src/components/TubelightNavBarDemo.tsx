
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
    <div className="flex flex-col items-center justify-center w-full py-8">
      <h3 className="text-xl font-semibold mb-4">Tubelight Navigation</h3>
      <div className="w-full max-w-md mx-auto">
        <TubelightNavBar items={navItems} demoMode={true} />
      </div>
    </div>
  );
}
