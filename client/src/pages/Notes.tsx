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
import { Plus, Search, Tag, FileText, Loader2, SlidersHorizontal } from "@/components/ui/Icon";
import { Checkbox } from "@/components/ui/checkbox";
import { ItemActionsMenu, ItemAction } from "@/components/ItemActionsMenu";
import { MultiSelectBar } from "@/components/MultiSelectBar";
import { DeleteConfirmDialog } from "@/components/DeleteConfirmDialog";
import { ScrollRevealFooter } from "@/components/ScrollRevealFooter";
import { PageHeader } from "@/components/PageHeader";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Markdown } from "@/components/Markdown";

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
  job: string;
  contact: string;
  created: "all" | "today" | "last7" | "last30" | "custom";
  createdFrom: string;
  createdTo: string;
  updated: "all" | "recent" | "older";
  hasAttachments: "all" | "yes" | "no";
  hasChecklist: "all" | "yes" | "no";
  hasLinks: "all" | "yes" | "no";
  pinned: "all" | "only";
  draft: "all" | "only";
  author: "all" | "me" | "others";
};

const defaultFilters: FilterState = {
  job: "all",
  contact: "all",
  created: "all",
  createdFrom: "",
  createdTo: "",
  updated: "all",
  hasAttachments: "all",
  hasChecklist: "all",
  hasLinks: "all",
  pinned: "all",
  draft: "all",
  author: "all",
};

export default function Notes() {
  const { user } = useAuth();
  const [, navigate] = useLocation();
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
  const { data: jobs = [] } = trpc.jobs.list.useQuery();

  useEffect(() => {
    if (!isSearchOpen) return;
    setSearchDraft(searchQuery);
    const timer = setTimeout(() => {
      searchInputRef.current?.focus();
    }, 0);
    return () => clearTimeout(timer);
  }, [isSearchOpen, searchQuery]);

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
        toast.info("Duplicate is coming soon.");
        break;
      case "archive":
        setArchiveTargetId(noteId);
        setArchiveDialogOpen(true);
        break;
      case "moveToTrash":
        setDeleteToRubbishTargetId(noteId);
        setDeleteToRubbishDialogOpen(true);
        break;
      case "select":
        setIsMultiSelectMode(true);
        setSelectedIds(new Set([noteId]));
        break;
    }
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

  const parseDateInput = (value: string, endOfDay = false) => {
    if (!value) return null;
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return null;
    if (endOfDay) {
      date.setHours(23, 59, 59, 999);
    }
    return date;
  };

  const isWithinRange = (date: Date, from: Date | null, to: Date | null) => {
    if (from && date < from) return false;
    if (to && date > to) return false;
    return true;
  };

  // Filter notes helper
  const filterNotes = (notes: Note[]) => {
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const last7 = new Date(startOfToday);
    last7.setDate(last7.getDate() - 6);
    const last30 = new Date(startOfToday);
    last30.setDate(last30.getDate() - 29);
    const createdFrom = parseDateInput(filters.createdFrom);
    const createdTo = parseDateInput(filters.createdTo, true);

    return notes.filter((note) => {
      const noteContent = note.content || "";
      const noteTags = (note.tags || "")
        .split(",")
        .map((tag) => tag.trim().toLowerCase())
        .filter(Boolean);
      const hasChecklist = /(^|\n)\s*[-*]\s+\[( |x|X)\]/.test(noteContent);
      const hasLinks = /https?:\/\/\S+|\[[^\]]+\]\([^)]+\)/.test(noteContent);
      const hasAttachments = (note.fileCount ?? 0) > 0;
      const isPinned = noteTags.includes("pinned");
      const isDraft = noteTags.includes("draft");

      const matchesSearch =
        note.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        note.content?.toLowerCase().includes(searchQuery.toLowerCase());

      const matchesJob =
        filters.job === "all" ||
        (filters.job === "unassigned" ? !note.jobId : note.jobId?.toString() === filters.job);
      const matchesContact =
        filters.contact === "all" ||
        (filters.contact === "unassigned"
          ? !note.contactId
          : note.contactId?.toString() === filters.contact);

      const createdAt = new Date(note.createdAt);
      const updatedAt = new Date(note.updatedAt);
      const matchesCreated =
        filters.created === "all" ||
        (filters.created === "today" && createdAt >= startOfToday) ||
        (filters.created === "last7" && createdAt >= last7) ||
        (filters.created === "last30" && createdAt >= last30) ||
        (filters.created === "custom" && isWithinRange(createdAt, createdFrom, createdTo));

      const matchesUpdated =
        filters.updated === "all" ||
        (filters.updated === "recent" && updatedAt >= last7) ||
        (filters.updated === "older" && updatedAt < last7);

      const matchesAttachments =
        filters.hasAttachments === "all" ||
        (filters.hasAttachments === "yes" ? hasAttachments : !hasAttachments);
      const matchesChecklist =
        filters.hasChecklist === "all" ||
        (filters.hasChecklist === "yes" ? hasChecklist : !hasChecklist);
      const matchesLinks =
        filters.hasLinks === "all" || (filters.hasLinks === "yes" ? hasLinks : !hasLinks);

      const matchesPinned =
        filters.pinned === "all" || (filters.pinned === "only" ? isPinned : true);
      const matchesDraft = filters.draft === "all" || (filters.draft === "only" ? isDraft : true);

      const matchesAuthor =
        filters.author === "all" ||
        (filters.author === "me" && user?.id && note.createdBy === user.id) ||
        (filters.author === "others" && user?.id && note.createdBy !== user.id);

      return (
        matchesSearch &&
        matchesJob &&
        matchesContact &&
        matchesCreated &&
        matchesUpdated &&
        matchesAttachments &&
        matchesChecklist &&
        matchesLinks &&
        matchesPinned &&
        matchesDraft &&
        matchesAuthor
      );
    });
  };

  const filteredActiveNotes = filterNotes(activeNotes);

  const getJobName = (jobId: number | null) => {
    if (!jobId) return null;
    const job = jobs.find((j) => j.id === jobId);
    return job?.title;
  };

  const getContactName = (contactId: number | null) => {
    if (!contactId) return null;
    const contact = contacts.find((c) => c.id === contactId);
    return contact?.name;
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
          selectedIds.has(note.id) ? "ring-2 ring-accent" : ""
        } ${!isMultiSelectMode ? "cursor-pointer" : ""}`}
        onClick={handleCardClick}
      >
        <div className="flex items-start gap-3 mb-3">
          {isMultiSelectMode && (
            <Checkbox
              checked={selectedIds.has(note.id)}
              onCheckedChange={() => toggleSelection(note.id)}
              onClick={(e) => e.stopPropagation()}
              className="mt-1"
            />
          )}
          <div className="flex-1 min-w-0">
            <h3 className="text-lg line-clamp-1">
              {note.title}
            </h3>
          </div>
          {!isMultiSelectMode && (
            <ItemActionsMenu
              onAction={(action) => handleItemAction(action, note.id)}
              actions={["edit", "duplicate", "archive", "moveToTrash", "select"]}
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
          {getJobName(note.jobId) && (
            <div className="flex items-center gap-1">
              <span className="text-accent">Job:</span>
              <span>{getJobName(note.jobId)}</span>
            </div>
          )}
          {getContactName(note.contactId) && (
            <div className="flex items-center gap-1">
              <span className="text-accent">Contact:</span>
              <span>{getContactName(note.contactId)}</span>
            </div>
          )}
          <div className="mt-2">
            {new Date(note.createdAt).toLocaleDateString()}
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
    filters.job !== "all" ||
    filters.contact !== "all" ||
    filters.created !== "all" ||
    filters.createdFrom ||
    filters.createdTo ||
    filters.updated !== "all" ||
    filters.hasAttachments !== "all" ||
    filters.hasChecklist !== "all" ||
    filters.hasLinks !== "all" ||
    filters.pinned !== "all" ||
    filters.draft !== "all" ||
    filters.author !== "all";

  const searchSlot = (
    <Dialog open={isSearchOpen} onOpenChange={setIsSearchOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="icon" aria-label="Search notes">
          <Search className="size-6" />
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Search notes</DialogTitle>
        </DialogHeader>
        <Input
          ref={searchInputRef}
          placeholder="Search title, body text, or headings..."
          value={searchDraft}
          onChange={(e) => setSearchDraft(e.target.value)}
        />
        <DialogFooter>
          <Button variant="ghost" onClick={clearSearch}>
            Clear
          </Button>
          <Button onClick={applySearch}>Search</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
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
        <div className="px-4 pb-4 overflow-y-auto">
          <Accordion type="multiple" defaultValue={["associations", "time", "content", "status"]}>
            <AccordionItem value="associations">
              <AccordionTrigger>Associations</AccordionTrigger>
              <AccordionContent>
                <div className="space-y-4">
                  <div className="space-y-2">
                    <div className="text-xs font-medium text-muted-foreground">Job</div>
                    <Select
                      value={draftFilters.job}
                      onValueChange={(value) =>
                        setDraftFilters((prev) => ({ ...prev, job: value }))
                      }
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="All jobs" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Jobs</SelectItem>
                        <SelectItem value="unassigned">Unassigned</SelectItem>
                        {jobs.length === 0 ? (
                          <div className="px-2 py-1.5 text-sm text-muted-foreground">
                            No jobs available
                          </div>
                        ) : (
                          jobs.map((job) => (
                            <SelectItem key={job.id} value={job.id.toString()}>
                              {job.title}
                            </SelectItem>
                          ))
                        )}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <div className="text-xs font-medium text-muted-foreground">Contact</div>
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
                              {contact.name}
                            </SelectItem>
                          ))
                        )}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="time">
              <AccordionTrigger>Time</AccordionTrigger>
              <AccordionContent>
                <div className="space-y-4">
                  <div className="space-y-2">
                    <div className="text-xs font-medium text-muted-foreground">Created</div>
                    <Select
                      value={draftFilters.created}
                      onValueChange={(value) =>
                        setDraftFilters((prev) => ({
                          ...prev,
                          created: value as FilterState["created"],
                        }))
                      }
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Any time" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Any time</SelectItem>
                        <SelectItem value="today">Today</SelectItem>
                        <SelectItem value="last7">Last 7 days</SelectItem>
                        <SelectItem value="last30">Last 30 days</SelectItem>
                        <SelectItem value="custom">Custom range</SelectItem>
                      </SelectContent>
                    </Select>
                    {draftFilters.created === "custom" && (
                      <div className="grid grid-cols-2 gap-2">
                        <Input
                          type="date"
                          value={draftFilters.createdFrom}
                          onChange={(e) =>
                            setDraftFilters((prev) => ({
                              ...prev,
                              createdFrom: e.target.value,
                            }))
                          }
                        />
                        <Input
                          type="date"
                          value={draftFilters.createdTo}
                          onChange={(e) =>
                            setDraftFilters((prev) => ({
                              ...prev,
                              createdTo: e.target.value,
                            }))
                          }
                        />
                      </div>
                    )}
                  </div>

                  <div className="space-y-2">
                    <div className="text-xs font-medium text-muted-foreground">Updated</div>
                    <Select
                      value={draftFilters.updated}
                      onValueChange={(value) =>
                        setDraftFilters((prev) => ({
                          ...prev,
                          updated: value as FilterState["updated"],
                        }))
                      }
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Any time" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Any time</SelectItem>
                        <SelectItem value="recent">Recently edited</SelectItem>
                        <SelectItem value="older">Older notes</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="content">
              <AccordionTrigger>Content</AccordionTrigger>
              <AccordionContent>
                <div className="space-y-4">
                  <div className="space-y-2">
                    <div className="text-xs font-medium text-muted-foreground">Attachments</div>
                    <Select
                      value={draftFilters.hasAttachments}
                      onValueChange={(value) =>
                        setDraftFilters((prev) => ({
                          ...prev,
                          hasAttachments: value as FilterState["hasAttachments"],
                        }))
                      }
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Any" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Any</SelectItem>
                        <SelectItem value="yes">Yes</SelectItem>
                        <SelectItem value="no">No</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <div className="text-xs font-medium text-muted-foreground">Checklist</div>
                    <Select
                      value={draftFilters.hasChecklist}
                      onValueChange={(value) =>
                        setDraftFilters((prev) => ({
                          ...prev,
                          hasChecklist: value as FilterState["hasChecklist"],
                        }))
                      }
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Any" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Any</SelectItem>
                        <SelectItem value="yes">Yes</SelectItem>
                        <SelectItem value="no">No</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <div className="text-xs font-medium text-muted-foreground">Links</div>
                    <Select
                      value={draftFilters.hasLinks}
                      onValueChange={(value) =>
                        setDraftFilters((prev) => ({
                          ...prev,
                          hasLinks: value as FilterState["hasLinks"],
                        }))
                      }
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Any" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Any</SelectItem>
                        <SelectItem value="yes">Yes</SelectItem>
                        <SelectItem value="no">No</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="status">
              <AccordionTrigger>Status</AccordionTrigger>
              <AccordionContent>
                <div className="space-y-4">
                  <div className="space-y-2">
                    <div className="text-xs font-medium text-muted-foreground">Pinned</div>
                    <Select
                      value={draftFilters.pinned}
                      onValueChange={(value) =>
                        setDraftFilters((prev) => ({
                          ...prev,
                          pinned: value as FilterState["pinned"],
                        }))
                      }
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Any" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Any</SelectItem>
                        <SelectItem value="only">Pinned only</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <div className="text-xs font-medium text-muted-foreground">Draft</div>
                    <Select
                      value={draftFilters.draft}
                      onValueChange={(value) =>
                        setDraftFilters((prev) => ({
                          ...prev,
                          draft: value as FilterState["draft"],
                        }))
                      }
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Any" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Any</SelectItem>
                        <SelectItem value="only">Drafts only</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <div className="text-xs font-medium text-muted-foreground">Created by</div>
                    <Select
                      value={draftFilters.author}
                      onValueChange={(value) =>
                        setDraftFilters((prev) => ({
                          ...prev,
                          author: value as FilterState["author"],
                        }))
                      }
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Anyone" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Anyone</SelectItem>
                        <SelectItem value="me">Me</SelectItem>
                        <SelectItem value="others">Others</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </AccordionContent>
            </AccordionItem>
          </Accordion>
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
          <Plus className="mr-2 h-4 w-4" />
          New Note
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
          onPrimaryAction={handleBatchDelete}
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
