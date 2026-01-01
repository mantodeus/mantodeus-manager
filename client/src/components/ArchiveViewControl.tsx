/**
 * ArchiveViewControl Component
 * 
 * A subtle toggle control to reveal/hide sections like rubbish bin.
 * Used for nested entities (e.g., files within a project) where
 * separate routes aren't practical.
 * 
 * For main entities (Projects, Contacts, Notes), use ScrollRevealFooter instead.
 */

import { Button } from "@/components/ui/button";
import { ChevronDown, ChevronUp } from "@/components/ui/Icon";

interface ArchiveViewControlProps {
  /** Whether the section is currently visible */
  isExpanded: boolean;
  /** Callback when the toggle is clicked */
  onToggle: () => void;
  /** Label when collapsed (default: "View rubbish bin") */
  collapsedLabel?: string;
  /** Label when expanded (default: "Hide rubbish bin") */
  expandedLabel?: string;
  /** Optional additional className */
  className?: string;
}

export function ArchiveViewControl({
  isExpanded,
  onToggle,
  collapsedLabel = "View rubbish bin",
  expandedLabel = "Hide rubbish bin",
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
          {expandedLabel}
          <ChevronUp className="h-4 w-4" />
        </>
      ) : (
        <>
          {collapsedLabel}
          <ChevronDown className="h-4 w-4" />
        </>
      )}
    </Button>
  );
}
