
import React from 'react';
import { Link } from 'react-router-dom';

interface LogoProps {
  className?: string;
  size?: 'sm' | 'md' | 'lg';
  responsive?: boolean;
  linkTo?: string;
  noLink?: boolean;
}

const Logo: React.FC<LogoProps> = ({ 
  className, 
  size = 'md', 
  responsive = false, 
  linkTo = "/",
  noLink = false
}) => {
  const sizeClasses = {
    sm: responsive ? "h-6 md:h-8" : "h-6", // Made sm size slightly smaller
    md: responsive ? "h-8 md:h-10" : "h-10",
    lg: responsive ? "h-10 md:h-12" : "h-12"
  };

  const LogoContent = () => (
    <img 
      src="/lovable-uploads/87c43c69-609c-4783-9425-7a25bb42926e.png" 
      alt="Common Groundz Logo" 
      className={`${sizeClasses[size]} ${className || ''} object-contain cursor-pointer`} 
    />
  );

  if (noLink) {
    return <LogoContent />;
  }

  return (
    <Link to={linkTo} className="inline-flex items-center">
      <LogoContent />
    </Link>
  );
};

export default Logo;
