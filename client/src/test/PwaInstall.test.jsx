import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import PwaInstallBanner from '../components/PwaInstallBanner';
import { usePwaInstall } from '../hooks/usePwaInstall';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const CLIENT_ROOT = path.resolve(__dirname, '../..');
const PUBLIC_DIR = path.join(CLIENT_ROOT, 'public');

function InstallHarness() {
  const {
    canPromptInstall,
    isIosInstallable,
    isInstalled,
    isPrompting,
    installOutcome,
    showInstallBanner,
    promptInstall,
    dismissBanner,
  } = usePwaInstall();

  return (
    <div>
      <span data-testid="installed-flag">{String(isInstalled)}</span>
      <span data-testid="outcome-flag">{installOutcome || 'none'}</span>
      {showInstallBanner && (
        <PwaInstallBanner
          canPromptInstall={canPromptInstall}
          isIosInstallable={isIosInstallable}
          isPrompting={isPrompting}
          onInstall={promptInstall}
          onDismiss={dismissBanner}
        />
      )}
    </div>
  );
}

describe('PWA Manifest, Icons & Install Experience (Day 27 Task 53)', () => {
  const originalMatchMedia = window.matchMedia;

  beforeEach(() => {
    window.localStorage.clear();
    window.matchMedia = vi.fn().mockImplementation((query) => ({
      matches: false,
      media: query,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    }));
  });

  afterEach(() => {
    window.matchMedia = originalMatchMedia;
    vi.restoreAllMocks();
  });

  it('provides a valid manifest.webmanifest with IRONCORE metadata and existing icon assets', () => {
    const manifestPath = path.join(PUBLIC_DIR, 'manifest.webmanifest');
    expect(fs.existsSync(manifestPath)).toBe(true);

    const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
    expect(manifest.name).toContain('IRONCORE');
    expect(manifest.short_name).toBe('IRONCORE');
    expect(manifest.display).toBe('standalone');
    expect(manifest.start_url).toBe('/');
    expect(manifest.theme_color).toBe('#0d0e11');
    expect(manifest.background_color).toBe('#0d0e11');

    const sizes = manifest.icons.map((icon) => icon.sizes);
    expect(sizes).toContain('192x192');
    expect(sizes).toContain('512x512');
    expect(manifest.icons.some((icon) => icon.purpose === 'maskable')).toBe(true);

    for (const icon of manifest.icons) {
      const iconFile = path.join(PUBLIC_DIR, icon.src.replace(/^\//, ''));
      expect(fs.existsSync(iconFile)).toBe(true);
      expect(fs.statSync(iconFile).size).toBeGreaterThan(0);
    }

    const indexHtml = fs.readFileSync(path.join(CLIENT_ROOT, 'index.html'), 'utf8');
    expect(indexHtml).toContain('rel="manifest" href="/manifest.webmanifest"');
    expect(indexHtml).toContain('name="theme-color" content="#0d0e11"');
    expect(fs.existsSync(path.join(PUBLIC_DIR, 'icons/apple-touch-icon.png'))).toBe(true);
  });

  it('captures beforeinstallprompt, triggers native prompt, and marks installed on acceptance', async () => {
    render(
      <MemoryRouter>
        <InstallHarness />
      </MemoryRouter>
    );

    expect(screen.queryByTestId('pwa-install-banner')).not.toBeInTheDocument();

    const promptMock = vi.fn().mockResolvedValue(undefined);
    const fakeEvent = new Event('beforeinstallprompt');
    fakeEvent.preventDefault = vi.fn();
    fakeEvent.prompt = promptMock;
    fakeEvent.userChoice = Promise.resolve({ outcome: 'accepted' });

    act(() => {
      window.dispatchEvent(fakeEvent);
    });

    expect(fakeEvent.preventDefault).toHaveBeenCalled();
    expect(screen.getByTestId('pwa-install-banner')).toBeInTheDocument();

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /install app/i }));
    });

    expect(promptMock).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId('installed-flag')).toHaveTextContent('true');
    expect(screen.getByTestId('outcome-flag')).toHaveTextContent('accepted');
    expect(screen.queryByTestId('pwa-install-banner')).not.toBeInTheDocument();
  });

  it('persists install banner dismissal in localStorage', () => {
    render(
      <MemoryRouter>
        <InstallHarness />
      </MemoryRouter>
    );

    const fakeEvent = new Event('beforeinstallprompt');
    fakeEvent.preventDefault = vi.fn();
    fakeEvent.prompt = vi.fn();
    fakeEvent.userChoice = Promise.resolve({ outcome: 'dismissed' });

    act(() => {
      window.dispatchEvent(fakeEvent);
    });

    expect(screen.getByTestId('pwa-install-banner')).toBeInTheDocument();

    act(() => {
      fireEvent.click(screen.getByRole('button', { name: /dismiss install banner/i }));
    });

    expect(screen.queryByTestId('pwa-install-banner')).not.toBeInTheDocument();
    expect(window.localStorage.getItem('ironcore_pwa_install_dismissed_at')).toBeTruthy();
  });

  it('stays hidden when already running in standalone installed mode', () => {
    window.matchMedia = vi.fn().mockImplementation((query) => ({
      matches: query === '(display-mode: standalone)',
      media: query,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    }));

    render(
      <MemoryRouter>
        <InstallHarness />
      </MemoryRouter>
    );

    expect(screen.getByTestId('installed-flag')).toHaveTextContent('true');
    expect(screen.queryByTestId('pwa-install-banner')).not.toBeInTheDocument();
  });
});
