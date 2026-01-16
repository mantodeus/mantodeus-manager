/**
 * ModulePage - Reusable shell for module list/landing screens
 * 
 * Provides consistent layout and spacing for all module entry pages:
 * - Standard outer spacing (space-y-6)
 * - PageHeader with sensible defaults
 * - Icon cluster enabled by default (search/filter/settings)
 * - Primary actions with h-10 and gap-2
 * 
 * Usage:
 * ```tsx
 * <ModulePage
 *   title="Projects"
 *   subtitle="Manage your projects and jobs"
 *   primaryActions={
 *     <>
 *       <Button className="h-10 whitespace-nowrap">New</Button>
 *     </>
 *   }
 * >
 *   {/* Page content */}
 * </ModulePage>
 * ```
 * 
 * To disable icon cluster (like Expenses):
 * ```tsx
 * <ModulePage
 *   title="Expenses"
 *   searchEnabled={false}
 *   filterEnabled={false}
 *   settingsEnabled={false}
 * >
 * ```
 */

import { PageHeader, type PageHeaderProps } from "@/components/PageHeader";
import { cn } from "@/lib/utils";

type ModulePageProps = {
  // PageHeader props
  title: string;
  subtitle?: string;
  leading?: React.ReactNode;
  
  // Icon cluster handlers
  onSearch?: () => void;
  onFilter?: () => void;
  onSettings?: () => void;
  searchEnabled?: boolean;
  filterEnabled?: boolean;
  settingsEnabled?: boolean;
  extraActions?: React.ReactNode;
  
  // Primary actions (right-aligned desktop, stacked mobile)
  primaryActions?: React.ReactNode;
  
  // Content
  children: React.ReactNode;
  
  // Layout overrides (use sparingly)
  className?: string;
  style?: React.CSSProperties;
};

export function ModulePage({
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
  children,
  className,
}: ModulePageProps) {
  return (
    <div className={cn("space-y-6", className)} style={style}>
      <PageHeader
        title={title}
        subtitle={subtitle}
        leading={leading}
        onSearch={onSearch}
        onFilter={onFilter}
        onSettings={onSettings}
        searchEnabled={searchEnabled}
        filterEnabled={filterEnabled}
        settingsEnabled={settingsEnabled}
        extraActions={extraActions}
        primaryActions={primaryActions}
        variant="default"
      />
      {children}
    </div>
  );
}
