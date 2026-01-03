/**
 * Archived Projects List Page
 *
 * Displays archived projects with options to:
 * - Restore to active
 * - Delete (move to rubbish)
 */

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { trpc, type RouterOutputs } from "@/lib/trpc";
import { ArrowLeft, MapPin, Calendar, Loader2, Building2, Archive, RotateCcw, Trash2 } from "@/components/ui/Icon";
import { Link, useLocation } from "wouter";
import { useState } from "react";
import { ItemActionsMenu, ItemAction } from "@/components/ItemActionsMenu";
import { toast } from "sonner";
import { formatProjectSchedule } from "@/lib/dateFormat";
import { DeleteConfirmDialog } from "@/components/DeleteConfirmDialog";
import { PageHeader } from "@/components/PageHeader";

type ProjectListItem = RouterOutputs["projects"]["listArchived"][number];

export default function ProjectsArchived() {
  const [, setLocation] = useLocation();
  
  const { data: archivedProjects, isLoading } = trpc.projects.listArchived.useQuery();
  const utils = trpc.useUtils();

  // Delete confirmation dialog
  const [deleteToRubbishDialogOpen, setDeleteToRubbishDialogOpen] = useState(false);
  const [deleteToRubbishTargetId, setDeleteToRubbishTargetId] = useState<number | null>(null);

  const invalidateProjectLists = () => {
    utils.projects.list.invalidate();
    utils.projects.listArchived.invalidate();
    utils.projects.listTrashed.invalidate();
  };

  const restoreArchivedProjectMutation = trpc.projects.restoreArchivedProject.useMutation({
    onSuccess: () => {
      toast.success("Project restored");
      invalidateProjectLists();
    },
    onError: (error) => {
      toast.error(`Failed to restore project: ${error.message}`);
    },
  });

  const moveProjectToTrashMutation = trpc.projects.moveProjectToTrash.useMutation({
    onSuccess: () => {
      toast.success("Deleted. You can restore this later from the Rubbish.");
      invalidateProjectLists();
    },
    onError: (error) => {
      toast.error(`Failed to delete: ${error.message}`);
    },
  });

  const handleItemAction = (action: ItemAction, projectId: number) => {
    switch (action) {
      case "edit":
        // "Edit" maps to "restore" for archived projects
        restoreArchivedProjectMutation.mutate({ projectId });
        break;
      case "duplicate":
        toast.info("Duplicate is coming soon.");
        break;
      case "select":
        toast.info("Selection mode is coming soon.");
        break;
      case "archive":
        // Archive not available for already-archived items
        break;
      case "delete":
        // "Delete" maps to "moveToTrash" for archived projects
        setDeleteToRubbishTargetId(projectId);
        setDeleteToRubbishDialogOpen(true);
        break;
    }
  };

  const getScheduleInfo = (project: ProjectListItem) =>
    formatProjectSchedule({
      dates: project.scheduledDates,
      start: project.startDate,
      end: project.endDate,
    });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const renderProjectCard = (project: ProjectListItem) => {
    const schedule = getScheduleInfo(project);

    return (
      <Card
        key={project.id}
        className="hover:shadow-lg transition-all h-full opacity-75"
      >
        <CardHeader>
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-2">
              <Building2 className="h-5 w-5 text-muted-foreground" />
              <CardTitle className="text-xl">{project.name}</CardTitle>
            </div>
            <div className="flex items-center gap-2">
              <Badge className="bg-muted text-muted-foreground">Archived</Badge>
              <ItemActionsMenu
                onAction={(action) => handleItemAction(action, project.id)}
                actions={["edit", "duplicate", "select", "delete"]}
                triggerClassName="text-muted-foreground hover:text-foreground"
              />
            </div>
          </div>
          {project.clientContact?.name && (
            <CardDescription>
              Client: {project.clientContact.name}
            </CardDescription>
          )}
          {project.description && (
            <CardDescription className="line-clamp-2">{project.description}</CardDescription>
          )}
        </CardHeader>
        <CardContent className="space-y-2">
          {project.address && (
            <div className="flex items-center text-sm text-muted-foreground">
              <MapPin className="h-4 w-4 mr-2" />
              <span className="truncate">{project.address}</span>
            </div>
          )}
          <div className="flex items-center text-sm text-muted-foreground">
            <Calendar className="h-4 w-4 mr-2" />
            <span>{schedule.label}</span>
          </div>
        </CardContent>
      </Card>
    );
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title={
          <span className="flex items-center gap-3">
            <Archive className="h-8 w-8 text-muted-foreground" />
            Archived Projects
          </span>
        }
        subtitle="Projects you've archived. You can restore them anytime."
        leading={
          <Link href="/projects">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-5 w-5" />
            </Button>
          </Link>
        }
      />

      {/* Archived Projects Grid */}
      <div className="space-y-4">
        {!archivedProjects || archivedProjects.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <Archive className="h-12 w-12 text-muted-foreground mb-4" />
              <p className="text-muted-foreground mb-4">No archived projects.</p>
              <Link href="/projects">
                <Button variant="outline">
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  Back to Projects
                </Button>
              </Link>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {archivedProjects.map((project) => renderProjectCard(project))}
          </div>
        )}
      </div>

      <DeleteConfirmDialog
        open={deleteToRubbishDialogOpen}
        onOpenChange={(open) => {
          setDeleteToRubbishDialogOpen(open);
          if (!open) {
            setDeleteToRubbishTargetId(null);
          }
        }}
        onConfirm={() => {
          if (!deleteToRubbishTargetId) return;
          moveProjectToTrashMutation.mutate({ projectId: deleteToRubbishTargetId });
        }}
        title="Delete"
        description={"Are you sure?\nYou can restore this later from the Rubbish."}
        confirmLabel="Delete"
        isDeleting={moveProjectToTrashMutation.isPending}
      />
    </div>
  );
}
