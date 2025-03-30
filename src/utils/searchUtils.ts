
import { User, Hash, Star, Coffee, Pizza } from "lucide-react";
import React from "react";

// Export type for search results so it can be used elsewhere
export type SearchResult = {
  id: string;
  type: "user" | "recommendation" | "feature" | "product" | "food";
  title: string;
  subtitle?: string;
  imageUrl?: string;
  location?: string;
  memberSince?: string;
  followingCount?: number;
};

// Mock data - in a real app, this would come from an API
export const mockSearchResults: SearchResult[] = [
  {
    id: "user1",
    type: "user",
    title: "Hana Li",
    subtitle: "Food Enthusiast",
    imageUrl: "https://uyjtgybbktgapspodajy.supabase.co/storage/v1/object/public/profile_images/abfcbf43-b985-40dc-933c-201e5448b794/avatar.png",
    location: "New York, NY",
    memberSince: "January 2021",
    followingCount: 120
  },
  {
    id: "user2",
    type: "user",
    title: "Sam Johnson",
    subtitle: "Photographer",
    location: "Brooklyn, NY",
    memberSince: "March 2022",
    followingCount: 85
  },
  {
    id: "rec1",
    type: "recommendation",
    title: "Coffee Shops in Brooklyn",
    subtitle: "15 places to visit",
  },
  {
    id: "feat1",
    type: "feature",
    title: "Community Events",
    subtitle: "Find events in your area",
  },
];

// Sample data for products and foods
export const sampleProducts: SearchResult[] = [
  {
    id: "prod1",
    type: "product",
    title: "Smart Watch",
    subtitle: "Fitness tracker with heart rate monitor",
    imageUrl: "https://images.unsplash.com/photo-1523275335684-37898b6baf30?auto=format&fit=crop&w=300&q=80"
  },
  {
    id: "prod2",
    type: "product",
    title: "Wireless Headphones",
    subtitle: "Noise-cancelling with 20hr battery life",
    imageUrl: "https://images.unsplash.com/photo-1505740420928-5e560c06d30e?auto=format&fit=crop&w=300&q=80"
  }
];

export const sampleFoods: SearchResult[] = [
  {
    id: "food1",
    type: "food",
    title: "Margherita Pizza",
    subtitle: "Classic Italian pizza with tomato and mozzarella",
    imageUrl: "https://images.unsplash.com/photo-1513104890138-7c749659a591?auto=format&fit=crop&w=300&q=80"
  },
  {
    id: "food2",
    type: "food",
    title: "Cappuccino",
    subtitle: "Espresso with steamed milk and foam",
    imageUrl: "https://images.unsplash.com/photo-1572442388796-11668a67e53d?auto=format&fit=crop&w=300&q=80"
  }
];

// Utility function to get the appropriate icon for a result type
export const getIconForType = (type: SearchResult["type"], title: string): React.ReactNode => {
  switch (type) {
    case "product":
      return <Star className="mr-2 h-4 w-4" />;
    case "food":
      return title.includes("Pizza") ? 
        <Pizza className="mr-2 h-4 w-4" /> : 
        <Coffee className="mr-2 h-4 w-4" />;
    case "user":
      return <User className="mr-2 h-4 w-4" />;
    default:
      return <Hash className="mr-2 h-4 w-4" />;
  }
};
