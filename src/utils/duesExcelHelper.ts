import * as XLSX from 'xlsx';
import { CashTransaction, DuesStatus, ResidentHouse } from '../types';
import {
  formatDateDDMMYYYY,
  getSubsequentMonthLabels,
  isHouseVacant,
} from './helpers';

export interface ParsedDuesRow {
  rowNumber: number;
  blockNumber: string;
  headName: string;
  occupancy: string;
  period: string;
  nominal: number;
  status: 'Lunas' | 'Bayar Lebih' | 'Belum Bayar' | 'Bebas Iuran';
  paidMonths: number;
  totalReceived: number;
  paidDate: string;
  previousArrears: number;
  previousArrearsNote: string;
  notes: string;
  matchedResident?: ResidentHouse;
  isVacant: boolean;
  isValid: boolean;
  errorMessage?: string;
}

export interface ParseDuesExcelResult {
  success: boolean;
  error?: string;
  rows?: ParsedDuesRow[];
  updatedResidents?: ResidentHouse[];
  cashTransactions?: Omit<CashTransaction, 'id'>[];
  summary?: {
    totalRows: number;
    matchedCount: number;
    unmatchedCount: number;
    lunasCount: number;
    bayarLebihCount: number;
    belumBayarCount: number;
    kosongCount: number;
    totalCashInflow: number;
    totalArrears: number;
  };
}

/**
 * Downloads a prefilled Excel template for Monthly Dues (Iuran Kas Per KK).
 */
export function downloadDuesExcelTemplate(
  residents: ResidentHouse[],
  periodLabel: string,
  defaultNominal: number = 50000
): void {
  const todayStr = new Date().toISOString().slice(0, 10);
  const cleanPeriod = periodLabel.replace(/[\/\\?%*:|"<>]/g, '_').trim();

  // 1. DATA SHEET
  const dataRows = residents.map((house, idx) => {
    const isVacant =
      house.occupancy === 'Kosong' ||
      isHouseVacant(house);

    const nominal =
      house.customDuesAmount !== undefined ? house.customDuesAmount : defaultNominal;

    const isAdvance = house.duesStatus === 'Bayar Lebih';
    const isPaid = house.duesStatus === 'Lunas' || isAdvance;
    const monthsCount = isAdvance
      ? Math.max(2, house.duesPaidMonths || 2)
      : isPaid
      ? 1
      : 0;

    let statusLabel = 'Belum Bayar';
    if (isVacant) {
      statusLabel = isPaid ? 'Lunas' : 'Bebas Iuran';
    } else if (isAdvance) {
      statusLabel = 'Bayar Lebih';
    } else if (isPaid) {
      statusLabel = 'Lunas';
    }

    const totalReceived = isAdvance
      ? nominal * monthsCount + (house.duesPrepaidBalance || 0)
      : isPaid
      ? nominal
      : 0;

    return {
      No: idx + 1,
      'No Blok': house.blockNumber,
      'Kepala Keluarga': house.duesHeadNameOverride || house.headName,
      'Status Rumah': house.occupancy,
      'Periode Iuran': periodLabel,
      'Nominal Iuran (Rp)': isVacant && !isPaid ? 0 : nominal,
      'Status Pembayaran': statusLabel,
      'Jumlah Bulan Dibayar': monthsCount,
      'Total Uang Diterima (Rp)': totalReceived,
      'Tanggal Bayar (YYYY-MM-DD)': isPaid ? house.duesPaidDate || todayStr : '',
      'Tunggakan Lalu (Rp)': house.previousArrears || 0,
      'Keterangan Tunggakan Lalu': house.previousArrearsNote || '',
      'Catatan Pembayaran': '',
    };
  });

  const wsData = XLSX.utils.json_to_sheet(dataRows);
  wsData['!cols'] = [
    { wch: 6 }, // No
    { wch: 12 }, // No Blok
    { wch: 26 }, // Kepala Keluarga
    { wch: 14 }, // Status Rumah
    { wch: 18 }, // Periode Iuran
    { wch: 18 }, // Nominal Iuran
    { wch: 18 }, // Status Pembayaran
    { wch: 16 }, // Jumlah Bulan Dibayar
    { wch: 22 }, // Total Uang Diterima
    { wch: 20 }, // Tanggal Bayar
    { wch: 18 }, // Tunggakan Lalu
    { wch: 28 }, // Keterangan Tunggakan Lalu
    { wch: 24 }, // Catatan Pembayaran
  ];

  // 2. INSTRUCTIONS SHEET
  const instructions = [
    {
      Kolom: 'No Blok',
      'Aturan Pengisian':
        'Wajib sama dengan nomor blok warga (contoh: K2/25, K3/01). Digunakan untuk mencocokkan data.',
    },
    {
      Kolom: 'Status Pembayaran',
      'Aturan Pengisian':
        'Pilih salah satu: "Lunas", "Bayar Lebih", "Belum Bayar", atau "Bebas Iuran".',
    },
    {
      Kolom: 'Jumlah Bulan Dibayar',
      'Aturan Pengisian':
        'Isi 1 jika Lunas 1 bulan. Isi 2 jika bayar lebih 1 bulan (mencakup bulan berjalan + 1 bulan berikutnya, misal Mei dan Juni = total 2 bulan). Isi 3 jika bayar lebih 2 bulan (total 3 bulan), dst. Isi 0 jika belum bayar.',
    },
    {
      Kolom: 'Total Uang Diterima (Rp)',
      'Aturan Pengisian':
        'Jumlah rupiah kas yang disetorkan warga. Otomatis masuk ke Buku Kas Keluar/Masuk (Kas Utama).',
    },
    {
      Kolom: 'Tanggal Bayar (YYYY-MM-DD)',
      'Aturan Pengisian':
        'Format YYYY-MM-DD (contoh: 2026-10-22) atau DD/MM/YYYY. Jika kosong pada status Lunas, sistem otomatis menggunakan tanggal hari ini.',
    },
    {
      Kolom: 'Rumah Kosong',
      'Aturan Pengisian':
        'Rumah kosong otomatis "Bebas Iuran" (tanpa tunggakan). Namun jika pemilik bersedia bayar, isi status "Lunas" dan nominal uang diterima.',
    },
    {
      Kolom: 'Tunggakan Lalu (Rp)',
      'Aturan Pengisian':
        'Jika ada tunggakan sebelum periode ini, isi nominalnya. Data otomatis terhubung ke menu Daftar Tunggakan Warga.',
    },
    {
      Kolom: 'Koneksi ke Kas',
      'Aturan Pengisian':
        'Semua baris berstatus Lunas / Bayar Lebih akan otomatis tercatat sebagai transaksi Masuk di Buku Kas (Kas Utama).',
    },
  ];

  const wsInstructions = XLSX.utils.json_to_sheet(instructions);
  wsInstructions['!cols'] = [{ wch: 28 }, { wch: 80 }];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, wsData, 'Data_Iuran_KK');
  XLSX.utils.book_append_sheet(wb, wsInstructions, 'Petunjuk_Pengisian');

  XLSX.writeFile(wb, `Template_Iuran_Kas_KK_${cleanPeriod}.xlsx`);
}

/**
 * Normalizes block strings for resilient matching (e.g., "k2/25", "K2 / 25", "k2-25" -> "K2/25")
 */
function normalizeBlock(raw: any): string {
  if (!raw) return '';
  return String(raw)
    .trim()
    .toUpperCase()
    .replace(/\s+/g, '')
    .replace(/-/g, '/');
}

/**
 * Parses date inputs from Excel (can be Date object, serial number, or string)
 */
function parseExcelDate(raw: any, fallbackDate: string): string {
  if (!raw) return fallbackDate;
  if (raw instanceof Date && !isNaN(raw.getTime())) {
    return raw.toISOString().slice(0, 10);
  }
  if (typeof raw === 'number' && raw > 30000 && raw < 70000) {
    // Excel serial date to JS Date
    const excelEpoch = new Date(Date.UTC(1899, 11, 30));
    const jsDate = new Date(excelEpoch.getTime() + raw * 86400000);
    if (!isNaN(jsDate.getTime())) {
      return jsDate.toISOString().slice(0, 10);
    }
  }
  const str = String(raw).trim();
  // YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(str)) {
    return str;
  }
  // DD/MM/YYYY or DD-MM-YYYY
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
 * Parses uploaded Excel file containing monthly dues for residents.
 */
export async function parseDuesExcelFile(
  file: File,
  targetPeriod: string,
  defaultNominal: number = 50000,
  existingResidents: ResidentHouse[]
): Promise<ParseDuesExcelResult> {
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

        // Find primary sheet
        const targetSheetName =
          wb.SheetNames.find((s) => s.toLowerCase().includes('iuran') || s.toLowerCase().includes('kk')) ||
          wb.SheetNames[0];

        const worksheet = wb.Sheets[targetSheetName];
        if (!worksheet) {
          resolve({ success: false, error: 'Lembar kerja data tidak ditemukan.' });
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

        const parsedRows: ParsedDuesRow[] = [];
        const updatedResidents: ResidentHouse[] = [];
        const cashTransactions: Omit<CashTransaction, 'id'>[] = [];

        let lunasCount = 0;
        let bayarLebihCount = 0;
        let belumBayarCount = 0;
        let kosongCount = 0;
        let matchedCount = 0;
        let unmatchedCount = 0;
        let totalCashInflow = 0;
        let totalArrears = 0;

        rawRows.forEach((row, idx) => {
          // Find fields with resilient key matching
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

          const rawBlock = getVal('No Blok', 'Blok', 'Nomor Blok', 'No. Blok', 'BlockNumber');
          if (!rawBlock) return; // Skip empty rows

          const normBlock = normalizeBlock(rawBlock);
          const matchedResident = residentMap.get(normBlock);

          const rawHeadName = getVal('Kepala Keluarga', 'Nama Kepala Keluarga', 'Nama', 'HeadName');
          const rawOccupancy = getVal('Status Rumah', 'Hunian', 'Status Hunian', 'Occupancy');
          const rawPeriod = getVal('Periode Iuran', 'Periode', 'Bulan', 'Period') || targetPeriod;
          const rawNominal = getVal('Nominal Iuran (Rp)', 'Nominal', 'Nominal Iuran', 'Iuran');
          const rawStatus = String(getVal('Status Pembayaran', 'Status', 'Status Iuran')).toLowerCase();
          const rawPaidMonths = getVal('Jumlah Bulan Dibayar', 'Jumlah Bulan', 'Bulan Dibayar', 'Months');
          const rawTotalReceived = getVal('Total Uang Diterima (Rp)', 'Total Diterima', 'Total Bayar', 'Uang Diterima');
          const rawPaidDate = getVal('Tanggal Bayar (YYYY-MM-DD)', 'Tanggal Bayar', 'Tanggal', 'Tgl Bayar');
          const rawPrevArrears = getVal('Tunggakan Lalu (Rp)', 'Tunggakan Lalu', 'Tunggakan', 'Arrears');
          const rawPrevNote = getVal('Keterangan Tunggakan Lalu', 'Ket. Tunggakan Lalu', 'Ket Tunggakan');
          const rawNotes = getVal('Catatan Pembayaran', 'Catatan', 'Keterangan');

          const finalHeadName =
            rawHeadName || (matchedResident ? matchedResident.headName : `Warga Blok ${rawBlock}`);

          const isVacant =
            (matchedResident &&
              (matchedResident.occupancy === 'Kosong' ||
                isHouseVacant(matchedResident))) ||
            /kosong/i.test(String(rawOccupancy)) ||
            /kosong/i.test(String(rawHeadName));

          // Determine dues nominal
          const parsedNominal = Math.max(
            0,
            Number(String(rawNominal).replace(/[^0-9]/g, '')) ||
              (matchedResident?.customDuesAmount !== undefined
                ? matchedResident.customDuesAmount
                : defaultNominal)
          );

          // Determine parsed status
          let status: 'Lunas' | 'Bayar Lebih' | 'Belum Bayar' | 'Bebas Iuran' = 'Belum Bayar';
          if (/bebas/i.test(rawStatus) || (isVacant && !/lunas|bayar|transfer/i.test(rawStatus))) {
            status = 'Bebas Iuran';
          } else if (/lebih|advance/i.test(rawStatus)) {
            status = 'Bayar Lebih';
          } else if (/lunas|sudah|ya|yes|paid|terbayar/i.test(rawStatus)) {
            status = 'Lunas';
          } else if (isVacant) {
            status = 'Bebas Iuran';
          } else {
            status = 'Belum Bayar';
          }

          // Parse months count
          let monthsCount = Number(String(rawPaidMonths).replace(/[^0-9]/g, '')) || 0;
          if (status === 'Bayar Lebih') {
            monthsCount = Math.max(2, monthsCount || 2);
          } else if (status === 'Lunas') {
            monthsCount = 1;
          } else {
            monthsCount = 0;
          }

          // Parse total received
          let totalReceived = Number(String(rawTotalReceived).replace(/[^0-9]/g, '')) || 0;
          if (totalReceived === 0 && (status === 'Lunas' || status === 'Bayar Lebih')) {
            totalReceived = parsedNominal * Math.max(1, monthsCount);
          }

          // Parse date
          const parsedDate = parseExcelDate(rawPaidDate, todayStr);

          // Parse previous arrears
          const prevArrears = isVacant
            ? 0
            : Number(String(rawPrevArrears).replace(/[^0-9]/g, '')) ||
              (matchedResident ? matchedResident.previousArrears || 0 : 0);
          const prevNote = String(rawPrevNote || matchedResident?.previousArrearsNote || '').trim();

          if (matchedResident) {
            matchedCount++;
          } else {
            unmatchedCount++;
          }

          if (status === 'Bebas Iuran' || (isVacant && status !== 'Lunas' && status !== 'Bayar Lebih')) {
            kosongCount++;
          } else if (status === 'Bayar Lebih') {
            bayarLebihCount++;
            totalCashInflow += totalReceived;
          } else if (status === 'Lunas') {
            lunasCount++;
            totalCashInflow += totalReceived;
          } else {
            belumBayarCount++;
          }

          totalArrears += prevArrears;

          const parsedRow: ParsedDuesRow = {
            rowNumber: idx + 2,
            blockNumber: matchedResident ? matchedResident.blockNumber : String(rawBlock).trim(),
            headName: finalHeadName,
            occupancy: matchedResident ? matchedResident.occupancy : String(rawOccupancy || 'Ditempati'),
            period: String(rawPeriod).trim(),
            nominal: parsedNominal,
            status,
            paidMonths: monthsCount,
            totalReceived,
            paidDate: parsedDate,
            previousArrears: prevArrears,
            previousArrearsNote: prevNote,
            notes: String(rawNotes).trim(),
            matchedResident,
            isVacant,
            isValid: true,
          };

          parsedRows.push(parsedRow);

          // Construct resident payload
          if (matchedResident) {
            const isNowPaid = status === 'Lunas' || status === 'Bayar Lebih';
            const residentDuesStatus: DuesStatus =
              status === 'Bayar Lebih'
                ? 'Bayar Lebih'
                : status === 'Lunas'
                ? 'Lunas'
                : 'Belum Bayar';
            const prepaidDeposit =
              status === 'Bayar Lebih' ? Math.max(0, totalReceived - parsedNominal) : 0;

            const trimmedHead = rawHeadName.trim();
            const headOverride = trimmedHead || matchedResident.duesHeadNameOverride || '';

            const updatedHouse: ResidentHouse = {
              ...matchedResident,
              duesHeadNameOverride: headOverride,
              customDuesAmount: parsedNominal,
              duesStatus: residentDuesStatus,
              duesPaidAmount: isNowPaid ? 0 : 0,
              duesPaidMonths: monthsCount,
              duesPrepaidBalance: prepaidDeposit,
              duesPaidDate: isNowPaid ? parsedDate : '',
              duesMonthNote: String(rawPeriod).trim() || targetPeriod,
              previousArrears: prevArrears,
              previousArrearsNote: prevNote,
            };

            updatedResidents.push(updatedHouse);

            // Construct cash transaction
            if (isNowPaid && totalReceived > 0) {
              const coveredMonths = getSubsequentMonthLabels(
                String(rawPeriod).trim() || targetPeriod,
                Math.max(1, monthsCount)
              );
              const displayName = headOverride || matchedResident.headName;
              const houseDesc = isVacant
                ? `(Rumah Kosong - ${displayName})`
                : `(${displayName})`;

              const description =
                status === 'Bayar Lebih'
                  ? `Iuran Kas Bayar Lebih ${monthsCount} Bulan (${coveredMonths.join(', ')}) Warga Blok ${matchedResident.blockNumber} ${houseDesc}${
                      rawNotes ? ` - ${rawNotes}` : ''
                    }`
                  : `Iuran Bulanan (${rawPeriod}) Warga Blok ${matchedResident.blockNumber} ${houseDesc}${
                      rawNotes ? ` - ${rawNotes}` : ''
                    }`;

              cashTransactions.push({
                date: parsedDate,
                type: 'masuk',
                pool: 'Kas Utama',
                category: 'Iuran Warga',
                description,
                amount: totalReceived,
              });
            }
          }
        });

        resolve({
          success: true,
          rows: parsedRows,
          updatedResidents,
          cashTransactions,
          summary: {
            totalRows: parsedRows.length,
            matchedCount,
            unmatchedCount,
            lunasCount,
            bayarLebihCount,
            belumBayarCount,
            kosongCount,
            totalCashInflow,
            totalArrears,
          },
        });
      } catch (err: any) {
        resolve({
          success: false,
          error: `Gagal memproses file Excel: ${err?.message || 'Format tidak sesuai.'}`,
        });
      }
    };

    reader.onerror = () => {
      resolve({ success: false, error: 'Gagal membaca file dari sistem Anda.' });
    };

    reader.readAsArrayBuffer(file);
  });
}
