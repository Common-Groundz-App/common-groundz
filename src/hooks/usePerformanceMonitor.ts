
import { useEffect, useRef } from 'react';

interface PerformanceMetrics {
  componentName: string;
  renderTime: number;
  mountTime: number;
}

export const usePerformanceMonitor = (componentName: string) => {
  const mountTimeRef = useRef<number>();
  const renderStartRef = useRef<number>();

  useEffect(() => {
    // Record mount time
    mountTimeRef.current = performance.now();
    
    return () => {
      // Calculate total mount time
      if (mountTimeRef.current) {
        const totalMountTime = performance.now() - mountTimeRef.current;
        console.log(`[Performance] ${componentName} total mount time: ${totalMountTime.toFixed(2)}ms`);
      }
    };
  }, [componentName]);

  const startRender = () => {
    renderStartRef.current = performance.now();
  };

  const endRender = () => {
    if (renderStartRef.current) {
      const renderTime = performance.now() - renderStartRef.current;
      console.log(`[Performance] ${componentName} render time: ${renderTime.toFixed(2)}ms`);
    }
  };

  return { startRender, endRender };
};
