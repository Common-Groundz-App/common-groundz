
import * as React from "react";

export function useHasTouchScreen() {
  const [hasTouchScreen, setHasTouchScreen] = React.useState<boolean>(false);
  
  React.useEffect(() => {
    // Check if the device has touch capabilities
    const detectTouch = () => {
      // First check navigator.maxTouchPoints
      if (navigator.maxTouchPoints > 0) {
        return true;
      }
      
      // Then check media query for touch devices
      if (window.matchMedia('(pointer: coarse)').matches) {
        return true;
      }
      
      // Fallback to older methods for older browsers
      return (
        'ontouchstart' in window || 
        navigator.maxTouchPoints > 0 || 
        (navigator as any).msMaxTouchPoints > 0
      );
    };
    
    setHasTouchScreen(detectTouch());
    
    // Re-check on orientation change since some devices may change capabilities
    const handleOrientationChange = () => {
      setHasTouchScreen(detectTouch());
    };
    
    window.addEventListener('orientationchange', handleOrientationChange);
    
    return () => {
      window.removeEventListener('orientationchange', handleOrientationChange);
    };
  }, []);
  
  return hasTouchScreen;
}
