
import React from 'react';
import { Link } from 'react-router-dom';

interface LogoProps {
  className?: string;
  size?: 'sm' | 'md' | 'lg';
}

const Logo: React.FC<LogoProps> = ({ className, size = 'md' }) => {
  const sizeClasses = {
    sm: "h-8",
    md: "h-10",
    lg: "h-12"
  };

  return (
    <Link to="/">
      <img 
        src="/lovable-uploads/87c43c69-609c-4783-9425-7a25bb42926e.png" 
        alt="Common Groundz Logo" 
        className={`${sizeClasses[size]} ${className || ''} cursor-pointer`} 
      />
    </Link>
  );
};

export default Logo;
