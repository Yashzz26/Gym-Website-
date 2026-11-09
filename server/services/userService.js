/**
 * services/userService.js — User Profile and Firestore Operations
 *
 * Implements business logic and data access for user profiles and staff approval workflows.
 * Enforces zero-trust privilege boundaries:
 *   - Public self-registration can NEVER grant the 'owner' role.
 *   - Users cannot mutate their own 'role' or 'approvalStatus'.
 *   - Direct Firestore client writes are denied; all mutations go through this service.
 */

import { db as defaultDb } from '../config/firebase.js';
import {
  BadRequestError,
  ConflictError,
  ForbiddenError,
  NotFoundError,
} from '../utils/errors.js';

export const FORBIDDEN_SELF_UPDATE_FIELDS = Object.freeze([
  'role',
  'approvalStatus',
  'status',
  'approvedBy',
  'approvedAt',
  'uid',
  'email',
  'createdAt',
]);

/**
 * Creates an instance of the user service.
 * Allows injecting a custom or mocked Firestore instance for testing.
 *
 * @param {import('firebase-admin/firestore').Firestore} [firestoreDb]
 */
export const createUserService = (firestoreDb = defaultDb) => {
  const getCollection = () => {
    if (!firestoreDb) {
      throw new Error('[UserService] Firestore database is not initialized');
    }
    return firestoreDb.collection('users');
  };

  return {
    /**
     * Retrieve a user profile by UID.
     *
     * @param {string} uid
     * @returns {Promise<Object>} User document data
     */
    async getUserById(uid) {
      if (!uid) {
        throw new BadRequestError('User ID is required');
      }

      const docSnap = await getCollection().doc(uid).get();

      if (!docSnap.exists) {
        throw new NotFoundError(`User profile not found for ID: ${uid}`);
      }

      return { uid: docSnap.id, ...docSnap.data() };
    },

    /**
     * Create a new user profile document in Firestore.
     *
     * @param {string} uid - Firebase Auth UID
     * @param {string} email - Firebase Auth email
     * @param {Object} profileData - Validated profile fields
     * @returns {Promise<Object>} Created user profile
     */
    async createUserProfile(uid, email, profileData) {
      if (!uid) {
        throw new BadRequestError('User ID is required');
      }

      // 1. Security Check: Prevent self-assignment of owner role
      const requestedRole = profileData.role || 'member';
      if (requestedRole === 'owner') {
        throw new ForbiddenError('Public registration cannot grant the owner role');
      }

      // 2. Check if profile already exists
      const existingDoc = await getCollection().doc(uid).get();
      if (existingDoc.exists) {
        throw new ConflictError('A user profile already exists for this account');
      }

      const now = new Date().toISOString();

      // 3. Status determination:
      // Members joining online become active only after verified payment.
      // Staff self-registration requires owner approval.
      // Both start with approvalStatus: 'pending'.
      const newUser = {
        uid,
        email: email || '',
        displayName: profileData.displayName,
        phone: profileData.phone || null,
        role: requestedRole,
        approvalStatus: 'pending',
        profilePhotoUrl: profileData.profilePhotoUrl || null,
        whatsappOptIn: Boolean(profileData.whatsappOptIn),
        createdAt: now,
        updatedAt: now,
      };

      await getCollection().doc(uid).set(newUser);
      return newUser;
    },

    /**
     * Update an authenticated user's own profile.
     * Strictly prevents mutating role, approvalStatus, or sensitive credentials.
     *
     * @param {string} uid - Current user UID
     * @param {Object} sanitizedUpdates - Sanitized update fields from Zod
     * @param {Object} rawBody - Raw request body to check for forbidden field attempts
     * @returns {Promise<Object>} Updated user profile
     */
    async updateUserProfile(uid, sanitizedUpdates, rawBody = {}) {
      if (!uid) {
        throw new BadRequestError('User ID is required');
      }

      // Security check: Reject ANY attempt to mutate protected fields
      for (const forbiddenField of FORBIDDEN_SELF_UPDATE_FIELDS) {
        if (rawBody && Object.prototype.hasOwnProperty.call(rawBody, forbiddenField)) {
          throw new ForbiddenError(
            `Modifying protected field '${forbiddenField}' is strictly forbidden.`
          );
        }
      }

      const docRef = getCollection().doc(uid);
      const docSnap = await docRef.get();

      if (!docSnap.exists) {
        throw new NotFoundError('User profile not found. Please complete registration first.');
      }

      const updates = {
        ...sanitizedUpdates,
        updatedAt: new Date().toISOString(),
      };

      // Strip any undefined keys
      Object.keys(updates).forEach((key) => {
        if (updates[key] === undefined) {
          delete updates[key];
        }
      });

      await docRef.update(updates);

      const updatedSnap = await docRef.get();
      return { uid: updatedSnap.id, ...updatedSnap.data() };
    },

    /**
     * List all staff accounts awaiting owner approval (role is trainer or reception and status is pending).
     *
     * @returns {Promise<Array>} List of pending staff user profiles
     */
    async listPendingStaff() {
      const snapshot = await getCollection()
        .where('approvalStatus', '==', 'pending')
        .get();

      const results = [];
      snapshot.forEach((doc) => {
        const data = doc.data();
        if (data.role === 'trainer' || data.role === 'reception') {
          results.push({ uid: doc.id, ...data });
        }
      });

      return results;
    },

    /**
     * Approve a pending staff account (Owner action).
     *
     * @param {string} staffUid - UID of staff to approve
     * @param {string} ownerUid - UID of owner performing approval
     * @param {string} [assignedRole] - Optional role confirmation/override
     * @returns {Promise<Object>} Approved user profile
     */
    async approveStaffAccount(staffUid, ownerUid, assignedRole = null) {
      const docRef = getCollection().doc(staffUid);
      const docSnap = await docRef.get();

      if (!docSnap.exists) {
        throw new NotFoundError(`Staff account not found for ID: ${staffUid}`);
      }

      const current = docSnap.data();
      const updates = {
        approvalStatus: 'active',
        approvedBy: ownerUid,
        approvedAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      if (assignedRole && ['trainer', 'reception'].includes(assignedRole)) {
        updates.role = assignedRole;
      }

      await docRef.update(updates);
      const updatedSnap = await docRef.get();
      return { uid: updatedSnap.id, ...updatedSnap.data() };
    },

    /**
     * Reject or suspend a staff account (Owner action).
     *
     * @param {string} staffUid - UID of staff
     * @param {string} ownerUid - UID of owner
     * @param {string} [reason] - Reason for rejection/suspension
     * @returns {Promise<Object>} Updated user profile
     */
    async suspendStaffAccount(staffUid, ownerUid, reason = null) {
      const docRef = getCollection().doc(staffUid);
      const docSnap = await docRef.get();

      if (!docSnap.exists) {
        throw new NotFoundError(`Staff account not found for ID: ${staffUid}`);
      }

      const updates = {
        approvalStatus: 'suspended',
        suspendedBy: ownerUid,
        suspendedAt: new Date().toISOString(),
        suspensionReason: reason || 'Suspended by gym owner',
        updatedAt: new Date().toISOString(),
      };

      await docRef.update(updates);
      const updatedSnap = await docRef.get();
      return { uid: updatedSnap.id, ...updatedSnap.data() };
    },

    /**
     * Owner-created staff account.
     * Directly creates an active staff account without self-registration pending state.
     *
     * @param {string} uid - Firebase Auth UID
     * @param {string} email - Staff email
     * @param {string} displayName - Staff name
     * @param {'trainer'|'reception'} role - Staff role
     * @param {string} ownerUid - UID of owner creating account
     * @returns {Promise<Object>} Created staff profile
     */
    async createStaffAccountByOwner(uid, email, displayName, role, ownerUid) {
      if (!['trainer', 'reception'].includes(role)) {
        throw new BadRequestError('Role must be either trainer or reception');
      }

      const existingDoc = await getCollection().doc(uid).get();
      if (existingDoc.exists) {
        throw new ConflictError('A profile already exists for this account');
      }

      const now = new Date().toISOString();
      const staffProfile = {
        uid,
        email,
        displayName,
        phone: null,
        role,
        approvalStatus: 'active',
        profilePhotoUrl: null,
        whatsappOptIn: false,
        createdBy: ownerUid,
        approvedBy: ownerUid,
        approvedAt: now,
        createdAt: now,
        updatedAt: now,
      };

      await getCollection().doc(uid).set(staffProfile);
      return staffProfile;
    },
  };
};

export const userService = createUserService();
export default userService;
