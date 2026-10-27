import React, { useCallback, useMemo, useState } from 'react';
import confetti from 'canvas-confetti';
import {
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
} from 'lucide-react';
import {
  BaksosAgenda,
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
  openWhatsAppShare,
  parseIndonesianMonthYearToKey,
} from '../utils/helpers';
import { exportFinancialReportToExcel } from '../utils/financialExcelExport';
import { BalanceBreakdown } from '../hooks/useStorage';
import { DuesExcelUploadModal } from './DuesExcelUploadModal';

interface CashReportSectionProps {
  config: SiteConfig;
  transactions: CashTransaction[];
  residents: ResidentHouse[];
  baksosAgendas?: BaksosAgenda[];
  balances: BalanceBreakdown;
  isAdmin: boolean;
  mode?: 'all' | 'mutasi' | 'per_kk';
  onAddTransaction: (tx: Omit<CashTransaction, 'id'>) => void;
  onEditTransaction: (tx: CashTransaction) => void;
  onDeleteTransaction: (id: string) => void;
  onAdjustBalance: (
    pool: 'Kas Utama' | 'Cashback WiFi' | 'Cashback Sampah',
    targetAmount: number,
    note: string,
    customDate?: string,
    currentPoolBalanceOverride?: number
  ) => void;
  onUpdateResident: (updated: ResidentHouse) => void;
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
  onAdjustBalance,
  onUpdateResident,
  onOpenConfigModal,
  onSwitchMode,
  onCreatePeriod,
  onDeletePeriod,
  onBatchImportDues,
}) => {
  // Modal upload Excel Iuran
  const [isUploadDuesModalOpen, setIsUploadDuesModalOpen] = useState<boolean>(false);

  // Unified Sub-tab selection: 'mutasi' (Buku Kas) or 'per_kk' (Iuran Per KK)
  const [currentSubTab, setCurrentSubTab] = useState<'mutasi' | 'per_kk'>(
    mode === 'per_kk' ? 'per_kk' : 'mutasi'
  );

  React.useEffect(() => {
    if (mode === 'per_kk') {
      setCurrentSubTab('per_kk');
    } else if (mode === 'mutasi') {
      setCurrentSubTab('mutasi');
    }
  }, [mode]);

  const defaultMonthLabel = config.duesCurrentMonth || 'Oktober 2026';
  const defaultMonthKey = parseIndonesianMonthYearToKey(defaultMonthLabel) || '2026-10';

  // Filters for Buku Kas Keluar Masuk
  const [filterPool, setFilterPool] = useState<string>('semua');
  // Tampilkan periode semuanya buku kas keluar dan masuk secara default untuk semua (termasuk tampilan warga)
  const [selectedTxMonth, setSelectedTxMonth] = useState<string>('semua');
  const [searchTx, setSearchTx] = useState<string>('');

  // Period management modal state
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
  const [houseDuesHeadNameInput, setHouseDuesHeadNameInput] = useState<string>('');
  const [houseDuesAmountInput, setHouseDuesAmountInput] = useState<number>(50000);
  const [houseDuesStatusInput, setHouseDuesStatusInput] = useState<'Lunas' | 'Bayar Lebih' | 'Belum Bayar'>('Lunas');
  const [houseDuesPaidMonthsInput, setHouseDuesPaidMonthsInput] = useState<number>(1);
  const [houseDuesTotalReceivedInput, setHouseDuesTotalReceivedInput] = useState<number>(50000);
  const [houseDuesPartialInput, setHouseDuesPartialInput] = useState<number>(0);
  const [houseDuesPrevArrearsInput, setHouseDuesPrevArrearsInput] = useState<number>(0);
  const [houseDuesPrevNoteInput, setHouseDuesPrevNoteInput] = useState<string>('');
  const [houseDuesPaidDateInput, setHouseDuesPaidDateInput] = useState<string>(
    new Date().toISOString().slice(0, 10)
  );
  const [houseDuesMonthInput, setHouseDuesMonthInput] = useState<string>(defaultMonthLabel);

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

  // Balance adjustment modal
  const [isAdjustModalOpen, setIsAdjustModalOpen] = useState(false);
  const [adjustTargetKas, setAdjustTargetKas] = useState<number>(balances.kasUtama);
  const [adjustTargetWifi, setAdjustTargetWifi] = useState<number>(balances.wifiCashback);
  const [adjustTargetSampah, setAdjustTargetSampah] = useState<number>(balances.sampahCashback);
  const [adjustReason, setAdjustReason] = useState('Rekonsiliasi / Opname Kas Fisik');

  // WhatsApp share modal
  const [isWaModalOpen, setIsWaModalOpen] = useState<boolean>(false);
  const [waRecapMode, setWaRecapMode] = useState<'keluar_masuk' | 'iuran_kk'>('keluar_masuk');
  const [copiedWaText, setCopiedWaText] = useState<boolean>(false);
  const [waCustomText, setWaCustomText] = useState<string>('');

  const getHouseDuesNominal = (house: ResidentHouse) =>
    house.customDuesAmount !== undefined
      ? house.customDuesAmount
      : config.duesAmountPerMonth || 50000;

  const getHousePeriodLabel = (house: ResidentHouse) =>
    (house.duesMonthNote && house.duesMonthNote.trim()) || defaultMonthLabel;

  // Helper to test if a transaction is related to Iuran or Tunggakan
  const isIuranOrTunggakanTx = (tx: CashTransaction) => {
    const cat = (tx.category || '').toLowerCase();
    const desc = (tx.description || '').toLowerCase();
    return (
      tx.category === 'Iuran Warga' ||
      cat.includes('iuran') ||
      cat.includes('tunggakan') ||
      desc.includes('iuran') ||
      desc.includes('tunggakan')
    );
  };

  // Group all transactions by month
  const allMonthlyCashflowGroups = useMemo<MonthlyTransactionGroup[]>(() => {
    const map: Record<string, MonthlyTransactionGroup> = {};
    transactions.forEach((tx) => {
      const mKey = getMonthKeyFromDate(tx.date);
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
      if (tx.type === 'masuk') {
        g.totalInflow += tx.amount;
        if (isIuranOrTunggakanTx(tx)) {
          g.iuranInflow += tx.amount;
        } else if (tx.pool === 'Cashback WiFi' || tx.category === 'Cashback WiFi') {
          g.wifiInflow += tx.amount;
        } else if (tx.pool === 'Cashback Sampah' || tx.category === 'Cashback Sampah') {
          g.sampahInflow += tx.amount;
        } else if (tx.category === 'Denda Baksos' || tx.description.toLowerCase().includes('denda')) {
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
      .sort((a, b) => b.monthKey.localeCompare(a.monthKey))
      .map((g) => ({
        ...g,
        transactions: [...g.transactions].sort((a, b) => a.date.localeCompare(b.date)),
      }));
  }, [transactions]);

  // List of available periods
  const availablePeriods = useMemo<string[]>(() => {
    const list =
      config.duesAvailablePeriods && config.duesAvailablePeriods.length > 0
        ? config.duesAvailablePeriods
        : [config.duesCurrentMonth || 'Oktober 2026', 'September 2026'];
    const txMonths = transactions.map((t) => formatMonthYearFromKey(getMonthKeyFromDate(t.date)));
    return Array.from(new Set([...list, ...txMonths])).filter(Boolean);
  }, [config.duesAvailablePeriods, config.duesCurrentMonth, transactions]);

  // Effective month key: Warga dan Pengurus keduanya dapat melihat Semua Periode maupun per bulan
  const effectiveMonthKey = selectedTxMonth;

  // Filtered transactions for display (Urutkan dari tanggal awal / ascending)
  const filteredTransactions = useMemo(() => {
    return transactions
      .filter((tx) => {
        const isIuran = isIuranOrTunggakanTx(tx);
        const isDenda = tx.category === 'Denda Baksos' || tx.description.toLowerCase().includes('denda');
        const isCashbackPool = tx.pool === 'Cashback WiFi' || tx.pool === 'Cashback Sampah';

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
            : filterPool === 'Kas Utama'
            ? tx.pool === 'Kas Utama'
            : filterPool === 'Cashback WiFi'
            ? tx.pool === 'Cashback WiFi'
            : filterPool === 'Cashback Sampah'
            ? tx.pool === 'Cashback Sampah'
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
      if (tx.type === 'masuk') {
        totalInflow += tx.amount;
        if (isIuranOrTunggakanTx(tx)) {
          iuranInflow += tx.amount;
        } else if (tx.pool === 'Cashback WiFi' || tx.category === 'Cashback WiFi') {
          wifiInflow += tx.amount;
        } else if (tx.pool === 'Cashback Sampah' || tx.category === 'Cashback Sampah') {
          sampahInflow += tx.amount;
        } else if (tx.category === 'Denda Baksos' || tx.description.toLowerCase().includes('denda')) {
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

  // Previous month balance summary (Pisahkan saldo bulan sebelumnya)
  const prevMonthSummary = useMemo(() => {
    const targetKey = effectiveMonthKey === 'semua' ? defaultMonthKey : effectiveMonthKey;
    return calculatePreviousMonthBalanceSummary(transactions, targetKey);
  }, [transactions, effectiveMonthKey, defaultMonthKey]);

  // Separate breakdown: Kas Utama vs Cashback (WiFi & Sampah)
  const breakdownSummary = useMemo(() => {
    let kasUtamaIn = 0;
    let cashbackIn = 0;
    let kasUtamaOut = 0;
    let cashbackOut = 0;

    filteredTransactions.forEach((tx) => {
      const isCashback = tx.pool === 'Cashback WiFi' || tx.pool === 'Cashback Sampah';
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
      const descLower = tx.description.toLowerCase();
      const catLower = (tx.category || '').toLowerCase();

      // Check if it's Tunggakan
      const isTunggakan =
        tx.category === 'Pembayaran Tunggakan' ||
        descLower.includes('tunggakan') ||
        catLower.includes('tunggakan');

      // Check if it's Denda Baksos
      const isDenda =
        !isTunggakan && (tx.category === 'Denda Baksos' || descLower.includes('denda') || catLower.includes('denda'));

      // Check if it's Iuran Warga
      const isIuran = !isTunggakan && !isDenda && isIuranOrTunggakanTx(tx);

      // Check WiFi vs Sampah
      const isWifi =
        tx.pool === 'Cashback WiFi' ||
        catLower.includes('wifi') ||
        descLower.includes('wifi');

      const isSampah =
        tx.pool === 'Cashback Sampah' ||
        catLower.includes('sampah') ||
        descLower.includes('sampah');

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
        if (isWifi && !isIuran && !isDenda && !isTunggakan) {
          masukWifi = tx.amount;
          runningWifi += tx.amount;
          subCategoryLabel = 'Cashback WiFi';
        } else if (isSampah && !isIuran && !isDenda && !isTunggakan) {
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
          subCategoryLabel = 'Kas Utama';
        }
        runningTotal += tx.amount;
      } else {
        if (isWifi) {
          keluarWifi = tx.amount;
          runningWifi -= tx.amount;
          subCategoryLabel = 'Pengeluaran WiFi';
        } else if (isSampah) {
          keluarSampah = tx.amount;
          runningSampah -= tx.amount;
          subCategoryLabel = 'Pengeluaran Sampah';
        } else {
          keluarKasUtama = tx.amount;
          runningKasUtama -= tx.amount;
          subCategoryLabel = 'Pengeluaran Kas Utama';
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

  // Aggregate totals for the table footer and summary cards
  const tableTotals = useMemo(() => {
    let sumMasukIuran = 0;
    let sumMasukDenda = 0;
    let sumMasukTunggakan = 0;
    let sumMasukKasLain = 0;
    let sumMasukWifi = 0;
    let sumMasukSampah = 0;
    let sumKeluarKasUtama = 0;
    let sumKeluarWifi = 0;
    let sumKeluarSampah = 0;

    classifiedTransactions.forEach((item) => {
      sumMasukIuran += item.masukIuran;
      sumMasukDenda += item.masukDenda;
      sumMasukTunggakan += item.masukTunggakan;
      sumMasukKasLain += item.masukKasLain;
      sumMasukWifi += item.masukWifi;
      sumMasukSampah += item.masukSampah;
      sumKeluarKasUtama += item.keluarKasUtama;
      sumKeluarWifi += item.keluarWifi;
      sumKeluarSampah += item.keluarSampah;
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
  }, [classifiedTransactions, prevMonthSummary]);

  // Per KK recap list
  const perKKRecapList = useMemo<PerKKRecapItem[]>(() => {
    return residents.map((house) => {
      const isEmptyHouse = house.occupancy === 'Kosong' || house.occupancy === 'Belum Ditempati' || isHouseVacant(house);
      const isAdvancePaid = house.duesStatus === 'Bayar Lebih';
      const isLunas = house.duesStatus === 'Lunas' || isAdvancePaid;
      // Rumah kosong default tidak wajib iuran (0 tagihan), namun jika pengurus mencatat bayar (isLunas), gunakan nominal iuran
      const defaultNominal = getHouseDuesNominal(house) || config.duesAmountPerMonth || 25000;
      const nominalPerMonth = isEmptyHouse ? (isLunas ? defaultNominal : 0) : defaultNominal;
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
        ? getSubsequentMonthLabels(periodLabel, Math.max(1, paidMonthsCount))
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

      const blockRegex = new RegExp(`\\b${house.blockNumber.replace('/', '\\/')}\\b`, 'i');
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

    const coveredByResidents = residents.flatMap((r) =>
      r.duesPaidMonths && r.duesPaidMonths > 1
        ? getSubsequentMonthLabels(r.duesMonthNote || currentActiveMonth, r.duesPaidMonths)
        : []
    );

    const combined = Array.from(
      new Set([currentActiveMonth, ...rawList, ...txMonths, ...coveredByResidents])
    ).filter(Boolean);

    return combined.sort((a, b) => {
      const keyA = parseIndonesianMonthYearToKey(a) || '';
      const keyB = parseIndonesianMonthYearToKey(b) || '';
      return keyA.localeCompare(keyB);
    });
  }, [config.duesAvailablePeriods, config.duesCurrentMonth, defaultMonthLabel, transactions, residents]);

  // Otomatis arahkan selectedKKPeriod ke bulan aktif penarikan keuangan saat ini
  React.useEffect(() => {
    const active = config.duesCurrentMonth || defaultMonthLabel || 'Oktober 2026';
    if (selectedKKPeriod !== 'semua' && (!selectedKKPeriod || !sortedPeriods.includes(selectedKKPeriod))) {
      setSelectedKKPeriod(active);
    }
  }, [sortedPeriods, config.duesCurrentMonth, defaultMonthLabel, selectedKKPeriod]);

  // Status computation for any given house in any given period
  const getHouseStatusForPeriod = useCallback((house: ResidentHouse, periodLabel: string) => {
    const isEmpty = house.occupancy === 'Kosong' || house.occupancy === 'Belum Ditempati' || isHouseVacant(house);
    const nominal = getHouseDuesNominal(house) || config.duesAmountPerMonth || 25000;
    const targetKey = parseIndonesianMonthYearToKey(periodLabel) || '';
    const currentKey = parseIndonesianMonthYearToKey(defaultMonthLabel) || '2026-10';

    const houseBasePeriod = house.duesMonthNote || defaultMonthLabel;
    const paidMonths = house.duesPaidMonths || 1;
    const isPaidState = house.duesStatus === 'Lunas' || house.duesStatus === 'Bayar Lebih';
    const coveredMonths = isPaidState
      ? getSubsequentMonthLabels(houseBasePeriod, Math.max(1, paidMonths))
      : [];

    // Prioritas 1: Jika periode yang dicek sama persis dengan periode penagihan rumah (houseBasePeriod)
    if (periodLabel === houseBasePeriod) {
      if (house.duesStatus === 'Lunas' || house.duesStatus === 'Bayar Lebih') {
        const isAdvance = house.duesStatus === 'Bayar Lebih';
        return {
          status: house.duesStatus,
          amount: nominal,
          label: isAdvance
            ? isEmpty
              ? 'Bayar Lebih (Kosong)'
              : 'Bayar Lebih'
            : isEmpty
            ? 'Lunas (Kosong)'
            : 'Lunas',
          badgeClass: isAdvance
            ? 'bg-indigo-600 text-white border border-indigo-500 font-bold shadow-xs'
            : 'bg-emerald-600 text-white border border-emerald-500 font-bold shadow-xs',
          paidDate: house.duesPaidDate,
          note: isAdvance ? `Deposit +${formatRupiah(house.duesPrepaidBalance || 0)}` : undefined,
        };
      }
      if (isEmpty) {
        return {
          status: 'Kosong' as const,
          amount: 0,
          label: 'Bebas Iuran',
          badgeClass: 'bg-slate-800 text-slate-300 border border-slate-700 font-semibold',
          paidDate: undefined,
          note: 'Rumah Kosong (Tidak Wajib)',
        };
      }
      const paidPart = house.duesPaidAmount || 0;
      return {
        status: 'Belum Bayar' as const,
        amount: paidPart,
        label: paidPart > 0 ? `Cicil ${formatRupiah(paidPart)}` : 'Belum Bayar',
        badgeClass: 'bg-rose-100 text-rose-800 border border-rose-200 font-bold',
        note: paidPart > 0 ? `Sisa ${formatRupiah(Math.max(0, nominal - paidPart))}` : 'Belum Bayar',
      };
    }

    // Prioritas 2: Advance payment / multi-month check (tercakup dalam bulan-bulan berikutnya)
    if (coveredMonths.includes(periodLabel)) {
      return {
        status: 'Bayar Lebih' as const,
        amount: nominal,
        label: isEmpty ? 'Bayar Lebih (Kosong)' : 'Bayar Lebih',
        badgeClass: 'bg-indigo-600 text-white border border-indigo-500 font-bold shadow-xs',
        paidDate: house.duesPaidDate,
        note: `Terbayar di Muka (${paidMonths} Bulan)`,
      };
    }

    // Prioritas 3: Cek transaksi di Buku Kas yang tercatat untuk rumah ini pada periode tersebut
    const blockRegex = new RegExp(`\\b${house.blockNumber.replace('/', '\\/')}\\b`, 'i');
    const txMatch = transactions.find(
      (t) =>
        t.type === 'masuk' &&
        isIuranOrTunggakanTx(t) &&
        getMonthKeyFromDate(t.date) === targetKey &&
        blockRegex.test(t.description)
    );

    if (txMatch) {
      return {
        status: 'Lunas' as const,
        amount: txMatch.amount,
        label: isEmpty ? 'Lunas (Kosong)' : 'Lunas',
        badgeClass: 'bg-emerald-600 text-white border border-emerald-500 font-bold shadow-xs',
        paidDate: txMatch.date,
        note: isEmpty ? 'Iuran Sukarela (Rumah Kosong)' : undefined,
      };
    }

    // Prioritas 4: Rumah Kosong yang TIDAK membayar: OTOMATIS BEBAS IURAN
    if (isEmpty) {
      return {
        status: 'Kosong' as const,
        amount: 0,
        label: 'Bebas Iuran',
        badgeClass: 'bg-slate-800 text-slate-300 border border-slate-700 font-semibold',
        paidDate: undefined as string | undefined,
        note: 'Rumah Kosong (Tidak Wajib)',
      };
    }

    // Prioritas 5: Default bulan berjalan jika periodLabel cocok
    if (periodLabel === defaultMonthLabel || targetKey === currentKey) {
      if (house.duesStatus === 'Lunas' || house.duesStatus === 'Bayar Lebih') {
        const isAdvance = house.duesStatus === 'Bayar Lebih';
        return {
          status: house.duesStatus,
          amount: nominal,
          label: isAdvance ? 'Bayar Lebih' : 'Lunas',
          badgeClass: isAdvance
            ? 'bg-indigo-100 text-indigo-800 border border-indigo-200 font-bold'
            : 'bg-emerald-100 text-emerald-800 border border-emerald-200 font-bold',
          paidDate: house.duesPaidDate,
          note: isAdvance ? `Deposit +${formatRupiah(house.duesPrepaidBalance || 0)}` : undefined,
        };
      }
      const paidPart = house.duesPaidAmount || 0;
      return {
        status: 'Belum Bayar' as const,
        amount: paidPart,
        label: paidPart > 0 ? `Cicil ${formatRupiah(paidPart)}` : 'Belum Bayar',
        badgeClass: 'bg-rose-100 text-rose-800 border border-rose-200 font-bold',
        note: paidPart > 0 ? `Sisa ${formatRupiah(Math.max(0, nominal - paidPart))}` : 'Belum Bayar',
      };
    }

    // 5. Past month check (targetKey < currentKey) untuk rumah berpenghuni
    if (targetKey < currentKey) {
      const prevNote = (house.previousArrearsNote || '').toLowerCase();
      const monthParts = targetKey.split('-');
      const monthIdx = parseInt(monthParts[1], 10) - 1;
      const monthName = (INDONESIAN_MONTHS[monthIdx] || '').toLowerCase();

      const hasDebtInThisMonth =
        house.previousArrears > 0 &&
        (prevNote.includes(monthName) ||
          prevNote.includes(targetKey) ||
          (targetKey === getPreviousMonthKey(currentKey) && !prevNote.includes('agustus')));

      if (hasDebtInThisMonth) {
        return {
          status: 'Belum Bayar' as const,
          amount: 0,
          label: 'Tertunggak',
          badgeClass: 'bg-rose-100 text-rose-800 border border-rose-200 font-bold',
          note: house.previousArrearsNote || `Tertunggak ${formatRupiah(house.previousArrears)}`,
        };
      }

      // Default for past months if occupied and no arrears recorded for that month
      return {
        status: 'Lunas' as const,
        amount: nominal,
        label: 'Lunas',
        badgeClass: 'bg-emerald-100 text-emerald-800 border border-emerald-200 font-bold',
      };
    }

    // 6. Future month not covered
    return {
      status: 'Belum Bayar' as const,
      amount: 0,
      label: 'Belum Masuk Periode',
      badgeClass: 'bg-slate-100 text-slate-500 border border-slate-200',
    };
  }, [defaultMonthLabel, transactions, config.duesAmountPerMonth]);

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

      // Check transactions from ledger for this month
      const matchingTxs = transactions.filter(
        (t) => t.type === 'masuk' && isIuranOrTunggakanTx(t) && getMonthKeyFromDate(t.date) === pKey
      );
      const txSum = matchingTxs.reduce((s, t) => s + t.amount, 0);

      return {
        periodLabel,
        pKey,
        isCurrentMonth: periodLabel === defaultMonthLabel,
        totalAmount: Math.max(totalAmount, txSum),
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

  // Rekap table totals for KK table
  const recapTotals = useMemo(() => {
    let sumIuran = 0;
    let sumDenda = 0;
    let sumTunggakan = 0;
    let sumTotal = 0;

    filteredPerKKList.forEach((item) => {
      const { house, isLunas, isAdvancePaid } = item;
      const statusInfo =
        selectedKKPeriod !== 'semua'
          ? getHouseStatusForPeriod(house, selectedKKPeriod)
          : null;

      const iuranPaid = statusInfo
        ? statusInfo.status === 'Lunas' || statusInfo.status === 'Bayar Lebih'
          ? statusInfo.amount || item.nominalPerMonth
          : statusInfo.amount || 0
        : isLunas
        ? item.nominalPerMonth * (isAdvancePaid ? Math.max(1, house.duesPaidMonths || 1) : 1)
        : house.duesPaidAmount || 0;

      const dendaPaid = item.baksosFineAmount || 0;

      const blockLower = house.blockNumber.toLowerCase();
      const tunggakanTxs = transactions.filter((t) => {
        if (t.type !== 'masuk') return false;
        const d = t.description.toLowerCase();
        const c = (t.category || '').toLowerCase();
        const isBlock = d.includes(blockLower);
        const isTung =
          t.category === 'Pembayaran Tunggakan' ||
          d.includes('tunggakan') ||
          c.includes('tunggakan');
        if (!isBlock || !isTung) return false;
        if (selectedKKPeriod !== 'semua') {
          const pKey = parseIndonesianMonthYearToKey(selectedKKPeriod);
          return getMonthKeyFromDate(t.date) === pKey;
        }
        return true;
      });
      const tunggakanPaid = tunggakanTxs.reduce((s, t) => s + t.amount, 0);

      sumIuran += iuranPaid;
      sumDenda += dendaPaid;
      sumTunggakan += tunggakanPaid;
      sumTotal += iuranPaid + dendaPaid + tunggakanPaid;
    });

    return { sumIuran, sumDenda, sumTunggakan, sumTotal };
  }, [filteredPerKKList, selectedKKPeriod, transactions, getHouseStatusForPeriod]);

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

  // Helper to remove recorded transactions for a house and period in Buku Kas & Rekap KK
  const removeTransactionsForHousePeriod = (house: ResidentHouse, targetPeriod: string) => {
    if (!onDeleteTransaction || !transactions || transactions.length === 0) return;
    const blockRegex = new RegExp(`\\b${house.blockNumber.replace('/', '\\/')}\\b`, 'i');
    const targetKey = parseIndonesianMonthYearToKey(targetPeriod);
    const targetPeriodLower = targetPeriod.toLowerCase();

    const matchingTxs = transactions.filter((tx) => {
      if (tx.type !== 'masuk') return false;
      if (!blockRegex.test(tx.description)) return false;

      const mKey = getMonthKeyFromDate(tx.date);
      const descLower = tx.description.toLowerCase();

      const isIuran = tx.category === 'Iuran Warga' || descLower.includes('iuran');
      const isDenda = tx.category === 'Denda Baksos' || descLower.includes('denda');
      const isTunggakan = descLower.includes('tunggakan');

      if (!isIuran && !isDenda && !isTunggakan) return false;

      return (
        descLower.includes(targetPeriodLower) ||
        mKey === targetKey ||
        (isDenda && descLower.includes(house.blockNumber.toLowerCase())) ||
        (isTunggakan && descLower.includes(house.blockNumber.toLowerCase()))
      );
    });

    matchingTxs.forEach((tx) => {
      onDeleteTransaction(tx.id);
    });
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

  // OPEN MODAL FOR EDITING HOUSE DUES
  const handleOpenEditHouseDues = (house: ResidentHouse, forceMultiMonth: boolean = false) => {
    if (!isAdmin) return;
    const isVacant =
      house.occupancy === 'Kosong' ||
      house.occupancy === 'Belum Ditempati' ||
      isHouseVacant(house);
    const nominal = getHouseDuesNominal(house) || config.duesAmountPerMonth || 25000;
    const initialStatus = forceMultiMonth ? 'Bayar Lebih' : house.duesStatus;
    const currentMonths =
      initialStatus === 'Bayar Lebih'
        ? Math.max(2, Math.min(12, house.duesPaidMonths || 2))
        : 1;
    const defaultTotalReceived =
      initialStatus === 'Bayar Lebih' && !forceMultiMonth && (house.duesPrepaidBalance || 0) > 0
        ? nominal + (house.duesPrepaidBalance || 0)
        : nominal * currentMonths;

    setEditingHouseDues(house);
    setHouseDuesHeadNameInput(house.duesHeadNameOverride || house.headName);
    setHouseDuesAmountInput(nominal);
    setHouseDuesStatusInput(initialStatus);
    setHouseDuesPaidMonthsInput(currentMonths);
    setHouseDuesTotalReceivedInput(defaultTotalReceived);
    setHouseDuesPartialInput(house.duesPaidAmount || 0);
    setHouseDuesPrevArrearsInput(isVacant ? 0 : (house.previousArrears || 0));
    setHouseDuesPrevNoteInput(house.previousArrearsNote || '');
    setHouseDuesPaidDateInput(house.duesPaidDate || new Date().toISOString().slice(0, 10));
    setHouseDuesMonthInput(getHousePeriodLabel(house));
  };

  // SAVE HOUSE DUES & INSERT TRANSACTIONS
  const handleSaveHouseDues = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingHouseDues) return;

    const isVacant =
      editingHouseDues.occupancy === 'Kosong' ||
      editingHouseDues.occupancy === 'Belum Ditempati' ||
      isHouseVacant(editingHouseDues);

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
    const monthLabel = houseDuesMonthInput.trim() || defaultMonthLabel;
    const paidDateVal = houseDuesPaidDateInput || new Date().toISOString().slice(0, 10);

    const oldPrevArrears = editingHouseDues.previousArrears || 0;
    const newPrevArrears = isVacant ? 0 : Math.max(0, Number(houseDuesPrevArrearsInput) || 0);
    const paidArrearsAmount = Math.max(0, oldPrevArrears - newPrevArrears);

    const trimmedHeadInput = houseDuesHeadNameInput.trim();
    const finalHeadNameOverride =
      trimmedHeadInput && trimmedHeadInput !== editingHouseDues.headName
        ? trimmedHeadInput
        : undefined;

    onUpdateResident({
      ...editingHouseDues,
      duesHeadNameOverride: finalHeadNameOverride,
      customDuesAmount: amountNum,
      duesStatus: houseDuesStatusInput,
      duesPaidAmount: isNowPaid ? 0 : partialNum,
      duesPaidMonths: monthsCount,
      duesPrepaidBalance: prepaidBalance,
      duesPaidDate: isNowPaid || partialNum > 0 ? paidDateVal : '',
      duesMonthNote: monthLabel,
      previousArrears: newPrevArrears,
      previousArrearsNote: isVacant ? '' : houseDuesPrevNoteInput.trim(),
    });

    const displayName = finalHeadNameOverride || editingHouseDues.headName;
    const houseDescLabel = isVacant
      ? `(Rumah Kosong - ${displayName})`
      : `(${displayName})`;

    // 1. Masukkan Pembayaran Iuran Kas Bulanan ke Laporan Kas Keluar Masuk (termasuk untuk rumah kosong sukarela)
    if (totalReceived > 0 && isNowPaid) {
      try {
        confetti({ particleCount: 45, spread: 60, origin: { y: 0.7 } });
      } catch {}
      const coveredMonths = getSubsequentMonthLabels(monthLabel, Math.max(1, monthsCount));

      onAddTransaction({
        date: paidDateVal,
        type: 'masuk',
        pool: 'Kas Utama',
        category: 'Iuran Warga',
        description: isAdvancePay
          ? `Iuran Kas Bayar Lebih ${monthsCount} Bulan (${coveredMonths.join(', ')}) Warga Blok ${editingHouseDues.blockNumber} ${houseDescLabel}`
          : isNowPaid
          ? `Iuran Bulanan (${monthLabel}) Warga Blok ${editingHouseDues.blockNumber} ${houseDescLabel}`
          : `Cicilan Iuran Bulanan (${monthLabel}) Warga Blok ${editingHouseDues.blockNumber} ${houseDescLabel}`,
        amount: totalReceived,
      });
    }

    // 2. Masukkan Pelunasan Tunggakan Lalu ke Laporan Kas Keluar Masuk
    if (paidArrearsAmount > 0 && !isVacant) {
      try {
        confetti({ particleCount: 40, spread: 55, origin: { y: 0.7 } });
      } catch {}
      onAddTransaction({
        date: paidDateVal,
        type: 'masuk',
        pool: 'Kas Utama',
        category: 'Iuran Warga',
        description: `Pelunasan Tunggakan Lalu Blok ${editingHouseDues.blockNumber} (${displayName})${
          editingHouseDues.previousArrearsNote ? ` - ${editingHouseDues.previousArrearsNote}` : ''
        }`,
        amount: paidArrearsAmount,
      });
    } else if (houseDuesStatusInput === 'Belum Bayar') {
      removeTransactionsForHousePeriod(editingHouseDues, monthLabel);
    }

    setEditingHouseDues(null);
  };

  // ADD / EDIT TRANSACTION
  const handleOpenAddTx = () => {
    setEditingTx(null);
    setTxDate(new Date().toISOString().slice(0, 10));
    setTxType('masuk');
    setTxPool('Kas Utama');
    setTxCategory('Iuran Warga');
    setTxDescription('');
    setTxAmount('');
    setTxResidentId('');
    setTxIuranMonths(1);
    setTxIuranStartMonth(defaultMonthLabel);
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
          onUpdateResident({
            ...targetHouse,
            customDuesAmount: targetHouse.customDuesAmount || (isVacant ? nom : undefined),
            duesStatus: isAdvance ? 'Bayar Lebih' : 'Lunas',
            duesPaidAmount: 0,
            duesPaidMonths: isAdvance ? monthsCount : 1,
            duesPrepaidBalance: isAdvance ? Math.max(0, finalAmount - nom) : 0,
            duesPaidDate: txDate,
            duesMonthNote: txIuranStartMonth.trim() || defaultMonthLabel,
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
  }, [config, selectedTxMonth, balances, periodSummary, residents, defaultMonthLabel, kkStats, waRecapMode]);

  return (
    <div className="space-y-6">
      {/* HEADER SECTION: Colorful, Vibrant & Unified */}
      {/* HEADER BANNER: 1. Judul di atas -> 2. Deskripsi di bawahnya -> 3. Menu-menu lainnya di bawahnya lagi */}
      <div className="bg-gradient-to-r from-emerald-800 via-teal-800 to-cyan-900 text-white rounded-3xl p-5 sm:p-7 shadow-lg border-b-4 border-emerald-400 space-y-4">
        {/* 1. Judul Halaman di Bagian Atas */}
        <div className="flex items-center gap-2.5 flex-wrap">
          <div className="p-2.5 rounded-2xl bg-white/15 text-white border border-white/25 shadow-xs backdrop-blur-xs shrink-0">
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
        <p className="text-xs sm:text-sm text-emerald-100 max-w-3xl leading-relaxed">
          {config.cashDescription || 'Pencatatan kas utama, buku mutasi keluar masuk, serta rekapitulasi iuran rutin per KK dalam satu halaman transparansi terpadu.'}
        </p>

        {/* 3. Menu-menu Lainnya di Bawahnya Lagi */}
        <div className="pt-2 border-t border-emerald-700/60 flex flex-wrap items-center gap-2">
          {isAdmin && (
            <button
              type="button"
              onClick={handleOpenAddTx}
              className="flex items-center gap-1.5 px-4 py-2 text-xs font-bold bg-amber-400 hover:bg-amber-300 text-slate-950 rounded-xl shadow-xs transition-colors cursor-pointer"
            >
              <Plus className="w-4 h-4 text-slate-950" />
              <span>Catat Transaksi</span>
            </button>
          )}

          {isAdmin && (
            <button
              type="button"
              onClick={() => setIsUploadDuesModalOpen(true)}
              className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold bg-emerald-500 hover:bg-emerald-400 text-slate-950 rounded-xl shadow-xs transition-colors cursor-pointer"
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
                setIsWaModalOpen(true);
              }}
              className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold bg-white/15 hover:bg-white/25 text-white border border-white/20 rounded-xl transition-colors cursor-pointer"
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
              className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold bg-white/15 hover:bg-white/25 text-white border border-white/20 rounded-xl transition-colors cursor-pointer"
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
              className="p-2 text-white/80 hover:text-white bg-white/10 hover:bg-white/20 rounded-xl border border-white/20 transition-colors cursor-pointer"
              title="Koreksi / Sesuaikan Saldo"
            >
              <Sliders className="w-4 h-4 text-amber-200" />
            </button>
          )}
        </div>
      </div>

      {/* SALDO SUMMARY CARDS (Tampil untuk Warga & Pengurus: Saldo Kas Utama, Cashback WiFi, Cashback Sampah & Total Saldo) */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {/* Kas Utama */}
        <div className="bg-gradient-to-br from-emerald-50 via-teal-50 to-green-100/80 border-2 border-emerald-300/90 text-emerald-950 rounded-2xl p-4 sm:p-5 shadow-sm flex flex-col justify-between hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between text-xs font-bold text-emerald-900">
            <span>Saldo Kas Utama</span>
            <div className="p-1.5 rounded-xl bg-emerald-600 text-white shadow-xs">
              <Wallet className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3 text-lg sm:text-2xl font-black font-mono tracking-tight text-emerald-950 tabular-nums">
            {formatRupiah(balances.kasUtama)}
          </div>
        </div>

        {/* Cashback WiFi */}
        <div className="bg-gradient-to-br from-cyan-50 via-sky-50 to-blue-100/80 border-2 border-cyan-300/90 text-cyan-950 rounded-2xl p-4 sm:p-5 shadow-sm flex flex-col justify-between hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between text-xs font-bold text-cyan-900">
            <span>Cashback WiFi</span>
            <div className="p-1.5 rounded-xl bg-cyan-600 text-white shadow-xs">
              <Wifi className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3 text-lg sm:text-2xl font-black font-mono tracking-tight text-cyan-950 tabular-nums">
            {formatRupiah(balances.wifiCashback)}
          </div>
        </div>

        {/* Cashback Sampah */}
        <div className="bg-gradient-to-br from-teal-50 via-emerald-50 to-teal-100/80 border-2 border-teal-300/90 text-teal-950 rounded-2xl p-4 sm:p-5 shadow-sm flex flex-col justify-between hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between text-xs font-bold text-teal-900">
            <span>Cashback Sampah</span>
            <div className="p-1.5 rounded-xl bg-teal-600 text-white shadow-xs">
              <RotateCcw className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3 text-lg sm:text-2xl font-black font-mono tracking-tight text-teal-950 tabular-nums">
            {formatRupiah(balances.sampahCashback)}
          </div>
        </div>

        {/* Total Keseluruhan Keuangan */}
        <div className="bg-gradient-to-br from-emerald-600 via-teal-700 to-cyan-800 text-white p-4 sm:p-5 rounded-2xl shadow-lg shadow-emerald-700/25 border-2 border-emerald-400/60 ring-2 ring-emerald-300/40 flex flex-col justify-between">
          <div className="flex items-center justify-between text-xs font-bold text-emerald-100">
            <span>Total Keseluruhan Keuangan</span>
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-amber-300 animate-pulse" />
              <span className="text-[10px] text-amber-200 font-mono font-bold uppercase tracking-wider">Aktif</span>
            </div>
          </div>
          <div className="mt-3 text-lg sm:text-2xl font-black font-mono tracking-tight tabular-nums text-white">
            {formatRupiah(balances.total)}
          </div>
        </div>
      </div>

      {/* UNIFIED SUB-TABS: 1. Buku Kas Keluar & Masuk | 2. Kas Per KK */}
      <div className="bg-gradient-to-r from-emerald-100/90 via-teal-100/90 to-indigo-100/90 p-1.5 rounded-2xl border-2 border-teal-300/80 shadow-xs flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 w-full sm:w-auto">
          <button
            type="button"
            onClick={() => {
              setCurrentSubTab('mutasi');
              if (onSwitchMode) onSwitchMode('kas');
            }}
            className={`flex-1 sm:flex-initial px-4 sm:px-5 py-2.5 rounded-xl text-xs sm:text-sm font-extrabold transition-all cursor-pointer flex items-center justify-center gap-2 ${
              currentSubTab === 'mutasi'
                ? 'bg-gradient-to-r from-teal-600 via-emerald-600 to-green-600 text-white shadow-md shadow-teal-600/30 ring-2 ring-teal-300/70 scale-[1.01]'
                : 'bg-white/80 hover:bg-white text-teal-950 border border-teal-300/70'
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
            className={`flex-1 sm:flex-initial px-4 sm:px-5 py-2.5 rounded-xl text-xs sm:text-sm font-extrabold transition-all cursor-pointer flex items-center justify-center gap-2 ${
              currentSubTab === 'per_kk'
                ? 'bg-gradient-to-r from-indigo-600 via-blue-600 to-sky-600 text-white shadow-md shadow-indigo-600/30 ring-2 ring-indigo-300/70 scale-[1.01]'
                : 'bg-white/80 hover:bg-white text-indigo-950 border border-indigo-300/70'
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
        </div>

        <div className="hidden lg:flex items-center gap-2 px-3 py-1.5 rounded-xl bg-white/70 border border-teal-200 text-xs font-bold text-teal-950">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
          <span>Kolom Buku Kas & Iuran Terpadu</span>
        </div>
      </div>

      {/* VIEW 1: BUKU KAS KELUAR & MASUK */}
      {currentSubTab === 'mutasi' && (
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden space-y-4 p-4 sm:p-6">
          {/* Baris Filter Periode (Khusus Warga: Hanya Bulan Berjalan. Pengurus: Semua Periode + Buat & Hapus) */}
          <div className="space-y-3 pb-3 border-b border-slate-100">
            {/* Baris Filter Periode (Transparansi Penuh: Tersedia untuk Warga & Pengurus) */}
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-2.5">
              <div className="flex flex-wrap items-center gap-1.5 text-xs">
                <span className="font-bold text-slate-700 mr-1 flex items-center gap-1">
                  <Calendar className="w-3.5 h-3.5 text-emerald-600" />
                  Pilih Periode:
                </span>
                <button
                  type="button"
                  onClick={() => setSelectedTxMonth('semua')}
                  className={`px-3 py-1.5 rounded-lg font-bold transition-all cursor-pointer ${
                    selectedTxMonth === 'semua'
                      ? 'bg-emerald-600 text-white shadow-xs'
                      : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                  }`}
                >
                  Semua Periode ({transactions.length})
                </button>
                {allMonthlyCashflowGroups.map((m) => (
                  <button
                    key={m.monthKey}
                    type="button"
                    onClick={() => setSelectedTxMonth(m.monthKey)}
                    className={`px-3 py-1.5 rounded-lg font-bold transition-all cursor-pointer ${
                      selectedTxMonth === m.monthKey
                        ? 'bg-emerald-600 text-white shadow-xs'
                        : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
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
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition-colors cursor-pointer shadow-xs"
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
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 text-xs font-bold transition-colors cursor-pointer"
                    title="Hapus Periode Buku Kas dan Iuran"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Hapus Periode</span>
                  </button>
                </div>
              )}
            </div>

            {/* Category / Pool Filter + Search */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2">
              {/* Category / Pool Filter Buttons (Semua, Iuran Warga, Denda Baksos, Kas Utama, WiFi, Sampah, Pengeluaran) */}
              <div className="flex flex-wrap items-center gap-1 text-xs">
                <button
                  type="button"
                  onClick={() => setFilterPool('semua')}
                  className={`px-2.5 py-1 rounded-lg font-bold cursor-pointer ${
                    filterPool === 'semua'
                      ? 'bg-slate-900 text-white shadow-xs'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  Semua ({filteredTransactions.length})
                </button>
                <button
                  type="button"
                  onClick={() => setFilterPool('Iuran Warga')}
                  className={`px-2.5 py-1 rounded-lg font-bold cursor-pointer ${
                    filterPool === 'Iuran Warga'
                      ? 'bg-emerald-700 text-white shadow-xs'
                      : 'bg-emerald-50 text-emerald-800 hover:bg-emerald-100 border border-emerald-200'
                  }`}
                >
                  Iuran Warga
                </button>
                <button
                  type="button"
                  onClick={() => setFilterPool('Denda Baksos')}
                  className={`px-2.5 py-1 rounded-lg font-bold cursor-pointer ${
                    filterPool === 'Denda Baksos'
                      ? 'bg-amber-600 text-white shadow-xs'
                      : 'bg-amber-50 text-amber-800 hover:bg-amber-100 border border-amber-200'
                  }`}
                >
                  Denda Baksos
                </button>
                <button
                  type="button"
                  onClick={() => setFilterPool('Kas Utama')}
                  className={`px-2.5 py-1 rounded-lg font-bold cursor-pointer ${
                    filterPool === 'Kas Utama'
                      ? 'bg-teal-700 text-white shadow-xs'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  Kas Utama
                </button>
                <button
                  type="button"
                  onClick={() => setFilterPool('Cashback WiFi')}
                  className={`px-2.5 py-1 rounded-lg font-bold cursor-pointer ${
                    filterPool === 'Cashback WiFi'
                      ? 'bg-cyan-700 text-white shadow-xs'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  WiFi
                </button>
                <button
                  type="button"
                  onClick={() => setFilterPool('Cashback Sampah')}
                  className={`px-2.5 py-1 rounded-lg font-bold cursor-pointer ${
                    filterPool === 'Cashback Sampah'
                      ? 'bg-teal-700 text-white shadow-xs'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  Sampah
                </button>
                <button
                  type="button"
                  onClick={() => setFilterPool('keluar')}
                  className={`px-2.5 py-1 rounded-lg font-bold cursor-pointer ${
                    filterPool === 'keluar'
                      ? 'bg-rose-700 text-white shadow-xs'
                      : 'bg-rose-50 text-rose-700 hover:bg-rose-100 border border-rose-200'
                  }`}
                >
                  Pengeluaran (-)
                </button>
              </div>

              {/* Search Box */}
              <div className="relative w-full sm:w-64">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
                <input
                  type="text"
                  placeholder="Cari transaksi / warga..."
                  value={searchTx}
                  onChange={(e) => setSearchTx(e.target.value)}
                  className="w-full pl-8 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-emerald-500"
                />
              </div>
            </div>
          </div>

          {/* PEMISAHAN DETAIL SALDO KAS UTAMA, WIFI, SAMPAH & PENJELASAN PENGELUARAN (Tampil Sama untuk Warga & Pengurus) */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5 text-center">
            {/* 1. Saldo Bulan Sebelumnya */}
            <div className="bg-amber-50/70 border-2 border-amber-200/90 rounded-2xl p-4 flex flex-col justify-between shadow-2xs">
              <div>
                <div className="flex items-center justify-center gap-1.5 text-xs font-extrabold text-amber-900 pb-2 border-b border-amber-200">
                  <Clock className="w-4 h-4 text-amber-600" />
                  <span>SALDO BULAN SEBELUMNYA</span>
                </div>
                <div className="text-[11px] text-amber-800 mt-1 font-medium">
                  Periode: {prevMonthSummary.prevMonthLabel}
                </div>
                <div className="mt-2.5 space-y-1 text-xs font-mono text-center">
                  <div className="flex justify-between items-center text-slate-700 px-2 py-0.5 rounded bg-white/70">
                    <span className="font-sans text-[11px] font-semibold text-slate-600">Saldo Kas Utama:</span>
                    <span className="font-bold text-emerald-800">{formatRupiah(prevMonthSummary.kasUtama)}</span>
                  </div>
                  <div className="flex justify-between items-center text-slate-700 px-2 py-0.5 rounded bg-white/70">
                    <span className="font-sans text-[11px] font-semibold text-slate-600">Saldo Cashback WiFi:</span>
                    <span className="font-bold text-blue-800">{formatRupiah(prevMonthSummary.wifiCashback)}</span>
                  </div>
                  <div className="flex justify-between items-center text-slate-700 px-2 py-0.5 rounded bg-white/70">
                    <span className="font-sans text-[11px] font-semibold text-slate-600">Saldo Cashback Sampah:</span>
                    <span className="font-bold text-teal-800">{formatRupiah(prevMonthSummary.sampahCashback)}</span>
                  </div>
                </div>
              </div>
              <div className="mt-3 pt-2 border-t border-amber-200 text-center">
                <span className="text-[11px] font-extrabold text-amber-900 block">TOTAL SALDO AWAL</span>
                <span className="font-mono text-base font-extrabold text-amber-950 tabular-nums">
                  {formatRupiah(prevMonthSummary.total)}
                </span>
              </div>
            </div>

            {/* 2. Pemasukan & Pengeluaran Kas Utama (Diberikan Nomor Urut Lengkap 1-8 + Sisa Saldo WiFi & Sampah) */}
            <div className="bg-gradient-to-br from-emerald-50 via-teal-50/80 to-cyan-50/90 border-2 border-emerald-300 rounded-2xl p-4 flex flex-col justify-between shadow-xs">
              <div>
                <div className="flex items-center justify-center gap-1.5 text-xs font-black text-emerald-950 pb-2 border-b-2 border-emerald-300">
                  <Wallet className="w-4 h-4 text-emerald-700" />
                  <span>KAS UTAMA PERIODE INI</span>
                </div>
                <div className="mt-2.5 space-y-1.5 text-xs font-mono text-center">
                  {/* 1. Iuran Warga */}
                  <div className="flex justify-between items-center text-emerald-950 px-2.5 py-1 rounded-xl bg-emerald-100/80 border border-emerald-200">
                    <span className="font-sans text-[11px] font-bold text-emerald-950">1. Iuran Warga (+):</span>
                    <span className="font-bold text-emerald-800 tabular-nums">+{formatRupiah(tableTotals.sumMasukIuran)}</span>
                  </div>

                  {/* 2. Denda Baksos */}
                  <div className="flex justify-between items-center text-rose-950 px-2.5 py-1 rounded-xl bg-rose-50 border border-rose-200">
                    <span className="font-sans text-[11px] font-bold text-rose-950">2. Denda Baksos (+):</span>
                    <span className="font-bold text-rose-600 tabular-nums">+{formatRupiah(tableTotals.sumMasukDenda)}</span>
                  </div>

                  {/* 3. Pembayaran Tunggakan */}
                  <div className="flex justify-between items-center text-rose-950 px-2.5 py-1 rounded-xl bg-rose-50 border border-rose-200">
                    <span className="font-sans text-[11px] font-bold text-rose-950">3. Pembayaran Tunggakan (+):</span>
                    <span className="font-bold text-rose-600 tabular-nums">+{formatRupiah(tableTotals.sumMasukTunggakan)}</span>
                  </div>

                  {/* 4. Pengeluaran Kas */}
                  <div className="flex justify-between items-center text-rose-950 px-2.5 py-1 rounded-xl bg-amber-50/90 border border-amber-200">
                    <span className="font-sans text-[11px] font-bold text-slate-800">4. Pengeluaran Kas (-):</span>
                    <span className="font-bold text-rose-600 tabular-nums">-{formatRupiah(tableTotals.sumKeluarKasUtama)}</span>
                  </div>

                  {/* 5. Arus Kas Bersih */}
                  <div className="flex justify-between items-center px-2.5 py-1 rounded-xl bg-teal-100/90 border border-teal-300 font-bold">
                    <span className="font-sans text-[11px] text-teal-950">5. Arus Kas Bersih:</span>
                    <span className={`tabular-nums ${tableTotals.netKasUtama >= 0 ? 'text-teal-900' : 'text-rose-700'}`}>
                      {tableTotals.netKasUtama >= 0 ? '+' : ''}{formatRupiah(tableTotals.netKasUtama)}
                    </span>
                  </div>
                </div>
              </div>
              <div className="mt-3 pt-2.5 border-t-2 border-emerald-300 text-center bg-gradient-to-r from-emerald-600 via-teal-600 to-cyan-700 text-white rounded-xl p-2 shadow-xs">
                <span className="text-[11px] font-extrabold uppercase tracking-wider block text-emerald-100">
                  SISA SALDO KAS UTAMA
                </span>
                <span className="font-mono text-base font-black text-amber-300 tabular-nums">
                  {formatRupiah(tableTotals.finalKasUtama)}
                </span>
              </div>
            </div>

            {/* 3. Pemasukan & Pengeluaran Saldo Cashback (Terpisah WiFi & Sampah) */}
            <div className="bg-cyan-50/70 border-2 border-cyan-200/90 rounded-2xl p-4 flex flex-col justify-between shadow-2xs">
              <div>
                <div className="flex items-center justify-center gap-1.5 text-xs font-extrabold text-cyan-900 pb-2 border-b border-cyan-200">
                  <Wifi className="w-4 h-4 text-cyan-600" />
                  <span>SALDO CASHBACK (WIFI & SAMPAH)</span>
                </div>
                <div className="mt-2.5 space-y-2 text-xs font-mono text-center">
                  {/* Pos Cashback WiFi */}
                  <div className="p-2 rounded-xl bg-blue-100/90 border-2 border-blue-300 space-y-1">
                    <div className="text-[11px] font-bold text-blue-950 flex justify-between items-center">
                      <span className="font-sans font-bold text-blue-900">1. Saldo Cashback WiFi:</span>
                      <span className="font-mono font-black text-blue-800 bg-white/90 px-2 py-0.5 rounded-md border border-blue-200">{formatRupiah(tableTotals.finalWifi)}</span>
                    </div>
                    <div className="flex justify-between text-[10px]">
                      <span className="text-slate-600 font-sans">Masuk:</span>
                      <span className="text-blue-700 font-bold">+{formatRupiah(tableTotals.sumMasukWifi)}</span>
                    </div>
                    <div className="flex justify-between text-[10px]">
                      <span className="text-slate-600 font-sans">Keluar:</span>
                      <span className="text-rose-600 font-bold">-{formatRupiah(tableTotals.sumKeluarWifi)}</span>
                    </div>
                  </div>

                  {/* Pos Cashback Sampah */}
                  <div className="p-2 rounded-xl bg-teal-100/90 border-2 border-teal-300 space-y-1">
                    <div className="text-[11px] font-bold text-teal-950 flex justify-between items-center">
                      <span className="font-sans font-bold text-teal-900">2. Saldo Cashback Sampah:</span>
                      <span className="font-mono font-black text-teal-800 bg-white/90 px-2 py-0.5 rounded-md border border-teal-200">{formatRupiah(tableTotals.finalSampah)}</span>
                    </div>
                    <div className="flex justify-between text-[10px]">
                      <span className="text-slate-600 font-sans">Masuk:</span>
                      <span className="text-teal-700 font-bold">+{formatRupiah(tableTotals.sumMasukSampah)}</span>
                    </div>
                    <div className="flex justify-between text-[10px]">
                      <span className="text-slate-600 font-sans">Keluar:</span>
                      <span className="text-rose-600 font-bold">-{formatRupiah(tableTotals.sumKeluarSampah)}</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Sisa Saldo Cashback Akhir WiFi & Sampah (Ditempatkan di atas Total Saldo Cashback) */}
              <div className="mt-3 pt-2 border-t border-cyan-200 space-y-1.5 font-mono text-xs">
                <div className="flex justify-between items-center px-2.5 py-1.5 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 text-white border border-blue-500 font-bold shadow-xs">
                  <span className="font-sans text-[11px] text-blue-100">Sisa Saldo Akhir Cashback WiFi:</span>
                  <span className="text-amber-300 font-black tabular-nums">{formatRupiah(tableTotals.finalWifi)}</span>
                </div>
                <div className="flex justify-between items-center px-2.5 py-1.5 rounded-xl bg-gradient-to-r from-teal-600 to-cyan-700 text-white border border-teal-500 font-bold shadow-xs">
                  <span className="font-sans text-[11px] text-teal-100">Sisa Saldo Akhir Cashback Sampah:</span>
                  <span className="text-amber-300 font-black tabular-nums">{formatRupiah(tableTotals.finalSampah)}</span>
                </div>

                <div className="mt-2.5 pt-2.5 border-t-2 border-cyan-300 text-center bg-gradient-to-r from-blue-600 via-indigo-600 to-cyan-700 text-white rounded-xl p-2 shadow-xs">
                  <span className="text-[11px] font-extrabold uppercase tracking-wider block text-cyan-100">
                    TOTAL SALDO CASHBACK
                  </span>
                  <span className="font-mono text-base font-black text-amber-300 tabular-nums">
                    {formatRupiah(tableTotals.finalCashback)}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* TABEL BUKU KAS KELUAR MASUK DENGAN GARIS-GARIS (GRID) */}
          <div className="overflow-x-auto rounded-xl border border-slate-300 shadow-2xs">
            <table className="w-full text-center text-xs border-collapse border border-slate-300">
              <thead>
                <tr className="border-b border-slate-300 bg-gradient-to-r from-teal-800 via-emerald-800 to-cyan-900 text-white font-extrabold">
                  <th rowSpan={2} className="py-2.5 px-2 text-center w-12 border border-slate-300 text-white">
                    No
                  </th>
                  <th rowSpan={2} className="py-2.5 px-3 text-center w-28 border border-slate-300 text-white">
                    Tanggal
                  </th>
                  <th rowSpan={2} className="py-2.5 px-4 text-center min-w-[220px] border border-slate-300 text-white">
                    Detail & Uraian Transaksi
                  </th>
                  <th colSpan={5} className="py-2 px-3 text-center bg-emerald-700 text-white border border-slate-300 font-black tracking-wide">
                    PEMASUKAN (+)
                  </th>
                  <th colSpan={3} className="py-2 px-3 text-center bg-rose-700 text-white border border-slate-300 font-black tracking-wide">
                    PENGELUARAN (-)
                  </th>
                  <th rowSpan={2} className="py-2.5 px-3 text-center w-28 border border-slate-300 text-white">
                    Jumlah
                  </th>
                  <th rowSpan={2} className="py-2.5 px-3 text-center w-32 border border-slate-300 text-white">
                    Saldo Berjalan
                  </th>
                  <th rowSpan={2} className="py-2.5 px-2 text-center w-20 border border-slate-300 text-white">
                    {isAdmin ? 'Aksi' : 'Status'}
                  </th>
                </tr>

                <tr className="border-b border-slate-300 text-[11px] font-black bg-slate-100">
                  <th className="py-2 px-2 text-center text-emerald-950 bg-emerald-100/90 border border-slate-300">
                    Iuran Warga
                  </th>
                  <th className="py-2 px-2 text-center text-rose-950 bg-rose-100/90 border border-slate-300">
                    Denda Baksos
                  </th>
                  <th className="py-2 px-2 text-center text-rose-950 bg-rose-100/90 border border-slate-300">
                    Pembayaran Tunggakan
                  </th>
                  <th className="py-2 px-2 text-center text-blue-950 bg-blue-100/90 border border-slate-300">
                    Cashback WiFi
                  </th>
                  <th className="py-2 px-2 text-center text-blue-950 bg-cyan-100/90 border border-slate-300">
                    Cashback Sampah
                  </th>
                  <th className="py-2 px-2 text-center text-rose-950 bg-rose-100/90 border border-slate-300">
                    Kas Utama
                  </th>
                  <th className="py-2 px-2 text-center text-blue-950 bg-blue-100/90 border border-slate-300">
                    Cashback WiFi
                  </th>
                  <th className="py-2 px-2 text-center text-blue-950 bg-cyan-100/90 border border-slate-300">
                    Cashback Sampah
                  </th>
                </tr>
              </thead>

              <tbody className="divide-y divide-slate-300">
                {/* BARIS SALDO BULAN SEBELUMNYA */}
                <tr className="bg-amber-100/60 font-semibold text-slate-800 border-b border-slate-300 text-center">
                  <td className="py-2.5 px-2 text-center text-amber-900 font-bold border border-slate-300">
                    -
                  </td>
                  <td className="py-2.5 px-3 text-center font-mono text-amber-900 whitespace-nowrap border border-slate-300">
                    Awal Bulan
                  </td>
                  <td className="py-2.5 px-4 text-center border border-slate-300">
                    <div className="font-extrabold text-amber-950">
                      Saldo Bulan Sebelumnya ({prevMonthSummary.prevMonthLabel})
                    </div>
                    <div className="text-[10px] text-amber-800 font-normal">
                      Kas Utama: {formatRupiah(prevMonthSummary.kasUtama)} | WiFi: {formatRupiah(prevMonthSummary.wifiCashback)} | Sampah: {formatRupiah(prevMonthSummary.sampahCashback)}
                    </div>
                  </td>
                  <td className="py-2.5 px-2 text-center font-mono text-emerald-800 font-bold border border-slate-300">
                    {formatRupiah(prevMonthSummary.kasUtama)}
                  </td>
                  <td className="py-2.5 px-2 text-center font-mono text-slate-400 border border-slate-300">
                    -
                  </td>
                  <td className="py-2.5 px-2 text-center font-mono text-slate-400 border border-slate-300">
                    -
                  </td>
                  <td className="py-2.5 px-2 text-center font-mono text-blue-600 font-bold border border-slate-300">
                    {formatRupiah(prevMonthSummary.wifiCashback)}
                  </td>
                  <td className="py-2.5 px-2 text-center font-mono text-blue-600 font-bold border border-slate-300">
                    {formatRupiah(prevMonthSummary.sampahCashback)}
                  </td>
                  <td className="py-2.5 px-2 text-center font-mono text-slate-400 border border-slate-300">
                    -
                  </td>
                  <td className="py-2.5 px-2 text-center font-mono text-slate-400 border border-slate-300">
                    -
                  </td>
                  <td className="py-2.5 px-2 text-center font-mono text-slate-400 border border-slate-300">
                    -
                  </td>
                  <td className="py-2.5 px-3 text-center font-mono font-bold text-amber-900 border border-slate-300">
                    {formatRupiah(prevMonthSummary.total)}
                  </td>
                  <td className="py-2.5 px-3 text-center font-mono font-extrabold text-amber-950 border border-slate-300">
                    {formatRupiah(prevMonthSummary.total)}
                  </td>
                  <td className="py-2.5 px-2 text-center text-slate-400 font-mono text-[10px] border border-slate-300">-</td>
                </tr>

                {/* BARIS TRANSAKSI BULAN BERJALAN */}
                {classifiedTransactions.length === 0 ? (
                  <tr>
                    <td
                      colSpan={14}
                      className="py-8 text-center text-slate-400 text-xs italic border border-slate-300"
                    >
                      Tidak ada transaksi mutasi kas pada periode ini.
                    </td>
                  </tr>
                ) : (
                  classifiedTransactions.map((item, idx) => {
                    const {
                      tx,
                      isMasuk,
                      isIuran,
                      isDenda,
                      isTunggakan,
                      isWifi,
                      isSampah,
                      masukIuran,
                      masukDenda,
                      masukTunggakan,
                      masukWifi,
                      masukSampah,
                      keluarKasUtama,
                      keluarWifi,
                      keluarSampah,
                      subCategoryLabel,
                      runningTotal,
                    } = item;
                    return (
                      <tr
                        key={tx.id}
                        className={`hover:bg-teal-50/40 transition-colors text-center ${
                          idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/50'
                        }`}
                      >
                        {/* No */}
                        <td className="py-2.5 px-2 text-center font-mono text-slate-500 border border-slate-300">
                          {idx + 1}
                        </td>

                        {/* Tanggal */}
                        <td className="py-2.5 px-3 text-center font-mono text-slate-700 whitespace-nowrap border border-slate-300">
                          {formatDateDDMMYYYY(tx.date)}
                        </td>

                        {/* Detail Transaksi & Badge */}
                        <td className="py-2.5 px-4 text-center border border-slate-300">
                          <div className="font-semibold text-slate-800 leading-snug">
                            {tx.description}
                          </div>
                          <div className="mt-1 flex items-center justify-center gap-1.5 flex-wrap">
                            <span
                              className={`px-2 py-0.5 rounded-full font-bold text-[10px] ${
                                isTunggakan
                                  ? 'bg-rose-100 text-rose-800 border border-rose-300'
                                  : isDenda
                                  ? 'bg-rose-100 text-rose-800 border border-rose-300'
                                  : isIuran
                                  ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                                  : isWifi
                                  ? 'bg-blue-100 text-blue-800 border border-blue-200'
                                  : isSampah
                                  ? 'bg-cyan-100 text-cyan-800 border border-cyan-200'
                                  : 'bg-slate-100 text-slate-700'
                              }`}
                            >
                              {subCategoryLabel || tx.pool}
                            </span>
                            {tx.category && tx.category !== tx.pool && (
                              <span className="px-1.5 py-0.5 rounded text-[10px] bg-slate-100 text-slate-600">
                                {tx.category}
                              </span>
                            )}
                          </div>
                        </td>

                        {/* Pemasukan: 1. Iuran Warga */}
                        <td className="py-2.5 px-2 text-center font-mono font-bold whitespace-nowrap tabular-nums border border-slate-300">
                          {masukIuran > 0 ? (
                            <span className="text-emerald-700">+{formatRupiah(masukIuran)}</span>
                          ) : (
                            <span className="text-slate-300">-</span>
                          )}
                        </td>

                        {/* Pemasukan: 2. Denda Baksos (MERAH) */}
                        <td className="py-2.5 px-2 text-center font-mono font-bold whitespace-nowrap tabular-nums border border-slate-300">
                          {masukDenda > 0 ? (
                            <span className="text-rose-600 font-bold">+{formatRupiah(masukDenda)}</span>
                          ) : (
                            <span className="text-slate-300">-</span>
                          )}
                        </td>

                        {/* Pemasukan: 3. Pembayaran Tunggakan (MERAH) */}
                        <td className="py-2.5 px-2 text-center font-mono font-bold whitespace-nowrap tabular-nums border border-slate-300">
                          {masukTunggakan > 0 ? (
                            <span className="text-rose-600 font-bold">+{formatRupiah(masukTunggakan)}</span>
                          ) : (
                            <span className="text-slate-300">-</span>
                          )}
                        </td>

                        {/* Pemasukan: 4. Cashback WiFi (BIRU) */}
                        <td className="py-2.5 px-2 text-center font-mono font-bold whitespace-nowrap tabular-nums border border-slate-300">
                          {masukWifi > 0 ? (
                            <span className="text-blue-600 font-bold">+{formatRupiah(masukWifi)}</span>
                          ) : (
                            <span className="text-slate-300">-</span>
                          )}
                        </td>

                        {/* Pemasukan: 5. Cashback Sampah (BIRU) */}
                        <td className="py-2.5 px-2 text-center font-mono font-bold whitespace-nowrap tabular-nums border border-slate-300">
                          {masukSampah > 0 ? (
                            <span className="text-blue-600 font-bold">+{formatRupiah(masukSampah)}</span>
                          ) : (
                            <span className="text-slate-300">-</span>
                          )}
                        </td>

                        {/* Pengeluaran: 1. Kas Utama */}
                        <td className="py-2.5 px-2 text-center font-mono font-bold whitespace-nowrap tabular-nums border border-slate-300">
                          {keluarKasUtama > 0 ? (
                            <span className="text-rose-600">-{formatRupiah(keluarKasUtama)}</span>
                          ) : (
                            <span className="text-slate-300">-</span>
                          )}
                        </td>

                        {/* Pengeluaran: 2. Cashback WiFi (BIRU) */}
                        <td className="py-2.5 px-2 text-center font-mono font-bold whitespace-nowrap tabular-nums border border-slate-300">
                          {keluarWifi > 0 ? (
                            <span className="text-blue-600 font-bold">-{formatRupiah(keluarWifi)}</span>
                          ) : (
                            <span className="text-slate-300">-</span>
                          )}
                        </td>

                        {/* Pengeluaran: 3. Cashback Sampah (BIRU) */}
                        <td className="py-2.5 px-2 text-center font-mono font-bold whitespace-nowrap tabular-nums border border-slate-300">
                          {keluarSampah > 0 ? (
                            <span className="text-blue-600 font-bold">-{formatRupiah(keluarSampah)}</span>
                          ) : (
                            <span className="text-slate-300">-</span>
                          )}
                        </td>

                        {/* Jumlah Transaksi */}
                        <td className="py-2.5 px-3 text-center font-mono font-bold whitespace-nowrap tabular-nums border border-slate-300">
                          <span className={isMasuk ? 'text-emerald-700' : 'text-rose-600'}>
                            {isMasuk ? '+' : '-'}{formatRupiah(tx.amount)}
                          </span>
                        </td>

                        {/* Saldo Berjalan (Kumulatif) */}
                        <td className="py-2.5 px-3 text-center font-mono font-extrabold whitespace-nowrap tabular-nums text-slate-900 border border-slate-300">
                          {formatRupiah(runningTotal)}
                        </td>

                        {/* Aksi (Pengurus) / Status (Warga) */}
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
                  })
                )}
              </tbody>

              {/* FOOTER TOTAL & SALDO AKHIR DENGAN GARIS-GARIS (GRID) */}
              <tfoot>
                <tr className="bg-slate-200/90 text-slate-900 font-extrabold border-t-2 border-slate-300 text-center">
                  <td className="py-3 px-2 text-center border border-slate-300">-</td>
                  <td className="py-3 px-3 text-center font-mono border border-slate-300">Akhir Bulan</td>
                  <td className="py-3 px-4 text-center font-black text-slate-900 border border-slate-300">
                    TOTAL TRANSAKSI & SALDO AKHIR
                  </td>
                  <td className="py-3 px-2 text-center font-mono font-black text-emerald-800 border border-slate-300">
                    +{formatRupiah(tableTotals.sumMasukIuran)}
                  </td>
                  <td className="py-3 px-2 text-center font-mono font-black text-rose-600 border border-slate-300">
                    +{formatRupiah(tableTotals.sumMasukDenda)}
                  </td>
                  <td className="py-3 px-2 text-center font-mono font-black text-rose-600 border border-slate-300">
                    +{formatRupiah(tableTotals.sumMasukTunggakan)}
                  </td>
                  <td className="py-3 px-2 text-center font-mono font-black text-blue-600 border border-slate-300">
                    +{formatRupiah(tableTotals.sumMasukWifi)}
                  </td>
                  <td className="py-3 px-2 text-center font-mono font-black text-blue-600 border border-slate-300">
                    +{formatRupiah(tableTotals.sumMasukSampah)}
                  </td>
                  <td className="py-3 px-2 text-center font-mono font-black text-rose-700 border border-slate-300">
                    -{formatRupiah(tableTotals.sumKeluarKasUtama)}
                  </td>
                  <td className="py-3 px-2 text-center font-mono font-black text-blue-600 border border-slate-300">
                    -{formatRupiah(tableTotals.sumKeluarWifi)}
                  </td>
                  <td className="py-3 px-2 text-center font-mono font-black text-blue-600 border border-slate-300">
                    -{formatRupiah(tableTotals.sumKeluarSampah)}
                  </td>
                  <td className="py-3 px-3 text-center font-mono font-black border border-slate-300">
                    <span className={tableTotals.netPeriod >= 0 ? 'text-emerald-700' : 'text-rose-700'}>
                      {tableTotals.netPeriod >= 0 ? '+' : ''}{formatRupiah(tableTotals.netPeriod)}
                    </span>
                  </td>
                  <td className="py-3 px-3 text-center font-mono font-black text-emerald-950 text-sm border border-slate-300">
                    {formatRupiah(tableTotals.finalSaldo)}
                  </td>
                  <td className="py-3 px-2 text-center text-slate-400 font-mono text-[10px] border border-slate-300">-</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}

      {/* VIEW 2: REKAP IURAN KAS PER KK */}
      {currentSubTab === 'per_kk' && (
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden space-y-5 p-4 sm:p-6">
          {/* Header & Stats (Warga: Khusus Bulan Berjalan. Pengurus: Bisa Buat & Hapus Periode + Ganti Periode) */}
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 pb-4 border-b border-slate-100">
            <div>
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-xl bg-teal-600 text-white shadow-xs">
                  <Users className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-extrabold text-slate-900 text-base sm:text-lg flex items-center gap-2">
                    <span>Rekap Pembayaran Iuran Kas Per KK</span>
                    {isAdmin ? (
                      <span className="px-2 py-0.5 rounded-md bg-teal-100 text-teal-800 text-[10px] font-bold">
                        Mode Pengurus
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 text-[10px] font-bold">
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
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold cursor-pointer shadow-xs transition-colors"
                    title="Upload Data Iuran Warga Per KK via Excel (.xlsx / .xls)"
                  >
                    <FileSpreadsheet className="w-3.5 h-3.5" />
                    <span>Upload Excel Iuran</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setPeriodModalTab('tambah');
                      setIsPeriodModalOpen(true);
                    }}
                    className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold cursor-pointer shadow-xs transition-colors"
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
                    className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 text-xs font-bold cursor-pointer transition-colors"
                    title="Hapus Periode Iuran KK & Buku Kas"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Hapus Periode</span>
                  </button>
                </>
              )}
            </div>
          </div>

          {/* BAR FILTER PERIODE, MODE TAMPILAN, STATUS & PENCARIAN */}
          <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200/90 space-y-3">
            {/* Baris 1: Pilihan Periode Bulan & Switcher Mode Tampilan */}
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
              {/* Filter Periode Bulan */}
              <div className="flex flex-wrap items-center gap-1.5 text-xs">
                <span className="font-bold text-slate-700 mr-1 flex items-center gap-1">
                  <Calendar className="w-3.5 h-3.5 text-emerald-600" />
                  Pilih Periode:
                </span>
                <button
                  type="button"
                  onClick={() => setSelectedKKPeriod('semua')}
                  className={`px-3 py-1.5 rounded-lg font-bold transition-all cursor-pointer ${
                    selectedKKPeriod === 'semua'
                      ? 'bg-emerald-600 text-white shadow-xs'
                      : 'bg-white hover:bg-slate-200 text-slate-700 border border-slate-200'
                  }`}
                >
                  Semua Periode ({residents.length} KK)
                </button>
                {sortedPeriods.map((p) => {
                  const isCur = p === defaultMonthLabel;
                  return (
                    <button
                      key={p}
                      type="button"
                      onClick={() => setSelectedKKPeriod(p)}
                      className={`px-3 py-1.5 rounded-lg font-bold transition-all cursor-pointer ${
                        selectedKKPeriod === p
                          ? 'bg-emerald-600 text-white shadow-xs'
                          : 'bg-white hover:bg-slate-200 text-slate-700 border border-slate-200'
                      }`}
                    >
                      {p} {isCur ? '★' : ''}
                    </button>
                  );
                })}
              </div>

              {/* Indikator Legenda Warna Baris & Sel Otomatis */}
              <div className="flex flex-wrap items-center gap-2 p-1.5 bg-white rounded-xl border border-slate-200 shadow-2xs text-[11px] font-bold self-start lg:self-auto">
                <span className="text-slate-500 font-semibold px-1">Pewarnaan Kolom & Sel:</span>
                <span className="flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-emerald-100 text-emerald-900 border border-emerald-300">
                  <span className="w-2 h-2 rounded-full bg-emerald-600"></span>
                  Hijau: Sudah Bayar
                </span>
                <span className="flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-rose-100 text-rose-900 border border-rose-300">
                  <span className="w-2 h-2 rounded-full bg-rose-600"></span>
                  Merah: Menunggak
                </span>
                <span className="flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-sky-100 text-sky-900 border border-sky-300">
                  <span className="w-2 h-2 rounded-full bg-sky-600"></span>
                  Biru Muda: Bayar &gt;1 Bln
                </span>
                <span className="flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-slate-900 text-white border border-slate-700">
                  <span className="w-2 h-2 rounded-full bg-slate-300"></span>
                  Hitam: Rumah Kosong
                </span>
              </div>
            </div>

            {/* Baris 2: Filter Status & Search Input */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2 border-t border-slate-200/70">
              <div className="flex items-center gap-1.5 text-xs">
                <button
                  type="button"
                  onClick={() => setDuesFilter('semua')}
                  className={`px-3 py-1.5 rounded-lg font-semibold cursor-pointer ${
                    duesFilter === 'semua'
                      ? 'bg-slate-900 text-white font-bold shadow-xs'
                      : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
                  }`}
                >
                  Semua Status ({residents.length})
                </button>
                <button
                  type="button"
                  onClick={() => setDuesFilter('Lunas')}
                  className={`px-3 py-1.5 rounded-lg font-semibold cursor-pointer ${
                    duesFilter === 'Lunas'
                      ? 'bg-emerald-600 text-white font-bold shadow-xs'
                      : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
                  }`}
                >
                  Lunas
                </button>
                <button
                  type="button"
                  onClick={() => setDuesFilter('Bayar Lebih')}
                  className={`px-3 py-1.5 rounded-lg font-semibold cursor-pointer ${
                    duesFilter === 'Bayar Lebih'
                      ? 'bg-indigo-600 text-white font-bold shadow-xs'
                      : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
                  }`}
                >
                  Bayar Lebih (&gt;1 Bln)
                </button>
                <button
                  type="button"
                  onClick={() => setDuesFilter('Belum Bayar')}
                  className={`px-3 py-1.5 rounded-lg font-semibold cursor-pointer ${
                    duesFilter === 'Belum Bayar'
                      ? 'bg-rose-600 text-white font-bold shadow-xs'
                      : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
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
                  className="w-full pl-8 pr-3 py-1.5 text-xs bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-emerald-500 shadow-2xs"
                />
              </div>
            </div>
          </div>

          {/* TABEL REKAP IURAN PER KK */}
          <div className="space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between text-xs text-slate-600 gap-1.5 pb-1">
                <span className="font-bold text-slate-800 flex items-center gap-1.5">
                  <Table className="w-4 h-4 text-emerald-600" />
                  <span>
                    Tabel Rekap Pembayaran Iuran Per KK {selectedKKPeriod !== 'semua' ? `— Periode ${selectedKKPeriod}` : ''} ({filteredPerKKList.length} KK)
                  </span>
                </span>
                <span className="text-[11px] text-slate-500">
                  Data tersinkronisasi otomatis dengan Buku Induk & Tunggakan Warga
                </span>
              </div>

              <div className="overflow-x-auto rounded-2xl border border-slate-200 shadow-2xs bg-white">
                <table className="w-full text-left text-xs border-collapse border border-slate-300 whitespace-nowrap">
                  <thead>
                    <tr className="bg-slate-100/90 text-slate-800 font-extrabold border-b border-slate-300">
                      <th className="py-3 px-2 text-center w-12 border border-slate-300">No</th>
                      <th className="py-3 px-3 text-center border border-slate-300">No Blok</th>
                      <th className="py-3 px-4 min-w-[200px] border border-slate-300">Nama Kepala Keluarga</th>
                      <th className="py-3 px-3 text-center border border-slate-300">Periode Iuran</th>
                      <th className="py-3 px-3 text-right border border-slate-300">Iuran Bulanan</th>
                      <th className="py-3 px-3 text-right border border-slate-300">Denda Baksos</th>
                      <th className="py-3 px-3 text-right border border-slate-300">Pembayaran Tunggakan</th>
                      <th className="py-3 px-3 text-center border border-slate-300">Tanggal Pembayaran</th>
                      <th className="py-3 px-4 text-right border border-slate-300">Total Semua Pembayaran</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-300">
                    {filteredPerKKList.length === 0 ? (
                      <tr>
                        <td colSpan={9} className="py-8 text-center text-slate-400 italic border border-slate-300">
                          Tidak ada data rekap pembayaran untuk filter ini.
                        </td>
                      </tr>
                    ) : (
                      filteredPerKKList.map((item, idx) => {
                        const { house, isLunas, isAdvancePaid, isEmptyHouse } = item;
                        const isVacant = isEmptyHouse || isHouseVacant(house);
                        const payerName = house.duesHeadNameOverride || house.headName;
                        const periodStr = selectedKKPeriod !== 'semua' ? selectedKKPeriod : item.periodLabel;
                        const statusInfo =
                          selectedKKPeriod !== 'semua'
                            ? getHouseStatusForPeriod(house, selectedKKPeriod)
                            : null;

                        const iuranPaid = statusInfo
                          ? statusInfo.status === 'Lunas' || statusInfo.status === 'Bayar Lebih'
                            ? statusInfo.amount || item.nominalPerMonth
                            : statusInfo.amount || 0
                          : isLunas
                          ? item.nominalPerMonth * (isAdvancePaid ? Math.max(1, house.duesPaidMonths || 1) : 1)
                          : house.duesPaidAmount || 0;

                        const dendaPaid = item.baksosFineAmount || 0;

                        const blockLower = house.blockNumber.toLowerCase();
                        const tunggakanTxs = transactions.filter((t) => {
                          if (t.type !== 'masuk') return false;
                          const d = t.description.toLowerCase();
                          const c = (t.category || '').toLowerCase();
                          const isBlock = d.includes(blockLower);
                          const isTung =
                            t.category === 'Pembayaran Tunggakan' ||
                            d.includes('tunggakan') ||
                            c.includes('tunggakan');
                          if (!isBlock || !isTung) return false;
                          if (selectedKKPeriod !== 'semua') {
                            const pKey = parseIndonesianMonthYearToKey(selectedKKPeriod);
                            return getMonthKeyFromDate(t.date) === pKey;
                          }
                          return true;
                        });
                        const tunggakanPaid = tunggakanTxs.reduce((s, t) => s + t.amount, 0);

                        const paidDate =
                          statusInfo?.paidDate ||
                          house.duesPaidDate ||
                          (tunggakanTxs.length > 0 ? tunggakanTxs[0].date : '');

                        const totalSemua = iuranPaid + dendaPaid + tunggakanPaid;

                        const isBayarLebih =
                          !isVacant &&
                          ((statusInfo && statusInfo.status === 'Bayar Lebih') ||
                           (selectedKKPeriod === 'semua' && isAdvancePaid) ||
                           ((house.duesPaidMonths || 0) > 1));

                        const isSudahBayar =
                          !isVacant &&
                          !isBayarLebih &&
                          ((statusInfo && (statusInfo.status === 'Lunas' || (statusInfo.amount || 0) > 0)) ||
                           (selectedKKPeriod === 'semua' && isLunas) ||
                           (iuranPaid > 0));

                        const isMenunggak = !isVacant && !isBayarLebih && !isSudahBayar;

                        // Pewarnaan otomatis seluruh baris & sel sesuai instruksi:
                        // - Sudah bayar: Hijau seluruhnya
                        // - Menunggak: Merah seluruhnya
                        // - Rumah kosong: Hitam seluruhnya
                        // - Bayar > 1 bulan: Biru muda seluruhnya
                        const rowCellClass = isVacant
                          ? 'bg-slate-900 text-white border-slate-700'
                          : isBayarLebih
                          ? 'bg-sky-50 text-sky-950 border-sky-300 font-medium'
                          : isSudahBayar
                          ? 'bg-emerald-50 text-emerald-950 border-emerald-300 font-medium'
                          : 'bg-rose-50 text-rose-950 border-rose-300 font-medium';

                        return (
                          <tr
                            key={house.id}
                            className={`transition-colors border-b ${
                              isVacant
                                ? 'bg-slate-900 text-white border-slate-700'
                                : isBayarLebih
                                ? 'bg-sky-50 text-sky-950 border-sky-300'
                                : isSudahBayar
                                ? 'bg-emerald-50 text-emerald-950 border-emerald-300'
                                : 'bg-rose-50 text-rose-950 border-rose-300'
                            }`}
                          >
                            {/* 1. No */}
                            <td className={`py-2.5 px-2 text-center font-mono border ${rowCellClass} ${isVacant ? 'text-slate-300' : 'text-slate-600'}`}>
                              {idx + 1}
                            </td>

                            {/* 2. No Blok */}
                            <td className={`py-2.5 px-3 text-center border ${rowCellClass}`}>
                              <span
                                className={`font-mono text-xs font-bold px-2 py-0.5 rounded-lg border shadow-2xs ${
                                  isVacant
                                    ? 'bg-slate-800 text-white border-slate-600'
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
                                <span
                                  className={`font-bold ${
                                    isVacant
                                      ? 'text-white'
                                      : isBayarLebih
                                      ? 'text-sky-950'
                                      : isSudahBayar
                                      ? 'text-emerald-950'
                                      : 'text-rose-950'
                                  }`}
                                >
                                  {isVacant
                                    ? payerName.toLowerCase().includes('kosong')
                                      ? payerName
                                      : `Rumah Kosong (${payerName})`
                                    : payerName}
                                </span>
                                {isAdmin && (
                                  <button
                                    type="button"
                                    onClick={() => handleOpenEditHouseDues(house, false)}
                                    className={`p-1 rounded transition-colors cursor-pointer shrink-0 ${
                                      isVacant
                                        ? 'text-slate-400 hover:text-white hover:bg-slate-800'
                                        : 'text-slate-400 hover:text-emerald-700 hover:bg-emerald-100/60'
                                    }`}
                                    title="Edit Iuran & Tunggakan KK"
                                  >
                                    <Edit2 className="w-3.5 h-3.5" />
                                  </button>
                                )}
                              </div>
                            </td>

                            {/* 4. Periode Iuran */}
                            <td className={`py-2.5 px-3 text-center font-bold border ${rowCellClass} ${isVacant ? 'text-slate-200' : ''}`}>
                              {periodStr}
                            </td>

                            {/* 5. Iuran Bulanan */}
                            <td className={`py-2.5 px-3 text-right font-mono tabular-nums border ${rowCellClass}`}>
                              {iuranPaid > 0 ? (
                                <span className={`font-bold ${isVacant ? 'text-emerald-300' : isBayarLebih ? 'text-sky-900' : isSudahBayar ? 'text-emerald-800' : 'text-slate-700'}`}>
                                  +{formatRupiah(iuranPaid)}
                                </span>
                              ) : isVacant ? (
                                <span className="text-slate-400 italic text-[11px]">Rumah Kosong (Rp 0)</span>
                              ) : (
                                <span className="text-rose-700 font-bold">Rp 0 (Belum Bayar)</span>
                              )}
                            </td>

                            {/* 6. Denda Baksos (Warna Merah) */}
                            <td className={`py-2.5 px-3 text-right font-mono tabular-nums border ${rowCellClass}`}>
                              {dendaPaid > 0 ? (
                                <span className="text-rose-600 font-black">+{formatRupiah(dendaPaid)}</span>
                              ) : (
                                <span className={isVacant ? 'text-slate-500' : 'text-slate-400'}>-</span>
                              )}
                            </td>

                            {/* 7. Pembayaran Tunggakan (Warna Merah) */}
                            <td className={`py-2.5 px-3 text-right font-mono tabular-nums border ${rowCellClass}`}>
                              {tunggakanPaid > 0 ? (
                                <span className="text-rose-600 font-black">+{formatRupiah(tunggakanPaid)}</span>
                              ) : (
                                <span className={isVacant ? 'text-slate-500' : 'text-slate-400'}>-</span>
                              )}
                            </td>

                            {/* 8. Tanggal Pembayaran */}
                            <td className={`py-2.5 px-3 text-center font-mono text-[11px] border ${rowCellClass} ${isVacant ? 'text-slate-300' : 'text-slate-700'}`}>
                              {paidDate ? formatDateDDMMYYYY(paidDate) : '-'}
                            </td>

                            {/* 9. Total Semua Pembayaran */}
                            <td className={`py-2.5 px-4 text-right font-mono tabular-nums border ${rowCellClass}`}>
                              <div className="flex flex-col items-end">
                                {isVacant ? (
                                  <>
                                    <span className="font-mono font-black text-white">
                                      {totalSemua > 0 ? `+${formatRupiah(totalSemua)}` : 'Rp 0'}
                                    </span>
                                    <span className="text-[10px] font-sans font-bold text-slate-300">
                                      Rumah Kosong
                                    </span>
                                  </>
                                ) : isBayarLebih ? (
                                  <>
                                    <span className="font-mono font-black text-sky-950">
                                      +{formatRupiah(totalSemua)}
                                    </span>
                                    <span className="text-[10px] font-sans font-extrabold text-sky-800">
                                      Bayar &gt;1 Bln ({house.duesPaidMonths || 2} Bln)
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
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                  <tfoot>
                    <tr className="bg-slate-100 font-extrabold text-slate-900 border-t-2 border-slate-300">
                      <td colSpan={4} className="py-3 px-4 text-left border border-slate-300">
                        TOTAL SEMUA ({filteredPerKKList.length} KK)
                      </td>
                      <td className="py-3 px-3 text-right font-mono text-emerald-800 border border-slate-300">
                        +{formatRupiah(recapTotals.sumIuran)}
                      </td>
                      <td className="py-3 px-3 text-right font-mono text-rose-600 border border-slate-300">
                        +{formatRupiah(recapTotals.sumDenda)}
                      </td>
                      <td className="py-3 px-3 text-right font-mono text-rose-600 border border-slate-300">
                        +{formatRupiah(recapTotals.sumTunggakan)}
                      </td>
                      <td className="py-3 px-3 text-center text-slate-400 border border-slate-300">
                        -
                      </td>
                      <td className="py-3 px-4 text-right font-mono text-slate-950 font-black border border-slate-300">
                        {formatRupiah(recapTotals.sumTotal)}
                      </td>
                    </tr>
                  </tfoot>
                </table>
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
                          setTxCategory('Kas Utama');
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
                          setTxCategory('Kas Utama');
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
                      } else if (cat === 'Cashback WiFi') {
                        setTxPool('Cashback WiFi');
                      } else if (cat === 'Cashback Sampah') {
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
                        <option value="Kas Utama">Pengeluaran Kas Utama</option>
                        <option value="Pengeluaran Cashback WiFi">Pengeluaran Cashback WiFi</option>
                        <option value="Pengeluaran Cashback Sampah">Pengeluaran Cashback Sampah</option>
                        <option value="Pengeluaran Gang">Pengeluaran Gang</option>
                        <option value="Pengeluaran Lingkungan">Pengeluaran Lingkungan</option>
                      </>
                    )}
                  </select>
                </div>
              </div>

              {/* Opsi KK jika Iuran Warga */}
              {!editingTx && txType === 'masuk' && txCategory === 'Iuran Warga' && (
                <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
                  <label className="block text-[11px] font-bold text-slate-700">
                    Tautkan ke Kepala Keluarga (Opsional)
                  </label>
                  <select
                    value={txResidentId}
                    onChange={(e) => {
                      const id = e.target.value;
                      setTxResidentId(id);
                      if (id) {
                        const h = residents.find((r) => r.id === id);
                        if (h) {
                          const isVacant = h.occupancy === 'Kosong' || h.occupancy === 'Belum Ditempati' || isHouseVacant(h);
                          const nom = getHouseDuesNominal(h) || config.duesAmountPerMonth || 25000;
                          setTxAmount(nom);
                          const payerName = h.duesHeadNameOverride || h.headName;
                          setTxDescription(
                            isVacant
                              ? `Iuran Kas Bulanan (${defaultMonthLabel}) Blok ${h.blockNumber} (Rumah Kosong - ${payerName})`
                              : `Iuran Kas Bulanan (${defaultMonthLabel}) Blok ${h.blockNumber} (${payerName})`
                          );
                        }
                      }
                    }}
                    className="w-full px-2.5 py-1.5 text-xs bg-white border border-slate-200 rounded-lg"
                  >
                    <option value="">— Tidak ditautkan ke KK spesifik —</option>
                    {residents.map((r) => {
                      const isVacant = r.occupancy === 'Kosong' || r.occupancy === 'Belum Ditempati' || isHouseVacant(r);
                      const displayName = r.duesHeadNameOverride ? `${r.duesHeadNameOverride} (Induk: ${r.headName})` : r.headName;
                      return (
                        <option key={r.id} value={r.id}>
                          Blok {r.blockNumber} — {displayName} {isVacant ? '(Rumah Kosong)' : ''}
                        </option>
                      );
                    })}
                  </select>
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Uraian / Keterangan Transaksi
                </label>
                <input
                  type="text"
                  required
                  placeholder="Misal: Iuran bulanan warga Blok K2/25 atau Pembelian lampu jalan"
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
          editingHouseDues.occupancy === 'Kosong' ||
          editingHouseDues.occupancy === 'Belum Ditempati' ||
          isHouseVacant(editingHouseDues);

        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs">
            <div className="bg-white rounded-2xl shadow-xl border border-slate-200 w-full max-w-lg overflow-hidden">
              <div className="bg-slate-900 p-4 text-white flex justify-between items-center">
                <div>
                  <h4 className="font-bold text-sm sm:text-base flex items-center gap-2">
                    <span>Edit Kas KK Blok {editingHouseDues.blockNumber}</span>
                    {isEditingVacant && (
                      <span className="px-2 py-0.5 rounded-full text-[10px] bg-slate-700 text-slate-200 border border-slate-600 font-normal">
                        Rumah Kosong
                      </span>
                    )}
                  </h4>
                  <p className="text-xs text-slate-300 mt-0.5">
                    {editingHouseDues.duesHeadNameOverride || editingHouseDues.headName}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setEditingHouseDues(null)}
                  className="text-white/70 hover:text-white cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {isEditingVacant && (
                <div className="mx-5 mt-4 p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-900 flex items-start gap-2">
                  <div className="font-bold text-amber-700 shrink-0 text-sm">ℹ️</div>
                  <div className="leading-relaxed">
                    <strong>Ketentuan Rumah Kosong:</strong> Secara default rumah kosong otomatis <strong>Bebas Iuran</strong> (tidak wajib bayar kas & tidak ada tunggakan). Jika pemilik rumah ingin berkontribusi membayar iuran kas, Anda dapat memilih <strong>Lunas</strong> atau <strong>Bayar Lebih</strong> di bawah dan simpan.
                  </div>
                </div>
              )}

              <form onSubmit={handleSaveHouseDues} className="p-5 space-y-3.5">
                {/* Input Nama Kepala Keluarga / Penanggung Jawab Iuran & Tunggakan */}
                <div className="p-3 bg-emerald-50/80 border border-emerald-200 rounded-xl space-y-1.5">
                  <div className="flex items-center justify-between">
                    <label className="block text-xs font-bold text-emerald-950">
                      Nama Kepala Keluarga / Pembayar Iuran
                    </label>
                    <span className="text-[10px] text-emerald-700 bg-white px-2 py-0.5 rounded-md border border-emerald-200 font-semibold">
                      Buku Induk: {editingHouseDues.headName}
                    </span>
                  </div>
                  <input
                    type="text"
                    value={houseDuesHeadNameInput}
                    onChange={(e) => setHouseDuesHeadNameInput(e.target.value)}
                    placeholder={editingHouseDues.headName}
                    className="w-full px-3 py-2 text-xs bg-white border border-emerald-300 rounded-lg font-bold text-slate-900 focus:outline-none focus:ring-1 focus:ring-emerald-500 shadow-2xs"
                  />
                  <p className="text-[10px] text-slate-500 leading-tight">
                    *Catatan: Anda dapat mengedit nama pembayar/KK di sini khusus untuk Rekap Iuran & Catatan Tunggakan, tanpa mengubah data asli Kepala Keluarga di Buku Induk Warga.
                  </p>
                </div>

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
                      className="w-full px-3 py-2 text-xs font-mono font-bold border border-slate-300 rounded-lg"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Status Iuran
                    </label>
                    <select
                      value={houseDuesStatusInput}
                      onChange={(e) => setHouseDuesStatusInput(e.target.value as any)}
                      className="w-full px-3 py-2 text-xs font-semibold border border-slate-300 rounded-lg"
                    >
                      {isEditingVacant ? (
                        <>
                          <option value="Belum Bayar">Bebas Iuran (Default Rumah Kosong - Tidak Wajib)</option>
                          <option value="Lunas">Lunas (1 Bulan)</option>
                          <option value="Bayar Lebih">Bayar Lebih (&gt;1 Bulan)</option>
                        </>
                      ) : (
                        <>
                          <option value="Lunas">Lunas (1 Bulan)</option>
                          <option value="Bayar Lebih">Bayar Lebih (&gt;1 Bulan)</option>
                          <option value="Belum Bayar">Belum Bayar</option>
                        </>
                      )}
                    </select>
                  </div>
                </div>

                {houseDuesStatusInput === 'Bayar Lebih' && (
                  <div className="p-3 bg-indigo-50 border border-indigo-200 rounded-xl space-y-2">
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div>
                        <label className="block font-semibold text-indigo-900 mb-1">
                          Jumlah Bulan
                        </label>
                        <input
                          type="number"
                          min={2}
                          max={12}
                          value={houseDuesPaidMonthsInput}
                          onChange={(e) => setHouseDuesPaidMonthsInput(Number(e.target.value) || 2)}
                          className="w-full px-2.5 py-1.5 text-xs bg-white border border-indigo-200 rounded-lg font-mono font-bold"
                        />
                      </div>
                      <div>
                        <label className="block font-semibold text-indigo-900 mb-1">
                          Total Diterima (Rp)
                        </label>
                        <input
                          type="number"
                          min={houseDuesAmountInput * 2}
                          step={5000}
                          value={houseDuesTotalReceivedInput}
                          onChange={(e) => setHouseDuesTotalReceivedInput(Number(e.target.value) || 0)}
                          className="w-full px-2.5 py-1.5 text-xs bg-white border border-indigo-200 rounded-lg font-mono font-bold"
                        />
                      </div>
                    </div>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-3 pt-1 border-t border-slate-100">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Tunggakan Lalu (Rp)
                    </label>
                    <input
                      type="number"
                      min={0}
                      step={5000}
                      disabled={isEditingVacant}
                      value={houseDuesPrevArrearsInput}
                      onChange={(e) => setHouseDuesPrevArrearsInput(Number(e.target.value) || 0)}
                      className={`w-full px-3 py-2 text-xs font-mono border border-slate-300 rounded-lg ${
                        isEditingVacant ? 'bg-slate-100 text-slate-400 cursor-not-allowed' : ''
                      }`}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Ket. Tunggakan Lalu
                    </label>
                    <input
                      type="text"
                      disabled={isEditingVacant}
                      placeholder={isEditingVacant ? 'Tidak ada tunggakan' : 'Sisa bulan lalu...'}
                      value={houseDuesPrevNoteInput}
                      onChange={(e) => setHouseDuesPrevNoteInput(e.target.value)}
                      className={`w-full px-3 py-2 text-xs border border-slate-300 rounded-lg ${
                        isEditingVacant ? 'bg-slate-100 text-slate-400 cursor-not-allowed' : ''
                      }`}
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Tanggal Pembayaran
                  </label>
                  <input
                    type="date"
                    value={houseDuesPaidDateInput}
                    onChange={(e) => setHouseDuesPaidDateInput(e.target.value)}
                    className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg"
                  />
                </div>

                <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setEditingHouseDues(null)}
                    className="px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-100 rounded-lg cursor-pointer"
                  >
                    Batal
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-1.5 text-xs bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-lg cursor-pointer"
                  >
                    {isEditingVacant && houseDuesStatusInput === 'Belum Bayar'
                      ? 'Simpan Bebas Iuran'
                      : 'Simpan & Catat Kas'}
                  </button>
                </div>
              </form>
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

      {/* MODAL 4: SHARE WHATSAPP */}
      {isWaModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs">
          <div className="bg-white rounded-2xl shadow-xl border border-slate-200 w-full max-w-lg overflow-hidden">
            <div className="bg-slate-900 p-4 text-white flex justify-between items-center">
              <div className="flex items-center gap-2">
                <MessageCircle className="w-4 h-4 text-emerald-400" />
                <h4 className="font-bold text-sm">Bagikan Rekap ke WhatsApp</h4>
              </div>
              <button
                type="button"
                onClick={() => setIsWaModalOpen(false)}
                className="text-white/70 hover:text-white cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-5 space-y-3">
              <div className="flex items-center gap-2 text-xs">
                <button
                  type="button"
                  onClick={() => {
                    setWaRecapMode('keluar_masuk');
                    setWaCustomText('');
                  }}
                  className={`flex-1 py-2 rounded-lg font-bold cursor-pointer ${
                    waRecapMode === 'keluar_masuk'
                      ? 'bg-emerald-600 text-white'
                      : 'bg-slate-100 text-slate-700'
                  }`}
                >
                  Rekap Uang Keluar Masuk
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setWaRecapMode('iuran_kk');
                    setWaCustomText('');
                  }}
                  className={`flex-1 py-2 rounded-lg font-bold cursor-pointer ${
                    waRecapMode === 'iuran_kk'
                      ? 'bg-emerald-600 text-white'
                      : 'bg-slate-100 text-slate-700'
                  }`}
                >
                  Rekap Iuran Kas Per KK
                </button>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Preview Isi Pesan WhatsApp
                </label>
                <textarea
                  rows={8}
                  value={waCustomText || previewWaText}
                  onChange={(e) => setWaCustomText(e.target.value)}
                  className="w-full p-2.5 text-xs font-mono bg-slate-50 border border-slate-200 rounded-lg focus:outline-none"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => {
                    navigator.clipboard.writeText(waCustomText || previewWaText);
                    setCopiedWaText(true);
                    setTimeout(() => setCopiedWaText(false), 2000);
                  }}
                  className="flex items-center gap-1 px-3 py-1.5 text-xs text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg font-semibold cursor-pointer"
                >
                  <Copy className="w-3.5 h-3.5" />
                  <span>{copiedWaText ? 'Tersalin!' : 'Salin Teks'}</span>
                </button>
                <button
                  type="button"
                  onClick={() => openWhatsAppShare(waCustomText || previewWaText)}
                  className="flex items-center gap-1.5 px-4 py-1.5 text-xs bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-lg cursor-pointer"
                >
                  <Share2 className="w-3.5 h-3.5" />
                  <span>Kirim ke WhatsApp</span>
                </button>
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
