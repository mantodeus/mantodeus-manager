/**
 * Projects List Page
 * 
 * Displays all projects for the current user with:
 * - Grid of project cards
 * - Status badges
 * - Quick actions (edit, delete)
 * - Create new project button
 */

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { trpc, type RouterOutputs } from "@/lib/trpc";
import { Plus, MapPin, Calendar, Loader2, Building2, FolderOpen, Archive, Trash2, RotateCcw } from "lucide-react";
import { Link, useLocation } from "wouter";
import { useEffect, useState } from "react";
import { CreateProjectDialog } from "@/components/CreateProjectDialog";
import { ItemActionsMenu, ItemAction } from "@/components/ItemActionsMenu";
import { MultiSelectBar } from "@/components/MultiSelectBar";
import { toast } from "sonner";
import { formatProjectSchedule } from "@/lib/dateFormat";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DeleteConfirmDialog } from "@/components/DeleteConfirmDialog";

type ProjectListItem = RouterOutputs["projects"]["list"][number];

export default function Projects() {
  const [location, setLocation] = useLocation();
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [view, setView] = useState<"active" | "archived" | "trash">("active");
  const { data: activeProjects, isLoading: activeLoading } = trpc.projects.list.useQuery();
  const { data: archivedProjects, isLoading: archivedLoading } = trpc.projects.listArchived.useQuery(undefined, {
    enabled: view === "archived",
  });
  const { data: trashedProjects, isLoading: trashedLoading } = trpc.projects.listTrashed.useQuery(undefined, {
    enabled: view === "trash",
  });
  const utils = trpc.useUtils();
  const [prefillClientId, setPrefillClientId] = useState<number | null>(null);

  // Multi-select state
  const [isMultiSelectMode, setIsMultiSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());

  // Permanent delete dialog (Trash only)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleteConfirmValue, setDeleteConfirmValue] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<ProjectListItem | null>(null);

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
      toast.success("Moved to Trash. Items in Trash can be restored.");
      invalidateProjectLists();
    },
    onError: (error) => {
      toast.error(`Failed to move to Trash: ${error.message}`);
    },
  });

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
      setDeleteDialogOpen(false);
      setDeleteTarget(null);
      setDeleteConfirmValue("");
    },
    onError: (error) => {
      toast.error(`Failed to delete project permanently: ${error.message}`);
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

  const formatDate = (date: Date | null) => {
    if (!date) return "Not set";
    return new Date(date).toLocaleDateString();
  };

  const handleItemAction = (action: ItemAction, projectId: number) => {
    switch (action) {
      case "edit":
        window.location.href = `/projects/${projectId}`;
        break;
      case "archive":
        handleArchiveProject(projectId);
        break;
      case "restore":
        handleRestoreProject(projectId);
        break;
      case "moveToTrash":
        handleMoveToTrash(projectId);
        break;
      case "deletePermanently":
        handleDeletePermanently(projectId);
        break;
      case "select":
        setIsMultiSelectMode(true);
        setSelectedIds(new Set([projectId]));
        break;
    }
  };

  const handleArchiveProject = (projectId: number) => {
    if (confirm("Archive this project? You can restore this later.")) {
      archiveProjectMutation.mutate({ projectId });
    }
  };

  const handleRestoreProject = (projectId: number) => {
    restoreArchivedProjectMutation.mutate({ projectId });
  };

  const handleMoveToTrash = (projectId: number) => {
    if (confirm("Move this project to Trash? Items in Trash can be restored.")) {
      moveProjectToTrashMutation.mutate({ projectId });
    }
  };

  const handleRestoreFromTrash = (projectId: number) => {
    restoreProjectFromTrashMutation.mutate({ projectId });
  };

  const handleDeletePermanently = (projectId: number) => {
    const project = (trashedProjects ?? []).find((p) => p.id === projectId) ?? null;
    if (!project) return;
    setDeleteTarget(project);
    setDeleteConfirmValue("");
    setDeleteDialogOpen(true);
  };

  const handleBatchArchive = () => {
    if (selectedIds.size === 0) return;
    
    const count = selectedIds.size;
    if (confirm(`Archive ${count} project${count > 1 ? "s" : ""}? You can restore this later.`)) {
      selectedIds.forEach((id) => {
        archiveProjectMutation.mutate({ projectId: id });
      });
      setSelectedIds(new Set());
      setIsMultiSelectMode(false);
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

  const isLoading = view === "active" ? activeLoading : view === "archived" ? archivedLoading : trashedLoading;
  const projects = view === "active" ? activeProjects : view === "archived" ? archivedProjects : trashedProjects;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Projects</h1>
          <p className="text-muted-foreground">Manage your client projects and work</p>
        </div>
        {view !== "trash" && (
          <Button onClick={() => setCreateDialogOpen(true)}>
            <Plus className="h-4 w-4 mr-2" />
            New Project
          </Button>
        )}
      </div>

      <Tabs value={view} onValueChange={(value) => {
        setIsMultiSelectMode(false);
        setSelectedIds(new Set());
        setView(value as "active" | "archived" | "trash");
      }}>
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="active">Active</TabsTrigger>
          <TabsTrigger value="archived">Archived</TabsTrigger>
          <TabsTrigger value="trash">Trash</TabsTrigger>
        </TabsList>

        <TabsContent value="active" className="space-y-4">
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
              {activeProjects?.map((project) => {
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
              })}
            </div>
          )}
        </TabsContent>

        <TabsContent value="archived" className="space-y-4">
          <p className="text-sm text-muted-foreground">You can restore this later.</p>
          {archivedProjects && archivedProjects.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12">
                <Archive className="h-12 w-12 text-muted-foreground mb-4" />
                <p className="text-muted-foreground">No archived projects.</p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {archivedProjects?.map((project) => {
                const { contact, label: clientLabel } = resolveClientDisplay(project);
                const schedule = getScheduleInfo(project);

                return (
                  <Link key={project.id} href={`/projects/${project.id}`}>
                    <Card className="hover:shadow-lg transition-all cursor-pointer h-full">
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
                              actions={["restore", "moveToTrash"]}
                              triggerClassName="text-muted-foreground hover:text-foreground"
                            />
                          </div>
                        </div>
                        {clientLabel && (
                          <CardDescription>Client: {contact?.name ?? clientLabel}</CardDescription>
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
                  </Link>
                );
              })}
            </div>
          )}
        </TabsContent>

        <TabsContent value="trash" className="space-y-4">
          <p className="text-sm text-muted-foreground">Items in Trash can be restored.</p>
          {trashedProjects && trashedProjects.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12">
                <Trash2 className="h-12 w-12 text-muted-foreground mb-4" />
                <p className="text-muted-foreground">Trash is empty.</p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {trashedProjects?.map((project) => (
                <Card key={project.id}>
                  <CardContent className="flex items-center justify-between py-4">
                    <div className="min-w-0">
                      <div className="font-medium truncate">{project.name}</div>
                      <div className="text-sm text-muted-foreground">
                        Trashed{" "}
                        {project.trashedAt ? new Date(project.trashedAt).toLocaleDateString() : "—"}
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        onClick={() => handleRestoreFromTrash(project.id)}
                        disabled={restoreProjectFromTrashMutation.isPending}
                        className="gap-2"
                      >
                        <RotateCcw className="h-4 w-4" />
                        Restore
                      </Button>
                      <Button
                        variant="destructive"
                        onClick={() => handleDeletePermanently(project.id)}
                        className="gap-2"
                      >
                        <Trash2 className="h-4 w-4" />
                        Delete permanently
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>

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

      <DeleteConfirmDialog
        open={deleteDialogOpen}
        onOpenChange={(open) => {
          setDeleteDialogOpen(open);
          if (!open) {
            setDeleteTarget(null);
            setDeleteConfirmValue("");
          }
        }}
        onConfirm={() => {
          if (!deleteTarget) return;
          deleteProjectPermanentlyMutation.mutate({ projectId: deleteTarget.id });
        }}
        title="Delete project permanently"
        description="This action cannot be undone."
        warning="This will permanently delete the project and all related data."
        requireTypeToConfirm={deleteTarget?.name ?? ""}
        confirmValue={deleteConfirmValue}
        onConfirmValueChange={setDeleteConfirmValue}
        confirmLabel="Delete permanently"
        isDeleting={deleteProjectPermanentlyMutation.isPending}
      />
    </div>
  );
}
