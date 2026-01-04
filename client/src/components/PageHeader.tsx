import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Search, Settings, SlidersHorizontal } from "@/components/ui/Icon";

type PageHeaderProps = {
  title?: React.ReactNode;
  subtitle?: string | null;
  leading?: React.ReactNode;
  primaryAction?: React.ReactNode;
  actions?: React.ReactNode; // Actions aligned with subtitle
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
  actions,
  searchSlot,
  filterSlot,
  settingsSlot,
  titleClassName,
}: PageHeaderProps) {
  const resolvedTitleClassName = titleClassName || "text-3xl font-regular";

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-4 min-w-0 flex-1">
          {leading}
          {(title || subtitle || actions) && (
            <div className="flex-1 min-w-0">
              {title && <h1 className={resolvedTitleClassName}>{title}</h1>}
              {(subtitle || actions) && (
                <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-2">
                  {subtitle && (
                    <p className="text-muted-foreground text-sm break-normal flex-1">
                      {subtitle}
                    </p>
                  )}
                  {actions && (
                    <div className="flex items-center gap-2 shrink-0">
                      {actions}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
          {primaryAction && <div className="ml-auto shrink-0">{primaryAction}</div>}
        </div>
        <div className="flex items-center gap-3 page-header-actions [&_svg]:size-6 shrink-0">
          {searchSlot ?? (
            <Button variant="ghost" size="icon" aria-label="Search">
              <Search className="size-6" />
            </Button>
          )}
          {filterSlot ?? (
            <Button variant="ghost" size="icon" aria-label="Filter">
              <SlidersHorizontal className="size-6" />
            </Button>
          )}
          {settingsSlot ?? (
            <Button
              variant="ghost"
              size="icon"
              aria-label="Page settings"
              onClick={() => toast.info("No settings available for this page yet.")}
            >
              <Settings className="size-6" />
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
