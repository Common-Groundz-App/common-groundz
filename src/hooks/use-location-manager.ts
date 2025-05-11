
import { useState, useEffect, useCallback } from 'react';
import { useGeolocation } from './use-geolocation';

export function useLocationManager() {
  const geolocation = useGeolocation();
  const [locationEnabled, setLocationEnabled] = useState<boolean>(false);
  
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
  }, [geolocation.permissionStatus]);
  
  // Save preference whenever it changes
  useEffect(() => {
    localStorage.setItem('locationEnabled', locationEnabled.toString());
  }, [locationEnabled]);
  
  const enableLocation = useCallback(() => {
    setLocationEnabled(true);
    geolocation.getPosition();
  }, [geolocation]);
  
  const disableLocation = useCallback(() => {
    setLocationEnabled(false);
  }, []);
  
  return {
    ...geolocation,
    locationEnabled,
    enableLocation,
    disableLocation
  };
}
