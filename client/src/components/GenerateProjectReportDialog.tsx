/**
 * Generate Project Report Dialog
 * 
 * Dialog for generating and sharing project reports as PDFs.
 * Includes shareable link generation with expiry options.
 */

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { trpc } from "@/lib/trpc";
import { Loader2, FileText, Share2, Copy, Check, ExternalLink } from "lucide-react";
import { toast } from "sonner";

interface GenerateProjectReportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: number;
}

export function GenerateProjectReportDialog({
  open,
  onOpenChange,
  projectId,
}: GenerateProjectReportDialogProps) {
  const [expiryHours, setExpiryHours] = useState<string>("168"); // 7 days default
  const [shareLink, setShareLink] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const generateMutation = trpc.pdf.generateProjectReport.useMutation({
    onSuccess: () => {
      toast.success("Project report generated successfully");
    },
    onError: (error) => {
      toast.error("Failed to generate report: " + error.message);
    },
  });

  const createShareLinkMutation = trpc.pdf.createShareLink.useMutation({
    onSuccess: (data) => {
      const baseUrl = window.location.origin;
      const fullLink = `${baseUrl}/share/${data.token}`;
      setShareLink(fullLink);
      toast.success("Shareable link created");
    },
    onError: (error) => {
      toast.error("Failed to create share link: " + error.message);
    },
  });

  const handleGenerate = async () => {
    await generateMutation.mutateAsync({ projectId });
  };

  const handleCreateShareLink = async () => {
    if (!generateMutation.data?.s3Key) {
      toast.error("Please generate the report first");
      return;
    }

    const hours = parseInt(expiryHours, 10);
    if (isNaN(hours) || hours < 1 || hours > 8760) {
      toast.error("Expiry must be between 1 and 8760 hours (1 year)");
      return;
    }

    await createShareLinkMutation.mutateAsync({
      documentType: "project_report",
      documentId: projectId,
      expiryHours: hours,
    });
  };

  const handleCopyLink = async () => {
    if (!shareLink) return;
    try {
      await navigator.clipboard.writeText(shareLink);
      setCopied(true);
      toast.success("Link copied to clipboard");
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      toast.error("Failed to copy link");
    }
  };

  const handleOpenLink = () => {
    if (!shareLink) return;
    window.open(shareLink, "_blank");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-primary" />
            Generate Project Report
          </DialogTitle>
          <DialogDescription>
            Generate a PDF report for this project. You can create a shareable link after generation.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label>Generate PDF Report</Label>
            <Button
              onClick={handleGenerate}
              disabled={generateMutation.isPending}
              className="w-full gap-2"
            >
              {generateMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Generating...
                </>
              ) : (
                <>
                  <FileText className="h-4 w-4" />
                  Generate Report
                </>
              )}
            </Button>
            {generateMutation.data && (
              <p className="text-sm text-muted-foreground">
                Report generated successfully
              </p>
            )}
          </div>

          {generateMutation.data && (
            <>
              <div className="border-t pt-4 space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="expiryHours">Link Expiry (hours)</Label>
                  <Input
                    id="expiryHours"
                    type="number"
                    min="1"
                    max="8760"
                    value={expiryHours}
                    onChange={(e) => setExpiryHours(e.target.value)}
                    placeholder="168"
                  />
                  <p className="text-xs text-muted-foreground">
                    Link will expire after this many hours (max 8760 = 1 year)
                  </p>
                </div>

                <Button
                  onClick={handleCreateShareLink}
                  disabled={createShareLinkMutation.isPending}
                  variant="outline"
                  className="w-full gap-2"
                >
                  {createShareLinkMutation.isPending ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Creating Link...
                    </>
                  ) : (
                    <>
                      <Share2 className="h-4 w-4" />
                      Create Shareable Link
                    </>
                  )}
                </Button>

                {shareLink && (
                  <div className="space-y-2 p-4 rounded-lg border bg-muted/50">
                    <Label>Shareable Link</Label>
                    <div className="flex items-center gap-2">
                      <Input
                        value={shareLink}
                        readOnly
                        className="font-mono text-xs"
                      />
                      <Button
                        onClick={handleCopyLink}
                        variant="ghost"
                        size="sm"
                        className="shrink-0"
                      >
                        {copied ? (
                          <Check className="h-4 w-4 text-primary" />
                        ) : (
                          <Copy className="h-4 w-4" />
                        )}
                      </Button>
                      <Button
                        onClick={handleOpenLink}
                        variant="ghost"
                        size="sm"
                        className="shrink-0"
                      >
                        <ExternalLink className="h-4 w-4" />
                      </Button>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      This link will expire in {expiryHours} hours
                    </p>
                  </div>
                )}
              </div>
            </>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

