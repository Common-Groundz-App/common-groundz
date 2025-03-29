
import React from 'react';

const GlowElements = () => {
  return (
    <div className="glow-container">
      {/* Large glow behind navbar */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[300px] bg-orange-500/20 rounded-full blur-[80px] -z-10" />
      
      {/* Multiple floating glows */}
      <div className="glow-element glow-lg" style={{ top: '15%', left: '10%', animationDelay: '0s' }} />
      <div className="glow-element glow-md" style={{ top: '80%', left: '15%', animationDelay: '2.3s' }} />
      <div className="glow-element glow-sm" style={{ top: '30%', left: '80%', animationDelay: '1.1s' }} />
      <div className="glow-element glow-md" style={{ top: '70%', left: '75%', animationDelay: '3.7s' }} />
      <div className="glow-element glow-lg" style={{ top: '40%', left: '5%', animationDelay: '2.1s' }} />
      <div className="glow-element glow-sm" style={{ top: '20%', left: '60%', animationDelay: '4.2s' }} />
      <div className="glow-element glow-md" style={{ top: '60%', left: '30%', animationDelay: '1.8s' }} />
      <div className="glow-element glow-sm" style={{ top: '50%', left: '90%', animationDelay: '3.3s' }} />
    </div>
  );
};

export default GlowElements;
