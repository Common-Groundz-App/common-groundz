
import React from 'react';

const GlowElements = () => {
  return (
    <div className="glow-container">
      {/* Two main glow circles - one on each side */}
      <div 
        className="absolute w-[200px] h-[200px] rounded-full bg-orange-500/30 blur-[40px] -z-10 animate-pulse-slow"
        style={{ top: '30%', left: '5%' }}
      />
      <div 
        className="absolute w-[200px] h-[200px] rounded-full bg-orange-500/30 blur-[40px] -z-10 animate-pulse-slow"
        style={{ top: '60%', right: '5%', animationDelay: '1.5s' }}
      />
    </div>
  );
};

export default GlowElements;
