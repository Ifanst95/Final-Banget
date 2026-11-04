import { initializeApp, getApps, getApp } from 'firebase/app';
import {
  initializeFirestore,
  memoryLocalCache,
  getFirestore,
  doc,
  getDoc,
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

// Client-side Firestore writes are permanently disabled because:
// 1. All persistent data is authoritatively stored & synchronized via Express Server (/api/database),
//    online_database.json, SQLite/JSON, IndexedDB, and localStorage.
// 2. The Firestore free-tier daily write unit quota has been reached on Google Cloud (resource-exhausted).
// Disabling direct client setDoc eliminates duplicate writes and stops the backoff retry loops.
export const isFirestoreQuotaExceeded = true;

export function getIsFirestoreQuotaExceeded(): boolean {
  return true;
}

export function markFirestoreQuotaExceeded() {
  try {
    terminate(db).catch(() => {});
  } catch {}
}

export function setIsFirestoreQuotaExceeded(_val: boolean) {}

export function handleFirestoreError(
  error: unknown,
  operationType: OperationType,
  path: string | null
) {
  const errMsg = error instanceof Error ? error.message : String(error);
  if (
    errMsg.includes('resource-exhausted') ||
    errMsg.includes('Quota limit exceeded') ||
    errMsg.includes('Quota exceeded') ||
    errMsg.includes('RESOURCE_EXHAUSTED')
  ) {
    try {
      terminate(db).catch(() => {});
    } catch {}
    return {
      error: 'Firestore Quota Exceeded (Free tier limit reached for today)',
      authInfo: { userId: null, email: null, emailVerified: null, isAnonymous: null, tenantId: null, providerInfo: [] },
      operationType,
      path,
    };
  }

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

// Test connection without writing: reads state with timeout protection
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

// Direct client-side write to Firestore is safely bypassed:
// Express server endpoint /api/database handles online storage and broadcasting.
export async function saveStateToFirestoreDirect(
  _payload: PortalDatabasePayload
): Promise<boolean> {
  return false;
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
