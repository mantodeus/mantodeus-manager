import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { ChevronDown, ChevronUp } from "lucide-react";

type ActiveArchiveRubbishSectionsProps = {
  expanded: boolean;
  onExpandedChange: (expanded: boolean) => void;
  active: ReactNode;
  archived?: ReactNode;
  rubbish?: ReactNode;
  activeLabel?: string;
  archivedLabel?: string;
  rubbishLabel?: string;
  className?: string;
};

export function ActiveArchiveRubbishSections({
  expanded,
  onExpandedChange,
  active,
  archived,
  rubbish,
  activeLabel = "Active",
  archivedLabel = "Archived",
  rubbishLabel = "Rubbish",
  className,
}: ActiveArchiveRubbishSectionsProps) {
  return (
    <div className={className ?? "space-y-6"}>
      <div className="flex items-center justify-between gap-4">
        <h2 className="text-lg font-semibold">{activeLabel}</h2>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="gap-1 px-2 text-muted-foreground hover:text-foreground"
          aria-expanded={expanded}
          onClick={() => onExpandedChange(!expanded)}
        >
          {expanded ? (
            <>
              Hide archived <ChevronUp className="h-4 w-4" />
            </>
          ) : (
            <>
              View archived <ChevronDown className="h-4 w-4" />
            </>
          )}
        </Button>
      </div>

      {active}

      {expanded && (
        <div className="space-y-8">
          {archived != null && (
            <section className="space-y-3">
              <h3 className="text-sm font-medium text-muted-foreground">{archivedLabel}</h3>
              {archived}
            </section>
          )}
          {rubbish != null && (
            <section className="space-y-3">
              <h3 className="text-sm font-medium text-muted-foreground">{rubbishLabel}</h3>
              {rubbish}
            </section>
          )}
        </div>
      )}
    </div>
  );
}

