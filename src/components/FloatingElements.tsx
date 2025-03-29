
import React, { useEffect, useRef } from 'react';
import { Circle, CircleDot, Sparkles, Sun } from 'lucide-react';

interface FloatingElement {
  x: number;
  y: number;
  size: number;
  opacity: number;
  speed: number;
  element: 'circle' | 'circle-dot' | 'sparkles' | 'sun';
  delay: number;
  pulseSpeed: number;
}

export const FloatingElements = () => {
  const elementsRef = useRef<FloatingElement[]>([
    // Background glowing elements (similar to the provided image)
    { x: 50, y: 10, size: 180, opacity: 0.15, speed: 0.2, element: 'circle', delay: 0, pulseSpeed: 4 },
    { x: 20, y: 30, size: 120, opacity: 0.1, speed: 0.3, element: 'circle', delay: 1, pulseSpeed: 5 },
    
    // Smaller decorative elements
    { x: 85, y: 15, size: 40, opacity: 0.25, speed: 0.5, element: 'circle-dot', delay: 2, pulseSpeed: 3 },
    { x: 15, y: 60, size: 35, opacity: 0.2, speed: 0.4, element: 'sparkles', delay: 0.5, pulseSpeed: 4.5 },
    { x: 75, y: 70, size: 30, opacity: 0.3, speed: 0.6, element: 'sun', delay: 1.5, pulseSpeed: 3 },
    { x: 30, y: 80, size: 25, opacity: 0.35, speed: 0.45, element: 'circle', delay: 0, pulseSpeed: 2.5 },
  ]);
  
  const containerRef = useRef<HTMLDivElement>(null);
  const animationRef = useRef<number>();
  const startTimeRef = useRef<number>(Date.now());

  useEffect(() => {
    const animate = () => {
      if (!containerRef.current) return;
      
      const now = Date.now();
      const elapsedSeconds = (now - startTimeRef.current) / 1000;
      
      elementsRef.current = elementsRef.current.map(element => {
        // Only start animating after delay
        if (elapsedSeconds < element.delay) {
          return element;
        }
        
        // Calculate new position based on time
        const time = (elapsedSeconds - element.delay) * element.speed;
        const newY = element.y + Math.sin(time) * 3;
        
        return {
          ...element,
          y: newY
        };
      });
      
      animationRef.current = requestAnimationFrame(animate);
    };
    
    animationRef.current = requestAnimationFrame(animate);
    
    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, []);

  const getElementComponent = (element: FloatingElement) => {
    const pulseClass = `animate-[pulse_${element.pulseSpeed}s_ease-in-out_infinite]`;
    const floatClass = "float-element";
    const glowClass = "orange-glow";
    
    const style = {
      left: `${element.x}%`,
      top: `${element.y}%`,
      opacity: element.opacity,
      transform: `scale(${element.size / 20})`,
      position: 'absolute' as const,
      color: '#F97316',
    };

    switch (element.element) {
      case 'circle':
        return (
          <div className={`${floatClass} ${pulseClass} ${glowClass}`}>
            <Circle style={style} />
          </div>
        );
      case 'circle-dot':
        return (
          <div className={`${floatClass} ${pulseClass} ${glowClass}`}>
            <CircleDot style={style} />
          </div>
        );
      case 'sparkles':
        return (
          <div className={`${floatClass} ${pulseClass} ${glowClass}`}>
            <Sparkles style={style} />
          </div>
        );
      case 'sun':
        return (
          <div className={`${floatClass} ${pulseClass} ${glowClass}`}>
            <Sun style={style} />
          </div>
        );
      default:
        return (
          <div className={`${floatClass} ${pulseClass} ${glowClass}`}>
            <Circle style={style} />
          </div>
        );
    }
  };

  return (
    <div 
      ref={containerRef} 
      className="absolute inset-0 w-full h-full overflow-hidden pointer-events-none z-0"
    >
      {elementsRef.current.map((element, index) => (
        <div key={index} className="absolute">
          {getElementComponent(element)}
        </div>
      ))}

      {/* Add a large glowing blob behind navbar similar to the example image */}
      <div 
        className="absolute top-[47px] left-1/2 -translate-x-1/2 w-[220px] h-[50px] rounded-full opacity-15 blur-2xl bg-orange-500 pointer-events-none"
        style={{ filter: 'drop-shadow(0 0 35px rgba(249, 115, 22, 0.8))' }}
      />
    </div>
  );
};

export default FloatingElements;
