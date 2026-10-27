import * as XLSX from 'xlsx';
import { CashTransaction, ResidentHouse } from '../types';

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
  return (
    occ === 'kosong' ||
    name.includes('kosong') ||
    name === '-' ||
    name === 'belum berpenghuni'
  );
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
  const parts = dateStr.trim().split('-');
  if (parts.length >= 2 && /^\d{4}$/.test(parts[0]) && /^\d{1,2}$/.test(parts[1])) {
    return `${parts[0]}-${parts[1].padStart(2, '0')}`;
  }
  return '0000-00';
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
  const referenceMonthKey =
    parseIndonesianMonthYearToKey(referenceMonthKeyOrLabel) || '2026-10';
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

    const catLower = (tx.category || '').toLowerCase();
    const descLower = (tx.description || '').toLowerCase();
    const isWifi = tx.pool === 'Cashback WiFi' || catLower.includes('wifi') || descLower.includes('wifi');
    const isSampah = tx.pool === 'Cashback Sampah' || catLower.includes('sampah') || descLower.includes('sampah');
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
