import { InvoiceForm } from "@/components/invoices/InvoiceForm";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { trpc } from "@/lib/trpc";
import { ArrowLeft, Loader2 } from "@/components/ui/Icon";
import { Link, useLocation, useRoute } from "wouter";
import { toast } from "sonner";
import { PageHeader } from "@/components/PageHeader";

export default function InvoiceDetail() {
  const [, params] = useRoute("/invoices/:id");
  const [, navigate] = useLocation();
  const invoiceId = params?.id ? parseInt(params.id) : null;

  const utils = trpc.useUtils();
  const { data: contacts = [] } = trpc.contacts.list.useQuery();
  const { data: invoice, isLoading } = trpc.invoices.get.useQuery(
    { id: invoiceId! },
    { enabled: !!invoiceId }
  );

  if (!invoiceId || Number.isNaN(invoiceId)) {
    navigate("/invoices");
    return null;
  }

  if (isLoading && !invoice) {
    return (
      <div className="space-y-6">
        <PageHeader />
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </div>
    );
  }

  const title = invoice?.invoiceName || invoice?.invoiceNumber || "Invoice";

  return (
    <div className="space-y-6">
      <PageHeader />
      <div className="flex items-center gap-4">
        <Link href="/invoices">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div>
          <h1 className="text-3xl font-regular">{title}</h1>
          <p className="text-muted-foreground text-sm">View and edit invoice details</p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Edit Invoice</CardTitle>
        </CardHeader>
        <CardContent>
          <InvoiceForm
            mode="edit"
            invoiceId={invoiceId}
            contacts={contacts}
            onClose={() => navigate("/invoices")}
            onSuccess={async () => {
              toast.success("Invoice updated");
              await utils.invoices.list.invalidate();
              await utils.invoices.listNeedsReview.invalidate();
            }}
            onOpenInvoice={(nextId) => navigate(`/invoices/${nextId}`)}
          />
        </CardContent>
      </Card>
    </div>
  );
}
