
import React from "react";
import { Hash, Star } from "lucide-react";
import { CommandItem } from "@/components/ui/command";
import { SearchResult } from "@/utils/searchUtils";

interface GenericSearchResultProps {
  result: SearchResult;
  onSelect: (result: SearchResult) => void;
  icon?: React.ReactNode;
}

export function GenericSearchResult({ result, onSelect, icon }: GenericSearchResultProps) {
  const defaultIcon = result.type === "feature" ? <Star className="mr-2 h-4 w-4" /> : <Hash className="mr-2 h-4 w-4" />;
  
  return (
    <CommandItem
      key={result.id}
      onSelect={() => onSelect(result)}
      className="cursor-pointer"
    >
      {icon || defaultIcon}
      <div className="flex flex-col">
        <span>{result.title}</span>
        {result.subtitle && (
          <span className="text-xs text-muted-foreground">{result.subtitle}</span>
        )}
      </div>
    </CommandItem>
  );
}
