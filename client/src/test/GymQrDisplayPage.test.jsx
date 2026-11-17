/**
 * test/GymQrDisplayPage.test.jsx — Tests for Gym Entrance Rotating QR Display (Day 16 Task 32)
 */

import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import GymQrDisplayPage from '../pages/reception/GymQrDisplayPage';
import { AuthContext } from '../context/AuthContext';
import * as qrService from '../services/qrService';

vi.mock('../services/qrService');

// Mock QRCode.toDataURL
vi.mock('qrcode', () => ({
  default: {
    toDataURL: vi.fn().mockResolvedValue('data:image/png;base64,mockQrCodeDataUrl'),
  },
}));

function renderWithAuth(ui, authValue = {}) {
  const defaultAuth = {
    user: {
      uid: 'staff-1',
      email: 'reception@fitmax.com',
      getIdToken: () => Promise.resolve('fake-token'),
    },
    profile: { role: 'reception', approvalStatus: 'active' },
    isAuthenticated: true,
    loading: false,
    ...authValue,
  };

  return render(
    <AuthContext.Provider value={defaultAuth}>
      <MemoryRouter>{ui}</MemoryRouter>
    </AuthContext.Provider>
  );
}

describe('GymQrDisplayPage — Entrance Rotating QR Display (Day 16 Task 32)', () => {
  const mockTokenData = {
    token: 'eyJhbGciOiJIUzI1NiJ9.mockTokenSignature',
    gymId: 'fitmax-main',
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + 60,
    expiresInSeconds: 60,
    nonce: 'a1b2c3d4e5f6789012345678',
    expiresAt: new Date(Date.now() + 60000).toISOString(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    qrService.getCurrentQrToken.mockResolvedValue(mockTokenData);
    qrService.rotateQrToken.mockResolvedValue({
      ...mockTokenData,
      nonce: 'f9e8d7c6b5a4321098765432',
      token: 'newToken.signature',
    });
  });

  it('renders branding header, instructions, session info and controls', async () => {
    renderWithAuth(<GymQrDisplayPage />);

    expect(screen.getByText(/FITMAX FITNESS CLUB/i)).toBeInTheDocument();
    expect(screen.getByText(/LIVE ATTENDANCE GATEWAY/i)).toBeInTheDocument();
    expect(screen.getByText(/Scan with FitMax Member App/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /rotate qr/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /kiosk mode/i })).toBeInTheDocument();
  });

  it('loads active QR token on mount and displays the security nonce and countdown', async () => {
    renderWithAuth(<GymQrDisplayPage />);

    await waitFor(() => {
      expect(qrService.getCurrentQrToken).toHaveBeenCalledTimes(1);
      expect(screen.getByText(/a1b2c3d4e5f6/i)).toBeInTheDocument();
      expect(screen.getByText(/60s/i)).toBeInTheDocument();
    });

    const qrImg = screen.getByAltText(/live gym attendance rotating qr/i);
    expect(qrImg).toBeInTheDocument();
    expect(qrImg).toHaveAttribute('src', 'data:image/png;base64,mockQrCodeDataUrl');
  });

  it('manually force-rotates token when clicking Rotate QR button', async () => {
    renderWithAuth(<GymQrDisplayPage />);

    await waitFor(() => {
      expect(screen.getByText(/a1b2c3d4e5f6/i)).toBeInTheDocument();
    });

    const rotateBtn = screen.getByRole('button', { name: /rotate qr/i });
    fireEvent.click(rotateBtn);

    await waitFor(() => {
      expect(qrService.rotateQrToken).toHaveBeenCalledTimes(1);
      expect(screen.getByText(/f9e8d7c6b5a4/i)).toBeInTheDocument();
    });
  });

  it('displays error banner and retry button when fetching fails', async () => {
    qrService.getCurrentQrToken.mockRejectedValueOnce(
      new Error('Network connection timeout')
    );

    renderWithAuth(<GymQrDisplayPage />);

    await waitFor(() => {
      expect(screen.getByText(/Network connection timeout/i)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /retry/i })).toBeInTheDocument();
    });
  });
});
