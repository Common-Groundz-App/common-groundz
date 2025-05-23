
import React from 'react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { ShoppingBag, Star } from 'lucide-react';

interface ProductResultItemProps {
  product: {
    name: string;
    venue: string;
    description: string | null;
    image_url: string;
    api_source: string;
    api_ref: string;
    metadata: {
      price?: string;
      rating?: number;
      seller?: string;
      purchase_url: string;
      [key: string]: any;
    }
  };
  onClick: () => void;
}

export function ProductResultItem({ product, onClick }: ProductResultItemProps) {
  const handleBuyClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    window.open(product.metadata.purchase_url, '_blank', 'noopener,noreferrer');
  };

  return (
    <a
      href={product.metadata.purchase_url}
      className="flex items-center gap-3 px-4 py-2 hover:bg-muted/30 transition-colors"
      onClick={(e) => {
        e.preventDefault();
        onClick();
        window.open(product.metadata.purchase_url, '_blank', 'noopener,noreferrer');
      }}
      target="_blank"
      rel="noopener noreferrer"
    >
      <Avatar className="h-10 w-10 rounded-md">
        <AvatarImage src={product.image_url} alt={product.name} className="object-cover" />
        <AvatarFallback className="rounded-md">
          <ShoppingBag className="h-4 w-4" />
        </AvatarFallback>
      </Avatar>
      
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1">
          <p className="text-sm font-medium truncate">{product.name}</p>
          <Badge variant="outline" className="text-xs py-0 px-1.5 h-5 bg-muted/50">
            Product
          </Badge>
        </div>
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span className="truncate">{product.venue || product.metadata.seller}</span>
          <div className="flex items-center gap-2">
            {product.metadata.rating && (
              <span className="flex items-center">
                <Star className="w-3 h-3 mr-0.5 fill-yellow-500 text-yellow-500" /> 
                {product.metadata.rating}
              </span>
            )}
            <span className="font-semibold">{product.metadata.price}</span>
          </div>
        </div>
      </div>
    </a>
  );
}
