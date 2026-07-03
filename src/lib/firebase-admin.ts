import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { getAuth } from 'firebase-admin/auth';
import { getStorage } from 'firebase-admin/storage';

let adminDb: any;
let adminAuth: any;
let adminStorage: any;

try {
  if (!getApps().length) {
    initializeApp({
      credential: cert({
        projectId: process.env.FIREBASE_PROJECT_ID,
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
        privateKey: process.env.FIREBASE_PRIVATE_KEY ? process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n') : undefined,
      }),
      storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET
    });
  }
  adminDb = getFirestore();
  adminAuth = getAuth();
  adminStorage = getStorage();
} catch (error: any) {
  console.error("Firebase admin initialization failed:", error.message);
  // Do not throw here to prevent module crash. The routes will fail when they try to use adminDb.
}

export { adminDb, adminAuth, adminStorage };
