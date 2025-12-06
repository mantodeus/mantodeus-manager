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
import { Plus, Search, Tag, FileText, Edit } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { ItemActionsMenu, ItemAction } from "@/components/ItemActionsMenu";
import { MultiSelectBar } from "@/components/MultiSelectBar";
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
};

export default function Notes() {
  const { user } = useAuth();
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [editingNote, setEditingNote] = useState<Note | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterProject, setFilterProject] = useState<string>("all");
  const [filterContact, setFilterContact] = useState<string>("all");
  
  // Multi-select state
  const [isMultiSelectMode, setIsMultiSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());

  // Form state
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [tags, setTags] = useState("");
  const [selectedJobId, setSelectedJobId] = useState<string>("none");
  const [selectedContactId, setSelectedContactId] = useState<string>("none");

  // Queries
  const { data: notes = [], refetch: refetchNotes } = trpc.notes.list.useQuery();
  const { data: projects = [] } = trpc.projects.list.useQuery();
  const { data: contacts = [] } = trpc.contacts.list.useQuery();
  const { data: jobs = [] } = trpc.jobs.list.useQuery();

  // Mutations
  const createNoteMutation = trpc.notes.create.useMutation({
    onSuccess: () => {
      toast.success("Note created successfully");
      refetchNotes();
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
      refetchNotes();
      resetForm();
      setIsEditDialogOpen(false);
    },
    onError: (error) => {
      toast.error(`Failed to update note: ${error.message}`);
    },
  });

  const deleteNoteMutation = trpc.notes.delete.useMutation({
    onSuccess: () => {
      toast.success("Note deleted successfully");
      refetchNotes();
    },
    onError: (error) => {
      toast.error(`Failed to delete note: ${error.message}`);
    },
  });

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

  const handleDeleteNote = (noteId: number) => {
    if (confirm("Are you sure you want to delete this note?")) {
      deleteNoteMutation.mutate({ id: noteId });
    }
  };

  const handleBatchDelete = () => {
    if (selectedIds.size === 0) return;
    
    const count = selectedIds.size;
    if (confirm(`Are you sure you want to delete ${count} note${count > 1 ? 's' : ''}?`)) {
      selectedIds.forEach((id) => {
        deleteNoteMutation.mutate({ id });
      });
      setSelectedIds(new Set());
      setIsMultiSelectMode(false);
    }
  };

  const handleItemAction = (action: ItemAction, noteId: number) => {
    const note = notes.find((n) => n.id === noteId);
    if (!note) return;

    switch (action) {
      case "edit":
        openEditDialog(note);
        break;
      case "delete":
        handleDeleteNote(noteId);
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

  // Filter notes
  const filteredNotes = notes.filter((note) => {
    const matchesSearch =
      note.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      note.content?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      note.tags?.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesJob = filterJob === "all" || note.jobId?.toString() === filterJob;
    const matchesContact =
      filterContact === "all" || note.contactId?.toString() === filterContact;

    return matchesSearch && matchesJob && matchesContact;
  });

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

  if (!user) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p className="text-muted-foreground">Please log in to view notes.</p>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8 px-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8">
        <div>
          <h1 className="text-3xl font-bold mb-2" style={{ fontFamily: "Kanit, sans-serif" }}>
            Notes
          </h1>
          <p className="text-muted-foreground" style={{ fontFamily: "Kanit, sans-serif", fontWeight: 200 }}>
            Create and manage your notes
          </p>
        </div>
        <Button
          onClick={() => setIsCreateDialogOpen(true)}
          className="bg-[#00ff88] text-black hover:bg-[#00dd77] font-medium"
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

      {/* Notes Grid */}
      {filteredNotes.length === 0 ? (
        <Card className="p-12 text-center">
          <FileText className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
          <p className="text-muted-foreground mb-2" style={{ fontFamily: "Kanit, sans-serif", fontWeight: 200 }}>
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
          {filteredNotes.map((note) => {
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
                  selectedIds.has(note.id) ? "ring-2 ring-[#00ff88]" : ""
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
                    <h3
                      className="text-lg font-semibold line-clamp-1"
                      style={{ fontFamily: "Kanit, sans-serif" }}
                    >
                      {note.title}
                    </h3>
                  </div>
                  {!isMultiSelectMode && (
                    <ItemActionsMenu
                      onAction={(action) => handleItemAction(action, note.id)}
                      actions={["edit", "delete", "select"]}
                      triggerClassName="text-muted-foreground hover:text-foreground"
                    />
                  )}
                </div>

              {note.content && (
                <p
                  className="text-sm text-muted-foreground mb-3 line-clamp-3"
                  style={{ fontFamily: "Kanit, sans-serif", fontWeight: 200 }}
                >
                  {note.content}
                </p>
              )}

              {note.tags && (
                <div className="flex items-center gap-2 mb-3">
                  <Tag className="h-3 w-3 text-[#00ff88]" />
                  <span className="text-xs text-muted-foreground">{note.tags}</span>
                </div>
              )}

              <div className="flex flex-col gap-1 text-xs text-muted-foreground">
                {getJobName(note.jobId) && (
                  <div className="flex items-center gap-1">
                    <span className="text-[#00ff88]">Job:</span>
                    <span>{getJobName(note.jobId)}</span>
                  </div>
                )}
                {getContactName(note.contactId) && (
                  <div className="flex items-center gap-1">
                    <span className="text-[#00ff88]">Contact:</span>
                    <span>{getContactName(note.contactId)}</span>
                  </div>
                )}
                <div className="mt-2">
                  {new Date(note.createdAt).toLocaleDateString()}
                </div>
              </div>
            </Card>
            );
          })}
        </div>
      )}

      {/* Create Note Dialog */}
      <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle style={{ fontFamily: "Kanit, sans-serif" }}>Create New Note</DialogTitle>
            <DialogDescription style={{ fontFamily: "Kanit, sans-serif", fontWeight: 200 }}>
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
                <Label htmlFor="project">Link to Project</Label>
                <Select value={selectedProjectId} onValueChange={setSelectedProjectId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select project (optional)" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">None</SelectItem>
                    {projects.map((project) => (
                      <SelectItem key={project.id} value={project.id.toString()}>
                        {project.name || project.title}
                      </SelectItem>
                    ))}
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
              className="bg-[#00ff88] text-black hover:bg-[#00dd77]"
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
            <DialogTitle style={{ fontFamily: "Kanit, sans-serif" }}>Edit Note</DialogTitle>
            <DialogDescription style={{ fontFamily: "Kanit, sans-serif", fontWeight: 200 }}>
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
                    {jobs.map((job) => (
                      <SelectItem key={job.id} value={job.id.toString()}>
                        {job.title}
                      </SelectItem>
                    ))}
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
              className="bg-[#00ff88] text-black hover:bg-[#00dd77]"
            >
              {updateNoteMutation.isPending ? "Updating..." : "Update Note"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Multi-Select Bar */}
      <MultiSelectBar
        selectedCount={selectedIds.size}
        onDelete={handleBatchDelete}
        onCancel={() => {
          setIsMultiSelectMode(false);
          setSelectedIds(new Set());
        }}
      />
    </div>
  );
}
