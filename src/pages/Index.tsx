
import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import HeroSection from '@/components/HeroSection';
import FeaturesSection from '@/components/FeaturesSection';
import TestimonialsSection from '@/components/TestimonialsSection';
import CTASection from '@/components/CTASection';
import Footer from '@/components/Footer';
import NavBarComponent from '@/components/NavBarComponent';

const Index = () => {
  const { user } = useAuth();

  // Redirect to /home if user is logged in
  if (user) {
    return <Navigate to="/home" replace />;
  }

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
