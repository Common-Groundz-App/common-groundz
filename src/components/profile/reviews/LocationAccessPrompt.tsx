
import React from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { MapPin, Navigation, AlertCircle, CheckCircle2, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useLocation } from '@/contexts/LocationContext';

interface LocationAccessPromptProps {
  onCancel: () => void;
  className?: string;
}

export function LocationAccessPrompt({ onCancel, className }: LocationAccessPromptProps) {
  const { 
    getPosition, 
    position, 
    isLoading, 
    error, 
    permissionStatus, 
    isGeolocationSupported,
    enableLocation,
    locationEnabled
  } = useLocation();

  // Get status message and icon
  const getStatusInfo = () => {
    if (!isGeolocationSupported) {
      return {
        message: "Location services are not supported in your browser.",
        icon: <AlertCircle className="h-5 w-5 text-yellow-500" />,
        color: "text-yellow-500"
      };
    }
    
    if (error) {
      return {
        message: error.message || "Error accessing location. Please check your browser settings.",
        icon: <AlertCircle className="h-5 w-5 text-red-500" />,
        color: "text-red-500"
      };
    }
    
    if (position) {
      return {
        message: "Location successfully accessed! You can now get nearby recommendations.",
        icon: <CheckCircle2 className="h-5 w-5 text-green-500" />,
        color: "text-green-500"
      };
    }
    
    if (isLoading) {
      return {
        message: "Accessing your location...",
        icon: <Navigation className="h-5 w-5 text-brand-orange animate-pulse" />,
        color: "text-brand-orange"
      };
    }
    
    return {
      message: "Allow access to your location for better recommendations.",
      icon: <MapPin className="h-5 w-5 text-brand-orange" />,
      color: "text-muted-foreground"
    };
  };
  
  const { message, icon, color } = getStatusInfo();
  
  const handleLocationAccess = () => {
    // Use the enableLocation from context to ensure consistency
    enableLocation();
  };

  // Check if we should show the close button (X)
  // Only show it after location has been granted or in error states
  const showCloseButton = position || locationEnabled || error;
  
  return (
    <Card className={cn("p-4 relative", className)}>
      {/* Close button - Only show after location access granted or error state */}
      {showCloseButton && (
        <Button 
          variant="ghost" 
          size="icon" 
          className="absolute top-1 right-1 h-6 w-6" 
          onClick={onCancel}
        >
          <X className="h-4 w-4" />
        </Button>
      )}
      
      <div className="flex items-center gap-3 mb-3">
        {icon}
        <h3 className="text-lg font-semibold">Location Access</h3>
      </div>
      
      <p className="text-sm text-muted-foreground mb-4">
        Allowing location access helps us provide:
      </p>
      
      <ul className="list-disc list-inside text-sm text-muted-foreground space-y-1 mb-4 pl-2">
        <li>Nearby restaurants and places</li>
        <li>Distance information in search results</li>
        <li>More accurate recommendations</li>
      </ul>
      
      <p className={cn("text-sm mb-4", color)}>{message}</p>
      
      <div className="flex gap-2 justify-end">
        {!position && !locationEnabled && (
          <Button
            variant="outline"
            size="sm"
            onClick={onCancel}
          >
            Skip
          </Button>
        )}
        
        {position || locationEnabled ? (
          <Button
            variant="default"
            size="sm"
            onClick={onCancel}
          >
            Got it
          </Button>
        ) : (
          <Button
            variant="default"
            size="sm"
            onClick={handleLocationAccess}
            disabled={!isGeolocationSupported || isLoading || permissionStatus === 'denied'}
          >
            {isLoading ? "Getting Location..." : 
             permissionStatus === 'denied' ? "Access Denied" : 
             "Allow Location Access"}
          </Button>
        )}
      </div>
    </Card>
  );
}

export default LocationAccessPrompt;
