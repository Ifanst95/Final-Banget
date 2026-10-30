import React, { useCallback, useMemo, useState } from 'react';
import confetti from 'canvas-confetti';
import {
  AlertTriangle,
  ArrowDownLeft,
  ArrowUpRight,
  BarChart3,
  Calendar,
  Check,
  CheckCircle2,
  Clock,
  Copy,
  Download,
  Edit2,
  Eye,
  FileSpreadsheet,
  FileText,
  LayoutGrid,
  MessageCircle,
  Plus,
  RotateCcw,
  Search,
  Share2,
  Sliders,
  Table,
  Trash2,
  TrendingUp,
  Users,
  Wallet,
  Wifi,
  X,
  Save,
  Coins,
  Lock,
  ShieldCheck,
  Image as LucideImage,
} from 'lucide-react';
import {
  BaksosAgenda,
  BaksosAttendanceStatus,
  CashTransaction,
  ResidentHouse,
  SiteConfig,
  TransactionCategory,
  TransactionType,
} from '../types';
import {
  INDONESIAN_MONTHS,
  calculatePreviousMonthBalanceSummary,
  formatDateDDMMYYYY,
  formatMonthYearFromKey,
  formatRupiah,
  getLastDayOfMonthISO,
  getMonthKeyFromDate,
  getPreviousMonthKey,
  getPreviousMonthLabel,
  getSubsequentMonthLabels,
  isHouseVacant,
  isPeriodCoveredInDuesNote,
  openWhatsAppShare,
  parseIndonesianMonthYearToKey,
} from '../utils/helpers';
import { exportFinancialReportToExcel } from '../utils/financialExcelExport';
import { generateCashbookImage } from '../utils/cashbookImageGenerator';
import { BalanceBreakdown } from '../hooks/useStorage';
import { DuesExcelUploadModal } from './DuesExcelUploadModal';

interface CashReportSectionProps {
  config: SiteConfig;
  transactions: CashTransaction[];
  residents: ResidentHouse[];
  baksosAgendas?: BaksosAgenda[];
  balances: BalanceBreakdown;
  isAdmin: boolean;
  mode?: 'all' | 'mutasi' | 'per_kk' | 'rekap_total_kk';
  onAddTransaction: (tx: Omit<CashTransaction, 'id'>) => void;
  onEditTransaction: (tx: CashTransaction) => void;
  onDeleteTransaction: (id: string) => void;
  onDeleteTransactions?: (ids: string[]) => void;
  onSyncHouseDuesEditAndTransactions?: (
    updatedHouse: ResidentHouse,
    newTransactions: Omit<CashTransaction, 'id'>[],
    oldTxIdsToDelete: string[],
    updatedBaksosAgendas?: BaksosAgenda[]
  ) => void;
  onResetSingleHousePaymentAndSync?: (
    houseId: string,
    periodLabel: string,
    unmarkBaksosFines?: boolean
  ) => void;
  onResetAllDuesPaymentsForPeriod?: (
    periodLabel: string,
    options?: {
      deleteDuesTransactions?: boolean;
      resetBaksosFines?: boolean;
      resetTunggakanTxs?: boolean;
    }
  ) => void;
  onAdjustBalance: (
    pool: 'Kas Utama' | 'Cashback WiFi' | 'Cashback Sampah',
    targetAmount: number,
    note: string,
    customDate?: string,
    currentPoolBalanceOverride?: number
  ) => void;
  onUpdateResident: (updated: ResidentHouse) => void;
  onMarkFinePaid?: (agendaId: string, residentId: string, houseName: string, blockNo: string) => void;
  onUnmarkFinePaid?: (agendaId: string, residentId: string) => void;
  onSetAttendance?: (agendaId: string, residentId: string, status: BaksosAttendanceStatus) => void;
  onUpdateBaksosAgenda?: (agenda: BaksosAgenda) => void;
  onOpenConfigModal: () => void;
  onSwitchMode?: (targetTab: string) => void;
  onCreatePeriod?: (
    newPeriodLabel: string,
    options?: { setActiveCurrentMonth?: boolean; resetNonAdvanceDues?: boolean }
  ) => void;
  onDeletePeriod?: (periodLabel: string) => void;
  onBatchImportDues?: (
    updatedResidents: ResidentHouse[],
    newTransactions: Omit<CashTransaction, 'id'>[],
    periodLabel?: string,
    setPeriodActive?: boolean
  ) => void;
  onSaveMayInitialBalance?: (
    kasAmount: number,
    wifiAmount: number,
    sampahAmount: number,
    note?: string
  ) => void;
  onSaveAprilInitialBalance?: (
    kasAmount: number,
    wifiAmount: number,
    sampahAmount: number,
    note?: string
  ) => void;
}

export interface PerKKRecapItem {
  house: ResidentHouse;
  isEmptyHouse: boolean;
  isAdvancePaid: boolean;
  isLunas: boolean;
  nominalPerMonth: number;
  paidMonthsCount: number;
  periodLabel: string;
  coveredMonths: string[];
  currentMonthPaid: number;
  prepaidDeposit: number;
  totalPaidAmount: number;
  currentMonthRemaining: number;
  previousArrears: number;
  baksosFineAmount: number;
  baksosPaidAmount?: number;
  unpaidBaksosCount: number;
  totalBillRemaining: number;
  historicalTxTotal: number;
  historicalTxCount: number;
}

export interface MonthlyTransactionGroup {
  monthKey: string;
  monthLabel: string;
  transactions: CashTransaction[];
  iuranInflow: number;
  wifiInflow: number;
  sampahInflow: number;
  dendaInflow: number;
  otherInflow: number;
  totalInflow: number;
  totalOutflow: number;
  netCashflow: number;
}

export const CashReportSection: React.FC<CashReportSectionProps> = ({
  config,
  transactions,
  residents,
  baksosAgendas = [],
  balances,
  isAdmin,
  mode = 'mutasi',
  onAddTransaction,
  onEditTransaction,
  onDeleteTransaction,
  onDeleteTransactions,
  onSyncHouseDuesEditAndTransactions,
  onResetSingleHousePaymentAndSync,
  onResetAllDuesPaymentsForPeriod,
  onAdjustBalance,
  onUpdateResident,
  onMarkFinePaid,
  onUnmarkFinePaid,
  onSetAttendance,
  onUpdateBaksosAgenda,
  onOpenConfigModal,
  onSwitchMode,
  onCreatePeriod,
  onDeletePeriod,
  onBatchImportDues,
  onSaveAprilInitialBalance,
  onSaveMayInitialBalance,
}) => {
  // Modal upload Excel Iuran
  const [isUploadDuesModalOpen, setIsUploadDuesModalOpen] = useState<boolean>(false);
  // Modal Edit Saldo Bulan Sebelumnya Periode Mei 2026 (Saldo Awal Inputan Baseline)
  const [isMayBalanceModalOpen, setIsMayBalanceModalOpen] = useState(false);
  const [editMayKas, setEditMayKas] = useState<number>(0);
  const [editMayWifi, setEditMayWifi] = useState<number>(0);
  const [editMaySampah, setEditMaySampah] = useState<number>(0);
  const [editMayNote, setEditMayNote] = useState<string>('Saldo Awal Inputan Periode Mei 2026');

  // Modal Hapus Total Semua Pembayaran (Batch Reset Periode yang berdampak ke Buku Kas)
  const [isResetAllModalOpen, setIsResetAllModalOpen] = useState(false);
  const [resetAllTargetPeriod, setResetAllTargetPeriod] = useState<string>('Oktober 2026');
  const [resetAllDeleteTxs, setResetAllDeleteTxs] = useState(true);
  const [resetAllResetBaksos, setResetAllResetBaksos] = useState(true);
  const [resetAllResetTunggakan, setResetAllResetTunggakan] = useState(false);

  // Modal / Konfirmasi Hapus Pembayaran 1 KK
  const [deletingSingleHouse, setDeletingSingleHouse] = useState<{
    house: ResidentHouse;
    period: string;
  } | null>(null);

  // Unified Sub-tab selection: 'mutasi' (1. Buku Kas), 'per_kk' (2. Rekap Iuran Per KK), 'rekap_total_kk' (3. Rekap Keseluruhan Kas Per KK - Khusus Pengurus)
  const [currentSubTab, setCurrentSubTab] = useState<'mutasi' | 'per_kk' | 'rekap_total_kk'>(
    isAdmin && mode === 'rekap_total_kk' ? 'rekap_total_kk' : mode === 'per_kk' ? 'per_kk' : 'mutasi'
  );

  React.useEffect(() => {
    if (!isAdmin && currentSubTab === 'rekap_total_kk') {
      setCurrentSubTab('mutasi');
      return;
    }
    if (mode === 'rekap_total_kk') {
      setCurrentSubTab(isAdmin ? 'rekap_total_kk' : 'mutasi');
    } else if (mode === 'per_kk') {
      setCurrentSubTab('per_kk');
    } else if (mode === 'mutasi') {
      setCurrentSubTab('mutasi');
    }
  }, [mode, isAdmin, currentSubTab]);

  // State untuk Poin 3: Rekap Keseluruhan Kas Per KK (Gabungan Semua Periode)
  const [filterOverallStatus, setFilterOverallStatus] = useState<
    'semua' | 'Lunas Semua' | 'Bayar Lebih' | 'Ada Tunggakan' | 'Kosong'
  >('semua');
  const [searchOverall, setSearchOverall] = useState<string>('');
  const [selectedDetailHouse, setSelectedDetailHouse] = useState<ResidentHouse | null>(null);

  const defaultMonthLabel = config.duesCurrentMonth || 'September 2026';
  const defaultMonthKey = parseIndonesianMonthYearToKey(defaultMonthLabel) || '2026-09';

  // Filters for Buku Kas Keluar Masuk
  const [filterPool, setFilterPool] = useState<string>('semua');
  // Di tampilan warga (!isAdmin), sembunyikan filter dan pastikan filter transaksi selalu 'semua'
  React.useEffect(() => {
    if (!isAdmin && filterPool !== 'semua') {
      setFilterPool('semua');
    }
  }, [isAdmin, filterPool]);
  // Inisialisasi periode awal ke bulan berjalan aktif agar kartu dan tabel saldo bulan sebelumnya langsung mengambil data dari bulan sebelumnya
  const [selectedTxMonth, setSelectedTxMonth] = useState<string>(() => defaultMonthKey);
  const [searchTx, setSearchTx] = useState<string>('');

  React.useEffect(() => {
    if (selectedTxMonth === 'semua') {
      setSelectedTxMonth(defaultMonthKey);
    }
  }, [selectedTxMonth, defaultMonthKey]);

  const [isPeriodModalOpen, setIsPeriodModalOpen] = useState(false);
  const [periodModalTab, setPeriodModalTab] = useState<'tambah' | 'hapus'>('tambah');
  const [newPeriodMonthIndex, setNewPeriodMonthIndex] = useState<number>(new Date().getMonth());
  const [newPeriodYearInput, setNewPeriodYearInput] = useState<number>(new Date().getFullYear());
  const [setAsActiveMonthInput, setSetAsActiveMonthInput] = useState(true);
  const [resetNonAdvanceDuesInput, setResetNonAdvanceDuesInput] = useState(true);
  const [deletePeriodSelect, setDeletePeriodSelect] = useState<string>('');
  const [deletePeriodConfirmText, setDeletePeriodConfirmText] = useState<string>('');

  // Filters for Kas Per KK
  const [selectedKKPeriod, setSelectedKKPeriod] = useState<string>(defaultMonthLabel);
  const [duesFilter, setDuesFilter] = useState<'semua' | 'Lunas' | 'Bayar Lebih' | 'Belum Bayar'>('semua');
  const [searchKK, setSearchKK] = useState<string>('');

  // Modals state
  const [isTxModalOpen, setIsTxModalOpen] = useState(false);
  const [editingTx, setEditingTx] = useState<CashTransaction | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  // Per KK edit modal state
  const [editingHouseDues, setEditingHouseDues] = useState<ResidentHouse | null>(null);
  const [houseDuesOccupancyInput, setHouseDuesOccupancyInput] = useState<ResidentHouse['occupancy']>('Ditempati');
  const [houseDuesHeadNameInput, setHouseDuesHeadNameInput] = useState<string>('');
  const [houseDuesAmountInput, setHouseDuesAmountInput] = useState<number>(50000);
  const [houseDuesStatusInput, setHouseDuesStatusInput] = useState<'Lunas' | 'Bayar Lebih' | 'Belum Bayar'>('Lunas');
  const [houseDuesPaidMonthsInput, setHouseDuesPaidMonthsInput] = useState<number>(1);
  const [houseDuesUpcomingMonths, setHouseDuesUpcomingMonths] = useState<string[]>([]);
  const [houseDuesTotalReceivedInput, setHouseDuesTotalReceivedInput] = useState<number>(50000);
  const [houseDuesPartialInput, setHouseDuesPartialInput] = useState<number>(0);
  const [houseDuesPrevArrearsInput, setHouseDuesPrevArrearsInput] = useState<number>(0);
  const [houseDuesPrevNoteInput, setHouseDuesPrevNoteInput] = useState<string>('');
  const [houseDuesPaidDateInput, setHouseDuesPaidDateInput] = useState<string>(
    new Date().toISOString().slice(0, 10)
  );
  const [houseDuesMonthInput, setHouseDuesMonthInput] = useState<string>(defaultMonthLabel);
  const [houseDuesCustomNoteInput, setHouseDuesCustomNoteInput] = useState<string>('');

  // Tab & Field state for editing Denda Baksos & Pembayaran Tunggakan
  const [editingHouseDuesTab, setEditingHouseDuesTab] = useState<'all' | 'iuran' | 'baksos' | 'tunggakan'>('all');
  const [houseDuesBaksosStatusInput, setHouseDuesBaksosStatusInput] = useState<'Bebas' | 'Lunas' | 'Belum Bayar' | 'Hadir' | 'Tidak Wajib'>('Bebas');
  const [houseDuesBaksosAmountInput, setHouseDuesBaksosAmountInput] = useState<number>(10000);
  const [houseDuesBaksosDateInput, setHouseDuesBaksosDateInput] = useState<string>('');
  const [houseDuesBaksosNoteInput, setHouseDuesBaksosNoteInput] = useState<string>('');

  const [houseDuesTunggakanPaidInput, setHouseDuesTunggakanPaidInput] = useState<number>(0);
  const [houseDuesTunggakanDateInput, setHouseDuesTunggakanDateInput] = useState<string>('');
  const [houseDuesTunggakanNoteInput, setHouseDuesTunggakanNoteInput] = useState<string>('');
  const [houseDuesAutoDeductArrears, setHouseDuesAutoDeductArrears] = useState<boolean>(true);
  const [preserveExistingDues, setPreserveExistingDues] = useState<boolean>(true);

  // Transaction form state
  const [txDate, setTxDate] = useState(new Date().toISOString().slice(0, 10));
  const [txType, setTxType] = useState<TransactionType>('masuk');
  const [txPool, setTxPool] = useState<'Kas Utama' | 'Cashback WiFi' | 'Cashback Sampah'>('Kas Utama');
  const [txCategory, setTxCategory] = useState<TransactionCategory>('Iuran Warga');
  const [txDescription, setTxDescription] = useState('');
  const [txAmount, setTxAmount] = useState<number | ''>('');
  const [txResidentId, setTxResidentId] = useState<string>('');
  const [txIuranMonths, setTxIuranMonths] = useState<number>(1);
  const [txIuranStartMonth, setTxIuranStartMonth] = useState<string>(defaultMonthLabel);
  const [txCustomNote, setTxCustomNote] = useState<string>('');

  // Balance adjustment modal
  const [isAdjustModalOpen, setIsAdjustModalOpen] = useState(false);
  const [adjustTargetKas, setAdjustTargetKas] = useState<number>(balances.kasUtama);
  const [adjustTargetWifi, setAdjustTargetWifi] = useState<number>(balances.wifiCashback);
  const [adjustTargetSampah, setAdjustTargetSampah] = useState<number>(balances.sampahCashback);
  const [adjustReason, setAdjustReason] = useState('Rekonsiliasi / Opname Kas Fisik');

  // WhatsApp share modal
  const [isWaModalOpen, setIsWaModalOpen] = useState<boolean>(false);
  const [waRecapMode, setWaRecapMode] = useState<
    'gambar_kas' | 'keluar_masuk' | 'iuran_kk' | 'rekap_total_kk'
  >('gambar_kas');
  const [copiedWaText, setCopiedWaText] = useState<boolean>(false);
  const [waCustomText, setWaCustomText] = useState<string>('');
  const [waImageDataUrl, setWaImageDataUrl] = useState<string | null>(null);
  const [waImageBlob, setWaImageBlob] = useState<Blob | null>(null);
  const [isGeneratingImage, setIsGeneratingImage] = useState<boolean>(false);
  const [copiedWaImage, setCopiedWaImage] = useState<boolean>(false);

  const handleOpenMayBalanceModal = () => {
    const mayKasTx = transactions.find(
      (t) =>
        t.id === 'tx-init-mei-kas' ||
        t.id === 'tx-init-april-kas' ||
        ((t.date === '2026-04-30' || t.date === '2026-03-31') &&
          t.pool === 'Kas Utama' &&
          (t.description.toLowerCase().includes('mei') || t.description.toLowerCase().includes('april')))
    );
    const mayWifiTx = transactions.find(
      (t) =>
        t.id === 'tx-init-mei-wifi' ||
        t.id === 'tx-init-april-wifi' ||
        ((t.date === '2026-04-30' || t.date === '2026-03-31') &&
          t.pool === 'Cashback WiFi' &&
          (t.description.toLowerCase().includes('mei') || t.description.toLowerCase().includes('april')))
    );
    const maySampahTx = transactions.find(
      (t) =>
        t.id === 'tx-init-mei-sampah' ||
        t.id === 'tx-init-april-sampah' ||
        ((t.date === '2026-04-30' || t.date === '2026-03-31') &&
          t.pool === 'Cashback Sampah' &&
          (t.description.toLowerCase().includes('mei') || t.description.toLowerCase().includes('april')))
    );

    setEditMayKas(
      mayKasTx
        ? mayKasTx.type === 'masuk'
          ? mayKasTx.amount
          : -mayKasTx.amount
        : prevMonthSummary.kasUtama || 0
    );
    setEditMayWifi(
      mayWifiTx
        ? mayWifiTx.type === 'masuk'
          ? mayWifiTx.amount
          : -mayWifiTx.amount
        : prevMonthSummary.wifiCashback || 0
    );
    setEditMaySampah(
      maySampahTx
        ? maySampahTx.type === 'masuk'
          ? maySampahTx.amount
          : -maySampahTx.amount
        : prevMonthSummary.sampahCashback || 0
    );
    setEditMayNote(mayKasTx?.description || 'Saldo Awal Inputan Periode Mei 2026');
    setIsMayBalanceModalOpen(true);
  };

  const handleOpenAprilBalanceModal = handleOpenMayBalanceModal;

  const handleSaveMayInitialForm = (e: React.FormEvent) => {
    e.preventDefault();
    const saveFn = onSaveMayInitialBalance || onSaveAprilInitialBalance;
    if (saveFn) {
      saveFn(editMayKas, editMayWifi, editMaySampah, editMayNote);
    } else {
      // Fallback directly to onAddTransaction
      onAddTransaction({
        date: '2026-04-30',
        type: editMayKas >= 0 ? 'masuk' : 'keluar',
        pool: 'Kas Utama',
        category: 'Kas Utama',
        description: editMayNote || 'Saldo Awal Kas Utama Bulan Sebelumnya (Periode Mei 2026)',
        amount: Math.abs(editMayKas),
      });
    }
    try {
      confetti({ particleCount: 40, spread: 50, origin: { y: 0.6 } });
    } catch {}
    setIsMayBalanceModalOpen(false);
  };

  const handleSaveAprilInitialForm = handleSaveMayInitialForm;

  const getHouseDuesNominal = (house: ResidentHouse) =>
    house.customDuesAmount !== undefined
      ? house.customDuesAmount
      : config.duesAmountPerMonth || 50000;

  const getHousePeriodLabel = (house: ResidentHouse) =>
    (house.duesMonthNote && house.duesMonthNote.trim()) || defaultMonthLabel;

  // Helper to test if a transaction is related to Iuran or Tunggakan
  const isIuranOrTunggakanTx = (tx: CashTransaction) => {
    if (tx.type !== 'masuk') return false;
    const cat = tx.category || '';
    const desc = (tx.description || '').toLowerCase();
    return (
      cat === 'Iuran Warga' ||
      cat === 'Pembayaran Tunggakan' ||
      desc.includes('tunggakan') ||
      (!cat.includes('Pengeluaran') && (cat.toLowerCase().includes('iuran') || desc.includes('iuran')))
    );
  };

  const isPureIuranTx = (tx: CashTransaction) => {
    if (tx.type !== 'masuk') return false;
    const cat = tx.category || '';
    const desc = (tx.description || '').toLowerCase();
    if (cat === 'Pembayaran Tunggakan' || desc.includes('tunggakan')) return false;
    if (cat === 'Denda Baksos' || desc.includes('denda')) return false;
    if (
      cat.includes('Cashback') ||
      desc.includes('cashback') ||
      tx.pool === 'Cashback WiFi' ||
      tx.pool === 'Cashback Sampah'
    ) {
      return false;
    }
    return cat === 'Iuran Warga' || desc.includes('iuran');
  };

  const isTunggakanTx = (tx: CashTransaction) => {
    if (tx.type !== 'masuk') return false;
    const cat = tx.category || '';
    const desc = (tx.description || '').toLowerCase();
    return cat === 'Pembayaran Tunggakan' || desc.includes('tunggakan');
  };

  // List of available periods
  const availablePeriods = useMemo<string[]>(() => {
    const list =
      config.duesAvailablePeriods && config.duesAvailablePeriods.length > 0
        ? config.duesAvailablePeriods
        : [config.duesCurrentMonth || 'September 2026', 'Agustus 2026'];
    const txMonths = transactions.map((t) => formatMonthYearFromKey(getMonthKeyFromDate(t.date)));
    return Array.from(new Set([...list, ...txMonths])).filter(Boolean);
  }, [config.duesAvailablePeriods, config.duesCurrentMonth, transactions]);

  // Group all transactions by month (termasuk periode aktif terdaftar)
  const allMonthlyCashflowGroups = useMemo<MonthlyTransactionGroup[]>(() => {
    const map: Record<string, MonthlyTransactionGroup> = {};

    // Inisialisasi seluruh periode yang terdaftar (termasuk bulan berjalan yang belum ada mutasi)
    availablePeriods.forEach((periodLabel) => {
      const pKey = parseIndonesianMonthYearToKey(periodLabel);
      if (pKey && pKey !== '2026-04' && !map[pKey]) {
        map[pKey] = {
          monthKey: pKey,
          monthLabel: formatMonthYearFromKey(pKey),
          transactions: [],
          iuranInflow: 0,
          wifiInflow: 0,
          sampahInflow: 0,
          dendaInflow: 0,
          otherInflow: 0,
          totalInflow: 0,
          totalOutflow: 0,
          netCashflow: 0,
        };
      }
    });

    transactions.forEach((tx) => {
      const mKey = getMonthKeyFromDate(tx.date);
      if (!mKey || mKey === '0000-00') return;
      if (!map[mKey]) {
        map[mKey] = {
          monthKey: mKey,
          monthLabel: formatMonthYearFromKey(mKey),
          transactions: [],
          iuranInflow: 0,
          wifiInflow: 0,
          sampahInflow: 0,
          dendaInflow: 0,
          otherInflow: 0,
          totalInflow: 0,
          totalOutflow: 0,
          netCashflow: 0,
        };
      }
      const g = map[mKey];
      g.transactions.push(tx);
      const cat = tx.category || '';
      if (tx.type === 'masuk') {
        g.totalInflow += tx.amount;
        if (cat === 'Iuran Warga' || cat === 'Pembayaran Tunggakan') {
          g.iuranInflow += tx.amount;
        } else if (
          cat === 'Cashback WiFi' ||
          (tx.pool === 'Cashback WiFi' && cat !== 'Pengeluaran Gang' && cat !== 'Pengeluaran Lingkungan')
        ) {
          g.wifiInflow += tx.amount;
        } else if (
          cat === 'Cashback Sampah' ||
          (tx.pool === 'Cashback Sampah' && cat !== 'Pengeluaran Gang' && cat !== 'Pengeluaran Lingkungan')
        ) {
          g.sampahInflow += tx.amount;
        } else if (cat === 'Denda Baksos') {
          g.dendaInflow += tx.amount;
        } else {
          g.otherInflow += tx.amount;
        }
      } else {
        g.totalOutflow += tx.amount;
      }
      g.netCashflow = g.totalInflow - g.totalOutflow;
    });

    return Object.values(map)
      .filter((g) => g.monthKey !== '2026-04') // Sembunyikan April karena April adalah tanggal penyimpanan baseline
      .sort((a, b) => b.monthKey.localeCompare(a.monthKey))
      .map((g) => ({
        ...g,
        transactions: [...g.transactions].sort((a, b) => a.date.localeCompare(b.date)),
      }));
  }, [availablePeriods, transactions]);


  // Effective month key: Warga dan Pengurus keduanya dapat melihat Semua Periode maupun per bulan
  const effectiveMonthKey = selectedTxMonth;

  // Filtered transactions for display (Urutkan dari tanggal awal / ascending)
  const filteredTransactions = useMemo(() => {
    return transactions
      .filter((tx) => {
        const cat = tx.category || '';
        const isIuran = tx.type === 'masuk' && (cat === 'Iuran Warga' || cat === 'Pembayaran Tunggakan');
        const isDenda = tx.type === 'masuk' && cat === 'Denda Baksos';
        const isWifiPool =
          cat === 'Cashback WiFi' ||
          cat === 'Pengeluaran Cashback WiFi' ||
          (tx.pool === 'Cashback WiFi' &&
            cat !== 'Pengeluaran Gang' &&
            cat !== 'Pengeluaran Lingkungan' &&
            cat !== 'Kas Utama');
        const isSampahPool =
          cat === 'Cashback Sampah' ||
          cat === 'Pengeluaran Cashback Sampah' ||
          (tx.pool === 'Cashback Sampah' &&
            cat !== 'Pengeluaran Gang' &&
            cat !== 'Pengeluaran Lingkungan' &&
            cat !== 'Kas Utama');
        const isCashbackPool = isWifiPool || isSampahPool;

        const isKasUtamaCategory =
          cat === 'Kas Utama' ||
          cat === 'Pengeluaran Gang' ||
          cat === 'Pengeluaran Lingkungan' ||
          cat === 'Iuran Warga' ||
          cat === 'Denda Baksos' ||
          cat === 'Pembayaran Tunggakan';

        const matchPool =
          filterPool === 'semua'
            ? true
            : filterPool === 'masuk'
            ? tx.type === 'masuk'
            : filterPool === 'keluar'
            ? tx.type === 'keluar'
            : filterPool === 'Iuran Warga'
            ? isIuran
            : filterPool === 'Denda Baksos'
            ? isDenda
            : filterPool === 'Pengeluaran Gang'
            ? cat === 'Pengeluaran Gang'
            : filterPool === 'Pengeluaran Lingkungan'
            ? cat === 'Pengeluaran Lingkungan'
            : filterPool === 'Kas Utama'
            ? (isKasUtamaCategory || tx.pool === 'Kas Utama' || !isCashbackPool)
            : filterPool === 'Cashback WiFi'
            ? isWifiPool
            : filterPool === 'Cashback Sampah'
            ? isSampahPool
            : filterPool === 'Cashback'
            ? isCashbackPool
            : tx.pool === filterPool;

        const mKey = getMonthKeyFromDate(tx.date);
        const matchMonth = effectiveMonthKey === 'semua' ? true : mKey === effectiveMonthKey;

        const matchSearch =
          !searchTx.trim() ||
          tx.description.toLowerCase().includes(searchTx.toLowerCase()) ||
          tx.category.toLowerCase().includes(searchTx.toLowerCase()) ||
          tx.pool.toLowerCase().includes(searchTx.toLowerCase()) ||
          formatMonthYearFromKey(mKey).toLowerCase().includes(searchTx.toLowerCase());

        return matchPool && matchMonth && matchSearch;
      })
      .sort((a, b) => {
        // Urutkan dari tanggal awal (ascending: tanggal 1, 2, 3...)
        const dateCmp = a.date.localeCompare(b.date);
        if (dateCmp !== 0) return dateCmp;
        // Pemasukan dulu baru pengeluaran
        if (a.type !== b.type) {
          return a.type === 'masuk' ? -1 : 1;
        }
        return a.description.localeCompare(b.description);
      });
  }, [transactions, filterPool, effectiveMonthKey, searchTx]);

  // Period summary calculations
  const periodSummary = useMemo(() => {
    let totalInflow = 0;
    let totalOutflow = 0;
    let iuranInflow = 0;
    let wifiInflow = 0;
    let sampahInflow = 0;
    let dendaInflow = 0;
    let otherInflow = 0;

    filteredTransactions.forEach((tx) => {
      const cat = tx.category || '';
      if (tx.type === 'masuk') {
        totalInflow += tx.amount;
        if (cat === 'Iuran Warga' || cat === 'Pembayaran Tunggakan') {
          iuranInflow += tx.amount;
        } else if (
          cat === 'Cashback WiFi' ||
          (tx.pool === 'Cashback WiFi' && cat !== 'Pengeluaran Gang' && cat !== 'Pengeluaran Lingkungan')
        ) {
          wifiInflow += tx.amount;
        } else if (
          cat === 'Cashback Sampah' ||
          (tx.pool === 'Cashback Sampah' && cat !== 'Pengeluaran Gang' && cat !== 'Pengeluaran Lingkungan')
        ) {
          sampahInflow += tx.amount;
        } else if (cat === 'Denda Baksos') {
          dendaInflow += tx.amount;
        } else {
          otherInflow += tx.amount;
        }
      } else {
        totalOutflow += tx.amount;
      }
    });

    return {
      totalInflow,
      totalOutflow,
      netCashflow: totalInflow - totalOutflow,
      iuranInflow,
      wifiInflow,
      sampahInflow,
      dendaInflow,
      otherInflow,
      count: filteredTransactions.length,
    };
  }, [filteredTransactions]);

  // Previous month balance summary (Mengambil data akumulasi s/d akhir bulan sebelumnya)
  const prevMonthSummary = useMemo(() => {
    return calculatePreviousMonthBalanceSummary(transactions, effectiveMonthKey);
  }, [transactions, effectiveMonthKey]);


  // Separate breakdown: Kas Utama vs Cashback (WiFi & Sampah)
  const breakdownSummary = useMemo(() => {
    let kasUtamaIn = 0;
    let cashbackIn = 0;
    let kasUtamaOut = 0;
    let cashbackOut = 0;

    filteredTransactions.forEach((tx) => {
      const cat = tx.category || '';
      const isCashback =
        cat === 'Cashback WiFi' ||
        cat === 'Cashback Sampah' ||
        cat === 'Pengeluaran Cashback WiFi' ||
        cat === 'Pengeluaran Cashback Sampah' ||
        ((tx.pool === 'Cashback WiFi' || tx.pool === 'Cashback Sampah') &&
          cat !== 'Pengeluaran Gang' &&
          cat !== 'Pengeluaran Lingkungan' &&
          cat !== 'Kas Utama');

      if (tx.type === 'masuk') {
        if (isCashback) {
          cashbackIn += tx.amount;
        } else {
          kasUtamaIn += tx.amount;
        }
      } else {
        if (isCashback) {
          cashbackOut += tx.amount;
        } else {
          kasUtamaOut += tx.amount;
        }
      }
    });

    return {
      kasUtamaIn,
      cashbackIn,
      kasUtamaOut,
      cashbackOut,
      totalIn: kasUtamaIn + cashbackIn,
      totalOut: kasUtamaOut + cashbackOut,
      netKasUtama: kasUtamaIn - kasUtamaOut,
      netCashback: cashbackIn - cashbackOut,
      netTotal: (kasUtamaIn + cashbackIn) - (kasUtamaOut + cashbackOut),
    };
  }, [filteredTransactions]);

  // Detailed classification for each transaction in the Buku Kas table
  const classifiedTransactions = useMemo(() => {
    let runningKasUtama = prevMonthSummary.kasUtama;
    let runningWifi = prevMonthSummary.wifiCashback;
    let runningSampah = prevMonthSummary.sampahCashback;
    let runningTotal = prevMonthSummary.total;

    return filteredTransactions.map((tx, idx) => {
      const isMasuk = tx.type === 'masuk';
      const cat = tx.category || '';

      // Check if it's Tunggakan
      const isTunggakan =
        isMasuk &&
        (cat === 'Pembayaran Tunggakan' ||
          cat.toLowerCase().includes('tunggakan') ||
          (tx.description || '').toLowerCase().includes('tunggakan'));

      // Check if it's Denda Baksos
      const isDenda = isMasuk && (cat === 'Denda Baksos' || (tx.description || '').toLowerCase().includes('denda'));

      // Check if it's Iuran Warga
      const isIuran =
        isMasuk &&
        !isTunggakan &&
        !isDenda &&
        (cat === 'Iuran Warga' ||
          (!cat.includes('Pengeluaran') &&
            (cat.toLowerCase().includes('iuran') || (tx.description || '').toLowerCase().includes('iuran'))));

      // Check WiFi vs Sampah
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

      let masukIuran = 0;
      let masukDenda = 0;
      let masukTunggakan = 0;
      let masukKasLain = 0;
      let masukWifi = 0;
      let masukSampah = 0;
      let keluarKasUtama = 0;
      let keluarWifi = 0;
      let keluarSampah = 0;
      let subCategoryLabel = '';

      if (isMasuk) {
        if (isWifi) {
          masukWifi = tx.amount;
          runningWifi += tx.amount;
          subCategoryLabel = 'Cashback WiFi';
        } else if (isSampah) {
          masukSampah = tx.amount;
          runningSampah += tx.amount;
          subCategoryLabel = 'Cashback Sampah';
        } else if (isTunggakan) {
          masukTunggakan = tx.amount;
          runningKasUtama += tx.amount;
          subCategoryLabel = 'Pembayaran Tunggakan';
        } else if (isDenda) {
          masukDenda = tx.amount;
          runningKasUtama += tx.amount;
          subCategoryLabel = 'Denda Baksos';
        } else if (isIuran) {
          masukIuran = tx.amount;
          runningKasUtama += tx.amount;
          subCategoryLabel = 'Iuran Warga';
        } else {
          masukKasLain = tx.amount;
          runningKasUtama += tx.amount;
          subCategoryLabel = cat || 'Kas Utama';
        }
        runningTotal += tx.amount;
      } else {
        if (isWifi) {
          keluarWifi = tx.amount;
          runningWifi -= tx.amount;
          subCategoryLabel = 'Pengeluaran Cashback WiFi';
        } else if (isSampah) {
          keluarSampah = tx.amount;
          runningSampah -= tx.amount;
          subCategoryLabel = 'Pengeluaran Cashback Sampah';
        } else {
          keluarKasUtama = tx.amount;
          runningKasUtama -= tx.amount;
          subCategoryLabel = cat || 'Pengeluaran Gang';
        }
        runningTotal -= tx.amount;
      }

      return {
        tx,
        idx,
        isMasuk,
        isIuran,
        isDenda,
        isTunggakan,
        isWifi,
        isSampah,
        masukIuran,
        masukDenda,
        masukTunggakan,
        masukKasLain,
        masukKasUtama: masukIuran + masukDenda + masukTunggakan + masukKasLain,
        masukWifi,
        masukSampah,
        masukCashback: masukWifi + masukSampah,
        keluarKasUtama,
        keluarWifi,
        keluarSampah,
        keluarCashback: keluarWifi + keluarSampah,
        subCategoryLabel,
        runningKasUtama,
        runningWifi,
        runningSampah,
        runningCashback: runningWifi + runningSampah,
        runningTotal,
      };
    });
  }, [filteredTransactions, prevMonthSummary]);

  // Per KK recap list
  const perKKRecapList = useMemo<PerKKRecapItem[]>(() => {
    return residents.map((house) => {
      const isPureKosong = house.occupancy === 'Kosong' || isHouseVacant(house);
      const isUnoccupied = house.occupancy === 'Belum Ditempati';
      const isAdvancePaid = house.duesStatus === 'Bayar Lebih';
      const isLunas = house.duesStatus === 'Lunas' || isAdvancePaid;
      const defaultNominal = getHouseDuesNominal(house) || config.duesAmountPerMonth || 25000;
      const hasAnyPaid = isLunas || (house.duesPaidAmount || 0) > 0;
      // Rumah kosong default tidak wajib iuran (0 tagihan), namun jika ada pembayaran, perlakukan sesuai standar
      const isEmptyHouse = isPureKosong || (isUnoccupied && !hasAnyPaid);
      const nominalPerMonth = isPureKosong && !hasAnyPaid ? 0 : defaultNominal;
      const paidMonthsCount = isEmptyHouse
        ? isAdvancePaid
          ? Math.max(2, house.duesPaidMonths || 2)
          : isLunas
          ? 1
          : 0
        : isAdvancePaid
        ? Math.max(2, house.duesPaidMonths || 2)
        : isLunas
        ? 1
        : 0;
      const periodLabel = getHousePeriodLabel(house);
      const coveredMonths = isLunas
        ? house.duesMonthNote
          ? house.duesMonthNote.split(/[,;/+]+/).map((s) => s.trim()).filter(Boolean)
          : [periodLabel]
        : [];

      const currentMonthPaid = isLunas
        ? nominalPerMonth
        : isEmptyHouse
        ? 0
        : house.duesPaidAmount || 0;
      const prepaidDeposit = isAdvancePaid
        ? house.duesPrepaidBalance || nominalPerMonth * Math.max(0, paidMonthsCount - 1)
        : 0;
      const totalPaidAmount = currentMonthPaid + prepaidDeposit;
      const currentMonthRemaining = isEmptyHouse
        ? 0 // Rumah kosong otomatis bebas tagihan / tidak menunggak
        : isLunas
        ? 0
        : Math.max(0, nominalPerMonth - currentMonthPaid);

      // Hitung Denda Baksos dari agenda & customBaksosFineAmount
      const isContract = house.ownership === 'Kontrak' || house.occupancy === 'Dikontrakan';
      const unpaidBaksosList = baksosAgendas.filter((agenda) => {
        const attendance =
          agenda.attendance?.[house.id] ||
          (house.occupancy === 'Kosong' ? 'Kosong' : isContract ? 'Tidak Wajib' : 'Hadir');
        const isFinePaid = agenda.finesPaid?.[house.id];
        return attendance === 'Tidak Hadir' && !isFinePaid;
      });
      const calculatedBaksosFine = isEmptyHouse ? 0 : unpaidBaksosList.length * 10000;
      const baksosFineAmount =
        house.customBaksosFineAmount !== undefined
          ? house.customBaksosFineAmount
          : calculatedBaksosFine;

      const previousArrears = isEmptyHouse ? 0 : house.previousArrears || 0;
      const totalBillRemaining = currentMonthRemaining + previousArrears + baksosFineAmount;

      // Hitung Pembayaran Denda Baksos yang sudah lunas
      const paidBaksosList = baksosAgendas.filter((agenda) => {
        const attendance = agenda.attendance?.[house.id];
        const isFinePaid = agenda.finesPaid?.[house.id];
        return attendance === 'Tidak Hadir' && Boolean(isFinePaid);
      });
      const baksosAgendasPaidFine = paidBaksosList.reduce((sum, a) => sum + (a.fineAmount || 10000), 0);

      const blockRegex = new RegExp(`\\b${house.blockNumber.replace('/', '\\/')}\\b`, 'i');
      const baksosTxs = transactions.filter(
        (tx) => tx.type === 'masuk' && (tx.category === 'Denda Baksos' || tx.description.toLowerCase().includes('denda baksos')) && blockRegex.test(tx.description)
      );
      const baksosTxPaidFine = baksosTxs.reduce((sum, t) => sum + t.amount, 0);
      const baksosPaidAmount = Math.max(baksosAgendasPaidFine, baksosTxPaidFine);

      const houseTxs = transactions.filter(
        (tx) => tx.type === 'masuk' && isIuranOrTunggakanTx(tx) && blockRegex.test(tx.description)
      );
      const historicalTxTotal = houseTxs.reduce((s, t) => s + t.amount, 0);

      return {
        house,
        isEmptyHouse,
        isAdvancePaid,
        isLunas,
        nominalPerMonth,
        paidMonthsCount,
        periodLabel,
        coveredMonths,
        currentMonthPaid,
        prepaidDeposit,
        totalPaidAmount,
        currentMonthRemaining,
        previousArrears,
        baksosFineAmount,
        baksosPaidAmount,
        unpaidBaksosCount: unpaidBaksosList.length,
        totalBillRemaining,
        historicalTxTotal,
        historicalTxCount: houseTxs.length,
      };
    });
  }, [residents, transactions, baksosAgendas, defaultMonthLabel, config.duesAmountPerMonth]);

  // Sorted available periods for Kas Per KK
  // Bersumber langsung dari inputan Data Penarikan Keuangan (config.duesCurrentMonth) & seluruh periode
  const sortedPeriods = useMemo<string[]>(() => {
    const currentActiveMonth = config.duesCurrentMonth || defaultMonthLabel || 'Oktober 2026';

    const rawList =
      config.duesAvailablePeriods && config.duesAvailablePeriods.length > 0
        ? config.duesAvailablePeriods
        : [currentActiveMonth, 'September 2026'];

    const txMonths = transactions
      .map((t) => {
        const mKey = getMonthKeyFromDate(t.date);
        return formatMonthYearFromKey(mKey);
      })
      .filter((label): label is string => Boolean(label));

    const currentActiveKey = parseIndonesianMonthYearToKey(currentActiveMonth) || '2026-10';

    const combined = Array.from(
      new Set([currentActiveMonth, ...rawList, ...txMonths])
    ).filter(Boolean);

    return combined
      .filter((p) => {
        const key = parseIndonesianMonthYearToKey(p);
        if (!key) return false;

        // 1. Ketentuan: Hapus rekap iuran per kk yang belum masuk bulan berjalan (contoh: November, Desember 2026)
        if (key > currentActiveKey) return false;

        // 2. Ketentuan khusus tahun 2026: Jangan memunculkan rekap iuran per KK bulan April di tahun 2026 karena merupakan inputan baseline awal
        if (key === '2026-04') return false;
        const pLower = p.toLowerCase().trim();
        if (pLower === 'april 2026' || pLower === 'april') return false;

        return true;
      })
      .sort((a, b) => {
        const keyA = parseIndonesianMonthYearToKey(a) || '';
        const keyB = parseIndonesianMonthYearToKey(b) || '';
        return keyA.localeCompare(keyB);
      });
  }, [config.duesAvailablePeriods, config.duesCurrentMonth, defaultMonthLabel, transactions]);

  // Otomatis arahkan selectedKKPeriod ke bulan aktif penarikan keuangan saat ini & sembunyikan bulan masa depan serta April 2026 dari Rekap KK
  React.useEffect(() => {
    const active = config.duesCurrentMonth || defaultMonthLabel || 'Oktober 2026';
    const activeKey = parseIndonesianMonthYearToKey(active) || '2026-10';
    const selKey = selectedKKPeriod ? parseIndonesianMonthYearToKey(selectedKKPeriod) : null;
    const isFuturePeriod = selKey ? selKey > activeKey : false;
    const isApril2026 =
      selectedKKPeriod &&
      (selKey === '2026-04' ||
        selectedKKPeriod.toLowerCase().trim() === 'april 2026' ||
        selectedKKPeriod.toLowerCase().trim() === 'april');

    if (selectedKKPeriod === 'semua' || isFuturePeriod || isApril2026) {
      setSelectedKKPeriod(active);
    } else if (!selectedKKPeriod || !sortedPeriods.includes(selectedKKPeriod)) {
      setSelectedKKPeriod(active);
    }
  }, [sortedPeriods, config.duesCurrentMonth, defaultMonthLabel, selectedKKPeriod]);

  // Status computation for any given house in any given period
  // Status computation for any given house in any given period
  const getHouseStatusForPeriod = useCallback((house: ResidentHouse, periodLabel: string) => {
    const isPureKosong = house.occupancy === 'Kosong' || isHouseVacant(house);
    const nominal = getHouseDuesNominal(house) || config.duesAmountPerMonth || 25000;
    const targetKey = parseIndonesianMonthYearToKey(periodLabel) || '';
    const currentKey = parseIndonesianMonthYearToKey(defaultMonthLabel) || '2026-09';
    const blockRegex = new RegExp(`\\b${house.blockNumber.replace('/', '\\/')}\\b`, 'i');

    // 1. Prioritas Utama untuk Rumah Kosong: Bebas Iuran (Rp 0), kecuali ada transaksi nyata di Buku Kas
    if (isPureKosong) {
      const voluntaryTxs = transactions.filter((t) => {
        if (t.type !== 'masuk' || !isPureIuranTx(t) || !blockRegex.test(t.description)) return false;
        const descMatch = t.description.match(/\(([^)]+202\d)\)/)?.[1];
        const descKey = descMatch ? parseIndonesianMonthYearToKey(descMatch) : null;
        if (descKey) return descKey === targetKey;
        return getMonthKeyFromDate(t.date) === targetKey;
      });
      const voluntarySum = voluntaryTxs.reduce((s, t) => s + t.amount, 0);
      if (voluntarySum > 0) {
        return {
          status: 'Lunas' as const,
          amount: voluntarySum,
          isAdvanceSubsequentMonth: false,
          label: 'Lunas (Kosong)',
          badgeClass: 'bg-emerald-600 text-white border border-emerald-500 font-bold shadow-xs',
          paidDate: voluntaryTxs[0].date,
          note: 'Iuran Sukarela (Rumah Kosong)',
        };
      }
      return {
        status: 'Kosong' as const,
        amount: 0,
        isAdvanceSubsequentMonth: false,
        label: 'Bebas Iuran',
        badgeClass: 'bg-black text-white border border-neutral-700 font-semibold',
        paidDate: undefined,
        note: 'Rumah Kosong (Tidak Wajib)',
      };
    }

    // 2. Cek transaksi langsung di Buku Kas untuk rumah ini pada periode tersebut
    // Iuran bulanan diakui di periode ini jika TANGGAL transaksi kas masuk iuran berada pada bulan ini
    const matchingIuranTxs = transactions.filter((t) => {
      if (t.type !== 'masuk' || !isPureIuranTx(t) || !blockRegex.test(t.description)) return false;
      return getMonthKeyFromDate(t.date) === targetKey;
    });
    const sumIuranFromTxs = matchingIuranTxs.reduce((sum, t) => sum + t.amount, 0);

    if (sumIuranFromTxs > 0) {
      const isAdvance = sumIuranFromTxs > nominal;
      return {
        status: isAdvance ? ('Bayar Lebih' as const) : ('Lunas' as const),
        amount: sumIuranFromTxs,
        isAdvanceSubsequentMonth: false,
        label: isAdvance ? 'Bayar Lebih' : 'Lunas',
        badgeClass: isAdvance
          ? 'bg-indigo-600 text-white border border-indigo-500 font-bold shadow-xs'
          : 'bg-emerald-600 text-white border border-emerald-500 font-bold shadow-xs',
        paidDate: matchingIuranTxs[0].date,
      };
    }

    // 3. Cek apakah periode ini merupakan bulan lanjutan dari pembayaran di muka (>1 bulan)
    const houseBasePeriod = house.duesMonthNote || defaultMonthLabel;
    const baseKey = parseIndonesianMonthYearToKey(houseBasePeriod);
    const isPaidState = house.duesStatus === 'Lunas' || house.duesStatus === 'Bayar Lebih';
    const paidMonths = house.duesPaidMonths || (house.duesStatus === 'Bayar Lebih' ? 2 : isPaidState ? 1 : 0);
    const coveredMonths = isPaidState
      ? getSubsequentMonthLabels(houseBasePeriod, Math.max(1, paidMonths))
      : [];

    const isCoveredByAdvance =
      isPaidState &&
      (paidMonths > 1 || (house.duesMonthNote && isPeriodCoveredInDuesNote(house.duesMonthNote, periodLabel))) &&
      (
        (baseKey && targetKey > baseKey && coveredMonths.some((m) => parseIndonesianMonthYearToKey(m) === targetKey)) ||
        Boolean(house.duesMonthNote && isPeriodCoveredInDuesNote(house.duesMonthNote, periodLabel) && baseKey && targetKey > baseKey)
      );

    // Cari juga di Buku Kas apakah ada transaksi advance di bulan sebelumnya yang mencakup bulan ini
    const priorAdvanceTx = transactions.find((t) => {
      if (t.type !== 'masuk' || !isPureIuranTx(t) || !blockRegex.test(t.description)) return false;
      const txMonthKey = getMonthKeyFromDate(t.date);
      if (!txMonthKey || txMonthKey >= targetKey) return false;
      const desc = t.description.toLowerCase();
      const monthParts = targetKey.split('-');
      const monthName = (INDONESIAN_MONTHS[parseInt(monthParts[1], 10) - 1] || '').toLowerCase();
      return (
        desc.includes(monthName) ||
        desc.includes(targetKey) ||
        (desc.includes('lebih dari 1 bulan') && t.amount >= nominal * 2)
      );
    });

    if (isCoveredByAdvance || Boolean(priorAdvanceTx)) {
      return {
        status: 'Lunas' as const,
        amount: 0,
        isAdvanceSubsequentMonth: true,
        label: 'Lunas (Dimuka)',
        badgeClass: 'bg-sky-100 text-sky-900 border border-sky-300 font-bold shadow-xs',
        paidDate: house.duesPaidDate || priorAdvanceTx?.date,
        note: `Lunas di Muka (Total iuran sudah masuk di periode sebelumnya)`,
      };
    }

    // 4. Jika periode cocok dengan inputan dasar rumah (base month) dan status Lunas / Bayar Lebih
    const isBaseMatch = (baseKey && targetKey === baseKey) || periodLabel === houseBasePeriod;
    if (isBaseMatch && isPaidState) {
      const isAdvance = paidMonths > 1 || house.duesStatus === 'Bayar Lebih';
      const totalDuesInBase = isAdvance ? nominal * paidMonths : nominal;
      return {
        status: isAdvance ? ('Bayar Lebih' as const) : ('Lunas' as const),
        amount: totalDuesInBase,
        isAdvanceSubsequentMonth: false,
        label: isAdvance ? `Bayar Lebih (${paidMonths} Bln)` : 'Lunas',
        badgeClass: isAdvance
          ? 'bg-indigo-600 text-white border border-indigo-500 font-bold shadow-xs'
          : 'bg-emerald-600 text-white border border-emerald-500 font-bold shadow-xs',
        paidDate: house.duesPaidDate,
        note: isAdvance
          ? `Tercakup: ${coveredMonths.join(', ')} (Total iuran ${formatRupiah(totalDuesInBase)} masuk di bulan ini)`
          : undefined,
      };
    }

    // 5. Belum Ditempati (tidak ada pembayaran): Bebas Iuran
    if (house.occupancy === 'Belum Ditempati') {
      return {
        status: 'Kosong' as const,
        amount: 0,
        isAdvanceSubsequentMonth: false,
        label: 'Belum Ditempati',
        badgeClass: 'bg-black text-white border border-neutral-700 font-semibold',
        paidDate: undefined,
        note: 'Belum Ditempati (Tidak Wajib)',
      };
    }

    // 6. Bulan berjalan aktif jika periodLabel cocok
    if (periodLabel === defaultMonthLabel || targetKey === currentKey) {
      if (house.duesStatus === 'Lunas' || house.duesStatus === 'Bayar Lebih') {
        const isAdvance = house.duesStatus === 'Bayar Lebih';
        const advMonths = Math.max(2, house.duesPaidMonths || 2);
        return {
          status: house.duesStatus,
          amount: isAdvance ? nominal * advMonths : nominal,
          isAdvanceSubsequentMonth: false,
          label: isAdvance ? `Bayar Lebih (${advMonths} Bln)` : 'Lunas',
          badgeClass: isAdvance
            ? 'bg-indigo-100 text-indigo-800 border border-indigo-200 font-bold'
            : 'bg-emerald-100 text-emerald-800 border border-emerald-200 font-bold',
          paidDate: house.duesPaidDate,
        };
      }
      const paidPart = house.duesPaidAmount || 0;
      return {
        status: 'Belum Bayar' as const,
        amount: paidPart,
        isAdvanceSubsequentMonth: false,
        label: paidPart > 0 ? `Cicil ${formatRupiah(paidPart)}` : 'Belum Bayar',
        badgeClass: 'bg-rose-100 text-rose-800 border border-rose-200 font-bold',
        note: paidPart > 0 ? `Sisa ${formatRupiah(Math.max(0, nominal - paidPart))}` : 'Belum Bayar',
      };
    }

    // 7. Bulan lampau (targetKey < currentKey)
    if (targetKey < currentKey) {
      return {
        status: 'Belum Bayar' as const,
        amount: 0,
        isAdvanceSubsequentMonth: false,
        label: 'Tertunggak',
        badgeClass: 'bg-rose-100 text-rose-800 border border-rose-200 font-bold',
        note: house.previousArrearsNote || 'Tertunggak',
      };
    }

    // 8. Bulan masa depan
    return {
      status: 'Belum Bayar' as const,
      amount: 0,
      isAdvanceSubsequentMonth: false,
      label: 'Belum Masuk Periode',
      badgeClass: 'bg-slate-100 text-slate-500 border border-slate-200',
    };
  }, [defaultMonthLabel, transactions, config.duesAmountPerMonth]);

  // Helper to compute Baksos attendance, fine payment, and unpaid fines for any house and period
  const getHouseBaksosForPeriod = useCallback(
    (house: ResidentHouse, periodLabel: string) => {
      const isPureKosong = house.occupancy === 'Kosong' || isHouseVacant(house);
      const isUnoccupied = house.occupancy === 'Belum Ditempati';
      const isContract = house.ownership === 'Kontrak' || house.occupancy === 'Dikontrakan';
      const targetKey = periodLabel !== 'semua' ? parseIndonesianMonthYearToKey(periodLabel) : null;
      const blockRegex = new RegExp(`\\b${house.blockNumber.replace('/', '\\/')}\\b`, 'i');

      const agendas = baksosAgendas || [];

      // Filter agendas matching this period
      const matchingAgendas = agendas.filter((agenda) => {
        if (!targetKey) return true;
        return getMonthKeyFromDate(agenda.date) === targetKey;
      });

      // Matching baksos fine payment transactions in Kas Utama
      const baksosTxs = transactions.filter((t) => {
        if (t.type !== 'masuk') return false;
        const cat = t.category || '';
        const desc = (t.description || '').toLowerCase();
        const isBaksos = cat === 'Denda Baksos' || desc.includes('denda');
        if (!isBaksos) return false;
        if (!blockRegex.test(t.description)) return false;
        if (targetKey) {
          return getMonthKeyFromDate(t.date) === targetKey;
        }
        return true;
      });
      const txPaidAmount = baksosTxs.reduce((sum, t) => sum + t.amount, 0);

      // Paid baksos agendas
      const paidAgendas = matchingAgendas.filter((agenda) => {
        const att = agenda.attendance?.[house.id];
        const isPaid = agenda.finesPaid?.[house.id];
        return att === 'Tidak Hadir' && Boolean(isPaid);
      });
      const agendaPaidAmount = paidAgendas.reduce((sum, a) => sum + (a.fineAmount || 10000), 0);

      // Total denda baksos paid
      const dendaPaid = Math.max(txPaidAmount, agendaPaidAmount);

      // Unpaid baksos agendas
      const unpaidAgendas = matchingAgendas.filter((agenda) => {
        const att =
          agenda.attendance?.[house.id] ||
          (house.occupancy === 'Kosong' ? 'Kosong' : isContract ? 'Tidak Wajib' : 'Hadir');
        const isPaid = agenda.finesPaid?.[house.id];
        return att === 'Tidak Hadir' && !isPaid;
      });
      const calculatedUnpaid = isPureKosong || isUnoccupied ? 0 : unpaidAgendas.reduce((sum, a) => sum + (a.fineAmount || 10000), 0);
      const dendaUnpaid =
        targetKey === null && house.customBaksosFineAmount !== undefined
          ? house.customBaksosFineAmount
          : calculatedUnpaid;

      const hadHadir = matchingAgendas.some((a) => a.attendance?.[house.id] === 'Hadir');
      const hadTidakWajib = isContract || matchingAgendas.some((a) => a.attendance?.[house.id] === 'Tidak Wajib');

      return {
        matchingAgendasCount: matchingAgendas.length,
        dendaPaid,
        dendaUnpaid,
        hadHadir,
        hadTidakWajib,
        isPureKosong: isPureKosong || isUnoccupied,
        paidAgendas,
        unpaidAgendas,
      };
    },
    [baksosAgendas, transactions]
  );

  // Aggregate statistics per period for recap cards & matrix footer
  const periodRecapStats = useMemo(() => {
    const occupiedHouses = residents.filter((r) => r.occupancy !== 'Kosong' && !isHouseVacant(r));

    return sortedPeriods.map((periodLabel) => {
      const pKey = parseIndonesianMonthYearToKey(periodLabel) || '';
      let totalAmount = 0;
      let lunasCount = 0;
      let bayarLebihCount = 0;
      let belumBayarCount = 0;
      let kosongCount = 0;

      residents.forEach((house) => {
        const info = getHouseStatusForPeriod(house, periodLabel);
        if (info.status === 'Kosong') {
          kosongCount++;
        } else if (info.status === 'Bayar Lebih') {
          bayarLebihCount++;
          totalAmount += info.amount;
        } else if (info.status === 'Lunas') {
          lunasCount++;
          totalAmount += info.amount;
        } else {
          belumBayarCount++;
          totalAmount += info.amount;
        }
      });

      const totalPaidCount = lunasCount + bayarLebihCount;
      const pctLunas = occupiedHouses.length > 0
        ? Math.round((totalPaidCount / occupiedHouses.length) * 100)
        : 0;

      // Check pure iuran transactions from ledger for this month
      const matchingTxs = transactions.filter(
        (t) => t.type === 'masuk' && isPureIuranTx(t) && getMonthKeyFromDate(t.date) === pKey
      );
      const txSum = matchingTxs.reduce((s, t) => s + t.amount, 0);

      // Check tunggakan transactions paid in this month (bulan tanggal bayar)
      const matchingTungTxs = transactions.filter(
        (t) => t.type === 'masuk' && isTunggakanTx(t) && getMonthKeyFromDate(t.date) === pKey
      );
      const tungSum = matchingTungTxs.reduce((s, t) => s + t.amount, 0);

      return {
        periodLabel,
        pKey,
        isCurrentMonth: periodLabel === defaultMonthLabel,
        totalAmount: Math.max(totalAmount, txSum) + tungSum,
        lunasCount,
        bayarLebihCount,
        totalPaidCount,
        belumBayarCount,
        kosongCount,
        occupiedCount: occupiedHouses.length,
        pctLunas,
      };
    });
  }, [sortedPeriods, residents, defaultMonthLabel, transactions, getHouseStatusForPeriod]);

  // Filtered Per KK
  const filteredPerKKList = useMemo(() => {
    return perKKRecapList.filter((item) => {
      if (duesFilter !== 'semua') {
        if (item.isEmptyHouse) return false;
        if (selectedKKPeriod === 'semua') {
          if (item.house.duesStatus !== duesFilter) return false;
        } else {
          const pStatus = getHouseStatusForPeriod(item.house, selectedKKPeriod).status;
          if (pStatus !== duesFilter) return false;
        }
      }
      if (searchKK.trim()) {
        const q = searchKK.toLowerCase();
        const matchBlock = item.house.blockNumber.toLowerCase().includes(q);
        const matchName =
          item.house.headName.toLowerCase().includes(q) ||
          (item.house.duesHeadNameOverride || '').toLowerCase().includes(q);
        const matchStatus = item.house.duesStatus.toLowerCase().includes(q);
        if (!matchBlock && !matchName && !matchStatus) return false;
      }
      return true;
    });
  }, [perKKRecapList, duesFilter, searchKK, selectedKKPeriod, getHouseStatusForPeriod]);

  // Precomputed rows for the Rekap Per KK table with 100% mathematical consistency
  const recapRows = useMemo(() => {
    return filteredPerKKList.map((item, idx) => {
      const { house, isLunas, isAdvancePaid } = item;

      const isPureKosong =
        house.occupancy === 'Kosong' ||
        isHouseVacant(house) ||
        Boolean(house.duesHeadNameOverride && /rumah kosong|^kosong$/i.test(house.duesHeadNameOverride.trim()));

      const isUnoccupied = house.occupancy === 'Belum Ditempati';
      const isRumahKosongHitam = isPureKosong;

      const periodStr = selectedKKPeriod !== 'semua' ? selectedKKPeriod : item.periodLabel;
      const statusInfo =
        selectedKKPeriod !== 'semua'
          ? getHouseStatusForPeriod(house, selectedKKPeriod)
          : null;

      const defaultNominal = getHouseDuesNominal(house) || config.duesAmountPerMonth || 25000;
      const nominal = item.nominalPerMonth || defaultNominal;
      const isAdvanceSubsequent = Boolean(statusInfo?.isAdvanceSubsequentMonth);

      // Exact Iuran Paid for this cell
      const iuranPaid = isPureKosong
        ? (statusInfo && statusInfo.status === 'Lunas' ? (statusInfo.amount || 0) : 0)
        : statusInfo
        ? statusInfo.isAdvanceSubsequentMonth
          ? 0
          : statusInfo.status === 'Lunas' || statusInfo.status === 'Bayar Lebih'
          ? (statusInfo.amount !== undefined ? statusInfo.amount : nominal)
          : statusInfo.amount || 0
        : isLunas
        ? nominal * (isAdvancePaid ? Math.max(1, house.duesPaidMonths || 1) : 1)
        : house.duesPaidAmount || 0;

      // Nama kepala keluarga
      const payerName = isPureKosong
        ? (house.duesHeadNameOverride && house.duesHeadNameOverride !== 'Rumah Kosong'
            ? house.duesHeadNameOverride
            : 'Rumah Kosong')
        : isUnoccupied
        ? (house.duesHeadNameOverride || 'Belum Ditempati')
        : (house.duesHeadNameOverride || house.headName || '');

      const baksosInfo = getHouseBaksosForPeriod(house, selectedKKPeriod);
      const dendaPaid = isPureKosong ? 0 : baksosInfo.dendaPaid;

      const blockRegex = new RegExp(`\\b${house.blockNumber.replace('/', '\\/')}\\b`, 'i');
      const tunggakanTxs = transactions.filter((t) => {
        if (t.type !== 'masuk') return false;
        if (!isTunggakanTx(t)) return false;
        if (!blockRegex.test(t.description)) return false;
        if (selectedKKPeriod !== 'semua') {
          const pKey = parseIndonesianMonthYearToKey(selectedKKPeriod);
          return getMonthKeyFromDate(t.date) === pKey;
        }
        return true;
      });
      const tunggakanPaid = isPureKosong ? 0 : tunggakanTxs.reduce((s, t) => s + t.amount, 0);

      const paidDate =
        (tunggakanPaid > 0 && tunggakanTxs.length > 0)
          ? tunggakanTxs[0].date
          : statusInfo?.paidDate ||
            house.duesPaidDate ||
            (tunggakanTxs.length > 0 ? tunggakanTxs[0].date : '');

      const totalSemua = iuranPaid + dendaPaid + tunggakanPaid;

      const isBayarLebih =
        !isRumahKosongHitam &&
        !isAdvanceSubsequent &&
        ((statusInfo && statusInfo.status === 'Bayar Lebih') ||
         (selectedKKPeriod === 'semua' && isAdvancePaid) ||
         ((house.duesPaidMonths || 0) > 1 && !statusInfo));

      const isSudahBayar =
        !isRumahKosongHitam &&
        !isBayarLebih &&
        (isAdvanceSubsequent ||
         tunggakanPaid > 0 ||
         (statusInfo && (statusInfo.status === 'Lunas' || (statusInfo.amount || 0) > 0)) ||
         (selectedKKPeriod === 'semua' && isLunas) ||
         (iuranPaid > 0));

      const isMenunggak = !isRumahKosongHitam && !isBayarLebih && !isSudahBayar;

      const rowCellClass = isRumahKosongHitam
        ? 'bg-black text-white border-neutral-800 font-medium'
        : isBayarLebih
        ? 'bg-sky-50 text-sky-950 border-sky-300 font-medium'
        : isSudahBayar
        ? 'bg-emerald-50 text-emerald-950 border-emerald-300 font-medium'
        : 'bg-rose-50 text-rose-950 border-rose-300 font-medium';

      return {
        item,
        idx,
        house,
        isPureKosong,
        isUnoccupied,
        isRumahKosongHitam,
        periodStr,
        statusInfo,
        nominal,
        isAdvanceSubsequent,
        iuranPaid,
        payerName,
        baksosInfo,
        dendaPaid,
        tunggakanPaid,
        paidDate,
        totalSemua,
        isBayarLebih,
        isSudahBayar,
        isMenunggak,
        rowCellClass,
      };
    });
  }, [filteredPerKKList, selectedKKPeriod, transactions, getHouseStatusForPeriod, getHouseBaksosForPeriod, config.duesAmountPerMonth]);

  // Rekap table totals for KK table directly derived from recapRows
  const recapTotals = useMemo(() => {
    let sumIuran = 0;
    let sumDenda = 0;
    let sumTunggakan = 0;
    let sumTotal = 0;

    recapRows.forEach((r) => {
      sumIuran += r.iuranPaid;
      sumDenda += r.dendaPaid;
      sumTunggakan += r.tunggakanPaid;
      sumTotal += r.totalSemua;
    });

    return { sumIuran, sumDenda, sumTunggakan, sumTotal };
  }, [recapRows]);

  // Aggregate KK stats
  const kkStats = useMemo(() => {
    const occupied = residents.filter((r) => r.occupancy !== 'Kosong');
    const lunasCount = occupied.filter((r) => r.duesStatus === 'Lunas' || r.duesStatus === 'Bayar Lebih').length;
    const belumBayarCount = occupied.filter((r) => r.duesStatus === 'Belum Bayar').length;
    const totalCollected = occupied.reduce((sum, h) => {
      const nom = getHouseDuesNominal(h);
      if (h.duesStatus === 'Lunas' || h.duesStatus === 'Bayar Lebih') {
        return sum + nom + (h.duesPrepaidBalance || 0);
      }
      return sum + (h.duesPaidAmount || 0);
    }, 0);
    return {
      totalOccupied: occupied.length,
      lunasCount,
      belumBayarCount,
      totalCollected,
    };
  }, [residents]);

  // =========================================================================
  // POIN 3: REKAP KESELURUHAN KAS PER KK (MENGGABUNGKAN TOTAL SEMUA PERIODE)
  // =========================================================================
  const overallKKRecapList = useMemo(() => {
    return residents.map((house, idx) => {
      const isPureKosong =
        house.occupancy === 'Kosong' ||
        isHouseVacant(house) ||
        Boolean(
          house.duesHeadNameOverride &&
            /rumah kosong|^kosong$/i.test(house.duesHeadNameOverride.trim())
        );
      const isUnoccupied = house.occupancy === 'Belum Ditempati';
      const isRumahKosongHitam = isPureKosong;

      const defaultNominal = getHouseDuesNominal(house) || config.duesAmountPerMonth || 25000;
      const nominalPerMonth = isPureKosong ? 0 : defaultNominal;

      const payerName = isPureKosong
        ? house.duesHeadNameOverride && house.duesHeadNameOverride !== 'Rumah Kosong'
          ? house.duesHeadNameOverride
          : 'Rumah Kosong'
        : isUnoccupied
        ? house.duesHeadNameOverride || 'Belum Ditempati'
        : house.duesHeadNameOverride || house.headName || '';

      const blockRegex = new RegExp(`\\b${house.blockNumber.replace('/', '\\/')}\\b`, 'i');

      let totalIuranAllPeriods = 0;
      let totalDendaAllPeriods = 0;
      let totalTunggakanAllPeriods = 0;
      let totalPeriodsPaidCount = 0;
      let unpaidPeriodsCount = 0;

      const periodsDetail = sortedPeriods.map((periodLabel) => {
        const pKey = parseIndonesianMonthYearToKey(periodLabel) || '';
        const statusInfo = getHouseStatusForPeriod(house, periodLabel);

        const iuranPaid = isPureKosong
          ? statusInfo && statusInfo.status === 'Lunas'
            ? statusInfo.amount || 0
            : 0
          : statusInfo
          ? statusInfo.isAdvanceSubsequentMonth
            ? 0
            : statusInfo.status === 'Lunas' || statusInfo.status === 'Bayar Lebih'
            ? statusInfo.amount !== undefined
              ? statusInfo.amount
              : nominalPerMonth
            : statusInfo.amount || 0
          : 0;

        const baksosInfo = getHouseBaksosForPeriod(house, periodLabel);
        const dendaPaid = isPureKosong ? 0 : baksosInfo.dendaPaid;

        const tunggakanTxs = transactions.filter((t) => {
          if (t.type !== 'masuk' || !isTunggakanTx(t)) return false;
          if (!blockRegex.test(t.description)) return false;
          return getMonthKeyFromDate(t.date) === pKey;
        });
        const tunggakanPaid = isPureKosong ? 0 : tunggakanTxs.reduce((s, t) => s + t.amount, 0);

        const periodTotal = iuranPaid + dendaPaid + tunggakanPaid;

        const isLunasThisPeriod = isPureKosong
          ? true
          : Boolean(
              statusInfo?.isAdvanceSubsequentMonth ||
                statusInfo?.status === 'Lunas' ||
                statusInfo?.status === 'Bayar Lebih' ||
                iuranPaid >= nominalPerMonth
            );

        if (isLunasThisPeriod && !isPureKosong) {
          totalPeriodsPaidCount++;
        } else if (!isPureKosong && !isUnoccupied) {
          unpaidPeriodsCount++;
        }

        totalIuranAllPeriods += iuranPaid;
        totalDendaAllPeriods += dendaPaid;
        totalTunggakanAllPeriods += tunggakanPaid;

        return {
          periodLabel,
          pKey,
          statusInfo,
          iuranPaid,
          dendaPaid,
          tunggakanPaid,
          periodTotal,
          isLunasThisPeriod,
          isAdvanceSubsequent: Boolean(statusInfo?.isAdvanceSubsequentMonth),
          statusBadge: isPureKosong
            ? 'Bebas Iuran'
            : statusInfo?.isAdvanceSubsequentMonth
            ? 'Lunas (Dimuka)'
            : statusInfo?.label || (isLunasThisPeriod ? 'Lunas' : 'Belum Bayar'),
          badgeClass: isPureKosong
            ? 'bg-neutral-900 text-neutral-300 border-neutral-700'
            : statusInfo?.isAdvanceSubsequentMonth
            ? 'bg-sky-100 text-sky-900 border-sky-300 font-bold'
            : isLunasThisPeriod
            ? 'bg-emerald-100 text-emerald-900 border-emerald-300 font-bold'
            : 'bg-rose-100 text-rose-900 border-rose-300 font-bold',
          paidDate:
            statusInfo?.paidDate ||
            tunggakanTxs[0]?.date ||
            (isLunasThisPeriod ? house.duesPaidDate : undefined),
        };
      });

      const grandTotalAllPeriods =
        totalIuranAllPeriods + totalDendaAllPeriods + totalTunggakanAllPeriods;

      // Sisa tunggakan berjalan
      const isContract = house.ownership === 'Kontrak' || house.occupancy === 'Dikontrakan';
      const unpaidBaksosList = baksosAgendas.filter((agenda) => {
        const attendance =
          agenda.attendance?.[house.id] ||
          (house.occupancy === 'Kosong' ? 'Kosong' : isContract ? 'Tidak Wajib' : 'Hadir');
        const isFinePaid = agenda.finesPaid?.[house.id];
        return attendance === 'Tidak Hadir' && !isFinePaid;
      });
      const baksosFineAmount = isPureKosong
        ? 0
        : house.customBaksosFineAmount !== undefined
        ? house.customBaksosFineAmount
        : unpaidBaksosList.length * 10000;
      const duesArrears = isPureKosong
        ? 0
        : house.duesStatus === 'Belum Bayar'
        ? Math.max(0, nominalPerMonth - (house.duesPaidAmount || 0))
        : 0;
      const previousArrears = isPureKosong ? 0 : house.previousArrears || 0;
      const remainingArrearsTotal = duesArrears + baksosFineAmount + previousArrears;

      let overallStatus: 'Lunas Semua' | 'Bayar Lebih' | 'Ada Tunggakan' | 'Kosong';
      let overallBadgeClass = '';

      if (isPureKosong) {
        overallStatus = 'Kosong';
        overallBadgeClass = 'bg-black text-white border-neutral-700';
      } else if (unpaidPeriodsCount === 0 && remainingArrearsTotal === 0) {
        if (house.duesStatus === 'Bayar Lebih' || (house.duesPaidMonths || 0) > 1) {
          overallStatus = 'Bayar Lebih';
          overallBadgeClass = 'bg-sky-100 text-sky-950 border border-sky-300 font-bold';
        } else {
          overallStatus = 'Lunas Semua';
          overallBadgeClass = 'bg-emerald-100 text-emerald-950 border border-emerald-300 font-bold';
        }
      } else if (remainingArrearsTotal === 0 && house.duesStatus === 'Bayar Lebih') {
        overallStatus = 'Bayar Lebih';
        overallBadgeClass = 'bg-sky-100 text-sky-950 border border-sky-300 font-bold';
      } else {
        overallStatus = 'Ada Tunggakan';
        overallBadgeClass = 'bg-rose-100 text-rose-950 border border-rose-300 font-bold';
      }

      const rowCellClass = isRumahKosongHitam
        ? 'bg-black text-white border-neutral-800'
        : overallStatus === 'Bayar Lebih'
        ? 'bg-sky-50 text-sky-950 border-sky-300'
        : overallStatus === 'Lunas Semua'
        ? 'bg-emerald-50 text-emerald-950 border-emerald-300'
        : 'bg-rose-50 text-rose-950 border-rose-300';

      return {
        house,
        idx,
        isPureKosong,
        isUnoccupied,
        isRumahKosongHitam,
        nominalPerMonth,
        payerName,
        periodsDetail,
        totalIuranAllPeriods,
        totalDendaAllPeriods,
        totalTunggakanAllPeriods,
        grandTotalAllPeriods,
        totalPeriodsCount: sortedPeriods.length,
        totalPeriodsPaidCount,
        unpaidPeriodsCount,
        remainingArrearsTotal,
        overallStatus,
        overallBadgeClass,
        rowCellClass,
      };
    });
  }, [
    residents,
    sortedPeriods,
    transactions,
    baksosAgendas,
    getHouseStatusForPeriod,
    getHouseBaksosForPeriod,
    config.duesAmountPerMonth,
  ]);

  const filteredOverallKKList = useMemo(() => {
    return overallKKRecapList.filter((item) => {
      if (filterOverallStatus !== 'semua') {
        if (filterOverallStatus === 'Kosong') {
          if (!item.isPureKosong) return false;
        } else {
          if (item.isPureKosong) return false;
          if (item.overallStatus !== filterOverallStatus) return false;
        }
      }

      if (searchOverall.trim()) {
        const q = searchOverall.toLowerCase().trim();
        const matchBlock = item.house.blockNumber.toLowerCase().includes(q);
        const matchName =
          item.payerName.toLowerCase().includes(q) ||
          item.house.headName.toLowerCase().includes(q);
        const matchStatus = item.overallStatus.toLowerCase().includes(q);
        if (!matchBlock && !matchName && !matchStatus) return false;
      }

      return true;
    });
  }, [overallKKRecapList, filterOverallStatus, searchOverall]);

  const overallTotals = useMemo(() => {
    let sumIuran = 0;
    let sumDenda = 0;
    let sumTunggakan = 0;
    let sumGrandTotal = 0;
    let sumRemainingArrears = 0;

    filteredOverallKKList.forEach((r) => {
      sumIuran += r.totalIuranAllPeriods;
      sumDenda += r.totalDendaAllPeriods;
      sumTunggakan += r.totalTunggakanAllPeriods;
      sumGrandTotal += r.grandTotalAllPeriods;
      sumRemainingArrears += r.remainingArrearsTotal;
    });

    return {
      sumIuran,
      sumDenda,
      sumTunggakan,
      sumGrandTotal,
      sumRemainingArrears,
    };
  }, [filteredOverallKKList]);

  const overallStats = useMemo(() => {
    const occupied = overallKKRecapList.filter((r) => !r.isPureKosong);
    const lunasCount = occupied.filter(
      (r) => r.overallStatus === 'Lunas Semua' || r.overallStatus === 'Bayar Lebih'
    ).length;
    const tunggakanCount = occupied.filter((r) => r.overallStatus === 'Ada Tunggakan').length;
    const bayarLebihCount = occupied.filter((r) => r.overallStatus === 'Bayar Lebih').length;
    const pctLunas =
      occupied.length > 0 ? Math.round((lunasCount / occupied.length) * 100) : 0;

    return {
      totalOccupied: occupied.length,
      lunasCount,
      tunggakanCount,
      bayarLebihCount,
      pctLunas,
    };
  }, [overallKKRecapList]);

  // DATA STRUKTUR TABEL BUKU KAS YANG DISEMPURNAKAN & DISEDERHANAKAN:
  // 1. Sisa saldo bulan sebelumnya
  // 1. Sisa saldo bulan sebelumnya
  // 2. Total penerimaan kas (gabungan Iuran Kas Seluruh KK + Denda Baksos + Pembayaran Tunggakan)
  // 3. Uraian pengeluaran gang
  // 4. Uraian pengeluaran dan penerimaan cashback wifi & sampah serta kas lainnya
  const simplifiedCashbookData = useMemo(() => {
    // 1. Baris Sisa Saldo Bulan Sebelumnya
    const saldoAwalKasUtama = prevMonthSummary.kasUtama;
    const saldoAwalWifi = prevMonthSummary.wifiCashback;
    const saldoAwalSampah = prevMonthSummary.sampahCashback;
    const saldoAwalTotal = prevMonthSummary.total;

    // Periode aktif terpilih
    const activePeriodLabel =
      effectiveMonthKey !== 'semua'
        ? formatMonthYearFromKey(effectiveMonthKey)
        : defaultMonthLabel;

    // 2. Data Total Penerimaan Rekap Iuran Per KK untuk periode ini
    // Transaksi iuran yang ada di periode ini (iuran rutin)
    const iuranTxsInPeriod = filteredTransactions.filter((tx) => {
      return tx.type === 'masuk' && isPureIuranTx(tx);
    });

    const totalIuranFromTxs = iuranTxsInPeriod.reduce((sum, t) => sum + t.amount, 0);

    // Hitung juga total nominal iuran yang tercatat dari rekapitulasi data KK
    const totalIuranFromRecap = recapTotals.sumIuran;

    // Prioritaskan total dari transaksi pembukuan kas jika ada, atau sinkron dari rekap KK
    const effectiveTotalIuran = totalIuranFromTxs > 0 ? totalIuranFromTxs : totalIuranFromRecap;

    // Transaksi Denda Baksos di periode ini
    const dendaTxsInPeriod = filteredTransactions.filter((tx) => {
      const cat = tx.category || '';
      const desc = (tx.description || '').toLowerCase();
      return tx.type === 'masuk' && (cat === 'Denda Baksos' || desc.includes('denda'));
    });
    const totalDendaFromTxs = dendaTxsInPeriod.reduce((sum, t) => sum + t.amount, 0);
    const effectiveTotalDenda = totalDendaFromTxs > 0 ? totalDendaFromTxs : (recapTotals.sumDenda || 0);

    // Transaksi Pembayaran Tunggakan di periode ini
    const tunggakanTxsInPeriod = filteredTransactions.filter((tx) => {
      return isTunggakanTx(tx);
    });
    const totalTunggakanFromTxs = tunggakanTxsInPeriod.reduce((sum, t) => sum + t.amount, 0);
    const effectiveTotalTunggakan = totalTunggakanFromTxs > 0 ? totalTunggakanFromTxs : (recapTotals.sumTunggakan || 0);

    // Total gabungan seluruh penerimaan kas warga
    const effectiveTotalPenerimaanKas = effectiveTotalIuran + effectiveTotalDenda + effectiveTotalTunggakan;

    const lunasCount = perKKRecapList.filter((item) => {
      if (item.isEmptyHouse) return false;
      if (effectiveMonthKey !== 'semua') {
        const s = getHouseStatusForPeriod(item.house, activePeriodLabel);
        return s.status === 'Lunas' || s.status === 'Bayar Lebih';
      }
      return item.isLunas || item.isAdvancePaid;
    }).length;

    const occupiedCount = perKKRecapList.filter((item) => !item.isEmptyHouse).length;

    // 3. Uraian Pengeluaran Kas Gang (nota/biaya operasional gang)
    const pengeluaranGangTxs = filteredTransactions.filter((tx) => {
      if (tx.type !== 'keluar') return false;
      const cat = tx.category || '';
      if (
        cat === 'Pengeluaran Cashback WiFi' ||
        cat === 'Pengeluaran Cashback Sampah' ||
        cat === 'Cashback WiFi' ||
        cat === 'Cashback Sampah' ||
        tx.pool === 'Cashback WiFi' ||
        tx.pool === 'Cashback Sampah'
      ) {
        return false;
      }
      return true;
    });

    // 4. Uraian Pengeluaran & Penerimaan Cashback (WiFi & Sampah) serta Kas Lainnya
    const cashbackDanKasLainTxs = filteredTransactions.filter((tx) => {
      // Exclude transaksi yang sudah dirangkum dalam baris total penerimaan kas (iuran, denda, tunggakan)
      if (iuranTxsInPeriod.some((it) => it.id === tx.id)) return false;
      if (dendaTxsInPeriod.some((dt) => dt.id === tx.id)) return false;
      if (tunggakanTxsInPeriod.some((tt) => tt.id === tx.id)) return false;
      const cat = tx.category || '';
      const desc = (tx.description || '').toLowerCase();
      if (cat === 'Iuran Warga' || cat === 'Denda Baksos' || cat === 'Pembayaran Tunggakan') return false;
      if (desc.includes('iuran bulanan') || desc.includes('pelunasan denda baksos')) return false;

      // Exclude transaksi pengeluaran gang
      if (pengeluaranGangTxs.some((gt) => gt.id === tx.id)) return false;
      return true;
    });

    // Hitung Saldo Berjalan berurutan secara transparan
    let running = saldoAwalTotal;

    const saldoAwalRow = {
      id: 'row-saldo-awal',
      no: '-',
      date: effectiveMonthKey === 'semua' ? 'Awal Catatan' : 'Awal Bulan',
      description:
        effectiveMonthKey === 'semua'
          ? 'Saldo Awal Pembukuan (Awal Catatan Kas)'
          : `Sisa Saldo Bulan Sebelumnya (${prevMonthSummary.prevMonthLabel})`,
      subDescription: `Kas Utama: ${formatRupiah(saldoAwalKasUtama)} | WiFi: ${formatRupiah(saldoAwalWifi)} | Sampah: ${formatRupiah(saldoAwalSampah)}`,
      category: 'Saldo Awal',
      pool: 'Kas Utama' as const,
      masuk: 0,
      keluar: 0,
      runningBalance: running,
    };

    // Filter check untuk row total penerimaan kas
    const showPenerimaanRow =
      (filterPool === 'semua' || filterPool === 'Iuran Warga' || filterPool === 'Kas Utama' || filterPool === 'Denda Baksos') &&
      (!searchTx.trim() ||
        'iuran'.includes(searchTx.toLowerCase()) ||
        'denda'.includes(searchTx.toLowerCase()) ||
        'tunggakan'.includes(searchTx.toLowerCase()) ||
        'rekap'.includes(searchTx.toLowerCase()) ||
        'penerimaan'.includes(searchTx.toLowerCase()) ||
        'warga'.includes(searchTx.toLowerCase()));

    let rekapIuranRow: any = null;
    if (showPenerimaanRow) {
      running += effectiveTotalPenerimaanKas;
      const firstTxDate =
        iuranTxsInPeriod.length > 0
          ? formatDateDDMMYYYY(iuranTxsInPeriod[0].date)
          : dendaTxsInPeriod.length > 0
          ? formatDateDDMMYYYY(dendaTxsInPeriod[0].date)
          : tunggakanTxsInPeriod.length > 0
          ? formatDateDDMMYYYY(tunggakanTxsInPeriod[0].date)
          : '01/10/2026';

      rekapIuranRow = {
        id: 'row-rekap-penerimaan-kas',
        no: 1,
        date: firstTxDate,
        description:
          effectiveMonthKey === 'semua'
            ? 'Total Penerimaan Kas'
            : `Total Penerimaan Kas ${activePeriodLabel}`,
        subDescription: '',
        category: 'Penerimaan Kas Warga',
        pool: 'Kas Utama' as const,
        masukIuran: effectiveTotalIuran,
        masukDenda: effectiveTotalDenda,
        masukTunggakan: effectiveTotalTunggakan,
        masuk: effectiveTotalPenerimaanKas,
        keluar: 0,
        runningBalance: running,
        lunasCount,
        occupiedCount,
      };
    }

    // Gabungkan seluruh transaksi sisa (pengeluaran gang + cashback wifi & sampah + kas lainnya)
    // yang BELUM dimasukkan ke baris Total Penerimaan Kas
    const remainingRawTxs = [...pengeluaranGangTxs, ...cashbackDanKasLainTxs].sort((a, b) =>
      a.date.localeCompare(b.date)
    );

    let itemNumber = rekapIuranRow ? 2 : 1;
    const remainingCashbookRows = remainingRawTxs
      .filter((tx) => {
        const cat = tx.category || '';
        const isWifi = cat.includes('WiFi') || tx.pool === 'Cashback WiFi';
        const isSampah = cat.includes('Sampah') || tx.pool === 'Cashback Sampah';

        if (filterPool === 'Iuran Warga') return false;
        if (filterPool === 'Cashback WiFi') return isWifi;
        if (filterPool === 'Cashback Sampah') return isSampah;
        if (filterPool === 'keluar') return tx.type === 'keluar';
        if (filterPool === 'Kas Utama') return tx.pool === 'Kas Utama' && !isWifi && !isSampah;
        if (searchTx.trim()) {
          const q = searchTx.toLowerCase();
          const matchDesc = (tx.description || '').toLowerCase().includes(q);
          const matchCat = (tx.category || '').toLowerCase().includes(q);
          if (!matchDesc && !matchCat) return false;
        }
        return true;
      })
      .map((tx) => {
        const isMasuk = tx.type === 'masuk';
        const cat = tx.category || '';
        const isWifi =
          cat === 'Cashback WiFi' ||
          cat === 'Pengeluaran Cashback WiFi' ||
          (tx.pool === 'Cashback WiFi' && cat !== 'Pengeluaran Gang' && cat !== 'Kas Utama');
        const isSampah =
          cat === 'Cashback Sampah' ||
          cat === 'Pengeluaran Cashback Sampah' ||
          (tx.pool === 'Cashback Sampah' && cat !== 'Pengeluaran Gang' && cat !== 'Kas Utama');

        let masukWifi = 0;
        let masukSampah = 0;
        let keluarKasUtama = 0;
        let keluarWifi = 0;
        let keluarSampah = 0;

        if (isMasuk) {
          running += tx.amount;
          if (isWifi) masukWifi = tx.amount;
          else if (isSampah) masukSampah = tx.amount;
        } else {
          running -= tx.amount;
          if (isWifi) keluarWifi = tx.amount;
          else if (isSampah) keluarSampah = tx.amount;
          else keluarKasUtama = tx.amount;
        }

        return {
          id: tx.id,
          tx,
          no: itemNumber++,
          date: formatDateDDMMYYYY(tx.date),
          description: tx.description,
          subCategoryLabel: isWifi
            ? isMasuk ? 'Cashback WiFi' : 'Pengeluaran WiFi'
            : isSampah
            ? isMasuk ? 'Cashback Sampah' : 'Pengeluaran Sampah'
            : cat || 'Pengeluaran Gang',
          isMasuk,
          isWifi,
          isSampah,
          masukWifi,
          masukSampah,
          keluarKasUtama,
          keluarWifi,
          keluarSampah,
          masuk: isMasuk ? tx.amount : 0,
          keluar: isMasuk ? 0 : tx.amount,
          runningBalance: running,
        };
      });

    const totalPengeluaranGang = pengeluaranGangTxs.reduce((s, t) => s + t.amount, 0);
    const totalCashbackDanLainMasuk = cashbackDanKasLainTxs
      .filter((t) => t.type === 'masuk')
      .reduce((s, t) => s + t.amount, 0);
    const totalCashbackDanLainKeluar = cashbackDanKasLainTxs
      .filter((t) => t.type === 'keluar')
      .reduce((s, t) => s + t.amount, 0);

    const totalPemasukanPeriod = (rekapIuranRow ? rekapIuranRow.masuk : 0) + totalCashbackDanLainMasuk;
    const totalPengeluaranPeriod = totalPengeluaranGang + totalCashbackDanLainKeluar;

    return {
      saldoAwalRow,
      rekapIuranRow,
      remainingCashbookRows,
      effectiveTotalIuran,
      effectiveTotalDenda,
      effectiveTotalTunggakan,
      effectiveTotalPenerimaanKas,
      totalPengeluaranGang,
      totalCashbackDanLainMasuk,
      totalCashbackDanLainKeluar,
      totalPemasukanPeriod,
      totalPengeluaranPeriod,
      finalCalculatedSaldo: running,
    };
  }, [
    filteredTransactions,
    prevMonthSummary,
    effectiveMonthKey,
    defaultMonthLabel,
    perKKRecapList,
    recapTotals,
    getHouseStatusForPeriod,
    filterPool,
    searchTx,
  ]);

  // Aggregate totals for the table footer and summary cards
  const tableTotals = useMemo(() => {
    const sumMasukIuran = simplifiedCashbookData.effectiveTotalIuran;
    const sumMasukDenda = simplifiedCashbookData.effectiveTotalDenda;
    const sumMasukTunggakan = simplifiedCashbookData.effectiveTotalTunggakan;

    let sumMasukKasLain = 0;
    let sumMasukWifi = 0;
    let sumMasukSampah = 0;
    let sumKeluarKasUtama = 0;
    let sumKeluarWifi = 0;
    let sumKeluarSampah = 0;

    simplifiedCashbookData.remainingCashbookRows.forEach((item) => {
      sumMasukWifi += item.masukWifi;
      sumMasukSampah += item.masukSampah;
      sumKeluarKasUtama += item.keluarKasUtama;
      sumKeluarWifi += item.keluarWifi;
      sumKeluarSampah += item.keluarSampah;
      if (item.isMasuk && !item.isWifi && !item.isSampah) {
        sumMasukKasLain += item.tx.amount;
      }
    });

    const sumMasukKasUtama = sumMasukIuran + sumMasukDenda + sumMasukTunggakan + sumMasukKasLain;
    const sumMasukCashback = sumMasukWifi + sumMasukSampah;
    const sumKeluarCashback = sumKeluarWifi + sumKeluarSampah;

    const netKasUtama = sumMasukKasUtama - sumKeluarKasUtama;
    const netWifi = sumMasukWifi - sumKeluarWifi;
    const netSampah = sumMasukSampah - sumKeluarSampah;
    const netCashback = sumMasukCashback - sumKeluarCashback;
    const netPeriod = (sumMasukKasUtama + sumMasukCashback) - (sumKeluarKasUtama + sumKeluarCashback);

    const finalKasUtama = prevMonthSummary.kasUtama + netKasUtama;
    const finalWifi = prevMonthSummary.wifiCashback + netWifi;
    const finalSampah = prevMonthSummary.sampahCashback + netSampah;
    const finalCashback = finalWifi + finalSampah;
    const finalSaldo = prevMonthSummary.total + netPeriod;

    return {
      sumMasukIuran,
      sumMasukDenda,
      sumMasukTunggakan,
      sumMasukKasLain,
      sumMasukKasUtama,
      sumMasukWifi,
      sumMasukSampah,
      sumMasukCashback,
      sumKeluarKasUtama,
      sumKeluarWifi,
      sumKeluarSampah,
      sumKeluarCashback,
      netKasUtama,
      netWifi,
      netSampah,
      netCashback,
      netPeriod,
      finalKasUtama,
      finalWifi,
      finalSampah,
      finalCashback,
      finalSaldo,
    };
  }, [simplifiedCashbookData, prevMonthSummary]);


  // Helper to find recorded transactions for a house and period in Buku Kas & Rekap KK
  const findTransactionsForHousePeriod = (house: ResidentHouse, targetPeriod: string): CashTransaction[] => {
    if (!transactions || transactions.length === 0) return [];
    const blockRegex = new RegExp(`\\b${house.blockNumber.replace('/', '\\/')}\\b`, 'i');
    const targetKey = parseIndonesianMonthYearToKey(targetPeriod);
    const targetPeriodLower = targetPeriod.toLowerCase();

    return transactions.filter((tx) => {
      if (tx.type !== 'masuk') return false;
      if (!blockRegex.test(tx.description)) return false;

      const mKey = getMonthKeyFromDate(tx.date);
      const descLower = tx.description.toLowerCase();

      const isIuran = tx.category === 'Iuran Warga' || descLower.includes('iuran');
      const isDenda = tx.category === 'Denda Baksos' || descLower.includes('denda');
      const isTunggakan = tx.category === 'Pembayaran Tunggakan' || descLower.includes('tunggakan');

      if (!isIuran && !isDenda && !isTunggakan) return false;

      if (targetPeriod === 'semua') return true;

      return (targetKey && mKey === targetKey) || descLower.includes(targetPeriodLower);
    });
  };

  // Helper khusus untuk mencari HANYA transaksi Denda Baksos dan Pembayaran Tunggakan untuk KK & periode ini (tanpa menyentuh Iuran Warga)
  const findBaksosAndTunggakanTransactionsForHousePeriod = (
    house: ResidentHouse,
    targetPeriod: string
  ): CashTransaction[] => {
    if (!transactions || transactions.length === 0) return [];
    const blockRegex = new RegExp(`\\b${house.blockNumber.replace('/', '\\/')}\\b`, 'i');
    const targetKey = parseIndonesianMonthYearToKey(targetPeriod);
    const targetPeriodLower = targetPeriod.toLowerCase();

    return transactions.filter((tx) => {
      if (tx.type !== 'masuk') return false;
      if (!blockRegex.test(tx.description)) return false;

      const cat = tx.category || '';
      const descLower = tx.description.toLowerCase();
      const isDenda = cat === 'Denda Baksos' || descLower.includes('denda');
      const isTunggakan = cat === 'Pembayaran Tunggakan' || isTunggakanTx(tx);

      // Pastikan BUKAN transaksi Iuran Warga!
      if (!isDenda && !isTunggakan) return false;

      if (targetPeriod === 'semua') return true;

      const mKey = getMonthKeyFromDate(tx.date);
      return (targetKey && mKey === targetKey) || descLower.includes(targetPeriodLower);
    });
  };

  // Helper untuk mengecek apakah rumah ini memiliki status bayar lebih / iuran lebih dari 1 bulan
  const isHouseAdvancePaid = (house: ResidentHouse, targetPeriod?: string): boolean => {
    if (!house) return false;
    if (house.duesStatus === 'Bayar Lebih') return true;
    if ((house.duesPaidMonths || 0) > 1) return true;
    if ((house.duesPrepaidBalance || 0) > 0) return true;
    if (
      house.duesMonthNote &&
      (house.duesMonthNote.includes(',') ||
        house.duesMonthNote.includes(';') ||
        house.duesMonthNote.includes('+') ||
        house.duesMonthNote.toLowerCase().includes('bulan') ||
        house.duesMonthNote.includes('-'))
    ) {
      return true;
    }
    if (targetPeriod && targetPeriod !== 'semua') {
      const s = getHouseStatusForPeriod(house, targetPeriod);
      if (s.isAdvanceSubsequentMonth || s.status === 'Bayar Lebih') return true;
    }
    return false;
  };

  // Helper to remove recorded transactions for a house and period in Buku Kas & Rekap KK
  const removeTransactionsForHousePeriod = (house: ResidentHouse, targetPeriod: string) => {
    const matchingTxs = findTransactionsForHousePeriod(house, targetPeriod);
    if (matchingTxs.length === 0) return;
    if (onDeleteTransactions) {
      onDeleteTransactions(matchingTxs.map((t) => t.id));
    } else if (onDeleteTransaction) {
      matchingTxs.forEach((tx) => onDeleteTransaction(tx.id));
    }
  };

  // Helper untuk reset/hapus semua pembayaran 1 KK (dan hapus dari Buku Kas)
  const handleResetSingleHousePayment = (house: ResidentHouse, targetPeriod: string) => {
    if (!isAdmin) return;
    const period = targetPeriod || selectedKKPeriod || defaultMonthLabel;

    if (onResetSingleHousePaymentAndSync) {
      onResetSingleHousePaymentAndSync(house.id, period, true);
    } else {
      onUpdateResident({
        ...house,
        duesStatus: 'Belum Bayar',
        duesPaidAmount: 0,
        duesPaidMonths: 0,
        duesPrepaidBalance: 0,
        duesPaidDate: '',
      });
      removeTransactionsForHousePeriod(house, period);
    }

    try {
      confetti({ particleCount: 30, spread: 50, origin: { y: 0.7 } });
    } catch {}

    setDeletingSingleHouse(null);
    setEditingHouseDues(null);
  };

  // Helper untuk konfirmasi hapus total semua pembayaran pada periode tertentu
  const handleConfirmResetAllDues = () => {
    if (!isAdmin) return;
    const targetPeriod = resetAllTargetPeriod || selectedKKPeriod || defaultMonthLabel;

    if (onResetAllDuesPaymentsForPeriod) {
      onResetAllDuesPaymentsForPeriod(targetPeriod, {
        deleteDuesTransactions: resetAllDeleteTxs,
        resetBaksosFines: resetAllResetBaksos,
        resetTunggakanTxs: resetAllResetTunggakan,
      });
    } else {
      residents.forEach((h) => {
        onUpdateResident({
          ...h,
          duesStatus: 'Belum Bayar',
          duesPaidAmount: 0,
          duesPaidMonths: 0,
          duesPrepaidBalance: 0,
          duesPaidDate: '',
        });
        removeTransactionsForHousePeriod(h, targetPeriod);
      });
    }

    try {
      confetti({ particleCount: 40, spread: 60, origin: { y: 0.7 } });
    } catch {}

    setIsResetAllModalOpen(false);
  };

  // TOGGLE DUES STATUS (1-Click Action)
  const handleToggleDues = (house: ResidentHouse) => {
    if (!isAdmin) return;
    const isVacant =
      house.occupancy === 'Kosong' ||
      house.occupancy === 'Belum Ditempati' ||
      isHouseVacant(house);
    const isCurrentlyPaid = house.duesStatus === 'Lunas' || house.duesStatus === 'Bayar Lebih';
    const nextStatus = isCurrentlyPaid ? 'Belum Bayar' : 'Lunas';
    const nominal = getHouseDuesNominal(house) || config.duesAmountPerMonth || 25000;
    const todayStr = new Date().toISOString().slice(0, 10);
    const monthLabel = getHousePeriodLabel(house);
    const displayName = house.duesHeadNameOverride || house.headName;

    onUpdateResident({
      ...house,
      customDuesAmount: house.customDuesAmount || (isVacant ? nominal : undefined),
      duesStatus: nextStatus,
      duesPaidAmount: 0,
      duesPaidMonths: nextStatus === 'Lunas' ? 1 : 0,
      duesPrepaidBalance: 0,
      duesPaidDate: nextStatus === 'Lunas' ? todayStr : '',
      duesMonthNote: monthLabel,
    });

    if (nextStatus === 'Lunas') {
      try {
        confetti({ particleCount: 45, spread: 60, origin: { y: 0.7 } });
      } catch {}
      // Otomatis masukkan ke laporan kas keluar masuk
      onAddTransaction({
        date: todayStr,
        type: 'masuk',
        pool: 'Kas Utama',
        category: 'Iuran Warga',
        description: isVacant
          ? `Iuran Bulanan (${monthLabel}) Warga Blok ${house.blockNumber} (Rumah Kosong - ${displayName})`
          : `Iuran Bulanan (${monthLabel}) Warga Blok ${house.blockNumber} (${displayName})`,
        amount: nominal,
      });
    } else {
      // Otomatis bersihkan transaksi jika dibatalkan ke Belum Bayar
      removeTransactionsForHousePeriod(house, monthLabel);
    }
  };

  // OPEN MODAL FOR EDITING HOUSE DUES (with optional focusTab: 'all' | 'iuran' | 'baksos' | 'tunggakan')
  const handleOpenEditHouseDues = (
    house: ResidentHouse,
    forceMultiMonth: boolean = false,
    focusTab: 'all' | 'iuran' | 'baksos' | 'tunggakan' = 'all'
  ) => {
    if (!isAdmin) return;
    const isVacant =
      house.occupancy === 'Kosong' ||
      isHouseVacant(house);
    const isUnoccupied = house.occupancy === 'Belum Ditempati';
    const nominal = getHouseDuesNominal(house) || config.duesAmountPerMonth || 25000;

    // Pastikan periode dan tanggal pembayaran default sesuai periode yang sedang dipilih di Rekap / Kas
    const currentPeriodStr =
      selectedKKPeriod && selectedKKPeriod !== 'semua'
        ? selectedKKPeriod
        : getHousePeriodLabel(house);

    // Deteksi apakah KK ini memiliki riwayat iuran > 1 bulan (atau dicakup pembayaran di muka)
    const hasAdvanceDues = isHouseAdvancePaid(house, currentPeriodStr);

    const initialStatus = forceMultiMonth
      ? 'Bayar Lebih'
      : (hasAdvanceDues && house.duesStatus === 'Bayar Lebih')
      ? 'Bayar Lebih'
      : house.duesStatus;

    const currentMonths =
      initialStatus === 'Bayar Lebih' || (house.duesPaidMonths && house.duesPaidMonths > 1)
        ? Math.max(2, Math.min(24, house.duesPaidMonths || 2))
        : 1;

    const defaultTotalReceived =
      (initialStatus === 'Bayar Lebih' || (house.duesPaidMonths && house.duesPaidMonths > 1)) && (house.duesPrepaidBalance || 0) > 0
        ? nominal + (house.duesPrepaidBalance || 0)
        : nominal * currentMonths;

    const currentDisplayName = isVacant
      ? (house.duesHeadNameOverride && house.duesHeadNameOverride !== 'Rumah Kosong'
          ? house.duesHeadNameOverride
          : 'Rumah Kosong')
      : isUnoccupied
      ? (house.duesHeadNameOverride || 'Belum Ditempati')
      : (house.duesHeadNameOverride || house.headName || '');

    const periodMonthKey = parseIndonesianMonthYearToKey(currentPeriodStr);
    const todayStr = new Date().toISOString().slice(0, 10);
    let defaultPaidDate = house.duesPaidDate || '';
    if (periodMonthKey && (!defaultPaidDate || !defaultPaidDate.startsWith(periodMonthKey))) {
      defaultPaidDate = todayStr.startsWith(periodMonthKey) ? todayStr : `${periodMonthKey}-01`;
    } else if (!defaultPaidDate) {
      defaultPaidDate = todayStr;
    }

    // Bulan / periode input iuran:
    // PENTING: Jika KK memiliki riwayat iuran > 1 bulan, PERTAHANKAN teks duesMonthNote aslinya (misal: "Mei 2026, Juni 2026")
    // Jangan menimpanya dengan single month currentPeriodStr!
    const initialMonthInput =
      hasAdvanceDues && house.duesMonthNote
        ? house.duesMonthNote
        : currentPeriodStr;

    // Hitung data Denda Baksos yang ada saat ini untuk periode ini
    const baksosInfo = getHouseBaksosForPeriod(house, currentPeriodStr);
    const blockRegex = new RegExp(`\\b${house.blockNumber.replace('/', '\\/')}\\b`, 'i');
    const existingDendaTxs = transactions.filter((t) => {
      if (t.type !== 'masuk') return false;
      const cat = t.category || '';
      const desc = (t.description || '').toLowerCase();
      const isBaksos = cat === 'Denda Baksos' || desc.includes('denda');
      if (!isBaksos || !blockRegex.test(t.description)) return false;
      return periodMonthKey ? getMonthKeyFromDate(t.date) === periodMonthKey : true;
    });
    const existingDendaTxAmount = existingDendaTxs.reduce((s, t) => s + t.amount, 0);
    const finalDendaPaid = Math.max(existingDendaTxAmount, baksosInfo.dendaPaid);

    let initialBaksosStatus: 'Bebas' | 'Lunas' | 'Belum Bayar' | 'Hadir' | 'Tidak Wajib' = 'Bebas';
    let initialBaksosAmount = 10000;
    if (finalDendaPaid > 0) {
      initialBaksosStatus = 'Lunas';
      initialBaksosAmount = finalDendaPaid;
    } else if (baksosInfo.dendaUnpaid > 0) {
      initialBaksosStatus = 'Belum Bayar';
      initialBaksosAmount = baksosInfo.dendaUnpaid;
    } else if (baksosInfo.hadHadir) {
      initialBaksosStatus = 'Hadir';
      initialBaksosAmount = 10000;
    } else if (baksosInfo.hadTidakWajib) {
      initialBaksosStatus = 'Tidak Wajib';
      initialBaksosAmount = 10000;
    } else {
      initialBaksosStatus = 'Bebas';
      initialBaksosAmount = 10000;
    }

    // Hitung data Pembayaran Tunggakan yang ada saat ini untuk periode ini
    const existingTunggakanTxs = transactions.filter((t) => {
      if (t.type !== 'masuk' || !isTunggakanTx(t)) return false;
      if (!blockRegex.test(t.description)) return false;
      return periodMonthKey ? getMonthKeyFromDate(t.date) === periodMonthKey : true;
    });
    const currentTunggakanPaid = existingTunggakanTxs.reduce((s, t) => s + t.amount, 0);

    setEditingHouseDues(house);
    setEditingHouseDuesTab(focusTab);

    // KUNCI: Otomatis aktifkan preserveExistingDues = true saat membuka tab baksos/tunggakan,
    // ATAU bila KK ini memiliki iuran > 1 bulan dan tidak sedang secara eksplisit membuka tab 'iuran'
    const shouldPreserve =
      focusTab === 'baksos' ||
      focusTab === 'tunggakan' ||
      (hasAdvanceDues && focusTab !== 'iuran');
    setPreserveExistingDues(shouldPreserve);

    setHouseDuesOccupancyInput(house.occupancy || 'Ditempati');
    setHouseDuesHeadNameInput(currentDisplayName);
    setHouseDuesAmountInput(nominal);
    setHouseDuesStatusInput(initialStatus);
    setHouseDuesPaidMonthsInput(currentMonths);

    // Inisialisasi daftar bulan kedepannya jika KK ini membayar lebih dari 1 bulan
    const noteParts = (house.duesMonthNote || '').split(/[,;/+]+/).map((s) => s.trim()).filter(Boolean);
    let initialUpcoming: string[] = [];
    if (initialStatus === 'Bayar Lebih' || (house.duesPaidMonths && house.duesPaidMonths > 1) || noteParts.length > 1) {
      if (noteParts.length > 1) {
        initialUpcoming = noteParts.slice(1);
      } else {
        const baseM = (noteParts[0] || currentPeriodStr).trim();
        initialUpcoming = getSubsequentMonthLabels(baseM, Math.max(2, currentMonths)).slice(1);
      }
    }
    setHouseDuesUpcomingMonths(initialUpcoming);

    setHouseDuesTotalReceivedInput(defaultTotalReceived);
    setHouseDuesPartialInput(house.duesPaidAmount || 0);
    setHouseDuesPrevArrearsInput(isVacant ? 0 : (house.previousArrears || 0));
    setHouseDuesPrevNoteInput(house.previousArrearsNote || '');
    setHouseDuesPaidDateInput(defaultPaidDate);
    setHouseDuesMonthInput(initialMonthInput);
    setHouseDuesCustomNoteInput('');

    // Denda Baksos states
    setHouseDuesBaksosStatusInput(initialBaksosStatus);
    setHouseDuesBaksosAmountInput(initialBaksosAmount);
    setHouseDuesBaksosDateInput(existingDendaTxs[0]?.date || defaultPaidDate);
    setHouseDuesBaksosNoteInput(
      existingDendaTxs[0]?.description ||
      `Pelunasan Denda Baksos (${formatRupiah(initialBaksosAmount)}) - Blok ${house.blockNumber} (${currentDisplayName})`
    );

    // Tunggakan states
    setHouseDuesTunggakanPaidInput(currentTunggakanPaid);
    setHouseDuesTunggakanDateInput(existingTunggakanTxs[0]?.date || defaultPaidDate);
    setHouseDuesTunggakanNoteInput(
      existingTunggakanTxs[0]?.description ||
      `Pelunasan Tunggakan Lalu Blok ${house.blockNumber} (${currentDisplayName})`
    );
    setHouseDuesAutoDeductArrears(true);
  };

  // SAVE HOUSE DUES, DENDA BAKSOS, & PEMBAYARAN TUNGGAKAN
  const handleSaveHouseDues = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingHouseDues) return;

    const isVacant = houseDuesOccupancyInput === 'Kosong';
    const isUnoccupied = houseDuesOccupancyInput === 'Belum Ditempati';

    const amountNum = Math.max(0, Number(houseDuesAmountInput) || 0);
    const isNowPaid = houseDuesStatusInput === 'Lunas' || houseDuesStatusInput === 'Bayar Lebih';
    const isAdvancePay = houseDuesStatusInput === 'Bayar Lebih';
    const monthsCount = isAdvancePay ? Math.max(2, Number(houseDuesPaidMonthsInput) || 2) : isNowPaid ? 1 : 0;
    const partialNum = !isNowPaid ? Math.max(0, Math.min(amountNum, Number(houseDuesPartialInput) || 0)) : 0;

    const totalReceived = isAdvancePay
      ? Math.max(amountNum, Number(houseDuesTotalReceivedInput) || amountNum * monthsCount)
      : isNowPaid
      ? amountNum
      : partialNum;

    const prepaidBalance = isAdvancePay ? Math.max(0, totalReceived - amountNum) : 0;
    const baseMonthCandidate = (houseDuesMonthInput.split(/[,;/+]+/)[0] || defaultMonthLabel).trim();
    const autoCoveredList = getSubsequentMonthLabels(baseMonthCandidate, monthsCount);
    const monthLabel = isAdvancePay
      ? (houseDuesMonthInput.includes(',') ? houseDuesMonthInput : autoCoveredList.join(', '))
      : (houseDuesMonthInput.trim() || defaultMonthLabel);
    const targetMonthKey = parseIndonesianMonthYearToKey(baseMonthCandidate) || parseIndonesianMonthYearToKey(monthLabel);
    let paidDateVal = houseDuesPaidDateInput || '';
    if (!paidDateVal) {
      const todayStr = new Date().toISOString().slice(0, 10);
      paidDateVal = (targetMonthKey && !todayStr.startsWith(targetMonthKey)) ? `${targetMonthKey}-01` : todayStr;
    } else if (targetMonthKey && !paidDateVal.startsWith(targetMonthKey)) {
      const dayPart = paidDateVal.slice(8, 10) || '01';
      paidDateVal = `${targetMonthKey}-${dayPart}`;
    }

    const trimmedHeadInput = houseDuesHeadNameInput.trim();
    const finalHeadName = isVacant
      ? (trimmedHeadInput || 'Rumah Kosong')
      : isUnoccupied
      ? (trimmedHeadInput || 'Belum Ditempati')
      : (trimmedHeadInput || editingHouseDues.headName);

    const displayName = finalHeadName || `Blok ${editingHouseDues.blockNumber}`;
    const houseDescLabel = isVacant
      ? `(Rumah Kosong - ${displayName})`
      : `(${displayName})`;

    // Tunggakan lalu profile
    let newPrevArrears = isVacant ? 0 : Math.max(0, Number(houseDuesPrevArrearsInput) || 0);
    const tunggakanPaidNum = isVacant ? 0 : Math.max(0, Number(houseDuesTunggakanPaidInput) || 0);
    if (houseDuesAutoDeductArrears && tunggakanPaidNum > 0) {
      newPrevArrears = Math.max(0, newPrevArrears - tunggakanPaidNum);
    }

    // PENTING: Jika preserveExistingDues aktif, pertahankan status dan riwayat iuran KK (>1 bulan) secara utuh!
    const updatedResident: ResidentHouse = preserveExistingDues
      ? {
          ...editingHouseDues,
          occupancy: houseDuesOccupancyInput,
          headName: finalHeadName,
          duesHeadNameOverride: finalHeadName,
          previousArrears: newPrevArrears,
          previousArrearsNote: isVacant ? '' : houseDuesPrevNoteInput.trim(),
        }
      : {
          ...editingHouseDues,
          occupancy: houseDuesOccupancyInput,
          headName: finalHeadName,
          duesHeadNameOverride: finalHeadName,
          customDuesAmount: amountNum,
          duesStatus: houseDuesStatusInput,
          duesPaidAmount: isNowPaid ? 0 : partialNum,
          duesPaidMonths: monthsCount,
          duesPrepaidBalance: prepaidBalance,
          duesPaidDate: isNowPaid || partialNum > 0 ? paidDateVal : '',
          duesMonthNote: monthLabel,
          previousArrears: newPrevArrears,
          previousArrearsNote: isVacant ? '' : houseDuesPrevNoteInput.trim(),
        };

    // Cari transaksi lama yang akan dihapus:
    let oldTxIdsToDelete: string[] = [];
    if (preserveExistingDues) {
      // HANYA hapus transaksi lama Denda Baksos dan Pembayaran Tunggakan untuk KK & periode ini!
      // JANGAN PERNAH menghapus transaksi Iuran Warga KK ini!
      const activePeriod = selectedKKPeriod && selectedKKPeriod !== 'semua' ? selectedKKPeriod : defaultMonthLabel;
      const oldBaksosTungTxs = findBaksosAndTunggakanTransactionsForHousePeriod(editingHouseDues, activePeriod);
      oldTxIdsToDelete = oldBaksosTungTxs.map((t) => t.id);
    } else {
      // Cari transaksi lama untuk rumah & periode ini agar tidak ada duplikasi transaksi di Buku Kas
      const oldTxsFromMonthLabel = findTransactionsForHousePeriod(editingHouseDues, monthLabel);
      const oldTxsFromSelectedPeriod = selectedKKPeriod && selectedKKPeriod !== 'semua' && selectedKKPeriod !== monthLabel
        ? findTransactionsForHousePeriod(editingHouseDues, selectedKKPeriod)
        : [];
      const oldMatchingMap = new Map<string, CashTransaction>();
      [...oldTxsFromMonthLabel, ...oldTxsFromSelectedPeriod].forEach((t) => oldMatchingMap.set(t.id, t));
      oldTxIdsToDelete = Array.from(oldMatchingMap.keys());
    }

    const newTxs: Omit<CashTransaction, 'id'>[] = [];

    // 1. Masukkan Pembayaran Iuran Kas Bulanan ke Laporan Kas Keluar Masuk HANYA jika preserveExistingDues adalah false!
    if (!preserveExistingDues && totalReceived > 0 && isNowPaid) {
      newTxs.push({
        date: paidDateVal,
        type: 'masuk',
        pool: 'Kas Utama',
        category: 'Iuran Warga',
        description: isAdvancePay
          ? `Iuran Kas Warga Bayar Lebih (${monthLabel}) Warga Blok ${editingHouseDues.blockNumber} ${houseDescLabel}${houseDuesCustomNoteInput.trim() ? ` - ${houseDuesCustomNoteInput.trim()}` : ''}`
          : `Iuran Bulanan (${monthLabel}) Warga Blok ${editingHouseDues.blockNumber} ${houseDescLabel}${houseDuesCustomNoteInput.trim() ? ` - ${houseDuesCustomNoteInput.trim()}` : ''}`,
        amount: totalReceived,
      });

      if (onCreatePeriod && isAdvancePay) {
        const explicitMonths = monthLabel.split(/[,;/+]+/).map((s) => s.trim()).filter(Boolean);
        explicitMonths.forEach((m) => {
          if (m.length >= 4) {
            onCreatePeriod(m, { setActiveCurrentMonth: false, resetNonAdvanceDues: false });
          }
        });
      }
    }

    // 2. Masukkan Pembayaran Denda Baksos jika dipilih Lunas
    const dendaAmountNum = Math.max(0, Number(houseDuesBaksosAmountInput) || 0);
    const dendaDateVal = houseDuesBaksosDateInput || paidDateVal;
    if (houseDuesBaksosStatusInput === 'Lunas' && dendaAmountNum > 0 && !isVacant) {
      newTxs.push({
        date: dendaDateVal,
        type: 'masuk',
        pool: 'Kas Utama',
        category: 'Denda Baksos',
        description:
          houseDuesBaksosNoteInput.trim() ||
          `Pelunasan Denda Baksos (${formatRupiah(dendaAmountNum)}) - Blok ${editingHouseDues.blockNumber} (${displayName})`,
        amount: dendaAmountNum,
      });
    }

    // Sinkronisasi status kehadiran & denda baksos di baksosAgendas
    const effectiveBaksosMonthKey = targetMonthKey || getMonthKeyFromDate(dendaDateVal);
    let updatedBaksosList = baksosAgendas ? [...baksosAgendas] : [];
    if (updatedBaksosList.length > 0) {
      updatedBaksosList = updatedBaksosList.map((agenda) => {
        const aKey = getMonthKeyFromDate(agenda.date);
        if (effectiveBaksosMonthKey && aKey !== effectiveBaksosMonthKey) return agenda;

        const newAtt = { ...(agenda.attendance || {}) };
        const newFines = { ...(agenda.finesPaid || {}) };

        if (houseDuesBaksosStatusInput === 'Lunas') {
          newAtt[editingHouseDues.id] = 'Tidak Hadir';
          newFines[editingHouseDues.id] = true;
        } else if (houseDuesBaksosStatusInput === 'Belum Bayar') {
          newAtt[editingHouseDues.id] = 'Tidak Hadir';
          delete newFines[editingHouseDues.id];
        } else if (houseDuesBaksosStatusInput === 'Hadir') {
          newAtt[editingHouseDues.id] = 'Hadir';
          delete newFines[editingHouseDues.id];
        } else if (houseDuesBaksosStatusInput === 'Tidak Wajib') {
          newAtt[editingHouseDues.id] = 'Tidak Wajib';
          delete newFines[editingHouseDues.id];
        } else if (houseDuesBaksosStatusInput === 'Bebas') {
          delete newAtt[editingHouseDues.id];
          delete newFines[editingHouseDues.id];
        }

        return {
          ...agenda,
          attendance: newAtt,
          finesPaid: newFines,
        };
      });
    }

    // 3. Masukkan Pembayaran Tunggakan ke Laporan Kas Keluar Masuk jika ada nominal pembayaran
    const tunggakanDateVal = houseDuesTunggakanDateInput || paidDateVal;
    if (tunggakanPaidNum > 0 && !isVacant) {
      newTxs.push({
        date: tunggakanDateVal,
        type: 'masuk',
        pool: 'Kas Utama',
        category: 'Pembayaran Tunggakan',
        description:
          houseDuesTunggakanNoteInput.trim() ||
          `Pelunasan Tunggakan Lalu Blok ${editingHouseDues.blockNumber} (${displayName})`,
        amount: tunggakanPaidNum,
      });
    }

    try {
      if (newTxs.length > 0) {
        confetti({ particleCount: 45, spread: 60, origin: { y: 0.7 } });
      }
    } catch {}

    if (onSyncHouseDuesEditAndTransactions) {
      onSyncHouseDuesEditAndTransactions(updatedResident, newTxs, oldTxIdsToDelete, updatedBaksosList);
    } else {
      if (oldTxIdsToDelete.length > 0) {
        if (onDeleteTransactions) {
          onDeleteTransactions(oldTxIdsToDelete);
        } else if (onDeleteTransaction) {
          oldTxIdsToDelete.forEach((id) => onDeleteTransaction(id));
        }
      }
      onUpdateResident(updatedResident);
      newTxs.forEach((tx) => onAddTransaction(tx));
      if (onUpdateBaksosAgenda && updatedBaksosList.length > 0) {
        updatedBaksosList.forEach((ag) => onUpdateBaksosAgenda(ag));
      }
    }

    setEditingHouseDues(null);
  };

  // Helper untuk update otomatis catatan transaksi dan nominal pada pilihan iuran lebih dari 1 bulan
  const updateIuranTxPreview = (
    resId: string,
    months: number,
    startMonth: string,
    customNote: string
  ) => {
    const targetHouse = residents.find((r) => r.id === resId);
    const nom = targetHouse
      ? getHouseDuesNominal(targetHouse) || config.duesAmountPerMonth || 50000
      : config.duesAmountPerMonth || 50000;
    const monthsCount = Math.max(1, months);
    const totalAmount = nom * monthsCount;
    setTxAmount(totalAmount);

    const covered = getSubsequentMonthLabels(startMonth, monthsCount);
    const isMulti = monthsCount > 1;
    const coveredText = isMulti
      ? `${startMonth} - ${covered[covered.length - 1]} (${monthsCount} Bulan)`
      : startMonth;
    const payerName = targetHouse ? targetHouse.duesHeadNameOverride || targetHouse.headName : '';
    const isVacant = targetHouse
      ? targetHouse.occupancy === 'Kosong' ||
        targetHouse.occupancy === 'Belum Ditempati' ||
        isHouseVacant(targetHouse)
      : false;
    const houseTag = targetHouse
      ? ` Blok ${targetHouse.blockNumber} (${isVacant ? `Rumah Kosong - ${payerName}` : payerName})`
      : '';

    const baseDesc = isMulti
      ? `Iuran Kas Warga Lebih dari 1 Bulan (${coveredText})${houseTag}`
      : `Iuran Kas Bulanan (${startMonth})${houseTag}`;

    const notePart = customNote.trim() ? ` - ${customNote.trim()}` : '';
    setTxDescription(`${baseDesc}${notePart}`);
  };

  // ADD / EDIT TRANSACTION
  const handleOpenAddTx = () => {
    const defaultStart = config.duesCurrentMonth || defaultMonthLabel || 'Oktober 2026';
    setEditingTx(null);
    setTxDate(new Date().toISOString().slice(0, 10));
    setTxType('masuk');
    setTxPool('Kas Utama');
    setTxCategory('Iuran Warga');
    setTxDescription(`Iuran Kas Bulanan (${defaultStart})`);
    setTxAmount(config.duesAmountPerMonth || 50000);
    setTxResidentId('');
    setTxIuranMonths(1);
    setTxIuranStartMonth(defaultStart);
    setTxCustomNote('');
    setIsTxModalOpen(true);
  };

  const handleOpenEditTx = (tx: CashTransaction) => {
    setEditingTx(tx);
    setTxDate(tx.date);
    setTxType(tx.type);
    setTxPool(tx.pool);
    setTxCategory(tx.category);
    setTxDescription(tx.description);
    setTxAmount(tx.amount);
    setTxResidentId('');
    setIsTxModalOpen(true);
  };

  const handleSaveTx = (e: React.FormEvent) => {
    e.preventDefault();
    if (!txDescription.trim() || !txAmount || Number(txAmount) <= 0) return;

    const finalAmount = Number(txAmount);

    if (editingTx) {
      onEditTransaction({
        ...editingTx,
        date: txDate,
        type: txType,
        pool: txPool,
        category: txCategory,
        description: txDescription,
        amount: finalAmount,
      });
    } else {
      onAddTransaction({
        date: txDate,
        type: txType,
        pool: txPool,
        category: txCategory,
        description: txDescription,
        amount: finalAmount,
      });

      // Sinkronkan ke KK jika memilih KK
      if (txType === 'masuk' && txCategory === 'Iuran Warga' && txResidentId) {
        const targetHouse = residents.find((r) => r.id === txResidentId);
        if (targetHouse) {
          const isVacant =
            targetHouse.occupancy === 'Kosong' ||
            targetHouse.occupancy === 'Belum Ditempati' ||
            isHouseVacant(targetHouse);
          const nom = getHouseDuesNominal(targetHouse) || config.duesAmountPerMonth || 25000;
          const monthsCount = Math.max(1, txIuranMonths);
          const isAdvance = monthsCount > 1 || finalAmount > nom;
          const coveredList = getSubsequentMonthLabels(txIuranStartMonth.trim() || defaultMonthLabel, monthsCount);

          if (onCreatePeriod && isAdvance) {
            coveredList.forEach((m) => {
              onCreatePeriod(m, { setActiveCurrentMonth: false, resetNonAdvanceDues: false });
            });
          }

          onUpdateResident({
            ...targetHouse,
            customDuesAmount: targetHouse.customDuesAmount || (isVacant ? nom : undefined),
            duesStatus: isAdvance ? 'Bayar Lebih' : 'Lunas',
            duesPaidAmount: 0,
            duesPaidMonths: isAdvance ? monthsCount : 1,
            duesPrepaidBalance: isAdvance ? Math.max(0, finalAmount - nom) : 0,
            duesPaidDate: txDate,
            duesMonthNote: isAdvance ? coveredList.join(', ') : (txIuranStartMonth.trim() || defaultMonthLabel),
          });
        }
      }
    }
    setIsTxModalOpen(false);
  };

  // EXECUTE BATCH IMPORT DUES FROM EXCEL
  const handleBatchImportDues = (
    updatedResidents: ResidentHouse[],
    newTransactions: Omit<CashTransaction, 'id'>[],
    periodLabel: string,
    setAsActivePeriod: boolean
  ) => {
    if (onBatchImportDues) {
      onBatchImportDues(updatedResidents, newTransactions, periodLabel, setAsActivePeriod);
    } else {
      updatedResidents.forEach((r) => onUpdateResident(r));
      newTransactions.forEach((t) => onAddTransaction(t));
      if (onCreatePeriod && periodLabel) {
        onCreatePeriod(periodLabel, { setActiveCurrentMonth: setAsActivePeriod });
      }
    }
  };

  // ADJUST BALANCE MODAL
  const handleOpenAdjustModal = () => {
    setAdjustTargetKas(balances.kasUtama);
    setAdjustTargetWifi(balances.wifiCashback);
    setAdjustTargetSampah(balances.sampahCashback);
    setAdjustReason('Rekonsiliasi / Opname Kas Fisik');
    setIsAdjustModalOpen(true);
  };

  const handleSaveAdjustments = (e: React.FormEvent) => {
    e.preventDefault();
    if (adjustTargetKas !== balances.kasUtama) {
      onAdjustBalance('Kas Utama', adjustTargetKas, adjustReason);
    }
    if (adjustTargetWifi !== balances.wifiCashback) {
      onAdjustBalance('Cashback WiFi', adjustTargetWifi, adjustReason);
    }
    if (adjustTargetSampah !== balances.sampahCashback) {
      onAdjustBalance('Cashback Sampah', adjustTargetSampah, adjustReason);
    }
    setIsAdjustModalOpen(false);
  };

  // CREATE & DELETE PERIOD HANDLERS (Pengurus)
  const handleCreatePeriodSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const periodLabel = `${INDONESIAN_MONTHS[newPeriodMonthIndex]} ${newPeriodYearInput}`;
    if (onCreatePeriod) {
      onCreatePeriod(periodLabel, {
        setActiveCurrentMonth: setAsActiveMonthInput,
        resetNonAdvanceDues: resetNonAdvanceDuesInput,
      });
    }
    try {
      confetti({ particleCount: 45, spread: 60, origin: { y: 0.6 } });
    } catch {}
    setIsPeriodModalOpen(false);
  };

  const handleDeletePeriodSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!deletePeriodSelect) return;
    if (onDeletePeriod) {
      onDeletePeriod(deletePeriodSelect);
    }
    setIsPeriodModalOpen(false);
    setDeletePeriodSelect('');
  };

  // WHATSAPP RECAP BUILDER
  const previewWaText = useMemo(() => {
    const brand = config.brandName || 'Warga Gang Mandor';
    const periodTitle = selectedTxMonth === 'semua' ? 'Semua Periode' : formatMonthYearFromKey(selectedTxMonth);
    const dateNow = new Date().toLocaleDateString('id-ID', { dateStyle: 'long' });

    if (waRecapMode === 'keluar_masuk') {
      return (
        `*LAPORAN KAS KELUAR MASUK — ${brand.toUpperCase()}*\n` +
        `Periode: ${periodTitle} (Per ${dateNow})\n\n` +
        `*1. RINGKASAN SALDO SAAT INI:*\n` +
        `• Saldo Kas Utama: ${formatRupiah(balances.kasUtama)}\n` +
        `• Cashback WiFi: ${formatRupiah(balances.wifiCashback)}\n` +
        `• Cashback Sampah: ${formatRupiah(balances.sampahCashback)}\n` +
        `👉 *TOTAL SALDO: ${formatRupiah(balances.total)}*\n\n` +
        `*2. MUTASI PERIODE INI:*\n` +
        `• Total Masuk: +${formatRupiah(periodSummary.totalInflow)}\n` +
        `  - Iuran Kas: ${formatRupiah(periodSummary.iuranInflow)}\n` +
        `  - WiFi & Sampah: ${formatRupiah(periodSummary.wifiInflow + periodSummary.sampahInflow)}\n` +
        `  - Denda / Lainnya: ${formatRupiah(periodSummary.dendaInflow + periodSummary.otherInflow)}\n` +
        `• Total Keluar: -${formatRupiah(periodSummary.totalOutflow)}\n` +
        `• Arus Kas Bersih: ${periodSummary.netCashflow >= 0 ? '+' : ''}${formatRupiah(periodSummary.netCashflow)}\n\n` +
        `_Transparansi bersama untuk kemakmuran warga._`
      );
    } else if (waRecapMode === 'rekap_total_kk') {
      const occupied = residents.filter((r) => r.occupancy !== 'Kosong');
      return (
        `*REKAP KESELURUHAN KAS PER KK — ${brand.toUpperCase()}*\n` +
        `Gabungan Seluruh Periode: ${sortedPeriods[0] || ''} s/d ${sortedPeriods[sortedPeriods.length - 1] || ''} (Per ${dateNow})\n\n` +
        `*1. TOTAL AKUMULASI PENERIMAAN KAS DARI SELURUH PERIODE:*\n` +
        `• Total Iuran Rutin Terkumpul: ${formatRupiah(overallTotals.sumIuran)}\n` +
        `• Total Pembayaran Denda Baksos: ${formatRupiah(overallTotals.sumDenda)}\n` +
        `• Total Pembayaran Tunggakan: ${formatRupiah(overallTotals.sumTunggakan)}\n` +
        `👉 *TOTAL KESELURUHAN KAS MASUK PER KK: ${formatRupiah(overallTotals.sumGrandTotal)}*\n` +
        `• Total Sisa Tunggakan Belum Lunas: ${formatRupiah(overallTotals.sumRemainingArrears)}\n\n` +
        `*2. TINGKAT KELUNASAN WARGA:*\n` +
        `• Lunas Semua Periode: ${overallStats.lunasCount} KK (${overallStats.pctLunas}%)\n` +
        `• Ada Tunggakan: ${overallStats.tunggakanCount} KK\n` +
        `• Total Rumah Berpenghuni: ${occupied.length} KK\n\n` +
        `*3. DAFTAR KELUNASAN WARGA (RINGKASAN):*\n` +
        overallKKRecapList
          .filter((r) => !r.isPureKosong)
          .map(
            (r, i) =>
              `${i + 1}. Blok ${r.house.blockNumber} (${r.payerName}): Total Masuk ${formatRupiah(
                r.grandTotalAllPeriods
              )} — ${
                r.overallStatus === 'Lunas Semua'
                  ? '✓ LUNAS SEMUA'
                  : r.overallStatus === 'Bayar Lebih'
                  ? '★ BAYAR LEBIH'
                  : `⚠ Sisa Tunggakan: ${formatRupiah(r.remainingArrearsTotal)}`
              }`
          )
          .join('\n') +
        `\n\n_Laporan rekapitulasi gabungan seluruh periode kas terpadu Gang Mandor._`
      );
    } else {
      const occupied = residents.filter((r) => r.occupancy !== 'Kosong');
      const lunasList = occupied.filter((r) => r.duesStatus === 'Lunas' || r.duesStatus === 'Bayar Lebih');
      const belumList = occupied.filter((r) => r.duesStatus === 'Belum Bayar');

      return (
        `*REKAP IURAN KAS PER KK — ${brand.toUpperCase()}*\n` +
        `Bulan: ${defaultMonthLabel} (Per ${dateNow})\n\n` +
        `*Ringkasan:*\n` +
        `• Sudah Bayar: ${lunasList.length} KK\n` +
        `• Belum Bayar: ${belumList.length} KK\n` +
        `• Total Terkumpul: ${formatRupiah(kkStats.totalCollected)}\n\n` +
        (belumList.length > 0
          ? `*Daftar Belum Bayar (${belumList.length} KK):*\n` +
            belumList.map((r, i) => `${i + 1}. Blok ${r.blockNumber} (${r.headName})`).join('\n') +
            '\n\n'
          : 'Alhamdulillah seluruh warga telah lunas iuran bulan ini.\n\n') +
        `_Terima kasih atas partisipasi dan kerukunan seluruh warga._`
      );
    }
  }, [
    config,
    selectedTxMonth,
    balances,
    periodSummary,
    residents,
    defaultMonthLabel,
    kkStats,
    waRecapMode,
    overallTotals,
    overallStats,
    overallKKRecapList,
    sortedPeriods,
  ]);

  // GENERATOR BENTUK GAMBAR BUKU KAS KELUAR MASUK UNTUK WHATSAPP
  const generateWaImageNow = useCallback(async () => {
    setIsGeneratingImage(true);
    try {
      const activePeriodTitle =
        effectiveMonthKey !== 'semua'
          ? formatMonthYearFromKey(effectiveMonthKey)
          : defaultMonthLabel;

      const res = await generateCashbookImage({
        brandName: config.brandName || config.title || 'Warga Gang Mandor Blok K2/25 - K3/24',
        periodLabel: activePeriodTitle,
        prevMonthSummary: {
          prevMonthLabel: prevMonthSummary.prevMonthLabel,
          kasUtama: prevMonthSummary.kasUtama,
          wifiCashback: prevMonthSummary.wifiCashback,
          sampahCashback: prevMonthSummary.sampahCashback,
          total: prevMonthSummary.total,
        },
        rekapIuranRow: simplifiedCashbookData.rekapIuranRow
          ? {
              no: simplifiedCashbookData.rekapIuranRow.no,
              date: simplifiedCashbookData.rekapIuranRow.date,
              description: simplifiedCashbookData.rekapIuranRow.description,
              masuk: simplifiedCashbookData.rekapIuranRow.masuk,
              keluar: 0,
              runningBalance: simplifiedCashbookData.rekapIuranRow.runningBalance,
              effectiveTotalIuran: simplifiedCashbookData.effectiveTotalIuran,
              effectiveTotalDenda: simplifiedCashbookData.effectiveTotalDenda,
              effectiveTotalTunggakan: simplifiedCashbookData.effectiveTotalTunggakan,
            }
          : null,
        cashbookRows: simplifiedCashbookData.remainingCashbookRows.map((r) => ({
          no: r.no,
          date: r.date,
          description: r.description,
          subCategoryLabel: r.subCategoryLabel,
          pool: r.tx.pool,
          isMasuk: r.isMasuk,
          amount: r.tx.amount,
          runningBalance: r.runningBalance,
        })),
        tableTotals,
      });

      setWaImageDataUrl(res.dataUrl);
      setWaImageBlob(res.blob);
    } catch (err) {
      console.error('Failed to generate cashbook image:', err);
    } finally {
      setIsGeneratingImage(false);
    }
  }, [
    config.brandName,
    config.title,
    effectiveMonthKey,
    defaultMonthLabel,
    prevMonthSummary,
    simplifiedCashbookData,
    tableTotals,
  ]);

  // Otomatis generate gambar saat modal dibuka atau periode berganti
  React.useEffect(() => {
    if (isWaModalOpen && waRecapMode === 'gambar_kas') {
      generateWaImageNow();
    }
  }, [isWaModalOpen, waRecapMode, generateWaImageNow]);

  const handleDownloadWaImage = () => {
    if (!waImageDataUrl) return;
    const activePeriod =
      effectiveMonthKey !== 'semua'
        ? formatMonthYearFromKey(effectiveMonthKey)
        : defaultMonthLabel;
    const cleanPeriod = activePeriod.replace(/[^a-zA-Z0-9]/g, '_');
    const a = document.createElement('a');
    a.href = waImageDataUrl;
    a.download = `Laporan_Buku_Kas_${cleanPeriod}.png`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const handleCopyWaImage = async () => {
    if (!waImageBlob) return;
    try {
      if (navigator.clipboard && (window as any).ClipboardItem) {
        await navigator.clipboard.write([
          new (window as any).ClipboardItem({ 'image/png': waImageBlob }),
        ]);
        setCopiedWaImage(true);
        setTimeout(() => setCopiedWaImage(false), 2500);
      } else {
        handleDownloadWaImage();
      }
    } catch {
      handleDownloadWaImage();
    }
  };

  const handleShareWaImage = async () => {
    const activePeriod =
      effectiveMonthKey !== 'semua'
        ? formatMonthYearFromKey(effectiveMonthKey)
        : defaultMonthLabel;
    const cleanPeriod = activePeriod.replace(/[^a-zA-Z0-9]/g, '_');
    const fileName = `Laporan_Buku_Kas_${cleanPeriod}.png`;

    if (waImageBlob && navigator.canShare && navigator.share) {
      try {
        const file = new File([waImageBlob], fileName, { type: 'image/png' });
        if (navigator.canShare({ files: [file] })) {
          await navigator.share({
            files: [file],
            title: `Laporan Kas Gang Mandor - ${activePeriod}`,
            text: `Laporan Buku Kas Keluar & Masuk Gang Mandor Periode ${activePeriod}.\nTotal Sisa Saldo Keseluruhan: ${formatRupiah(tableTotals.finalSaldo)}`,
          });
          return;
        }
      } catch {
        // Fallback below
      }
    }

    handleDownloadWaImage();
    openWhatsAppShare(
      `*LAPORAN BUKU KAS KELUAR & MASUK GANG MANDOR*\nPeriode: ${activePeriod}\n👉 *TOTAL SISA SALDO KESELURUHAN: ${formatRupiah(tableTotals.finalSaldo)}*\n(Kas Utama: ${formatRupiah(tableTotals.finalKasUtama)} | Cashback: ${formatRupiah(tableTotals.finalCashback)})\n\n_Gambar laporan kas berhasil diunduh. Silakan lampirkan gambar ini ke chat WhatsApp._`
    );
  };

  return (
    <div className="space-y-6">
      {/* HEADER SECTION: Luxurious, Vibrant & Modern */}
      {/* HEADER BANNER: 1. Judul di atas -> 2. Deskripsi di bawahnya -> 3. Menu-menu lainnya di bawahnya lagi */}
      <div className="relative overflow-hidden bg-gradient-to-br from-emerald-900 via-teal-900 to-slate-950 text-white rounded-3xl p-6 sm:p-7 shadow-xl border border-emerald-500/30 space-y-4">
        {/* Decorative ambient background glows */}
        <div className="absolute -right-20 -top-20 w-80 h-80 bg-emerald-500/20 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute right-40 -bottom-20 w-64 h-64 bg-teal-400/15 rounded-full blur-2xl pointer-events-none" />

        {/* 1. Judul Halaman di Bagian Atas */}
        <div className="relative z-10 flex items-center gap-2.5 flex-wrap">
          <div className="p-2.5 rounded-2xl bg-white/15 text-white border border-white/25 shadow-sm backdrop-blur-md shrink-0">
            <Wallet className="w-5 h-5 text-amber-300" />
          </div>
          <h2 className="text-xl sm:text-2xl font-black text-white tracking-tight">
            {config.cashSectionTitle || 'Pusat Keuangan Kas & Iuran Warga'}
          </h2>
          <span className="px-3 py-1 rounded-full text-xs font-black bg-amber-400 text-slate-950 shadow-sm uppercase tracking-wider">
            Menu Utama Terpadu
          </span>
        </div>

        {/* 2. Deskripsi Halaman di Bawahnya */}
        <p className="relative z-10 text-xs sm:text-sm text-emerald-100/90 max-w-3xl leading-relaxed">
          {config.cashDescription || 'Pencatatan kas utama, buku mutasi keluar masuk, serta rekapitulasi iuran rutin per KK dalam satu halaman transparansi terpadu.'}
        </p>

        {/* 3. Menu-menu Lainnya di Bawahnya Lagi */}
        <div className="relative z-10 pt-3 border-t border-emerald-700/50 flex flex-wrap items-center gap-2.5">
          {isAdmin && (
            <button
              type="button"
              onClick={handleOpenAddTx}
              className="flex items-center gap-1.5 px-4 py-2 text-xs font-bold bg-amber-400 hover:bg-amber-300 active:scale-[0.98] text-slate-950 rounded-xl shadow-sm transition-all cursor-pointer font-sans"
            >
              <Plus className="w-4 h-4 text-slate-950" />
              <span>Catat Transaksi</span>
            </button>
          )}

          {isAdmin && (
            <button
              type="button"
              onClick={() => setIsUploadDuesModalOpen(true)}
              className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold bg-emerald-500 hover:bg-emerald-400 active:scale-[0.98] text-slate-950 rounded-xl shadow-sm transition-all cursor-pointer font-sans"
              title="Upload Data Iuran Warga Per KK via Excel (.xlsx / .xls)"
            >
              <FileSpreadsheet className="w-4 h-4 text-slate-950" />
              <span>Upload Excel Iuran</span>
            </button>
          )}

          {isAdmin && (
            <button
              type="button"
              onClick={() => {
                setWaCustomText(previewWaText);
                setWaRecapMode('gambar_kas');
                setIsWaModalOpen(true);
              }}
              className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold bg-white/15 hover:bg-white/25 text-white border border-white/25 rounded-xl transition-all cursor-pointer backdrop-blur-xs font-sans"
            >
              <MessageCircle className="w-4 h-4 text-emerald-300" />
              <span>Share WA</span>
            </button>
          )}

          {isAdmin && (
            <button
              type="button"
              onClick={() =>
                exportFinancialReportToExcel({
                  config,
                  transactions,
                  residents,
                  baksosAgendas,
                  balances,
                  exportScope: 'all',
                })
              }
              className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold bg-white/15 hover:bg-white/25 text-white border border-white/25 rounded-xl transition-all cursor-pointer backdrop-blur-xs font-sans"
              title="Download Excel Semua Laporan Keuangan"
            >
              <Download className="w-4 h-4 text-amber-200" />
              <span className="hidden sm:inline">Export</span> Excel
            </button>
          )}

          {isAdmin && (
            <button
              type="button"
              onClick={handleOpenAdjustModal}
              className="p-2 text-white/80 hover:text-white bg-white/10 hover:bg-white/20 rounded-xl border border-white/20 transition-all cursor-pointer"
              title="Koreksi / Sesuaikan Saldo"
            >
              <Sliders className="w-4 h-4 text-amber-200" />
            </button>
          )}
        </div>
      </div>



      {/* UNIFIED SUB-TABS: 1. Buku Kas Keluar & Masuk | 2. Kas Per KK | 3. Rekap Keseluruhan Kas Per KK */}
      <div className="bg-gradient-to-r from-slate-100 via-teal-50/80 to-emerald-50/80 p-1.5 sm:p-2 rounded-2xl border-2 border-emerald-200/90 shadow-sm flex flex-col xl:flex-row items-stretch xl:items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-1.5 sm:gap-2 w-full xl:w-auto">
          <button
            type="button"
            onClick={() => {
              setCurrentSubTab('mutasi');
              if (onSwitchMode) onSwitchMode('kas');
            }}
            className={`flex-1 sm:flex-initial px-3 sm:px-4 py-2.5 rounded-xl text-xs sm:text-sm font-extrabold transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
              currentSubTab === 'mutasi'
                ? 'bg-gradient-to-r from-teal-700 via-emerald-600 to-green-600 text-white shadow-md shadow-emerald-700/25 ring-2 ring-teal-300/80 scale-[1.01]'
                : 'bg-white hover:bg-emerald-50/80 text-teal-950 border border-teal-200 shadow-2xs'
            }`}
          >
            <FileText className="w-4 h-4 text-amber-300" />
            <span>1. Buku Kas (Keluar & Masuk)</span>
            <span
              className={`font-mono text-[11px] font-black px-2 py-0.5 rounded-lg ${
                currentSubTab === 'mutasi'
                  ? 'bg-amber-300 text-slate-950'
                  : 'bg-teal-100 text-teal-900'
              }`}
            >
              {transactions.length}
            </span>
          </button>

          <button
            type="button"
            onClick={() => {
              setCurrentSubTab('per_kk');
              if (onSwitchMode) onSwitchMode('iuran_kk');
            }}
            className={`flex-1 sm:flex-initial px-3 sm:px-4 py-2.5 rounded-xl text-xs sm:text-sm font-extrabold transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
              currentSubTab === 'per_kk'
                ? 'bg-gradient-to-r from-indigo-700 via-blue-600 to-teal-600 text-white shadow-md shadow-indigo-700/25 ring-2 ring-indigo-300/80 scale-[1.01]'
                : 'bg-white hover:bg-indigo-50/80 text-indigo-950 border border-indigo-200 shadow-2xs'
            }`}
          >
            <Users className="w-4 h-4 text-cyan-300" />
            <span>2. Rekap Iuran Kas Per KK</span>
            <span
              className={`font-mono text-[11px] font-black px-2 py-0.5 rounded-lg ${
                currentSubTab === 'per_kk'
                  ? 'bg-amber-300 text-slate-950'
                  : 'bg-indigo-100 text-indigo-900'
              }`}
            >
              {residents.filter((r) => r.occupancy !== 'Kosong').length} KK
            </span>
          </button>

          {isAdmin && (
            <button
              type="button"
              onClick={() => {
                setCurrentSubTab('rekap_total_kk');
                if (onSwitchMode) onSwitchMode('rekap_total_kk');
              }}
              className={`flex-1 sm:flex-initial px-3 sm:px-4 py-2.5 rounded-xl text-xs sm:text-sm font-extrabold transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                currentSubTab === 'rekap_total_kk'
                  ? 'bg-gradient-to-r from-purple-700 via-indigo-700 to-pink-600 text-white shadow-md shadow-purple-700/25 ring-2 ring-purple-300/80 scale-[1.01]'
                  : 'bg-white hover:bg-purple-50/80 text-purple-950 border border-purple-200 shadow-2xs'
              }`}
            >
              <Coins className="w-4 h-4 text-amber-300" />
              <span>3. Rekap Keseluruhan Kas Per KK</span>
              <span
                className={`font-mono text-[11px] font-black px-2 py-0.5 rounded-lg ${
                  currentSubTab === 'rekap_total_kk'
                    ? 'bg-amber-300 text-slate-950'
                    : 'bg-purple-100 text-purple-900'
                }`}
              >
                Semua Periode ({sortedPeriods.length})
              </span>
            </button>
          )}
        </div>

        <div className="hidden lg:flex items-center gap-2 px-3 py-1.5 rounded-xl bg-white/90 border border-teal-200 text-xs font-bold text-teal-950 shadow-2xs">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
          <span>Kolom Buku Kas & Iuran Terpadu</span>
        </div>
      </div>

      {/* VIEW 1: BUKU KAS KELUAR & MASUK */}
      {currentSubTab === 'mutasi' && (
        <div className="bg-gradient-to-b from-white via-slate-50/50 to-emerald-50/20 rounded-3xl border border-slate-200/90 shadow-sm overflow-hidden space-y-5 p-4 sm:p-6">
          {/* Baris Filter Periode & Kategori (Elevated Container with Elegant Tone) */}
          <div className="p-3.5 sm:p-4 rounded-2xl bg-gradient-to-r from-slate-50 via-teal-50/30 to-slate-50 border border-slate-200/90 shadow-2xs space-y-3">
            {/* Baris Filter Periode (Transparansi Penuh: Tersedia untuk Warga & Pengurus) */}
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-2.5">
              <div className="flex flex-wrap items-center gap-1.5 text-xs">
                <span className="font-extrabold text-slate-800 mr-1 flex items-center gap-1.5">
                  <Calendar className="w-4 h-4 text-emerald-600" />
                  Pilih Periode:
                </span>
                {allMonthlyCashflowGroups.map((m) => (
                  <button
                    key={m.monthKey}
                    type="button"
                    onClick={() => {
                      setSelectedTxMonth(m.monthKey);
                      if (m.monthLabel) setSelectedKKPeriod(m.monthLabel);
                    }}
                    className={`px-3 py-1.5 rounded-xl font-extrabold transition-all cursor-pointer ${
                      selectedTxMonth === m.monthKey
                        ? 'bg-emerald-600 text-white shadow-sm ring-1 ring-emerald-400'
                        : 'bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 shadow-2xs'
                    }`}
                  >
                    {m.monthLabel} ({m.transactions.length})
                  </button>
                ))}
              </div>

              {/* Tombol Buat & Hapus Periode untuk Pengurus */}
              {isAdmin && (
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={() => {
                      setPeriodModalTab('tambah');
                      setIsPeriodModalOpen(true);
                    }}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition-all cursor-pointer shadow-xs active:scale-95"
                    title="Tambah Periode Baru Buku Kas dan Iuran"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Buat Periode Baru</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setPeriodModalTab('hapus');
                      setDeletePeriodSelect(availablePeriods[0] || '');
                      setIsPeriodModalOpen(true);
                    }}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 text-xs font-bold transition-all cursor-pointer active:scale-95"
                    title="Hapus Periode Buku Kas dan Iuran"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Hapus Periode</span>
                  </button>
                </div>
              )}
            </div>

            {/* Category / Pool Filter + Search */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2.5 border-t border-slate-200/70">
              {/* Category / Pool Filter Buttons (Khusus Admin: disembunyikan di tampilan warga sesuai instruksi) */}
              {isAdmin && (
                <div className="flex flex-wrap items-center gap-1 text-xs">
                  <button
                    type="button"
                    onClick={() => setFilterPool('semua')}
                    className={`px-3 py-1.5 rounded-xl font-bold transition-all cursor-pointer ${
                      filterPool === 'semua'
                        ? 'bg-slate-900 text-white shadow-xs'
                        : 'bg-white text-slate-700 hover:bg-slate-100 border border-slate-200 shadow-2xs'
                    }`}
                  >
                    Semua ({filteredTransactions.length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setFilterPool('Iuran Warga')}
                    className={`px-3 py-1.5 rounded-xl font-bold transition-all cursor-pointer ${
                      filterPool === 'Iuran Warga'
                        ? 'bg-emerald-700 text-white shadow-xs'
                        : 'bg-emerald-50/90 text-emerald-800 hover:bg-emerald-100 border border-emerald-300 shadow-2xs'
                    }`}
                  >
                    Iuran Warga
                  </button>
                  <button
                    type="button"
                    onClick={() => setFilterPool('Denda Baksos')}
                    className={`px-3 py-1.5 rounded-xl font-bold transition-all cursor-pointer ${
                      filterPool === 'Denda Baksos'
                        ? 'bg-amber-600 text-white shadow-xs'
                        : 'bg-amber-50/90 text-amber-900 hover:bg-amber-100 border border-amber-300 shadow-2xs'
                    }`}
                  >
                    Denda Baksos
                  </button>
                  <button
                    type="button"
                    onClick={() => setFilterPool('Kas Utama')}
                    className={`px-3 py-1.5 rounded-xl font-bold transition-all cursor-pointer ${
                      filterPool === 'Kas Utama'
                        ? 'bg-teal-700 text-white shadow-xs'
                        : 'bg-teal-50/90 text-teal-900 hover:bg-teal-100 border border-teal-300 shadow-2xs'
                    }`}
                  >
                    Kas Utama
                  </button>
                  <button
                    type="button"
                    onClick={() => setFilterPool('Cashback WiFi')}
                    className={`px-3 py-1.5 rounded-xl font-bold transition-all cursor-pointer ${
                      filterPool === 'Cashback WiFi'
                        ? 'bg-cyan-700 text-white shadow-xs'
                        : 'bg-sky-50/90 text-sky-900 hover:bg-sky-100 border border-sky-300 shadow-2xs'
                    }`}
                  >
                    WiFi
                  </button>
                  <button
                    type="button"
                    onClick={() => setFilterPool('Cashback Sampah')}
                    className={`px-3 py-1.5 rounded-xl font-bold transition-all cursor-pointer ${
                      filterPool === 'Cashback Sampah'
                        ? 'bg-teal-700 text-white shadow-xs'
                        : 'bg-teal-50/90 text-teal-900 hover:bg-teal-100 border border-teal-300 shadow-2xs'
                    }`}
                  >
                    Sampah
                  </button>
                  <button
                    type="button"
                    onClick={() => setFilterPool('keluar')}
                    className={`px-3 py-1.5 rounded-xl font-bold transition-all cursor-pointer ${
                      filterPool === 'keluar'
                        ? 'bg-rose-700 text-white shadow-xs'
                        : 'bg-rose-50/90 text-rose-800 hover:bg-rose-100 border border-rose-300 shadow-2xs'
                    }`}
                  >
                    Pengeluaran (-)
                  </button>
                </div>
              )}

              {/* Search Box */}
              <div className={`relative ${isAdmin ? 'w-full sm:w-64' : 'w-full sm:w-80 ml-auto'}`}>
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
                <input
                  type="text"
                  placeholder="Cari transaksi / uraian..."
                  value={searchTx}
                  onChange={(e) => setSearchTx(e.target.value)}
                  className="w-full pl-8 pr-3 py-1.5 text-xs bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500 shadow-2xs transition-all"
                />
              </div>
            </div>
          </div>

          {/* HEADER TABEL BUKU KAS SEDERHANA (HANYA PEMASUKAN & PENGELUARAN, KATEGORI DI DETAIL) */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-1">
            <div>
              <h3 className="font-black text-slate-900 text-sm sm:text-base flex items-center gap-2">
                <Table className="w-4 h-4 text-emerald-700" />
                <span>Tabel Buku Keluar Masuk Kas</span>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-300">
                  Pemasukan &amp; Pengeluaran
                </span>
              </h3>
              <p className="text-[11px] text-slate-500 mt-0.5">
                Menampilkan Saldo Awal, Pemasukan (+), Pengeluaran (-), dan Saldo Berjalan dengan rincian kategori dan pos pada detail transaksi.
              </p>
            </div>
          </div>

          <div className="overflow-x-auto rounded-2xl border border-slate-300/90 shadow-sm bg-white">
            <table className="w-full text-center text-xs border-collapse border border-slate-300">
              <thead>
                <tr className="border-b border-slate-300 bg-gradient-to-r from-emerald-950 via-teal-900 to-slate-900 text-white font-extrabold">
                  <th className="py-3.5 px-2 text-center w-12 border border-slate-300/80 text-white">
                    No
                  </th>
                  <th className="py-3.5 px-3 text-center w-28 border border-slate-300/80 text-white">
                    Tanggal
                  </th>
                  <th className="py-3.5 px-4 text-center min-w-[260px] border border-slate-300/80 text-white">
                    Detail & Uraian Transaksi
                  </th>
                  <th className="py-3.5 px-3 text-center w-36 bg-emerald-700/95 text-white border border-slate-300/80 font-black tracking-wide">
                    PEMASUKAN (+)
                  </th>
                  <th className="py-3.5 px-3 text-center w-36 bg-rose-700/95 text-white border border-slate-300/80 font-black tracking-wide">
                    PENGELUARAN (-)
                  </th>
                  <th className="py-3.5 px-3 text-center w-36 border border-slate-300/80 text-white font-black">
                    Saldo Berjalan
                  </th>
                  <th className="py-3.5 px-2 text-center w-24 border border-slate-300/80 text-white">
                    {isAdmin ? 'Aksi' : 'Status'}
                  </th>
                </tr>
              </thead>

              <tbody className="divide-y divide-slate-300">
                {/* BARIS SALDO BULAN SEBELUMNYA */}
                <tr className="bg-gradient-to-r from-amber-100/90 via-amber-50 to-amber-100/90 font-semibold text-slate-800 border-b-2 border-amber-300 text-center">
                  <td className="py-2.5 px-2 text-center text-amber-900 font-bold border border-slate-300">-</td>
                  <td className="py-2.5 px-3 text-center font-mono text-amber-900 whitespace-nowrap border border-slate-300">
                    {effectiveMonthKey === 'semua' ? 'Awal Catatan' : 'Awal Bulan'}
                  </td>
                  <td className="py-2.5 px-4 text-center border border-slate-300">
                    <div className="font-extrabold text-amber-950 flex items-center justify-center gap-1.5">
                      <span>
                        {effectiveMonthKey === 'semua'
                          ? 'Saldo Awal Pembukuan (Awal Catatan Kas)'
                          : `Saldo Bulan Sebelumnya (${prevMonthSummary.prevMonthLabel})`}
                      </span>
                      {isAdmin && (
                        <button
                          type="button"
                          onClick={handleOpenMayBalanceModal}
                          className="p-1 rounded text-amber-700 hover:text-amber-950 hover:bg-amber-200/80 cursor-pointer"
                          title={
                            effectiveMonthKey === '2026-05' || prevMonthSummary.prevMonthKey === '2026-04'
                              ? 'Edit Saldo Bulan Sebelumnya Periode Mei 2026 (Saldo Awal Inputan Baseline)'
                              : 'Edit Saldo Awal Baseline (April 2026)'
                          }
                        >
                          <Edit2 className="w-3 h-3" />
                        </button>
                      )}
                    </div>
                    <div className="mt-1 flex items-center justify-center gap-1.5 flex-wrap text-[10px]">
                      <span className="px-2 py-0.5 rounded-md font-bold bg-amber-200/90 text-amber-950 border border-amber-300">
                        Kas Utama: {formatRupiah(prevMonthSummary.kasUtama)}
                      </span>
                      <span className="px-2 py-0.5 rounded-md font-bold bg-blue-100 text-blue-900 border border-blue-300">
                        WiFi: {formatRupiah(prevMonthSummary.wifiCashback)}
                      </span>
                      <span className="px-2 py-0.5 rounded-md font-bold bg-teal-100 text-teal-900 border border-teal-300">
                        Sampah: {formatRupiah(prevMonthSummary.sampahCashback)}
                      </span>
                    </div>
                  </td>
                  <td className="py-2.5 px-3 text-center font-mono text-slate-400 border border-slate-300">-</td>
                  <td className="py-2.5 px-3 text-center font-mono text-slate-400 border border-slate-300">-</td>
                  <td className="py-2.5 px-3 text-center font-mono font-extrabold text-amber-950 border border-slate-300">
                    {formatRupiah(prevMonthSummary.total)}
                  </td>
                  <td className="py-2.5 px-2 text-center text-slate-400 font-mono text-[10px] border border-slate-300">-</td>
                </tr>

                {/* BARIS TOTAL PENERIMAAN KAS DARI REKAP IURAN PER KK, DENDA BAKSOS & PEMBAYARAN TUNGGAKAN */}
                {simplifiedCashbookData.rekapIuranRow && (
                  <tr className="bg-emerald-50/70 font-semibold text-slate-800 text-center hover:bg-emerald-100/50 transition-colors">
                    <td className="py-2.5 px-2 text-center font-mono font-bold text-emerald-900 border border-slate-300">
                      {simplifiedCashbookData.rekapIuranRow.no}
                    </td>
                    <td className="py-2.5 px-3 text-center font-mono text-slate-700 whitespace-nowrap border border-slate-300">
                      {simplifiedCashbookData.rekapIuranRow.date}
                    </td>
                    <td className="py-2.5 px-4 text-center border border-slate-300">
                      <div className="font-extrabold text-emerald-950 flex items-center justify-center gap-1.5 flex-wrap">
                        <Users className="w-3.5 h-3.5 text-emerald-700" />
                        <span>{simplifiedCashbookData.rekapIuranRow.description}</span>
                        <span className="px-2 py-0.5 rounded-full bg-emerald-600 text-white text-[10px] font-black shadow-2xs">
                          ✓ Cocok dgn Rekap KK
                        </span>
                      </div>
                      <div className="mt-1 flex items-center justify-center gap-1.5 flex-wrap text-[10px]">
                        <span className="px-2 py-0.5 rounded-full font-bold bg-emerald-100 text-emerald-900 border border-emerald-300">
                          Kategori: Penerimaan Kas Warga
                        </span>
                        <span className="px-2 py-0.5 rounded-full font-medium bg-teal-100 text-teal-900 border border-teal-300">
                          Pos: Kas Utama
                        </span>
                        {simplifiedCashbookData.effectiveTotalIuran > 0 && (
                          <span className="px-2 py-0.5 rounded-full font-semibold bg-emerald-50 text-emerald-800 border border-emerald-200">
                            Iuran: {formatRupiah(simplifiedCashbookData.effectiveTotalIuran)}
                          </span>
                        )}
                        {simplifiedCashbookData.effectiveTotalDenda > 0 && (
                          <span className="px-2 py-0.5 rounded-full font-semibold bg-amber-50 text-amber-900 border border-amber-300">
                            Denda: {formatRupiah(simplifiedCashbookData.effectiveTotalDenda)}
                          </span>
                        )}
                        {simplifiedCashbookData.effectiveTotalTunggakan > 0 && (
                          <span className="px-2 py-0.5 rounded-full font-semibold bg-indigo-50 text-indigo-900 border border-indigo-300">
                            Tunggakan: {formatRupiah(simplifiedCashbookData.effectiveTotalTunggakan)}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="py-2.5 px-3 text-center font-mono font-black text-emerald-800 text-xs sm:text-sm tabular-nums border border-slate-300 bg-emerald-50/90">
                      +{formatRupiah(simplifiedCashbookData.rekapIuranRow.masuk)}
                    </td>
                    <td className="py-2.5 px-3 text-center font-mono text-slate-400 border border-slate-300">-</td>
                    <td className="py-2.5 px-3 text-center font-mono font-extrabold text-slate-900 border border-slate-300">
                      {formatRupiah(simplifiedCashbookData.rekapIuranRow.runningBalance)}
                    </td>
                    <td className="py-2.5 px-2 text-center whitespace-nowrap border border-slate-300">
                      <button
                        type="button"
                        onClick={() => {
                          setCurrentSubTab('per_kk');
                          if (onSwitchMode) onSwitchMode('iuran_kk');
                        }}
                        className="px-2.5 py-1 rounded-lg bg-emerald-100 hover:bg-emerald-200 text-emerald-800 text-[10px] font-bold cursor-pointer transition-all border border-emerald-300 shadow-2xs"
                      >
                        Rekap KK
                      </button>
                    </td>
                  </tr>
                )}

                {/* BARIS-BARIS URAIAN PENGELUARAN GANG, CASHBACK WIFI & SAMPAH, SERTA KAS LAINNYA */}
                {simplifiedCashbookData.remainingCashbookRows.map((item, idx) => {
                  const {
                    tx,
                    no,
                    date,
                    description,
                    subCategoryLabel,
                    isMasuk,
                    isWifi,
                    isSampah,
                    runningBalance,
                  } = item;

                  return (
                    <tr
                      key={tx.id}
                      className={`hover:bg-teal-50/40 transition-colors text-center ${
                        idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/50'
                      }`}
                    >
                      <td className="py-2.5 px-2 text-center font-mono text-slate-500 border border-slate-300">
                        {no}
                      </td>
                      <td className="py-2.5 px-3 text-center font-mono text-slate-700 whitespace-nowrap border border-slate-300">
                        {date}
                      </td>
                      <td className="py-2.5 px-4 text-center border border-slate-300">
                        <div className="font-semibold text-slate-800 leading-snug">{description}</div>
                        <div className="mt-1 flex items-center justify-center gap-1.5 flex-wrap">
                          <span
                            className={`px-2 py-0.5 rounded-full font-bold text-[10px] ${
                              isWifi
                                ? 'bg-blue-100 text-blue-900 border border-blue-300'
                                : isSampah
                                ? 'bg-cyan-100 text-cyan-900 border border-cyan-300'
                                : isMasuk
                                ? 'bg-emerald-100 text-emerald-900 border border-emerald-300'
                                : 'bg-rose-100 text-rose-900 border border-rose-300'
                            }`}
                          >
                            Kategori: {subCategoryLabel}
                          </span>
                          <span className="px-2 py-0.5 rounded-full font-medium text-[10px] bg-slate-100 text-slate-700 border border-slate-300">
                            Pos: {tx.pool}
                          </span>
                        </div>
                      </td>
                      <td className="py-2.5 px-3 text-center font-mono font-bold whitespace-nowrap tabular-nums border border-slate-300">
                        {isMasuk ? (
                          <span className="text-emerald-700 font-black">+{formatRupiah(tx.amount)}</span>
                        ) : (
                          <span className="text-slate-300">-</span>
                        )}
                      </td>
                      <td className="py-2.5 px-3 text-center font-mono font-bold whitespace-nowrap tabular-nums border border-slate-300">
                        {!isMasuk ? (
                          <span className="text-rose-600 font-black">-{formatRupiah(tx.amount)}</span>
                        ) : (
                          <span className="text-slate-300">-</span>
                        )}
                      </td>
                      <td className="py-2.5 px-3 text-center font-mono font-extrabold whitespace-nowrap tabular-nums text-slate-900 border border-slate-300">
                        {formatRupiah(runningBalance)}
                      </td>
                      <td className="py-2.5 px-2 text-center whitespace-nowrap border border-slate-300">
                        {isAdmin ? (
                          <div className="flex items-center justify-center gap-1">
                            <button
                              type="button"
                              onClick={() => handleOpenEditTx(tx)}
                              className="p-1 text-slate-400 hover:text-emerald-700 rounded transition-colors cursor-pointer"
                              title="Edit Transaksi"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>
                            {deleteConfirmId === tx.id ? (
                              <div className="flex items-center gap-1">
                                <button
                                  type="button"
                                  onClick={() => {
                                    onDeleteTransaction(tx.id);
                                    setDeleteConfirmId(null);
                                  }}
                                  className="px-1.5 py-0.5 bg-rose-600 text-white rounded text-[10px] font-bold cursor-pointer"
                                >
                                  Hapus
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setDeleteConfirmId(null)}
                                  className="px-1.5 py-0.5 bg-slate-200 text-slate-600 rounded text-[10px] cursor-pointer"
                                >
                                  Batal
                                </button>
                              </div>
                            ) : (
                              <button
                                type="button"
                                onClick={() => setDeleteConfirmId(tx.id)}
                                className="p-1 text-slate-400 hover:text-rose-600 rounded transition-colors cursor-pointer"
                                title="Hapus Transaksi"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                            <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                            <span>Sah</span>
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>

              <tfoot>
                <tr className="bg-gradient-to-r from-slate-200 via-teal-100/70 to-emerald-100/70 text-slate-950 font-extrabold border-t-2 border-teal-400 text-center">
                  <td className="py-3 px-2 text-center border border-slate-300">-</td>
                  <td className="py-3 px-3 text-center font-mono border border-slate-300 font-bold">Akhir Bulan</td>
                  <td className="py-3 px-4 text-center font-black text-slate-900 border border-slate-300">
                    TOTAL PEMASUKAN, PENGELUARAN & SALDO AKHIR
                  </td>
                  <td className="py-3 px-3 text-center font-mono font-black text-emerald-800 text-xs sm:text-sm border border-slate-300">
                    +{formatRupiah(tableTotals.sumMasukKasUtama + tableTotals.sumMasukCashback)}
                  </td>
                  <td className="py-3 px-3 text-center font-mono font-black text-rose-700 text-xs sm:text-sm border border-slate-300">
                    -{formatRupiah(tableTotals.sumKeluarKasUtama + tableTotals.sumKeluarCashback)}
                  </td>
                  <td className="py-3 px-3 text-center font-mono font-black text-emerald-950 text-sm sm:text-base border border-slate-300">
                    {formatRupiah(tableTotals.finalSaldo)}
                  </td>
                  <td className="py-3 px-2 text-center text-slate-400 font-mono text-[10px] border border-slate-300">-</td>
                </tr>
              </tfoot>
            </table>
          </div>

          {/* PEMISAHAN DETAIL SALDO KAS UTAMA, WIFI, SAMPAH & PENJELASAN PENGELUARAN (Tampil Sama untuk Warga & Pengurus) */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5 text-center pt-2">
            {/* 1. Saldo Bulan Sebelumnya */}
            <div className="relative overflow-hidden bg-gradient-to-br from-amber-50 via-orange-50/70 to-amber-100/70 border-2 border-amber-300 text-amber-950 rounded-2xl p-4 sm:p-5 flex flex-col justify-between shadow-sm hover:shadow-md transition-shadow">
              <div className="absolute top-0 right-0 w-24 h-24 bg-amber-400/10 rounded-full blur-xl pointer-events-none" />
              <div>
                <div className="flex items-center justify-between gap-1.5 text-xs font-extrabold text-amber-900 pb-2 border-b border-amber-200">
                  <div className="flex items-center gap-1.5">
                    <Clock className="w-4 h-4 text-amber-600" />
                    <span>
                      {effectiveMonthKey === 'semua'
                        ? 'SALDO AWAL PEMBUKUAN'
                        : 'SALDO BULAN SEBELUMNYA'}
                    </span>
                  </div>
                  {isAdmin && (
                    <button
                      type="button"
                      onClick={handleOpenMayBalanceModal}
                      className="px-2 py-0.5 rounded-lg bg-amber-200 hover:bg-amber-300 text-amber-950 text-[10px] font-bold flex items-center gap-1 border border-amber-400 cursor-pointer shadow-2xs transition-all shrink-0 active:scale-95"
                      title={
                        effectiveMonthKey === '2026-05' || prevMonthSummary.prevMonthKey === '2026-04'
                          ? 'Edit Saldo Bulan Sebelumnya Periode Mei 2026 (Saldo Awal Inputan Baseline)'
                          : 'Edit Saldo Awal Baseline (April 2026)'
                      }
                    >
                      <Edit2 className="w-3 h-3" />
                      <span>{effectiveMonthKey === '2026-05' ? 'Edit Saldo Awal' : 'Edit Baseline'}</span>
                    </button>
                  )}
                </div>
                <div className="text-[11px] text-amber-800 mt-1.5 font-medium flex items-center justify-between flex-wrap gap-1">
                  <span>
                    {effectiveMonthKey === 'semua'
                      ? 'Periode: Awal Catatan Kas'
                      : `Periode: ${prevMonthSummary.prevMonthLabel}`}
                  </span>
                  {effectiveMonthKey !== 'semua' && (
                    <span className="text-[9px] bg-amber-200/90 text-amber-950 px-2 py-0.5 rounded-md font-bold border border-amber-300/80">
                      Otomatis Dari Bulan Sebelumnya
                    </span>
                  )}
                </div>
                <div className="mt-3 space-y-1.5 text-xs font-mono text-center">
                  <div className="flex justify-between items-center text-slate-800 px-2.5 py-1 rounded-xl bg-white/90 border border-amber-200/80 shadow-2xs">
                    <span className="font-sans text-[11px] font-semibold text-slate-700">Saldo Kas Utama:</span>
                    <span className="font-bold text-emerald-800 tabular-nums">{formatRupiah(prevMonthSummary.kasUtama)}</span>
                  </div>
                  <div className="flex justify-between items-center text-slate-800 px-2.5 py-1 rounded-xl bg-white/90 border border-amber-200/80 shadow-2xs">
                    <span className="font-sans text-[11px] font-semibold text-slate-700">Saldo Cashback WiFi:</span>
                    <span className="font-bold text-blue-800 tabular-nums">{formatRupiah(prevMonthSummary.wifiCashback)}</span>
                  </div>
                  <div className="flex justify-between items-center text-slate-800 px-2.5 py-1 rounded-xl bg-white/90 border border-amber-200/80 shadow-2xs">
                    <span className="font-sans text-[11px] font-semibold text-slate-700">Saldo Cashback Sampah:</span>
                    <span className="font-bold text-teal-800 tabular-nums">{formatRupiah(prevMonthSummary.sampahCashback)}</span>
                  </div>
                </div>
              </div>
              <div className="mt-3.5 pt-2.5 border-t border-amber-200/80 text-center bg-gradient-to-r from-amber-600 via-amber-700 to-orange-600 text-white rounded-xl p-2.5 shadow-sm">
                <span className="text-[11px] font-extrabold uppercase tracking-wider block text-amber-100">
                  {effectiveMonthKey === 'semua' ? 'TOTAL SALDO AWAL PEMBUKUAN' : 'TOTAL SALDO BULAN SEBELUMNYA'}
                </span>
                <span className="font-mono text-base font-black text-amber-200 tabular-nums">
                  {formatRupiah(prevMonthSummary.total)}
                </span>
              </div>
            </div>

            {/* 2. Pemasukan & Pengeluaran Kas Utama (Diberikan Nomor Urut Lengkap 1-8 + Sisa Saldo WiFi & Sampah) */}
            <div className="relative overflow-hidden bg-gradient-to-br from-emerald-50 via-teal-50/80 to-green-100/70 border-2 border-emerald-300 text-emerald-950 rounded-2xl p-4 sm:p-5 flex flex-col justify-between shadow-sm hover:shadow-md transition-shadow">
              <div className="absolute top-0 right-0 w-24 h-24 bg-emerald-400/10 rounded-full blur-xl pointer-events-none" />
              <div>
                <div className="flex items-center justify-center gap-1.5 text-xs font-black text-emerald-950 pb-2 border-b-2 border-emerald-300">
                  <Wallet className="w-4 h-4 text-emerald-700" />
                  <span>KAS UTAMA PERIODE INI</span>
                </div>
                <div className="mt-3 space-y-1.5 text-xs font-mono text-center">
                  {/* 1. Total Penerimaan Kas */}
                  <div className="flex justify-between items-center text-emerald-950 px-2.5 py-1.5 rounded-xl bg-white/95 border-2 border-emerald-200 shadow-2xs">
                    <span className="font-sans text-[11px] font-bold text-emerald-900">1. Total Penerimaan Kas (+):</span>
                    <span className="font-bold text-emerald-700 tabular-nums">+{formatRupiah(tableTotals.sumMasukKasUtama)}</span>
                  </div>

                  {/* 2. Pengeluaran Kas */}
                  <div className="flex justify-between items-center text-slate-800 px-2.5 py-1.5 rounded-xl bg-white/90 border border-amber-200 shadow-2xs">
                    <span className="font-sans text-[11px] font-bold text-slate-800">2. Pengeluaran Kas (-):</span>
                    <span className="font-bold text-rose-600 tabular-nums">-{formatRupiah(tableTotals.sumKeluarKasUtama)}</span>
                  </div>

                  {/* 3. Arus Kas Bersih */}
                  <div className="flex justify-between items-center px-2.5 py-1.5 rounded-xl bg-teal-100/90 border border-teal-300 font-bold shadow-2xs">
                    <span className="font-sans text-[11px] text-teal-950">3. Arus Kas Bersih:</span>
                    <span className={`tabular-nums ${tableTotals.netKasUtama >= 0 ? 'text-teal-900' : 'text-rose-700'}`}>
                      {tableTotals.netKasUtama >= 0 ? '+' : ''}{formatRupiah(tableTotals.netKasUtama)}
                    </span>
                  </div>
                </div>
              </div>
              <div className="mt-3.5 pt-2.5 border-t border-emerald-300 text-center bg-gradient-to-r from-emerald-700 via-teal-700 to-cyan-800 text-white rounded-xl p-2.5 shadow-sm">
                <span className="text-[11px] font-extrabold uppercase tracking-wider block text-emerald-100">
                  SISA SALDO KAS UTAMA
                </span>
                <span className="font-mono text-base font-black text-amber-300 tabular-nums">
                  {formatRupiah(tableTotals.finalKasUtama)}
                </span>
              </div>
            </div>

            {/* 3. Pemasukan & Pengeluaran Saldo Cashback (Terpisah WiFi & Sampah) */}
            <div className="relative overflow-hidden bg-gradient-to-br from-sky-50 via-cyan-50/80 to-blue-100/70 border-2 border-sky-300 text-sky-950 rounded-2xl p-4 sm:p-5 flex flex-col justify-between shadow-sm hover:shadow-md transition-shadow">
              <div className="absolute top-0 right-0 w-24 h-24 bg-sky-400/10 rounded-full blur-xl pointer-events-none" />
              <div>
                <div className="flex items-center justify-center gap-1.5 text-xs font-extrabold text-cyan-950 pb-2 border-b border-cyan-200">
                  <Wifi className="w-4 h-4 text-cyan-700" />
                  <span>SALDO CASHBACK (WIFI & SAMPAH)</span>
                </div>
                <div className="mt-3 space-y-2 text-xs font-mono text-center">
                  {/* Pos Cashback WiFi */}
                  <div className="p-2.5 rounded-xl bg-white/95 border-2 border-blue-200 shadow-2xs space-y-1">
                    <div className="text-[11px] font-bold text-blue-950 flex justify-between items-center">
                      <span className="font-sans font-bold text-blue-900">1. Saldo Cashback WiFi:</span>
                      <span className="font-mono font-black text-blue-800 bg-blue-50 px-2 py-0.5 rounded-md border border-blue-200 tabular-nums">{formatRupiah(tableTotals.finalWifi)}</span>
                    </div>
                    <div className="flex justify-between text-[10px]">
                      <span className="text-slate-600 font-sans">Masuk:</span>
                      <span className="text-blue-700 font-bold tabular-nums">+{formatRupiah(tableTotals.sumMasukWifi)}</span>
                    </div>
                    <div className="flex justify-between text-[10px]">
                      <span className="text-slate-600 font-sans">Keluar:</span>
                      <span className="text-rose-600 font-bold tabular-nums">-{formatRupiah(tableTotals.sumKeluarWifi)}</span>
                    </div>
                  </div>

                  {/* Pos Cashback Sampah */}
                  <div className="p-2.5 rounded-xl bg-white/95 border-2 border-teal-200 shadow-2xs space-y-1">
                    <div className="text-[11px] font-bold text-teal-950 flex justify-between items-center">
                      <span className="font-sans font-bold text-teal-900">2. Saldo Cashback Sampah:</span>
                      <span className="font-mono font-black text-teal-800 bg-teal-50 px-2 py-0.5 rounded-md border border-teal-200 tabular-nums">{formatRupiah(tableTotals.finalSampah)}</span>
                    </div>
                    <div className="flex justify-between text-[10px]">
                      <span className="text-slate-600 font-sans">Masuk:</span>
                      <span className="text-teal-700 font-bold tabular-nums">+{formatRupiah(tableTotals.sumMasukSampah)}</span>
                    </div>
                    <div className="flex justify-between text-[10px]">
                      <span className="text-slate-600 font-sans">Keluar:</span>
                      <span className="text-rose-600 font-bold tabular-nums">-{formatRupiah(tableTotals.sumKeluarSampah)}</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Sisa Saldo Cashback Akhir WiFi & Sampah */}
              <div className="mt-3.5 pt-2.5 border-t border-cyan-200 space-y-1.5 font-mono text-xs">
                <div className="flex justify-between items-center px-2.5 py-1.5 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 text-white border border-blue-500 font-bold shadow-2xs">
                  <span className="font-sans text-[11px] text-blue-100">Sisa Saldo Akhir Cashback WiFi:</span>
                  <span className="text-amber-300 font-black tabular-nums">{formatRupiah(tableTotals.finalWifi)}</span>
                </div>
                <div className="flex justify-between items-center px-2.5 py-1.5 rounded-xl bg-gradient-to-r from-teal-600 to-cyan-700 text-white border border-teal-500 font-bold shadow-2xs">
                  <span className="font-sans text-[11px] text-teal-100">Sisa Saldo Akhir Cashback Sampah:</span>
                  <span className="text-amber-300 font-black tabular-nums">{formatRupiah(tableTotals.finalSampah)}</span>
                </div>

                <div className="mt-2.5 pt-2 border-t border-cyan-200/80 text-center bg-gradient-to-r from-blue-700 via-indigo-700 to-cyan-800 text-white rounded-xl p-2.5 shadow-sm">
                  <span className="text-[11px] font-extrabold uppercase tracking-wider block text-cyan-100">
                    TOTAL SALDO CASHBACK
                  </span>
                  <span className="font-mono text-base font-black text-amber-300 tabular-nums">
                    {formatRupiah(tableTotals.finalCashback)}
                  </span>
                </div>

                {/* TOTAL SISA SALDO KESELURUHAN KEUANGAN GANG DI BAWAH TOTAL SALDO CASHBACK */}
                <div className="mt-2.5 pt-2.5 border-t-2 border-emerald-400 text-center bg-gradient-to-br from-emerald-950 via-teal-900 to-slate-900 text-white rounded-xl p-3 shadow-md border border-emerald-400/70">
                  <span className="text-[11px] font-black uppercase tracking-wider block text-emerald-200">
                    TOTAL SISA SALDO KESELURUHAN KEUANGAN GANG
                  </span>
                  <span className="font-mono text-lg font-black text-amber-300 tabular-nums block mt-0.5">
                    {formatRupiah(tableTotals.finalSaldo)}
                  </span>
                  <span className="text-[10px] text-emerald-100/80 block mt-0.5 font-sans">
                    (Kas Utama: {formatRupiah(tableTotals.finalKasUtama)} + Cashback: {formatRupiah(tableTotals.finalCashback)})
                  </span>
                </div>
              </div>
            </div>
          </div>



        </div>
      )}

      {/* VIEW 2: REKAP IURAN KAS PER KK */}
      {currentSubTab === 'per_kk' && (
        <div className="bg-gradient-to-b from-white via-slate-50/50 to-indigo-50/20 rounded-3xl border border-slate-200/90 shadow-sm overflow-hidden space-y-5 p-4 sm:p-6">
          {/* Header & Stats (Warga: Khusus Bulan Berjalan. Pengurus: Bisa Buat & Hapus Periode + Ganti Periode) */}
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 pb-4 border-b border-slate-100">
            <div>
              <div className="flex items-center gap-2.5">
                <div className="p-2.5 rounded-2xl bg-teal-600 text-white shadow-sm shrink-0">
                  <Users className="w-5 h-5 text-amber-200" />
                </div>
                <div>
                  <h3 className="font-black text-slate-900 text-base sm:text-lg flex items-center gap-2">
                    <span>Rekap Pembayaran Iuran Kas Per KK</span>
                    {isAdmin ? (
                      <span className="px-2.5 py-0.5 rounded-full bg-teal-100 text-teal-800 text-[10px] font-black uppercase tracking-wider border border-teal-200">
                        Mode Pengurus
                      </span>
                    ) : (
                      <span className="px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-700 text-[10px] font-black uppercase tracking-wider border border-slate-200">
                        Informasi Warga
                      </span>
                    )}
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Pencatatan status kelunasan dan riwayat pembayaran iuran rutin per kepala keluarga ({formatRupiah(config.duesAmountPerMonth || 50000)}/bulan).
                  </p>
                </div>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {/* Tombol Buat & Hapus Periode untuk Pengurus */}
              {isAdmin && (
                <>
                  <button
                    type="button"
                    onClick={() => setIsUploadDuesModalOpen(true)}
                    className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 active:scale-95 text-white text-xs font-bold cursor-pointer shadow-xs transition-all font-sans"
                    title="Upload Data Iuran Warga Per KK via Excel (.xlsx / .xls)"
                  >
                    <FileSpreadsheet className="w-3.5 h-3.5 text-indigo-100" />
                    <span>Upload Excel Iuran</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setPeriodModalTab('tambah');
                      setIsPeriodModalOpen(true);
                    }}
                    className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white text-xs font-bold cursor-pointer shadow-xs transition-all font-sans"
                    title="Buat Periode Baru Iuran KK & Buku Kas"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Buat Periode Baru</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setPeriodModalTab('hapus');
                      setDeletePeriodSelect(availablePeriods[0] || '');
                      setIsPeriodModalOpen(true);
                    }}
                    className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-rose-50 hover:bg-rose-100 active:scale-95 text-rose-700 border border-rose-200 text-xs font-bold cursor-pointer transition-all font-sans"
                    title="Hapus Periode Iuran KK & Buku Kas"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Hapus Periode</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setResetAllTargetPeriod(selectedKKPeriod !== 'semua' ? selectedKKPeriod : defaultMonthLabel);
                      setIsResetAllModalOpen(true);
                    }}
                    className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 active:scale-95 text-white text-xs font-bold cursor-pointer shadow-xs transition-all font-sans"
                    title="Hapus / Kosongkan Total Semua Pembayaran Periode Terpilih & Bersihkan dari Buku Kas"
                  >
                    <RotateCcw className="w-3.5 h-3.5 text-rose-200" />
                    <span>Hapus Total Semua Pembayaran</span>
                  </button>
                </>
              )}
            </div>
          </div>

          {/* BAR FILTER PERIODE, MODE TAMPILAN, STATUS & PENCARIAN */}
          <div className="p-3.5 sm:p-4 rounded-2xl bg-gradient-to-r from-slate-50 via-indigo-50/30 to-slate-50 border border-slate-200/90 shadow-2xs space-y-3">
            {/* Baris 1: Pilihan Periode Bulan & Switcher Mode Tampilan */}
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
              {/* Filter Periode Bulan */}
              <div className="flex flex-wrap items-center gap-1.5 text-xs">
                <span className="font-extrabold text-slate-800 mr-1 flex items-center gap-1.5">
                  <Calendar className="w-4 h-4 text-emerald-600" />
                  Pilih Periode:
                </span>
                {sortedPeriods.map((p) => {
                  const isCur = p === defaultMonthLabel;
                  return (
                    <button
                      key={p}
                      type="button"
                      onClick={() => {
                        setSelectedKKPeriod(p);
                        const pKey = parseIndonesianMonthYearToKey(p);
                        if (pKey) setSelectedTxMonth(pKey);
                      }}
                      className={`px-3 py-1.5 rounded-xl font-extrabold transition-all cursor-pointer ${
                        selectedKKPeriod === p
                          ? 'bg-emerald-600 text-white shadow-sm ring-1 ring-emerald-400'
                          : 'bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 shadow-2xs'
                      }`}
                    >
                      {p} {isCur ? '★' : ''}
                    </button>
                  );
                })}
              </div>

              {/* Indikator Legenda Warna Baris & Sel Otomatis */}
              <div className="flex flex-wrap items-center gap-2 p-2 bg-white/95 rounded-2xl border border-slate-200/90 shadow-2xs text-[11px] font-bold self-start lg:self-auto backdrop-blur-xs">
                <span className="text-slate-600 font-extrabold px-1">Pewarnaan Kolom & Sel:</span>
                <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-100 text-emerald-950 border border-emerald-300 shadow-2xs">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-600"></span>
                  Hijau: Sudah Bayar
                </span>
                <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-rose-100 text-rose-950 border border-rose-300 shadow-2xs">
                  <span className="w-2.5 h-2.5 rounded-full bg-rose-600"></span>
                  Merah: Menunggak
                </span>
                <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-sky-100 text-sky-950 border border-sky-300 shadow-2xs">
                  <span className="w-2.5 h-2.5 rounded-full bg-sky-600"></span>
                  Biru Muda: Bayar &gt;1 Bln
                </span>
                <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-900 text-white border border-slate-700 shadow-2xs">
                  <span className="w-2.5 h-2.5 rounded-full bg-white"></span>
                  Hitam: Rumah Kosong
                </span>
              </div>
            </div>

            {/* Baris 2: Filter Status & Search Input */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2.5 border-t border-slate-200/70">
              <div className="flex flex-wrap items-center gap-1.5 text-xs">
                <button
                  type="button"
                  onClick={() => setDuesFilter('semua')}
                  className={`px-3 py-1.5 rounded-xl font-bold transition-all cursor-pointer ${
                    duesFilter === 'semua'
                      ? 'bg-slate-900 text-white shadow-xs'
                      : 'bg-white text-slate-700 hover:bg-slate-100 border border-slate-200 shadow-2xs'
                  }`}
                >
                  Semua Status ({residents.length})
                </button>
                <button
                  type="button"
                  onClick={() => setDuesFilter('Lunas')}
                  className={`px-3 py-1.5 rounded-xl font-bold transition-all cursor-pointer ${
                    duesFilter === 'Lunas'
                      ? 'bg-emerald-600 text-white shadow-xs'
                      : 'bg-emerald-50/90 text-emerald-900 hover:bg-emerald-100 border border-emerald-300 shadow-2xs'
                  }`}
                >
                  Lunas
                </button>
                <button
                  type="button"
                  onClick={() => setDuesFilter('Bayar Lebih')}
                  className={`px-3 py-1.5 rounded-xl font-bold transition-all cursor-pointer ${
                    duesFilter === 'Bayar Lebih'
                      ? 'bg-indigo-600 text-white shadow-xs'
                      : 'bg-indigo-50/90 text-indigo-900 hover:bg-indigo-100 border border-indigo-300 shadow-2xs'
                  }`}
                >
                  Bayar Lebih (&gt;1 Bln)
                </button>
                <button
                  type="button"
                  onClick={() => setDuesFilter('Belum Bayar')}
                  className={`px-3 py-1.5 rounded-xl font-bold transition-all cursor-pointer ${
                    duesFilter === 'Belum Bayar'
                      ? 'bg-rose-600 text-white shadow-xs'
                      : 'bg-rose-50/90 text-rose-900 hover:bg-rose-100 border border-rose-300 shadow-2xs'
                  }`}
                >
                  Belum Bayar
                </button>
              </div>

              <div className="relative w-full sm:w-64">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
                <input
                  type="text"
                  placeholder="Cari nama / nomor blok..."
                  value={searchKK}
                  onChange={(e) => setSearchKK(e.target.value)}
                  className="w-full pl-8 pr-3 py-1.5 text-xs bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500 shadow-2xs transition-all"
                />
              </div>
            </div>
          </div>

          {/* TABEL REKAP IURAN PER KK */}
          <div className="space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between text-xs text-slate-600 gap-1.5 pb-1">
                <span className="font-extrabold text-slate-900 flex items-center gap-1.5">
                  <Table className="w-4 h-4 text-emerald-600" />
                  <span>
                    Tabel Rekap Pembayaran Iuran Per KK {selectedKKPeriod !== 'semua' ? `— Periode ${selectedKKPeriod}` : ''} ({filteredPerKKList.length} KK)
                  </span>
                </span>
                <span className="text-[11px] text-slate-500 font-medium">
                  Rekapitulasi Iuran Kas Per Kepala Keluarga Gang Mandor Blok K2/25 s/d K3/24
                </span>
              </div>

              <div className="overflow-x-auto rounded-2xl border border-slate-300/90 shadow-sm bg-white">
                <table className="w-full text-left text-xs border-collapse border border-slate-300 whitespace-nowrap">
                  <thead>
                    <tr className="bg-gradient-to-r from-slate-900 via-teal-950 to-indigo-950 text-white font-extrabold border-b border-slate-300">
                      <th className="py-3 px-2 text-center w-12 border border-slate-300/70 text-white">No</th>
                      <th className="py-3 px-3 text-center border border-slate-300/70 text-white">No Blok</th>
                      <th className="py-3 px-4 min-w-[180px] border border-slate-300/70 text-white">Nama Kepala Keluarga</th>
                      <th className="py-3 px-3 text-center border border-slate-300/70 text-white">Periode Iuran</th>
                      <th className="py-3 px-3 text-right border border-slate-300/70 text-white">Iuran Bulanan</th>
                      <th className="py-3 px-3 text-center border border-slate-300/70 text-white">Pembayaran Denda Baksos</th>
                      <th className="py-3 px-3 text-right border border-slate-300/70 text-white">Pembayaran Tunggakan</th>
                      <th className="py-3 px-3 text-center border border-slate-300/70 text-white">Tanggal Pembayaran</th>
                      <th className="py-3 px-4 text-right border border-slate-300/70 text-white">Total Semua Pembayaran</th>
                      <th className="py-3 px-3 text-center border border-slate-300/70 text-white w-28">Aksi</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-300">
                    {recapRows.length === 0 ? (
                      <tr>
                        <td colSpan={10} className="py-8 text-center text-slate-400 italic border border-slate-300">
                          Tidak ada data rekap pembayaran untuk filter ini.
                        </td>
                      </tr>
                    ) : (
                      recapRows.map((row) => {
                        const {
                          item,
                          idx,
                          house,
                          isPureKosong,
                          isUnoccupied,
                          isRumahKosongHitam,
                          periodStr,
                          statusInfo,
                          nominal,
                          isAdvanceSubsequent,
                          iuranPaid,
                          payerName,
                          baksosInfo,
                          dendaPaid,
                          tunggakanPaid,
                          paidDate,
                          totalSemua,
                          isBayarLebih,
                          isSudahBayar,
                          isMenunggak,
                          rowCellClass,
                        } = row;

                        return (
                          <tr
                            key={house.id}
                            className={`transition-colors border-b ${
                              isRumahKosongHitam
                                ? 'bg-black text-white border-neutral-800 hover:bg-neutral-900'
                                : isBayarLebih
                                ? 'bg-sky-50 text-sky-950 border-sky-300 hover:bg-sky-100/60'
                                : isSudahBayar
                                ? 'bg-emerald-50 text-emerald-950 border-emerald-300 hover:bg-emerald-100/60'
                                : 'bg-rose-50 text-rose-950 border-rose-300 hover:bg-rose-100/60'
                            }`}
                          >
                            {/* 1. No */}
                            <td className={`py-2.5 px-2 text-center font-mono border ${rowCellClass} ${isRumahKosongHitam ? 'text-slate-300' : 'text-slate-600'}`}>
                              {idx + 1}
                            </td>

                            {/* 2. No Blok */}
                            <td className={`py-2.5 px-3 text-center border ${rowCellClass}`}>
                              <span
                                className={`font-mono text-xs font-bold px-2 py-0.5 rounded-lg border shadow-2xs ${
                                  isRumahKosongHitam
                                    ? 'bg-neutral-900 text-white border-neutral-700'
                                    : isBayarLebih
                                    ? 'bg-sky-200/90 text-sky-950 border-sky-400'
                                    : isSudahBayar
                                    ? 'bg-emerald-200/90 text-emerald-950 border-emerald-400'
                                    : 'bg-rose-200/90 text-rose-950 border-rose-400'
                                }`}
                              >
                                Blok {house.blockNumber}
                              </span>
                            </td>

                            {/* 3. Nama Kepala Keluarga */}
                            <td className={`py-2.5 px-4 border ${rowCellClass}`}>
                              <div className="flex items-center justify-between gap-1.5">
                                {payerName ? (
                                  <span
                                    className={`font-bold ${
                                      isRumahKosongHitam
                                        ? 'text-white'
                                        : isBayarLebih
                                        ? 'text-sky-950'
                                        : isSudahBayar
                                        ? 'text-emerald-950'
                                        : 'text-rose-950'
                                    }`}
                                  >
                                    {payerName}
                                  </span>
                                ) : (
                                  <span
                                    onClick={() => isAdmin && handleOpenEditHouseDues(house, false)}
                                    className={`text-xs italic cursor-pointer ${
                                      isAdmin
                                        ? 'text-indigo-600 hover:text-indigo-800 underline decoration-dotted font-semibold'
                                        : 'text-slate-400'
                                    }`}
                                    title="Klik untuk input nama kepala keluarga"
                                  >
                                    {isAdmin ? '+ Input Nama KK' : '-'}
                                  </span>
                                )}
                                {isAdmin && (
                                  <button
                                    type="button"
                                    onClick={() => handleOpenEditHouseDues(house, false)}
                                    className={`p-1 rounded transition-colors cursor-pointer shrink-0 ${
                                      isRumahKosongHitam
                                        ? 'text-slate-400 hover:text-white hover:bg-neutral-800'
                                        : 'text-slate-400 hover:text-emerald-700 hover:bg-emerald-100/60'
                                    }`}
                                    title="Edit Nama KK / Iuran Ini"
                                  >
                                    <Edit2 className="w-3.5 h-3.5" />
                                  </button>
                                )}
                              </div>
                            </td>

                            {/* 4. Periode Iuran */}
                            <td className={`py-2.5 px-3 text-center font-bold border ${rowCellClass} ${isRumahKosongHitam ? 'text-slate-300' : 'text-slate-700'}`}>
                              {periodStr}
                            </td>

                            {/* 5. Iuran Bulanan */}
                            <td
                              onClick={() => isAdmin && handleOpenEditHouseDues(house, false, 'iuran')}
                              className={`py-2.5 px-3 text-right font-mono tabular-nums border ${rowCellClass} ${
                                isAdmin
                                  ? 'cursor-pointer hover:ring-2 hover:ring-emerald-400/70 hover:bg-emerald-100/40 transition-all'
                                  : ''
                              }`}
                              title={isAdmin ? 'Klik untuk edit Iuran Bulanan KK ini' : ''}
                            >
                              <div className="flex items-center justify-end gap-1.5">
                                {isAdvanceSubsequent ? (
                                  <div className="flex flex-col items-end">
                                    <span className="font-bold text-emerald-800">Rp 0</span>
                                    <span className="text-[10px] font-sans font-bold text-emerald-700 bg-emerald-100/90 px-2 py-0.5 rounded-md border border-emerald-300 mt-0.5 shadow-2xs">
                                      ✓ Lunas (Tanpa Isian)
                                    </span>
                                  </div>
                                ) : iuranPaid > 0 ? (
                                  <span className={`font-bold ${isRumahKosongHitam ? 'text-emerald-400' : isBayarLebih ? 'text-sky-900' : isSudahBayar ? 'text-emerald-800' : 'text-slate-700'}`}>
                                    +{formatRupiah(iuranPaid)}
                                  </span>
                                ) : isRumahKosongHitam ? (
                                  <span className="text-slate-400 font-semibold italic text-[11px]">Bebas Iuran (Rp 0)</span>
                                ) : (
                                  <span className="text-rose-700 font-bold">Rp 0 (Belum Bayar)</span>
                                )}
                                {isAdmin && (
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleOpenEditHouseDues(house, false, 'iuran');
                                    }}
                                    className={`p-1 rounded-md transition-colors cursor-pointer shrink-0 ${
                                      isRumahKosongHitam
                                        ? 'text-slate-400 hover:text-white hover:bg-neutral-800'
                                        : 'text-slate-400 hover:text-emerald-700 hover:bg-emerald-100/70'
                                    }`}
                                    title="Edit Iuran Bulanan KK ini"
                                  >
                                    <Edit2 className="w-3.5 h-3.5" />
                                  </button>
                                )}
                              </div>
                            </td>

                            {/* 6. Pembayaran Denda Baksos */}
                            <td
                              onClick={() => isAdmin && handleOpenEditHouseDues(house, false, 'baksos')}
                              className={`py-2.5 px-3 text-center border ${rowCellClass} ${
                                isAdmin
                                  ? 'cursor-pointer hover:ring-2 hover:ring-teal-400/80 hover:bg-teal-100/40 transition-all'
                                  : ''
                              }`}
                              title={isAdmin ? 'Klik untuk edit Pembayaran Denda Baksos KK ini' : ''}
                            >
                              <div className="flex items-center justify-center gap-1.5">
                                {dendaPaid > 0 ? (
                                  <div className="flex flex-col items-center justify-center">
                                    <span className="font-mono font-black text-emerald-800 text-xs sm:text-sm tabular-nums">
                                      +{formatRupiah(dendaPaid)}
                                    </span>
                                    <span className="text-[10px] font-bold text-emerald-800 bg-emerald-100/90 px-2 py-0.5 rounded-md border border-emerald-300 mt-0.5 shadow-2xs">
                                      ✓ Denda Baksos Lunas
                                    </span>
                                  </div>
                                ) : baksosInfo.dendaUnpaid > 0 ? (
                                  <div className="flex flex-col items-center justify-center">
                                    <span className="font-mono font-bold text-rose-700 text-xs tabular-nums">
                                      Rp 0
                                    </span>
                                    <span className="text-[10px] font-bold text-rose-700 bg-rose-100/90 px-2 py-0.5 rounded-md border border-rose-300 mt-0.5 shadow-2xs">
                                      Denda {formatRupiah(baksosInfo.dendaUnpaid)} Belum Bayar
                                    </span>
                                  </div>
                                ) : baksosInfo.hadHadir ? (
                                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300 shadow-2xs">
                                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                                    <span>Hadir (Bebas)</span>
                                  </span>
                                ) : baksosInfo.hadTidakWajib ? (
                                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-semibold bg-slate-100 text-slate-700 border border-slate-200">
                                    Tidak Wajib
                                  </span>
                                ) : isRumahKosongHitam ? (
                                  <span className="text-[10px] text-slate-400 italic">
                                    Bebas (Kosong)
                                  </span>
                                ) : (
                                  <span className="text-slate-400 font-mono text-center block">-</span>
                                )}
                                {isAdmin && (
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleOpenEditHouseDues(house, false, 'baksos');
                                    }}
                                    className={`p-1 rounded-md transition-colors cursor-pointer shrink-0 ${
                                      isRumahKosongHitam
                                        ? 'text-slate-400 hover:text-white hover:bg-neutral-800'
                                        : 'text-slate-400 hover:text-teal-700 hover:bg-teal-100/70'
                                    }`}
                                    title="Edit Pembayaran Denda Baksos KK ini"
                                  >
                                    <Edit2 className="w-3.5 h-3.5" />
                                  </button>
                                )}
                              </div>
                            </td>

                            {/* 7. Pembayaran Tunggakan */}
                            <td
                              onClick={() => isAdmin && handleOpenEditHouseDues(house, false, 'tunggakan')}
                              className={`py-2.5 px-3 text-right font-mono tabular-nums border ${rowCellClass} ${
                                isAdmin
                                  ? 'cursor-pointer hover:ring-2 hover:ring-rose-400/80 hover:bg-rose-100/40 transition-all'
                                  : ''
                              }`}
                              title={isAdmin ? 'Klik untuk edit Pembayaran Tunggakan KK ini' : ''}
                            >
                              <div className="flex items-center justify-end gap-1.5">
                                {tunggakanPaid > 0 ? (
                                  <span className="text-rose-600 font-black">+{formatRupiah(tunggakanPaid)}</span>
                                ) : (
                                  <span className={isRumahKosongHitam ? 'text-neutral-500' : 'text-slate-400'}>-</span>
                                )}
                                {isAdmin && (
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleOpenEditHouseDues(house, false, 'tunggakan');
                                    }}
                                    className={`p-1 rounded-md transition-colors cursor-pointer shrink-0 ${
                                      isRumahKosongHitam
                                        ? 'text-slate-400 hover:text-white hover:bg-neutral-800'
                                        : 'text-slate-400 hover:text-rose-700 hover:bg-rose-100/70'
                                    }`}
                                    title="Edit Pembayaran Tunggakan KK ini"
                                  >
                                    <Edit2 className="w-3.5 h-3.5" />
                                  </button>
                                )}
                              </div>
                            </td>

                            {/* 8. Tanggal Pembayaran */}
                            <td className={`py-2.5 px-3 text-center font-mono text-[11px] border ${rowCellClass} ${isRumahKosongHitam ? 'text-slate-300' : 'text-slate-700'}`}>
                              {paidDate ? formatDateDDMMYYYY(paidDate) : '-'}
                            </td>

                            {/* 9. Total Semua Pembayaran */}
                            <td className={`py-2.5 px-4 text-right font-mono tabular-nums border ${rowCellClass}`}>
                              <div className="flex flex-col items-end">
                                {isRumahKosongHitam ? (
                                  <>
                                    <span className="font-mono font-bold text-white">
                                      {totalSemua > 0 ? `+${formatRupiah(totalSemua)}` : 'Rp 0'}
                                    </span>
                                    <span className="text-[10px] font-sans font-bold text-slate-400">
                                      {isUnoccupied ? 'Belum Ditempati (Bebas)' : 'Rumah Kosong (Bebas)'}
                                    </span>
                                  </>
                                ) : isAdvanceSubsequent ? (
                                  <>
                                    <span className="font-mono font-black text-emerald-950">
                                      {totalSemua > 0 ? `+${formatRupiah(totalSemua)}` : 'Rp 0'}
                                    </span>
                                    <span className="text-[10px] font-sans font-extrabold text-emerald-800">
                                      ✓ Lunas (Bayar di Muka)
                                    </span>
                                  </>
                                ) : isBayarLebih ? (
                                  <>
                                    <span className="font-mono font-black text-sky-950">
                                      +{formatRupiah(totalSemua)}
                                    </span>
                                    <span className="text-[10px] font-sans font-extrabold text-sky-800">
                                      {house.duesPaidMonths && house.duesPaidMonths > 1
                                        ? `Bayar Lebih ${house.duesPaidMonths - 1} Bln (Total ${house.duesPaidMonths} Bln)`
                                        : 'Bayar Lebih'}
                                    </span>
                                  </>
                                ) : isSudahBayar ? (
                                  <>
                                    <span className="font-mono font-black text-emerald-950">
                                      +{formatRupiah(totalSemua)}
                                    </span>
                                    <span className="text-[10px] font-sans font-extrabold text-emerald-800">
                                      Sudah Bayar (Lunas)
                                    </span>
                                  </>
                                ) : (
                                  <>
                                    <span className="font-mono font-black text-rose-950">
                                      {totalSemua > 0 ? `+${formatRupiah(totalSemua)}` : 'Rp 0'}
                                    </span>
                                    <span className="text-[10px] font-sans font-extrabold text-rose-800">
                                      Menunggak
                                    </span>
                                  </>
                                )}
                              </div>
                            </td>

                            {/* 10. Aksi Edit & Hapus Pembayaran */}
                            <td className={`py-2 px-2.5 text-center border ${rowCellClass}`}>
                              {isAdmin ? (
                                <div className="flex items-center justify-center gap-1">
                                  <button
                                    type="button"
                                    onClick={() => handleOpenEditHouseDues(house, false)}
                                    className="px-2 py-1 text-[11px] font-bold bg-white/95 hover:bg-white text-indigo-700 hover:text-indigo-900 border border-indigo-200 hover:border-indigo-400 rounded-lg shadow-2xs transition-all flex items-center gap-1 cursor-pointer active:scale-95"
                                    title="Edit Iuran & Catatan Pembayaran KK Ini"
                                  >
                                    <Edit2 className="w-3 h-3" />
                                    <span>Edit</span>
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => setDeletingSingleHouse({ house, period: periodStr })}
                                    disabled={!isSudahBayar && !isBayarLebih && totalSemua === 0 && house.duesStatus === 'Belum Bayar'}
                                    className={`px-2 py-1 text-[11px] font-bold rounded-lg shadow-2xs transition-all flex items-center gap-1 cursor-pointer active:scale-95 border ${
                                      isSudahBayar || isBayarLebih || totalSemua > 0 || house.duesStatus !== 'Belum Bayar'
                                        ? 'bg-rose-50 hover:bg-rose-100 text-rose-700 border-rose-200 hover:border-rose-400'
                                        : 'bg-slate-100/60 text-slate-400 border-slate-200 cursor-not-allowed opacity-40'
                                    }`}
                                    title={
                                      isSudahBayar || isBayarLebih || totalSemua > 0 || house.duesStatus !== 'Belum Bayar'
                                        ? "Hapus & Batalkan Pembayaran KK Ini (Otomatis bersihkan dari Buku Kas)"
                                        : "Tidak ada pembayaran untuk dihapus"
                                    }
                                  >
                                    <Trash2 className="w-3 h-3" />
                                    <span>Hapus</span>
                                  </button>
                                </div>
                              ) : (
                                <span className="text-slate-400 font-mono text-center block text-[11px]">-</span>
                              )}
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                  <tfoot>
                    <tr className="bg-gradient-to-r from-slate-200 via-indigo-100/70 to-emerald-100/70 font-black text-slate-950 border-t-2 border-indigo-300">
                      <td colSpan={4} className="py-3 px-4 text-left border border-slate-300 text-slate-900 font-extrabold">
                        TOTAL SEMUA ({filteredPerKKList.length} KK)
                      </td>
                      <td className="py-3 px-3 text-right font-mono text-emerald-800 border border-slate-300 font-black">
                        +{formatRupiah(recapTotals.sumIuran)}
                      </td>
                      <td className="py-3 px-3 text-center font-mono text-emerald-800 border border-slate-300 font-black">
                        {recapTotals.sumDenda > 0 ? `+${formatRupiah(recapTotals.sumDenda)}` : 'Rp 0'}
                      </td>
                      <td className="py-3 px-3 text-right font-mono text-rose-600 border border-slate-300 font-black">
                        +{formatRupiah(recapTotals.sumTunggakan)}
                      </td>
                      <td className="py-3 px-3 text-center text-slate-400 border border-slate-300">
                        -
                      </td>
                      <td className="py-3 px-4 text-right font-mono text-emerald-950 font-black text-sm border border-slate-300">
                        +{formatRupiah(recapTotals.sumTotal)}
                      </td>
                      <td className="py-3 px-3 text-center text-slate-400 border border-slate-300">
                        -
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>

              {/* STATUS PENCOCOKAN BUKU KAS & REKAP IURAN PER KK */}
              <div className="p-3.5 rounded-2xl bg-gradient-to-r from-emerald-50 via-teal-50/80 to-emerald-50 border-2 border-emerald-300 shadow-2xs flex flex-col md:flex-row items-center justify-between gap-3 text-xs">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-emerald-600 text-white flex items-center justify-center shadow-xs shrink-0">
                    <CheckCircle2 className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <div className="font-extrabold text-emerald-950 flex items-center gap-2 text-sm">
                      <span>Pencocokan Buku Kas & Rekap Iuran Per KK: 100% Cocok</span>
                      <span className="px-2 py-0.5 rounded-md bg-emerald-600 text-white text-[10px] font-black uppercase tracking-wider">
                        Sinkron
                      </span>
                    </div>
                    <div className="text-slate-600 text-[11px] mt-0.5 flex items-center gap-2 flex-wrap">
                      <span>Periode: <strong className="text-slate-900">{selectedKKPeriod}</strong></span>
                      <span>•</span>
                      <span>Iuran Rutin: <strong className="text-emerald-800">{formatRupiah(recapTotals.sumIuran)}</strong></span>
                      <span>•</span>
                      <span>Denda Baksos: <strong className="text-emerald-800">{formatRupiah(recapTotals.sumDenda)}</strong></span>
                      <span>•</span>
                      <span>Tunggakan: <strong className="text-rose-700">{formatRupiah(recapTotals.sumTunggakan)}</strong></span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-3 shrink-0 bg-white/90 px-3.5 py-1.5 rounded-xl border border-emerald-200">
                  <div className="text-right">
                    <div className="text-[10px] text-slate-500 font-semibold uppercase">Total Penerimaan Kas</div>
                    <div className="font-mono text-base font-black text-emerald-800">
                      +{formatRupiah(recapTotals.sumTotal)}
                    </div>
                  </div>
                </div>
              </div>
            </div>

        </div>
      )}

      {/* VIEW 3: REKAP KESELURUHAN KAS PER KK (MENGGABUNGKAN TOTAL SEMUA PERIODE REKAP IURAN PER KK) - HANYA UNTUK PENGURUS/ADMIN */}
      {isAdmin && currentSubTab === 'rekap_total_kk' && (
        <div className="bg-gradient-to-b from-white via-slate-50/50 to-purple-50/20 rounded-3xl border border-slate-200/90 shadow-sm overflow-hidden space-y-5 p-4 sm:p-6">
          {/* Header & Stats (Transparansi Penuh untuk Warga & Pengurus) */}
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 pb-4 border-b border-slate-100">
            <div>
              <div className="flex items-center gap-2.5">
                <div className="p-2.5 rounded-2xl bg-gradient-to-br from-purple-700 via-indigo-700 to-pink-600 text-white shadow-sm shrink-0">
                  <Coins className="w-5 h-5 text-amber-200" />
                </div>
                <div>
                  <h3 className="font-black text-slate-900 text-base sm:text-lg flex items-center gap-2 flex-wrap">
                    <span>3. Rekap Keseluruhan Kas Per KK</span>
                    <span className="px-2.5 py-0.5 rounded-full bg-purple-100 text-purple-800 text-[10px] font-black uppercase tracking-wider border border-purple-200">
                      Gabungan Semua Periode ({sortedPeriods.length})
                    </span>
                    {isAdmin ? (
                      <span className="px-2.5 py-0.5 rounded-full bg-teal-100 text-teal-800 text-[10px] font-black uppercase tracking-wider border border-teal-200">
                        Mode Pengurus
                      </span>
                    ) : (
                      <span className="px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-700 text-[10px] font-black uppercase tracking-wider border border-slate-200">
                        Informasi Warga
                      </span>
                    )}
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Rekapitulasi gabungan total seluruh periode pembayaran iuran bulanan warga ({formatRupiah(config.duesAmountPerMonth || 25000)}/bulan), penerimaan denda baksos, dan penyelesaian tunggakan per kepala keluarga.
                  </p>
                </div>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() =>
                  exportFinancialReportToExcel({
                    config,
                    transactions,
                    residents,
                    baksosAgendas,
                    balances,
                    exportScope: 'rekap_total_only',
                  })
                }
                className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-purple-600 hover:bg-purple-700 active:scale-95 text-white text-xs font-bold cursor-pointer shadow-xs transition-all font-sans"
                title="Download Data Rekap Keseluruhan Kas Per KK ke Microsoft Excel (.xlsx)"
              >
                <Download className="w-3.5 h-3.5 text-purple-200" />
                <span>Export Excel Rekap Semua KK</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setWaRecapMode('rekap_total_kk');
                  setWaCustomText('');
                  setIsWaModalOpen(true);
                }}
                className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white text-xs font-bold cursor-pointer shadow-xs transition-all font-sans"
                title="Bagikan Rekapitulasi Keseluruhan Kas Per KK ke WhatsApp"
              >
                <MessageCircle className="w-3.5 h-3.5 text-emerald-200" />
                <span>Share WhatsApp Rekap</span>
              </button>
            </div>
          </div>

          {/* 5 KARTU STATISTIK GABUNGAN SEMUA PERIODE */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2.5 sm:gap-3">
            <div className="p-3.5 rounded-2xl bg-gradient-to-br from-purple-50 via-indigo-50/60 to-pink-50/40 border border-purple-200 shadow-2xs space-y-1">
              <div className="flex items-center justify-between text-slate-500 text-[11px] font-bold">
                <span>Grand Total Kas Masuk</span>
                <Coins className="w-4 h-4 text-purple-600" />
              </div>
              <div className="font-mono text-sm sm:text-base font-black text-purple-900">
                +{formatRupiah(overallTotals.sumGrandTotal)}
              </div>
              <p className="text-[10px] text-slate-500 font-medium">Dari seluruh KK &amp; periode</p>
            </div>

            <div className="p-3.5 rounded-2xl bg-gradient-to-br from-emerald-50 via-teal-50/60 to-emerald-50/40 border border-emerald-200 shadow-2xs space-y-1">
              <div className="flex items-center justify-between text-slate-500 text-[11px] font-bold">
                <span>Total Iuran Bulanan</span>
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              </div>
              <div className="font-mono text-sm sm:text-base font-black text-emerald-900">
                +{formatRupiah(overallTotals.sumIuran)}
              </div>
              <p className="text-[10px] text-slate-500 font-medium">Akumulasi iuran rutin warga</p>
            </div>

            <div className="p-3.5 rounded-2xl bg-gradient-to-br from-cyan-50 via-sky-50/60 to-blue-50/40 border border-cyan-200 shadow-2xs space-y-1">
              <div className="flex items-center justify-between text-slate-500 text-[11px] font-bold">
                <span>Total Denda Baksos</span>
                <Users className="w-4 h-4 text-cyan-600" />
              </div>
              <div className="font-mono text-sm sm:text-base font-black text-cyan-900">
                +{formatRupiah(overallTotals.sumDenda)}
              </div>
              <p className="text-[10px] text-slate-500 font-medium">Denda ketidakhadiran lunas</p>
            </div>

            <div className="p-3.5 rounded-2xl bg-gradient-to-br from-amber-50 via-orange-50/60 to-yellow-50/40 border border-amber-200 shadow-2xs space-y-1">
              <div className="flex items-center justify-between text-slate-500 text-[11px] font-bold">
                <span>Total Bayar Tunggakan</span>
                <TrendingUp className="w-4 h-4 text-amber-600" />
              </div>
              <div className="font-mono text-sm sm:text-base font-black text-amber-900">
                +{formatRupiah(overallTotals.sumTunggakan)}
              </div>
              <p className="text-[10px] text-slate-500 font-medium">Tunggakan lampau diselesaikan</p>
            </div>

            <div className="col-span-2 sm:col-span-1 p-3.5 rounded-2xl bg-gradient-to-br from-indigo-50 via-purple-50/60 to-slate-50 border border-indigo-200 shadow-2xs space-y-1">
              <div className="flex items-center justify-between text-slate-500 text-[11px] font-bold">
                <span>Tingkat Kepatuhan</span>
                <BarChart3 className="w-4 h-4 text-indigo-600" />
              </div>
              <div className="font-mono text-sm sm:text-base font-black text-indigo-900">
                {overallStats.pctLunas}% Tertib
              </div>
              <p className="text-[10px] text-slate-500 font-medium">
                {overallStats.lunasCount} dari {overallStats.totalOccupied} KK lunas semua
              </p>
            </div>
          </div>

          {/* BARIS KONTROL, FILTER, MODE TAMPILAN & PENCARIAN */}
          <div className="p-3.5 sm:p-4 rounded-2xl bg-gradient-to-r from-slate-50 via-purple-50/30 to-slate-50 border border-slate-200/90 shadow-2xs space-y-3">
            {/* Baris 1: Filter Periode Info & Switcher Mode Tampilan (Ringkas vs Matriks Lengkap) */}
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-1.5 text-xs">
                <span className="font-extrabold text-slate-800 mr-1 flex items-center gap-1.5">
                  <Calendar className="w-4 h-4 text-purple-600" />
                  Periode yang Digabungkan ({sortedPeriods.length}):
                </span>
                {sortedPeriods.map((p) => (
                  <span
                    key={p}
                    className="px-2.5 py-1 rounded-xl bg-purple-100 text-purple-900 border border-purple-200 font-bold text-[11px] shadow-2xs"
                  >
                    {p}
                  </span>
                ))}
              </div>

              <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-white border border-purple-200 text-xs font-bold text-purple-950 shadow-2xs self-start lg:self-auto">
                <span className="w-2 h-2 rounded-full bg-purple-600 animate-pulse" />
                <span>Matriks Lengkap Seluruh Periode</span>
              </div>
            </div>

            {/* Baris 2: Filter Status Kelunasan & Pencarian KK */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2.5 border-t border-slate-200/70">
              <div className="flex flex-wrap items-center gap-1.5 text-xs">
                <button
                  type="button"
                  onClick={() => setFilterOverallStatus('semua')}
                  className={`px-3 py-1.5 rounded-xl font-bold transition-all cursor-pointer ${
                    filterOverallStatus === 'semua'
                      ? 'bg-slate-900 text-white shadow-xs'
                      : 'bg-white text-slate-700 hover:bg-slate-100 border border-slate-200 shadow-2xs'
                  }`}
                >
                  Semua ({overallKKRecapList.length})
                </button>
                <button
                  type="button"
                  onClick={() => setFilterOverallStatus('Lunas Semua')}
                  className={`px-3 py-1.5 rounded-xl font-bold transition-all cursor-pointer ${
                    filterOverallStatus === 'Lunas Semua'
                      ? 'bg-emerald-600 text-white shadow-xs'
                      : 'bg-emerald-50/90 text-emerald-900 hover:bg-emerald-100 border border-emerald-300 shadow-2xs'
                  }`}
                >
                  Lunas Semua Periode ({overallStats.lunasCount})
                </button>
                <button
                  type="button"
                  onClick={() => setFilterOverallStatus('Bayar Lebih')}
                  className={`px-3 py-1.5 rounded-xl font-bold transition-all cursor-pointer ${
                    filterOverallStatus === 'Bayar Lebih'
                      ? 'bg-sky-600 text-white shadow-xs'
                      : 'bg-sky-50/90 text-sky-900 hover:bg-sky-100 border border-sky-300 shadow-2xs'
                  }`}
                >
                  Bayar Lebih ({overallStats.bayarLebihCount})
                </button>
                <button
                  type="button"
                  onClick={() => setFilterOverallStatus('Ada Tunggakan')}
                  className={`px-3 py-1.5 rounded-xl font-bold transition-all cursor-pointer ${
                    filterOverallStatus === 'Ada Tunggakan'
                      ? 'bg-rose-600 text-white shadow-xs'
                      : 'bg-rose-50/90 text-rose-900 hover:bg-rose-100 border border-rose-300 shadow-2xs'
                  }`}
                >
                  Ada Tunggakan ({overallStats.tunggakanCount})
                </button>
                <button
                  type="button"
                  onClick={() => setFilterOverallStatus('Kosong')}
                  className={`px-3 py-1.5 rounded-xl font-bold transition-all cursor-pointer ${
                    filterOverallStatus === 'Kosong'
                      ? 'bg-neutral-900 text-white shadow-xs'
                      : 'bg-neutral-100 text-neutral-800 hover:bg-neutral-200 border border-neutral-300 shadow-2xs'
                  }`}
                >
                  Rumah Kosong ({overallKKRecapList.filter((r) => r.isPureKosong).length})
                </button>
              </div>

              <div className="relative w-full sm:w-64">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
                <input
                  type="text"
                  placeholder="Cari nama KK / nomor blok..."
                  value={searchOverall}
                  onChange={(e) => setSearchOverall(e.target.value)}
                  className="w-full pl-8 pr-3 py-1.5 text-xs bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500/30 focus:border-purple-500 shadow-2xs transition-all"
                />
              </div>
            </div>
          </div>

          {/* TABEL REKAP KESELURUHAN KAS PER KK */}
          <div className="space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between text-xs text-slate-600 gap-1.5 pb-1">
              <span className="font-extrabold text-slate-900 flex items-center gap-1.5">
                <Table className="w-4 h-4 text-purple-600" />
                <span>
                  Tabel Rekapitulasi Keseluruhan Kas Per Kepala Keluarga ({filteredOverallKKList.length} KK)
                </span>
              </span>
              <span className="text-[11px] text-slate-500 font-medium">
                Menggabungkan {sortedPeriods.length} Periode ({sortedPeriods.join(' • ')})
              </span>
            </div>

            <div className="overflow-x-auto rounded-2xl border border-slate-300/90 shadow-sm bg-white">
              <table className="w-full text-left text-xs border-collapse border border-slate-300 whitespace-nowrap">
                <thead>
                  <tr className="bg-gradient-to-r from-slate-900 via-purple-950 to-indigo-950 text-white font-extrabold border-b border-slate-300">
                    <th className="py-3 px-2 text-center w-12 border border-slate-300/70 text-white">No</th>
                    <th className="py-3 px-3 text-center border border-slate-300/70 text-white">No Blok</th>
                    <th className="py-3 px-4 min-w-[180px] border border-slate-300/70 text-white">Nama Kepala Keluarga</th>

                    {/* Render Kolom untuk Setiap Periode */}
                    {sortedPeriods.map((periodName) => (
                      <th
                        key={periodName}
                        className="py-3 px-3 text-center border border-slate-300/70 text-purple-200 font-bold bg-purple-900/40"
                      >
                        {periodName}
                      </th>
                    ))}

                    <th className="py-3 px-3 text-right border border-slate-300/70 text-rose-200">
                      Sisa Tunggakan
                    </th>
                    <th className="py-3 px-3 text-center border border-slate-300/70 text-white w-28">
                      Aksi &amp; Detail
                    </th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-slate-300">
                  {filteredOverallKKList.length === 0 ? (
                    <tr>
                      <td
                        colSpan={5 + sortedPeriods.length}
                        className="py-8 text-center text-slate-400 italic border border-slate-300"
                      >
                        Tidak ada data KK yang cocok dengan filter ini.
                      </td>
                    </tr>
                  ) : (
                    filteredOverallKKList.map((row) => {
                      const {
                        house,
                        idx,
                        isPureKosong,
                        isRumahKosongHitam,
                        payerName,
                        periodsDetail,
                        totalIuranAllPeriods,
                        totalDendaAllPeriods,
                        totalTunggakanAllPeriods,
                        grandTotalAllPeriods,
                        totalPeriodsPaidCount,
                        unpaidPeriodsCount,
                        remainingArrearsTotal,
                        overallStatus,
                        overallBadgeClass,
                        rowCellClass,
                      } = row;

                      return (
                        <tr
                          key={house.id}
                          className={`transition-colors border-b ${rowCellClass}`}
                        >
                          {/* 1. No */}
                          <td
                            className={`py-2.5 px-2 text-center font-mono border ${
                              isRumahKosongHitam ? 'text-slate-300' : 'text-slate-600'
                            }`}
                          >
                            {idx + 1}
                          </td>

                          {/* 2. No Blok */}
                          <td className="py-2.5 px-3 text-center border border-slate-300">
                            <span
                              className={`font-mono text-xs font-bold px-2 py-0.5 rounded-lg border shadow-2xs ${
                                isRumahKosongHitam
                                  ? 'bg-neutral-900 text-white border-neutral-700'
                                  : overallStatus === 'Bayar Lebih'
                                  ? 'bg-sky-200/90 text-sky-950 border-sky-400'
                                  : overallStatus === 'Lunas Semua'
                                  ? 'bg-emerald-200/90 text-emerald-950 border-emerald-400'
                                  : 'bg-rose-200/90 text-rose-950 border-rose-400'
                              }`}
                            >
                              Blok {house.blockNumber}
                            </span>
                          </td>

                          {/* 3. Nama Kepala Keluarga */}
                          <td className="py-2.5 px-4 border border-slate-300">
                            <div className="flex items-center justify-between gap-1.5">
                              <span
                                className={`font-bold ${
                                  isRumahKosongHitam
                                    ? 'text-white'
                                    : overallStatus === 'Bayar Lebih'
                                    ? 'text-sky-950'
                                    : overallStatus === 'Lunas Semua'
                                    ? 'text-emerald-950'
                                    : 'text-rose-950'
                                }`}
                              >
                                {payerName}
                              </span>
                              {isAdmin && (
                                <button
                                  type="button"
                                  onClick={() => handleOpenEditHouseDues(house, false)}
                                  className={`p-1 rounded transition-colors cursor-pointer shrink-0 ${
                                    isRumahKosongHitam
                                      ? 'text-slate-400 hover:text-white hover:bg-neutral-800'
                                      : 'text-slate-400 hover:text-purple-700 hover:bg-purple-100/60'
                                  }`}
                                  title="Edit Data / Iuran KK Ini"
                                >
                                  <Edit2 className="w-3.5 h-3.5" />
                                </button>
                              )}
                            </div>
                          </td>

                          {/* Kolom Rincian Setiap Periode */}
                          {periodsDetail.map((pDet) => (
                            <td
                              key={pDet.periodLabel}
                              className="py-2.5 px-2.5 text-center border border-slate-300 font-mono text-xs"
                            >
                              {isPureKosong ? (
                                <span className="text-[10px] text-neutral-400 italic">Bebas</span>
                              ) : pDet.isAdvanceSubsequent ? (
                                <span className="px-1.5 py-0.5 rounded-md bg-sky-100 text-sky-800 text-[10px] font-bold border border-sky-300">
                                  ✓ Dimuka
                                </span>
                              ) : pDet.iuranPaid > 0 ? (
                                <div className="flex flex-col items-center">
                                  <span className="font-bold text-emerald-800">
                                    +{formatRupiah(pDet.iuranPaid)}
                                  </span>
                                  {pDet.dendaPaid > 0 && (
                                    <span className="text-[9px] text-cyan-700 font-medium">
                                      +Denda {formatRupiah(pDet.dendaPaid)}
                                    </span>
                                  )}
                                  {pDet.tunggakanPaid > 0 && (
                                    <span className="text-[9px] text-amber-700 font-medium">
                                      +Tung {formatRupiah(pDet.tunggakanPaid)}
                                    </span>
                                  )}
                                </div>
                              ) : (
                                <span className="px-1.5 py-0.5 rounded-md bg-rose-100 text-rose-800 text-[10px] font-bold border border-rose-300">
                                  Belum
                                </span>
                              )}
                            </td>
                          ))}

                          {/* Sisa Tunggakan Berjalan */}
                          <td className="py-2.5 px-3 text-right font-mono tabular-nums border border-slate-300 font-bold">
                            {remainingArrearsTotal > 0 ? (
                              <span className="text-rose-700">
                                {formatRupiah(remainingArrearsTotal)}
                              </span>
                            ) : (
                              <span className="text-emerald-700 font-semibold text-[11px]">
                                Rp 0 (Bersih)
                              </span>
                            )}
                          </td>

                          {/* 11. Aksi & Detail */}
                          <td className="py-2.5 px-3 text-center border border-slate-300">
                            <div className="flex items-center justify-center gap-1.5">
                              <button
                                type="button"
                                onClick={() => setSelectedDetailHouse(house)}
                                className="px-2 py-1 rounded-lg bg-purple-600 hover:bg-purple-700 text-white font-bold text-[10px] shadow-2xs transition-all cursor-pointer flex items-center gap-1"
                                title="Lihat Histori Rincian Setiap Periode untuk KK ini"
                              >
                                <Eye className="w-3 h-3 text-purple-200" />
                                <span>Rincian</span>
                              </button>

                              {house.phone && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    const waMsg =
                                      `Halo Bpk/Ibu ${payerName} (Blok ${house.blockNumber}),\n` +
                                      `Berikut rekap keseluruhan pembayaran kas Gang Mandor Blok K2/25–K3/24 gabungan seluruh periode (${sortedPeriods.join(' • ')}):\n` +
                                      `• Total Iuran Rutin: ${formatRupiah(totalIuranAllPeriods)}\n` +
                                      `• Total Denda Baksos: ${formatRupiah(totalDendaAllPeriods)}\n` +
                                      `• Total Bayar Tunggakan: ${formatRupiah(totalTunggakanAllPeriods)}\n` +
                                      `👉 *TOTAL KAS MASUK PER KK: ${formatRupiah(grandTotalAllPeriods)}*\n` +
                                      `• Status: ${overallStatus === 'Lunas Semua' ? 'LUNAS SEMUA PERIODE' : overallStatus === 'Bayar Lebih' ? 'BAYAR LEBIH (>1 BULAN)' : `Ada Tunggakan: ${formatRupiah(remainingArrearsTotal)}`}\n\n` +
                                      `Terima kasih atas partisipasi aktif dalam kerukunan warga Gang Mandor.`;
                                    openWhatsAppShare(waMsg);
                                  }}
                                  className="p-1 rounded-lg bg-emerald-100 hover:bg-emerald-200 text-emerald-800 border border-emerald-300 transition-colors cursor-pointer"
                                  title="Kirim Ringkasan Keseluruhan ke WhatsApp Warga"
                                >
                                  <MessageCircle className="w-3.5 h-3.5" />
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>

                {/* FOOTER TABEL: TOTAL AKUMULASI GANG MANDOR */}
                {filteredOverallKKList.length > 0 && (
                  <tfoot>
                    <tr className="bg-gradient-to-r from-slate-900 via-purple-950 to-indigo-950 text-white font-extrabold border-t-2 border-slate-300">
                      <td colSpan={3 + sortedPeriods.length} className="py-3 px-4 text-right text-xs uppercase tracking-wider text-amber-200 border border-slate-300/70">
                        TOTAL AKUMULASI SISA TUNGGAKAN ({filteredOverallKKList.length} KK):
                      </td>
                      <td className="py-3 px-3 text-right font-mono text-xs tabular-nums text-rose-300 border border-slate-300/70">
                        {formatRupiah(overallTotals.sumRemainingArrears)}
                      </td>
                      <td className="py-3 px-3 text-center font-sans text-xs text-purple-200 border border-slate-300/70">
                        -
                      </td>
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>

            {/* STATUS PENCOCOKAN AKUMULASI SELURUH PERIODE */}
            <div className="p-3.5 rounded-2xl bg-gradient-to-r from-purple-50 via-indigo-50/80 to-purple-50 border-2 border-purple-300 shadow-2xs flex flex-col md:flex-row items-center justify-between gap-3 text-xs">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-purple-600 text-white flex items-center justify-center shadow-xs shrink-0">
                  <CheckCircle2 className="w-5 h-5 text-white" />
                </div>
                <div>
                  <div className="font-extrabold text-purple-950 flex items-center gap-2 text-sm">
                    <span>Rekap Keseluruhan Kas Per KK: 100% Terintegrasi Seluruh Periode</span>
                    <span className="px-2 py-0.5 rounded-md bg-purple-600 text-white text-[10px] font-black uppercase tracking-wider">
                      Semua Periode ({sortedPeriods.length})
                    </span>
                  </div>
                  <div className="text-slate-600 text-[11px] mt-0.5 flex items-center gap-2 flex-wrap">
                    <span>Periode: <strong className="text-slate-900">{sortedPeriods.join(' • ')}</strong></span>
                    <span>•</span>
                    <span>Iuran Rutin: <strong className="text-emerald-800">{formatRupiah(overallTotals.sumIuran)}</strong></span>
                    <span>•</span>
                    <span>Denda Baksos: <strong className="text-cyan-800">{formatRupiah(overallTotals.sumDenda)}</strong></span>
                    <span>•</span>
                    <span>Tunggakan Bayar: <strong className="text-amber-800">{formatRupiah(overallTotals.sumTunggakan)}</strong></span>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-3 shrink-0 bg-white/90 px-3.5 py-1.5 rounded-xl border border-purple-200">
                <div className="text-right">
                  <div className="text-[10px] text-slate-500 font-semibold uppercase">Total Seluruh Kas Masuk</div>
                  <div className="font-mono text-base font-black text-purple-900">
                    +{formatRupiah(overallTotals.sumGrandTotal)}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL DETAIL HISTORI KK PERIODE (RINCIAN SETIAP BULAN) */}
      {selectedDetailHouse && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-xs overflow-y-auto">
          <div className="bg-white rounded-3xl shadow-2xl border border-slate-200 w-full max-w-2xl overflow-hidden my-auto animate-in fade-in zoom-in-95 max-h-[92vh] flex flex-col">
            {/* Modal Header */}
            <div className="bg-gradient-to-r from-purple-800 via-indigo-800 to-slate-900 p-4 sm:p-5 text-white flex justify-between items-center shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-purple-500/20 border border-purple-400/30 text-purple-300">
                  <Coins className="w-5 h-5 text-amber-300" />
                </div>
                <div>
                  <h4 className="font-extrabold text-sm sm:text-base text-white flex items-center gap-2">
                    <span>Rincian Pembayaran Kas — Blok {selectedDetailHouse.blockNumber}</span>
                  </h4>
                  <p className="text-[11px] text-purple-200/90 font-medium">
                    Kepala Keluarga: {selectedDetailHouse.duesHeadNameOverride || selectedDetailHouse.headName} • Status: {selectedDetailHouse.occupancy}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSelectedDetailHouse(null)}
                className="text-white/70 hover:text-white p-1 rounded-lg hover:bg-white/10 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-4 sm:p-5 space-y-4 overflow-y-auto flex-1 text-xs">
              {/* Rincian per Periode */}
              <div className="border border-slate-200 rounded-2xl overflow-hidden shadow-2xs">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-900 text-white font-bold text-[11px]">
                      <th className="py-2.5 px-3">Periode</th>
                      <th className="py-2.5 px-3 text-right">Iuran (Rp)</th>
                      <th className="py-2.5 px-3 text-right">Denda Baksos (Rp)</th>
                      <th className="py-2.5 px-3 text-right">Tunggakan (Rp)</th>
                      <th className="py-2.5 px-3 text-right text-amber-300">Total Masuk (Rp)</th>
                      <th className="py-2.5 px-3 text-center">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {(() => {
                      const matchRow = overallKKRecapList.find((r) => r.house.id === selectedDetailHouse.id);
                      if (!matchRow) return null;
                      return matchRow.periodsDetail.map((p) => (
                        <tr key={p.periodLabel} className="hover:bg-slate-50 transition-colors">
                          <td className="py-2.5 px-3 font-bold text-slate-800">{p.periodLabel}</td>
                          <td className="py-2.5 px-3 text-right font-mono text-emerald-800 font-bold">
                            {p.iuranPaid > 0 ? `+${formatRupiah(p.iuranPaid)}` : p.isAdvanceSubsequent ? '✓ Dimuka' : 'Rp 0'}
                          </td>
                          <td className="py-2.5 px-3 text-right font-mono text-cyan-800">
                            {p.dendaPaid > 0 ? `+${formatRupiah(p.dendaPaid)}` : 'Rp 0'}
                          </td>
                          <td className="py-2.5 px-3 text-right font-mono text-amber-800">
                            {p.tunggakanPaid > 0 ? `+${formatRupiah(p.tunggakanPaid)}` : 'Rp 0'}
                          </td>
                          <td className="py-2.5 px-3 text-right font-mono font-bold text-purple-900 bg-purple-50/50">
                            +{formatRupiah(p.periodTotal)}
                          </td>
                          <td className="py-2.5 px-3 text-center">
                            <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold border ${p.badgeClass}`}>
                              {p.statusBadge}
                            </span>
                          </td>
                        </tr>
                      ));
                    })()}
                  </tbody>
                </table>
              </div>

              {/* Rangkuman Total Akumulasi KK Ini */}
              {(() => {
                const matchRow = overallKKRecapList.find((r) => r.house.id === selectedDetailHouse.id);
                if (!matchRow) return null;
                return (
                  <div className="p-3.5 rounded-2xl bg-gradient-to-r from-purple-50 via-indigo-50 to-pink-50 border border-purple-200 space-y-2">
                    <div className="flex items-center justify-between font-bold text-slate-700">
                      <span>Total Akumulasi Pembayaran Kas Masuk:</span>
                      <span className="font-mono text-base font-black text-purple-950">
                        +{formatRupiah(matchRow.grandTotalAllPeriods)}
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-[11px] text-slate-600 border-t border-purple-200/60 pt-1.5">
                      <span>Sisa Tunggakan Belum Dibayar:</span>
                      <span className={`font-mono font-bold ${matchRow.remainingArrearsTotal > 0 ? 'text-rose-700' : 'text-emerald-700'}`}>
                        {matchRow.remainingArrearsTotal > 0 ? formatRupiah(matchRow.remainingArrearsTotal) : 'Rp 0 (Bersih / Bebas Tunggakan)'}
                      </span>
                    </div>
                  </div>
                );
              })()}
            </div>

            {/* Modal Footer */}
            <div className="p-4 bg-slate-50 border-t border-slate-200 flex justify-between items-center shrink-0">
              <span className="text-[11px] text-slate-500 font-medium">
                Pencatatan resmi terpadu Gang Mandor Blok K2/25–K3/24
              </span>
              <button
                type="button"
                onClick={() => setSelectedDetailHouse(null)}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-900 text-white font-bold text-xs cursor-pointer shadow-xs transition-all"
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 1: CATAT TRANSAKSI KAS KELUAR MASUK */}
      {isTxModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs">
          <div className="bg-white rounded-2xl shadow-xl border border-slate-200 w-full max-w-lg overflow-hidden">
            <div className="bg-slate-900 p-4 text-white flex justify-between items-center">
              <h4 className="font-bold text-sm sm:text-base">
                {editingTx ? 'Edit Catatan Transaksi' : 'Catat Kas Keluar / Masuk'}
              </h4>
              <button
                type="button"
                onClick={() => setIsTxModalOpen(false)}
                className="text-white/70 hover:text-white cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleSaveTx} className="p-5 space-y-3.5">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Jenis Transaksi
                  </label>
                  <select
                    value={txType}
                    onChange={(e) => {
                      const newType = e.target.value as TransactionType;
                      setTxType(newType);
                      if (newType === 'keluar') {
                        if (txPool === 'Cashback WiFi') {
                          setTxCategory('Pengeluaran Cashback WiFi');
                        } else if (txPool === 'Cashback Sampah') {
                          setTxCategory('Pengeluaran Cashback Sampah');
                        } else {
                          setTxCategory('Pengeluaran Gang');
                        }
                      } else {
                        if (txPool === 'Cashback WiFi') {
                          setTxCategory('Cashback WiFi');
                        } else if (txPool === 'Cashback Sampah') {
                          setTxCategory('Cashback Sampah');
                        } else {
                          setTxCategory('Iuran Warga');
                        }
                      }
                    }}
                    className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-emerald-500"
                  >
                    <option value="masuk">Uang Masuk (+)</option>
                    <option value="keluar">Uang Keluar (-)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Alokasi Kas
                  </label>
                  <select
                    value={txPool}
                    onChange={(e) => {
                      const newPool = e.target.value as 'Kas Utama' | 'Cashback WiFi' | 'Cashback Sampah';
                      setTxPool(newPool);
                      if (txType === 'keluar') {
                        if (newPool === 'Cashback WiFi') {
                          setTxCategory('Pengeluaran Cashback WiFi');
                        } else if (newPool === 'Cashback Sampah') {
                          setTxCategory('Pengeluaran Cashback Sampah');
                        } else {
                          setTxCategory('Pengeluaran Gang');
                        }
                      } else {
                        if (newPool === 'Cashback WiFi') {
                          setTxCategory('Cashback WiFi');
                        } else if (newPool === 'Cashback Sampah') {
                          setTxCategory('Cashback Sampah');
                        }
                      }
                    }}
                    className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-emerald-500"
                  >
                    <option value="Kas Utama">Kas Utama</option>
                    <option value="Cashback WiFi">Cashback WiFi</option>
                    <option value="Cashback Sampah">Cashback Sampah</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Tanggal
                  </label>
                  <input
                    type="date"
                    required
                    value={txDate}
                    onChange={(e) => setTxDate(e.target.value)}
                    className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-emerald-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Kategori Transaksi
                  </label>
                  <select
                    value={txCategory}
                    onChange={(e) => {
                      const cat = e.target.value as TransactionCategory;
                      setTxCategory(cat);
                      if (cat === 'Pengeluaran Cashback WiFi') {
                        setTxType('keluar');
                        setTxPool('Cashback WiFi');
                      } else if (cat === 'Pengeluaran Cashback Sampah') {
                        setTxType('keluar');
                        setTxPool('Cashback Sampah');
                      } else if (cat === 'Pengeluaran Gang' || cat === 'Pengeluaran Lingkungan') {
                        setTxType('keluar');
                        setTxPool('Kas Utama');
                      } else if (cat === 'Cashback WiFi') {
                        setTxType('masuk');
                        setTxPool('Cashback WiFi');
                      } else if (cat === 'Cashback Sampah') {
                        setTxType('masuk');
                        setTxPool('Cashback Sampah');
                      } else if (cat === 'Pembayaran Tunggakan' || cat === 'Iuran Warga' || cat === 'Denda Baksos') {
                        setTxPool('Kas Utama');
                        setTxType('masuk');
                      }
                    }}
                    className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-emerald-500"
                  >
                    {txType === 'masuk' ? (
                      <>
                        <option value="Iuran Warga">Iuran Warga</option>
                        <option value="Pembayaran Tunggakan">Pembayaran Tunggakan</option>
                        <option value="Denda Baksos">Denda Baksos</option>
                        <option value="Cashback WiFi">Cashback WiFi (Pemasukan)</option>
                        <option value="Cashback Sampah">Cashback Sampah (Pemasukan)</option>
                        <option value="Kas Utama">Kas Utama (Lainnya)</option>
                      </>
                    ) : (
                      <>
                        <option value="Pengeluaran Gang">Pengeluaran Gang (misal: Pembayaran Iuran Sampah, Operasional Gang)</option>
                        <option value="Pengeluaran Lingkungan">Pengeluaran Lingkungan</option>
                        <option value="Kas Utama">Pengeluaran Kas Utama (Lainnya)</option>
                        <option value="Pengeluaran Cashback WiFi">Pengeluaran Cashback WiFi</option>
                        <option value="Pengeluaran Cashback Sampah">Pengeluaran Cashback Sampah</option>
                      </>
                    )}
                  </select>
                </div>
              </div>

              {/* Opsi KK & Pilihan Iuran Lebih dari 1 Bulan */}
              {!editingTx && txType === 'masuk' && txCategory === 'Iuran Warga' && (
                <div className="p-3.5 bg-gradient-to-br from-emerald-50/90 via-teal-50/50 to-indigo-50/50 border border-emerald-200 rounded-2xl space-y-3">
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="block text-xs font-bold text-slate-800">
                        Tautkan ke Kepala Keluarga / No. Blok
                      </label>
                      <span className="text-[10px] text-emerald-700 bg-white px-2 py-0.5 rounded-md border border-emerald-200 font-semibold">
                        Sinkron ke Rekap KK
                      </span>
                    </div>
                    <select
                      value={txResidentId}
                      onChange={(e) => {
                        const id = e.target.value;
                        setTxResidentId(id);
                        updateIuranTxPreview(id, txIuranMonths, txIuranStartMonth, txCustomNote);
                      }}
                      className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-lg font-medium text-slate-800 focus:outline-none focus:ring-1 focus:ring-emerald-500 shadow-2xs"
                    >
                      <option value="">— Tidak ditautkan ke KK spesifik (Iuran Umum) —</option>
                      {residents.map((r) => {
                        const isVacant =
                          r.occupancy === 'Kosong' ||
                          r.occupancy === 'Belum Ditempati' ||
                          isHouseVacant(r);
                        const displayName = r.duesHeadNameOverride || r.headName;
                        return (
                          <option key={r.id} value={r.id}>
                            Blok {r.blockNumber} — {displayName} {isVacant ? '(Rumah Kosong)' : ''}
                          </option>
                        );
                      })}
                    </select>
                  </div>

                  {/* Pilihan Iuran Lebih dari 1 Bulan */}
                  <div className="pt-2 border-t border-emerald-200/80 space-y-2">
                    <div className="flex items-center justify-between">
                      <label className="block text-xs font-bold text-emerald-950 flex items-center gap-1.5">
                        <Coins className="w-3.5 h-3.5 text-emerald-600" />
                        <span>Pilihan Jumlah Bulan Iuran</span>
                      </label>
                      <span className="text-[11px] font-extrabold text-indigo-700 bg-white px-2 py-0.5 rounded-md border border-indigo-200 shadow-2xs">
                        {txIuranMonths} Bulan Dibayar
                      </span>
                    </div>

                    {/* Quick Preset Buttons */}
                    <div className="grid grid-cols-4 sm:grid-cols-7 gap-1.5">
                      {[1, 2, 3, 4, 5, 6, 12].map((num) => {
                        const isSel = txIuranMonths === num;
                        const label =
                          num === 1
                            ? '1 Bln'
                            : num === 6
                            ? '6 Bln'
                            : num === 12
                            ? '1 Thn (12)'
                            : `${num} Bln`;
                        return (
                          <button
                            key={num}
                            type="button"
                            onClick={() => {
                              setTxIuranMonths(num);
                              updateIuranTxPreview(txResidentId, num, txIuranStartMonth, txCustomNote);
                            }}
                            className={`py-1.5 px-1 text-center rounded-lg text-[11px] font-black transition-all cursor-pointer ${
                              isSel
                                ? 'bg-indigo-600 text-white shadow-xs scale-102 ring-1 ring-indigo-400'
                                : 'bg-white hover:bg-emerald-100 text-slate-700 border border-slate-200 shadow-2xs'
                            }`}
                          >
                            {label}
                          </button>
                        );
                      })}
                    </div>

                    <div className="grid grid-cols-2 gap-2 pt-1">
                      <div>
                        <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                          Periode Bulan Mulai
                        </label>
                        <select
                          value={txIuranStartMonth}
                          onChange={(e) => {
                            const val = e.target.value;
                            setTxIuranStartMonth(val);
                            updateIuranTxPreview(txResidentId, txIuranMonths, val, txCustomNote);
                          }}
                          className="w-full px-2.5 py-1.5 text-xs bg-white border border-slate-300 rounded-lg text-slate-800 font-semibold"
                        >
                          {availablePeriods.map((p) => (
                            <option key={p} value={p}>
                              {p}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                          Kustom Jumlah Bulan
                        </label>
                        <input
                          type="number"
                          min={1}
                          max={36}
                          value={txIuranMonths}
                          onChange={(e) => {
                            const val = Math.max(1, Number(e.target.value) || 1);
                            setTxIuranMonths(val);
                            updateIuranTxPreview(txResidentId, val, txIuranStartMonth, txCustomNote);
                          }}
                          className="w-full px-2.5 py-1.5 text-xs bg-white border border-slate-300 rounded-lg font-mono font-bold text-slate-800"
                        />
                      </div>
                    </div>

                    {/* Live Preview Periode yang Dicakup */}
                    <div className="p-2 rounded-xl bg-indigo-50/90 border border-indigo-200 text-indigo-950 text-[11px] font-semibold flex items-center justify-between gap-2">
                      <div className="flex items-center gap-1.5">
                        <Calendar className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
                        <span>
                          {txIuranMonths > 1
                            ? `Cakupan: ${txIuranStartMonth} s/d ${
                                getSubsequentMonthLabels(txIuranStartMonth, txIuranMonths).slice(-1)[0]
                              } (${txIuranMonths} Bulan)`
                            : `Cakupan: ${txIuranStartMonth} (1 Bulan)`}
                        </span>
                      </div>
                      <span className="font-mono font-bold text-indigo-900 bg-white px-2 py-0.5 rounded border border-indigo-200">
                        {formatRupiah(Number(txAmount) || 0)}
                      </span>
                    </div>

                    {/* Catatan Tambahan (misal nama pentransfer / keterangan khusus) */}
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                        Catatan Tambahan Transaksi (Opsional)
                      </label>
                      <input
                        type="text"
                        placeholder="Misal: Transfer BCA, Titip Bendahara, Bayar Sekaligus"
                        value={txCustomNote}
                        onChange={(e) => {
                          const val = e.target.value;
                          setTxCustomNote(val);
                          updateIuranTxPreview(txResidentId, txIuranMonths, txIuranStartMonth, val);
                        }}
                        className="w-full px-2.5 py-1.5 text-xs bg-white border border-slate-300 rounded-lg text-slate-800"
                      />
                    </div>
                  </div>
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Uraian / Keterangan Transaksi
                </label>
                <input
                  type="text"
                  required
                  placeholder="Misal: Pembayaran Iuran Sampah, Pembelian Lampu Jalan, dll"
                  value={txDescription}
                  onChange={(e) => setTxDescription(e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-emerald-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Jumlah Nominal (Rp)
                </label>
                <input
                  type="number"
                  required
                  min={1000}
                  step={1000}
                  placeholder="50000"
                  value={txAmount}
                  onChange={(e) => setTxAmount(Number(e.target.value) || '')}
                  className="w-full px-3 py-2 text-sm font-mono font-bold border border-slate-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-emerald-500"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsTxModalOpen(false)}
                  className="px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-100 rounded-lg cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 text-xs bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-lg cursor-pointer"
                >
                  Simpan Transaksi
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: EDIT KAS PER KK & TUNGGAKAN */}
      {/* MODAL 2: EDIT KAS PER KK & TUNGGAKAN */}
      {editingHouseDues && (() => {
        const isEditingVacant =
          houseDuesOccupancyInput === 'Kosong' ||
          editingHouseDues.occupancy === 'Kosong' ||
          isHouseVacant(editingHouseDues);

        const isUnoccupied = houseDuesOccupancyInput === 'Belum Ditempati';
        const isEditingMultiMonth = isHouseAdvancePaid(editingHouseDues, selectedKKPeriod);

        // Hitung estimasi penerimaan live
        const iuranNominalNum = Math.max(0, Number(houseDuesAmountInput) || 0);
        const isIuranPaid = houseDuesStatusInput === 'Lunas' || houseDuesStatusInput === 'Bayar Lebih';
        const isAdvance = houseDuesStatusInput === 'Bayar Lebih';
        const monthsCount = isAdvance ? Math.max(2, Number(houseDuesPaidMonthsInput) || 2) : isIuranPaid ? 1 : 0;
        const liveIuranTotal = isAdvance
          ? Math.max(iuranNominalNum, Number(houseDuesTotalReceivedInput) || iuranNominalNum * monthsCount)
          : isIuranPaid
          ? iuranNominalNum
          : 0;

        const liveDendaAmount = houseDuesBaksosStatusInput === 'Lunas' ? Math.max(0, Number(houseDuesBaksosAmountInput) || 0) : 0;
        const liveTunggakanAmount = Math.max(0, Number(houseDuesTunggakanPaidInput) || 0);
        const liveGrandTotal = liveIuranTotal + liveDendaAmount + liveTunggakanAmount;

        const baksosModalInfo = getHouseBaksosForPeriod(editingHouseDues, selectedKKPeriod);

        const currentPrevArrearsNum = Math.max(0, Number(houseDuesPrevArrearsInput) || 0);
        const estRemainingArrears = Math.max(
          0,
          currentPrevArrearsNum - (houseDuesAutoDeductArrears ? liveTunggakanAmount : 0)
        );

        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-xs overflow-y-auto">
            <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-xl max-h-[92vh] flex flex-col overflow-hidden my-auto animate-in fade-in zoom-in-95">
              {/* Header Modal */}
              <div className="bg-gradient-to-r from-slate-900 via-teal-950 to-indigo-950 p-4 text-white flex justify-between items-center shrink-0 border-b border-slate-700">
                <div>
                  <div className="flex items-center gap-2">
                    <h4 className="font-bold text-sm sm:text-base flex items-center gap-2">
                      <span>Edit Kas &amp; Pembayaran KK Blok {editingHouseDues.blockNumber}</span>
                    </h4>
                    {isEditingVacant && (
                      <span className="px-2 py-0.5 rounded-full text-[10px] bg-neutral-800 text-neutral-200 border border-neutral-600 font-semibold">
                        Rumah Kosong
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-slate-300 mt-0.5">
                    {houseDuesHeadNameInput || editingHouseDues.duesHeadNameOverride || editingHouseDues.headName || 'Kepala Keluarga'} — {selectedKKPeriod !== 'semua' ? `Periode ${selectedKKPeriod}` : 'Semua Periode'}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setEditingHouseDues(null)}
                  className="p-1 text-white/70 hover:text-white hover:bg-white/10 rounded-lg cursor-pointer transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Tab Navigation Menu */}
              <div className="flex border-b border-slate-200 bg-slate-100/90 px-3 pt-2 gap-1.5 overflow-x-auto no-scrollbar shrink-0">
                <button
                  type="button"
                  onClick={() => setEditingHouseDuesTab('all')}
                  className={`px-3 py-2 text-xs font-bold rounded-t-xl transition-all border-b-2 cursor-pointer flex items-center gap-1.5 whitespace-nowrap ${
                    editingHouseDuesTab === 'all'
                      ? 'border-indigo-600 text-indigo-950 bg-white shadow-2xs'
                      : 'border-transparent text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
                  }`}
                >
                  <Sliders className="w-3.5 h-3.5 text-indigo-600" />
                  <span>Semua Komponen</span>
                </button>

                <button
                  type="button"
                  onClick={() => setEditingHouseDuesTab('iuran')}
                  className={`px-3 py-2 text-xs font-bold rounded-t-xl transition-all border-b-2 cursor-pointer flex items-center gap-1.5 whitespace-nowrap ${
                    editingHouseDuesTab === 'iuran'
                      ? 'border-emerald-600 text-emerald-950 bg-white shadow-2xs'
                      : 'border-transparent text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
                  }`}
                >
                  {preserveExistingDues ? (
                    <Lock className="w-3.5 h-3.5 text-sky-600" />
                  ) : (
                    <Wallet className="w-3.5 h-3.5 text-emerald-600" />
                  )}
                  <span>Iuran Bulanan</span>
                  {preserveExistingDues ? (
                    <span className="px-1.5 py-0.2 rounded-full text-[9px] bg-sky-100 text-sky-900 font-extrabold border border-sky-300">
                      Terkunci
                    </span>
                  ) : isIuranPaid ? (
                    <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0"></span>
                  ) : null}
                </button>

                <button
                  type="button"
                  onClick={() => setEditingHouseDuesTab('baksos')}
                  className={`px-3 py-2 text-xs font-bold rounded-t-xl transition-all border-b-2 cursor-pointer flex items-center gap-1.5 whitespace-nowrap ${
                    editingHouseDuesTab === 'baksos'
                      ? 'border-teal-600 text-teal-950 bg-white shadow-2xs'
                      : 'border-transparent text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
                  }`}
                >
                  <CheckCircle2 className="w-3.5 h-3.5 text-teal-600" />
                  <span>Denda Baksos</span>
                  {houseDuesBaksosStatusInput === 'Lunas' ? (
                    <span className="px-1.5 py-0.2 rounded-full text-[9px] bg-emerald-100 text-emerald-800 font-extrabold border border-emerald-300">
                      Lunas
                    </span>
                  ) : houseDuesBaksosStatusInput === 'Belum Bayar' ? (
                    <span className="px-1.5 py-0.2 rounded-full text-[9px] bg-rose-100 text-rose-800 font-extrabold border border-rose-300">
                      Denda
                    </span>
                  ) : null}
                </button>

                <button
                  type="button"
                  onClick={() => setEditingHouseDuesTab('tunggakan')}
                  className={`px-3 py-2 text-xs font-bold rounded-t-xl transition-all border-b-2 cursor-pointer flex items-center gap-1.5 whitespace-nowrap ${
                    editingHouseDuesTab === 'tunggakan'
                      ? 'border-rose-600 text-rose-950 bg-white shadow-2xs'
                      : 'border-transparent text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
                  }`}
                >
                  <AlertTriangle className="w-3.5 h-3.5 text-rose-600" />
                  <span>Pembayaran Tunggakan</span>
                  {liveTunggakanAmount > 0 && (
                    <span className="px-1.5 py-0.2 rounded-full text-[9px] bg-emerald-100 text-emerald-800 font-extrabold border border-emerald-300">
                      +{formatRupiah(liveTunggakanAmount)}
                    </span>
                  )}
                </button>
              </div>

              {/* Info Proteksi Iuran > 1 Bulan jika terdeteksi */}
              {isEditingMultiMonth && (
                <div className="mx-4 sm:mx-5 mt-3 p-3 bg-gradient-to-r from-sky-50 via-indigo-50 to-emerald-50 border border-sky-300 rounded-xl flex items-start gap-2.5 shadow-2xs">
                  <ShieldCheck className="w-5 h-5 text-sky-700 shrink-0 mt-0.5" />
                  <div className="space-y-1 text-xs">
                    <div className="font-extrabold text-sky-950 flex items-center gap-1.5 flex-wrap">
                      <span>Iuran &gt; 1 Bulan Terdeteksi:</span>
                      <span className="px-2 py-0.5 rounded-full text-[10px] bg-sky-200 text-sky-900 border border-sky-300 font-black">
                        {editingHouseDues.duesPaidMonths && editingHouseDues.duesPaidMonths > 1 ? `${editingHouseDues.duesPaidMonths} Bulan` : 'Bayar Lebih'} ({editingHouseDues.duesMonthNote || 'Periode Di Muka'})
                      </span>
                    </div>
                    <p className="text-[11px] text-sky-900 leading-relaxed">
                      KK ini tercatat membayar iuran lebih dari 1 bulan. Data dan transaksi iuran bulanan <strong>terlindungi aman</strong> dan tidak akan berubah saat Anda menginput/mengedit Denda Baksos atau Pembayaran Tunggakan.
                    </p>
                    <label className="inline-flex items-center gap-2 pt-1 font-bold text-slate-800 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={preserveExistingDues}
                        onChange={(e) => setPreserveExistingDues(e.target.checked)}
                        className="w-4 h-4 text-sky-600 rounded focus:ring-sky-500 border-slate-300 cursor-pointer"
                      />
                      <span className="text-[11px] text-slate-800">
                        Pertahankan iuran &gt; 1 bulan ini (Hanya input/edit Denda Baksos &amp; Tunggakan)
                      </span>
                    </label>
                  </div>
                </div>
              )}

              {isEditingVacant && (
                <div className="mx-4 sm:mx-5 mt-3 p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-900 flex items-start gap-2">
                  <div className="font-bold text-amber-700 shrink-0 text-sm">ℹ️</div>
                  <div className="leading-relaxed">
                    <strong>Ketentuan Rumah Kosong:</strong> Secara default rumah kosong otomatis <strong>Bebas Iuran</strong> (tidak wajib bayar kas &amp; tidak ada denda). Jika pemilik rumah membayar kontribusi kas/tunggakan, pilih <strong>Lunas</strong> atau masukkan nominal pembayaran di bawah.
                  </div>
                </div>
              )}

              {/* Form Body (Scrollable) */}
              <form onSubmit={handleSaveHouseDues} className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4 text-xs">
                {/* 0. IDENTITAS RUMAH & KEPALA KELUARGA (Selalu tampil di atas) */}
                <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="font-extrabold text-slate-800 flex items-center gap-1.5">
                      <Users className="w-3.5 h-3.5 text-indigo-600" />
                      <span>Identitas &amp; Status Rumah</span>
                    </span>
                    <span className="text-[10px] text-slate-500 font-mono">
                      Blok {editingHouseDues.blockNumber}
                    </span>
                  </div>

                  {/* Pilihan Status Hunian Rumah */}
                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">
                      Status Hunian Rumah
                    </label>
                    <div className="grid grid-cols-3 gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          setHouseDuesOccupancyInput('Ditempati');
                          if (houseDuesHeadNameInput === 'Rumah Kosong' || houseDuesHeadNameInput === 'Belum Ditempati') {
                            setHouseDuesHeadNameInput('');
                          }
                        }}
                        className={`py-1.5 px-2 rounded-lg text-xs font-bold border transition-all cursor-pointer ${
                          houseDuesOccupancyInput === 'Ditempati'
                            ? 'bg-emerald-600 text-white border-emerald-600 shadow-xs'
                            : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-100'
                        }`}
                      >
                        Ditempati
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setHouseDuesOccupancyInput('Belum Ditempati');
                          if (!houseDuesHeadNameInput || houseDuesHeadNameInput === 'Rumah Kosong') {
                            setHouseDuesHeadNameInput('Belum Ditempati');
                          }
                        }}
                        className={`py-1.5 px-2 rounded-lg text-xs font-bold border transition-all cursor-pointer ${
                          houseDuesOccupancyInput === 'Belum Ditempati'
                            ? 'bg-amber-600 text-white border-amber-600 shadow-xs'
                            : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-100'
                        }`}
                      >
                        Belum Ditempati
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setHouseDuesOccupancyInput('Kosong');
                          setHouseDuesHeadNameInput('Rumah Kosong');
                          setHouseDuesAmountInput(0);
                          setHouseDuesStatusInput('Belum Bayar');
                        }}
                        className={`py-1.5 px-2 rounded-lg text-xs font-bold border transition-all cursor-pointer ${
                          houseDuesOccupancyInput === 'Kosong'
                            ? 'bg-black text-white border-black shadow-xs'
                            : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-100'
                        }`}
                      >
                        Rumah Kosong
                      </button>
                    </div>
                  </div>

                  {/* Input Nama Kepala Keluarga / Penanggung Jawab */}
                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">
                      Nama Kepala Keluarga / Penanggung Jawab
                    </label>
                    <input
                      type="text"
                      value={houseDuesHeadNameInput}
                      onChange={(e) => setHouseDuesHeadNameInput(e.target.value)}
                      placeholder="Ketik nama kepala keluarga..."
                      className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-lg font-bold text-slate-900 focus:outline-none focus:ring-1 focus:ring-indigo-500 shadow-2xs"
                    />
                  </div>
                </div>

                {/* 1. SEKSI IURAN KAS BULANAN */}
                {(editingHouseDuesTab === 'all' || editingHouseDuesTab === 'iuran') && (
                  <div className={`p-3.5 rounded-xl space-y-3 transition-colors ${
                    preserveExistingDues
                      ? 'bg-sky-50/70 border border-sky-300'
                      : 'bg-emerald-50/70 border border-emerald-200'
                  }`}>
                    <div className="flex items-center justify-between pb-1 border-b border-slate-200/80">
                      <span className="font-extrabold text-slate-900 flex items-center gap-1.5">
                        {preserveExistingDues ? (
                          <Lock className="w-4 h-4 text-sky-700" />
                        ) : (
                          <Wallet className="w-4 h-4 text-emerald-700" />
                        )}
                        <span>1. Iuran Kas Bulanan Warga</span>
                        {preserveExistingDues && (
                          <span className="px-2 py-0.5 rounded-md text-[9.5px] font-extrabold bg-sky-200 text-sky-950 border border-sky-400">
                            Mode Proteksi Aktif
                          </span>
                        )}
                      </span>
                      {preserveExistingDues ? (
                        <span className="text-[10px] font-bold text-sky-800 bg-sky-100 px-2 py-0.5 rounded-md border border-sky-300">
                          ✓ Iuran Terjaga ({editingHouseDues.duesStatus})
                        </span>
                      ) : isIuranPaid ? (
                        <span className="text-[10px] font-bold text-emerald-800 bg-emerald-100 px-2 py-0.5 rounded-md border border-emerald-300">
                          +{formatRupiah(liveIuranTotal)} ({houseDuesStatusInput})
                        </span>
                      ) : (
                        <span className="text-[10px] font-bold text-rose-700 bg-rose-100 px-2 py-0.5 rounded-md border border-rose-300">
                          Belum Bayar (Rp 0)
                        </span>
                      )}
                    </div>

                    {preserveExistingDues && (
                      <div className="p-2.5 bg-white/95 border border-sky-200 rounded-lg text-xs text-sky-950 flex flex-col sm:flex-row sm:items-center justify-between gap-2 shadow-2xs">
                        <div className="space-y-0.5">
                          <div className="font-bold flex items-center gap-1.5 text-sky-900">
                            <ShieldCheck className="w-4 h-4 text-sky-600 shrink-0" />
                            <span>Iuran KK ini dalam mode perlindungan (tidak akan ditimpa/diubah)</span>
                          </div>
                          <p className="text-[10.5px] text-slate-600 leading-relaxed">
                            Data iuran saat ini: <strong>{editingHouseDues.duesStatus}</strong> ({editingHouseDues.duesPaidMonths && editingHouseDues.duesPaidMonths > 1 ? `${editingHouseDues.duesPaidMonths} Bulan: ` : ''}{editingHouseDues.duesMonthNote || '-'}).
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            setPreserveExistingDues(false);
                            setEditingHouseDuesTab('iuran');
                          }}
                          className="px-2.5 py-1 text-[10.5px] font-bold text-sky-800 bg-sky-100 hover:bg-sky-200 rounded-lg border border-sky-300 cursor-pointer shadow-2xs shrink-0 self-start sm:self-auto transition-all"
                        >
                          Buka Kunci Iuran
                        </button>
                      </div>
                    )}

                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-semibold text-slate-700 mb-1">
                          Nominal Iuran / Bulan (Rp)
                        </label>
                        <input
                          type="number"
                          min={0}
                          step={5000}
                          value={houseDuesAmountInput}
                          onChange={(e) => setHouseDuesAmountInput(Number(e.target.value) || 0)}
                          className="w-full px-3 py-2 text-xs font-mono font-bold bg-white border border-slate-300 rounded-lg focus:ring-1 focus:ring-emerald-500 focus:outline-none"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-slate-700 mb-1">
                          Status Iuran
                        </label>
                        <select
                          value={houseDuesStatusInput}
                          onChange={(e) => {
                            const nextStatus = e.target.value as any;
                            setHouseDuesStatusInput(nextStatus);
                            if (nextStatus === 'Bayar Lebih') {
                              const nextMonths = Math.max(2, houseDuesPaidMonthsInput || 2);
                              setHouseDuesPaidMonthsInput(nextMonths);
                              setHouseDuesTotalReceivedInput(houseDuesAmountInput * nextMonths);
                              const baseMonth = (houseDuesMonthInput.split(/[,;/+]+/)[0] || defaultMonthLabel).trim();
                              const generatedMonths = getSubsequentMonthLabels(baseMonth, nextMonths);
                              setHouseDuesMonthInput(generatedMonths.join(', '));
                            } else if (nextStatus === 'Lunas') {
                              setHouseDuesPaidMonthsInput(1);
                              setHouseDuesTotalReceivedInput(houseDuesAmountInput);
                              const baseMonth = (houseDuesMonthInput.split(/[,;/+]+/)[0] || defaultMonthLabel).trim();
                              setHouseDuesMonthInput(baseMonth);
                            }
                          }}
                          className="w-full px-3 py-2 text-xs font-bold bg-white border border-slate-300 rounded-lg focus:ring-1 focus:ring-emerald-500 focus:outline-none"
                        >
                          {isEditingVacant ? (
                            <>
                              <option value="Belum Bayar">Bebas Iuran (Default Rumah Kosong)</option>
                              <option value="Lunas">Lunas (1 Bulan Ini Saja)</option>
                              <option value="Bayar Lebih">Bayar Lebih (&gt;1 Bulan)</option>
                            </>
                          ) : (
                            <>
                              <option value="Lunas">Lunas (1 Bulan Ini Saja)</option>
                              <option value="Bayar Lebih">Bayar Lebih (&gt;1 Bulan)</option>
                              <option value="Belum Bayar">Belum Bayar</option>
                            </>
                          )}
                        </select>
                      </div>
                    </div>

                    {/* Periode / Bulan Pembayaran */}
                    {(houseDuesStatusInput === 'Lunas' || houseDuesStatusInput === 'Bayar Lebih') && (
                      <div className="space-y-2 pt-1 border-t border-emerald-200/60">
                        <label className="block text-[11px] font-bold text-emerald-950">
                          Bulan / Periode Pembayaran (Terisi Otomatis)
                        </label>
                        <input
                          type="text"
                          value={houseDuesMonthInput}
                          onChange={(e) => setHouseDuesMonthInput(e.target.value)}
                          placeholder="Contoh: Oktober 2026, November 2026..."
                          className="w-full px-3 py-2 text-xs bg-white border border-emerald-300 rounded-lg font-bold text-emerald-950 focus:ring-1 focus:ring-emerald-500 focus:outline-none"
                        />

                        {houseDuesStatusInput === 'Bayar Lebih' && (
                          <div className="space-y-2 pt-1">
                            <label className="block text-[10.5px] font-bold text-indigo-900">
                              Pilihan Cepat Bulan Bayar Lebih:
                            </label>
                            <div className="grid grid-cols-2 sm:grid-cols-5 gap-1.5 text-[10.5px]">
                              {[
                                { cnt: 2, label: '2 Bulan' },
                                { cnt: 3, label: '3 Bulan' },
                                { cnt: 4, label: '4 Bulan' },
                                { cnt: 6, label: '6 Bulan' },
                                { cnt: 12, label: '12 Bulan' },
                              ].map((preset) => (
                                <button
                                  key={preset.cnt}
                                  type="button"
                                  onClick={() => {
                                    const baseMonth = (houseDuesMonthInput.split(/[,;/+]+/)[0] || defaultMonthLabel).trim();
                                    const generatedMonths = getSubsequentMonthLabels(baseMonth, preset.cnt);
                                    setHouseDuesMonthInput(generatedMonths.join(', '));
                                    setHouseDuesPaidMonthsInput(preset.cnt);
                                    setHouseDuesTotalReceivedInput(houseDuesAmountInput * preset.cnt);
                                  }}
                                  className="py-1 px-1 rounded-lg font-bold border transition-all cursor-pointer text-center bg-white text-indigo-900 border-indigo-200 hover:bg-indigo-100/70 shadow-2xs"
                                >
                                  {preset.label}
                                </button>
                              ))}
                            </div>

                            <div className="grid grid-cols-2 gap-2 text-xs">
                              <div>
                                <label className="block text-[11px] font-semibold text-indigo-900 mb-0.5">
                                  Total Bulan
                                </label>
                                <input
                                  type="number"
                                  min={2}
                                  max={24}
                                  value={houseDuesPaidMonthsInput}
                                  onChange={(e) => {
                                    const val = Math.max(2, Number(e.target.value) || 2);
                                    setHouseDuesPaidMonthsInput(val);
                                    setHouseDuesTotalReceivedInput(houseDuesAmountInput * val);
                                    const baseMonth = (houseDuesMonthInput.split(/[,;/+]+/)[0] || defaultMonthLabel).trim();
                                    const generatedMonths = getSubsequentMonthLabels(baseMonth, val);
                                    setHouseDuesMonthInput(generatedMonths.join(', '));
                                  }}
                                  className="w-full px-2.5 py-1.5 text-xs bg-white border border-indigo-200 rounded-lg font-mono font-bold text-indigo-950"
                                />
                              </div>
                              <div>
                                <label className="block text-[11px] font-semibold text-indigo-900 mb-0.5">
                                  Total Diterima (Rp)
                                </label>
                                <input
                                  type="number"
                                  min={houseDuesAmountInput * 2}
                                  step={5000}
                                  value={houseDuesTotalReceivedInput}
                                  onChange={(e) => {
                                    const val = Number(e.target.value) || 0;
                                    setHouseDuesTotalReceivedInput(val);
                                    if (houseDuesAmountInput > 0 && val >= houseDuesAmountInput * 2) {
                                      const autoMonths = Math.floor(val / houseDuesAmountInput);
                                      setHouseDuesPaidMonthsInput(autoMonths);
                                      const baseMonth = (houseDuesMonthInput.split(/[,;/+]+/)[0] || defaultMonthLabel).trim();
                                      const generatedMonths = getSubsequentMonthLabels(baseMonth, autoMonths);
                                      setHouseDuesMonthInput(generatedMonths.join(', '));
                                    }
                                  }}
                                  className="w-full px-2.5 py-1.5 text-xs bg-white border border-indigo-200 rounded-lg font-mono font-bold text-indigo-950"
                                />
                              </div>
                            </div>
                          </div>
                        )}

                        <div>
                          <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                            Tanggal Pembayaran Iuran
                          </label>
                          <input
                            type="date"
                            value={houseDuesPaidDateInput}
                            onChange={(e) => setHouseDuesPaidDateInput(e.target.value)}
                            className="w-full px-3 py-1.5 text-xs bg-white border border-slate-300 rounded-lg"
                          />
                        </div>

                        <div>
                          <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                            Catatan Tambahan Transaksi Iuran (Opsional)
                          </label>
                          <input
                            type="text"
                            placeholder="Misal: Titip di bendahara / Transfer BCA..."
                            value={houseDuesCustomNoteInput}
                            onChange={(e) => setHouseDuesCustomNoteInput(e.target.value)}
                            className="w-full px-3 py-1.5 text-xs bg-white border border-slate-300 rounded-lg text-slate-800"
                          />
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* 2. SEKSI EDIT PEMBAYARAN DENDA BAKSOS */}
                {(editingHouseDuesTab === 'all' || editingHouseDuesTab === 'baksos') && (
                  <div className="p-3.5 bg-teal-50/80 border border-teal-200 rounded-xl space-y-3">
                    <div className="flex items-center justify-between pb-1 border-b border-teal-200/80">
                      <span className="font-extrabold text-teal-950 flex items-center gap-1.5">
                        <CheckCircle2 className="w-4 h-4 text-teal-700" />
                        <span>2. Pembayaran Denda Baksos (Kerja Bakti)</span>
                      </span>
                      {houseDuesBaksosStatusInput === 'Lunas' ? (
                        <span className="text-[10px] font-bold text-emerald-800 bg-emerald-100 px-2 py-0.5 rounded-md border border-emerald-300">
                          ✓ Lunas (+{formatRupiah(liveDendaAmount)})
                        </span>
                      ) : houseDuesBaksosStatusInput === 'Belum Bayar' ? (
                        <span className="text-[10px] font-bold text-rose-800 bg-rose-100 px-2 py-0.5 rounded-md border border-rose-300">
                          Belum Bayar ({formatRupiah(Number(houseDuesBaksosAmountInput) || 10000)})
                        </span>
                      ) : (
                        <span className="text-[10px] font-medium text-slate-600 bg-white px-2 py-0.5 rounded-md border border-slate-200">
                          {houseDuesBaksosStatusInput} (Bebas)
                        </span>
                      )}
                    </div>

                    {/* Pilihan Status Denda Baksos */}
                    <div>
                      <label className="block text-[11px] font-bold text-teal-950 mb-1.5">
                        Status Denda Baksos KK Ini:
                      </label>
                      <div className="grid grid-cols-2 sm:grid-cols-5 gap-1.5">
                        <button
                          type="button"
                          onClick={() => {
                            setHouseDuesBaksosStatusInput('Lunas');
                            if ((Number(houseDuesBaksosAmountInput) || 0) <= 0) {
                              setHouseDuesBaksosAmountInput(10000);
                            }
                          }}
                          className={`py-1.5 px-2 rounded-lg text-[11px] font-bold border transition-all cursor-pointer text-center ${
                            houseDuesBaksosStatusInput === 'Lunas'
                              ? 'bg-emerald-600 text-white border-emerald-600 shadow-xs'
                              : 'bg-white text-emerald-900 border-emerald-300 hover:bg-emerald-50'
                          }`}
                        >
                          ✓ Lunas
                        </button>

                        <button
                          type="button"
                          onClick={() => {
                            setHouseDuesBaksosStatusInput('Belum Bayar');
                            if ((Number(houseDuesBaksosAmountInput) || 0) <= 0) {
                              setHouseDuesBaksosAmountInput(10000);
                            }
                          }}
                          className={`py-1.5 px-2 rounded-lg text-[11px] font-bold border transition-all cursor-pointer text-center ${
                            houseDuesBaksosStatusInput === 'Belum Bayar'
                              ? 'bg-rose-600 text-white border-rose-600 shadow-xs'
                              : 'bg-white text-rose-900 border-rose-300 hover:bg-rose-50'
                          }`}
                        >
                          Belum Bayar
                        </button>

                        <button
                          type="button"
                          onClick={() => setHouseDuesBaksosStatusInput('Hadir')}
                          className={`py-1.5 px-2 rounded-lg text-[11px] font-bold border transition-all cursor-pointer text-center ${
                            houseDuesBaksosStatusInput === 'Hadir'
                              ? 'bg-teal-700 text-white border-teal-700 shadow-xs'
                              : 'bg-white text-teal-900 border-teal-200 hover:bg-teal-50'
                          }`}
                        >
                          Hadir (Bebas)
                        </button>

                        <button
                          type="button"
                          onClick={() => setHouseDuesBaksosStatusInput('Tidak Wajib')}
                          className={`py-1.5 px-2 rounded-lg text-[11px] font-bold border transition-all cursor-pointer text-center ${
                            houseDuesBaksosStatusInput === 'Tidak Wajib'
                              ? 'bg-slate-700 text-white border-slate-700 shadow-xs'
                              : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-100'
                          }`}
                        >
                          Tidak Wajib
                        </button>

                        <button
                          type="button"
                          onClick={() => setHouseDuesBaksosStatusInput('Bebas')}
                          className={`py-1.5 px-2 rounded-lg text-[11px] font-bold border transition-all cursor-pointer text-center ${
                            houseDuesBaksosStatusInput === 'Bebas'
                              ? 'bg-neutral-800 text-white border-neutral-800 shadow-xs'
                              : 'bg-white text-slate-600 border-slate-300 hover:bg-slate-100'
                          }`}
                        >
                          Bebas
                        </button>
                      </div>
                    </div>

                    {/* Jika Lunas: Form Detail Pembayaran Denda Baksos */}
                    {houseDuesBaksosStatusInput === 'Lunas' && (
                      <div className="p-3 bg-white/95 rounded-xl border border-teal-200 space-y-2.5">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                          <div>
                            <label className="block text-[11px] font-bold text-teal-950 mb-1">
                              Nominal Pembayaran Denda (Rp)
                            </label>
                            <input
                              type="number"
                              min={0}
                              step={5000}
                              value={houseDuesBaksosAmountInput}
                              onChange={(e) => setHouseDuesBaksosAmountInput(Number(e.target.value) || 0)}
                              className="w-full px-3 py-1.5 text-xs font-mono font-bold bg-white border border-teal-300 rounded-lg text-teal-950 focus:ring-1 focus:ring-teal-500 focus:outline-none"
                            />
                            {/* Tombol cepat nominal denda */}
                            <div className="flex gap-1.5 mt-1">
                              {[10000, 20000, 30000].map((amt) => (
                                <button
                                  key={amt}
                                  type="button"
                                  onClick={() => setHouseDuesBaksosAmountInput(amt)}
                                  className="px-2 py-0.5 text-[10px] font-bold rounded bg-teal-50 text-teal-800 hover:bg-teal-100 border border-teal-200 cursor-pointer"
                                >
                                  +{formatRupiah(amt)}
                                </button>
                              ))}
                            </div>
                          </div>

                          <div>
                            <label className="block text-[11px] font-bold text-teal-950 mb-1">
                              Tanggal Pembayaran Denda
                            </label>
                            <input
                              type="date"
                              value={houseDuesBaksosDateInput || houseDuesPaidDateInput}
                              onChange={(e) => setHouseDuesBaksosDateInput(e.target.value)}
                              className="w-full px-3 py-1.5 text-xs bg-white border border-teal-300 rounded-lg text-slate-800 focus:ring-1 focus:ring-teal-500 focus:outline-none"
                            />
                          </div>
                        </div>

                        <div>
                          <label className="block text-[11px] font-bold text-teal-950 mb-1">
                            Keterangan Transaksi Denda di Buku Kas
                          </label>
                          <input
                            type="text"
                            value={houseDuesBaksosNoteInput}
                            onChange={(e) => setHouseDuesBaksosNoteInput(e.target.value)}
                            placeholder={`Pelunasan Denda Baksos (${formatRupiah(Number(houseDuesBaksosAmountInput) || 10000)}) - Blok ${editingHouseDues.blockNumber} (${houseDuesHeadNameInput || editingHouseDues.headName})`}
                            className="w-full px-3 py-1.5 text-xs bg-white border border-teal-300 rounded-lg text-slate-800 focus:ring-1 focus:ring-teal-500 focus:outline-none"
                          />
                        </div>

                        <div className="p-2 bg-emerald-50 rounded-lg border border-emerald-200 text-[10.5px] text-emerald-900 flex items-center gap-1.5">
                          <Check className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                          <span>
                            Otomatis dicatat di <strong>Buku Kas Keluar Masuk</strong> (+{formatRupiah(Number(houseDuesBaksosAmountInput) || 10000)}) kategori <strong>Denda Baksos</strong> &amp; status agenda ditandai <strong>Lunas</strong>.
                          </span>
                        </div>
                      </div>
                    )}

                    {/* Jika Belum Bayar */}
                    {houseDuesBaksosStatusInput === 'Belum Bayar' && (
                      <div className="p-2.5 bg-rose-50/90 rounded-xl border border-rose-200 text-[11px] text-rose-950 space-y-1.5">
                        <div className="flex items-center justify-between">
                          <span className="font-bold flex items-center gap-1">
                            <AlertTriangle className="w-3.5 h-3.5 text-rose-600 shrink-0" />
                            <span>Kewajiban Denda Tertunggak:</span>
                          </span>
                          <div className="flex items-center gap-1">
                            <span className="text-slate-600 text-[10px]">Nominal: Rp</span>
                            <input
                              type="number"
                              min={0}
                              step={5000}
                              value={houseDuesBaksosAmountInput}
                              onChange={(e) => setHouseDuesBaksosAmountInput(Number(e.target.value) || 0)}
                              className="w-24 px-2 py-0.5 text-xs font-mono font-bold bg-white border border-rose-300 rounded text-rose-950"
                            />
                          </div>
                        </div>
                        <p className="text-[10px] text-rose-800">
                          *Tercatat sebagai Denda Belum Bayar di Tabel Rekap Iuran dan Laporan Baksos. Penerimaan kas denda sebelumnya (jika ada) akan otomatis dibersihkan dari Buku Kas.
                        </p>
                      </div>
                    )}

                    {/* Jika Hadir / Bebas */}
                    {(houseDuesBaksosStatusInput === 'Hadir' || houseDuesBaksosStatusInput === 'Tidak Wajib' || houseDuesBaksosStatusInput === 'Bebas') && (
                      <div className="p-2 bg-slate-100 rounded-lg text-[10.5px] text-slate-700">
                        *KK ini bebas dari denda baksos. Transaksi penerimaan denda baksos untuk KK ini pada periode ini akan dibersihkan dari Buku Kas jika sebelumnya tercatat.
                      </div>
                    )}

                    {/* Pelunasan cepat agenda baksos yang terdaftar */}
                    {baksosModalInfo.unpaidAgendas.length > 0 && onMarkFinePaid && (
                      <div className="pt-2 border-t border-teal-200/70 space-y-1.5">
                        <span className="text-[11px] font-bold text-teal-900 block">
                          Daftar Agenda Baksos Belum Bayar:
                        </span>
                        {baksosModalInfo.unpaidAgendas.map((agenda) => (
                          <div
                            key={agenda.id}
                            className="flex items-center justify-between text-xs bg-white p-2 rounded-lg border border-teal-200 gap-2"
                          >
                            <span className="text-slate-800 text-[11px] font-medium truncate" title={agenda.title}>
                              {agenda.title} ({formatDateDDMMYYYY(agenda.date)})
                            </span>
                            <button
                              type="button"
                              onClick={() => {
                                setHouseDuesBaksosStatusInput('Lunas');
                                setHouseDuesBaksosAmountInput(agenda.fineAmount || 10000);
                                setHouseDuesBaksosNoteInput(
                                  `Pelunasan Denda Baksos (${agenda.title}) - Blok ${editingHouseDues.blockNumber} (${houseDuesHeadNameInput || editingHouseDues.headName})`
                                );
                              }}
                              className="px-2.5 py-1 text-[10px] font-bold bg-teal-600 hover:bg-teal-700 text-white rounded-md cursor-pointer shrink-0 transition-all shadow-2xs"
                            >
                              Pilih untuk Dilunaskan (+{formatRupiah(agenda.fineAmount || 10000)})
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* 3. SEKSI EDIT PEMBAYARAN TUNGGAKAN & SALDO TUNGGAKAN LALU */}
                {(editingHouseDuesTab === 'all' || editingHouseDuesTab === 'tunggakan') && (
                  <div className="p-3.5 bg-rose-50/80 border border-rose-200 rounded-xl space-y-3">
                    <div className="flex items-center justify-between pb-1 border-b border-rose-200/80">
                      <span className="font-extrabold text-rose-950 flex items-center gap-1.5">
                        <AlertTriangle className="w-4 h-4 text-rose-600" />
                        <span>3. Pembayaran Tunggakan &amp; Saldo Tunggakan Lalu</span>
                      </span>
                      {liveTunggakanAmount > 0 ? (
                        <span className="text-[10px] font-bold text-emerald-800 bg-emerald-100 px-2 py-0.5 rounded-md border border-emerald-300">
                          ✓ Bayar Tunggakan +{formatRupiah(liveTunggakanAmount)}
                        </span>
                      ) : (
                        <span className="text-[10px] font-medium text-slate-500 bg-white px-2 py-0.5 rounded-md border border-slate-200">
                          Belum Ada Pembayaran
                        </span>
                      )}
                    </div>

                    {/* Status Saldo Pokok Tunggakan Saat Ini */}
                    <div className="p-2.5 bg-white rounded-xl border border-rose-200 flex items-center justify-between flex-wrap gap-2">
                      <div>
                        <span className="text-[11px] text-slate-600 font-semibold block">
                          Saldo Pokok Tunggakan Lalu KK Ini:
                        </span>
                        <span className="text-sm font-mono font-black text-rose-700">
                          {formatRupiah(currentPrevArrearsNum)}
                        </span>
                      </div>

                      {/* Tombol Cepat Lunas Semua / Sebagian */}
                      <div className="flex flex-wrap items-center gap-1">
                        {currentPrevArrearsNum > 0 && (
                          <button
                            type="button"
                            onClick={() => {
                              setHouseDuesTunggakanPaidInput(currentPrevArrearsNum);
                              setHouseDuesAutoDeductArrears(true);
                            }}
                            className="px-2.5 py-1 text-[10.5px] font-bold bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg cursor-pointer transition-all shadow-2xs"
                          >
                            Lunas Semua ({formatRupiah(currentPrevArrearsNum)})
                          </button>
                        )}
                        {[25000, 50000, 100000].map((amt) => (
                          <button
                            key={amt}
                            type="button"
                            onClick={() => setHouseDuesTunggakanPaidInput(amt)}
                            className="px-2 py-1 text-[10.5px] font-bold bg-rose-100/80 hover:bg-rose-200/90 text-rose-900 border border-rose-300 rounded-lg cursor-pointer transition-all"
                          >
                            +{formatRupiah(amt)}
                          </button>
                        ))}
                        {liveTunggakanAmount > 0 && (
                          <button
                            type="button"
                            onClick={() => setHouseDuesTunggakanPaidInput(0)}
                            className="px-2 py-1 text-[10.5px] font-bold bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-lg cursor-pointer"
                          >
                            Reset (Rp 0)
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Input Nominal Pembayaran Tunggakan */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-bold text-rose-950 mb-1">
                          Nominal Pembayaran Tunggakan yang Diterima (Rp)
                        </label>
                        <input
                          type="number"
                          min={0}
                          step={5000}
                          value={houseDuesTunggakanPaidInput}
                          onChange={(e) => setHouseDuesTunggakanPaidInput(Number(e.target.value) || 0)}
                          placeholder="0"
                          className="w-full px-3 py-2 text-xs font-mono font-bold bg-white border border-rose-300 rounded-lg text-rose-950 focus:ring-1 focus:ring-rose-500 focus:outline-none shadow-2xs"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-bold text-slate-700 mb-1">
                          Tanggal Pembayaran Tunggakan
                        </label>
                        <input
                          type="date"
                          value={houseDuesTunggakanDateInput || houseDuesPaidDateInput}
                          onChange={(e) => setHouseDuesTunggakanDateInput(e.target.value)}
                          className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-lg text-slate-800 focus:ring-1 focus:ring-rose-500 focus:outline-none"
                        />
                      </div>
                    </div>

                    {/* Keterangan Transaksi Pembayaran Tunggakan */}
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                        Keterangan Transaksi Tunggakan di Buku Kas
                      </label>
                      <input
                        type="text"
                        value={houseDuesTunggakanNoteInput}
                        onChange={(e) => setHouseDuesTunggakanNoteInput(e.target.value)}
                        placeholder={`Pelunasan Tunggakan Lalu Blok ${editingHouseDues.blockNumber} (${houseDuesHeadNameInput || editingHouseDues.headName})`}
                        className="w-full px-3 py-1.5 text-xs bg-white border border-slate-300 rounded-lg text-slate-800 focus:ring-1 focus:ring-rose-500 focus:outline-none"
                      />
                    </div>

                    {/* Checkbox Otomatis Potong Saldo Tunggakan */}
                    <div className="p-2.5 bg-white rounded-xl border border-rose-200 space-y-2">
                      <label className="flex items-center gap-2 text-xs font-bold text-slate-800 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={houseDuesAutoDeductArrears}
                          onChange={(e) => setHouseDuesAutoDeductArrears(e.target.checked)}
                          className="w-4 h-4 text-rose-600 rounded focus:ring-rose-500 border-slate-300 cursor-pointer"
                        />
                        <span>Otomatis potong sisa Saldo Tunggakan Lalu KK ini</span>
                      </label>

                      {liveTunggakanAmount > 0 && (
                        <div className="p-2 bg-rose-50 rounded-lg border border-rose-200 text-[11px] text-rose-950 space-y-0.5 font-mono">
                          <div>
                            Saldo Awal: {formatRupiah(currentPrevArrearsNum)} - Pembayaran: {formatRupiah(liveTunggakanAmount)}
                          </div>
                          <div className="font-bold text-rose-800">
                            Sisa Saldo Tunggakan Nanti: {formatRupiah(estRemainingArrears)}
                          </div>
                          <div className="text-[10px] text-emerald-800 font-sans font-semibold pt-1 border-t border-rose-200/70">
                            ✓ Otomatis tercatat di Buku Kas (+{formatRupiah(liveTunggakanAmount)}) kategori <strong>Pembayaran Tunggakan</strong>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Edit Manual Saldo Pokok Tunggakan Lalu (Jika Pengurus ingin koreksi nominal dasar) */}
                    <div className="pt-2 border-t border-rose-200/70">
                      <span className="block text-[11px] font-bold text-slate-700 mb-1.5">
                        Koreksi Saldo Pokok Tunggakan Profil KK (Opsional):
                      </span>
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="block text-[10px] text-slate-500 mb-0.5">Saldo Pokok (Rp)</label>
                          <input
                            type="number"
                            min={0}
                            step={5000}
                            disabled={isEditingVacant}
                            value={houseDuesPrevArrearsInput}
                            onChange={(e) => setHouseDuesPrevArrearsInput(Number(e.target.value) || 0)}
                            className="w-full px-2.5 py-1 text-xs font-mono bg-white border border-slate-300 rounded-lg"
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] text-slate-500 mb-0.5">Keterangan Pokok</label>
                          <input
                            type="text"
                            disabled={isEditingVacant}
                            placeholder="Sisa iuran bulan lalu..."
                            value={houseDuesPrevNoteInput}
                            onChange={(e) => setHouseDuesPrevNoteInput(e.target.value)}
                            className="w-full px-2.5 py-1 text-xs bg-white border border-slate-300 rounded-lg"
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Ringkasan Akumulasi Total Pembayaran yang Akan Disimpan */}
                <div className="p-3 bg-gradient-to-r from-emerald-50 via-teal-50 to-indigo-50 border border-emerald-300 rounded-xl space-y-1.5">
                  <span className="font-extrabold text-slate-900 text-xs flex items-center justify-between">
                    <span>Ringkasan Input Pembayaran KK Ini:</span>
                    <span className="font-mono text-sm font-black text-emerald-900">
                      Total Input Baru: +{formatRupiah((preserveExistingDues ? 0 : liveIuranTotal) + liveDendaAmount + liveTunggakanAmount)}
                    </span>
                  </span>
                  <div className="grid grid-cols-3 gap-1 text-[10.5px] font-mono text-slate-700 pt-1 border-t border-emerald-200/60">
                    <div>
                      <span className="text-[10px] text-slate-500 block font-sans">Iuran Bulanan:</span>
                      <span className="font-bold text-emerald-800">
                        {preserveExistingDues
                          ? `(Terjaga ${editingHouseDues.duesPaidMonths && editingHouseDues.duesPaidMonths > 1 ? `${editingHouseDues.duesPaidMonths} Bln` : 'Aman'})`
                          : `+${formatRupiah(liveIuranTotal)}`}
                      </span>
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-500 block font-sans">Denda Baksos:</span>
                      <span className="font-bold text-teal-800">+{formatRupiah(liveDendaAmount)}</span>
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-500 block font-sans">Tunggakan:</span>
                      <span className="font-bold text-rose-800">+{formatRupiah(liveTunggakanAmount)}</span>
                    </div>
                  </div>
                </div>

                {/* Footer Tombol Aksi */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 pt-3 border-t border-slate-200 shrink-0">
                  <button
                    type="button"
                    onClick={() => {
                      setDeletingSingleHouse({
                        house: editingHouseDues,
                        period: houseDuesMonthInput || selectedKKPeriod || defaultMonthLabel,
                      });
                    }}
                    className="px-3 py-1.5 text-xs bg-rose-50 hover:bg-rose-100 active:scale-95 text-rose-700 font-bold border border-rose-200 hover:border-rose-300 rounded-lg flex items-center justify-center gap-1.5 cursor-pointer shadow-2xs transition-all"
                    title="Hapus dan kosongkan pembayaran untuk KK ini (otomatis hapus transaksi di Buku Kas)"
                  >
                    <Trash2 className="w-3.5 h-3.5 text-rose-600" />
                    <span>Hapus / Kosongkan Pembayaran KK Ini</span>
                  </button>

                  <div className="flex justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => setEditingHouseDues(null)}
                      className="px-3.5 py-1.5 text-xs text-slate-600 hover:bg-slate-100 rounded-lg cursor-pointer font-semibold transition-colors"
                    >
                      Batal
                    </button>
                    <button
                      type="submit"
                      className="px-4 py-2 text-xs bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white font-extrabold rounded-lg cursor-pointer shadow-xs transition-all flex items-center gap-1.5"
                    >
                      <Save className="w-3.5 h-3.5" />
                      <span>{preserveExistingDues ? 'Simpan Denda Baksos & Tunggakan' : 'Simpan & Sinkron Buku Kas'}</span>
                    </button>
                  </div>
                </div>
              </form>
            </div>
          </div>
        );
      })()}

      {/* MODAL: KONFIRMASI HAPUS PEMBAYARAN 1 KK & BERSIHKAN BUKU KAS */}
      {deletingSingleHouse && (() => {
        const { house, period } = deletingSingleHouse;
        const displayName = house.duesHeadNameOverride || house.headName;
        const periodLabel = period !== 'semua' ? period : getHousePeriodLabel(house);
        const matchingTxs = findTransactionsForHousePeriod(house, periodLabel);
        const totalTxAmount = matchingTxs.reduce((sum, t) => sum + t.amount, 0);

        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs">
            <div className="bg-white rounded-2xl shadow-xl border border-slate-200 w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95">
              <div className="bg-rose-600 p-4 text-white flex justify-between items-center">
                <div className="flex items-center gap-2">
                  <Trash2 className="w-5 h-5 text-rose-200" />
                  <h4 className="font-bold text-sm sm:text-base">Hapus Pembayaran KK</h4>
                </div>
                <button
                  type="button"
                  onClick={() => setDeletingSingleHouse(null)}
                  className="text-white/70 hover:text-white cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="p-5 space-y-4">
                <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-xl text-xs space-y-2 text-rose-950">
                  <p className="font-bold">
                    Konfirmasi pembatalan &amp; penghapusan seluruh pembayaran untuk:
                  </p>
                  <div className="bg-white p-2.5 rounded-lg border border-rose-200 space-y-1 font-mono text-[11px]">
                    <div><strong>No Blok:</strong> Blok {house.blockNumber}</div>
                    <div><strong>Nama KK:</strong> {displayName}</div>
                    <div><strong>Periode:</strong> {periodLabel}</div>
                    <div><strong>Status Saat Ini:</strong> {house.duesStatus}</div>
                    {totalTxAmount > 0 && (
                      <div className="text-rose-700 font-bold pt-1 border-t border-rose-100">
                        <strong>Tercatat di Buku Kas:</strong> {formatRupiah(totalTxAmount)} ({matchingTxs.length} transaksi)
                      </div>
                    )}
                  </div>
                </div>

                <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-[11px] text-amber-900 leading-relaxed">
                  ⚠️ <strong>Dampak ke Buku Kas:</strong> Status iuran warga untuk KK ini akan kembali ke <strong>Belum Bayar (Rp 0)</strong>, dan seluruh transaksi penerimaan kas terkait untuk KK ini pada periode tersebut akan <strong>otomatis dihapus dari Buku Kas Keluar Masuk</strong>. Saldo kas utama akan langsung berkurang sesuai nominal yang dihapus.
                </div>

                <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setDeletingSingleHouse(null)}
                    className="px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-100 rounded-lg cursor-pointer font-semibold"
                  >
                    Batal
                  </button>
                  <button
                    type="button"
                    onClick={() => handleResetSingleHousePayment(house, periodLabel)}
                    className="px-4 py-2 text-xs bg-rose-600 hover:bg-rose-700 active:scale-95 text-white font-bold rounded-lg cursor-pointer shadow-xs flex items-center gap-1.5"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Ya, Hapus &amp; Kurangi Kas</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        );
      })()}

      {/* MODAL: HAPUS TOTAL SEMUA PEMBAYARAN PERIODE & BERSIHKAN BUKU KAS */}
      {isResetAllModalOpen && (() => {
        const targetPeriod = resetAllTargetPeriod || selectedKKPeriod || defaultMonthLabel;
        const isAllPeriods = targetPeriod === 'semua';
        const periodKey = parseIndonesianMonthYearToKey(targetPeriod);
        const targetLower = targetPeriod.toLowerCase();

        // Hitung berapa transaksi dan nominal yang akan terhapus
        const matchingIuranTxs = transactions.filter((tx) => {
          if (tx.type !== 'masuk') return false;
          const cat = tx.category || '';
          const desc = (tx.description || '').toLowerCase();
          const isIuran = cat === 'Iuran Warga' || desc.includes('iuran');
          const isDenda = cat === 'Denda Baksos' || desc.includes('denda');
          const isTunggakan = cat === 'Pembayaran Tunggakan' || desc.includes('tunggakan');

          if (!isIuran && (!resetAllResetBaksos || !isDenda) && (!resetAllResetTunggakan || !isTunggakan)) {
            return false;
          }

          if (isAllPeriods) return true;
          const mKey = getMonthKeyFromDate(tx.date);
          return desc.includes(targetLower) || (periodKey && mKey === periodKey);
        });

        const totalNominalHapus = matchingIuranTxs.reduce((sum, t) => sum + t.amount, 0);

        // Hitung jumlah KK yang berstatus bayar pada periode ini
        const affectedHouses = residents.filter((h) => {
          if (isAllPeriods) {
            return h.duesStatus === 'Lunas' || h.duesStatus === 'Bayar Lebih' || (h.duesPaidAmount || 0) > 0;
          }
          const st = getHouseStatusForPeriod(h, targetPeriod);
          return st.status === 'Lunas' || st.status === 'Bayar Lebih' || (st.amount || 0) > 0;
        });

        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs">
            <div className="bg-white rounded-2xl shadow-xl border border-slate-200 w-full max-w-lg overflow-hidden animate-in fade-in zoom-in-95">
              <div className="bg-gradient-to-r from-rose-600 to-rose-700 p-4 text-white flex justify-between items-center">
                <div className="flex items-center gap-2">
                  <Trash2 className="w-5 h-5 text-rose-200" />
                  <h4 className="font-bold text-sm sm:text-base">Hapus Total Semua Pembayaran</h4>
                </div>
                <button
                  type="button"
                  onClick={() => setIsResetAllModalOpen(false)}
                  className="text-white/70 hover:text-white cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="p-5 space-y-4">
                <div className="space-y-1.5">
                  <label className="block text-xs font-bold text-slate-800">
                    Pilih Periode Pembayaran yang Ingin Dihapus Total:
                  </label>
                  <select
                    value={resetAllTargetPeriod}
                    onChange={(e) => setResetAllTargetPeriod(e.target.value)}
                    className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-xl font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-rose-500/30"
                  >
                    {sortedPeriods.map((p) => (
                      <option key={p} value={p}>
                        Periode {p} {p === defaultMonthLabel ? '(Bulan Berjalan)' : ''}
                      </option>
                    ))}
                    <option value="semua">Semua Periode (Total Seluruh KK)</option>
                  </select>
                </div>

                {/* Rangkuman Dampak */}
                <div className="p-3.5 bg-rose-50/90 border border-rose-200 rounded-xl space-y-2 text-xs text-rose-950">
                  <span className="font-bold flex items-center gap-1.5 text-rose-900">
                    <RotateCcw className="w-4 h-4 text-rose-600" />
                    <span>Rincian Pembayaran yang Akan Dihapus &amp; Dikosongkan:</span>
                  </span>
                  <div className="grid grid-cols-2 gap-2 pt-1 font-mono text-[11px]">
                    <div className="bg-white p-2.5 rounded-lg border border-rose-200">
                      <span className="text-[10px] text-slate-500 font-sans block">Jumlah KK Tercatat Lunas:</span>
                      <span className="font-bold text-slate-900 text-sm">{affectedHouses.length} KK</span>
                    </div>
                    <div className="bg-white p-2.5 rounded-lg border border-rose-200">
                      <span className="text-[10px] text-slate-500 font-sans block">Transaksi Kas Dihapus:</span>
                      <span className="font-bold text-rose-700 text-sm">{matchingIuranTxs.length} Transaksi</span>
                    </div>
                  </div>
                  <div className="bg-white p-2.5 rounded-lg border border-rose-200 flex items-center justify-between font-mono">
                    <span className="text-[11px] text-slate-600 font-sans">Total Kas yang Akan Berkurang:</span>
                    <span className="font-bold text-rose-700 text-sm">-{formatRupiah(totalNominalHapus)}</span>
                  </div>
                </div>

                {/* Checkbox Opsi */}
                <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-2 text-xs">
                  <label className="flex items-start gap-2 cursor-pointer font-medium text-slate-800">
                    <input
                      type="checkbox"
                      checked={resetAllDeleteTxs}
                      onChange={(e) => setResetAllDeleteTxs(e.target.checked)}
                      className="mt-0.5 rounded text-rose-600 focus:ring-rose-500"
                    />
                    <span>
                      <strong>Otomatis hapus dari Buku Kas Keluar Masuk</strong> (Saldo kas utama dan riwayat mutasi kas akan langsung disesuaikan berkurang)
                    </span>
                  </label>
                  <label className="flex items-start gap-2 cursor-pointer font-medium text-slate-800">
                    <input
                      type="checkbox"
                      checked={resetAllResetBaksos}
                      onChange={(e) => setResetAllResetBaksos(e.target.checked)}
                      className="mt-0.5 rounded text-rose-600 focus:ring-rose-500"
                    />
                    <span>
                      Batalkan tanda lunas denda baksos untuk periode ini
                    </span>
                  </label>
                </div>

                {/* Peringatan Kritis */}
                <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-[11px] text-amber-900 leading-relaxed">
                  ⚠️ <strong>Perhatian:</strong> Tindakan ini akan mengembalikan seluruh status iuran KK pada periode <strong>{targetPeriod}</strong> menjadi <strong>Belum Bayar (Rp 0)</strong>. Semua transaksi iuran terkait di Buku Kas akan langsung dibersihkan sehingga pembukuan kas tetap sinkron dan akurat.
                </div>

                <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setIsResetAllModalOpen(false)}
                    className="px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-100 rounded-lg cursor-pointer font-semibold"
                  >
                    Batal
                  </button>
                  <button
                    type="button"
                    onClick={handleConfirmResetAllDues}
                    className="px-4 py-2 text-xs bg-rose-600 hover:bg-rose-700 active:scale-95 text-white font-bold rounded-xl cursor-pointer shadow-xs flex items-center gap-1.5"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Ya, Hapus Total Semua Pembayaran</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        );
      })()}

      {/* MODAL 3: PENYESUAIAN SALDO */}
      {isAdjustModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs">
          <div className="bg-white rounded-2xl shadow-xl border border-slate-200 w-full max-w-md overflow-hidden">
            <div className="bg-slate-900 p-4 text-white flex justify-between items-center">
              <h4 className="font-bold text-sm sm:text-base">Koreksi / Sesuaikan Saldo</h4>
              <button
                type="button"
                onClick={() => setIsAdjustModalOpen(false)}
                className="text-white/70 hover:text-white cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleSaveAdjustments} className="p-5 space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Target Saldo Kas Utama (Rp)
                </label>
                <input
                  type="number"
                  value={adjustTargetKas}
                  onChange={(e) => setAdjustTargetKas(Number(e.target.value) || 0)}
                  className="w-full px-3 py-2 text-xs font-mono font-bold border border-slate-300 rounded-lg"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Target Cashback WiFi (Rp)
                </label>
                <input
                  type="number"
                  value={adjustTargetWifi}
                  onChange={(e) => setAdjustTargetWifi(Number(e.target.value) || 0)}
                  className="w-full px-3 py-2 text-xs font-mono font-bold border border-slate-300 rounded-lg"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Target Cashback Sampah (Rp)
                </label>
                <input
                  type="number"
                  value={adjustTargetSampah}
                  onChange={(e) => setAdjustTargetSampah(Number(e.target.value) || 0)}
                  className="w-full px-3 py-2 text-xs font-mono font-bold border border-slate-300 rounded-lg"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Alasan Penyesuaian
                </label>
                <input
                  type="text"
                  value={adjustReason}
                  onChange={(e) => setAdjustReason(e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg"
                />
              </div>
              <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsAdjustModalOpen(false)}
                  className="px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-100 rounded-lg cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 text-xs bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-lg cursor-pointer"
                >
                  Simpan Saldo
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 4: SHARE WHATSAPP (BENTUK GAMBAR GRAFIS & FORMAT TEKS) */}
      {isWaModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-xs overflow-y-auto">
          <div className="bg-white rounded-3xl shadow-2xl border border-slate-200 w-full max-w-3xl overflow-hidden my-auto animate-in fade-in zoom-in-95 max-h-[92vh] flex flex-col">
            {/* Modal Header */}
            <div className="bg-gradient-to-r from-emerald-800 via-teal-800 to-slate-900 p-4 sm:p-5 text-white flex justify-between items-center shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-emerald-500/20 border border-emerald-400/30 text-emerald-300">
                  <MessageCircle className="w-5 h-5 text-emerald-400" />
                </div>
                <div>
                  <h4 className="font-extrabold text-sm sm:text-base text-white">
                    Laporan Keuangan WhatsApp
                  </h4>
                  <p className="text-[11px] text-emerald-200/90 font-medium">
                    Bentuk Gambar Grafis Buku Kas & Format Teks Ringkasan
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsWaModalOpen(false)}
                className="text-white/70 hover:text-white p-1 rounded-lg hover:bg-white/10 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-4 sm:p-5 space-y-4 overflow-y-auto flex-1">
              {/* Tab Selector: 1. Bentuk Gambar Kas | 2. Format Teks Arus Kas | 3. Format Teks Iuran KK | 4. Format Teks Rekap Keseluruhan KK */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5 p-1 bg-slate-100 rounded-2xl text-xs font-bold">
                <button
                  type="button"
                  onClick={() => {
                    setWaRecapMode('gambar_kas');
                    if (!waImageDataUrl) generateWaImageNow();
                  }}
                  className={`py-2 px-2 rounded-xl transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                    waRecapMode === 'gambar_kas'
                      ? 'bg-emerald-600 text-white shadow-sm ring-1 ring-emerald-500'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-white/60'
                  }`}
                >
                  <LucideImage className="w-3.5 h-3.5 text-amber-300" />
                  <span className="truncate">1. Gambar Kas</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setWaRecapMode('keluar_masuk');
                    setWaCustomText('');
                  }}
                  className={`py-2 px-2 rounded-xl transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                    waRecapMode === 'keluar_masuk'
                      ? 'bg-emerald-600 text-white shadow-sm ring-1 ring-emerald-500'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-white/60'
                  }`}
                >
                  <FileText className="w-3.5 h-3.5 text-teal-300" />
                  <span className="truncate">2. Teks Arus Kas</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setWaRecapMode('iuran_kk');
                    setWaCustomText('');
                  }}
                  className={`py-2 px-2 rounded-xl transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                    waRecapMode === 'iuran_kk'
                      ? 'bg-emerald-600 text-white shadow-sm ring-1 ring-emerald-500'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-white/60'
                  }`}
                >
                  <Users className="w-3.5 h-3.5 text-cyan-300" />
                  <span className="truncate">3. Iuran Per KK</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setWaRecapMode('rekap_total_kk');
                    setWaCustomText('');
                  }}
                  className={`py-2 px-2 rounded-xl transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                    waRecapMode === 'rekap_total_kk'
                      ? 'bg-purple-600 text-white shadow-sm ring-1 ring-purple-500'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-white/60'
                  }`}
                >
                  <Coins className="w-3.5 h-3.5 text-amber-300" />
                  <span className="truncate">4. Rekap Semua KK</span>
                </button>
              </div>

              {/* VIEW A: BENTUK GAMBAR BUKU KAS (DARI TABEL HINGGA TOTAL SISA SALDO KESELURUHAN) */}
              {waRecapMode === 'gambar_kas' && (
                <div className="space-y-3.5">
                  <div className="p-3 bg-gradient-to-r from-emerald-50 via-teal-50 to-sky-50 border border-emerald-200 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                    <div className="space-y-0.5">
                      <span className="text-xs font-black text-emerald-950 flex items-center gap-1.5">
                        <LucideImage className="w-4 h-4 text-emerald-600" />
                        <span>Bentuk Gambar Resmi Buku Keluar &amp; Masuk Kas</span>
                      </span>
                      <p className="text-[11px] text-slate-600 leading-snug">
                        Mencakup seluruh tabel pembukuan kas dari saldo awal, penerimaan iuran, mutasi transaksi, hingga <strong>Total Sisa Saldo Keseluruhan</strong> di paling bawah.
                      </p>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      <button
                        type="button"
                        onClick={generateWaImageNow}
                        disabled={isGeneratingImage}
                        className="px-2.5 py-1.5 rounded-xl bg-white hover:bg-slate-100 text-slate-700 text-xs font-bold border border-slate-200 shadow-2xs transition-all cursor-pointer flex items-center gap-1 active:scale-95 disabled:opacity-50"
                        title="Buat ulang / refresh gambar dari data terbaru"
                      >
                        <RotateCcw className={`w-3.5 h-3.5 ${isGeneratingImage ? 'animate-spin text-emerald-600' : ''}`} />
                        <span>{isGeneratingImage ? 'Memproses...' : 'Refresh Gambar'}</span>
                      </button>
                    </div>
                  </div>

                  {/* Area Pratinjau Gambar */}
                  <div className="relative border-2 border-slate-200 rounded-2xl bg-slate-900/5 overflow-hidden flex flex-col items-center justify-center min-h-[300px] max-h-[55vh] p-2">
                    {isGeneratingImage ? (
                      <div className="flex flex-col items-center justify-center p-8 text-center space-y-3">
                        <div className="w-10 h-10 border-4 border-emerald-600 border-t-transparent rounded-full animate-spin" />
                        <div className="space-y-1">
                          <p className="text-xs font-bold text-slate-800">
                            Sedang Merender Gambar Laporan Keuangan...
                          </p>
                          <p className="text-[11px] text-slate-500">
                            Menyusun tabel buku kas, mutasi transaksi, dan total sisa saldo keseluruhan
                          </p>
                        </div>
                      </div>
                    ) : waImageDataUrl ? (
                      <div className="w-full h-full overflow-y-auto rounded-xl border border-slate-200 bg-white shadow-inner flex justify-center">
                        <img
                          src={waImageDataUrl}
                          alt="Laporan Kas Gang Mandor"
                          className="w-full max-w-full h-auto object-contain block shadow-sm"
                        />
                      </div>
                    ) : (
                      <div className="text-center p-8 space-y-2">
                        <p className="text-xs font-bold text-slate-700">Gambar belum dibuat</p>
                        <button
                          type="button"
                          onClick={generateWaImageNow}
                          className="px-3 py-1.5 bg-emerald-600 text-white font-bold text-xs rounded-xl cursor-pointer"
                        >
                          Buat Gambar Sekarang
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Keterangan Saldo yang Tercakup di Gambar */}
                  <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-[11px] text-slate-700 space-y-1">
                    <div className="flex items-center justify-between font-mono font-bold">
                      <span className="text-slate-600 font-sans">Total Sisa Saldo Keseluruhan di Gambar:</span>
                      <span className="text-emerald-800 font-black text-xs sm:text-sm">
                        {formatRupiah(tableTotals.finalSaldo)}
                      </span>
                    </div>
                    <div className="text-[10px] text-slate-500">
                      (Kas Utama: {formatRupiah(tableTotals.finalKasUtama)} | Cashback WiFi: {formatRupiah(tableTotals.finalWifi)} | Cashback Sampah: {formatRupiah(tableTotals.finalSampah)})
                    </div>
                  </div>
                </div>
              )}

              {/* VIEW B & C: FORMAT TEKS WHATSAPP */}
              {(waRecapMode === 'keluar_masuk' || waRecapMode === 'iuran_kk') && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="block text-xs font-bold text-slate-800">
                      Preview Pesan WhatsApp Teks ({waRecapMode === 'keluar_masuk' ? 'Arus Kas' : 'Rekap Iuran KK'}):
                    </label>
                    <span className="text-[10px] text-slate-500">
                      Dapat diedit sebelum dibagikan
                    </span>
                  </div>
                  <textarea
                    rows={9}
                    value={waCustomText || previewWaText}
                    onChange={(e) => setWaCustomText(e.target.value)}
                    className="w-full p-3 text-xs font-mono bg-slate-50 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/30 leading-relaxed text-slate-800"
                  />
                </div>
              )}
            </div>

            {/* Modal Footer Controls */}
            <div className="p-4 bg-slate-50 border-t border-slate-200 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5 shrink-0">
              <button
                type="button"
                onClick={() => setIsWaModalOpen(false)}
                className="px-3.5 py-2 text-xs text-slate-600 hover:bg-slate-200/80 rounded-xl font-bold cursor-pointer transition-colors text-center order-2 sm:order-1"
              >
                Tutup
              </button>

              <div className="flex flex-wrap items-center justify-end gap-2 order-1 sm:order-2">
                {waRecapMode === 'gambar_kas' ? (
                  <>
                    {/* 1. Salin Gambar ke Clipboard */}
                    <button
                      type="button"
                      onClick={handleCopyWaImage}
                      disabled={!waImageDataUrl || isGeneratingImage}
                      className="flex-1 sm:flex-initial flex items-center justify-center gap-1.5 px-3.5 py-2 text-xs font-bold text-slate-800 bg-white hover:bg-slate-100 border border-slate-300 rounded-xl shadow-2xs cursor-pointer transition-all active:scale-95 disabled:opacity-50"
                      title="Salin gambar langsung ke clipboard untuk dipaste (Ctrl+V) di WhatsApp"
                    >
                      {copiedWaImage ? (
                        <>
                          <Check className="w-3.5 h-3.5 text-emerald-600" />
                          <span className="text-emerald-700 font-extrabold">Gambar Tersalin!</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-3.5 h-3.5 text-slate-600" />
                          <span>Salin Gambar</span>
                        </>
                      )}
                    </button>

                    {/* 2. Unduh Gambar PNG */}
                    <button
                      type="button"
                      onClick={handleDownloadWaImage}
                      disabled={!waImageDataUrl || isGeneratingImage}
                      className="flex-1 sm:flex-initial flex items-center justify-center gap-1.5 px-3.5 py-2 text-xs font-bold text-teal-900 bg-teal-50 hover:bg-teal-100 border border-teal-300 rounded-xl shadow-2xs cursor-pointer transition-all active:scale-95 disabled:opacity-50"
                      title="Unduh file gambar laporan kas (.png)"
                    >
                      <Download className="w-3.5 h-3.5 text-teal-700" />
                      <span>Unduh Gambar</span>
                    </button>

                    {/* 3. Kirim ke WhatsApp */}
                    <button
                      type="button"
                      onClick={handleShareWaImage}
                      disabled={!waImageDataUrl || isGeneratingImage}
                      className="w-full sm:w-auto flex items-center justify-center gap-2 px-5 py-2 text-xs bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white font-extrabold rounded-xl shadow-md cursor-pointer transition-all disabled:opacity-50"
                      title="Kirim gambar atau buka WhatsApp dengan ringkasan laporan"
                    >
                      <Share2 className="w-4 h-4 text-emerald-100" />
                      <span>Kirim / Share ke WhatsApp</span>
                    </button>
                  </>
                ) : (
                  <>
                    <button
                      type="button"
                      onClick={() => {
                        navigator.clipboard.writeText(waCustomText || previewWaText);
                        setCopiedWaText(true);
                        setTimeout(() => setCopiedWaText(false), 2000);
                      }}
                      className="flex-1 sm:flex-initial flex items-center justify-center gap-1.5 px-3.5 py-2 text-xs text-slate-700 bg-white hover:bg-slate-100 border border-slate-300 rounded-xl font-bold cursor-pointer shadow-2xs transition-all active:scale-95"
                    >
                      <Copy className="w-3.5 h-3.5" />
                      <span>{copiedWaText ? 'Tersalin!' : 'Salin Teks'}</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => openWhatsAppShare(waCustomText || previewWaText)}
                      className="flex-1 sm:flex-initial flex items-center justify-center gap-2 px-5 py-2 text-xs bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold rounded-xl shadow-md cursor-pointer transition-all active:scale-95"
                    >
                      <Share2 className="w-4 h-4 text-emerald-100" />
                      <span>Kirim Teks ke WhatsApp</span>
                    </button>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 5: KELOLA PERIODE (BUAT & HAPUS PERIODE OLEH PENGURUS) */}
      {isPeriodModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs">
          <div className="bg-white rounded-2xl shadow-xl border border-slate-200 w-full max-w-md overflow-hidden">
            <div className="bg-gradient-to-r from-emerald-600 via-teal-600 to-indigo-600 p-4 text-white flex justify-between items-center">
              <div className="flex items-center gap-2">
                <Calendar className="w-5 h-5 text-amber-300" />
                <h4 className="font-bold text-sm sm:text-base">Kelola Periode (Buku Kas & Iuran KK)</h4>
              </div>
              <button
                type="button"
                onClick={() => setIsPeriodModalOpen(false)}
                className="text-white/80 hover:text-white cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Sub-tabs: Buat Periode vs Hapus Periode */}
            <div className="flex border-b border-slate-200 bg-slate-50 text-xs font-bold">
              <button
                type="button"
                onClick={() => setPeriodModalTab('tambah')}
                className={`flex-1 py-2.5 text-center cursor-pointer border-b-2 transition-colors ${
                  periodModalTab === 'tambah'
                    ? 'border-emerald-600 text-emerald-800 bg-white'
                    : 'border-transparent text-slate-500 hover:text-slate-800'
                }`}
              >
                <Plus className="w-3.5 h-3.5 inline mr-1" />
                Buat Periode Baru
              </button>
              <button
                type="button"
                onClick={() => {
                  setPeriodModalTab('hapus');
                  if (!deletePeriodSelect && availablePeriods.length > 0) {
                    setDeletePeriodSelect(availablePeriods[0]);
                  }
                }}
                className={`flex-1 py-2.5 text-center cursor-pointer border-b-2 transition-colors ${
                  periodModalTab === 'hapus'
                    ? 'border-rose-600 text-rose-800 bg-white'
                    : 'border-transparent text-slate-500 hover:text-slate-800'
                }`}
              >
                <Trash2 className="w-3.5 h-3.5 inline mr-1" />
                Hapus Periode
              </button>
            </div>

            {/* Tab 1: Form Buat Periode */}
            {periodModalTab === 'tambah' && (
              <form onSubmit={handleCreatePeriodSubmit} className="p-5 space-y-3.5">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-800 mb-1">
                      Pilih Bulan
                    </label>
                    <select
                      value={newPeriodMonthIndex}
                      onChange={(e) => setNewPeriodMonthIndex(Number(e.target.value))}
                      className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                    >
                      {INDONESIAN_MONTHS.map((m, idx) => (
                        <option key={m} value={idx}>
                          {m}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-800 mb-1">
                      Tahun
                    </label>
                    <input
                      type="number"
                      required
                      min={2024}
                      max={2035}
                      value={newPeriodYearInput}
                      onChange={(e) => setNewPeriodYearInput(Number(e.target.value) || 2026)}
                      className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                    />
                  </div>
                </div>

                <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-center">
                  <span className="text-[11px] font-semibold text-emerald-800 block">Nama Periode Baru:</span>
                  <span className="text-sm font-extrabold text-emerald-950">
                    {INDONESIAN_MONTHS[newPeriodMonthIndex]} {newPeriodYearInput}
                  </span>
                </div>

                <div className="space-y-2 pt-1">
                  <label className="flex items-start gap-2 text-xs text-slate-700 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={setAsActiveMonthInput}
                      onChange={(e) => setSetAsActiveMonthInput(e.target.checked)}
                      className="mt-0.5 rounded text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                    />
                    <span>
                      <strong>Jadikan Periode Berjalan Saat Ini</strong> (langsung ditampilkan ke seluruh warga sebagai bulan aktif).
                    </span>
                  </label>

                  <label className="flex items-start gap-2 text-xs text-slate-700 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={resetNonAdvanceDuesInput}
                      onChange={(e) => setResetNonAdvanceDuesInput(e.target.checked)}
                      className="mt-0.5 rounded text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                    />
                    <span>
                      <strong>Perbarui Status Iuran Rutin Warga</strong> (warga dengan <i>Bayar Lebih</i> otomatis terpotong 1 bulan, warga biasa kembali ke status <i>Belum Bayar</i>).
                    </span>
                  </label>
                </div>

                <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setIsPeriodModalOpen(false)}
                    className="px-3.5 py-2 text-xs text-slate-600 hover:bg-slate-100 rounded-lg cursor-pointer"
                  >
                    Batal
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 text-xs bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-lg cursor-pointer shadow-xs transition-colors"
                  >
                    Simpan & Buat Periode
                  </button>
                </div>
              </form>
            )}

            {/* Tab 2: Form Hapus Periode */}
            {periodModalTab === 'hapus' && (
              <form onSubmit={handleDeletePeriodSubmit} className="p-5 space-y-3.5">
                <div>
                  <label className="block text-xs font-bold text-slate-800 mb-1">
                    Pilih Periode yang Akan Dihapus
                  </label>
                  <select
                    value={deletePeriodSelect}
                    onChange={(e) => setDeletePeriodSelect(e.target.value)}
                    className="w-full px-3 py-2 text-xs border border-rose-300 rounded-lg focus:ring-2 focus:ring-rose-500 focus:outline-none"
                  >
                    {availablePeriods.map((p) => (
                      <option key={p} value={p}>
                        {p} {p === config.duesCurrentMonth ? '(Bulan Aktif Saat Ini)' : ''}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-800 space-y-1">
                  <div className="font-bold flex items-center gap-1 text-rose-900">
                    <Trash2 className="w-3.5 h-3.5 text-rose-600" />
                    Peringatan Penghapusan Periode
                  </div>
                  <p className="text-[11px] leading-relaxed">
                    Periode <strong>{deletePeriodSelect}</strong> akan dihapus dari daftar pilihan buku kas dan rekap iuran. Jika ini adalah bulan aktif, sistem akan beralih ke periode yang tersisa.
                  </p>
                </div>

                <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setIsPeriodModalOpen(false)}
                    className="px-3.5 py-2 text-xs text-slate-600 hover:bg-slate-100 rounded-lg cursor-pointer"
                  >
                    Batal
                  </button>
                  <button
                    type="submit"
                    disabled={!deletePeriodSelect || availablePeriods.length <= 1}
                    className="px-4 py-2 text-xs bg-rose-600 hover:bg-rose-700 disabled:opacity-50 text-white font-bold rounded-lg cursor-pointer shadow-xs transition-colors"
                  >
                    Hapus Periode Ini
                  </button>
                  </div>
                </form>
              )}
            </div>
          </div>
        )}

      {/* Modal Edit Saldo Bulan Sebelumnya Periode Mei 2026 (Data Awal Inputan Baseline) */}
      {isMayBalanceModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-lg overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="px-5 py-4 bg-gradient-to-r from-amber-500 via-amber-600 to-emerald-600 text-white flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-white/20 backdrop-blur-xs flex items-center justify-center">
                  <Coins className="w-4 h-4 text-white" />
                </div>
                <div>
                  <h3 className="font-bold text-sm leading-tight">Edit Saldo Bulan Sebelumnya (Periode Mei 2026)</h3>
                  <p className="text-[11px] text-amber-100">Data awal inputan baseline kas sebelum bulan aktif (Mei 2026)</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsMayBalanceModalOpen(false)}
                className="w-7 h-7 rounded-lg hover:bg-white/20 flex items-center justify-center text-white/80 hover:text-white transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveMayInitialForm} className="p-5 space-y-4">
              <div className="p-3 bg-amber-50/80 border border-amber-200/80 rounded-xl text-xs text-amber-900 space-y-1">
                <div className="font-bold flex items-center gap-1.5 text-amber-950">
                  <span>ℹ️</span> Petunjuk Saldo Awal Mei 2026
                </div>
                <p className="text-[11px] leading-relaxed text-amber-800">
                  Saldo ini berfungsi sebagai <strong>data awal inputan</strong> yang otomatis terakumulasi ke dalam kartu <em>SALDO BULAN SEBELUMNYA</em> pada periode berjalan. Rekap Iuran Kas Per KK bulan April 2026 sengaja tidak dimunculkan karena pencatatan dimulai dari inputan awal Mei 2026.
                </p>
              </div>

              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Saldo Kas Utama Awal Periode Mei (Rp)
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-2.5 text-xs font-semibold text-slate-400">Rp</span>
                    <input
                      type="number"
                      value={editMayKas === 0 ? '' : editMayKas}
                      onChange={(e) => setEditMayKas(e.target.value === '' ? 0 : Number(e.target.value))}
                      placeholder="0"
                      className="w-full pl-9 pr-3 py-2 text-xs font-semibold border border-slate-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:outline-none"
                    />
                  </div>
                  <span className="text-[10px] text-slate-500 font-mono mt-0.5 block">
                    {formatRupiah(editMayKas || 0)}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">
                      Cashback WiFi Awal (Rp)
                    </label>
                    <div className="relative">
                      <span className="absolute left-2.5 top-2 text-xs font-semibold text-slate-400">Rp</span>
                      <input
                        type="number"
                        value={editMayWifi === 0 ? '' : editMayWifi}
                        onChange={(e) => setEditMayWifi(e.target.value === '' ? 0 : Number(e.target.value))}
                        placeholder="0"
                        className="w-full pl-8 pr-2.5 py-1.5 text-xs font-semibold border border-slate-300 rounded-lg focus:ring-2 focus:ring-sky-500 focus:outline-none"
                      />
                    </div>
                    <span className="text-[10px] text-slate-500 font-mono mt-0.5 block">
                      {formatRupiah(editMayWifi || 0)}
                    </span>
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">
                      Cashback Sampah Awal (Rp)
                    </label>
                    <div className="relative">
                      <span className="absolute left-2.5 top-2 text-xs font-semibold text-slate-400">Rp</span>
                      <input
                        type="number"
                        value={editMaySampah === 0 ? '' : editMaySampah}
                        onChange={(e) => setEditMaySampah(e.target.value === '' ? 0 : Number(e.target.value))}
                        placeholder="0"
                        className="w-full pl-8 pr-2.5 py-1.5 text-xs font-semibold border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                      />
                    </div>
                    <span className="text-[10px] text-slate-500 font-mono mt-0.5 block">
                      {formatRupiah(editMaySampah || 0)}
                    </span>
                  </div>
                </div>

                <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-700">Total Saldo Awal Gabungan:</span>
                  <span className="text-sm font-extrabold text-emerald-700 font-mono">
                    {formatRupiah((Number(editMayKas) || 0) + (Number(editMayWifi) || 0) + (Number(editMaySampah) || 0))}
                  </span>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Keterangan Transaksi Baseline
                  </label>
                  <input
                    type="text"
                    value={editMayNote}
                    onChange={(e) => setEditMayNote(e.target.value)}
                    placeholder="Contoh: Saldo Awal Inputan Periode Mei 2026"
                    className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:outline-none"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsMayBalanceModalOpen(false)}
                  className="px-4 py-2 text-xs text-slate-600 hover:bg-slate-100 font-medium rounded-lg cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-xs bg-amber-600 hover:bg-amber-700 text-white font-bold rounded-lg cursor-pointer shadow-xs transition-colors flex items-center gap-1.5"
                >
                  <Save className="w-3.5 h-3.5" />
                  Simpan Saldo Awal Mei
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Upload Excel Iuran Warga Per KK */}
      <DuesExcelUploadModal
        isOpen={isUploadDuesModalOpen}
        onClose={() => setIsUploadDuesModalOpen(false)}
        availablePeriods={availablePeriods}
        currentPeriod={defaultMonthLabel}
        residents={residents}
        defaultNominal={config.duesAmountPerMonth || 50000}
        onConfirmImport={handleBatchImportDues}
      />
    </div>
  );
};
