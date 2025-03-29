
import React from 'react';
import AuthFeatures from './AuthFeatures';

const AuthBrandPanel = () => {
  return (
    <div className="w-full lg:w-1/2 bg-gradient-to-br from-brand-orange/10 via-brand-blue/10 to-brand-teal/10 flex-col items-center justify-center p-12 relative hidden lg:flex">
      <div className="max-w-md text-center mb-12">
        <h2 className="text-4xl font-bold mb-6 text-brand-orange">Find Common Ground</h2>
        <p className="text-lg mb-8">
          Discover recommendations from people who share your interests and tastes.
        </p>
        
        <AuthFeatures />
      </div>
      
      {/* Decorative elements */}
      <div className="absolute bottom-10 right-10 h-32 w-32 rounded-full bg-brand-orange/20 animate-pulse-delay-0 filter blur-xl"></div>
      <div className="absolute top-20 left-10 h-24 w-24 rounded-full bg-brand-blue/20 animate-pulse-delay-2 filter blur-xl"></div>
      <div className="absolute bottom-40 left-20 h-16 w-16 rounded-full bg-brand-teal/20 animate-pulse-delay-0 filter blur-xl"></div>
    </div>
  );
};

export default AuthBrandPanel;
