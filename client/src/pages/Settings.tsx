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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { trpc } from "@/lib/trpc";
import { Loader2, Save, Building2, Receipt, CreditCard, Info, Palette, ImageIcon, User } from "lucide-react";
import { toast } from "sonner";
import { useTheme } from "@/hooks/useTheme";
import { ThemeName } from "@/lib/theme";
import { LogoUploadSection } from "@/components/LogoUploadSection";

export default function Settings() {
  const { theme, switchTheme, themes } = useTheme();
  const { data: settings, isLoading } = trpc.settings.get.useQuery();
  const { data: preferences, isLoading: preferencesLoading } = trpc.settings.preferences.get.useQuery();

  const updateMutation = trpc.settings.update.useMutation({
    onSuccess: () => {
      toast.success("Settings saved successfully");
    },
    onError: (error) => {
      toast.error("Failed to save settings: " + error.message);
    },
  });

  const updatePreferencesMutation = trpc.settings.preferences.update.useMutation({
    onSuccess: () => {
      toast.success("Preferences saved successfully");
    },
    onError: (error) => {
      toast.error("Failed to save preferences: " + error.message);
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

  const [preferencesData, setPreferencesData] = useState({
    dateFormat: "MM/DD/YYYY",
    timeFormat: "12h" as "12h" | "24h",
    timezone: "UTC",
    language: "en",
    currency: "EUR",
    notificationsEnabled: true,
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

  // Initialize preferences when they load
  useEffect(() => {
    if (preferences) {
      setPreferencesData({
        dateFormat: preferences.dateFormat || "MM/DD/YYYY",
        timeFormat: (preferences.timeFormat as "12h" | "24h") || "12h",
        timezone: preferences.timezone || "UTC",
        language: preferences.language || "en",
        currency: preferences.currency || "EUR",
        notificationsEnabled: preferences.notificationsEnabled ?? true,
      });
    }
  }, [preferences]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await updateMutation.mutateAsync(formData);
  };

  const handlePreferencesSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await updatePreferencesMutation.mutateAsync(preferencesData);
  };

  const handleChange = (field: string, value: string | boolean) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handlePreferenceChange = (field: string, value: string | boolean) => {
    setPreferencesData((prev) => ({ ...prev, [field]: value }));
  };

  if (isLoading || preferencesLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-regular">Settings</h1>
          <p className="text-muted-foreground text-sm">Configure your company information and invoice settings</p>
        </div>
      </div>

      {/* Theme Settings */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Palette className="h-5 w-5 text-primary" />
            <CardTitle>Theme</CardTitle>
          </div>
          <CardDescription>
            Choose your preferred visual theme
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3">
            {(Object.keys(themes) as ThemeName[]).map((themeName) => {
              const themeConfig = themes[themeName];
              const isSelected = theme === themeName;
              
              return (
                <button
                  key={themeName}
                  type="button"
                  onClick={() => switchTheme(themeName)}
                  className={
                    `relative flex items-start gap-4 p-4 rounded-lg border-2 transition-all ${
                      isSelected
                        ? 'border-primary bg-primary/5'
                        : 'border-border hover:border-primary/50 bg-card'
                    }`
                  }
                >
                  {/* Radio indicator */}
                  <div className="flex items-center justify-center w-5 h-5 mt-0.5 shrink-0">
                    <div
                      className={
                        `w-4 h-4 rounded-full border-2 transition-all ${
                          isSelected
                            ? 'border-primary bg-primary'
                            : 'border-muted-foreground/50'
                        }`
                      }
                    >
                      {isSelected && (
                        <div className="w-full h-full rounded-full bg-primary-foreground scale-50" />
                      )}
                    </div>
                  </div>
                  
                  {/* Theme info */}
                  <div className="flex-1 text-left">
                    <div className="text-base">
                      {themeConfig.displayName}
                    </div>
                    <p className="text-sm text-muted-foreground mt-0.5">
                      {themeConfig.description}
                    </p>
                  </div>
                  
                  {/* Visual preview */}
                  <div className="flex gap-1.5 shrink-0">
                    <div className="w-6 h-6 rounded-md" style={{ background: themeConfig.tokens.accentStart }} />
                    <div className="w-6 h-6 rounded-md" style={{ background: themeConfig.tokens.accentMid }} />
                    <div className="w-6 h-6 rounded-md" style={{ background: themeConfig.tokens.accentEnd }} />
                  </div>
                </button>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Logo Upload Section */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <ImageIcon className="h-5 w-5 text-primary" />
            <CardTitle>Company Logo</CardTitle>
          </div>
          <CardDescription>
            Logo appears on invoices and reports (max 800x200px)
          </CardDescription>
        </CardHeader>
        <CardContent>
          <LogoUploadSection />
        </CardContent>
      </Card>

      {/* User Preferences Section */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <User className="h-5 w-5 text-primary" />
            <CardTitle>User Preferences</CardTitle>
          </div>
          <CardDescription>
            Customize your personal display and formatting preferences
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handlePreferencesSubmit} className="space-y-6">
            <div className="grid gap-4 md:grid-cols-2">
              {/* Date Format */}
              <div className="space-y-2">
                <Label htmlFor="dateFormat">Date Format</Label>
                <Select
                  value={preferencesData.dateFormat}
                  onValueChange={(value) => handlePreferenceChange("dateFormat", value)}
                >
                  <SelectTrigger id="dateFormat">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="MM/DD/YYYY">MM/DD/YYYY</SelectItem>
                    <SelectItem value="DD/MM/YYYY">DD/MM/YYYY</SelectItem>
                    <SelectItem value="YYYY-MM-DD">YYYY-MM-DD</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Time Format */}
              <div className="space-y-2">
                <Label htmlFor="timeFormat">Time Format</Label>
                <RadioGroup
                  value={preferencesData.timeFormat}
                  onValueChange={(value) => handlePreferenceChange("timeFormat", value)}
                  className="flex gap-4"
                >
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="12h" id="12h" />
                    <Label htmlFor="12h" className="font-normal cursor-pointer">12-hour</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="24h" id="24h" />
                    <Label htmlFor="24h" className="font-normal cursor-pointer">24-hour</Label>
                  </div>
                </RadioGroup>
              </div>

              {/* Timezone */}
              <div className="space-y-2">
                <Label htmlFor="timezone">Timezone</Label>
                <Select
                  value={preferencesData.timezone}
                  onValueChange={(value) => handlePreferenceChange("timezone", value)}
                >
                  <SelectTrigger id="timezone">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="UTC">UTC</SelectItem>
                    <SelectItem value="Europe/Berlin">Europe/Berlin</SelectItem>
                    <SelectItem value="Europe/London">Europe/London</SelectItem>
                    <SelectItem value="Europe/Paris">Europe/Paris</SelectItem>
                    <SelectItem value="America/New_York">America/New York</SelectItem>
                    <SelectItem value="America/Los_Angeles">America/Los Angeles</SelectItem>
                    <SelectItem value="Asia/Tokyo">Asia/Tokyo</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Language */}
              <div className="space-y-2">
                <Label htmlFor="language">Language</Label>
                <Select
                  value={preferencesData.language}
                  onValueChange={(value) => handlePreferenceChange("language", value)}
                >
                  <SelectTrigger id="language">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="en">English</SelectItem>
                    <SelectItem value="de">Deutsch</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Currency */}
              <div className="space-y-2">
                <Label htmlFor="currency">Currency</Label>
                <Select
                  value={preferencesData.currency}
                  onValueChange={(value) => handlePreferenceChange("currency", value)}
                >
                  <SelectTrigger id="currency">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="EUR">EUR (€)</SelectItem>
                    <SelectItem value="USD">USD ($)</SelectItem>
                    <SelectItem value="GBP">GBP (£)</SelectItem>
                    <SelectItem value="CHF">CHF</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Notifications */}
              <div className="flex items-center justify-between p-4 rounded-lg border bg-muted/50">
                <div className="space-y-0.5">
                  <Label htmlFor="notifications" className="text-base cursor-pointer">
                    Notifications
                  </Label>
                  <p className="text-sm text-muted-foreground">
                    Enable email notifications
                  </p>
                </div>
                <Switch
                  id="notifications"
                  checked={preferencesData.notificationsEnabled}
                  onCheckedChange={(checked) => handlePreferenceChange("notificationsEnabled", checked)}
                />
              </div>
            </div>

            {/* Save Button */}
            <div className="flex justify-end">
              <Button
                type="submit"
                disabled={updatePreferencesMutation.isPending}
                className="bg-primary text-primary-foreground hover:bg-primary/90"
              >
                {updatePreferencesMutation.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    <Save className="h-4 w-4 mr-2" />
                    Save Preferences
                  </>
                )}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

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
                <Label htmlFor="kleinunternehmer" className="text-base cursor-pointer">
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

