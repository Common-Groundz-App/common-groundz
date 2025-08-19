import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { MapPin, AlertTriangle, CheckCircle } from 'lucide-react';

interface AdminEntityPlaceIdToolProps {
  entityId: string;
  entityName: string;
  currentMetadata?: any;
  onUpdate?: () => void;
}

export const AdminEntityPlaceIdTool: React.FC<AdminEntityPlaceIdToolProps> = ({
  entityId,
  entityName,
  currentMetadata,
  onUpdate
}) => {
  const [placeId, setPlaceId] = useState(currentMetadata?.place_id || '');
  const [isUpdating, setIsUpdating] = useState(false);
  const { toast } = useToast();

  const handleUpdatePlaceId = async () => {
    if (!placeId.trim()) {
      toast({
        title: "Error",
        description: "Please enter a valid place_id",
        variant: "destructive",
      });
      return;
    }

    setIsUpdating(true);

    try {
      // Update the entity metadata with the new place_id
      const updatedMetadata = {
        ...currentMetadata,
        place_id: placeId.trim()
      };

      const { error } = await supabase
        .from('entities')
        .update({ metadata: updatedMetadata })
        .eq('id', entityId);

      if (error) {
        throw error;
      }

      toast({
        title: "Success",
        description: "Place ID updated successfully. You can now refresh the entity image.",
        variant: "default",
      });

      onUpdate?.();
    } catch (error: any) {
      console.error('Error updating place_id:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to update place_id",
        variant: "destructive",
      });
    } finally {
      setIsUpdating(false);
    }
  };

  const hasPlaceId = currentMetadata?.place_id;

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <MapPin className="h-5 w-5" />
          Google Places ID Manager
        </CardTitle>
        <CardDescription>
          Manage the Google Places ID for "{entityName}" to enable proper image refreshing
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center gap-2">
          {hasPlaceId ? (
            <Badge variant="default" className="bg-green-100 text-green-800">
              <CheckCircle className="h-3 w-3 mr-1" />
              Place ID Present
            </Badge>
          ) : (
            <Badge variant="destructive">
              <AlertTriangle className="h-3 w-3 mr-1" />
              Place ID Missing
            </Badge>
          )}
        </div>

        {!hasPlaceId && (
          <div className="p-3 bg-amber-50 border border-amber-200 rounded-md">
            <p className="text-sm text-amber-800">
              <strong>Issue:</strong> This Google Places entity is missing a place_id, which causes image refresh failures. 
              Add a valid place_id to enable proper image refreshing.
            </p>
          </div>
        )}

        <div className="space-y-2">
          <Label htmlFor="place-id">Google Places ID</Label>
          <Input
            id="place-id"
            value={placeId}
            onChange={(e) => setPlaceId(e.target.value)}
            placeholder="Enter Google Places ID (e.g., ChIJN1t_tDeuEmsRUsoyG83frY4)"
            className="font-mono text-sm"
          />
          <p className="text-xs text-muted-foreground">
            You can find the place_id by searching for the location on Google Places API or Google Maps.
          </p>
        </div>

        <Button 
          onClick={handleUpdatePlaceId}
          disabled={isUpdating || !placeId.trim() || placeId === currentMetadata?.place_id}
          className="w-full"
        >
          {isUpdating ? "Updating..." : "Update Place ID"}
        </Button>

        {currentMetadata?.place_id && (
          <div className="mt-4 p-3 bg-gray-50 rounded-md">
            <Label className="text-xs font-medium text-gray-600">Current Place ID:</Label>
            <p className="font-mono text-sm break-all">{currentMetadata.place_id}</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
};