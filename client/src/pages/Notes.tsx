/**
 * Notes List Page
 * 
 * Displays all active notes for the current user.
 * Pull-down reveal provides navigation to archived/rubbish views.
 */

import { useState } from "react";
import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { Plus, Search, Tag, FileText, Loader2 } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { ItemActionsMenu, ItemAction } from "@/components/ItemActionsMenu";
import { MultiSelectBar } from "@/components/MultiSelectBar";
import { DeleteConfirmDialog } from "@/components/DeleteConfirmDialog";
import { ScrollRevealFooter } from "@/components/ScrollRevealFooter";
import { Streamdown } from "streamdown";

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
};

export default function Notes() {
  const { user } = useAuth();
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [editingNote, setEditingNote] = useState<Note | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterJob, setFilterJob] = useState<string>("all");
  const [filterContact, setFilterContact] = useState<string>("all");
  
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

  // Form state
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [tags, setTags] = useState("");
  const [selectedJobId, setSelectedJobId] = useState<string>("none");
  const [selectedContactId, setSelectedContactId] = useState<string>("none");

  // Queries
  const utils = trpc.useUtils();
  const { data: activeNotes = [], isLoading: activeLoading } = trpc.notes.list.useQuery();
  const { data: contacts = [] } = trpc.contacts.list.useQuery();
  const { data: jobs = [] } = trpc.jobs.list.useQuery();

  // Mutations
  const createNoteMutation = trpc.notes.create.useMutation({
    onSuccess: () => {
      toast.success("Note created successfully");
      invalidateNoteLists();
      resetForm();
      setIsCreateDialogOpen(false);
    },
    onError: (error) => {
      toast.error(`Failed to create note: ${error.message}`);
    },
  });

  const updateNoteMutation = trpc.notes.update.useMutation({
    onSuccess: () => {
      toast.success("Note updated successfully");
      invalidateNoteLists();
      resetForm();
      setIsEditDialogOpen(false);
    },
    onError: (error) => {
      toast.error(`Failed to update note: ${error.message}`);
    },
  });

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

  const resetForm = () => {
    setTitle("");
    setContent("");
    setTags("");
    setSelectedJobId("none");
    setSelectedContactId("none");
    setEditingNote(null);
  };

  const handleCreateNote = () => {
    if (!title.trim()) {
      toast.error("Please enter a title");
      return;
    }

    createNoteMutation.mutate({
      title: title.trim(),
      content: content.trim() || undefined,
      tags: tags.trim() || undefined,
      jobId: selectedJobId && selectedJobId !== "none" ? parseInt(selectedJobId) : undefined,
      contactId: selectedContactId && selectedContactId !== "none" ? parseInt(selectedContactId) : undefined,
    });
  };

  const handleUpdateNote = () => {
    if (!editingNote) return;
    if (!title.trim()) {
      toast.error("Please enter a title");
      return;
    }

    updateNoteMutation.mutate({
      id: editingNote.id,
      title: title.trim(),
      content: content.trim() || undefined,
      tags: tags.trim() || undefined,
      jobId: selectedJobId && selectedJobId !== "none" ? parseInt(selectedJobId) : undefined,
      contactId: selectedContactId && selectedContactId !== "none" ? parseInt(selectedContactId) : undefined,
    });
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
        openEditDialog(note);
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

  const openEditDialog = (note: Note) => {
    setEditingNote(note);
    setTitle(note.title);
    setContent(note.content || "");
    setTags(note.tags || "");
    setSelectedJobId(note.jobId?.toString() || "none");
    setSelectedContactId(note.contactId?.toString() || "none");
    setIsEditDialogOpen(true);
  };

  // Filter notes helper
  const filterNotes = (notes: Note[]) => {
    return notes.filter((note) => {
      const matchesSearch =
        note.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        note.content?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        note.tags?.toLowerCase().includes(searchQuery.toLowerCase());

      const matchesJob = filterJob === "all" || note.jobId?.toString() === filterJob;
      const matchesContact =
        filterContact === "all" || note.contactId?.toString() === filterContact;

      return matchesSearch && matchesJob && matchesContact;
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
        openEditDialog(note);
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
            <Streamdown>{note.content}</Streamdown>
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

  return (
    <div className="space-y-6 pb-24">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-regular">Notes</h1>
          <p className="text-muted-foreground text-sm">Create and manage your notes</p>
        </div>
        <Button
          onClick={() => setIsCreateDialogOpen(true)}
        >
          <Plus className="mr-2 h-4 w-4" />
          New Note
        </Button>
      </div>

      {/* Filters */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search notes..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>
        <Select value={filterJob} onValueChange={setFilterJob}>
          <SelectTrigger>
            <SelectValue placeholder="Filter by job" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Jobs</SelectItem>
            {jobs.length === 0 ? (
              <div className="px-2 py-1.5 text-sm text-muted-foreground">No jobs available</div>
            ) : (
              jobs.map((job) => (
                <SelectItem key={job.id} value={job.id.toString()}>
                  {job.title}
                </SelectItem>
              ))
            )}
          </SelectContent>
        </Select>
        <Select value={filterContact} onValueChange={setFilterContact}>
          <SelectTrigger>
            <SelectValue placeholder="Filter by contact" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Contacts</SelectItem>
            {contacts.length === 0 ? (
              <div className="px-2 py-1.5 text-sm text-muted-foreground">No contacts available</div>
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

      {/* Active Notes Grid */}
      <div className="space-y-4">
        {filteredActiveNotes.length === 0 ? (
          <Card className="p-12 text-center">
            <FileText className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
            <p className="text-muted-foreground mb-2">
              {searchQuery || filterJob !== "all" || filterContact !== "all"
                ? "No notes found matching your filters"
                : "No notes yet"}
            </p>
            {!searchQuery && filterJob === "all" && filterContact === "all" && (
              <Button
                onClick={() => setIsCreateDialogOpen(true)}
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

      {/* Create Note Dialog */}
      <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Create New Note</DialogTitle>
            <DialogDescription>
              Add a new note with optional links to projects and contacts
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="title">Title *</Label>
              <Input
                id="title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Enter note title"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="content">Content</Label>
              <Textarea
                id="content"
                value={content}
                onChange={(e) => setContent(e.target.value)}
                placeholder="Enter note content"
                rows={6}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="tags">Tags</Label>
              <Input
                id="tags"
                value={tags}
                onChange={(e) => setTags(e.target.value)}
                placeholder="e.g., important, follow-up, meeting"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="job">Link to Job</Label>
                <Select value={selectedJobId} onValueChange={setSelectedJobId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select job (optional)" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">None</SelectItem>
                    {jobs && jobs.length > 0 ? (
                      jobs.map((job) => (
                        <SelectItem key={job.id} value={job.id.toString()}>
                          {job.title}
                        </SelectItem>
                      ))
                    ) : (
                      <SelectItem value="no-jobs" disabled>
                        No jobs available
                      </SelectItem>
                    )}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="contact">Link to Contact</Label>
                <Select value={selectedContactId} onValueChange={setSelectedContactId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select contact (optional)" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">None</SelectItem>
                    {contacts.map((contact) => (
                      <SelectItem key={contact.id} value={contact.id.toString()}>
                        {contact.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                resetForm();
                setIsCreateDialogOpen(false);
              }}
            >
              Cancel
            </Button>
            <Button
              onClick={handleCreateNote}
              disabled={createNoteMutation.isPending}
            >
              {createNoteMutation.isPending ? "Creating..." : "Create Note"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Note Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Edit Note</DialogTitle>
            <DialogDescription>
              Update note details and links
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="edit-title">Title *</Label>
              <Input
                id="edit-title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Enter note title"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="edit-content">Content</Label>
              <Textarea
                id="edit-content"
                value={content}
                onChange={(e) => setContent(e.target.value)}
                placeholder="Enter note content"
                rows={6}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="edit-tags">Tags</Label>
              <Input
                id="edit-tags"
                value={tags}
                onChange={(e) => setTags(e.target.value)}
                placeholder="e.g., important, follow-up, meeting"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="edit-job">Link to Job</Label>
                <Select value={selectedJobId} onValueChange={setSelectedJobId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select job (optional)" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">None</SelectItem>
                    {jobs && jobs.length > 0 ? (
                      jobs.map((job) => (
                        <SelectItem key={job.id} value={job.id.toString()}>
                          {job.title}
                        </SelectItem>
                      ))
                    ) : (
                      <SelectItem value="no-jobs" disabled>
                        No jobs available
                      </SelectItem>
                    )}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="edit-contact">Link to Contact</Label>
                <Select value={selectedContactId} onValueChange={setSelectedContactId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select contact (optional)" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">None</SelectItem>
                    {contacts.map((contact) => (
                      <SelectItem key={contact.id} value={contact.id.toString()}>
                        {contact.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                resetForm();
                setIsEditDialogOpen(false);
              }}
            >
              Cancel
            </Button>
            <Button
              onClick={handleUpdateNote}
              disabled={updateNoteMutation.isPending}
            >
              {updateNoteMutation.isPending ? "Updating..." : "Update Note"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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
