// src/lib/firebase-admin.ts
import { initializeApp, getApps, cert, type App } from 'firebase-admin/app';
import { getAuth, type Auth } from 'firebase-admin/auth';
import { getFirestore, type Firestore } from 'firebase-admin/firestore';

// Debug environment variables (only in development)
if (process.env.NODE_ENV === 'development') {
  console.log('Firebase Admin Config:', {
    projectId: process.env.FIREBASE_PROJECT_ID,
    clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
    privateKeyExists: !!process.env.FIREBASE_PRIVATE_KEY,
  });
}

function initializeFirebaseAdmin(): App {
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
let adminApp: App;
try {
  adminApp = initializeFirebaseAdmin();
  if (process.env.NODE_ENV === 'development') {
    console.log('✅ Firebase Admin initialized successfully');
  }
} catch (error) {
  console.error('❌ Firebase Admin initialization failed:', error);
  throw error;
}

// Export functions instead of instances to avoid type issues
export function getAdminAuth(): Auth {
  return getAuth(adminApp);
}

export function getAdminFirestore(): Firestore {
  return getFirestore(adminApp);
}

// Optional: Export the app if needed
export { adminApp };