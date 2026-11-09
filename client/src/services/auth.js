import {
  createUserWithEmailAndPassword,
  sendEmailVerification,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signInWithPopup,
  GoogleAuthProvider,
  signOut,
  updateProfile,
} from 'firebase/auth';
import { requireFirebaseAuth } from '../config/firebase';

export async function registerWithEmail({ name, email, password, role = 'member' }) {
  const auth = requireFirebaseAuth();
  const credential = await createUserWithEmailAndPassword(auth, email, password);

  await updateProfile(credential.user, { displayName: name });
  try {
    await sendEmailVerification(credential.user);
  } catch (verifyErr) {
    console.warn('[registerWithEmail] Email verification send warning:', verifyErr.message);
  }

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

  const requireVerification = import.meta.env.VITE_REQUIRE_EMAIL_VERIFICATION !== 'false';
  if (requireVerification && !credential.user.emailVerified) {
    await signOut(auth);
    const error = new Error('Verify your email address before signing in. Check your inbox for the link.');
    error.code = 'auth/email-not-verified';
    throw error;
  }

  return credential.user;
}

export async function loginWithGoogle(role = 'member') {
  const auth = requireFirebaseAuth();
  const provider = new GoogleAuthProvider();
  provider.setCustomParameters({ prompt: 'select_account' });
  const credential = await signInWithPopup(auth, provider);

  // Initialize or fetch backend Firestore profile
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
        displayName: credential.user.displayName || credential.user.email?.split('@')[0] || 'User',
        role: role === 'owner' ? 'member' : role,
      }),
    });
  } catch {
    // Already exists or offline fallback
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
