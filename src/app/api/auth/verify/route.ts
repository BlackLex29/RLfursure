// lib/firebase-admin.js
import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';

// Debug environment variables
console.log('Firebase Admin Config:', {
  projectId: process.env.FIREBASE_PROJECT_ID,
  clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
  privateKeyExists: !!process.env.FIREBASE_PRIVATE_KEY,
});

function initializeFirebaseAdmin() {
  if (getApps().length > 0) {
    return getApps()[0];
  }

  const projectId = process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n');

  // Validate all required fields
  if (!projectId) {
    throw new Error('Missing FIREBASE_PROJECT_ID environment variable');
  }
  if (!clientEmail) {
    throw new Error('Missing FIREBASE_CLIENT_EMAIL environment variable');
  }
  if (!privateKey) {
    throw new Error('Missing FIREBASE_PRIVATE_KEY environment variable');
  }

  const serviceAccount = {
    projectId,
    clientEmail,
    privateKey,
  };

  return initializeApp({
    credential: cert(serviceAccount),
  });
}

// Initialize Firebase Admin
let adminApp;
try {
  adminApp = initializeFirebaseAdmin();
  console.log('✅ Firebase Admin initialized successfully');
} catch (error) {
  console.error('❌ Firebase Admin initialization failed:', error);
  throw error; // Re-throw to prevent the app from starting with broken Firebase
}

export const adminAuth = getAuth(adminApp);
export const adminFirestore = getFirestore(adminApp);