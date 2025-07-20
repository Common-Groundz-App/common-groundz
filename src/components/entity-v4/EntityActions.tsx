
import React from 'react';
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Heart, Share2, ExternalLink, MapPin, MessageSquare } from "lucide-react";
import { Entity } from '@/services/recommendation/types';
import { SafeUserProfile } from '@/types/profile';
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

interface EntityActionsProps {
  entity: Entity;
  user: SafeUserProfile | null;
  isSaved: boolean;
  isSaveLoading: boolean;
  onShare: () => Promise<void>;
  onToggleSave: () => Promise<void>;
  onRecommendationModalOpen: () => void;
  onSidebarAction: () => void;
  sidebarButtonConfig: {
    text: string;
    icon: React.ComponentType<any>;
    action: () => void;
    tooltip: string | null;
  };
}

export const EntityActions: React.FC<EntityActionsProps> = ({
  entity,
  user,
  isSaved,
  isSaveLoading,
  onShare,
  onToggleSave,
  onRecommendationModalOpen,
  onSidebarAction,
  sidebarButtonConfig
}) => {
  const handleWebsiteClick = () => {
    const websiteUrl = `https://www.${entity.name.toLowerCase().replace(/\s+/g, '')}.com`;
    window.open(websiteUrl, '_blank');
  };

  const handleDirectionsClick = () => {
    const query = encodeURIComponent(`${entity.name} directions`);
    window.open(`https://www.google.com/maps/search/${query}`, '_blank');
  };

  return (
    <div className="flex flex-wrap gap-3">
      {/* Save Button */}
      <Button
        variant={isSaved ? "default" : "outline"}
        size="sm"
        onClick={onToggleSave}
        disabled={isSaveLoading || !user}
        className="flex items-center gap-2"
      >
        <Heart className={`w-4 h-4 ${isSaved ? 'fill-current' : ''}`} />
        {isSaved ? 'Saved' : 'Save'}
      </Button>

      {/* Share Button */}
      <Button
        variant="outline"
        size="sm"
        onClick={onShare}
        className="flex items-center gap-2"
      >
        <Share2 className="w-4 h-4" />
        Share
      </Button>

      {/* Website Button */}
      <Button
        variant="outline"
        size="sm"
        onClick={handleWebsiteClick}
        className="flex items-center gap-2"
      >
        <ExternalLink className="w-4 h-4" />
        Website
      </Button>

      {/* Directions Button */}
      <Button
        variant="outline"
        size="sm"
        onClick={handleDirectionsClick}
        className="flex items-center gap-2"
      >
        <MapPin className="w-4 h-4" />
        Directions
      </Button>

      {/* Recommend Button */}
      <Button
        variant="outline"
        size="sm"
        onClick={onRecommendationModalOpen}
        className="flex items-center gap-2"
      >
        <Badge variant="secondary" className="mr-1">
          Circle
        </Badge>
        Recommend
      </Button>

      {/* Dynamic Sidebar Action Button */}
      {sidebarButtonConfig.tooltip ? (
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="default"
              size="sm"
              onClick={sidebarButtonConfig.action}
              className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700"
            >
              <sidebarButtonConfig.icon className="w-4 h-4" />
              {sidebarButtonConfig.text}
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            <p>{sidebarButtonConfig.tooltip}</p>
          </TooltipContent>
        </Tooltip>
      ) : (
        <Button
          variant="default"
          size="sm"
          onClick={sidebarButtonConfig.action}
          className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700"
        >
          <sidebarButtonConfig.icon className="w-4 h-4" />
          {sidebarButtonConfig.text}
        </Button>
      )}
    </div>
  );
};
