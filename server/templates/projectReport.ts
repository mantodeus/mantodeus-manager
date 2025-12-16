import type { Project, ProjectJob, FileMetadata } from '../../drizzle/schema';

interface ProjectReportData {
  project: Project & { clientContact?: { name: string; address: string | null } | null };
  jobs?: ProjectJob[];
  files?: Array<FileMetadata & { signedUrl?: string }>;
  logoUrl?: string;
  companyName?: string;
}

export function generateProjectReportHTML(data: ProjectReportData): string {
  const { project, jobs = [], files = [], logoUrl = '', companyName = 'Mantodeus Manager' } = data;

  const formatDate = (date: Date | string | null) => {
    if (!date) return 'Nicht gesetzt';
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

  const currentDate = new Date();
  const reportDate = currentDate.toLocaleDateString('de-DE');

  let jobsHTML = '';
  if (jobs.length > 0) {
    jobsHTML = jobs
      .map(
        (job) => `
      <tr>
        <td style="padding: 10px 12px; border-bottom: 1px solid #e0e0e0; font-size: 11px; font-family: Arial, sans-serif;">
          ${escapeHtml(job.title)}
        </td>
        <td style="padding: 10px 12px; border-bottom: 1px solid #e0e0e0; font-size: 11px; font-family: Arial, sans-serif;">
          ${escapeHtml(job.status.replace('_', ' ').toUpperCase())}
        </td>
        <td style="padding: 10px 12px; border-bottom: 1px solid #e0e0e0; font-size: 11px; font-family: Arial, sans-serif;">
          ${job.startTime ? formatDate(job.startTime) : '-'}
        </td>
      </tr>
    `
      )
      .join('');
  }

  let imagesHTML = '';
  const imageFiles = files.filter(f => f.mimeType?.startsWith('image/'));
  if (imageFiles.length > 0) {
    imagesHTML = imageFiles
      .slice(0, 10) // Limit to first 10 images
      .map(
        (file) => `
      <div style="margin-bottom: 20px; page-break-inside: avoid;">
        ${file.signedUrl ? `<img src="${escapeHtml(file.signedUrl)}" alt="Project image" style="max-width: 100%; height: auto; border-radius: 2px; max-height: 350px;" />` : ''}
        ${file.originalName ? `<p style="margin: 8px 0 0 0; font-size: 10px; color: #666; font-family: Arial, sans-serif;">${escapeHtml(file.originalName)}</p>` : ''}
      </div>
    `
      )
      .join('');
  }

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>${escapeHtml(project.name)} - Projektbericht</title>
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
    .header-content {
      display: flex;
      justify-content: space-between;
      margin-bottom: 20px;
      padding-bottom: 20px;
      border-bottom: 1px solid #e0e0e0;
    }
    .header-left {
      text-align: left;
      flex: 1;
    }
    .header-right {
      text-align: right;
      flex: 1;
    }
    .header-label {
      font-size: 10px;
      color: #999;
      font-weight: bold;
      letter-spacing: 1px;
      margin-bottom: 3px;
    }
    .header-value {
      font-size: 12px;
      color: #0a0a0a;
      font-weight: bold;
      margin-bottom: 10px;
    }
    .section {
      margin-bottom: 25px;
      page-break-inside: avoid;
    }
    .section-header {
      background-color: #00ff88;
      padding: 10px 12px;
      margin-bottom: 15px;
      font-size: 11px;
      font-weight: bold;
      letter-spacing: 1px;
      color: #0a0a0a;
    }
    .project-details {
      background: #f9f9f9;
      padding: 15px;
      margin-bottom: 15px;
      border-left: 3px solid #00ff88;
    }
    .project-title {
      font-size: 16px;
      font-weight: bold;
      color: #0a0a0a;
      margin-bottom: 12px;
    }
    .detail-row {
      margin-bottom: 8px;
      font-size: 11px;
      display: flex;
      justify-content: space-between;
    }
    .detail-label {
      font-weight: bold;
      color: #0a0a0a;
      min-width: 100px;
    }
    .detail-value {
      color: #333;
      flex: 1;
      text-align: right;
    }
    .status-badge {
      display: inline-block;
      padding: 4px 10px;
      background-color: #00ff88;
      color: #0a0a0a;
      font-size: 10px;
      font-weight: bold;
      border-radius: 2px;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      margin-top: 0;
    }
    th {
      background-color: #f0f0f0;
      padding: 10px 12px;
      text-align: left;
      font-weight: bold;
      font-size: 10px;
      letter-spacing: 0.5px;
      border-bottom: 2px solid #00ff88;
      color: #0a0a0a;
    }
    td {
      padding: 10px 12px;
      border-bottom: 1px solid #e0e0e0;
      font-size: 11px;
    }
    .images-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 15px;
      margin-top: 15px;
    }
    .image-item {
      page-break-inside: avoid;
    }
    .image-item img {
      width: 100%;
      height: auto;
      border-radius: 2px;
      max-height: 250px;
      object-fit: cover;
    }
    .image-caption {
      margin-top: 5px;
      font-size: 9px;
      color: #666;
    }
    .footer {
      margin-top: 40px;
      padding-top: 15px;
      border-top: 1px solid #e0e0e0;
      font-size: 9px;
      color: #999;
      text-align: center;
    }
    .footer-text {
      margin-bottom: 5px;
    }
    @media print {
      body {
        margin: 0;
        padding: 20mm;
      }
      .section {
        page-break-inside: avoid;
      }
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      ${logoUrl ? `<img src="${escapeHtml(logoUrl)}" alt="Logo" class="logo" />` : ''}
      <div class="company-name">${escapeHtml(companyName)}</div>
    </div>

    <div class="header-content">
      <div class="header-left">
        <div class="header-label">PROJEKT</div>
        <div class="header-value">${escapeHtml(project.name)}</div>
        ${project.address ? `<div class="header-label" style="margin-top: 10px;">STANDORT</div><div class="header-value">${escapeHtml(project.address)}</div>` : ''}
        ${project.clientContact ? `<div class="header-label" style="margin-top: 10px;">KUNDE</div><div class="header-value">${escapeHtml(project.clientContact.name)}</div>` : ''}
      </div>
      <div class="header-right">
        <div class="header-label">ERSTELLT</div>
        <div class="header-value">${reportDate}</div>
        ${project.startDate ? `<div class="header-label" style="margin-top: 10px;">START</div><div class="header-value">${formatDate(project.startDate)}</div>` : ''}
        ${project.endDate ? `<div class="header-label" style="margin-top: 10px;">ENDE</div><div class="header-value">${formatDate(project.endDate)}</div>` : ''}
      </div>
    </div>

    <div class="section">
      <div class="section-header">PROJEKTDETAILS</div>
      <div class="project-details">
        <div class="detail-row">
          <span class="detail-label">Status:</span>
          <span class="detail-value"><span class="status-badge">${escapeHtml(project.status.toUpperCase())}</span></span>
        </div>
        ${project.description ? `<div class="detail-row"><span class="detail-label">Beschreibung:</span></div><div style="margin-bottom: 8px; font-size: 11px; color: #333;">${escapeHtml(project.description)}</div>` : ''}
      </div>
    </div>

    ${
      jobs.length > 0
        ? `
    <div class="section">
      <div class="section-header">AUFGABEN (${jobs.length})</div>
      <table>
        <thead>
          <tr>
            <th>AUFGABE</th>
            <th>STATUS</th>
            <th>STARTZEIT</th>
          </tr>
        </thead>
        <tbody>
          ${jobsHTML}
        </tbody>
      </table>
    </div>
    `
        : ''
    }

    ${
      imageFiles.length > 0
        ? `
    <div class="section">
      <div class="section-header">PROJEKTFOTOS (${imageFiles.length})</div>
      <div class="images-grid">
        ${imageFiles
          .slice(0, 10)
          .map(
            (file) => `
          <div class="image-item">
            ${file.signedUrl ? `<img src="${escapeHtml(file.signedUrl)}" alt="Project image" />` : ''}
            ${file.originalName ? `<div class="image-caption">${escapeHtml(file.originalName)}</div>` : ''}
          </div>
        `
          )
          .join('')}
      </div>
    </div>
    `
        : ''
    }

    <div class="footer">
      <div class="footer-text">Generiert am ${reportDate}</div>
      <div class="footer-text">© ${new Date().getFullYear()} ${escapeHtml(companyName)}. Alle Rechte vorbehalten.</div>
    </div>
  </div>
</body>
</html>
  `;
}

