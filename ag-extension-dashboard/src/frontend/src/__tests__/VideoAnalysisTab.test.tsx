import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { VideoAnalysisTab } from '../pages/diagnostics/VideoAnalysisTab';
import { analyzeCropVideo } from '../api/diseaseService';

vi.mock('../api/diseaseService', () => ({
  MAX_DIAGNOSIS_VIDEO_BYTES: 30 * 1024 * 1024,
  analyzeCropVideo: vi.fn(),
}));

describe('VideoAnalysisTab', () => {
  beforeEach(() => vi.resetAllMocks());

  it('uploads a selected video and labels returned observations as unverified', async () => {
    vi.mocked(analyzeCropVideo).mockResolvedValue({ analysis: 'Frame 1: yellow leaves', framesAnalyzed: 1 });
    render(<VideoAnalysisTab />);
    fireEvent.change(screen.getByLabelText('Choose a plant video'), {
      target: { files: [new File(['video'], 'plant.mp4', { type: 'video/mp4' })] },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Analyze video' }));
    expect(await screen.findByText('Frame 1: yellow leaves')).toBeInTheDocument();
    expect(screen.getByText('Unverified observations from 1 frame(s)')).toBeInTheDocument();
    expect(analyzeCropVideo).toHaveBeenCalledWith(expect.stringMatching(/^data:video\/mp4;base64,/));
  });

  it('rejects unsupported and oversized files before uploading', () => {
    render(<VideoAnalysisTab />);
    expect(screen.getByRole('button', { name: 'Analyze video' })).toHaveClass('bg-emerald-800', 'text-white');
    const input = screen.getByLabelText('Choose a plant video');
    fireEvent.change(input, { target: { files: [new File(['x'], 'image.png', { type: 'image/png' })] } });
    expect(screen.getByRole('alert')).toHaveTextContent('MP4');
    const largeFile = new File(['x'], 'large.mp4', { type: 'video/mp4' });
    Object.defineProperty(largeFile, 'size', { value: 30 * 1024 * 1024 + 1 });
    fireEvent.change(input, { target: { files: [largeFile] } });
    expect(screen.getByRole('alert')).toHaveTextContent('30 MB');
    expect(analyzeCropVideo).not.toHaveBeenCalled();
  });

  it('keeps the file available to retry when the provider fails', async () => {
    vi.mocked(analyzeCropVideo).mockRejectedValueOnce(new Error('unavailable'))
      .mockResolvedValueOnce({ analysis: 'Frame 1: wilting', framesAnalyzed: 1 });
    const log = vi.spyOn(console, 'error').mockImplementation(() => {});
    try {
      render(<VideoAnalysisTab />);
      fireEvent.change(screen.getByLabelText('Choose a plant video'), {
        target: { files: [new File(['video'], 'plant.webm', { type: 'video/webm' })] },
      });
      fireEvent.click(screen.getByRole('button', { name: 'Analyze video' }));
      await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('unavailable'));
      expect(screen.getByText('Selected: plant.webm')).toBeInTheDocument();
      fireEvent.click(screen.getByRole('button', { name: 'Analyze video' }));
      expect(await screen.findByText('Frame 1: wilting')).toBeInTheDocument();
    } finally {
      log.mockRestore();
    }
  });

  it.each([
    { flags: { limitReached: true }, message: 'You’ve reached your video observation limit. Review your usage or plan.' },
    { flags: { upgradeRequired: true }, message: 'Video observations require an eligible plan. Review your plan.' },
  ])('shows relevant guidance for access denials', async ({ flags, message }) => {
    vi.mocked(analyzeCropVideo).mockRejectedValueOnce(
      Object.assign(new Error('Forbidden'), { response: { data: flags } })
    );
    const log = vi.spyOn(console, 'error').mockImplementation(() => {});
    try {
      render(<VideoAnalysisTab />);
      fireEvent.change(screen.getByLabelText('Choose a plant video'), {
        target: { files: [new File(['video'], 'plant.mp4', { type: 'video/mp4' })] },
      });
      fireEvent.click(screen.getByRole('button', { name: 'Analyze video' }));
      expect(await screen.findByRole('alert')).toHaveTextContent(message);
    } finally {
      log.mockRestore();
    }
  });
});
