import * as XLSX from 'xlsx';
import { BaksosAgenda, CashTransaction, DuesStatus, ResidentHouse } from '../types';
import { formatDateDDMMYYYY, getSubsequentMonthLabels, isHouseVacant } from './helpers';

export type PaymentChoiceOption =
  | 'Semua Lunas'
  | 'Hanya Iuran'
  | 'Hanya Baksos'
  | 'Hanya Tunggakan'
  | 'Belum Bayar'
  | 'Bebas Iuran';

export interface ParsedBillingRow {
  rowNumber: number;
  blockNumber: string;
  headName: string;
  occupancy: string;
  period: string;
  duesAmount: number;
  previousArrears: number;
  previousArrearsNote: string;
  baksosFine: number;
  unpaidBaksosCount: number;
  totalBill: number;
  paymentChoice: PaymentChoiceOption;
  paidDues: boolean;
  paidBaksos: boolean;
  paidPreviousArrears: boolean;
  totalReceived: number;
  paidDate: string;
  notes: string;
  matchedResident?: ResidentHouse;
  isVacant: boolean;
  isNotOccupiedYet: boolean;
  isValid: boolean;
  errorMessage?: string;
}

export interface ParseBillingExcelResult {
  success: boolean;
  error?: string;
  rows?: ParsedBillingRow[];
  updatedResidents?: ResidentHouse[];
  baksosPaidActions?: { agendaId: string; residentId: string; headName: string; blockNumber: string }[];
  cashTransactions?: Omit<CashTransaction, 'id'>[];
  summary?: {
    totalRows: number;
    matchedCount: number;
    unmatchedCount: number;
    semuaLunasCount: number;
    hanyaIuranCount: number;
    hanyaBaksosCount: number;
    hanyaTunggakanCount: number;
    belumBayarCount: number;
    kosongCount: number;
    totalCashInflow: number;
    totalBillGenerated: number;
  };
}

function normalizeBlock(raw: any): string {
  if (!raw) return '';
  return String(raw)
    .trim()
    .toUpperCase()
    .replace(/\s+/g, '')
    .replace(/^BLOK/i, '')
    .replace(/-/g, '/');
}

function parseExcelDate(raw: any, fallbackDate: string): string {
  if (!raw) return fallbackDate;
  if (raw instanceof Date && !isNaN(raw.getTime())) {
    return raw.toISOString().slice(0, 10);
  }
  if (typeof raw === 'number' && raw > 30000 && raw < 70000) {
    const excelEpoch = new Date(Date.UTC(1899, 11, 30));
    const jsDate = new Date(excelEpoch.getTime() + raw * 86400000);
    if (!isNaN(jsDate.getTime())) {
      return jsDate.toISOString().slice(0, 10);
    }
  }
  const str = String(raw).trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(str)) {
    return str;
  }
  const parts = str.split(/[\/\-\.]/);
  if (parts.length === 3) {
    if (parts[0].length <= 2 && parts[1].length <= 2 && parts[2].length === 4) {
      const d = parts[0].padStart(2, '0');
      const m = parts[1].padStart(2, '0');
      const y = parts[2];
      return `${y}-${m}-${d}`;
    }
  }
  return fallbackDate;
}

/**
 * Downloads a comprehensive Excel template for Financial Billing / Penarikan Keuangan.
 * Features exact column alignment with the web table:
 * 1. No
 * 2. No Blok
 * 3. Kepala Keluarga / Penanggung Jawab
 * 4. Status Rumah
 * 5. 1. Iuran Bulanan
 * 6. 2. Tunggakan Lalu
 * 7. Keterangan Tunggakan Lalu
 * 8. 3. Denda Baksos
 * 9. Total Tagihan
 * 10. Pilihan Pembayaran & Aksi
 * 11. Tanggal Bayar
 * 12. Catatan
 */
export function downloadBillingExcelTemplate(
  residents: ResidentHouse[],
  periodLabel: string,
  defaultNominal: number = 50000,
  baksosAgendas: BaksosAgenda[] = []
): void {
  const todayStr = new Date().toISOString().slice(0, 10);
  const cleanPeriod = periodLabel.replace(/[\/\\?%*:|"<>]/g, '_').trim();

  // 1. DATA SHEET (Sama persis dengan format kolom di web)
  const dataRows = residents.map((house, idx) => {
    const isVacant = house.occupancy === 'Kosong' || isHouseVacant(house);
    const isContract = house.ownership === 'Kontrak' || house.occupancy === 'Dikontrakan';
    const isNotOccupiedYet = house.occupancy === 'Belum Ditempati';

    // 1. Jumlah Iuran Bulanan: Kosongkan untuk rumah kosong (0), isi nominal untuk terisi
    const duesNominal = isVacant
      ? 0
      : house.customDuesAmount !== undefined
      ? house.customDuesAmount
      : defaultNominal;

    // 2. Data Tunggakan Sebelumnya & Keterangan
    const prevArrears = isVacant ? 0 : house.previousArrears || 0;
    const prevNote = house.previousArrearsNote || '';

    // 3. Denda Baksos (Rp 10.000 untuk absen 'Tidak Hadir' yang belum lunas)
    const unpaidBaksos = baksosAgendas.filter((agenda) => {
      const attendance =
        agenda.attendance?.[house.id] ||
        (house.occupancy === 'Kosong' ? 'Kosong' : isContract ? 'Tidak Wajib' : 'Hadir');
      const isFinePaid = agenda.finesPaid?.[house.id];
      return attendance === 'Tidak Hadir' && !isFinePaid;
    });
    const baksosFine = unpaidBaksos.length * 10000;

    // Total Tagihan
    const duesUnpaid = house.duesStatus === 'Belum Bayar' ? duesNominal : 0;
    const totalBill = duesUnpaid + prevArrears + baksosFine;

    // Default Pilihan Bayar & Aksi sama persis dengan web
    let defaultChoice: PaymentChoiceOption = 'Belum Bayar';
    if (isVacant) {
      defaultChoice = 'Bebas Iuran';
    } else if (house.duesStatus === 'Bayar Lebih') {
      defaultChoice = 'Semua Lunas';
    } else if (house.duesStatus === 'Lunas') {
      defaultChoice = totalBill === 0 ? 'Semua Lunas' : 'Hanya Iuran';
    }

    return {
      No: idx + 1,
      'No Blok': house.blockNumber,
      'Kepala Keluarga / Penanggung Jawab': house.duesHeadNameOverride || house.headName,
      'Status Rumah': house.occupancy,
      '1. Iuran Bulanan': isVacant ? 0 : duesNominal,
      '2. Tunggakan Lalu': prevArrears > 0 ? prevArrears : 0,
      'Keterangan Tunggakan Lalu': prevNote,
      '3. Denda Baksos': baksosFine > 0 ? baksosFine : 0,
      'Total Tagihan': totalBill > 0 ? totalBill : 0,
      'Pilihan Pembayaran & Aksi': defaultChoice,
      'Tanggal Bayar': defaultChoice !== 'Belum Bayar' && defaultChoice !== 'Bebas Iuran' ? todayStr : '',
      Catatan: isVacant ? 'Rumah Kosong (Bebas Tagihan)' : isNotOccupiedYet ? 'Belum Ditempati' : '',
    };
  });

  const wsData = XLSX.utils.json_to_sheet(dataRows);
  wsData['!cols'] = [
    { wch: 6 },  // No
    { wch: 14 }, // No Blok
    { wch: 34 }, // Kepala Keluarga / Penanggung Jawab
    { wch: 18 }, // Status Rumah
    { wch: 18 }, // 1. Iuran Bulanan
    { wch: 18 }, // 2. Tunggakan Lalu
    { wch: 30 }, // Keterangan Tunggakan Lalu
    { wch: 18 }, // 3. Denda Baksos
    { wch: 18 }, // Total Tagihan
    { wch: 28 }, // Pilihan Pembayaran & Aksi
    { wch: 16 }, // Tanggal Bayar
    { wch: 32 }, // Catatan
  ];

  // 2. INSTRUCTIONS SHEET
  const instructions = [
    {
      'Ketentuan / Kolom': 'Menu Penarikan Keuangan dan Bakti Sosial',
      'Aturan & Cara Pengisian':
        'Format tabel di Excel ini diselaraskan sama persis dengan tabel web "Input Data Penarikan Keuangan dan Bakti Sosial".',
    },
    {
      'Ketentuan / Kolom': 'Kepala Keluarga / Penanggung Jawab',
      'Aturan & Cara Pengisian':
        'Dapat diedit sesuai nama pembayar / penanggung jawab penarikan di blok bersangkutan tanpa merusak data KTP asli di Buku Induk.',
    },
    {
      'Ketentuan / Kolom': '1. Iuran Bulanan',
      'Aturan & Cara Pengisian':
        'Nominal iuran bulanan untuk periode ini. Rumah kosong murni terisi 0 (bebas iuran). Rumah belum ditempati atau dihuni bisa diisi nominalnya.',
    },
    {
      'Ketentuan / Kolom': '2. Tunggakan Lalu & Keterangan',
      'Aturan & Cara Pengisian':
        'Nominal tunggakan bulan/tahun sebelumnya beserta keterangannya (misal: Tunggakan Agustus 2026).',
    },
    {
      'Ketentuan / Kolom': '3. Denda Baksos',
      'Aturan & Cara Pengisian':
        'Akumulasi denda kerja bakti/bakti sosial warga yang belum lunas (Rp 10.000 / ketidakhadiran).',
    },
    {
      'Ketentuan / Kolom': 'Total Tagihan',
      'Aturan & Cara Pengisian':
        'Total akumulasi yang harus dibayar: 1. Iuran Bulanan + 2. Tunggakan Lalu + 3. Denda Baksos.',
    },
    {
      'Ketentuan / Kolom': 'Pilihan Pembayaran & Aksi',
      'Aturan & Cara Pengisian':
        'Isi status pembayaran sama seperti di web:\n1. "Semua Lunas" -> Membayar Iuran + Denda Baksos + Tunggakan Lalu sekaligus.\n2. "Hanya Iuran" -> Hanya membayar Iuran Bulanan saja (Baksos & Tunggakan tetap menunggak).\n3. "Hanya Baksos" -> Hanya membayar Denda Baksos saja (Iuran & Tunggakan tetap menunggak).\n4. "Hanya Tunggakan" -> Hanya membayar Tunggakan Lalu saja (Iuran & Baksos tetap menunggak).\n5. "Belum Bayar" -> Belum ada pembayaran untuk periode ini.\n6. "Bebas Iuran" -> Rumah kosong bebas tagihan.',
    },
    {
      'Ketentuan / Kolom': 'Alur Rekapan Otomatis',
      'Aturan & Cara Pengisian':
        'Komponen yang dibayar otomatis masuk ke Rekap Kas Per KK dan Buku Kas Utama (+). Komponen yang belum dibayar otomatis masuk ke Rekap Tunggakan.',
    },
  ];

  const wsInstructions = XLSX.utils.json_to_sheet(instructions);
  wsInstructions['!cols'] = [{ wch: 36 }, { wch: 95 }];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, wsData, 'Penarikan_Keuangan');
  XLSX.utils.book_append_sheet(wb, wsInstructions, 'Petunjuk_Pengisian');
  XLSX.writeFile(wb, `Template_Penarikan_Keuangan_${cleanPeriod}.xlsx`);
}

/**
 * Parses uploaded Excel file for Penarikan Keuangan with support for partial/selective component payment.
 */
export async function parseBillingExcelFile(
  file: File,
  targetPeriod: string,
  defaultNominal: number = 50000,
  existingResidents: ResidentHouse[],
  baksosAgendas: BaksosAgenda[] = []
): Promise<ParseBillingExcelResult> {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const buffer = e.target?.result as ArrayBuffer;
        if (!buffer) {
          resolve({ success: false, error: 'File Excel kosong atau tidak dapat dibaca.' });
          return;
        }
        const wb = XLSX.read(buffer, { type: 'array', cellDates: true });
        if (!wb.SheetNames || wb.SheetNames.length === 0) {
          resolve({ success: false, error: 'File Excel tidak memiliki lembar kerja (sheet).' });
          return;
        }

        const targetSheetName =
          wb.SheetNames.find(
            (s) =>
              s.toLowerCase().includes('penarikan') ||
              s.toLowerCase().includes('keuangan') ||
              s.toLowerCase().includes('iuran')
          ) || wb.SheetNames[0];

        const worksheet = wb.Sheets[targetSheetName];
        if (!worksheet) {
          resolve({ success: false, error: 'Lembar kerja penarikan keuangan tidak ditemukan.' });
          return;
        }

        const rawRows: any[] = XLSX.utils.sheet_to_json(worksheet, { defval: '' });
        if (rawRows.length === 0) {
          resolve({ success: false, error: 'File Excel tidak memiliki baris data.' });
          return;
        }

        const todayStr = new Date().toISOString().slice(0, 10);
        const residentMap = new Map<string, ResidentHouse>();
        existingResidents.forEach((r) => {
          residentMap.set(normalizeBlock(r.blockNumber), r);
        });

        const parsedRows: ParsedBillingRow[] = [];
        const updatedResidents: ResidentHouse[] = [];
        const baksosPaidActions: { agendaId: string; residentId: string; headName: string; blockNumber: string }[] = [];
        const cashTransactions: Omit<CashTransaction, 'id'>[] = [];

        let semuaLunasCount = 0;
        let hanyaIuranCount = 0;
        let hanyaBaksosCount = 0;
        let hanyaTunggakanCount = 0;
        let belumBayarCount = 0;
        let kosongCount = 0;
        let matchedCount = 0;
        let unmatchedCount = 0;
        let totalCashInflow = 0;
        let totalBillGenerated = 0;

        rawRows.forEach((row, idx) => {
          const getVal = (...keys: string[]) => {
            for (const k of keys) {
              const matchedKey = Object.keys(row).find(
                (rk) => rk.toLowerCase().trim() === k.toLowerCase().trim()
              );
              if (matchedKey && row[matchedKey] !== undefined && row[matchedKey] !== '') {
                return row[matchedKey];
              }
            }
            return '';
          };

          const rawBlock = getVal('No Blok', 'Blok', 'Nomor Blok', 'No. Blok', 'BlockNumber', 'Kavling');
          if (!rawBlock) return;

          const normBlock = normalizeBlock(rawBlock);
          const matchedResident = residentMap.get(normBlock);

          const rawHeadName = String(
            getVal(
              'Kepala Keluarga / Penanggung Jawab',
              'Kepala Keluarga/Penanggung Jawab',
              'Kepala Keluarga',
              'Nama Kepala Keluarga',
              'Penanggung Jawab',
              'Nama',
              'HeadName'
            )
          ).trim();
          const rawOccupancy = String(
            getVal('Status Rumah', 'Status Hunian', 'Hunian', 'Occupancy')
          ).trim();
          const rawPeriod =
            String(getVal('Periode Penarikan', 'Periode Iuran', 'Periode', 'Bulan')).trim() ||
            targetPeriod;

          const rawDuesAmount = getVal(
            '1. Iuran Bulanan',
            '1. Iuran Bulanan (Rp)',
            'Iuran Bulanan',
            'Jumlah Iuran Bulanan (Rp)',
            'Jumlah Iuran (Rp)',
            'Jumlah Iuran',
            'Nominal Iuran',
            'Iuran'
          );
          const rawPrevArrears = getVal(
            '2. Tunggakan Lalu',
            '2. Tunggakan Lalu (Rp)',
            'Tunggakan Lalu (Rp)',
            'Tunggakan Lalu',
            'Tunggakan Sebelumnya',
            'Tunggakan'
          );
          const rawPrevNote = String(
            getVal(
              'Keterangan Tunggakan Lalu',
              'Ket. Tunggakan Lalu',
              'Keterangan Tunggakan',
              'Ket Tunggakan',
              'Keterangan'
            )
          ).trim();
          const rawBaksosFine = getVal(
            '3. Denda Baksos',
            '3. Denda Baksos (Rp)',
            'Denda Baksos (Rp)',
            'Denda Baksos',
            'Denda'
          );
          const rawChoice = String(
            getVal(
              'Pilihan Pembayaran & Aksi',
              'Pilihan Pembayaran & Aksi (Lunas/Belum)',
              'Pilihan Pembayaran',
              'Pilihan Bayar',
              'Status Pembayaran',
              'Status Bayar',
              'Aksi',
              'Status'
            )
          ).trim().toLowerCase();
          const rawTotalReceived = getVal(
            'Total Tagihan',
            'Total Tagihan (Rp)',
            'Total Uang Diterima (Rp)',
            'Total Diterima',
            'Total Bayar',
            'Uang Diterima'
          );
          const rawPaidDate = getVal(
            'Tanggal Bayar',
            'Tanggal Bayar (YYYY-MM-DD)',
            'Tanggal',
            'Tgl Bayar'
          );
          const rawNotes = String(getVal('Catatan Penarikan', 'Catatan', 'Keterangan')).trim();

          const currentOccupancy = rawOccupancy || (matchedResident ? matchedResident.occupancy : 'Ditempati');
          const isVacant =
            currentOccupancy === 'Kosong' ||
            /kosong/i.test(currentOccupancy) ||
            /kosong/i.test(rawHeadName) ||
            (matchedResident ? isHouseVacant(matchedResident) : false);
          const isNotOccupiedYet = currentOccupancy === 'Belum Ditempati';
          const isContract =
            currentOccupancy === 'Dikontrakan' ||
            (matchedResident ? matchedResident.ownership === 'Kontrak' || matchedResident.occupancy === 'Dikontrakan' : false);

          // 1. Hitung Jumlah Iuran Bulanan
          let duesAmount = 0;
          if (isVacant) {
            duesAmount = 0; // Rumah kosong: kosongkan jumlah iurannya
          } else {
            const parsedDues = Number(String(rawDuesAmount).replace(/[^0-9]/g, ''));
            if (!isNaN(parsedDues) && parsedDues >= 0 && rawDuesAmount !== '') {
              duesAmount = parsedDues;
            } else if (matchedResident?.customDuesAmount !== undefined) {
              duesAmount = matchedResident.customDuesAmount;
            } else {
              duesAmount = defaultNominal;
            }
          }

          // 2. Hitung Tunggakan Lalu
          const previousArrears = isVacant
            ? 0
            : Number(String(rawPrevArrears).replace(/[^0-9]/g, '')) ||
              (matchedResident ? matchedResident.previousArrears || 0 : 0);
          const previousArrearsNote = rawPrevNote || matchedResident?.previousArrearsNote || '';

          // 3. Hitung Denda Baksos dari data agenda
          const unpaidBaksosList = baksosAgendas.filter((agenda) => {
            if (!matchedResident) return false;
            const attendance =
              agenda.attendance?.[matchedResident.id] ||
              (matchedResident.occupancy === 'Kosong' ? 'Kosong' : isContract ? 'Tidak Wajib' : 'Hadir');
            const isFinePaid = agenda.finesPaid?.[matchedResident.id];
            return attendance === 'Tidak Hadir' && !isFinePaid;
          });
          const calculatedBaksosFine = isVacant ? 0 : unpaidBaksosList.length * 10000;
          const parsedBaksosFineNum = Number(String(rawBaksosFine).replace(/[^0-9]/g, ''));
          const baksosFine = !isNaN(parsedBaksosFineNum) && rawBaksosFine !== '' ? parsedBaksosFineNum : calculatedBaksosFine;

          const totalBill = duesAmount + previousArrears + baksosFine;

          // 4. Deteksi Pilihan Bayar (Membayar Salah Satu / Semua / Belum)
          let paymentChoice: PaymentChoiceOption = 'Belum Bayar';
          let paidDues = false;
          let paidBaksos = false;
          let paidPreviousArrears = false;

          if (/bebas/i.test(rawChoice) || (isVacant && !/lunas|bayar|semua/i.test(rawChoice))) {
            paymentChoice = 'Bebas Iuran';
          } else if (/semua|all|lunas|lunas semua|sudah semua/i.test(rawChoice)) {
            paymentChoice = 'Semua Lunas';
            paidDues = true;
            paidBaksos = baksosFine > 0;
            paidPreviousArrears = previousArrears > 0;
            semuaLunasCount++;
          } else if (/hanya iuran|iuran saja|iuran/i.test(rawChoice)) {
            paymentChoice = 'Hanya Iuran';
            paidDues = true;
            hanyaIuranCount++;
          } else if (/hanya baksos|baksos saja|denda|denda baksos/i.test(rawChoice)) {
            paymentChoice = 'Hanya Baksos';
            paidBaksos = true;
            hanyaBaksosCount++;
          } else if (/hanya tunggakan|tunggakan saja|tunggakan lalu|tunggakan/i.test(rawChoice)) {
            paymentChoice = 'Hanya Tunggakan';
            paidPreviousArrears = true;
            hanyaTunggakanCount++;
          } else if (isVacant) {
            paymentChoice = 'Bebas Iuran';
            kosongCount++;
          } else {
            paymentChoice = 'Belum Bayar';
            belumBayarCount++;
          }

          if (paymentChoice === 'Bebas Iuran') {
            kosongCount++;
          }

          // Hitung Uang Diterima
          let totalReceived = Number(String(rawTotalReceived).replace(/[^0-9]/g, '')) || 0;
          if (totalReceived === 0) {
            if (paidDues) totalReceived += duesAmount;
            if (paidBaksos) totalReceived += baksosFine;
            if (paidPreviousArrears) totalReceived += previousArrears;
          }

          const parsedDate = parseExcelDate(rawPaidDate, todayStr);

          if (matchedResident) {
            matchedCount++;
          } else {
            unmatchedCount++;
          }

          totalCashInflow += totalReceived;
          totalBillGenerated += totalBill;

          const finalHeadName =
            rawHeadName ||
            (matchedResident
              ? matchedResident.duesHeadNameOverride || matchedResident.headName
              : `Blok ${rawBlock}`);

          parsedRows.push({
            rowNumber: idx + 2,
            blockNumber: matchedResident ? matchedResident.blockNumber : String(rawBlock).trim(),
            headName: finalHeadName,
            occupancy: currentOccupancy,
            period: rawPeriod,
            duesAmount,
            previousArrears,
            previousArrearsNote,
            baksosFine,
            unpaidBaksosCount: unpaidBaksosList.length,
            totalBill,
            paymentChoice,
            paidDues,
            paidBaksos,
            paidPreviousArrears,
            totalReceived,
            paidDate: parsedDate,
            notes: rawNotes,
            matchedResident,
            isVacant,
            isNotOccupiedYet,
            isValid: true,
          });

          // Build updated resident
          if (matchedResident) {
            const nextDuesStatus: DuesStatus = paidDues
              ? 'Lunas'
              : matchedResident.duesStatus === 'Bayar Lebih'
              ? 'Bayar Lebih'
              : 'Belum Bayar';

            const remainingPrevArrears = paidPreviousArrears ? 0 : previousArrears;
            const trimmedHead = rawHeadName.trim();
            const headOverride =
              trimmedHead && trimmedHead !== matchedResident.headName
                ? trimmedHead
                : matchedResident.duesHeadNameOverride;

            const updatedHouse: ResidentHouse = {
              ...matchedResident,
              duesHeadNameOverride: headOverride,
              customDuesAmount: isVacant ? 0 : duesAmount,
              customBaksosFineAmount: paidBaksos ? 0 : baksosFine,
              duesStatus: nextDuesStatus,
              duesPaidAmount: 0,
              duesPaidMonths: paidDues ? 1 : 0,
              duesPrepaidBalance: 0,
              duesPaidDate: paidDues ? parsedDate : matchedResident.duesPaidDate,
              duesMonthNote: rawPeriod || targetPeriod,
              previousArrears: remainingPrevArrears,
              previousArrearsNote: remainingPrevArrears > 0 ? previousArrearsNote : '',
            };

            updatedResidents.push(updatedHouse);

            const displayName = headOverride || matchedResident.headName;
            const houseDesc = isVacant ? `(Rumah Kosong - ${displayName})` : `(${displayName})`;

            // 1. Catat transaksi iuran bulanan ke Kas Utama
            if (paidDues && duesAmount > 0) {
              cashTransactions.push({
                date: parsedDate,
                type: 'masuk',
                pool: 'Kas Utama',
                category: 'Iuran Warga',
                description: `Penarikan Iuran Bulanan (${rawPeriod}) Warga Blok ${matchedResident.blockNumber} ${houseDesc}${
                  rawNotes ? ` - ${rawNotes}` : ''
                }`,
                amount: duesAmount,
              });
            }

            // 2. Catat transaksi denda baksos ke Kas Utama & siapkan aksi pelunasan baksos
            if (paidBaksos && baksosFine > 0) {
              unpaidBaksosList.forEach((agenda) => {
                baksosPaidActions.push({
                  agendaId: agenda.id,
                  residentId: matchedResident.id,
                  headName: displayName,
                  blockNumber: matchedResident.blockNumber,
                });
              });

              cashTransactions.push({
                date: parsedDate,
                type: 'masuk',
                pool: 'Kas Utama',
                category: 'Denda Baksos',
                description: `Pelunasan Denda Baksos Warga Blok ${matchedResident.blockNumber} ${houseDesc}`,
                amount: baksosFine,
              });
            }

            // 3. Catat transaksi pelunasan tunggakan sebelumnya ke Kas Utama
            if (paidPreviousArrears && previousArrears > 0) {
              cashTransactions.push({
                date: parsedDate,
                type: 'masuk',
                pool: 'Kas Utama',
                category: 'Iuran Warga',
                description: `Pelunasan Tunggakan Lalu Blok ${matchedResident.blockNumber} ${houseDesc}${
                  previousArrearsNote ? ` (${previousArrearsNote})` : ''
                }`,
                amount: previousArrears,
              });
            }
          }
        });

        resolve({
          success: true,
          rows: parsedRows,
          updatedResidents,
          baksosPaidActions,
          cashTransactions,
          summary: {
            totalRows: parsedRows.length,
            matchedCount,
            unmatchedCount,
            semuaLunasCount,
            hanyaIuranCount,
            hanyaBaksosCount,
            hanyaTunggakanCount,
            belumBayarCount,
            kosongCount,
            totalCashInflow,
            totalBillGenerated,
          },
        });
      } catch (err: any) {
        resolve({
          success: false,
          error: `Gagal memproses file Excel Penarikan Keuangan: ${err?.message || 'Format tidak sesuai.'}`,
        });
      }
    };
    reader.onerror = () => {
      resolve({ success: false, error: 'Gagal membaca file dari komputer/HP Anda.' });
    };
    reader.readAsArrayBuffer(file);
  });
}
