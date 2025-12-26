/**
 * Inspection Report HTML Template
 * 
 * Generates HTML for inspection PDF reports with:
 * - Cover page
 * - Summary
 * - Findings grouped by InspectionUnit
 * - Media (annotated preferred, original fallback)
 */

interface InspectionUnitData {
  id: number;
  label: string;
  sequenceIndex: number;
  status: string | null;
  findings: Array<{
    id: number;
    defectType: string | null;
    severity: string | null;
    notes: string | null;
    positionDescriptor: string | null;
    heightMeters: string | null;
    createdAt: Date | string;
    createdByUserId: number;
    createdByUserName?: string;
    media: Array<{
      id: number;
      imageUrl: string; // Prefer annotated, fallback to original
      caption: string;
    }>;
  }>;
}

interface InspectionReportData {
  inspection: {
    id: number;
    projectId: number;
    projectName: string;
    type: string | null;
    status: string | null;
    startedAt: Date | string | null;
    completedAt: Date | string | null;
    createdByUserId: number;
    createdByUserName?: string;
  };
  units: InspectionUnitData[];
  summary: {
    totalUnits: number;
    completedUnits: number;
    totalFindings: number;
    severityBreakdown: Record<string, number>;
    inspectors: string[];
  };
  logoUrl?: string;
  companyName?: string;
}

export function generateInspectionReportHTML(data: InspectionReportData): string {
  const { inspection, units, summary, logoUrl = '', companyName = 'Mantodeus Manager' } = data;

  const formatDate = (date: Date | string | null) => {
    if (!date) return 'Nicht gesetzt';
    const d = typeof date === 'string' ? new Date(date) : date;
    return d.toLocaleDateString('de-DE', { 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric' 
    });
  };

  const formatDateTime = (date: Date | string | null) => {
    if (!date) return 'Nicht gesetzt';
    const d = typeof date === 'string' ? new Date(date) : date;
    return d.toLocaleDateString('de-DE', { 
      year: 'numeric', 
      month: '2-digit', 
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    });
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

  // Determine date range
  const dateRange = inspection.startedAt && inspection.completedAt
    ? `${formatDate(inspection.startedAt)} - ${formatDate(inspection.completedAt)}`
    : inspection.startedAt
    ? `Ab ${formatDate(inspection.startedAt)}`
    : 'Nicht gesetzt';

  // Cover page HTML
  const coverPageHTML = `
    <div style="page-break-after: always; min-height: 100vh; display: flex; flex-direction: column; justify-content: center; align-items: center; text-align: center; padding: 40px;">
      ${logoUrl ? `<img src="${escapeHtml(logoUrl)}" alt="Logo" style="max-width: 120px; height: auto; margin-bottom: 30px;" />` : ''}
      <div style="font-size: 11px; letter-spacing: 2px; color: #0a0a0a; margin-bottom: 40px; font-weight: bold;">
        ${escapeHtml(companyName)}
      </div>
      <div style="font-size: 28px; font-weight: bold; color: #0a0a0a; margin-bottom: 20px;">
        ${escapeHtml(inspection.type || 'Inspektionsbericht')}
      </div>
      <div style="font-size: 18px; color: #333; margin-bottom: 40px;">
        ${escapeHtml(inspection.projectName)}
      </div>
      <div style="font-size: 12px; color: #666; margin-bottom: 10px;">
        <strong>Zeitraum:</strong> ${dateRange}
      </div>
      <div style="font-size: 12px; color: #666; margin-bottom: 10px;">
        <strong>Status:</strong> ${escapeHtml(inspection.status || 'In Bearbeitung')}
      </div>
      <div style="font-size: 10px; color: #999; margin-top: 60px;">
        Generiert am ${formatDateTime(new Date())}
      </div>
    </div>
  `;

  // Summary HTML
  const severityBreakdownHTML = Object.entries(summary.severityBreakdown)
    .map(([severity, count]) => `<div style="margin: 5px 0;">${escapeHtml(severity)}: ${count}</div>`)
    .join('');

  const summaryHTML = `
    <div style="page-break-after: always; padding: 40px;">
      <div style="font-size: 18px; font-weight: bold; color: #0a0a0a; margin-bottom: 30px; padding-bottom: 15px; border-bottom: 2px solid #00ff88;">
        ZUSAMMENFASSUNG
      </div>
      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 30px; margin-bottom: 30px;">
        <div>
          <div style="font-size: 11px; font-weight: bold; color: #0a0a0a; margin-bottom: 10px;">EINHEITEN</div>
          <div style="font-size: 14px; color: #333;">
            Gesamt: ${summary.totalUnits}<br/>
            Abgeschlossen: ${summary.completedUnits}
          </div>
        </div>
        <div>
          <div style="font-size: 11px; font-weight: bold; color: #0a0a0a; margin-bottom: 10px;">BEFUNDE</div>
          <div style="font-size: 14px; color: #333;">
            Gesamt: ${summary.totalFindings}
          </div>
        </div>
      </div>
      ${Object.keys(summary.severityBreakdown).length > 0 ? `
        <div style="margin-bottom: 30px;">
          <div style="font-size: 11px; font-weight: bold; color: #0a0a0a; margin-bottom: 10px;">SCHWEREGRAD</div>
          <div style="font-size: 12px; color: #333;">
            ${severityBreakdownHTML}
          </div>
        </div>
      ` : ''}
      ${summary.inspectors.length > 0 ? `
        <div>
          <div style="font-size: 11px; font-weight: bold; color: #0a0a0a; margin-bottom: 10px;">INSPEKTOREN</div>
          <div style="font-size: 12px; color: #333;">
            ${summary.inspectors.map(i => escapeHtml(i)).join(', ')}
          </div>
        </div>
      ` : ''}
    </div>
  `;

  // Units HTML (grouped by unit)
  const unitsHTML = units.map((unit, unitIndex) => {
    const findingsHTML = unit.findings.map((finding, findingIndex) => {
      const defectType = finding.defectType || 'Allgemeiner Befund';
      const mediaHTML = finding.media.map((mediaItem) => `
        <div style="margin: 15px 0; page-break-inside: avoid;">
          <img src="${escapeHtml(mediaItem.imageUrl)}" alt="${escapeHtml(mediaItem.caption)}" style="max-width: 100%; height: auto; border-radius: 2px; max-height: 400px; display: block; margin: 0 auto;" />
          <div style="font-size: 9px; color: #666; text-align: center; margin-top: 5px;">
            ${escapeHtml(mediaItem.caption)}
          </div>
        </div>
      `).join('');

      const positionInfo = finding.positionDescriptor || finding.heightMeters
        ? `<div style="font-size: 10px; color: #666; margin-top: 5px;">
            ${finding.positionDescriptor ? escapeHtml(finding.positionDescriptor) : ''}
            ${finding.heightMeters ? ` (${escapeHtml(finding.heightMeters)} m)` : ''}
          </div>`
        : '';

      return `
        <div style="margin-bottom: 25px; padding-bottom: 20px; border-bottom: 1px solid #e0e0e0; page-break-inside: avoid;">
          <div style="font-size: 12px; font-weight: bold; color: #0a0a0a; margin-bottom: 8px;">
            Befund ${findingIndex + 1}: ${escapeHtml(defectType)}
            ${finding.severity ? `<span style="font-size: 10px; font-weight: normal; color: #666; margin-left: 10px;">(${escapeHtml(finding.severity)})</span>` : ''}
          </div>
          ${finding.notes ? `
            <div style="font-size: 11px; color: #333; margin-bottom: 8px; line-height: 1.5;">
              ${escapeHtml(finding.notes)}
            </div>
          ` : ''}
          ${positionInfo}
          ${finding.createdByUserName ? `
            <div style="font-size: 9px; color: #999; margin-top: 8px;">
              Erstellt von ${escapeHtml(finding.createdByUserName)} am ${formatDateTime(finding.createdAt)}
            </div>
          ` : ''}
          ${mediaHTML}
        </div>
      `;
    }).join('');

    return `
      <div style="page-break-inside: avoid; margin-bottom: 40px;">
        <div style="font-size: 16px; font-weight: bold; color: #0a0a0a; margin-bottom: 15px; padding-bottom: 10px; border-bottom: 2px solid #00ff88;">
          ${escapeHtml(unit.label)} (${unit.findings.length} ${unit.findings.length === 1 ? 'Befund' : 'Befunde'})
          <span style="font-size: 11px; font-weight: normal; color: #666; margin-left: 10px;">
            ${unit.status === 'completed' ? 'Abgeschlossen' : unit.status === 'in_progress' ? 'In Bearbeitung' : 'Leer'}
          </span>
        </div>
        ${findingsHTML || '<div style="font-size: 11px; color: #999; font-style: italic;">Keine Befunde</div>'}
      </div>
    `;
  }).join('');

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>${escapeHtml(inspection.projectName)} - Inspektionsbericht</title>
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }
    html, body {
      width: 100%;
      background: white;
      font-family: Arial, sans-serif;
      color: #333;
      line-height: 1.4;
    }
    body {
      padding: 0;
      background-color: #ffffff;
    }
    .page {
      padding: 40px;
      min-height: 100vh;
    }
    .footer {
      position: fixed;
      bottom: 0;
      left: 0;
      right: 0;
      padding: 15px 40px;
      border-top: 1px solid #e0e0e0;
      background: white;
      font-size: 9px;
      color: #999;
      text-align: center;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    .footer-left {
      text-align: left;
    }
    .footer-center {
      text-align: center;
    }
    .footer-right {
      text-align: right;
    }
    @media print {
      .page {
        padding: 20mm;
      }
      .footer {
        position: fixed;
        bottom: 0;
      }
    }
    @page {
      margin: 0;
      @bottom-center {
        content: "Seite " counter(page) " von " counter(pages);
        font-size: 9px;
        color: #999;
      }
    }
  </style>
</head>
<body>
  ${coverPageHTML}
  ${summaryHTML}
  <div class="page">
    <div style="font-size: 18px; font-weight: bold; color: #0a0a0a; margin-bottom: 30px; padding-bottom: 15px; border-bottom: 2px solid #00ff88;">
      BEFUNDE NACH EINHEITEN
    </div>
    ${unitsHTML}
  </div>
  <div class="footer">
    <div class="footer-left">
      ${escapeHtml(inspection.projectName)} | Inspektion #${inspection.id}
    </div>
    <div class="footer-center">
      Generiert von Mantodeus Manager
    </div>
    <div class="footer-right">
      Seite <span class="page-number"></span>
    </div>
  </div>
</body>
</html>
  `;
}

