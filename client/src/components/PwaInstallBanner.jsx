/**
 * PwaInstallBanner.jsx — Installability prompt UI for supported browsers & iOS Safari (Day 27 Task 53)
 */

import { Download, Share, X } from 'lucide-react';
import './PwaInstallBanner.css';

export default function PwaInstallBanner({
  canPromptInstall,
  isIosInstallable,
  isPrompting,
  onInstall,
  onDismiss,
}) {
  if (!canPromptInstall && !isIosInstallable) {
    return null;
  }

  return (
    <aside
      className="pwa-install-banner"
      aria-label="Install IRONCORE application"
      data-testid="pwa-install-banner"
    >
      <div className="pwa-install-content">
        <div className="pwa-install-icon-wrap" aria-hidden="true">
          {isIosInstallable && !canPromptInstall ? (
            <Share size={18} strokeWidth={1.75} />
          ) : (
            <Download size={18} strokeWidth={1.75} />
          )}
        </div>
        <div className="pwa-install-copy">
          <span className="pwa-install-title">Install IRONCORE app</span>
          <span className="pwa-install-desc">
            {canPromptInstall
              ? 'Open directly from your home screen or desktop for faster QR check-ins'
              : 'Tap Share in Safari and select Add to Home Screen for standalone access'}
          </span>
        </div>
      </div>

      <div className="pwa-install-actions">
        {canPromptInstall && (
          <button
            type="button"
            className="btn btn-primary pwa-install-btn"
            onClick={onInstall}
            disabled={isPrompting}
          >
            <Download size={16} strokeWidth={1.75} />
            <span>{isPrompting ? 'Installing…' : 'Install app'}</span>
          </button>
        )}
        <button
          type="button"
          className="pwa-dismiss-btn"
          onClick={onDismiss}
          aria-label="Dismiss install banner"
        >
          <X size={16} strokeWidth={1.75} />
        </button>
      </div>
    </aside>
  );
}
