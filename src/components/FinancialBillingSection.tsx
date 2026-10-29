import React, { useMemo, useState } from 'react';
import confetti from 'canvas-confetti';
import {
  AlertCircle,
  AlertTriangle,
  ArrowRight,
  Banknote,
  Calendar,
  Check,
  CheckCircle2,
  Clock,
  Coins,
  Download,
  Edit2,
  FileSpreadsheet,
  Lock,
  Plus,
  RotateCcw,
  Save,
  Search,
  Sparkles,
  Trash2,
  Upload,
  User,
  Users,
  Wallet,
  X,
  Zap,
} from 'lucide-react';
import { BaksosAgenda, CashTransaction, DuesStatus, ResidentHouse, SiteConfig } from '../types';
import {
  formatDateDDMMYYYY,
  formatRupiah,
  getMonthKeyFromDate,
  getSubsequentMonthLabels,
  isHouseVacant,
  parseIndonesianMonthYearToKey,
} from '../utils/helpers';
import { downloadBillingExcelTemplate } from '../utils/billingExcelHelper';
import { BillingExcelUploadModal } from './BillingExcelUploadModal';

interface FinancialBillingSectionProps {
  config: SiteConfig;
  residents: ResidentHouse[];
  baksosAgendas?: BaksosAgenda[];
  transactions?: CashTransaction[];
  isAdmin: boolean;
  onUpdateResident: (updated: ResidentHouse) => void;
  onDeleteResident?: (houseId: string) => void;
  onAddTransaction: (tx: Omit<CashTransaction, 'id'>) => void;
  onDeleteTransaction?: (id: string) => void;
  onMarkFinePaid?: (agendaId: string, residentId: string, houseName: string, blockNo: string) => void;
  onUnmarkFinePaid?: (agendaId: string, residentId: string) => void;
  onBatchImportDues?: (
    updatedResidents: ResidentHouse[],
    newTransactions: Omit<CashTransaction, 'id'>[],
    periodLabel?: string,
    setPeriodActive?: boolean
  ) => void;
  onCreatePeriod?: (
    newPeriodLabel: string,
    options?: { setActiveCurrentMonth?: boolean; resetNonAdvanceDues?: boolean }
  ) => void;
  onRolloverBillingMonth?: (
    savedPeriod: string,
    nextPeriod: string,
    updatedResidentList: ResidentHouse[],
    newTransactions?: Omit<CashTransaction, 'id'>[]
  ) => void;
  onOpenLogin: () => void;
  onNavigateTab: (tab: string) => void;
}

export type PaymentSelectionMode =
  | 'all'
  | 'dues_only'
  | 'baksos_only'
  | 'arrears_only'
  | 'custom';

export const FinancialBillingSection: React.FC<FinancialBillingSectionProps> = ({
  config,
  residents,
  baksosAgendas = [],
  transactions = [],
  isAdmin,
  onUpdateResident,
  onDeleteResident,
  onAddTransaction,
  onDeleteTransaction,
  onMarkFinePaid,
  onUnmarkFinePaid,
  onBatchImportDues,
  onCreatePeriod,
  onRolloverBillingMonth,
  onOpenLogin,
  onNavigateTab,
}) => {
  const defaultPeriod = config.duesCurrentMonth || 'Oktober 2026';
  const defaultNominal = config.duesAmountPerMonth || 50000;

  // Cukup inputkan bulan penarikan di sini
  const [inputMonth, setInputMonth] = useState<string>(defaultPeriod);

  // Sync inputMonth when config.duesCurrentMonth changes from rollover
  React.useEffect(() => {
    if (config.duesCurrentMonth) {
      setInputMonth(config.duesCurrentMonth);
    }
  }, [config.duesCurrentMonth]);

  const [searchQuery, setSearchQuery] = useState<string>('');
  const [filterOccupancy, setFilterOccupancy] = useState<string>('semua');
  const [filterStatus, setFilterStatus] = useState<string>('semua');
  const [isUploadModalOpen, setIsUploadModalOpen] = useState<boolean>(false);

  // Modal 1: Edit Data Penarikan (Kepala Keluarga, Status Rumah, Iuran Bulanan, Baksos, dan Tunggakan)
  const [editingHouse, setEditingHouse] = useState<ResidentHouse | null>(null);
  const [editHeadName, setEditHeadName] = useState<string>('');
  const [editOccupancy, setEditOccupancy] = useState<ResidentHouse['occupancy']>('Ditempati');
  const [editNominal, setEditNominal] = useState<number>(50000);
  const [editBaksosFine, setEditBaksosFine] = useState<number>(0);
  const [editPrevArrears, setEditPrevArrears] = useState<number>(0);
  const [editPrevNote, setEditPrevNote] = useState<string>('');

  // Modal 2: Pembayaran Fleksibel (Bayar Semua / Pilih Salah Satu)
  const [payingHouse, setPayingHouse] = useState<ResidentHouse | null>(null);
  const [payChoice, setPayChoice] = useState<PaymentSelectionMode>('all');
  const [payDuesSelected, setPayDuesSelected] = useState<boolean>(true);
  const [payDuesMonths, setPayDuesMonths] = useState<number>(1);
  const [payBaksosSelected, setPayBaksosSelected] = useState<boolean>(true);
  const [payArrearsSelected, setPayArrearsSelected] = useState<boolean>(true);
  const [payArrearsAmount, setPayArrearsAmount] = useState<number>(0);
  const [payDate, setPayDate] = useState<string>(new Date().toISOString().slice(0, 10));
  const [payNote, setPayNote] = useState<string>('');

  // Modal 3: Clear Belum Bayar Semua
  const [isClearAllModalOpen, setIsClearAllModalOpen] = useState<boolean>(false);

  // Modal 4: Hapus Manual Per Kepala Keluarga
  const [deletingHouse, setDeletingHouse] = useState<ResidentHouse | null>(null);

  // Modal 5: Simpan Data Penarikan & Pindah ke Bulan Berikutnya (Rollover)
  const [isRolloverModalOpen, setIsRolloverModalOpen] = useState<boolean>(false);

  // Available periods from config + covered months from residents who paid ahead
  const availablePeriods = useMemo(() => {
    const fromConfig =
      config.duesAvailablePeriods && config.duesAvailablePeriods.length > 0
        ? config.duesAvailablePeriods
        : [defaultPeriod, 'September 2026'];
    const coveredByResidents = residents.flatMap((r) =>
      r.duesPaidMonths && r.duesPaidMonths > 1
        ? getSubsequentMonthLabels(r.duesMonthNote || defaultPeriod, r.duesPaidMonths)
        : []
    );
    return Array.from(new Set([...fromConfig, ...coveredByResidents])).filter(Boolean);
  }, [config.duesAvailablePeriods, defaultPeriod, residents]);

  // Aggregate computation per house for the 3 distinct billing components:
  // 1. Iuran Bulanan (bisa diedit, dukung bayar >1 bulan & otomatis lunas di bulan berikutnya)
  // 2. Tunggakan Lalu & Keterangan (bisa diedit)
  // 3. Denda Baksos (bisa diedit)
  const billingList = useMemo(() => {
    return residents.map((house) => {
      const isVacant = house.occupancy === 'Kosong' || isHouseVacant(house);
      const isUnoccupied = house.occupancy === 'Belum Ditempati';
      const isContract = house.ownership === 'Kontrak' || house.occupancy === 'Dikontrakan';

      // 1. Cek Cakupan Multi-Bulan (Bayar Lebih dari 1 Bulan & Otomatis Masuk ke Bulan Berikutnya)
      const houseBasePeriod = house.duesMonthNote || defaultPeriod;
      const paidMonths = house.duesPaidMonths || (house.duesStatus === 'Lunas' || house.duesStatus === 'Bayar Lebih' ? 1 : 0);
      const isPaidState = house.duesStatus === 'Lunas' || house.duesStatus === 'Bayar Lebih';
      const coveredMonths = isPaidState
        ? getSubsequentMonthLabels(houseBasePeriod, Math.max(1, paidMonths))
        : [];

      // Apakah rumah ini lunas untuk bulan penarikan yang sedang dibuka (inputMonth)?
      const isCoveredForInputMonth = isPaidState && coveredMonths.includes(inputMonth);
      const isAdvancePaidForInputMonth = isCoveredForInputMonth && inputMonth !== houseBasePeriod;
      const isDuesPaid = isCoveredForInputMonth || (inputMonth === houseBasePeriod && isPaidState);

      const monthlyDuesNominal = isVacant
        ? isDuesPaid
          ? house.customDuesAmount || defaultNominal
          : 0
        : house.customDuesAmount !== undefined
        ? house.customDuesAmount
        : defaultNominal;

      const remainingDues = isVacant
        ? 0
        : isDuesPaid
        ? 0
        : Math.max(0, monthlyDuesNominal - (house.duesPaidAmount || 0));

      // 2. Tunggakan Lalu & Keterangan (bisa diedit):
      const previousArrears = isVacant ? 0 : house.previousArrears || 0;
      const previousArrearsNote = house.previousArrearsNote || '';

      // 3. Denda Baksos (bisa diedit via customBaksosFineAmount atau dihitung dari agenda gotong royong):
      const unpaidBaksosList = baksosAgendas.filter((agenda) => {
        const attendance =
          agenda.attendance?.[house.id] ||
          (house.occupancy === 'Kosong' ? 'Kosong' : isContract ? 'Tidak Wajib' : 'Hadir');
        const isFinePaid = agenda.finesPaid?.[house.id];
        return attendance === 'Tidak Hadir' && !isFinePaid;
      });
      const calculatedBaksosFine = isVacant ? 0 : unpaidBaksosList.length * 10000;
      const baksosFineAmount =
        house.customBaksosFineAmount !== undefined
          ? house.customBaksosFineAmount
          : calculatedBaksosFine;

      // Total Tagihan Bersih
      const totalBillRemaining = remainingDues + previousArrears + baksosFineAmount;

      return {
        house,
        displayName: isVacant
          ? house.duesHeadNameOverride && house.duesHeadNameOverride !== house.headName
            ? house.duesHeadNameOverride
            : 'Rumah Kosong'
          : isUnoccupied
          ? house.duesHeadNameOverride || 'Belum Ditempati'
          : house.duesHeadNameOverride || house.headName,
        isVacant,
        isUnoccupied,
        isContract,
        monthlyDuesNominal,
        isDuesPaid,
        remainingDues,
        isAdvancePaidForInputMonth,
        coveredMonths,
        paidMonthsCount: paidMonths,
        previousArrears,
        previousArrearsNote,
        unpaidBaksosList,
        baksosFineAmount,
        totalBillRemaining,
      };
    });
  }, [residents, baksosAgendas, defaultNominal, defaultPeriod, inputMonth]);

  // Access guard for non-admin
  if (!isAdmin) {
    return (
      <div className="bg-white rounded-3xl p-8 sm:p-12 text-center border-2 border-slate-200 shadow-md max-w-2xl mx-auto space-y-4 my-8">
        <div className="w-16 h-16 rounded-3xl bg-rose-50 border-2 border-rose-200 text-rose-600 flex items-center justify-center mx-auto shadow-inner">
          <Lock className="w-8 h-8" />
        </div>
        <div className="space-y-1.5">
          <h2 className="text-xl sm:text-2xl font-black text-slate-900">
            Akses Terbatas Pengurus Gang
          </h2>
          <p className="text-sm text-slate-600 leading-relaxed max-w-md mx-auto">
            Halaman <strong>Input Data Penarikan Keuangan</strong> hanya dapat diakses oleh Administrator / Pengurus yang telah login.
          </p>
        </div>
        <div className="pt-2">
          <button
            type="button"
            onClick={onOpenLogin}
            className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold text-sm shadow-md transition-all cursor-pointer"
          >
            Masuk Kredensial Pengurus
          </button>
        </div>
      </div>
    );
  }

  // OPEN MODAL 1: EDIT DATA WARGA & 3 KOMPONEN (Kepala Keluarga, Iuran Bulanan, Baksos, dan Tunggakan)
  const handleOpenEdit = (house: ResidentHouse) => {
    const isVacant = house.occupancy === 'Kosong' || isHouseVacant(house);
    const nominal = isVacant
      ? 0
      : house.customDuesAmount !== undefined
      ? house.customDuesAmount
      : defaultNominal;

    const bItem = billingList.find((b) => b.house.id === house.id);

    const isUnoccupied = house.occupancy === 'Belum Ditempati';
    const initialName = isVacant
      ? house.duesHeadNameOverride && house.duesHeadNameOverride !== house.headName
        ? house.duesHeadNameOverride
        : 'Rumah Kosong'
      : isUnoccupied
      ? house.duesHeadNameOverride || 'Belum Ditempati'
      : house.duesHeadNameOverride || house.headName;

    setEditingHouse(house);
    setEditHeadName(initialName);
    setEditOccupancy(house.occupancy);
    setEditNominal(nominal);
    setEditBaksosFine(bItem ? bItem.baksosFineAmount : 0);
    setEditPrevArrears(isVacant ? 0 : house.previousArrears || 0);
    setEditPrevNote(house.previousArrearsNote || '');
  };

  const handleSaveEditModal = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingHouse) return;

    const isVacant = editOccupancy === 'Kosong';
    const isUnoccupied = editOccupancy === 'Belum Ditempati';
    const finalNominal = isVacant ? 0 : Math.max(0, editNominal);
    const trimmedHead = editHeadName.trim();
    const finalHeadOverride = isVacant
      ? trimmedHead && trimmedHead !== 'Rumah Kosong' ? trimmedHead : 'Rumah Kosong'
      : isUnoccupied
      ? trimmedHead && trimmedHead !== 'Belum Ditempati' ? trimmedHead : 'Belum Ditempati'
      : trimmedHead && trimmedHead !== editingHouse.headName ? trimmedHead : undefined;

    const updated: ResidentHouse = {
      ...editingHouse,
      occupancy: editOccupancy,
      headName: isVacant
        ? (trimmedHead || 'Rumah Kosong')
        : isUnoccupied
        ? (trimmedHead || 'Belum Ditempati')
        : (trimmedHead || editingHouse.headName),
      duesHeadNameOverride: finalHeadOverride,
      customDuesAmount: finalNominal,
      customBaksosFineAmount: isVacant ? 0 : Math.max(0, editBaksosFine),
      previousArrears: isVacant ? 0 : Math.max(0, editPrevArrears),
      previousArrearsNote: isVacant ? '' : editPrevNote.trim(),
    };

    onUpdateResident(updated);
    try {
      confetti({ particleCount: 30, spread: 40, origin: { y: 0.7 } });
    } catch {}
    setEditingHouse(null);
  };

  // OPEN MODAL 2: PEMBAYARAN FLEKSIBEL (PILIHAN SALAH SATU ATAU SEMUA & LEBIH DARI 1 BULAN)
  const handleOpenPaymentModal = (item: typeof billingList[0], initialMode: PaymentSelectionMode = 'all') => {
    setPayingHouse(item.house);
    setPayChoice(initialMode);
    setPayDuesMonths(1);
    setPayDate(new Date().toISOString().slice(0, 10));
    setPayNote('');

    if (initialMode === 'all') {
      setPayDuesSelected(item.remainingDues > 0 || !item.isDuesPaid);
      setPayBaksosSelected(item.baksosFineAmount > 0);
      setPayArrearsSelected(item.previousArrears > 0);
      setPayArrearsAmount(item.previousArrears);
    } else if (initialMode === 'dues_only') {
      setPayDuesSelected(true);
      setPayBaksosSelected(false);
      setPayArrearsSelected(false);
      setPayArrearsAmount(0);
    } else if (initialMode === 'baksos_only') {
      setPayDuesSelected(false);
      setPayBaksosSelected(true);
      setPayArrearsSelected(false);
      setPayArrearsAmount(0);
    } else if (initialMode === 'arrears_only') {
      setPayDuesSelected(false);
      setPayBaksosSelected(false);
      setPayArrearsSelected(true);
      setPayArrearsAmount(item.previousArrears);
    } else {
      setPayDuesSelected(true);
      setPayBaksosSelected(false);
      setPayArrearsSelected(false);
      setPayArrearsAmount(0);
    }
  };

  const handleApplyPaymentMode = (mode: PaymentSelectionMode, item: typeof billingList[0]) => {
    setPayChoice(mode);
    if (mode === 'all') {
      setPayDuesSelected(item.remainingDues > 0 || !item.isDuesPaid);
      setPayBaksosSelected(item.baksosFineAmount > 0);
      setPayArrearsSelected(item.previousArrears > 0);
      setPayArrearsAmount(item.previousArrears);
    } else if (mode === 'dues_only') {
      setPayDuesSelected(true);
      setPayBaksosSelected(false);
      setPayArrearsSelected(false);
      setPayArrearsAmount(0);
    } else if (mode === 'baksos_only') {
      setPayDuesSelected(false);
      setPayBaksosSelected(true);
      setPayArrearsSelected(false);
      setPayArrearsAmount(0);
    } else if (mode === 'arrears_only') {
      setPayDuesSelected(false);
      setPayBaksosSelected(false);
      setPayArrearsSelected(true);
      setPayArrearsAmount(item.previousArrears);
    }
  };

  // EXECUTE PAYMENT (Mendukung Pembayaran Iuran > 1 Bulan & Otomatis Masuk Bulan Berikutnya)
  const handleExecutePayment = (e: React.FormEvent) => {
    e.preventDefault();
    if (!payingHouse) return;

    const billingItem = billingList.find((b) => b.house.id === payingHouse.id);
    if (!billingItem) return;

    const house: ResidentHouse = { ...payingHouse };
    const displayName = house.duesHeadNameOverride || house.headName;
    const houseDesc = billingItem.isVacant ? `(Rumah Kosong - ${displayName})` : `(${displayName})`;
    const targetPeriod = inputMonth.trim() || defaultPeriod;
    let totalCashReceived = 0;

    // 1. Eksekusi Pembayaran Iuran Bulanan jika dipilih -> Masuk ke Rekap Per KK, Kas Utama & Otomatis Lunas Bulan Berikutnya
    if (payDuesSelected) {
      const baseNominal = billingItem.monthlyDuesNominal || defaultNominal;
      const monthsCount = Math.max(1, payDuesMonths);
      const duesTotalAmount = baseNominal * monthsCount;
      totalCashReceived += duesTotalAmount;

      const coveredList = getSubsequentMonthLabels(targetPeriod, monthsCount);
      const isMulti = monthsCount > 1;
      const coveredRangeText = isMulti
        ? `${targetPeriod} - ${coveredList[coveredList.length - 1]} (${monthsCount} Bulan)`
        : targetPeriod;

      house.duesStatus = isMulti ? 'Bayar Lebih' : 'Lunas';
      house.duesPaidAmount = 0;
      house.duesPaidMonths = monthsCount;
      house.duesPrepaidBalance = isMulti ? (monthsCount - 1) * baseNominal : 0;
      house.duesPaidDate = payDate;
      house.duesMonthNote = targetPeriod;

      // Otomatis daftarkan bulan-bulan yang dicakup ke config periode yang tersedia
      if (onCreatePeriod) {
        coveredList.forEach((m) => {
          onCreatePeriod(m, { setActiveCurrentMonth: false, resetNonAdvanceDues: false });
        });
      }

      onAddTransaction({
        date: payDate,
        type: 'masuk',
        pool: 'Kas Utama',
        category: 'Iuran Warga',
        description: isMulti
          ? `Penarikan Iuran Bulanan Lebih dari 1 Bulan (${coveredRangeText}) Blok ${house.blockNumber} ${houseDesc}${
              payNote ? ` - ${payNote}` : ''
            }`
          : `Penarikan Iuran Bulanan (${targetPeriod}) Blok ${house.blockNumber} ${houseDesc}${
              payNote ? ` - ${payNote}` : ''
            }`,
        amount: duesTotalAmount,
      });
    }

    // 2. Eksekusi Pembayaran Denda Baksos jika dipilih -> Reset denda baksos & masuk Kas Utama
    if (payBaksosSelected && billingItem.baksosFineAmount > 0) {
      totalCashReceived += billingItem.baksosFineAmount;

      billingItem.unpaidBaksosList.forEach((agenda) => {
        if (onMarkFinePaid) {
          onMarkFinePaid(agenda.id, house.id, displayName, house.blockNumber);
        }
      });

      house.customBaksosFineAmount = 0;

      if (!onMarkFinePaid) {
        onAddTransaction({
          date: payDate,
          type: 'masuk',
          pool: 'Kas Utama',
          category: 'Denda Baksos',
          description: `Pelunasan Denda Baksos (${billingItem.unpaidBaksosList.length}x) Blok ${house.blockNumber} ${houseDesc}`,
          amount: billingItem.baksosFineAmount,
        });
      }
    }

    // 3. Eksekusi Pembayaran Tunggakan Sebelumnya jika dipilih -> Masuk Kas Utama
    if (payArrearsSelected && payArrearsAmount > 0 && house.previousArrears > 0) {
      const deduct = Math.min(payArrearsAmount, house.previousArrears);
      totalCashReceived += deduct;
      house.previousArrears -= deduct;

      onAddTransaction({
        date: payDate,
        type: 'masuk',
        pool: 'Kas Utama',
        category: 'Pembayaran Tunggakan',
        description: `Pelunasan / Cicilan Tunggakan Lalu Blok ${house.blockNumber} ${houseDesc}${
          house.previousArrearsNote ? ` (${house.previousArrearsNote})` : ''
        }`,
        amount: deduct,
      });

      if (house.previousArrears === 0) {
        house.previousArrearsNote = '';
      }
    }

    onUpdateResident(house);

    if (totalCashReceived > 0) {
      try {
        confetti({ particleCount: 50, spread: 60, origin: { y: 0.65 } });
      } catch {}
    }

    setPayingHouse(null);
  };

  // Helper to remove recorded transactions for a house and period in Buku Kas & Rekap KK
  const removeHouseTransactionsForPeriod = (house: ResidentHouse, targetPeriod: string) => {
    if (!onDeleteTransaction || !transactions || transactions.length === 0) return;
    const blockRegex = new RegExp(`\\b${house.blockNumber.replace('/', '\\/')}\\b`, 'i');
    const targetKey = parseIndonesianMonthYearToKey(targetPeriod);
    const targetPeriodLower = targetPeriod.toLowerCase();

    // Find any transactions belonging to this resident for this target period:
    // 1. Iuran Bulanan
    // 2. Denda Baksos
    // 3. Tunggakan Lalu
    const matchingTxs = transactions.filter((tx) => {
      if (tx.type !== 'masuk') return false;
      if (!blockRegex.test(tx.description)) return false;

      const mKey = getMonthKeyFromDate(tx.date);
      const descLower = tx.description.toLowerCase();

      const isIuran = tx.category === 'Iuran Warga' || descLower.includes('iuran');
      const isDenda = tx.category === 'Denda Baksos' || descLower.includes('denda');
      const isTunggakan = descLower.includes('tunggakan');

      if (!isIuran && !isDenda && !isTunggakan) return false;

      // Match target period, date month key, or if it was a denda/tunggakan payment for this house
      const matchesPeriod =
        descLower.includes(targetPeriodLower) ||
        mKey === targetKey ||
        (isDenda && descLower.includes(house.blockNumber.toLowerCase())) ||
        (isTunggakan && descLower.includes(house.blockNumber.toLowerCase()));

      return matchesPeriod;
    });

    matchingTxs.forEach((tx) => {
      onDeleteTransaction(tx.id);
    });
  };

  // Revert/Batalkan input pembayaran satu KK dan kembalikan ke Belum Bayar
  const handleRevertHouseToUnpaid = (house: ResidentHouse) => {
    const targetPeriod = inputMonth.trim() || defaultPeriod;
    const isVacant = house.occupancy === 'Kosong' || isHouseVacant(house);
    const nominal = isVacant
      ? 0
      : house.customDuesAmount !== undefined
      ? house.customDuesAmount
      : defaultNominal;

    // 1. Otomatis hapus pencatatan transaksi di Rekap KK & Buku Kas (Buku Mutasi)
    removeHouseTransactionsForPeriod(house, targetPeriod);

    // 2. Unmark denda baksos di agenda jika sebelumnya tercatat lunas
    if (onUnmarkFinePaid && baksosAgendas.length > 0) {
      baksosAgendas.forEach((agenda) => {
        if (agenda.finesPaid?.[house.id]) {
          onUnmarkFinePaid(agenda.id, house.id);
        }
      });
    }

    // 3. Kembalikan status penarikan KK ini menjadi Belum Bayar
    onUpdateResident({
      ...house,
      customDuesAmount: nominal,
      duesStatus: 'Belum Bayar',
      duesPaidAmount: 0,
      duesPaidMonths: 0,
      duesPrepaidBalance: 0,
      duesPaidDate: '',
      duesMonthNote: targetPeriod,
    });

    try {
      confetti({ particleCount: 30, spread: 45, origin: { y: 0.7 } });
    } catch {}
  };

  // Toggle quick paid/unpaid status directly in table (1-click)
  const handleQuickToggleStatus = (house: ResidentHouse) => {
    const isCurrentlyPaid = house.duesStatus === 'Lunas' || house.duesStatus === 'Bayar Lebih';
    if (isCurrentlyPaid) {
      // Jika sebelumnya sudah diinput Lunas / Bayar Lebih, kembalikan ke Belum Bayar & otomatis bersihkan data rekap KK
      handleRevertHouseToUnpaid(house);
      return;
    }

    const isVacant = house.occupancy === 'Kosong' || isHouseVacant(house);
    const nextStatus: DuesStatus = 'Lunas';
    const targetPeriod = inputMonth.trim() || defaultPeriod;
    const nominal = isVacant
      ? 0
      : house.customDuesAmount !== undefined
      ? house.customDuesAmount
      : defaultNominal;

    const todayStr = new Date().toISOString().slice(0, 10);
    const displayName = house.duesHeadNameOverride || house.headName;

    onUpdateResident({
      ...house,
      customDuesAmount: nominal,
      duesStatus: nextStatus,
      duesPaidAmount: 0,
      duesPaidMonths: 1,
      duesPrepaidBalance: 0,
      duesPaidDate: todayStr,
      duesMonthNote: targetPeriod,
    });

    try {
      confetti({ particleCount: 35, spread: 50, origin: { y: 0.7 } });
    } catch {}

    onAddTransaction({
      date: todayStr,
      type: 'masuk',
      pool: 'Kas Utama',
      category: 'Iuran Warga',
      description: isVacant
        ? `Penarikan Iuran Bulanan (${targetPeriod}) Warga Blok ${house.blockNumber} (Rumah Kosong - ${displayName})`
        : `Penarikan Iuran Bulanan (${targetPeriod}) Warga Blok ${house.blockNumber} (${displayName})`,
      amount: nominal,
    });
  };

  // Quick batch apply: Mark all occupied houses as paid for inputMonth
  const handleMarkAllOccupiedAsPaid = () => {
    const todayStr = new Date().toISOString().slice(0, 10);
    const targetPeriod = inputMonth.trim() || defaultPeriod;
    const occupiedUnpaid = residents.filter(
      (h) =>
        h.occupancy !== 'Kosong' &&
        !isHouseVacant(h) &&
        h.duesStatus === 'Belum Bayar'
    );

    if (occupiedUnpaid.length === 0) return;

    occupiedUnpaid.forEach((house) => {
      const nom =
        house.customDuesAmount !== undefined ? house.customDuesAmount : defaultNominal;

      onUpdateResident({
        ...house,
        duesStatus: 'Lunas',
        duesPaidAmount: 0,
        duesPaidMonths: 1,
        duesPrepaidBalance: 0,
        duesPaidDate: todayStr,
        duesMonthNote: targetPeriod,
      });

      onAddTransaction({
        date: todayStr,
        type: 'masuk',
        pool: 'Kas Utama',
        category: 'Iuran Warga',
        description: `Penarikan Iuran Bulanan (${targetPeriod}) Warga Blok ${house.blockNumber} (${
          house.duesHeadNameOverride || house.headName
        })`,
        amount: nom,
      });
    });

    try {
      confetti({ particleCount: 75, spread: 85, origin: { y: 0.6 } });
    } catch {}
  };

  // Tagihan yang belum lunas (iuran bulanan, denda baksos, atau tunggakan lalu)
  const unpaidBillingItems = useMemo(() => {
    return billingList.filter((item) => !item.isVacant && item.totalBillRemaining > 0);
  }, [billingList]);

  const totalUnpaidRemainingDues = useMemo(() => {
    return unpaidBillingItems.reduce((acc, curr) => acc + curr.remainingDues, 0);
  }, [unpaidBillingItems]);

  const totalUnpaidBaksosFines = useMemo(() => {
    return unpaidBillingItems.reduce((acc, curr) => acc + curr.baksosFineAmount, 0);
  }, [unpaidBillingItems]);

  const totalUnpaidPrevArrears = useMemo(() => {
    return unpaidBillingItems.reduce((acc, curr) => acc + curr.previousArrears, 0);
  }, [unpaidBillingItems]);

  const totalAllUnpaidRemaining = useMemo(() => {
    return totalUnpaidRemainingDues + totalUnpaidBaksosFines + totalUnpaidPrevArrears;
  }, [totalUnpaidRemainingDues, totalUnpaidBaksosFines, totalUnpaidPrevArrears]);

  // Aksi Utama: Clear Belum Bayar (Ubah / Reset status seluruh warga menjadi 'Belum Bayar' untuk bulan ini & otomatis hapus transaksi di Rekap KK)
  const handleExecuteResetAllToUnpaid = () => {
    const targetPeriod = inputMonth.trim() || defaultPeriod;

    residents.forEach((house) => {
      // Otomatis hapus mutasi/transaksi di Rekap KK & Buku Kas untuk periode ini
      removeHouseTransactionsForPeriod(house, targetPeriod);

      // Unmark denda baksos di agenda jika ada
      if (onUnmarkFinePaid && baksosAgendas.length > 0) {
        baksosAgendas.forEach((agenda) => {
          if (agenda.finesPaid?.[house.id]) {
            onUnmarkFinePaid(agenda.id, house.id);
          }
        });
      }

      onUpdateResident({
        ...house,
        duesStatus: 'Belum Bayar',
        duesPaidAmount: 0,
        duesPaidMonths: 0,
        duesPrepaidBalance: 0,
        duesPaidDate: '',
        duesMonthNote: targetPeriod,
      });
    });

    try {
      confetti({ particleCount: 60, spread: 70, origin: { y: 0.6 } });
    } catch {}
    setIsClearAllModalOpen(false);
  };

  // Aksi Alternatif 1: Lunaskan seluruh tagihan belum bayar (catat ke Kas Utama & Rekap KK)
  const handleExecuteClearAllPaid = () => {
    if (unpaidBillingItems.length === 0) return;
    const todayStr = new Date().toISOString().slice(0, 10);
    const targetPeriod = inputMonth.trim() || defaultPeriod;

    unpaidBillingItems.forEach((item) => {
      const house: ResidentHouse = { ...item.house };
      const displayName = house.duesHeadNameOverride || house.headName;
      const houseDesc = `(${displayName})`;

      // 1. Lunaskan Iuran Bulanan jika belum
      if (item.remainingDues > 0) {
        house.duesStatus = 'Lunas';
        house.duesPaidAmount = 0;
        house.duesPaidMonths = 1;
        house.duesPrepaidBalance = 0;
        house.duesPaidDate = todayStr;
        house.duesMonthNote = targetPeriod;

        onAddTransaction({
          date: todayStr,
          type: 'masuk',
          pool: 'Kas Utama',
          category: 'Iuran Warga',
          description: `Penarikan Iuran Bulanan (${targetPeriod}) Blok ${house.blockNumber} ${houseDesc}`,
          amount: item.remainingDues,
        });
      }

      // 2. Lunaskan Denda Baksos jika ada
      if (item.baksosFineAmount > 0) {
        item.unpaidBaksosList.forEach((agenda) => {
          if (onMarkFinePaid) {
            onMarkFinePaid(agenda.id, house.id, displayName, house.blockNumber);
          }
        });
        house.customBaksosFineAmount = 0;

        if (!onMarkFinePaid) {
          onAddTransaction({
            date: todayStr,
            type: 'masuk',
            pool: 'Kas Utama',
            category: 'Denda Baksos',
            description: `Pelunasan Denda Baksos Blok ${house.blockNumber} ${houseDesc}`,
            amount: item.baksosFineAmount,
          });
        }
      }

      // 3. Lunaskan Tunggakan Lalu jika ada
      if (house.previousArrears > 0) {
        const deduct = house.previousArrears;
        house.previousArrears = 0;
        house.previousArrearsNote = '';

        onAddTransaction({
          date: todayStr,
          type: 'masuk',
          pool: 'Kas Utama',
          category: 'Iuran Warga',
          description: `Pelunasan Tunggakan Lalu Blok ${house.blockNumber} ${houseDesc}`,
          amount: deduct,
        });
      }

      onUpdateResident(house);
    });

    try {
      confetti({ particleCount: 80, spread: 90, origin: { y: 0.6 } });
    } catch {}
    setIsClearAllModalOpen(false);
  };

  // Aksi 2: Kosongkan / Bebaskan Tagihan (Nolkan tagihan tanpa mutasi kas)
  const handleExecuteClearZeroOut = () => {
    if (unpaidBillingItems.length === 0) return;
    const targetPeriod = inputMonth.trim() || defaultPeriod;

    unpaidBillingItems.forEach((item) => {
      const house: ResidentHouse = { ...item.house };

      house.duesStatus = 'Lunas';
      house.customDuesAmount = 0;
      house.customBaksosFineAmount = 0;
      house.previousArrears = 0;
      house.previousArrearsNote = '';
      house.duesMonthNote = targetPeriod;

      onUpdateResident(house);
    });

    try {
      confetti({ particleCount: 50, spread: 60, origin: { y: 0.6 } });
    } catch {}
    setIsClearAllModalOpen(false);
  };

  // Filtered residents list
  const filteredBillingList = useMemo(() => {
    return billingList.filter((item) => {
      if (filterOccupancy === 'kosong' && !item.isVacant) return false;
      if (filterOccupancy === 'belum_ditempati' && !item.isUnoccupied) return false;
      if (filterOccupancy === 'ditempati' && (item.isVacant || item.isUnoccupied)) return false;

      if (filterStatus === 'lunas' && item.totalBillRemaining > 0) return false;
      if (filterStatus === 'belum' && (item.totalBillRemaining === 0 || item.isVacant)) return false;
      if (filterStatus === 'iuran_belum' && item.remainingDues === 0) return false;
      if (filterStatus === 'baksos_belum' && item.baksosFineAmount === 0) return false;
      if (filterStatus === 'tunggakan_belum' && item.previousArrears === 0) return false;

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchBlock = item.house.blockNumber.toLowerCase().includes(q);
        const matchName = item.house.headName.toLowerCase().includes(q);
        const matchDisplay = item.displayName.toLowerCase().includes(q);
        if (!matchBlock && !matchName && !matchDisplay) return false;
      }

      return true;
    });
  }, [billingList, filterOccupancy, filterStatus, searchQuery]);

  const payingBillingItem = payingHouse
    ? billingList.find((b) => b.house.id === payingHouse.id)
    : null;

  // Calculate live total payment in modal (termasuk perkalian bayar lebih dari 1 bulan)
  const calculatedModalTotalPayment = useMemo(() => {
    if (!payingBillingItem) return 0;
    let sum = 0;
    if (payDuesSelected) {
      const baseNominal = payingBillingItem.monthlyDuesNominal || defaultNominal;
      sum += Math.max(1, payDuesMonths) * baseNominal;
    }
    if (payBaksosSelected) sum += payingBillingItem.baksosFineAmount;
    if (payArrearsSelected) sum += Math.min(payArrearsAmount, payingBillingItem.previousArrears);
    return sum;
  }, [payingBillingItem, payDuesSelected, payDuesMonths, payBaksosSelected, payArrearsSelected, payArrearsAmount, defaultNominal]);

  // HITUNG DATA ROLLOVER SIMPAN PENARIKAN & PINDAH BULAN BERIKUTNYA
  const activePeriod = inputMonth.trim() || defaultPeriod;
  const nextPeriodLabel = useMemo(() => {
    return getSubsequentMonthLabels(activePeriod, 2)[1] || 'Bulan Berikutnya';
  }, [activePeriod]);

  const paidBillingHouses = useMemo(() => {
    return billingList.filter((b) => !b.isVacant && b.isDuesPaid);
  }, [billingList]);

  const unpaidBillingHouses = useMemo(() => {
    return billingList.filter((b) => !b.isVacant && !b.isDuesPaid);
  }, [billingList]);

  const unpaidDuesAmountTotal = useMemo(() => {
    return unpaidBillingHouses.reduce(
      (sum, b) => sum + (b.remainingDues > 0 ? b.remainingDues : b.monthlyDuesNominal),
      0
    );
  }, [unpaidBillingHouses]);

  const handleExecuteSaveAndRollover = () => {
    const todayStr = new Date().toISOString().slice(0, 10);
    const targetPeriod = activePeriod;
    const missingTransactions: Omit<CashTransaction, 'id'>[] = [];

    const updatedResidents: ResidentHouse[] = billingList.map((item) => {
      const house: ResidentHouse = { ...item.house };
      const displayName = house.duesHeadNameOverride || house.headName;
      const isVacant = item.isVacant;

      if (isVacant) {
        return {
          ...house,
          duesStatus: 'Belum Bayar',
          duesPaidAmount: 0,
          duesPaidMonths: 0,
          duesPrepaidBalance: 0,
          duesMonthNote: nextPeriodLabel,
        };
      }

      // 1. Warga yang SUDAH LUNAS untuk periode ini -> Tetap tercatat di Rekap KK
      if (item.isDuesPaid) {
        // Cek jika belum ada mutasi kas untuk warga ini di periode ini, catat otomatis
        const blockRegex = new RegExp(`\\b${house.blockNumber.replace('/', '\\/')}\\b`, 'i');
        const hasExistingTx = transactions.some(
          (tx) => tx.type === 'masuk' && blockRegex.test(tx.description) && tx.description.includes(targetPeriod)
        );
        if (!hasExistingTx) {
          missingTransactions.push({
            date: house.duesPaidDate || todayStr,
            type: 'masuk',
            pool: 'Kas Utama',
            category: 'Iuran Warga',
            description: `Penarikan Iuran Bulanan (${targetPeriod}) Blok ${house.blockNumber} (${displayName})`,
            amount: item.monthlyDuesNominal,
          });
        }

        // Rollover ke bulan berikutnya: cek apakah warga bayar di muka (> 1 bulan)
        const currentPaidMonths = item.paidMonthsCount || 1;
        if (currentPaidMonths > 1) {
          const nextMonthsCount = currentPaidMonths - 1;
          const nextPrepaid = Math.max(0, (house.duesPrepaidBalance || 0) - item.monthlyDuesNominal);
          return {
            ...house,
            duesStatus: nextMonthsCount > 1 ? 'Bayar Lebih' : 'Lunas',
            duesPaidMonths: nextMonthsCount,
            duesPrepaidBalance: nextPrepaid,
            duesMonthNote: nextPeriodLabel,
          };
        } else {
          // Hanya lunas 1 bulan untuk periode ini -> kembali Belum Bayar untuk bulan berikutnya
          return {
            ...house,
            duesStatus: 'Belum Bayar',
            duesPaidAmount: 0,
            duesPaidMonths: 0,
            duesPrepaidBalance: 0,
            duesPaidDate: '',
            duesMonthNote: nextPeriodLabel,
          };
        }
      }

      // 2. Warga yang BELUM BAYAR untuk periode ini -> Tagihan iuran otomatis dialihkan ke Tunggakan (previousArrears)
      const unpaidAmount = item.remainingDues > 0 ? item.remainingDues : item.monthlyDuesNominal;
      const existingArrears = house.previousArrears || 0;
      const newTotalArrears = existingArrears + unpaidAmount;

      const existingNote = (house.previousArrearsNote || '').trim();
      let updatedNote = existingNote;
      if (!existingNote) {
        updatedNote = `Tunggakan ${targetPeriod}`;
      } else if (!existingNote.includes(targetPeriod)) {
        updatedNote = `${existingNote}, ${targetPeriod}`;
      }

      return {
        ...house,
        previousArrears: newTotalArrears,
        previousArrearsNote: updatedNote,
        duesStatus: 'Belum Bayar',
        duesPaidAmount: 0,
        duesPaidMonths: 0,
        duesPrepaidBalance: 0,
        duesPaidDate: '',
        duesMonthNote: nextPeriodLabel,
      };
    });

    if (onRolloverBillingMonth) {
      onRolloverBillingMonth(targetPeriod, nextPeriodLabel, updatedResidents, missingTransactions);
    } else if (onBatchImportDues) {
      onBatchImportDues(updatedResidents, missingTransactions, nextPeriodLabel, true);
    } else {
      updatedResidents.forEach((h) => onUpdateResident(h));
      missingTransactions.forEach((t) => onAddTransaction(t));
      if (onCreatePeriod) {
        onCreatePeriod(nextPeriodLabel, { setActiveCurrentMonth: true, resetNonAdvanceDues: false });
      }
    }

    setInputMonth(nextPeriodLabel);
    setIsRolloverModalOpen(false);

    try {
      confetti({ particleCount: 90, spread: 85, origin: { y: 0.6 } });
    } catch {}
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* HEADER BANNER: 1. Judul di atas -> 2. Deskripsi di bawahnya -> 3. Menu-menu lainnya di bawahnya lagi */}
      <div className="bg-gradient-to-r from-emerald-800 via-teal-800 to-indigo-900 text-white rounded-3xl p-5 sm:p-7 shadow-lg border-b-4 border-emerald-400 space-y-4">
        {/* 1. Judul Halaman di Bagian Atas */}
        <div className="flex items-center gap-2.5 flex-wrap">
          <span className="p-2.5 rounded-2xl bg-white/15 border border-white/20 text-amber-300 backdrop-blur-xs">
            <Banknote className="w-5 h-5" />
          </span>
          <h2 className="text-xl sm:text-2xl font-black text-white tracking-tight">
            Input Data Penarikan Keuangan dan Bakti Sosial
          </h2>
          <span className="px-3 py-1 rounded-full text-xs font-black bg-amber-400 text-slate-950 shadow-sm uppercase tracking-wider">
            Khusus Login Pengurus
          </span>
        </div>

        {/* 2. Deskripsi Halaman di Bawahnya */}
        <p className="text-xs sm:text-sm text-emerald-100 max-w-3xl leading-relaxed">
          Pengurus dapat mengedit <strong>Kepala Keluarga</strong>, <strong>Status Rumah</strong>, <strong>Jumlah Iuran</strong>, <strong>Denda Baksos</strong>, dan <strong>Tunggakan Lalu</strong>. Data dari input penarikan ini otomatis tersimpan ke <strong>Tabel Rekap Pembayaran Iuran Per KK</strong> dengan pewarnaan sel/baris otomatis (hijau seluruhnya untuk lunas, merah seluruhnya untuk menunggak, abu-abu netral untuk rumah belum ditempati/kosong, dan biru muda seluruhnya untuk bayar &gt; 1 bulan).
        </p>

        {/* 3. Menu-menu Lainnya di Bawahnya Lagi */}
        <div className="pt-2 border-t border-emerald-700/60 flex flex-wrap items-center gap-2.5">
          {/* TOMBOL SIMPAN UTAMA: Simpan Data Penarikan & Pindah ke Bulan Berikutnya */}
          <button
            type="button"
            onClick={() => setIsRolloverModalOpen(true)}
            className="flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-gradient-to-r from-emerald-400 via-teal-300 to-amber-300 hover:from-emerald-300 hover:to-amber-200 text-slate-950 font-black text-xs shadow-lg hover:shadow-xl transition-all cursor-pointer whitespace-nowrap ring-2 ring-white/60"
            title="Simpan data penarikan bulan ini, alihkan yang belum bayar ke Tunggakan, catat yang lunas ke Rekap KK, dan pindah ke bulan berikutnya"
          >
            <Save className="w-4 h-4 text-emerald-950" />
            <span>Simpan Data Penarikan</span>
            <span className="px-2 py-0.5 rounded-full bg-slate-950 text-emerald-300 font-mono text-[10px] font-black flex items-center gap-1">
              <span>Lanjut</span>
              <ArrowRight className="w-3 h-3 inline" />
            </span>
          </button>

          <button
            type="button"
            onClick={() => setIsClearAllModalOpen(true)}
            className="flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs shadow-md hover:shadow-lg transition-all cursor-pointer whitespace-nowrap ring-2 ring-amber-300/60"
            title="Ubah semua status warga menjadi Belum Bayar untuk periode penarikan bulan ini"
          >
            <RotateCcw className="w-4 h-4 text-slate-950" />
            <span>Clear (Semua Belum Bayar)</span>
            <span className="px-2 py-0.5 rounded-full bg-slate-950 text-amber-300 font-mono text-[10px] font-black">
              {residents.length} KK
            </span>
          </button>

          <button
            type="button"
            onClick={() => downloadBillingExcelTemplate(residents, inputMonth, defaultNominal, baksosAgendas)}
            className="flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-white hover:bg-slate-100 text-slate-900 font-extrabold text-xs shadow-md transition-all cursor-pointer whitespace-nowrap"
            title="Download Template Excel Penarikan Keuangan Lengkap dengan 3 Komponen"
          >
            <Download className="w-4 h-4 text-emerald-700" />
            <span>Download Template Excel</span>
          </button>

          <button
            type="button"
            onClick={() => setIsUploadModalOpen(true)}
            className="flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-amber-400 hover:bg-amber-300 text-slate-950 font-black text-xs shadow-md transition-all cursor-pointer whitespace-nowrap"
            title="Upload Excel Penarikan Keuangan untuk update massal"
          >
            <Upload className="w-4 h-4 text-slate-950" />
            <span>Upload Excel Penarikan</span>
          </button>
        </div>
      </div>

      {/* TOOLBAR: INPUT BULAN PENARIKAN & PENCARIAN (Tanpa Rekap Periode) */}
      <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-2xs flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2.5">
          {/* Inputkan Bulan: Cukup inputkan bulan penarikan di sini */}
          <div className="flex items-center gap-2 text-xs font-bold text-slate-800 bg-emerald-50 px-3.5 py-2 rounded-xl border-2 border-emerald-300 shadow-2xs">
            <Calendar className="w-4 h-4 text-emerald-700 shrink-0" />
            <span className="whitespace-nowrap font-extrabold text-emerald-950">Inputkan Bulan:</span>
            <input
              type="text"
              list="list-bulan-tersedia"
              value={inputMonth}
              onChange={(e) => setInputMonth(e.target.value)}
              placeholder="Contoh: Oktober 2026"
              className="px-2.5 py-1 text-xs font-black bg-white border border-emerald-400 rounded-lg text-emerald-950 focus:outline-none focus:ring-2 focus:ring-emerald-500 shadow-inner w-36 sm:w-48"
              title="Ketikkan atau pilih nama bulan penarikan iuran"
            />
            <datalist id="list-bulan-tersedia">
              {availablePeriods.map((p) => (
                <option key={p} value={p} />
              ))}
            </datalist>
          </div>
        </div>
      </div>

      {/* TABEL RINCIAN 3 KOMPONEN PENARIKAN KEUANGAN */}
      <div className="space-y-3">
        {/* Keterangan Warna Otomatis Sama Persis Dengan Rekap Iuran Per KK */}
        <div className="flex flex-wrap items-center gap-2.5 sm:gap-3 text-xs bg-white/95 rounded-2xl p-3 sm:px-4 border border-slate-200/90 shadow-2xs">
          <span className="font-bold text-slate-700 text-xs">Keterangan Warna Otomatis:</span>
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-neutral-950 text-white font-bold border border-neutral-800 text-[11px] shadow-2xs">
            <span className="w-2.5 h-2.5 rounded-full bg-neutral-400"></span>
            Rumah Kosong (Hitam / Bebas Iuran)
          </span>
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-sky-100 text-sky-950 font-bold border border-sky-300 text-[11px] shadow-2xs">
            <span className="w-2.5 h-2.5 rounded-full bg-sky-500"></span>
            Bayar Lebih / Lunas di Muka (Biru Muda)
          </span>
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-emerald-100 text-emerald-950 font-bold border border-emerald-300 text-[11px] shadow-2xs">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500"></span>
            Lunas (Hijau Muda)
          </span>
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-rose-100 text-rose-950 font-bold border border-rose-300 text-[11px] shadow-2xs">
            <span className="w-2.5 h-2.5 rounded-full bg-rose-500"></span>
            Belum Bayar / Menunggak (Merah Muda)
          </span>
        </div>

        <div className="bg-white rounded-3xl border border-slate-300/90 shadow-md overflow-hidden">
          <div className="p-4 sm:p-5 bg-gradient-to-r from-emerald-600 via-teal-600 to-cyan-600 text-white flex flex-col sm:flex-row sm:items-center justify-between gap-2 shadow-xs">
            <div className="flex items-center gap-2">
              <FileSpreadsheet className="w-5 h-5 text-amber-300" />
              <h3 className="font-extrabold text-sm sm:text-base text-white">
                Tabel Rincian 3 Komponen Penarikan Keuangan ({filteredBillingList.length} Kavling)
              </h3>
            </div>
            <div className="flex items-center gap-2 text-xs font-medium text-emerald-50">
              <span>Bulan Ditagihkan: <strong className="text-amber-200 font-bold">{inputMonth}</strong></span>
              <span>•</span>
              <span className="text-emerald-100 font-bold">Bisa Edit Iuran, Baksos & Tunggakan</span>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse border border-slate-300 whitespace-nowrap">
              <thead>
                <tr className="bg-slate-100 text-slate-800 font-extrabold border-b border-slate-300">
                  <th className="py-3 px-2 text-center w-10 border border-slate-300 bg-slate-100 text-slate-800">No</th>
                  <th className="py-3 px-2.5 text-center w-24 border border-slate-300 bg-slate-100 text-slate-800">No Blok</th>
                  <th className="py-3 px-3 min-w-[200px] border border-slate-300 bg-slate-100 text-slate-800">
                    Kepala Keluarga / Penanggung Jawab
                    <span className="block text-[10px] text-slate-500 font-normal">
                      (Bisa diedit khusus penarikan)
                    </span>
                  </th>
                  <th className="py-3 px-2.5 text-center border border-slate-300 bg-slate-100 text-slate-800">Status Rumah</th>
                  <th className="py-3 px-3 text-right border border-slate-300 bg-emerald-100/80 text-emerald-950">
                    <div className="flex items-center justify-end gap-1">
                      <span>1. Iuran Bulanan</span>
                      <Edit2 className="w-3 h-3 text-emerald-700" />
                    </div>
                    <span className="block text-[10px] text-emerald-800 font-normal">
                      (Kosong = Rp 0, Belum Ditempati = Edit)
                    </span>
                  </th>
                  <th className="py-3 px-3 text-right border border-slate-300 bg-purple-100/80 text-purple-950">
                    <div className="flex items-center justify-end gap-1">
                      <span>2. Tunggakan Lalu</span>
                      <Edit2 className="w-3 h-3 text-purple-700" />
                    </div>
                    <span className="block text-[10px] text-purple-800 font-normal">
                      (Bisa diedit nominalnya)
                    </span>
                  </th>
                  <th className="py-3 px-3 text-right border border-slate-300 bg-amber-100/80 text-amber-950">
                    <div className="flex items-center justify-end gap-1">
                      <span>3. Denda Baksos</span>
                      <Edit2 className="w-3 h-3 text-amber-700" />
                    </div>
                    <span className="block text-[10px] text-amber-800 font-normal">
                      (Bisa diedit nominalnya)
                    </span>
                  </th>
                  <th className="py-3 px-3 text-right border border-slate-300 bg-rose-100/80 text-rose-950 font-black">
                    Total Tagihan
                  </th>
                  <th className="py-3 px-3 text-center min-w-[240px] border border-slate-300 bg-slate-100 text-slate-800">
                    Pilihan Pembayaran & Aksi
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-300">
                {filteredBillingList.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="py-12 text-center text-slate-400 text-xs italic border border-slate-300">
                      Tidak ada data kavling rumah yang cocok dengan filter pencarian.
                    </td>
                  </tr>
                ) : (
                  filteredBillingList.map((item, idx) => {
                    const {
                      house,
                      displayName,
                      isVacant,
                      isUnoccupied,
                      monthlyDuesNominal,
                      isDuesPaid,
                      remainingDues,
                      isAdvancePaidForInputMonth,
                      paidMonthsCount,
                      previousArrears,
                      previousArrearsNote,
                      baksosFineAmount,
                      unpaidBaksosList,
                      totalBillRemaining,
                    } = item;

                    const isAllPaid = totalBillRemaining === 0;

                    // Kriteria pewarnaan otomatis sama persis dengan Rekap Iuran Per KK:
                    // 1. Rumah kosong murni (tanpa pembayaran) ATAU belum ditempati tanpa pembayaran -> Hitam pekat
                    // 2. Bayar Lebih dari 1 bulan atau Lunas di Muka -> Biru Muda
                    // 3. Lunas (sudah bayar 1 bulan / semua komponen lunas) -> Hijau Muda
                    // 4. Belum Bayar / Menunggak -> Merah Muda
                    const isRumahKosongHitam = (isVacant && !isDuesPaid) || (isUnoccupied && !isDuesPaid);

                    const isBayarLebih =
                      !isRumahKosongHitam &&
                      (isAdvancePaidForInputMonth ||
                       paidMonthsCount > 1 ||
                       house.duesStatus === 'Bayar Lebih' ||
                       (house.duesPaidMonths || 0) > 1);

                    const isSudahBayar =
                      !isRumahKosongHitam &&
                      !isBayarLebih &&
                      (isDuesPaid || house.duesStatus === 'Lunas' || (house.duesPaidAmount || 0) > 0 || isAllPaid);

                    const rowCellClass = isRumahKosongHitam
                      ? 'bg-black text-white border-neutral-800 font-medium'
                      : isBayarLebih
                      ? 'bg-sky-50 text-sky-950 border-sky-300 font-medium'
                      : isSudahBayar
                      ? 'bg-emerald-50 text-emerald-950 border-emerald-300 font-medium'
                      : 'bg-rose-50 text-rose-950 border-rose-300 font-medium';

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
                        <td className={`py-3 px-2 text-center font-mono border ${rowCellClass} ${isRumahKosongHitam ? 'text-slate-300' : 'text-slate-600'}`}>
                          {idx + 1}
                        </td>

                        {/* 2. No Blok */}
                        <td className={`py-3 px-2.5 text-center border ${rowCellClass}`}>
                          <span
                            className={`font-mono font-bold text-xs px-2.5 py-1 rounded-xl shadow-2xs border ${
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

                        {/* 3. Kepala Keluarga (Bisa diedit khusus penarikan) */}
                        <td className={`py-3 px-3 border ${rowCellClass}`}>
                          <div className="flex items-center justify-between gap-2">
                            <div>
                              <div
                                className={`font-extrabold text-xs sm:text-sm flex items-center gap-1.5 ${
                                  isRumahKosongHitam
                                    ? 'text-white'
                                    : isBayarLebih
                                    ? 'text-sky-950'
                                    : isSudahBayar
                                    ? 'text-emerald-950'
                                    : 'text-rose-950'
                                }`}
                              >
                                <span>{displayName}</span>
                                {house.duesHeadNameOverride && (
                                  <span
                                    className={`px-1.5 py-0.2 rounded text-[10px] font-bold border ${
                                      isRumahKosongHitam
                                        ? 'bg-neutral-800 text-amber-300 border-neutral-700'
                                        : 'bg-amber-100 text-amber-800 border-amber-300'
                                    }`}
                                  >
                                    Disesuaikan
                                  </span>
                                )}
                              </div>
                            </div>
                            <button
                              type="button"
                              onClick={() => handleOpenEdit(house)}
                              className={`p-1 rounded transition-colors cursor-pointer ${
                                isRumahKosongHitam
                                  ? 'text-slate-400 hover:text-white hover:bg-neutral-800'
                                  : 'text-slate-500 hover:text-emerald-700 hover:bg-emerald-100/60'
                              }`}
                              title="Edit nama penanggung jawab atau 3 komponen keuangan"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>

                        {/* 4. Status Rumah */}
                        <td className={`py-3 px-2.5 text-center border ${rowCellClass}`}>
                          <span
                            className={`inline-block px-2 py-0.5 rounded-md text-[10px] font-bold border ${
                              isRumahKosongHitam
                                ? 'bg-neutral-900 text-slate-300 border-neutral-700'
                                : isVacant
                                ? 'bg-slate-200 text-slate-700 border-slate-300'
                                : isUnoccupied
                                ? 'bg-amber-100 text-amber-900 border-amber-300'
                                : isBayarLebih
                                ? 'bg-sky-100 text-sky-950 border-sky-300'
                                : isSudahBayar
                                ? 'bg-emerald-100 text-emerald-950 border-emerald-300'
                                : 'bg-rose-100 text-rose-950 border-rose-300'
                            }`}
                          >
                            {house.occupancy}
                          </span>
                        </td>

                        {/* 5. 1. IURAN BULANAN (Bisa diedit) */}
                        <td className={`py-3 px-3 text-right font-mono border ${rowCellClass}`}>
                          {isRumahKosongHitam ? (
                            <div className="flex items-center justify-end gap-1">
                              <span className="text-slate-400 italic text-[11px]">Rp 0 (Bebas)</span>
                              <button
                                type="button"
                                onClick={() => handleOpenEdit(house)}
                                className="p-0.5 text-slate-400 hover:text-white rounded cursor-pointer"
                                title="Edit Jumlah Iuran Bulanan"
                              >
                                <Edit2 className="w-2.5 h-2.5" />
                              </button>
                            </div>
                          ) : (
                            <div>
                              <div className="flex items-center justify-end gap-1">
                                <span
                                  className={`font-bold ${
                                    isBayarLebih
                                      ? 'text-sky-900'
                                      : isSudahBayar
                                      ? 'text-emerald-800'
                                      : 'text-rose-950'
                                  }`}
                                >
                                  {formatRupiah(monthlyDuesNominal)}
                                </span>
                                <button
                                  type="button"
                                  onClick={() => handleOpenEdit(house)}
                                  className={`p-0.5 rounded cursor-pointer ${
                                    isBayarLebih
                                      ? 'text-sky-700 hover:text-sky-950'
                                      : isSudahBayar
                                      ? 'text-emerald-700 hover:text-emerald-950'
                                      : 'text-rose-700 hover:text-rose-950'
                                  }`}
                                  title="Edit Jumlah Iuran Bulanan"
                                >
                                  <Edit2 className="w-2.5 h-2.5" />
                                </button>
                              </div>
                              <div className="mt-0.5">
                                {isDuesPaid ? (
                                  <button
                                    type="button"
                                    onClick={() => handleQuickToggleStatus(house)}
                                    className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold cursor-pointer transition-all hover:scale-105 border ${
                                      isAdvancePaidForInputMonth
                                        ? 'bg-sky-200 text-sky-950 border-sky-400 hover:bg-sky-300'
                                        : paidMonthsCount > 1
                                        ? 'bg-sky-200 text-sky-950 border-sky-400 hover:bg-sky-300'
                                        : 'bg-emerald-200 text-emerald-950 border-emerald-400 hover:bg-emerald-300'
                                    }`}
                                    title="Klik untuk ubah kembali status menjadi Belum Bayar (Otomatis bersihkan data di Rekap KK & Buku Kas)"
                                  >
                                    {isAdvancePaidForInputMonth ? (
                                      <>
                                        <span>✓ Lunas di Muka</span>
                                        <span className="text-[9px] font-normal text-sky-800">(Otomatis)</span>
                                      </>
                                    ) : paidMonthsCount > 1 ? (
                                      <span>✓ Lunas ({paidMonthsCount} Bln)</span>
                                    ) : (
                                      <span>✓ Lunas (Klik Batal)</span>
                                    )}
                                  </button>
                                ) : (
                                  <button
                                    type="button"
                                    onClick={() => handleQuickToggleStatus(house)}
                                    className="inline-block px-1.5 py-0.5 rounded text-[10px] bg-rose-200 text-rose-950 border border-rose-400 font-bold hover:bg-rose-300 cursor-pointer transition-all hover:scale-105"
                                    title="Klik untuk tandai Lunas 1 bulan ini"
                                  >
                                    Belum Bayar (Klik Lunas)
                                  </button>
                                )}
                              </div>
                            </div>
                          )}
                        </td>

                        {/* 6. 2. TUNGGAKAN LALU (Bisa diedit) */}
                        <td className={`py-3 px-3 text-right font-mono border ${rowCellClass}`}>
                          <div className="flex items-center justify-end gap-1">
                            <span
                              className={
                                previousArrears > 0
                                  ? isRumahKosongHitam
                                    ? 'font-bold text-amber-300'
                                    : 'font-bold text-purple-900'
                                  : isRumahKosongHitam
                                  ? 'text-neutral-500 font-sans text-[11px]'
                                  : 'text-slate-400 font-sans text-[11px]'
                              }
                            >
                              {previousArrears > 0 ? formatRupiah(previousArrears) : '-'}
                            </span>
                            <button
                              type="button"
                              onClick={() => handleOpenEdit(house)}
                              className={`p-0.5 rounded cursor-pointer ${
                                isRumahKosongHitam
                                  ? 'text-slate-400 hover:text-white'
                                  : 'text-slate-400 hover:text-purple-700'
                              }`}
                              title="Edit Tunggakan Sebelumnya & Keterangannya"
                            >
                              <Edit2 className="w-2.5 h-2.5" />
                            </button>
                          </div>
                          {previousArrearsNote && (
                            <span
                              className={`block text-[10px] font-sans truncate max-w-[140px] text-right ${
                                isRumahKosongHitam ? 'text-slate-400' : 'text-slate-500'
                              }`}
                              title={previousArrearsNote}
                            >
                              {previousArrearsNote}
                            </span>
                          )}
                        </td>

                        {/* 7. 3. DENDA BAKSOS (Bisa diedit) */}
                        <td className={`py-3 px-3 text-right font-mono border ${rowCellClass}`}>
                          <div className="flex items-center justify-end gap-1">
                            <span
                              className={
                                baksosFineAmount > 0
                                  ? isRumahKosongHitam
                                    ? 'font-bold text-rose-400'
                                    : 'font-bold text-amber-900'
                                  : isRumahKosongHitam
                                  ? 'text-neutral-500 font-sans text-[11px]'
                                  : 'text-slate-400 font-sans text-[11px]'
                              }
                            >
                              {baksosFineAmount > 0 ? formatRupiah(baksosFineAmount) : '-'}
                            </span>
                            <button
                              type="button"
                              onClick={() => handleOpenEdit(house)}
                              className={`p-0.5 rounded cursor-pointer ${
                                isRumahKosongHitam
                                  ? 'text-slate-400 hover:text-white'
                                  : 'text-slate-400 hover:text-amber-700'
                              }`}
                              title="Edit Denda Bakti Sosial"
                            >
                              <Edit2 className="w-2.5 h-2.5" />
                            </button>
                          </div>
                          {baksosFineAmount > 0 && unpaidBaksosList.length > 0 && (
                            <span
                              className={`block text-[10px] font-sans font-medium text-right ${
                                isRumahKosongHitam ? 'text-rose-300' : 'text-amber-700'
                              }`}
                            >
                              ({unpaidBaksosList.length}x Absen)
                            </span>
                          )}
                        </td>

                        {/* 8. TOTAL TAGIHAN */}
                        <td className={`py-3 px-3 text-right font-mono font-black text-sm border tabular-nums ${rowCellClass}`}>
                          {totalBillRemaining > 0 ? (
                            <span className={isRumahKosongHitam ? 'text-rose-400' : 'text-rose-700'}>
                              {formatRupiah(totalBillRemaining)}
                            </span>
                          ) : (
                            <span
                              className={`text-xs ${
                                isRumahKosongHitam
                                  ? 'text-slate-300'
                                  : isBayarLebih
                                  ? 'text-sky-900'
                                  : 'text-emerald-800'
                              }`}
                            >
                              {isRumahKosongHitam ? 'Rp 0' : 'Rp 0 (Lunas)'}
                            </span>
                          )}
                        </td>

                        {/* 9. PILIHAN PEMBAYARAN & AKSI */}
                        <td className={`py-3 px-3 text-center border ${rowCellClass}`}>
                          <div className="flex flex-wrap items-center justify-center gap-1">
                            {isAllPaid ? (
                              <div className="flex items-center gap-1">
                                <span
                                  className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-xl text-[11px] font-bold border ${
                                    isRumahKosongHitam
                                      ? 'bg-neutral-900 text-slate-300 border-neutral-700'
                                      : isBayarLebih
                                      ? 'bg-sky-200 text-sky-950 border-sky-400'
                                      : 'bg-emerald-200 text-emerald-950 border-emerald-400'
                                  }`}
                                >
                                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                                  <span>
                                    {isRumahKosongHitam
                                      ? 'Bebas Tagihan'
                                      : item.isAdvancePaidForInputMonth
                                      ? 'Lunas di Muka'
                                      : 'Semua Lunas'}
                                  </span>
                                </span>
                                {!isRumahKosongHitam && (
                                  <button
                                    type="button"
                                    onClick={() => handleRevertHouseToUnpaid(house)}
                                    className="px-2 py-1 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-lg text-[10px] font-bold cursor-pointer flex items-center gap-1 shadow-2xs"
                                    title="Batalkan input pembayaran KK ini & otomatis hapus dari Rekap KK dan Buku Kas"
                                  >
                                    <RotateCcw className="w-3 h-3 text-rose-600" />
                                    <span>Batal Bayar</span>
                                  </button>
                                )}
                                <button
                                  type="button"
                                  onClick={() => handleOpenPaymentModal(item, 'custom')}
                                  className={`px-2 py-1 rounded-lg text-[10px] font-bold cursor-pointer border shadow-2xs ${
                                    isRumahKosongHitam
                                      ? 'bg-neutral-800 hover:bg-neutral-700 text-white border-neutral-600'
                                      : 'bg-white hover:bg-emerald-50 text-emerald-900 border-emerald-300'
                                  }`}
                                  title="Buka dialog untuk membayar iuran bulan berikutnya atau rincian lainnya"
                                >
                                  + Bayar Lagi
                                </button>
                              </div>
                            ) : (
                              <>
                                {/* Tombol Utama Pembayaran Fleksibel (Pilih salah satu / semua) */}
                                <button
                                  type="button"
                                  onClick={() => handleOpenPaymentModal(item, 'all')}
                                  className="px-2.5 py-1 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white rounded-lg text-xs font-bold shadow-2xs transition-all cursor-pointer"
                                  title="Buka dialog pembayaran untuk memilih bayar salah satu atau semua"
                                >
                                  Bayar / Pilih
                                </button>

                                {/* Pilihan Bayar Hanya Iuran */}
                                {remainingDues > 0 && (
                                  <button
                                    type="button"
                                    onClick={() => handleOpenPaymentModal(item, 'dues_only')}
                                    className="px-2 py-1 bg-white hover:bg-teal-50 text-teal-900 border border-teal-300 rounded-lg text-[10px] font-bold cursor-pointer shadow-2xs"
                                    title="Hanya bayar Iuran Bulanan saja"
                                  >
                                    Iuran Saja
                                  </button>
                                )}

                                {/* Pilihan Bayar Hanya Baksos */}
                                {baksosFineAmount > 0 && (
                                  <button
                                    type="button"
                                    onClick={() => handleOpenPaymentModal(item, 'baksos_only')}
                                    className="px-2 py-1 bg-white hover:bg-amber-50 text-amber-900 border border-amber-300 rounded-lg text-[10px] font-bold cursor-pointer shadow-2xs"
                                    title="Hanya bayar Denda Baksos saja"
                                  >
                                    Baksos Saja
                                  </button>
                                )}

                                {/* Pilihan Bayar Hanya Tunggakan Lalu */}
                                {previousArrears > 0 && (
                                  <button
                                    type="button"
                                    onClick={() => handleOpenPaymentModal(item, 'arrears_only')}
                                    className="px-2 py-1 bg-white hover:bg-purple-50 text-purple-900 border border-purple-300 rounded-lg text-[10px] font-bold cursor-pointer shadow-2xs"
                                    title="Hanya bayar Tunggakan Lalu saja"
                                  >
                                    Lalu Saja
                                  </button>
                                )}
                              </>
                            )}

                            {/* Tombol Edit Rincian Komponen */}
                            <button
                              type="button"
                              onClick={() => handleOpenEdit(house)}
                              className={`p-1 rounded-lg border cursor-pointer ${
                                isRumahKosongHitam
                                  ? 'border-neutral-700 text-slate-300 hover:text-white hover:bg-neutral-800'
                                  : 'border-slate-300 text-slate-700 hover:text-emerald-700 hover:bg-white shadow-2xs'
                              }`}
                              title="Edit Jumlah Iuran, Denda Baksos & Tunggakan"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>

                            {/* Tombol Hapus Manual Per Kepala Keluarga */}
                            <button
                              type="button"
                              onClick={() => setDeletingHouse(house)}
                              className={`p-1 rounded-lg border cursor-pointer ${
                                isRumahKosongHitam
                                  ? 'border-neutral-700 text-rose-400 hover:text-rose-300 hover:bg-neutral-800'
                                  : 'border-rose-200 text-rose-600 hover:text-rose-800 hover:bg-white shadow-2xs'
                              }`}
                              title={`Hapus manual / Clear tagihan KK ${displayName} (Blok ${house.blockNumber})`}
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* MODAL 1: EDIT 3 KOMPONEN (JUMLAH IURAN, BAKSOS, TUNGGAKAN & KEPALA KELUARGA) */}
      {editingHouse && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/70 backdrop-blur-xs overflow-y-auto animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl shadow-2xl border-2 border-emerald-400 w-full max-w-lg overflow-hidden my-4 sm:my-8">
            <div className="bg-gradient-to-r from-emerald-800 to-teal-800 p-4 sm:p-5 text-white flex justify-between items-center">
              <div>
                <h4 className="font-extrabold text-base sm:text-lg flex items-center gap-2">
                  <span>Edit Komponen: Blok {editingHouse.blockNumber}</span>
                  {editingHouse.occupancy === 'Kosong' && (
                    <span className="px-2 py-0.5 rounded-full text-[10px] bg-slate-700 text-slate-200 border border-slate-600">
                      Rumah Kosong
                    </span>
                  )}
                  {editingHouse.occupancy === 'Belum Ditempati' && (
                    <span className="px-2 py-0.5 rounded-full text-[10px] bg-amber-400 text-slate-950 font-bold">
                      Belum Ditempati
                    </span>
                  )}
                </h4>
              </div>
              <button
                type="button"
                onClick={() => setEditingHouse(null)}
                className="p-1.5 text-white/70 hover:text-white rounded-xl cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveEditModal} className="p-5 sm:p-6 space-y-4">
              {/* Edit Nama Kepala Keluarga */}
              <div className="p-3.5 bg-emerald-50/70 border border-emerald-200 rounded-2xl space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="block text-xs font-bold text-emerald-950">
                    Nama Kepala Keluarga / Pembayar Penarikan *
                  </label>
                  <span className="text-[10px] text-emerald-800 bg-white px-2 py-0.5 rounded-md border border-emerald-200 font-semibold">
                    Bisa Disesuaikan
                  </span>
                </div>
                <input
                  type="text"
                  required
                  value={editHeadName}
                  onChange={(e) => setEditHeadName(e.target.value)}
                  placeholder="Nama Kepala Keluarga / Rumah Kosong"
                  className="w-full px-3 py-2 text-xs bg-white border border-emerald-300 rounded-xl font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500 shadow-2xs"
                />
                <p className="text-[10px] text-slate-500">
                  * Nama kepala keluarga / penanggung jawab penarikan di blok ini.
                </p>
              </div>

              {/* Edit Status Hunian Rumah */}
              <div className="p-3.5 bg-cyan-50/70 border border-cyan-200 rounded-2xl space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="block text-xs font-bold text-cyan-950">
                    Status Rumah / Hunian *
                  </label>
                  <span className="text-[10px] text-cyan-800 bg-white px-2 py-0.5 rounded-md border border-cyan-200 font-semibold">
                    Dapat Diedit
                  </span>
                </div>
                <select
                  value={editOccupancy}
                  onChange={(e) => {
                    const newOcc = e.target.value as ResidentHouse['occupancy'];
                    setEditOccupancy(newOcc);
                    if (newOcc === 'Kosong') {
                      setEditNominal(0);
                      setEditHeadName('Rumah Kosong');
                    } else if (newOcc === 'Belum Ditempati') {
                      if (editHeadName === 'Rumah Kosong') setEditHeadName('Belum Ditempati');
                    } else if (editNominal === 0) {
                      setEditNominal(defaultNominal);
                    }
                  }}
                  className="w-full px-3 py-2 text-xs bg-white border border-cyan-300 rounded-xl font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-cyan-500 shadow-2xs cursor-pointer"
                >
                  <option value="Ditempati">Ditempati (Penghuni Tetap)</option>
                  <option value="Belum Ditempati">Belum Ditempati</option>
                  <option value="Kosong">Kosong (Bebas Iuran Kas / Rp 0)</option>
                  <option value="Dikontrakan">Dikontrakan (Sewa / Kontrak)</option>
                </select>
                <p className="text-[10px] text-slate-500">
                  {editOccupancy === 'Kosong'
                    ? '⚠️ Rumah kosong otomatis bebas tagihan iuran bulanan dan ditandai warna hitam di rekap.'
                    : '* Mengubah status hunian kavling rumah ini di data penarikan dan rekap iuran.'}
                </p>
              </div>

              {/* 1. Edit Jumlah Iuran Bulanan */}
              <div className="p-3.5 bg-emerald-50/40 border border-emerald-200 rounded-2xl space-y-1">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-emerald-950 flex items-center gap-1.5">
                    <Wallet className="w-4 h-4 text-emerald-600" />
                    <span>1. Jumlah Iuran Bulanan (Rp)</span>
                  </label>
                  {editOccupancy === 'Kosong' && (
                    <span className="text-[10px] text-slate-500 font-bold bg-slate-100 px-2 py-0.5 rounded">
                      Kosong = Rp 0
                    </span>
                  )}
                  {editOccupancy === 'Belum Ditempati' && (
                    <span className="text-[10px] text-amber-800 font-bold bg-amber-100 px-2 py-0.5 rounded">
                      Bisa diedit
                    </span>
                  )}
                </div>
                <input
                  type="number"
                  min={0}
                  step={5000}
                  disabled={editOccupancy === 'Kosong'}
                  value={editNominal}
                  onChange={(e) => setEditNominal(Number(e.target.value) || 0)}
                  className="w-full px-3 py-2 text-xs font-mono font-bold border border-emerald-300 rounded-xl focus:ring-2 focus:ring-emerald-500 bg-white disabled:bg-slate-100"
                />
                {editOccupancy === 'Kosong' ? (
                  <span className="text-[10px] text-slate-500 block font-semibold text-slate-700">
                    Rumah kosong bebas tagihan bulanan (Rp 0).
                  </span>
                ) : editOccupancy === 'Belum Ditempati' ? (
                  <span className="text-[10px] text-amber-700 block font-semibold">
                    Rumah belum ditempati bisa diisi/diedit iurannya sesuai kesepakatan.
                  </span>
                ) : null}
              </div>

              {/* 2. Edit Denda Baksos */}
              <div className="p-3.5 bg-amber-50/40 border border-amber-200 rounded-2xl space-y-1">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-amber-950 flex items-center gap-1.5">
                    <Coins className="w-4 h-4 text-amber-600" />
                    <span>2. Denda Bakti Sosial / Gotong Royong (Rp)</span>
                  </label>
                  <span className="text-[10px] text-amber-800 bg-white px-2 py-0.5 rounded border border-amber-300 font-semibold">
                    Bisa Disesuaikan
                  </span>
                </div>
                <input
                  type="number"
                  min={0}
                  step={5000}
                  disabled={editingHouse.occupancy === 'Kosong'}
                  value={editBaksosFine}
                  onChange={(e) => setEditBaksosFine(Number(e.target.value) || 0)}
                  className="w-full px-3 py-2 text-xs font-mono font-bold border border-amber-300 rounded-xl focus:ring-2 focus:ring-amber-500 bg-white disabled:bg-slate-100"
                />
                <span className="text-[10px] text-slate-500 block">
                  * Mengubah nominal denda baksos untuk kavling ini (misal Rp 0, Rp 10.000, Rp 20.000).
                </span>
              </div>

              {/* 3. Edit Tunggakan Sebelumnya & Keterangan */}
              <div className="p-3.5 bg-purple-50/40 border border-purple-200 rounded-2xl space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-purple-950 flex items-center gap-1.5">
                    <Clock className="w-4 h-4 text-purple-600" />
                    <span>3. Tunggakan Sebelumnya (Bulan / Tahun Lalu)</span>
                  </label>
                  <span className="text-[10px] text-purple-800 bg-white px-2 py-0.5 rounded border border-purple-300 font-semibold">
                    Bisa Disesuaikan
                  </span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-700 mb-0.5">
                      Nominal Tunggakan (Rp)
                    </label>
                    <input
                      type="number"
                      min={0}
                      step={5000}
                      disabled={editingHouse.occupancy === 'Kosong'}
                      value={editPrevArrears}
                      onChange={(e) => setEditPrevArrears(Number(e.target.value) || 0)}
                      className="w-full px-3 py-2 text-xs font-mono font-bold border border-purple-300 rounded-xl focus:ring-2 focus:ring-purple-500 bg-white disabled:bg-slate-100"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-700 mb-0.5">
                      Keterangan Tunggakan
                    </label>
                    <input
                      type="text"
                      disabled={editingHouse.occupancy === 'Kosong'}
                      placeholder="Sisa iuran bulan lalu..."
                      value={editPrevNote}
                      onChange={(e) => setEditPrevNote(e.target.value)}
                      className="w-full px-3 py-2 text-xs border border-purple-300 rounded-xl focus:ring-2 focus:ring-purple-500 bg-white disabled:bg-slate-100"
                    />
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setEditingHouse(null)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="flex items-center gap-1.5 px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-md cursor-pointer"
                >
                  <Save className="w-4 h-4" />
                  <span>Simpan Perubahan 3 Komponen</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: PEMBAYARAN FLEKSIBEL (PILIHAN MEMBAYAR SALAH SATU ATAU SEMUA) */}
      {payingHouse && payingBillingItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/70 backdrop-blur-xs overflow-y-auto animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl shadow-2xl border-2 border-emerald-400 w-full max-w-xl overflow-hidden my-4 sm:my-8">
            <div className="bg-gradient-to-r from-emerald-800 via-teal-800 to-indigo-900 p-4 sm:p-5 text-white flex justify-between items-center">
              <div>
                <h4 className="font-extrabold text-base sm:text-lg flex items-center gap-2">
                  <span>Proses Penarikan: Blok {payingHouse.blockNumber}</span>
                  <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-400 text-slate-950">
                    Pilihan Bayar
                  </span>
                </h4>
                <p className="text-xs text-emerald-100 mt-0.5">
                  Warga: <strong>{payingBillingItem.displayName}</strong> ({payingHouse.occupancy})
                </p>
              </div>
              <button
                type="button"
                onClick={() => setPayingHouse(null)}
                className="p-1.5 text-white/70 hover:text-white rounded-xl cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleExecutePayment} className="p-5 sm:p-6 space-y-4">
              {/* TOMBOL PILIHAN CEPAT (PRESET BUTTONS) */}
              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-slate-800">
                  Pilih Komponen yang Ingin Dibayarkan Sekarang:
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5 text-xs">
                  <button
                    type="button"
                    onClick={() => handleApplyPaymentMode('all', payingBillingItem)}
                    className={`py-2 px-2.5 rounded-xl font-bold transition-all cursor-pointer text-center ${
                      payChoice === 'all'
                        ? 'bg-emerald-600 text-white shadow-xs ring-2 ring-emerald-300'
                        : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                    }`}
                  >
                    Semua Lunas
                  </button>
                  <button
                    type="button"
                    onClick={() => handleApplyPaymentMode('dues_only', payingBillingItem)}
                    className={`py-2 px-2.5 rounded-xl font-bold transition-all cursor-pointer text-center ${
                      payChoice === 'dues_only'
                        ? 'bg-teal-600 text-white shadow-xs ring-2 ring-teal-300'
                        : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                    }`}
                  >
                    Hanya Iuran
                  </button>
                  <button
                    type="button"
                    onClick={() => handleApplyPaymentMode('baksos_only', payingBillingItem)}
                    className={`py-2 px-2.5 rounded-xl font-bold transition-all cursor-pointer text-center ${
                      payChoice === 'baksos_only'
                        ? 'bg-amber-600 text-white shadow-xs ring-2 ring-amber-300'
                        : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                    }`}
                  >
                    Hanya Baksos
                  </button>
                  <button
                    type="button"
                    onClick={() => handleApplyPaymentMode('arrears_only', payingBillingItem)}
                    className={`py-2 px-2.5 rounded-xl font-bold transition-all cursor-pointer text-center ${
                      payChoice === 'arrears_only'
                        ? 'bg-purple-600 text-white shadow-xs ring-2 ring-purple-300'
                        : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                    }`}
                  >
                    Hanya Lalu
                  </button>
                </div>
              </div>

              {/* RINCIAN 3 KOMPONEN DENGAN CHECKBOX */}
              <div className="space-y-2 pt-1">
                {/* 1. Iuran Kas Bulanan (Dukungan Bayar Lebih Dari 1 Bulan & Otomatis Lunas Bulan Berikutnya) */}
                <div
                  className={`p-3.5 rounded-2xl border transition-all ${
                    payDuesSelected
                      ? 'bg-emerald-50/90 border-emerald-400'
                      : 'bg-slate-50 border-slate-200 opacity-70'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={payDuesSelected}
                        onChange={(e) => {
                          setPayChoice('custom');
                          setPayDuesSelected(e.target.checked);
                        }}
                        className="w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                      />
                      <div>
                        <strong className="text-xs text-slate-900 block flex items-center gap-1.5 flex-wrap">
                          <span>1. Iuran Kas Bulanan ({inputMonth})</span>
                          {payDuesMonths > 1 && (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-indigo-600 text-white shadow-xs">
                              {payDuesMonths} Bulan Sekaligus
                            </span>
                          )}
                        </strong>
                        <span className="text-[10px] text-slate-500 block">
                          {payingBillingItem.isDuesPaid
                            ? 'Sudah lunas bulan ini, dapat bayar di muka untuk bulan-bulan berikutnya'
                            : 'Warga melunasi iuran bulan berjalan & bisa bayar lebih dari 1 bulan ke depan'}
                        </span>
                      </div>
                    </label>
                    <div className="text-right">
                      <span className="font-mono font-black text-sm text-emerald-800">
                        {formatRupiah(payDuesMonths * (payingBillingItem.monthlyDuesNominal || defaultNominal))}
                      </span>
                      {payDuesMonths > 1 && (
                        <span className="block text-[10px] text-slate-500 font-mono">
                          ({payDuesMonths} x {formatRupiah(payingBillingItem.monthlyDuesNominal || defaultNominal)})
                        </span>
                      )}
                    </div>
                  </div>

                  {/* KONTROL PILIHAN BAYAR LEBIH DARI 1 BULAN */}
                  {payDuesSelected && (
                    <div className="mt-3 pt-3 border-t border-emerald-200/80 space-y-2.5">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                        <span className="text-xs font-bold text-emerald-950 flex items-center gap-1.5">
                          <Calendar className="w-3.5 h-3.5 text-emerald-700" />
                          <span>Pilih Jumlah Bulan Iuran:</span>
                        </span>

                        {/* Stepper / Input Number */}
                        <div className="flex items-center gap-1.5 self-start sm:self-auto">
                          <button
                            type="button"
                            onClick={() => setPayDuesMonths(Math.max(1, payDuesMonths - 1))}
                            disabled={payDuesMonths <= 1}
                            className="w-7 h-7 rounded-lg bg-emerald-100 hover:bg-emerald-200 disabled:opacity-40 disabled:cursor-not-allowed text-emerald-900 font-black flex items-center justify-center cursor-pointer transition-colors"
                            title="Kurang 1 bulan"
                          >
                            -
                          </button>
                          <div className="flex items-center gap-1 px-2.5 py-1 bg-white border border-emerald-300 rounded-lg shadow-inner">
                            <input
                              type="number"
                              min={1}
                              max={24}
                              value={payDuesMonths}
                              onChange={(e) => {
                                const val = parseInt(e.target.value, 10);
                                setPayDuesMonths(isNaN(val) || val < 1 ? 1 : Math.min(24, val));
                              }}
                              className="w-10 text-center font-mono font-black text-xs text-slate-900 focus:outline-none"
                            />
                            <span className="text-xs font-bold text-slate-600">Bulan</span>
                          </div>
                          <button
                            type="button"
                            onClick={() => setPayDuesMonths(Math.min(24, payDuesMonths + 1))}
                            className="w-7 h-7 rounded-lg bg-emerald-100 hover:bg-emerald-200 text-emerald-900 font-black flex items-center justify-center cursor-pointer transition-colors"
                            title="Tambah 1 bulan"
                          >
                            +
                          </button>
                        </div>
                      </div>

                      {/* Presets Tombol Cepat */}
                      <div className="grid grid-cols-5 gap-1 text-[11px]">
                        {[
                          { count: 1, label: '1 Bln' },
                          { count: 2, label: '2 Bln' },
                          { count: 3, label: '3 Bln' },
                          { count: 6, label: '6 Bln' },
                          { count: 12, label: '12 Bln' },
                        ].map((preset) => (
                          <button
                            key={preset.count}
                            type="button"
                            onClick={() => setPayDuesMonths(preset.count)}
                            className={`py-1 rounded-lg font-bold border transition-all cursor-pointer text-center ${
                              payDuesMonths === preset.count
                                ? 'bg-emerald-700 text-white border-emerald-800 shadow-xs ring-1 ring-emerald-400'
                                : 'bg-white text-slate-700 border-emerald-200 hover:bg-emerald-100/60'
                            }`}
                          >
                            {preset.label}
                          </button>
                        ))}
                      </div>

                      {/* Pratinjau Bulan yang Dicakup & Otomatis Masuk Bulan Berikutnya */}
                      <div className="p-2.5 bg-white/95 border border-emerald-200 rounded-xl space-y-1.5 text-[11px]">
                        <div className="flex items-center justify-between text-slate-700 font-semibold">
                          <span>Bulan yang Dicakup Pembayaran:</span>
                          <span className="text-emerald-800 font-mono font-bold">
                            {payDuesMonths} Bulan ({formatRupiah(payDuesMonths * (payingBillingItem.monthlyDuesNominal || defaultNominal))})
                          </span>
                        </div>
                        <div className="flex flex-wrap gap-1">
                          {getSubsequentMonthLabels(inputMonth.trim() || defaultPeriod, payDuesMonths).map((mLabel, idx) => (
                            <span
                              key={mLabel}
                              className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md font-bold text-[10px] ${
                                idx === 0
                                  ? 'bg-emerald-100 text-emerald-900 border border-emerald-300'
                                  : 'bg-indigo-100 text-indigo-900 border border-indigo-300'
                              }`}
                            >
                              <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                              <span>{mLabel}</span>
                              {idx > 0 && (
                                <span className="text-[9px] font-normal text-indigo-700">
                                  (Otomatis Lunas)
                                </span>
                              )}
                            </span>
                          ))}
                        </div>
                        {payDuesMonths > 1 && (
                          <>
                            <p className="text-[10px] text-indigo-950 bg-indigo-50/80 p-2 rounded-lg border border-indigo-200 leading-relaxed font-medium">
                              💡 <strong>Otomatis Masuk ke Bulan Berikutnya:</strong> Warga otomatis tercatat <strong>LUNAS</strong> saat Anda memilih bulan-bulan di atas di penarikan keuangan maupun rekap kas per KK tanpa perlu ditagih/diinput ulang.
                            </p>
                            <div className="p-2 bg-indigo-50/90 rounded-lg border border-indigo-200 text-[10px] space-y-1">
                              <span className="font-bold text-indigo-950 block">📝 Catatan Transaksi Kas Otomatis:</span>
                              <div className="font-mono text-indigo-900 bg-white/90 p-1.5 rounded border border-indigo-200 break-words font-semibold text-[10px]">
                                {(() => {
                                  const covList = getSubsequentMonthLabels(inputMonth.trim() || defaultPeriod, payDuesMonths);
                                  const rangeTxt = `${inputMonth.trim() || defaultPeriod} - ${covList[covList.length - 1]} (${payDuesMonths} Bulan)`;
                                  return `Iuran Kas Warga Lebih dari 1 Bulan (${rangeTxt}) Blok ${payingBillingItem.house.blockNumber} (${payingBillingItem.displayName})${payNote ? ` - ${payNote}` : ''}`;
                                })()}
                              </div>
                            </div>
                          </>
                        )}
                      </div>
                    </div>
                  )}
                </div>

                {/* 2. Denda Baksos */}
                <div
                  className={`p-3.5 rounded-2xl border transition-all cursor-pointer ${
                    payBaksosSelected
                      ? 'bg-amber-50/90 border-amber-400'
                      : 'bg-slate-50 border-slate-200 opacity-70'
                  }`}
                  onClick={() => {
                    setPayChoice('custom');
                    setPayBaksosSelected(!payBaksosSelected);
                  }}
                >
                  <div className="flex items-center justify-between">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={payBaksosSelected}
                        onChange={(e) => {
                          setPayChoice('custom');
                          setPayBaksosSelected(e.target.checked);
                        }}
                        className="w-4 h-4 rounded text-amber-600 focus:ring-amber-500 cursor-pointer"
                      />
                      <div>
                        <strong className="text-xs text-slate-900 block">
                          2. Denda Bakti Sosial (Gotong Royong)
                        </strong>
                        <span className="text-[10px] text-slate-500">
                          {payingBillingItem.baksosFineAmount > 0
                            ? `${payingBillingItem.unpaidBaksosList.length}x absen kerja bakti (Rp 10.000/absen)`
                            : 'Tidak ada denda baksos yang tertunggak'}
                        </span>
                      </div>
                    </label>
                    <span className="font-mono font-black text-sm text-amber-900">
                      {formatRupiah(payingBillingItem.baksosFineAmount)}
                    </span>
                  </div>
                </div>

                {/* 3. Tunggakan Lalu */}
                <div
                  className={`p-3.5 rounded-2xl border transition-all ${
                    payArrearsSelected
                      ? 'bg-purple-50/90 border-purple-400'
                      : 'bg-slate-50 border-slate-200 opacity-70'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={payArrearsSelected}
                        onChange={(e) => {
                          setPayChoice('custom');
                          setPayArrearsSelected(e.target.checked);
                          if (e.target.checked && payArrearsAmount === 0) {
                            setPayArrearsAmount(payingBillingItem.previousArrears);
                          }
                        }}
                        className="w-4 h-4 rounded text-purple-600 focus:ring-purple-500 cursor-pointer"
                      />
                      <div>
                        <strong className="text-xs text-slate-900 block">
                          3. Tunggakan Bulan / Tahun Lalu
                        </strong>
                        <span className="text-[10px] text-slate-500">
                          {payingBillingItem.previousArrearsNote
                            ? `Ket: ${payingBillingItem.previousArrearsNote}`
                            : 'Sisa tunggakan periode sebelumnya'}
                        </span>
                      </div>
                    </label>
                    <span className="font-mono font-black text-sm text-purple-900">
                      {formatRupiah(payingBillingItem.previousArrears)}
                    </span>
                  </div>

                  {/* Nominal Pelunasan Tunggakan Lalu jika dicicil/bayar sebagian */}
                  {payArrearsSelected && payingBillingItem.previousArrears > 0 && (
                    <div className="mt-2.5 pt-2 border-t border-purple-200/70 flex items-center justify-between gap-2 text-xs">
                      <span className="text-[11px] font-semibold text-purple-900">
                        Nominal Tunggakan Dibayar Sekarang:
                      </span>
                      <div className="w-36">
                        <input
                          type="number"
                          min={1000}
                          max={payingBillingItem.previousArrears}
                          step={5000}
                          value={payArrearsAmount}
                          onChange={(e) => setPayArrearsAmount(Number(e.target.value) || 0)}
                          className="w-full px-2.5 py-1 text-xs font-mono font-bold bg-white border border-purple-300 rounded-lg text-right"
                        />
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* TOTAL YANG DIBAYAR SEKARANG */}
              <div className="p-4 rounded-2xl bg-gradient-to-br from-slate-900 to-slate-800 text-white flex items-center justify-between shadow-sm">
                <div>
                  <span className="text-[11px] text-slate-300 font-bold block uppercase tracking-wider">
                    Total Yang Dibayarkan Sekarang:
                  </span>
                  <span className="text-[10px] text-emerald-300">
                    Otomatis tercatat masuk ke Kas Utama & Rekap Per KK
                  </span>
                </div>
                <div className="text-right">
                  <span className="font-mono font-black text-xl text-emerald-400">
                    {formatRupiah(calculatedModalTotalPayment)}
                  </span>
                </div>
              </div>

              {/* Tanggal & Catatan */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Tanggal Pembayaran
                  </label>
                  <input
                    type="date"
                    required
                    value={payDate}
                    onChange={(e) => setPayDate(e.target.value)}
                    className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Catatan Pembayaran (Opsional)
                  </label>
                  <input
                    type="text"
                    placeholder="Misal: Tunai di pos / transfer BCA..."
                    value={payNote}
                    onChange={(e) => setPayNote(e.target.value)}
                    className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
              </div>

              {/* Action buttons */}
              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setPayingHouse(null)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={calculatedModalTotalPayment === 0}
                  className="flex items-center gap-1.5 px-5 py-2.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white font-bold text-xs rounded-xl shadow-md cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Check className="w-4 h-4" />
                  <span>Proses Pembayaran ({formatRupiah(calculatedModalTotalPayment)})</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 3: CLEAR BELUM BAYAR (RUBAH SEMUA STATUS KE BELUM BAYAR) */}
      {isClearAllModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/70 backdrop-blur-xs overflow-y-auto animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl shadow-2xl border-2 border-amber-400 w-full max-w-lg overflow-hidden my-4 sm:my-8">
            <div className="bg-gradient-to-r from-amber-600 via-orange-600 to-rose-700 p-4 sm:p-5 text-white flex justify-between items-center">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-white/20 rounded-xl backdrop-blur-xs">
                  <RotateCcw className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h4 className="font-extrabold text-base sm:text-lg">
                    Clear Status: Ubah Semua ke Belum Bayar
                  </h4>
                  <p className="text-[11px] text-amber-100">
                    Bulan Penarikan: <strong className="text-white underline">{inputMonth}</strong>
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsClearAllModalOpen(false)}
                className="p-1 rounded-xl text-white/80 hover:text-white hover:bg-white/20 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 sm:p-6 space-y-4">
              {/* Ringkasan Status Saat Ini */}
              <div className="bg-amber-50 border-2 border-amber-200 rounded-2xl p-4 text-xs space-y-2">
                <div className="flex items-center justify-between text-slate-800 pb-2 border-b border-amber-200 font-bold">
                  <span>Total Warga Terdaftar:</span>
                  <span className="font-mono text-sm text-slate-900 font-black">
                    {residents.length} KK
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-2 pt-1 text-[11px]">
                  <div className="p-2 bg-white rounded-xl border border-amber-200 flex flex-col">
                    <span className="text-slate-500 font-medium">Sudah Lunas Saat Ini:</span>
                    <span className="font-mono font-black text-emerald-700 text-sm">
                      {residents.filter((r) => r.duesStatus === 'Lunas' || r.duesStatus === 'Bayar Lebih').length} KK
                    </span>
                  </div>
                  <div className="p-2 bg-white rounded-xl border border-amber-200 flex flex-col">
                    <span className="text-slate-500 font-medium">Belum Bayar Saat Ini:</span>
                    <span className="font-mono font-black text-rose-700 text-sm">
                      {residents.filter((r) => r.duesStatus === 'Belum Bayar').length} KK
                    </span>
                  </div>
                </div>
                <div className="flex justify-between pt-2 border-t border-amber-200 text-slate-700 font-medium text-[11px]">
                  <span>Total Nilai Tagihan Tertunggak:</span>
                  <span className="font-mono font-bold text-rose-700">{formatRupiah(totalAllUnpaidRemaining)}</span>
                </div>
              </div>

              <div className="space-y-3">
                <p className="text-xs text-slate-700 font-bold">
                  Pilih tindakan yang ingin dilakukan:
                </p>

                {/* PILIHAN 1 (UTAMA): UBAH SEMUA STATUS KE BELUM BAYAR */}
                <div className="p-3.5 rounded-2xl border-2 border-amber-400 bg-amber-50/80 hover:bg-amber-100/70 transition-colors space-y-2.5">
                  <div className="flex items-center justify-between">
                    <div className="font-extrabold text-xs text-amber-950 flex items-center gap-1.5">
                      <RotateCcw className="w-4 h-4 text-amber-700" />
                      <span>1. Ubah Semua Status ke Belum Bayar (Permintaan Utama)</span>
                    </div>
                    <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-amber-200 text-amber-950">
                      Reset Penarikan
                    </span>
                  </div>
                  <p className="text-[11px] text-amber-900 leading-relaxed">
                    Merubah seluruh status iuran warga (<strong>{residents.length} KK</strong>) untuk bulan <strong>{inputMonth}</strong> menjadi <strong>Belum Bayar</strong> dan mengosongkan riwayat pembayaran bulan ini. Siap digunakan untuk memulai penarikan iuran baru.
                  </p>
                  <button
                    type="button"
                    onClick={handleExecuteResetAllToUnpaid}
                    className="w-full py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-rose-600 hover:from-amber-600 hover:to-rose-700 text-white font-black text-xs shadow-md transition-all cursor-pointer flex items-center justify-center gap-2"
                  >
                    <RotateCcw className="w-4 h-4" />
                    <span>Ubah Semua Status Menjadi Belum Bayar ({residents.length} KK)</span>
                  </button>
                </div>

                {/* PILIHAN 2 (ALTERNATIF): LUNASKAN SELURUH WARGA YANG BELUM BAYAR */}
                <div className="p-3.5 rounded-2xl border border-emerald-300 bg-emerald-50/70 hover:bg-emerald-50 transition-colors space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="font-extrabold text-xs text-emerald-950 flex items-center gap-1.5">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                      <span>2. Lunaskan Warga yang Belum Bayar (Catat ke Kas)</span>
                    </div>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-200 text-emerald-900">
                      Catat Masuk Kas
                    </span>
                  </div>
                  <p className="text-[11px] text-emerald-800 leading-relaxed">
                    Menandai warga yang belum bayar ({unpaidBillingItems.length} KK) menjadi <strong>Lunas</strong> untuk bulan {inputMonth} dan membukukan dananya ke <strong>Kas Utama</strong>.
                  </p>
                  <button
                    type="button"
                    onClick={handleExecuteClearAllPaid}
                    disabled={unpaidBillingItems.length === 0}
                    className="w-full py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-300 disabled:cursor-not-allowed text-white font-bold text-xs shadow-xs transition-all cursor-pointer flex items-center justify-center gap-1.5"
                  >
                    <Check className="w-4 h-4" />
                    <span>Lunaskan Semua ({formatRupiah(totalAllUnpaidRemaining)})</span>
                  </button>
                </div>

                {/* PILIHAN 3 (ALTERNATIF): KOSONGKAN / NOLKAN TAGIHAN TANPA MUTASI */}
                <div className="p-3.5 rounded-2xl border border-slate-300 bg-slate-50 hover:bg-slate-100/80 transition-colors space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="font-extrabold text-xs text-slate-900 flex items-center gap-1.5">
                      <Sparkles className="w-4 h-4 text-slate-600" />
                      <span>3. Nolkan Tagihan Tertunggak (Bebas Tagihan)</span>
                    </div>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-200 text-slate-700">
                      Tanpa Mutasi Kas
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-600 leading-relaxed">
                    Mereset nominal tagihan (iuran, denda, tunggakan) menjadi Rp 0 bagi warga yang belum bayar tanpa membukukan penerimaan kas.
                  </p>
                  <button
                    type="button"
                    onClick={handleExecuteClearZeroOut}
                    disabled={unpaidBillingItems.length === 0}
                    className="w-full py-2 rounded-xl bg-slate-800 hover:bg-slate-900 disabled:bg-slate-300 disabled:cursor-not-allowed text-white font-bold text-xs shadow-xs transition-all cursor-pointer flex items-center justify-center gap-1.5"
                  >
                    <span>Nolkan Tagihan ({unpaidBillingItems.length} KK)</span>
                  </button>
                </div>
              </div>

              <div className="flex justify-end pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsClearAllModalOpen(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl cursor-pointer"
                >
                  Tutup
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 4: HAPUS MANUAL PER KEPALA KELUARGA */}
      {deletingHouse && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/70 backdrop-blur-xs overflow-y-auto animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl shadow-2xl border-2 border-rose-400 w-full max-w-md overflow-hidden my-4 sm:my-8">
            <div className="bg-gradient-to-r from-rose-700 to-red-800 p-4 sm:p-5 text-white flex justify-between items-center">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-white/20 rounded-xl backdrop-blur-xs">
                  <Trash2 className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h4 className="font-extrabold text-base sm:text-lg">
                    Hapus Manual KK
                  </h4>
                  <p className="text-[11px] text-rose-100">
                    Kavling Blok {deletingHouse.blockNumber}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setDeletingHouse(null)}
                className="p-1 rounded-xl text-white/80 hover:text-white hover:bg-white/20 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 sm:p-6 space-y-4">
              <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-2xl text-xs space-y-1.5">
                <div className="flex justify-between items-center text-slate-700">
                  <span>Nomor Blok:</span>
                  <span className="font-mono font-black text-slate-900 bg-white px-2 py-0.5 rounded border border-slate-200">
                    {deletingHouse.blockNumber}
                  </span>
                </div>
                <div className="flex justify-between items-center text-slate-700">
                  <span>Kepala Keluarga:</span>
                  <span className="font-extrabold text-slate-900">
                    {deletingHouse.duesHeadNameOverride || deletingHouse.headName}
                  </span>
                </div>
                <div className="flex justify-between items-center text-slate-700">
                  <span>Status Hunian:</span>
                  <span className="font-bold text-slate-700">
                    {deletingHouse.occupancy}
                  </span>
                </div>
                {deletingHouse.previousArrears > 0 && (
                  <div className="flex justify-between items-center text-purple-800">
                    <span>Tunggakan Sebelumnya:</span>
                    <span className="font-mono font-bold">{formatRupiah(deletingHouse.previousArrears)}</span>
                  </div>
                )}
              </div>

              <div className="space-y-2.5">
                <p className="text-xs text-slate-600 font-medium">
                  Pilih tindakan yang ingin dilakukan pada kepala keluarga ini:
                </p>

                {/* Opsi 1: Hapus Permanen KK dari Sistem */}
                {onDeleteResident && (
                  <button
                    type="button"
                    onClick={() => {
                      onDeleteResident(deletingHouse.id);
                      try {
                        confetti({ particleCount: 35, spread: 50, origin: { y: 0.7 } });
                      } catch {}
                      setDeletingHouse(null);
                    }}
                    className="w-full p-3 rounded-2xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold shadow-md transition-all cursor-pointer flex items-center justify-between text-left"
                  >
                    <div>
                      <span className="block font-black text-sm">Hapus KK dari Sistem Warga</span>
                      <span className="block text-[11px] text-rose-100 font-normal">
                        Menghapus data rumah & KK ini dari database dan penagihan
                      </span>
                    </div>
                    <Trash2 className="w-5 h-5 shrink-0 ml-2" />
                  </button>
                )}

                {/* Opsi 1: Ubah Status KK Ini Menjadi Belum Bayar */}
                <button
                  type="button"
                  onClick={() => {
                    handleRevertHouseToUnpaid(deletingHouse);
                    setDeletingHouse(null);
                  }}
                  className="w-full p-3 rounded-2xl bg-amber-500 hover:bg-amber-600 text-white text-xs font-bold shadow-md transition-all cursor-pointer flex items-center justify-between text-left"
                >
                  <div>
                    <span className="block font-black text-sm">Ubah Status Menjadi Belum Bayar</span>
                    <span className="block text-[11px] text-amber-100 font-normal">
                      Reset status penarikan iuran KK ini untuk bulan {inputMonth} ke Belum Bayar
                    </span>
                  </div>
                  <RotateCcw className="w-5 h-5 shrink-0 ml-2" />
                </button>

                {/* Opsi 2: Clear / Nolkan Tagihan KK Ini Saja */}
                <button
                  type="button"
                  onClick={() => {
                    onUpdateResident({
                      ...deletingHouse,
                      duesStatus: 'Lunas',
                      customDuesAmount: 0,
                      customBaksosFineAmount: 0,
                      previousArrears: 0,
                      previousArrearsNote: '',
                    });
                    try {
                      confetti({ particleCount: 30, spread: 40, origin: { y: 0.7 } });
                    } catch {}
                    setDeletingHouse(null);
                  }}
                  className="w-full p-3 rounded-2xl bg-slate-700 hover:bg-slate-800 text-white text-xs font-bold shadow-md transition-all cursor-pointer flex items-center justify-between text-left"
                >
                  <div>
                    <span className="block font-black text-sm">Nolkan Tagihan KK Ini (Bebaskan Tagihan)</span>
                    <span className="block text-[11px] text-slate-200 font-normal">
                      Tetap simpan data warga, namun kosongkan seluruh tunggakan & tagihan
                    </span>
                  </div>
                  <Sparkles className="w-5 h-5 shrink-0 ml-2" />
                </button>
              </div>

              <div className="flex justify-end pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setDeletingHouse(null)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl cursor-pointer"
                >
                  Batal
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL UPLOAD EXCEL PENARIKAN KEUANGAN */}
      <BillingExcelUploadModal
        isOpen={isUploadModalOpen}
        onClose={() => setIsUploadModalOpen(false)}
        availablePeriods={availablePeriods}
        currentPeriod={inputMonth}
        residents={residents}
        baksosAgendas={baksosAgendas}
        defaultNominal={defaultNominal}
        onConfirmImport={(updatedResidents, newTxs, periodLabel, setAsActive, baksosPaidActions) => {
          if (onBatchImportDues) {
            onBatchImportDues(updatedResidents, newTxs, periodLabel, setAsActive);
          } else {
            updatedResidents.forEach((r) => onUpdateResident(r));
            newTxs.forEach((t) => onAddTransaction(t));
          }

          if (baksosPaidActions && baksosPaidActions.length > 0 && onMarkFinePaid) {
            baksosPaidActions.forEach((act) => {
              onMarkFinePaid(act.agendaId, act.residentId, act.headName, act.blockNumber);
            });
          }
        }}
      />

      {/* MODAL 5: SIMPAN DATA PENARIKAN & PINDAH KE BULAN BERIKUTNYA */}
      {isRolloverModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl shadow-2xl border-2 border-emerald-300 w-full max-w-lg overflow-hidden animate-in zoom-in-95 duration-150">
            {/* Header */}
            <div className="bg-gradient-to-r from-emerald-700 via-teal-700 to-indigo-900 p-5 text-white flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="p-2.5 rounded-2xl bg-white/15 text-amber-300 border border-white/20">
                  <Save className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-black text-base text-white">
                    Simpan Data Penarikan & Pindah Bulan
                  </h3>
                  <p className="text-xs text-emerald-100">
                    Tutup penarikan periode <strong className="text-amber-300">{activePeriod}</strong> dan lanjut ke <strong className="text-amber-300">{nextPeriodLabel}</strong>
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsRolloverModalOpen(false)}
                className="p-1 rounded-xl text-emerald-100 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Content Body */}
            <div className="p-6 space-y-4">
              <div className="p-4 rounded-2xl bg-emerald-50/80 border border-emerald-200 space-y-2 text-xs leading-relaxed text-emerald-950">
                <p className="font-bold text-emerald-900 text-sm flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>Ringkasan Penutupan Penarikan {activePeriod}:</span>
                </p>
                <ul className="space-y-1.5 pl-2">
                  <li className="flex items-start gap-2">
                    <span className="text-emerald-600 font-black">•</span>
                    <span>
                      <strong className="text-emerald-900">{paidBillingHouses.length} KK Lunas</strong> akan tercatat resmi dalam <strong>Rekap Iuran Kas Per KK</strong> periode {activePeriod}.
                    </span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-amber-600 font-black">•</span>
                    <span>
                      <strong className="text-rose-700">{unpaidBillingHouses.length} KK Belum Bayar</strong> (total tagihan <strong className="text-rose-700">{formatRupiah(unpaidDuesAmountTotal)}</strong>) otomatis dimasukkan ke dalam <strong>Daftar Tunggakan</strong>.
                    </span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-indigo-600 font-black">•</span>
                    <span>
                      Bulan penarikan akan otomatis berganti ke <strong className="text-indigo-900">{nextPeriodLabel}</strong> dan seluruh status kembali <strong>Belum Bayar</strong> (kecuali warga yang membayar lebih/di muka).
                    </span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-teal-600 font-black">•</span>
                    <span>
                      Periode <strong>{activePeriod}</strong> akan muncul di pilihan periode <strong>Rekap Iuran Kas Per KK</strong> karena periode telah resmi berganti bulan.
                    </span>
                  </li>
                </ul>
              </div>

              {/* Rincian Angka */}
              <div className="grid grid-cols-2 gap-3">
                <div className="p-3 rounded-2xl bg-slate-50 border border-slate-200">
                  <span className="text-[10px] uppercase font-bold text-slate-500 tracking-wider block">
                    Sudah Bayar / Lunas
                  </span>
                  <div className="text-lg font-black text-emerald-700 font-mono mt-0.5">
                    {paidBillingHouses.length} KK
                  </div>
                  <span className="text-[11px] text-slate-600 font-medium">
                    Tercatat di Rekap KK
                  </span>
                </div>

                <div className="p-3 rounded-2xl bg-rose-50/70 border border-rose-200">
                  <span className="text-[10px] uppercase font-bold text-rose-600 tracking-wider block">
                    Belum Bayar (Menunggak)
                  </span>
                  <div className="text-lg font-black text-rose-700 font-mono mt-0.5">
                    {unpaidBillingHouses.length} KK
                  </div>
                  <span className="text-[11px] text-rose-800 font-medium">
                    +{formatRupiah(unpaidDuesAmountTotal)} ke Tunggakan
                  </span>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setIsRolloverModalOpen(false)}
                  className="px-4 py-2.5 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="button"
                  onClick={handleExecuteSaveAndRollover}
                  className="flex items-center gap-2 px-5 py-2.5 text-xs font-black bg-gradient-to-r from-emerald-600 via-teal-600 to-indigo-600 hover:from-emerald-500 hover:to-indigo-500 text-white rounded-xl shadow-md hover:shadow-lg transition-all cursor-pointer"
                >
                  <Save className="w-4 h-4 text-amber-300" />
                  <span>Ya, Simpan & Pindah ke {nextPeriodLabel}</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
