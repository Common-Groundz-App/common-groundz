
import React from 'react';
import { useIsMobile } from '@/hooks/use-mobile';

const GlowElements = () => {
  const isMobile = useIsMobile();
  
  return (
    <>
      {/* Left glow circle */}
      <div 
        className="absolute w-24 h-24 md:w-32 md:h-32 rounded-full bg-brand-orange/20 animate-pulse"
        style={{
          top: isMobile ? '15%' : '15%',
          left: isMobile ? '-5%' : '-5%',
          filter: 'blur(25px)',
          zIndex: 0
        }}
      />
      
      {/* Right glow circle */}
      <div 
        className="absolute w-24 h-24 md:w-32 md:h-32 rounded-full bg-brand-orange/20 animate-pulse"
        style={{
          bottom: isMobile ? '5%' : '15%',
          right: isMobile ? '-5%' : '-5%',
          filter: 'blur(25px)',
          zIndex: 0
        }}
      />
    </>
  );
};

export default GlowElements;
