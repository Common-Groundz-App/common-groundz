
import { useState, useEffect, useCallback } from 'react';
import { useGeolocation, locationEventBus } from './use-geolocation';
import { useToast } from '@/hooks/use-toast';

export function useLocationManager() {
  const geolocation = useGeolocation();
  const [locationEnabled, setLocationEnabled] = useState<boolean>(false);
  const { toast } = useToast();
  
  // Load preference from localStorage on initial mount
  useEffect(() => {
    const savedPreference = localStorage.getItem('locationEnabled');
    if (savedPreference === 'true') {
      setLocationEnabled(true);
      // If permission is already granted, get position automatically
      if (geolocation.permissionStatus === 'granted' && !geolocation.position) {
        geolocation.getPosition();
      }
    }
    
    // Subscribe to location status changes from other components
    const unsubscribe = locationEventBus.subscribe('status-change', (detail) => {
      // Only update if the change came from another component
      if (detail.source !== 'use-location-manager') {
        setLocationEnabled(detail.enabled);
        
        // If enabled and permission granted but no position yet, get position
        if (detail.enabled && geolocation.permissionStatus === 'granted' && !geolocation.position) {
          geolocation.getPosition();
        }
      }
    });
    
    // Subscribe to permission changes
    const unsubscribePermission = locationEventBus.subscribe('permission-change', (detail) => {
      // If permission was denied, we should disable location
      if (detail.permissionStatus === 'denied' && locationEnabled) {
        setLocationEnabled(false);
        localStorage.setItem('locationEnabled', 'false');
        
        toast({
          title: 'Location access denied',
          description: 'Please update your browser settings if you want to enable location services.',
          variant: 'destructive',
        });
      }
    });
    
    return () => {
      unsubscribe();
      unsubscribePermission();
    };
  }, [geolocation.permissionStatus, geolocation.position, locationEnabled, toast]);
  
  // Enable location
  const enableLocation = useCallback(() => {
    setLocationEnabled(true);
    
    // Emit location status change event
    locationEventBus.emit('status-change', {
      enabled: true,
      source: 'use-location-manager'
    });
    
    // Get position
    geolocation.getPosition();
    
    // Display toast notification
    toast({
      title: 'Location services enabled',
      description: 'You can now receive location-based recommendations.',
    });
  }, [geolocation, toast]);
  
  // Disable location
  const disableLocation = useCallback(() => {
    setLocationEnabled(false);
    
    // Emit location status change event
    locationEventBus.emit('status-change', {
      enabled: false,
      source: 'use-location-manager'
    });
    
    // Display toast notification
    toast({
      title: 'Location services disabled',
      description: 'You will no longer receive location-based recommendations.',
    });
  }, [toast]);
  
  // Save preference whenever it changes
  useEffect(() => {
    localStorage.setItem('locationEnabled', locationEnabled.toString());
  }, [locationEnabled]);
  
  return {
    ...geolocation,
    locationEnabled,
    enableLocation,
    disableLocation
  };
}
