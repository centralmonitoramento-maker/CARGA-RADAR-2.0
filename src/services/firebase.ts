import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore, doc, getDocFromServer } from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';

import { getApps, getApp } from 'firebase/app';

const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();
export const db = (() => {
  try {
    return firebaseConfig?.firestoreDatabaseId 
      ? getFirestore(app, firebaseConfig.firestoreDatabaseId)
      : getFirestore(app);
  } catch (err) {
    console.warn('Firestore initialization warning, falling back to default:', err);
    try {
      return getFirestore(app);
    } catch {
      return null as any;
    }
  }
})();
export const auth = (() => {
  try {
    return getAuth(app);
  } catch (err) {
    console.warn('Auth initialization warning:', err);
    return null as any;
  }
})();

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null): void {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData?.map(provider => ({
        providerId: provider.providerId,
        email: provider.email,
      })) || []
    },
    operationType,
    path
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
}

// Test initial connection as required by skill instructions
export async function testConnection(): Promise<void> {
  try {
    if (!db) return;
    await getDocFromServer(doc(db, 'test', 'connection'));
    console.log('Firebase connection to Firestore active.');
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.warn("Please check your Firebase configuration.");
    } else {
      console.warn("Firebase non-fatal initial connection note:", error);
    }
  }
}

// Call test connection on boot
if (typeof window !== 'undefined') {
  testConnection().catch(() => {});
}
