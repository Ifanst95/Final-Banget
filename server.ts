import express from 'express';
import dotenv from 'dotenv';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { fileURLToPath } from 'url';
import {
  INITIAL_ANNOUNCEMENTS,
  INITIAL_BAKSOS_AGENDAS,
  INITIAL_COMMITTEES,
  INITIAL_RESIDENTS,
  INITIAL_SITE_CONFIG,
  INITIAL_TRANSACTIONS,
} from './src/data/initialData.ts';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DB_FILE_PATH = path.join(__dirname, 'online_database.json');
const TMP_DB_FILE_PATH = path.join(os.tmpdir(), 'mandor_online_database_v6.json');

// Cloud Firestore Configuration for Persistent Cloud Storage across Container Restarts
const FIREBASE_CONFIG_PATH = path.join(__dirname, 'firebase-applet-config.json');
let firebaseConfig: any = null;
try {
  if (fs.existsSync(FIREBASE_CONFIG_PATH)) {
    firebaseConfig = JSON.parse(fs.readFileSync(FIREBASE_CONFIG_PATH, 'utf-8'));
  }
} catch {}

const FIRESTORE_PROJECT_ID = process.env.FIREBASE_PROJECT_ID || firebaseConfig?.projectId || 'quiet-celerity-0pthm';
const FIRESTORE_DB_ID = process.env.FIREBASE_DATABASE_ID || firebaseConfig?.firestoreDatabaseId || 'ai-studio-remixpapaninform-41e5cb9f-2f4d-49e1-83a5-ba7c0b787c5b';
const FIRESTORE_API_KEY = process.env.FIREBASE_API_KEY || firebaseConfig?.apiKey || 'AIzaSyAzqsKwGf4SyDIxvOlzPbXk2CUue1Av0Zc';
const FIRESTORE_DOC_URL = `https://firestore.googleapis.com/v1/projects/${FIRESTORE_PROJECT_ID}/databases/${FIRESTORE_DB_ID}/documents/portal_state/main_state`;

interface RuntimeDatabasePayload {
  version: number;
  revision: number;
  isDefaultSeed?: boolean;
  forceReset?: boolean;
  updatedAt: string;
  updatedBy: string;
  clientId?: string;
  siteConfig: typeof INITIAL_SITE_CONFIG;
  residents: typeof INITIAL_RESIDENTS;
  transactions: typeof INITIAL_TRANSACTIONS;
  baksosAgendas: typeof INITIAL_BAKSOS_AGENDAS;
  committees: typeof INITIAL_COMMITTEES;
  announcements: typeof INITIAL_ANNOUNCEMENTS;
}

let memoryDbState: RuntimeDatabasePayload | null = null;
let cachedGcpAccessToken: { token: string; expiresAt: number } | null = null;

function createDefaultSeedPayload(): RuntimeDatabasePayload {
  return {
    version: 5,
    revision: 0,
    isDefaultSeed: true,
    updatedAt: new Date(0).toISOString(),
    updatedBy: 'Server Online Gang Mandor',
    siteConfig: INITIAL_SITE_CONFIG,
    residents: INITIAL_RESIDENTS,
    transactions: INITIAL_TRANSACTIONS,
    baksosAgendas: INITIAL_BAKSOS_AGENDAS,
    committees: INITIAL_COMMITTEES,
    announcements: INITIAL_ANNOUNCEMENTS,
  };
}

function ensureSeptemberDefaultTransactions(
  txs: typeof INITIAL_TRANSACTIONS
): typeof INITIAL_TRANSACTIONS {
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

function normalizePayload(raw: any): RuntimeDatabasePayload | null {
  if (!raw || typeof raw !== 'object' || !raw.siteConfig || !Array.isArray(raw.residents)) {
    return null;
  }
  const rawRev = Number(raw.revision);
  const isLegacyDefaultSeed =
    raw.isDefaultSeed === true ||
    rawRev === 0 ||
    (rawRev === 1 && raw.updatedBy === 'Server Online Gang Mandor');

  return {
    version: 5,
    revision: isLegacyDefaultSeed ? 0 : Math.max(1, rawRev || 1),
    isDefaultSeed: isLegacyDefaultSeed,
    updatedAt: raw.updatedAt || new Date().toISOString(),
    updatedBy: raw.updatedBy || 'Portal Online Gang Mandor',
    clientId: raw.clientId,
    siteConfig: raw.siteConfig,
    residents: raw.residents,
    transactions: ensureSeptemberDefaultTransactions(
      Array.isArray(raw.transactions) ? raw.transactions : INITIAL_TRANSACTIONS
    ),
    baksosAgendas: Array.isArray(raw.baksosAgendas) ? raw.baksosAgendas : INITIAL_BAKSOS_AGENDAS,
    committees: Array.isArray(raw.committees) ? raw.committees : INITIAL_COMMITTEES,
    announcements: Array.isArray(raw.announcements) ? raw.announcements : INITIAL_ANNOUNCEMENTS,
  };
}

function readJsonFileSafe(filePath: string): RuntimeDatabasePayload | null {
  try {
    if (!fs.existsSync(filePath)) return null;
    const raw = fs.readFileSync(filePath, 'utf-8');
    return normalizePayload(JSON.parse(raw));
  } catch {
    return null;
  }
}

let fileWriteCounter = 0;
function writeJsonFileAtomic(filePath: string, data: RuntimeDatabasePayload) {
  try {
    fileWriteCounter = (fileWriteCounter + 1) % 1000000;
    const tmpPath = `${filePath}.tmp.${process.pid}.${Date.now()}.${fileWriteCounter}`;
    fs.writeFileSync(tmpPath, JSON.stringify(data, null, 2), 'utf-8');
    fs.renameSync(tmpPath, filePath);
  } catch {
    try {
      fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8');
    } catch {}
  }
}

function pickNewerPayload(
  a: RuntimeDatabasePayload | null,
  b: RuntimeDatabasePayload | null
): RuntimeDatabasePayload | null {
  if (!a) return b;
  if (!b) return a;
  if (a.isDefaultSeed && !b.isDefaultSeed) return b;
  if (!a.isDefaultSeed && b.isDefaultSeed) return a;
  if ((b.revision || 0) > (a.revision || 0)) return b;
  if ((a.revision || 0) > (b.revision || 0)) return a;
  const timeA = Date.parse(a.updatedAt || '') || 0;
  const timeB = Date.parse(b.updatedAt || '') || 0;
  return timeB > timeA ? b : a;
}

// Fetch GCP Service Account Access Token on Cloud Run for Cloud Firestore Persistence
async function getGcpAccessToken(): Promise<string | null> {
  if (cachedGcpAccessToken && Date.now() < cachedGcpAccessToken.expiresAt) {
    return cachedGcpAccessToken.token;
  }
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 1200);
    const res = await fetch(
      'http://metadata.google.internal/computeMetadata/v1/instance/service-accounts/default/token',
      {
        headers: { 'Metadata-Flavor': 'Google' },
        signal: controller.signal,
      }
    );
    clearTimeout(timeout);
    if (!res.ok) return null;
    const json = (await res.json()) as { access_token?: string; expires_in?: number };
    if (json.access_token) {
      cachedGcpAccessToken = {
        token: json.access_token,
        expiresAt: Date.now() + Math.max(60, (json.expires_in || 300) - 60) * 1000,
      };
      return json.access_token;
    }
    return null;
  } catch {
    return null;
  }
}

async function loadStateFromCloudFirestore(): Promise<RuntimeDatabasePayload | null> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 4500);
    const url = `${FIRESTORE_DOC_URL}?key=${FIRESTORE_API_KEY}`;
    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(timeout);
    if (!res.ok) return null;
    const docJson = (await res.json()) as any;
    const rawJsonStr = docJson?.fields?.payloadJson?.stringValue;
    if (!rawJsonStr) return null;
    return normalizePayload(JSON.parse(rawJsonStr));
  } catch {
    return null;
  }
}

async function saveStateToCloudFirestore(payload: RuntimeDatabasePayload): Promise<void> {
  if (payload.isDefaultSeed) return;
  try {
    const body = {
      fields: {
        revision: { integerValue: String(payload.revision || 1) },
        updatedAt: { stringValue: payload.updatedAt || new Date().toISOString() },
        updatedBy: { stringValue: payload.updatedBy || 'Portal Online Gang Mandor' },
        payloadJson: { stringValue: JSON.stringify(payload) },
      },
    };
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);
    const patchUrl = `${FIRESTORE_DOC_URL}?key=${FIRESTORE_API_KEY}`;
    const patchRes = await fetch(patchUrl, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    if (patchRes.status === 404) {
      const createUrl = `https://firestore.googleapis.com/v1/projects/${FIRESTORE_PROJECT_ID}/databases/${FIRESTORE_DB_ID}/documents/portal_state?documentId=main_state&key=${FIRESTORE_API_KEY}`;
      await fetch(createUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
    }
    clearTimeout(timeout);
  } catch {
    // Gracefully ignore network timeout
  }
}

const SQL_FILE_PATH = path.join(__dirname, 'database_warga_gang_mandor.sql');

function escapeSql(val: any): string {
  if (val === null || val === undefined) return 'NULL';
  if (typeof val === 'number') return String(val);
  if (typeof val === 'boolean') return val ? '1' : '0';
  return `'${String(val).replace(/'/g, "''").replace(/\\/g, '\\\\')}'`;
}

function generateSqlDump(payload: RuntimeDatabasePayload): string {
  const lines: string[] = [];
  const now = new Date().toISOString();
  lines.push('-- ============================================================');
  lines.push('-- DATABASE WARGA & KAS GANG MANDOR BLOK K2/25 - K3/24');
  lines.push(`-- Terakhir Disinkronkan: ${now}`);
  lines.push(`-- Revisi: #${payload.revision || 1}`);
  lines.push('-- ============================================================\n');

  lines.push('SET FOREIGN_KEY_CHECKS = 0;');
  lines.push('SET SQL_MODE = "NO_AUTO_VALUE_ON_ZERO";\n');

  // Table: warga
  lines.push('CREATE TABLE IF NOT EXISTS `warga` (');
  lines.push('  `id` VARCHAR(64) NOT NULL PRIMARY KEY,');
  lines.push('  `block_number` VARCHAR(32) NOT NULL,');
  lines.push('  `head_name` VARCHAR(128) NOT NULL,');
  lines.push('  `phone` VARCHAR(32) DEFAULT NULL,');
  lines.push('  `ownership` VARCHAR(32) DEFAULT NULL,');
  lines.push('  `occupancy` VARCHAR(32) DEFAULT NULL,');
  lines.push('  `rukem` VARCHAR(32) DEFAULT NULL,');
  lines.push('  `wifi_status` VARCHAR(32) DEFAULT NULL,');
  lines.push('  `wifi_provider` VARCHAR(64) DEFAULT NULL,');
  lines.push('  `dues_status` VARCHAR(32) DEFAULT NULL,');
  lines.push('  `custom_dues_amount` INT DEFAULT NULL,');
  lines.push('  `dues_paid_amount` INT DEFAULT NULL,');
  lines.push('  `dues_paid_months` INT DEFAULT NULL,');
  lines.push('  `dues_prepaid_balance` INT DEFAULT NULL,');
  lines.push('  `dues_paid_date` VARCHAR(32) DEFAULT NULL,');
  lines.push('  `dues_month_note` VARCHAR(128) DEFAULT NULL,');
  lines.push('  `previous_arrears` INT DEFAULT 0,');
  lines.push('  `previous_arrears_note` TEXT DEFAULT NULL,');
  lines.push('  `previous_baksos_arrears` INT DEFAULT 0,');
  lines.push('  `previous_baksos_arrears_note` TEXT DEFAULT NULL,');
  lines.push('  `custom_baksos_fine_amount` INT DEFAULT NULL,');
  lines.push('  `updated_at` VARCHAR(64) DEFAULT NULL');
  lines.push(') ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;\n');

  // Table: anggota_keluarga
  lines.push('CREATE TABLE IF NOT EXISTS `anggota_keluarga` (');
  lines.push('  `id` VARCHAR(64) NOT NULL PRIMARY KEY,');
  lines.push('  `resident_house_id` VARCHAR(64) NOT NULL,');
  lines.push('  `name` VARCHAR(128) NOT NULL,');
  lines.push('  `relation` VARCHAR(64) DEFAULT NULL,');
  lines.push('  `birth_place` VARCHAR(64) DEFAULT NULL,');
  lines.push('  `birth_date` VARCHAR(32) DEFAULT NULL,');
  lines.push('  `gender` VARCHAR(32) DEFAULT NULL,');
  lines.push('  `religion` VARCHAR(32) DEFAULT NULL,');
  lines.push('  `occupation` VARCHAR(64) DEFAULT NULL,');
  lines.push('  KEY `idx_resident_house_id` (`resident_house_id`)');
  lines.push(') ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;\n');

  // Table: transaksi_kas
  lines.push('CREATE TABLE IF NOT EXISTS `transaksi_kas` (');
  lines.push('  `id` VARCHAR(64) NOT NULL PRIMARY KEY,');
  lines.push('  `date` VARCHAR(32) NOT NULL,');
  lines.push('  `type` VARCHAR(16) NOT NULL,');
  lines.push('  `pool` VARCHAR(32) NOT NULL,');
  lines.push('  `category` VARCHAR(64) NOT NULL,');
  lines.push('  `description` TEXT DEFAULT NULL,');
  lines.push('  `amount` INT NOT NULL');
  lines.push(') ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;\n');

  // Table: agenda_baksos
  lines.push('CREATE TABLE IF NOT EXISTS `agenda_baksos` (');
  lines.push('  `id` VARCHAR(64) NOT NULL PRIMARY KEY,');
  lines.push('  `title` VARCHAR(128) NOT NULL,');
  lines.push('  `date` VARCHAR(32) NOT NULL,');
  lines.push('  `location` VARCHAR(128) DEFAULT NULL,');
  lines.push('  `description` TEXT DEFAULT NULL,');
  lines.push('  `fine_amount` INT DEFAULT 10000');
  lines.push(') ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;\n');

  // Table: pengurus
  lines.push('CREATE TABLE IF NOT EXISTS `pengurus` (');
  lines.push('  `id` VARCHAR(64) NOT NULL PRIMARY KEY,');
  lines.push('  `name` VARCHAR(128) NOT NULL,');
  lines.push('  `role` VARCHAR(64) NOT NULL,');
  lines.push('  `phone` VARCHAR(32) DEFAULT NULL');
  lines.push(') ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;\n');

  // Table: pengumuman
  lines.push('CREATE TABLE IF NOT EXISTS `pengumuman` (');
  lines.push('  `id` VARCHAR(64) NOT NULL PRIMARY KEY,');
  lines.push('  `title` VARCHAR(128) NOT NULL,');
  lines.push('  `date` VARCHAR(32) NOT NULL,');
  lines.push('  `content` TEXT DEFAULT NULL,');
  lines.push('  `priority` VARCHAR(16) DEFAULT "normal"');
  lines.push(') ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;\n');

  // Populate data
  if (Array.isArray(payload.residents) && payload.residents.length > 0) {
    lines.push('-- Data Warga');
    for (const h of payload.residents) {
      lines.push(
        `REPLACE INTO \`warga\` VALUES (${escapeSql(h.id)}, ${escapeSql(h.blockNumber)}, ${escapeSql(h.headName)}, ${escapeSql(h.phone)}, ${escapeSql(h.ownership)}, ${escapeSql(h.occupancy)}, ${escapeSql(h.rukem)}, ${escapeSql(h.wifiStatus)}, ${escapeSql(h.wifiProvider)}, ${escapeSql(h.duesStatus)}, ${escapeSql(h.customDuesAmount)}, ${escapeSql(h.duesPaidAmount)}, ${escapeSql(h.duesPaidMonths)}, ${escapeSql(h.duesPrepaidBalance)}, ${escapeSql(h.duesPaidDate)}, ${escapeSql(h.duesMonthNote)}, ${Number(h.previousArrears) || 0}, ${escapeSql(h.previousArrearsNote)}, ${Number(h.previousBaksosArrears) || 0}, ${escapeSql(h.previousBaksosArrearsNote)}, ${escapeSql(h.customBaksosFineAmount)}, ${escapeSql(h.updatedAt)});`
      );
      if (Array.isArray(h.members)) {
        for (const m of h.members) {
          lines.push(
            `REPLACE INTO \`anggota_keluarga\` VALUES (${escapeSql(m.id)}, ${escapeSql(h.id)}, ${escapeSql(m.name)}, ${escapeSql(m.relation)}, ${escapeSql(m.birthPlace)}, ${escapeSql(m.birthDate)}, ${escapeSql(m.gender)}, ${escapeSql(m.religion)}, ${escapeSql(m.occupation)});`
          );
        }
      }
    }
    lines.push('');
  }

  if (Array.isArray(payload.transactions) && payload.transactions.length > 0) {
    lines.push('-- Data Transaksi Kas');
    for (const t of payload.transactions) {
      lines.push(
        `REPLACE INTO \`transaksi_kas\` VALUES (${escapeSql(t.id)}, ${escapeSql(t.date)}, ${escapeSql(t.type)}, ${escapeSql(t.pool)}, ${escapeSql(t.category)}, ${escapeSql(t.description)}, ${Number(t.amount) || 0});`
      );
    }
    lines.push('');
  }

  if (Array.isArray(payload.baksosAgendas) && payload.baksosAgendas.length > 0) {
    lines.push('-- Data Agenda Bakti Sosial');
    for (const a of payload.baksosAgendas) {
      lines.push(
        `REPLACE INTO \`agenda_baksos\` VALUES (${escapeSql(a.id)}, ${escapeSql(a.title)}, ${escapeSql(a.date)}, ${escapeSql(a.location)}, ${escapeSql(a.description)}, ${Number(a.fineAmount) || 10000});`
      );
    }
    lines.push('');
  }

  if (Array.isArray(payload.committees) && payload.committees.length > 0) {
    lines.push('-- Data Pengurus & Kontak Layanan');
    for (const c of payload.committees) {
      lines.push(
        `REPLACE INTO \`pengurus\` VALUES (${escapeSql(c.id)}, ${escapeSql(c.name)}, ${escapeSql(c.role)}, ${escapeSql(c.phone)});`
      );
    }
    lines.push('');
  }

  if (Array.isArray(payload.announcements) && payload.announcements.length > 0) {
    lines.push('-- Data Papan Pengumuman');
    for (const ann of payload.announcements) {
      lines.push(
        `REPLACE INTO \`pengumuman\` VALUES (${escapeSql(ann.id)}, ${escapeSql(ann.title)}, ${escapeSql(ann.date)}, ${escapeSql(ann.content)}, ${escapeSql(ann.priority)});`
      );
    }
    lines.push('');
  }

  lines.push('SET FOREIGN_KEY_CHECKS = 1;');
  lines.push('-- Selesai Ekspor SQL\n');
  return lines.join('\n');
}

function persistStateEverywhereSync(payload: RuntimeDatabasePayload) {
  memoryDbState = payload;
  writeJsonFileAtomic(DB_FILE_PATH, payload);
  writeJsonFileAtomic(TMP_DB_FILE_PATH, payload);
  try {
    const sqlContent = generateSqlDump(payload);
    fs.writeFileSync(SQL_FILE_PATH, sqlContent, 'utf-8');
  } catch {}
}

function ensureOnlineDatabaseInitialized(): RuntimeDatabasePayload {
  if (memoryDbState) {
    return memoryDbState;
  }

  const fromRepoDisk = readJsonFileSafe(DB_FILE_PATH);
  const fromTmpDisk = readJsonFileSafe(TMP_DB_FILE_PATH);
  const bestLocal = pickNewerPayload(fromRepoDisk, fromTmpDisk);

  if (bestLocal) {
    persistStateEverywhereSync(bestLocal);
    return bestLocal;
  }

  const initialSeed = createDefaultSeedPayload();
  persistStateEverywhereSync(initialSeed);
  return initialSeed;
}

async function startServer() {
  const app = express();
  const PORT = Number(process.env.PORT) || 3000;

  ensureOnlineDatabaseInitialized();

  // Active SSE clients for real-time automatic synchronization across all browsers/devices
  const sseClients = new Set<express.Response>();

  const broadcastDatabaseUpdate = (payload: RuntimeDatabasePayload) => {
    const message = `data: ${JSON.stringify(payload)}\n\n`;
    for (const client of sseClients) {
      try {
        client.write(message);
        (client as any).flush?.();
      } catch {
        sseClients.delete(client);
      }
    }
  };

  // Hydrate from Cloud Firestore on server boot so container restarts never revert to default seed
  loadStateFromCloudFirestore()
    .then((cloudState) => {
      if (!cloudState) return;
      const current = ensureOnlineDatabaseInitialized();
      const winner = pickNewerPayload(current, cloudState);
      if (winner && winner !== current) {
        persistStateEverywhereSync(winner);
        broadcastDatabaseUpdate(winner);
      }
    })
    .catch(() => {});

  app.use(express.json({ limit: '20mb' }));
  app.use(express.text({ limit: '20mb', type: ['text/plain', 'application/json'] }));
  app.use((req, _res, next) => {
    if (typeof req.body === 'string') {
      try {
        req.body = JSON.parse(req.body);
      } catch {}
    }
    next();
  });

  // Disable caching on API routes so clients always get fresh data
  app.use('/api', (_req, res, next) => {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    next();
  });

  // GET /api/database/sql - Download synchronized MySQL/MariaDB database dump
  app.get('/api/database/sql', (_req, res) => {
    try {
      const current = ensureOnlineDatabaseInitialized();
      const sqlContent = generateSqlDump(current);
      res.setHeader('Content-Type', 'application/sql; charset=utf-8');
      res.setHeader(
        'Content-Disposition',
        'attachment; filename="database_warga_gang_mandor.sql"'
      );
      return res.send(sqlContent);
    } catch {
      return res.status(500).json({ error: 'Failed to generate SQL database dump' });
    }
  });

  // GET /api/database/stream - Real-Time Server-Sent Events (SSE) stream for instant multi-device sync
  app.get('/api/database/stream', (req, res) => {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
    res.flushHeaders?.();

    sseClients.add(res);

    try {
      const current = ensureOnlineDatabaseInitialized();
      if (current) {
        res.write(
          `event: connected\ndata: ${JSON.stringify({
            revision: current.revision || 0,
            isDefaultSeed: Boolean(current.isDefaultSeed),
            updatedAt: current.updatedAt,
            connectedClients: sseClients.size,
          })}\n\n`
        );
      }
    } catch {}

    const heartbeat = setInterval(() => {
      try {
        res.write(`: heartbeat ${Date.now()}\n\n`);
      } catch {
        clearInterval(heartbeat);
        sseClients.delete(res);
      }
    }, 20000);

    req.on('close', () => {
      clearInterval(heartbeat);
      sseClients.delete(res);
    });

    req.on('error', () => {
      clearInterval(heartbeat);
      sseClients.delete(res);
    });

    res.on('error', () => {
      clearInterval(heartbeat);
      sseClients.delete(res);
    });
  });

  // GET /api/database/meta - Lightweight metadata check for smart background sync
  app.get('/api/database/meta', (_req, res) => {
    try {
      const parsed = ensureOnlineDatabaseInitialized();
      return res.json({
        exists: true,
        revision: parsed.revision || 0,
        isDefaultSeed: Boolean(parsed.isDefaultSeed),
        updatedAt: parsed.updatedAt || null,
        updatedBy: parsed.updatedBy || 'Server Online',
        connectedClients: sseClients.size,
      });
    } catch {
      return res.status(500).json({ error: 'Failed to read online database metadata' });
    }
  });

  // GET /api/database - Retrieve latest online community database state
  app.get('/api/database', async (_req, res) => {
    try {
      const fromRepoDisk = readJsonFileSafe(DB_FILE_PATH);
      const fromTmpDisk = readJsonFileSafe(TMP_DB_FILE_PATH);
      let best = pickNewerPayload(memoryDbState, pickNewerPayload(fromRepoDisk, fromTmpDisk));

      // Always check Cloud Firestore to ensure container redeploys or cross-device edits are immediately pulled
      try {
        const cloudState = await loadStateFromCloudFirestore();
        if (cloudState) {
          best = pickNewerPayload(best, cloudState);
        }
      } catch {}

      if (!best) {
        best = ensureOnlineDatabaseInitialized();
      } else {
        persistStateEverywhereSync(best);
      }

      return res.json({
        exists: true,
        data: best,
        connectedClients: sseClients.size,
      });
    } catch (err) {
      console.error('Error reading online database:', err);
      return res.status(500).json({ error: 'Failed to read online database' });
    }
  });

  // Mutex queue to serialize concurrent mutation POSTs and prevent race conditions
  let postMutationLock: Promise<any> = Promise.resolve();

  // POST /api/database - Update online community database state, sync MySQL tables (.sql), & broadcast live
  app.post('/api/database', (req, res) => {
    postMutationLock = postMutationLock
      .catch(() => {})
      .then(async () => {
        try {
          const rawIncoming = req.body;
          const incoming = normalizePayload(rawIncoming);
          if (!incoming) {
            return res.status(400).json({ error: 'Invalid database payload' });
          }

          const existing = ensureOnlineDatabaseInitialized();
          const isExplicitReset = Boolean(rawIncoming.forceReset);

          // Guard against accidental overwrite of customized server data with default seed
          if (!existing.isDefaultSeed && incoming.isDefaultSeed && !isExplicitReset) {
            return res.json({
              success: true,
              ignoredStaleSeed: true,
              revision: existing.revision,
              isDefaultSeed: existing.isDefaultSeed,
              updatedAt: existing.updatedAt,
              data: existing,
              connectedClients: sseClients.size,
            });
          }

          const nextRevision = isExplicitReset
            ? (existing.revision || 1) + 1
            : Math.max(existing.revision || 0, incoming.revision || 0) + 1;

          const savedPayload: RuntimeDatabasePayload = {
            ...incoming,
            version: 5,
            revision: nextRevision,
            isDefaultSeed: false,
            updatedAt: new Date().toISOString(),
            updatedBy: rawIncoming.updatedBy || 'Portal Online Gang Mandor',
            clientId: rawIncoming.clientId,
          };

          persistStateEverywhereSync(savedPayload);

          // Asynchronously persist to Cloud Firestore so data survives container scale-to-zero / redeploys
          saveStateToCloudFirestore(savedPayload).catch(() => {});

          // Broadcast instantaneously to all connected online browsers/devices
          broadcastDatabaseUpdate(savedPayload);

          return res.json({
            success: true,
            revision: savedPayload.revision,
            isDefaultSeed: false,
            updatedAt: savedPayload.updatedAt,
            mysqlSynced: true,
            connectedClients: sseClients.size,
          });
        } catch (err) {
          console.error('Error saving online database:', err);
          return res.status(500).json({ error: 'Failed to save online database' });
        }
      });
  });


  // Vite middleware for development or static serving for production
  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(__dirname, 'dist');
    app.use(express.static(distPath));
    app.use((_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
