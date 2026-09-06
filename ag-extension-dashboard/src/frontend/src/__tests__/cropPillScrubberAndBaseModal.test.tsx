import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { BaseModal } from '@/components/BaseModal';
import { CROP_PRESETS } from '@/components/EdgeVisionScannerModal';
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
});
