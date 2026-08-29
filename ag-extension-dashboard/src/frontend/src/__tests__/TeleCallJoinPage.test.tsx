import React from 'react';
import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { LanguageProvider } from '@/lib/LanguageContext';
import { TeleCallJoinPage } from '@/pages/TeleCallJoinPage';
import { useAppStore, type User } from '@/store/useAppStore';

const FARMER_USER: User = {
  id: 'farmer-1',
  firstName: 'Grace',
  lastName: 'Wanjiku',
  email: 'grace@example.com',
  role: 'farmer',
};

// LanguageProvider loads translations asynchronously in useEffect; flush the
// pending microtasks inside act so t() resolves instead of returning raw keys.
async function renderJoinPage(roomId = 'tele-254712345601') {
  const result = render(
    <LanguageProvider>
      <MemoryRouter initialEntries={[`/tele-call/${roomId}`]}>
        <Routes>
          <Route path="/tele-call/:roomId" element={<TeleCallJoinPage />} />
          <Route path="/login" element={<div>Login page</div>} />
          <Route path="*" element={<div>Not found</div>} />
        </Routes>
      </MemoryRouter>
    </LanguageProvider>
  );
  await act(async () => {
    await new Promise(resolve => setTimeout(resolve, 0));
  });
  return result;
}

describe('TeleCallJoinPage', () => {
  beforeEach(() => {
    useAppStore.setState({ user: null });
  });

  it('redirects unauthenticated visitors to login (socket signaling requires a session)', async () => {
    await renderJoinPage();
    expect(screen.getByText('Login page')).toBeInTheDocument();
    expect(screen.queryByText(/Tele-Agronomy Consultation/)).not.toBeInTheDocument();
  });

  it('renders the guest join UI for an authenticated farmer', async () => {
    useAppStore.setState({ user: FARMER_USER });
    await renderJoinPage();

    expect(screen.getByText(/Joining as Grace Wanjiku/)).toBeInTheDocument();
    // Guest mode renders the real WebRTC pre-call view with a Join button
    expect(screen.getByRole('button', { name: /Join Call/i })).toBeInTheDocument();
    expect(screen.queryByText('Login page')).not.toBeInTheDocument();
  });

  it('shows an honest error for a malformed room id', async () => {
    useAppStore.setState({ user: FARMER_USER });
    await renderJoinPage('x');
    expect(screen.getByText('Invalid call link')).toBeInTheDocument();
  });
});
