import type { CompanySettings } from '../../drizzle/schema';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load embedded base64 Kanit fonts (deterministic, no external requests)
const kanitFontsCSS = fs.readFileSync(
  path.join(__dirname, 'kanit-fonts-base64.css'),
  'utf-8'
);

interface InvoiceClient {
  name: string;
  address: string | null;
}

interface InvoiceData {
  invoiceNumber: string;
  invoiceDate: Date;
  dueDate: Date;
  company: CompanySettings;
  client: InvoiceClient | null;
  items: Array<{
    description: string;
    quantity: number;
    unitPrice: number;
    total: number;
    vatRate?: number;
  }>;
  subtotal: number;
  vatAmount: number;
  total: number;
  notes?: string;
  terms?: string;
  logoUrl?: string;
  servicePeriodStart?: Date | null;
  servicePeriodEnd?: Date | null;
}

export function generateInvoiceHTML(data: InvoiceData): { html: string; footerTemplate: string } {
  const { 
    invoiceNumber, 
    invoiceDate, 
    dueDate, 
    company, 
    client, 
    items, 
    subtotal, 
    vatAmount, 
    total, 
    notes, 
    terms,
    logoUrl = '',
    servicePeriodStart,
    servicePeriodEnd
  } = data;

  const formatDate = (date: Date | string | null | undefined) => {
    if (!date) return '';
    const d = typeof date === 'string' ? new Date(date) : date;
    return d.toLocaleDateString('de-DE');
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('de-DE', {
      style: 'currency',
      currency: 'EUR',
    }).format(amount);
  };

  const escapeHtml = (text: string | null | undefined) => {
    if (!text) return '';
    return String(text)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  };

  // Get accent color from company settings, default to #00ff88
  const accentColor = (company.invoiceAccentColor && typeof company.invoiceAccentColor === 'string') 
    ? company.invoiceAccentColor 
    : '#00ff88';
  
  // Convert hex color to rgba for gradient (handles various hex formats)
  const hexToRgba = (hex: string | null | undefined, alpha: number): string => {
    // Handle null/undefined/empty
    if (!hex || typeof hex !== 'string') {
      return `rgba(0, 255, 136, ${alpha})`; // Default green
    }
    
    // Normalize hex color - remove # if present, ensure it's 6 characters
    let normalizedHex = hex.replace('#', '').trim();
    
    // Handle 3-character hex (e.g., #f88 -> #ff8888)
    if (normalizedHex.length === 3) {
      normalizedHex = normalizedHex.split('').map(char => char + char).join('');
    }
    
    // If still not 6 characters, use default
    if (normalizedHex.length !== 6) {
      return `rgba(0, 255, 136, ${alpha})`; // Default green
    }
    
    try {
      const r = parseInt(normalizedHex.slice(0, 2), 16);
      const g = parseInt(normalizedHex.slice(2, 4), 16);
      const b = parseInt(normalizedHex.slice(4, 6), 16);
      
      // Validate parsed values
      if (isNaN(r) || isNaN(g) || isNaN(b)) {
        return `rgba(0, 255, 136, ${alpha})`; // Default green
      }
      
      return `rgba(${r}, ${g}, ${b}, ${alpha})`;
    } catch (error) {
      // Fallback to default green if parsing fails
      return `rgba(0, 255, 136, ${alpha})`;
    }
  };
  
  // Pre-compute rgba values for gradient to avoid issues in template string
  const gradientStart = hexToRgba(accentColor, 0);
  const gradientMiddle = hexToRgba(accentColor, 1);
  const gradientEnd = hexToRgba(accentColor, 0);
  
  // Format address from structured fields or fallback to address text
  const formatCompanyAddress = () => {
    if (company.address) {
      return escapeHtml(company.address).replace(/\n/g, '<br>');
    }
    const parts: string[] = [];
    if (company.streetName && company.streetNumber) {
      parts.push(`${escapeHtml(company.streetName)} ${escapeHtml(company.streetNumber)}`);
    }
    if (company.postalCode && company.city) {
      parts.push(`${escapeHtml(company.postalCode)} ${escapeHtml(company.city)}`);
    }
    if (company.country) {
      parts.push(escapeHtml(company.country));
    }
    return parts.join('<br>');
  };

  // Format client address
  const formatClientAddress = () => {
    if (!client || !client.address) return '';
    return escapeHtml(client.address).replace(/\n/g, '<br>');
  };

  // Build items table rows with VAT rate column
  // Parse description to separate title and description (format: "Title - Description")
  const itemsHTML = items
    .map((item) => {
      const vatRate = company.isKleinunternehmer ? 0 : (item.vatRate ?? Number(company.vatRate));
      
      // Parse description: if it contains " - ", split into title and description
      const descParts = item.description.split(' - ');
      const itemTitle = descParts[0] || item.description;
      const itemDescription = descParts.length > 1 ? descParts.slice(1).join(' - ') : '';
      
      return `
        <tr>
          <td>
            <div class="item-title">${escapeHtml(itemTitle)}</div>
            ${itemDescription ? `<div class="item-description">${escapeHtml(itemDescription)}</div>` : ''}
          </td>
          <td class="right">${item.quantity}</td>
          <td class="right">${formatCurrency(item.unitPrice)}</td>
          <td class="right">${vatRate} %</td>
          <td class="right">${formatCurrency(item.total)}</td>
        </tr>
      `;
    })
    .join('');

  // Service period date range (placed between Zahlungsziel and Erstellt)
  const servicePeriodHTML = (servicePeriodStart && servicePeriodEnd)
    ? `<div class="date-row"><span class="date-label">Leistungszeitraum</span>${formatDate(servicePeriodStart)} – ${formatDate(servicePeriodEnd)}</div>`
    : '';

  // Logo HTML (hide container if no logo)
  const logoHTML = logoUrl 
    ? `<div class="logo">
        <img src="${escapeHtml(logoUrl)}" alt="Logo" style="max-width: 80px; max-height: 80px; object-fit: contain;" />
      </div>`
    : '';

  // VAT totals section
  const vatRowHTML = !company.isKleinunternehmer && vatAmount > 0
    ? `<div class="totals-row">
        <span>Umsatzsteuer</span>
        <span>${formatCurrency(vatAmount)}</span>
      </div>`
    : '';

  // Kleinunternehmer notice (directly under totals, subtle styling)
  const kleinunternehmerCardHTML = company.isKleinunternehmer
    ? `<div class="vat-note" style="margin-top: 16px; padding: 12px 16px; background: #fafafa; border-radius: 8px; font-size: 11px; color: #7A8087; text-align: center;">
        Umsatzsteuerbefreiung aufgrund des Kleinunternehmerstatus gemäß § 19 UStG
      </div>`
    : '';

  // Notes card
  const notesCardHTML = notes
    ? `<div class="card">
        <div class="info-title">Anmerkungen</div>
        ${escapeHtml(notes).replace(/\n/g, '<br>')}
      </div>`
    : '';

  // Terms card
  const termsCardHTML = terms
    ? `<div class="card">
        <div class="info-title">Bedingungen</div>
        ${escapeHtml(terms).replace(/\n/g, '<br>')}
      </div>`
    : '';

  // Info sections (only render if any exist)
  // Separate kleinunternehmer note to keep with totals
  const otherInfoSectionsHTML = (notesCardHTML || termsCardHTML)
    ? `<div class="info-section">
        ${notesCardHTML}
        ${termsCardHTML}
      </div>`
    : '';

  // Account holder name for bank details
  const accountHolderName = company.invoiceAccountHolderName || company.companyName || '';

  // Format company address for footer
  const companyAddressParts: string[] = [];
  if (company.streetName && company.streetNumber) {
    companyAddressParts.push(`${escapeHtml(company.streetName)} ${escapeHtml(company.streetNumber)}`);
  }
  if (company.postalCode && company.city) {
    companyAddressParts.push(`${escapeHtml(company.postalCode)} ${escapeHtml(company.city)}`);
  }

  // Generate footer template HTML for Puppeteer (repeats on every page)
  const footerTemplateHTML = `
    <div style="width: 100%; padding: 0 16mm; font-family: 'Kanit', Arial, sans-serif; font-size: 10.5px; color: #4A5058; border-top: 1px solid #e0e0e0;">
      <div style="display: flex; justify-content: space-between; gap: 18px; align-items: flex-start; padding-top: 8px;">
        <div style="flex: 1.2;">
          <div style="font-weight: 400; font-size: 8px; text-transform: uppercase; letter-spacing: 1px; color: #7A8087; margin-bottom: 4px;">Kontakt</div>
          <div style="font-size: 10px; line-height: 1.4;">${company.email ? escapeHtml(company.email) : ''}${company.phone ? `<br>${escapeHtml(company.phone)}` : ''}</div>
        </div>
        <div style="flex: 1; text-align: center;">
          <div style="font-weight: 400; font-size: 8px; text-transform: uppercase; letter-spacing: 1px; color: #7A8087; margin-bottom: 4px;">Adresse</div>
          <div style="font-size: 10px; line-height: 1.4;">${companyAddressParts.join('<br>')}</div>
        </div>
        <div style="flex: 1.2; text-align: right;">
          <div style="font-weight: 400; font-size: 8px; text-transform: uppercase; letter-spacing: 1px; color: #7A8087; margin-bottom: 4px;">Bankverbindung</div>
          <div style="font-size: 10px; line-height: 1.4;">${accountHolderName ? `${escapeHtml(accountHolderName)}<br>` : ''}${company.iban ? `IBAN: ${escapeHtml(company.iban)}<br>` : ''}Ref: ${escapeHtml(invoiceNumber)}</div>
        </div>
      </div>
      <div style="margin-top: 6px; display: flex; justify-content: flex-end; color: #7A8087; font-size: 9px;">
        Seite <span class="pageNumber"></span> von <span class="totalPages"></span>
      </div>
    </div>
  `;

  const htmlString = `
<!DOCTYPE html>
<html lang="de">
<head>
  <meta charset="UTF-8" />
  <title>Rechnung ${escapeHtml(invoiceNumber)}</title>

  <style>
    /* Embedded Kanit fonts (base64) - deterministic loading, no external requests */
    /* To verify fonts are embedded: macOS Preview -> Tools -> Show Inspector -> Fonts tab */
    /* Or: Windows Edge -> Open PDF -> Right-click -> Inspect -> Look for Kanit in font list */
    ${kanitFontsCSS}

    @page {
      size: A4;
      margin: 0;
    }

    :root {
      --accent: ${accentColor};
      --text-primary: #1C1F23;
      --text-secondary: #5A6068;
      --text-muted: #7A8087;
      --border-soft: #d8d8d8;
      --bg-soft: #fafafa;
    }

    * {
      box-sizing: border-box;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }

    body {
      font-family: 'Kanit', Arial, sans-serif;
      font-weight: 300;
      color: var(--text-primary);
      background: #fff;
      margin: 0;
      padding: 0;
      line-height: 1.55;
    }

    /* GLOBAL ALIGNMENT GRID - no padding, margins handled by Puppeteer */
    .content-grid {
      padding: 0;
      width: 100%;
    }

    /* HEADER */
    .header {
      display: grid;
      grid-template-columns: 1fr auto 1fr;
      align-items: start;
      margin-bottom: 42px;
    }

    h1 {
      font-size: 42px;
      font-weight: 100;
      letter-spacing: 2px;
      margin: 0;
      line-height: 1;
    }

    .invoice-number {
      margin-top: 4px;
      font-size: 19px;
      font-weight: 500;
      color: var(--text-secondary);
    }

    .logo {
      display: flex;
      justify-content: center;
    }

    .logo-box {
      width: 80px;
      height: 80px;
      background: #f0f0f0;
      border-radius: 12px;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 10px;
      color: #999;
    }

    .dates {
      text-align: right;
      font-size: 13px;
      color: var(--text-secondary);
      white-space: nowrap;
    }

    .date-row { margin-bottom: 6px; }
    .date-label { color: var(--text-muted); margin-right: 8px; }

    /* CARDS - Premium v4 styling */
    .card {
      background: #ffffff;
      border-radius: 16px;
      padding: 22px 24px;
      border: 1px solid rgba(0, 0, 0, 0.06);
      box-shadow: 0 6px 20px rgba(0, 0, 0, 0.04);
    }

    .billing {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 28px;
      margin-bottom: 40px;
    }

    .box-label {
      text-transform: uppercase;
      font-size: 9px;
      letter-spacing: 0.08em;
      color: var(--text-muted);
      margin-bottom: 10px;
    }

    /* TABLE */
    .table-wrapper {
      border-radius: 16px;
      overflow: hidden;
      border: 1px solid var(--border-soft);
      margin-top: 32px;
      box-shadow: 0 6px 20px rgba(0, 0, 0, 0.04);
    }

    table {
      width: 100%;
      border-collapse: collapse;
    }

    thead th {
      background: #f7f7f7;
      padding: 12px 14px;
      font-size: 12px;
      font-weight: 500;
      border-bottom: 1px solid var(--border-soft);
      text-align: left;
    }

    tbody td {
      padding: 12px 14px;
      font-size: 12px;
      border-bottom: 1px solid var(--border-soft);
      vertical-align: top;
    }

    .item-title {
      font-weight: 500;
      margin-bottom: 4px;
    }

    .item-description {
      font-weight: 300;
      font-size: 11px;
      color: var(--text-secondary);
      margin-top: 2px;
    }

    .right { text-align: right; }

    /* TOTALS */
    .totals-and-vat {
      margin-top: 18px;
      break-inside: avoid;
      page-break-inside: avoid;
    }

    .totals {
      margin-left: auto;
      width: 320px;
      padding: 20px 22px;
      border-radius: 16px;
      border: 1px solid rgba(0, 0, 0, 0.06);
      background: #fff;
      box-shadow: 0 6px 20px rgba(0, 0, 0, 0.04);
    }

    .totals-row {
      display: flex;
      justify-content: space-between;
      font-size: 12px;
      padding: 6px 0;
    }

    .totals-row.total {
      font-size: 18px;
      font-weight: 500;
      margin-top: 10px;
      padding-top: 12px;
      position: relative;
      color: var(--text-primary);
    }

    .totals-row.total::before {
      content: "";
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      height: 0.5px;
      background: linear-gradient(
        to right,
        ${gradientStart} 0%,
        ${gradientMiddle} 30%,
        ${gradientMiddle} 70%,
        ${gradientEnd} 100%
      );
    }

    /* INFO */
    .info-section {
      margin-top: 24px;
      display: grid;
      gap: 18px;
    }

    .vat-note {
      font-size: 11px;
      color: var(--text-muted);
      break-inside: avoid;
      page-break-inside: avoid;
    }

    strong { font-weight: 400; }
  </style>
</head>

<body>

<div class="content-grid">

  <!-- HEADER -->
  <div class="header">
    <div>
      <h1>RECHNUNG</h1>
      <div class="invoice-number">${escapeHtml(invoiceNumber)}</div>
    </div>

    ${logoHTML}

    <div class="dates">
      <div class="date-row"><span class="date-label">Zahlungsziel</span>${formatDate(dueDate)}</div>
      ${servicePeriodHTML}
      <div class="date-row"><span class="date-label">Erstellt</span>${formatDate(invoiceDate)}</div>
    </div>
  </div>

  <!-- BILLING -->
  <div class="billing">
    <div class="card">
      <div class="box-label">An</div>
      <strong>${client ? escapeHtml(client.name) : 'Nicht angegeben'}</strong><br>
      ${client ? formatClientAddress() : ''}
    </div>

    <div class="card">
      <div class="box-label">Von</div>
      <strong>${escapeHtml(company.companyName || '')}</strong><br>
      ${formatCompanyAddress()}
      ${company.steuernummer ? `<br><br>Steuernummer: ${escapeHtml(company.steuernummer)}` : ''}
    </div>
  </div>

  <!-- ITEMS -->
  <div class="table-wrapper">
    <table>
      <thead>
        <tr>
          <th>Beschreibung</th>
          <th class="right">Anzahl</th>
          <th class="right">Preis (ohne USt.)</th>
          <th class="right">USt.-Satz</th>
          <th class="right">Gesamt</th>
        </tr>
      </thead>
      <tbody>
        ${itemsHTML}
      </tbody>
    </table>
  </div>

  <!-- TOTALS AND VAT NOTE (grouped together, never split) -->
  <section class="totals-and-vat">
    <div class="totals">
      ${vatRowHTML}
      <div class="totals-row total">
        <span>Gesamtbetrag</span>
        <span>${formatCurrency(total)}</span>
      </div>
    </div>
    ${kleinunternehmerCardHTML}
  </section>

  <!-- INFO SECTIONS -->
  ${otherInfoSectionsHTML}

</div>

</body>
</html>
  `;

  return {
    html: htmlString,
    footerTemplate: footerTemplateHTML,
  };
}
