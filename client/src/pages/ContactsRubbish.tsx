/**
 * Rubbish Contacts List Page
 *
 * Displays trashed contacts with options to:
 * - Restore to active
 * - Delete permanently (irreversible)
 */

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { trpc } from "@/lib/trpc";
import { ArrowLeft, Building2, Loader2, Trash2, User } from "@/components/ui/Icon";
import { Link } from "wouter";
import { useState } from "react";
import { ItemActionsMenu, ItemAction } from "@/components/ItemActionsMenu";
import { toast } from "sonner";
import { DeleteConfirmDialog } from "@/components/DeleteConfirmDialog";
import { PageHeader } from "@/components/PageHeader";

export default function ContactsRubbish() {
  const { data: trashedContacts = [], isLoading } = trpc.contacts.listTrashed.useQuery();
  const utils = trpc.useUtils();

  // Permanent delete dialog
  const [deletePermanentlyDialogOpen, setDeletePermanentlyDialogOpen] = useState(false);
  const [deletePermanentlyTargetId, setDeletePermanentlyTargetId] = useState<number | null>(null);
  
  // Empty rubbish dialog
  const [emptyRubbishDialogOpen, setEmptyRubbishDialogOpen] = useState(false);

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

  const handleItemAction = (action: ItemAction, contactId: number) => {
    switch (action) {
      case "restore":
        restoreFromRubbishMutation.mutate({ id: contactId });
        break;
      case "deletePermanently":
        setDeletePermanentlyTargetId(contactId);
        setDeletePermanentlyDialogOpen(true);
        break;
    }
  };

  const handleEmptyRubbish = () => {
    if (trashedContacts.length === 0) return;
    
    // Delete all contacts one by one
    trashedContacts.forEach((contact) => {
      deletePermanentlyMutation.mutate({ id: contact.id });
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

  const renderRubbishItem = (contact: typeof trashedContacts[0]) => {
    const ContactIcon = contact.type === "business" ? Building2 : User;
    return (
      <Card key={contact.id}>
        <div className="flex items-center justify-between p-4">
          <div className="min-w-0 flex items-center gap-2">
            <ContactIcon className="h-5 w-5 text-muted-foreground flex-shrink-0" />
            <div>
              <div className="truncate">{contact.clientName || contact.name}</div>
              <div className="text-sm text-muted-foreground">
                Deleted{" "}
                {contact.trashedAt ? new Date(contact.trashedAt).toLocaleDateString() : "—"}
              </div>
            </div>
          </div>
          <ItemActionsMenu
            actions={["restore", "deletePermanently"]}
            onAction={(action) => handleItemAction(action, contact.id)}
          />
        </div>
      </Card>
    );
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title={
          <span className="flex items-center gap-3">
            <Trash2 className="h-8 w-8 text-muted-foreground" />
            Rubbish
          </span>
        }
        subtitle="Deleted contacts. Items here can be restored or permanently deleted."
        leading={
          <Link href="/contacts">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-5 w-5" />
            </Button>
          </Link>
        }
        primaryAction={
          trashedContacts.length > 0 ? (
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
      />

      {/* Rubbish Items List */}
      <div className="space-y-3">
        {trashedContacts.length === 0 ? (
          <Card className="p-8 text-center">
            <Trash2 className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
            <p className="text-gray-400 mb-4">Rubbish is empty.</p>
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

      <DeleteConfirmDialog
        open={emptyRubbishDialogOpen}
        onOpenChange={(open) => {
          setEmptyRubbishDialogOpen(open);
        }}
        onConfirm={handleEmptyRubbish}
        title="Empty rubbish"
        description={`This will permanently delete all ${trashedContacts.length} contact(s) in the rubbish. This action cannot be undone.`}
        confirmLabel="Empty rubbish"
        isDeleting={deletePermanentlyMutation.isPending}
      />
    </div>
  );
}
