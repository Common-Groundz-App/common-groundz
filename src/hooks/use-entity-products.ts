
import { useState, useEffect } from 'react';
import { getEntityProducts, EntityProduct } from '@/services/entityProductService';

export const useEntityProducts = (entityId: string) => {
  const [products, setProducts] = useState<EntityProduct[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchProducts = async () => {
      if (!entityId) {
        setProducts([]);
        setIsLoading(false);
        return;
      }

      try {
        setIsLoading(true);
        setError(null);
        const entityProducts = await getEntityProducts(entityId);
        setProducts(entityProducts);
      } catch (err) {
        console.error('Error fetching entity products:', err);
        setError('Failed to load products');
      } finally {
        setIsLoading(false);
      }
    };

    fetchProducts();
  }, [entityId]);

  const refreshProducts = async () => {
    if (!entityId) return;
    
    try {
      const entityProducts = await getEntityProducts(entityId);
      setProducts(entityProducts);
    } catch (err) {
      console.error('Error refreshing entity products:', err);
    }
  };

  return {
    products,
    isLoading,
    error,
    refreshProducts
  };
};
