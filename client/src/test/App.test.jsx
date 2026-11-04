import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import App from '../App';

describe('Client Application Shell & Routing Smoke Tests', () => {
  it('renders the brand heading and navigation shell', () => {
    render(<App />);

    // Brand logo & title in sidebar
    expect(screen.getByText('IRONCORE')).toBeInTheDocument();
    expect(screen.getAllByText(/Gym Management/i).length).toBeGreaterThan(0);

    // Role switcher tabs
    expect(screen.getByRole('button', { name: /owner/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /reception/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /trainer/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /member/i })).toBeInTheDocument();
  });

  it('renders the home page portal cards on default route', () => {
    render(<App />);

    // Check that portal cards exist
    expect(screen.getByText(/Member Portal/i)).toBeInTheDocument();
    expect(screen.getByText(/Reception Desk/i)).toBeInTheDocument();
    expect(screen.getByText(/Trainer Portal/i)).toBeInTheDocument();
    expect(screen.getByText(/Owner Dashboard/i)).toBeInTheDocument();
  });

  it('displays the sign-in quick link in navigation', () => {
    render(<App />);

    const signinLinks = screen.getAllByRole('link', { name: /sign in/i });
    expect(signinLinks.length).toBeGreaterThan(0);
  });
});
