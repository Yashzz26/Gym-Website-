import { getApps, initializeApp } from 'firebase/app';
import { getAuth, connectAuthEmulator } from 'firebase/auth';
import { getFirestore, connectFirestoreEmulator } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

const requiredConfigKeys = Object.entries(firebaseConfig)
  .filter(([, value]) => !value)
  .map(([key]) => key);

export const isFirebaseConfigured = requiredConfigKeys.length === 0;

const firebaseApp = isFirebaseConfigured
  ? getApps()[0] || initializeApp(firebaseConfig)
  : null;

export const firebaseAuth = firebaseApp ? getAuth(firebaseApp) : null;
export const firebaseDb = firebaseApp ? getFirestore(firebaseApp) : null;
export const firebaseStorage = firebaseApp ? getStorage(firebaseApp) : null;

// Connect to Auth & Firestore emulators if specified
if (firebaseAuth && import.meta.env.VITE_FIREBASE_AUTH_EMULATOR_HOST) {
  try {
    connectAuthEmulator(firebaseAuth, import.meta.env.VITE_FIREBASE_AUTH_EMULATOR_HOST, { disableWarnings: true });
  } catch {
    // Already connected
  }
}

export function requireFirebaseAuth() {
  if (!firebaseAuth) {
    throw new Error(
      'Firebase is not configured. Please create client/.env with your Firebase configuration (VITE_FIREBASE_API_KEY, etc.).',
    );
  }

  return firebaseAuth;
}

export function requireFirebaseDb() {
  if (!firebaseDb) {
    throw new Error(
      'Firebase is not configured. Please create client/.env with your Firebase configuration (VITE_FIREBASE_API_KEY, etc.).',
    );
  }

  return firebaseDb;
}
