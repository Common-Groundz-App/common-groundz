
import * as React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import HeroSection from '@/components/HeroSection';
import FeaturesSection from '@/components/FeaturesSection';
import TestimonialsSection from '@/components/TestimonialsSection';
import CTASection from '@/components/CTASection';
import Footer from '@/components/Footer';
import NavBarComponent from '@/components/NavBarComponent';

const Index = () => {
  const { user, isLoading } = useAuth();
  const [renderCount, setRenderCount] = React.useState(0);
  const lastStateRef = React.useRef({ user: null, isLoading: true });

  // Track renders with a limit to prevent infinite loops
  React.useEffect(() => {
    setRenderCount(prev => {
      const newCount = prev + 1;
      if (newCount > 100) {
        console.error('🚨 [Index] Too many renders detected! Stopping count.');
        return 100;
      }
      return newCount;
    });
  });

  // Track state changes over time (but only when they actually change)
  React.useEffect(() => {
    const timestamp = new Date().toISOString();
    const currentState = { user: !!user, isLoading };
    const lastState = lastStateRef.current;
    
    // Only log if state actually changed
    if (currentState.user !== !!lastState.user || currentState.isLoading !== lastState.isLoading) {
      console.log(`🔍 [${timestamp}] Index state change:`, { 
        renderCount,
        isLoading, 
        hasUser: !!user,
        userId: user?.id || 'none',
        userEmail: user?.email || 'none'
      });
      
      lastStateRef.current = { user, isLoading };
    }
  }, [isLoading, user, renderCount]);

  // Memoize the decision logic to prevent unnecessary re-calculations
  const routingDecision = React.useMemo(() => {
    const timestamp = new Date().toISOString();
    
    if (isLoading) {
      console.log(`⏳ [${timestamp}] Loading state active - render #${renderCount}`);
      return { type: 'loading' };
    }

    if (user) {
      console.log(`🔄 [${timestamp}] Authenticated user detected, redirecting to /home - render #${renderCount}`, {
        userId: user.id,
        email: user.email
      });
      return { type: 'redirect' };
    }

    console.log(`🎨 [${timestamp}] Rendering landing page - render #${renderCount}`);
    return { type: 'landing' };
  }, [isLoading, user, renderCount]);

  // Prevent renders beyond reasonable limit
  if (renderCount > 50) {
    console.error('🚨 [Index] Render limit exceeded, forcing stable state');
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-red-600 mb-4">Render Loop Detected</h1>
          <p className="text-gray-600">Please refresh the page</p>
        </div>
      </div>
    );
  }

  // Handle routing decisions
  switch (routingDecision.type) {
    case 'loading':
      return <LoadingSpinner size="lg" text="Loading..." className="min-h-screen flex items-center justify-center" />;
    
    case 'redirect':
      return <Navigate to="/home" replace />;
    
    case 'landing':
    default:
      return (
        <div className="min-h-screen">
          <NavBarComponent />
          <main>
            <HeroSection />
            <FeaturesSection />
            <TestimonialsSection />
            <CTASection />
          </main>
          <Footer />
        </div>
      );
  }
};

export default Index;
