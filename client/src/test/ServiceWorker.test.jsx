import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';
import { render, screen, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import AppShell from '../layouts/AppShell';
import { registerServiceWorker } from '../utils/registerServiceWorker';

vi.mock('../context/AuthContext', () => ({
  useAuth: () => ({
    user: { uid: 'member-1', email: 'member@ironcore.test' },
    profile: { displayName: 'Test Member', role: 'member', approvalStatus: 'active' },
    isAuthenticated: true,
  }),
}));

vi.mock('../services/auth', () => ({
  logout: vi.fn().mockResolvedValue(undefined),
}));

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PUBLIC_DIR = path.resolve(__dirname, '../../public');

function createServiceWorkerSandbox() {
  const listeners = new Map();
  const cacheStores = new Map();
  const mockFetch = vi.fn();

  const getStore = (name) => {
    if (!cacheStores.has(name)) {
      cacheStores.set(name, new Map());
    }
    const store = cacheStores.get(name);
    return {
      addAll: vi.fn(async (urls) => {
        for (const u of urls) {
          store.set(`https://ironcore.app${u}`, {
            status: 200,
            type: 'basic',
            body: `cached:${u}`,
            clone() {
              return { ...this };
            },
          });
        }
      }),
      match: vi.fn(async (req) => {
        const key = typeof req === 'string' ? `https://ironcore.app${req}` : req.url;
        return store.get(key) || undefined;
      }),
      put: vi.fn(async (req, res) => {
        const key = typeof req === 'string' ? req : req.url;
        store.set(key, res);
      }),
    };
  };

  const sandbox = {
    URL,
    Response: class MockResponse {
      constructor(body, init = {}) {
        this.body = body;
        this.status = init.status || 200;
        this.headers = init.headers || {};
        this.type = 'basic';
      }
      clone() {
        return new MockResponse(this.body, { status: this.status, headers: this.headers });
      }
    },
    fetch: mockFetch,
    caches: {
      open: vi.fn(async (name) => getStore(name)),
      keys: vi.fn(async () => Array.from(cacheStores.keys())),
      delete: vi.fn(async (name) => cacheStores.delete(name)),
    },
    self: {
      location: { origin: 'https://ironcore.app' },
      addEventListener: (type, cb) => listeners.set(type, cb),
      skipWaiting: vi.fn(async () => {}),
      clients: { claim: vi.fn(async () => {}) },
    },
  };

  const swCode = fs.readFileSync(path.join(PUBLIC_DIR, 'sw.js'), 'utf8');
  vm.runInNewContext(swCode, sandbox);

  return { listeners, cacheStores, mockFetch, sandbox };
}

describe('Safe Service Worker Caching & Offline Fallback (Day 27 Task 54)', () => {
  const originalOnLine = Object.getOwnPropertyDescriptor(window.navigator, 'onLine');

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    if (originalOnLine) {
      Object.defineProperty(window.navigator, 'onLine', originalOnLine);
    }
  });

  it('ships a self-contained IRONCORE offline.html fallback page', () => {
    const offlinePath = path.join(PUBLIC_DIR, 'offline.html');
    expect(fs.existsSync(offlinePath)).toBe(true);

    const html = fs.readFileSync(offlinePath, 'utf8');
    expect(html).toContain('IRONCORE');
    expect(html).toContain('Connection unavailable');
    expect(html).toContain('Try again');
    expect(html).toMatch(/attendance|payments/i);
    // Must not reference external scripts or stylesheets while offline
    expect(html).not.toMatch(/https?:\/\//i);
  });

  it('precaches static assets on install and deletes stale caches on activate', async () => {
    const { listeners, cacheStores, sandbox } = createServiceWorkerSandbox();
    cacheStores.set('old-legacy-cache-v0', new Map());

    let installPromise;
    listeners.get('install')({
      waitUntil: (p) => {
        installPromise = p;
      },
    });
    await installPromise;

    expect(cacheStores.has('ironcore-static-v1')).toBe(true);
    const activeCache = cacheStores.get('ironcore-static-v1');
    expect(activeCache.has('https://ironcore.app/offline.html')).toBe(true);
    expect(activeCache.has('https://ironcore.app/manifest.webmanifest')).toBe(true);
    expect(activeCache.has('https://ironcore.app/icons/icon-192.png')).toBe(true);
    expect(sandbox.self.skipWaiting).toHaveBeenCalled();

    let activatePromise;
    listeners.get('activate')({
      waitUntil: (p) => {
        activatePromise = p;
      },
    });
    await activatePromise;

    expect(cacheStores.has('old-legacy-cache-v0')).toBe(false);
    expect(cacheStores.has('ironcore-static-v1')).toBe(true);
    expect(sandbox.self.clients.claim).toHaveBeenCalled();
  });

  it('never intercepts or caches sensitive API, payment, attendance, or cross-origin requests', async () => {
    const { listeners, cacheStores } = createServiceWorkerSandbox();

    const makeReq = (url, { method = 'GET', auth = false, destination = '' } = {}) => ({
      url,
      method,
      destination,
      mode: 'cors',
      headers: {
        has: (h) => auth && h.toLowerCase() === 'authorization',
      },
    });

    const sensitiveRequests = [
      makeReq('https://ironcore.app/api/payments/verify'),
      makeReq('https://ironcore.app/api/attendance/check-in'),
      makeReq('https://ironcore.app/api/members'),
      makeReq('https://ironcore.app/api/auth/session'),
      makeReq('https://ironcore.app/assets/chunk.js', { auth: true }),
      makeReq('https://ironcore.app/assets/chunk.js', { method: 'POST' }),
      makeReq('https://checkout.razorpay.com/v1/checkout.js', { destination: 'script' }),
    ];

    for (const req of sensitiveRequests) {
      let intercepted = false;
      listeners.get('fetch')({
        request: req,
        respondWith: () => {
          intercepted = true;
        },
      });
      expect(intercepted).toBe(false);
    }

    expect(cacheStores.size).toBe(0);
  });

  it('caches static same-origin assets and serves offline.html when navigation fails offline', async () => {
    const { listeners, cacheStores, mockFetch, sandbox } = createServiceWorkerSandbox();

    // Run install so offline.html is cached
    let installPromise;
    listeners.get('install')({ waitUntil: (p) => { installPromise = p; } });
    await installPromise;

    // 1. Static Vite JS bundle should be intercepted and cached on first 200 fetch
    mockFetch.mockResolvedValueOnce(new sandbox.Response('console.log("ok")', { status: 200 }));
    let assetPromise;
    listeners.get('fetch')({
      request: {
        url: 'https://ironcore.app/assets/index-abc123.js',
        method: 'GET',
        destination: 'script',
        mode: 'no-cors',
        headers: { has: () => false },
      },
      respondWith: (p) => {
        assetPromise = p;
      },
    });
    const assetRes = await assetPromise;
    expect(assetRes.status).toBe(200);
    expect(cacheStores.get('ironcore-static-v1').has('https://ironcore.app/assets/index-abc123.js')).toBe(true);

    // 2. Navigation request when offline should fall back to /offline.html
    mockFetch.mockRejectedValueOnce(new Error('Network offline'));
    let navPromise;
    listeners.get('fetch')({
      request: {
        url: 'https://ironcore.app/member/attendance',
        method: 'GET',
        mode: 'navigate',
        headers: { has: () => false },
      },
      respondWith: (p) => {
        navPromise = p;
      },
    });
    const navRes = await navPromise;
    expect(navRes.body).toBe('cached:/offline.html');
  });

  it('registers service worker in production when supported', async () => {
    const registerMock = vi.fn().mockResolvedValue({ scope: '/' });
    const reg = await registerServiceWorker({
      isProd: true,
      navigatorObj: { serviceWorker: { register: registerMock } },
      windowObj: { location: { hostname: 'ironcore.app', port: '443' } },
    });

    expect(registerMock).toHaveBeenCalledWith('/sw.js', { scope: '/' });
    expect(reg).toEqual({ scope: '/' });
  });

  it('displays offline status banner inside AppShell when connectivity is lost', () => {
    Object.defineProperty(window.navigator, 'onLine', { value: true, configurable: true });

    render(
      <MemoryRouter initialEntries={['/member/join']}>
        <Routes>
          <Route element={<AppShell />}>
            <Route path="/member/join" element={<div>Join Content</div>} />
          </Route>
        </Routes>
      </MemoryRouter>
    );

    expect(screen.queryByTestId('offline-banner')).not.toBeInTheDocument();

    act(() => {
      window.dispatchEvent(new Event('offline'));
    });

    expect(screen.getByTestId('offline-banner')).toHaveTextContent(/you are offline/i);

    act(() => {
      window.dispatchEvent(new Event('online'));
    });

    expect(screen.queryByTestId('offline-banner')).not.toBeInTheDocument();
  });
});
