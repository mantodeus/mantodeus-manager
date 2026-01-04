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
            <div className="flex-1 flex flex-col" style={{ minWidth: 0, width: '100%' }}>
              {title && <h1 className={resolvedTitleClassName}>{title}</h1>}
              {(subtitle || actions) && (
                <div 
                  className="flex items-center justify-between gap-4 mt-1" 
                  style={{ 
                    width: '100%', 
                    flexDirection: 'row',
                    display: 'flex',
                    minWidth: '200px'
                  }}
                >
                  {subtitle && (
                    <p 
                      className="text-muted-foreground text-sm" 
                      style={{ 
                        whiteSpace: 'normal', 
                        wordBreak: 'normal', 
                        writingMode: 'horizontal-tb',
                        direction: 'ltr',
                        display: 'block',
                        minWidth: 0,
                        flex: '1 1 auto'
                      }}
                    >
                      {subtitle}
                    </p>
                  )}
                  {actions && (
                    <div 
                      className="flex items-center gap-2" 
                      style={{ 
                        flexShrink: 0,
                        flexGrow: 0
                      }}
                    >
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
