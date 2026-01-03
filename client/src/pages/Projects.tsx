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
import { Plus, MapPin, Calendar, Loader2, Building2, FolderOpen, SlidersHorizontal } from "@/components/ui/Icon";
import { Link, useLocation } from "wouter";
import { useEffect, useState, useMemo } from "react";
import { ItemActionsMenu, ItemAction } from "@/components/ItemActionsMenu";
import { toast } from "sonner";
import { formatProjectSchedule } from "@/lib/dateFormat";
import { DeleteConfirmDialog } from "@/components/DeleteConfirmDialog";
import { PageHeader } from "@/components/PageHeader";
import { MultiSelectBar, createArchiveAction, createDeleteAction } from "@/components/MultiSelectBar";
import {
  Sheet,
  SheetContent,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type ProjectListItem = RouterOutputs["projects"]["list"][number];

type FilterState = {
  client: string;
  time: string; // "all" | "2024" | "2024-10" (year-month format)
  status: "active" | "archived" | "deleted" | "all";
};

const defaultFilters: FilterState = {
  client: "all",
  time: "all",
  status: "active",
};

const monthDisplayNames = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December"
];

export default function Projects() {
  const [location, setLocation] = useLocation();
  
  const { data: activeProjects, isLoading: activeLoading } = trpc.projects.list.useQuery();
  const { data: archivedProjects = [] } = trpc.projects.listArchived.useQuery();
  const { data: trashedProjects = [] } = trpc.projects.listTrashed.useQuery();
  const { data: contacts = [] } = trpc.contacts.list.useQuery();
  const utils = trpc.useUtils();
  
  // Combine all projects for filtering
  const allProjects = useMemo(() => {
    const active = (activeProjects || []).map(proj => ({ ...proj, _status: 'active' as const }));
    const archived = archivedProjects.map(proj => ({ ...proj, _status: 'archived' as const }));
    const trashed = trashedProjects.map(proj => ({ ...proj, _status: 'deleted' as const }));
    return [...active, ...archived, ...trashed];
  }, [activeProjects, archivedProjects, trashedProjects]);
  
  // Filter state
  const [filters, setFilters] = useState<FilterState>(defaultFilters);
  const [draftFilters, setDraftFilters] = useState<FilterState>(defaultFilters);
  const [isFilterOpen, setIsFilterOpen] = useState(false);

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

    if (shouldOpen === "1" || prefillParam) {
      // Navigate to new project page with prefill if needed
      const newPath = prefillParam 
        ? `/projects/new?prefillClientId=${prefillParam}`
        : "/projects/new";
      setLocation(newPath);
      
      // Clean up URL params
      url.searchParams.delete("openCreateProject");
      url.searchParams.delete("prefillClientId");
      const nextSearch = url.searchParams.toString();
      const nextHref = nextSearch ? `${url.pathname}?${nextSearch}${url.hash}` : `${url.pathname}${url.hash}`;
      window.history.replaceState(null, "", nextHref);
    }
  }, [location, setLocation]);

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
      toast.success("Deleted. You can restore this later from the Rubbish.");
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

  const duplicateProjectMutation = trpc.projects.duplicate.useMutation({
    onSuccess: () => {
      toast.success("Project duplicated");
      invalidateProjectLists();
    },
    onError: (error) => {
      toast.error(`Failed to duplicate project: ${error.message}`);
    },
  });

  const handleItemAction = (action: ItemAction, projectId: number) => {
    switch (action) {
      case "edit":
        window.location.href = `/projects/${projectId}`;
        break;
      case "duplicate":
        duplicateProjectMutation.mutate({ projectId });
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

  const handleSelectAll = () => {
    setSelectedIds(new Set(filteredProjects.map(p => p.id)));
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

  const handleBatchDuplicate = () => {
    if (selectedIds.size === 0) return;
    const ids = Array.from(selectedIds);
    ids.forEach((id) => {
      duplicateProjectMutation.mutate({ projectId: id });
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
  
  const revertFilters = () => {
    setFilters(defaultFilters);
    setDraftFilters(defaultFilters);
    setIsFilterOpen(false);
  };

  const applyFilters = () => {
    setFilters(draftFilters);
    setIsFilterOpen(false);
  };
  
  // Filter projects helper
  const filterProjects = (projects: typeof allProjects) => {
    return projects.filter((project) => {
      // Client filter
      const matchesClient =
        filters.client === "all" ||
        (filters.client === "unassigned"
          ? !project.clientId
          : project.clientId?.toString() === filters.client);

      // Time filter (based on createdAt or updatedAt) - supports "all", "2024" (year), or "2024-10" (year-month)
      const projectDate = project.createdAt ? new Date(project.createdAt) : (project.updatedAt ? new Date(project.updatedAt) : null);
      const matchesTime =
        filters.time === "all" ||
        (projectDate && (() => {
          const projectYear = projectDate.getFullYear();
          const projectMonth = projectDate.getMonth() + 1; // 1-12
          
          // If filter is just a year (e.g., "2024")
          if (/^\d{4}$/.test(filters.time)) {
            return projectYear === parseInt(filters.time, 10);
          }
          
          // If filter is year-month format (e.g., "2024-10")
          if (/^\d{4}-\d{1,2}$/.test(filters.time)) {
            const [filterYear, filterMonth] = filters.time.split("-").map(Number);
            return projectYear === filterYear && projectMonth === filterMonth;
          }
          
          return false;
        })());

      // Status filter
      const matchesStatus =
        filters.status === "all" ||
        (filters.status === "active" && project._status === "active") ||
        (filters.status === "archived" && project._status === "archived") ||
        (filters.status === "deleted" && project._status === "deleted");

      return matchesClient && matchesTime && matchesStatus;
    });
  };
  
  const filteredProjects = filterProjects(allProjects);
  
  useEffect(() => {
    if (isFilterOpen) {
      setDraftFilters(filters);
    }
  }, [isFilterOpen, filters]);

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

  const filterSlot = (
    <Sheet open={isFilterOpen} onOpenChange={setIsFilterOpen}>
      <SheetTrigger asChild>
        <Button variant="ghost" size="icon" aria-label="Filter projects">
          <SlidersHorizontal className="size-6" />
        </Button>
      </SheetTrigger>
      <SheetContent side="right" className="p-0">
        <SheetHeader>
          <SheetTitle>Filters</SheetTitle>
        </SheetHeader>
        <div className="px-4 pb-4 overflow-y-auto space-y-4 pt-4">
          {/* Client Filter */}
          <div className="space-y-2">
            <div className="text-sm font-medium">Client</div>
            <Select
              value={draftFilters.client}
              onValueChange={(value) =>
                setDraftFilters((prev) => ({ ...prev, client: value }))
              }
            >
              <SelectTrigger>
                <SelectValue placeholder="All clients" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Clients</SelectItem>
                <SelectItem value="unassigned">Unassigned</SelectItem>
                {contacts.length === 0 ? (
                  <div className="px-2 py-1.5 text-sm text-muted-foreground">
                    No contacts available
                  </div>
                ) : (
                  contacts.map((contact) => (
                    <SelectItem key={contact.id} value={contact.id.toString()}>
                      {contact.name || contact.clientName}
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
          </div>

          {/* Time Filter */}
          <div className="space-y-2">
            <div className="text-sm font-medium">Time</div>
            <Select
              value={draftFilters.time}
              onValueChange={(value) =>
                setDraftFilters((prev) => ({
                  ...prev,
                  time: value,
                }))
              }
            >
              <SelectTrigger>
                <SelectValue placeholder="Any time" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Any time</SelectItem>
                {/* Generate years (current year and 5 years back) */}
                {(() => {
                  const currentYear = new Date().getFullYear();
                  const years = [];
                  for (let year = currentYear; year >= currentYear - 5; year--) {
                    years.push(
                      <SelectItem key={year} value={year.toString()}>
                        {year}
                      </SelectItem>
                    );
                    // Add months for each year (January to December)
                    for (let month = 1; month <= 12; month++) {
                      const monthValue = `${year}-${month}`;
                      const monthName = monthDisplayNames[month - 1];
                      years.push(
                        <SelectItem key={monthValue} value={monthValue}>
                          {monthName} {year}
                        </SelectItem>
                      );
                    }
                  }
                  return years;
                })()}
              </SelectContent>
            </Select>
          </div>

          {/* Status Filter */}
          <div className="space-y-2">
            <div className="text-sm font-medium">Status</div>
            <Select
              value={draftFilters.status}
              onValueChange={(value) =>
                setDraftFilters((prev) => ({
                  ...prev,
                  status: value as FilterState["status"],
                }))
              }
            >
              <SelectTrigger>
                <SelectValue placeholder="All statuses" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All statuses</SelectItem>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="archived">Archived</SelectItem>
                <SelectItem value="deleted">Deleted</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <SheetFooter className="flex-row justify-end gap-2">
          <Button variant="outline" onClick={revertFilters}>
            Revert
          </Button>
          <Button onClick={applyFilters}>
            Apply
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title="Projects"
        subtitle="Manage your client projects and work"
        filterSlot={filterSlot}
      />

      {/* Top-of-Page Action Row */}
      <div className="flex items-center justify-end gap-2 pb-2 border-b">
        <Link href="/projects/new">
          <Button>
            <Plus className="h-4 w-4 mr-1" />
            New
          </Button>
        </Link>
      </div>

      {/* Projects Grid */}
      <div className="space-y-4">
        {filteredProjects.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <FolderOpen className="h-12 w-12 text-muted-foreground mb-4" />
              <p className="text-muted-foreground mb-4">
                {filters.status !== "active" || filters.client !== "all" || filters.time !== "all"
                  ? "No projects found matching your filters"
                  : "No projects yet. Create your first project to get started."}
              </p>
              {filters.status === "active" && filters.client === "all" && filters.time === "all" && (
                <Link href="/projects/new">
                  <Button>
                    <Plus className="h-4 w-4 mr-1" />
                    New
                  </Button>
                </Link>
              )}
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {filteredProjects.map((project) => (
              <ProjectCard key={project.id} project={project} />
            ))}
          </div>
        )}
      </div>

      {/* Multi-select bar */}
      {isMultiSelectMode && (
        <MultiSelectBar
          selectedCount={selectedIds.size}
          totalCount={filteredProjects.length}
          onSelectAll={handleSelectAll}
          onDuplicate={handleBatchDuplicate}
          onArchive={handleBatchArchive}
          onDelete={handleBatchDelete}
          onCancel={() => {
            setIsMultiSelectMode(false);
            setSelectedIds(new Set());
          }}
        />
      )}

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
        description={"Are you sure?\nYou can restore this later from the Rubbish."}
        confirmLabel="Delete"
        isDeleting={moveProjectToTrashMutation.isPending}
      />

    </div>
  );
}
