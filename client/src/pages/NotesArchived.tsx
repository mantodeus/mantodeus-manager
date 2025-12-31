/**
 * Archived Notes List Page
 *
 * Displays archived notes with options to:
 * - Restore to active
 * - Delete (move to rubbish)
 */

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { trpc } from "@/lib/trpc";
import { ArrowLeft, Tag, Archive, Loader2 } from "lucide-react";
import { Link } from "wouter";
import { useState } from "react";
import { ItemActionsMenu, ItemAction } from "@/components/ItemActionsMenu";
import { toast } from "sonner";
import { DeleteConfirmDialog } from "@/components/DeleteConfirmDialog";
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

export default function NotesArchived() {
  const { data: archivedNotes = [], isLoading } = trpc.notes.listArchived.useQuery();
  const { data: contacts = [] } = trpc.contacts.list.useQuery();
  const { data: jobs = [] } = trpc.jobs.list.useQuery();
  const utils = trpc.useUtils();

  // Delete confirmation dialog
  const [deleteToRubbishDialogOpen, setDeleteToRubbishDialogOpen] = useState(false);
  const [deleteToRubbishTargetId, setDeleteToRubbishTargetId] = useState<number | null>(null);

  const invalidateNoteLists = () => {
    utils.notes.list.invalidate();
    utils.notes.listArchived.invalidate();
    utils.notes.listTrashed.invalidate();
  };

  const restoreArchivedNoteMutation = trpc.notes.restore.useMutation({
    onSuccess: () => {
      toast.success("Note restored");
      invalidateNoteLists();
    },
    onError: (error) => {
      toast.error(`Failed to restore note: ${error.message}`);
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

  const handleItemAction = (action: ItemAction, noteId: number) => {
    switch (action) {
      case "restore":
        restoreArchivedNoteMutation.mutate({ id: noteId });
        break;
      case "duplicate":
        toast.info("Duplicate is coming soon.");
        break;
      case "moveToTrash":
        setDeleteToRubbishTargetId(noteId);
        setDeleteToRubbishDialogOpen(true);
        break;
    }
  };

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

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const renderNoteCard = (note: Note) => (
    <Card
      key={note.id}
      className="p-6 opacity-75"
    >
      <div className="flex items-start gap-3 mb-3">
        <div className="flex-1 min-w-0">
          <h3 className="text-lg line-clamp-1">
            {note.title}
          </h3>
        </div>
        <ItemActionsMenu
          onAction={(action) => handleItemAction(action, note.id)}
          actions={["restore", "duplicate", "moveToTrash"]}
          triggerClassName="text-muted-foreground hover:text-foreground"
        />
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

  return (
    <div className="container mx-auto py-8 px-4 pb-24">
      <div className="flex justify-between items-center">
        <div className="flex items-center gap-4">
          <Link href="/notes">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-5 w-5" />
            </Button>
          </Link>
          <div>
            <h1 className="text-3xl font-regular flex items-center gap-3">
              <Archive className="h-8 w-8 text-muted-foreground" />
              Archived Notes
            </h1>
            <p className="text-muted-foreground text-sm">Notes you've archived. You can restore them anytime.</p>
          </div>
        </div>
      </div>

      {/* Archived Notes Grid */}
      <div className="space-y-4">
        {archivedNotes.length === 0 ? (
          <Card className="p-12 text-center">
            <Archive className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
            <p className="text-muted-foreground mb-4">
              No archived notes.
            </p>
            <Link href="/notes">
              <Button variant="outline">
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back to Notes
              </Button>
            </Link>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {archivedNotes.map((note) => renderNoteCard(note))}
          </div>
        )}
      </div>

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
    </div>
  );
}
