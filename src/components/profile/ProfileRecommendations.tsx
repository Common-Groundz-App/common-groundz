import React from 'react';
import { Card, CardContent } from "@/components/ui/card";
import { Heart, Star, Award, Bookmark } from 'lucide-react';
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
type RecommendationItem = {
  id: string;
  title: string;
  venue: string;
  rating: number;
  image: string;
  isCertified: boolean;
  category?: string;
  likes?: number;
};
const dummyRecommendations: RecommendationItem[] = [{
  id: '1',
  title: 'Truffle Fries',
  venue: 'Smoke House Deli',
  rating: 4.6,
  image: 'https://images.unsplash.com/photo-1630384060421-cb20d0e0649d',
  isCertified: true,
  category: 'Food',
  likes: 43
}, {
  id: '2',
  title: 'Margherita Pizza',
  venue: 'Pizzeria Locale',
  rating: 4.2,
  image: 'https://images.unsplash.com/photo-1513104890138-7c749659a591',
  isCertified: true,
  category: 'Food',
  likes: 29
}, {
  id: '3',
  title: 'French Press Coffee',
  venue: 'Artisan Cafe',
  rating: 4.5,
  image: 'https://images.unsplash.com/photo-1557142046-c704a3adf364',
  isCertified: true,
  category: 'Drinks',
  likes: 37
}, {
  id: '4',
  title: 'Wireless Headphones',
  venue: 'Tech Emporium',
  rating: 4.3,
  image: 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e',
  isCertified: true,
  category: 'Gadgets',
  likes: 21
}, {
  id: '5',
  title: 'Bluetooth Speakers',
  venue: 'Sound Studio',
  rating: 4.3,
  image: 'https://images.unsplash.com/photo-1563330232-57114bb0823c',
  isCertified: true,
  category: 'Gadgets',
  likes: 18
}, {
  id: '6',
  title: 'Handcrafted Leather Wallet',
  venue: 'Artisan Market',
  rating: 4.7,
  image: 'https://images.unsplash.com/photo-1627123423521-013e47bffe3c',
  isCertified: true,
  category: 'Accessories',
  likes: 32
}];
const RatingStars = ({
  rating
}: {
  rating: number;
}) => {
  return <div className="flex items-center">
      {[1, 2, 3, 4, 5].map(star => <Star key={star} size={16} className={cn("mr-1", star <= Math.floor(rating) ? "fill-brand-orange text-brand-orange" : star === Math.ceil(rating) && star > Math.floor(rating) ? "fill-brand-orange/50 text-brand-orange/50" : "text-gray-300")} />)}
      <span className="ml-2 font-bold text-sm">{rating.toFixed(1)}</span>
    </div>;
};
const ProfileRecommendations = () => {
  return <div className="space-y-6 mx-0 my-0">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-xl font-semibold">My Recommendations</h2>
        <Button variant="outline" size="sm">Filter</Button>
      </div>
      
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        {dummyRecommendations.map(item => <Card key={item.id} className="overflow-hidden hover:shadow-lg transition-all duration-300 hover:-translate-y-1 border border-gray-200">
            <div className="relative">
              <div className="absolute top-3 left-3 z-10">
                <Badge variant="secondary" className="bg-black/70 hover:bg-black/80 text-white">
                  {item.category}
                </Badge>
              </div>
              {item.isCertified && <div className="absolute top-3 right-3 z-10">
                  <Badge variant="secondary" className="bg-brand-orange hover:bg-brand-orange/90 text-white flex items-center gap-1">
                    <Award size={12} />
                    <span>Certified</span>
                  </Badge>
                </div>}
              <div className="h-48 relative overflow-hidden group">
                <img src={item.image} alt={item.title} className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110" />
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
              </div>
            </div>
            
            <CardContent className="p-4">
              <div className="flex justify-between items-start mb-2">
                <h3 className="text-lg font-bold line-clamp-1">{item.title}</h3>
                <Button variant="ghost" size="icon" className="h-8 w-8 text-gray-500 hover:text-brand-orange">
                  <Bookmark size={18} />
                </Button>
              </div>
              
              <p className="text-gray-600 mb-3 text-sm">{item.venue}</p>
              
              <RatingStars rating={item.rating} />
              
              <div className="mt-4 pt-3 border-t border-gray-100 flex justify-between items-center">
                <Button variant="ghost" size="sm" className="text-gray-500 hover:text-brand-orange flex items-center gap-1 px-2">
                  <Heart size={16} />
                  <span>{item.likes}</span>
                </Button>
                <Button variant="outline" size="sm" className="text-xs">
                  View Details
                </Button>
              </div>
            </CardContent>
          </Card>)}
      </div>
    </div>;
};
export default ProfileRecommendations;