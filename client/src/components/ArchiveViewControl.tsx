/**
 * ArchiveViewControl Component
 * 
 * A subtle toggle control to reveal/hide archived and rubbish items.
 * Shows "View archived ▾" when collapsed, "Hide archived ▴" when expanded.
 * 
 * This component is designed to reduce UI clutter by:
 * - Showing Active items only by default
 * - Allowing users to opt-in to see Archived and Rubbish sections
 * - Providing a consistent pattern across all entities
 */

import { Button } from "@/components/ui/button";
import { ChevronDown, ChevronUp } from "lucide-react";

interface ArchiveViewControlProps {
  /** Whether the archived/rubbish sections are currently visible */
  isExpanded: boolean;
  /** Callback when the toggle is clicked */
  onToggle: () => void;
  /** Optional additional className */
  className?: string;
}

export function ArchiveViewControl({
  isExpanded,
  onToggle,
  className = "",
}: ArchiveViewControlProps) {
  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={onToggle}
      className={`text-muted-foreground hover:text-foreground text-sm font-normal gap-1 ${className}`}
    >
      {isExpanded ? (
        <>
          Hide archived
          <ChevronUp className="h-4 w-4" />
        </>
      ) : (
        <>
          View archived
          <ChevronDown className="h-4 w-4" />
        </>
      )}
    </Button>
  );
}
