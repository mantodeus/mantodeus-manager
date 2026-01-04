import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Search, Settings, SlidersHorizontal } from "@/components/ui/Icon";

type PageHeaderProps = {
  title?: React.ReactNode;
  subtitle?: string | null;
  leading?: React.ReactNode;
  primaryAction?: React.ReactNode;
  actions?: React.ReactNode; // Actions aligned with subtitle
  actionsPlacement?: "inline" | "right";
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
  actionsPlacement = "inline",
  searchSlot,
  filterSlot,
  settingsSlot,
  titleClassName,
}: PageHeaderProps) {
  const resolvedTitleClassName = titleClassName || "text-3xl font-regular";
  const showInlineActions = Boolean(actions) && actionsPlacement !== "right";
  const showRightActions = Boolean(actions) && actionsPlacement === "right";

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-4 min-w-0 flex-1 self-stretch">
          {leading}
          {(title || subtitle || showInlineActions) && (
            <div className="flex-1 min-w-0 flex flex-col h-full">
              {title && <h1 className={resolvedTitleClassName}>{title}</h1>}
              {(subtitle || showInlineActions) && (
                <div className="flex flex-wrap items-center gap-x-4 gap-y-2 mt-3">
                  {subtitle && (
                    <p className="text-muted-foreground text-sm break-normal flex-1">
                      {subtitle}
                    </p>
                  )}
                  {showInlineActions && (
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
        <div className="flex flex-col items-end gap-3 shrink-0 self-stretch">
          <div className="flex items-center gap-3 page-header-actions [&_svg]:size-6">
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
          {showRightActions && (
            <div className="flex flex-wrap items-center justify-end gap-2">
              {actions}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
