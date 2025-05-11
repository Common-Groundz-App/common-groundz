
import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { MapPin, Navigation, AlertCircle, CheckCircle2, ArrowRight } from 'lucide-react';
import { useGeolocation } from '@/hooks/use-geolocation';
import { cn } from '@/lib/utils';

interface LocationAccessPromptProps {
  onCancel: () => void;
  onLocationObtained?: () => void;
  className?: string;
  compact?: boolean;
}

export function LocationAccessPrompt({ 
  onCancel, 
  onLocationObtained, 
  className = "", 
  compact = false 
}: LocationAccessPromptProps) {
  const { 
    getPosition, 
    position, 
    isLoading, 
    error, 
    permissionStatus, 
    isGeolocationSupported,
    checkPermission
  } = useGeolocation();

  // Get status message and icon
  const getStatusInfo = () => {
    if (!isGeolocationSupported) {
      return {
        message: "Location services are not supported in your browser.",
        icon: <AlertCircle className="h-5 w-5 text-yellow-500" />,
        color: "text-yellow-500",
        buttonText: "Skip",
        buttonAction: onCancel,
        buttonDisabled: false,
        buttonColor: "outline"
      };
    }
    
    if (error) {
      const isDenied = error.code === 1; // PERMISSION_DENIED
      return {
        message: isDenied 
          ? "Location access was denied. Please enable location in your browser settings."
          : error.message || "Error accessing location. Please check your browser settings.",
        icon: <AlertCircle className="h-5 w-5 text-red-500" />,
        color: "text-red-500",
        buttonText: isDenied ? "Open Settings" : "Try Again",
        buttonAction: isDenied 
          ? () => window.open("https://support.google.com/chrome/answer/142065", "_blank")
          : () => getPosition(),
        buttonDisabled: false,
        buttonColor: "default"
      };
    }
    
    if (position) {
      return {
        message: "Location successfully accessed! You can now get nearby recommendations.",
        icon: <CheckCircle2 className="h-5 w-5 text-green-500" />,
        color: "text-green-500",
        buttonText: "Continue",
        buttonAction: () => {
          if (onLocationObtained) onLocationObtained();
          else onCancel();
        },
        buttonDisabled: false,
        buttonColor: "default"
      };
    }
    
    if (isLoading) {
      return {
        message: "Accessing your location...",
        icon: <Navigation className="h-5 w-5 text-brand-orange animate-pulse" />,
        color: "text-brand-orange",
        buttonText: "Getting Location...",
        buttonAction: () => {},
        buttonDisabled: true,
        buttonColor: "default"
      };
    }
    
    return {
      message: "Allow access to your location for better recommendations.",
      icon: <MapPin className="h-5 w-5 text-brand-orange" />,
      color: "text-muted-foreground",
      buttonText: "Allow Location Access",
      buttonAction: getPosition,
      buttonDisabled: false,
      buttonColor: "default"
    };
  };
  
  const { message, icon, color, buttonText, buttonAction, buttonDisabled, buttonColor } = getStatusInfo();
  
  if (compact) {
    return (
      <div className={cn("flex items-center gap-2 p-2", className)}>
        {icon}
        <p className={cn("text-sm flex-1", color)}>{message}</p>
        <Button
          variant={buttonColor as any}
          size="sm"
          onClick={buttonAction}
          disabled={buttonDisabled}
          className="whitespace-nowrap"
        >
          {buttonText}
        </Button>
      </div>
    );
  }
  
  return (
    <Card className={cn("p-4", className)}>
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
        {(!position && !error) && (
          <Button
            variant="outline"
            size="sm"
            onClick={onCancel}
          >
            Skip
          </Button>
        )}
        
        <Button
          variant={buttonColor as any}
          size="sm"
          onClick={buttonAction}
          disabled={buttonDisabled}
        >
          {buttonText}
        </Button>
      </div>
    </Card>
  );
}

export default LocationAccessPrompt;
