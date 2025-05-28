import React, { useState, useEffect } from 'react';
import { cn } from "@/lib/utils";
import { useThemedClass } from '@/utils/theme-utils';
import { 
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Star, Sparkles } from "lucide-react";

interface ConnectedRingsRatingProps {
  value: number;
  onChange?: (value: number) => void;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'badge';
  variant?: 'default' | 'badge';
  showValue?: boolean;
  className?: string;
  isInteractive?: boolean;
  showLabel?: boolean;
  minimal?: boolean;
}

const ConnectedRingsRating = ({ 
  value, 
  onChange,
  size = 'md',
  variant = 'default',
  showValue = true,
  className,
  isInteractive = false,
  showLabel = false,
  minimal = false
}: ConnectedRingsRatingProps) => {
  const [hoverRating, setHoverRating] = useState(0);
  const [animateRing, setAnimateRing] = useState<number | null>(null);
  const [textAnimating, setTextAnimating] = useState(false);
  const [showCelebration, setShowCelebration] = useState(false);
  
  // Track previous value for text animations
  const [prevValue, setPrevValue] = useState(value);
  
  // Trigger text animation when value changes
  useEffect(() => {
    if (!minimal && value !== prevValue) {
      setTextAnimating(true);
      const timer = setTimeout(() => {
        setTextAnimating(false);
      }, 400);
      setPrevValue(value);
      return () => clearTimeout(timer);
    }
  }, [value, prevValue, minimal]);

  // Handle celebration animation
  useEffect(() => {
    // Skip celebrations in minimal mode
    if (minimal) return;
    
    // Clear any existing celebration timeout
    let celebrationTimer: NodeJS.Timeout | null = null;

    if (value === 5 && prevValue !== 5) {
      // Start celebration when rating becomes 5
      setShowCelebration(true);
      
      // Auto-dismiss celebration after 3 seconds
      celebrationTimer = setTimeout(() => {
        setShowCelebration(false);
      }, 3000);
    } else if (value !== 5 && showCelebration) {
      // Immediately clear celebration if rating changes from 5 to something else
      setShowCelebration(false);
    }
    
    // Cleanup function to clear timeout when component unmounts or dependencies change
    return () => {
      if (celebrationTimer) {
        clearTimeout(celebrationTimer);
      }
    };
  }, [value, prevValue, showCelebration, minimal]);
  
  const sizeConfig = {
    xs: {
      svgWidth: 120,
      svgHeight: 120,
      ringSize: 12,
      strokeWidth: 2.5,
      textClass: 'text-[10px]',
      textOffset: 20,
      overlapOffset: 8
    },
    sm: {
      svgWidth: 150,
      svgHeight: 150,
      ringSize: 20,
      strokeWidth: 4,
      textClass: 'text-xs',
      textOffset: 30,
      overlapOffset: 15
    },
    md: {
      svgWidth: 200,
      svgHeight: 200,
      ringSize: 28,
      strokeWidth: 4.5,
      textClass: 'text-sm',
      textOffset: 40,
      overlapOffset: 20
    },
    lg: {
      svgWidth: 250,
      svgHeight: 250,
      ringSize: 36,
      strokeWidth: 5,
      textClass: 'text-base',
      textOffset: 50,
      overlapOffset: 25
    },
    badge: {
      svgWidth: 72,
      svgHeight: 20,
      ringSize: 9,
      strokeWidth: 2,
      textClass: 'text-sm',
      textOffset: 12,
      overlapOffset: 6
    }
  };
  
  // Use the badge size config for badge variant regardless of specified size
  const config = variant === 'badge' ? sizeConfig.badge : sizeConfig[size];
  
  const { ringSize, strokeWidth, textClass, overlapOffset } = config;
  const svgWidth = config.svgWidth;
  const svgHeight = config.svgHeight;
  
  const effectiveRating = hoverRating || value;
  
  // Calculate ring positions based on the variant
  const calculateRingPositions = () => {
    const rings = [];
    
    if (variant === 'badge') {
      // For badge variant: horizontal layout with tighter spacing
      const verticalCenter = svgHeight / 2;
      
      // For badge, we want the rings to start from the left with some padding
      let horizontalPosition = ringSize;
      
      // Create 5 rings in a row with overlap, starting from the left
      for (let i = 0; i < 5; i++) {
        rings.push({
          cx: horizontalPosition,
          cy: verticalCenter,
          value: i + 1 // Rating value 1-5
        });
        // Move horizontally with overlap
        horizontalPosition += (ringSize * 2) - overlapOffset;
      }
    } else {
      // Default: centered layout
      const verticalCenter = svgHeight / 2;
      
      // Calculate the total width of all 5 rings with overlap
      const totalRingsWidth = ((ringSize * 2) * 5) - (overlapOffset * 4);
      
      // Calculate the starting position to center the rings within the SVG
      const startX = (svgWidth - totalRingsWidth) / 2 + ringSize;
      
      let horizontalPosition = startX;
      
      // Create 5 rings in a row with overlap, centered in the SVG
      for (let i = 0; i < 5; i++) {
        rings.push({
          cx: horizontalPosition,
          cy: verticalCenter,
          value: i + 1 // Rating value 1-5
        });
        // Move horizontally with overlap
        horizontalPosition += (ringSize * 2) - overlapOffset;
      }
    }
    
    return rings;
  };
  
  const ringPositions = calculateRingPositions();

  // Get sentiment color based on rating
  const getSentimentColor = (rating: number) => {
    if (rating < 2) return "#ea384c"; // Red for 1.0-1.9
    if (rating < 3) return "#F97316"; // Orange for 2.0-2.9
    if (rating < 4) return "#FEC006"; // Yellow for 3.0-3.9
    if (rating < 4.5) return "#84cc16"; // Light green for 4.0-4.4
    return "#22c55e"; // Green for 4.5-5.0
  };
  
  // Get sentiment gradient ID based on rating
  const getSentimentGradientId = (rating: number) => {
    if (rating < 2) return "sentimentGradientRed";
    if (rating < 3) return "sentimentGradientOrange";
    if (rating < 4) return "sentimentGradientYellow";
    if (rating < 4.5) return "sentimentGradientLightGreen";
    return "sentimentGradientGreen";
  };

  // Get emoji and text based on rating
  const getRatingText = (rating: number) => {
    if (rating === 0) return "Tap to rate";
    if (rating < 2) return "Didn't like it 😕";
    if (rating < 3) return "Below average 😐";
    if (rating < 4) return "It was okay 🙂";
    if (rating < 4.5) return "Liked it 😄";
    return "Loved it! 🤩";
  };
  
  // Get emoji only based on rating
  const getRatingEmoji = (rating: number) => {
    if (rating < 2) return "😕";
    if (rating < 3) return "😐";
    if (rating < 4) return "🙂";
    if (rating < 4.5) return "😄";
    return "🤩";
  };
  
  // Handle ring click with animation
  const handleRingClick = (ringValue: number) => {
    if (isInteractive && onChange) {
      if (!minimal) {
        setAnimateRing(ringValue);
        
        // Reset animation state after animation completes
        setTimeout(() => {
          setAnimateRing(null);
        }, 500);
      }
      onChange(ringValue);
    }
  };

  // Calculate the stroke dasharray and dashoffset for animated rings
  const calculateStrokeDashArray = (radius: number) => {
    const circumference = 2 * Math.PI * radius;
    return circumference;
  };

  const sentimentColor = getSentimentColor(effectiveRating);
  
  // Define colors for inactive rings based on whether a selection has been made
  const defaultInactiveColor = "#999"; // Medium gray for initial state
  const selectedInactiveColor = "#ddd"; // Lighter gray after selection
  
  // Use the appropriate inactive color based on whether a value has been selected
  const inactiveRingColor = value > 0 ? selectedInactiveColor : defaultInactiveColor;

  // Conditionally render different layouts based on variant and minimal props
  const renderRating = () => {
    // Base component with animations and tooltips conditionally applied
    return (
      // Only wrap with TooltipProvider if not minimal
      <>
        {/* Define keyframe animations for ring interactions */}
        {!minimal && (
          <style>
            {`
            @keyframes ringSelectPulse {
              0% { transform: scale(1); opacity: 0.5; }
              50% { transform: scale(1.2); opacity: 0.8; }
              100% { transform: scale(1); opacity: 0; }
            }
            
            @keyframes ringSelectWave {
              0% { transform: scale(0.8); opacity: 0.8; }
              100% { transform: scale(2); opacity: 0; }
            }
            
            @keyframes springyHover {
              0% { transform: scale(1); }
              50% { transform: scale(1.25); }
              75% { transform: scale(0.95); }
              100% { transform: scale(1.15); }
            }
            
            @keyframes ringHoverGlow {
              0% { opacity: 0; filter: blur(1px); }
              100% { opacity: 0.4; filter: blur(3px); }
            }
            
            @keyframes ratingTextChange {
              0% { transform: translateY(0); opacity: 1; }
              20% { transform: translateY(-10px); opacity: 0; }
              40% { transform: translateY(10px); opacity: 0; }
              60% { transform: translateY(0); opacity: 1; }
            }
            
            @keyframes elasticFill {
              0% { stroke-dashoffset: 0; }
              50% { stroke-dashoffset: -10; }
              100% { stroke-dashoffset: 0; }
            }
            
            @keyframes fillProgress {
              0% { stroke-dashoffset: 283; }
              100% { stroke-dashoffset: 0; }
            }
            
            @keyframes popScale {
              0% { transform: scale(1); }
              50% { transform: scale(1.08); }
              85% { transform: scale(0.98); }
              100% { transform: scale(1); }
            }
            
            /* Celebration animations */
            @keyframes celebrationPulse {
              0%, 100% { transform: scale(1); opacity: 1; }
              50% { transform: scale(1.1); opacity: 0.8; }
            }
            
            @keyframes confettiBurst {
              0% { transform: scale(0); opacity: 1; }
              100% { transform: scale(2); opacity: 0; }
            }
            
            @keyframes starFloat {
              0%, 100% { transform: translateY(0); opacity: 0.8; }
              50% { transform: translateY(-15px); opacity: 1; }
            }
            
            @keyframes colorFlash {
              0% { opacity: 0; }
              25% { opacity: 0.6; }
              50% { opacity: 0.3; }
              100% { opacity: 0; }
            }
            
            @keyframes emojiPop {
              0% { transform: translate(-50%, -50%) scale(0); opacity: 0; }
              60% { transform: translate(-50%, -50%) scale(1.2); opacity: 1; }
              80% { transform: translate(-50%, -50%) scale(0.9); opacity: 1; }
              100% { transform: translate(-50%, -50%) scale(1); opacity: 1; }
            }
            
            @keyframes emojiFloat {
              0% { transform: translate(-50%, -50%) scale(1); opacity: 1; }
              70% { transform: translate(-50%, -80px) scale(1.1); opacity: 1; }
              100% { transform: translate(-50%, -120px) scale(0.8); opacity: 0; }
            }
            
            @keyframes celebrationRingRipple {
              0% { transform: scale(1); opacity: 0.8; stroke-width: 3px; }
              100% { transform: scale(1.5); opacity: 0; stroke-width: 0.5px; }
            }
            
            @keyframes fadeOut {
              0% { opacity: 1; }
              100% { opacity: 0; }
            }
            `}
          </style>
        )}

        {/* Main container with proper flex layout for horizontal alignment */}
        <div className={cn(
          "w-full flex",
          variant === 'badge' ? "items-center gap-2" : "flex-col items-center"
        )}>
          {/* SVG Container */}
          <div
            className={cn(
              "relative flex",
              variant === 'badge' ? "items-center w-fit" : "justify-center",
              isInteractive && !minimal && "cursor-pointer"
            )}
            onMouseLeave={() => isInteractive && !minimal && setHoverRating(0)}
          >
            <svg
              width={svgWidth}
              height={svgHeight}
              viewBox={`0 0 ${svgWidth} ${svgHeight}`}
              className="transform"
              style={{ overflow: 'visible' }}
            >
              {/* Gradient definitions for sentiment colors */}
              <defs>
                <linearGradient id="sentimentGradientRed" x1="0%" y1="0%" x2="100%" y2="0%">
                  <stop offset="0%" stopColor="#ea384c" />
                  <stop offset="100%" stopColor="#f87171" />
                </linearGradient>
                <linearGradient id="sentimentGradientOrange" x1="0%" y1="0%" x2="100%" y2="0%">
                  <stop offset="0%" stopColor="#F97316" />
                  <stop offset="100%" stopColor="#FB923C" />
                </linearGradient>
                <linearGradient id="sentimentGradientYellow" x1="0%" y1="0%" x2="100%" y2="0%">
                  <stop offset="0%" stopColor="#FEC006" />
                  <stop offset="100%" stopColor="#FEF08A" />
                </linearGradient>
                <linearGradient id="sentimentGradientLightGreen" x1="0%" y1="0%" x2="100%" y2="0%">
                  <stop offset="0%" stopColor="#84cc16" />
                  <stop offset="100%" stopColor="#bef264" />
                </linearGradient>
                <linearGradient id="sentimentGradientGreen" x1="0%" y1="0%" x2="100%" y2="0%">
                  <stop offset="0%" stopColor="#22c55e" />
                  <stop offset="100%" stopColor="#86efac" />
                </linearGradient>
                <radialGradient id="selectionGlowGradient" cx="50%" cy="50%" r="50%" fx="50%" fy="50%">
                  <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity="0.7" />
                  <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity="0" />
                </radialGradient>
                
                {/* Celebration gradients */}
                <radialGradient id="celebrationGlowGradient" cx="50%" cy="50%" r="50%" fx="50%" fy="50%">
                  <stop offset="0%" stopColor="#F97316" stopOpacity="0.8" />
                  <stop offset="70%" stopColor="#F97316" stopOpacity="0.3" />
                  <stop offset="100%" stopColor="#F97316" stopOpacity="0" />
                </radialGradient>
                <linearGradient id="confettiGradient1" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#F97316" />
                  <stop offset="100%" stopColor="#9b87f5" />
                </linearGradient>
                <linearGradient id="confettiGradient2" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#D946EF" />
                  <stop offset="100%" stopColor="#22c55e" />
                </linearGradient>
                <linearGradient id="confettiGradient3" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#0EA5E9" />
                  <stop offset="100%" stopColor="#FEC006" />
                </linearGradient>
              </defs>
              
              {/* Background celebration effect - shown only when perfect rating is selected */}
              {!minimal && showCelebration && (
                <>
                  {/* Background glow effect */}
                  <circle
                    cx={svgWidth/2}
                    cy={svgHeight/2}
                    r={ringSize * 3.5}
                    fill="url(#celebrationGlowGradient)"
                    style={{
                      animation: 'celebrationPulse 1.5s ease-in-out infinite',
                      transformOrigin: 'center',
                      opacity: 0.7, // Reduced from original value to be less distracting
                    }}
                  />
                  
                  {/* Confetti bursts */}
                  {Array.from({length: 15}).map((_, i) => {
                    const angle = i * (360 / 15);
                    const distance = ringSize * 2.5;
                    const x = svgWidth/2 + distance * Math.cos(angle * Math.PI / 180);
                    const y = svgHeight/2 + distance * Math.sin(angle * Math.PI / 180);
                    const size = Math.random() * 6 + 2;
                    const delay = Math.random() * 0.8;
                    const duration = Math.random() * 0.5 + 1.2;
                    const gradientIndex = Math.floor(Math.random() * 3) + 1;
                    
                    return (
                      <circle
                        key={`confetti-${i}`}
                        cx={x}
                        cy={y}
                        r={size}
                        fill={`url(#confettiGradient${gradientIndex})`}
                        style={{
                          animation: `confettiBurst ${duration}s ease-out ${delay}s infinite`,
                          transformOrigin: 'center',
                          opacity: 0,
                        }}
                      />
                    );
                  })}
                  
                  {/* Animated stars */}
                  {Array.from({length: 5}).map((_, i) => {
                    const angle = i * (360 / 5) + 45;
                    const distance = ringSize * 3;
                    const x = svgWidth/2 + distance * Math.cos(angle * Math.PI / 180);
                    const y = svgHeight/2 + distance * Math.sin(angle * Math.PI / 180);
                    const delay = i * 0.2;
                    const scale = 0.7 + Math.random() * 0.3;
                    
                    return (
                      <g 
                        key={`star-${i}`}
                        transform={`translate(${x} ${y}) scale(${scale})`}
                        style={{
                          animation: `starFloat 2s ease-in-out ${delay}s infinite`,
                          transformOrigin: 'center',
                        }}
                      >
                        <Star className="text-yellow-300" size={14} fill="#FEC006" stroke="#FEC006" />
                      </g>
                    );
                  })}
                  
                  {/* Colorful rings that ripple outward */}
                  {Array.from({length: 3}).map((_, i) => {
                    const delay = i * 0.5;
                    const color = i === 0 ? "#F97316" : i === 1 ? "#0EA5E9" : "#D946EF";
                    
                    return (
                      <circle
                        key={`ripple-${i}`}
                        cx={svgWidth/2}
                        cy={svgHeight/2}
                        r={ringSize * 2}
                        fill="none"
                        stroke={color}
                        strokeWidth={3}
                        style={{
                          animation: `celebrationRingRipple 2s ease-out ${delay}s infinite`,
                          transformOrigin: 'center',
                        }}
                      />
                    );
                  })}
                  
                  {/* Emoji celebration in the center */}
                  <foreignObject
                    x={svgWidth/2 - 30}
                    y={svgHeight/2 - 30}
                    width={60}
                    height={60}
                    style={{
                      animation: 'emojiPop 0.5s ease-out forwards, emojiFloat 2s ease-in-out 1s forwards',
                      opacity: 0,
                    }}
                  >
                    <div className="flex items-center justify-center w-full h-full text-2xl">
                      🎉
                    </div>
                  </foreignObject>
                </>
              )}
              
              {/* Interlinking donut rings */}
              {ringPositions.map((ring, i) => {
                const isActive = effectiveRating >= ring.value;
                const isHovered = hoverRating === ring.value;
                const ringRadius = ringSize - strokeWidth / 2;
                const circumference = calculateStrokeDashArray(ringRadius);
                const activePercentage = isActive ? 100 : 0;
                const dashOffset = circumference - (circumference * activePercentage) / 100;
                const isAnimating = animateRing === ring.value;
                
                // Never dim rings when rating is 5 - they should remain crisp and clear
                const unselectedRingOpacity = (value === 5) ? 1 : 
                                              (value > 0 && ring.value > value && !isHovered) ? 0.5 : 1;
                
                // Add a subtle tint to unselected rings on hover when they're not selected yet
                const showHoverTint = !minimal && isInteractive && isHovered && !isActive;
                
                // Add synchronized animation for all rings when perfect rating is selected
                const isPerfectRating = !minimal && showCelebration && value === 5;
                const celebrationAnimation = isPerfectRating ? 'celebrationPulse 1.8s ease-in-out infinite' : 'none';
                const celebrationDelay = `${i * 0.1}s`;
                
                // Generate the ring component, different for minimal vs. interactive
                const ringComponent = (
                  <g 
                    key={`ring-${i}`}
                    className="transform-gpu"
                    style={{ 
                      transformOrigin: `${ring.cx}px ${ring.cy}px`,
                      willChange: !minimal && isInteractive ? 'transform, opacity' : 'auto',
                      animation: isPerfectRating ? celebrationAnimation : 
                              (!minimal && isInteractive && isHovered) ? 'springyHover 0.5s cubic-bezier(0.34, 1.56, 0.64, 1) forwards' : 
                              (!minimal && isAnimating && isActive) ? 'popScale 0.4s cubic-bezier(0.34, 1.56, 0.64, 1)' : 'none',
                      opacity: unselectedRingOpacity, // Apply the dimming effect
                      transition: "opacity 0.3s ease-out", // Smooth transition for opacity changes
                      animationDelay: celebrationDelay,
                    }}
                    onMouseEnter={() => isInteractive && !minimal && setHoverRating(ring.value)}
                    onClick={() => handleRingClick(ring.value)}
                  >
                    {/* Ring outline (always visible) */}
                    <circle
                      cx={ring.cx}
                      cy={ring.cy}
                      r={ringRadius}
                      stroke={isActive || isHovered ? sentimentColor : inactiveRingColor}
                      strokeWidth={strokeWidth}
                      fill="transparent"
                      style={{
                        transition: "stroke 0.2s ease-out",
                      }}
                    />
                    
                    {/* Hover tint overlay for unselected rings */}
                    {showHoverTint && (
                      <circle
                        cx={ring.cx}
                        cy={ring.cy}
                        r={ringRadius - strokeWidth/4}
                        fill="hsl(var(--brand-orange)/20)"
                        style={{
                          transition: "opacity 0.2s ease",
                          opacity: 0.8,
                        }}
                      />
                    )}
                    
                    {/* Animated fill stroke */}
                    <circle
                      cx={ring.cx}
                      cy={ring.cy}
                      r={ringRadius}
                      stroke={minimal && variant === 'badge' 
                        ? getSentimentColor(isHovered ? ring.value : effectiveRating) 
                        : `url(#${getSentimentGradientId(isHovered ? ring.value : effectiveRating)})`}
                      strokeWidth={strokeWidth}
                      fill="transparent"
                      strokeDasharray={circumference}
                      strokeDashoffset={isActive || isHovered ? 0 : circumference}
                      strokeLinecap="round"
                      style={{ 
                        transform: 'rotate(-90deg)', 
                        transformOrigin: `${ring.cx}px ${ring.cy}px`,
                        opacity: isActive || isHovered ? 1 : 0,
                        transition: 'stroke-dashoffset 0.3s cubic-bezier(0.34, 1.56, 0.64, 1), opacity 0.2s ease-out',
                        animation: !minimal && isActive && isAnimating ? 'elasticFill 0.5s ease-out' : 'none',
                        willChange: 'opacity, stroke-dashoffset',
                      }}
                    />
                    
                    {/* Hover glow effect - appears during hover */}
                    {!minimal && isInteractive && (
                      <circle
                        cx={ring.cx}
                        cy={ring.cy}
                        r={ringRadius + strokeWidth/2}
                        stroke={getSentimentColor(ring.value)}
                        strokeWidth={strokeWidth * 1.5}
                        fill="transparent"
                        style={{
                          opacity: isHovered ? 0.3 : 0,
                          transition: isHovered ? "none" : "opacity 0.3s ease-out", 
                          filter: "blur(3px)",
                          animation: isHovered ? "ringHoverGlow 0.3s forwards" : "none",
                          willChange: 'opacity',
                        }}
                      />
                    )}

                    {/* Selection animation - ripple effect */}
                    {!minimal && isAnimating && isActive && (
                      <>
                        {/* Glow pulse behind selected ring */}
                        <circle
                          cx={ring.cx}
                          cy={ring.cy}
                          r={ringRadius * 1.5}
                          fill="url(#selectionGlowGradient)"
                          style={{
                            animation: 'ringSelectPulse 0.5s ease-out forwards',
                            transformOrigin: `${ring.cx}px ${ring.cy}px`,
                            willChange: 'transform, opacity',
                            opacity: 0.6,
                          }}
                        />
                        
                        {/* Inner pulse */}
                        <circle
                          cx={ring.cx}
                          cy={ring.cy}
                          r={ringRadius}
                          stroke={sentimentColor}
                          strokeWidth={strokeWidth / 2}
                          fill="transparent"
                          style={{
                            animation: 'ringSelectPulse 0.5s ease-out forwards',
                            transformOrigin: `${ring.cx}px ${ring.cy}px`,
                            willChange: 'transform, opacity',
                          }}
                        />
                        
                        {/* Outer wave */}
                        <circle
                          cx={ring.cx}
                          cy={ring.cy}
                          r={ringRadius}
                          stroke={sentimentColor}
                          strokeWidth={strokeWidth / 3}
                          fill="transparent"
                          style={{
                            animation: 'ringSelectWave 0.8s ease-out forwards',
                            transformOrigin: `${ring.cx}px ${ring.cy}px`,
                            willChange: 'transform, opacity',
                          }}
                        />
                      </>
                    )}
                  </g>
                );
                
                // Wrap the ring with Tooltip only if not in minimal mode
                return minimal ? (
                  ringComponent
                ) : (
                  <Tooltip key={`tooltip-${i}`}>
                    <TooltipTrigger asChild>
                      {ringComponent}
                    </TooltipTrigger>
                    <TooltipContent side="top" className="bg-popover/90 backdrop-blur-sm">
                      {getRatingText(ring.value)}
                    </TooltipContent>
                  </Tooltip>
                );
              })}
              
              {/* Sparkle decoration when perfect rating selected */}
              {!minimal && showCelebration && (
                <div 
                  className="absolute -right-6 -top-6 text-yellow-400"
                  style={{
                    animation: 'starFloat 2s ease-in-out infinite',
                  }}
                >
                  <Sparkles size={24} className="fill-yellow-300" />
                </div>
              )}
            </svg>
          </div>
          
          {/* Rating value - positioned next to rings for badge variant, below for others */}
          {showValue && (
            <span 
              className={cn(
                textClass, 
                "font-semibold flex-shrink-0",
                textAnimating && !minimal && "animate-pulse"
              )}
              style={{
                color: sentimentColor,
                animation: textAnimating && !minimal ? 'ratingTextChange 0.4s cubic-bezier(0.34, 1.56, 0.64, 1)' : 'none'
              }}
            >
              {effectiveRating.toFixed(1)}
            </span>
          )}
        </div>
        
        {/* Label - only show for non-badge variant when enabled */}
        {showLabel && variant !== 'badge' && (
          <div className="mt-2 flex flex-col items-center">
            <span 
              className={cn(
                textClass, 
                "text-muted-foreground text-center",
                textAnimating && !minimal && "animate-pulse"
              )}
              style={{
                animation: textAnimating && !minimal ? 'ratingTextChange 0.4s cubic-bezier(0.34, 1.56, 0.64, 1) 0.1s' : 'none'
              }}
            >
              {getRatingText(effectiveRating)}
            </span>
          </div>
        )}
      </>
    );
  };

  // Wrap with TooltipProvider only if not in minimal mode
  return minimal ? (
    <div className={cn("w-full", className)}>
      {renderRating()}
    </div>
  ) : (
    <TooltipProvider>
      <div className={cn("w-full", className)}>
        {renderRating()}
      </div>
    </TooltipProvider>
  );
};

export default ConnectedRingsRating;
