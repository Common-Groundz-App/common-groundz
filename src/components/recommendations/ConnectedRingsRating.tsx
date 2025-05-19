
import React from 'react';

export interface ConnectedRingsRatingProps {
  value?: number;
  size?: "sm" | "md" | "lg" | "badge" | "xs";
  maxValue?: number;
  color?: string;
  variant?: string;
  minimal?: boolean;
  showValue?: boolean;
  isInteractive?: boolean;
  showLabel?: boolean;
  onChange?: (value: number) => void;
  className?: string;
}

const ConnectedRingsRating: React.FC<ConnectedRingsRatingProps> = ({ 
  value = 0, 
  size = "md", 
  maxValue = 5,
  color = "currentColor",
  variant,
  minimal = false,
  showValue = true,
  isInteractive = false,
  showLabel = false,
  onChange,
  className = ""
}) => {
  // Convert the rating to a percentage
  const percentage = Math.min(Math.max((value / maxValue) * 100, 0), 100);
  
  // Define sizes for different size options
  const sizes = {
    xs: { width: 32, height: 12, fontSize: 9, gap: 3 },
    sm: { width: 40, height: 16, fontSize: 10, gap: 4 },
    md: { width: 60, height: 24, fontSize: 12, gap: 6 },
    lg: { width: 80, height: 32, fontSize: 14, gap: 8 },
    badge: { width: 36, height: 14, fontSize: 10, gap: 3 },
  };
  
  const { width, height, fontSize, gap } = sizes[size] || sizes.md;
  
  // Handle click event for interactive mode
  const handleClick = (e: React.MouseEvent) => {
    if (!isInteractive || !onChange) return;
    
    const container = e.currentTarget as HTMLDivElement;
    const rect = container.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const percentage = (x / rect.width) * 100;
    const newValue = Math.max(0.5, Math.min(Math.ceil(percentage / 20) / 2, maxValue));
    
    onChange(newValue);
  };
  
  // Get label text based on rating value
  const getRatingLabel = () => {
    if (value < 1) return "Poor";
    if (value < 2) return "Fair";
    if (value < 3) return "Average";
    if (value < 4) return "Good";
    if (value < 4.5) return "Very Good";
    return "Excellent";
  };
  
  return (
    <div 
      className={`inline-flex items-center ${className} ${isInteractive ? 'cursor-pointer' : ''}`}
      style={{ height, gap }}
      onClick={isInteractive ? handleClick : undefined}
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
      
      {showValue && (
        <span 
          className="font-medium"
          style={{ fontSize }}
        >
          {value.toFixed(1)}
        </span>
      )}
      
      {showLabel && value > 0 && (
        <span 
          className="text-muted-foreground ml-1"
          style={{ fontSize }}
        >
          {getRatingLabel()}
        </span>
      )}
    </div>
  );
};

export default ConnectedRingsRating;
