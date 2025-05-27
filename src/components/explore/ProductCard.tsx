
import React from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Star, ShoppingBag, Plus } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useEntityOperations } from '@/hooks/recommendations/use-entity-operations';
import { useToast } from '@/hooks/use-toast';

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
      purchase_url?: string;
      [key: string]: any;
    }
  };
  enableEntityCreation?: boolean;
  onEntityCreated?: () => void;
}

export function ProductCard({ product, enableEntityCreation = false, onEntityCreated }: ProductCardProps) {
  const navigate = useNavigate();
  const { handleEntityCreation } = useEntityOperations();
  const { toast } = useToast();

  const handleCreateEntity = async () => {
    try {
      console.log('🔍 Creating entity from product:', product);
      
      // Determine entity type based on API source
      let entityType = 'product';
      if (product.api_source === 'openlibrary') {
        entityType = 'book';
      } else if (product.api_source === 'tmdb') {
        entityType = 'movie';
      } else if (product.api_source === 'google_places') {
        entityType = 'place';
      }

      const entity = await handleEntityCreation(
        product.name,
        entityType as any,
        product.api_source,
        product.api_ref,
        product.venue,
        product.description,
        product.image_url,
        product.metadata
      );

      if (entity) {
        console.log('✅ Entity created successfully:', entity);
        
        // Navigate to the entity page using slug
        const identifier = entity.slug || entity.id;
        const entityPath = `/entity/${identifier}`;
        
        console.log(`🔗 Navigating to entity page: ${entityPath}`);
        navigate(entityPath);
        
        if (onEntityCreated) {
          onEntityCreated();
        }
      } else {
        console.error('❌ Entity creation failed - no entity returned');
        toast({
          title: 'Error',
          description: 'Could not create entity from this result',
          variant: 'destructive'
        });
      }
    } catch (error) {
      console.error('❌ Error creating entity:', error);
      toast({
        title: 'Error',
        description: 'Failed to create entity. Please try again.',
        variant: 'destructive'
      });
    }
  };

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
        {product.metadata.purchase_url ? (
          <Button 
            onClick={() => window.open(product.metadata.purchase_url, '_blank', 'noopener,noreferrer')}
            className="w-full"
          >
            Buy Now
          </Button>
        ) : (
          <Button 
            className="w-full" 
            variant="outline"
            onClick={handleCreateEntity}
          >
            <Plus className="w-4 h-4 mr-2" />
            Create Entity
          </Button>
        )}
      </CardFooter>
    </Card>
  );
}
