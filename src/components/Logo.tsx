
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
    "/lovable-uploads/d4621fe6-4a75-45d1-a171-c55f4ad5fa28.png"  // Dark mode logo
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

