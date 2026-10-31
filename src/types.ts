export type Gender = 'Laki-laki' | 'Perempuan';

export type Religion = 'Islam' | 'Kristen' | 'Katolik' | 'Hindu' | 'Buddha' | 'Konghucu';

export type FamilyRole = 'Kepala Keluarga' | 'Istri' | 'Anak' | 'Orang Tua' | 'Famili Lain';

export type OwnershipStatus = 'Milik Sendiri' | 'Kontrak' | 'Milik Orang Lain';

export type OccupancyStatus = 'Ditempati' | 'Belum Ditempati' | 'Dikontrakan' | 'Kosong';

export type RukemStatus = 'Ikut Rukem' | 'Tidak Ikut';

export type WifiStatus = 'Pasang' | 'Tidak Pasang';

export type DuesStatus = 'Lunas' | 'Bayar Lebih' | 'Belum Bayar';

export type BaksosAttendanceStatus = 'Hadir' | 'Tidak Hadir' | 'Tidak Wajib' | 'Kosong';

export interface FamilyMember {
  id: string;
  name: string;
  relation: FamilyRole;
  birthPlace: string;
  birthDate: string; // ISO YYYY-MM-DD
  gender: Gender;
  religion: Religion;
  occupation?: string;
}

export interface ResidentHouse {
  id: string;
  blockNumber: string; // e.g. "K2/25"
  headName: string;
  duesHeadNameOverride?: string; // Nama KK / Penanggung Jawab iuran & tunggakan (khusus rekap iuran tanpa mengubah database buku induk)
  phone: string;
  ownership: OwnershipStatus;
  occupancy: OccupancyStatus;
  rukem: RukemStatus;
  wifiStatus: WifiStatus;
  wifiProvider: string; // e.g. "Indihome", "Biznet", "MyRepublic", "-"
  duesStatus: DuesStatus; // Iuran kas/sampah bulan ini ('Lunas' | 'Bayar Lebih' | 'Belum Bayar')
  customDuesAmount?: number; // Nominal iuran kas khusus per rumah (Rp)
  duesPaidAmount?: number; // Nominal iuran bulan berjalan yang sudah dicicil/dibayar sebagian
  duesPaidMonths?: number; // Jumlah bulan yang dibayar sekaligus (1 = bulan berjalan, >1 = bayar lebih dari bulan berjalan)
  duesPrepaidBalance?: number; // Saldo lebih bayar / deposit kas untuk bulan berikutnya (Rp)
  duesPaidDate?: string; // Tanggal penerimaan iuran (YYYY-MM-DD)
  duesMonthNote?: string; // Keterangan bulan pada status iuran warga (misal: "Oktober - Desember 2026")
  previousArrears: number; // Tunggakan bulan / tahun sebelumnya (Rp)
  previousArrearsNote?: string; // Keterangan rincian tunggakan sebelumnya
  previousBaksosArrears?: number; // Tunggakan denda baksos bulan lalu / periode sebelumnya (Rp)
  previousBaksosArrearsNote?: string; // Keterangan denda baksos bulan lalu
  customBaksosFineAmount?: number; // Nominal denda baksos khusus/editan per rumah (Rp)
  occupancyHistory?: Record<string, OccupancyStatus>; // Riwayat status hunian per periode (contoh: '2026-05': 'Ditempati', '2026-09': 'Kosong')
  periodHistory?: Record<string, {
    occupancy?: OccupancyStatus;
    headName?: string;
    duesHeadNameOverride?: string;
    duesStatus?: DuesStatus;
    customDuesAmount?: number;
    updatedAt?: string;
  }>;
  members: FamilyMember[];
  updatedAt?: string;
}

export type TransactionCategory =
  | 'Kas Utama'
  | 'Cashback WiFi'
  | 'Cashback Sampah'
  | 'Iuran Warga'
  | 'Denda Baksos'
  | 'Pengeluaran Gang'
  | 'Pengeluaran Lingkungan'
  | 'Pengeluaran Cashback WiFi'
  | 'Pengeluaran Cashback Sampah'
  | 'Pembayaran Tunggakan';

export type TransactionType = 'masuk' | 'keluar';

export interface CashTransaction {
  id: string;
  date: string; // YYYY-MM-DD
  type: TransactionType;
  pool: 'Kas Utama' | 'Cashback WiFi' | 'Cashback Sampah';
  category: TransactionCategory;
  description: string;
  amount: number;
}

export interface BaksosAgenda {
  id: string;
  title: string;
  date: string;
  location: string;
  description: string;
  fineAmount?: number;
  // residentHouseId -> 'Hadir' | 'Tidak Hadir' | 'Tidak Wajib' | 'Kosong'
  attendance: Record<string, BaksosAttendanceStatus>;
  // residentHouseId -> boolean (whether the fine of 10.000 was paid)
  finesPaid?: Record<string, boolean>;
}

export interface Announcement {
  id: string;
  title: string;
  date: string;
  content: string;
  priority: 'normal' | 'penting' | 'darurat';
}

export interface CommitteeContact {
  id: string;
  name: string;
  role: string;
  phone: string;
}

export interface SubMenuItemConfig {
  id: string; // e.g. 'mutasi' | 'per_kk' or custom ID
  label: string; // Teks tombol/link submenu
  title: string; // Judul saat submenu aktif
  description: string; // Deskripsi submenu
  targetId?: string; // e.g. 'mutasi' | 'per_kk' | 'custom'
  content?: string; // Konten teks/informasi jika kustom
  icon?: string;
  isHidden?: boolean;
}

export interface MenuItemConfig {
  id: string; // e.g. 'pengumuman', 'dashboard', 'kas', 'baksos', 'warga', 'tunggakan', or 'custom-xxx'
  label: string; // Teks di navbar utama
  shortLabel?: string; // Teks pendek untuk HP
  title: string; // Judul halaman / seksi
  description: string; // Deskripsi halaman / seksi
  icon?: string; // nama icon (Megaphone, Users, Wallet, CheckCircle2, FileSpreadsheet, Bell, Sparkles, BookOpen, FileText, Info)
  colorScheme?: string; // e.g. 'emerald', 'cyan', 'teal', 'violet', 'amber', 'rose', 'indigo'
  isHidden?: boolean; // jika true, disembunyikan
  isCustom?: boolean; // jika true, menu dibuat oleh pengurus
  content?: string; // konten teks jika menu kustom
  subMenus?: SubMenuItemConfig[]; // daftar sub menu
}

export interface SiteConfig {
  brandName?: string;
  title: string;
  subtitle: string;
  description: string;
  navigationMenus?: MenuItemConfig[];
  announcementSectionTitle?: string;
  announcementSectionSubtitle?: string;
  dashboardSectionTitle?: string;
  dashboardSectionDescription?: string;
  cashSectionTitle?: string;
  cashDescription: string;
  wifiCashbackDescription: string;
  trashCashbackDescription: string;
  baksosSectionTitle?: string;
  baksosDescription: string;
  directorySectionTitle?: string;
  directorySectionDescription?: string;
  arrearsSectionTitle?: string;
  arrearsSectionDescription?: string;
  publicContactTitle?: string;
  publicContactDescription?: string;
  footerCopyrightText?: string;
  duesAmountPerMonth: number;
  duesCurrentMonth?: string;
  duesAvailablePeriods?: string[];
}

export interface PortalDatabasePayload {
  version: number;
  revision?: number;
  isDefaultSeed?: boolean;
  forceReset?: boolean;
  updatedAt: string;
  updatedBy?: string;
  clientId?: string;
  siteConfig: SiteConfig;
  residents: ResidentHouse[];
  transactions: CashTransaction[];
  baksosAgendas: BaksosAgenda[];
  committees: CommitteeContact[];
  announcements: Announcement[];
}


