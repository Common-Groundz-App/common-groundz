
import React, { createContext, useContext, ReactNode } from 'react';
import { useLocationManager } from '@/hooks/use-location-manager';

type LocationContextType = ReturnType<typeof useLocationManager>;

const LocationContext = createContext<LocationContextType | undefined>(undefined);

export const LocationProvider = ({ children }: { children: ReactNode }) => {
  const locationManager = useLocationManager();
  
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
