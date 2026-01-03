/**
 * Notes List Page
 * 
 * Displays all active notes for the current user.
 * Pull-down reveal provides navigation to archived/rubbish views.
 */

import { useEffect, useRef, useState } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
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
import { toast } from "sonner";
import { Plus, Search, Tag, FileText, Loader2, SlidersHorizontal, X } from "@/components/ui/Icon";
import { ItemActionsMenu, ItemAction } from "@/components/ItemActionsMenu";
import { MultiSelectBar } from "@/components/MultiSelectBar";
import { DeleteConfirmDialog } from "@/components/DeleteConfirmDialog";
import { ScrollRevealFooter } from "@/components/ScrollRevealFooter";
import { PageHeader } from "@/components/PageHeader";
import { Markdown } from "@/components/Markdown";
import { useIsMobile } from "@/hooks/useMobile";

type Note = {
  id: number;
  title: string;
  content: string | null;
  tags: string | null;
  jobId: number | null;
  contactId: number | null;
  createdBy: number;
  createdAt: Date;
  updatedAt: Date;
  archivedAt?: Date | null;
  trashedAt?: Date | null;
  fileCount?: number | null;
};

type FilterState = {
  project: string;
  contact: string;
  time: "all" | "week" | "month" | "year";
};

const defaultFilters: FilterState = {
  project: "all",
  contact: "all",
  time: "all",
};

export default function Notes() {
  const { user } = useAuth();
  const [, navigate] = useLocation();
  const isMobile = useIsMobile();
  const [searchQuery, setSearchQuery] = useState("");
  const [searchDraft, setSearchDraft] = useState("");
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);

  const [filters, setFilters] = useState<FilterState>(defaultFilters);
  const [draftFilters, setDraftFilters] = useState<FilterState>(defaultFilters);
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  
  // Multi-select state
  const [isMultiSelectMode, setIsMultiSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());

  // Confirmation dialogs
  const [archiveDialogOpen, setArchiveDialogOpen] = useState(false);
  const [archiveTargetId, setArchiveTargetId] = useState<number | null>(null);
  const [deleteToRubbishDialogOpen, setDeleteToRubbishDialogOpen] = useState(false);
  const [deleteToRubbishTargetId, setDeleteToRubbishTargetId] = useState<number | null>(null);
  const [batchDeleteDialogOpen, setBatchDeleteDialogOpen] = useState(false);
  const [batchArchiveDialogOpen, setBatchArchiveDialogOpen] = useState(false);

  // Queries
  const utils = trpc.useUtils();
  const { data: activeNotes = [], isLoading: activeLoading } = trpc.notes.list.useQuery();
  const { data: contacts = [] } = trpc.contacts.list.useQuery();
  const { data: projects = [] } = trpc.projects.list.useQuery();

  // Auto-focus search input on mobile when search opens
  useEffect(() => {
    if (isSearchOpen && isMobile) {
      // Small delay to ensure overlay is rendered
      const timer = setTimeout(() => {
        searchInputRef.current?.focus();
        // Force mobile keyboard to open
        if (searchInputRef.current) {
          searchInputRef.current.click();
        }
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [isSearchOpen, isMobile]);

  useEffect(() => {
    if (isFilterOpen) {
      setDraftFilters(filters);
    }
  }, [isFilterOpen, filters]);

  const archiveNoteMutation = trpc.notes.archive.useMutation({
    onSuccess: () => {
      toast.success("Archived. You can restore this later.");
      invalidateNoteLists();
    },
    onError: (error) => {
      toast.error(`Failed to archive note: ${error.message}`);
    },
  });

  const deleteToRubbishMutation = trpc.notes.delete.useMutation({
    onSuccess: () => {
      toast.success("Deleted. You can restore this later from the Rubbish bin.");
      invalidateNoteLists();
    },
    onError: (error) => {
      toast.error(`Failed to delete note: ${error.message}`);
    },
  });
  const duplicateNoteMutation = trpc.notes.duplicate.useMutation({
    onSuccess: () => {
      toast.success("Note duplicated");
      invalidateNoteLists();
    },
    onError: (error) => {
      toast.error(`Failed to duplicate note: ${error.message}`);
    },
  });

  const invalidateNoteLists = () => {
    utils.notes.list.invalidate();
    utils.notes.listArchived.invalidate();
    utils.notes.listTrashed.invalidate();
  };

  const handleBatchDelete = () => {
    if (selectedIds.size === 0) return;
    setBatchDeleteDialogOpen(true);
  };

  const handleBatchArchive = () => {
    if (selectedIds.size === 0) return;
    setBatchArchiveDialogOpen(true);
  };

  const handleItemAction = (action: ItemAction, noteId: number) => {
    const note = activeNotes.find((n) => n.id === noteId);
    if (!note) return;

    switch (action) {
      case "edit":
        navigate(`/notes/${note.id}`);
        break;
      case "duplicate":
        duplicateNoteMutation.mutate({ id: noteId });
        break;
      case "select":
        setIsMultiSelectMode(true);
        setSelectedIds(new Set([noteId]));
        break;
      case "archive":
        setArchiveTargetId(noteId);
        setArchiveDialogOpen(true);
        break;
      case "delete":
        setDeleteToRubbishTargetId(noteId);
        setDeleteToRubbishDialogOpen(true);
        break;
    }
  };

  const handleSelectAll = () => {
    setSelectedIds(new Set(activeNotes.map(n => n.id)));
  };

  const handleBatchDuplicate = () => {
    if (selectedIds.size === 0) return;
    const ids = Array.from(selectedIds);
    ids.forEach((id) => {
      duplicateNoteMutation.mutate({ id });
    });
    setSelectedIds(new Set());
    setIsMultiSelectMode(false);
  };

  const toggleSelection = (noteId: number) => {
    const newSelected = new Set(selectedIds);
    if (newSelected.has(noteId)) {
      newSelected.delete(noteId);
    } else {
      newSelected.add(noteId);
    }
    setSelectedIds(newSelected);
  };

  const applySearch = () => {
    setSearchQuery(searchDraft.trim());
    setIsSearchOpen(false);
  };

  const clearSearch = () => {
    setSearchDraft("");
    setSearchQuery("");
    setIsSearchOpen(false);
  };

  const clearDraftFilters = () => {
    setDraftFilters(defaultFilters);
  };

  const applyFilters = () => {
    setFilters(draftFilters);
    setIsFilterOpen(false);
  };

  // Get project for a note (through job -> projectJob relationship)
  // Note: Since notes reference old jobs table, we'll need to match through projectJobs
  // For now, we'll check if the note's jobId matches any projectJob
  const getNoteProject = (note: Note) => {
    // Notes are linked to old jobs, not projectJobs directly
    // For now, we can't reliably match notes to projects without additional data
    // This will be improved when notes are migrated to use projectId directly
    return null;
  };

  // Get client name for a note (through project or contact)
  const getNoteClient = (note: Note) => {
    const project = getNoteProject(note);
    if (project?.client) return project.client;
    if (project?.clientContact) return project.clientContact.name;
    if (note.contactId) {
      const contact = contacts.find((c) => c.id === note.contactId);
      return contact?.name || contact?.clientName;
    }
    return null;
  };

  // Filter notes helper
  const filterNotes = (notes: Note[]) => {
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    
    // Calculate time ranges based on updatedAt
    const lastWeek = new Date(startOfToday);
    lastWeek.setDate(lastWeek.getDate() - 7);
    
    const lastMonth = new Date(startOfToday);
    lastMonth.setMonth(lastMonth.getMonth() - 1);
    
    const lastYear = new Date(startOfToday);
    lastYear.setFullYear(lastYear.getFullYear() - 1);

    return notes.filter((note) => {
      // Search matching - includes title, body, project name, client
      const searchLower = searchQuery.toLowerCase();
      const matchesSearch = !searchQuery || 
        note.title.toLowerCase().includes(searchLower) ||
        note.content?.toLowerCase().includes(searchLower) ||
        (() => {
          const project = getNoteProject(note);
          const projectName = project?.name || "";
          const clientName = getNoteClient(note) || "";
          return projectName.toLowerCase().includes(searchLower) ||
                 clientName.toLowerCase().includes(searchLower);
        })();

      // Project filter
      // Note: Since notes don't have direct projectId yet, we'll filter by "unassigned" for now
      // This will be improved when notes are migrated to use projectId
      const matchesProject = filters.project === "all" || 
        (filters.project === "unassigned" ? !note.jobId : false);

      // Contact filter
      const matchesContact =
        filters.contact === "all" ||
        (filters.contact === "unassigned"
          ? !note.contactId
          : note.contactId?.toString() === filters.contact);

      // Time filter (based on updatedAt)
      const updatedAt = new Date(note.updatedAt);
      const matchesTime =
        filters.time === "all" ||
        (filters.time === "week" && updatedAt >= lastWeek) ||
        (filters.time === "month" && updatedAt >= lastMonth) ||
        (filters.time === "year" && updatedAt >= lastYear);

      return matchesSearch && matchesProject && matchesContact && matchesTime;
    });
  };

  const filteredActiveNotes = filterNotes(activeNotes);

  const getContactName = (contactId: number | null) => {
    if (!contactId) return null;
    const contact = contacts.find((c) => c.id === contactId);
    return contact?.name || contact?.clientName;
  };

  const getProjectName = (note: Note) => {
    const project = getNoteProject(note);
    return project?.name || null;
  };

  const renderNoteCard = (note: Note) => {
    const handleCardClick = (e: React.MouseEvent) => {
      if (isMultiSelectMode) {
        toggleSelection(note.id);
      } else {
        // Navigate to note detail page instead of opening dialog
        navigate(`/notes/${note.id}`);
      }
    };

    return (
      <Card
        key={note.id}
        className={`p-6 hover:shadow-lg transition-all ${
          selectedIds.has(note.id) ? "item-selected" : ""
        } ${!isMultiSelectMode ? "cursor-pointer" : ""}`}
        onClick={handleCardClick}
      >
        <div className="flex items-start gap-3 mb-3">
          <div className="flex-1 min-w-0">
            <h3 className="text-lg line-clamp-1">
              {note.title}
            </h3>
          </div>
          {!isMultiSelectMode && (
            <ItemActionsMenu
              onAction={(action) => handleItemAction(action, note.id)}
              actions={["edit", "duplicate", "select", "archive", "delete"]}
              triggerClassName="text-muted-foreground hover:text-foreground"
            />
          )}
        </div>

        {note.content && (
          <div className="text-sm text-muted-foreground mb-3 line-clamp-3 prose prose-sm dark:prose-invert max-w-none">
            <Markdown>{note.content}</Markdown>
          </div>
        )}

        {note.tags && (
          <div className="flex items-center gap-2 mb-3">
            <Tag className="h-3 w-3 text-accent" />
            <span className="text-xs text-muted-foreground">{note.tags}</span>
          </div>
        )}

        <div className="flex flex-col gap-1 text-xs text-muted-foreground">
          {getProjectName(note) && (
            <div className="flex items-center gap-1">
              <span className="text-accent">Project:</span>
              <span>{getProjectName(note)}</span>
            </div>
          )}
          {getContactName(note.contactId) && (
            <div className="flex items-center gap-1">
              <span className="text-accent">Contact:</span>
              <span>{getContactName(note.contactId)}</span>
            </div>
          )}
          <div className="mt-2">
            Updated: {new Date(note.updatedAt).toLocaleDateString()}
          </div>
        </div>
      </Card>
    );
  };

  if (!user) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p className="text-muted-foreground">Please log in to view notes.</p>
      </div>
    );
  }

  if (activeLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const hasActiveFilters =
    searchQuery ||
    filters.project !== "all" ||
    filters.contact !== "all" ||
    filters.time !== "all";

  // Search overlay - full screen at top on mobile
  const searchSlot = (
    <>
      {isSearchOpen && (
        <div className="fixed inset-0 z-50 bg-background">
          <div className="flex flex-col h-full">
            {/* Search input at top */}
            <div className="flex items-center gap-2 p-4 border-b">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  ref={searchInputRef}
                  placeholder="Search title, body, project name, client..."
                  value={searchDraft}
                  onChange={(e) => setSearchDraft(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      applySearch();
                    }
                    if (e.key === "Escape") {
                      setIsSearchOpen(false);
                    }
                  }}
                  className="pl-10 pr-10"
                  autoFocus
                />
                {searchDraft && (
                  <button
                    onClick={() => setSearchDraft("")}
                    className="absolute right-3 top-1/2 transform -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    <X className="h-4 w-4" />
                  </button>
                )}
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setIsSearchOpen(false)}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
            
            {/* Search suggestions/results preview */}
            <div className="flex-1 overflow-y-auto p-4">
              {searchDraft && (
                <div className="space-y-2">
                  {(() => {
                    // Filter notes using searchDraft for preview
                    const searchLower = searchDraft.toLowerCase();
                    return activeNotes
                      .filter((note) => {
                        const project = getNoteProject(note);
                        const projectName = project?.name || "";
                        const clientName = getNoteClient(note) || "";
                        return (
                          note.title.toLowerCase().includes(searchLower) ||
                          note.content?.toLowerCase().includes(searchLower) ||
                          projectName.toLowerCase().includes(searchLower) ||
                          clientName.toLowerCase().includes(searchLower)
                        );
                      })
                      .slice(0, 10)
                      .map((note) => (
                        <Card
                          key={note.id}
                          className="p-3 cursor-pointer hover:bg-accent"
                          onClick={() => {
                            navigate(`/notes/${note.id}`);
                            setIsSearchOpen(false);
                          }}
                        >
                          <div className="font-medium">{note.title}</div>
                          {note.content && (
                            <div className="text-sm text-muted-foreground line-clamp-2 mt-1">
                              {note.content}
                            </div>
                          )}
                        </Card>
                      ));
                  })()}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
      <Button
        variant="ghost"
        size="icon"
        aria-label="Search notes"
        onClick={() => setIsSearchOpen(true)}
      >
        <Search className="size-6" />
      </Button>
    </>
  );

  const filterSlot = (
    <Sheet open={isFilterOpen} onOpenChange={setIsFilterOpen}>
      <SheetTrigger asChild>
        <Button variant="ghost" size="icon" aria-label="Filter notes">
          <SlidersHorizontal className="size-6" />
        </Button>
      </SheetTrigger>
      <SheetContent side="right" className="p-0">
        <SheetHeader>
          <SheetTitle>Filters</SheetTitle>
        </SheetHeader>
        <div className="px-4 pb-4 overflow-y-auto space-y-4 pt-4">
          {/* Project Filter */}
          <div className="space-y-2">
            <div className="text-sm font-medium">Project</div>
            <Select
              value={draftFilters.project}
              onValueChange={(value) =>
                setDraftFilters((prev) => ({ ...prev, project: value }))
              }
            >
              <SelectTrigger>
                <SelectValue placeholder="All projects" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Projects</SelectItem>
                <SelectItem value="unassigned">Unassigned</SelectItem>
                {projects.length === 0 ? (
                  <div className="px-2 py-1.5 text-sm text-muted-foreground">
                    No projects available
                  </div>
                ) : (
                  projects.map((project) => (
                    <SelectItem key={project.id} value={project.id.toString()}>
                      {project.name}
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
          </div>

          {/* Contact Filter */}
          <div className="space-y-2">
            <div className="text-sm font-medium">Contact</div>
            <Select
              value={draftFilters.contact}
              onValueChange={(value) =>
                setDraftFilters((prev) => ({ ...prev, contact: value }))
              }
            >
              <SelectTrigger>
                <SelectValue placeholder="All contacts" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Contacts</SelectItem>
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

          {/* Time Filter (Last Updated) */}
          <div className="space-y-2">
            <div className="text-sm font-medium">Time</div>
            <Select
              value={draftFilters.time}
              onValueChange={(value) =>
                setDraftFilters((prev) => ({
                  ...prev,
                  time: value as FilterState["time"],
                }))
              }
            >
              <SelectTrigger>
                <SelectValue placeholder="Any time" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Any time</SelectItem>
                <SelectItem value="week">Last week</SelectItem>
                <SelectItem value="month">Last month</SelectItem>
                <SelectItem value="year">Last year</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <SheetFooter>
          <div className="flex items-center gap-2">
            <Button variant="outline" className="flex-1" onClick={clearDraftFilters}>
              Clear all
            </Button>
            <Button className="flex-1" onClick={applyFilters}>
              Apply filters
            </Button>
          </div>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title="Notes"
        subtitle="Create and manage your notes"
        searchSlot={searchSlot}
        filterSlot={filterSlot}
      />

      {/* Top-of-Page Action Row */}
      <div className="flex items-center justify-end gap-2 pb-2 border-b">
        <Button onClick={() => navigate("/notes/new")}>
          <Plus className="mr-1 h-4 w-4" />
          New
        </Button>
      </div>

      {/* Active Notes Grid */}
      <div className="space-y-4">
        {filteredActiveNotes.length === 0 ? (
          <Card className="p-12 text-center">
            <FileText className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
            <p className="text-muted-foreground mb-2">
              {hasActiveFilters
                ? "No notes found matching your filters"
                : "No notes yet"}
            </p>
            {!hasActiveFilters && (
              <Button
                onClick={() => navigate("/notes/new")}
                variant="outline"
                className="mt-4"
              >
                Create your first note
              </Button>
            )}
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredActiveNotes.map((note) => renderNoteCard(note))}
          </div>
        )}
      </div>

      {/* Scroll-reveal footer for Archived/Rubbish navigation */}
      <ScrollRevealFooter basePath="/notes" />

      {/* Multi-Select Bar */}
      {isMultiSelectMode && (
        <MultiSelectBar
          selectedCount={selectedIds.size}
          totalCount={activeNotes.length}
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
          archiveNoteMutation.mutate({ id: archiveTargetId });
        }}
        title="Archive"
        description="Archive this note? You can restore it anytime from the archived view."
        confirmLabel="Archive"
        isDeleting={archiveNoteMutation.isPending}
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
          deleteToRubbishMutation.mutate({ id: deleteToRubbishTargetId });
        }}
        title="Delete"
        description={"Are you sure?\nYou can restore this later from the Rubbish bin."}
        confirmLabel="Delete"
        isDeleting={deleteToRubbishMutation.isPending}
      />

      {/* Batch Delete Confirmation Dialog */}
      <DeleteConfirmDialog
        open={batchDeleteDialogOpen}
        onOpenChange={setBatchDeleteDialogOpen}
        onConfirm={() => {
          const ids = Array.from(selectedIds);
          ids.forEach((id) => deleteToRubbishMutation.mutate({ id }));
          setSelectedIds(new Set());
          setIsMultiSelectMode(false);
        }}
        title="Delete"
        description={"Are you sure?\nYou can restore this later from the Rubbish bin."}
        confirmLabel="Delete"
        isDeleting={deleteToRubbishMutation.isPending}
      />

      {/* Batch Archive Confirmation Dialog */}
      <DeleteConfirmDialog
        open={batchArchiveDialogOpen}
        onOpenChange={setBatchArchiveDialogOpen}
        onConfirm={() => {
          const ids = Array.from(selectedIds);
          ids.forEach((id) => archiveNoteMutation.mutate({ id }));
          setSelectedIds(new Set());
          setIsMultiSelectMode(false);
        }}
        title="Archive"
        description={`Archive ${selectedIds.size} note${selectedIds.size > 1 ? "s" : ""}? You can restore them anytime.`}
        confirmLabel="Archive"
        isDeleting={archiveNoteMutation.isPending}
      />
    </div>
  );
}
