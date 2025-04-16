
import React from 'react';
import { Link } from 'react-router-dom';
import { useTheme } from '@/contexts/ThemeContext';

interface LogoProps {
  className?: string;
  size?: 'sm' | 'md' | 'lg';
}

const Logo: React.FC<LogoProps> = ({ className, size = 'md' }) => {
  const { getThemedValue } = useTheme();
  
  const sizeClasses = {
    sm: "h-8",
    md: "h-10",
    lg: "h-12"
  };

  // Use different logo images based on theme
  const logoSrc = getThemedValue(
    "/lovable-uploads/87c43c69-609c-4783-9425-7a25bb42926e.png", // Light mode logo
    "/lovable-uploads/87c43c69-609c-4783-9425-7a25bb42926e.png"  // Replace with dark mode logo URL
  );

  return (
    <Link to="/">
      <img 
        src={logoSrc} 
        alt="Common Groundz Logo" 
        className={`${sizeClasses[size]} ${className || ''} cursor-pointer`} 
      />
    </Link>
  );
};

export default Logo;
