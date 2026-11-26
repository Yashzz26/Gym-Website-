/**
 * utils/userResolver.js — Resolves related user document IDs across UID and normalized email.
 *
 * Bridges dev/seeded accounts (e.g. 'member-1-uid' for 'member1@gmail.com') or
 * walk-in records with real Firebase Auth UIDs when email matches the verified token.
 */

export async function resolveRelatedUserIds(db, userId, email = null) {
  const related = new Set();
  if (userId) related.add(userId);

  if (!db) {
    return {
      primaryUserId: userId,
      relatedUserIds: [...related],
      userProfile: null,
    };
  }

  const usersCol = db.collection('users');
  let primaryUserId = userId;
  let userProfile = null;
  let lookupEmail = email ? email.trim().toLowerCase() : null;

  if (userId && typeof usersCol.doc === 'function') {
    try {
      const directDoc = await usersCol.doc(userId).get();
      if (directDoc.exists) {
        const data = directDoc.data();
        userProfile = { uid: directDoc.id, ...data };
        if (!lookupEmail && data?.email) {
          lookupEmail = String(data.email).trim().toLowerCase();
        }
      }
    } catch {
      // Safe fallback to email query
    }
  }

  if (lookupEmail && typeof usersCol.where === 'function') {
    try {
      const snap = await usersCol.where('email', '==', lookupEmail).get();
      if (snap && !snap.empty) {
        snap.forEach((doc) => {
          related.add(doc.id);
          if (!userProfile) {
            primaryUserId = doc.id;
            userProfile = { uid: doc.id, ...doc.data() };
          }
        });
      }
    } catch {
      // Safe no-op if mock Firestore doesn't implement where('email', ...)
    }
  }

  return {
    primaryUserId,
    relatedUserIds: [...related],
    userProfile,
  };
}
