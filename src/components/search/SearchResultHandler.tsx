
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { createOrUpdateEnhancedEntity, enrichEntityWithSearchData } from '@/services/enhancedEntityService';
import { ProductCard } from '@/components/explore/ProductCard';
import { LoadingSpinner } from '@/components/loading/LoadingSpinner';

interface SearchResultHandlerProps {
  result: any;
  query: string;
  onClose?: () => void;
}

export function SearchResultHandler({ result, query, onClose }: SearchResultHandlerProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [isCreating, setIsCreating] = useState(false);

  const handleCreateEntity = async () => {
    if (!user) {
      toast({
        title: 'Authentication required',
        description: 'Please sign in to save items',
        variant: 'destructive'
      });
      return;
    }

    try {
      setIsCreating(true);
      console.log('🔍 Creating enhanced entity from result:', result);
      
      // Enrich the search result with structured data
      const enrichedData = enrichEntityWithSearchData(result);
      
      // Create or update entity with enhanced data
      const entity = await createOrUpdateEnhancedEntity(enrichedData, user.id);

      if (entity) {
        console.log('✅ Enhanced entity created successfully:', entity);
        
        // Navigate to the entity page using slug
        const identifier = entity.slug || entity.id;
        const entityPath = `/entity/${identifier}`;
        
        console.log(`🔗 Navigating to enhanced entity page: ${entityPath}`);
        navigate(entityPath);
        
        if (onClose) onClose();
        
        toast({
          title: 'Success',
          description: `${result.name || result.title} has been saved to your database`,
        });
      }
    } catch (error) {
      console.error('❌ Error creating enhanced entity:', error);
      toast({
        title: 'Error',
        description: 'Failed to save item. Please try again.',
        variant: 'destructive'
      });
    } finally {
      setIsCreating(false);
    }
  };

  if (isCreating) {
    return (
      <div className="p-4 flex items-center justify-center">
        <LoadingSpinner text="Saving to your database..." />
      </div>
    );
  }

  return (
    <div className="cursor-pointer" onClick={handleCreateEntity}>
      <ProductCard 
        product={result}
        enableEntityCreation={true}
        onEntityCreated={() => {}}
      />
    </div>
  );
}
