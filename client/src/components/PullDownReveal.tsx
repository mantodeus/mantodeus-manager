/**
 * PullDownReveal Component
 *
 * A Telegram-style pull-down reveal header for accessing archived and rubbish views.
 * 
 * Behaviour:
 * - When list scroll position is at top, user can pull down to reveal header
 * - Header contains "View archived" and "View rubbish bin" links
 * - Desktop: Shows a subtle chevron affordance that can be clicked
 * - Collapses when user scrolls normally or navigates away
 */

import { useState, useRef, useEffect, useCallback } from "react";
import { Link } from "wouter";
import { ChevronDown, Archive, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface PullDownRevealProps {
  /** Base path for navigation (e.g., "/projects") */
  basePath: string;
  /** Optional additional className for the container */
  className?: string;
  /** Whether there are archived items */
  hasArchived?: boolean;
  /** Whether there are rubbish items */
  hasRubbish?: boolean;
}

export function PullDownReveal({
  basePath,
  className = "",
  hasArchived = true,
  hasRubbish = true,
}: PullDownRevealProps) {
  const [isRevealed, setIsRevealed] = useState(false);
  const [pullProgress, setPullProgress] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const touchStartY = useRef<number>(0);
  const isPulling = useRef(false);

  // Threshold for pull-to-reveal (in pixels)
  const PULL_THRESHOLD = 60;
  const MAX_PULL = 100;

  const handleTouchStart = useCallback((e: TouchEvent) => {
    // Only start pull if we're at the top of the scroll container
    const scrollTop = window.scrollY || document.documentElement.scrollTop;
    if (scrollTop <= 0) {
      touchStartY.current = e.touches[0].clientY;
      isPulling.current = true;
    }
  }, []);

  const handleTouchMove = useCallback((e: TouchEvent) => {
    if (!isPulling.current) return;
    
    const scrollTop = window.scrollY || document.documentElement.scrollTop;
    if (scrollTop > 0) {
      isPulling.current = false;
      setPullProgress(0);
      return;
    }

    const currentY = e.touches[0].clientY;
    const deltaY = currentY - touchStartY.current;
    
    if (deltaY > 0) {
      // Pulling down
      const progress = Math.min(deltaY / MAX_PULL, 1);
      setPullProgress(progress);
      
      if (deltaY > PULL_THRESHOLD && !isRevealed) {
        setIsRevealed(true);
      }
    }
  }, [isRevealed]);

  const handleTouchEnd = useCallback(() => {
    isPulling.current = false;
    setPullProgress(0);
  }, []);

  // Handle scroll to collapse
  const handleScroll = useCallback(() => {
    const scrollTop = window.scrollY || document.documentElement.scrollTop;
    if (scrollTop > 50 && isRevealed) {
      setIsRevealed(false);
    }
  }, [isRevealed]);

  useEffect(() => {
    window.addEventListener("touchstart", handleTouchStart, { passive: true });
    window.addEventListener("touchmove", handleTouchMove, { passive: true });
    window.addEventListener("touchend", handleTouchEnd, { passive: true });
    window.addEventListener("scroll", handleScroll, { passive: true });

    return () => {
      window.removeEventListener("touchstart", handleTouchStart);
      window.removeEventListener("touchmove", handleTouchMove);
      window.removeEventListener("touchend", handleTouchEnd);
      window.removeEventListener("scroll", handleScroll);
    };
  }, [handleTouchStart, handleTouchMove, handleTouchEnd, handleScroll]);

  const toggleReveal = () => {
    setIsRevealed(!isRevealed);
  };

  return (
    <div ref={containerRef} className={cn("relative", className)}>
      {/* Pull indicator for mobile */}
      <div
        className={cn(
          "flex justify-center items-center transition-all duration-200",
          pullProgress > 0 ? "opacity-100" : "opacity-0"
        )}
        style={{
          height: pullProgress > 0 ? `${pullProgress * 40}px` : 0,
        }}
      >
        <ChevronDown
          className={cn(
            "h-5 w-5 text-muted-foreground transition-transform",
            pullProgress > 0.6 ? "rotate-180" : ""
          )}
        />
      </div>

      {/* Desktop affordance - subtle chevron */}
      <button
        onClick={toggleReveal}
        className="w-full flex justify-center items-center py-2 group cursor-pointer hover:bg-accent/50 rounded-lg transition-colors"
        aria-label={isRevealed ? "Hide archive options" : "Show archive options"}
      >
        <div className="flex items-center gap-2 text-muted-foreground group-hover:text-foreground transition-colors">
          <span className="text-sm">
            {isRevealed ? "Hide" : "View archived & rubbish"}
          </span>
          <ChevronDown
            className={cn(
              "h-4 w-4 transition-transform duration-200",
              isRevealed ? "rotate-180" : ""
            )}
          />
        </div>
      </button>

      {/* Revealed header content */}
      <div
        className={cn(
          "overflow-hidden transition-all duration-300 ease-out",
          isRevealed ? "max-h-32 opacity-100" : "max-h-0 opacity-0"
        )}
      >
        <div className="flex flex-col sm:flex-row gap-3 p-4 bg-accent/30 rounded-lg mt-2">
          <Link href={`${basePath}/archived`}>
            <button className="flex items-center gap-3 px-4 py-3 w-full sm:w-auto rounded-lg bg-background hover:bg-accent border border-border transition-colors">
              <Archive className="h-5 w-5 text-muted-foreground" />
              <div className="text-left">
                <div className="font-medium">View archived</div>
                <div className="text-xs text-muted-foreground">
                  Items you've archived
                </div>
              </div>
            </button>
          </Link>
          <Link href={`${basePath}/rubbish`}>
            <button className="flex items-center gap-3 px-4 py-3 w-full sm:w-auto rounded-lg bg-background hover:bg-accent border border-border transition-colors">
              <Trash2 className="h-5 w-5 text-muted-foreground" />
              <div className="text-left">
                <div className="font-medium">View rubbish bin</div>
                <div className="text-xs text-muted-foreground">
                  Deleted items you can restore
                </div>
              </div>
            </button>
          </Link>
        </div>
      </div>
    </div>
  );
}
