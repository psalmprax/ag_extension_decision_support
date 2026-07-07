import React from 'react';
import { Modal } from '@/components/Modal';
import type { EmailTemplate } from '@/api/emailWorkflowService';

const TEMPLATE_PREVIEW_SAMPLE_DATA: Record<string, string> = {
  farmerName: 'John Doe',
  officerName: 'Dr. Sarah Johnson',
  location: 'Kampala District',
  visitDate: '2026-04-15',
  visitTime: '10:00 AM',
  purpose: 'Crop disease assessment',
  diseaseName: 'Late Blight',
  region: 'Central Region',
  affectedCrops: 'Tomatoes, Potatoes',
  severity: 'High',
  recommendations: 'Apply copper-based fungicide immediately',
  cropName: 'Tomatoes',
  price: '2500',
  unit: 'UGX/kg',
  priceTable: 'Tomatoes: 2500 UGX/kg\nPotatoes: 1800 UGX/kg',
  marketName: 'Kampala Market',
  date: '2026-04-06',
  dateRange: '2026-04-06 to 2026-04-10',
  weatherSummary: 'Heavy rainfall expected with winds up to 25 km/h',
  recipientName: 'Jane Smith',
  trainingTopic: 'Sustainable Farming Practices',
  time: '2:00 PM',
  trainerName: 'Prof. Michael Brown',
};

function renderTemplatePreview(template: EmailTemplate): { subject: string; body: string } {
  let previewSubject = template.subject;
  let previewBody = template.body;
  template.variables.forEach(variable => {
    const regex = new RegExp(`{{${variable}}}`, 'g');
    const sampleValue = TEMPLATE_PREVIEW_SAMPLE_DATA[variable] || `[${variable}]`;
    previewSubject = previewSubject.replace(regex, sampleValue);
    previewBody = previewBody.replace(regex, sampleValue);
  });
  return { subject: previewSubject, body: previewBody };
}

export function EmailWorkflowsPreviewModal({
  template,
  onClose,
}: {
  template: EmailTemplate;
  onClose: () => void;
}) {
  const preview = renderTemplatePreview(template);
  return (
    <Modal
      title={`Template Preview: ${template.displayName || template.name}`}
      onClose={onClose}
      size="lg"
    >
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Subject
          </label>
          <div className="p-3 bg-gray-50 dark:bg-gray-700 rounded border font-medium">
            {preview.subject}
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Body
          </label>
          <div className="p-4 bg-gray-50 dark:bg-gray-700 rounded border whitespace-pre-wrap font-mono text-sm">
            {preview.body}
          </div>
        </div>

        <div className="text-xs text-gray-500 dark:text-gray-400">
          <strong>Note:</strong> Variables in {'{{'}brackets{'}}'} have been replaced with sample
          data for preview.
        </div>
      </div>

      <div className="flex justify-end mt-6">
        <button
          onClick={onClose}
          className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700"
        >
          Close
        </button>
      </div>
    </Modal>
  );
}
