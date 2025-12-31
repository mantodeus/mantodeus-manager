import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Search, Settings, SlidersHorizontal } from "lucide-react";

type PageHeaderProps = {
  title?: React.ReactNode;
  subtitle?: string | null;
  leading?: React.ReactNode;
  primaryAction?: React.ReactNode;
  searchSlot?: React.ReactNode;
  filterSlot?: React.ReactNode;
  settingsSlot?: React.ReactNode;
  titleClassName?: string;
};

export function PageHeader({
  title,
  subtitle,
  leading,
  primaryAction,
  searchSlot,
  filterSlot,
  settingsSlot,
  titleClassName,
}: PageHeaderProps) {
  const resolvedTitleClassName = titleClassName || "text-3xl font-regular";

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div />
        <div className="flex items-center gap-2">
          {searchSlot ?? (
            <Button variant="ghost" size="icon" aria-label="Search">
              <Search className="h-4 w-4" />
            </Button>
          )}
          {filterSlot ?? (
            <Button variant="ghost" size="icon" aria-label="Filter">
              <SlidersHorizontal className="h-4 w-4" />
            </Button>
          )}
          {settingsSlot ?? (
            <Button
              variant="ghost"
              size="icon"
              aria-label="Page settings"
              onClick={() => toast.info("No settings available for this page yet.")}
            >
              <Settings className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>
      {(title || subtitle || primaryAction || leading) && (
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            {leading}
            <div>
              {title && <h1 className={resolvedTitleClassName}>{title}</h1>}
              {subtitle && (
                <p className="text-muted-foreground text-sm">{subtitle}</p>
              )}
            </div>
          </div>
          {primaryAction}
        </div>
      )}
    </div>
  );
}
