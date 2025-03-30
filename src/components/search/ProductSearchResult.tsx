
import React from "react";
import { Star } from "lucide-react";
import { CommandItem } from "@/components/ui/command";
import { SearchResult } from "@/utils/searchUtils";

interface ProductSearchResultProps {
  product: SearchResult;
  onSelect: (result: SearchResult) => void;
}

export function ProductSearchResult({ product, onSelect }: ProductSearchResultProps) {
  return (
    <CommandItem
      key={product.id}
      onSelect={() => onSelect(product)}
      className="cursor-pointer"
    >
      <div className="flex items-center gap-2">
        {product.imageUrl ? (
          <img 
            src={product.imageUrl} 
            alt={product.title} 
            className="h-6 w-6 rounded object-cover"
          />
        ) : (
          <Star className="mr-2 h-4 w-4" />
        )}
        <div className="flex flex-col">
          <span>{product.title}</span>
          {product.subtitle && (
            <span className="text-xs text-muted-foreground">{product.subtitle}</span>
          )}
        </div>
      </div>
    </CommandItem>
  );
}
