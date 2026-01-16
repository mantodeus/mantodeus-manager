/**
 * Settings Page
 * 
 * Company and invoice settings for German businesses:
 * - Company information (name, address, contact)
 * - Tax information (Steuernummer, USt-IdNr)
 * - Banking details (IBAN, BIC)
 * - Invoice settings (Kleinunternehmer, VAT rate, number format)
 * - Mobile-first, dark theme with neon green highlights
 */

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { trpc } from "@/lib/trpc";
import { Loader2, Save, Building2, Receipt, CreditCard, Info, Palette, ImageIcon, User } from "@/components/ui/Icon";
import { toast } from "sonner";
import { PageHeader } from "@/components/PageHeader";
import { PageContainer } from "@/components/PageContainer";
import { useTheme } from "@/hooks/useTheme";
import { ThemeName } from "@/lib/theme";
import { LogoUploadSection } from "@/components/LogoUploadSection";
import { isDebugPanelEnabled, setDebugPanelEnabled } from "@/lib/debugPanel";

export default function Settings() {
  const { theme, switchTheme, themes } = useTheme();
  const { data: settings, isLoading, error } = trpc.settings.get.useQuery();
  const currentYear = new Date().getFullYear();

  // Preferences query - enabled after migration applied
  const { data: preferences, isLoading: preferencesLoading } = trpc.settings.preferences.get.useQuery();

  // Debug: Log any errors
  useEffect(() => {
    if (error) {
      console.error('[Settings] Error loading settings:', error);
    }
  }, [error]);

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
    streetName: "",
    streetNumber: "",
    postalCode: "",
    city: "",
    country: "",
    email: "",
    phone: "",
    steuernummer: "",
    ustIdNr: "",
    iban: "",
    bic: "",
    isKleinunternehmer: false,
    accountingMethod: "EÜR" as "EÜR" | "BILANZ",
    vatMethod: null as "IST" | "SOLL" | null,
    vatRate: "19.00",
    invoiceNumberFormat: `RE-${currentYear}-0001`,
    invoiceAccentColor: "#00ff88",
    invoiceAccountHolderName: "",
  });

  const [preferencesData, setPreferencesData] = useState({
    dateFormat: "DD.MM.YYYY",
    timeFormat: "24h" as "12h" | "24h",
    timezone: "Europe/Berlin",
    language: "en",
    currency: "EUR",
    notificationsEnabled: true,
    weekStartsOn: "monday" as "monday" | "sunday",
  });

  // Debug panel setting (stored in localStorage, not in preferences)
  const [debugPanelEnabled, setDebugPanelEnabledState] = useState(false);

  // Initialize debug panel setting from localStorage
  useEffect(() => {
    setDebugPanelEnabledState(isDebugPanelEnabled());
  }, []);

  // Initialize form when settings load
  useEffect(() => {
    if (settings) {
      setFormData({
        companyName: settings.companyName || "",
        streetName: settings.streetName || "",
        streetNumber: settings.streetNumber || "",
        postalCode: settings.postalCode || "",
        city: settings.city || "",
        country: settings.country || "",
        email: settings.email || "",
        phone: settings.phone || "",
        steuernummer: settings.steuernummer || "",
        ustIdNr: settings.ustIdNr || "",
        iban: settings.iban || "",
        bic: settings.bic || "",
        isKleinunternehmer: settings.isKleinunternehmer || false,
        accountingMethod: (settings.accountingMethod as "EÜR" | "BILANZ") || "EÜR",
        vatMethod: (settings.vatMethod as "IST" | "SOLL" | null) || null,
        vatRate: settings.vatRate || "19.00",
        invoiceNumberFormat: settings.invoiceNumberFormat || `RE-${currentYear}-0001`,
        invoiceAccentColor: settings.invoiceAccentColor || "#00ff88",
        invoiceAccountHolderName: settings.invoiceAccountHolderName || "",
      });
    }
  }, [settings, currentYear]);

  // Initialize preferences when they load
  useEffect(() => {
    if (preferences) {
      setPreferencesData({
        dateFormat: preferences.dateFormat || "DD.MM.YYYY",
        timeFormat: (preferences.timeFormat as "12h" | "24h") || "24h",
        timezone: preferences.timezone || "Europe/Berlin",
        language: preferences.language || "en",
        currency: preferences.currency || "EUR",
        notificationsEnabled: preferences.notificationsEnabled ?? true,
        weekStartsOn: (preferences.weekStartsOn as "monday" | "sunday") || "monday",
      });
    }
  }, [preferences]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await updateMutation.mutateAsync(formData);
  };

  const handlePreferencesSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const normalized = {
      dateFormat: preferencesData.dateFormat || "DD.MM.YYYY",
      timeFormat: preferencesData.timeFormat || "24h",
      timezone: preferencesData.timezone || "Europe/Berlin",
      language: preferencesData.language || "en",
      currency: preferencesData.currency || "EUR",
      notificationsEnabled: preferencesData.notificationsEnabled ?? true,
      weekStartsOn: preferencesData.weekStartsOn || "monday",
    };
    await updatePreferencesMutation.mutateAsync(normalized);
  };

  const handleChange = (field: string, value: string | boolean | null) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handlePreferenceChange = (field: string, value: string | boolean) => {
    setPreferencesData((prev) => ({ ...prev, [field]: value }));
  };

  if (isLoading || preferencesLoading) {
    return (
      <PageContainer>
        <div className="flex items-center justify-center min-h-[400px]">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </PageContainer>
    );
  }

  if (error) {
    return (
      <PageContainer>
        <div className="flex flex-col items-center justify-center min-h-[400px] gap-4">
          <div className="text-destructive">Error loading settings</div>
          <div className="text-sm text-muted-foreground">{error.message}</div>
          <Button onClick={() => window.location.reload()}>Reload Page</Button>
        </div>
      </PageContainer>
    );
  }

  return (
    <PageContainer variant="narrow">
      <PageHeader
        title="Settings"
        subtitle="Configure your company information and invoice settings"
      />

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
            Square format recommended for consistent display across PDFs and app
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
                    <SelectItem value="DD.MM.YYYY">DD.MM.YYYY (German)</SelectItem>
                    <SelectItem value="DD/MM/YYYY">DD/MM/YYYY (UK)</SelectItem>
                    <SelectItem value="YYYY-MM-DD">YYYY-MM-DD (ISO)</SelectItem>
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

              {/* Week Starts On */}
              <div className="space-y-2">
                <Label htmlFor="weekStartsOn">Week Starts On</Label>
                <Select
                  value={preferencesData.weekStartsOn}
                  onValueChange={(value) => handlePreferenceChange("weekStartsOn", value)}
                >
                  <SelectTrigger id="weekStartsOn">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="monday">Monday</SelectItem>
                    <SelectItem value="sunday">Sunday</SelectItem>
                  </SelectContent>
                </Select>
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

              {/* Debug Panel Toggle */}
              <div className="flex items-center justify-between p-4 rounded-lg border bg-muted/50">
                <div className="space-y-0.5">
                  <Label htmlFor="debugPanel" className="text-base cursor-pointer">
                    Debug Panel
                  </Label>
                  <p className="text-sm text-muted-foreground">
                    Show the debug panel button (🐛) for troubleshooting. You can also press Shift+D to toggle it.
                  </p>
                </div>
                <Switch
                  id="debugPanel"
                  checked={debugPanelEnabled}
                  onCheckedChange={(checked) => {
                    setDebugPanelEnabledState(checked);
                    setDebugPanelEnabled(checked);
                  }}
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

            <div className="grid gap-4 md:grid-cols-3">
              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="streetName">Street Name</Label>
                <Input
                  id="streetName"
                  value={formData.streetName}
                  onChange={(e) => handleChange("streetName", e.target.value)}
                  placeholder="Hauptstrasse"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="streetNumber">Street Number</Label>
                <Input
                  id="streetNumber"
                  value={formData.streetNumber}
                  onChange={(e) => handleChange("streetNumber", e.target.value)}
                  placeholder="12a"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="postalCode">Postal Code</Label>
                <Input
                  id="postalCode"
                  value={formData.postalCode}
                  onChange={(e) => handleChange("postalCode", e.target.value)}
                  placeholder="10115"
                />
              </div>
              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="city">City</Label>
                <Input
                  id="city"
                  value={formData.city}
                  onChange={(e) => handleChange("city", e.target.value)}
                  placeholder="Berlin"
                />
              </div>
              <div className="space-y-2 md:col-span-3">
                <Label htmlFor="country">Country</Label>
                <Input
                  id="country"
                  value={formData.country}
                  onChange={(e) => handleChange("country", e.target.value)}
                  placeholder="Germany"
                />
              </div>
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

            {/* Accounting Method */}
            <div className="space-y-2">
              <Label htmlFor="accountingMethod">Accounting Method</Label>
              <Select
                value={formData.accountingMethod}
                onValueChange={(value) => handleChange("accountingMethod", value as "EÜR" | "BILANZ")}
              >
                <SelectTrigger id="accountingMethod">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="EÜR">Einnahmen-Überschuss-Rechnung (EÜR)</SelectItem>
                  <SelectItem value="BILANZ">Bilanz</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                {formData.accountingMethod === "EÜR" 
                  ? "Income recognized when payment is received"
                  : "Income recognized when service is completed (service period end)"}
              </p>
            </div>

            {/* VAT Method - only shown if not Kleinunternehmer */}
            {!formData.isKleinunternehmer && (
              <div className="space-y-2">
                <Label htmlFor="vatMethod">VAT Method (optional)</Label>
                <Select
                  value={formData.vatMethod || "none"}
                  onValueChange={(value) => handleChange("vatMethod", value === "none" ? null : value as "IST" | "SOLL")}
                >
                  <SelectTrigger id="vatMethod">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Not specified</SelectItem>
                    <SelectItem value="IST">Ist-Versteuerung (cash basis)</SelectItem>
                    <SelectItem value="SOLL">Soll-Versteuerung (accrual basis)</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  VAT accounting method (only relevant if not Kleinunternehmer)
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
                <Label htmlFor="invoiceNumberFormat">Invoice Number Format</Label>
                <Input
                  id="invoiceNumberFormat"
                  value={formData.invoiceNumberFormat}
                  onChange={(e) => handleChange("invoiceNumberFormat", e.target.value)}
                  placeholder={`RE-${currentYear}-0001`}
                  maxLength={50}
                />
                <p className="text-xs text-muted-foreground">
                  Example: RE-{currentYear}-0001, INV0001, MM-24-099
                </p>
              </div>
            </div>

            <Separator />

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="invoiceAccentColor">Invoice Accent Color</Label>
                <div className="flex gap-2">
                  <Input
                    id="invoiceAccentColor"
                    type="color"
                    value={formData.invoiceAccentColor}
                    onChange={(e) => handleChange("invoiceAccentColor", e.target.value)}
                    className="w-20 h-10 cursor-pointer"
                  />
                  <Input
                    type="text"
                    value={formData.invoiceAccentColor}
                    onChange={(e) => handleChange("invoiceAccentColor", e.target.value)}
                    placeholder="#00ff88"
                    pattern="^#[0-9A-Fa-f]{6}$"
                    maxLength={7}
                    className="flex-1"
                  />
                </div>
                <p className="text-xs text-muted-foreground">
                  Color used for invoice dividers and accents (hex format)
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="invoiceAccountHolderName">Kontoinhaber (für Bankverbindung)</Label>
                <Input
                  id="invoiceAccountHolderName"
                  value={formData.invoiceAccountHolderName}
                  onChange={(e) => handleChange("invoiceAccountHolderName", e.target.value)}
                  placeholder={formData.companyName || "Account holder name"}
                  maxLength={255}
                />
                <p className="text-xs text-muted-foreground">
                  Account holder name shown in invoice footer (defaults to company name)
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
    </PageContainer>
  );
}

