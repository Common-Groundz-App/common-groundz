
import * as React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Skeleton } from '@/components/ui/skeleton';
import HeroSection from '@/components/HeroSection';
import FeaturesSection from '@/components/FeaturesSection';
import TestimonialsSection from '@/components/TestimonialsSection';
import CTASection from '@/components/CTASection';
import Footer from '@/components/Footer';
import NavBarComponent from '@/components/NavBarComponent';

const Index = () => {
  const { user, isLoading } = useAuth();
  const location = useLocation();
  const [hasRedirected, setHasRedirected] = React.useState(false);

  console.log('🏠 Index render:', { 
    isLoading, 
    hasUser: !!user, 
    pathname: location.pathname,
    hasRedirected 
  });

  // Show loading state while authentication is being checked
  if (isLoading) {
    console.log('⏳ Showing loading state...');
    return (
      <div className="flex flex-col items-center justify-center min-h-screen p-4">
        <div className="w-full max-w-md space-y-4">
          <Skeleton className="h-8 w-3/4 mx-auto" />
          <Skeleton className="h-32 w-full" />
          <div className="space-y-2">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-5/6" />
            <Skeleton className="h-4 w-4/6" />
          </div>
        </div>
        <p className="text-muted-foreground mt-4">Loading...</p>
      </div>
    );
  }

  // Redirect to /home if user is logged in and we're on the root path
  // Add guards to prevent redirect loops
  if (user && location.pathname === '/' && !hasRedirected) {
    console.log('🔄 Authenticated user on root path, redirecting to /home');
    setHasRedirected(true);
    return <Navigate to="/home" replace />;
  }

  // If we're not on the root path and user is authenticated, don't redirect
  if (user && location.pathname !== '/') {
    console.log('✅ Authenticated user on non-root path, staying put');
    return null; // Let the router handle the current path
  }

  // Render landing page if user is not authenticated or we're explicitly on root
  console.log('🎨 Rendering landing page');
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
};

export default Index;
