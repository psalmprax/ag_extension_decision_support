import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { BaseModal } from '@/components/BaseModal';
import { CROP_PRESETS, SvgBoundingBoxesOverlay } from '@/components/EdgeVisionScannerModal';
import { useFeatureFlags } from '@/store/useFeatureFlags';

describe('Base App UX Additions: CropPillScrubber & BaseModal', () => {
  beforeEach(() => {
    useFeatureFlags.setState({ designVariant: 'base' });
  });

  describe('CROP_PRESETS configuration', () => {
    it('contains all essential agronomic target crops', () => {
      const cropIds = CROP_PRESETS.map(c => c.id);
      expect(cropIds).toContain('Maize');
      expect(cropIds).toContain('Cassava');
      expect(cropIds).toContain('Tomato');
      expect(cropIds).toContain('Coffee');
      expect(cropIds).toContain('Banana');
      expect(cropIds).toContain('Legumes');
    });

    it('defines emojis and alternative names for all crops', () => {
      CROP_PRESETS.forEach(crop => {
        expect(crop.emoji).toBeTruthy();
        expect(crop.label).toBeTruthy();
        expect(crop.alt).toBeTruthy();
      });
    });
  });

  describe('BaseModal with Bottom Sheet Drag Support', () => {
    it('renders modal title, content, and mobile drag handle when open in Base variant', () => {
      const onClose = vi.fn();
      render(
        <BaseModal
          isOpen={true}
          onClose={onClose}
          title="Diagnostic HUD"
          subtitle="Real-time Scanner"
        >
          <div>Specimen Content</div>
        </BaseModal>
      );

      expect(screen.getByText('Diagnostic HUD')).toBeInTheDocument();
      expect(screen.getByText('Real-time Scanner')).toBeInTheDocument();
      expect(screen.getByText('Specimen Content')).toBeInTheDocument();

      // Mobile drag handle element exists
      const dragHandle = screen.getByLabelText('Drag down to close');
      expect(dragHandle).toBeInTheDocument();

      // Close button triggers onClose
      const closeBtn = screen.getByLabelText('Close modal');
      fireEvent.click(closeBtn);
      expect(onClose).toHaveBeenCalledTimes(1);
    });

    it('does not render when isOpen is false', () => {
      render(
        <BaseModal isOpen={false} onClose={() => {}} title="Hidden Modal">
          <div>Hidden</div>
        </BaseModal>
      );

      expect(screen.queryByText('Hidden Modal')).not.toBeInTheDocument();
    });
  });

  describe('AD-003: SvgBoundingBoxesOverlay (Low-RAM Android Go)', () => {
    it('renders SVG bounding box elements without canvas overhead', () => {
      const mockBoxes = [
        {
          id: 'box-1',
          label: 'foliar_lesion' as const,
          box: [0.1, 0.2, 0.4, 0.5] as [number, number, number, number],
          confidence: 0.88,
          color: '#ef4444',
        },
      ];

      render(<SvgBoundingBoxesOverlay boxes={mockBoxes} />);

      const svgOverlay = screen.getByTestId('svg-bounding-boxes-overlay');
      expect(svgOverlay).toBeInTheDocument();
      expect(screen.getByText('Foliar Lesion 88%')).toBeInTheDocument();
    });

    it('applies custom bounding rect style to prevent letterbox/pillarbox offset (REM-06)', () => {
      const mockBoxes = [
        {
          id: 'box-2',
          label: 'foliar_lesion' as const,
          box: [0.2, 0.3, 0.6, 0.7] as [number, number, number, number],
          confidence: 0.95,
          color: '#ef4444',
        },
      ];

      render(
        <SvgBoundingBoxesOverlay
          boxes={mockBoxes}
          style={{ top: '10px', left: '20px', width: '300px', height: '200px' }}
        />
      );

      const svgOverlay = screen.getByTestId('svg-bounding-boxes-overlay');
      expect(svgOverlay).toHaveStyle({
        top: '10px',
        left: '20px',
        width: '300px',
        height: '200px',
      });
    });
  });
});
