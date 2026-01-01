/**
 * ScrollRevealFooter Component
 *
 * A clean, scroll-triggered footer that reveals Archive and Rubbish navigation
 * only when the user scrolls to the bottom of the content.
 *
 * No visible toggle button, no "View archived & rubbish" text.
 * The sections appear elegantly as part of the natural scroll flow.
 */

import { useRef, useEffect, useState } from "react";
import { Link } from "wouter";
import { Archive, Trash2 } from "@/components/ui/Icon";
import { cn } from "@/lib/utils";

interface ScrollRevealFooterProps {
  /** Base path for navigation (e.g., "/projects") */
  basePath: string;
  /** Optional additional className for the container */
  className?: string;
  /** Custom label for archived section */
  archivedLabel?: string;
  /** Custom label for rubbish section */
  rubbishLabel?: string;
}

export function ScrollRevealFooter({
  basePath,
  className = "",
  archivedLabel = "Archived",
  rubbishLabel = "Rubbish Bin",
}: ScrollRevealFooterProps) {
  const [isVisible, setIsVisible] = useState(false);
  const sentinelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          // Reveal when sentinel comes into view
          if (entry.isIntersecting) {
            setIsVisible(true);
          }
        });
      },
      {
        root: null, // viewport
        rootMargin: "100px", // Start revealing slightly before reaching bottom
        threshold: 0,
      }
    );

    observer.observe(sentinel);

    return () => {
      observer.disconnect();
    };
  }, []);

  return (
    <div ref={sentinelRef} className={cn("relative mt-8", className)}>
      {/* The revealed footer content */}
      <div
        className={cn(
          "transition-all duration-500 ease-out",
          isVisible
            ? "opacity-100 translate-y-0"
            : "opacity-0 translate-y-8 pointer-events-none"
        )}
      >
        {/* Subtle divider */}
        <div className="flex items-center gap-4 mb-6">
          <div className="flex-1 h-px bg-gradient-to-r from-transparent via-border to-transparent" />
        </div>

        {/* Archive and Rubbish buttons */}
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Link href={`${basePath}/archived`}>
            <button
              className={cn(
                "flex items-center justify-center gap-3 px-6 py-4 w-full sm:w-auto",
                "rounded-xl bg-card/50 hover:bg-card border border-border/50 hover:border-border",
                "transition-all duration-200 group"
              )}
            >
              <Archive className="h-5 w-5 text-muted-foreground group-hover:text-foreground transition-colors" />
              <div className="text-left">
                <div className="font-medium text-muted-foreground group-hover:text-foreground transition-colors">
                  {archivedLabel}
                </div>
                <div className="text-xs text-muted-foreground/70">
                  Items you've archived
                </div>
              </div>
            </button>
          </Link>

          <Link href={`${basePath}/rubbish`}>
            <button
              className={cn(
                "flex items-center justify-center gap-3 px-6 py-4 w-full sm:w-auto",
                "rounded-xl bg-card/50 hover:bg-card border border-border/50 hover:border-border",
                "transition-all duration-200 group"
              )}
            >
              <Trash2 className="h-5 w-5 text-muted-foreground group-hover:text-foreground transition-colors" />
              <div className="text-left">
                <div className="font-medium text-muted-foreground group-hover:text-foreground transition-colors">
                  {rubbishLabel}
                </div>
                <div className="text-xs text-muted-foreground/70">
                  Deleted items you can restore
                </div>
              </div>
            </button>
          </Link>
        </div>

        {/* Bottom spacing */}
        <div className="h-8" />
      </div>
    </div>
  );
}
