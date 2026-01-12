import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Search, Settings, SlidersHorizontal, ChevronLeft } from "@/components/ui/Icon";
import { cn } from "@/lib/utils";

/**
 * HeaderIconCluster - Internal component for consistent icon actions
 * Renders icons in fixed order: Search → Filter → Settings → extraActions
 */
function HeaderIconCluster({
  onSearch,
  onFilter,
  onSettings,
  searchEnabled = true,
  filterEnabled = true,
  settingsEnabled = true,
  extraActions,
}: {
  onSearch?: () => void;
  onFilter?: () => void;
  onSettings?: () => void;
  searchEnabled?: boolean;
  filterEnabled?: boolean;
  settingsEnabled?: boolean;
  extraActions?: React.ReactNode;
}) {
  return (
    <div 
      className="flex items-center shrink-0"
      style={{ gap: 'var(--space-header-icons, 8px)' }}
    >
      {searchEnabled && (
        <Button
          variant="icon"
          size="icon"
          aria-label="Search"
          onClick={onSearch}
          className="size-9 [&_svg]:size-7"
        >
          <Search />
        </Button>
      )}
      {filterEnabled && (
        <Button
          variant="icon"
          size="icon"
          aria-label="Filter"
          onClick={onFilter}
          className="size-9 [&_svg]:size-7"
        >
          <SlidersHorizontal />
        </Button>
      )}
      {settingsEnabled && (
        <Button
          variant="icon"
          size="icon"
          aria-label="Page settings"
          onClick={onSettings ?? (() => toast.info("No settings available for this page yet."))}
          className="size-9 [&_svg]:size-7"
        >
          <Settings />
        </Button>
      )}
      {extraActions}
    </div>
  );
}

type PageHeaderProps = {
  // REQUIRED
  title: string;
  
  // OPTIONAL - Structured data only
  subtitle?: string;
  leading?: React.ReactNode; // Back button (detail pages only)
  
  // ICON ACTIONS - Handlers only, NO JSX slots
  onSearch?: () => void;
  onFilter?: () => void;
  onSettings?: () => void;
  searchEnabled?: boolean;
  filterEnabled?: boolean;
  settingsEnabled?: boolean;
  
  // ESCAPE HATCH - Exceptional screens only
  extraActions?: React.ReactNode;
  
  // PRIMARY ACTIONS - Right-aligned desktop, stacked mobile
  primaryActions?: React.ReactNode;
  
  // VARIANT
  variant?: "default" | "detail" | "fullscreen";
};

export function PageHeader({
  title,
  subtitle,
  leading,
  onSearch,
  onFilter,
  onSettings,
  searchEnabled = true,
  filterEnabled = true,
  settingsEnabled = true,
  extraActions,
  primaryActions,
  variant = "default",
}: PageHeaderProps) {
  // Fullscreen variant: minimal header with title and settings only
  if (variant === "fullscreen") {
    return (
      <div className="flex items-center justify-between gap-4 px-4 py-3 bg-[var(--surface-overlay)] backdrop-blur-[var(--blur-overlay)]">
        <h1 className="text-xl font-normal truncate">{title}</h1>
        <HeaderIconCluster
          onSettings={onSettings}
          searchEnabled={false}
          filterEnabled={false}
          settingsEnabled={settingsEnabled}
        />
      </div>
    );
  }
  
  // Detail variant: has back button, no icon cluster
  if (variant === "detail") {
    return (
      <div style={{ marginBottom: 'var(--space-page-gap, 24px)' }}>
        {/* TitleRow with leading */}
        <div className="flex items-center gap-3">
          {leading ?? (
            <Button
              variant="ghost"
              size="icon"
              aria-label="Go back"
              onClick={() => window.history.back()}
              className="size-9 [&_svg]:size-6"
            >
              <ChevronLeft />
            </Button>
          )}
          <h1 className="text-3xl font-light truncate flex-1">{title}</h1>
        </div>
        
        {/* SubtitleRow */}
        {subtitle && (
          <p 
            className="text-muted-foreground text-sm mt-2"
            style={{ marginTop: 'var(--space-header-subtitle, 12px)' }}
          >
            {subtitle}
          </p>
        )}
        
        {/* ActionRow */}
        {primaryActions && (
          <div
            className="flex flex-col sm:flex-row sm:justify-end gap-2"
            style={{ marginTop: 'var(--space-header-actions, 16px)' }}
          >
            {primaryActions}
          </div>
        )}
      </div>
    );
  }
  
  // Default variant: full header with icon cluster
  return (
    <div style={{ marginBottom: 'var(--space-page-gap, 24px)' }}>
      {/* TitleRow */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-start gap-2">
            {leading}
            <h1 className="text-3xl font-light">{title}</h1>
          </div>
          
          {/* SubtitleRow */}
          {subtitle && (
            <p 
              className="text-muted-foreground text-sm"
              style={{ marginTop: 'var(--space-header-subtitle, 12px)' }}
            >
              {subtitle}
            </p>
          )}
        </div>
        
        {/* Icon Cluster - right side */}
        <HeaderIconCluster
          onSearch={onSearch}
          onFilter={onFilter}
          onSettings={onSettings}
          searchEnabled={searchEnabled}
          filterEnabled={filterEnabled}
          settingsEnabled={settingsEnabled}
          extraActions={extraActions}
        />
      </div>
      
      {/* ActionRow - Primary actions */}
      {primaryActions && (
        <div
          className="flex flex-col sm:flex-row sm:justify-end gap-2"
          style={{ marginTop: 'var(--space-header-actions, 16px)' }}
        >
          {primaryActions}
        </div>
      )}
    </div>
  );
}

// Re-export for backwards compatibility during migration
// TODO: Remove after all pages are migrated
export type { PageHeaderProps };
