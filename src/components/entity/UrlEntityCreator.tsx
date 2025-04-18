
import React, { useState } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Loader2, ExternalLink } from 'lucide-react';
import { useUrlEntityCreator } from '@/hooks/use-url-entity-creator';
import { EntityType } from '@/services/recommendationService';

interface UrlEntityCreatorProps {
  onEntityCreated: (entity: any) => void;
}

export default function UrlEntityCreator({ onEntityCreated }: UrlEntityCreatorProps) {
  const [url, setUrl] = useState('');
  const [entityType, setEntityType] = useState<EntityType>('product');
  const { createEntityFromUrl, isLoading } = useUrlEntityCreator();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!url.trim()) return;
    
    const entity = await createEntityFromUrl(url.trim(), entityType);
    if (entity) {
      onEntityCreated(entity);
      setUrl('');
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Create entity from URL</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="entity-url">Website URL</Label>
            <div className="flex items-center space-x-2">
              <Input
                id="entity-url"
                placeholder="https://example.com/product"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                className="flex-1"
              />
              <Button 
                type="button" 
                variant="outline" 
                size="icon"
                onClick={() => window.open(url, '_blank', 'noopener,noreferrer')}
                disabled={!url.trim()}
              >
                <ExternalLink className="h-4 w-4" />
              </Button>
            </div>
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="entity-type">Entity Type</Label>
            <Select value={entityType} onValueChange={(value: EntityType) => setEntityType(value)}>
              <SelectTrigger id="entity-type">
                <SelectValue placeholder="Select type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="product">Product</SelectItem>
                <SelectItem value="place">Place</SelectItem>
                <SelectItem value="book">Book</SelectItem>
                <SelectItem value="movie">Movie</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </form>
      </CardContent>
      <CardFooter>
        <Button 
          onClick={handleSubmit} 
          disabled={isLoading || !url.trim()} 
          className="w-full"
        >
          {isLoading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Creating...
            </>
          ) : (
            'Create Entity'
          )}
        </Button>
      </CardFooter>
    </Card>
  );
}
