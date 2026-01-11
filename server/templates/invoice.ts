import type { CompanySettings } from '../../drizzle/schema';

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

export function generateInvoiceHTML(data: InvoiceData): string {
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
  const itemsHTML = items
    .map((item) => {
      const vatRate = company.isKleinunternehmer ? 0 : (item.vatRate ?? Number(company.vatRate));
      return `
        <tr>
          <td>${escapeHtml(item.description)}</td>
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

  // Kleinunternehmer notice card
  const kleinunternehmerCardHTML = company.isKleinunternehmer
    ? `<div class="card vat-note">
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
  const infoSectionsHTML = (kleinunternehmerCardHTML || notesCardHTML || termsCardHTML)
    ? `<div class="info-section">
        ${kleinunternehmerCardHTML}
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

  return `
<!DOCTYPE html>
<html lang="de">
<head>
  <meta charset="UTF-8" />
  <title>Rechnung ${escapeHtml(invoiceNumber)}</title>

  <style>
    @font-face {
      font-family: 'Kanit';
      src: url('/fonts/kanit-variable.woff2') format('woff2');
      font-weight: 100 500;
      font-style: normal;
      font-display: block;
    }

    @page {
      size: A4;
      margin: 0;
    }

    :root {
      --accent: ${accentColor};
      --text-primary: #1C1F23;
      --text-secondary: #4A5058;
      --text-muted: #6A7078;
      --border-soft: #d0d0d0;
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

    .page {
      width: 210mm;
      min-height: 297mm;
      padding: 18mm;
    }

    /* GLOBAL ALIGNMENT GRID */
    .content-grid {
      padding: 0;
    }

    /* HEADER */
    .header {
      display: grid;
      grid-template-columns: 1fr auto 1fr;
      align-items: start;
      margin-bottom: 42px;
    }

    h1 {
      font-size: 32px;
      font-weight: 100;
      letter-spacing: 2px;
      margin: 0;
      line-height: 1;
    }

    .invoice-number {
      margin-top: 4px;
      font-size: 14px;
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
      font-size: 11px;
      color: var(--text-secondary);
      white-space: nowrap;
    }

    .date-row { margin-bottom: 6px; }
    .date-label { color: var(--text-muted); margin-right: 8px; }

    /* CARDS */
    .card {
      background: #ffffff;
      border-radius: 16px;
      padding: 22px 24px;
      border: 1px solid var(--border-soft);
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
      letter-spacing: 1px;
      color: var(--text-muted);
      margin-bottom: 10px;
    }

    /* TABLE */
    .table-wrapper {
      border-radius: 16px;
      overflow: hidden;
      border: 1px solid var(--border-soft);
      margin-top: 32px;
    }

    table {
      width: 100%;
      border-collapse: collapse;
    }

    thead th {
      background: #f7f7f7;
      padding: 16px 14px;
      font-size: 12px;
      font-weight: 500;
      border-bottom: 1px solid var(--border-soft);
      text-align: left;
    }

    tbody td {
      padding: 14px;
      font-size: 12px;
      border-bottom: 1px solid var(--border-soft);
    }

    .right { text-align: right; }

    /* TOTALS */
    .totals {
      margin-top: 28px;
      margin-left: auto;
      width: 320px;
      padding: 20px 22px;
      border-radius: 16px;
      border: 1px solid var(--border-soft);
      background: #fff;
    }

    .totals-row {
      display: flex;
      justify-content: space-between;
      font-size: 12px;
      padding: 6px 0;
    }

    .totals-row.total {
      font-size: 16px;
      font-weight: 500;
      margin-top: 8px;
      padding-top: 10px;
      position: relative;
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
        ${gradientMiddle} 50%,
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
    }

    /* FOOTER */
    .footer {
      display: grid;
      grid-template-columns: 1.3fr 1fr 1.3fr;
      gap: 36px;
      margin-top: 64px;
      font-size: 11px;
      color: var(--text-secondary);
    }

    strong { font-weight: 400; }
  </style>
</head>

<body>

<div class="page">
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

  <!-- TOTALS -->
  <div class="totals">
    ${vatRowHTML}
    <div class="totals-row total">
      <span>Gesamtbetrag</span>
      <span>${formatCurrency(total)}</span>
    </div>
  </div>

  <!-- INFO SECTIONS -->
  ${infoSectionsHTML}

  <!-- FOOTER -->
  <div class="footer">
    <div>
      <strong>Bankverbindung</strong><br>
      ${accountHolderName ? `Kontoinhaber: ${escapeHtml(accountHolderName)}<br>` : ''}
      ${company.iban ? `IBAN: ${escapeHtml(company.iban)}<br>` : ''}
      Verwendungszweck: ${escapeHtml(invoiceNumber)}
    </div>

    <div>
      <strong>Adresse</strong><br>
      ${companyAddressParts.join('<br>')}
    </div>

    <div>
      <strong>Kontakt</strong><br>
      ${company.email ? escapeHtml(company.email) : ''}
      ${company.phone ? `<br>${escapeHtml(company.phone)}` : ''}
    </div>
  </div>

</div>
</div>

</body>
</html>
  `;
}
