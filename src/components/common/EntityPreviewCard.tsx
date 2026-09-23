
import React from "react";
import { cn } from "@/lib/utils";
import { useEntityImageFallback } from "@/hooks/useEntityImageFallback";
import { getEntityFallbackIcon } from "@/utils/entityImageFallback";
import { MapPin } from "lucide-react";

interface EntityPreviewCardProps {
  entity: {
    image_url?: string;
    name?: string;
    title?: string;
    brand?: string;
    website?: string;
    venue?: string;
    description?: string;
    api_source?: string;
    metadata?: {
      formatted_address?: string;
      rating?: number;
      user_ratings_total?: number;
      price_level?: number;
      types?: string[];
      business_status?: string;
    };
  };
  type: string;
  onChange: () => void;
  disableChange?: boolean; // New prop to disable the change button
}

export const EntityPreviewCard = ({
  entity,
  type,
  onChange,
  disableChange = false, // Default to false to maintain backward compatibility
}: EntityPreviewCardProps) => {
  const { imageUrl, showFallback, markImageFailed } = useEntityImageFallback(entity);
  const FallbackIcon = getEntityFallbackIcon(type);

  if (!entity) return null;

  // Get address from metadata if available (for Google Places)
  const address = entity.metadata?.formatted_address || entity.venue;
  const isGooglePlace = entity.api_source === "google_places";
  
  // Extract useful metadata
  const priceLevel = entity.metadata?.price_level;
  const types = entity.metadata?.types || [];
  
  // Format price level to $ symbols
  const getPriceLevel = () => {
    if (priceLevel === undefined) return null;
    return Array(priceLevel).fill('$').join('');
  };
  
  // Get cuisine types from place types
  const getCuisineTypes = () => {
    const relevantTypes = types.filter(type => 
      !['point_of_interest', 'establishment', 'food', 'restaurant'].includes(type)
    );
    
    // Format types to be more readable (replace underscores with spaces, capitalize)
    return relevantTypes
      .slice(0, 3)
      .map(type => type.replace(/_/g, ' '))
      .map(type => type.charAt(0).toUpperCase() + type.slice(1))
      .join(', ');
  };
  
  // Get the appropriate display label based on entity type
  const getDisplayLabel = () => {
    if (type === "food") {
      return "Selected place";
    }
    return `Selected ${type}`;
  };
  
  return (
    <div className="w-full mb-4">
      <div className="flex items-center justify-between mb-2">
        <span className="font-medium text-sm">{getDisplayLabel()}</span>
        {!disableChange && (
          <button
            type="button"
            className="text-sm px-3 py-1 border rounded-md bg-white hover:bg-accent border-border shadow-sm transition"
            onClick={onChange}
          >
            Change
          </button>
        )}
      </div>
      <div className={cn(
        "flex flex-col sm:flex-row w-full rounded-xl bg-white p-4 shadow-md border gap-4",
        "hover:shadow-lg transition-shadow duration-200"
      )}>
        {/* Image section */}
        <div className="flex-shrink-0">
          {showFallback ? (
            <div
              className="w-full sm:w-24 h-24 rounded-lg bg-gray-100 flex items-center justify-center text-muted-foreground text-sm font-semibold border"
              role="img"
              aria-label={entity.name || entity.title || "Preview"}
            >
              <FallbackIcon className="h-8 w-8" aria-hidden="true" />
            </div>
          ) : (
            <img
              src={imageUrl || ''}
              alt={entity.name || entity.title || "Preview"}
              className="w-full sm:w-24 h-24 object-cover rounded-lg border bg-gray-100"
              onError={markImageFailed}
            />
          )}
        </div>
        
        {/* Content section */}
        <div className="flex-1 min-w-0">
          {/* Name/Title */}
          <div className="font-semibold text-base mb-1 text-gray-900 break-words">
            {entity.name || entity.title}
          </div>
          
          {/* Address with icon for places */}
          {address && (
            <div className="flex items-start gap-1 text-xs text-gray-500 font-medium mb-2">
              <MapPin className="h-3 w-3 mt-0.5 flex-shrink-0 text-brand-orange" strokeWidth={2.5} />
              <span className="break-words">{address}</span>
            </div>
          )}
          
          {/* Additional metadata - price, cuisine types */}
          <div className="flex flex-wrap gap-x-2 gap-y-1 mb-1">
            {/* Price level */}
            {getPriceLevel() && (
              <span className="text-xs font-medium text-gray-700 bg-gray-100 px-2 py-0.5 rounded">
                {getPriceLevel()}
              </span>
            )}
            
            {/* Cuisine types */}
            {getCuisineTypes() && (
              <span className="text-xs font-medium text-gray-700 bg-gray-100 px-2 py-0.5 rounded truncate max-w-full">
                {getCuisineTypes()}
              </span>
            )}
          </div>
          
          {/* Description if available */}
          {entity.description && (
            <div className="text-sm text-gray-700 leading-snug whitespace-pre-line break-words mt-2">
              {entity.description}
            </div>
          )}
          
          {/* Subtle attribution for Google Places data (minimum required by Google) */}
          {isGooglePlace && (
            <div className="flex items-center justify-end mt-2">
              <span className="text-[10px] text-gray-400">Location data from Google</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
