
import React from 'react';
import { useIsMobile } from '@/hooks/use-mobile';

const GlowElements = () => {
  const isMobile = useIsMobile();
  
  return (
    <div className="glow-container">
      {/* Glow circle near the top right of heading */}
      <div 
        className="absolute w-[180px] h-[180px] rounded-full bg-orange-500/30 blur-[40px] -z-10 animate-pulse-slow"
        style={{ 
          top: isMobile ? '15%' : '25%', 
          right: isMobile ? '5%' : '15%'
        }}
      />
      
      {/* Glow circle near learn more button */}
      <div 
        className="absolute w-[150px] h-[150px] rounded-full bg-orange-500/25 blur-[35px] -z-10 animate-pulse-slow"
        style={{ 
          top: isMobile ? '40%' : '50%', 
          left: isMobile ? '5%' : '15%',
          animationDelay: '1.5s' 
        }}
      />
    </div>
  );
};

export default GlowElements;
