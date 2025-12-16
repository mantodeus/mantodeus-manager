/**
 * Projects List Page
 * 
 * Displays all active projects for the current user with:
 * - Grid of project cards
 * - Status badges
 * - Quick actions (edit, archive, delete)
 * - Create new project button
 * - Pull-down reveal for archived/rubbish navigation (Telegram-style)
 */

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { trpc, type RouterOutputs } from "@/lib/trpc";
import { Plus, MapPin, Calendar, Loader2, Building2, FolderOpen, Archive } from "lucide-react";
import { Link, useLocation } from "wouter";
import { useEffect, useState } from "react";
import { CreateProjectDialog } from "@/components/CreateProjectDialog";
import { ItemActionsMenu, ItemAction } from "@/components/ItemActionsMenu";
import { MultiSelectBar } from "@/components/MultiSelectBar";
import { toast } from "sonner";
import { formatProjectSchedule } from "@/lib/dateFormat";
import { DeleteConfirmDialog } from "@/components/DeleteConfirmDialog";
import { ScrollRevealFooter } from "@/components/ScrollRevealFooter";

type ProjectListItem = RouterOutputs["projects"]["list"][number];

export default function Projects() {
  const [location, setLocation] = useLocation();
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  
  const { data: activeProjects, isLoading: activeLoading } = trpc.projects.list.useQuery();
  const utils = trpc.useUtils();
  const [prefillClientId, setPrefillClientId] = useState<number | null>(null);

  // Multi-select state
  const [isMultiSelectMode, setIsMultiSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());

  // Delete confirmation dialogs
  const [deleteToRubbishDialogOpen, setDeleteToRubbishDialogOpen] = useState(false);
  const [deleteToRubbishTargetId, setDeleteToRubbishTargetId] = useState<number | null>(null);

  // Archive confirmation dialog
  const [archiveDialogOpen, setArchiveDialogOpen] = useState(false);
  const [archiveTargetId, setArchiveTargetId] = useState<number | null>(null);

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
        setIsMultiSelectMode(true);
        setSelectedIds(new Set([projectId]));
        break;
    }
  };

  const handleDeleteToRubbish = (projectId: number) => {
    moveProjectToTrashMutation.mutate({ projectId });
  };

  // Batch archive dialog
  const [batchArchiveDialogOpen, setBatchArchiveDialogOpen] = useState(false);

  const handleBatchArchive = () => {
    if (selectedIds.size === 0) return;
    setBatchArchiveDialogOpen(true);
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

  const renderProjectCard = (project: ProjectListItem) => {
    const isSelected = selectedIds.has(project.id);
    const { contact, label: clientLabel } = resolveClientDisplay(project);
    const schedule = getScheduleInfo(project);

    return (
      <div
        key={project.id}
        className="relative no-select"
        onClick={(e) => {
          if (isMultiSelectMode) {
            e.preventDefault();
            toggleSelection(project.id);
          }
        }}
      >
        {isMultiSelectMode && (
          <div className="absolute top-2 left-2 z-10">
            <input
              type="checkbox"
              checked={isSelected}
              onChange={() => toggleSelection(project.id)}
              className="h-5 w-5 rounded border-2 border-primary accent-primary"
            />
          </div>
        )}
        <Link href={`/projects/${project.id}`}>
          <Card
            className={`hover:shadow-lg transition-all cursor-pointer h-full ${
              isSelected ? "ring-2 ring-primary" : ""
            }`}
          >
            <CardHeader>
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-2">
                  <Building2 className="h-5 w-5 text-muted-foreground" />
                  <CardTitle className="text-xl">{project.name}</CardTitle>
                </div>
                <div className="flex items-center gap-2">
                  <Badge className={getStatusColor(project.status)}>{project.status}</Badge>
                  {!isMultiSelectMode && (
                    <ItemActionsMenu
                      onAction={(action) => handleItemAction(action, project.id)}
                      actions={["edit", "archive", "moveToTrash", "select"]}
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
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Projects</h1>
          <p className="text-muted-foreground">Manage your client projects and work</p>
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
            {activeProjects?.map((project) => renderProjectCard(project))}
          </div>
        )}
      </div>

      {/* Scroll-reveal footer for Archived/Rubbish navigation */}
      <ScrollRevealFooter basePath="/projects" />

      {isMultiSelectMode && (
        <MultiSelectBar
          selectedCount={selectedIds.size}
          onCancel={() => {
            setIsMultiSelectMode(false);
            setSelectedIds(new Set());
          }}
          onPrimaryAction={handleBatchArchive}
          primaryLabel="Archive"
          primaryIcon={Archive}
          primaryVariant="outline"
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

      {/* Batch Archive Confirmation Dialog */}
      <DeleteConfirmDialog
        open={batchArchiveDialogOpen}
        onOpenChange={setBatchArchiveDialogOpen}
        onConfirm={() => {
          selectedIds.forEach((id) => {
            archiveProjectMutation.mutate({ projectId: id });
          });
          setSelectedIds(new Set());
          setIsMultiSelectMode(false);
        }}
        title="Archive"
        description={`Archive ${selectedIds.size} project${selectedIds.size > 1 ? "s" : ""}? You can restore them anytime.`}
        confirmLabel="Archive"
        isDeleting={archiveProjectMutation.isPending}
      />
    </div>
  );
}
