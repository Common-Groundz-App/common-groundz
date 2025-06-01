
import * as React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import HeroSection from '@/components/HeroSection';
import FeaturesSection from '@/components/FeaturesSection';
import TestimonialsSection from '@/components/TestimonialsSection';
import CTASection from '@/components/CTASection';
import Footer from '@/components/Footer';
import NavBarComponent from '@/components/NavBarComponent';
import { LoadingSpinner } from '@/components/ui/loading-spinner';

const Index = () => {
  const { user, isLoading } = useAuth();

  console.log('🏠 [Index] Rendering - isLoading:', isLoading, 'user:', user ? 'authenticated' : 'not authenticated');

  // CRITICAL: Don't do anything until auth is fully initialized
  if (isLoading) {
    console.log('⏳ [Index] Auth still loading, showing spinner...');
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center space-y-4">
          <LoadingSpinner size="lg" />
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  // Simple redirect logic - auth is already initialized by AuthInitializer
  if (user) {
    console.log('🔀 [Index] User authenticated, redirecting to /home');
    return <Navigate to="/home" replace />;
  }

  console.log('📄 [Index] Showing landing page');
  
  // Show landing page for unauthenticated users
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
