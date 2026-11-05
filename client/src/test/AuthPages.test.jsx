import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import LoginPage from '../pages/auth/LoginPage';
import RegisterPage from '../pages/auth/RegisterPage';
import ForgotPasswordPage from '../pages/auth/ForgotPasswordPage';
import {
  loginWithEmail,
  registerWithEmail,
  sendPasswordReset,
} from '../services/auth';

vi.mock('../services/auth', () => ({
  loginWithEmail: vi.fn(),
  registerWithEmail: vi.fn(),
  sendPasswordReset: vi.fn(),
}));

function renderPage(page) {
  return render(<MemoryRouter>{page}</MemoryRouter>);
}

describe('Firebase authentication screens', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('signs in with email and password', async () => {
    renderPage(<LoginPage />);
    fireEvent.change(screen.getByPlaceholderText('name@example.com'), {
      target: { value: 'member@example.com' },
    });
    fireEvent.change(screen.getByPlaceholderText('••••••••'), {
      target: { value: 'password123' },
    });
    fireEvent.click(screen.getByRole('button', { name: /sign in/i }));

    await waitFor(() => {
      expect(loginWithEmail).toHaveBeenCalledWith({
        email: 'member@example.com',
        password: 'password123',
      });
    });
  });

  it('registers without exposing a client-selected role', async () => {
    renderPage(<RegisterPage />);
    expect(screen.queryByLabelText(/account role/i)).not.toBeInTheDocument();

    fireEvent.change(screen.getByLabelText(/full name/i), {
      target: { value: 'Member One' },
    });
    fireEvent.change(screen.getByLabelText(/email address/i), {
      target: { value: 'member@example.com' },
    });
    fireEvent.change(screen.getByLabelText('Password'), {
      target: { value: 'password123' },
    });
    fireEvent.click(screen.getByRole('button', { name: /register/i }));

    await waitFor(() => {
      expect(registerWithEmail).toHaveBeenCalledWith({
        name: 'Member One',
        email: 'member@example.com',
        password: 'password123',
      });
    });
  });

  it('sends password reset requests through Firebase', async () => {
    renderPage(<ForgotPasswordPage />);
    fireEvent.change(screen.getByLabelText(/registered email/i), {
      target: { value: 'member@example.com' },
    });
    fireEvent.click(screen.getByRole('button', { name: /send reset link/i }));

    await waitFor(() => {
      expect(sendPasswordReset).toHaveBeenCalledWith('member@example.com');
    });
  });
});
