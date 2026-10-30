import * as XLSX from 'xlsx';
import { BaksosAgenda, BaksosAttendanceStatus, ResidentHouse } from '../types';
import { formatDateDDMMYYYY, isHouseVacant } from './helpers';

export interface ParsedBaksosRow {
  rowNumber: number;
  blockNumber: string;
  headName: string;
  attendance: BaksosAttendanceStatus;
  fineAmount: number;
  isFinePaid: boolean;
  notes: string;
  matchedResident?: ResidentHouse;
  isValid: boolean;
  errorMessage?: string;
}

export interface ParseBaksosExcelResult {
  success: boolean;
  error?: string;
  rows?: ParsedBaksosRow[];
  updatedAttendance?: Record<string, BaksosAttendanceStatus>;
  updatedFinesPaid?: Record<string, boolean>;
  summary?: {
    totalRows: number;
    matchedCount: number;
    hadirCount: number;
    tidakHadirCount: number;
    tidakWajibCount: number;
    kosongCount: number;
    dendaLunasCount: number;
    dendaBelumCount: number;
    totalDendaNominal: number;
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

/**
 * Downloads prefilled Excel template for Bakti Sosial attendance.
 * Exact columns matching the web table:
 * 1. No
 * 2. No Blok
 * 3. Nama Kepala Keluarga
 * 4. Status Kehadiran (Hadir / Tidak Hadir / Tidak Wajib / Kosong)
 * 5. Denda Bakti Sosial (Rp 10.000)
 * 6. Status Denda (Lunas / Belum Bayar / Bebas Denda)
 * 7. Catatan
 */
export function downloadBaksosExcelTemplate(
  agenda: BaksosAgenda,
  residents: ResidentHouse[]
): void {
  const cleanTitle = agenda.title.replace(/[\/\\?%*:|"<>]/g, '_').trim();
  const dateStr = formatDateDDMMYYYY(agenda.date);

  const dataRows = residents.map((house, idx) => {
    const isContract = house.ownership === 'Kontrak' || house.occupancy === 'Dikontrakan';
    const isVacant = house.occupancy === 'Kosong' || isHouseVacant(house);

    const defaultStatus: BaksosAttendanceStatus = isVacant
      ? 'Kosong'
      : isContract
      ? 'Tidak Wajib'
      : 'Hadir';

    const status: BaksosAttendanceStatus =
      agenda.attendance?.[house.id] || defaultStatus;

    const isFinePaid = Boolean(agenda.finesPaid?.[house.id]);
    const fineNominal = status === 'Tidak Hadir' ? 10000 : 0;
    const fineStatusLabel =
      status === 'Tidak Hadir'
        ? isFinePaid
          ? 'Lunas'
          : 'Belum Bayar'
        : 'Bebas Denda';

    const displayName = isVacant
      ? (house.duesHeadNameOverride && house.duesHeadNameOverride.toLowerCase().includes('kosong')
          ? house.duesHeadNameOverride
          : `Rumah Kosong (${house.headName || 'Tanpa Penghuni'})`)
      : (house.duesHeadNameOverride || house.headName || '-');

    return {
      No: idx + 1,
      'No Blok': house.blockNumber,
      'Nama Kepala Keluarga': displayName,
      'Status Kehadiran': status,
      'Denda Bakti Sosial (Rp 10.000)': fineNominal,
      'Status Denda': fineStatusLabel,
      Catatan: isVacant ? 'Rumah Kosong (Bebas Denda)' : isContract ? 'Warga Kontrak (Tidak Wajib)' : '',
    };
  });

  const wsData = XLSX.utils.json_to_sheet(dataRows);
  wsData['!cols'] = [
    { wch: 6 },  // No
    { wch: 14 }, // No Blok
    { wch: 34 }, // Nama Kepala Keluarga
    { wch: 22 }, // Status Kehadiran
    { wch: 30 }, // Denda Bakti Sosial
    { wch: 18 }, // Status Denda
    { wch: 32 }, // Catatan
  ];

  const instructions = [
    {
      'Ketentuan / Kolom': 'Agenda Bakti Sosial',
      'Aturan & Cara Pengisian': `${agenda.title} (${dateStr} - Lokasi: ${agenda.location})`,
    },
    {
      'Ketentuan / Kolom': 'Status Kehadiran (PILIH SALAH SATU)',
      'Aturan & Cara Pengisian':
        '1. "Hadir" -> Warga hadir gotong royong (Bebas Denda).\n2. "Tidak Hadir" -> Berhalangan hadir (Dikenakan Denda Rp 10.000,-).\n3. "Tidak Wajib" -> Khusus warga Kontrak / Dikontrakan (Bebas Denda).\n4. "Kosong" -> Rumah belum berpenghuni / kosong (Bebas Denda).',
    },
    {
      'Ketentuan / Kolom': 'Denda Bakti Sosial (Rp 10.000)',
      'Aturan & Cara Pengisian':
        'Otomatis terisi Rp 10.000 jika status "Tidak Hadir", dan Rp 0 jika Hadir, Tidak Wajib, atau Kosong.',
    },
    {
      'Ketentuan / Kolom': 'Status Denda',
      'Aturan & Cara Pengisian':
        'Isi "Lunas" jika warga sudah menyetorkan denda Rp 10.000, atau "Belum Bayar" jika belum lunas (akan otomatis masuk ke Rekap Tunggakan & Penarikan Keuangan).',
    },
  ];

  const wsInstructions = XLSX.utils.json_to_sheet(instructions);
  wsInstructions['!cols'] = [{ wch: 36 }, { wch: 95 }];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, wsData, 'Presensi_Bakti_Sosial');
  XLSX.utils.book_append_sheet(wb, wsInstructions, 'Petunjuk_Pengisian');
  XLSX.writeFile(wb, `Presensi_Baksos_${cleanTitle}.xlsx`);
}

/**
 * Parses uploaded Excel file for Bakti Sosial attendance.
 */
export async function parseBaksosExcelFile(
  file: File,
  agenda: BaksosAgenda,
  residents: ResidentHouse[]
): Promise<ParseBaksosExcelResult> {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const buffer = e.target?.result as ArrayBuffer;
        if (!buffer) {
          resolve({ success: false, error: 'File Excel kosong atau tidak dapat dibaca.' });
          return;
        }
        const wb = XLSX.read(buffer, { type: 'array' });
        if (!wb.SheetNames || wb.SheetNames.length === 0) {
          resolve({ success: false, error: 'File Excel tidak memiliki lembar kerja (sheet).' });
          return;
        }

        const targetSheetName =
          wb.SheetNames.find(
            (s) =>
              s.toLowerCase().includes('presensi') ||
              s.toLowerCase().includes('baksos') ||
              s.toLowerCase().includes('absen') ||
              s.toLowerCase().includes('kehadiran')
          ) || wb.SheetNames[0];

        const worksheet = wb.Sheets[targetSheetName];
        if (!worksheet) {
          resolve({ success: false, error: 'Lembar kerja presensi baksos tidak ditemukan.' });
          return;
        }

        const rawRows: any[] = XLSX.utils.sheet_to_json(worksheet, { defval: '' });
        if (rawRows.length === 0) {
          resolve({ success: false, error: 'File Excel tidak memiliki baris data.' });
          return;
        }

        const residentMap = new Map<string, ResidentHouse>();
        residents.forEach((r) => {
          residentMap.set(normalizeBlock(r.blockNumber), r);
        });

        const parsedRows: ParsedBaksosRow[] = [];
        const updatedAttendance: Record<string, BaksosAttendanceStatus> = { ...(agenda.attendance || {}) };
        const updatedFinesPaid: Record<string, boolean> = { ...(agenda.finesPaid || {}) };

        let hadirCount = 0;
        let tidakHadirCount = 0;
        let tidakWajibCount = 0;
        let kosongCount = 0;
        let dendaLunasCount = 0;
        let dendaBelumCount = 0;
        let matchedCount = 0;

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
            getVal('Nama Kepala Keluarga', 'Kepala Keluarga', 'Nama', 'HeadName')
          ).trim();
          const rawStatus = String(
            getVal('Status Kehadiran', 'Kehadiran', 'Status', 'Presensi')
          ).trim();
          const rawFineStatus = String(
            getVal('Status Denda', 'Denda Lunas', 'Denda Status', 'Status Pembayaran Denda')
          ).trim();
          const rawNotes = String(getVal('Catatan', 'Keterangan')).trim();

          let attendance: BaksosAttendanceStatus = 'Hadir';
          if (/tidak hadir|absen|mangkir|alpa/i.test(rawStatus)) {
            attendance = 'Tidak Hadir';
            tidakHadirCount++;
          } else if (/tidak wajib|kontrak|bebas/i.test(rawStatus)) {
            attendance = 'Tidak Wajib';
            tidakWajibCount++;
          } else if (/kosong/i.test(rawStatus) || (matchedResident && isHouseVacant(matchedResident))) {
            attendance = 'Kosong';
            kosongCount++;
          } else {
            attendance = 'Hadir';
            hadirCount++;
          }

          const fineAmount = attendance === 'Tidak Hadir' ? 10000 : 0;
          let isFinePaid = false;
          if (attendance === 'Tidak Hadir') {
            if (/lunas|sudah|bayar|paid/i.test(rawFineStatus)) {
              isFinePaid = true;
              dendaLunasCount++;
            } else {
              isFinePaid = false;
              dendaBelumCount++;
            }
          }

          if (matchedResident) {
            matchedCount++;
            updatedAttendance[matchedResident.id] = attendance;
            if (attendance === 'Tidak Hadir') {
              updatedFinesPaid[matchedResident.id] = isFinePaid;
            } else {
              delete updatedFinesPaid[matchedResident.id];
            }
          }

          parsedRows.push({
            rowNumber: idx + 1,
            blockNumber: matchedResident ? matchedResident.blockNumber : String(rawBlock).trim(),
            headName:
              rawHeadName ||
              (matchedResident
                ? matchedResident.duesHeadNameOverride || matchedResident.headName
                : '-'),
            attendance,
            fineAmount,
            isFinePaid,
            notes: rawNotes,
            matchedResident,
            isValid: Boolean(matchedResident),
            errorMessage: matchedResident ? undefined : `Blok ${rawBlock} tidak ditemukan di master warga.`,
          });
        });

        resolve({
          success: true,
          rows: parsedRows,
          updatedAttendance,
          updatedFinesPaid,
          summary: {
            totalRows: parsedRows.length,
            matchedCount,
            hadirCount,
            tidakHadirCount,
            tidakWajibCount,
            kosongCount,
            dendaLunasCount,
            dendaBelumCount,
            totalDendaNominal: dendaBelumCount * 10000,
          },
        });
      } catch (err: any) {
        resolve({
          success: false,
          error: err?.message || 'Terjadi kesalahan saat memproses file Excel.',
        });
      }
    };
    reader.onerror = () => {
      resolve({ success: false, error: 'Gagal membaca file Excel.' });
    };
    reader.readAsArrayBuffer(file);
  });
}
