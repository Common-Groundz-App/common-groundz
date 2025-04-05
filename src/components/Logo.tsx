
import React from 'react';
import { Link } from 'react-router-dom';

interface LogoProps {
  className?: string;
  size?: 'sm' | 'md' | 'lg';
  responsive?: boolean;
}

const Logo: React.FC<LogoProps> = ({ className, size = 'md', responsive = false }) => {
  const sizeClasses = {
    sm: responsive ? "h-6 md:h-8" : "h-8",
    md: responsive ? "h-8 md:h-10" : "h-10",
    lg: responsive ? "h-10 md:h-12" : "h-12"
  };

  return (
    <Link to="/" className="inline-flex items-center">
      <img 
        src="/lovable-uploads/87c43c69-609c-4783-9425-7a25bb42926e.png" 
        alt="Common Groundz Logo" 
        className={`${sizeClasses[size]} ${className || ''} object-contain cursor-pointer`} 
      />
    </Link>
  );
};

export default Logo;
