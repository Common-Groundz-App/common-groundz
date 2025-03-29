
import React from 'react';
import { useIsMobile } from '@/hooks/use-mobile';

const GlowElements = () => {
  const isMobile = useIsMobile();
  
  return (
    <>
      {/* Left glow circle */}
      <div 
        className="absolute w-32 h-32 md:w-48 md:h-48 rounded-full bg-brand-orange/20 animate-pulse"
        style={{
          bottom: isMobile ? '15%' : '25%',
          left: isMobile ? '-10%' : '-10%',
          filter: 'blur(25px)',
          zIndex: 0
        }}
      />
      
      {/* Right glow circle */}
      <div 
        className="absolute w-32 h-32 md:w-48 md:h-48 rounded-full bg-brand-orange/20 animate-pulse"
        style={{
          top: isMobile ? '5%' : '5%',
          right: isMobile ? '-10%' : '-10%',
          filter: 'blur(25px)',
          zIndex: 0
        }}
      />
    </>
  );
};

export default GlowElements;
