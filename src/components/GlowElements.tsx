
import React from 'react';
import { useIsMobile } from '@/hooks/use-mobile';

const GlowElements = () => {
  const isMobile = useIsMobile();
  
  return (
    <>
      {/* Top left glow circle */}
      <div 
        className="absolute w-40 h-40 md:w-64 md:h-64 rounded-full bg-brand-orange/20 animate-pulse-delay-0"
        style={{
          top: isMobile ? '0' : '-5%',
          left: isMobile ? '-5%' : '-5%',
          filter: 'blur(25px)',
          zIndex: 0
        }}
      />
      
      {/* Bottom right glow circle */}
      <div 
        className="absolute w-40 h-40 md:w-64 md:h-64 rounded-full bg-brand-orange/20 animate-pulse-delay-2"
        style={{
          bottom: isMobile ? '0' : '-5%',
          right: isMobile ? '-5%' : '-5%',
          filter: 'blur(25px)',
          zIndex: 0
        }}
      />
    </>
  );
};

export default GlowElements;
