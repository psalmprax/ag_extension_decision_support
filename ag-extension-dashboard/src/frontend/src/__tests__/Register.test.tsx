import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { LanguageProvider } from '@/lib/LanguageContext';
import { Register } from '../pages/Register';
import apiClient from '@/api/client';
import * as authService from '@/api/authService';

const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

vi.mock('@/api/client', () => ({
  default: { post: vi.fn() },
}));

vi.mock('@/api/authService', () => ({
  register: vi.fn(),
}));

vi.mock('@/components/canvasui/LiquidBackgroundCanvas', () => ({
  LiquidBackgroundCanvas: () => <div data-testid="liquid-canvas" />,
}));

vi.mock('@/components/canvas-ui/AgroEcosystemCanvasScrubber', () => ({
  AgroEcosystemCanvasScrubber: () => <div data-testid="agro-scrubber" />,
}));

vi.mock('@/components/canvasui/LiquidToggleSwitch', () => ({
  LiquidToggleSwitch: () => <div data-testid="liquid-toggle" />,
}));

const mockedPost = apiClient.post as unknown as ReturnType<typeof vi.fn>;
const mockedRegister = authService.register as unknown as ReturnType<typeof vi.fn>;

describe('Register Component Session Handoff', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    sessionStorage.clear();
    localStorage.clear();
  });

  it('navigates to /dashboard when there is no pending consultation session', async () => {
    mockedRegister.mockResolvedValueOnce({
      token: 'jwt-mock-token',
      data: {
        token: 'jwt-mock-token',
        user: { id: 'usr-1', email: 'test@example.com' },
      },
    });

    render(
      <MemoryRouter>
        <LanguageProvider>
          <Register />
        </LanguageProvider>
      </MemoryRouter>
    );

    const form = document.querySelector('form')!;
    fireEvent.submit(form);

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith('/dashboard');
    });

    expect(mockedPost).not.toHaveBeenCalledWith('/chatbot/import-session', expect.anything());
  });

  it('imports pending consultation session and navigates to /farmer-chat?imported=1', async () => {
    const consultationSession = {
      messages: [
        { sender: 'assistant', text: 'Hello! I am your AI Agronomic Assistant.' },
        { sender: 'user', text: 'How do I control Fall Armyworm in maize?' },
        { sender: 'assistant', text: 'Apply cold-pressed Neem oil at 3ml/L.' },
      ],
      entitySlots: {
        crop: 'Maize',
        pest_disease: 'Fall Armyworm',
      },
    };

    sessionStorage.setItem('ag_ext_talking_session_raw', JSON.stringify(consultationSession));

    mockedRegister.mockResolvedValueOnce({
      token: 'jwt-mock-token',
      data: {
        token: 'jwt-mock-token',
        user: { id: 'usr-1', email: 'farmer@example.com' },
      },
    });

    mockedPost.mockResolvedValueOnce({
      data: {
        success: true,
        data: {
          conversationId: 'conv-1234',
          importedMessagesCount: 3,
        },
      },
    });

    render(
      <MemoryRouter>
        <LanguageProvider>
          <Register />
        </LanguageProvider>
      </MemoryRouter>
    );

    const form = document.querySelector('form')!;
    fireEvent.submit(form);

    await waitFor(() => {
      expect(mockedPost).toHaveBeenCalledWith(
        '/chatbot/import-session',
        expect.objectContaining({
          messages: consultationSession.messages,
          entitySlots: consultationSession.entitySlots,
        })
      );
    });

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith('/farmer-chat?imported=1');
    });

    expect(sessionStorage.getItem('ag_ext_talking_session_raw')).toBeNull();
  });
});
