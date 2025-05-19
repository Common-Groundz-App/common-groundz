
import React from 'react';

export interface ConnectedRingsRatingProps {
  value?: number;
  size?: "sm" | "md" | "lg";
  maxValue?: number;
  color?: string;
}

const ConnectedRingsRating: React.FC<ConnectedRingsRatingProps> = ({ 
  value = 0, 
  size = "md", 
  maxValue = 5,
  color = "currentColor"
}) => {
  // Convert the rating to a percentage
  const percentage = Math.min(Math.max((value / maxValue) * 100, 0), 100);
  
  // Define sizes for different size options
  const sizes = {
    sm: { width: 40, height: 16, fontSize: 10, gap: 4 },
    md: { width: 60, height: 24, fontSize: 12, gap: 6 },
    lg: { width: 80, height: 32, fontSize: 14, gap: 8 },
  };
  
  const { width, height, fontSize, gap } = sizes[size];
  
  return (
    <div 
      className="inline-flex items-center"
      style={{ height, gap }}
    >
      <div 
        className="relative overflow-hidden rounded-full"
        style={{ width, height: height / 2 }}
      >
        {/* Background track */}
        <div 
          className="absolute inset-0 bg-muted/30 rounded-full"
        />
        
        {/* Filled track */}
        <div 
          className="absolute inset-0 bg-current rounded-full"
          style={{ 
            width: `${percentage}%`,
            color
          }}
        />
      </div>
      
      <span 
        className="font-medium"
        style={{ fontSize }}
      >
        {value.toFixed(1)}
      </span>
    </div>
  );
};

export default ConnectedRingsRating;
