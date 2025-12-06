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
import { trpc } from "@/lib/trpc";
import { Plus, MapPin, Calendar, Loader2, Building2, FolderOpen } from "lucide-react";
import { Link, useLocation } from "wouter";
import { useEffect, useMemo, useState } from "react";
import { CreateProjectDialog } from "@/components/CreateProjectDialog";
import { ItemActionsMenu, ItemAction } from "@/components/ItemActionsMenu";
import { MultiSelectBar } from "@/components/MultiSelectBar";
import { toast } from "sonner";
import { formatProjectSchedule } from "@/lib/dateFormat";

export default function Projects() {
  const [location, setLocation] = useLocation();
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const { data: projects, isLoading } = trpc.projects.list.useQuery();
  const { data: contacts = [] } = trpc.contacts.list.useQuery();
  const contactMap = useMemo(() => {
    return new Map(contacts.map((contact) => [contact.id, contact]));
  }, [contacts]);
  const [prefillClientId, setPrefillClientId] = useState<number | null>(null);

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

  const archiveProjectMutation = trpc.projects.archive.useMutation({
    onSuccess: () => {
      toast.success("Project archived successfully");
      trpc.useUtils().projects.list.invalidate();
    },
    onError: (error) => {
      toast.error(`Failed to archive project: ${error.message}`);
    },
  });

  const deleteProjectMutation = trpc.projects.delete.useMutation({
    onSuccess: () => {
      toast.success("Project deleted successfully");
      trpc.useUtils().projects.list.invalidate();
    },
    onError: (error) => {
      toast.error(`Failed to delete project: ${error.message}`);
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
      case "delete":
        handleArchiveProject(projectId);
        break;
      case "select":
        setIsMultiSelectMode(true);
        setSelectedIds(new Set([projectId]));
        break;
    }
  };

  const handleArchiveProject = (projectId: number) => {
    if (confirm("Are you sure you want to archive this project? You can still view it in archived projects.")) {
      archiveProjectMutation.mutate({ id: projectId });
    }
  };

  const handleBatchArchive = () => {
    if (selectedIds.size === 0) return;
    
    const count = selectedIds.size;
    if (confirm(`Are you sure you want to archive ${count} project${count > 1 ? 's' : ''}?`)) {
      selectedIds.forEach((id) => {
        archiveProjectMutation.mutate({ id });
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

  const getScheduleInfo = (project: any) =>
    formatProjectSchedule({
      dates: project.scheduledDates,
      start: project.startDate,
      end: project.endDate,
    });

  const handleDateClick = (project: any) => {
    const { primaryDate } = getScheduleInfo(project);
    if (!primaryDate) return;
    const url = new URL("/calendar", window.location.origin);
    url.searchParams.set("focusDate", primaryDate.toISOString());
    url.searchParams.set("highlightProjectId", project.id.toString());
    setLocation(url.pathname + url.search);
  };

  const handleAddressClick = (project: any) => {
    if (project.clientId) {
      const contact = contactMap.get(project.clientId);
      if (contact?.latitude && contact?.longitude) {
        setLocation(`/maps?contactId=${project.clientId}`);
        return;
      }
    }
    if (project.address) {
      setLocation(`/maps?address=${encodeURIComponent(project.address)}`);
    }
  };

  const handleContactClick = (contactId: number) => {
    setLocation(`/contacts?contactId=${contactId}`);
  };

  const resolveClientDisplay = (project: any) => {
    const contact = project.clientId ? contactMap.get(project.clientId) : null;
    const label = contact?.name || project.client || null;
    return { contact, label };
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

      {projects && projects.length === 0 ? (
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
          {projects?.map((project) => {
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
                      isSelected ? 'ring-2 ring-primary' : ''
                    }`}
                  >
                    <CardHeader>
                      <div className="flex items-start justify-between">
                        <div className="flex items-center gap-2">
                          <Building2 className="h-5 w-5 text-muted-foreground" />
                          <CardTitle className="text-xl">{project.name}</CardTitle>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge className={getStatusColor(project.status)}>
                            {project.status}
                          </Badge>
                          {!isMultiSelectMode && (
                            <ItemActionsMenu
                              onAction={(action) => handleItemAction(action, project.id)}
                              actions={["edit", "delete", "select"]}
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

      {isMultiSelectMode && (
        <MultiSelectBar
          selectedCount={selectedIds.size}
          onCancel={() => {
            setIsMultiSelectMode(false);
            setSelectedIds(new Set());
          }}
          onDelete={handleBatchArchive}
        />
      )}

      <CreateProjectDialog
        open={createDialogOpen}
        onOpenChange={setCreateDialogOpen}
        prefillClientId={prefillClientId ?? undefined}
        onPrefillConsumed={handlePrefillConsumed}
        onRequestAddContact={handleRequestAddContact}
      />
    </div>
  );
}
