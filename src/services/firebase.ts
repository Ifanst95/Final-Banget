import { initializeApp, getApps, getApp } from 'firebase/app';
import {
  getFirestore,
  doc,
  getDoc,
  getDocFromServer,
  setDoc,
  onSnapshot,
} from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';
import { PortalDatabasePayload } from '../types';

export const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);

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

let isFirestoreQuotaExceeded = false;

export function getIsFirestoreQuotaExceeded(): boolean {
  return isFirestoreQuotaExceeded;
}

export function setIsFirestoreQuotaExceeded(val: boolean) {
  isFirestoreQuotaExceeded = val;
}

export function handleFirestoreError(
  error: unknown,
  operationType: OperationType,
  path: string | null
) {
  const errMsg = error instanceof Error ? error.message : String(error);
  if (
    errMsg.includes('resource-exhausted') ||
    errMsg.includes('Quota limit exceeded') ||
    errMsg.includes('Quota exceeded')
  ) {
    isFirestoreQuotaExceeded = true;
    console.warn(
      'Firestore Quota Exceeded (Free Tier limit reached for today). Seamlessly falling back to local server & browser storage.'
    );
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
  console.warn('Firestore Notice: ', JSON.stringify(errInfo));
  return errInfo;
}

// Test connection on boot as required by Firebase integration skill
export async function testFirestoreConnection(): Promise<boolean> {
  if (isFirestoreQuotaExceeded) return false;
  const path = 'portal_state/main_state';
  try {
    const res = await Promise.race([
      getDocFromServer(doc(db, 'portal_state', 'main_state')),
      new Promise<null>((_, reject) => setTimeout(() => reject(new Error('timeout')), 3000)),
    ]);
    return Boolean(res);
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.warn('Firebase client is offline.');
    }
    handleFirestoreError(error, OperationType.GET, path);
    return false;
  }
}

// Directly fetch latest cloud state from Firestore with timeout protection
export async function loadStateFromFirestoreDirect(): Promise<PortalDatabasePayload | null> {
  if (isFirestoreQuotaExceeded) return null;
  const path = 'portal_state/main_state';
  try {
    const snap = await Promise.race([
      getDoc(doc(db, 'portal_state', 'main_state')),
      new Promise<null>((resolve) => setTimeout(() => resolve(null), 3500)),
    ]);
    if (!snap || !snap.exists()) return null;
    const data = snap.data();
    if (!data || !data.payloadJson) return null;
    return JSON.parse(data.payloadJson) as PortalDatabasePayload;
  } catch (err: any) {
    if (err?.code === 'resource-exhausted' || err?.message?.includes('Quota')) {
      isFirestoreQuotaExceeded = true;
    }
    handleFirestoreError(err, OperationType.GET, path);
    return null;
  }
}

// Directly persist state to Firestore with timeout protection
export async function saveStateToFirestoreDirect(
  payload: PortalDatabasePayload
): Promise<boolean> {
  if (payload.isDefaultSeed || isFirestoreQuotaExceeded) return false;
  const path = 'portal_state/main_state';
  try {
    const ref = doc(db, 'portal_state', 'main_state');
    await Promise.race([
      setDoc(ref, {
        revision: Number(payload.revision) || 1,
        updatedAt: payload.updatedAt || new Date().toISOString(),
        updatedBy: payload.updatedBy || 'Portal Online Gang Mandor',
        payloadJson: JSON.stringify(payload),
      }),
      new Promise<void>((_, reject) => setTimeout(() => reject(new Error('setDoc timeout')), 4000)),
    ]);
    return true;
  } catch (err: any) {
    if (err?.code === 'resource-exhausted' || err?.message?.includes('Quota')) {
      isFirestoreQuotaExceeded = true;
    }
    handleFirestoreError(err, OperationType.WRITE, path);
    return false;
  }
}

// Real-time live listener for Firestore with automatic unsubscribe on quota exhaustion
export function subscribeToFirestoreLive(
  onUpdate: (payload: PortalDatabasePayload) => void
): () => void {
  if (isFirestoreQuotaExceeded) {
    return () => {};
  }
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
          errMsg.includes('Quota') ||
          err?.code === 'permission-denied'
        ) {
          if (err?.code === 'resource-exhausted' || errMsg.includes('Quota')) {
            isFirestoreQuotaExceeded = true;
          }
          if (unsub) {
            try {
              unsub();
            } catch {}
            unsub = null;
          }
        }
        handleFirestoreError(err, OperationType.GET, path);
      }
    );
    return () => {
      if (unsub) {
        try {
          unsub();
        } catch {}
      }
    };
  } catch (err) {
    handleFirestoreError(err, OperationType.GET, path);
    return () => {};
  }
}
