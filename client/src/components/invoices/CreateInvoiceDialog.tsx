/**
 * Create Invoice Dialog
 * 
 * Dialog for creating a new invoice with the same style as the edit invoice dialog.
 */

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { trpc } from "@/lib/trpc";
import { DocumentCurrencyEuro, X } from "@/components/ui/Icon";
import { toast } from "sonner";
import { useIsMobile } from "@/hooks/useMobile";
import { cn } from "@/lib/utils";
import { InvoiceForm } from "./InvoiceForm";

interface CreateInvoiceDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

export function CreateInvoiceDialog({
  open,
  onOpenChange,
  onSuccess,
}: CreateInvoiceDialogProps) {
  const isMobile = useIsMobile();
  const utils = trpc.useUtils();
  const { data: contacts = [] } = trpc.contacts.list.useQuery();

  const handleSuccess = async () => {
    toast.success("Invoice created");
    await utils.invoices.list.invalidate();
    onOpenChange(false);
    onSuccess?.();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent 
        className={cn(
          "flex flex-col p-0",
          // Desktop: right side with margins, showing blurred background border
          "sm:!top-[1.5rem] sm:!bottom-[1.5rem] sm:!translate-x-0 sm:!translate-y-0 sm:!max-w-none sm:!h-auto sm:max-h-[calc(100vh-3rem)]",
          // Mobile: fullscreen with safe margins
          isMobile && "max-h-[calc(100vh-var(--bottom-safe-area,0px)-2rem)] mb-[calc(var(--bottom-safe-area,0px)+1rem)]"
        )}
        style={{
          // Desktop: right side, 60% width with margins for blurred border
          // Mobile: normal dialog behavior
          left: isMobile ? undefined : "calc(40vw + 0.5rem)", // Start after preview + small gap
          right: isMobile ? undefined : "1.5rem",
          top: isMobile ? undefined : "1.5rem",
          bottom: isMobile ? undefined : "1.5rem",
          width: isMobile ? undefined : "calc(60vw - 2rem)", // 60% width with margins
          height: isMobile ? undefined : "calc(100vh - 3rem)",
          maxHeight: isMobile ? undefined : "calc(100vh - 3rem)",
        } as React.CSSProperties}
        showCloseButton={false}
      >
        {/* PageHeader-like structure */}
        <div className="flex-shrink-0 p-6 pb-2 space-y-4">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-start gap-4 min-w-0 flex-1">
              <div className="flex-1 min-w-0 flex flex-col">
                <h1 className="text-3xl font-regular flex items-center gap-2">
                  <DocumentCurrencyEuro className="h-6 w-6 text-primary" />
                  Create Invoice
                </h1>
                <p className="text-muted-foreground text-sm mt-3">
                  Create a new invoice
                </p>
              </div>
            </div>
            <div className="flex flex-col items-end gap-3 shrink-0">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => onOpenChange(false)}
                className="h-10 w-10"
                aria-label="Close"
              >
                <X className="h-6 w-6" />
              </Button>
            </div>
          </div>
        </div>

        {/* Fade-out separator */}
        <div className="separator-fade" />

        <div className={cn(
          "px-6 pt-4 overflow-y-auto flex-1",
          isMobile ? "pb-[calc(var(--bottom-safe-area,0px)+1rem)]" : "pb-6"
        )}>
          <InvoiceForm
            mode="create"
            contacts={contacts}
            onClose={() => onOpenChange(false)}
            onSuccess={handleSuccess}
          />
        </div>
      </DialogContent>
    </Dialog>
  );
}

