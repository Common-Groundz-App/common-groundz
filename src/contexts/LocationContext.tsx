
import React, { createContext, useContext, ReactNode, useEffect } from 'react';
import { useLocationManager } from '@/hooks/use-location-manager';
import { locationEventBus } from '@/hooks/use-geolocation';

type LocationContextType = ReturnType<typeof useLocationManager>;

const LocationContext = createContext<LocationContextType | undefined>(undefined);

export const LocationProvider = ({ children }: { children: ReactNode }) => {
  const locationManager = useLocationManager();
  
  // When this context changes the location enabled status, broadcast to all components
  useEffect(() => {
    // This is a global context change notification
    // We don't need to emit an event here because the useLocationManager hook
    // already emits events when enableLocation or disableLocation are called
  }, [locationManager.locationEnabled]);
  
  return (
    <LocationContext.Provider value={locationManager}>
      {children}
    </LocationContext.Provider>
  );
};

export const useLocation = () => {
  const context = useContext(LocationContext);
  if (context === undefined) {
    throw new Error('useLocation must be used within a LocationProvider');
  }
  return context;
};

// Add a utility function to trigger location status changes from anywhere
export const setLocationStatus = (enabled: boolean, source: string = 'external') => {
  locationEventBus.emit('status-change', { 
    enabled, 
    source 
  });
};
