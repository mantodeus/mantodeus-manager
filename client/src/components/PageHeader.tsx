import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Search, Settings, SlidersHorizontal } from "lucide-react";

type PageHeaderProps = {
  title: string;
  subtitle?: string;
  leading?: React.ReactNode;
  primaryAction?: React.ReactNode;
  searchSlot?: React.ReactNode;
  filterSlot?: React.ReactNode;
  settingsSlot?: React.ReactNode;
};

export function PageHeader({
  title,
  subtitle,
  leading,
  primaryAction,
  searchSlot,
  filterSlot,
  settingsSlot,
}: PageHeaderProps) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-4">
      <div className="flex items-center gap-4">
        {leading}
        <div>
          <h1 className="text-3xl font-regular">{title}</h1>
          {subtitle && (
            <p className="text-muted-foreground text-sm">{subtitle}</p>
          )}
        </div>
      </div>
      <div className="flex items-center gap-2">
        {searchSlot ?? (
          <Button
            variant="ghost"
            size="icon"
            aria-label="Search"
            onClick={() => toast.info("Search isn't available for this page yet.")}
          >
            <Search className="h-4 w-4" />
          </Button>
        )}
        {filterSlot ?? (
          <Button
            variant="ghost"
            size="icon"
            aria-label="Filter"
            onClick={() => toast.info("Filters aren't available for this page yet.")}
          >
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
        {primaryAction}
      </div>
    </div>
  );
}
