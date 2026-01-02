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
import { ArrowLeft, Archive, Building2, ChevronDown, Loader2, Mail, MapPin, Phone, User } from "@/components/ui/Icon";
import { Link, useLocation } from "wouter";
import { useState } from "react";
import { ItemActionsMenu, ItemAction } from "@/components/ItemActionsMenu";
import { toast } from "sonner";
import { DeleteConfirmDialog } from "@/components/DeleteConfirmDialog";
import { PageHeader } from "@/components/PageHeader";

export default function ContactsArchived() {
  const [, setLocation] = useLocation();
  const { data: archivedContacts = [], isLoading } = trpc.contacts.listArchived.useQuery();
  const utils = trpc.useUtils();
  const [expandedContactId, setExpandedContactId] = useState<number | null>(null);

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
      case "duplicate":
        toast.info("Duplicate is coming soon.");
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
    const isExpanded = expandedContactId === contact.id;
    const displayName = getDisplayName(contact);
    const previewAddress = getPreviewAddress(contact);
    const mapAddress = getMapAddress(contact);
    
    // Get emails and phone numbers from new array format or fallback to single values
    const emails = (contact.emails as Array<{ label: string; value: string }> | null) || 
      (contact.email ? [{ label: "Email", value: contact.email }] : []);
    const phoneNumbers = (contact.phoneNumbers as Array<{ label: string; value: string }> | null) || 
      (contact.phoneNumber || contact.phone ? [{ label: "Phone", value: contact.phoneNumber || contact.phone || "" }] : []);
    
    const ContactIcon = contact.type === "business" ? Building2 : User;

    return (
      <div key={contact.id} className="rounded-lg border opacity-75">
        <div className="flex items-center gap-3 px-4 py-3">
          <div className="flex-1 min-w-0 flex items-center gap-2">
            <ContactIcon className="h-5 w-5 text-muted-foreground flex-shrink-0" />
            <div className="truncate text-base font-regular">{displayName}</div>
          </div>
          <div className="flex items-center gap-1">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-11 w-11"
              aria-expanded={isExpanded}
              onClick={() => setExpandedContactId(isExpanded ? null : contact.id)}
            >
              <ChevronDown
                className={`h-5 w-5 transition-transform ${isExpanded ? "rotate-180" : ""}`}
              />
            </Button>
            <ItemActionsMenu
              onAction={(action) => handleItemAction(action, contact.id)}
              actions={["restore", "duplicate", "moveToTrash"]}
              triggerClassName="h-11 w-11 text-muted-foreground hover:text-foreground"
              size="lg"
            />
          </div>
        </div>

        <div
          className={`grid transition-[grid-template-rows] duration-200 ease-out ${
            isExpanded ? "grid-rows-[1fr]" : "grid-rows-[0fr]"
          }`}
        >
          <div className="overflow-hidden">
            <div className="flex flex-col gap-2 px-4 pb-3">
              {previewAddress && (
                <button
                  type="button"
                  className="flex min-h-11 w-full items-center gap-2 rounded-md px-2 py-2 text-left text-sm text-muted-foreground transition-colors hover:text-foreground"
                  onClick={() => {
                    if (!mapAddress) return;
                    setLocation(`/maps?address=${encodeURIComponent(mapAddress)}`);
                  }}
                >
                  <MapPin className="h-4 w-4" />
                  <span className="truncate">{previewAddress}</span>
                </button>
              )}
              {emails.map((emailItem, idx) => (
                <a
                  key={idx}
                  href={`mailto:${emailItem.value}`}
                  className="flex min-h-11 w-full items-center gap-2 rounded-md px-2 py-2 text-left text-sm text-muted-foreground transition-colors hover:text-foreground"
                >
                  <Mail className="h-4 w-4" />
                  <div className="flex-1 min-w-0">
                    {emailItem.label !== "Email" && (
                      <div className="text-xs text-muted-foreground/70">{emailItem.label}</div>
                    )}
                    <span className="truncate">{emailItem.value}</span>
                  </div>
                </a>
              ))}
              {phoneNumbers.map((phoneItem, idx) => (
                <a
                  key={idx}
                  href={`tel:${phoneItem.value}`}
                  className="flex min-h-11 w-full items-center gap-2 rounded-md px-2 py-2 text-left text-sm text-muted-foreground transition-colors hover:text-foreground"
                >
                  <Phone className="h-4 w-4" />
                  <div className="flex-1 min-w-0">
                    {phoneItem.label !== "Phone" && (
                      <div className="text-xs text-muted-foreground/70">{phoneItem.label}</div>
                    )}
                    <span className="truncate">{phoneItem.value}</span>
                  </div>
                </a>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title={
          <span className="flex items-center gap-3">
            <Archive className="h-8 w-8 text-muted-foreground" />
            Archived Contacts
          </span>
        }
        subtitle="Contacts you've archived. You can restore them anytime."
        leading={
          <Link href="/contacts">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-5 w-5" />
            </Button>
          </Link>
        }
      />

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
        description={"Are you sure?\nYou can restore this later from the Rubbish bin."}
        confirmLabel="Delete"
        isDeleting={deleteToRubbishMutation.isPending}
      />
    </div>
  );
}
