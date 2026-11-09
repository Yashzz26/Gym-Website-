import {
  createUserWithEmailAndPassword,
  sendEmailVerification,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signOut,
  updateProfile,
} from 'firebase/auth';
import { requireFirebaseAuth } from '../config/firebase';

export async function registerWithEmail({ name, email, password, role = 'member' }) {
  const auth = requireFirebaseAuth();
  const credential = await createUserWithEmailAndPassword(auth, email, password);

  await updateProfile(credential.user, { displayName: name });
  await sendEmailVerification(credential.user);

  // Attempt to initialize profile in backend if reachable
  try {
    const token = await credential.user.getIdToken();
    const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:5000';
    await fetch(`${apiUrl}/api/users`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        displayName: name,
        role: role === 'owner' ? 'member' : role,
      }),
    });
  } catch {
    // Offline / unit test fallback
  }

  await signOut(auth);
}

export async function loginWithEmail({ email, password }) {
  const auth = requireFirebaseAuth();
  const credential = await signInWithEmailAndPassword(auth, email, password);

  if (!credential.user.emailVerified) {
    await signOut(auth);
    const error = new Error('Verify your email address before signing in.');
    error.code = 'auth/email-not-verified';
    throw error;
  }

  return credential.user;
}

export async function sendPasswordReset(email) {
  const auth = requireFirebaseAuth();
  await sendPasswordResetEmail(auth, email);
}

export async function logout() {
  const auth = requireFirebaseAuth();
  await signOut(auth);
}
