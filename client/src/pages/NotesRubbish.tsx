/**
 * Rubbish Bin Notes List Page
 *
 * Displays trashed notes with options to:
 * - Restore to active
 * - Delete permanently (irreversible)
 */

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { trpc } from "@/lib/trpc";
import { ArrowLeft, Loader2, Trash2, RotateCcw } from "lucide-react";
import { Link } from "wouter";
import { useState } from "react";
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
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => restoreFromRubbishMutation.mutate({ id: note.id })}
            disabled={restoreFromRubbishMutation.isPending}
            className="gap-2"
          >
            <RotateCcw className="h-4 w-4" />
            Restore
          </Button>
          <Button
            variant="destructive"
            size="sm"
            onClick={() => {
              setDeletePermanentlyTargetId(note.id);
              setDeletePermanentlyDialogOpen(true);
            }}
            className="gap-2"
          >
            <Trash2 className="h-4 w-4" />
            Delete permanently
          </Button>
        </div>
      </div>
    </Card>
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title={
          <span className="flex items-center gap-3">
            <Trash2 className="h-8 w-8 text-muted-foreground" />
            Rubbish Bin
          </span>
        }
        subtitle="Deleted notes. Items here can be restored or permanently deleted."
        leading={
          <Link href="/notes">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-5 w-5" />
            </Button>
          </Link>
        }
      />

      {/* Rubbish Items List */}
      <div className="space-y-3">
        {trashedNotes.length === 0 ? (
          <Card className="p-12 text-center">
            <Trash2 className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
            <p className="text-muted-foreground mb-4">
              Rubbish bin is empty.
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
    </div>
  );
}
