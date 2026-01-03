import { InvoiceForm } from "@/components/invoices/InvoiceForm";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { trpc } from "@/lib/trpc";
import { ArrowLeft } from "@/components/ui/Icon";
import { Link, useLocation } from "wouter";
import { toast } from "sonner";
import { PageHeader } from "@/components/PageHeader";

export default function InvoiceCreate() {
  const [, navigate] = useLocation();
  const utils = trpc.useUtils();
  const { data: contacts = [] } = trpc.contacts.list.useQuery();

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
          <h1 className="text-3xl font-regular">Create Invoice</h1>
          <p className="text-muted-foreground text-sm">Create a new invoice</p>
        </div>
      </div>

      <Card className="w-full">
        <CardHeader>
          <CardTitle>Invoice Details</CardTitle>
        </CardHeader>
        <CardContent>
          <InvoiceForm
            mode="create"
            contacts={contacts}
            onClose={() => navigate("/invoices")}
            onSuccess={async () => {
              toast.success("Invoice created");
              await utils.invoices.list.invalidate();
              navigate("/invoices");
            }}
          />
        </CardContent>
      </Card>
    </div>
  );
}
