import React, { useEffect, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { getCategoryPath } from '@/services/categoryService';
import { Database } from '@/integrations/supabase/types';

type Category = Database['public']['Tables']['categories']['Row'];

interface EntityCategoryBadgeProps {
  categoryId: string;
  showFullPath?: boolean;
  className?: string;
  variant?: 'default' | 'secondary' | 'outline' | 'destructive';
}

export const EntityCategoryBadge: React.FC<EntityCategoryBadgeProps> = ({
  categoryId,
  showFullPath = false,
  className = '',
  variant = 'secondary'
}) => {
  const [path, setPath] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    const loadPath = async () => {
      try {
        setLoading(true);
        const categoryPath = await getCategoryPath(categoryId);
        setPath(categoryPath);
        setError(false);
      } catch (err) {
        console.error('Error loading category path:', err);
        setError(true);
      } finally {
        setLoading(false);
      }
    };
    
    loadPath();
  }, [categoryId]);

  // Don't render anything while loading or if error/no path
  if (loading || error || path.length === 0) return null;

  const displayText = showFullPath
    ? path.map(c => c.name).join(' > ')
    : path[path.length - 1].name; // Show only leaf category

  return (
    <Badge variant={variant} className={className}>
      {displayText}
    </Badge>
  );
};
