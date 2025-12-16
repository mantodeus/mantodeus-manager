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
  }>;
  subtotal: number;
  vatAmount: number;
  total: number;
  notes?: string;
  logoUrl?: string;
}

export function generateInvoiceHTML(data: InvoiceData): string {
  const { invoiceNumber, invoiceDate, dueDate, company, client, items, subtotal, vatAmount, total, notes, logoUrl = '' } = data;

  const formatDate = (date: Date | string) => {
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

  const itemsHTML = items
    .map(
      (item) => `
    <tr>
      <td style="padding: 10px 12px; border-bottom: 1px solid #e0e0e0; font-size: 11px; font-family: Arial, sans-serif;">
        ${escapeHtml(item.description)}
      </td>
      <td style="padding: 10px 12px; border-bottom: 1px solid #e0e0e0; font-size: 11px; text-align: center; font-family: Arial, sans-serif;">
        ${item.quantity}
      </td>
      <td style="padding: 10px 12px; border-bottom: 1px solid #e0e0e0; font-size: 11px; text-align: right; font-family: Arial, sans-serif;">
        ${formatCurrency(item.unitPrice)}
      </td>
      <td style="padding: 10px 12px; border-bottom: 1px solid #e0e0e0; font-size: 11px; text-align: right; font-family: Arial, sans-serif;">
        ${formatCurrency(item.total)}
      </td>
    </tr>
  `
    )
    .join('');

  const vatSection = company.isKleinunternehmer
    ? `
    <div style="margin-top: 20px; padding: 15px; background: #f9f9f9; border-left: 3px solid #00ff88; font-size: 10px; color: #666;">
      <strong>Keine Umsatzsteuer aufgrund der Kleinunternehmerregelung, § 19 UStG</strong>
    </div>
  `
    : `
    <div style="display: flex; justify-content: space-between; margin-top: 20px; padding: 15px; background: #f9f9f9; border-left: 3px solid #00ff88;">
      <div style="font-size: 11px; font-weight: bold; color: #0a0a0a;">Zwischensumme:</div>
      <div style="font-size: 11px; color: #333;">${formatCurrency(subtotal)}</div>
    </div>
    <div style="display: flex; justify-content: space-between; padding: 10px 15px; background: #f9f9f9; border-left: 3px solid #00ff88;">
      <div style="font-size: 11px; font-weight: bold; color: #0a0a0a;">MwSt. (${Number(company.vatRate)}%):</div>
      <div style="font-size: 11px; color: #333;">${formatCurrency(vatAmount)}</div>
    </div>
  `;

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Rechnung ${escapeHtml(invoiceNumber)}</title>
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }
    html, body {
      width: 100%;
      background: white;
    }
    body {
      font-family: Arial, sans-serif;
      color: #333;
      line-height: 1.4;
      padding: 40px;
      background-color: #ffffff;
    }
    .container {
      max-width: 800px;
      margin: 0 auto;
      background: white;
    }
    .header {
      display: flex;
      justify-content: space-between;
      margin-bottom: 40px;
      padding-bottom: 20px;
      border-bottom: 2px solid #00ff88;
    }
    .header-left {
      flex: 1;
    }
    .header-right {
      flex: 1;
      text-align: right;
    }
    .logo {
      max-width: 60px;
      height: auto;
      margin-bottom: 15px;
    }
    .company-name {
      font-size: 14px;
      font-weight: bold;
      color: #0a0a0a;
      margin-bottom: 10px;
    }
    .company-details {
      font-size: 10px;
      color: #666;
      line-height: 1.6;
    }
    .invoice-title {
      font-size: 24px;
      font-weight: bold;
      color: #0a0a0a;
      margin-bottom: 10px;
    }
    .invoice-number {
      font-size: 12px;
      color: #666;
    }
    .invoice-info {
      margin-top: 30px;
      font-size: 11px;
    }
    .invoice-info-row {
      margin-bottom: 5px;
    }
    .invoice-info-label {
      font-weight: bold;
      color: #0a0a0a;
      display: inline-block;
      min-width: 100px;
    }
    .billing-section {
      display: flex;
      justify-content: space-between;
      margin-bottom: 40px;
    }
    .billing-box {
      flex: 1;
      padding: 20px;
      background: #f9f9f9;
      border-left: 3px solid #00ff88;
    }
    .billing-label {
      font-size: 10px;
      color: #999;
      font-weight: bold;
      letter-spacing: 1px;
      margin-bottom: 10px;
    }
    .billing-content {
      font-size: 11px;
      color: #333;
      line-height: 1.6;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 20px;
    }
    th {
      background-color: #00ff88;
      padding: 12px;
      text-align: left;
      font-weight: bold;
      font-size: 10px;
      letter-spacing: 0.5px;
      color: #0a0a0a;
    }
    th:last-child {
      text-align: right;
    }
    td {
      padding: 10px 12px;
      border-bottom: 1px solid #e0e0e0;
      font-size: 11px;
    }
    .total-section {
      margin-top: 20px;
      padding: 20px;
      background: #f9f9f9;
      border-left: 3px solid #00ff88;
    }
    .total-row {
      display: flex;
      justify-content: space-between;
      margin-bottom: 10px;
    }
    .total-label {
      font-size: 12px;
      font-weight: bold;
      color: #0a0a0a;
    }
    .total-amount {
      font-size: 16px;
      font-weight: bold;
      color: #0a0a0a;
    }
    .footer {
      margin-top: 60px;
      padding-top: 20px;
      border-top: 1px solid #e0e0e0;
      font-size: 9px;
      color: #666;
    }
    .footer-section {
      margin-bottom: 15px;
    }
    .footer-label {
      font-weight: bold;
      color: #0a0a0a;
      margin-bottom: 5px;
    }
    @media print {
      body {
        margin: 0;
        padding: 20mm;
      }
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <div class="header-left">
        ${logoUrl ? `<img src="${escapeHtml(logoUrl)}" alt="Logo" class="logo" />` : ''}
        <div class="company-name">${escapeHtml(company.companyName || '')}</div>
        <div class="company-details">
          ${company.address ? escapeHtml(company.address).replace(/\n/g, '<br>') : ''}
        </div>
      </div>
      <div class="header-right">
        <div class="invoice-title">RECHNUNG</div>
        <div class="invoice-number">${escapeHtml(invoiceNumber)}</div>
        <div class="invoice-info">
          <div class="invoice-info-row">
            <span class="invoice-info-label">Rechnungsdatum:</span>
            <span>${formatDate(invoiceDate)}</span>
          </div>
          <div class="invoice-info-row">
            <span class="invoice-info-label">Fälligkeitsdatum:</span>
            <span>${formatDate(dueDate)}</span>
          </div>
        </div>
      </div>
    </div>

    <div class="billing-section">
      <div class="billing-box">
        <div class="billing-label">RECHNUNGSSTELLER</div>
        <div class="billing-content">
          ${escapeHtml(company.companyName || '')}<br>
          ${company.address ? escapeHtml(company.address).replace(/\n/g, '<br>') : ''}<br>
          ${company.steuernummer ? `Steuernummer: ${escapeHtml(company.steuernummer)}<br>` : ''}
          ${company.ustIdNr ? `USt-IdNr.: ${escapeHtml(company.ustIdNr)}<br>` : ''}
        </div>
      </div>
      <div class="billing-box" style="margin-left: 20px;">
        <div class="billing-label">RECHNUNGSEMPFÄNGER</div>
        <div class="billing-content">
          ${client ? `
            ${escapeHtml(client.name)}<br>
            ${client.address ? escapeHtml(client.address).replace(/\n/g, '<br>') : ''}
          ` : 'Nicht angegeben'}
        </div>
      </div>
    </div>

    <table>
      <thead>
        <tr>
          <th>Beschreibung</th>
          <th style="text-align: center;">Menge</th>
          <th style="text-align: right;">Einzelpreis</th>
          <th style="text-align: right;">Gesamt</th>
        </tr>
      </thead>
      <tbody>
        ${itemsHTML}
      </tbody>
    </table>

    <div class="total-section">
      ${vatSection}
      <div class="total-row" style="margin-top: 20px; padding-top: 15px; border-top: 2px solid #00ff88;">
        <div class="total-label">GESAMTSUMME:</div>
        <div class="total-amount">${formatCurrency(total)}</div>
      </div>
    </div>

    ${notes ? `
    <div style="margin-top: 30px; padding: 15px; background: #f9f9f9; border-left: 3px solid #00ff88;">
      <div style="font-size: 10px; font-weight: bold; color: #0a0a0a; margin-bottom: 8px;">Hinweise:</div>
      <div style="font-size: 10px; color: #666; white-space: pre-line;">${escapeHtml(notes)}</div>
    </div>
    ` : ''}

    <div class="footer">
      ${company.iban || company.bic ? `
      <div class="footer-section">
        <div class="footer-label">Bankverbindung:</div>
        ${company.iban ? `IBAN: ${escapeHtml(company.iban)}<br>` : ''}
        ${company.bic ? `BIC: ${escapeHtml(company.bic)}` : ''}
      </div>
      ` : ''}
      <div class="footer-section">
        <div style="font-size: 8px; color: #999; text-align: center; margin-top: 20px;">
          © ${new Date().getFullYear()} ${escapeHtml(company.companyName || '')}. Alle Rechte vorbehalten.
        </div>
      </div>
    </div>
  </div>
</body>
</html>
  `;
}

