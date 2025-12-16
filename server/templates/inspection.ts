interface InspectionData {
  title: string;
  inspectionDate: Date;
  inspector: string;
  items: Array<{
    name: string;
    status: 'pass' | 'fail' | 'na';
    notes?: string;
  }>;
  signature?: string;
  logoUrl?: string;
  companyName?: string;
}

export function generateInspectionHTML(data: InspectionData): string {
  const { title, inspectionDate, inspector, items, signature, logoUrl = '', companyName = 'Mantodeus Manager' } = data;

  const formatDate = (date: Date | string) => {
    const d = typeof date === 'string' ? new Date(date) : date;
    return d.toLocaleDateString('de-DE');
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

  const getStatusBadge = (status: string) => {
    const badges = {
      pass: '<span style="display: inline-block; padding: 4px 10px; background-color: #00ff88; color: #0a0a0a; font-size: 10px; font-weight: bold; border-radius: 2px;">BESTANDEN</span>',
      fail: '<span style="display: inline-block; padding: 4px 10px; background-color: #ff4444; color: white; font-size: 10px; font-weight: bold; border-radius: 2px;">DURCHGEFALLEN</span>',
      na: '<span style="display: inline-block; padding: 4px 10px; background-color: #999; color: white; font-size: 10px; font-weight: bold; border-radius: 2px;">N/A</span>',
    };
    return badges[status as keyof typeof badges] || badges.na;
  };

  const itemsHTML = items
    .map(
      (item) => `
    <tr>
      <td style="padding: 10px 12px; border-bottom: 1px solid #e0e0e0; font-size: 11px; font-family: Arial, sans-serif;">
        ${escapeHtml(item.name)}
      </td>
      <td style="padding: 10px 12px; border-bottom: 1px solid #e0e0e0; font-size: 11px; text-align: center; font-family: Arial, sans-serif;">
        ${getStatusBadge(item.status)}
      </td>
      <td style="padding: 10px 12px; border-bottom: 1px solid #e0e0e0; font-size: 11px; font-family: Arial, sans-serif;">
        ${item.notes ? escapeHtml(item.notes) : '-'}
      </td>
    </tr>
  `
    )
    .join('');

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>${escapeHtml(title)} - Inspektion</title>
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
      text-align: center;
      margin-bottom: 30px;
      padding-bottom: 20px;
      border-bottom: 2px solid #00ff88;
    }
    .logo {
      max-width: 60px;
      height: auto;
      margin-bottom: 15px;
    }
    .company-name {
      font-size: 11px;
      letter-spacing: 2px;
      color: #0a0a0a;
      margin-bottom: 20px;
      font-weight: bold;
    }
    .inspection-title {
      font-size: 20px;
      font-weight: bold;
      color: #0a0a0a;
      margin-bottom: 20px;
    }
    .inspection-info {
      display: flex;
      justify-content: space-between;
      margin-bottom: 30px;
      font-size: 11px;
    }
    .info-item {
      flex: 1;
    }
    .info-label {
      font-weight: bold;
      color: #0a0a0a;
      margin-bottom: 5px;
    }
    .info-value {
      color: #333;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 30px;
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
    th:nth-child(2) {
      text-align: center;
    }
    td {
      padding: 10px 12px;
      border-bottom: 1px solid #e0e0e0;
      font-size: 11px;
    }
    .signature-section {
      margin-top: 40px;
      padding-top: 20px;
      border-top: 1px solid #e0e0e0;
    }
    .signature-box {
      margin-top: 30px;
      padding: 20px;
      border: 1px solid #e0e0e0;
      min-height: 100px;
    }
    .signature-label {
      font-size: 10px;
      color: #999;
      margin-bottom: 10px;
    }
    .footer {
      margin-top: 40px;
      padding-top: 15px;
      border-top: 1px solid #e0e0e0;
      font-size: 9px;
      color: #999;
      text-align: center;
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
      ${logoUrl ? `<img src="${escapeHtml(logoUrl)}" alt="Logo" class="logo" />` : ''}
      <div class="company-name">${escapeHtml(companyName)}</div>
      <div class="inspection-title">${escapeHtml(title)}</div>
    </div>

    <div class="inspection-info">
      <div class="info-item">
        <div class="info-label">Inspektionsdatum:</div>
        <div class="info-value">${formatDate(inspectionDate)}</div>
      </div>
      <div class="info-item">
        <div class="info-label">Inspektor:</div>
        <div class="info-value">${escapeHtml(inspector)}</div>
      </div>
    </div>

    <table>
      <thead>
        <tr>
          <th>Prüfpunkt</th>
          <th>Status</th>
          <th>Bemerkungen</th>
        </tr>
      </thead>
      <tbody>
        ${itemsHTML}
      </tbody>
    </table>

    <div class="signature-section">
      <div class="signature-label">Unterschrift:</div>
      <div class="signature-box">
        ${signature ? `<img src="${escapeHtml(signature)}" alt="Signature" style="max-width: 200px; height: auto;" />` : ''}
      </div>
    </div>

    <div class="footer">
      <div style="margin-bottom: 5px;">Generiert am ${formatDate(new Date())}</div>
      <div>© ${new Date().getFullYear()} ${escapeHtml(companyName)}. Alle Rechte vorbehalten.</div>
    </div>
  </div>
</body>
</html>
  `;
}

