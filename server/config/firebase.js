/**
 * config/firebase.js — Firebase Admin SDK Initialization
 *
 * Initializes Firebase Admin using environment configuration:
 * 1. FIREBASE_SERVICE_ACCOUNT_JSON (direct JSON string)
 * 2. FIREBASE_SERVICE_ACCOUNT_PATH (file path)
 * 3. Emulator environment variables (FIREBASE_AUTH_EMULATOR_HOST / FIRESTORE_EMULATOR_HOST)
 * 4. Fallback projectId for test environments
 *
 * Keeps service-account credentials strictly out of source control.
 */

import fs from 'node:fs';
import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';

function initFirebaseAdmin() {
  if (getApps().length > 0) {
    const existingApp = getApps()[0];
    return {
      adminApp: existingApp,
      auth: getAuth(existingApp),
      db: getFirestore(existingApp),
    };
  }

  const projectId = process.env.FIREBASE_PROJECT_ID || 'gym-management-system';
  let appConfig = { projectId };

  // 1. Check for single-line JSON string in environment variable
  if (process.env.FIREBASE_SERVICE_ACCOUNT_JSON) {
    try {
      const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON);
      appConfig = {
        credential: cert(serviceAccount),
        projectId: serviceAccount.project_id || projectId,
      };
    } catch (err) {
      console.error('[FirebaseAdmin] Failed to parse FIREBASE_SERVICE_ACCOUNT_JSON:', err.message);
    }
  }
  // 2. Check for service account file path
  else if (process.env.FIREBASE_SERVICE_ACCOUNT_PATH) {
    try {
      const filePath = process.env.FIREBASE_SERVICE_ACCOUNT_PATH;
      if (fs.existsSync(filePath)) {
        const fileContent = fs.readFileSync(filePath, 'utf8');
        const serviceAccount = JSON.parse(fileContent);
        appConfig = {
          credential: cert(serviceAccount),
          projectId: serviceAccount.project_id || projectId,
        };
      } else {
        console.warn(`[FirebaseAdmin] Service account file not found at: ${filePath}`);
      }
    } catch (err) {
      console.error('[FirebaseAdmin] Failed to load FIREBASE_SERVICE_ACCOUNT_PATH:', err.message);
    }
  }
  // 3. Emulator mode or Development fallback
  else if (process.env.FIREBASE_AUTH_EMULATOR_HOST || process.env.NODE_ENV === 'test') {
    appConfig = {
      projectId,
    };
  } else {
    console.warn(
      '[FirebaseAdmin] No service account credentials found. Set FIREBASE_SERVICE_ACCOUNT_JSON or FIREBASE_SERVICE_ACCOUNT_PATH.'
    );
  }

  const adminApp = initializeApp(appConfig);
  const auth = getAuth(adminApp);
  const db = getFirestore(adminApp);

  return { adminApp, auth, db };
}

export const { adminApp, auth, db } = initFirebaseAdmin();
export default adminApp;

