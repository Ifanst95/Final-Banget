import {
  Announcement,
  BaksosAgenda,
  CashTransaction,
  CommitteeContact,
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
import { isHouseVacant } from './helpers';

export interface RestoreResult {
  success: boolean;
  payload?: PortalDatabasePayload;
  error?: string;
  stats?: {
    residentsCount: number;
    transactionsCount: number;
    agendasCount: number;
    announcementsCount: number;
    committeesCount: number;
  };
}

/**
 * Robust JSON backup parser and normalizer.
 * Supports:
 * - Direct PortalDatabasePayload schema
 * - Nested wrappers: { data: ... }, { payload: ... }, { state: ... }, { backup: ... }
 * - LocalStorage dumps: { mandor_portal_db_snapshot_v6: ..., mandor_residents_v5: ... }
 * - Direct array of residents: [ { blockNumber: "K2/25", headName: "..." } ]
 * - Indonesian alternative keys: warga, transaksi, bukuKas, baksos, pengurus, pengumuman
 */
export function parseAndNormalizeBackupJson(rawText: string): RestoreResult {
  if (!rawText || typeof rawText !== 'string') {
    return { success: false, error: 'File kosong atau format teks tidak valid.' };
  }

  let parsed: any;
  try {
    // Clean UTF-8 BOM and whitespace
    const clean = rawText.replace(/^\uFEFF/, '').trim();
    parsed = JSON.parse(clean);
  } catch (err) {
    return {
      success: false,
      error: 'Gagal membaca format JSON. Pastikan file berformat .json yang valid dan tidak rusak.',
    };
  }

  if (!parsed || (typeof parsed !== 'object' && !Array.isArray(parsed))) {
    return { success: false, error: 'Struktur isi file JSON tidak dikenali.' };
  }

  // 1. Unwrap nested container wrappers if present
  let root = parsed;
  if (root.mandor_portal_db_snapshot_v6) {
    root = typeof root.mandor_portal_db_snapshot_v6 === 'string'
      ? JSON.parse(root.mandor_portal_db_snapshot_v6)
      : root.mandor_portal_db_snapshot_v6;
  } else if (root.payload && typeof root.payload === 'object') {
    root = root.payload;
  } else if (root.data && typeof root.data === 'object' && !Array.isArray(root.data)) {
    root = root.data;
  } else if (root.backup && typeof root.backup === 'object') {
    root = root.backup;
  } else if (root.state && typeof root.state === 'object') {
    root = root.state;
  }

  // 2. Extract components with fallback for varied key names
  let rawResidents: any[] = [];
  if (Array.isArray(root)) {
    // If the entire root is an array of residents
    rawResidents = root;
  } else if (Array.isArray(root.residents)) {
    rawResidents = root.residents;
  } else if (Array.isArray(root.warga)) {
    rawResidents = root.warga;
  } else if (Array.isArray(root.dataWarga)) {
    rawResidents = root.dataWarga;
  } else if (Array.isArray(root.residentHouses)) {
    rawResidents = root.residentHouses;
  } else if (root.mandor_residents_v5) {
    rawResidents = typeof root.mandor_residents_v5 === 'string'
      ? JSON.parse(root.mandor_residents_v5)
      : root.mandor_residents_v5;
  }

  let rawTransactions: any[] = [];
  if (Array.isArray(root.transactions)) {
    rawTransactions = root.transactions;
  } else if (Array.isArray(root.transaksi)) {
    rawTransactions = root.transaksi;
  } else if (Array.isArray(root.bukuKas)) {
    rawTransactions = root.bukuKas;
  } else if (Array.isArray(root.cashTransactions)) {
    rawTransactions = root.cashTransactions;
  } else if (root.mandor_transactions_v5) {
    rawTransactions = typeof root.mandor_transactions_v5 === 'string'
      ? JSON.parse(root.mandor_transactions_v5)
      : root.mandor_transactions_v5;
  }

  let rawBaksos: any[] = [];
  if (Array.isArray(root.baksosAgendas)) {
    rawBaksos = root.baksosAgendas;
  } else if (Array.isArray(root.baksos)) {
    rawBaksos = root.baksos;
  } else if (Array.isArray(root.agendas)) {
    rawBaksos = root.agendas;
  } else if (root.mandor_baksos_v5) {
    rawBaksos = typeof root.mandor_baksos_v5 === 'string'
      ? JSON.parse(root.mandor_baksos_v5)
      : root.mandor_baksos_v5;
  }

  let rawCommittees: any[] = [];
  if (Array.isArray(root.committees)) {
    rawCommittees = root.committees;
  } else if (Array.isArray(root.pengurus)) {
    rawCommittees = root.pengurus;
  } else if (root.mandor_committees_v5) {
    rawCommittees = typeof root.mandor_committees_v5 === 'string'
      ? JSON.parse(root.mandor_committees_v5)
      : root.mandor_committees_v5;
  }

  let rawAnnouncements: any[] = [];
  if (Array.isArray(root.announcements)) {
    rawAnnouncements = root.announcements;
  } else if (Array.isArray(root.pengumuman)) {
    rawAnnouncements = root.pengumuman;
  } else if (root.mandor_announcements_v5) {
    rawAnnouncements = typeof root.mandor_announcements_v5 === 'string'
      ? JSON.parse(root.mandor_announcements_v5)
      : root.mandor_announcements_v5;
  }

  const rawConfig = root.siteConfig || root.config || root.pengaturan || {};

  // Require at least residents or transactions or siteConfig
  if (
    rawResidents.length === 0 &&
    rawTransactions.length === 0 &&
    !root.siteConfig &&
    !root.config
  ) {
    return {
      success: false,
      error: 'File JSON tidak memuat data warga, transaksi, maupun pengaturan portal yang valid.',
    };
  }

  // 3. Normalize Residents
  const normalizedResidents: ResidentHouse[] = (rawResidents.length > 0 ? rawResidents : INITIAL_RESIDENTS).map(
    (item: any, idx: number) => {
      const id = String(item.id || `house-${idx + 1}-${Date.now().toString(36)}`);
      const blockNumber = String(item.blockNumber || item.blok || `K2/${25 + idx}`).trim();
      const headName = String(item.headName || item.namaKepalaKeluarga || item.nama || '-').trim();
      const occupancy = item.occupancy || (headName === '-' || headName.toLowerCase().includes('kosong') ? 'Kosong' : 'Ditempati');
      const isVacant = occupancy === 'Kosong' || isHouseVacant({ occupancy, headName });
      const rukem = isVacant ? 'Tidak Ikut' : (item.rukem || 'Ikut Rukem');

      const members = Array.isArray(item.members)
        ? item.members.map((m: any, mIdx: number) => ({
            id: String(m.id || `mem-${idx}-${mIdx}`),
            name: String(m.name || m.nama || headName),
            relation: m.relation || m.hubungan || (mIdx === 0 ? 'Kepala Keluarga' : 'Famili Lain'),
            birthPlace: String(m.birthPlace || m.tempatLahir || '-'),
            birthDate: String(m.birthDate || m.tanggalLahir || '1990-01-01'),
            gender: m.gender || m.jenisKelamin || 'Laki-laki',
            religion: m.religion || m.agama || 'Islam',
            occupation: m.occupation || m.pekerjaan || '',
          }))
        : [];

      return {
        id,
        blockNumber,
        headName,
        duesHeadNameOverride: item.duesHeadNameOverride ? String(item.duesHeadNameOverride).trim() : undefined,
        phone: String(item.phone || item.noHp || item.telepon || '-'),
        ownership: item.ownership || 'Milik Sendiri',
        occupancy,
        rukem,
        wifiStatus: item.wifiStatus || 'Tidak Pasang',
        wifiProvider: item.wifiProvider || '-',
        duesStatus: item.duesStatus || 'Belum Bayar',
        customDuesAmount: item.customDuesAmount !== undefined ? Number(item.customDuesAmount) || 0 : undefined,
        duesPaidAmount: Number(item.duesPaidAmount) || 0,
        duesPaidMonths: Number(item.duesPaidMonths) || (item.duesStatus === 'Lunas' || item.duesStatus === 'Bayar Lebih' ? 1 : 0),
        duesPrepaidBalance: Number(item.duesPrepaidBalance) || 0,
        duesPaidDate: item.duesPaidDate ? String(item.duesPaidDate) : '',
        duesMonthNote: item.duesMonthNote ? String(item.duesMonthNote) : undefined,
        previousArrears: Number(item.previousArrears) || 0,
        previousArrearsNote: item.previousArrearsNote ? String(item.previousArrearsNote).trim() : '',
        customBaksosFineAmount: item.customBaksosFineAmount !== undefined ? Number(item.customBaksosFineAmount) || 0 : undefined,
        members,
        updatedAt: item.updatedAt || new Date().toISOString(),
      };
    }
  );

  // 4. Normalize Transactions
  const normalizedTransactions: CashTransaction[] = (
    rawTransactions.length > 0 ? rawTransactions : INITIAL_TRANSACTIONS
  ).map((t: any, idx: number) => ({
    id: String(t.id || `tx-${idx + 1}-${Date.now().toString(36)}`),
    date: String(t.date || t.tanggal || new Date().toISOString().slice(0, 10)),
    type: t.type === 'keluar' || t.jenis === 'keluar' ? 'keluar' : 'masuk',
    pool:
      t.pool === 'Cashback WiFi' || t.pool === 'Cashback Sampah'
        ? t.pool
        : 'Kas Utama',
    category: t.category || t.kategori || 'Iuran Warga',
    description: String(t.description || t.keterangan || 'Transaksi Kas'),
    amount: Math.max(0, Number(t.amount || t.jumlah || t.nominal) || 0),
  }));

  // 5. Normalize Baksos Agendas
  const normalizedBaksos: BaksosAgenda[] = (
    rawBaksos.length > 0 ? rawBaksos : INITIAL_BAKSOS_AGENDAS
  ).map((a: any, idx: number) => ({
    id: String(a.id || `agenda-${idx + 1}`),
    title: String(a.title || a.judul || 'Agenda Baksos'),
    date: String(a.date || a.tanggal || new Date().toISOString().slice(0, 10)),
    location: String(a.location || a.lokasi || 'Lingkungan Gang Mandor'),
    description: String(a.description || a.keterangan || ''),
    fineAmount: Number(a.fineAmount) || 10000,
    attendance: (typeof a.attendance === 'object' && a.attendance !== null) ? a.attendance : {},
    finesPaid: (typeof a.finesPaid === 'object' && a.finesPaid !== null) ? a.finesPaid : {},
  }));

  // 6. Normalize Committees
  const normalizedCommittees: CommitteeContact[] = (
    rawCommittees.length > 0 ? rawCommittees : INITIAL_COMMITTEES
  ).map((c: any, idx: number) => ({
    id: String(c.id || `comm-${idx + 1}`),
    name: String(c.name || c.nama || 'Pengurus'),
    role: String(c.role || c.jabatan || 'Anggota'),
    phone: String(c.phone || c.noHp || '-'),
  }));

  // 7. Normalize Announcements
  const normalizedAnnouncements: Announcement[] = (
    rawAnnouncements.length > 0 ? rawAnnouncements : INITIAL_ANNOUNCEMENTS
  ).map((n: any, idx: number) => ({
    id: String(n.id || `ann-${idx + 1}`),
    title: String(n.title || n.judul || 'Pengumuman'),
    date: String(n.date || n.tanggal || new Date().toISOString().slice(0, 10)),
    content: String(n.content || n.isi || ''),
    priority: n.priority === 'darurat' || n.priority === 'penting' ? n.priority : 'normal',
  }));

  // 8. Normalize SiteConfig
  const normalizedConfig: SiteConfig = {
    ...INITIAL_SITE_CONFIG,
    ...rawConfig,
    navigationMenus:
      Array.isArray(rawConfig.navigationMenus) && rawConfig.navigationMenus.length > 0
        ? rawConfig.navigationMenus
        : INITIAL_NAV_MENUS,
    duesCurrentMonth: rawConfig.duesCurrentMonth || 'Oktober 2026',
    duesAmountPerMonth: Number(rawConfig.duesAmountPerMonth) || 50000,
    duesAvailablePeriods:
      Array.isArray(rawConfig.duesAvailablePeriods) && rawConfig.duesAvailablePeriods.length > 0
        ? rawConfig.duesAvailablePeriods
        : ['September 2026'],
  };

  const payload: PortalDatabasePayload = {
    version: 5,
    revision: Math.max(1, (Number(root.revision) || 0) + 1),
    isDefaultSeed: false,
    forceReset: true,
    updatedAt: new Date().toISOString(),
    updatedBy: 'Pemulihan File Cadangan JSON',
    siteConfig: normalizedConfig,
    residents: normalizedResidents,
    transactions: normalizedTransactions,
    baksosAgendas: normalizedBaksos,
    committees: normalizedCommittees,
    announcements: normalizedAnnouncements,
  };

  return {
    success: true,
    payload,
    stats: {
      residentsCount: normalizedResidents.length,
      transactionsCount: normalizedTransactions.length,
      agendasCount: normalizedBaksos.length,
      announcementsCount: normalizedAnnouncements.length,
      committeesCount: normalizedCommittees.length,
    },
  };
}

export function downloadBackupJsonFile(payload: PortalDatabasePayload): void {
  const dataStr = JSON.stringify(payload, null, 2);
  const blob = new Blob([dataStr], { type: 'application/json;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  const dateStamp = new Date().toISOString().slice(0, 10);
  a.href = url;
  a.download = `backup_online_warga_gang_mandor_${dateStamp}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
