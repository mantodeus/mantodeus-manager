/**
 * Projects List Page
 * 
 * Displays all active projects for the current user with:
 * - Grid of project cards with multi-select support
 * - Long-press to enter selection mode (mobile-first)
 * - Tap to toggle selection when in selection mode
 * - Shift+Click for range selection on desktop
 * - Status badges
 * - Quick actions (edit, archive, delete)
 * - Create new project button
 * - Pull-down reveal for archived/rubbish navigation (Telegram-style)
 */

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { trpc, type RouterOutputs } from "@/lib/trpc";
import { Plus, MapPin, Calendar, Loader2, Building2, FolderOpen } from "@/components/ui/Icon";
import { Link, useLocation } from "wouter";
import { useEffect, useState } from "react";
import { CreateProjectDialog } from "@/components/CreateProjectDialog";
import { ItemActionsMenu, ItemAction } from "@/components/ItemActionsMenu";
import { toast } from "sonner";
import { formatProjectSchedule } from "@/lib/dateFormat";
import { DeleteConfirmDialog } from "@/components/DeleteConfirmDialog";
import { ScrollRevealFooter } from "@/components/ScrollRevealFooter";
import { PageHeader } from "@/components/PageHeader";
import { Checkbox } from "@/components/ui/checkbox";
import { MultiSelectBar, createArchiveAction, createDeleteAction } from "@/components/MultiSelectBar";

type ProjectListItem = RouterOutputs["projects"]["list"][number];

export default function Projects() {
  const [location, setLocation] = useLocation();
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  
  const { data: activeProjects, isLoading: activeLoading } = trpc.projects.list.useQuery();
  const utils = trpc.useUtils();
  const [prefillClientId, setPrefillClientId] = useState<number | null>(null);

  // Delete confirmation dialogs
  const [deleteToRubbishDialogOpen, setDeleteToRubbishDialogOpen] = useState(false);
  const [deleteToRubbishTargetId, setDeleteToRubbishTargetId] = useState<number | null>(null);

  // Archive confirmation dialog
  const [archiveDialogOpen, setArchiveDialogOpen] = useState(false);
  const [archiveTargetId, setArchiveTargetId] = useState<number | null>(null);

  // Multi-select state
  const [isMultiSelectMode, setIsMultiSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());

  useEffect(() => {
    const url = new URL(window.location.href);
    const shouldOpen = url.searchParams.get("openCreateProject");
    const prefillParam = url.searchParams.get("prefillClientId");

    if (prefillParam) {
      const parsed = parseInt(prefillParam, 10);
      if (!Number.isNaN(parsed)) {
        setPrefillClientId(parsed);
        setCreateDialogOpen(true);
      }
    } else if (shouldOpen === "1") {
      setCreateDialogOpen(true);
    }

    if (shouldOpen || prefillParam) {
      url.searchParams.delete("openCreateProject");
      url.searchParams.delete("prefillClientId");
      const nextSearch = url.searchParams.toString();
      const nextHref = nextSearch ? `${url.pathname}?${nextSearch}${url.hash}` : `${url.pathname}${url.hash}`;
      window.history.replaceState(null, "", nextHref);
    }
  }, [location]);

  const handlePrefillConsumed = () => setPrefillClientId(null);

  const handleRequestAddContact = () => {
    const currentUrl = new URL(window.location.href);
    currentUrl.searchParams.set("openCreateProject", "1");
    const returnToPath = currentUrl.searchParams.toString()
      ? `${currentUrl.pathname}?${currentUrl.searchParams.toString()}`
      : currentUrl.pathname;
    setCreateDialogOpen(false);
    setLocation(`/contacts?returnTo=${encodeURIComponent(returnToPath)}`);
  };

  const invalidateProjectLists = () => {
    utils.projects.list.invalidate();
    utils.projects.listArchived.invalidate();
    utils.projects.listTrashed.invalidate();
  };

  const archiveProjectMutation = trpc.projects.archiveProject.useMutation({
    onSuccess: () => {
      toast.success("Archived. You can restore this later.");
      invalidateProjectLists();
    },
    onError: (error) => {
      toast.error(`Failed to archive project: ${error.message}`);
    },
  });

  const moveProjectToTrashMutation = trpc.projects.moveProjectToTrash.useMutation({
    onSuccess: () => {
      toast.success("Deleted. You can restore this later from the Rubbish bin.");
      invalidateProjectLists();
    },
    onError: (error) => {
      toast.error(`Failed to delete: ${error.message}`);
    },
  });

  const getStatusColor = (status: string) => {
    switch (status) {
      case "active":
        return "bg-primary text-primary-foreground";
      case "planned":
        return "bg-secondary text-secondary-foreground";
      case "completed":
        return "bg-emerald-600 text-white";
      case "archived":
        return "bg-muted text-muted-foreground";
      default:
        return "bg-muted text-muted-foreground";
    }
  };

  const handleItemAction = (action: ItemAction, projectId: number) => {
    switch (action) {
      case "edit":
        window.location.href = `/projects/${projectId}`;
        break;
      case "duplicate":
        toast.info("Duplicate is coming soon.");
        break;
      case "select":
        setIsMultiSelectMode(true);
        toggleSelection(projectId); // Pre-select the current item
        break;
      case "archive":
        setArchiveTargetId(projectId);
        setArchiveDialogOpen(true);
        break;
      case "delete":
        setDeleteToRubbishTargetId(projectId);
        setDeleteToRubbishDialogOpen(true);
        break;
    }
  };

  const toggleSelection = (projectId: number) => {
    const newSelected = new Set(selectedIds);
    if (newSelected.has(projectId)) {
      newSelected.delete(projectId);
    } else {
      newSelected.add(projectId);
    }
    setSelectedIds(newSelected);
  };

  const handleBatchArchive = () => {
    if (selectedIds.size === 0) return;
    const ids = Array.from(selectedIds);
    ids.forEach((id) => {
      archiveProjectMutation.mutate({ projectId: id });
    });
    setSelectedIds(new Set());
    setIsMultiSelectMode(false);
  };

  const handleBatchDelete = () => {
    if (selectedIds.size === 0) return;
    const ids = Array.from(selectedIds);
    ids.forEach((id) => {
      moveProjectToTrashMutation.mutate({ projectId: id });
    });
    setSelectedIds(new Set());
    setIsMultiSelectMode(false);
  };

  const handleDeleteToRubbish = (projectId: number) => {
    moveProjectToTrashMutation.mutate({ projectId });
  };

  const getScheduleInfo = (project: ProjectListItem) =>
    formatProjectSchedule({
      dates: project.scheduledDates,
      start: project.startDate,
      end: project.endDate,
    });

  const handleDateClick = (project: ProjectListItem) => {
    const { primaryDate } = getScheduleInfo(project);
    if (!primaryDate) return;
    const url = new URL("/calendar", window.location.origin);
    url.searchParams.set("focusDate", primaryDate.toISOString());
    url.searchParams.set("highlightProjectId", project.id.toString());
    setLocation(url.pathname + url.search);
  };

  const handleAddressClick = (project: ProjectListItem) => {
    if (project.clientId && project.clientContact?.latitude && project.clientContact.longitude) {
      setLocation(`/maps?contactId=${project.clientId}`);
      return;
    }
    if (project.address) {
      setLocation(`/maps?address=${encodeURIComponent(project.address)}`);
    }
  };

  const handleContactClick = (contactId: number) => {
    setLocation(`/contacts?contactId=${contactId}`);
  };

  const resolveClientDisplay = (project: ProjectListItem) => {
    const contact = project.clientContact ?? null;
    const label = contact?.name || project.client || null;
    return { contact, label };
  };

  if (activeLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  // Project Card component with long-press and selection support
  const ProjectCard = ({ project }: { project: ProjectListItem }) => {
    const { contact, label: clientLabel } = resolveClientDisplay(project);
    const schedule = getScheduleInfo(project);

    const handleCardClick = () => {
      if (isMultiSelectMode) {
        toggleSelection(project.id);
      }
    };

    return (
      <div
        onClick={handleCardClick}
        className={`${isMultiSelectMode ? "cursor-pointer" : ""} ${selectedIds.has(project.id) ? "item-selected" : ""}`}
      >
        <Link href={isMultiSelectMode ? "#" : `/projects/${project.id}`} onClick={(e) => isMultiSelectMode && e.preventDefault()}>
          <Card className="hover:shadow-lg transition-all h-full">
            <CardHeader>
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-2">
                  {isMultiSelectMode && (
                    <Checkbox
                      checked={selectedIds.has(project.id)}
                      onCheckedChange={() => toggleSelection(project.id)}
                      onClick={(e) => e.stopPropagation()}
                      className="mr-2"
                    />
                  )}
                  <Building2 className="h-5 w-5 text-muted-foreground" />
                  <CardTitle className="text-xl">{project.name}</CardTitle>
                </div>
                <div className="flex items-center gap-2">
                  <Badge className={getStatusColor(project.status)}>{project.status}</Badge>
                  {!isMultiSelectMode && (
                    <ItemActionsMenu
                      onAction={(action) => handleItemAction(action, project.id)}
                      actions={["edit", "select", "duplicate", "archive", "delete"]}
                      triggerClassName="text-muted-foreground hover:text-foreground"
                    />
                  )}
                </div>
              </div>
            {clientLabel && (
              <CardDescription>
                Client:{" "}
                {contact ? (
                  <button
                    type="button"
                    className="underline decoration-dotted hover:text-primary transition-colors"
                    onClick={(event) => {
                      event.preventDefault();
                      event.stopPropagation();
                      handleContactClick(contact.id);
                    }}
                  >
                    {contact.name}
                  </button>
                ) : (
                  clientLabel
                )}
              </CardDescription>
            )}
            {project.description && (
              <CardDescription className="line-clamp-2">{project.description}</CardDescription>
            )}
          </CardHeader>
          <CardContent className="space-y-2">
            {project.address && (
              <button
                type="button"
                className="flex items-center text-sm text-muted-foreground hover:text-primary transition-colors w-full text-left"
                onClick={(event) => {
                  event.preventDefault();
                  event.stopPropagation();
                  handleAddressClick(project);
                }}
              >
                <MapPin className="h-4 w-4 mr-2" />
                <span className="truncate underline decoration-dotted">{project.address}</span>
              </button>
            )}
            <button
              type="button"
              className={`flex items-center text-sm w-full text-left transition-colors ${
                schedule.primaryDate
                  ? "text-muted-foreground hover:text-primary"
                  : "text-muted-foreground opacity-70 cursor-default"
              }`}
              disabled={!schedule.primaryDate}
              onClick={(event) => {
                event.preventDefault();
                event.stopPropagation();
                handleDateClick(project);
              }}
            >
              <Calendar className="h-4 w-4 mr-2" />
              <span>{schedule.label}</span>
            </button>
          </CardContent>
        </Card>
      </Link>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Projects"
        subtitle="Manage your client projects and work"
      />

      {/* Top-of-Page Action Row */}
      <div className="flex items-center justify-end gap-2 pb-2 border-b">
        <Button onClick={() => setCreateDialogOpen(true)}>
          <Plus className="h-4 w-4 mr-1" />
          New
        </Button>
      </div>

      {/* Active Projects Grid */}
      <div className="space-y-4">
        {activeProjects && activeProjects.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <FolderOpen className="h-12 w-12 text-muted-foreground mb-4" />
              <p className="text-muted-foreground mb-4">No projects yet. Create your first project to get started.</p>
              <Button onClick={() => setCreateDialogOpen(true)}>
                <Plus className="h-4 w-4 mr-1" />
                New
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {activeProjects?.map((project) => (
              <ProjectCard key={project.id} project={project} />
            ))}
          </div>
        )}
      </div>

      {/* Scroll-reveal footer for Archived/Rubbish navigation */}
      <ScrollRevealFooter basePath="/projects" />

      {/* Multi-select bar */}
      {isMultiSelectMode && (
        <MultiSelectBar
          selectedCount={selectedIds.size}
          onCancel={() => {
            setIsMultiSelectMode(false);
            setSelectedIds(new Set());
          }}
          actions={[
            createArchiveAction(handleBatchArchive, archiveProjectMutation.isPending),
            createDeleteAction(handleBatchDelete, moveProjectToTrashMutation.isPending),
          ]}
        />
      )}

      <CreateProjectDialog
        open={createDialogOpen}
        onOpenChange={setCreateDialogOpen}
        prefillClientId={prefillClientId ?? undefined}
        onPrefillConsumed={handlePrefillConsumed}
        onRequestAddContact={handleRequestAddContact}
      />

      {/* Archive Confirmation Dialog */}
      <DeleteConfirmDialog
        open={archiveDialogOpen}
        onOpenChange={(open) => {
          setArchiveDialogOpen(open);
          if (!open) {
            setArchiveTargetId(null);
          }
        }}
        onConfirm={() => {
          if (!archiveTargetId) return;
          archiveProjectMutation.mutate({ projectId: archiveTargetId });
        }}
        title="Archive"
        description="Archive this project? You can restore it anytime from the archived view."
        confirmLabel="Archive"
        isDeleting={archiveProjectMutation.isPending}
      />

      {/* Delete (Move to Rubbish) Confirmation Dialog */}
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
          handleDeleteToRubbish(deleteToRubbishTargetId);
        }}
        title="Delete"
        description={"Are you sure?\nYou can restore this later from the Rubbish bin."}
        confirmLabel="Delete"
        isDeleting={moveProjectToTrashMutation.isPending}
      />

    </div>
  );
}
