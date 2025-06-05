
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
  const { user, session, isLoading } = useAuth();

  // CRITICAL: Don't do anything until auth is fully initialized
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center space-y-4">
          <LoadingSpinner size="lg" />
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  // Enhanced redirect logic - require both user AND valid session
  if (user && session) {
    // Additional session validation
    if (session.expires_at && new Date(session.expires_at * 1000) > new Date()) {
      console.log('Index: Valid user and session found, redirecting to home');
      return <Navigate to="/home" replace />;
    } else {
      console.log('Index: Session expired, showing landing page');
    }
  }
  
  console.log('Index: No valid authentication, showing landing page');
  // Show landing page for unauthenticated users or expired sessions
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
