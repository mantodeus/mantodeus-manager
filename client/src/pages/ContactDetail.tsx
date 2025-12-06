import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { trpc } from "@/lib/trpc";
import { ArrowLeft, Mail, Map, MapPin, Phone, StickyNote, Trash2 } from "lucide-react";
import { useMemo } from "react";
import { Link, useRoute, useLocation } from "wouter";
import { toast } from "sonner";

export default function ContactDetail() {
  const [, params] = useRoute("/contacts/:id");
  const [location, navigate] = useLocation();
  const contactId = params?.id ? parseInt(params.id, 10) : 0;

  const searchParams = useMemo(() => {
    if (typeof window === "undefined") {
      return new URLSearchParams();
    }
    return new URLSearchParams(window.location.search);
  }, [location]);

  const backParam = searchParams.get("back");
  const backLabelParam = searchParams.get("backLabel");
  const backTarget =
    backParam && backParam.startsWith("/") ? backParam : "/contacts";
  const backLabel = backLabelParam || (backTarget.startsWith("/projects") ? "Projects" : "Contacts");

  const { data: contact, isLoading } = trpc.contacts.getById.useQuery(
    { id: contactId },
    { enabled: contactId > 0 }
  );

  const deleteContact = trpc.contacts.delete.useMutation({
    onSuccess: () => {
      toast.success("Contact deleted successfully");
      navigate(backTarget);
    },
    onError: (error) => {
      toast.error(`Failed to delete contact: ${error.message}`);
    },
  });

  const handleDelete = () => {
    if (!contactId) return;
    if (confirm("Delete this contact? This action cannot be undone.")) {
      deleteContact.mutate({ id: contactId });
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  if (!contact) {
    return (
      <div className="space-y-6">
        <Link href={backTarget}>
          <Button variant="ghost">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to {backLabel}
          </Button>
        </Link>
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <p className="text-muted-foreground">Contact not found</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const mapLink =
    contact.latitude && contact.longitude
      ? `/maps?contactId=${contact.id}`
      : null;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <Link href={backTarget}>
          <Button variant="ghost">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to {backLabel}
          </Button>
        </Link>
        <div className="flex gap-2">
          <Link href="/contacts">
            <Button variant="outline">
              Manage in Contacts
            </Button>
          </Link>
          <Button
            variant="destructive"
            onClick={handleDelete}
            disabled={deleteContact.isPending}
            className="gap-2"
          >
            {deleteContact.isPending ? (
              <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
            ) : (
              <Trash2 className="h-4 w-4" />
            )}
            Delete
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-3xl">{contact.name}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid gap-4 md:grid-cols-2">
            {contact.email && (
              <div className="flex items-center gap-3">
                <Mail className="h-4 w-4 text-muted-foreground" />
                <a
                  href={`mailto:${contact.email}`}
                  className="text-primary hover:underline"
                >
                  {contact.email}
                </a>
              </div>
            )}
            {contact.phone && (
              <div className="flex items-center gap-3">
                <Phone className="h-4 w-4 text-muted-foreground" />
                <a
                  href={`tel:${contact.phone}`}
                  className="text-primary hover:underline"
                >
                  {contact.phone}
                </a>
              </div>
            )}
            {contact.address && (
              <div className="flex items-center gap-3 md:col-span-2">
                <MapPin className="h-4 w-4 text-muted-foreground" />
                <span>{contact.address}</span>
              </div>
            )}
          </div>

          {contact.notes && (
            <div className="flex items-start gap-3">
              <StickyNote className="h-4 w-4 text-muted-foreground mt-1" />
              <p className="text-muted-foreground whitespace-pre-wrap">
                {contact.notes}
              </p>
            </div>
          )}

          {mapLink && (
            <Link href={mapLink}>
              <Button variant="outline" className="gap-2">
                <Map className="h-4 w-4" />
                View on Map
              </Button>
            </Link>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
