
import React from 'react';
import { Card, CardContent } from "@/components/ui/card";

type RecommendationItem = {
  id: string;
  title: string;
  venue: string;
  rating: number;
  image: string;
  isCertified: boolean;
};

const dummyRecommendations: RecommendationItem[] = [
  {
    id: '1',
    title: 'Truffle Fries',
    venue: 'Smoke House Deli',
    rating: 4.6,
    image: 'https://images.unsplash.com/photo-1630384060421-cb20d0e0649d',
    isCertified: true
  },
  {
    id: '2',
    title: 'Margherita Pizza',
    venue: 'Pizzeria Locale',
    rating: 4.2,
    image: 'https://images.unsplash.com/photo-1513104890138-7c749659a591',
    isCertified: true
  },
  {
    id: '3',
    title: 'French Press',
    venue: 'by Bodum',
    rating: 4.5,
    image: 'https://images.unsplash.com/photo-1557142046-c704a3adf364',
    isCertified: true
  },
  {
    id: '4',
    title: 'French Press',
    venue: 'by Bodum',
    rating: 4.5,
    image: 'https://images.unsplash.com/photo-1557142046-c704a3adf364',
    isCertified: true
  },
  {
    id: '5',
    title: 'Bluetooth Speakers',
    venue: 'by JBL',
    rating: 4.3,
    image: 'https://images.unsplash.com/photo-1563330232-57114bb0823c',
    isCertified: true
  },
  {
    id: '6',
    title: 'Bluetooth Speakers',
    venue: 'by JBL',
    rating: 4.3,
    image: 'https://images.unsplash.com/photo-1563330232-57114bb0823c',
    isCertified: true
  }
];

const RatingStars = ({ rating }: { rating: number }) => {
  return (
    <div className="flex items-center">
      {[1, 2, 3, 4, 5].map((star) => (
        <div key={star} className={`w-5 h-5 rounded-full mr-1 
          ${star <= Math.floor(rating) 
            ? 'bg-green-500' 
            : star === Math.ceil(rating) && star > Math.floor(rating)
              ? 'bg-yellow-500'
              : 'bg-gray-300'
          }`} 
        />
      ))}
      <span className="ml-2 font-bold text-xl">{rating}</span>
    </div>
  );
};

const ProfileRecommendations = () => {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
      {dummyRecommendations.map((item) => (
        <Card key={item.id} className="overflow-hidden hover:shadow-lg transition-shadow">
          <div className="relative h-48">
            <img 
              src={item.image} 
              alt={item.title} 
              className="w-full h-full object-cover"
            />
          </div>
          <CardContent className="p-4">
            <h3 className="text-xl font-bold mb-1">{item.title}</h3>
            <p className="text-gray-600 mb-3">{item.venue}</p>
            
            <RatingStars rating={item.rating} />
            
            {item.isCertified && (
              <div className="mt-2 text-sm text-gray-700">
                Groundz Certified
              </div>
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  );
};

export default ProfileRecommendations;
