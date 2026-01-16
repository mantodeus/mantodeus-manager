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
import { ArrowLeft, Archive, Building2, Loader2, Mail, MapPin, Phone, User } from "@/components/ui/Icon";
import { Link, useLocation } from "wouter";
import { useState } from "react";
import { ItemActionsMenu, ItemAction } from "@/components/ItemActionsMenu";
import { toast } from "sonner";
import { DeleteConfirmDialog } from "@/components/DeleteConfirmDialog";
import { ModulePage } from "@/components/ModulePage";

export default function ContactsArchived() {
  const [, setLocation] = useLocation();
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
      toast.success("Deleted. You can restore this later from the Rubbish.");
      invalidateContactLists();
    },
    onError: (error) => {
      toast.error("Failed to delete contact: " + error.message);
    },
  });

  const handleItemAction = (action: ItemAction, contactId: number) => {
    switch (action) {
      case "edit":
        // "Edit" maps to "restore" for archived contacts
        restoreArchivedMutation.mutate({ id: contactId });
        break;
      case "duplicate":
        toast.info("Duplicate is coming soon.");
        break;
      case "select":
        toast.info("Selection mode is coming soon.");
        break;
      case "archive":
        // Archive not available for already-archived items
        break;
      case "delete":
        // "Delete" maps to "moveToTrash" for archived contacts
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

  const getDisplayName = (contact: typeof archivedContacts[0]) =>
    contact.clientName || contact.name || "Contact";

  const getPreviewAddress = (contact: typeof archivedContacts[0]) => {
    const streetLine = [contact.streetName, contact.streetNumber].filter(Boolean).join(" ").trim();
    const cityLine = [contact.postalCode, contact.city].filter(Boolean).join(" ").trim();
    if (!streetLine && !cityLine) return null;
    return [streetLine, cityLine].filter(Boolean).join(", ");
  };

  const getMapAddress = (contact: typeof archivedContacts[0]) => {
    const streetLine = [contact.streetName, contact.streetNumber].filter(Boolean).join(" ").trim();
    const cityLine = [contact.postalCode, contact.city].filter(Boolean).join(" ").trim();
    const parts = [streetLine, cityLine, contact.country].filter(Boolean);
    if (parts.length === 0) return contact.address;
    return parts.join(", ");
  };

  const renderContactRow = (contact: typeof archivedContacts[0]) => {
    const displayName = getDisplayName(contact);
    
    const ContactIcon = contact.type === "business" ? Building2 : User;

    return (
      <div key={contact.id} className="rounded-lg border opacity-75">
        <div className="flex items-center gap-3 px-4 py-3">
          <div className="flex-1 min-w-0 flex items-center gap-2">
            <ContactIcon className="h-5 w-5 text-muted-foreground flex-shrink-0" />
            <div className="text-base font-regular break-words">{displayName}</div>
          </div>
          <div className="flex items-center gap-1">
            <ItemActionsMenu
              onAction={(action) => handleItemAction(action, contact.id)}
              actions={["edit", "duplicate", "select", "delete"]}
              triggerClassName="h-11 w-11 text-muted-foreground hover:text-foreground"
              size="lg"
            />
          </div>
        </div>
      </div>
    );
  };

  return (
    <ModulePage
      title="Archived"
      subtitle="Contacts you've archived. You can restore them anytime."
      leading={
        <Link href="/contacts">
          <Button variant="ghost" size="icon" className="size-9 [&_svg]:size-6">
            <ArrowLeft className="h-5 w-5" />
          </Button>
        </Link>
      }
    >

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
          <div className="space-y-3">
            {archivedContacts.map((contact) => renderContactRow(contact))}
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
        description={"Are you sure?\nYou can restore this later from the Rubbish."}
        confirmLabel="Delete"
        isDeleting={deleteToRubbishMutation.isPending}
      />
    </ModulePage>
  );
}
