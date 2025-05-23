
import React from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Star, ShoppingBag } from 'lucide-react';

interface ProductCardProps {
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
}

export function ProductCard({ product }: ProductCardProps) {
  return (
    <Card className="overflow-hidden h-full flex flex-col">
      <div className="h-48 overflow-hidden relative">
        {product.image_url ? (
          <img 
            src={product.image_url} 
            alt={product.name} 
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-muted">
            <ShoppingBag className="h-12 w-12 text-muted-foreground/50" />
          </div>
        )}
        {product.metadata.price && (
          <div className="absolute top-2 right-2 bg-background/90 backdrop-blur-sm rounded-md px-2 py-1 text-sm font-medium">
            {product.metadata.price}
          </div>
        )}
      </div>
      
      <CardHeader className="p-4 pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base line-clamp-2">{product.name}</CardTitle>
          {product.metadata.rating && (
            <span className="flex items-center text-sm">
              <Star className="w-4 h-4 mr-1 fill-yellow-500 text-yellow-500" /> 
              {product.metadata.rating}
            </span>
          )}
        </div>
        <CardDescription className="text-xs">
          {product.venue || product.metadata.seller}
        </CardDescription>
      </CardHeader>
      
      {product.description && (
        <CardContent className="p-4 pt-1 flex-grow">
          <p className="text-sm text-muted-foreground line-clamp-3">{product.description}</p>
        </CardContent>
      )}
      
      <CardFooter className="p-4 pt-2 flex justify-end">
        <Button 
          onClick={() => window.open(product.metadata.purchase_url, '_blank', 'noopener,noreferrer')}
          className="w-full"
        >
          Buy Now
        </Button>
      </CardFooter>
    </Card>
  );
}
