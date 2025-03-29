
import React from 'react';
import { useIsMobile } from '@/hooks/use-mobile';

const GlowElements = () => {
  const isMobile = useIsMobile();
  
  return (
    <div className="glow-container">
      {/* Black circle to the left of the heading */}
      <div 
        className="absolute border-2 border-black rounded-full -z-10"
        style={{ 
          top: isMobile ? '10%' : '15%', 
          left: isMobile ? '5%' : '10%',
          width: isMobile ? '100px' : '120px',
          height: isMobile ? '100px' : '120px',
          transform: 'rotate(5deg)'
        }}
      />
      
      {/* Black circle to the bottom right by the "Learn More" button */}
      <div 
        className="absolute border-2 border-black rounded-full -z-10"
        style={{ 
          bottom: isMobile ? '30%' : '25%', 
          right: isMobile ? '5%' : '15%',
          width: isMobile ? '120px' : '150px',
          height: isMobile ? '110px' : '130px',
          transform: 'rotate(-10deg)'
        }}
      />
    </div>
  );
};

export default GlowElements;
