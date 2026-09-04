import PDFDocument from 'pdfkit';
import * as XLSX from 'xlsx';
import { query } from '@/services/databaseService';
import type { ReportListRow } from '@/types/rowTypes';
import { type VisitStatsDTO, type ConversationStatsDTO } from '@/types/dtos';
import { objectStorage } from '@/services/objectStorageService';
import { logger } from '@/utils/logger';

interface ReportStorageContent {
  visits?: VisitStatsDTO;
  conversations?: ConversationStatsDTO;
  metadata?: {
    region?: string | null;
    startDate?: string | null;
    endDate?: string | null;
    officerId?: string | null;
    cropType?: string | null;
  };
  overallHealth?: 'healthy' | 'stressed' | 'diseased' | 'unknown';
  confidence?: number;
  reviewStatus?: 'ready' | 'needs_expert_review';
  provenance?: {
    evidenceStatus: 'verified_source' | 'no_verified_source';
    source: string;
    sourceUrl: string | null;
    sourceTimestamp: string | null;
    provider: string | null;
    model: string | null;
    generatedAt: string;
  };
  diseases?: Array<{
    disease: string;
    severity?: string;
    confidence?: number;
    reviewStatus?: 'ready' | 'needs_expert_review';
    provenance?: ReportStorageContent['provenance'];
    description?: string;
    symptoms?: string[];
    treatment?: string[];
  }>;
  nutrientDeficiencies?: string[];
  recommendations?: string[];
  overallHealthScore?: number | null;
  texture?: string;
  estimatedMoisture?: string;
  drainageClass?: string;
  colorDiscoloration?: string;
  npkDeficiencies?: {
    nitrogen?: string;
    phosphorus?: string;
    potassium?: string;
  };
  cropSuitability?: string[];
  storage?: {
    pdf?: { key: string; url: string; sizeBytes: number; storedAt: string };
    csv?: { key: string; url: string; sizeBytes: number; storedAt: string };
    excel?: { key: string; url: string; sizeBytes: number; storedAt: string };
  };
}

interface ReportArchiveResult {
  reportId: string;
  pdf?: { key: string; url: string; sizeBytes: number };
  csv?: { key: string; url: string; sizeBytes: number };
  excel?: { key: string; url: string; sizeBytes: number };
}

function buildReportCsv(report: ReportListRow): Buffer {
  const data = (report.content || {}) as ReportStorageContent;
  let csv = 'Metric,Value\n';

  if (data.visits) {
    const visits = data.visits as unknown as Record<string, unknown>;
    csv += `Total Visits,${visits.total || 0}\n`;
    csv += `Completed Visits,${visits.completed || 0}\n`;
    csv += `Total Minutes,${visits.totalMinutes || visits.total_minutes || 0}\n`;
  }
  if (data.conversations) {
    const conv = data.conversations as unknown as Record<string, unknown>;
    csv += `Total Conversations,${conv.totalConversations || conv.total_conversations || 0}\n`;
    csv += `Average Satisfaction,${conv.avgSatisfaction || conv.avg_satisfaction || 0}\n`;
  }

  return Buffer.from(csv, 'utf8');
}

function buildReportExcel(report: ReportListRow): Buffer {
  const data = (report.content || {}) as ReportStorageContent;
  const wb = XLSX.utils.book_new();

  const summaryData = [
    ['Agricultural Extension Report'],
    [''],
    ['Report Title', report.title || 'Activity Report'],
    ['Report Type', report.type],
    ['Status', report.status],
    ['Generated', new Date(report.created_at).toLocaleString()],
    ['Period Start', data.metadata?.startDate ? new Date(data.metadata.startDate).toLocaleDateString() : 'N/A'],
    ['Period End', data.metadata?.endDate ? new Date(data.metadata.endDate).toLocaleDateString() : 'N/A'],
  ];
  const summarySheet = XLSX.utils.aoa_to_sheet(summaryData);
  XLSX.utils.book_append_sheet(wb, summarySheet, 'Summary');

  if (data.visits) {
    const visits = data.visits as unknown as Record<string, unknown>;
    const visitsData = [
      ['Visit Statistics'],
      [''],
      ['Metric', 'Value'],
      ['Total Visits', visits.total || 0],
      ['Completed Visits', visits.completed || 0],
      ['Total Minutes', visits.totalMinutes || visits.total_minutes || 0],
    ];
    const visitsSheet = XLSX.utils.aoa_to_sheet(visitsData);
    XLSX.utils.book_append_sheet(wb, visitsSheet, 'Visits');
  }

  if (data.conversations) {
    const conv = data.conversations as unknown as Record<string, unknown>;
    const convData = [
      ['Conversation Statistics'],
      [''],
      ['Metric', 'Value'],
      ['Total Conversations', conv.totalConversations || conv.total_conversations || 0],
      ['Rated Conversations', conv.rated || 0],
      ['Average Satisfaction', conv.avgSatisfaction || conv.avg_satisfaction || 0],
    ];
    const convSheet = XLSX.utils.aoa_to_sheet(convData);
    XLSX.utils.book_append_sheet(wb, convSheet, 'Conversations');
  }

  return XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
}

function drawDiseaseDiagnosisHeader(doc: PDFKit.PDFDocument, report: ReportListRow, data: ReportStorageContent) {
  doc.rect(0, 0, doc.page.width, 110).fill('#1b5e20');
  doc.fillColor('#ffffff')
    .fontSize(20)
    .font('Helvetica-Bold')
    .text('Agricultural Decision-Support System', 50, 30);
  doc.fontSize(13)
    .font('Helvetica')
    .text('Plant Pathology & Leaf Diagnosis Report', 50, 60);
  doc.rect(0, 110, doc.page.width, 5).fill('#81c784');

  doc.y = 135;
  doc.fillColor('#1b5e20')
    .fontSize(15)
    .font('Helvetica-Bold')
    .text(report.title || 'Plant Pathology Scan', 50, doc.y);
  doc.moveDown(0.5);

  const crop = data.metadata?.cropType || 'Unspecified Crop';
  const generatedDate = new Date(report.created_at).toLocaleString();
  const startY = doc.y;
  doc.fontSize(9)
    .fillColor('#455a64')
    .font('Helvetica-Bold')
    .text('Target Crop:', 50, startY)
    .font('Helvetica')
    .text(crop.toUpperCase(), 150, startY)
    .font('Helvetica-Bold')
    .text('Analysis Date:', 300, startY)
    .font('Helvetica')
    .text(generatedDate, 400, startY);

  doc.moveDown(1.5);
  const health = data.overallHealth || 'healthy';
  let bannerBg = '#e8f5e9';
  let bannerText = '#1b5e20';
  if (health === 'stressed') {
    bannerBg = '#fff3e0';
    bannerText = '#e65100';
  } else if (health === 'diseased') {
    bannerBg = '#ffebee';
    bannerText = '#b71c1c';
  }

  doc.rect(50, doc.y, doc.page.width - 100, 45).fill(bannerBg);
  const bannerY = doc.y + 15;
  doc.fillColor(bannerText)
    .fontSize(11)
    .font('Helvetica-Bold')
    .text(`OVERALL CROP HEALTH STATUS:  ${health.toUpperCase()}`, 70, bannerY);

  if (data.confidence) {
    doc.font('Helvetica')
      .fontSize(9)
      .text(`Confidence Score: ${(data.confidence * 100).toFixed(1)}%`, doc.page.width - 200, bannerY, { align: 'right' });
  }

  doc.y = bannerY + 45;
}

function drawDiseasePathologies(doc: PDFKit.PDFDocument, data: ReportStorageContent) {
  doc.fillColor('#263238')
    .fontSize(13)
    .font('Helvetica-Bold')
    .text('Detected Pathologies & Issues', 50, doc.y);
  doc.moveDown(0.5);

  if (data.diseases && data.diseases.length > 0) {
    data.diseases.forEach((dis, idx) => {
      const disY = doc.y;
      doc.rect(50, disY, doc.page.width - 100, 140).stroke('#cfd8dc');
      doc.fillColor('#b71c1c')
        .fontSize(11)
        .font('Helvetica-Bold')
        .text(`${idx + 1}. ${dis.disease}`, 65, disY + 12);
      doc.fillColor('#455a64')
        .fontSize(9)
        .font('Helvetica-Bold')
        .text(`Severity: ${dis.severity?.toUpperCase() || 'MODERATE'}`, doc.page.width - 250, disY + 12)
        .text(`Confidence: ${dis.confidence}%`, doc.page.width - 150, disY + 12);

      doc.fillColor('#263238')
        .font('Helvetica')
        .fontSize(9)
        .text(dis.description || 'No description provided.', 65, disY + 32, { width: doc.page.width - 130 });

      const listY = disY + 65;
      doc.fillColor('#1b5e20')
        .font('Helvetica-Bold')
        .fontSize(9)
        .text('Observed Symptoms:', 65, listY)
        .text('Recommended Treatments:', 300, listY);

      doc.fillColor('#37474f')
        .font('Helvetica')
        .fontSize(8);

      const symptoms = (dis.symptoms || []).slice(0, 3);
      symptoms.forEach((sym: string, sIdx: number) => {
        doc.text(`• ${sym}`, 65, listY + 15 + (sIdx * 10), { width: 220 });
      });

      const treatments = (dis.treatment || []).slice(0, 3);
      treatments.forEach((treat: string, tIdx: number) => {
        doc.text(`• ${treat}`, 300, listY + 15 + (tIdx * 10), { width: 250 });
      });

      doc.y = disY + 155;
    });
  } else {
    doc.fillColor('#455a64')
      .font('Helvetica-Oblique')
      .fontSize(10)
      .text('No active crop diseases or visual pathogens detected in this sample.', 60, doc.y);
    doc.moveDown(1);
  }
}

function generateDiseaseDiagnosisPDF(doc: PDFKit.PDFDocument, report: ReportListRow, data: ReportStorageContent) {
  drawDiseaseDiagnosisHeader(doc, report, data);
  drawDiseasePathologies(doc, data);

  if (data.nutrientDeficiencies && data.nutrientDeficiencies.length > 0) {
    doc.fillColor('#263238')
      .fontSize(12)
      .font('Helvetica-Bold')
      .text('Nutrient & Chemical Observations', 50, doc.y);
    doc.moveDown(0.5);

    data.nutrientDeficiencies.forEach((def: string) => {
      doc.fillColor('#e65100')
        .font('Helvetica-Bold')
        .fontSize(9)
        .text('⚠  POTENTIAL NUTRIENT DEFICIENCY: ', 65, doc.y)
        .font('Helvetica')
        .fillColor('#37474f')
        .text(def, doc.x + 5, doc.y);
      doc.moveDown(0.3);
    });
    doc.moveDown(0.5);
  }

  if (data.recommendations && data.recommendations.length > 0) {
    doc.fillColor('#1b5e20')
      .fontSize(12)
      .font('Helvetica-Bold')
      .text('Agronomic Advisory & Actions', 50, doc.y);
    doc.moveDown(0.5);

    doc.fillColor('#37474f')
      .font('Helvetica')
      .fontSize(9);

    data.recommendations.forEach((rec: string) => {
      doc.text(`✓   ${rec}`, 65, doc.y);
      doc.moveDown(0.4);
    });
  }

  doc.fontSize(8)
    .fillColor('#95a5a6')
    .text('This pathology analysis represents an AI-assisted diagnostic estimate and should be validated through direct agronomic inspection.', 50, doc.page.height - 40, { align: 'center', width: doc.page.width - 100 });
}

function drawSoilDiagnosticHeader(doc: PDFKit.PDFDocument, report: ReportListRow, data: ReportStorageContent) {
  doc.rect(0, 0, doc.page.width, 110).fill('#3e2723');
  doc.fillColor('#ffffff')
    .fontSize(20)
    .font('Helvetica-Bold')
    .text('Agricultural Decision-Support System', 50, 30);
  doc.fontSize(13)
    .font('Helvetica')
    .text('High-Fidelity Soil Diagnostics & Advisory Report', 50, 60);
  doc.rect(0, 110, doc.page.width, 5).fill('#8d6e63');

  doc.y = 135;
  doc.fillColor('#3e2723')
    .fontSize(15)
    .font('Helvetica-Bold')
    .text(report.title || 'Soil Diagnostics Scan', 50, doc.y);
  doc.moveDown(0.5);

  const crop = data.metadata?.cropType || 'General Suitability';
  const generatedDate = new Date(report.created_at).toLocaleString();
  const startY = doc.y;
  doc.fontSize(9)
    .fillColor('#455a64')
    .font('Helvetica-Bold')
    .text('Target Crop Focus:', 50, startY)
    .font('Helvetica')
    .text(crop.toUpperCase(), 170, startY)
    .font('Helvetica-Bold')
    .text('Diagnostics Date:', 300, startY)
    .font('Helvetica')
    .text(generatedDate, 410, startY);

  doc.moveDown(1.5);
  const score = data.overallHealthScore;
  let scoreColor = '#1b5e20';
  let scoreBg = '#e8f5e9';
  if (score === null || score === undefined) {
    scoreColor = '#616161';
    scoreBg = '#f5f5f5';
  } else if (score < 50) {
    scoreColor = '#b71c1c';
    scoreBg = '#ffebee';
  } else if (score < 75) {
    scoreColor = '#e65100';
    scoreBg = '#fff3e0';
  }

  doc.rect(50, doc.y, doc.page.width - 100, 45).fill(scoreBg);
  const bannerY = doc.y + 15;
  doc.fillColor(scoreColor)
    .fontSize(11)
    .font('Helvetica-Bold')
    .text(`SOIL DIAGNOSTIC QUALITY RATING:  ${score !== null && score !== undefined ? `${score}/100` : 'NOT DETERMINED'}`, 70, bannerY);

  doc.y = bannerY + 45;
}

function generateSoilDiagnosticPDF(doc: PDFKit.PDFDocument, report: ReportListRow, data: ReportStorageContent) {
  drawSoilDiagnosticHeader(doc, report, data);

  doc.fillColor('#3e2723')
    .fontSize(13)
    .font('Helvetica-Bold')
    .text('Physical & Chemical Soil Characteristics', 50, doc.y);
  doc.moveDown(0.8);

  const startY = doc.y;
  doc.fontSize(9).fillColor('#37474f');
  doc.text(`Texture Class: ${data.texture || 'N/A'}`, 65, startY);
  doc.text(`Estimated Moisture: ${data.estimatedMoisture || 'N/A'}`, 250, startY);
  doc.text(`Drainage: ${data.drainageClass || 'N/A'}`, 430, startY);

  doc.y = startY + 25;
  if (data.cropSuitability && data.cropSuitability.length > 0) {
    doc.fontSize(11).font('Helvetica-Bold').fillColor('#1b5e20').text('Crop Suitability Matches:', 50, doc.y);
    doc.moveDown(0.3);
    doc.fontSize(9).font('Helvetica').fillColor('#37474f').text(data.cropSuitability.join(', '), 65, doc.y);
    doc.moveDown(1);
  }

  doc.fontSize(8)
    .fillColor('#95a5a6')
    .text('Soil diagnostic advisory generated based on regional SoilGrids and physical field parameters.', 50, doc.page.height - 40, { align: 'center', width: doc.page.width - 100 });
}

function drawGeneralReportDetails(doc: PDFKit.PDFDocument, report: ReportListRow, data: ReportStorageContent) {
  doc.fontSize(18).fillColor('#2c3e50').text(report.title || 'Agricultural Extension Report', { underline: true });
  doc.moveDown(0.5);
  doc.fontSize(10).fillColor('#7f8c8d');
  doc.text(`Generated: ${new Date(report.created_at).toLocaleString()}`);
  doc.text(`Report Type: ${report.type}`);
  doc.text(`Status: ${report.status}`);
  const startDateStr = data.metadata?.startDate ? new Date(data.metadata.startDate).toLocaleDateString() : 'N/A';
  const endDateStr = data.metadata?.endDate ? new Date(data.metadata.endDate).toLocaleDateString() : 'N/A';
  doc.text(`Period: ${startDateStr} - ${endDateStr}`);
  doc.moveDown(1);

  if (data.visits) {
    const visits = data.visits as unknown as Record<string, unknown>;
    doc.fontSize(12).fillColor('#2c3e50').text('Visit Statistics', { underline: true });
    doc.moveDown(0.5);
    doc.fontSize(10).fillColor('#34495e');
    doc.text(`Total Visits: ${visits.total || 0}`);
    doc.text(`Completed Visits: ${visits.completed || 0}`);
    doc.text(`Total Minutes: ${visits.totalMinutes || visits.total_minutes || 0}`);
    doc.moveDown(1);
  }

  if (data.conversations) {
    const conv = data.conversations as unknown as Record<string, unknown>;
    const avgSat = conv.avgSatisfaction || conv.avg_satisfaction;
    doc.fontSize(12).fillColor('#2c3e50').text('Conversation Statistics', { underline: true });
    doc.moveDown(0.5);
    doc.fontSize(10).fillColor('#34495e');
    doc.text(`Total Conversations: ${conv.totalConversations || conv.total_conversations || 0}`);
    doc.text(`Rated Conversations: ${conv.rated || 0}`);
    doc.text(`Average Satisfaction: ${avgSat ? Number(avgSat).toFixed(1) + '/5' : 'N/A'}`);
    doc.moveDown(1);
  }

  doc.moveDown(2);
  doc.fontSize(8).fillColor('#95a5a6').text('Agricultural Extension Decision Support System', { align: 'center' });
}

function buildReportPdf(report: ReportListRow): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 50 });
    const chunks: Buffer[] = [];
    doc.on('data', chunk => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    const data = (report.content || {}) as ReportStorageContent;
    if (report.type === 'disease_diagnosis') {
      generateDiseaseDiagnosisPDF(doc, report, data);
    } else if (report.type === 'soil_diagnostic') {
      generateSoilDiagnosticPDF(doc, report, data);
    } else {
      drawGeneralReportDetails(doc, report, data);
    }
    doc.end();
  });
}

export async function archiveReportToObjectStorage(reportId: string): Promise<ReportArchiveResult> {
  const result = await query<ReportListRow>('SELECT * FROM reports WHERE id = $1', [reportId]);
  const report = result.rows[0];
  if (!report) {
    throw new Error(`Report not found: ${reportId}`);
  }

  const tenant = report.tenant_id || 'global';
  const prefix = `reports/${tenant}/${report.id}`;

  const [pdfBuffer, csvBuffer, excelBuffer] = await Promise.all([
    buildReportPdf(report),
    Promise.resolve(buildReportCsv(report)),
    Promise.resolve(buildReportExcel(report)),
  ]);

  const [pdfMeta, csvMeta, excelMeta] = await Promise.all([
    objectStorage.putObject({
      key: `${prefix}/report_${report.id}.pdf`,
      buffer: pdfBuffer,
      contentType: 'application/pdf',
      metadata: { reportId: report.id, reportType: report.type, tenantId: tenant },
    }),
    objectStorage.putObject({
      key: `${prefix}/report_${report.id}.csv`,
      buffer: csvBuffer,
      contentType: 'text/csv',
      metadata: { reportId: report.id, reportType: report.type, tenantId: tenant },
    }),
    objectStorage.putObject({
      key: `${prefix}/report_${report.id}.xlsx`,
      buffer: excelBuffer,
      contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      metadata: { reportId: report.id, reportType: report.type, tenantId: tenant },
    }),
  ]);

  const now = new Date().toISOString();
  const existingContent = (typeof report.content === 'object' && report.content !== null) ? report.content : {};
  const updatedContent = {
    ...existingContent,
    storage: {
      pdf: { key: pdfMeta.key, url: pdfMeta.url, sizeBytes: pdfMeta.sizeBytes, storedAt: now },
      csv: { key: csvMeta.key, url: csvMeta.url, sizeBytes: csvMeta.sizeBytes, storedAt: now },
      excel: { key: excelMeta.key, url: excelMeta.url, sizeBytes: excelMeta.sizeBytes, storedAt: now },
    },
  };

  await query('UPDATE reports SET content = $1, updated_at = NOW() WHERE id = $2', [
    JSON.stringify(updatedContent),
    report.id,
  ]);

  logger.info(`[ReportStorage] Archived report ${report.id} to Object Storage (${pdfMeta.storageBackend})`);

  return {
    reportId: report.id,
    pdf: { key: pdfMeta.key, url: pdfMeta.url, sizeBytes: pdfMeta.sizeBytes },
    csv: { key: csvMeta.key, url: csvMeta.url, sizeBytes: csvMeta.sizeBytes },
    excel: { key: excelMeta.key, url: excelMeta.url, sizeBytes: excelMeta.sizeBytes },
  };
}
