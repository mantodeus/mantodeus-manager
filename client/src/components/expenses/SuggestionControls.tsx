/**
 * SuggestionControls Component
 * 
 * Accept/Dismiss buttons for suggestions
 */

import { Button } from "@/components/ui/button";
import { Check, X } from "lucide-react";
import { cn } from "@/lib/utils";

interface SuggestionControlsProps {
  onAccept: () => void;
  onDismiss: () => void;
  isAccepting?: boolean;
  className?: string;
}

export function SuggestionControls({
  onAccept,
  onDismiss,
  isAccepting = false,
  className,
}: SuggestionControlsProps) {
  return (
    <div className={cn("flex items-center gap-1", className)}>
      <Button
        variant="ghost"
        size="sm"
        onClick={onAccept}
        disabled={isAccepting}
        className="h-7 px-2 text-xs"
        title="Accept suggestion"
      >
        <Check className="h-3 w-3 mr-1" />
        Accept
      </Button>
      <Button
        variant="ghost"
        size="sm"
        onClick={onDismiss}
        disabled={isAccepting}
        className="h-7 px-2 text-xs text-muted-foreground hover:text-foreground"
        title="Dismiss suggestion"
      >
        <X className="h-3 w-3" />
      </Button>
    </div>
  );
}

