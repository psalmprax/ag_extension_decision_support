import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AdvisoryStudioPage as Page } from '../pages/AdvisoryStudioPage';

/** The page with a fresh query cache (it lists saved protocols). */
function AdvisoryStudioPage() {
  const client = React.useMemo(() => new QueryClient({ defaultOptions: { queries: { retry: false } } }), []);
  return (
    <QueryClientProvider client={client}>
      <Page />
    </QueryClientProvider>
  );
}
import apiClient from '@/api/client';

vi.mock('@/api/client', () => ({
  default: {
    post: vi.fn(),
    put: vi.fn(),
    get: vi.fn(),
  },
}));

const mockedPost = apiClient.post as unknown as ReturnType<typeof vi.fn>;
const mockedPut = apiClient.put as unknown as ReturnType<typeof vi.fn>;

describe('AdvisoryStudioPage Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (apiClient.get as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({ data: { success: true, data: [] } });
    mockedPost.mockResolvedValue({
      data: {
        success: true,
        data: { id: 'wf-test-123', version: 1 },
      },
    });
    mockedPut.mockResolvedValue({
      data: {
        success: true,
        data: { id: 'wf-test-123', version: 2 },
      },
    });
  });

  it('renders initial default maize workflow template and steps', () => {
    render(<AdvisoryStudioPage />);

    expect(screen.getByDisplayValue('Kenya Maize & Fall Armyworm Bio-Protocol')).toBeInTheDocument();
    expect(screen.getByText('4 steps')).toBeInTheDocument();
    expect(screen.getByText('Crop & phenology phase')).toBeInTheDocument();
    expect(screen.getByText('Fall armyworm severity assessment')).toBeInTheDocument();
    expect(screen.getByText('Mobile PWA preview')).toBeInTheDocument();
  });

  it('switches template when selector changes', () => {
    render(<AdvisoryStudioPage />);

    const selects = screen.getAllByRole('combobox');
    fireEvent.change(selects[0]!, { target: { value: 'soil_lime' } });

    expect(screen.getByDisplayValue('Acidic soil remediation & lime advisory')).toBeInTheDocument();
    expect(screen.getByText('Soil pH Sensor Input')).toBeInTheDocument();
    expect(screen.getByText('3 steps')).toBeInTheDocument();
  });

  it('allows adding a new step block from the palette', () => {
    render(<AdvisoryStudioPage />);

    const initialStepCount = screen.getByText('4 steps');
    expect(initialStepCount).toBeInTheDocument();

    const addSoilBlockBtn = screen.getByText('Soil Chemistry & pH');
    fireEvent.click(addSoilBlockBtn);

    expect(screen.getByText('5 steps')).toBeInTheDocument();
  });

  it('allows moving and deleting steps', () => {
    render(<AdvisoryStudioPage />);

    const deleteButtons = screen.getAllByTitle('Delete step');
    expect(deleteButtons.length).toBe(4);

    fireEvent.click(deleteButtons[0]!);
    expect(screen.getByText('3 steps')).toBeInTheDocument();
  });

  it('handles editing and saving step conditions', () => {
    render(<AdvisoryStudioPage />);

    const editConditionButtons = screen.getAllByText('Edit');
    expect(editConditionButtons.length).toBeGreaterThan(0);

    fireEvent.click(editConditionButtons[0]!);
    const input = screen.getByPlaceholderText("e.g. Crop == 'Maize' or pH < 5.5");
    fireEvent.change(input, { target: { value: 'Severity > 40%' } });

    const saveBtn = screen.getByText('Save');
    fireEvent.click(saveBtn);

    expect(screen.getByText('Severity > 40%')).toBeInTheDocument();
  });

  it('saves draft workflow via API', async () => {
    render(<AdvisoryStudioPage />);

    const saveDraftBtn = screen.getByText('Save draft');
    fireEvent.click(saveDraftBtn);

    await waitFor(() => {
      expect(mockedPost).toHaveBeenCalledWith(
        '/workflows',
        expect.objectContaining({
          title: 'Kenya Maize & Fall Armyworm Bio-Protocol',
          status: 'draft',
        })
      );
    });

    expect(
      await screen.findByText(/Draft saved/i)
    ).toBeInTheDocument();
  });

  it('publishes workflow to field officers', async () => {
    render(<AdvisoryStudioPage />);

    const publishBtn = screen.getByText('Publish');
    fireEvent.click(publishBtn);

    await waitFor(() => {
      expect(mockedPost).toHaveBeenCalledWith(
        '/workflows',
        expect.any(Object)
      );
      expect(mockedPost).toHaveBeenCalledWith(
        '/workflows/wf-test-123/publish'
      );
    });
  });

  it('allows clearing canvas steps', () => {
    render(<AdvisoryStudioPage />);

    const clearBtn = screen.getByText('Clear canvas');
    fireEvent.click(clearBtn);

    expect(screen.getByText('0 steps')).toBeInTheDocument();
  });
});
