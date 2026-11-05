import {
  createUserWithEmailAndPassword,
  sendEmailVerification,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signOut,
  updateProfile,
} from 'firebase/auth';
import { requireFirebaseAuth } from '../config/firebase';

export async function registerWithEmail({ name, email, password }) {
  const auth = requireFirebaseAuth();
  const credential = await createUserWithEmailAndPassword(auth, email, password);

  await updateProfile(credential.user, { displayName: name });
  await sendEmailVerification(credential.user);
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
