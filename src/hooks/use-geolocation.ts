
import { useState, useEffect, useCallback } from 'react';

export type GeolocationState = {
  isLoading: boolean;
  position: {
    latitude: number;
    longitude: number;
  } | null;
  error: GeolocationPositionError | null;
  permissionStatus: PermissionState | null;
  timestamp: number | null;
};

export function useGeolocation() {
  const [state, setState] = useState<GeolocationState>({
    isLoading: false,
    position: null,
    error: null,
    permissionStatus: null,
    timestamp: null,
  });

  // Check if geolocation is supported by the browser
  const isGeolocationSupported = 'geolocation' in navigator;

  // Check permission status
  const checkPermission = useCallback(async () => {
    if (!isGeolocationSupported) return;
    
    try {
      // Only works in secure contexts (HTTPS)
      if ('permissions' in navigator) {
        const permission = await navigator.permissions.query({ name: 'geolocation' as PermissionName });
        setState(prev => ({ ...prev, permissionStatus: permission.state }));
        
        permission.addEventListener('change', () => {
          setState(prev => ({ ...prev, permissionStatus: permission.state }));
        });
        
        return permission.state;
      }
    } catch (error) {
      console.error('Error checking geolocation permission:', error);
    }
    return null;
  }, [isGeolocationSupported]);

  useEffect(() => {
    checkPermission();
  }, [checkPermission]);

  // Reset error state so UI can return to initial state
  const resetError = useCallback(() => {
    setState(prev => ({
      ...prev,
      error: null
    }));
  }, []);

  // Request the user's location
  const getPosition = useCallback(() => {
    if (!isGeolocationSupported) {
      setState(prev => ({
        ...prev,
        error: new GeolocationPositionError(),
        isLoading: false
      }));
      return;
    }

    setState(prev => ({ ...prev, isLoading: true, error: null }));

    navigator.geolocation.getCurrentPosition(
      (position) => {
        setState({
          isLoading: false,
          position: {
            latitude: position.coords.latitude,
            longitude: position.coords.longitude
          },
          error: null,
          permissionStatus: state.permissionStatus,
          timestamp: position.timestamp
        });
      },
      (error) => {
        setState(prev => ({
          ...prev,
          error,
          isLoading: false
        }));
        
        // Update permission status when error occurs
        if (error.code === 1) { // PERMISSION_DENIED
          checkPermission();
        }
      },
      { 
        enableHighAccuracy: true, 
        timeout: 10000, 
        maximumAge: 300000 // 5 minutes cache
      }
    );
  }, [isGeolocationSupported, state.permissionStatus, checkPermission]);

  // Calculate distance between two coordinates in kilometers
  const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
    const R = 6371; // Radius of the earth in km
    const dLat = deg2rad(lat2 - lat1);
    const dLon = deg2rad(lon2 - lon1); 
    const a = 
      Math.sin(dLat/2) * Math.sin(dLat/2) +
      Math.cos(deg2rad(lat1)) * Math.cos(deg2rad(lat2)) * 
      Math.sin(dLon/2) * Math.sin(dLon/2); 
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a)); 
    const distance = R * c; // Distance in km
    return distance;
  };
  
  const deg2rad = (deg: number): number => {
    return deg * (Math.PI/180);
  };

  // Format distance for display
  const formatDistance = (distance: number): string => {
    if (distance < 1) {
      return `${Math.round(distance * 1000)} m`;
    }
    return `${Math.round(distance * 10) / 10} km`;
  };

  return {
    ...state,
    getPosition,
    resetError,
    isGeolocationSupported,
    checkPermission,
    calculateDistance,
    formatDistance
  };
}
