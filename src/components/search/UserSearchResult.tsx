
import React from "react";
import { User } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { CommandItem } from "@/components/ui/command";
import { SearchResult } from "@/utils/searchUtils";

interface UserSearchResultProps {
  user: SearchResult;
  onSelect: (result: SearchResult) => void;
}

export function UserSearchResult({ user, onSelect }: UserSearchResultProps) {
  return (
    <CommandItem
      key={user.id}
      onSelect={() => onSelect(user)}
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
  );
}
