
import React from 'react';
import { MessageSquare, Heart, Coffee } from 'lucide-react';

// Features or benefits to display on the authentication page
const features = [
  { 
    icon: <MessageSquare className="h-6 w-6 text-brand-orange" />, 
    title: "Trusted Recommendations", 
    description: "Find recommendations from people you know and trust."
  },
  { 
    icon: <Heart className="h-6 w-6 text-brand-blue" />, 
    title: "Share What You Love", 
    description: "Easily share your favorite books, movies, and more."
  },
  { 
    icon: <Coffee className="h-6 w-6 text-brand-teal" />, 
    title: "Discover New Favorites", 
    description: "Expand your horizons with new discoveries from your network."
  }
];

const AuthFeatures = () => {
  return (
    <div className="space-y-6">
      {features.map((feature, index) => (
        <div 
          key={index} 
          className="flex items-start p-4 rounded-lg bg-white/50 backdrop-blur-sm shadow-sm dark:bg-background/40 dark:backdrop-blur-md dark:border dark:border-border/10"
        >
          <div className="mr-4 mt-1">{feature.icon}</div>
          <div className="text-left">
            <h3 className="font-medium text-foreground dark:text-white">{feature.title}</h3>
            <p className="text-sm text-muted-foreground dark:text-white/70">{feature.description}</p>
          </div>
        </div>
      ))}
    </div>
  );
};

export default AuthFeatures;
