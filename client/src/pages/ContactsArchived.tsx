/**
 * Archived Contacts List Page
 *
 * Displays archived contacts with options to:
 * - Restore to active
 * - Delete (move to rubbish)
 */

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { trpc } from "@/lib/trpc";
import { ArrowLeft, Mail, MapPin, Phone, Archive, Loader2 } from "lucide-react";
import { Link } from "wouter";
import { useState } from "react";
import { ItemActionsMenu, ItemAction } from "@/components/ItemActionsMenu";
import { toast } from "sonner";
import { DeleteConfirmDialog } from "@/components/DeleteConfirmDialog";

export default function ContactsArchived() {
  const { data: archivedContacts = [], isLoading } = trpc.contacts.listArchived.useQuery();
  const utils = trpc.useUtils();

  // Delete confirmation dialog
  const [deleteToRubbishDialogOpen, setDeleteToRubbishDialogOpen] = useState(false);
  const [deleteToRubbishTargetId, setDeleteToRubbishTargetId] = useState<number | null>(null);

  const invalidateContactLists = () => {
    utils.contacts.list.invalidate();
    utils.contacts.listArchived.invalidate();
    utils.contacts.listTrashed.invalidate();
  };

  const restoreArchivedMutation = trpc.contacts.restore.useMutation({
    onSuccess: () => {
      toast.success("Contact restored");
      invalidateContactLists();
    },
    onError: (error) => {
      toast.error("Failed to restore contact: " + error.message);
    },
  });

  const deleteToRubbishMutation = trpc.contacts.delete.useMutation({
    onSuccess: () => {
      toast.success("Deleted. You can restore this later from the Rubbish bin.");
      invalidateContactLists();
    },
    onError: (error) => {
      toast.error("Failed to delete contact: " + error.message);
    },
  });

  const handleItemAction = (action: ItemAction, contactId: number) => {
    switch (action) {
      case "restore":
        restoreArchivedMutation.mutate({ id: contactId });
        break;
      case "moveToTrash":
        setDeleteToRubbishTargetId(contactId);
        setDeleteToRubbishDialogOpen(true);
        break;
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const renderContactCard = (contact: typeof archivedContacts[0]) => (
    <Card
      key={contact.id}
      className="p-4 opacity-75"
    >
      <div className="flex items-start gap-3 mb-3">
        <div className="flex-1">
          <h3 className="font-regular text-lg">{contact.name}</h3>
          {contact.address && (
            <div className="text-gray-400 text-sm flex items-center gap-1 mt-1">
              <MapPin className="w-3 h-3" />
              {contact.address}
            </div>
          )}
        </div>
        <ItemActionsMenu
          onAction={(action) => handleItemAction(action, contact.id)}
          actions={["restore", "moveToTrash"]}
          triggerClassName="text-muted-foreground hover:text-foreground"
        />
      </div>

      <div className="space-y-2 text-sm text-gray-400">
        {contact.email && (
          <p className="flex items-center gap-2">
            <Mail className="w-3 h-3" />
            <span>{contact.email}</span>
          </p>
        )}
        {contact.phone && (
          <p className="flex items-center gap-2">
            <Phone className="w-3 h-3" />
            <span>{contact.phone}</span>
          </p>
        )}
      </div>

      {contact.notes && (
        <p className="text-muted-foreground text-xs mt-3 pt-3 border-t border-border">{contact.notes}</p>
      )}
    </Card>
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/contacts">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-5 w-5" />
          </Button>
        </Link>
        <div>
          <h1 className="text-3xl font-regular flex items-center gap-3">
            <Archive className="h-8 w-8 text-muted-foreground" />
            Archived Contacts
          </h1>
          <p className="text-gray-400 text-sm">Contacts you've archived. You can restore them anytime.</p>
        </div>
      </div>

      {/* Archived Contacts Grid */}
      <div className="space-y-4">
        {archivedContacts.length === 0 ? (
          <Card className="p-8 text-center">
            <Archive className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
            <p className="text-gray-400 mb-4">No archived contacts.</p>
            <Link href="/contacts">
              <Button variant="outline">
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back to Contacts
              </Button>
            </Link>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {archivedContacts.map((contact) => renderContactCard(contact))}
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
