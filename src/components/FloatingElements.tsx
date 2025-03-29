
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
}

export const FloatingElements = () => {
  const elementsRef = useRef<FloatingElement[]>([
    { x: 15, y: 20, size: 40, opacity: 0.2, speed: 0.4, element: 'circle', delay: 0 },
    { x: 80, y: 15, size: 25, opacity: 0.15, speed: 0.5, element: 'circle-dot', delay: 2 },
    { x: 45, y: 60, size: 35, opacity: 0.12, speed: 0.3, element: 'sparkles', delay: 1 },
    { x: 75, y: 70, size: 30, opacity: 0.18, speed: 0.6, element: 'sun', delay: 3 },
    { x: 25, y: 80, size: 20, opacity: 0.25, speed: 0.45, element: 'circle', delay: 0.5 },
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
        const newY = element.y + Math.sin(time) * 5;
        
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
        return <Circle style={style} />;
      case 'circle-dot':
        return <CircleDot style={style} />;
      case 'sparkles':
        return <Sparkles style={style} />;
      case 'sun':
        return <Sun style={style} />;
      default:
        return <Circle style={style} />;
    }
  };

  return (
    <div 
      ref={containerRef} 
      className="absolute inset-0 w-full h-full overflow-hidden pointer-events-none z-0"
    >
      {elementsRef.current.map((element, index) => (
        <div key={index} className="absolute transition-all duration-1000 ease-in-out">
          {getElementComponent(element)}
        </div>
      ))}
    </div>
  );
};

export default FloatingElements;
