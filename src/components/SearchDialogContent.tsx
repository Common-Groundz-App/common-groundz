
import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  CommandInput,
  CommandList,
  CommandEmpty,
  CommandGroup,
  CommandItem,
} from "@/components/ui/command";
import { User, Hash, Star } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

type SearchResult = {
  id: string;
  type: "user" | "recommendation" | "feature";
  title: string;
  subtitle?: string;
  imageUrl?: string;
};

// Mock data - in a real app, this would come from an API
const mockSearchResults: SearchResult[] = [
  {
    id: "user1",
    type: "user",
    title: "Hana Li",
    subtitle: "Food Enthusiast",
    imageUrl: "https://uyjtgybbktgapspodajy.supabase.co/storage/v1/object/public/profile_images/abfcbf43-b985-40dc-933c-201e5448b794/avatar.png",
  },
  {
    id: "user2",
    type: "user",
    title: "Sam Johnson",
    subtitle: "Photographer",
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

interface SearchDialogContentProps {
  setOpen: (open: boolean) => void;
}

export function SearchDialogContent({ setOpen }: SearchDialogContentProps) {
  const [query, setQuery] = useState("");
  const navigate = useNavigate();

  // Filter results based on search query
  const filteredResults = mockSearchResults.filter(
    (result) =>
      result.title.toLowerCase().includes(query.toLowerCase()) ||
      (result.subtitle && result.subtitle.toLowerCase().includes(query.toLowerCase()))
  );

  // Group results by type
  const users = filteredResults.filter((r) => r.type === "user");
  const recommendations = filteredResults.filter((r) => r.type === "recommendation");
  const features = filteredResults.filter((r) => r.type === "feature");

  const handleSelect = (result: SearchResult) => {
    setOpen(false);
    
    // Navigate based on result type
    if (result.type === "user") {
      navigate(`/profile/${result.id}`);
    } else if (result.type === "recommendation") {
      navigate(`/recommendations/${result.id}`);
    } else if (result.type === "feature") {
      navigate(`/#features`);
    }
  };

  return (
    <>
      <CommandInput 
        placeholder="Search for people, recommendations..." 
        value={query}
        onValueChange={setQuery}
      />
      <CommandList>
        <CommandEmpty>No results found.</CommandEmpty>
        
        {users.length > 0 && (
          <CommandGroup heading="People">
            {users.map((user) => (
              <CommandItem
                key={user.id}
                onSelect={() => handleSelect(user)}
                className="cursor-pointer"
              >
                <div className="flex items-center gap-2">
                  <Avatar className="h-6 w-6">
                    <AvatarImage src={user.imageUrl} alt={user.title} />
                    <AvatarFallback>
                      {user.title.substring(0, 2).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex flex-col">
                    <span>{user.title}</span>
                    {user.subtitle && (
                      <span className="text-xs text-muted-foreground">{user.subtitle}</span>
                    )}
                  </div>
                </div>
              </CommandItem>
            ))}
          </CommandGroup>
        )}
        
        {recommendations.length > 0 && (
          <CommandGroup heading="Recommendations">
            {recommendations.map((rec) => (
              <CommandItem
                key={rec.id}
                onSelect={() => handleSelect(rec)}
                className="cursor-pointer"
              >
                <Hash className="mr-2 h-4 w-4" />
                <div className="flex flex-col">
                  <span>{rec.title}</span>
                  {rec.subtitle && (
                    <span className="text-xs text-muted-foreground">{rec.subtitle}</span>
                  )}
                </div>
              </CommandItem>
            ))}
          </CommandGroup>
        )}
        
        {features.length > 0 && (
          <CommandGroup heading="Features">
            {features.map((feature) => (
              <CommandItem
                key={feature.id}
                onSelect={() => handleSelect(feature)}
                className="cursor-pointer"
              >
                <Star className="mr-2 h-4 w-4" />
                <div className="flex flex-col">
                  <span>{feature.title}</span>
                  {feature.subtitle && (
                    <span className="text-xs text-muted-foreground">{feature.subtitle}</span>
                  )}
                </div>
              </CommandItem>
            ))}
          </CommandGroup>
        )}
      </CommandList>
    </>
  );
}
