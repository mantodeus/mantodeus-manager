/**
 * Rubbish (Deleted) Reports List Page
 *
 * Displays deleted reports with options to:
 * - Restore to active
 * - Delete permanently
 */

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { trpc } from "@/lib/trpc";
import { ArrowLeft, FileText, Loader2, Trash2, RotateCcw, X } from "@/components/ui/Icon";
import { Link, useLocation } from "wouter";
import { useState } from "react";
import { ItemActionsMenu, ItemAction } from "@/components/ItemActionsMenu";
import { toast } from "sonner";
import { DeleteConfirmDialog } from "@/components/DeleteConfirmDialog";
import { PageHeader } from "@/components/PageHeader";

export default function ReportsRubbish() {
  const [, setLocation] = useLocation();
  
  // Note: Reports trash functionality may not be implemented yet
  // This page follows the pattern but shows empty state for now
  const { data: trashedReports = [], isLoading } = trpc.projects.listTrashed.useQuery();
  const utils = trpc.useUtils();

  // Delete confirmation dialogs
  const [restoreDialogOpen, setRestoreDialogOpen] = useState(false);
  const [restoreTargetId, setRestoreTargetId] = useState<number | null>(null);
  const [deletePermanentlyDialogOpen, setDeletePermanentlyDialogOpen] = useState(false);
  const [deletePermanentlyTargetId, setDeletePermanentlyTargetId] = useState<number | null>(null);

  const invalidateReportLists = () => {
    utils.projects.list.invalidate();
    utils.projects.listArchived.invalidate();
    utils.projects.listTrashed.invalidate();
  };

  const restoreTrashedReportMutation = trpc.projects.restoreTrashedProject.useMutation({
    onSuccess: () => {
      toast.success("Report restored");
      invalidateReportLists();
    },
    onError: (error) => {
      toast.error(`Failed to restore report: ${error.message}`);
    },
  });

  const deleteReportPermanentlyMutation = trpc.projects.deleteProjectPermanently.useMutation({
    onSuccess: () => {
      toast.success("Report deleted permanently");
      invalidateReportLists();
    },
    onError: (error) => {
      toast.error(`Failed to delete report: ${error.message}`);
    },
  });

  const handleItemAction = (action: ItemAction, reportId: number) => {
    switch (action) {
      case "restore":
        setRestoreTargetId(reportId);
        setRestoreDialogOpen(true);
        break;
      case "delete":
        setDeletePermanentlyTargetId(reportId);
        setDeletePermanentlyDialogOpen(true);
        break;
    }
  };

  const handleRestore = (reportId: number) => {
    restoreTrashedReportMutation.mutate({ projectId: reportId });
  };

  const handleDeletePermanently = (reportId: number) => {
    deleteReportPermanentlyMutation.mutate({ projectId: reportId });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Rubbish"
        subtitle="Deleted reports"
        leading={
          <Link href="/reports">
            <Button variant="ghost" size="icon" aria-label="Back to reports">
              <ArrowLeft className="h-5 w-5" />
            </Button>
          </Link>
        }
      />

      {trashedReports.length === 0 ? (
        <Card className="p-8 text-center">
          <Trash2 className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
          <p className="text-muted-foreground mb-4">Rubbish is empty.</p>
          <Button asChild variant="outline">
            <Link href="/reports">Back to Reports</Link>
          </Button>
        </Card>
      ) : (
        <div className="space-y-4">
          {trashedReports.map((report) => (
            <Card key={report.id}>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <FileText className="h-5 w-5 text-muted-foreground flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate">{report.name || "Untitled Report"}</p>
                      <p className="text-sm text-muted-foreground">
                        Deleted {report.trashedAt ? new Date(report.trashedAt).toLocaleDateString() : ""}
                      </p>
                    </div>
                  </div>
                  <ItemActionsMenu
                    onAction={(action) => handleItemAction(action, report.id)}
                    actions={["restore", "delete"]}
                  />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Restore Confirmation Dialog */}
      <DeleteConfirmDialog
        open={restoreDialogOpen}
        onOpenChange={(open) => {
          setRestoreDialogOpen(open);
          if (!open) {
            setRestoreTargetId(null);
          }
        }}
        onConfirm={() => {
          if (restoreTargetId) {
            handleRestore(restoreTargetId);
            setRestoreTargetId(null);
          }
        }}
        title="Restore Report"
        description="Restore this report to active?"
        confirmLabel="Restore"
        isDeleting={restoreTrashedReportMutation.isPending}
      />

      {/* Delete Permanently Confirmation Dialog */}
      <DeleteConfirmDialog
        open={deletePermanentlyDialogOpen}
        onOpenChange={(open) => {
          setDeletePermanentlyDialogOpen(open);
          if (!open) {
            setDeletePermanentlyTargetId(null);
          }
        }}
        onConfirm={() => {
          if (deletePermanentlyTargetId) {
            handleDeletePermanently(deletePermanentlyTargetId);
            setDeletePermanentlyTargetId(null);
          }
        }}
        title="Delete Permanently"
        description="Are you sure? This action cannot be undone. This report will be permanently deleted."
        confirmLabel="Delete Permanently"
        variant="destructive"
        isDeleting={deleteReportPermanentlyMutation.isPending}
      />
    </div>
  );
}

