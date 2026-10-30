import * as XLSX from 'xlsx';
import {
  BaksosAgenda,
  CashTransaction,
  ResidentHouse,
  SiteConfig,
} from '../types';
import { BalanceBreakdown } from '../hooks/useStorage';
import {
  formatDateDDMMYYYY,
  formatMonthYearFromDate,
  formatMonthYearFromKey,
  getMonthKeyFromDate,
  getSubsequentMonthLabels,
  isHouseVacant,
  parseIndonesianMonthYearToKey,
} from './helpers';

export interface FinancialExportOptions {
  config: SiteConfig;
  transactions: CashTransaction[];
  residents: ResidentHouse[];
  baksosAgendas?: BaksosAgenda[];
  balances: BalanceBreakdown;
  exportScope?: 'all' | 'mutasi_only' | 'per_kk_only' | 'rekap_total_only' | 'tunggakan_only';
}

/**
 * Export seluruh laporan keuangan (Ringkasan Saldo, Rekap Bulanan, Mutasi Keluar Masuk, Kas Per KK, & Rincian Tunggakan)
 * ke dalam satu file Microsoft Excel (.xlsx) profesional untuk akses Admin.
 */
export function exportFinancialReportToExcel({
  config,
  transactions,
  residents,
  baksosAgendas = [],
  balances,
  exportScope = 'all',
}: FinancialExportOptions) {
  const wb = XLSX.utils.book_new();
  const todayStr = new Date().toISOString().slice(0, 10);
  const currentPeriod = config.duesCurrentMonth || 'Oktober 2026';
  const defaultNominal = config.duesAmountPerMonth || 50000;

  const getHouseDuesNominal = (house: ResidentHouse) =>
    house.customDuesAmount !== undefined ? house.customDuesAmount : defaultNominal;

  const occupiedResidents = residents.filter((h) => h.occupancy !== 'Kosong');
  const totalInflow = transactions
    .filter((t) => t.type === 'masuk')
    .reduce((sum, t) => sum + t.amount, 0);
  const totalOutflow = transactions
    .filter((t) => t.type === 'keluar')
    .reduce((sum, t) => sum + t.amount, 0);

  const totalCurrentMonthCollected = occupiedResidents.reduce((sum, h) => {
    const nom = getHouseDuesNominal(h);
    if (h.duesStatus === 'Lunas' || h.duesStatus === 'Bayar Lebih') return sum + nom;
    return sum + (h.duesPaidAmount || 0);
  }, 0);

  const totalPrepaidAdvance = occupiedResidents.reduce((sum, h) => {
    if (h.duesStatus === 'Bayar Lebih') return sum + (h.duesPrepaidBalance || 0);
    return sum;
  }, 0);

  // 1. SHEET: RINGKASAN SALDO & REKAP KEUANGAN
  if (exportScope === 'all') {
    const summaryRows = [
      {
        'Komponen Laporan Keuangan': 'Nama Gang / Portal',
        'Nilai / Nominal (Rp)': config.title || 'Warga Gang Mandor Blok K2/25 - K3/24',
        Keterangan: (config.subtitle || 'Transparansi Keuangan & Kas Gang').replace(/Lingkungan/gi, 'Gang'),
      },
      {
        'Komponen Laporan Keuangan': 'Periode Bulan Berjalan',
        'Nilai / Nominal (Rp)': currentPeriod,
        Keterangan: `Tanggal Cetak Excel: ${formatDateDDMMYYYY(todayStr)}`,
      },
      {
        'Komponen Laporan Keuangan': 'Saldo Kas Utama (Rp)',
        'Nilai / Nominal (Rp)': balances.kasUtama,
        Keterangan: 'Iuran bulanan warga, denda baksos & pengeluaran gang',
      },
      {
        'Komponen Laporan Keuangan': 'Saldo Cashback WiFi (Rp)',
        'Nilai / Nominal (Rp)': balances.wifiCashback,
        Keterangan: 'Komisi / bagi hasil kemitraan provider internet gang',
      },
      {
        'Komponen Laporan Keuangan': 'Saldo Cashback Sampah (Rp)',
        'Nilai / Nominal (Rp)': balances.sampahCashback,
        Keterangan: 'Dana pengelolaan bank sampah & daur ulang',
      },
      {
        'Komponen Laporan Keuangan': 'TOTAL AKUMULASI SELURUH KAS (Rp)',
        'Nilai / Nominal (Rp)': balances.total,
        Keterangan: 'Total Gabungan Kas Utama + Cashback WiFi + Cashback Sampah',
      },
      {
        'Komponen Laporan Keuangan': 'Total Pemasukan Tercatat (Rp)',
        'Nilai / Nominal (Rp)': totalInflow,
        Keterangan: `${transactions.filter((t) => t.type === 'masuk').length} transaksi uang masuk`,
      },
      {
        'Komponen Laporan Keuangan': 'Total Pengeluaran Tercatat (Rp)',
        'Nilai / Nominal (Rp)': totalOutflow,
        Keterangan: `${transactions.filter((t) => t.type === 'keluar').length} transaksi uang keluar`,
      },
      {
        'Komponen Laporan Keuangan': 'Iuran Bulan Berjalan Terkumpul (Rp)',
        'Nilai / Nominal (Rp)': totalCurrentMonthCollected,
        Keterangan: `${
          occupiedResidents.filter(
            (h) => h.duesStatus === 'Lunas' || h.duesStatus === 'Bayar Lebih'
          ).length
        } dari ${occupiedResidents.length} rumah wajib iuran telah lunas`,
      },
      {
        'Komponen Laporan Keuangan': 'Deposit Kas Bayar Lebih >1 Bulan (Rp)',
        'Nilai / Nominal (Rp)': totalPrepaidAdvance,
        Keterangan: `${
          occupiedResidents.filter((h) => h.duesStatus === 'Bayar Lebih').length
        } rumah memiliki saldo deposit untuk bulan berikutnya`,
      },
    ];

    const wsSummary = XLSX.utils.json_to_sheet(summaryRows);
    wsSummary['!cols'] = [{ wch: 36 }, { wch: 28 }, { wch: 52 }];
    XLSX.utils.book_append_sheet(wb, wsSummary, 'Ringkasan Keuangan');
  }

  // 1B. SHEET: REKAP BULANAN IURAN KAS & KELUAR MASUK UANG
  if (exportScope === 'all' || exportScope === 'mutasi_only') {
    const monthBuckets: Record<
      string,
      {
        monthKey: string;
        monthLabel: string;
        txCount: number;
        iuranMasuk: number;
        wifiMasuk: number;
        sampahMasuk: number;
        dendaMasuk: number;
        lainMasuk: number;
        totalMasuk: number;
        totalKeluar: number;
      }
    > = {};

    transactions.forEach((tx) => {
      const mKey = getMonthKeyFromDate(tx.date);
      if (!monthBuckets[mKey]) {
        monthBuckets[mKey] = {
          monthKey: mKey,
          monthLabel: formatMonthYearFromKey(mKey),
          txCount: 0,
          iuranMasuk: 0,
          wifiMasuk: 0,
          sampahMasuk: 0,
          dendaMasuk: 0,
          lainMasuk: 0,
          totalMasuk: 0,
          totalKeluar: 0,
        };
      }
      const b = monthBuckets[mKey];
      b.txCount += 1;
      if (tx.type === 'masuk') {
        b.totalMasuk += tx.amount;
        if (tx.category === 'Iuran Warga') b.iuranMasuk += tx.amount;
        else if (tx.pool === 'Cashback WiFi' || tx.category === 'Cashback WiFi')
          b.wifiMasuk += tx.amount;
        else if (tx.pool === 'Cashback Sampah' || tx.category === 'Cashback Sampah')
          b.sampahMasuk += tx.amount;
        else if (tx.category === 'Denda Baksos') b.dendaMasuk += tx.amount;
        else b.lainMasuk += tx.amount;
      } else {
        b.totalKeluar += tx.amount;
      }
    });

    const monthlyRows = Object.values(monthBuckets)
      .sort((a, b) => b.monthKey.localeCompare(a.monthKey))
      .map((m, idx) => ({
        No: idx + 1,
        'Periode Bulan': m.monthLabel,
        'Kode Bulan': m.monthKey,
        'Jumlah Transaksi': m.txCount,
        'Iuran Kas Warga Masuk (Rp)': m.iuranMasuk,
        'Cashback WiFi Masuk (Rp)': m.wifiMasuk,
        'Cashback Sampah Masuk (Rp)': m.sampahMasuk,
        'Denda Baksos Masuk (Rp)': m.dendaMasuk,
        'Pemasukan Lainnya (Rp)': m.lainMasuk,
        'TOTAL UANG MASUK (Rp)': m.totalMasuk,
        'TOTAL UANG KELUAR (Rp)': m.totalKeluar,
        'SELISIH KAS BERSIH BULANAN (Rp)': m.totalMasuk - m.totalKeluar,
      }));

    const wsMonthly = XLSX.utils.json_to_sheet(monthlyRows);
    wsMonthly['!cols'] = [
      { wch: 5 },
      { wch: 18 },
      { wch: 12 },
      { wch: 16 },
      { wch: 24 },
      { wch: 22 },
      { wch: 24 },
      { wch: 22 },
      { wch: 20 },
      { wch: 22 },
      { wch: 22 },
      { wch: 26 },
    ];
    XLSX.utils.book_append_sheet(wb, wsMonthly, 'Rekap Bulanan Kas');
  }

  // 2. SHEET: MUTASI KELUAR MASUK KAS (LEDGER TRANSAKSI)
  if (exportScope === 'all' || exportScope === 'mutasi_only') {
    // Sort chronologically ascending to compute running balance accurately, then display
    const sortedAsc = [...transactions].sort((a, b) => a.date.localeCompare(b.date));
    let runningTotal = 0;
    const ledgerWithRunning = sortedAsc.map((tx) => {
      const signedVal = tx.type === 'masuk' ? tx.amount : -tx.amount;
      runningTotal += signedVal;
      return {
        ...tx,
        runningBalance: runningTotal,
      };
    });

    const ledgerRows = ledgerWithRunning.reverse().map((tx, idx) => ({
      No: idx + 1,
      'ID Transaksi': tx.id,
      'Kelompok Bulan': formatMonthYearFromDate(tx.date),
      Tanggal: formatDateDDMMYYYY(tx.date),
      'Tanggal ISO': tx.date,
      'Alokasi Pos Kas': tx.pool,
      Kategori: tx.category,
      'Uraian / Keterangan Transaksi': tx.description,
      'Jenis Mutasi': tx.type === 'masuk' ? 'UANG MASUK (+)' : 'UANG KELUAR (-)',
      'Nominal Masuk (Rp)': tx.type === 'masuk' ? tx.amount : 0,
      'Nominal Keluar (Rp)': tx.type === 'keluar' ? tx.amount : 0,
      'Mutasi Bersih (Rp)': tx.type === 'masuk' ? tx.amount : -tx.amount,
      'Saldo Akumulasi Berjalan (Rp)': tx.runningBalance,
    }));

    const wsMutasi = XLSX.utils.json_to_sheet(ledgerRows);
    wsMutasi['!cols'] = [
      { wch: 5 },
      { wch: 16 },
      { wch: 18 },
      { wch: 14 },
      { wch: 12 },
      { wch: 18 },
      { wch: 22 },
      { wch: 48 },
      { wch: 16 },
      { wch: 18 },
      { wch: 18 },
      { wch: 18 },
      { wch: 24 },
    ];
    XLSX.utils.book_append_sheet(wb, wsMutasi, 'Mutasi Keluar Masuk Kas');
  }

  // 3. SHEET: LAPORAN KAS & IURAN PER KK
  if (exportScope === 'all' || exportScope === 'per_kk_only') {
    const perKKRows = residents.map((house, idx) => {
      const isEmpty =
        house.occupancy === 'Kosong' ||
        house.occupancy === 'Belum Ditempati' ||
        isHouseVacant(house);
      const nominal = getHouseDuesNominal(house);
      const isAdvance = house.duesStatus === 'Bayar Lebih';
      const isLunas = house.duesStatus === 'Lunas' || isAdvance;
      const paidMonths = isAdvance
        ? Math.max(2, house.duesPaidMonths || 2)
        : isLunas
        ? 1
        : 0;
      const prepaidDeposit = isAdvance ? house.duesPrepaidBalance || 0 : 0;
      const paidThisMonth = isAdvance
        ? nominal + prepaidDeposit
        : isLunas
        ? nominal
        : isEmpty
        ? 0
        : house.duesPaidAmount || 0;
      const remainingThisMonth = isEmpty
        ? 0
        : isLunas
        ? 0
        : Math.max(0, nominal - (house.duesPaidAmount || 0));

      const basePeriod = house.duesMonthNote || currentPeriod;
      const coveredMonths = isLunas
        ? getSubsequentMonthLabels(basePeriod, Math.max(1, paidMonths)).join(', ')
        : isEmpty
        ? 'Bebas Iuran (Kosong)'
        : basePeriod;

      const blockRegex = new RegExp(`\\b${house.blockNumber.replace('/', '\\/')}\\b`, 'i');
      const dendaTxs = transactions.filter((t) =>
        t.type === 'masuk' &&
        (t.category === 'Denda Baksos' || t.description.toLowerCase().includes('denda')) &&
        blockRegex.test(t.description)
      );
      const dendaFromTxs = dendaTxs.reduce((s, t) => s + t.amount, 0);

      const isContract = house.ownership === 'Kontrak' || house.occupancy === 'Dikontrakan';
      const unpaidBaksos = baksosAgendas.filter((agenda) => {
        const att =
          agenda.attendance?.[house.id] ||
          (house.occupancy === 'Kosong' ? 'Kosong' : isContract ? 'Tidak Wajib' : 'Hadir');
        const paid = agenda.finesPaid?.[house.id];
        return att === 'Tidak Hadir' && !paid;
      });
      const baksosFineArrears = unpaidBaksos.length * 10000;
      const dendaBaksosAmount =
        dendaFromTxs > 0
          ? dendaFromTxs
          : house.customBaksosFineAmount !== undefined
          ? house.customBaksosFineAmount
          : baksosFineArrears;

      const tunggakanTxs = transactions.filter((t) =>
        t.type === 'masuk' &&
        (t.category === 'Pembayaran Tunggakan' || t.description.toLowerCase().includes('tunggakan')) &&
        blockRegex.test(t.description)
      );
      const tunggakanPaid = tunggakanTxs.reduce((s, t) => s + t.amount, 0);
      const totalSemuaPenerimaan = paidThisMonth + dendaFromTxs + tunggakanPaid;

      return {
        No: idx + 1,
        'No Blok': house.blockNumber,
        'Kepala Keluarga': house.headName,
        'No. WhatsApp': house.phone || '-',
        'Status Hunian': house.occupancy,
        'Status Kepemilikan': house.ownership,
        'Periode Bulan': basePeriod,
        'Alokasi Bulan Tercover': coveredMonths,
        'Wajib Iuran Rutin': isEmpty ? 'Bebas Iuran (Kosong)' : 'Wajib / Boleh Bayar',
        'Nominal Iuran / Bulan (Rp)': isEmpty && !isLunas ? 0 : nominal,
        'Status Pembayaran': isEmpty
          ? isLunas
            ? isAdvance
              ? `Bayar Lebih (Kosong ${paidMonths} Bulan)`
              : 'Lunas (Rumah Kosong)'
            : 'Bebas Iuran (Kosong)'
          : isAdvance
          ? `Bayar Lebih (${paidMonths} Bulan)`
          : house.duesStatus,
        'Jumlah Bulan Dibayar': paidMonths,
        'Iuran Kas Diterima (Rp)': paidThisMonth,
        'Denda Baksos (Rp)': dendaBaksosAmount,
        'Pembayaran Tunggakan (Rp)': tunggakanPaid,
        'Total Pembayaran Diterima (Rp)': totalSemuaPenerimaan,
        'Saldo Deposit Bulan Depan (Rp)': prepaidDeposit,
        'Cicilan Berjalan (Rp)': !isLunas && !isEmpty ? house.duesPaidAmount || 0 : 0,
        'Sisa Tagihan Bulan Ini (Rp)': remainingThisMonth,
        'Tanggal Bayar': house.duesPaidDate ? formatDateDDMMYYYY(house.duesPaidDate) : '-',
      };
    });

    const wsPerKK = XLSX.utils.json_to_sheet(perKKRows);
    wsPerKK['!cols'] = [
      { wch: 5 },
      { wch: 10 },
      { wch: 24 },
      { wch: 16 },
      { wch: 16 },
      { wch: 18 },
      { wch: 18 },
      { wch: 28 },
      { wch: 20 },
      { wch: 22 },
      { wch: 22 },
      { wch: 18 },
      { wch: 22 },
      { wch: 20 },
      { wch: 22 },
      { wch: 24 },
      { wch: 24 },
      { wch: 18 },
      { wch: 22 },
      { wch: 15 },
    ];
    XLSX.utils.book_append_sheet(wb, wsPerKK, 'Laporan Kas Per KK');
  }

  // 3B. SHEET: REKAP KESELURUHAN KAS PER KK (GABUNGAN SEMUA PERIODE)
  if (exportScope === 'all' || exportScope === 'rekap_total_only') {
    const rawList =
      config.duesAvailablePeriods && config.duesAvailablePeriods.length > 0
        ? config.duesAvailablePeriods
        : [currentPeriod, 'September 2026'];
    const txMonths = transactions
      .map((t) => formatMonthYearFromKey(getMonthKeyFromDate(t.date)))
      .filter((l): l is string => Boolean(l));
    const currentActiveKey = parseIndonesianMonthYearToKey(currentPeriod) || '2026-10';
    const sortedAllPeriods = Array.from(new Set([currentPeriod, ...rawList, ...txMonths]))
      .filter((p) => {
        const key = parseIndonesianMonthYearToKey(p);
        if (!key) return false;
        if (key > currentActiveKey) return false;
        if (key === '2026-04' || p.toLowerCase().includes('april')) return false;
        return true;
      })
      .sort((a, b) => (parseIndonesianMonthYearToKey(a) || '').localeCompare(parseIndonesianMonthYearToKey(b) || ''));

    const overallRows = residents.map((house, idx) => {
      const isPureKosong =
        house.occupancy === 'Kosong' ||
        isHouseVacant(house) ||
        Boolean(house.duesHeadNameOverride && /rumah kosong|^kosong$/i.test(house.duesHeadNameOverride.trim()));
      const isUnoccupied = house.occupancy === 'Belum Ditempati';
      const nominal = isPureKosong ? 0 : getHouseDuesNominal(house);
      const payerName = isPureKosong
        ? (house.duesHeadNameOverride && house.duesHeadNameOverride !== 'Rumah Kosong'
            ? house.duesHeadNameOverride
            : 'Rumah Kosong')
        : isUnoccupied
        ? (house.duesHeadNameOverride || 'Belum Ditempati')
        : (house.duesHeadNameOverride || house.headName || '');

      const blockRegex = new RegExp(`\\b${house.blockNumber.replace('/', '\\/')}\\b`, 'i');

      let totalIuranAll = 0;
      let totalDendaAll = 0;
      let totalTunggakanAll = 0;
      let lunasPeriodsCount = 0;

      const periodStatusMap: Record<string, string> = {};

      sortedAllPeriods.forEach((pLabel) => {
        const pKey = parseIndonesianMonthYearToKey(pLabel) || '';
        
        // Iuran
        const matchingIuranTxs = transactions.filter((t) => {
          if (t.type !== 'masuk') return false;
          const cat = t.category || '';
          const desc = (t.description || '').toLowerCase();
          const isIuran = cat === 'Iuran Warga' || desc.includes('iuran');
          if (!isIuran || !blockRegex.test(t.description)) return false;
          return getMonthKeyFromDate(t.date) === pKey;
        });
        const sumTxs = matchingIuranTxs.reduce((s, t) => s + t.amount, 0);

        let iuranPeriod = 0;
        let isPeriodLunas = false;
        let isAdv = false;

        if (isPureKosong) {
          iuranPeriod = sumTxs;
          isPeriodLunas = true;
        } else if (sumTxs > 0) {
          iuranPeriod = sumTxs;
          isPeriodLunas = true;
        } else {
          // Check advance or base match
          const houseBase = house.duesMonthNote || currentPeriod;
          const baseKey = parseIndonesianMonthYearToKey(houseBase);
          const isPaid = house.duesStatus === 'Lunas' || house.duesStatus === 'Bayar Lebih';
          const paidMonths = house.duesPaidMonths || (house.duesStatus === 'Bayar Lebih' ? 2 : isPaid ? 1 : 0);
          const covered = isPaid ? getSubsequentMonthLabels(houseBase, Math.max(1, paidMonths)) : [];
          isAdv = Boolean(isPaid && paidMonths > 1 && baseKey && pKey > baseKey && covered.some(m => parseIndonesianMonthYearToKey(m) === pKey));

          if (isAdv) {
            iuranPeriod = 0;
            isPeriodLunas = true;
          } else if (((baseKey && pKey === baseKey) || pLabel === houseBase) && isPaid) {
            iuranPeriod = paidMonths > 1 ? nominal * paidMonths : nominal;
            isPeriodLunas = true;
          } else if (pLabel === currentPeriod) {
            if (isPaid) {
              iuranPeriod = house.duesStatus === 'Bayar Lebih' ? nominal * Math.max(2, house.duesPaidMonths || 2) : nominal;
              isPeriodLunas = true;
            } else {
              iuranPeriod = house.duesPaidAmount || 0;
              isPeriodLunas = false;
            }
          }
        }

        // Deteksi pelunasan tunggakan jika tertunggak di bulan sebelumnya
        let settlementMonth: string | null = null;
        if (!isPeriodLunas && !isPureKosong && !isUnoccupied) {
          const currentActiveKey = parseIndonesianMonthYearToKey(currentPeriod) || '2026-10';
          const periodMonthName = (pLabel.split(' ')[0] || '').toLowerCase();

          const explicitTx = transactions.find((t) => {
            if (t.type !== 'masuk' || !blockRegex.test(t.description)) return false;
            const txKey = getMonthKeyFromDate(t.date);
            if (!txKey || txKey <= pKey) return false;
            const desc = t.description.toLowerCase();
            return desc.includes(periodMonthName) || desc.includes(pLabel.toLowerCase()) || desc.includes(pKey);
          });
          if (explicitTx) {
            const txKey = getMonthKeyFromDate(explicitTx.date);
            settlementMonth = formatMonthYearFromKey(txKey) || formatMonthYearFromDate(explicitTx.date);
          }

          if (!settlementMonth) {
            const laterTungTxs = transactions
              .filter((t) => {
                if (t.type !== 'masuk' || !blockRegex.test(t.description)) return false;
                const txKey = getMonthKeyFromDate(t.date);
                if (!txKey || txKey <= pKey) return false;
                const cat = t.category || '';
                const desc = (t.description || '').toLowerCase();
                return cat === 'Pembayaran Tunggakan' || desc.includes('tunggakan');
              })
              .sort((a, b) => a.date.localeCompare(b.date));

            if (laterTungTxs.length > 0) {
              const txKey = getMonthKeyFromDate(laterTungTxs[0].date);
              settlementMonth = formatMonthYearFromKey(txKey) || formatMonthYearFromDate(laterTungTxs[0].date);
            }
          }

          if (!settlementMonth && house.previousArrearsNote) {
            const note = house.previousArrearsNote.toLowerCase();
            const match = note.match(/lunas\s+(?:di\s+|pada\s+|bulan\s+)?([a-z]+(?:\s+\d{4})?)/i);
            if (match && match[1]) {
              const parsedMonth = match[1].trim();
              const capMonth = parsedMonth.split(' ').map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
              settlementMonth = capMonth.includes('202') ? capMonth : `${capMonth} 2026`;
            }
          }

          if (!settlementMonth) {
            const hasZeroArrears = (house.previousArrears || 0) === 0;
            const isCurrentlyPaid = house.duesStatus === 'Lunas' || house.duesStatus === 'Bayar Lebih';
            if (hasZeroArrears && isCurrentlyPaid && pKey < currentActiveKey) {
              if (house.duesPaidDate) {
                const payMonthKey = getMonthKeyFromDate(house.duesPaidDate);
                if (payMonthKey && payMonthKey > pKey) {
                  settlementMonth = formatMonthYearFromKey(payMonthKey) || formatMonthYearFromDate(house.duesPaidDate);
                }
              }
              if (!settlementMonth) {
                settlementMonth = currentPeriod;
              }
            }
          }

          if (settlementMonth) {
            isPeriodLunas = true;
          }
        }

        let periodStatusText = 'Belum Bayar';
        if (isPureKosong) {
          periodStatusText = 'Bebas Iuran (Kosong)';
        } else if (isAdv) {
          periodStatusText = 'Lunas (Dimuka)';
        } else if (settlementMonth) {
          periodStatusText = `Lunas Bulan ${settlementMonth}`;
        } else if (isPeriodLunas) {
          periodStatusText = `Lunas (+Rp ${iuranPeriod.toLocaleString('id-ID')})`;
        }
        periodStatusMap[`Periode ${pLabel}`] = periodStatusText;

        if (isPeriodLunas && !isPureKosong) lunasPeriodsCount++;
        totalIuranAll += iuranPeriod;

        // Denda baksos
        const baksosTxs = transactions.filter((t) => {
          if (t.type !== 'masuk') return false;
          const cat = t.category || '';
          const desc = (t.description || '').toLowerCase();
          return (cat === 'Denda Baksos' || desc.includes('denda')) && blockRegex.test(t.description) && getMonthKeyFromDate(t.date) === pKey;
        });
        const agendaPaid = baksosAgendas.filter((a) => {
          return getMonthKeyFromDate(a.date) === pKey && a.attendance?.[house.id] === 'Tidak Hadir' && Boolean(a.finesPaid?.[house.id]);
        }).reduce((sum, a) => sum + (a.fineAmount || 10000), 0);
        const dendaPeriod = isPureKosong ? 0 : Math.max(baksosTxs.reduce((s, t) => s + t.amount, 0), agendaPaid);
        totalDendaAll += dendaPeriod;

        // Tunggakan
        const tunggakanTxs = transactions.filter((t) => {
          if (t.type !== 'masuk') return false;
          const desc = (t.description || '').toLowerCase();
          const cat = t.category || '';
          const isTung = cat === 'Pembayaran Tunggakan' || desc.includes('tunggakan') || desc.includes('bayar tunggakan');
          return isTung && blockRegex.test(t.description) && getMonthKeyFromDate(t.date) === pKey;
        });
        const tunggakanPeriod = isPureKosong ? 0 : tunggakanTxs.reduce((s, t) => s + t.amount, 0);
        totalTunggakanAll += tunggakanPeriod;
      });

      const grandTotalAll = totalIuranAll + totalDendaAll + totalTunggakanAll;

      // Tunggakan tersisa
      const isContract = house.ownership === 'Kontrak' || house.occupancy === 'Dikontrakan';
      const unpaidBaksos = baksosAgendas.filter((agenda) => {
        const att = agenda.attendance?.[house.id] || (house.occupancy === 'Kosong' ? 'Kosong' : isContract ? 'Tidak Wajib' : 'Hadir');
        return att === 'Tidak Hadir' && !agenda.finesPaid?.[house.id];
      });
      const baksosFineArrears = isPureKosong ? 0 : (house.customBaksosFineAmount !== undefined ? house.customBaksosFineAmount : unpaidBaksos.length * 10000);
      const duesArrears = isPureKosong ? 0 : (house.duesStatus === 'Belum Bayar' ? Math.max(0, nominal - (house.duesPaidAmount || 0)) : 0);
      const prevArrears = isPureKosong ? 0 : (house.previousArrears || 0);
      const remainingTotal = duesArrears + baksosFineArrears + prevArrears;

      let statusOverall = 'LUNAS SEMUA PERIODE';
      if (isPureKosong) {
        statusOverall = 'BEBAS IURAN (KOSONG)';
      } else if (lunasPeriodsCount === sortedAllPeriods.length && remainingTotal === 0) {
        statusOverall = (house.duesStatus === 'Bayar Lebih' || (house.duesPaidMonths || 0) > 1) ? 'BAYAR LEBIH (>1 BLN)' : 'LUNAS SEMUA PERIODE';
      } else if (remainingTotal === 0 && house.duesStatus === 'Bayar Lebih') {
        statusOverall = 'BAYAR LEBIH (>1 BLN)';
      } else {
        statusOverall = 'ADA TUNGGAKAN';
      }

      return {
        No: idx + 1,
        'No Blok': house.blockNumber,
        'Nama Kepala Keluarga': payerName,
        ...periodStatusMap,
        'Jumlah Periode Tercatat': sortedAllPeriods.length,
        'Periode Lunas': isPureKosong ? '-' : `${lunasPeriodsCount} dari ${sortedAllPeriods.length} Periode`,
        'Total Iuran Rutin (Rp)': totalIuranAll,
        'Total Denda Baksos (Rp)': totalDendaAll,
        'Total Pembayaran Tunggakan (Rp)': totalTunggakanAll,
        'TOTAL KESELURUHAN KAS MASUK (Rp)': grandTotalAll,
        'Sisa Tunggakan Berjalan (Rp)': remainingTotal,
        'Status Kelunasan Keseluruhan': statusOverall,
      };
    });

    const wsOverall = XLSX.utils.json_to_sheet(overallRows);
    wsOverall['!cols'] = [
      { wch: 5 },
      { wch: 10 },
      { wch: 24 },
      { wch: 16 },
      { wch: 22 },
      { wch: 24 },
      { wch: 22 },
      { wch: 22 },
      { wch: 26 },
      { wch: 30 },
      { wch: 24 },
      { wch: 26 },
    ];
    XLSX.utils.book_append_sheet(wb, wsOverall, 'Rekap Keseluruhan Kas Per KK');
  }

  // 4. SHEET: RINCIAN TUNGGAKAN & DENDA WARGA
  if (exportScope === 'all' || exportScope === 'tunggakan_only') {
    const arrearsRows = residents.map((house, idx) => {
      const nominal = getHouseDuesNominal(house);
      const duesArrears =
        house.occupancy === 'Kosong'
          ? 0
          : house.duesStatus === 'Belum Bayar'
          ? Math.max(0, nominal - (house.duesPaidAmount || 0))
          : 0;

      const isContract = house.ownership === 'Kontrak' || house.occupancy === 'Dikontrakan';
      const unpaidBaksos = baksosAgendas.filter((agenda) => {
        const att =
          agenda.attendance?.[house.id] ||
          (house.occupancy === 'Kosong' ? 'Kosong' : isContract ? 'Tidak Wajib' : 'Hadir');
        const paid = agenda.finesPaid?.[house.id];
        return att === 'Tidak Hadir' && !paid;
      });
      const baksosFineArrears = unpaidBaksos.length * 10000;
      const previousArrears = house.previousArrears || 0;
      const totalArrears = duesArrears + baksosFineArrears + previousArrears;

      return {
        No: idx + 1,
        'No Blok': house.blockNumber,
        'Kepala Keluarga': house.headName,
        'No. WhatsApp': house.phone || '-',
        'Status Hunian': house.occupancy,
        'Tunggakan Iuran Bulan Ini (Rp)': duesArrears,
        'Jumlah Absen Baksos Belum Lunas': unpaidBaksos.length,
        'Tunggakan Denda Baksos (Rp)': baksosFineArrears,
        'Tunggakan Bulan/Tahun Lalu (Rp)': previousArrears,
        'Keterangan Tunggakan Lalu': house.previousArrearsNote || '-',
        'TOTAL TUNGGAKAN (Rp)': totalArrears,
        'Status Tagihan': totalArrears > 0 ? 'TERTUNGGAK' : 'LUNAS / BERSIH',
      };
    });

    const wsArrears = XLSX.utils.json_to_sheet(arrearsRows);
    wsArrears['!cols'] = [
      { wch: 5 },
      { wch: 10 },
      { wch: 24 },
      { wch: 16 },
      { wch: 16 },
      { wch: 26 },
      { wch: 24 },
      { wch: 24 },
      { wch: 26 },
      { wch: 32 },
      { wch: 22 },
      { wch: 18 },
    ];
    XLSX.utils.book_append_sheet(wb, wsArrears, 'Rincian Tunggakan');
  }

  const filePrefix =
    exportScope === 'mutasi_only'
      ? 'Laporan_Mutasi_Kas_Gang_Mandor'
      : exportScope === 'per_kk_only'
      ? 'Laporan_Kas_Per_KK_Gang_Mandor'
      : exportScope === 'rekap_total_only'
      ? 'Laporan_Rekap_Keseluruhan_Kas_Per_KK_Gang_Mandor'
      : exportScope === 'tunggakan_only'
      ? 'Laporan_Tunggakan_Warga_Gang_Mandor'
      : 'Laporan_Keuangan_Lengkap_Gang_Mandor';

  XLSX.writeFile(wb, `${filePrefix}_${todayStr}.xlsx`);
}
