/**
 * Rubbish Projects List Page
 *
 * Displays trashed projects with options to:
 * - Restore to active
 * - Delete permanently (irreversible)
 */

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { trpc, type RouterOutputs } from "@/lib/trpc";
import { ArrowLeft, Loader2, Trash2 } from "@/components/ui/Icon";
import { Link } from "wouter";
import { useState } from "react";
import { ItemActionsMenu, ItemAction } from "@/components/ItemActionsMenu";
import { toast } from "sonner";
import { DeleteConfirmDialog } from "@/components/DeleteConfirmDialog";
import { PageHeader } from "@/components/PageHeader";

type ProjectListItem = RouterOutputs["projects"]["listTrashed"][number];

export default function ProjectsRubbish() {
  const { data: trashedProjects, isLoading } = trpc.projects.listTrashed.useQuery();
  const utils = trpc.useUtils();

  // Permanent delete dialog
  const [deletePermanentlyDialogOpen, setDeletePermanentlyDialogOpen] = useState(false);
  const [deletePermanentlyTarget, setDeletePermanentlyTarget] = useState<ProjectListItem | null>(null);
  
  // Empty rubbish dialog
  const [emptyRubbishDialogOpen, setEmptyRubbishDialogOpen] = useState(false);

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

  const handleEmptyRubbish = () => {
    if (!trashedProjects || trashedProjects.length === 0) return;
    
    // Delete all projects one by one
    trashedProjects.forEach((project) => {
      deleteProjectPermanentlyMutation.mutate({ projectId: project.id });
    });
    
    setEmptyRubbishDialogOpen(false);
  };

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
        <ItemActionsMenu
          actions={["restore", "deletePermanently"]}
          onAction={(action) => handleItemAction(action, project.id)}
        />
      </CardContent>
    </Card>
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title="Rubbish"
        subtitle="Deleted projects. Items here can be restored or permanently deleted."
        leading={
          <Link href="/projects">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-5 w-5" />
            </Button>
          </Link>
        }
        actions={
          trashedProjects && trashedProjects.length > 0 ? (
            <Button
              variant="destructive-outline"
              size="sm"
              onClick={() => setEmptyRubbishDialogOpen(true)}
              disabled={deleteProjectPermanentlyMutation.isPending}
            >
              <Trash2 className="h-4 w-4 mr-2" />
              Empty
            </Button>
          ) : undefined
        }
        actionsPlacement="right"
      />

      {/* Rubbish Items List */}
      <div className="space-y-3">
        {!trashedProjects || trashedProjects.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <Trash2 className="h-12 w-12 text-muted-foreground mb-4" />
              <p className="text-muted-foreground mb-4">Rubbish is empty.</p>
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

      <DeleteConfirmDialog
        open={emptyRubbishDialogOpen}
        onOpenChange={(open) => {
          setEmptyRubbishDialogOpen(open);
        }}
        onConfirm={handleEmptyRubbish}
        title="Empty rubbish"
        description={`This will permanently delete all ${trashedProjects?.length || 0} project(s) in the rubbish. This action cannot be undone.`}
        confirmLabel="Empty rubbish"
        isDeleting={deleteProjectPermanentlyMutation.isPending}
      />
    </div>
  );
}
