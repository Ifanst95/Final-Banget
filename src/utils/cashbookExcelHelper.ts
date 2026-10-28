import * as XLSX from 'xlsx';
import { CashTransaction, TransactionCategory, TransactionType } from '../types';

export interface ParsedCashbookRow {
  rowNumber: number;
  date: string;
  type: TransactionType;
  pool: 'Kas Utama' | 'Cashback WiFi' | 'Cashback Sampah';
  category: TransactionCategory;
  description: string;
  amount: number;
  isValid: boolean;
  errorMessage?: string;
}

export interface ParseCashbookExcelResult {
  success: boolean;
  error?: string;
  rows?: ParsedCashbookRow[];
  validTransactions?: Omit<CashTransaction, 'id'>[];
  summary?: {
    totalRows: number;
    validCount: number;
    invalidCount: number;
    totalMasuk: number;
    totalKeluar: number;
    netAmount: number;
  };
}

/**
 * Downloads a prefilled Excel template for Keluar Masuk Kas (Buku Kas).
 */
export function downloadCashbookExcelTemplate(periodLabel?: string): void {
  const todayStr = new Date().toISOString().slice(0, 10);
  const cleanLabel = (periodLabel || 'Semua_Periode').replace(/[\/\\?%*:|"<>]/g, '_').trim();

  // 1. DATA SHEET with realistic sample rows
  const sampleRows = [
    {
      'No': 1,
      'Tanggal (YYYY-MM-DD)': todayStr,
      'Jenis Transaksi (Masuk/Keluar)': 'Masuk',
      'Alokasi Kas (Kas Utama/Cashback WiFi/Cashback Sampah)': 'Kas Utama',
      'Kategori': 'Iuran Warga',
      'Uraian / Keterangan Transaksi': 'Iuran Kas Rutin Bulanan Blok K2/25 (Bpk. Sugeng)',
      'Nominal (Rp)': 50000,
    },
    {
      'No': 2,
      'Tanggal (YYYY-MM-DD)': todayStr,
      'Jenis Transaksi (Masuk/Keluar)': 'Masuk',
      'Alokasi Kas (Kas Utama/Cashback WiFi/Cashback Sampah)': 'Kas Utama',
      'Kategori': 'Denda Baksos',
      'Uraian / Keterangan Transaksi': 'Denda Ketidakhadiran Baksos Blok K3/08 (Bpk. Agus)',
      'Nominal (Rp)': 10000,
    },
    {
      'No': 3,
      'Tanggal (YYYY-MM-DD)': todayStr,
      'Jenis Transaksi (Masuk/Keluar)': 'Masuk',
      'Alokasi Kas (Kas Utama/Cashback WiFi/Cashback Sampah)': 'Cashback WiFi',
      'Kategori': 'Cashback WiFi',
      'Uraian / Keterangan Transaksi': 'Cashback Bagi Hasil Tagihan WiFi Warga Bulan Ini',
      'Nominal (Rp)': 150000,
    },
    {
      'No': 4,
      'Tanggal (YYYY-MM-DD)': todayStr,
      'Jenis Transaksi (Masuk/Keluar)': 'Keluar',
      'Alokasi Kas (Kas Utama/Cashback WiFi/Cashback Sampah)': 'Kas Utama',
      'Kategori': 'Pengeluaran Gang',
      'Uraian / Keterangan Transaksi': 'Pembelian 2 unit Lampu LED Sorot Jalan Gang Mandor',
      'Nominal (Rp)': 120000,
    },
  ];

  const wsData = XLSX.utils.json_to_sheet(sampleRows);
  wsData['!cols'] = [
    { wch: 6 },  // No
    { wch: 22 }, // Tanggal
    { wch: 28 }, // Jenis Transaksi
    { wch: 34 }, // Alokasi Kas
    { wch: 20 }, // Kategori
    { wch: 50 }, // Keterangan
    { wch: 18 }, // Nominal
  ];

  // 2. INSTRUCTIONS SHEET
  const instructions = [
    {
      Kolom: 'Tanggal (YYYY-MM-DD)',
      'Aturan Pengisian': 'Format tanggal transaksi standar YYYY-MM-DD (contoh: 2026-10-22) atau DD/MM/YYYY. Jika kosong, sistem otomatis memakai tanggal hari ini.',
    },
    {
      Kolom: 'Jenis Transaksi',
      'Aturan Pengisian': 'Wajib diisi: "Masuk" untuk uang masuk/pemasukan, atau "Keluar" untuk pengeluaran uang kas.',
    },
    {
      Kolom: 'Alokasi Kas',
      'Aturan Pengisian': 'Pilih salah satu pool kas: "Kas Utama", "Cashback WiFi", atau "Cashback Sampah".',
    },
    {
      Kolom: 'Kategori',
      'Aturan Pengisian': 'Pilih salah satu: "Iuran Warga", "Denda Baksos", "Kas Utama", "Cashback WiFi", "Cashback Sampah", atau "Pengeluaran Gang".',
    },
    {
      Kolom: 'Uraian / Keterangan Transaksi',
      'Aturan Pengisian': 'Rincian transaksi secara jelas (contoh: Iuran Bulanan Blok K2/25, Beli Lampu Jalan, Denda Baksos).',
    },
    {
      Kolom: 'Nominal (Rp)',
      'Aturan Pengisian': 'Jumlah rupiah angka positif bulat tanpa titik/koma (contoh: 50000, 10000, 120000).',
    },
  ];

  const wsInstructions = XLSX.utils.json_to_sheet(instructions);
  wsInstructions['!cols'] = [{ wch: 30 }, { wch: 85 }];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, wsData, 'Buku_Kas_Transaksi');
  XLSX.utils.book_append_sheet(wb, wsInstructions, 'Petunjuk_Pengisian');

  XLSX.writeFile(wb, `Template_Buku_Kas_Keluar_Masuk_${cleanLabel}.xlsx`);
}

/**
 * Normalizes date inputs from Excel.
 */
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
 * Parses uploaded Excel file for Keluar Masuk Kas.
 */
export async function parseCashbookExcelFile(file: File): Promise<ParseCashbookExcelResult> {
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

        // Search for data sheet
        const sheetName =
          wb.SheetNames.find((s) => s.toLowerCase().includes('buku_kas') || s.toLowerCase().includes('transaksi') || s.toLowerCase().includes('kas')) ||
          wb.SheetNames[0];

        const ws = wb.Sheets[sheetName];
        if (!ws) {
          resolve({ success: false, error: 'Lembar kerja transaksi tidak ditemukan.' });
          return;
        }

        const rawRows: any[] = XLSX.utils.sheet_to_json(ws, { defval: '' });
        if (!rawRows || rawRows.length === 0) {
          resolve({ success: false, error: 'Lembar kerja Excel tidak memiliki baris data.' });
          return;
        }

        const todayStr = new Date().toISOString().slice(0, 10);
        const parsedRows: ParsedCashbookRow[] = [];
        const validTransactions: Omit<CashTransaction, 'id'>[] = [];
        let totalMasuk = 0;
        let totalKeluar = 0;
        let validCount = 0;
        let invalidCount = 0;

        rawRows.forEach((row, idx) => {
          // Identify columns tolerantly
          const getVal = (...keys: string[]): any => {
            for (const k of keys) {
              if (row[k] !== undefined && row[k] !== '') return row[k];
              const match = Object.keys(row).find(
                (col) => col.trim().toLowerCase() === k.toLowerCase()
              );
              if (match && row[match] !== undefined && row[match] !== '') {
                return row[match];
              }
            }
            return '';
          };

          const rawDate = getVal('Tanggal (YYYY-MM-DD)', 'Tanggal', 'Tgl', 'Date');
          const rawType = getVal('Jenis Transaksi (Masuk/Keluar)', 'Jenis Transaksi', 'Tipe', 'Jenis', 'Type');
          const rawPool = getVal('Alokasi Kas (Kas Utama/Cashback WiFi/Cashback Sampah)', 'Alokasi Kas', 'Alokasi', 'Pool');
          const rawCategory = getVal('Kategori', 'Category', 'Pos');
          const rawDesc = getVal('Uraian / Keterangan Transaksi', 'Keterangan', 'Uraian', 'Deskripsi', 'Description');
          const rawAmount = getVal('Nominal (Rp)', 'Nominal', 'Jumlah', 'Amount');

          const parsedDate = parseExcelDate(rawDate, todayStr);

          // Type parsing
          const typeStr = String(rawType).trim().toLowerCase();
          let type: TransactionType = 'masuk';
          if (typeStr.includes('keluar') || typeStr === 'out' || typeStr === 'k') {
            type = 'keluar';
          } else if (typeStr.includes('masuk') || typeStr === 'in' || typeStr === 'm') {
            type = 'masuk';
          }

          // Pool parsing
          const poolStr = String(rawPool).trim().toLowerCase();
          let pool: 'Kas Utama' | 'Cashback WiFi' | 'Cashback Sampah' = 'Kas Utama';
          if (poolStr.includes('wifi') || poolStr.includes('wi-fi')) {
            pool = 'Cashback WiFi';
          } else if (poolStr.includes('sampah')) {
            pool = 'Cashback Sampah';
          } else {
            pool = 'Kas Utama';
          }

          // Category & Pool parsing
          const catStr = String(rawCategory).trim().toLowerCase();
          let category: TransactionCategory = 'Kas Utama';

          if (type === 'keluar') {
            if (catStr.includes('wifi')) {
              category = 'Pengeluaran Cashback WiFi';
              pool = 'Cashback WiFi';
            } else if (catStr.includes('sampah') && (poolStr.includes('sampah') || catStr.includes('cashback'))) {
              category = 'Pengeluaran Cashback Sampah';
              pool = 'Cashback Sampah';
            } else if (catStr.includes('lingkungan')) {
              category = 'Pengeluaran Lingkungan';
              pool = 'Kas Utama';
            } else {
              category = 'Pengeluaran Gang';
              pool = 'Kas Utama';
            }
          } else {
            if (catStr.includes('tunggakan')) {
              category = 'Pembayaran Tunggakan';
              pool = 'Kas Utama';
            } else if (catStr.includes('denda') || catStr.includes('baksos')) {
              category = 'Denda Baksos';
              pool = 'Kas Utama';
            } else if (catStr.includes('wifi')) {
              category = 'Cashback WiFi';
              pool = 'Cashback WiFi';
            } else if (catStr.includes('sampah')) {
              category = 'Cashback Sampah';
              pool = 'Cashback Sampah';
            } else if (catStr.includes('iuran')) {
              category = 'Iuran Warga';
              pool = 'Kas Utama';
            } else {
              category = pool === 'Kas Utama' ? 'Kas Utama' : (pool as any);
            }
          }

          const description = String(rawDesc).trim();

          // Amount parsing
          let amount = 0;
          if (typeof rawAmount === 'number') {
            amount = Math.abs(rawAmount);
          } else {
            const cleaned = String(rawAmount).replace(/[^0-9]/g, '');
            amount = parseInt(cleaned, 10) || 0;
          }

          // Validation
          let isValid = true;
          let errorMessage = '';

          if (!description) {
            isValid = false;
            errorMessage = 'Uraian / Keterangan wajib diisi.';
          } else if (amount <= 0) {
            isValid = false;
            errorMessage = 'Nominal harus berupa angka lebih besar dari 0.';
          }

          if (isValid) {
            validCount++;
            if (type === 'masuk') {
              totalMasuk += amount;
            } else {
              totalKeluar += amount;
            }

            validTransactions.push({
              date: parsedDate,
              type,
              pool,
              category,
              description,
              amount,
            });
          } else {
            invalidCount++;
          }

          parsedRows.push({
            rowNumber: idx + 1,
            date: parsedDate,
            type,
            pool,
            category,
            description,
            amount,
            isValid,
            errorMessage,
          });
        });

        resolve({
          success: true,
          rows: parsedRows,
          validTransactions,
          summary: {
            totalRows: parsedRows.length,
            validCount,
            invalidCount,
            totalMasuk,
            totalKeluar,
            netAmount: totalMasuk - totalKeluar,
          },
        });
      } catch (err: any) {
        resolve({
          success: false,
          error: `Gagal memproses file Excel Buku Kas: ${err?.message || 'Format tidak sesuai.'}`,
        });
      }
    };

    reader.onerror = () => {
      resolve({ success: false, error: 'Gagal membaca file dari sistem Anda.' });
    };

    reader.readAsArrayBuffer(file);
  });
}
