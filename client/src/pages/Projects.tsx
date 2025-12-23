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
import { Checkbox } from "@/components/ui/checkbox";
import { trpc, type RouterOutputs } from "@/lib/trpc";
import { Plus, MapPin, Calendar, Loader2, Building2, FolderOpen, Archive, Trash2 } from "lucide-react";
import { Link, useLocation } from "wouter";
import { useCallback, useEffect, useMemo, useState } from "react";
import { CreateProjectDialog } from "@/components/CreateProjectDialog";
import { ItemActionsMenu, ItemAction } from "@/components/ItemActionsMenu";
import { MultiSelectBar, createDeleteAction, createArchiveAction } from "@/components/MultiSelectBar";
import { toast } from "sonner";
import { formatProjectSchedule } from "@/lib/dateFormat";
import { DeleteConfirmDialog } from "@/components/DeleteConfirmDialog";
import { ScrollRevealFooter } from "@/components/ScrollRevealFooter";
import { useLongPress } from "@/hooks/useLongPress";
import { useSelectionMode } from "@/hooks/useSelectionMode";
import { cn } from "@/lib/utils";

type ProjectListItem = RouterOutputs["projects"]["list"][number];

export default function Projects() {
  const [location, setLocation] = useLocation();
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  
  const { data: activeProjects, isLoading: activeLoading } = trpc.projects.list.useQuery();
  const utils = trpc.useUtils();
  const [prefillClientId, setPrefillClientId] = useState<number | null>(null);

  // Multi-select state using the hook
  const {
    isSelectionMode,
    selectedIds,
    selectedCount,
    enterSelectionMode,
    exitSelectionMode,
    toggleSelection,
    isSelected,
    handleShiftClick,
  } = useSelectionMode<number>();

  // All project IDs for shift-click range selection
  const allProjectIds = useMemo(
    () => activeProjects?.map((p) => p.id) || [],
    [activeProjects]
  );

  // Delete confirmation dialogs
  const [deleteToRubbishDialogOpen, setDeleteToRubbishDialogOpen] = useState(false);
  const [deleteToRubbishTargetId, setDeleteToRubbishTargetId] = useState<number | null>(null);

  // Archive confirmation dialog
  const [archiveDialogOpen, setArchiveDialogOpen] = useState(false);
  const [archiveTargetId, setArchiveTargetId] = useState<number | null>(null);

  // Batch action dialogs
  const [batchDeleteDialogOpen, setBatchDeleteDialogOpen] = useState(false);

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
      case "archive":
        setArchiveTargetId(projectId);
        setArchiveDialogOpen(true);
        break;
      case "moveToTrash":
        setDeleteToRubbishTargetId(projectId);
        setDeleteToRubbishDialogOpen(true);
        break;
      case "select":
        enterSelectionMode(projectId);
        break;
    }
  };

  const handleDeleteToRubbish = (projectId: number) => {
    moveProjectToTrashMutation.mutate({ projectId });
  };

  // Batch action dialogs
  const [batchArchiveDialogOpen, setBatchArchiveDialogOpen] = useState(false);

  const handleBatchDelete = useCallback(() => {
    if (selectedCount === 0) return;
    setBatchDeleteDialogOpen(true);
  }, [selectedCount]);

  const handleBatchArchive = useCallback(() => {
    if (selectedCount === 0) return;
    setBatchArchiveDialogOpen(true);
  }, [selectedCount]);

  // Handle card click with shift-click support for range selection
  const handleCardClick = useCallback(
    (projectId: number, event: React.MouseEvent) => {
      if (!isSelectionMode) return;

      // Shift+Click for range selection (desktop)
      if (event.shiftKey) {
        handleShiftClick(projectId, allProjectIds);
      } else {
        toggleSelection(projectId);
      }
    },
    [isSelectionMode, handleShiftClick, allProjectIds, toggleSelection]
  );

  // Handle long-press to enter selection mode
  const handleLongPress = useCallback(
    (projectId: number) => {
      enterSelectionMode(projectId);
    },
    [enterSelectionMode]
  );

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
    const cardIsSelected = isSelected(project.id);
    const { contact, label: clientLabel } = resolveClientDisplay(project);
    const schedule = getScheduleInfo(project);

    // Long-press hook for entering selection mode
    const { handlers: longPressHandlers, isLongPressing } = useLongPress({
      duration: 350,
      onLongPress: () => handleLongPress(project.id),
      onClick: () => {
        // In selection mode, toggle selection
        // Otherwise, let the Link handle navigation
      },
      disabled: false,
    });

    // Handle card interaction
    const handleInteraction = (e: React.MouseEvent) => {
      if (isSelectionMode) {
        e.preventDefault();
        e.stopPropagation();
        handleCardClick(project.id, e);
      }
      // In normal mode, let the Link handle navigation
    };

    // Prevent navigation when in selection mode or long-pressing
    const shouldPreventNavigation = isSelectionMode || isLongPressing;

    return (
      <div
        key={project.id}
        className={cn(
          "relative no-select selectable-card",
          isSelectionMode && "selection-mode-active",
          cardIsSelected && "selected",
          isLongPressing && "long-pressing"
        )}
        {...longPressHandlers}
        onClick={handleInteraction}
        role={isSelectionMode ? "checkbox" : undefined}
        aria-checked={isSelectionMode ? cardIsSelected : undefined}
        aria-label={isSelectionMode ? `${project.name}, ${cardIsSelected ? "selected" : "not selected"}` : undefined}
      >
        {/* Selection checkbox - visible in selection mode */}
        <div 
          className={cn(
            "absolute top-4 left-4 z-20 selection-checkbox",
            isSelectionMode && "selection-mode-active"
          )}
        >
          <Checkbox
            checked={cardIsSelected}
            onCheckedChange={() => toggleSelection(project.id)}
            onClick={(e) => e.stopPropagation()}
            className="h-5 w-5 border-2 data-[state=checked]:bg-primary data-[state=checked]:border-primary"
            aria-hidden={!isSelectionMode}
          />
        </div>

        {shouldPreventNavigation ? (
          // When in selection mode or long-pressing, render without Link
          <Card
            className={cn(
              "transition-all cursor-pointer h-full",
              cardIsSelected && "border-primary"
            )}
          >
            <CardHeader className={cn(isSelectionMode && "pl-12")}>
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-2">
                  <Building2 className="h-5 w-5 text-muted-foreground" />
                  <CardTitle className="text-xl">{project.name}</CardTitle>
                </div>
                <div className="flex items-center gap-2">
                  <Badge className={getStatusColor(project.status)}>{project.status}</Badge>
                </div>
              </div>
              {clientLabel && (
                <CardDescription>
                  Client: {contact?.name || clientLabel}
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
        ) : (
          // Normal mode - render with Link for navigation
          <Link href={`/projects/${project.id}`}>
            <Card className="hover:shadow-lg transition-all cursor-pointer h-full">
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2">
                    <Building2 className="h-5 w-5 text-muted-foreground" />
                    <CardTitle className="text-xl">{project.name}</CardTitle>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge className={getStatusColor(project.status)}>{project.status}</Badge>
                    <ItemActionsMenu
                      onAction={(action) => handleItemAction(action, project.id)}
                      actions={["edit", "archive", "moveToTrash", "select"]}
                      triggerClassName="text-muted-foreground hover:text-foreground"
                    />
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
        )}
      </div>
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-regular">Projects</h1>
          <p className="text-muted-foreground text-sm">Manage your client projects and work</p>
        </div>
        <Button onClick={() => setCreateDialogOpen(true)}>
          <Plus className="h-4 w-4 mr-2" />
          New Project
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
                <Plus className="h-4 w-4 mr-2" />
                Create Project
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

      {isSelectionMode && (
        <MultiSelectBar
          selectedCount={selectedCount}
          onCancel={exitSelectionMode}
          actions={[
            createDeleteAction(handleBatchDelete, moveProjectToTrashMutation.isPending),
            createArchiveAction(handleBatchArchive, archiveProjectMutation.isPending),
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

      {/* Batch Delete Confirmation Dialog */}
      <DeleteConfirmDialog
        open={batchDeleteDialogOpen}
        onOpenChange={setBatchDeleteDialogOpen}
        onConfirm={() => {
          const ids = Array.from(selectedIds);
          ids.forEach((id) => {
            moveProjectToTrashMutation.mutate({ projectId: id });
          });
          exitSelectionMode();
        }}
        title="Delete Projects"
        description={`Delete ${selectedCount} project${selectedCount > 1 ? "s" : ""}? This cannot be undone.`}
        warning={selectedCount > 1 ? `You are about to delete ${selectedCount} projects and all their associated files.` : undefined}
        confirmLabel="Delete"
        isDeleting={moveProjectToTrashMutation.isPending}
      />

      {/* Batch Archive Confirmation Dialog */}
      <DeleteConfirmDialog
        open={batchArchiveDialogOpen}
        onOpenChange={setBatchArchiveDialogOpen}
        onConfirm={() => {
          const ids = Array.from(selectedIds);
          ids.forEach((id) => {
            archiveProjectMutation.mutate({ projectId: id });
          });
          exitSelectionMode();
        }}
        title="Archive Projects"
        description={`Archive ${selectedCount} project${selectedCount > 1 ? "s" : ""}? You can restore them anytime.`}
        confirmLabel="Archive"
        isDeleting={archiveProjectMutation.isPending}
      />
    </div>
  );
}
