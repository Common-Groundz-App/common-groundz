
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

// Create a custom event type for location updates
export type LocationEventType = 'status-change' | 'position-update' | 'permission-change';
export type LocationEventDetail = {
  enabled: boolean;
  position?: GeolocationState['position'];
  permissionStatus?: PermissionState | null;
  timestamp?: number | null;
  source?: string; // Which component triggered the change
};

// Create a singleton event bus for location events
class LocationEventBus {
  private static instance: LocationEventBus;
  
  private constructor() {}
  
  public static getInstance(): LocationEventBus {
    if (!LocationEventBus.instance) {
      LocationEventBus.instance = new LocationEventBus();
    }
    return LocationEventBus.instance;
  }
  
  public emit(type: LocationEventType, detail: LocationEventDetail): void {
    const event = new CustomEvent<LocationEventDetail>(`location:${type}`, { detail });
    window.dispatchEvent(event);
    
    // Also dispatch a general location-change event for any listeners
    const generalEvent = new CustomEvent<LocationEventDetail>('location:change', { detail });
    window.dispatchEvent(generalEvent);
    
    // Store last state in localStorage for persistence
    if (type === 'status-change') {
      localStorage.setItem('locationEnabled', detail.enabled.toString());
      localStorage.setItem('locationLastChanged', Date.now().toString());
    }
  }
  
  public subscribe(type: LocationEventType | 'change', callback: (detail: LocationEventDetail) => void): () => void {
    const eventName = type === 'change' ? 'location:change' : `location:${type}`;
    
    const handler = (event: Event) => {
      const customEvent = event as CustomEvent<LocationEventDetail>;
      callback(customEvent.detail);
    };
    
    window.addEventListener(eventName, handler);
    
    // Return unsubscribe function
    return () => {
      window.removeEventListener(eventName, handler);
    };
  }
}

export const locationEventBus = LocationEventBus.getInstance();

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
  
  // Try to get cached position on mount
  useEffect(() => {
    const cachedPosition = localStorage.getItem('lastKnownPosition');
    const cachedTimestamp = localStorage.getItem('lastPositionTimestamp');
    
    if (cachedPosition) {
      try {
        const position = JSON.parse(cachedPosition);
        setState(prev => ({
          ...prev,
          position,
          timestamp: cachedTimestamp ? parseInt(cachedTimestamp) : null
        }));
      } catch (e) {
        console.error('Error parsing cached position:', e);
      }
    }
  }, []);

  // Check permission status
  const checkPermission = useCallback(async () => {
    if (!isGeolocationSupported) return;
    
    try {
      // Only works in secure contexts (HTTPS)
      if ('permissions' in navigator) {
        const permission = await navigator.permissions.query({ name: 'geolocation' as PermissionName });
        setState(prev => ({ ...prev, permissionStatus: permission.state }));
        
        // Emit permission change event
        locationEventBus.emit('permission-change', {
          enabled: localStorage.getItem('locationEnabled') === 'true',
          permissionStatus: permission.state,
          source: 'permission-check'
        });
        
        permission.addEventListener('change', () => {
          setState(prev => ({ ...prev, permissionStatus: permission.state }));
          
          // Emit permission change event when browser permission changes
          locationEventBus.emit('permission-change', {
            enabled: localStorage.getItem('locationEnabled') === 'true',
            permissionStatus: permission.state,
            source: 'permission-listener'
          });
        });
      }
    } catch (error) {
      console.error('Error checking geolocation permission:', error);
    }
  }, [isGeolocationSupported]);

  useEffect(() => {
    checkPermission();
  }, [checkPermission]);

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

    setState(prev => ({ ...prev, isLoading: true }));

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const positionData = {
          latitude: position.coords.latitude,
          longitude: position.coords.longitude
        };
        
        // Cache the position
        localStorage.setItem('lastKnownPosition', JSON.stringify(positionData));
        localStorage.setItem('lastPositionTimestamp', position.timestamp.toString());
        
        const newState = {
          isLoading: false,
          position: positionData,
          error: null,
          permissionStatus: state.permissionStatus,
          timestamp: position.timestamp
        };
        
        setState(newState);
        
        // Emit position update event
        locationEventBus.emit('position-update', {
          enabled: true,
          position: positionData,
          timestamp: position.timestamp,
          source: 'get-position'
        });
      },
      (error) => {
        setState(prev => ({
          ...prev,
          error,
          isLoading: false
        }));
        
        // If error is permission denied, update the permission status
        if (error.code === 1) { // PERMISSION_DENIED
          locationEventBus.emit('permission-change', {
            enabled: false,
            permissionStatus: 'denied',
            source: 'position-error'
          });
        }
      },
      { 
        enableHighAccuracy: true, 
        timeout: 10000, 
        maximumAge: 300000 // 5 minutes cache
      }
    );
  }, [isGeolocationSupported, state.permissionStatus]);

  // Calculate distance between two coordinates in kilometers
  const calculateDistance = useCallback((lat1: number, lon1: number, lat2: number, lon2: number): number => {
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
  }, []);
  
  const deg2rad = (deg: number): number => {
    return deg * (Math.PI/180);
  };

  // Format distance for display
  const formatDistance = useCallback((distance: number): string => {
    if (distance < 1) {
      return `${Math.round(distance * 1000)} m`;
    }
    return `${Math.round(distance * 10) / 10} km`;
  }, []);

  // Get the last known position timestamp
  const getLastPositionTimestamp = useCallback((): number | null => {
    const timestamp = localStorage.getItem('lastPositionTimestamp');
    return timestamp ? parseInt(timestamp) : null;
  }, []);
  
  // Reset permission denied state - usually by directing user to browser settings
  const resetPermissionDenied = useCallback(() => {
    // This would typically open browser settings on most devices
    // But since we can't do that directly, we'll show an alert
    alert("Please update your browser settings to allow location access");
  }, []);

  return {
    ...state,
    getPosition,
    isGeolocationSupported,
    checkPermission,
    calculateDistance,
    formatDistance,
    getLastPositionTimestamp,
    resetPermissionDenied
  };
}
