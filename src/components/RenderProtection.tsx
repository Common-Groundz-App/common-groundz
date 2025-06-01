
import React, { useRef, useEffect } from 'react';

interface RenderProtectionProps {
  children: React.ReactNode;
  maxRenders?: number;
  timeWindow?: number;
}

const RenderProtection: React.FC<RenderProtectionProps> = ({ 
  children, 
  maxRenders = 100, 
  timeWindow = 5000 
}) => {
  const renderCount = useRef(0);
  const startTime = useRef(Date.now());
  const [isBlocked, setIsBlocked] = React.useState(false);

  useEffect(() => {
    renderCount.current++;
    const now = Date.now();
    
    // Reset counter if time window has passed
    if (now - startTime.current > timeWindow) {
      renderCount.current = 1;
      startTime.current = now;
      setIsBlocked(false);
      return;
    }

    console.log(`🔄 [RenderProtection] Render count: ${renderCount.current}/${maxRenders} in ${now - startTime.current}ms`);

    if (renderCount.current > maxRenders) {
      console.error(`🚨 [RenderProtection] INFINITE RENDER DETECTED! Blocking further renders. Count: ${renderCount.current}`);
      setIsBlocked(true);
    }
  });

  if (isBlocked) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="text-center max-w-md">
          <h1 className="text-2xl font-bold text-red-600 mb-4">Render Loop Detected</h1>
          <p className="text-gray-600 mb-4">
            The app detected an infinite render loop and stopped to prevent browser crash.
          </p>
          <button 
            onClick={() => window.location.reload()}
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            Reload Page
          </button>
        </div>
      </div>
    );
  }

  return <>{children}</>;
};

export default RenderProtection;
