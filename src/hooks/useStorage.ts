import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Announcement,
  BaksosAgenda,
  BaksosAttendanceStatus,
  CashTransaction,
  CommitteeContact,
  MenuItemConfig,
  PortalDatabasePayload,
  ResidentHouse,
  SiteConfig,
} from '../types';
import {
  INITIAL_ANNOUNCEMENTS,
  INITIAL_BAKSOS_AGENDAS,
  INITIAL_COMMITTEES,
  INITIAL_NAV_MENUS,
  INITIAL_RESIDENTS,
  INITIAL_SITE_CONFIG,
  INITIAL_TRANSACTIONS,
} from '../data/initialData';
import { getMonthKeyFromDate, parseIndonesianMonthYearToKey } from '../utils/helpers';
import { parseAndNormalizeBackupJson } from '../utils/backupRestoreHelper';
import {
  getIsFirestoreQuotaExceeded,
  loadStateFromFirestoreDirect,
  saveStateToFirestoreDirect,
  subscribeToFirestoreLive,
} from '../services/firebase';

const STORAGE_KEYS = {
  UNIFIED_SNAPSHOT: 'mandor_portal_db_snapshot_v6',
  CONFIG: 'mandor_site_config_v5',
  RESIDENTS: 'mandor_residents_v5',
  TRANSACTIONS: 'mandor_transactions_v5',
  BAKSOS: 'mandor_baksos_v5',
  COMMITTEES: 'mandor_committees_v5',
  ANNOUNCEMENTS: 'mandor_announcements_v5',
  ADMIN_PASS: 'mandor_admin_secret_key_v5',
  ADMIN_SESSION: 'mandor_admin_session_v5',
  ONLINE_AUTO_SYNC: 'mandor_online_autosync_v1',
};

const IDB_NAME = 'MandorPortalPersistentDB';
const IDB_STORE = 'snapshots';
const IDB_KEY = 'latest_portal_state';
const CROSS_DEVICE_SYNC_CHANNEL = 'mandor_cross_device_sync_channel_v6';

export interface BalanceBreakdown {
  kasUtama: number;
  wifiCashback: number;
  sampahCashback: number;
  total: number;
}

function replaceLingkunganWithGang<T>(obj: T): T {
  try {
    const raw = JSON.stringify(obj);
    const replaced = raw
      .replace(/Lingkungan Gang/g, 'Gang')
      .replace(/lingkungan Gang/g, 'Gang')
      .replace(/Lingkungan/g, 'Gang')
    return JSON.parse(replaced) as T;
  } catch {
    return obj;
  }
}

function sanitizeNavigationMenus(menus?: MenuItemConfig[]): MenuItemConfig[] {
  if (!Array.isArray(menus) || menus.length === 0) return INITIAL_NAV_MENUS;
  const seenIds = new Set<string>();
  const seenLabels = new Set<string>();
  const sanitized = menus.filter((m) => {
    if (!m || !m.id) return false;
    if (seenIds.has(m.id)) return false;
    const norm = (m.label || '').toLowerCase().trim();
    if (norm && seenLabels.has(norm)) return false;
    seenIds.add(m.id);
    if (norm) seenLabels.add(norm);
    return true;
  });

  // Pastikan menu data warga ada dan berada tepat di sebelah kanan menu pengumuman
  const wargaIdx = sanitized.findIndex((m) => m.id === 'warga');
  const wargaMenu =
    wargaIdx !== -1
      ? sanitized.splice(wargaIdx, 1)[0]
      : INITIAL_NAV_MENUS.find((m) => m.id === 'warga') || {
          id: 'warga',
          label: 'Data Warga',
          shortLabel: 'Warga',
          title: 'Direktori Data Warga Gang Mandor',
          description:
            'Daftar warga per kavling blok rumah beserta rincian anggota keluarga, status hunian, kepesertaan Rukem, dan status WiFi.',
          icon: 'FileSpreadsheet',
          colorScheme: 'amber',
          subMenus: [],
        };

  const pengumumanIdx = sanitized.findIndex((m) => m.id === 'pengumuman');
  if (pengumumanIdx !== -1) {
    sanitized.splice(pengumumanIdx + 1, 0, wargaMenu);
  } else {
    sanitized.unshift(wargaMenu);
  }

  // Pastikan menu penarikan selalu dikembalikan
  if (!sanitized.some((m) => m.id === 'penarikan')) {
    const penarikanMenu = INITIAL_NAV_MENUS.find((m) => m.id === 'penarikan') || {
      id: 'penarikan',
      label: 'Penarikan Keuangan',
      shortLabel: 'Penarikan',
      title: 'Data Penarikan Keuangan & Iuran Rutin Warga',
      description: 'Pencatatan penarikan iuran rutin warga, kelunasan per KK, dan pembukuan kas gang.',
      icon: 'Banknote',
      colorScheme: 'indigo',
      subMenus: [],
    };
    sanitized.push(penarikanMenu);
  }

  return sanitized.length > 0 ? sanitized : INITIAL_NAV_MENUS;
}

function isStateDifferentFromInitial(state: {
  siteConfig: SiteConfig;
  residents: ResidentHouse[];
  transactions: CashTransaction[];
  baksosAgendas: BaksosAgenda[];
  committees: CommitteeContact[];
  announcements: Announcement[];
}): boolean {
  try {
    const defaultComparable = JSON.stringify({
      siteConfig: replaceLingkunganWithGang(INITIAL_SITE_CONFIG),
      residents: replaceLingkunganWithGang(INITIAL_RESIDENTS),
      transactions: replaceLingkunganWithGang(INITIAL_TRANSACTIONS),
      baksosAgendas: replaceLingkunganWithGang(INITIAL_BAKSOS_AGENDAS),
      committees: replaceLingkunganWithGang(INITIAL_COMMITTEES),
      announcements: replaceLingkunganWithGang(INITIAL_ANNOUNCEMENTS),
    });
    const currentComparable = JSON.stringify({
      siteConfig: state.siteConfig,
      residents: state.residents,
      transactions: state.transactions,
      baksosAgendas: state.baksosAgendas,
      committees: state.committees,
      announcements: state.announcements,
    });
    return defaultComparable !== currentComparable;
  } catch {
    return false;
  }
}

function saveToIndexedDB(payload: PortalDatabasePayload): void {
  try {
    if (typeof window === 'undefined' || !('indexedDB' in window)) return;
    const req = window.indexedDB.open(IDB_NAME, 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(IDB_STORE)) {
        db.createObjectStore(IDB_STORE);
      }
    };
    req.onsuccess = () => {
      try {
        const db = req.result;
        const tx = db.transaction(IDB_STORE, 'readwrite');
        tx.objectStore(IDB_STORE).put(payload, IDB_KEY);
      } catch {}
    };
  } catch {}
}

function loadFromIndexedDB(): Promise<PortalDatabasePayload | null> {
  return new Promise((resolve) => {
    try {
      if (typeof window === 'undefined' || !('indexedDB' in window)) {
        resolve(null);
        return;
      }
      const req = window.indexedDB.open(IDB_NAME, 1);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(IDB_STORE)) {
          db.createObjectStore(IDB_STORE);
        }
      };
      req.onsuccess = () => {
        try {
          const db = req.result;
          const tx = db.transaction(IDB_STORE, 'readonly');
          const getReq = tx.objectStore(IDB_STORE).get(IDB_KEY);
          getReq.onsuccess = () => {
            resolve((getReq.result as PortalDatabasePayload) || null);
          };
          getReq.onerror = () => resolve(null);
        } catch {
          resolve(null);
        }
      };
      req.onerror = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
}

function persistSnapshotLocally(payload: PortalDatabasePayload): void {
  try {
    localStorage.setItem(STORAGE_KEYS.UNIFIED_SNAPSHOT, JSON.stringify(payload));
    localStorage.setItem(STORAGE_KEYS.CONFIG, JSON.stringify(payload.siteConfig));
    localStorage.setItem(STORAGE_KEYS.RESIDENTS, JSON.stringify(payload.residents));
    localStorage.setItem(STORAGE_KEYS.TRANSACTIONS, JSON.stringify(payload.transactions));
    localStorage.setItem(STORAGE_KEYS.BAKSOS, JSON.stringify(payload.baksosAgendas));
    localStorage.setItem(STORAGE_KEYS.COMMITTEES, JSON.stringify(payload.committees));
    localStorage.setItem(STORAGE_KEYS.ANNOUNCEMENTS, JSON.stringify(payload.announcements));
  } catch {}
  saveToIndexedDB(payload);
}

function ensureSeptemberDefaultTransactions(txs: CashTransaction[]): CashTransaction[] {
  if (!Array.isArray(txs)) return INITIAL_TRANSACTIONS;
  const sepTxs = txs.filter((t) => t.date && t.date.startsWith('2026-09'));
  const hasLegacySoleTx6 = sepTxs.length === 1 && sepTxs[0].id === 'tx-6';
  if (hasLegacySoleTx6) {
    const missingDefaults = INITIAL_TRANSACTIONS.filter(
      (initTx) => initTx.id.startsWith('tx-sep-') && !txs.some((t) => t.id === initTx.id)
    );
    return [...txs, ...missingDefaults];
  }
  return txs;
}

function loadInitialSnapshot(): PortalDatabasePayload {
  try {
    const rawUnified = localStorage.getItem(STORAGE_KEYS.UNIFIED_SNAPSHOT);
    if (rawUnified) {
      const parsed = replaceLingkunganWithGang(JSON.parse(rawUnified) as PortalDatabasePayload);
      if (parsed && parsed.siteConfig && Array.isArray(parsed.residents)) {
        const syncedTransactions = ensureSeptemberDefaultTransactions(
          Array.isArray(parsed.transactions) ? parsed.transactions : INITIAL_TRANSACTIONS
        );
        const validResidents =
          parsed.residents.length > 0 && parsed.residents[0].headName === 'Bambang Sutrisno'
            ? INITIAL_RESIDENTS
            : parsed.residents;
        const customized = isStateDifferentFromInitial({
          ...parsed,
          residents: validResidents,
          transactions: syncedTransactions,
        });
        const rev = Number(parsed.revision) || (customized ? 1 : 0);
        return {
          version: 5,
          revision: rev,
          isDefaultSeed: parsed.isDefaultSeed !== undefined ? parsed.isDefaultSeed : !customized && rev === 0,
          updatedAt: parsed.updatedAt || new Date().toISOString(),
          updatedBy: parsed.updatedBy || 'Cache Perangkat Lokal',
          siteConfig: {
            ...parsed.siteConfig,
            navigationMenus: sanitizeNavigationMenus(parsed.siteConfig.navigationMenus),
          },
          residents: validResidents,
          transactions: syncedTransactions,
          baksosAgendas: Array.isArray(parsed.baksosAgendas) ? parsed.baksosAgendas : INITIAL_BAKSOS_AGENDAS,
          committees: Array.isArray(parsed.committees) ? parsed.committees : INITIAL_COMMITTEES,
          announcements: Array.isArray(parsed.announcements) ? parsed.announcements : INITIAL_ANNOUNCEMENTS,
        };
      }
    }
  } catch {}

  // Fallback to legacy v5 keys if unified snapshot does not exist yet
  const readKey = <T,>(key: string, fallback: T): T => {
    try {
      const raw = localStorage.getItem(key);
      return raw ? replaceLingkunganWithGang(JSON.parse(raw)) : replaceLingkunganWithGang(fallback);
    } catch {
      return replaceLingkunganWithGang(fallback);
    }
  };

  const rawConfig = readKey(STORAGE_KEYS.CONFIG, INITIAL_SITE_CONFIG);
  const siteConfig: SiteConfig = {
    ...rawConfig,
    navigationMenus: sanitizeNavigationMenus(rawConfig.navigationMenus),
  };
  const rawResidents = readKey(STORAGE_KEYS.RESIDENTS, INITIAL_RESIDENTS);
  const residents =
    rawResidents.length > 0 && rawResidents[0].headName === 'Bambang Sutrisno'
      ? INITIAL_RESIDENTS
      : rawResidents;
  const transactions = ensureSeptemberDefaultTransactions(
    readKey(STORAGE_KEYS.TRANSACTIONS, INITIAL_TRANSACTIONS)
  );
  const baksosAgendas = readKey(STORAGE_KEYS.BAKSOS, INITIAL_BAKSOS_AGENDAS);
  const committees = readKey(STORAGE_KEYS.COMMITTEES, INITIAL_COMMITTEES);
  const announcements = readKey(STORAGE_KEYS.ANNOUNCEMENTS, INITIAL_ANNOUNCEMENTS);

  const customized = isStateDifferentFromInitial({
    siteConfig,
    residents,
    transactions,
    baksosAgendas,
    committees,
    announcements,
  });

  const snapshot: PortalDatabasePayload = {
    version: 5,
    revision: customized ? 1 : 0,
    isDefaultSeed: !customized,
    updatedAt: customized ? new Date().toISOString() : new Date(0).toISOString(),
    updatedBy: customized ? 'Data Tersimpan Perangkat' : 'Server Online Gang Mandor',
    siteConfig,
    residents,
    transactions,
    baksosAgendas,
    committees,
    announcements,
  };

  return snapshot;
}

export function useStorage() {
  const clientIdRef = useRef<string>(
    'client-' + Math.random().toString(36).slice(2, 10) + '-' + Date.now().toString(36)
  );

  const initialSnapshotRef = useRef<PortalDatabasePayload | null>(null);
  if (!initialSnapshotRef.current) {
    initialSnapshotRef.current = loadInitialSnapshot();
  }
  const initSnap = initialSnapshotRef.current;

  // Authoritative synchronous ref so back-to-back mutations NEVER read stale closures
  const dbStateRef = useRef<PortalDatabasePayload>(initSnap);

  const [siteConfig, setSiteConfig] = useState<SiteConfig>(initSnap.siteConfig);
  const [residents, setResidents] = useState<ResidentHouse[]>(initSnap.residents);
  const [transactions, setTransactions] = useState<CashTransaction[]>(initSnap.transactions);
  const [baksosAgendas, setBaksosAgendas] = useState<BaksosAgenda[]>(initSnap.baksosAgendas);
  const [committees, setCommittees] = useState<CommitteeContact[]>(initSnap.committees);
  const [announcements, setAnnouncements] = useState<Announcement[]>(initSnap.announcements);

  const [adminPassword, setAdminPassword] = useState<string>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEYS.ADMIN_PASS);
      return stored || 'mandor123';
    } catch {
      return 'mandor123';
    }
  });

  const [isAdmin, setIsAdmin] = useState<boolean>(() => {
    try {
      return sessionStorage.getItem(STORAGE_KEYS.ADMIN_SESSION) === 'true';
    } catch {
      return false;
    }
  });

  // Online Real-Time Synchronization states
  const [lastOnlineSync, setLastOnlineSync] = useState<string | null>(
    initSnap.isDefaultSeed ? null : initSnap.updatedAt
  );
  const [onlineRevision, setOnlineRevision] = useState<number>(initSnap.revision || 0);
  const [isOnlineSyncing, setIsOnlineSyncing] = useState<boolean>(false);
  const [isOnlineConnected, setIsOnlineConnected] = useState<boolean>(true);
  const [isAutoSyncEnabled, setIsAutoSyncEnabled] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.ONLINE_AUTO_SYNC);
      return saved === null ? true : saved === 'true';
    } catch {
      return true;
    }
  });

  // Guards to prevent incoming pulls from overwriting pending/in-flight local edits
  const hasPendingPushRef = useRef<boolean>(false);
  const isPushingMutationRef = useRef<boolean>(false);
  const pushTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastPushedRevRef = useRef<number>(-1);

  const toggleAutoSync = useCallback((enabled: boolean) => {
    setIsAutoSyncEnabled(enabled);
    try {
      localStorage.setItem(STORAGE_KEYS.ONLINE_AUTO_SYNC, String(enabled));
    } catch {}
  }, []);

  // Synchronize React states + localStorage + IndexedDB with a verified payload
  const applySnapshotToStateAndStorage = useCallback((rawPayload: PortalDatabasePayload) => {
    const clean = replaceLingkunganWithGang(rawPayload);
    const rev = Number(clean.revision) || 0;
    const isSeed =
      clean.isDefaultSeed === true ||
      (rev <= 1 && clean.updatedBy === 'Server Online Gang Mandor' && !isStateDifferentFromInitial(clean));

    const normalized: PortalDatabasePayload = {
      version: 5,
      revision: isSeed ? 0 : Math.max(1, rev),
      isDefaultSeed: isSeed,
      updatedAt: clean.updatedAt || new Date().toISOString(),
      updatedBy: clean.updatedBy || 'Portal Online Gang Mandor',
      clientId: clean.clientId,
      siteConfig: {
        ...(clean.siteConfig || dbStateRef.current.siteConfig),
        navigationMenus: sanitizeNavigationMenus(
          clean.siteConfig?.navigationMenus || dbStateRef.current.siteConfig?.navigationMenus
        ),
      },
      residents: Array.isArray(clean.residents) ? clean.residents : dbStateRef.current.residents,
      transactions: ensureSeptemberDefaultTransactions(
        Array.isArray(clean.transactions)
          ? clean.transactions
          : dbStateRef.current.transactions
      ),
      baksosAgendas: Array.isArray(clean.baksosAgendas)
        ? clean.baksosAgendas
        : dbStateRef.current.baksosAgendas,
      committees: Array.isArray(clean.committees)
        ? clean.committees
        : dbStateRef.current.committees,
      announcements: Array.isArray(clean.announcements)
        ? clean.announcements
        : dbStateRef.current.announcements,
    };

    dbStateRef.current = normalized;
    setSiteConfig(normalized.siteConfig);
    setResidents(normalized.residents);
    setTransactions(normalized.transactions);
    setBaksosAgendas(normalized.baksosAgendas);
    setCommittees(normalized.committees);
    setAnnouncements(normalized.announcements);
    setOnlineRevision(normalized.revision || 0);
    setLastOnlineSync(normalized.updatedAt);
    setIsOnlineConnected(true);

    persistSnapshotLocally(normalized);
  }, []);

  // Push authoritative snapshot to online server with automatic retries and Firestore synchronization
  const pushSnapshotToServer = useCallback(
    async (customSnapshot?: PortalDatabasePayload): Promise<boolean> => {
      const snapshotToPush = customSnapshot || dbStateRef.current;
      isPushingMutationRef.current = true;
      setIsOnlineSyncing(true);

      const payloadToSend: PortalDatabasePayload = {
        ...snapshotToPush,
        version: 5,
        revision: Math.max(1, Number(snapshotToPush.revision) || 1),
        isDefaultSeed: false,
        updatedAt: snapshotToPush.updatedAt || new Date().toISOString(),
        updatedBy: isAdmin ? 'Pengurus Gang Mandor (Online)' : 'Warga Gang Mandor (Online)',
        clientId: clientIdRef.current,
      };

      lastPushedRevRef.current = Number(payloadToSend.revision) || 0;

      // Always asynchronously backup directly to Cloud Firestore as dual redundancy
      if (!getIsFirestoreQuotaExceeded()) {
        saveStateToFirestoreDirect(payloadToSend).catch(() => {});
      }

      // Retry up to 3 times with exponential backoff before declaring offline
      let lastError: any = null;
      for (let attempt = 1; attempt <= 3; attempt++) {
        try {
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 10000);
          const res = await fetch('/api/database', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payloadToSend),
            signal: controller.signal,
          });
          clearTimeout(timeoutId);

          if (res.ok) {
            const result = await res.json();
            const confirmedRev = Number(result.revision) || payloadToSend.revision || 1;
            const confirmedTime = result.updatedAt || payloadToSend.updatedAt;

            // Update revision metadata if no newer local mutation happened while POST was in flight
            if ((dbStateRef.current.revision || 0) <= confirmedRev) {
              const updatedSnap: PortalDatabasePayload = {
                ...dbStateRef.current,
                revision: confirmedRev,
                isDefaultSeed: false,
                updatedAt: confirmedTime,
              };
              dbStateRef.current = updatedSnap;
              persistSnapshotLocally(updatedSnap);
              hasPendingPushRef.current = false;
            }

            setOnlineRevision(confirmedRev);
            setLastOnlineSync(confirmedTime);
            setIsOnlineConnected(true);
            isPushingMutationRef.current = false;
            setIsOnlineSyncing(false);

            // If a newer local mutation occurred while this push was in flight, immediately push it
            if (hasPendingPushRef.current) {
              setTimeout(() => {
                pushSnapshotToServer(dbStateRef.current);
              }, 40);
            }
            return true;
          }
        } catch (err) {
          lastError = err;
        }

        if (attempt < 3) {
          await new Promise((resolve) => setTimeout(resolve, 150 * attempt));
        }
      }

      console.warn('Failed to push state to online server after 3 attempts:', lastError);
      // Attempt emergency direct save to Cloud Firestore if server is unreachable
      try {
        const firestoreSuccess = await saveStateToFirestoreDirect(payloadToSend);
        if (firestoreSuccess) {
          hasPendingPushRef.current = false;
          setIsOnlineConnected(true);
          isPushingMutationRef.current = false;
          setIsOnlineSyncing(false);
          return true;
        }
      } catch {}

      setIsOnlineConnected(false);
      isPushingMutationRef.current = false;
      setIsOnlineSyncing(false);
      return false;
    },
    [isAdmin]
  );

  // Synchronous mutation helper: updates dbStateRef + localStorage in 0ms and schedules immediate server push
  const commitLocalMutation = useCallback(
    (
      mutator: (current: PortalDatabasePayload) => Partial<PortalDatabasePayload>,
      forceResetFlag: boolean = false
    ) => {
      const current = dbStateRef.current;
      const changes = mutator(current);
      const nextRev = (Number(current.revision) || 0) + 1;
      const nowIso = new Date().toISOString();

      const nextSnapshot: PortalDatabasePayload = replaceLingkunganWithGang({
        ...current,
        ...changes,
        version: 5,
        revision: nextRev,
        isDefaultSeed: false,
        forceReset: forceResetFlag ? true : undefined,
        updatedAt: nowIso,
        updatedBy: isAdmin ? 'Pengurus Gang Mandor (Online)' : 'Warga Gang Mandor (Online)',
        clientId: clientIdRef.current,
      });

      // 1. Block any incoming stale fetch from overwriting our new mutation
      hasPendingPushRef.current = true;
      dbStateRef.current = nextSnapshot;

      // 2. Persist synchronously to localStorage & IndexedDB (0ms delay)
      persistSnapshotLocally(nextSnapshot);

      // 3. Update React UI state
      setSiteConfig(nextSnapshot.siteConfig);
      setResidents(nextSnapshot.residents);
      setTransactions(nextSnapshot.transactions);
      setBaksosAgendas(nextSnapshot.baksosAgendas);
      setCommittees(nextSnapshot.committees);
      setAnnouncements(nextSnapshot.announcements);
      setOnlineRevision(nextRev);
      setLastOnlineSync(nowIso);

      // 3. Broadcast to all open tabs/windows on the same browser in 0ms via BroadcastChannel
      try {
        if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
          const bc = new BroadcastChannel(CROSS_DEVICE_SYNC_CHANNEL);
          bc.postMessage({
            type: 'MUTATION_SAVED',
            payload: nextSnapshot,
            clientId: clientIdRef.current,
          });
          bc.close();
        }
      } catch {}

      // 4. Fast debounce (40ms) to automatically push changes to server & cloud database
      if (pushTimerRef.current) {
        clearTimeout(pushTimerRef.current);
      }
      pushTimerRef.current = setTimeout(() => {
        pushTimerRef.current = null;
        pushSnapshotToServer(dbStateRef.current);
      }, 40);
    },
    [isAdmin, pushSnapshotToServer]
  );

  // Pull latest database from server with automatic retries and direct Firestore fallback
  const fetchLatestFromServer = useCallback(
    async (manualForcePull: boolean = false): Promise<boolean> => {
      if ((hasPendingPushRef.current || isPushingMutationRef.current) && !manualForcePull) {
        if (hasPendingPushRef.current && !isPushingMutationRef.current) {
          await pushSnapshotToServer(dbStateRef.current);
        }
        return true;
      }

      setIsOnlineSyncing(true);

      // Try fetching from server with up to 3 retries
      let fetchedPayload: PortalDatabasePayload | null = null;
      for (let attempt = 1; attempt <= 3; attempt++) {
        try {
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 8000);
          const res = await fetch(`/api/database?t=${Date.now()}`, {
            cache: 'no-store',
            signal: controller.signal,
          });
          clearTimeout(timeoutId);
          if (res.ok) {
            const json = await res.json();
            if (json.exists && json.data) {
              fetchedPayload = json.data as PortalDatabasePayload;
              setIsOnlineConnected(true);
              break;
            }
          }
        } catch {}

        if (attempt < 3) {
          await new Promise((resolve) => setTimeout(resolve, 150 * attempt));
        }
      }

      // If server could not be reached, try reading directly from Cloud Firestore as dual fallback
      if (!fetchedPayload) {
        try {
          const cloudDirectSnap = await loadStateFromFirestoreDirect();
          if (cloudDirectSnap && !cloudDirectSnap.isDefaultSeed) {
            fetchedPayload = cloudDirectSnap;
            setIsOnlineConnected(true);
          }
        } catch {}
      }

      if (fetchedPayload) {
        // Do not overwrite if a local mutation occurred while the request was in flight
        if (hasPendingPushRef.current && !manualForcePull) {
          setIsOnlineSyncing(false);
          return true;
        }

        const remoteData = fetchedPayload;
        const remoteRev = Number(remoteData.revision) || 0;
        const remoteIsSeed =
          remoteData.isDefaultSeed === true ||
          remoteRev === 0 ||
          (remoteRev === 1 &&
            remoteData.updatedBy === 'Server Online Gang Mandor' &&
            !isStateDifferentFromInitial(remoteData));

        const localSnap = dbStateRef.current;
        const localRev = Number(localSnap.revision) || 0;
        const localIsCustomized = !localSnap.isDefaultSeed && localRev >= 1;

        // SELF-HEALING CASE 1: Server has reset to default seed, but client has real customized data!
        // Never overwrite client with default seed -> push client's real data to heal the server!
        if (remoteIsSeed && localIsCustomized) {
          await pushSnapshotToServer(localSnap);
          setIsOnlineSyncing(false);
          return true;
        }

        // SELF-HEALING CASE 2: Both are customized, but client has a strictly higher revision (e.g., offline edits)
        if (!remoteIsSeed && localIsCustomized && localRev > remoteRev && !manualForcePull) {
          await pushSnapshotToServer(localSnap);
          setIsOnlineSyncing(false);
          return true;
        }

        // NORMAL UPDATE CASE: Server has newer revision, or local is still default seed, or user requested manual pull
        const remoteTime = Date.parse(remoteData.updatedAt || '') || 0;
        const localTime = Date.parse(localSnap.updatedAt || '') || 0;

        if (
          manualForcePull ||
          (!remoteIsSeed && localSnap.isDefaultSeed) ||
          remoteRev > localRev ||
          (remoteRev === localRev && remoteTime > localTime)
        ) {
          applySnapshotToStateAndStorage(remoteData);
        }
        setIsOnlineSyncing(false);
        return true;
      }

      setIsOnlineConnected(false);
      setIsOnlineSyncing(false);
      return false;
    },
    [applySnapshotToStateAndStorage, pushSnapshotToServer]
  );

  // Manual sync function (pulls latest from server or pushes if requested)
  const syncOnlineNow = useCallback(
    async (mode: 'pull' | 'push' = 'pull'): Promise<boolean> => {
      if (mode === 'push') {
        return await pushSnapshotToServer(dbStateRef.current);
      }
      return await fetchLatestFromServer(true);
    },
    [fetchLatestFromServer, pushSnapshotToServer]
  );

  // Recover from IndexedDB if IndexedDB holds a newer revision than localStorage, then sync with server
  useEffect(() => {
    let isMounted = true;
    let eventSource: EventSource | null = null;
    let unsubFirestore: (() => void) | null = null;

    const bootSync = async () => {
      try {
        const idbSnap = await loadFromIndexedDB();
        if (isMounted && idbSnap && !hasPendingPushRef.current) {
          const idbRev = Number(idbSnap.revision) || 0;
          const curRev = Number(dbStateRef.current.revision) || 0;
          if (!idbSnap.isDefaultSeed && (dbStateRef.current.isDefaultSeed || idbRev > curRev)) {
            applySnapshotToStateAndStorage(idbSnap);
          }
        }
      } catch {}

      // Pull latest state directly from Cloud Firestore
      try {
        const cloudSnap = await loadStateFromFirestoreDirect();
        if (isMounted && cloudSnap && !hasPendingPushRef.current) {
          const cloudRev = Number(cloudSnap.revision) || 0;
          const curRev = Number(dbStateRef.current.revision) || 0;
          if (!cloudSnap.isDefaultSeed && (dbStateRef.current.isDefaultSeed || cloudRev >= curRev)) {
            applySnapshotToStateAndStorage(cloudSnap);
          }
        }
      } catch {}

      if (isMounted) {
        // Automatically pull latest input data from the database server on startup
        await fetchLatestFromServer(true);
      }
    };

    bootSync();

    // Subscribe to real-time Firestore database changes across all devices
    try {
      unsubFirestore = subscribeToFirestoreLive((incoming) => {
        if (!isMounted || !isAutoSyncEnabled) return;
        if (hasPendingPushRef.current || isPushingMutationRef.current) return;
        const incomingRev = Number(incoming.revision) || 0;
        const curRev = Number(dbStateRef.current.revision) || 0;
        if (incomingRev > curRev || (dbStateRef.current.isDefaultSeed && !incoming.isDefaultSeed)) {
          applySnapshotToStateAndStorage(incoming);
        }
      });
    } catch {}

    // Listen to local BroadcastChannel for 0ms cross-tab synchronization
    let localBroadcastChannel: BroadcastChannel | null = null;
    try {
      if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
        localBroadcastChannel = new BroadcastChannel(CROSS_DEVICE_SYNC_CHANNEL);
        localBroadcastChannel.onmessage = (event) => {
          if (!isMounted || !isAutoSyncEnabled) return;
          if (event.data?.type === 'MUTATION_SAVED' && event.data?.payload) {
            if (event.data.clientId === clientIdRef.current) return;
            const incoming = event.data.payload as PortalDatabasePayload;
            const inRev = Number(incoming.revision) || 0;
            const curRev = Number(dbStateRef.current.revision) || 0;
            if (inRev > curRev || (dbStateRef.current.isDefaultSeed && !incoming.isDefaultSeed)) {
              applySnapshotToStateAndStorage(incoming);
            }
          }
        };
      }
    } catch {}

    // Connect to SSE stream for real-time instant synchronization across all open devices
    let sseReconnectTimer: ReturnType<typeof setTimeout> | null = null;
    const connectSSE = () => {
      if (!isMounted) return;
      try {
        if (eventSource) {
          eventSource.close();
          eventSource = null;
        }
        eventSource = new EventSource('/api/database/stream');

        eventSource.onopen = () => {
          if (isMounted) setIsOnlineConnected(true);
        };

        eventSource.onmessage = (event) => {
          if (!isMounted || !isAutoSyncEnabled) return;
          if (hasPendingPushRef.current || isPushingMutationRef.current) return;
          try {
            const incoming = JSON.parse(event.data) as PortalDatabasePayload;
            if (!incoming || !incoming.siteConfig) return;
            // Ignore echo from our own client
            if (incoming.clientId && incoming.clientId === clientIdRef.current) {
              return;
            }
            const incomingRev = Number(incoming.revision) || 0;
            const incomingIsSeed =
              incoming.isDefaultSeed === true ||
              incomingRev === 0 ||
              (incomingRev === 1 && incoming.updatedBy === 'Server Online Gang Mandor');

            if (incomingIsSeed && !dbStateRef.current.isDefaultSeed) {
              return;
            }

            if (
              incomingRev > (dbStateRef.current.revision || 0) ||
              (dbStateRef.current.isDefaultSeed && !incomingIsSeed)
            ) {
              applySnapshotToStateAndStorage(incoming);
            }
          } catch {}
        };

        eventSource.onerror = () => {
          if (eventSource) {
            eventSource.close();
            eventSource = null;
          }
          if (isMounted) {
            if (sseReconnectTimer) clearTimeout(sseReconnectTimer);
            sseReconnectTimer = setTimeout(() => {
              if (isMounted && (!eventSource || eventSource.readyState === EventSource.CLOSED)) {
                connectSSE();
              }
            }, 1200);
          }
        };
      } catch {}
    };

    connectSSE();

    // Background metadata check every 15 seconds to guarantee sync & flush any pending changes across devices
    const intervalId = setInterval(async () => {
      if (!isMounted || !isAutoSyncEnabled || isPushingMutationRef.current) return;

      if (hasPendingPushRef.current) {
        await pushSnapshotToServer(dbStateRef.current);
        return;
      }

      try {
        const res = await fetch(`/api/database/meta?t=${Date.now()}`, { cache: 'no-store' });
        if (!res.ok) return;
        const meta = await res.json();
        setIsOnlineConnected(true);
        if (meta.exists) {
          const remoteRev = Number(meta.revision) || 0;
          const remoteIsSeed = Boolean(meta.isDefaultSeed) || remoteRev === 0;
          const localSnap = dbStateRef.current;
          const localRev = Number(localSnap.revision) || 0;

          if (remoteIsSeed && !localSnap.isDefaultSeed && localRev >= 1) {
            // Guard against infinite push loops
            if (lastPushedRevRef.current !== localRev) {
              await pushSnapshotToServer(localSnap);
            }
          } else if (
            !remoteIsSeed &&
            (localSnap.isDefaultSeed ||
              remoteRev > localRev ||
              (remoteRev === localRev &&
                meta.updatedAt &&
                meta.updatedAt !== localSnap.updatedAt))
          ) {
            await fetchLatestFromServer(false);
          }
        }
      } catch {}

      if (!eventSource || eventSource.readyState === EventSource.CLOSED) {
        connectSSE();
      }
    }, 15000);

    const handleVisibilityOrFocus = () => {
      if (document.visibilityState === 'visible' && isAutoSyncEnabled) {
        if (hasPendingPushRef.current) {
          pushSnapshotToServer(dbStateRef.current);
        } else {
          fetchLatestFromServer(false);
        }
      }
    };

    const handleOnline = () => {
      setIsOnlineConnected(true);
      if (hasPendingPushRef.current) {
        pushSnapshotToServer(dbStateRef.current);
      } else if (isAutoSyncEnabled) {
        fetchLatestFromServer(false);
      }
    };

    const handleBeforeUnload = () => {
      if (hasPendingPushRef.current) {
        persistSnapshotLocally(dbStateRef.current);
      }
    };

    window.addEventListener('focus', handleVisibilityOrFocus);
    document.addEventListener('visibilitychange', handleVisibilityOrFocus);
    window.addEventListener('online', handleOnline);
    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      isMounted = false;
      if (unsubFirestore) {
        try {
          unsubFirestore();
        } catch {}
      }
      if (eventSource) eventSource.close();
      if (sseReconnectTimer) clearTimeout(sseReconnectTimer);
      if (localBroadcastChannel) {
        try {
          localBroadcastChannel.close();
        } catch {}
      }
      if (pushTimerRef.current) clearTimeout(pushTimerRef.current);
      clearInterval(intervalId);
      window.removeEventListener('focus', handleVisibilityOrFocus);
      document.removeEventListener('visibilitychange', handleVisibilityOrFocus);
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [
    isAutoSyncEnabled,
    fetchLatestFromServer,
    applySnapshotToStateAndStorage,
    pushSnapshotToServer,
  ]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEYS.ADMIN_PASS, adminPassword);
    } catch {}
  }, [adminPassword]);

  // Compute calculated balances from transaction history
  const calculatedBalances: BalanceBreakdown = transactions.reduce(
    (acc, tx) => {
      const val = tx.type === 'masuk' ? tx.amount : -tx.amount;
      const cat = tx.category || '';
      const isWifi =
        cat === 'Cashback WiFi' ||
        cat === 'Pengeluaran Cashback WiFi' ||
        (tx.pool === 'Cashback WiFi' &&
          cat !== 'Pengeluaran Gang' &&
          cat !== 'Pengeluaran Lingkungan' &&
          cat !== 'Kas Utama');

      const isSampah =
        cat === 'Cashback Sampah' ||
        cat === 'Pengeluaran Cashback Sampah' ||
        (tx.pool === 'Cashback Sampah' &&
          cat !== 'Pengeluaran Gang' &&
          cat !== 'Pengeluaran Lingkungan' &&
          cat !== 'Kas Utama');

      if (isWifi) {
        acc.wifiCashback += val;
      } else if (isSampah) {
        acc.sampahCashback += val;
      } else {
        acc.kasUtama += val;
      }
      acc.total += val;
      return acc;
    },
    { kasUtama: 0, wifiCashback: 0, sampahCashback: 0, total: 0 }
  );

  // Admin authentication handlers
  const loginAdmin = (passwordAttempt: string): boolean => {
    if (passwordAttempt === adminPassword) {
      setIsAdmin(true);
      try {
        sessionStorage.setItem(STORAGE_KEYS.ADMIN_SESSION, 'true');
      } catch {}
      return true;
    }
    return false;
  };

  const logoutAdmin = (clearHistory: boolean = true) => {
    setIsAdmin(false);
    try {
      sessionStorage.removeItem(STORAGE_KEYS.ADMIN_SESSION);
      if (clearHistory) {
        sessionStorage.clear();
      }
    } catch {}
  };

  const changeAdminPassword = (newPass: string) => {
    setAdminPassword(newPass);
  };

  // CRUD for Site Config
  const updateSiteConfig = (newConfig: Partial<SiteConfig>) => {
    commitLocalMutation((cur) => ({
      siteConfig: { ...cur.siteConfig, ...newConfig },
    }));
  };

  // Pengurus bisa membuat periode baru (iuran kas per kk & buku kas)
  const createPeriod = (
    newPeriodLabel: string,
    options?: {
      setActiveCurrentMonth?: boolean;
      resetNonAdvanceDues?: boolean;
    }
  ) => {
    const trimmed = newPeriodLabel.trim();
    if (!trimmed) return;
    commitLocalMutation((cur) => {
      const existing = cur.siteConfig.duesAvailablePeriods || [
        cur.siteConfig.duesCurrentMonth || 'Oktober 2026',
      ];
      const updatedPeriods = Array.from(new Set([trimmed, ...existing]));
      const updatedConfig = {
        ...cur.siteConfig,
        duesAvailablePeriods: updatedPeriods,
        ...(options?.setActiveCurrentMonth ? { duesCurrentMonth: trimmed } : {}),
      };

      let updatedResidents = cur.residents;
      if (options?.resetNonAdvanceDues) {
        updatedResidents = cur.residents.map((r) => {
          if (r.occupancy === 'Kosong') return r;
          const paidMonths = r.duesPaidMonths || 0;
          if (r.duesStatus === 'Bayar Lebih' && paidMonths > 1) {
            const nextPaidMonths = paidMonths - 1;
            const nom = r.customDuesAmount ?? cur.siteConfig.duesAmountPerMonth ?? 50000;
            const newPrepaid = Math.max(0, (r.duesPrepaidBalance || 0) - nom);
            return {
              ...r,
              duesStatus: nextPaidMonths > 1 ? 'Bayar Lebih' : 'Lunas',
              duesPaidMonths: nextPaidMonths,
              duesPrepaidBalance: newPrepaid,
              duesMonthNote: trimmed,
            };
          }
          return {
            ...r,
            duesStatus: 'Belum Bayar' as const,
            duesPaidAmount: 0,
            duesPaidMonths: 0,
            duesPrepaidBalance: 0,
            duesPaidDate: '',
            duesMonthNote: trimmed,
          };
        });
      }

      return {
        siteConfig: updatedConfig,
        residents: updatedResidents,
      };
    });
  };

  // Pengurus bisa menghapus periode (iuran kas per kk & buku kas)
  const deletePeriod = (periodLabel: string) => {
    const trimmed = periodLabel.trim();
    if (!trimmed) return;
    const targetMonthKey = parseIndonesianMonthYearToKey(trimmed);

    commitLocalMutation((cur) => {
      const existing = cur.siteConfig.duesAvailablePeriods || [
        cur.siteConfig.duesCurrentMonth || 'Oktober 2026',
      ];
      const filtered = existing.filter((p) => p !== trimmed);
      const fallback = filtered[0] || 'Oktober 2026';

      const updatedConfig = {
        ...cur.siteConfig,
        duesAvailablePeriods: filtered.length > 0 ? filtered : [fallback],
        duesCurrentMonth:
          cur.siteConfig.duesCurrentMonth === trimmed ? fallback : cur.siteConfig.duesCurrentMonth,
      };

      let updatedTransactions = cur.transactions;
      if (targetMonthKey) {
        updatedTransactions = cur.transactions.filter(
          (t) => getMonthKeyFromDate(t.date) !== targetMonthKey
        );
      }

      return {
        siteConfig: updatedConfig,
        transactions: updatedTransactions,
      };
    });
  };

  // Helper to compute updated Baksos agendas when resident house status changes
  const computeSyncedBaksosAgendas = (
    agendas: BaksosAgenda[],
    house: ResidentHouse
  ): BaksosAgenda[] => {
    const isContract = house.ownership === 'Kontrak' || house.occupancy === 'Dikontrakan';
    const isEmpty = house.occupancy === 'Kosong';
    if (!isContract && !isEmpty) return agendas;

    const targetStatus: BaksosAttendanceStatus = isEmpty ? 'Kosong' : 'Tidak Wajib';
    return agendas.map((agenda) => ({
      ...agenda,
      attendance: {
        ...agenda.attendance,
        [house.id]: targetStatus,
      },
    }));
  };

  const addResident = (newHouse: ResidentHouse) => {
    commitLocalMutation((cur) => ({
      residents: [newHouse, ...cur.residents],
      baksosAgendas: computeSyncedBaksosAgendas(cur.baksosAgendas, newHouse),
    }));
  };

  const updateResident = (updated: ResidentHouse) => {
    const stamped = { ...updated, updatedAt: new Date().toISOString() };
    commitLocalMutation((cur) => ({
      residents: cur.residents.map((h) => (h.id === stamped.id ? stamped : h)),
      baksosAgendas: computeSyncedBaksosAgendas(cur.baksosAgendas, stamped),
    }));
  };

  const deleteResident = (houseId: string) => {
    commitLocalMutation((cur) => ({
      residents: cur.residents.filter((h) => h.id !== houseId),
    }));
  };

  const importResidents = (newHouses: ResidentHouse[], mode: 'replace' | 'merge') => {
    commitLocalMutation((cur) => {
      if (mode === 'replace') {
        return { residents: newHouses };
      }
      const map = new Map<string, ResidentHouse>();
      cur.residents.forEach((h) => map.set(h.blockNumber.toUpperCase(), h));
      newHouses.forEach((h) => {
        map.set(h.blockNumber.toUpperCase(), {
          ...h,
          updatedAt: new Date().toISOString(),
        });
      });
      return { residents: Array.from(map.values()) };
    });
  };

  // Batch Import Dues from Excel (Atomic mutation for residents, transactions, and periods)
  const batchImportDues = (
    updatedResidentList: ResidentHouse[],
    newTransactions: Omit<CashTransaction, 'id'>[],
    periodLabel?: string,
    setPeriodActive?: boolean
  ) => {
    commitLocalMutation((cur) => {
      // 1. Merge updated residents
      const residentMap = new Map(cur.residents.map((r) => [r.id, r]));
      updatedResidentList.forEach((r) => {
        const existing = residentMap.get(r.id);
        residentMap.set(r.id, {
          ...(existing || {}),
          ...r,
          updatedAt: new Date().toISOString(),
        });
      });

      // 2. Add transactions with unique IDs
      const preparedTxs: CashTransaction[] = newTransactions.map((tx, idx) => ({
        ...tx,
        id: `tx-dues-imp-${Date.now()}-${idx}-${Math.random().toString(36).slice(2, 6)}`,
      }));

      // 3. Update available periods if specified
      let updatedConfig = cur.siteConfig;
      if (periodLabel && periodLabel.trim()) {
        const trimmed = periodLabel.trim();
        const existing = cur.siteConfig.duesAvailablePeriods || [
          cur.siteConfig.duesCurrentMonth || 'Oktober 2026',
        ];
        const updatedPeriods = Array.from(new Set([trimmed, ...existing]));
        updatedConfig = {
          ...cur.siteConfig,
          duesAvailablePeriods: updatedPeriods,
          ...(setPeriodActive ? { duesCurrentMonth: trimmed } : {}),
        };
      }

      return {
        residents: Array.from(residentMap.values()),
        transactions: [...preparedTxs, ...cur.transactions],
        siteConfig: updatedConfig,
      };
    });
  };

  // Simpan Penarikan & Rollover ke Bulan Berikutnya secara atomik
  const rolloverBillingMonth = (
    savedPeriod: string,
    nextPeriod: string,
    updatedResidentList: ResidentHouse[],
    newTransactions: Omit<CashTransaction, 'id'>[] = []
  ) => {
    commitLocalMutation((cur) => {
      const preparedTxs: CashTransaction[] = newTransactions.map((tx, idx) => ({
        ...tx,
        id: `tx-roll-${Date.now()}-${idx}-${Math.random().toString(36).slice(2, 6)}`,
      }));

      const existingPeriods = cur.siteConfig.duesAvailablePeriods || ['September 2026'];
      // Periode yang baru saja disimpan sekarang resmi menjadi periode historis yang selesai
      const updatedPeriods = Array.from(new Set([...existingPeriods, savedPeriod]));

      const updatedConfig = {
        ...cur.siteConfig,
        duesCurrentMonth: nextPeriod,
        duesAvailablePeriods: updatedPeriods,
      };

      return {
        residents: updatedResidentList,
        transactions: preparedTxs.length > 0 ? [...preparedTxs, ...cur.transactions] : cur.transactions,
        siteConfig: updatedConfig,
      };
    });
  };

  // CRUD for Cash Transactions
  const addTransaction = (tx: Omit<CashTransaction, 'id'>) => {
    const newTx: CashTransaction = {
      ...tx,
      id: 'tx-' + Date.now() + '-' + Math.random().toString(36).slice(2, 6),
    };
    commitLocalMutation((cur) => ({
      transactions: [newTx, ...cur.transactions],
    }));
  };

  const updateTransaction = (updated: CashTransaction) => {
    commitLocalMutation((cur) => ({
      transactions: cur.transactions.map((t) => (t.id === updated.id ? updated : t)),
    }));
  };

  const deleteTransaction = (id: string) => {
    commitLocalMutation((cur) => ({
      transactions: cur.transactions.filter((t) => t.id !== id),
    }));
  };

  const deleteTransactions = (ids: string[]) => {
    if (!ids || ids.length === 0) return;
    const idSet = new Set(ids);
    commitLocalMutation((cur) => ({
      transactions: cur.transactions.filter((t) => !idSet.has(t.id)),
    }));
  };

  // Sync edits on a house's dues payment with transactions in Buku Kas Keluar Masuk atomically
  const syncHouseDuesEditAndTransactions = (
    updatedHouse: ResidentHouse,
    newTransactions: Omit<CashTransaction, 'id'>[],
    oldTxIdsToDelete: string[] = []
  ) => {
    commitLocalMutation((cur) => {
      const stamped: ResidentHouse = { ...updatedHouse, updatedAt: new Date().toISOString() };
      const deleteSet = new Set(oldTxIdsToDelete);
      const filteredTxs = cur.transactions.filter((t) => !deleteSet.has(t.id));
      const preparedNewTxs: CashTransaction[] = newTransactions.map((tx, idx) => ({
        ...tx,
        id: `tx-dues-sync-${Date.now()}-${idx}-${Math.random().toString(36).slice(2, 6)}`,
      }));

      return {
        residents: cur.residents.map((h) => (h.id === stamped.id ? stamped : h)),
        transactions: [...preparedNewTxs, ...filteredTxs],
        baksosAgendas: computeSyncedBaksosAgendas(cur.baksosAgendas, stamped),
      };
    });
  };

  // Hapus & batalkan semua pembayaran untuk 1 KK pada periode tertentu (otomatis bersihkan transaksi di Buku Kas)
  const resetSingleHousePaymentAndSync = (
    houseId: string,
    periodLabel: string,
    unmarkBaksosFines: boolean = true
  ) => {
    const trimmedPeriod = periodLabel.trim();
    const periodKey = parseIndonesianMonthYearToKey(trimmedPeriod);
    const periodLower = trimmedPeriod.toLowerCase();

    commitLocalMutation((cur) => {
      const targetHouse = cur.residents.find((h) => h.id === houseId);
      if (!targetHouse) return {};

      const blockRegex = new RegExp(`\\b${targetHouse.blockNumber.replace('/', '\\/')}\\b`, 'i');

      // 1. Reset status pembayaran KK
      const updatedResidents = cur.residents.map((h) => {
        if (h.id !== houseId) return h;
        return {
          ...h,
          duesStatus: 'Belum Bayar' as const,
          duesPaidAmount: 0,
          duesPaidMonths: 0,
          duesPrepaidBalance: 0,
          duesPaidDate: '',
          updatedAt: new Date().toISOString(),
        };
      });

      // 2. Hapus transaksi terkait di Buku Kas (Iuran Warga, Denda Baksos, Pembayaran Tunggakan periode ini)
      const updatedTransactions = cur.transactions.filter((tx) => {
        if (tx.type !== 'masuk') return true;
        if (!blockRegex.test(tx.description)) return true;

        const mKey = getMonthKeyFromDate(tx.date);
        const descLower = tx.description.toLowerCase();
        const isIuran = tx.category === 'Iuran Warga' || descLower.includes('iuran');
        const isDenda = tx.category === 'Denda Baksos' || descLower.includes('denda');
        const isTunggakan = tx.category === 'Pembayaran Tunggakan' || descLower.includes('tunggakan');

        if (!isIuran && !isDenda && !isTunggakan) return true;

        const matchesPeriod =
          trimmedPeriod === 'semua' ||
          descLower.includes(periodLower) ||
          (periodKey && mKey === periodKey);

        return !matchesPeriod;
      });

      // 3. Batalkan status denda baksos lunas jika ada di periode ini
      let updatedBaksos = cur.baksosAgendas;
      if (unmarkBaksosFines) {
        updatedBaksos = cur.baksosAgendas.map((agenda) => {
          const agendaKey = getMonthKeyFromDate(agenda.date);
          const matchesAgendaPeriod =
            trimmedPeriod === 'semua' || (periodKey && agendaKey === periodKey);
          if (!matchesAgendaPeriod) return agenda;

          if (agenda.finesPaid?.[houseId]) {
            const newFinesPaid = { ...agenda.finesPaid };
            delete newFinesPaid[houseId];
            return {
              ...agenda,
              finesPaid: newFinesPaid,
            };
          }
          return agenda;
        });
      }

      return {
        residents: updatedResidents,
        transactions: updatedTransactions,
        baksosAgendas: updatedBaksos,
      };
    });
  };

  // Hapus total semua pembayaran periode tertentu (mengosongkan status pembayaran KK & menghapus transaksi dari Buku Kas)
  const resetAllDuesPaymentsForPeriod = (
    periodLabel: string,
    options: {
      deleteDuesTransactions?: boolean;
      resetBaksosFines?: boolean;
      resetTunggakanTxs?: boolean;
    } = {
      deleteDuesTransactions: true,
      resetBaksosFines: true,
      resetTunggakanTxs: false,
    }
  ) => {
    const trimmed = periodLabel.trim();
    const periodKey = parseIndonesianMonthYearToKey(trimmed);
    const periodLower = trimmed.toLowerCase();
    const isAllPeriods = trimmed === 'semua' || !trimmed;

    commitLocalMutation((cur) => {
      // 1. Reset status pembayaran seluruh KK yang terdaftar di periode ini (atau seluruh KK jika 'semua')
      const updatedResidents = cur.residents.map((house) => {
        const housePeriod = house.duesMonthNote || cur.siteConfig.duesCurrentMonth || 'Oktober 2026';
        const matches =
          isAllPeriods ||
          housePeriod === trimmed ||
          house.duesMonthNote?.toLowerCase().includes(periodLower);

        if (!matches && !isAllPeriods) return house;

        return {
          ...house,
          duesStatus: 'Belum Bayar' as const,
          duesPaidAmount: 0,
          duesPaidMonths: 0,
          duesPrepaidBalance: 0,
          duesPaidDate: '',
          updatedAt: new Date().toISOString(),
        };
      });

      // 2. Hapus seluruh transaksi iuran warga (dan denda/tunggakan bila dipilih) di periode ini dari Buku Kas
      let updatedTransactions = cur.transactions;
      if (options.deleteDuesTransactions !== false) {
        updatedTransactions = cur.transactions.filter((tx) => {
          if (tx.type !== 'masuk') return true;

          const mKey = getMonthKeyFromDate(tx.date);
          const descLower = (tx.description || '').toLowerCase();
          const cat = tx.category || '';

          const isIuran = cat === 'Iuran Warga' || descLower.includes('iuran');
          const isDenda = cat === 'Denda Baksos' || descLower.includes('denda');
          const isTunggakan = cat === 'Pembayaran Tunggakan' || descLower.includes('tunggakan');

          if (!isIuran && (!options.resetBaksosFines || !isDenda) && (!options.resetTunggakanTxs || !isTunggakan)) {
            return true;
          }

          const matchesPeriod =
            isAllPeriods ||
            descLower.includes(periodLower) ||
            (periodKey && mKey === periodKey);

          return !matchesPeriod;
        });
      }

      // 3. Batalkan status pelunasan denda baksos untuk agenda pada periode ini jika dipilih
      let updatedBaksos = cur.baksosAgendas;
      if (options.resetBaksosFines) {
        updatedBaksos = cur.baksosAgendas.map((agenda) => {
          const agendaKey = getMonthKeyFromDate(agenda.date);
          const matchesAgenda = isAllPeriods || (periodKey && agendaKey === periodKey);
          if (!matchesAgenda) return agenda;

          return {
            ...agenda,
            finesPaid: {},
          };
        });
      }

      return {
        residents: updatedResidents,
        transactions: updatedTransactions,
        baksosAgendas: updatedBaksos,
      };
    });
  };

  // Balance adjustment via transaction
  const adjustBalance = (
    pool: 'Kas Utama' | 'Cashback WiFi' | 'Cashback Sampah',
    targetAmount: number,
    note: string,
    customDate?: string,
    currentPoolBalanceOverride?: number
  ) => {
    const current =
      currentPoolBalanceOverride !== undefined
        ? currentPoolBalanceOverride
        : pool === 'Cashback WiFi'
        ? calculatedBalances.wifiCashback
        : pool === 'Cashback Sampah'
        ? calculatedBalances.sampahCashback
        : calculatedBalances.kasUtama;

    const diff = targetAmount - current;
    if (diff === 0) return;

    const newTx: CashTransaction = {
      id: 'tx-adj-' + Date.now() + '-' + Math.random().toString(36).slice(2, 6),
      date: customDate || new Date().toISOString().slice(0, 10),
      type: diff > 0 ? 'masuk' : 'keluar',
      pool,
      category: pool === 'Kas Utama' ? 'Kas Utama' : pool,
      description: `Penyesuaian Saldo ${pool}: ${note || 'Penyesuaian manual admin'}`,
      amount: Math.abs(diff),
    };
    commitLocalMutation((cur) => ({
      transactions: [newTx, ...cur.transactions],
    }));
  };

  // Fitur edit Saldo Bulan Sebelumnya periode Mei (Saldo Awal Inputan Baseline Tahun 2026)
  const saveMayInitialBalance = (
    kasAmount: number,
    wifiAmount: number,
    sampahAmount: number,
    note?: string
  ) => {
    commitLocalMutation((cur) => {
      // Bersihkan transaksi saldo awal (baik Mei maupun warisan April) jika ada
      const remainingTxs = cur.transactions.filter(
        (t) =>
          t.id !== 'tx-init-mei-kas' &&
          t.id !== 'tx-init-mei-wifi' &&
          t.id !== 'tx-init-mei-sampah' &&
          t.id !== 'tx-init-april-kas' &&
          t.id !== 'tx-init-april-wifi' &&
          t.id !== 'tx-init-april-sampah' &&
          !(
            (t.date === '2026-04-30' || t.date === '2026-03-31') &&
            (t.description.toLowerCase().includes('april') || t.description.toLowerCase().includes('mei'))
          )
      );

      const newTxs: CashTransaction[] = [];
      if (kasAmount !== 0) {
        newTxs.push({
          id: 'tx-init-mei-kas',
          date: '2026-04-30',
          type: kasAmount >= 0 ? 'masuk' : 'keluar',
          pool: 'Kas Utama',
          category: 'Kas Utama',
          description: note || 'Saldo Awal Kas Utama Bulan Sebelumnya (Periode Mei 2026)',
          amount: Math.abs(kasAmount),
        });
      }
      if (wifiAmount !== 0) {
        newTxs.push({
          id: 'tx-init-mei-wifi',
          date: '2026-04-30',
          type: wifiAmount >= 0 ? 'masuk' : 'keluar',
          pool: 'Cashback WiFi',
          category: 'Cashback WiFi',
          description: 'Saldo Awal Cashback WiFi Bulan Sebelumnya (Periode Mei 2026)',
          amount: Math.abs(wifiAmount),
        });
      }
      if (sampahAmount !== 0) {
        newTxs.push({
          id: 'tx-init-mei-sampah',
          date: '2026-04-30',
          type: sampahAmount >= 0 ? 'masuk' : 'keluar',
          pool: 'Cashback Sampah',
          category: 'Cashback Sampah',
          description: 'Saldo Awal Cashback Sampah Bulan Sebelumnya (Periode Mei 2026)',
          amount: Math.abs(sampahAmount),
        });
      }

      return {
        transactions: [...newTxs, ...remainingTxs],
      };
    });
  };

  const saveAprilInitialBalance = saveMayInitialBalance;

  // CRUD for Baksos Agenda & Attendance
  const addBaksosAgenda = (agenda: Omit<BaksosAgenda, 'id'>) => {
    const newAgenda: BaksosAgenda = {
      ...agenda,
      id: 'baksos-' + Date.now(),
    };
    commitLocalMutation((cur) => ({
      baksosAgendas: [newAgenda, ...cur.baksosAgendas],
    }));
  };

  const updateBaksosAgenda = (updated: BaksosAgenda) => {
    commitLocalMutation((cur) => ({
      baksosAgendas: cur.baksosAgendas.map((b) => (b.id === updated.id ? updated : b)),
    }));
  };

  const deleteBaksosAgenda = (id: string) => {
    commitLocalMutation((cur) => ({
      baksosAgendas: cur.baksosAgendas.filter((b) => b.id !== id),
    }));
  };

  const setBaksosAttendance = (
    agendaId: string,
    residentId: string,
    status: BaksosAttendanceStatus
  ) => {
    commitLocalMutation((cur) => ({
      baksosAgendas: cur.baksosAgendas.map((agenda) => {
        if (agenda.id !== agendaId) return agenda;
        return {
          ...agenda,
          attendance: {
            ...agenda.attendance,
            [residentId]: status,
          },
        };
      }),
    }));
  };

  // Pay Baksos Fine of 10.000: records fine as paid and automatically adds cash transaction to Kas Utama
  const markBaksosFinePaid = (
    agendaId: string,
    residentId: string,
    houseName: string,
    blockNo: string
  ) => {
    const newTx: CashTransaction = {
      id: 'tx-baksos-' + Date.now() + '-' + Math.random().toString(36).slice(2, 6),
      date: new Date().toISOString().slice(0, 10),
      type: 'masuk',
      pool: 'Kas Utama',
      category: 'Denda Baksos',
      description: `Pelunasan Denda Baksos (Rp 10.000) - Blok ${blockNo} (${houseName})`,
      amount: 10000,
    };

    commitLocalMutation((cur) => ({
      baksosAgendas: cur.baksosAgendas.map((agenda) => {
        if (agenda.id !== agendaId) return agenda;
        return {
          ...agenda,
          finesPaid: {
            ...(agenda.finesPaid || {}),
            [residentId]: true,
          },
        };
      }),
      transactions: [newTx, ...cur.transactions],
    }));
  };

  // Unmark Baksos Fine as paid (used when input is cancelled or reverted to Belum Bayar)
  const unmarkBaksosFinePaid = (agendaId: string, residentId: string) => {
    commitLocalMutation((cur) => ({
      baksosAgendas: cur.baksosAgendas.map((agenda) => {
        if (agenda.id !== agendaId) return agenda;
        const updatedFines = { ...(agenda.finesPaid || {}) };
        delete updatedFines[residentId];
        return {
          ...agenda,
          finesPaid: updatedFines,
        };
      }),
    }));
  };

  // CRUD for Pelayanan Publik & Pengurus
  const addCommittee = (name: string, role: string, phone: string) => {
    const newC: CommitteeContact = {
      id: 'kom-' + Date.now(),
      name,
      role: role || 'Pengurus Gang',
      phone,
    };
    commitLocalMutation((cur) => ({
      committees: [...cur.committees, newC],
    }));
  };

  const updateCommittee = (updated: CommitteeContact) => {
    commitLocalMutation((cur) => ({
      committees: cur.committees.map((c) => (c.id === updated.id ? updated : c)),
    }));
  };

  const deleteCommittee = (id: string) => {
    commitLocalMutation((cur) => ({
      committees: cur.committees.filter((c) => c.id !== id),
    }));
  };

  // CRUD for Announcements
  const addAnnouncement = (ann: Omit<Announcement, 'id'>) => {
    const newAnn: Announcement = {
      ...ann,
      id: 'ann-' + Date.now(),
    };
    commitLocalMutation((cur) => ({
      announcements: [newAnn, ...cur.announcements],
    }));
  };

  const updateAnnouncement = (updated: Announcement) => {
    commitLocalMutation((cur) => ({
      announcements: cur.announcements.map((a) => (a.id === updated.id ? updated : a)),
    }));
  };

  const deleteAnnouncement = (id: string) => {
    commitLocalMutation((cur) => ({
      announcements: cur.announcements.filter((a) => a.id !== id),
    }));
  };

  // Reset to initial data (only when explicitly requested by Admin)
  const resetToDefaultData = () => {
    commitLocalMutation(
      () => ({
        siteConfig: INITIAL_SITE_CONFIG,
        residents: INITIAL_RESIDENTS,
        transactions: INITIAL_TRANSACTIONS,
        baksosAgendas: INITIAL_BAKSOS_AGENDAS,
        committees: INITIAL_COMMITTEES,
        announcements: INITIAL_ANNOUNCEMENTS,
      }),
      true
    );
  };

  // Reset / hapus halaman kembali ke default tapi otomatis menarik input data terakhir dari database
  const resetPageToDefaultWithLatestDb = useCallback(async (): Promise<boolean> => {
    try {
      localStorage.removeItem(STORAGE_KEYS.UNIFIED_SNAPSHOT);
      localStorage.removeItem(STORAGE_KEYS.CONFIG);
      localStorage.removeItem(STORAGE_KEYS.RESIDENTS);
      localStorage.removeItem(STORAGE_KEYS.TRANSACTIONS);
      localStorage.removeItem(STORAGE_KEYS.BAKSOS);
      localStorage.removeItem(STORAGE_KEYS.COMMITTEES);
      localStorage.removeItem(STORAGE_KEYS.ANNOUNCEMENTS);
    } catch {}
    return await fetchLatestFromServer(true);
  }, [fetchLatestFromServer]);

  const getDatabasePayload = (): PortalDatabasePayload => ({
    ...dbStateRef.current,
    version: 5,
    revision: onlineRevision || dbStateRef.current.revision || 1,
    updatedAt: lastOnlineSync || dbStateRef.current.updatedAt || new Date().toISOString(),
  });

  const restoreFromDatabasePayload = (payload: PortalDatabasePayload | string) => {
    let normalizedPayload: PortalDatabasePayload;
    if (typeof payload === 'string') {
      const res = parseAndNormalizeBackupJson(payload);
      normalizedPayload = res.success && res.payload ? res.payload : replaceLingkunganWithGang(JSON.parse(payload));
    } else {
      const res = parseAndNormalizeBackupJson(JSON.stringify(payload));
      normalizedPayload = res.success && res.payload ? res.payload : replaceLingkunganWithGang(payload);
    }

    commitLocalMutation(
      () => ({
        siteConfig: normalizedPayload.siteConfig,
        residents: normalizedPayload.residents,
        transactions: normalizedPayload.transactions,
        baksosAgendas: normalizedPayload.baksosAgendas,
        committees: normalizedPayload.committees,
        announcements: normalizedPayload.announcements,
      }),
      true
    );
  };

  return {
    siteConfig,
    residents,
    transactions,
    baksosAgendas,
    committees,
    announcements,
    calculatedBalances,
    isAdmin,
    resetPageToDefaultWithLatestDb,
    lastOnlineSync,
    onlineRevision,
    isOnlineSyncing,
    isOnlineConnected,
    isAutoSyncEnabled,
    toggleAutoSync,
    syncOnlineNow,
    loginAdmin,
    logoutAdmin,
    changeAdminPassword,
    updateSiteConfig,
    createPeriod,
    deletePeriod,
    addResident,
    updateResident,
    deleteResident,
    importResidents,
    batchImportDues,
    rolloverBillingMonth,
    addTransaction,
    updateTransaction,
    deleteTransaction,
    deleteTransactions,
    syncHouseDuesEditAndTransactions,
    resetSingleHousePaymentAndSync,
    resetAllDuesPaymentsForPeriod,
    adjustBalance,
    saveAprilInitialBalance,
    saveMayInitialBalance,
    addBaksosAgenda,
    updateBaksosAgenda,
    deleteBaksosAgenda,
    setBaksosAttendance,
    markBaksosFinePaid,
    unmarkBaksosFinePaid,
    addCommittee,
    updateCommittee,
    deleteCommittee,
    addAnnouncement,
    updateAnnouncement,
    deleteAnnouncement,
    resetToDefaultData,
    getDatabasePayload,
    restoreFromDatabasePayload,
  };
}
