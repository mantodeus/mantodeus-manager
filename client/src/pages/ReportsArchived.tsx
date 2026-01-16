/**
 * Archived Reports List Page
 *
 * Displays archived reports with options to:
 * - Restore to active
 * - Delete (move to rubbish)
 */

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { trpc } from "@/lib/trpc";
import { ArrowLeft, FileText, Loader2, Archive, RotateCcw, Trash2 } from "@/components/ui/Icon";
import { Link, useLocation } from "wouter";
import { useState } from "react";
import { ItemActionsMenu, ItemAction } from "@/components/ItemActionsMenu";
import { toast } from "sonner";
import { DeleteConfirmDialog } from "@/components/DeleteConfirmDialog";
import { ModulePage } from "@/components/ModulePage";

export default function ReportsArchived() {
  const [, setLocation] = useLocation();
  
  // Note: Reports archive functionality may not be implemented yet
  // This page follows the pattern but shows empty state for now
  const { data: archivedReports = [], isLoading } = trpc.projects.listArchived.useQuery();
  const utils = trpc.useUtils();

  // Delete confirmation dialog
  const [deleteToRubbishDialogOpen, setDeleteToRubbishDialogOpen] = useState(false);
  const [deleteToRubbishTargetId, setDeleteToRubbishTargetId] = useState<number | null>(null);

  const invalidateReportLists = () => {
    utils.projects.list.invalidate();
    utils.projects.listArchived.invalidate();
    utils.projects.listTrashed.invalidate();
  };

  const restoreArchivedReportMutation = trpc.projects.restoreArchivedProject.useMutation({
    onSuccess: () => {
      toast.success("Report restored");
      invalidateReportLists();
    },
    onError: (error) => {
      toast.error(`Failed to restore report: ${error.message}`);
    },
  });

  const moveReportToTrashMutation = trpc.projects.moveProjectToTrash.useMutation({
    onSuccess: () => {
      toast.success("Report moved to rubbish");
      invalidateReportLists();
    },
    onError: (error) => {
      toast.error(`Failed to move report to rubbish: ${error.message}`);
    },
  });

  const handleItemAction = (action: ItemAction, reportId: number) => {
    switch (action) {
      case "restore":
        restoreArchivedReportMutation.mutate({ projectId: reportId });
        break;
      case "delete":
        setDeleteToRubbishTargetId(reportId);
        setDeleteToRubbishDialogOpen(true);
        break;
    }
  };

  const handleDeleteToRubbish = (reportId: number) => {
    moveReportToTrashMutation.mutate({ projectId: reportId });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <ModulePage
      title="Archived"
      subtitle="Reports that have been archived"
      leading={
        <Link href="/reports">
          <Button variant="ghost" size="icon" className="size-9 [&_svg]:size-6" aria-label="Back to reports">
            <ArrowLeft className="h-5 w-5" />
          </Button>
        </Link>
      }
    >

      {archivedReports.length === 0 ? (
        <Card className="p-8 text-center">
          <Archive className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
          <p className="text-muted-foreground mb-4">No archived reports found.</p>
          <Button asChild variant="outline">
            <Link href="/reports">Back to Reports</Link>
          </Button>
        </Card>
      ) : (
        <div className="space-y-4">
          {archivedReports.map((report) => (
            <Card key={report.id}>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <FileText className="h-5 w-5 text-muted-foreground flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate">{report.name || "Untitled Report"}</p>
                      <p className="text-sm text-muted-foreground">
                        Archived {report.archivedAt ? new Date(report.archivedAt).toLocaleDateString() : ""}
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

      {/* Delete to Rubbish Confirmation Dialog */}
      <DeleteConfirmDialog
        open={deleteToRubbishDialogOpen}
        onOpenChange={(open) => {
          setDeleteToRubbishDialogOpen(open);
          if (!open) {
            setDeleteToRubbishTargetId(null);
          }
        }}
        onConfirm={() => {
          if (deleteToRubbishTargetId) {
            handleDeleteToRubbish(deleteToRubbishTargetId);
            setDeleteToRubbishTargetId(null);
          }
        }}
        title="Move to Rubbish"
        description="Move this report to rubbish? You can restore it later from the rubbish bin."
        confirmLabel="Move to Rubbish"
        isDeleting={moveReportToTrashMutation.isPending}
      />
    </ModulePage>
  );
}

