import React, { useEffect, useMemo, useState } from 'react';
import confetti from 'canvas-confetti';
import {
  AlertTriangle,
  Banknote,
  Building2,
  Check,
  CheckCircle2,
  Clock,
  Copy,
  Edit2,
  ExternalLink,
  FileSpreadsheet,
  FileText,
  MessageCircle,
  Pause,
  Phone,
  Play,
  RotateCcw,
  Search,
  Send,
  SkipForward,
  Sparkles,
  Trash2,
  Users,
  X,
  Zap,
} from 'lucide-react';
import { BaksosAgenda, CashTransaction, ResidentHouse, SiteConfig } from '../types';
import { formatRupiah, isHouseVacant, openWhatsAppShare } from '../utils/helpers';
import { exportFinancialReportToExcel } from '../utils/financialExcelExport';
import { BalanceBreakdown } from '../hooks/useStorage';

interface ArrearsSectionProps {
  config: SiteConfig;
  residents: ResidentHouse[];
  baksosAgendas: BaksosAgenda[];
  transactions?: CashTransaction[];
  balances?: BalanceBreakdown;
  isAdmin: boolean;
  onUpdateResident: (updated: ResidentHouse) => void;
  onAddTransaction: (tx: any) => void;
  onMarkFinePaid: (agendaId: string, residentId: string, houseName: string, blockNo: string) => void;
  onOpenConfigModal?: () => void;
}

export const ArrearsSection: React.FC<ArrearsSectionProps> = ({
  config,
  residents,
  baksosAgendas,
  transactions = [],
  balances = { kasUtama: 0, wifiCashback: 0, sampahCashback: 0, total: 0 },
  isAdmin,
  onUpdateResident,
  onAddTransaction,
  onMarkFinePaid,
  onOpenConfigModal,
}) => {
  // Modal Edit Tunggakan Bulan / Tahun Lalu + Keterangan
  const [editingHouse, setEditingHouse] = useState<ResidentHouse | null>(null);
  const [editPrevAmount, setEditPrevAmount] = useState<number>(0);
  const [editPrevNote, setEditPrevNote] = useState<string>('');

  // Modal Pembayaran Sebagian (Cicil) Tunggakan Per Rumah
  const [partialPayItem, setPartialPayItem] = useState<any | null>(null);
  const [partialAmount, setPartialAmount] = useState<number>(20000);
  const [partialNote, setPartialNote] = useState<string>('');

  // Batch Auto-Billing via WhatsApp (Penarikan Tagihan Otomatis Sekaligus)
  const [isBatchBillingModalOpen, setIsBatchBillingModalOpen] = useState(false);
  const [batchBillingTab, setBatchBillingTab] = useState<'runner' | 'broadcast' | 'list'>('runner');
  const [runnerIndex, setRunnerIndex] = useState<number>(0);
  const [isRunnerActive, setIsRunnerActive] = useState<boolean>(false);
  const [runnerDelay, setRunnerDelay] = useState<number>(3);
  const [countdown, setCountdown] = useState<number>(3);
  const [sentHouseIds, setSentHouseIds] = useState<Record<string, boolean>>({});
  const [copiedBroadcast, setCopiedBroadcast] = useState(false);
  const [bankInfo, setBankInfo] = useState(
    'BCA 1234567890 a.n. Siti Rahmawati (Bendahara Gang Mandor) / Tunai ke Pos Gang'
  );
  const [deadlineNote, setDeadlineNote] = useState('Sebelum tanggal 10 bulan berjalan');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Compute arrears per household
  const arrearsList = residents.map((house) => {
    const houseMonthlyNominal =
      house.customDuesAmount !== undefined
        ? house.customDuesAmount
        : config.duesAmountPerMonth || 50000;

    // 1. Tunggakan iuran rutin bulan ini (Rumah Kosong otomatis tidak dikenakan iuran rutin / bebas tunggakan)
    const isVacant =
      house.occupancy === 'Kosong' ||
      house.occupancy === 'Belum Ditempati' ||
      isHouseVacant(house);
    const duesArrears =
      isVacant
        ? 0
        : house.duesStatus === 'Belum Bayar'
        ? Math.max(0, houseMonthlyNominal - (house.duesPaidAmount || 0))
        : 0;

    // 2. Tunggakan denda baksos (Rp 10.000 khusus untuk status 'Tidak Hadir' yang belum lunas; Kontrak otomatis Tidak Wajib)
    const isContract = house.ownership === 'Kontrak' || house.occupancy === 'Dikontrakan';
    const unpaidBaksosList = baksosAgendas.filter((agenda) => {
      const attendance =
        agenda.attendance?.[house.id] ||
        (house.occupancy === 'Kosong' ? 'Kosong' : isContract ? 'Tidak Wajib' : 'Hadir');
      const isFinePaid = agenda.finesPaid?.[house.id];
      return attendance === 'Tidak Hadir' && !isFinePaid;
    });
    const calculatedBaksosFine = isVacant ? 0 : unpaidBaksosList.length * 10000;
    const baksosFineArrears =
      house.customBaksosFineAmount !== undefined
        ? house.customBaksosFineAmount
        : calculatedBaksosFine;

    // 3. Tunggakan bulan / tahun sebelumnya + keterangan
    const previousArrears = house.previousArrears || 0;
    const previousArrearsNote = house.previousArrearsNote || '';

    // Total tunggakan
    const totalArrears = duesArrears + baksosFineArrears + previousArrears;

    return {
      house,
      houseMonthlyNominal,
      duesArrears,
      unpaidBaksosList,
      baksosFineArrears,
      previousArrears,
      previousArrearsNote,
      totalArrears,
    };
  });

  const housesWithArrears = arrearsList.filter((item) => item.totalArrears > 0);
  const totalAllArrears = arrearsList.reduce((acc, curr) => acc + curr.totalArrears, 0);

  const filteredDelinquentList = housesWithArrears.filter((item) => {
    const payerName = item.house.duesHeadNameOverride || item.house.headName;
    return (
      !searchQuery.trim() ||
      item.house.blockNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.house.headName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      payerName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.previousArrearsNote.toLowerCase().includes(searchQuery.toLowerCase())
    );
  });

  const handleOpenEditPrev = (house: ResidentHouse) => {
    setEditingHouse(house);
    setEditPrevAmount(house.previousArrears || 0);
    setEditPrevNote(house.previousArrearsNote || '');
  };

  const handleSavePrev = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingHouse) return;
    const oldPrev = editingHouse.previousArrears || 0;
    const newPrev = Math.max(0, Number(editPrevAmount) || 0);
    const paidDiff = Math.max(0, oldPrev - newPrev);

    onUpdateResident({
      ...editingHouse,
      previousArrears: newPrev,
      previousArrearsNote: editPrevNote.trim(),
    });

    if (paidDiff > 0) {
      try {
        confetti({ particleCount: 45, spread: 60, origin: { y: 0.7 } });
      } catch {}
      onAddTransaction({
        date: new Date().toISOString().slice(0, 10),
        type: 'masuk',
        pool: 'Kas Utama',
        category: 'Iuran Warga',
        description: `Pembayaran / Pelunasan Tunggakan Lalu Blok ${editingHouse.blockNumber} (${editingHouse.headName})${
          editPrevNote.trim() ? ` - ${editPrevNote.trim()}` : ''
        }`,
        amount: paidDiff,
      });
    }

    setEditingHouse(null);
  };

  const handleResetPrev = (house: ResidentHouse) => {
    const prevAmt = house.previousArrears || 0;
    onUpdateResident({
      ...house,
      previousArrears: 0,
      previousArrearsNote: '',
    });

    if (prevAmt > 0) {
      try {
        confetti({ particleCount: 40, spread: 50, origin: { y: 0.7 } });
      } catch {}
      onAddTransaction({
        date: new Date().toISOString().slice(0, 10),
        type: 'masuk',
        pool: 'Kas Utama',
        category: 'Iuran Warga',
        description: `Pelunasan Tunggakan Sebelumnya Blok ${house.blockNumber} (${house.headName})${
          house.previousArrearsNote ? ` - ${house.previousArrearsNote}` : ''
        }`,
        amount: prevAmt,
      });
    }
  };

  const handleOpenPartialPay = (item: typeof arrearsList[0]) => {
    setPartialPayItem(item);
    setPartialAmount(Math.min(25000, item.totalArrears));
    setPartialNote('');
  };

  const handleSavePartialPay = (e: React.FormEvent) => {
    e.preventDefault();
    if (!partialPayItem) return;

    const payVal = Math.max(1000, Number(partialAmount) || 0);
    if (payVal <= 0) return;

    let remainingPayment = payVal;
    const house: ResidentHouse = { ...partialPayItem.house };
    const todayStr = new Date().toISOString().slice(0, 10);

    // 1. Potong Tunggakan Bulan / Tahun Lalu terlebih dahulu
    if (remainingPayment > 0 && (house.previousArrears || 0) > 0) {
      const deductPrev = Math.min(remainingPayment, house.previousArrears);
      house.previousArrears -= deductPrev;
      remainingPayment -= deductPrev;

      onAddTransaction({
        date: todayStr,
        type: 'masuk',
        pool: 'Kas Utama',
        category: 'Iuran Warga',
        description: `Cicilan / Pembayaran Tunggakan Lalu Blok ${house.blockNumber} (${house.duesHeadNameOverride || house.headName})${
          partialNote ? ` - ${partialNote}` : ''
        }`,
        amount: deductPrev,
      });
    }

    // 2. Potong Denda Baksos (per kelipatan Rp 10.000 jika cukup)
    if (remainingPayment >= 10000 && partialPayItem.unpaidBaksosList.length > 0) {
      for (const agenda of partialPayItem.unpaidBaksosList) {
        if (remainingPayment >= 10000) {
          onMarkFinePaid(agenda.id, house.id, house.duesHeadNameOverride || house.headName, house.blockNumber);
          remainingPayment -= 10000;
        }
      }
    }

    // 3. Potong Iuran Bulan Berjalan & Hitung Kelebihan Bayar (jika bayar lebih dari bulan berjalan)
    if (remainingPayment > 0) {
      const nominal = partialPayItem.houseMonthlyNominal;
      const alreadyPaidThisMonth =
        house.duesStatus === 'Lunas' || house.duesStatus === 'Bayar Lebih'
          ? nominal + (house.duesPrepaidBalance || 0)
          : house.duesPaidAmount || 0;
      const totalAccumulated = alreadyPaidThisMonth + remainingPayment;

      if (totalAccumulated > nominal) {
        const extraBalance = totalAccumulated - nominal;
        const estimatedMonths = Math.max(2, Math.floor(totalAccumulated / (nominal || 50000)));
        house.duesStatus = 'Bayar Lebih';
        house.duesPaidAmount = 0;
        house.duesPaidMonths = estimatedMonths;
        house.duesPrepaidBalance = extraBalance;
        house.duesPaidDate = todayStr;
      } else if (totalAccumulated === nominal) {
        house.duesStatus = 'Lunas';
        house.duesPaidAmount = 0;
        house.duesPaidMonths = 1;
        house.duesPrepaidBalance = 0;
        house.duesPaidDate = todayStr;
      } else {
        house.duesStatus = 'Belum Bayar';
        house.duesPaidAmount = totalAccumulated;
        house.duesPaidDate = todayStr;
      }

      const payerName = house.duesHeadNameOverride || house.headName;
      onAddTransaction({
        date: todayStr,
        type: 'masuk',
        pool: 'Kas Utama',
        category: 'Iuran Warga',
        description:
          totalAccumulated > nominal
            ? `Pembayaran Iuran & Lebih Bayar Blok ${house.blockNumber} (${payerName})${
                partialNote ? ` - ${partialNote}` : ''
              }`
            : `Pembayaran Iuran Blok ${house.blockNumber} (${payerName})${
                partialNote ? ` - ${partialNote}` : ''
              }`,
        amount: remainingPayment,
      });
    }

    onUpdateResident(house);
    setPartialPayItem(null);

    try {
      confetti({ particleCount: 40, spread: 55, origin: { y: 0.7 } });
    } catch {}
  };

  const handlePayAllArrears = (item: typeof arrearsList[0]) => {
    const payerName = item.house.duesHeadNameOverride || item.house.headName;
    if (item.duesArrears > 0) {
      onAddTransaction({
        date: new Date().toISOString().slice(0, 10),
        type: 'masuk',
        pool: 'Kas Utama',
        category: 'Iuran Warga',
        description: `Pelunasan Iuran Bulanan Blok ${item.house.blockNumber} (${payerName})`,
        amount: item.duesArrears,
      });
    }

    item.unpaidBaksosList.forEach((agenda) => {
      onMarkFinePaid(agenda.id, item.house.id, payerName, item.house.blockNumber);
    });

    if (item.previousArrears > 0) {
      onAddTransaction({
        date: new Date().toISOString().slice(0, 10),
        type: 'masuk',
        pool: 'Kas Utama',
        category: 'Iuran Warga',
        description: `Pelunasan Tunggakan Sebelumnya Blok ${item.house.blockNumber} (${payerName})`,
        amount: item.previousArrears,
      });
    }

    onUpdateResident({
      ...item.house,
      duesStatus: 'Lunas',
      duesPaidAmount: 0,
      duesPaidDate:
        item.duesArrears > 0
          ? new Date().toISOString().slice(0, 10)
          : item.house.duesPaidDate,
      previousArrears: 0,
    });

    try {
      confetti({ particleCount: 60, spread: 70, origin: { y: 0.65 } });
    } catch {}
  };

  const handleSendWAReminder = (item: typeof arrearsList[0]) => {
    if (!isAdmin) return;
    const payerName = item.house.duesHeadNameOverride || item.house.headName;
    const prevNoteStr = item.previousArrearsNote ? ` (${item.previousArrearsNote})` : '';
    const text =
      `Halo Bpk/Ibu *${payerName}* (Blok ${item.house.blockNumber}),\n` +
      `Salam hangat dan rukun warga Gang Mandor.\n\n` +
      `Kami dari pengurus menyampaikan rincian catatan tunggakan iuran & denda gang sebagai berikut:\n` +
      `• Iuran Kas/Sampah (${item.house.duesMonthNote || config.duesCurrentMonth || 'Bulan Ini'}): ${formatRupiah(item.duesArrears)}\n` +
      `• Denda Baksos (${item.unpaidBaksosList.length}x): ${formatRupiah(item.baksosFineArrears)}\n` +
      `• Tunggakan Bulan/Tahun Lalu: ${formatRupiah(item.previousArrears)}${prevNoteStr}\n` +
      `────────────────────\n` +
      `*Total Tunggakan: ${formatRupiah(item.totalArrears)}*\n\n` +
      `Pembayaran dapat dilakukan secara penuh maupun dicicil sebagian melalui bendahara gang. Terima kasih atas kerja sama dan kepedulian Bpk/Ibu.`;
    openWhatsAppShare(text, item.house.phone);
  };

  const handleShareSummaryWA = () => {
    if (!isAdmin) return;
    let text =
      `📋 *REKAP DAFTAR TUNGGAKAN WARGA GANG MANDOR*\n` +
      `Total Tertunggak: *${formatRupiah(totalAllArrears)}* (${housesWithArrears.length} Rumah)\n\n`;

    housesWithArrears.forEach((item) => {
      const payerName = item.house.duesHeadNameOverride || item.house.headName;
      const note = item.previousArrearsNote ? ` — Ket: ${item.previousArrearsNote}` : '';
      text += `• Blok ${item.house.blockNumber} (${payerName}): ${formatRupiah(item.totalArrears)}${note}\n`;
    });

    text += `\n_Mohon kerja sama warga untuk tertib administrasi demi kemajuan bersama._`;
    openWhatsAppShare(text);
  };

  const billableHouses = useMemo(
    () =>
      housesWithArrears.filter(
        (item) => item.house.phone && item.house.phone.replace(/[^0-9]/g, '').length >= 7
      ),
    [housesWithArrears]
  );

  const unbillableHouses = useMemo(
    () =>
      housesWithArrears.filter(
        (item) => !item.house.phone || item.house.phone.replace(/[^0-9]/g, '').length < 7
      ),
    [housesWithArrears]
  );

  const generateSingleBillingMessage = (item: typeof arrearsList[0]) => {
    const payerName = item.house.duesHeadNameOverride || item.house.headName;
    const prevNoteStr = item.previousArrearsNote ? ` (${item.previousArrearsNote})` : '';
    const monthStr = item.house.duesMonthNote || config.duesCurrentMonth || 'Bulan Berjalan';
    return (
      `Halo Bpk/Ibu *${payerName}* (Blok ${item.house.blockNumber}),\n` +
      `Salam hangat dan rukun warga Gang Mandor.\n\n` +
      `Kami dari pengurus menyampaikan rincian catatan tagihan kas/iuran gang yang perlu diselesaikan:\n` +
      `• Iuran Kas/Sampah (${monthStr}): ${formatRupiah(item.duesArrears)}\n` +
      `• Denda Baksos (${item.unpaidBaksosList.length}x): ${formatRupiah(item.baksosFineArrears)}\n` +
      `• Tunggakan Bulan/Tahun Lalu: ${formatRupiah(item.previousArrears)}${prevNoteStr}\n` +
      `────────────────────\n` +
      `*Total Tagihan: ${formatRupiah(item.totalArrears)}*\n\n` +
      (bankInfo ? `💳 *Penyaluran Pembayaran:*\n${bankInfo}\n` : '') +
      (deadlineNote ? `⏰ *Batas Waktu:* ${deadlineNote}\n\n` : '\n') +
      `Pembayaran dapat ditransfer atau diserahkan tunai melalui bendahara gang. Mohon konfirmasi bukti transfer jika sudah membayar.\n\n` +
      `Terima kasih atas partisipasi dan kepedulian Bpk/Ibu untuk kemajuan lingkungan Gang Mandor.`
    );
  };

  const generateFullGroupBroadcast = () => {
    const monthStr = config.duesCurrentMonth || 'Oktober 2026';
    let text =
      `📢 *PEMBERITAHUAN PENARIKAN IURAN & TAGIHAN WARGA GANG MANDOR*\n` +
      `Periode: *${monthStr}*\n` +
      `Total Tunggakan: *${formatRupiah(totalAllArrears)}* (${housesWithArrears.length} Rumah Tertunggak)\n\n` +
      `Yth. Seluruh Warga Gang Mandor Blok K2/25 s/d K3/24,\n` +
      `Demi kelancaran operasional kebersihan, keamanan, penerangan jalan, dan kas bersama gang, berikut kami sampaikan rekapitulasi tagihan yang belum terselesaikan:\n\n`;

    housesWithArrears.forEach((item, idx) => {
      const payerName = item.house.duesHeadNameOverride || item.house.headName;
      const details = [];
      if (item.duesArrears > 0) details.push(`Iuran: ${formatRupiah(item.duesArrears)}`);
      if (item.baksosFineArrears > 0) details.push(`Denda: ${formatRupiah(item.baksosFineArrears)}`);
      if (item.previousArrears > 0) details.push(`Lalu: ${formatRupiah(item.previousArrears)}`);
      const detailStr = details.length > 0 ? ` (${details.join(', ')})` : '';

      text += `${idx + 1}. *Blok ${item.house.blockNumber}* - ${payerName}: *${formatRupiah(item.totalArrears)}*${detailStr}\n`;
    });

    text +=
      `\n────────────────────\n` +
      (bankInfo ? `💳 *Penyaluran Pembayaran:*\n${bankInfo}\n\n` : '\n') +
      (deadlineNote ? `⏰ *Batas Waktu:* ${deadlineNote}\n\n` : '') +
      `Warga yang sudah transfer dimohon untuk mengirimkan bukti transfer ke Bendahara Gang agar status dapat langsung diperbarui menjadi *Lunas* di Portal Resmi Warga.\n\n` +
      `Atas perhatian, kebersamaan, dan kerja sama seluruh warga, kami haturkan terima kasih. 🙏✨\n` +
      `_Pengurus RT/RW Gang Mandor Blok K2/25 - K3/24_`;

    return text;
  };

  // Timer auto-sender runner
  useEffect(() => {
    let timer: any = null;
    if (isRunnerActive && isBatchBillingModalOpen && billableHouses.length > 0) {
      if (runnerIndex >= billableHouses.length) {
        setIsRunnerActive(false);
        try {
          confetti({ particleCount: 70, spread: 80, origin: { y: 0.6 } });
        } catch {}
        return;
      }

      timer = setInterval(() => {
        setCountdown((prev) => {
          if (prev <= 1) {
            const target = billableHouses[runnerIndex];
            if (target) {
              const msg = generateSingleBillingMessage(target);
              openWhatsAppShare(msg, target.house.phone);
              setSentHouseIds((old) => ({ ...old, [target.house.id]: true }));
            }

            if (runnerIndex + 1 < billableHouses.length) {
              setRunnerIndex((r) => r + 1);
              return runnerDelay;
            } else {
              setIsRunnerActive(false);
              try {
                confetti({ particleCount: 80, spread: 90, origin: { y: 0.6 } });
              } catch {}
              return 0;
            }
          }
          return prev - 1;
        });
      }, 1000);
    }

    return () => {
      if (timer) clearInterval(timer);
    };
  }, [
    isRunnerActive,
    isBatchBillingModalOpen,
    runnerIndex,
    billableHouses,
    runnerDelay,
    bankInfo,
    deadlineNote,
    config.duesCurrentMonth,
  ]);

  const handleSendCurrentAndNext = () => {
    if (runnerIndex >= billableHouses.length) return;
    const target = billableHouses[runnerIndex];
    const msg = generateSingleBillingMessage(target);
    openWhatsAppShare(msg, target.house.phone);
    setSentHouseIds((old) => ({ ...old, [target.house.id]: true }));

    if (runnerIndex + 1 < billableHouses.length) {
      setRunnerIndex(runnerIndex + 1);
      setCountdown(runnerDelay);
    } else {
      setIsRunnerActive(false);
      try {
        confetti({ particleCount: 80, spread: 90, origin: { y: 0.6 } });
      } catch {}
    }
  };

  const handleCopyBroadcastText = (text: string) => {
    try {
      navigator.clipboard.writeText(text);
      setCopiedBroadcast(true);
      setTimeout(() => setCopiedBroadcast(false), 2500);
    } catch {
      const textarea = document.createElement('textarea');
      textarea.value = text;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
      setCopiedBroadcast(true);
      setTimeout(() => setCopiedBroadcast(false), 2500);
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-300">
      {/* Top Banner Overview with Options Below Description */}
      <div className="bg-gradient-to-r from-rose-50/90 via-orange-50/70 to-amber-50/80 dark:from-slate-900 dark:via-rose-950/50 dark:to-amber-950/40 rounded-2xl p-6 border border-rose-200 border-t-4 border-t-rose-500 shadow-xs space-y-4">
        {/* Row 1: Judul & Deskripsi Penuh */}
        <div>
          {(config.arrearsSectionTitle ?? 'Ringkasan Rekapitulasi Daftar Tunggakan Warga') && (
            <div className="flex items-center gap-2.5">
              <div className="p-2 bg-gradient-to-br from-rose-500 to-orange-600 text-white rounded-xl shadow-xs shrink-0">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <h2 className="text-lg sm:text-xl font-bold text-slate-900 tracking-tight">
                {config.arrearsSectionTitle !== undefined
                  ? config.arrearsSectionTitle
                  : 'Ringkasan Rekapitulasi Daftar Tunggakan Warga'}
              </h2>
            </div>
          )}
          {(config.arrearsSectionDescription ??
            'Data tunggakan bersumber otomatis dari integrasi belum bayar iuran kas, denda baksos (Rp 10.000/ketidakhadiran), serta tunggakan bulan/tahun sebelumnya beserta keterangannya.') && (
            <p className="text-xs sm:text-sm text-slate-600 max-w-4xl mt-2 leading-relaxed">
              {config.arrearsSectionDescription !== undefined
                ? config.arrearsSectionDescription
                : 'Data tunggakan bersumber otomatis dari integrasi belum bayar iuran kas, denda baksos (Rp 10.000/ketidakhadiran), serta tunggakan bulan/tahun sebelumnya beserta keterangannya.'}
            </p>
          )}
        </div>

        {/* Row 2: Pilihan / Tombol Aksi Berada di Bawah Deskripsi */}
        {isAdmin && (
          <div className="pt-3 border-t border-rose-200/70 dark:border-rose-900/60 flex flex-wrap items-center gap-2">
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
              className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold bg-gradient-to-r from-indigo-600 to-teal-600 hover:from-indigo-500 hover:to-teal-500 text-white rounded-xl shadow-xs transition-all cursor-pointer whitespace-nowrap"
              title="Download Excel (.xlsx) Semua Laporan Keuangan & Rincian Tunggakan"
            >
              <FileSpreadsheet className="w-3.5 h-3.5 text-amber-300" />
              <span>Export Excel Keuangan & Tunggakan</span>
            </button>

            {/* Tombol Utama: Penarikan Tagihan Otomatis Massal via WhatsApp (Semua Warga Sekaligus) */}
            <button
              type="button"
              onClick={() => {
                setIsBatchBillingModalOpen(true);
                setBatchBillingTab('runner');
                setRunnerIndex(0);
                setIsRunnerActive(false);
                setCountdown(runnerDelay);
              }}
              className="flex items-center gap-2 px-4 py-2 text-xs font-black bg-gradient-to-r from-emerald-600 via-teal-600 to-green-600 hover:from-emerald-500 hover:to-green-500 text-white rounded-xl shadow-md shadow-emerald-600/30 transition-all cursor-pointer whitespace-nowrap min-h-[38px] ring-2 ring-emerald-300"
              title="Tarik Tagihan Otomatis Sekaligus via WhatsApp (Semua Warga)"
            >
              <Zap className="w-4 h-4 text-amber-300 animate-pulse" />
              <span>⚡ Tarik Tagihan Otomatis Massal ({housesWithArrears.length})</span>
            </button>

            <button
              type="button"
              onClick={handleShareSummaryWA}
              className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold bg-gradient-to-r from-rose-600 to-orange-600 hover:from-rose-500 hover:to-orange-500 text-white rounded-xl shadow-xs transition-all cursor-pointer whitespace-nowrap"
            >
              <Send className="w-3.5 h-3.5" />
              <span>Kirim Rekap Tagihan ke WA</span>
            </button>

            {onOpenConfigModal && (
              <button
                type="button"
                onClick={onOpenConfigModal}
                className="p-2 text-slate-500 hover:text-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg cursor-pointer ml-auto"
                title="Edit / Hapus Judul & Deskripsi Tunggakan"
              >
                <Edit2 className="w-4 h-4" />
              </button>
            )}
          </div>
        )}
      </div>

      {/* Colorful Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-gradient-to-br from-rose-500 via-rose-600 to-red-700 text-white p-5 rounded-2xl shadow-md shadow-rose-600/15">
          <span className="text-xs font-semibold text-rose-100 uppercase tracking-wider block">
            Total Seluruh Tunggakan
          </span>
          <div className="mt-2 text-2xl sm:text-3xl font-extrabold font-mono tracking-tight tabular-nums">
            {formatRupiah(totalAllArrears)}
          </div>
          <span className="text-xs text-rose-100 mt-1 block">
            Dari {housesWithArrears.length} rumah yang memiliki tanggungan
          </span>
        </div>

        <div className="bg-gradient-to-br from-amber-500 via-orange-500 to-amber-700 text-white p-5 rounded-2xl shadow-md shadow-amber-500/15">
          <span className="text-xs font-semibold text-amber-100 uppercase tracking-wider block">
            Tunggakan Iuran Bulan Ini
          </span>
          <div className="mt-2 text-2xl font-extrabold font-mono tracking-tight tabular-nums">
            {formatRupiah(
              arrearsList.reduce((acc, curr) => acc + curr.duesArrears, 0)
            )}
          </div>
          <span className="text-xs text-amber-100 mt-1 block">
            {arrearsList.filter((a) => a.duesArrears > 0).length} rumah belum lunas iuran berjalan
          </span>
        </div>

        <div className="bg-gradient-to-br from-purple-600 via-violet-600 to-indigo-800 text-white p-5 rounded-2xl shadow-md shadow-purple-600/15">
          <span className="text-xs font-semibold text-purple-100 uppercase tracking-wider block">
            Denda Baksos & Tunggakan Lalu
          </span>
          <div className="mt-2 text-2xl font-extrabold font-mono tracking-tight tabular-nums">
            {formatRupiah(
              arrearsList.reduce(
                (acc, curr) => acc + curr.baksosFineArrears + curr.previousArrears,
                0
              )
            )}
          </div>
          <span className="text-xs text-purple-100 mt-1 block">
            Akumulasi denda baksos & sisa bulan/tahun lalu
          </span>
        </div>
      </div>

      {/* Arrears Detailed Table */}
      <div className="bg-gradient-to-br from-rose-50/60 via-amber-50/40 to-orange-50/50 dark:from-slate-900 dark:to-rose-950/30 rounded-2xl border border-rose-200 dark:border-rose-800/60 overflow-hidden shadow-md">
        <div className="p-4 sm:p-5 bg-gradient-to-r from-rose-600 via-orange-600 to-amber-600 text-white flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h3 className="font-bold text-sm sm:text-base text-white">
              Daftar Rincian Tunggakan Per Rumah (Blok K2/25 - K3/24)
            </h3>
            <span className="text-xs text-amber-100">
              Otomatis terakumulasi & tersinkronisasi dengan Kas Utama
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2" />
              <input
                type="text"
                placeholder="Cari blok / warga..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-8 pr-3 py-1 text-xs bg-white border border-white/40 text-slate-800 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-300 shadow-2xs"
              />
            </div>

            <div className="flex items-center gap-1.5 px-3 py-1.5 bg-black/20 backdrop-blur-xs rounded-xl text-xs font-bold text-amber-200 border border-white/10 shadow-2xs whitespace-nowrap">
              <AlertTriangle className="w-3.5 h-3.5 text-amber-300" />
              <span>Khusus Data Tunggakan ({housesWithArrears.length} Rumah)</span>
            </div>
          </div>
        </div>

        {/* View Mode 1: Mobile Card View for Handphones (Zero horizontal table squeeze) */}
        <div className="md:hidden divide-y divide-rose-200/80">
          {filteredDelinquentList.length === 0 ? (
            <div className="p-8 text-center bg-white/70 text-slate-600 font-medium text-xs">
              🎉 Tidak ada data warga yang menunggak {searchQuery ? 'dengan kata kunci pencarian ini' : '(Seluruh KK Tertib & Lunas)'}.
            </div>
          ) : (
            filteredDelinquentList.map((item, idx) => {
              const isVacant = isHouseVacant(item.house);
              const hasDebt = item.totalArrears > 0;
              const paidPartialDues = item.house.duesPaidAmount || 0;
              const payerName = item.house.duesHeadNameOverride || item.house.headName;

              return (
                <div
                  key={item.house.id}
                  className={`p-4 space-y-3 transition-colors ${
                    isVacant
                      ? 'bg-slate-100/95 text-slate-600 border border-slate-300 rounded-xl my-1'
                      : hasDebt
                      ? 'bg-rose-50/40'
                      : 'bg-white/80'
                  }`}
                >
                  {/* Card Header */}
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs font-bold text-slate-400">
                        #{idx + 1}
                      </span>
                      <span
                        className={`px-2.5 py-1 rounded-lg font-mono font-black text-xs shadow-2xs ${
                          isVacant ? 'bg-slate-500 text-white' : 'bg-emerald-600 text-white'
                        }`}
                      >
                        Blok {item.house.blockNumber}
                      </span>
                      <div>
                        <h4
                          className={`font-extrabold text-sm leading-tight flex flex-wrap items-center gap-1.5 ${
                            isVacant ? 'text-slate-700 italic' : 'text-slate-900'
                          }`}
                        >
                          <span>{payerName}</span>
                          {item.house.duesHeadNameOverride && (
                            <span className="text-[10px] font-normal text-amber-700 bg-amber-100 px-1.5 py-0.5 rounded border border-amber-300">
                              Induk: {item.house.headName}
                            </span>
                          )}
                        </h4>
                        <span className="text-[11px] text-slate-500">
                          {item.house.ownership} · {item.house.occupancy}
                        </span>
                      </div>
                    </div>

                    <div className="text-right">
                      <span
                        className={`inline-block px-2 py-0.5 rounded-md text-[11px] font-bold ${
                          isVacant
                            ? 'bg-slate-200 text-slate-700 border border-slate-300'
                            : hasDebt
                            ? 'bg-rose-100 text-rose-700 border border-rose-300'
                            : 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                        }`}
                      >
                        {isVacant ? 'Kosong (Bebas Iuran)' : hasDebt ? 'Tertunggak' : 'Lunas'}
                      </span>
                      <div className="mt-1 font-mono font-black text-sm tabular-nums">
                        {hasDebt ? (
                          <span className="text-rose-700">{formatRupiah(item.totalArrears)}</span>
                        ) : (
                          <span className="text-emerald-700">Rp 0</span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Arrears Breakdown Grid */}
                  <div className="grid grid-cols-2 gap-2 p-2.5 rounded-xl bg-slate-50 border border-slate-200/80 text-xs">
                    <div>
                      <span className="text-slate-500 text-[11px] block">Iuran Bulan Ini:</span>
                      {item.house.occupancy === 'Kosong' ? (
                        <span className="text-slate-400 italic text-[11px]">Kosong</span>
                      ) : item.duesArrears > 0 ? (
                        <div>
                          <strong className="text-rose-600 font-mono">
                            {formatRupiah(item.duesArrears)}
                          </strong>
                          {paidPartialDues > 0 && (
                            <span className="block text-[10px] text-amber-700">
                              (Cicil {formatRupiah(paidPartialDues)})
                            </span>
                          )}
                        </div>
                      ) : (
                        <span className="text-emerald-700 font-medium">Rp 0 (Lunas)</span>
                      )}
                    </div>

                    <div>
                      <span className="text-slate-500 text-[11px] block">Denda Baksos:</span>
                      {item.baksosFineArrears > 0 ? (
                        <strong className="text-amber-700 font-mono">
                          {formatRupiah(item.baksosFineArrears)} ({item.unpaidBaksosList.length}x)
                        </strong>
                      ) : (
                        <span className="text-slate-400">Rp 0</span>
                      )}
                    </div>

                    <div className="col-span-2 pt-1 border-t border-slate-200/60 flex items-center justify-between">
                      <div>
                        <span className="text-slate-500 text-[11px]">Tunggakan Lalu:</span>{' '}
                        <strong
                          className={
                            item.previousArrears > 0
                              ? 'text-rose-700 font-mono'
                              : 'text-slate-400 font-mono'
                          }
                        >
                          {formatRupiah(item.previousArrears)}
                        </strong>
                        {item.previousArrearsNote && (
                          <span className="text-[11px] text-slate-500 italic ml-1.5">
                            ({item.previousArrearsNote})
                          </span>
                        )}
                      </div>
                      {isAdmin && (
                        <button
                          type="button"
                          onClick={() => handleOpenEditPrev(item.house)}
                          className="text-[11px] text-emerald-700 hover:text-emerald-800 underline font-semibold cursor-pointer"
                        >
                          Edit Lalu
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Admin Touch Actions on Handphone */}
                  {isAdmin && (
                    <div className="flex flex-wrap items-center gap-1.5 pt-1">
                      {hasDebt && (
                        <>
                          <button
                            type="button"
                            onClick={() => handleSendWAReminder(item)}
                            className="flex-1 flex items-center justify-center gap-1.5 py-2 px-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-2xs transition-all cursor-pointer min-h-[38px]"
                          >
                            <MessageCircle className="w-3.5 h-3.5" />
                            <span>Tagih WA</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => handleOpenPartialPay(item)}
                            className="flex-1 flex items-center justify-center gap-1.5 py-2 px-3 bg-amber-500 hover:bg-amber-600 text-white rounded-xl text-xs font-bold shadow-2xs transition-all cursor-pointer min-h-[38px]"
                          >
                            <Banknote className="w-3.5 h-3.5" />
                            <span>Cicil</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => handlePayAllArrears(item)}
                            className="flex-1 py-2 px-3 bg-teal-600 hover:bg-teal-700 text-white rounded-xl text-xs font-bold shadow-2xs transition-all cursor-pointer min-h-[38px]"
                          >
                            Lunaskan
                          </button>
                        </>
                      )}
                      {item.previousArrears > 0 && (
                        <button
                          type="button"
                          onClick={() => handleResetPrev(item.house)}
                          className="py-2 px-3 bg-rose-50 text-rose-600 hover:bg-rose-100 border border-rose-200 rounded-xl text-xs font-bold transition-colors cursor-pointer min-h-[38px]"
                          title="Hapus Tunggakan Bulan Lalu"
                        >
                          Hapus Lalu
                        </button>
                      )}
                    </div>
                  )}
                </div>
              );
            }))}
        </div>

        {/* View Mode 2: Desktop & Tablet Spread Table (>= 768px) */}
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse whitespace-nowrap">
            <thead>
              <tr className="bg-slate-100/80 border-b border-slate-200 text-slate-700 font-bold">
                <th className="py-3 px-3 w-10 text-center">No</th>
                <th className="py-3 px-3">No Blok</th>
                <th className="py-3 px-3">Kepala Keluarga</th>
                <th className="py-3 px-3 text-right">Iuran Bulan Ini</th>
                <th className="py-3 px-3 text-right">Denda Baksos</th>
                <th className="py-3 px-3 text-right">Tunggakan Bulan/Thn Lalu</th>
                <th className="py-3 px-3">Keterangan Tunggakan Lalu</th>
                <th className="py-3 px-3 text-right">Total Tunggakan</th>
                <th className="py-3 px-3 text-center">Status</th>
                {isAdmin && (
                  <th className="py-3 px-3 text-center">
                    Aksi Pengurus (Cicil / Lunas / WA)
                  </th>
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredDelinquentList.length === 0 ? (
                <tr>
                  <td
                    colSpan={isAdmin ? 10 : 9}
                    className="py-10 text-center text-slate-500 font-medium bg-white/60"
                  >
                    🎉 Tidak ada data warga yang menunggak {searchQuery ? 'dengan kata kunci pencarian ini' : '(Seluruh KK Tertib & Lunas)'}.
                  </td>
                </tr>
              ) : (
                filteredDelinquentList.map((item, idx) => {
                  const isVacant = isHouseVacant(item.house);
                  const hasDebt = item.totalArrears > 0;
                  const paidPartialDues = item.house.duesPaidAmount || 0;
                  const payerName = item.house.duesHeadNameOverride || item.house.headName;

                  return (
                    <tr
                      key={item.house.id}
                      className={`transition-colors ${
                        isVacant
                          ? 'bg-slate-100/90 text-slate-600 hover:bg-slate-200/50'
                          : hasDebt
                          ? 'bg-rose-50/25 hover:bg-rose-50/50'
                          : 'hover:bg-slate-50'
                      }`}
                    >
                      <td className="py-3 px-3 text-center text-slate-400 font-mono tabular-nums">
                        {idx + 1}
                      </td>
                      <td className="py-3 px-3 font-bold font-mono">
                        <span
                          className={
                            isVacant
                              ? 'px-2 py-0.5 rounded bg-slate-500 text-white text-xs'
                              : 'text-emerald-800'
                          }
                        >
                          Blok {item.house.blockNumber}
                        </span>
                      </td>
                      <td
                        className={`py-3 px-3 font-semibold ${
                          isVacant ? 'text-slate-600 italic' : 'text-slate-800'
                        }`}
                      >
                        <div className="flex flex-col">
                          <span>{payerName}</span>
                          {item.house.duesHeadNameOverride && (
                            <span className="text-[10px] font-normal text-amber-700">
                              Buku Induk: {item.house.headName}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="py-3 px-3 text-right font-mono tabular-nums">
                        {item.house.occupancy === 'Kosong' ? (
                          <span className="text-slate-400 italic">
                            Tanpa Iuran Rutin (Kosong)
                          </span>
                        ) : item.duesArrears > 0 ? (
                          <div>
                            <span className="text-rose-600 font-semibold">
                              {formatRupiah(item.duesArrears)}
                            </span>
                            {paidPartialDues > 0 && (
                              <span className="block text-[10px] text-amber-700">
                                Dicicil {formatRupiah(paidPartialDues)}
                              </span>
                            )}
                          </div>
                        ) : item.house.duesStatus === 'Bayar Lebih' ? (
                          <div>
                            <span className="text-indigo-700 font-bold">
                              Rp 0 (Bayar Lebih {item.house.duesPaidMonths || 2} Bln)
                            </span>
                            {(item.house.duesPrepaidBalance || 0) > 0 && (
                              <span className="block text-[10px] text-emerald-700">
                                Deposit +{formatRupiah(item.house.duesPrepaidBalance || 0)}
                              </span>
                            )}
                          </div>
                        ) : (
                          <span className="text-emerald-600 font-medium">Rp 0 (Lunas)</span>
                        )}
                      </td>
                      <td className="py-3 px-3 text-right font-mono tabular-nums">
                        {item.baksosFineArrears > 0 ? (
                          <span className="text-amber-700 font-semibold">
                            {formatRupiah(item.baksosFineArrears)} ({item.unpaidBaksosList.length}x)
                          </span>
                        ) : (
                          <span className="text-slate-400">Rp 0</span>
                        )}
                      </td>
                      <td className="py-3 px-3 text-right font-mono tabular-nums">
                        <div className="flex items-center justify-end gap-1">
                          <span
                            className={
                              item.previousArrears > 0
                                ? 'text-rose-700 font-bold'
                                : 'text-slate-400'
                            }
                          >
                            {formatRupiah(item.previousArrears)}
                          </span>
                          {isAdmin && (
                            <button
                              type="button"
                              onClick={() => handleOpenEditPrev(item.house)}
                              className="p-1 text-slate-400 hover:text-emerald-700 rounded transition-colors cursor-pointer"
                              title="Edit Nominal & Keterangan Tunggakan Lalu"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </td>
                      <td className="py-3 px-3 max-w-[220px] truncate">
                        {item.previousArrearsNote ? (
                          <span className="text-slate-700 italic flex items-center gap-1">
                            <FileText className="w-3 h-3 text-amber-600 shrink-0" />
                            <span className="truncate">{item.previousArrearsNote}</span>
                          </span>
                        ) : (
                          <span className="text-slate-400">-</span>
                        )}
                      </td>
                      <td className="py-3 px-3 text-right font-mono font-black text-sm tabular-nums">
                        {hasDebt ? (
                          <span className="text-rose-700">{formatRupiah(item.totalArrears)}</span>
                        ) : (
                          <span className="text-emerald-700">Rp 0</span>
                        )}
                      </td>
                      <td className="py-3 px-3 text-center">
                        {hasDebt ? (
                          <span className="font-bold text-rose-600">
                            Tertunggak
                          </span>
                        ) : (
                          <span className="font-bold text-emerald-700">
                            Lunas
                          </span>
                        )}
                      </td>
                      {isAdmin && (
                        <td className="py-3 px-3 text-center">
                          <div className="flex items-center justify-center gap-1.5">
                            {hasDebt && (
                              <>
                                <button
                                  type="button"
                                  onClick={() => handleSendWAReminder(item)}
                                  className="flex items-center gap-1 px-2.5 py-1 bg-emerald-50 text-emerald-800 hover:bg-emerald-100 border border-emerald-300 rounded-lg text-[11px] font-semibold transition-colors cursor-pointer"
                                  title="Kirim Tagihan WhatsApp (Khusus Pengurus)"
                                >
                                  <MessageCircle className="w-3.5 h-3.5 text-emerald-600" />
                                  <span>Tagih WA</span>
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleOpenPartialPay(item)}
                                  className="flex items-center gap-1 px-2.5 py-1 bg-amber-500 hover:bg-amber-600 text-white rounded-lg text-[11px] font-semibold transition-colors cursor-pointer shadow-2xs"
                                  title="Bayar Sebagian / Cicil Tunggakan Rumah Ini"
                                >
                                  <Banknote className="w-3.5 h-3.5" />
                                  <span>Bayar Sebagian</span>
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handlePayAllArrears(item)}
                                  className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-[11px] font-semibold transition-colors cursor-pointer shadow-2xs"
                                  title="Tandai Seluruh Tunggakan Lunas & Masukkan ke Kas"
                                >
                                  Lunaskan
                                </button>
                              </>
                            )}
                            {item.previousArrears > 0 && (
                              <button
                                type="button"
                                onClick={() => handleResetPrev(item.house)}
                                className="p-1 text-rose-500 hover:text-rose-700 hover:bg-rose-50 rounded transition-colors cursor-pointer"
                                title="Hapus Tunggakan Bulan Lalu"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                        </td>
                      )}
                    </tr>
                  );
                }))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal Edit Tunggakan Bulan/Tahun Sebelumnya beserta Keterangan */}
      {editingHouse && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs">
          <div className="bg-white rounded-2xl shadow-xl border border-slate-200 w-full max-w-md overflow-hidden">
            <div className="bg-gradient-to-r from-emerald-600 to-teal-700 p-4 text-white flex justify-between items-center">
              <h4 className="font-bold text-sm">
                Edit Tunggakan Bulan/Thn Lalu: Blok {editingHouse.blockNumber}
              </h4>
              <button
                type="button"
                onClick={() => setEditingHouse(null)}
                className="text-white/80 hover:text-white cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={handleSavePrev} className="p-5 space-y-4">
              <div>
                <p className="text-xs text-slate-500 mb-2">
                  Warga: <strong>{editingHouse.headName}</strong>
                </p>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Nominal Tunggakan Bulan / Tahun Lalu (Rp)
                </label>
                <input
                  type="number"
                  min={0}
                  step={5000}
                  value={editPrevAmount}
                  onChange={(e) => setEditPrevAmount(Number(e.target.value))}
                  className="w-full px-3 py-2 text-sm font-mono border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                  autoFocus
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Keterangan Tunggakan Bulan / Tahun Lalu
                </label>
                <input
                  type="text"
                  placeholder="Misal: Sisa iuran Agt & Sep 2026 / Belum bayar kas 2 bulan..."
                  value={editPrevNote}
                  onChange={(e) => setEditPrevNote(e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                />
                <span className="text-[11px] text-slate-400 block mt-1">
                  *Keterangan ini tampil di tabel tunggakan dan otomatis disertakan pada pesan tagihan WA pengurus.
                </span>
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setEditingHouse(null)}
                  className="px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-100 rounded-lg cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 text-xs bg-emerald-600 hover:bg-emerald-700 text-white font-semibold rounded-lg cursor-pointer"
                >
                  Simpan Perubahan
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Pembayaran Sebagian (Cicilan) Tunggakan Per Rumah */}
      {partialPayItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs">
          <div className="bg-white rounded-2xl shadow-xl border border-slate-200 w-full max-w-md overflow-hidden">
            <div className="bg-gradient-to-r from-amber-500 to-orange-600 p-4 text-white flex justify-between items-center">
              <div>
                <h4 className="font-bold text-sm">
                  Pembayaran Sebagian (Cicil) Tunggakan
                </h4>
                <p className="text-[11px] text-amber-100">
                  Blok {partialPayItem.house.blockNumber} — {partialPayItem.house.headName}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setPartialPayItem(null)}
                className="text-white/80 hover:text-white cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSavePartialPay} className="p-5 space-y-4">
              <div className="p-3.5 rounded-xl bg-amber-50 border border-amber-200 space-y-1 text-xs">
                <div className="flex justify-between text-slate-600">
                  <span>Tunggakan Bulan/Tahun Lalu:</span>
                  <span className="font-mono font-semibold">
                    {formatRupiah(partialPayItem.previousArrears)}
                  </span>
                </div>
                <div className="flex justify-between text-slate-600">
                  <span>Denda Bakti Sosial:</span>
                  <span className="font-mono font-semibold">
                    {formatRupiah(partialPayItem.baksosFineArrears)}
                  </span>
                </div>
                <div className="flex justify-between text-slate-600">
                  <span>Sisa Iuran Bulan Berjalan:</span>
                  <span className="font-mono font-semibold">
                    {formatRupiah(partialPayItem.duesArrears)}
                  </span>
                </div>
                <div className="pt-1.5 border-t border-amber-200 flex justify-between font-bold text-slate-900">
                  <span>Total Tanggungan Saat Ini:</span>
                  <span className="font-mono text-rose-600">
                    {formatRupiah(partialPayItem.totalArrears)}
                  </span>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Nominal yang Dibayarkan Sekarang (Rp)
                </label>
                <input
                  type="number"
                  required
                  min={1000}
                  step={1000}
                  value={partialAmount}
                  onChange={(e) => setPartialAmount(Number(e.target.value))}
                  className="w-full px-3 py-2 text-sm font-mono border border-slate-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:outline-none"
                  autoFocus
                />
                {(Number(partialAmount) || 0) > partialPayItem.totalArrears ? (
                  <span className="text-[11px] text-indigo-700 font-semibold block mt-1">
                    Kelebihan bayar{' '}
                    <strong className="font-mono">
                      +{formatRupiah((Number(partialAmount) || 0) - partialPayItem.totalArrears)}
                    </strong>{' '}
                    otomatis menjadi status <strong>Bayar Lebih (Deposit Bulan Depan)</strong> & masuk ke Kas Utama.
                  </span>
                ) : (
                  <span className="text-[11px] text-slate-500 block mt-1">
                    Sisa tunggakan setelah pembayaran ini:{' '}
                    <strong className="font-mono text-rose-600">
                      {formatRupiah(
                        Math.max(0, partialPayItem.totalArrears - (Number(partialAmount) || 0))
                      )}
                    </strong>
                  </span>
                )}
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Catatan Pembayaran (Opsional)
                </label>
                <input
                  type="text"
                  placeholder="Misal: Cicilan tahap 1 tunai ke bendahara..."
                  value={partialNote}
                  onChange={(e) => setPartialNote(e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:outline-none"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setPartialPayItem(null)}
                  className="px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-100 rounded-lg cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 text-xs bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700 text-white font-semibold rounded-lg shadow-xs cursor-pointer"
                >
                  Terima & Catat ke Kas Utama
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================
          MODAL PENARIKAN TAGIHAN OTOMATIS MASSAL VIA WHATSAPP (BATCH AUTO-BILLING)
          ======================================================================== */}
      {isBatchBillingModalOpen && (
        <div
          className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-3 sm:p-5 overflow-y-auto animate-in fade-in duration-200"
          onClick={() => {
            setIsBatchBillingModalOpen(false);
            setIsRunnerActive(false);
          }}
        >
          <div
            className="bg-white rounded-3xl max-w-3xl w-full max-h-[92vh] flex flex-col shadow-2xl border-2 border-emerald-400 overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="bg-gradient-to-r from-emerald-700 via-teal-700 to-cyan-700 text-white p-5 flex items-start justify-between gap-3 shrink-0">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-2xl bg-white/20 text-white shadow-inner shrink-0">
                  <Zap className="w-6 h-6 text-amber-300" />
                </div>
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="font-extrabold text-base sm:text-lg">
                      Penarikan Tagihan Otomatis Massal via WhatsApp
                    </h3>
                    <span className="px-2 py-0.5 rounded-full bg-amber-400 text-slate-950 font-black text-[10px] uppercase tracking-wider">
                      Khusus Pengurus
                    </span>
                  </div>
                  <p className="text-xs text-emerald-100 mt-0.5">
                    Kirim tagihan iuran kas & denda sekaligus ke seluruh warga tertunggak ({housesWithArrears.length} rumah) secara otomatis tanpa satu-satu.
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => {
                  setIsBatchBillingModalOpen(false);
                  setIsRunnerActive(false);
                }}
                className="p-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-white cursor-pointer transition-colors"
                title="Tutup"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Mode Switcher Tabs */}
            <div className="p-3 sm:p-4 bg-emerald-50/70 border-b border-emerald-200 flex flex-wrap items-center justify-between gap-2 shrink-0">
              <div className="flex items-center gap-1.5 bg-white p-1 rounded-2xl border border-emerald-200 shadow-2xs w-full sm:w-auto">
                <button
                  type="button"
                  onClick={() => setBatchBillingTab('runner')}
                  className={`flex-1 sm:flex-initial flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                    batchBillingTab === 'runner'
                      ? 'bg-gradient-to-r from-emerald-600 to-teal-600 text-white shadow-xs'
                      : 'text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  <Play className="w-3.5 h-3.5" />
                  <span>1. Auto-Sender Berurutan</span>
                </button>
                <button
                  type="button"
                  onClick={() => setBatchBillingTab('broadcast')}
                  className={`flex-1 sm:flex-initial flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                    batchBillingTab === 'broadcast'
                      ? 'bg-gradient-to-r from-cyan-600 to-blue-600 text-white shadow-xs'
                      : 'text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>2. Broadcast Grup WA</span>
                </button>
                <button
                  type="button"
                  onClick={() => setBatchBillingTab('list')}
                  className={`flex-1 sm:flex-initial flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                    batchBillingTab === 'list'
                      ? 'bg-gradient-to-r from-purple-600 to-indigo-600 text-white shadow-xs'
                      : 'text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  <Users className="w-3.5 h-3.5" />
                  <span>3. Checklist Cepat ({housesWithArrears.length})</span>
                </button>
              </div>

              <div className="flex items-center gap-2 text-xs font-mono font-bold text-slate-700">
                <span className="text-slate-500 font-sans">Total Tunggakan:</span>
                <span className="px-2 py-1 rounded-lg bg-rose-100 text-rose-700 border border-rose-200">
                  {formatRupiah(totalAllArrears)}
                </span>
              </div>
            </div>

            {/* Modal Body */}
            <div className="p-4 sm:p-6 overflow-y-auto space-y-5 flex-1">
              {/* Tab 1: Auto-Sender Berurutan */}
              {batchBillingTab === 'runner' && (
                <div className="space-y-5">
                  {billableHouses.length === 0 ? (
                    <div className="p-8 text-center bg-emerald-50 rounded-2xl border border-emerald-200 space-y-2">
                      <CheckCircle2 className="w-12 h-12 text-emerald-600 mx-auto" />
                      <h4 className="font-extrabold text-base text-emerald-900">
                        Tidak Ada Tunggakan yang Perlu Ditagih!
                      </h4>
                      <p className="text-xs text-emerald-700">
                        Seluruh warga telah menyelesaikan kewajiban iuran kas dan denda baksos.
                      </p>
                    </div>
                  ) : (
                    <>
                      {/* Overall Progress Tracker */}
                      <div className="p-4 rounded-2xl bg-gradient-to-br from-emerald-50 to-teal-50 border border-emerald-200 space-y-2">
                        <div className="flex items-center justify-between text-xs font-bold text-slate-800">
                          <span className="flex items-center gap-1.5">
                            <Zap className="w-4 h-4 text-emerald-600" />
                            <span>Progres Pengiriman Antrean:</span>
                          </span>
                          <span className="font-mono text-emerald-700 font-black">
                            {Object.keys(sentHouseIds).length} dari {billableHouses.length} Warga Terkirim (
                            {Math.round((Object.keys(sentHouseIds).length / billableHouses.length) * 100)}%)
                          </span>
                        </div>

                        {/* Progress Bar */}
                        <div className="h-3 w-full bg-slate-200 rounded-full overflow-hidden p-0.5">
                          <div
                            className="h-full bg-gradient-to-r from-emerald-500 via-teal-500 to-cyan-500 rounded-full transition-all duration-300"
                            style={{
                              width: `${Math.max(
                                5,
                                Math.round((Object.keys(sentHouseIds).length / billableHouses.length) * 100)
                              )}%`,
                            }}
                          />
                        </div>
                      </div>

                      {/* Current Target Card in Queue */}
                      {runnerIndex < billableHouses.length ? (() => {
                        const currentTarget = billableHouses[runnerIndex];
                        const isSent = !!sentHouseIds[currentTarget.house.id];
                        const currentMsg = generateSingleBillingMessage(currentTarget);

                        return (
                          <div className="rounded-2xl border-2 border-emerald-400 bg-white shadow-md overflow-hidden space-y-4 p-5">
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-3">
                              <div className="flex items-center gap-3">
                                <span className="w-8 h-8 rounded-xl bg-emerald-600 text-white font-extrabold text-sm flex items-center justify-center shrink-0">
                                  #{runnerIndex + 1}
                                </span>
                                <div>
                                  <div className="flex items-center gap-2">
                                    <h4 className="font-extrabold text-sm sm:text-base text-slate-900">
                                      Blok {currentTarget.house.blockNumber} — {currentTarget.house.headName}
                                    </h4>
                                    {isSent && (
                                      <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-bold">
                                        Sudah Dibuka/Kirim
                                      </span>
                                    )}
                                  </div>
                                  <div className="text-xs text-slate-500 font-mono flex items-center gap-1.5 mt-0.5">
                                    <Phone className="w-3.5 h-3.5 text-emerald-600" />
                                    <span>{currentTarget.house.phone}</span>
                                  </div>
                                </div>
                              </div>

                              <div className="text-right">
                                <span className="text-[11px] text-slate-400 block">Total Tagihan</span>
                                <span className="font-mono font-black text-rose-600 text-lg">
                                  {formatRupiah(currentTarget.totalArrears)}
                                </span>
                              </div>
                            </div>

                            {/* Breakdown Pills */}
                            <div className="grid grid-cols-3 gap-2 text-[11px] font-mono text-center">
                              <div className="p-2 rounded-xl bg-amber-50 border border-amber-200 text-amber-900">
                                <span className="block text-[10px] text-amber-700 font-sans">Iuran Kas:</span>
                                <strong>{formatRupiah(currentTarget.duesArrears)}</strong>
                              </div>
                              <div className="p-2 rounded-xl bg-rose-50 border border-rose-200 text-rose-900">
                                <span className="block text-[10px] text-rose-700 font-sans">Denda Baksos:</span>
                                <strong>{formatRupiah(currentTarget.baksosFineArrears)}</strong>
                              </div>
                              <div className="p-2 rounded-xl bg-purple-50 border border-purple-200 text-purple-900">
                                <span className="block text-[10px] text-purple-700 font-sans">Tunggakan Lalu:</span>
                                <strong>{formatRupiah(currentTarget.previousArrears)}</strong>
                              </div>
                            </div>

                            {/* Message Preview Box */}
                            <div>
                              <div className="flex items-center justify-between text-xs font-bold text-slate-700 mb-1">
                                <span>Preview Pesan WhatsApp yang Akan Dikirim:</span>
                                <button
                                  type="button"
                                  onClick={() => handleCopyBroadcastText(currentMsg)}
                                  className="text-[11px] text-emerald-700 hover:underline flex items-center gap-1 cursor-pointer"
                                >
                                  <Copy className="w-3 h-3" />
                                  <span>Salin Teks</span>
                                </button>
                              </div>
                              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-xs font-mono text-slate-700 whitespace-pre-wrap max-h-36 overflow-y-auto leading-relaxed">
                                {currentMsg}
                              </div>
                            </div>

                            {/* Control Bar */}
                            <div className="pt-2 flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-t border-slate-100">
                              <div className="flex items-center gap-2">
                                <button
                                  type="button"
                                  onClick={() => setIsRunnerActive(!isRunnerActive)}
                                  className={`flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-xs font-extrabold shadow-sm transition-all cursor-pointer ${
                                    isRunnerActive
                                      ? 'bg-amber-500 hover:bg-amber-600 text-white'
                                      : 'bg-emerald-600 hover:bg-emerald-700 text-white'
                                  }`}
                                >
                                  {isRunnerActive ? (
                                    <>
                                      <Pause className="w-4 h-4" />
                                      <span>Jeda Auto-Runner ({countdown}s)</span>
                                    </>
                                  ) : (
                                    <>
                                      <Play className="w-4 h-4 text-amber-300" />
                                      <span>Mulai Auto-Runner Sekaligus</span>
                                    </>
                                  )}
                                </button>

                                <button
                                  type="button"
                                  onClick={handleSendCurrentAndNext}
                                  className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-gradient-to-r from-teal-600 to-cyan-600 hover:from-teal-500 hover:to-cyan-500 text-white text-xs font-extrabold shadow-sm transition-all cursor-pointer whitespace-nowrap"
                                  title="Buka WhatsApp untuk warga ini dan langsung geser ke antrean berikutnya"
                                >
                                  <MessageCircle className="w-4 h-4 text-white" />
                                  <span>Kirim Sekarang & Lanjut</span>
                                </button>
                              </div>

                              <div className="flex items-center gap-2">
                                {runnerIndex + 1 < billableHouses.length && (
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setRunnerIndex(runnerIndex + 1);
                                      setCountdown(runnerDelay);
                                    }}
                                    className="px-3 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 border border-slate-200 cursor-pointer flex items-center gap-1"
                                  >
                                    <SkipForward className="w-3.5 h-3.5" />
                                    <span>Lewati Warga Ini</span>
                                  </button>
                                )}
                                <button
                                  type="button"
                                  onClick={() => {
                                    setRunnerIndex(0);
                                    setIsRunnerActive(false);
                                    setCountdown(runnerDelay);
                                  }}
                                  className="p-2 rounded-xl text-slate-500 hover:bg-slate-100 cursor-pointer"
                                  title="Ulangi dari Warga Pertama"
                                >
                                  <RotateCcw className="w-4 h-4" />
                                </button>
                              </div>
                            </div>
                          </div>
                        );
                      })() : (
                        <div className="p-8 text-center bg-emerald-50 rounded-2xl border-2 border-emerald-300 space-y-3">
                          <CheckCircle2 className="w-14 h-14 text-emerald-600 mx-auto" />
                          <h4 className="font-extrabold text-base sm:text-lg text-emerald-950">
                            🎉 Seluruh Antrean Tagihan ({billableHouses.length} Rumah) Berhasil Diproses!
                          </h4>
                          <p className="text-xs text-emerald-800 max-w-md mx-auto">
                            Semua pesan tagihan telah dibuka atau dikirimkan ke WhatsApp warga. Terima kasih telah menjalankan penarikan tagihan otomatis massal.
                          </p>
                          <div className="pt-2 flex justify-center gap-2">
                            <button
                              type="button"
                              onClick={() => {
                                setRunnerIndex(0);
                                setIsRunnerActive(false);
                                setCountdown(runnerDelay);
                              }}
                              className="px-4 py-2 rounded-xl bg-emerald-600 text-white font-bold text-xs cursor-pointer shadow-xs"
                            >
                              Ulangi Pengiriman
                            </button>
                            <button
                              type="button"
                              onClick={() => setIsBatchBillingModalOpen(false)}
                              className="px-4 py-2 rounded-xl bg-white border border-slate-200 text-slate-700 font-bold text-xs cursor-pointer hover:bg-slate-50"
                            >
                              Tutup Modal
                            </button>
                          </div>
                        </div>
                      )}

                      {/* Unbillable Houses Warning (Tanpa Nomor WA) */}
                      {unbillableHouses.length > 0 && (
                        <div className="p-3.5 rounded-xl bg-amber-50 border border-amber-300 text-xs text-amber-900 flex items-start gap-2.5">
                          <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                          <div>
                            <strong>Catatan {unbillableHouses.length} Rumah Tanpa Nomor WhatsApp:</strong>
                            <span className="block mt-0.5 text-amber-800">
                              {unbillableHouses
                                .map((h) => `Blok ${h.house.blockNumber} (${h.house.headName})`)
                                .join(', ')}{' '}
                              dapat ditagih manual secara tatap muka / offline oleh pengurus.
                            </span>
                          </div>
                        </div>
                      )}
                    </>
                  )}
                </div>
              )}

              {/* Tab 2: Broadcast Sekaligus ke Grup WhatsApp Warga */}
              {batchBillingTab === 'broadcast' && (() => {
                const groupMsg = generateFullGroupBroadcast();
                return (
                  <div className="space-y-4">
                    <div className="p-4 rounded-2xl bg-cyan-50 border border-cyan-200 text-xs text-cyan-950 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div>
                        <h4 className="font-extrabold text-sm text-cyan-900">
                          Format Pesan Rekapitulasi Tagihan Sekaligus ke Grup WA Warga
                        </h4>
                        <p className="text-cyan-800 mt-0.5">
                          Kirim 1 pesan rangkuman ke grup WhatsApp resmi warga yang memuat seluruh rincian rumah tertunggak dan petunjuk pembayaran.
                        </p>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <button
                          type="button"
                          onClick={() => handleCopyBroadcastText(groupMsg)}
                          className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                            copiedBroadcast
                              ? 'bg-emerald-600 text-white'
                              : 'bg-white hover:bg-slate-50 text-slate-800 border border-slate-200 shadow-2xs'
                          }`}
                        >
                          {copiedBroadcast ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                          <span>{copiedBroadcast ? 'Tersalin!' : 'Salin Teks'}</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => openWhatsAppShare(groupMsg)}
                          className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white text-xs font-extrabold shadow-sm cursor-pointer"
                        >
                          <Send className="w-3.5 h-3.5 text-white" />
                          <span>Kirim ke Grup WA</span>
                        </button>
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">
                        Isi Pesan Broadcast Grup (Otomatis Di-generate):
                      </label>
                      <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 font-mono text-xs text-slate-800 whitespace-pre-wrap leading-relaxed max-h-80 overflow-y-auto">
                        {groupMsg}
                      </div>
                    </div>
                  </div>
                );
              })()}

              {/* Tab 3: Checklist Cepat Semua Tagihan */}
              {batchBillingTab === 'list' && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                    <span className="text-xs font-bold text-slate-700">
                      Daftar {housesWithArrears.length} Rumah Tertunggak:
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        const allMap: Record<string, boolean> = {};
                        housesWithArrears.forEach((h) => {
                          allMap[h.house.id] = true;
                        });
                        setSentHouseIds(allMap);
                      }}
                      className="text-xs text-emerald-700 font-bold hover:underline cursor-pointer"
                    >
                      Tandai Semua Sudah Terkirim
                    </button>
                  </div>

                  <div className="divide-y divide-slate-100 border border-slate-200 rounded-2xl overflow-hidden bg-white">
                    {housesWithArrears.map((item, idx) => {
                      const isSent = !!sentHouseIds[item.house.id];
                      return (
                        <div
                          key={item.house.id}
                          className="p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-slate-50 transition-colors"
                        >
                          <div className="flex items-center gap-3">
                            <span className="w-6 h-6 rounded-lg bg-slate-100 text-slate-700 font-bold text-xs flex items-center justify-center shrink-0">
                              {idx + 1}
                            </span>
                            <div>
                              <div className="font-extrabold text-xs text-slate-900 flex items-center gap-2">
                                <span>Blok {item.house.blockNumber} — {item.house.headName}</span>
                                {isSent ? (
                                  <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-bold">
                                    ✓ Terkirim
                                  </span>
                                ) : (
                                  <span className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 text-[10px] font-medium">
                                    Belum Dikirim
                                  </span>
                                )}
                              </div>
                              <div className="text-[11px] text-slate-500 font-mono mt-0.5">
                                {item.house.phone ? `WA: ${item.house.phone}` : 'Tanpa No. WA'}
                              </div>
                            </div>
                          </div>

                          <div className="flex items-center justify-between sm:justify-end gap-3 shrink-0">
                            <span className="font-mono font-black text-rose-600 text-sm">
                              {formatRupiah(item.totalArrears)}
                            </span>

                            {item.house.phone ? (
                              <button
                                type="button"
                                onClick={() => {
                                  const msg = generateSingleBillingMessage(item);
                                  openWhatsAppShare(msg, item.house.phone);
                                  setSentHouseIds((old) => ({ ...old, [item.house.id]: true }));
                                }}
                                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs cursor-pointer shadow-2xs"
                              >
                                <MessageCircle className="w-3.5 h-3.5" />
                                <span>Kirim WA</span>
                              </button>
                            ) : (
                              <span className="text-[11px] text-slate-400 italic">Offline</span>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Rekening Transfer & Pengaturan Pembayaran */}
              <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-3">
                <h4 className="font-bold text-xs text-slate-800 flex items-center gap-1.5">
                  <Building2 className="w-4 h-4 text-emerald-600" />
                  <span>Pengaturan Info Pembayaran Tagihan:</span>
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                  <div>
                    <label className="block text-slate-600 font-semibold mb-1">
                      Rekening Bank / QRIS / Pos Kas Bendahara:
                    </label>
                    <input
                      type="text"
                      value={bankInfo}
                      onChange={(e) => setBankInfo(e.target.value)}
                      placeholder="BCA 1234567890 a.n. Siti Rahmawati"
                      className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-600 font-semibold mb-1">
                      Keterangan Batas Waktu / Deadline:
                    </label>
                    <input
                      type="text"
                      value={deadlineNote}
                      onChange={(e) => setDeadlineNote(e.target.value)}
                      placeholder="Sebelum tanggal 10 bulan berjalan"
                      className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="p-4 bg-slate-100/80 border-t border-slate-200 flex items-center justify-between gap-3 shrink-0">
              <span className="text-[11px] text-slate-500">
                ⚡ Sistem penarikan tagihan WhatsApp otomatis massal untuk pengurus Gang Mandor.
              </span>
              <button
                type="button"
                onClick={() => {
                  setIsBatchBillingModalOpen(false);
                  setIsRunnerActive(false);
                }}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-900 text-white font-bold text-xs cursor-pointer shadow-xs"
              >
                Tutup Jendela
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
