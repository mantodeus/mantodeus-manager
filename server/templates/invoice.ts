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
  const accentColor = company.invoiceAccentColor || '#00ff88';
  
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

  // Service period date range
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
    ? `<div class="card">
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

  <link href="https://fonts.googleapis.com/css2?family=Kanit:wght@100;300;400;500&display=swap" rel="stylesheet">

  <style>
    :root {
      --accent: ${accentColor};
      --text-primary: #1C1F23;
      --text-secondary: #4A5058;
      --text-muted: #7A8087;
      --border-soft: #ececec;
    }

    * { box-sizing: border-box; }

    body {
      font-family: 'Kanit', Arial, sans-serif;
      font-weight: 300;
      color: var(--text-primary);
      background: #fff;
      padding: 56px;
      max-width: 900px;
      margin: auto;
      line-height: 1.55;
    }

    /* HEADER */
    .header {
      display: grid;
      grid-template-columns: 1fr auto 1fr;
      align-items: start;
      margin-bottom: 42px;
    }

    h1 {
      font-size: 32pt;
      font-weight: 100;
      letter-spacing: 1.6px;
      margin: 0;
      line-height: 1;
    }

    .invoice-number {
      margin-top: 4px;
      font-size: 14pt;
      font-weight: 500;
      color: var(--text-secondary);
    }

    .logo {
      display: flex;
      justify-content: center;
      align-items: flex-start;
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
      font-size: 10.5pt;
      color: var(--text-secondary);
    }

    .date-row { margin-bottom: 6px; }
    .date-label { color: var(--text-muted); margin-right: 8px; }

    /* CARDS */
    .card {
      background: #ffffff;
      border-radius: 16px;
      padding: 22px 24px;
      box-shadow: 0 6px 20px rgba(0,0,0,0.04);
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
    }

    table {
      width: 100%;
      border-collapse: collapse;
    }

    thead th {
      background: #f7f7f7;
      color: var(--text-primary);
      padding: 16px 14px;
      font-size: 12px;
      font-weight: 500;
      text-align: left;
      border-bottom: 1px solid var(--border-soft);
    }

    tbody td {
      padding: 14px;
      font-size: 11.5px;
      border-bottom: 1px solid #f0f0f0;
    }

    tbody tr:last-child td { border-bottom: none; }
    .right { text-align: right; }

    /* TOTALS */
    .totals {
      margin-top: 28px;
      margin-left: auto;
      width: 320px;
      background: #ffffff;
      border-radius: 16px;
      padding: 20px 22px;
      box-shadow: 0 6px 20px rgba(0,0,0,0.04);
    }

    .totals-row {
      display: flex;
      justify-content: space-between;
      padding: 6px 0;
      font-size: 11.5px;
    }

    .totals-row.total {
      font-size: 16px;
      font-weight: 500;
      margin-top: 8px;
      padding-top: 10px;
      position: relative;
    }

    /* gradient divider */
    .totals-row.total::before {
      content: "";
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      height: 2px;
      background: linear-gradient(
        to right,
        ${accentColor}00 0%,
        ${accentColor} 50%,
        ${accentColor}00 100%
      );
    }

    /* INFO SECTIONS */
    .info-section {
      margin-top: 24px;
      display: grid;
      gap: 18px;
    }

    .info-title {
      font-weight: 500;
      margin-bottom: 6px;
      color: var(--text-primary);
    }

    /* FOOTER */
    .footer {
      display: grid;
      grid-template-columns: 1fr 1fr 1fr;
      gap: 36px;
      margin-top: 64px;
      font-size: 10.5px;
      color: var(--text-secondary);
    }

    strong { font-weight: 400; }
  </style>
</head>

<body>

  <!-- HEADER -->
  <div class="header">
    <div>
      <h1>RECHNUNG</h1>
      <div class="invoice-number">${escapeHtml(invoiceNumber)}</div>
    </div>

    ${logoHTML}

    <div class="dates">
      <div class="date-row"><span class="date-label">Erstellt</span>${formatDate(invoiceDate)}</div>
      ${servicePeriodHTML}
      <div class="date-row"><span class="date-label">Zahlungsziel</span>${formatDate(dueDate)}</div>
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

    <div style="text-align: center;">
      <strong>Adresse</strong><br>
      ${companyAddressParts.join('<br>')}
    </div>

    <div style="text-align: right;">
      <strong>Kontakt</strong><br>
      ${company.companyName ? escapeHtml(company.companyName) : ''}
      ${company.email ? `<br>${escapeHtml(company.email)}` : ''}
      ${company.phone ? `<br>${escapeHtml(company.phone)}` : ''}
    </div>
  </div>

</body>
</html>
  `;
}
