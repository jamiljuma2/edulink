import { App, getApps, initializeApp, cert } from 'firebase-admin/app';
import { Auth, getAuth } from 'firebase-admin/auth';
import { Storage, getStorage } from 'firebase-admin/storage';

type FirebaseAdminConfig = {
  projectId: string;
  clientEmail: string;
  privateKey: string;
};

function getFirebaseAdminConfig(): FirebaseAdminConfig {
  const projectId = process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n');
  if (!projectId || !clientEmail || !privateKey) {
    throw new Error('Missing Firebase admin environment variables.');
  }
  return { projectId, clientEmail, privateKey };
}

export function getFirebaseAdminApp(): App {
  if (getApps().length === 0) {
    const config = getFirebaseAdminConfig();
    initializeApp({
      credential: cert({
        projectId: config.projectId,
        clientEmail: config.clientEmail,
        privateKey: config.privateKey,
      }),
    });
  }
  return getApps()[0]!;
}

export function getFirebaseAdminAuth(): Auth {
  return getAuth(getFirebaseAdminApp());
}

export function getFirebaseAdminStorage(): Storage {
  return getStorage(getFirebaseAdminApp());
}

export function getFirebaseStorageBucket() {
  const bucketName = process.env.FIREBASE_STORAGE_BUCKET ?? process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET;
  return bucketName ? getFirebaseAdminStorage().bucket(bucketName) : getFirebaseAdminStorage().bucket();
}
