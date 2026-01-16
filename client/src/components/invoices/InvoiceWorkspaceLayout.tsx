import { Button } from "@/components/ui/button";
import { ArrowLeft, X } from "@/components/ui/Icon";
import { useIsMobile } from "@/hooks/useMobile";
import { cn } from "@/lib/utils";

type InvoiceWorkspaceHeaderProps = {
  title: string;
  subtitle?: string;
  actions?: React.ReactNode;
  onClose: () => void;
  closeDisabled?: boolean;
};

export function InvoiceWorkspaceHeader({
  title,
  subtitle,
  actions,
  onClose,
  closeDisabled = false,
}: InvoiceWorkspaceHeaderProps) {
  const isMobile = useIsMobile();

  return (
    <div className={cn("flex-shrink-0", isMobile ? "px-0 pt-0" : "px-6 pt-6")}>
      <div className="flex items-center gap-3">
        {isMobile && (
          <Button
            variant="icon"
            size="icon"
            onClick={onClose}
            className="size-9 [&_svg]:size-7 hover:bg-muted/50 shrink-0"
            aria-label="Back to invoices"
            disabled={closeDisabled}
          >
            <ArrowLeft />
          </Button>
        )}

        <div className="flex items-center gap-2 min-w-0 flex-1">
          <h1 className="text-2xl md:text-3xl font-light truncate">{title}</h1>
        </div>

        {(actions || !isMobile) && (
          <div className="flex items-center gap-2 shrink-0">
            {actions}
            {!isMobile && (
              <Button
                variant="icon"
                size="icon"
                onClick={onClose}
                className="size-9 [&_svg]:size-7"
                aria-label="Close"
                disabled={closeDisabled}
              >
                <X className="h-6 w-6" />
              </Button>
            )}
          </div>
        )}
      </div>

      {subtitle && (
        <p 
          className="text-muted-foreground text-sm"
          style={{ marginTop: 'var(--space-header-subtitle, 2px)' }}
        >
          {subtitle}
        </p>
      )}

      <InvoiceWorkspaceSeparator />
    </div>
  );
}

export function InvoiceWorkspaceSeparator() {
  return <div className="separator-fade my-3" />;
}

export function InvoiceWorkspaceBody({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  const isMobile = useIsMobile();

  return (
    <div
      className={cn(
        "flex-1 min-h-0 overflow-y-auto pt-2",
        isMobile ? "px-0 pb-4" : "px-6 pb-6",
        className
      )}
    >
      {children}
    </div>
  );
}

export function InvoiceWorkspaceFooter({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  const isMobile = useIsMobile();

  return (
    <div
      className={cn(
        "flex-shrink-0 pt-4",
        isMobile ? "px-0 pb-4" : "px-6 pb-6",
        className
      )}
    >
      {children}
    </div>
  );
}
