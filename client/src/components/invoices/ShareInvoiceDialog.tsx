/**
 * Share Invoice Dialog
 * 
 * Dialog for sharing invoices with clients via shareable links.
 * Auto-marks invoice as sent when share link is created.
 */

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { trpc } from "@/lib/trpc";
import { Loader2, Copy, Check, ExternalLink } from "@/components/ui/Icon";
import { toast } from "sonner";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { CheckCircle2 } from "@/components/ui/Icon";

interface ShareInvoiceDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  invoiceId: number;
  onSuccess?: () => void;
}

export function ShareInvoiceDialog({
  open,
  onOpenChange,
  invoiceId,
  onSuccess,
}: ShareInvoiceDialogProps) {
  const [copied, setCopied] = useState(false);
  const [shareUrl, setShareUrl] = useState<string | null>(null);
  const [wasJustSent, setWasJustSent] = useState(false);

  const { data: invoice } = trpc.invoices.get.useQuery(
    { id: invoiceId },
    { enabled: open && !!invoiceId }
  );

  const utils = trpc.useUtils();
  const createShareLinkMutation = trpc.pdf.createShareLink.useMutation({
    onSuccess: (data) => {
      setShareUrl(data.shareUrl);
      // Check if invoice was just marked as sent
      if (invoice && !invoice.sentAt) {
        setWasJustSent(true);
      }
      toast.success("Share link created");
      utils.invoices.get.invalidate({ id: invoiceId });
    },
    onError: (error) => {
      toast.error("Failed to create share link: " + error.message);
    },
  });

  const handleCreateShareLink = async () => {
    if (!invoice) return;

    // Validate: dueDate and totalAmount > 0 required before sending
    if (!invoice.dueDate) {
      toast.error("Invoice must have a due date before it can be sent");
      return;
    }
    const total = Number(invoice.total || 0);
    if (total <= 0) {
      toast.error("Invoice total must be greater than 0");
      return;
    }

    await createShareLinkMutation.mutateAsync({
      documentType: 'invoice',
      referenceId: invoiceId,
      expiryHours: 720, // 30 days default
    });
  };

  const handleCopyLink = async () => {
    if (!shareUrl) return;
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      toast.success("Link copied to clipboard");
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      toast.error("Failed to copy link");
    }
  };

  const handleOpenLink = () => {
    if (shareUrl) {
      window.open(shareUrl, '_blank');
    }
  };

  const handleClose = () => {
    setShareUrl(null);
    setWasJustSent(false);
    setCopied(false);
    onOpenChange(false);
    onSuccess?.();
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Share Invoice</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {wasJustSent && (
            <Alert>
              <CheckCircle2 className="h-4 w-4" />
              <AlertDescription>
                This invoice has now been marked as sent.
              </AlertDescription>
            </Alert>
          )}

          {invoice && (
            <div className="space-y-2 rounded-lg border bg-muted/30 p-4">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Invoice Number</span>
                <span className="font-medium">{invoice.invoiceNumber || "Draft"}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Total</span>
                <span className="font-medium">
                  {new Intl.NumberFormat("de-DE", {
                    style: "currency",
                    currency: "EUR",
                  }).format(Number(invoice.total || 0))}
                </span>
              </div>
            </div>
          )}

          {!shareUrl ? (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Create a shareable link for this invoice. The link will expire in 30 days.
              </p>
              <Button
                onClick={handleCreateShareLink}
                disabled={createShareLinkMutation.isPending}
                className="w-full"
              >
                {createShareLinkMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Create Share Link
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Shareable Link</Label>
                <div className="flex gap-2">
                  <Input
                    value={shareUrl}
                    readOnly
                    className="font-mono text-xs"
                  />
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={handleCopyLink}
                    disabled={copied}
                  >
                    {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                  </Button>
                </div>
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  onClick={handleOpenLink}
                  className="flex-1"
                >
                  <ExternalLink className="mr-2 h-4 w-4" />
                  Open Link
                </Button>
                <Button
                  variant="outline"
                  onClick={handleCreateShareLink}
                  disabled={createShareLinkMutation.isPending}
                  className="flex-1"
                >
                  {createShareLinkMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Regenerate Link
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                The link expires in 30 days. Regenerating creates a new link but does not change the sent date.
              </p>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button onClick={handleClose} variant="outline">
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

