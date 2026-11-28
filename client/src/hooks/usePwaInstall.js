/**
 * usePwaInstall.js — Hook managing Web App Installability & Prompts (Day 27 Task 53)
 *
 * Handles:
 * - Capturing Chromium/Android `beforeinstallprompt` event
 * - Detecting standalone installed mode via matchMedia and navigator.standalone
 * - Detecting iOS Safari for manual "Add to Home Screen" instructions
 * - Tracking `appinstalled` and dismissal cooldowns in localStorage
 */

import { useState, useEffect, useCallback } from 'react';

const DISMISS_KEY = 'ironcore_pwa_install_dismissed_at';
const DISMISS_COOLDOWN_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

function checkStandaloneMode() {
  if (typeof window === 'undefined') return false;
  const displayStandalone =
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(display-mode: standalone)').matches;
  const iosStandalone = Boolean(window.navigator?.standalone);
  return displayStandalone || iosStandalone;
}

function checkIsIosSafari() {
  if (typeof window === 'undefined') return false;
  const ua = window.navigator?.userAgent || '';
  const isIos = /iPad|iPhone|iPod/.test(ua) && !window.MSStream;
  const isSafari = /Safari/.test(ua) && !/CriOS|FxiOS|EdgiOS/.test(ua);
  return isIos && isSafari;
}

function wasRecentlyDismissed() {
  try {
    const raw = window.localStorage?.getItem(DISMISS_KEY);
    if (!raw) return false;
    const dismissedAt = Number(raw);
    if (Number.isNaN(dismissedAt)) return false;
    return Date.now() - dismissedAt < DISMISS_COOLDOWN_MS;
  } catch {
    return false;
  }
}

export function usePwaInstall() {
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [isInstalled, setIsInstalled] = useState(checkStandaloneMode);
  const [isDismissed, setIsDismissed] = useState(wasRecentlyDismissed);
  const [installOutcome, setInstallOutcome] = useState(null);
  const [isPrompting, setIsPrompting] = useState(false);

  const isIosInstallable = !isInstalled && checkIsIosSafari();

  useEffect(() => {
    if (typeof window === 'undefined') return undefined;

    const handleBeforeInstallPrompt = (event) => {
      event.preventDefault();
      setDeferredPrompt(event);
    };

    const handleAppInstalled = () => {
      setIsInstalled(true);
      setDeferredPrompt(null);
      setInstallOutcome('accepted');
    };

    const mediaQuery =
      typeof window.matchMedia === 'function'
        ? window.matchMedia('(display-mode: standalone)')
        : null;

    const handleDisplayChange = (event) => {
      if (event.matches) {
        setIsInstalled(true);
        setDeferredPrompt(null);
      }
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);
    mediaQuery?.addEventListener?.('change', handleDisplayChange);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
      mediaQuery?.removeEventListener?.('change', handleDisplayChange);
    };
  }, []);

  const promptInstall = useCallback(async () => {
    if (!deferredPrompt) return { outcome: 'unavailable' };

    try {
      setIsPrompting(true);
      await deferredPrompt.prompt();
      const choice = await deferredPrompt.userChoice;
      const outcome = choice?.outcome || 'dismissed';
      setInstallOutcome(outcome);

      if (outcome === 'accepted') {
        setIsInstalled(true);
      }
      setDeferredPrompt(null);
      return { outcome };
    } catch {
      return { outcome: 'error' };
    } finally {
      setIsPrompting(false);
    }
  }, [deferredPrompt]);

  const dismissBanner = useCallback(() => {
    setIsDismissed(true);
    try {
      window.localStorage?.setItem(DISMISS_KEY, String(Date.now()));
    } catch {
      // Ignore storage quota errors
    }
  }, []);

  const canPromptInstall = !isInstalled && Boolean(deferredPrompt);
  const showInstallBanner = !isInstalled && !isDismissed && (canPromptInstall || isIosInstallable);

  return {
    canPromptInstall,
    isIosInstallable,
    isInstalled,
    isDismissed,
    isPrompting,
    installOutcome,
    showInstallBanner,
    promptInstall,
    dismissBanner,
  };
}
