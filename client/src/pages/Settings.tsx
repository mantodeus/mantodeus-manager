/**
 * Settings Page
 * 
 * Company and invoice settings for German businesses:
 * - Company information (name, address, contact)
 * - Tax information (Steuernummer, USt-IdNr)
 * - Banking details (IBAN, BIC)
 * - Invoice settings (Kleinunternehmer, VAT rate, prefix)
 * - Mobile-first, dark theme with neon green highlights
 */

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { trpc } from "@/lib/trpc";
import { Loader2, Save, Building2, Receipt, CreditCard, Info } from "lucide-react";
import { toast } from "sonner";

export default function Settings() {
  const { data: settings, isLoading } = trpc.settings.get.useQuery();
  const updateMutation = trpc.settings.update.useMutation({
    onSuccess: () => {
      toast.success("Settings saved successfully");
    },
    onError: (error) => {
      toast.error("Failed to save settings: " + error.message);
    },
  });

  const [formData, setFormData] = useState({
    companyName: "",
    address: "",
    email: "",
    phone: "",
    steuernummer: "",
    ustIdNr: "",
    iban: "",
    bic: "",
    isKleinunternehmer: false,
    vatRate: "19.00",
    invoicePrefix: "RE",
  });

  // Initialize form when settings load
  useEffect(() => {
    if (settings) {
      setFormData({
        companyName: settings.companyName || "",
        address: settings.address || "",
        email: settings.email || "",
        phone: settings.phone || "",
        steuernummer: settings.steuernummer || "",
        ustIdNr: settings.ustIdNr || "",
        iban: settings.iban || "",
        bic: settings.bic || "",
        isKleinunternehmer: settings.isKleinunternehmer || false,
        vatRate: settings.vatRate || "19.00",
        invoicePrefix: settings.invoicePrefix || "RE",
      });
    }
  }, [settings]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await updateMutation.mutateAsync(formData);
  };

  const handleChange = (field: string, value: string | boolean) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div>
        <h1 className="text-3xl font-regular">Settings</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Configure your company information and invoice settings
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Company Information */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Building2 className="h-5 w-5 text-primary" />
              <CardTitle>Company Information</CardTitle>
            </div>
            <CardDescription>
              Your company details will appear on invoices and reports
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="companyName">Company Name *</Label>
              <Input
                id="companyName"
                value={formData.companyName}
                onChange={(e) => handleChange("companyName", e.target.value)}
                placeholder="Mantodeus GmbH"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="address">Address</Label>
              <Textarea
                id="address"
                value={formData.address}
                onChange={(e) => handleChange("address", e.target.value)}
                placeholder="Street Address&#10;City, Postal Code&#10;Germany"
                rows={3}
                className="resize-none"
              />
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  value={formData.email}
                  onChange={(e) => handleChange("email", e.target.value)}
                  placeholder="info@company.de"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="phone">Phone</Label>
                <Input
                  id="phone"
                  type="tel"
                  value={formData.phone}
                  onChange={(e) => handleChange("phone", e.target.value)}
                  placeholder="+49 123 456789"
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Tax Information */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Receipt className="h-5 w-5 text-primary" />
              <CardTitle>Tax Information</CardTitle>
            </div>
            <CardDescription>
              Required for German invoicing compliance
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="steuernummer">Steuernummer</Label>
                <Input
                  id="steuernummer"
                  value={formData.steuernummer}
                  onChange={(e) => handleChange("steuernummer", e.target.value)}
                  placeholder="12/345/67890"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="ustIdNr">USt-IdNr. (VAT ID)</Label>
                <Input
                  id="ustIdNr"
                  value={formData.ustIdNr}
                  onChange={(e) => handleChange("ustIdNr", e.target.value)}
                  placeholder="DE123456789"
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Banking Details */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <CreditCard className="h-5 w-5 text-primary" />
              <CardTitle>Banking Details</CardTitle>
            </div>
            <CardDescription>
              For invoice payment instructions
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="iban">IBAN</Label>
                <Input
                  id="iban"
                  value={formData.iban}
                  onChange={(e) => handleChange("iban", e.target.value.toUpperCase())}
                  placeholder="DE89 3704 0044 0532 0130 00"
                  maxLength={34}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="bic">BIC</Label>
                <Input
                  id="bic"
                  value={formData.bic}
                  onChange={(e) => handleChange("bic", e.target.value.toUpperCase())}
                  placeholder="COBADEFFXXX"
                  maxLength={11}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Invoice Settings */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Receipt className="h-5 w-5 text-primary" />
              <CardTitle>Invoice Settings</CardTitle>
            </div>
            <CardDescription>
              Configure how invoices are generated and numbered
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Kleinunternehmer Toggle */}
            <div className="flex items-center justify-between p-4 rounded-lg border bg-muted/50">
              <div className="space-y-0.5 flex-1">
                <Label htmlFor="kleinunternehmer" className="text-base font-medium cursor-pointer">
                  Kleinunternehmerregelung
                </Label>
                <p className="text-sm text-muted-foreground">
                  Apply § 19 UStG (no VAT shown on invoices)
                </p>
              </div>
              <Switch
                id="kleinunternehmer"
                checked={formData.isKleinunternehmer}
                onCheckedChange={(checked) => handleChange("isKleinunternehmer", checked)}
              />
            </div>

            {formData.isKleinunternehmer && (
              <div className="flex items-start gap-2 p-3 rounded-lg bg-primary/10 border border-primary/20">
                <Info className="h-4 w-4 text-primary mt-0.5 shrink-0" />
                <p className="text-sm text-muted-foreground">
                  When enabled, invoices will include: "Keine Umsatzsteuer aufgrund der Kleinunternehmerregelung, § 19 UStG"
                </p>
              </div>
            )}

            <Separator />

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="vatRate">VAT Rate (%)</Label>
                <Input
                  id="vatRate"
                  type="number"
                  step="0.01"
                  min="0"
                  max="100"
                  value={formData.vatRate}
                  onChange={(e) => handleChange("vatRate", e.target.value)}
                  placeholder="19.00"
                  disabled={formData.isKleinunternehmer}
                />
                {formData.isKleinunternehmer && (
                  <p className="text-xs text-muted-foreground">
                    VAT rate is disabled when Kleinunternehmerregelung is active
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="invoicePrefix">Invoice Prefix</Label>
                <Input
                  id="invoicePrefix"
                  value={formData.invoicePrefix}
                  onChange={(e) => handleChange("invoicePrefix", e.target.value.toUpperCase())}
                  placeholder="RE"
                  maxLength={10}
                />
                <p className="text-xs text-muted-foreground">
                  Invoice numbers will be: {formData.invoicePrefix}-{new Date().getFullYear()}-0001
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Save Button */}
        <div className="flex justify-end gap-2 pt-4 border-t">
          <Button
            type="submit"
            disabled={updateMutation.isPending}
            className="bg-primary text-primary-foreground hover:bg-primary/90"
          >
            {updateMutation.isPending ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <Save className="h-4 w-4 mr-2" />
                Save Settings
              </>
            )}
          </Button>
        </div>
      </form>
    </div>
  );
}

