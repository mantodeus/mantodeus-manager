/**
 * Rubbish Notes List Page
 *
 * Displays trashed notes with options to:
 * - Restore to active
 * - Delete permanently (irreversible)
 */

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { trpc } from "@/lib/trpc";
import { ArrowLeft, Loader2, Trash2 } from "@/components/ui/Icon";
import { Link } from "wouter";
import { useState } from "react";
import { ItemActionsMenu, ItemAction } from "@/components/ItemActionsMenu";
import { toast } from "sonner";
import { DeleteConfirmDialog } from "@/components/DeleteConfirmDialog";
import { PageHeader } from "@/components/PageHeader";

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

export default function NotesRubbish() {
  const { data: trashedNotes = [], isLoading } = trpc.notes.listTrashed.useQuery();
  const utils = trpc.useUtils();

  // Permanent delete dialog
  const [deletePermanentlyDialogOpen, setDeletePermanentlyDialogOpen] = useState(false);
  const [deletePermanentlyTargetId, setDeletePermanentlyTargetId] = useState<number | null>(null);
  
  // Empty rubbish dialog
  const [emptyRubbishDialogOpen, setEmptyRubbishDialogOpen] = useState(false);

  const invalidateNoteLists = () => {
    utils.notes.list.invalidate();
    utils.notes.listArchived.invalidate();
    utils.notes.listTrashed.invalidate();
  };

  const restoreFromRubbishMutation = trpc.notes.restoreFromTrash.useMutation({
    onSuccess: () => {
      toast.success("Note restored");
      invalidateNoteLists();
    },
    onError: (error) => {
      toast.error("Failed to restore note: " + error.message);
    },
  });

  const deletePermanentlyMutation = trpc.notes.deletePermanently.useMutation({
    onSuccess: () => {
      toast.success("Note deleted permanently");
      invalidateNoteLists();
      setDeletePermanentlyDialogOpen(false);
      setDeletePermanentlyTargetId(null);
    },
    onError: (error) => {
      toast.error("Failed to delete note permanently: " + error.message);
    },
  });

  const handleItemAction = (action: ItemAction, noteId: number) => {
    switch (action) {
      case "restore":
        restoreFromRubbishMutation.mutate({ id: noteId });
        break;
      case "deletePermanently":
        setDeletePermanentlyTargetId(noteId);
        setDeletePermanentlyDialogOpen(true);
        break;
    }
  };

  const handleEmptyRubbish = () => {
    if (trashedNotes.length === 0) return;
    
    // Delete all notes one by one
    trashedNotes.forEach((note) => {
      deletePermanentlyMutation.mutate({ id: note.id });
    });
    
    setEmptyRubbishDialogOpen(false);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const renderRubbishItem = (note: Note) => (
    <Card key={note.id}>
      <div className="flex items-center justify-between p-4">
        <div className="min-w-0">
          <div className="truncate">{note.title}</div>
          <div className="text-sm text-muted-foreground">
            Deleted{" "}
            {note.trashedAt ? new Date(note.trashedAt).toLocaleDateString() : "—"}
          </div>
        </div>
        <ItemActionsMenu
          actions={["restore", "deletePermanently"]}
          onAction={(action) => handleItemAction(action, note.id)}
        />
      </div>
    </Card>
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title="Rubbish"
        subtitle="Deleted notes. Items here can be restored or permanently deleted."
        leading={
          <Link href="/notes">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-5 w-5" />
            </Button>
          </Link>
        }
        actions={
          trashedNotes.length > 0 ? (
            <Button
              variant="destructive"
              size="sm"
              onClick={() => setEmptyRubbishDialogOpen(true)}
              disabled={deletePermanentlyMutation.isPending}
            >
              <Trash2 className="h-4 w-4 mr-2" />
              Empty
            </Button>
          ) : undefined
        }
        actionsPlacement="right"
      />

      {/* Rubbish Items List */}
      <div className="space-y-3">
        {trashedNotes.length === 0 ? (
          <Card className="p-12 text-center">
            <Trash2 className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
            <p className="text-muted-foreground mb-4">
              Rubbish is empty.
            </p>
            <Link href="/notes">
              <Button variant="outline">
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back to Notes
              </Button>
            </Link>
          </Card>
        ) : (
          trashedNotes.map((note) => renderRubbishItem(note))
        )}
      </div>

      <DeleteConfirmDialog
        open={deletePermanentlyDialogOpen}
        onOpenChange={(open) => {
          setDeletePermanentlyDialogOpen(open);
          if (!open) {
            setDeletePermanentlyTargetId(null);
          }
        }}
        onConfirm={() => {
          if (!deletePermanentlyTargetId) return;
          deletePermanentlyMutation.mutate({ id: deletePermanentlyTargetId });
        }}
        title="Delete permanently"
        description="This action cannot be undone."
        confirmLabel="Delete permanently"
        isDeleting={deletePermanentlyMutation.isPending}
      />

      <DeleteConfirmDialog
        open={emptyRubbishDialogOpen}
        onOpenChange={(open) => {
          setEmptyRubbishDialogOpen(open);
        }}
        onConfirm={handleEmptyRubbish}
        title="Empty rubbish"
        description={`This will permanently delete all ${trashedNotes.length} note(s) in the rubbish. This action cannot be undone.`}
        confirmLabel="Empty rubbish"
        isDeleting={deletePermanentlyMutation.isPending}
      />
    </div>
  );
}
