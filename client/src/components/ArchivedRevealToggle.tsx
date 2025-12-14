import { Button } from "@/components/ui/button";
import { ChevronDown, ChevronUp } from "lucide-react";

interface ArchivedRevealToggleProps {
  expanded: boolean;
  onToggle: () => void;
  className?: string;
}

export function ArchivedRevealToggle({ expanded, onToggle, className }: ArchivedRevealToggleProps) {
  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      onClick={onToggle}
      className={className}
    >
      {expanded ? "Hide archived" : "View archived"}
      {expanded ? (
        <ChevronUp className="ml-2 h-4 w-4" />
      ) : (
        <ChevronDown className="ml-2 h-4 w-4" />
      )}
    </Button>
  );
}

