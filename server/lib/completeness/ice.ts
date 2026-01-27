import type { Invoice } from "../../../drizzle/schema";

export interface InvoiceSnapshot {
  invoiceNumber?: string | null;
  issueDate?: Date | null;
  dueDate?: Date | null;
  servicePeriodStart?: Date | null;
  servicePeriodEnd?: Date | null;
  total: number;
  items: Array<{ name?: string; quantity?: number; unitPrice?: number }>;
  recipientName?: string | null;
  recipientAddress?: string | null;
}

export interface CompanySnapshot {
  legalName?: string | null;
  address?: string | null;
  taxNumber?: string | null;
  vatId?: string | null;
}

export interface SettingsSnapshot {
  isKleinunternehmer: boolean;
}

export interface Blocker {
  ruleId: string;
  message: string;
  field?: string;
}

export interface CompletenessResult {
  stage: "INCOMPLETE" | "NEEDS_REVIEW" | "READY_TO_SEND";
  percent: number;
  blockers: Blocker[];
  warnings: Blocker[];
  allowedActions: ("SAVE" | "PREVIEW" | "SEND")[];
}

type BlockedAction = "PREVIEW" | "SEND";

export function evaluateInvoiceCompleteness(
  invoice: InvoiceSnapshot,
  company: CompanySnapshot,
  settings: SettingsSnapshot
): CompletenessResult {
  const blockers: Blocker[] = [];
  const warnings: Blocker[] = [];
  const blockedActions = new Set<BlockedAction>();
  const totalRules = 10;
  let passedRules = 0;

  const addBlocker = (ruleId: string, message: string, actions: BlockedAction[], field?: string) => {
    blockers.push({ ruleId, message, field });
    actions.forEach((action) => blockedActions.add(action));
  };

  const invoiceNumberOk = Boolean(invoice.invoiceNumber?.trim());
  if (!invoiceNumberOk) {
    addBlocker("INVOICE_NUMBER_MISSING", "Invoice number is required", ["SEND"], "invoiceNumber");
  } else {
    passedRules += 1;
  }

  const issueDateOk = Boolean(invoice.issueDate);
  if (!issueDateOk) {
    addBlocker("ISSUE_DATE_MISSING", "Issue date is required", ["SEND"], "issueDate");
  } else {
    passedRules += 1;
  }

  const dueDateOk = Boolean(invoice.dueDate);
  if (!dueDateOk) {
    addBlocker("DUE_DATE_MISSING", "Due date is required", ["SEND"], "dueDate");
  } else {
    passedRules += 1;
  }

  const totalOk = Number(invoice.total) > 0;
  if (!totalOk) {
    addBlocker("TOTAL_INVALID", "Invoice total must be greater than 0", ["SEND"], "total");
  } else {
    passedRules += 1;
  }

  const hasValidLineItem = (invoice.items || []).some((item) => {
    const name = item.name?.trim();
    const quantity = Number(item.quantity);
    const unitPrice = Number(item.unitPrice);
    return Boolean(name) && Number.isFinite(quantity) && quantity > 0 && Number.isFinite(unitPrice) && unitPrice >= 0;
  });
  if (!hasValidLineItem) {
    addBlocker("NO_VALID_LINE_ITEMS", "At least one valid line item is required", ["SEND", "PREVIEW"], "items");
  } else {
    passedRules += 1;
  }

  let servicePeriodOk = true;
  if (!invoice.servicePeriodStart && !invoice.servicePeriodEnd) {
    servicePeriodOk = false;
    addBlocker("SERVICE_PERIOD_INVALID", "Service date or period is required", ["SEND"], "servicePeriodStart");
  } else if (!invoice.servicePeriodStart && invoice.servicePeriodEnd) {
    servicePeriodOk = false;
    addBlocker(
      "SERVICE_PERIOD_INVALID",
      "Service period end requires a start date",
      ["SEND"],
      "servicePeriodEnd"
    );
  } else if (
    invoice.servicePeriodStart &&
    invoice.servicePeriodEnd &&
    invoice.servicePeriodEnd < invoice.servicePeriodStart
  ) {
    servicePeriodOk = false;
    addBlocker(
      "SERVICE_PERIOD_INVALID",
      "Service period end cannot be before start",
      ["SEND"],
      "servicePeriodEnd"
    );
  }
  if (servicePeriodOk) {
    passedRules += 1;
  }

  const missingCompanyName = !company.legalName?.trim();
  const missingCompanyAddress = !company.address?.trim();
  const companyOk = !(missingCompanyName || missingCompanyAddress);
  if (!companyOk) {
    if (missingCompanyName) {
      addBlocker("ISSUER_IDENTITY_INCOMPLETE", "Company name is required", ["SEND", "PREVIEW"], "legalName");
    }
    if (missingCompanyAddress) {
      addBlocker("ISSUER_IDENTITY_INCOMPLETE", "Company address is required", ["SEND", "PREVIEW"], "address");
    }
  } else {
    passedRules += 1;
  }

  const hasTaxId = Boolean(company.taxNumber?.trim() || company.vatId?.trim());
  const taxIdOk = settings.isKleinunternehmer || hasTaxId;
  if (!taxIdOk) {
    addBlocker("TAX_ID_MISSING", "Tax number or VAT ID is required", ["SEND", "PREVIEW"]);
  } else {
    passedRules += 1;
  }

  const recipientNameOk = Boolean(invoice.recipientName?.trim());
  if (!recipientNameOk) {
    addBlocker("RECIPIENT_MISSING", "Recipient name is required", ["SEND"], "recipientName");
  } else {
    passedRules += 1;
  }

  const recipientAddressOk = Boolean(invoice.recipientAddress?.trim());
  if (!recipientAddressOk) {
    addBlocker("RECIPIENT_ADDRESS_MISSING", "Recipient address is required", ["SEND"], "recipientAddress");
  } else {
    passedRules += 1;
  }

  const percent = (passedRules / totalRules) * 100;
  const allowedActions: ("SAVE" | "PREVIEW" | "SEND")[] = ["SAVE"];
  if (!blockedActions.has("PREVIEW")) {
    allowedActions.push("PREVIEW");
  }
  if (!blockedActions.has("SEND")) {
    allowedActions.push("SEND");
  }

  const stage = allowedActions.includes("SEND")
    ? "READY_TO_SEND"
    : allowedActions.includes("PREVIEW")
    ? "NEEDS_REVIEW"
    : "INCOMPLETE";

  return {
    stage,
    percent,
    blockers,
    warnings,
    allowedActions,
  };
}

export function buildInvoiceSnapshot(
  invoice: Invoice,
  contact: { name: string; address?: string | null } | null
): InvoiceSnapshot {
  return {
    invoiceNumber: invoice.invoiceNumber,
    issueDate: invoice.issueDate,
    dueDate: invoice.dueDate,
    servicePeriodStart: invoice.servicePeriodStart,
    servicePeriodEnd: invoice.servicePeriodEnd,
    total: Number(invoice.total || 0),
    items: (invoice.items as any[]) || [],
    recipientName: contact?.name,
    recipientAddress: contact?.address,
  };
}

export function buildCompanySnapshot(companySettings: {
  companyName?: string | null;
  address?: string | null;
  steuernummer?: string | null;
  ustIdNr?: string | null;
}): CompanySnapshot {
  return {
    legalName: companySettings.companyName,
    address: companySettings.address,
    taxNumber: companySettings.steuernummer,
    vatId: companySettings.ustIdNr,
  };
}

export function buildSettingsSnapshot(companySettings: { isKleinunternehmer?: boolean }): SettingsSnapshot {
  return {
    isKleinunternehmer: companySettings.isKleinunternehmer ?? false,
  };
}
