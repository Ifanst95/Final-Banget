import * as XLSX from 'xlsx';
import { BaksosAgenda, BaksosAttendanceStatus, CashTransaction, ResidentHouse } from '../types';

export function formatDateDDMMYYYY(dateStr: string): string {
  if (!dateStr) return '-';
  const parts = dateStr.split('-');
  if (parts.length === 3) {
    // YYYY-MM-DD -> DD/MM/YYYY
    const [year, month, day] = parts;
    return `${day.padStart(2, '0')}/${month.padStart(2, '0')}/${year}`;
  }
  return dateStr;
}

export function calculateAge(birthDateStr: string): number {
  if (!birthDateStr) return 0;
  const birth = new Date(birthDateStr);
  if (isNaN(birth.getTime())) return 0;
  const today = new Date();
  let age = today.getFullYear() - birth.getFullYear();
  const m = today.getMonth() - birth.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) {
    age--;
  }
  return Math.max(0, age);
}

export function formatRupiah(amount: number): string {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount || 0);
}

export function isHouseVacant(house?: { occupancy?: string; headName?: string } | null): boolean {
  if (!house) return false;
  const occ = (house.occupancy || '').trim().toLowerCase();
  const name = (house.headName || '').trim().toLowerCase();
  if (occ === 'belum ditempati' || occ === 'belum diisi') return false;
  return (
    occ === 'kosong' ||
    name.includes('kosong') ||
    name === '-' ||
    name === 'belum berpenghuni'
  );
}

export function isHouseUnfilled(house?: { occupancy?: string; headName?: string; members?: any[] } | null): boolean {
  if (!house) return false;
  if (isHouseVacant(house)) return false;
  const occ = (house.occupancy || '').trim().toLowerCase();
  const name = (house.headName || '').trim().toLowerCase();
  const members = house.members || [];
  const hasNoMembers = members.length === 0;
  const hasOnlyDummyMember =
    members.length === 1 &&
    (!members[0].name ||
      members[0].name.trim() === '' ||
      members[0].name.toLowerCase() === 'kosong' ||
      members[0].name === '-');

  return (
    occ === 'belum ditempati' ||
    occ === 'belum diisi' ||
    name.includes('belum diisi') ||
    name.includes('belum ditempati') ||
    name.includes('belum terisi') ||
    name === '' ||
    hasNoMembers ||
    hasOnlyDummyMember
  );
}

/**
 * Memeriksa apakah suatu rumah merupakan "Rumah Kosong" pada periode bulan tertentu.
 * Aturan tegas:
 * 1. Hanya rumah dengan status Rumah Kosong (occupancy === 'Kosong' atau isHouseVacant(house) === true atau override 'Rumah Kosong').
 * 2. BUKAN rumah dengan status "Belum Ditempati" / "Belum Diisi".
 * 3. BUKAN rumah berpenghuni yang nominalnya 0 karena belum bayar iuran (tunggakan berjalan).
 * 4. Atau transaksi resmi di Buku Kas pada periode ini eksplisit menyatakan "(Rumah Kosong)".
 */
export function isHouseVacantInPeriod(
  house: ResidentHouse | null | undefined,
  periodLabel: string,
  transactions: CashTransaction[] = []
): boolean {
  if (!house) return false;

  const occ = (house.occupancy || '').trim().toLowerCase();

  // 1. Rumah berstatus "Belum Ditempati" atau "Belum Diisi" BUKAN Rumah Kosong
  if (occ === 'belum ditempati' || occ === 'belum diisi') {
    return false;
  }

  // 2. Hanya jika status rumahnya adalah Rumah Kosong
  const isVacantStatus =
    occ === 'kosong' ||
    isHouseVacant(house) ||
    Boolean(
      house.duesHeadNameOverride &&
        /rumah kosong|^kosong$/i.test(house.duesHeadNameOverride.trim())
    );

  if (isVacantStatus) {
    return true;
  }

  const pKey = parseIndonesianMonthYearToKey(periodLabel);
  if (!pKey) return false;

  const blockRegex = new RegExp(`\\b${house.blockNumber.replace('/', '\\/')}\\b`, 'i');
  const periodMonthNameLower = (periodLabel.split(' ')[0] || '').toLowerCase();

  // 3. Cek transaksi eksplisit pada periode ini di Buku Kas yang menyatakan "(Rumah Kosong)"
  const currentPeriodTx = transactions.find((t) => {
    if (t.type !== 'masuk' || !blockRegex.test(t.description)) return false;
    const tKey = getMonthKeyFromDate(t.date);
    const desc = t.description.toLowerCase();
    return tKey === pKey || desc.includes(periodMonthNameLower) || desc.includes(periodLabel.toLowerCase());
  });

  if (currentPeriodTx) {
    const descLower = currentPeriodTx.description.toLowerCase();
    if (descLower.includes('rumah kosong') || descLower.includes('(kosong)')) {
      return true;
    }
  }

  // Bukan Rumah Kosong (bukan Belum Ditempati dan bukan yang 0 karena belum bayar iuran)
  return false;
}

export function exportResidentsToExcel(residents: ResidentHouse[]): void {
  const rows: Record<string, string | number>[] = [];

  residents.forEach((house) => {
    if (house.members && house.members.length > 0) {
      house.members.forEach((member, index) => {
        rows.push({
          'No Blok': house.blockNumber,
          'Kepala Keluarga': house.headName,
          'Nama Anggota': member.name,
          'Status Hubungan': member.relation,
          'Tempat Lahir': member.birthPlace,
          'Tanggal Lahir': formatDateDDMMYYYY(member.birthDate),
          'Umur (Tahun)': calculateAge(member.birthDate),
          'Jenis Kelamin': member.gender,
          'Agama': member.religion,
          'No Telepon / WA': house.phone,
          'Status Kepemilikan': house.ownership,
          'Status Rumah': house.occupancy,
          'Status Rukem': house.rukem,
          'Status WiFi': `${house.wifiStatus}${house.wifiStatus === 'Pasang' && house.wifiProvider ? ` (${house.wifiProvider})` : ''}`,
          'Urutan Anggota': index === 0 ? 'Utama (KK)' : `Anggota #${index + 1}`,
        });
      });
    } else {
      rows.push({
        'No Blok': house.blockNumber,
        'Kepala Keluarga': house.headName,
        'Nama Anggota': house.headName,
        'Status Hubungan': 'Kepala Keluarga',
        'Tempat Lahir': '-',
        'Tanggal Lahir': '-',
        'Umur (Tahun)': '-',
        'Jenis Kelamin': '-',
        'Agama': '-',
        'No Telepon / WA': house.phone,
        'Status Kepemilikan': house.ownership,
        'Status Rumah': house.occupancy,
        'Status Rukem': house.rukem,
        'Status WiFi': `${house.wifiStatus}${house.wifiStatus === 'Pasang' && house.wifiProvider ? ` (${house.wifiProvider})` : ''}`,
        'Urutan Anggota': 'Utama (KK)',
      });
    }
  });

  const worksheet = XLSX.utils.json_to_sheet(rows);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Data Warga Mandor');

  // Generate file name with date
  const todayStr = new Date().toISOString().slice(0, 10);
  XLSX.writeFile(workbook, `Data_Warga_Gang_Mandor_${todayStr}.xlsx`);
}

export function downloadExcelTemplate(): void {
  const sampleRows = [
    {
      'No Blok': 'K2/25',
      'Kepala Keluarga': 'Bambang Sutrisno',
      'Nama Anggota': 'Bambang Sutrisno',
      'Status Hubungan': 'Kepala Keluarga',
      'Tempat Lahir': 'Solo',
      'Tanggal Lahir': '14/06/1975',
      'Jenis Kelamin': 'Laki-laki',
      'Agama': 'Islam',
      'No Telepon / WA': '081287654321',
      'Status Kepemilikan': 'Milik Sendiri',
      'Status Rumah': 'Ditempati',
      'Status Rukem': 'Ikut Rukem',
      'Status WiFi': 'Pasang (Indihome)',
    },
    {
      'No Blok': 'K2/25',
      'Kepala Keluarga': 'Bambang Sutrisno',
      'Nama Anggota': 'Sri Wahyuni',
      'Status Hubungan': 'Istri',
      'Tempat Lahir': 'Yogyakarta',
      'Tanggal Lahir': '22/08/1978',
      'Jenis Kelamin': 'Perempuan',
      'Agama': 'Islam',
      'No Telepon / WA': '081287654321',
      'Status Kepemilikan': 'Milik Sendiri',
      'Status Rumah': 'Ditempati',
      'Status Rukem': 'Ikut Rukem',
      'Status WiFi': 'Pasang (Indihome)',
    },
    {
      'No Blok': 'K2/25',
      'Kepala Keluarga': 'Bambang Sutrisno',
      'Nama Anggota': 'Rizky Pratama',
      'Status Hubungan': 'Anak',
      'Tempat Lahir': 'Jakarta',
      'Tanggal Lahir': '10/03/2004',
      'Jenis Kelamin': 'Laki-laki',
      'Agama': 'Islam',
      'No Telepon / WA': '081287654321',
      'Status Kepemilikan': 'Milik Sendiri',
      'Status Rumah': 'Ditempati',
      'Status Rukem': 'Ikut Rukem',
      'Status WiFi': 'Pasang (Indihome)',
    },
    {
      'No Blok': 'K2/26',
      'Kepala Keluarga': 'Hendra Gunawan',
      'Nama Anggota': 'Hendra Gunawan',
      'Status Hubungan': 'Kepala Keluarga',
      'Tempat Lahir': 'Bandung',
      'Tanggal Lahir': '12/04/1980',
      'Jenis Kelamin': 'Laki-laki',
      'Agama': 'Islam',
      'No Telepon / WA': '081398761234',
      'Status Kepemilikan': 'Milik Sendiri',
      'Status Rumah': 'Ditempati',
      'Status Rukem': 'Ikut Rukem',
      'Status WiFi': 'Pasang (Biznet)',
    },
  ];

  const worksheet = XLSX.utils.json_to_sheet(sampleRows);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Template Warga');
  XLSX.writeFile(workbook, 'Template_Update_Data_Warga_Mandor.xlsx');
}

export function parseDateString(val: any): string {
  if (!val) return '1990-01-01';
  // Excel serial number date
  if (typeof val === 'number') {
    const dateObj = new Date(Math.round((val - 25569) * 86400 * 1000));
    if (!isNaN(dateObj.getTime())) {
      return dateObj.toISOString().slice(0, 10);
    }
  }
  const str = String(val).trim();
  // If DD/MM/YYYY
  if (/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(str)) {
    const [d, m, y] = str.split('/');
    return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
  }
  // If DD-MM-YYYY
  if (/^\d{1,2}-\d{1,2}-\d{4}$/.test(str)) {
    const [d, m, y] = str.split('-');
    return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
  }
  // If YYYY-MM-DD
  if (/^\d{4}-\d{1,2}-\d{1,2}$/.test(str)) {
    return str;
  }
  const parsed = new Date(str);
  if (!isNaN(parsed.getTime())) {
    return parsed.toISOString().slice(0, 10);
  }
  return '1990-01-01';
}

export async function parseResidentsFromExcelFile(file: File): Promise<{
  success: boolean;
  data?: ResidentHouse[];
  error?: string;
  totalRows?: number;
  totalHouses?: number;
}> {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const buffer = e.target?.result;
        if (!buffer) {
          resolve({ success: false, error: 'Gagal membaca isi file.' });
          return;
        }
        const workbook = XLSX.read(buffer, { type: 'array' });
        const sheetName = workbook.SheetNames[0];
        if (!sheetName) {
          resolve({ success: false, error: 'File Excel tidak memiliki lembar kerja (sheet).' });
          return;
        }
        const worksheet = workbook.Sheets[sheetName];
        const rawJson: any[] = XLSX.utils.sheet_to_json(worksheet, { defval: '' });

        if (!rawJson || rawJson.length === 0) {
          resolve({ success: false, error: 'File Excel kosong atau tidak memiliki data baris.' });
          return;
        }

        // Map by blockNumber
        const houseMap: Record<string, ResidentHouse> = {};

        rawJson.forEach((row, idx) => {
          // Normalize column keys
          const blockNo = String(
            row['No Blok'] || row['Blok'] || row['Block'] || row['NO BLOK'] || ''
          ).trim();
          if (!blockNo) return; // Skip rows without block number

          const headNameCandidate = String(
            row['Kepala Keluarga'] || row['Nama Kepala Keluarga'] || row['Nama KK'] || ''
          ).trim();
          const memberName = String(
            row['Nama Anggota'] || row['Nama Lengkap'] || row['Nama'] || headNameCandidate || `Warga #${idx + 1}`
          ).trim();

          const rawRelation = String(
            row['Status Hubungan'] || row['Hubungan'] || row['Status Keluarga'] || ''
          ).trim();
          let relation: any = 'Anak';
          if (/kepala/i.test(rawRelation) || (!rawRelation && !houseMap[blockNo])) {
            relation = 'Kepala Keluarga';
          } else if (/istri/i.test(rawRelation)) {
            relation = 'Istri';
          } else if (/orang tua|ayah|ibu/i.test(rawRelation)) {
            relation = 'Orang Tua';
          } else if (/famili|keluarga lain/i.test(rawRelation)) {
            relation = 'Famili Lain';
          } else if (/anak/i.test(rawRelation)) {
            relation = 'Anak';
          }

          const birthPlace = String(
            row['Tempat Lahir'] || row['Kota Lahir'] || 'Jakarta'
          ).trim();
          const birthDate = parseDateString(
            row['Tanggal Lahir'] || row['Tgl Lahir'] || row['TANGGAL LAHIR']
          );

          const rawGender = String(
            row['Jenis Kelamin'] || row['JK'] || row['Gender'] || ''
          ).trim();
          const gender: any = /^p|perempuan|wanita/i.test(rawGender) ? 'Perempuan' : 'Laki-laki';

          const rawReligion = String(row['Agama'] || 'Islam').trim();
          let religion: any = 'Islam';
          if (/kristen/i.test(rawReligion)) religion = 'Kristen';
          else if (/katolik/i.test(rawReligion)) religion = 'Katolik';
          else if (/hindu/i.test(rawReligion)) religion = 'Hindu';
          else if (/buddha/i.test(rawReligion)) religion = 'Buddha';
          else if (/konghucu/i.test(rawReligion)) religion = 'Konghucu';

          const phone = String(
            row['No Telepon / WA'] || row['No HP'] || row['Telepon'] || row['WhatsApp'] || ''
          ).trim();

          const rawOwnership = String(
            row['Status Kepemilikan'] || row['Kepemilikan'] || 'Milik Sendiri'
          ).trim();
          let ownership: any = 'Milik Sendiri';
          if (/kontrak/i.test(rawOwnership)) ownership = 'Kontrak';
          else if (/orang lain/i.test(rawOwnership)) ownership = 'Milik Orang Lain';

          const rawOccupancy = String(
            row['Status Rumah'] || row['Hunian'] || 'Ditempati'
          ).trim();
          let occupancy: any = 'Ditempati';
          if (/kosong/i.test(rawOccupancy)) {
            occupancy = 'Kosong';
          } else if (/belum/i.test(rawOccupancy)) {
            occupancy = 'Belum Ditempati';
          } else if (/dikontrak|kontrak/i.test(rawOccupancy)) {
            occupancy = 'Dikontrakan';
          }

          const rawRukem = String(row['Status Rukem'] || row['Rukem'] || '').trim();
          const rukem: any =
            occupancy === 'Kosong'
              ? rawRukem && /ikut/i.test(rawRukem) && !/tidak/i.test(rawRukem)
                ? 'Ikut Rukem'
                : 'Tidak Ikut'
              : /tidak/i.test(rawRukem)
              ? 'Tidak Ikut'
              : 'Ikut Rukem';

          const rawWifi = String(row['Status WiFi'] || row['WiFi'] || row['Wifi'] || 'Tidak Pasang').trim();
          const isWifiPasang = /pasang|ya|ada/i.test(rawWifi) && !/tidak/i.test(rawWifi);
          const wifiStatus: any = isWifiPasang ? 'Pasang' : 'Tidak Pasang';

          // Extract provider if in parenthesis e.g. "Pasang (Indihome)"
          let wifiProvider = '-';
          if (isWifiPasang) {
            const matchProvider = rawWifi.match(/\(([^)]+)\)/);
            if (matchProvider && matchProvider[1]) {
              wifiProvider = matchProvider[1].trim();
            } else if (/indihome/i.test(rawWifi)) wifiProvider = 'Indihome';
            else if (/biznet/i.test(rawWifi)) wifiProvider = 'Biznet';
            else if (/myrepublic/i.test(rawWifi)) wifiProvider = 'MyRepublic';
            else if (/first media/i.test(rawWifi)) wifiProvider = 'First Media';
            else wifiProvider = 'Indihome';
          }

          const rawDues = String(
            row['Status Iuran Bulan Ini'] || row['Status Iuran'] || row['Iuran'] || 'Lunas'
          ).trim();
          const duesStatus: any = /belum/i.test(rawDues) ? 'Belum Bayar' : 'Lunas';

          const prevArrears = Number(
            row['Tunggakan Sebelumnya (Rp)'] || row['Tunggakan Sebelumnya'] || 0
          ) || 0;

          if (!houseMap[blockNo]) {
            houseMap[blockNo] = {
              id: 'warga-' + blockNo.replace(/[^a-zA-Z0-9]/g, '-').toLowerCase(),
              blockNumber: blockNo,
              headName: headNameCandidate || (relation === 'Kepala Keluarga' ? memberName : memberName),
              phone: phone,
              ownership,
              occupancy,
              rukem,
              wifiStatus,
              wifiProvider,
              duesStatus,
              previousArrears: prevArrears,
              members: [],
            };
          }

          // If phone is available, update
          if (phone && !houseMap[blockNo].phone) {
            houseMap[blockNo].phone = phone;
          }
          if (relation === 'Kepala Keluarga') {
            houseMap[blockNo].headName = memberName;
          }

          houseMap[blockNo].members.push({
            id: 'm-' + blockNo + '-' + (houseMap[blockNo].members.length + 1) + '-' + Date.now(),
            name: memberName,
            relation,
            birthPlace,
            birthDate,
            gender,
            religion,
          });
        });

        const houses = Object.values(houseMap);
        if (houses.length === 0) {
          resolve({
            success: false,
            error: 'Tidak ditemukan data No Blok yang valid dalam file Excel tersebut.',
          });
          return;
        }

        // Sort members so Kepala Keluarga is always at index 0 for each house
        houses.forEach((h) => {
          h.members.sort((a, b) => {
            if (a.relation === 'Kepala Keluarga') return -1;
            if (b.relation === 'Kepala Keluarga') return 1;
            return 0;
          });
        });

        resolve({
          success: true,
          data: houses,
          totalRows: rawJson.length,
          totalHouses: houses.length,
        });
      } catch (err: any) {
        resolve({
          success: false,
          error: `Gagal memproses file Excel: ${err?.message || 'Format tidak dikenal'}`,
        });
      }
    };
    reader.onerror = () => {
      resolve({ success: false, error: 'Terjadi kesalahan saat membaca file.' });
    };
    reader.readAsArrayBuffer(file);
  });
}

export function openWhatsAppShare(text: string, phone?: string): void {
  const cleanPhone = phone ? phone.replace(/[^0-9]/g, '') : '';
  const internationalPhone = cleanPhone.startsWith('0')
    ? '62' + cleanPhone.slice(1)
    : cleanPhone;

  const url = internationalPhone
    ? `https://wa.me/${internationalPhone}?text=${encodeURIComponent(text)}`
    : `https://wa.me/?text=${encodeURIComponent(text)}`;

  const link = document.createElement('a');
  link.href = url;
  link.target = '_blank';
  link.rel = 'noopener noreferrer';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

export const INDONESIAN_MONTHS = [
  'Januari',
  'Februari',
  'Maret',
  'April',
  'Mei',
  'Juni',
  'Juli',
  'Agustus',
  'September',
  'Oktober',
  'November',
  'Desember',
];

const INDONESIAN_MONTH_PATTERNS: { index: number; regex: RegExp }[] = [
  { index: 0, regex: /\b(januari|jan)\b/i },
  { index: 1, regex: /\b(februari|feb)\b/i },
  { index: 2, regex: /\b(maret|mar)\b/i },
  { index: 3, regex: /\b(april|apr)\b/i },
  { index: 4, regex: /\b(mei)\b/i },
  { index: 5, regex: /\b(juni|jun)\b/i },
  { index: 6, regex: /\b(juli|jul)\b/i },
  { index: 7, regex: /\b(agustus|agu|ags|aug)\b/i },
  { index: 8, regex: /\b(september|sept|sep)\b/i },
  { index: 9, regex: /\b(oktober|okt|oct)\b/i },
  { index: 10, regex: /\b(november|nov)\b/i },
  { index: 11, regex: /\b(desember|des|dec)\b/i },
];

export function getMonthKeyFromDate(dateStr: string): string {
  if (!dateStr) return '0000-00';
  const trimmed = dateStr.trim();
  // 1. Standard YYYY-MM or YYYY-MM-DD
  const ymdMatch = trimmed.match(/^(\d{4})[-\/](\d{1,2})/);
  if (ymdMatch) {
    return `${ymdMatch[1]}-${ymdMatch[2].padStart(2, '0')}`;
  }
  // 2. DD/MM/YYYY or DD-MM-YYYY
  const dmyMatch = trimmed.match(/^(\d{1,2})[-\/](\d{1,2})[-\/](\d{4})/);
  if (dmyMatch) {
    return `${dmyMatch[3]}-${dmyMatch[2].padStart(2, '0')}`;
  }
  // 3. Text label like "Oktober 2026" or "10 Oktober 2026"
  const parsed = parseIndonesianMonthYearToKey(trimmed);
  if (parsed) return parsed;

  // 4. Fallback Date object parsing
  const d = new Date(trimmed);
  if (!isNaN(d.getTime())) {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    return `${y}-${m}`;
  }
  return '0000-00';
}

/**
 * Checks if a transaction belongs to a resident house by block number or name.
 * Robust against formatting differences: K2/25, K2-25, K2 25, Blok K2/25.
 */
export function isTransactionForHouse(
  tx: { description?: string },
  house: ResidentHouse
): boolean {
  if (!tx || !tx.description || !house || !house.blockNumber) return false;
  const desc = tx.description;
  const rawBlock = house.blockNumber.trim();
  const cleanBlock = rawBlock.replace(/\s+/g, '');
  const slashVersion = cleanBlock.replace(/-/g, '/');
  const dashVersion = cleanBlock.replace(/\//g, '-');
  const spaceVersion = cleanBlock.replace(/[\/-]/g, ' ');

  const escapeRegex = (s: string) => s.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
  const pattern = `(?:\\b|Blok\\s*)(?:${escapeRegex(slashVersion)}|${escapeRegex(dashVersion)}|${escapeRegex(spaceVersion)})(?:\\b|[^a-zA-Z0-9]|$)`;
  const regex = new RegExp(pattern, 'i');
  if (regex.test(desc)) return true;

  if (house.headName && house.headName.length > 3 && !/kosong|belum/i.test(house.headName)) {
    if (desc.toLowerCase().includes(house.headName.toLowerCase())) return true;
  }
  return false;
}

/**
 * Retrieves the attendance status of a resident house from a Baksos agenda.
 * Resolves keys by: house.id, house.blockNumber (exact & normalized), or legacy index ('warga-1' ...).
 */
export function getBaksosAttendanceForHouse(
  agenda: BaksosAgenda,
  house: ResidentHouse,
  residentsList?: ResidentHouse[]
): BaksosAttendanceStatus | undefined {
  if (!agenda || !agenda.attendance || !house) return undefined;
  if (agenda.attendance[house.id]) {
    return agenda.attendance[house.id];
  }
  if (agenda.attendance[house.blockNumber]) {
    return agenda.attendance[house.blockNumber];
  }
  const normTarget = house.blockNumber.replace(/[\s\/-]/g, '').toUpperCase();
  for (const [key, val] of Object.entries(agenda.attendance)) {
    if (key.replace(/[\s\/-]/g, '').toUpperCase() === normTarget) {
      return val;
    }
  }
  if (residentsList && residentsList.length > 0) {
    const idx = residentsList.findIndex((h) => h.id === house.id);
    if (idx >= 0) {
      const legacyKey1 = `warga-${idx + 1}`;
      if (agenda.attendance[legacyKey1]) {
        return agenda.attendance[legacyKey1];
      }
      const legacyKey2 = `warga-${idx}`;
      if (agenda.attendance[legacyKey2]) {
        return agenda.attendance[legacyKey2];
      }
    }
  }
  return undefined;
}

/**
 * Checks whether a Baksos fine is marked paid for a resident house.
 * Resolves keys by: house.id, house.blockNumber (exact & normalized), or legacy index ('warga-1' ...).
 */
export function isBaksosFinePaidForHouse(
  agenda: BaksosAgenda,
  house: ResidentHouse,
  residentsList?: ResidentHouse[]
): boolean {
  if (!agenda || !agenda.finesPaid || !house) return false;
  if (agenda.finesPaid[house.id] !== undefined) {
    return Boolean(agenda.finesPaid[house.id]);
  }
  if (agenda.finesPaid[house.blockNumber] !== undefined) {
    return Boolean(agenda.finesPaid[house.blockNumber]);
  }
  const normTarget = house.blockNumber.replace(/[\s\/-]/g, '').toUpperCase();
  for (const [key, val] of Object.entries(agenda.finesPaid)) {
    if (key.replace(/[\s\/-]/g, '').toUpperCase() === normTarget) {
      return Boolean(val);
    }
  }
  if (residentsList && residentsList.length > 0) {
    const idx = residentsList.findIndex((h) => h.id === house.id);
    if (idx >= 0) {
      const legacyKey1 = `warga-${idx + 1}`;
      if (agenda.finesPaid[legacyKey1] !== undefined) {
        return Boolean(agenda.finesPaid[legacyKey1]);
      }
      const legacyKey2 = `warga-${idx}`;
      if (agenda.finesPaid[legacyKey2] !== undefined) {
        return Boolean(agenda.finesPaid[legacyKey2]);
      }
    }
  }
  return false;
}


export function formatMonthYearFromKey(monthKey: string): string {
  if (!monthKey || monthKey === '0000-00') return 'Periode Lainnya';
  const [year, month] = monthKey.split('-');
  const monthIdx = parseInt(month, 10) - 1;
  if (monthIdx >= 0 && monthIdx < 12) {
    return `${INDONESIAN_MONTHS[monthIdx]} ${year}`;
  }
  return monthKey;
}

export function formatMonthYearFromDate(dateStr: string): string {
  return formatMonthYearFromKey(getMonthKeyFromDate(dateStr));
}

export function parseIndonesianMonthYearToKey(label: string): string | null {
  if (!label) return null;
  const clean = label.trim();
  if (/^\d{4}-\d{2}$/.test(clean)) {
    return clean;
  }
  const yearMatch = clean.match(/\b(20\d{2})\b/);
  const year = yearMatch ? yearMatch[1] : '2026';

  let earliestPos = Infinity;
  let matchedMonthIdx = -1;

  for (const item of INDONESIAN_MONTH_PATTERNS) {
    const m = item.regex.exec(clean);
    if (m && m.index < earliestPos) {
      earliestPos = m.index;
      matchedMonthIdx = item.index;
    }
  }

  if (matchedMonthIdx >= 0) {
    return `${year}-${String(matchedMonthIdx + 1).padStart(2, '0')}`;
  }
  return null;
}

export function getSubsequentMonthLabels(startLabel: string, count: number): string[] {
  const key = parseIndonesianMonthYearToKey(startLabel) || '2026-10';
  const [yStr, mStr] = key.split('-');
  const year = parseInt(yStr, 10) || 2026;
  const monthIdx = (parseInt(mStr, 10) || 10) - 1;
  const result: string[] = [];
  for (let i = 0; i < Math.max(1, count); i++) {
    const curMonthIdx = (monthIdx + i) % 12;
    const curYear = year + Math.floor((monthIdx + i) / 12);
    result.push(`${INDONESIAN_MONTHS[curMonthIdx]} ${curYear}`);
  }
  return result;
}

/**
 * Cek apakah sebuah periode tertentu (misal: "November 2026") tercakup dalam inputan bulan iuran warga.
 * Tidak ada perhitungan otomatis bulan berikutnya lunas, tetapi murni mengikuti apa yang diinput oleh pengurus.
 */
export function isPeriodCoveredInDuesNote(duesMonthNote: string | undefined, periodLabel: string): boolean {
  if (!duesMonthNote || !duesMonthNote.trim() || !periodLabel || !periodLabel.trim()) return false;
  const noteLower = duesMonthNote.toLowerCase().trim();
  const periodLower = periodLabel.toLowerCase().trim();

  // 1. Exact atau persis match
  if (noteLower === periodLower) return true;

  // 2. Substring match langsung (misal: "Oktober 2026, November 2026")
  if (noteLower.includes(periodLower)) return true;

  const pKey = parseIndonesianMonthYearToKey(periodLabel);
  if (!pKey) return false;
  const [pYearStr, pMonthStr] = pKey.split('-');
  const pYear = parseInt(pYearStr, 10);
  const pMonth = parseInt(pMonthStr, 10);

  const indonesianMonths = [
    'januari', 'februari', 'maret', 'april', 'mei', 'juni',
    'juli', 'agustus', 'september', 'oktober', 'november', 'desember'
  ];
  const targetMonthName = indonesianMonths[pMonth - 1];

  // 3. Rentang bulan yang ditulis eksplisit seperti: "Oktober - Desember 2026" atau "Oktober s/d Desember 2026"
  const rangeMatch = noteLower.match(/([a-z]+)\s*(?:-|s\/d|sampai|hingga)\s*([a-z]+)(?:\s*(\d{4}))?/);
  if (rangeMatch) {
    const startMonthName = rangeMatch[1];
    const endMonthName = rangeMatch[2];
    const rangeYear = rangeMatch[3] ? parseInt(rangeMatch[3], 10) : pYear;

    const startIdx = indonesianMonths.indexOf(startMonthName);
    const endIdx = indonesianMonths.indexOf(endMonthName);

    if (startIdx !== -1 && endIdx !== -1) {
      const yearMatches = !noteLower.includes('20') || noteLower.includes(String(pYear)) || rangeYear === pYear;
      if (yearMatches) {
        const minIdx = Math.min(startIdx, endIdx);
        const maxIdx = Math.max(startIdx, endIdx);
        const currIdx = pMonth - 1;
        if (currIdx >= minIdx && currIdx <= maxIdx) {
          return true;
        }
      }
    }
  }

  // 4. Daftar bulan dipisah koma/dan/garis miring tanpa tahun berulang, misal: "Oktober, November, Desember 2026"
  if (noteLower.includes(targetMonthName)) {
    const yearMatches = !noteLower.includes('20') || noteLower.includes(String(pYear));
    if (yearMatches) {
      return true;
    }
  }

  return false;
}

export function getPreviousMonthKey(monthKeyOrLabel: string): string {
  const key = parseIndonesianMonthYearToKey(monthKeyOrLabel) || '2026-10';
  const [yStr, mStr] = key.split('-');
  const year = parseInt(yStr, 10) || 2026;
  const month = parseInt(mStr, 10) || 10;
  if (month <= 1) {
    return `${year - 1}-12`;
  }
  return `${year}-${String(month - 1).padStart(2, '0')}`;
}

export function getPreviousMonthLabel(monthKeyOrLabel: string): string {
  return formatMonthYearFromKey(getPreviousMonthKey(monthKeyOrLabel));
}

export function getLastDayOfMonthISO(monthKeyOrLabel: string): string {
  const key = parseIndonesianMonthYearToKey(monthKeyOrLabel) || '2026-09';
  const [yStr, mStr] = key.split('-');
  const year = parseInt(yStr, 10) || 2026;
  const month = parseInt(mStr, 10) || 9;
  const lastDay = new Date(year, month, 0).getDate();
  return `${year}-${String(month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
}

export interface PreviousMonthBalanceSummary {
  referenceMonthKey: string;
  referenceMonthLabel: string;
  prevMonthKey: string;
  prevMonthLabel: string;
  kasUtama: number;
  wifiCashback: number;
  sampahCashback: number;
  total: number;
  prevMonthKasIn: number;
  prevMonthKasOut: number;
  prevMonthWifiIn: number;
  prevMonthWifiOut: number;
  prevMonthSampahIn: number;
  prevMonthSampahOut: number;
  prevMonthTxCount: number;
  currentMonthKasNet: number;
  currentMonthWifiNet: number;
  currentMonthSampahNet: number;
  currentMonthTotalNet: number;
  closingKasUtama: number;
  closingWifiCashback: number;
  closingSampahCashback: number;
  closingTotal: number;
}

export function calculatePreviousMonthBalanceSummary(
  transactions: CashTransaction[],
  referenceMonthKeyOrLabel: string
): PreviousMonthBalanceSummary {
  // Jika 'semua' (Semua Periode), saldo awal pembukuan adalah 0 agar tidak menduplikasi transaksi di tabel
  if (
    !referenceMonthKeyOrLabel ||
    referenceMonthKeyOrLabel.toLowerCase() === 'semua' ||
    referenceMonthKeyOrLabel.toLowerCase().includes('semua')
  ) {
    let closingKas = 0;
    let closingWifi = 0;
    let closingSampah = 0;
    transactions.forEach((tx) => {
      const cat = tx.category || '';
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

      const signedVal = tx.type === 'masuk' ? tx.amount : -tx.amount;
      if (isWifi) closingWifi += signedVal;
      else if (isSampah) closingSampah += signedVal;
      else closingKas += signedVal;
    });

    return {
      referenceMonthKey: 'semua',
      referenceMonthLabel: 'Semua Periode',
      prevMonthKey: '',
      prevMonthLabel: 'Awal Pembukuan',
      kasUtama: 0,
      wifiCashback: 0,
      sampahCashback: 0,
      total: 0,
      prevMonthKasIn: 0,
      prevMonthKasOut: 0,
      prevMonthWifiIn: 0,
      prevMonthWifiOut: 0,
      prevMonthSampahIn: 0,
      prevMonthSampahOut: 0,
      prevMonthTxCount: 0,
      currentMonthKasNet: closingKas,
      currentMonthWifiNet: closingWifi,
      currentMonthSampahNet: closingSampah,
      currentMonthTotalNet: closingKas + closingWifi + closingSampah,
      closingKasUtama: closingKas,
      closingWifiCashback: closingWifi,
      closingSampahCashback: closingSampah,
      closingTotal: closingKas + closingWifi + closingSampah,
    };
  }

  const referenceMonthKey =
    parseIndonesianMonthYearToKey(referenceMonthKeyOrLabel) || '2026-09';
  const referenceMonthLabel = formatMonthYearFromKey(referenceMonthKey);
  const prevMonthKey = getPreviousMonthKey(referenceMonthKey);
  const prevMonthLabel = formatMonthYearFromKey(prevMonthKey);

  let kasUtama = 0;
  let wifiCashback = 0;
  let sampahCashback = 0;


  let prevMonthKasIn = 0;
  let prevMonthKasOut = 0;
  let prevMonthWifiIn = 0;
  let prevMonthWifiOut = 0;
  let prevMonthSampahIn = 0;
  let prevMonthSampahOut = 0;
  let prevMonthTxCount = 0;

  let currentMonthKasNet = 0;
  let currentMonthWifiNet = 0;
  let currentMonthSampahNet = 0;

  let closingKasUtama = 0;
  let closingWifiCashback = 0;
  let closingSampahCashback = 0;

  transactions.forEach((tx) => {
    const txKey = getMonthKeyFromDate(tx.date);
    if (!txKey || txKey === '0000-00') return;

    const cat = tx.category || '';
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

    const signedVal = tx.type === 'masuk' ? tx.amount : -tx.amount;

    // Cumulative balance up to the end of the previous month (<= prevMonthKey)
    if (txKey <= prevMonthKey) {
      if (isWifi) wifiCashback += signedVal;
      else if (isSampah) sampahCashback += signedVal;
      else kasUtama += signedVal;
    }

    // Transactions specifically in the previous month (=== prevMonthKey)
    if (txKey === prevMonthKey) {
      prevMonthTxCount += 1;
      if (isWifi) {
        if (tx.type === 'masuk') prevMonthWifiIn += tx.amount;
        else prevMonthWifiOut += tx.amount;
      } else if (isSampah) {
        if (tx.type === 'masuk') prevMonthSampahIn += tx.amount;
        else prevMonthSampahOut += tx.amount;
      } else {
        if (tx.type === 'masuk') prevMonthKasIn += tx.amount;
        else prevMonthKasOut += tx.amount;
      }
    }

    // Net mutations in the reference/active month (=== referenceMonthKey)
    if (txKey === referenceMonthKey) {
      if (isWifi) currentMonthWifiNet += signedVal;
      else if (isSampah) currentMonthSampahNet += signedVal;
      else currentMonthKasNet += signedVal;
    }

    // Cumulative closing balance up to the end of the reference month (<= referenceMonthKey)
    if (txKey <= referenceMonthKey) {
      if (isWifi) closingWifiCashback += signedVal;
      else if (isSampah) closingSampahCashback += signedVal;
      else closingKasUtama += signedVal;
    }
  });

  const total = kasUtama + wifiCashback + sampahCashback;
  const currentMonthTotalNet =
    currentMonthKasNet + currentMonthWifiNet + currentMonthSampahNet;
  const closingTotal = closingKasUtama + closingWifiCashback + closingSampahCashback;

  return {
    referenceMonthKey,
    referenceMonthLabel,
    prevMonthKey,
    prevMonthLabel,
    kasUtama,
    wifiCashback,
    sampahCashback,
    total,
    prevMonthKasIn,
    prevMonthKasOut,
    prevMonthWifiIn,
    prevMonthWifiOut,
    prevMonthSampahIn,
    prevMonthSampahOut,
    prevMonthTxCount,
    currentMonthKasNet,
    currentMonthWifiNet,
    currentMonthSampahNet,
    currentMonthTotalNet,
    closingKasUtama,
    closingWifiCashback,
    closingSampahCashback,
    closingTotal,
  };
}
