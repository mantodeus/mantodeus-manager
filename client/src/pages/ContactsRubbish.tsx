/**
 * Rubbish Bin Contacts List Page
 *
 * Displays trashed contacts with options to:
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

export default function ContactsRubbish() {
  const { data: trashedContacts = [], isLoading } = trpc.contacts.listTrashed.useQuery();
  const utils = trpc.useUtils();

  // Permanent delete dialog
  const [deletePermanentlyDialogOpen, setDeletePermanentlyDialogOpen] = useState(false);
  const [deletePermanentlyTargetId, setDeletePermanentlyTargetId] = useState<number | null>(null);

  const invalidateContactLists = () => {
    utils.contacts.list.invalidate();
    utils.contacts.listArchived.invalidate();
    utils.contacts.listTrashed.invalidate();
  };

  const restoreFromRubbishMutation = trpc.contacts.restoreFromTrash.useMutation({
    onSuccess: () => {
      toast.success("Contact restored");
      invalidateContactLists();
    },
    onError: (error) => {
      toast.error("Failed to restore contact: " + error.message);
    },
  });

  const deletePermanentlyMutation = trpc.contacts.deletePermanently.useMutation({
    onSuccess: () => {
      toast.success("Contact deleted permanently");
      invalidateContactLists();
      setDeletePermanentlyDialogOpen(false);
      setDeletePermanentlyTargetId(null);
    },
    onError: (error) => {
      toast.error("Failed to delete contact permanently: " + error.message);
    },
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const renderRubbishItem = (contact: typeof trashedContacts[0]) => (
    <Card key={contact.id}>
      <div className="flex items-center justify-between p-4">
        <div className="min-w-0">
          <div className="truncate">{contact.name}</div>
          <div className="text-sm text-muted-foreground">
            Deleted{" "}
            {contact.trashedAt ? new Date(contact.trashedAt).toLocaleDateString() : "—"}
          </div>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => restoreFromRubbishMutation.mutate({ id: contact.id })}
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
              setDeletePermanentlyTargetId(contact.id);
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
        title="Rubbish Bin"
        subtitle="Deleted contacts. Items here can be restored or permanently deleted."
        leading={
          <Link href="/contacts">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-5 w-5" />
            </Button>
          </Link>
        }
      />

      {/* Rubbish Items List */}
      <div className="space-y-3">
        {trashedContacts.length === 0 ? (
          <Card className="p-8 text-center">
            <Trash2 className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
            <p className="text-gray-400 mb-4">Rubbish bin is empty.</p>
            <Link href="/contacts">
              <Button variant="outline">
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back to Contacts
              </Button>
            </Link>
          </Card>
        ) : (
          trashedContacts.map((contact) => renderRubbishItem(contact))
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
