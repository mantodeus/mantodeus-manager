import { useState, useRef } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { Download, Upload, FileJson, CheckCircle2, AlertCircle, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { normalizeExportPayload } from "@shared/importNormalizer";

interface DataExportImportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function DataExportImportDialog({ open, onOpenChange }: DataExportImportDialogProps) {
  const [isExporting, setIsExporting] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [importResult, setImportResult] = useState<{
    success: boolean;
    imported?: {
      jobs: number;
      tasks: number;
      contacts: number;
      notes: number;
      locations: number;
      comments: number;
      reports: number;
    };
    error?: string;
  } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const exportQuery = trpc.export.userData.useQuery(undefined, {
    enabled: false,
  });

  const importMutation = trpc.export.importUserData.useMutation({
    onSuccess: (data) => {
      setImportResult({ success: true, imported: data.imported });
      toast.success("Data imported successfully!");
    },
    onError: (error) => {
      setImportResult({ success: false, error: error.message });
      toast.error(`Import failed: ${error.message}`);
    },
    onSettled: () => {
      setIsImporting(false);
    },
  });

  const handleExport = async () => {
    setIsExporting(true);
    try {
      const result = await exportQuery.refetch();
      if (result.data) {
        const jsonString = JSON.stringify(result.data, null, 2);
        const blob = new Blob([jsonString], { type: "application/json" });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = `mantodeus-export-${new Date().toISOString().split("T")[0]}.json`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
        toast.success("Data exported successfully!");
      }
    } catch (error) {
      toast.error("Failed to export data");
    } finally {
      setIsExporting(false);
    }
  };

  const handleImportClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setIsImporting(true);
    setImportResult(null);

    try {
      const text = await file.text();
      const rawData = JSON.parse(text);
      const normalizedData = normalizeExportPayload(rawData);

      await importMutation.mutateAsync(normalizedData);
    } catch (error) {
      if (error instanceof SyntaxError) {
        setImportResult({ success: false, error: "Invalid JSON file" });
        toast.error("Invalid JSON file");
      } else if (error instanceof Error) {
        setImportResult({ success: false, error: error.message });
      }
      setIsImporting(false);
    }

    // Reset file input
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleClose = () => {
    setImportResult(null);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileJson className="h-5 w-5 text-primary" />
            Data Export & Import
          </DialogTitle>
          <DialogDescription>
            Export your data to share with other users or import data from an export file.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Export Section */}
          <div className="rounded-lg border border-border/50 p-4 space-y-3">
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-emerald-500/10">
                <Download className="h-5 w-5 text-emerald-500" />
              </div>
              <div className="space-y-1">
                <h4 className="font-medium">Export Data</h4>
                <p className="text-sm text-muted-foreground">
                  Download all your jobs, tasks, contacts, notes, and locations as a JSON file.
                </p>
              </div>
            </div>
            <Button
              onClick={handleExport}
              disabled={isExporting}
              className="w-full"
              variant="outline"
            >
              {isExporting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Exporting...
                </>
              ) : (
                <>
                  <Download className="mr-2 h-4 w-4" />
                  Export All Data
                </>
              )}
            </Button>
          </div>

          {/* Import Section */}
          <div className="rounded-lg border border-border/50 p-4 space-y-3">
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[#131416]/10">
                <Upload className="h-5 w-5 text-[#131416]" />
              </div>
              <div className="space-y-1">
                <h4 className="font-medium">Import Data</h4>
                <p className="text-sm text-muted-foreground">
                  Import data from an export file. This will create new entries without affecting existing data.
                </p>
              </div>
            </div>
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileSelect}
              accept=".json"
              className="hidden"
            />
            <Button
              onClick={handleImportClick}
              disabled={isImporting}
              className="w-full"
              variant="outline"
            >
              {isImporting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Importing...
                </>
              ) : (
                <>
                  <Upload className="mr-2 h-4 w-4" />
                  Import from File
                </>
              )}
            </Button>
          </div>

          {/* Import Result */}
          {importResult && (
            <div
              className={cn(
                "rounded-lg p-4 space-y-2",
                importResult.success
                  ? "bg-emerald-500/10 border border-emerald-500/20"
                  : "bg-destructive/10 border border-destructive/20"
              )}
            >
              <div className="flex items-center gap-2">
                {importResult.success ? (
                  <>
                    <CheckCircle2 className="h-5 w-5 text-emerald-500" />
                    <span className="font-medium text-emerald-500">Import Successful</span>
                  </>
                ) : (
                  <>
                    <AlertCircle className="h-5 w-5 text-destructive" />
                    <span className="font-medium text-destructive">Import Failed</span>
                  </>
                )}
              </div>
              {importResult.success && importResult.imported && (
                <div className="text-sm text-muted-foreground space-y-1 pl-7">
                  {importResult.imported.jobs > 0 && (
                    <p>{importResult.imported.jobs} job(s) imported</p>
                  )}
                  {importResult.imported.tasks > 0 && (
                    <p>{importResult.imported.tasks} task(s) imported</p>
                  )}
                  {importResult.imported.contacts > 0 && (
                    <p>{importResult.imported.contacts} contact(s) imported</p>
                  )}
                  {importResult.imported.notes > 0 && (
                    <p>{importResult.imported.notes} note(s) imported</p>
                  )}
                  {importResult.imported.locations > 0 && (
                    <p>{importResult.imported.locations} location(s) imported</p>
                  )}
                  {importResult.imported.comments > 0 && (
                    <p>{importResult.imported.comments} comment(s) imported</p>
                  )}
                  {importResult.imported.reports > 0 && (
                    <p>{importResult.imported.reports} report(s) imported</p>
                  )}
                  {Object.values(importResult.imported).every(v => v === 0) && (
                    <p>No data to import</p>
                  )}
                </div>
              )}
              {importResult.error && (
                <p className="text-sm text-destructive pl-7">{importResult.error}</p>
              )}
            </div>
          )}
        </div>

        <div className="text-xs text-muted-foreground border-t pt-4">
          <p className="flex items-center gap-1">
            <span className="font-medium">Note:</span> Importing will create new entries and won't overwrite existing data.
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
