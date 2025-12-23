/**
 * Rubbish Bin Projects List Page
 *
 * Displays trashed projects with options to:
 * - Restore to active
 * - Delete permanently (irreversible)
 */

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { trpc, type RouterOutputs } from "@/lib/trpc";
import { ArrowLeft, Loader2, Trash2, RotateCcw } from "lucide-react";
import { Link } from "wouter";
import { useState } from "react";
import { ItemActionsMenu, ItemAction } from "@/components/ItemActionsMenu";
import { toast } from "sonner";
import { DeleteConfirmDialog } from "@/components/DeleteConfirmDialog";

type ProjectListItem = RouterOutputs["projects"]["listTrashed"][number];

export default function ProjectsRubbish() {
  const { data: trashedProjects, isLoading } = trpc.projects.listTrashed.useQuery();
  const utils = trpc.useUtils();

  // Permanent delete dialog
  const [deletePermanentlyDialogOpen, setDeletePermanentlyDialogOpen] = useState(false);
  const [deletePermanentlyTarget, setDeletePermanentlyTarget] = useState<ProjectListItem | null>(null);

  const invalidateProjectLists = () => {
    utils.projects.list.invalidate();
    utils.projects.listArchived.invalidate();
    utils.projects.listTrashed.invalidate();
  };

  const restoreProjectFromTrashMutation = trpc.projects.restoreProjectFromTrash.useMutation({
    onSuccess: () => {
      toast.success("Project restored");
      invalidateProjectLists();
    },
    onError: (error) => {
      toast.error(`Failed to restore project: ${error.message}`);
    },
  });

  const deleteProjectPermanentlyMutation = trpc.projects.deleteProjectPermanently.useMutation({
    onSuccess: () => {
      toast.success("Project deleted permanently");
      invalidateProjectLists();
      setDeletePermanentlyDialogOpen(false);
      setDeletePermanentlyTarget(null);
    },
    onError: (error) => {
      toast.error(`Failed to delete project permanently: ${error.message}`);
    },
  });

  const handleItemAction = (action: ItemAction, projectId: number) => {
    switch (action) {
      case "restore":
        restoreProjectFromTrashMutation.mutate({ projectId });
        break;
      case "deletePermanently":
        const project = (trashedProjects ?? []).find((p) => p.id === projectId) ?? null;
        if (project) {
          setDeletePermanentlyTarget(project);
          setDeletePermanentlyDialogOpen(true);
        }
        break;
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const renderRubbishItem = (project: ProjectListItem) => (
    <Card key={project.id}>
      <CardContent className="flex items-center justify-between py-4">
        <div className="min-w-0">
          <div className="truncate">{project.name}</div>
          <div className="text-sm text-muted-foreground">
            Deleted{" "}
            {project.trashedAt ? new Date(project.trashedAt).toLocaleDateString() : "—"}
          </div>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={() => handleItemAction("restore", project.id)}
            disabled={restoreProjectFromTrashMutation.isPending}
            className="gap-2"
          >
            <RotateCcw className="h-4 w-4" />
            Restore
          </Button>
          <Button
            variant="destructive"
            onClick={() => handleItemAction("deletePermanently", project.id)}
            className="gap-2"
          >
            <Trash2 className="h-4 w-4" />
            Delete permanently
          </Button>
        </div>
      </CardContent>
    </Card>
  );

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div className="flex items-center gap-4">
          <Link href="/projects">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-5 w-5" />
            </Button>
          </Link>
          <div>
            <h1 className="text-3xl font-regular flex items-center gap-3">
              <Trash2 className="h-8 w-8 text-muted-foreground" />
              Rubbish Bin
            </h1>
            <p className="text-muted-foreground text-sm">Deleted projects. Items here can be restored or permanently deleted.</p>
          </div>
        </div>
      </div>

      {/* Rubbish Items List */}
      <div className="space-y-3">
        {!trashedProjects || trashedProjects.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <Trash2 className="h-12 w-12 text-muted-foreground mb-4" />
              <p className="text-muted-foreground mb-4">Rubbish bin is empty.</p>
              <Link href="/projects">
                <Button variant="outline">
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  Back to Projects
                </Button>
              </Link>
            </CardContent>
          </Card>
        ) : (
          trashedProjects.map((project) => renderRubbishItem(project))
        )}
      </div>

      <DeleteConfirmDialog
        open={deletePermanentlyDialogOpen}
        onOpenChange={(open) => {
          setDeletePermanentlyDialogOpen(open);
          if (!open) {
            setDeletePermanentlyTarget(null);
          }
        }}
        onConfirm={() => {
          if (!deletePermanentlyTarget) return;
          deleteProjectPermanentlyMutation.mutate({ projectId: deletePermanentlyTarget.id });
        }}
        title="Delete permanently"
        description="This action cannot be undone."
        confirmLabel="Delete permanently"
        isDeleting={deleteProjectPermanentlyMutation.isPending}
      />
    </div>
  );
}
