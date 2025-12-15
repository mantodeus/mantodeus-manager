/**
 * PullDownReveal Component
 *
 * A Telegram-style pull-down reveal for Archive and Rubbish navigation.
 * 
 * Behaviour:
 * - When at top of page, pulling down reveals Archive/Rubbish options
 * - No visible toggle text - completely hidden until pull gesture
 * - Smooth spring-like animation
 * - Collapses when user scrolls down into content
 * - Works on both touch (mobile) and mouse wheel (desktop)
 */

import { useState, useRef, useEffect, useCallback } from "react";
import { Link } from "wouter";
import { Archive, Trash2, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

interface PullDownRevealProps {
  /** Base path for navigation (e.g., "/projects") */
  basePath: string;
  /** Optional additional className for the container */
  className?: string;
}

export function PullDownReveal({
  basePath,
  className = "",
}: PullDownRevealProps) {
  const [isRevealed, setIsRevealed] = useState(false);
  const [pullDistance, setPullDistance] = useState(0);
  const [isAnimating, setIsAnimating] = useState(false);
  
  const containerRef = useRef<HTMLDivElement>(null);
  const touchStartY = useRef<number>(0);
  const isPulling = useRef(false);
  const lastScrollY = useRef(0);

  // Thresholds
  const REVEAL_THRESHOLD = 80; // Pull distance to reveal
  const MAX_PULL = 150; // Maximum pull distance
  const COLLAPSE_SCROLL_THRESHOLD = 100; // Scroll distance to collapse

  // Handle touch start
  const handleTouchStart = useCallback((e: TouchEvent) => {
    const scrollTop = window.scrollY || document.documentElement.scrollTop;
    if (scrollTop <= 5) {
      touchStartY.current = e.touches[0].clientY;
      isPulling.current = true;
      lastScrollY.current = scrollTop;
    }
  }, []);

  // Handle touch move
  const handleTouchMove = useCallback((e: TouchEvent) => {
    if (!isPulling.current) return;

    const scrollTop = window.scrollY || document.documentElement.scrollTop;
    
    // If we've scrolled down, stop pulling
    if (scrollTop > 5) {
      isPulling.current = false;
      if (!isRevealed) {
        setPullDistance(0);
      }
      return;
    }

    const currentY = e.touches[0].clientY;
    const deltaY = currentY - touchStartY.current;

    if (deltaY > 0) {
      // Prevent native pull-to-refresh while we're handling the gesture
      if (deltaY < MAX_PULL * 1.5) {
        e.preventDefault();
      }
      
      // Apply rubber-band effect for smoother feel
      const resistance = 0.5;
      const adjustedDelta = deltaY * resistance;
      const clampedDistance = Math.min(adjustedDelta, MAX_PULL);
      
      setPullDistance(clampedDistance);

      // Reveal if we've pulled past threshold
      if (clampedDistance >= REVEAL_THRESHOLD && !isRevealed) {
        setIsRevealed(true);
        // Haptic feedback on mobile if available
        if (navigator.vibrate) {
          navigator.vibrate(10);
        }
      }
    }
  }, [isRevealed]);

  // Handle touch end
  const handleTouchEnd = useCallback(() => {
    isPulling.current = false;
    setIsAnimating(true);
    
    // Snap to revealed or collapsed state
    if (pullDistance >= REVEAL_THRESHOLD) {
      setIsRevealed(true);
      setPullDistance(0);
    } else {
      setIsRevealed(false);
      setPullDistance(0);
    }
    
    setTimeout(() => setIsAnimating(false), 300);
  }, [pullDistance]);

  // Handle scroll to collapse when scrolling down
  const handleScroll = useCallback(() => {
    const scrollTop = window.scrollY || document.documentElement.scrollTop;
    
    if (isRevealed && scrollTop > COLLAPSE_SCROLL_THRESHOLD) {
      setIsRevealed(false);
      setPullDistance(0);
    }
  }, [isRevealed]);

  // Handle wheel for desktop - scroll up at top reveals
  const handleWheel = useCallback((e: WheelEvent) => {
    const scrollTop = window.scrollY || document.documentElement.scrollTop;
    
    // Only trigger on scroll up (negative deltaY) when at top
    if (scrollTop <= 5 && e.deltaY < 0 && !isRevealed) {
      // Accumulate wheel delta
      const newPull = Math.min(pullDistance + Math.abs(e.deltaY) * 0.3, MAX_PULL);
      setPullDistance(newPull);
      
      if (newPull >= REVEAL_THRESHOLD) {
        setIsRevealed(true);
        setPullDistance(0);
      }
    }
  }, [isRevealed, pullDistance]);

  // Reset pull distance when wheel stops
  useEffect(() => {
    if (pullDistance > 0 && !isPulling.current) {
      const timer = setTimeout(() => {
        if (!isRevealed) {
          setIsAnimating(true);
          setPullDistance(0);
          setTimeout(() => setIsAnimating(false), 300);
        }
      }, 150);
      return () => clearTimeout(timer);
    }
  }, [pullDistance, isRevealed]);

  // Set up event listeners
  useEffect(() => {
    const options = { passive: false } as AddEventListenerOptions;
    const passiveOptions = { passive: true } as AddEventListenerOptions;

    window.addEventListener("touchstart", handleTouchStart, passiveOptions);
    window.addEventListener("touchmove", handleTouchMove, options);
    window.addEventListener("touchend", handleTouchEnd, passiveOptions);
    window.addEventListener("scroll", handleScroll, passiveOptions);
    window.addEventListener("wheel", handleWheel, passiveOptions);

    return () => {
      window.removeEventListener("touchstart", handleTouchStart);
      window.removeEventListener("touchmove", handleTouchMove);
      window.removeEventListener("touchend", handleTouchEnd);
      window.removeEventListener("scroll", handleScroll);
      window.removeEventListener("wheel", handleWheel);
    };
  }, [handleTouchStart, handleTouchMove, handleTouchEnd, handleScroll, handleWheel]);

  // Calculate dynamic height based on pull distance or revealed state
  const revealHeight = isRevealed ? 140 : pullDistance > 0 ? Math.min(pullDistance * 1.5, 140) : 0;
  const opacity = isRevealed ? 1 : Math.min(pullDistance / REVEAL_THRESHOLD, 1);
  const scale = isRevealed ? 1 : 0.9 + (Math.min(pullDistance / REVEAL_THRESHOLD, 1) * 0.1);

  return (
    <div 
      ref={containerRef} 
      className={cn("relative overflow-hidden", className)}
      style={{
        height: revealHeight,
        transition: isAnimating || isRevealed ? 'height 0.3s cubic-bezier(0.4, 0, 0.2, 1)' : 'none',
      }}
    >
      {/* Pull indicator - shows during pull gesture */}
      {pullDistance > 0 && !isRevealed && (
        <div 
          className="absolute top-0 left-0 right-0 flex justify-center py-2"
          style={{ opacity: Math.min(pullDistance / 40, 1) }}
        >
          <ChevronDown 
            className={cn(
              "h-5 w-5 text-muted-foreground transition-transform duration-200",
              pullDistance >= REVEAL_THRESHOLD ? "rotate-180" : ""
            )}
          />
        </div>
      )}

      {/* Revealed content */}
      <div
        className={cn(
          "flex flex-col items-center justify-center h-full px-4 py-3",
          "transition-all duration-300 ease-out"
        )}
        style={{
          opacity,
          transform: `scale(${scale})`,
        }}
      >
        {/* Archive and Rubbish buttons */}
        <div className="flex flex-col sm:flex-row gap-2 w-full max-w-md">
          <Link href={`${basePath}/archived`} className="flex-1">
            <button
              className={cn(
                "flex items-center justify-center gap-3 px-4 py-3 w-full",
                "rounded-xl bg-card/80 hover:bg-card border border-border/50 hover:border-border",
                "transition-all duration-200 group backdrop-blur-sm"
              )}
            >
              <Archive className="h-5 w-5 text-muted-foreground group-hover:text-foreground transition-colors" />
              <div className="text-left">
                <div className="font-medium text-sm text-muted-foreground group-hover:text-foreground transition-colors">
                  Archived
                </div>
              </div>
            </button>
          </Link>

          <Link href={`${basePath}/rubbish`} className="flex-1">
            <button
              className={cn(
                "flex items-center justify-center gap-3 px-4 py-3 w-full",
                "rounded-xl bg-card/80 hover:bg-card border border-border/50 hover:border-border",
                "transition-all duration-200 group backdrop-blur-sm"
              )}
            >
              <Trash2 className="h-5 w-5 text-muted-foreground group-hover:text-foreground transition-colors" />
              <div className="text-left">
                <div className="font-medium text-sm text-muted-foreground group-hover:text-foreground transition-colors">
                  Rubbish Bin
                </div>
              </div>
            </button>
          </Link>
        </div>
      </div>
    </div>
  );
}
