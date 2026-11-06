import { initializeApp, getApps, getApp } from 'firebase/app';
import {
  initializeFirestore,
  memoryLocalCache,
  getFirestore,
  doc,
  getDoc,
  setDoc,
  onSnapshot,
  terminate,
  setLogLevel,
} from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';
import { PortalDatabasePayload } from '../types';

// Silence internal Firestore SDK retry and backoff logs in browser console
try {
  setLogLevel('silent');
} catch {}

const effectiveConfig = {
  ...firebaseConfig,
  apiKey: (import.meta as any).env?.VITE_FIREBASE_API_KEY || firebaseConfig.apiKey,
};

export const app = !getApps().length ? initializeApp(effectiveConfig) : getApp();

let firestoreInstance;
try {
  firestoreInstance = initializeFirestore(app, {
    localCache: memoryLocalCache(),
  }, effectiveConfig.firestoreDatabaseId);
} catch {
  firestoreInstance = getFirestore(app, effectiveConfig.firestoreDatabaseId);
}

export const db = firestoreInstance;

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

// Batas kuota tulis harian gratis Firebase Cloud telah dihapus:
// Firebase Cloud Firestore aktif sinkron dua arah bersama Express Server dan penyimpanan lokal.
export const isFirestoreQuotaExceeded = false;

export function getIsFirestoreQuotaExceeded(): boolean {
  return false;
}

export function markFirestoreQuotaExceeded() {
  // Batas kuota tulis harian telah dihapus: koneksi dan penulisan tetap aktif
}

export function setIsFirestoreQuotaExceeded(_val: boolean) {}

export function handleFirestoreError(
  error: unknown,
  operationType: OperationType,
  path: string | null
) {
  const errMsg = error instanceof Error ? error.message : String(error);
  const errInfo: FirestoreErrorInfo = {
    error: errMsg,
    authInfo: {
      userId: null,
      email: null,
      emailVerified: null,
      isAnonymous: null,
      tenantId: null,
      providerInfo: [],
    },
    operationType,
    path,
  };
  return errInfo;
}

// Test connection: reads state with timeout protection
export async function testFirestoreConnection(): Promise<boolean> {
  const path = 'portal_state/main_state';
  try {
    const res = await Promise.race([
      getDoc(doc(db, 'portal_state', 'main_state')),
      new Promise<null>((resolve) => setTimeout(() => resolve(null), 2000)),
    ]);
    return Boolean(res);
  } catch {
    return false;
  }
}

// Directly fetch latest cloud state from Firestore with timeout protection
export async function loadStateFromFirestoreDirect(): Promise<PortalDatabasePayload | null> {
  const path = 'portal_state/main_state';
  try {
    const snap = await Promise.race([
      getDoc(doc(db, 'portal_state', 'main_state')),
      new Promise<null>((resolve) => setTimeout(() => resolve(null), 2500)),
    ]);
    if (!snap || !snap.exists()) return null;
    const data = snap.data();
    if (!data || !data.payloadJson) return null;
    return JSON.parse(data.payloadJson) as PortalDatabasePayload;
  } catch {
    return null;
  }
}

// Direct write to Firestore without artificial daily write limits
export async function saveStateToFirestoreDirect(
  payload: PortalDatabasePayload
): Promise<boolean> {
  try {
    const docRef = doc(db, 'portal_state', 'main_state');
    await setDoc(docRef, {
      revision: payload.revision || 1,
      updatedAt: payload.updatedAt || new Date().toISOString(),
      updatedBy: payload.updatedBy || 'Portal Online Gang Mandor',
      payloadJson: JSON.stringify(payload),
    });
    return true;
  } catch (err) {
    console.warn('Direct Firestore save notice (Server Express & Local Storage aktif):', err);
    return false;
  }
}

// Real-time live listener for Firestore
export function subscribeToFirestoreLive(
  onUpdate: (payload: PortalDatabasePayload) => void
): () => void {
  const path = 'portal_state/main_state';
  let unsub: (() => void) | null = null;
  try {
    unsub = onSnapshot(
      doc(db, 'portal_state', 'main_state'),
      (snap) => {
        if (!snap.exists()) return;
        const data = snap.data();
        if (data?.payloadJson) {
          try {
            const parsed = JSON.parse(data.payloadJson);
            onUpdate(parsed);
          } catch {}
        }
      },
      (err) => {
        const errMsg = err?.message || String(err);
        if (
          err?.code === 'resource-exhausted' ||
          errMsg.includes('Quota limit exceeded') ||
          errMsg.includes('Quota exceeded') ||
          err?.code === 'permission-denied'
        ) {
          if (unsub) {
            try {
              unsub();
            } catch {}
            unsub = null;
          }
        }
      }
    );
    return () => {
      if (unsub) {
        try {
          unsub();
        } catch {}
      }
    };
  } catch {
    return () => {};
  }
}
