
import React from 'react';
import { Entity } from '@/services/recommendation/types';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Check, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

interface EntityDisplayProps {
  entity: Entity;
  className?: string;
}

export function EntityDisplay({ entity, className }: EntityDisplayProps) {
  // Get isVerified from entity metadata or direct property
  const isVerified = 
    (entity.is_verified !== undefined) ? entity.is_verified : 
    (entity.metadata && 
    typeof entity.metadata === 'object' && 
    (entity.metadata as any).is_verified ? 
    Boolean((entity.metadata as any).is_verified) : false);
  
  // Get websiteUrl from entity metadata or direct property
  const websiteUrl = 
    (entity.website_url !== undefined) ? entity.website_url :
    (entity.metadata && 
    typeof entity.metadata === 'object' && 
    (entity.metadata as any).website_url ? 
    (entity.metadata as any).website_url : null);

  return (
    <Card className={cn("p-3 flex items-start gap-3", className)}>
      {entity.image_url && (
        <img 
          src={entity.image_url} 
          alt={entity.name}
          className="w-16 h-16 object-cover rounded"
        />
      )}
      
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <h3 className="font-medium text-base truncate">{entity.name}</h3>
          {isVerified ? (
            <Badge variant="secondary" className="flex items-center gap-1">
              <Check className="w-3 h-3" />
              Verified
            </Badge>
          ) : (
            <Badge variant="outline" className="flex items-center gap-1">
              <AlertCircle className="w-3 h-3" />
              Unverified
            </Badge>
          )}
        </div>
        
        {entity.venue && (
          <p className="text-sm text-muted-foreground truncate">{entity.venue}</p>
        )}
        
        {entity.description && (
          <p className="text-sm text-muted-foreground line-clamp-2 mt-1">
            {entity.description}
          </p>
        )}
        
        {websiteUrl && (
          <a 
            href={websiteUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm text-primary hover:underline truncate block mt-1"
          >
            {new URL(websiteUrl).hostname}
          </a>
        )}
      </div>
    </Card>
  );
}
