
import React from 'react';
import { useIsMobile } from '@/hooks/use-mobile';

const GlowElements = () => {
  const isMobile = useIsMobile();
  
  return (
    <div className="glow-container">
      {/* Two main glow circles positioned around the hero heading */}
      <div 
        className="absolute w-[200px] h-[200px] rounded-full bg-orange-500/30 blur-[40px] -z-10 animate-pulse-slow"
        style={{ 
          top: isMobile ? '20%' : '30%', 
          left: isMobile ? '0' : '10%'
        }}
      />
      <div 
        className="absolute w-[180px] h-[180px] rounded-full bg-orange-500/25 blur-[35px] -z-10 animate-pulse-slow"
        style={{ 
          top: isMobile ? '25%' : '35%', 
          right: isMobile ? '0' : '10%', 
          animationDelay: '1.5s' 
        }}
      />
      <div 
        className="absolute w-[120px] h-[120px] rounded-full bg-orange-500/20 blur-[30px] -z-10 animate-pulse-slow"
        style={{ 
          top: isMobile ? '15%' : '25%', 
          left: '50%',
          transform: 'translateX(-50%)',
          animationDelay: '2.5s' 
        }}
      />
    </div>
  );
};

export default GlowElements;
