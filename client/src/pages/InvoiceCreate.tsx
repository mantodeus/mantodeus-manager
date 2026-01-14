import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { CreateInvoiceDialog } from "@/components/invoices/CreateInvoiceDialog";
import { PageHeader } from "@/components/PageHeader";
import { trpc } from "@/lib/trpc";

export default function InvoiceCreate() {
  const [, navigate] = useLocation();
  const utils = trpc.useUtils();
  const [dialogOpen, setDialogOpen] = useState(true);

  // Close dialog and navigate back when dialog closes
  const handleDialogChange = (open: boolean) => {
    setDialogOpen(open);
    if (!open) {
      navigate("/invoices");
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader />
      <CreateInvoiceDialog
        open={dialogOpen}
        onOpenChange={handleDialogChange}
        onSuccess={async () => {
          await utils.invoices.list.invalidate();
          navigate("/invoices");
        }}
      />
    </div>
  );
}
