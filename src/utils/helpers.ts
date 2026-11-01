import * as XLSX from 'xlsx';
import { BaksosAgenda, BaksosAttendanceStatus, CashTransaction, OccupancyStatus, ResidentHouse, SiteConfig } from '../types';


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
 * Mendapatkan status hunian (occupancy) suatu rumah untuk periode tertentu.
 * Menjamin jika status rumah diedit pada periode tertentu/berjalan,
 * data dan status di bulan-bulan sebelumnya TIDAK BERUBAH.
 */
export function getHouseOccupancyForPeriod(
  house: ResidentHouse | null | undefined,
  periodLabelOrKey: string,
  transactions: CashTransaction[] = []
): OccupancyStatus {
  if (!house) return 'Kosong';

  const pKey = parseIndonesianMonthYearToKey(periodLabelOrKey) || periodLabelOrKey;
  const pLabel = formatMonthYearFromKey(pKey) || periodLabelOrKey;

  // 1. Prioritas Utama: Riwayat Eksplisit di occupancyHistory / periodHistory
  if (house.occupancyHistory) {
    if (house.occupancyHistory[pKey]) return house.occupancyHistory[pKey];
    if (house.occupancyHistory[pLabel]) return house.occupancyHistory[pLabel];
    for (const [k, v] of Object.entries(house.occupancyHistory)) {
      if (k === pKey || k.toLowerCase() === pLabel.toLowerCase() || parseIndonesianMonthYearToKey(k) === pKey) {
        return v;
      }
    }
  }

  if (house.periodHistory) {
    const entry = house.periodHistory[pKey] || house.periodHistory[pLabel];
    if (entry?.occupancy) return entry.occupancy;
  }

  // 2. Cek transaksi nyata di Buku Kas pada periode tersebut untuk rumah ini
  const blockRegex = new RegExp(`\\b${house.blockNumber.replace('/', '\\/')}\\b`, 'i');
  const periodMonthNameLower = (pLabel.split(' ')[0] || '').toLowerCase();

  const matchingTxs = transactions.filter((t) => {
    if (t.type !== 'masuk' || !blockRegex.test(t.description)) return false;
    const tKey = getMonthKeyFromDate(t.date);
    const desc = t.description.toLowerCase();
    return tKey === pKey || desc.includes(periodMonthNameLower) || desc.includes(pLabel.toLowerCase());
  });

  if (matchingTxs.length > 0) {
    const hasVacantTx = matchingTxs.some((t) => {
      const descLower = t.description.toLowerCase();
      return descLower.includes('rumah kosong') || descLower.includes('(kosong)');
    });
    if (hasVacantTx) {
      return 'Kosong';
    }

    const hasPaidDuesOrBaksos = matchingTxs.some(
      (t) =>
        t.category === 'Iuran Warga' ||
        t.category === 'Kas Utama' ||
        t.category === 'Denda Baksos' ||
        t.description.toLowerCase().includes('iuran bulanan') ||
        t.description.toLowerCase().includes('iuran kas')
    );
    if (hasPaidDuesOrBaksos) {
      return house.occupancy === 'Belum Ditempati' ? 'Belum Ditempati' : 'Ditempati';
    }
  }

  // 3. Cek apakah tercakup pembayaran di muka yang dilakukan di bulan sebelumnya
  if (
    house.duesMonthNote &&
    isPeriodCoveredInDuesNote(house.duesMonthNote, pLabel)
  ) {
    return house.occupancy === 'Belum Ditempati' ? 'Belum Ditempati' : 'Ditempati';
  }

  // 4. Default ke status occupancy rumah saat ini
  return house.occupancy || 'Ditempati';
}

/**
 * Mendapatkan nominal iuran kas bulanan suatu rumah untuk periode tertentu.
 * Menjamin jika iuran bulanan berubah di periode baru / saat ini,
 * nominal iuran bulan-bulan sebelumnya TIDAK BERUBAH.
 */
export function getHouseDuesNominalForPeriod(
  house: ResidentHouse | null | undefined,
  periodLabelOrKey: string,
  config?: Partial<SiteConfig> | null,
  transactions: CashTransaction[] = []
): number {
  const fallbackNominal = config?.duesAmountPerMonth || 50000;
  if (!house) return fallbackNominal;

  const pKey = parseIndonesianMonthYearToKey(periodLabelOrKey) || periodLabelOrKey;
  const pLabel = formatMonthYearFromKey(pKey) || periodLabelOrKey;

  // 1. Prioritas Utama: Riwayat Eksplisit di house.periodHistory untuk periode ini
  if (house.periodHistory) {
    const entry = house.periodHistory[pKey] || house.periodHistory[pLabel];
    if (entry && entry.customDuesAmount !== undefined && entry.customDuesAmount !== null) {
      return entry.customDuesAmount;
    }
  }

  // 2. Cek transaksi nyata di Buku Kas pada periode tersebut untuk rumah ini
  const blockRegex = new RegExp(`\\b${house.blockNumber.replace('/', '\\/')}\\b`, 'i');
  const periodMonthNameLower = (pLabel.split(' ')[0] || '').toLowerCase();
  const matchingIuranTx = transactions.find((t) => {
    if (t.type !== 'masuk' || !isPureIuranTx(t) || !blockRegex.test(t.description)) return false;
    const tKey = getMonthKeyFromDate(t.date);
    const desc = t.description.toLowerCase();
    return tKey === pKey || desc.includes(periodMonthNameLower) || desc.includes(pLabel.toLowerCase());
  });

  if (matchingIuranTx && matchingIuranTx.amount > 0) {
    const multiMatch = matchingIuranTx.description.match(/(\d+)\s*Bulan/i);
    const monthsCount = multiMatch ? parseInt(multiMatch[1], 10) : 1;
    if (monthsCount > 1 && matchingIuranTx.amount % monthsCount === 0) {
      return Math.round(matchingIuranTx.amount / monthsCount);
    }
    if (monthsCount <= 1 && matchingIuranTx.amount >= 10000 && matchingIuranTx.amount <= 200000) {
      return matchingIuranTx.amount;
    }
  }

  // 3. Cek apakah ada konfigurasi nominal khusus untuk periode ini di config.periodDuesAmounts
  if (config?.periodDuesAmounts) {
    if (config.periodDuesAmounts[pKey] !== undefined) {
      return config.periodDuesAmounts[pKey];
    }
    if (config.periodDuesAmounts[pLabel] !== undefined) {
      return config.periodDuesAmounts[pLabel];
    }
  }

  // 4. Cek customDuesAmount dari rumah (jika disetel khusus per KK)
  if (house.customDuesAmount !== undefined && house.customDuesAmount !== null) {
    return house.customDuesAmount;
  }

  // 5. Default iuran bulanan dari config
  return fallbackNominal;
}

/**
 * Mendapatkan nama kepala keluarga / pembayar untuk rumah pada periode tertentu.
 */
export function getHouseHeadNameForPeriod(
  house: ResidentHouse | null | undefined,
  periodLabelOrKey: string,
  transactions: CashTransaction[] = []
): string {
  if (!house) return '';
  const occ = getHouseOccupancyForPeriod(house, periodLabelOrKey, transactions);
  const pKey = parseIndonesianMonthYearToKey(periodLabelOrKey) || periodLabelOrKey;
  const pLabel = formatMonthYearFromKey(pKey) || periodLabelOrKey;

  // 1. Prioritas Utama: Riwayat Eksplisit di periodHistory untuk bulan ini
  if (house.periodHistory) {
    const entry =
      house.periodHistory[pKey] ||
      house.periodHistory[pLabel] ||
      house.periodHistory[periodLabelOrKey] ||
      (pKey
        ? Object.entries(house.periodHistory).find(
            ([k]) =>
              k.toLowerCase() === pKey.toLowerCase() ||
              k.toLowerCase() === pLabel.toLowerCase() ||
              parseIndonesianMonthYearToKey(k) === pKey
          )?.[1]
        : undefined);

    if (entry) {
      if (entry.occupancy === 'Kosong' && (!entry.duesHeadNameOverride || entry.duesHeadNameOverride === 'Rumah Kosong')) {
        return 'Rumah Kosong';
      }
      if (entry.occupancy === 'Belum Ditempati' && (!entry.duesHeadNameOverride || entry.duesHeadNameOverride === 'Belum Ditempati')) {
        return 'Belum Ditempati';
      }
      if (entry.duesHeadNameOverride) return entry.duesHeadNameOverride;
      if (entry.headName) return entry.headName;
    }
  }

  // 2. Cek nama dari transaksi pada periode tersebut jika ada
  const blockRegex = new RegExp(`\\b${house.blockNumber.replace('/', '\\/')}\\b`, 'i');
  const periodMonthNameLower = (pLabel.split(' ')[0] || '').toLowerCase();
  const matchingTx = transactions.find((t) => {
    if (t.type !== 'masuk' || !blockRegex.test(t.description)) return false;
    const tKey = getMonthKeyFromDate(t.date);
    const desc = t.description.toLowerCase();
    return tKey === pKey || desc.includes(periodMonthNameLower) || desc.includes(pLabel.toLowerCase());
  });

  if (matchingTx) {
    const blockEscaped = house.blockNumber.replace('/', '\\/');
    const blockNameMatch = matchingTx.description.match(
      new RegExp(`Blok\\s+${blockEscaped}\\s*\\(([^)]+)\\)`, 'i')
    );
    const parenMatch = blockNameMatch || matchingTx.description.match(/\(([^)]+)\)$/);
    if (parenMatch && parenMatch[1]) {
      let extracted = parenMatch[1].trim();
      if (extracted.toLowerCase().startsWith('rumah kosong - ')) {
        extracted = extracted.slice('rumah kosong - '.length).trim();
      }
      const isNote =
        /^(pelunasan|iuran|denda|tunggakan|warga|\d+\s*rumah|bulan)/i.test(extracted) ||
        extracted.includes('202');
      if (extracted && !isNote) {
        return extracted;
      }
    }
  }

  if (occ === 'Kosong') {
    return 'Rumah Kosong';
  }
  if (occ === 'Belum Ditempati') {
    return 'Belum Ditempati';
  }
  // Penting: jika house.duesHeadNameOverride bernilai 'Rumah Kosong' tapi occ pada periode ini BUKAN Kosong,
  // JANGAN gunakan duesHeadNameOverride 'Rumah Kosong' karena itu milik bulan lain! Gunakan house.headName!
  if (house.duesHeadNameOverride && /rumah kosong|^kosong$/i.test(house.duesHeadNameOverride.trim())) {
    return house.headName || '';
  }
  return house.duesHeadNameOverride || house.headName || '';
}

/**
 * Memeriksa apakah suatu rumah merupakan "Rumah Kosong" pada periode bulan tertentu.
 * Menggunakan status hunian spesifik untuk periode tersebut agar tidak merubah data bulan sebelum sebelumnya.
 */
export function isHouseVacantInPeriod(
  house: ResidentHouse | null | undefined,
  periodLabel: string,
  transactions: CashTransaction[] = []
): boolean {
  if (!house) return false;
  const occ = getHouseOccupancyForPeriod(house, periodLabel, transactions);
  return occ === 'Kosong';
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
  const safeCount = !Number.isFinite(count) || count < 1 ? 1 : Math.min(Math.floor(count), 60);
  const key = parseIndonesianMonthYearToKey(startLabel) || '2026-10';
  const [yStr, mStr] = key.split('-');
  const year = parseInt(yStr, 10) || 2026;
  const monthIdx = (parseInt(mStr, 10) || 10) - 1;
  const result: string[] = [];
  for (let i = 0; i < safeCount; i++) {
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

export function isPureIuranTx(tx: { category?: string; description?: string; type?: string; pool?: string }): boolean {
  if (tx.type !== 'masuk') return false;
  const cat = tx.category || '';
  const desc = (tx.description || '').toLowerCase();
  if (cat === 'Pembayaran Tunggakan' || desc.includes('tunggakan') || (desc.includes('pelunasan') && !desc.includes('iuran'))) return false;
  if (cat === 'Denda Baksos' || desc.includes('denda')) return false;
  if (
    cat.includes('Cashback') ||
    desc.includes('cashback') ||
    tx.pool === 'Cashback WiFi' ||
    tx.pool === 'Cashback Sampah'
  ) {
    return false;
  }
  return cat === 'Iuran Warga' || desc.includes('iuran');
}

export function isTunggakanTx(tx: { category?: string; description?: string; type?: string }): boolean {
  if (tx.type !== 'masuk') return false;
  const cat = tx.category || '';
  const desc = (tx.description || '').toLowerCase();
  // Transaksi Denda Baksos BUKAN transaksi tunggakan iuran
  if (cat === 'Denda Baksos' || desc.includes('denda baksos') || desc.includes('denda')) {
    return false;
  }
  return (
    cat === 'Pembayaran Tunggakan' ||
    desc.includes('tunggakan') ||
    desc.includes('tertunggak') ||
    desc.includes('tunggak') ||
    (desc.includes('pelunasan') && !desc.includes('denda'))
  );
}

/**
 * Mendeteksi apakah suatu periode iuran yang belum lunas telah diselesaikan
 * melalui pembayaran tunggakan di bulan kemudian (atau transaksi pelunasan di Buku Kas).
 * Mengembalikan nama bulan pelunasan (misal "Oktober 2026") dan tanggal bayarnya.
 */
export function findArrearSettlementForPeriod(
  house: ResidentHouse,
  targetKey: string,
  periodLabel: string,
  transactions: CashTransaction[] = []
): { settlementMonth: string; paidDate?: string } | null {
  if (!house || !targetKey) return null;

  // 1. Cek periodHistory jika sudah eksplisit tercatat settlementMonth
  if (house.periodHistory) {
    const snap = house.periodHistory[targetKey] || house.periodHistory[periodLabel];
    if (snap?.settlementMonth) {
      return { settlementMonth: snap.settlementMonth, paidDate: snap.paidDate };
    }
  }

  // 2. Cek transaksi eksplisit di Buku Kas yang menyebut nama bulan atau key periode spesifik ini
  const periodMonthLower = (periodLabel.split(' ')[0] || '').toLowerCase();
  const explicitTx = transactions.find((t) => {
    if (t.type !== 'masuk' || !isTransactionForHouse(t, house)) return false;
    const txKey = getMonthKeyFromDate(t.date);
    if (!txKey || txKey <= targetKey) return false;
    const desc = t.description.toLowerCase();
    const isArrearOrDues = isTunggakanTx(t) || t.category === 'Iuran Warga';
    if (!isArrearOrDues) return false;
    return (
      desc.includes(periodMonthLower) ||
      desc.includes(periodLabel.toLowerCase()) ||
      desc.includes(targetKey)
    );
  });

  if (explicitTx) {
    const sMonth =
      formatMonthYearFromDate(explicitTx.date) ||
      formatMonthYearFromKey(getMonthKeyFromDate(explicitTx.date));
    if (sMonth) {
      return { settlementMonth: sMonth, paidDate: explicitTx.date };
    }
  }

  // 3. Cek apakah ada transaksi Pembayaran Tunggakan untuk KK ini di bulan kemudian (txKey > targetKey)
  // yang secara spesifik melunasi tunggakan bulan ini
  const tunggakanTx = transactions.find((t) => {
    if (t.type !== 'masuk' || !isTunggakanTx(t)) return false;
    if (!isTransactionForHouse(t, house)) return false;
    const txKey = getMonthKeyFromDate(t.date);
    if (!txKey || txKey <= targetKey) return false;
    const desc = t.description.toLowerCase();
    return (
      desc.includes(periodMonthLower) ||
      desc.includes(periodLabel.toLowerCase()) ||
      desc.includes(targetKey)
    );
  });

  if (tunggakanTx) {
    const sMonth =
      formatMonthYearFromDate(tunggakanTx.date) ||
      formatMonthYearFromKey(getMonthKeyFromDate(tunggakanTx.date));
    if (sMonth) {
      return { settlementMonth: sMonth, paidDate: tunggakanTx.date };
    }
  }

  // 4. Jika KK ini sudah tidak memiliki sisa tunggakan lalu (previousArrears === 0),
  // dan di catatan sebelumnya (previousArrearsNote) tertera periode ini,
  // cari transaksi pembayaran tunggakan atau pelunasan untuk menentukan bulan pelunasannya
  if (
    house.previousArrears === 0 &&
    house.previousArrearsNote &&
    (house.previousArrearsNote.toLowerCase().includes(periodMonthLower) ||
      house.previousArrearsNote.toLowerCase().includes(periodLabel.toLowerCase()))
  ) {
    const anyTungTx = transactions.find((t) => {
      if (t.type !== 'masuk' || !isTunggakanTx(t)) return false;
      return isTransactionForHouse(t, house);
    });
    if (anyTungTx) {
      const sMonth =
        formatMonthYearFromDate(anyTungTx.date) ||
        formatMonthYearFromKey(getMonthKeyFromDate(anyTungTx.date));
      if (sMonth) {
        return { settlementMonth: sMonth, paidDate: anyTungTx.date };
      }
    }
    return {
      settlementMonth: house.duesPaidDate ? formatMonthYearFromDate(house.duesPaidDate) : 'Pelunasan',
      paidDate: house.duesPaidDate,
    };
  }

  return null;
}

export interface HousePeriodStatusInfo {
  status: 'Lunas' | 'Bayar Lebih' | 'Belum Bayar' | 'Kosong';
  amount: number;
  isAdvanceSubsequentMonth: boolean;
  label: string;
  badgeClass: string;
  paidDate?: string;
  note?: string;
  basePaymentMonth?: string;
  paidMonthsCount?: number;
  coveredMonths?: string[];
  lastCoveredMonth?: string;
  isArrearSettledLater?: boolean;
  settlementMonth?: string | null;
}

export interface HousePeriodBaksosInfo {
  matchingAgendasCount: number;
  dendaPaid: number;
  dendaUnpaid: number;
  hadHadir: boolean;
  hadTidakWajib: boolean;
  isPureKosong: boolean;
  paidAgendas: BaksosAgenda[];
  unpaidAgendas: BaksosAgenda[];
}

export function getHouseStatusForPeriod(
  house: ResidentHouse,
  periodLabel: string,
  config?: Partial<SiteConfig> | null,
  transactions: CashTransaction[] = [],
  residents: ResidentHouse[] = [],
  defaultMonthLabel: string = config?.duesCurrentMonth || 'September 2026'
): HousePeriodStatusInfo {
  const isPeriodVacant = isHouseVacantInPeriod(house, periodLabel, transactions);
  const nominal = getHouseDuesNominalForPeriod(house, periodLabel, config, transactions);
  const targetKey = parseIndonesianMonthYearToKey(periodLabel) || '';
  const currentKey = parseIndonesianMonthYearToKey(defaultMonthLabel) || '2026-09';
  const blockRegex = new RegExp(`\\b${house.blockNumber.replace('/', '\\/')}\\b`, 'i');

  // 1. Prioritas Utama untuk Rumah Kosong pada periode ini: Bebas Iuran (Rp 0), kecuali ada transaksi nyata di Buku Kas
  if (isPeriodVacant) {
    const voluntaryTxs = transactions.filter((t) => {
      if (t.type !== 'masuk' || !isPureIuranTx(t) || !blockRegex.test(t.description)) return false;
      const descMatch = t.description.match(/\(([^)]+202\d)\)/)?.[1];
      const descKey = descMatch ? parseIndonesianMonthYearToKey(descMatch) : null;
      if (descKey) return descKey === targetKey;
      return getMonthKeyFromDate(t.date) === targetKey;
    });
    const voluntarySum = voluntaryTxs.reduce((s, t) => s + t.amount, 0);
    if (voluntarySum > 0) {
      return {
        status: 'Lunas',
        amount: voluntarySum,
        isAdvanceSubsequentMonth: false,
        label: 'Lunas (Kosong)',
        badgeClass: 'bg-emerald-600 text-white border border-emerald-500 font-bold shadow-xs',
        paidDate: voluntaryTxs[0].date,
        note: 'Iuran Sukarela (Rumah Kosong)',
      };
    }
    return {
      status: 'Kosong',
      amount: 0,
      isAdvanceSubsequentMonth: false,
      label: 'Bebas Iuran',
      badgeClass: 'bg-black text-white border border-neutral-700 font-semibold',
      paidDate: undefined,
      note: 'Rumah Kosong (Tidak Wajib)',
    };
  }

  // 2. Prioritas Tertinggi untuk Status Hasil Edit / Hapus Admin:
  // Cek snapshot eksplisit di periodHistory untuk periode ini
  const periodSnapshot = house.periodHistory?.[targetKey] || (targetKey ? house.periodHistory?.[periodLabel] : undefined);
  if (periodSnapshot) {
    const snapNominal = periodSnapshot.customDuesAmount ?? nominal;
    if (periodSnapshot.occupancy === 'Kosong' || periodSnapshot.duesStatus === 'Kosong' || isPeriodVacant) {
      if (periodSnapshot.duesStatus === 'Lunas' && (periodSnapshot.paidAmount || 0) > 0) {
        return {
          status: 'Lunas',
          amount: periodSnapshot.paidAmount || 0,
          isAdvanceSubsequentMonth: false,
          label: 'Lunas (Kosong)',
          badgeClass: 'bg-emerald-600 text-white border border-emerald-500 font-bold shadow-xs',
          paidDate: periodSnapshot.paidDate,
          note: 'Iuran Sukarela (Rumah Kosong)',
        };
      }
      return {
        status: 'Kosong',
        amount: 0,
        isAdvanceSubsequentMonth: false,
        label: 'Bebas Iuran',
        badgeClass: 'bg-black text-white border border-neutral-700 font-semibold',
        paidDate: undefined,
        note: 'Rumah Kosong (Tidak Wajib)',
      };
    }

    if (periodSnapshot.duesStatus === 'Belum Bayar') {
      const paidPart = periodSnapshot.paidAmount || 0;
      if (paidPart > 0) {
        return {
          status: 'Belum Bayar',
          amount: paidPart,
          isAdvanceSubsequentMonth: false,
          label: `Cicil ${formatRupiah(paidPart)}`,
          badgeClass: 'bg-rose-100 text-rose-800 border border-rose-300 font-bold',
          paidDate: periodSnapshot.paidDate,
          note: `Sisa ${formatRupiah(Math.max(0, snapNominal - paidPart))}`,
        };
      }

      if (periodSnapshot.settlementMonth) {
        return {
          status: 'Lunas',
          amount: 0,
          isAdvanceSubsequentMonth: false,
          label: `Lunas Bulan ${periodSnapshot.settlementMonth}`,
          badgeClass: 'bg-emerald-100 text-emerald-900 border border-emerald-300 font-bold shadow-xs',
          paidDate: periodSnapshot.paidDate,
          note: `Tunggakan dilunasi pada bulan ${periodSnapshot.settlementMonth}`,
          isArrearSettledLater: true,
          settlementMonth: periodSnapshot.settlementMonth,
        };
      }

      // Standar mutlak jika pembayaran dihapus / belum bayar: Status Belum Bayar & Pewarnaan Merah
      return {
        status: 'Belum Bayar',
        amount: 0,
        isAdvanceSubsequentMonth: false,
        label: 'Belum Bayar',
        badgeClass: 'bg-rose-100 text-rose-800 border border-rose-300 font-bold',
        paidDate: undefined,
        note: 'Belum Bayar',
      };
    }

    if (periodSnapshot.duesStatus === 'Lunas' || periodSnapshot.duesStatus === 'Bayar Lebih') {
      const isAdv = periodSnapshot.duesStatus === 'Bayar Lebih';
      const paidVal = periodSnapshot.paidAmount !== undefined ? periodSnapshot.paidAmount : snapNominal;
      const paidMonths = isAdv && periodSnapshot.paidAmount && snapNominal > 0 ? Math.max(2, Math.round(periodSnapshot.paidAmount / snapNominal)) : isAdv ? 2 : 1;
      const covered = getSubsequentMonthLabels(periodLabel, paidMonths);
      return {
        status: periodSnapshot.duesStatus,
        amount: paidVal,
        isAdvanceSubsequentMonth: false,
        label: isAdv ? `Bayar Lebih (${paidMonths} Bln)` : 'Lunas',
        badgeClass: isAdv
          ? 'bg-sky-600 text-white border border-sky-500 font-bold shadow-xs'
          : 'bg-emerald-600 text-white border border-emerald-500 font-bold shadow-xs',
        paidDate: periodSnapshot.paidDate,
        basePaymentMonth: periodLabel,
        paidMonthsCount: paidMonths,
        coveredMonths: covered,
        lastCoveredMonth: covered[covered.length - 1] || periodLabel,
      };
    }
  }

  // 3. Cek transaksi langsung di Buku Kas untuk rumah ini pada periode tersebut
  const matchingIuranTxs = transactions.filter((t) => {
    if (t.type !== 'masuk' || !isPureIuranTx(t) || !blockRegex.test(t.description)) return false;
    return getMonthKeyFromDate(t.date) === targetKey;
  });
  const sumIuranFromTxs = matchingIuranTxs.reduce((sum, t) => sum + t.amount, 0);

  if (sumIuranFromTxs > 0) {
    const effectiveNominal = nominal > 0 ? nominal : (config?.duesAmountPerMonth || 25000);
    const isAdvance = sumIuranFromTxs > effectiveNominal;
    const txPaidMonths = Math.max(1, Math.round(sumIuranFromTxs / effectiveNominal));
    const txCoveredMonths = isAdvance ? getSubsequentMonthLabels(periodLabel, txPaidMonths) : [periodLabel];
    return {
      status: isAdvance ? 'Bayar Lebih' : 'Lunas',
      amount: sumIuranFromTxs,
      isAdvanceSubsequentMonth: false,
      label: isAdvance ? `Bayar Lebih (${txPaidMonths} Bln)` : 'Lunas',
      badgeClass: isAdvance
        ? 'bg-sky-600 text-white border border-sky-500 font-bold shadow-xs'
        : 'bg-emerald-600 text-white border border-emerald-500 font-bold shadow-xs',
      paidDate: matchingIuranTxs[0].date,
      note: isAdvance
        ? `Tercakup: ${txCoveredMonths.join(', ')} (Total iuran ${formatRupiah(sumIuranFromTxs)} masuk di bulan ini)`
        : undefined,
      basePaymentMonth: periodLabel,
      paidMonthsCount: txPaidMonths,
      coveredMonths: txCoveredMonths,
      lastCoveredMonth: txCoveredMonths[txCoveredMonths.length - 1] || periodLabel,
    };
  }

  // 3a. Cek apakah ada transaksi Pembayaran Tunggakan untuk rumah ini pada periode bulan ini
  const matchingTunggakanTxs = transactions.filter((t) => {
    if (t.type !== 'masuk' || !isTunggakanTx(t)) return false;
    if (!isTransactionForHouse(t, house)) return false;
    return getMonthKeyFromDate(t.date) === targetKey;
  });
  const sumTunggakanFromTxs = matchingTunggakanTxs.reduce((sum, t) => sum + t.amount, 0);

  if (sumTunggakanFromTxs > 0 && sumIuranFromTxs === 0) {
    return {
      status: 'Lunas',
      amount: sumTunggakanFromTxs,
      isAdvanceSubsequentMonth: false,
      label: 'Lunas (Bayar Tunggakan)',
      badgeClass: 'bg-emerald-600 text-white border border-emerald-500 font-bold shadow-xs',
      paidDate: matchingTunggakanTxs[0].date,
      note: `Pelunasan tunggakan ${formatRupiah(sumTunggakanFromTxs)} di bulan ini`,
      basePaymentMonth: periodLabel,
    };
  }

  // 3b. Cek apakah periode ini merupakan bulan lanjutan dari pembayaran di muka (>1 bulan) dari bulan sebelumnya (< targetKey)
  const houseBasePeriod = house.duesMonthNote || defaultMonthLabel;
  const baseKey = parseIndonesianMonthYearToKey(houseBasePeriod);
  const isPaidState = house.duesStatus === 'Lunas' || house.duesStatus === 'Bayar Lebih';
  const paidMonths = house.duesPaidMonths || (house.duesStatus === 'Bayar Lebih' ? 2 : isPaidState ? 1 : 0);
  const coveredMonths = isPaidState
    ? getSubsequentMonthLabels(houseBasePeriod, Math.max(1, paidMonths))
    : [];

  const explicitNoteMonths = (house.duesMonthNote || '').split(/[,;/+]+/).map((s) => s.trim()).filter(Boolean);
  const isExplicitSubsequent =
    isPaidState &&
    explicitNoteMonths.length > 1 &&
    explicitNoteMonths
      .slice(1)
      .some(
        (m) =>
          m.toLowerCase() === periodLabel.toLowerCase() ||
          (targetKey && parseIndonesianMonthYearToKey(m) === targetKey)
      );

  const isCoveredByAdvance =
    isExplicitSubsequent ||
    (isPaidState &&
      (paidMonths > 1 || (house.duesMonthNote && isPeriodCoveredInDuesNote(house.duesMonthNote, periodLabel))) &&
      (
        (baseKey && targetKey > baseKey && coveredMonths.some((m) => parseIndonesianMonthYearToKey(m) === targetKey)) ||
        Boolean(house.duesMonthNote && isPeriodCoveredInDuesNote(house.duesMonthNote, periodLabel) && baseKey && targetKey > baseKey)
      ));

  // Cari juga di Buku Kas apakah ada transaksi advance di bulan sebelumnya yang mencakup bulan ini
  const priorAdvanceTx = transactions.find((t) => {
    if (t.type !== 'masuk' || !isPureIuranTx(t) || !blockRegex.test(t.description)) return false;
    const txMonthKey = getMonthKeyFromDate(t.date);
    if (!txMonthKey || txMonthKey >= targetKey) return false;
    const desc = t.description.toLowerCase();
    const monthParts = targetKey.split('-');
    const monthName = (INDONESIAN_MONTHS[parseInt(monthParts[1], 10) - 1] || '').toLowerCase();
    const matchMonths = desc.match(/(\d+)\s*bulan/i);
    const mCount = matchMonths ? parseInt(matchMonths[1], 10) : nominal > 0 ? Math.floor(t.amount / nominal) : 1;
    if (mCount > 1) {
      const cLabels = getSubsequentMonthLabels(formatMonthYearFromKey(txMonthKey), mCount);
      if (cLabels.some((l) => parseIndonesianMonthYearToKey(l) === targetKey)) return true;
    }
    return (
      desc.includes(monthName) ||
      desc.includes(targetKey) ||
      (desc.includes('lebih dari 1 bulan') && t.amount >= nominal * 2)
    );
  });

  // Cek riwayat periodHistory bulan sebelumnya yang bayar lebih
  let histAdvanceMonth: string | null = null;
  if (!isCoveredByAdvance && !priorAdvanceTx && house.periodHistory) {
    for (const [histPeriodKey, histVal] of Object.entries(house.periodHistory)) {
      const normKey = parseIndonesianMonthYearToKey(histPeriodKey) || histPeriodKey;
      if (
        normKey < targetKey &&
        (histVal.duesStatus === 'Bayar Lebih' ||
          (histVal.paidAmount && nominal > 0 && histVal.paidAmount >= nominal * 2))
      ) {
        const mCount =
          histVal.paidAmount && nominal > 0
            ? Math.max(2, Math.floor(histVal.paidAmount / (histVal.customDuesAmount || nominal)))
            : 2;
        const cLabels = getSubsequentMonthLabels(formatMonthYearFromKey(normKey), mCount);
        if (cLabels.some((l) => parseIndonesianMonthYearToKey(l) === targetKey)) {
          histAdvanceMonth = formatMonthYearFromKey(normKey);
          break;
        }
      }
    }
  }

  if (isCoveredByAdvance || Boolean(priorAdvanceTx) || Boolean(histAdvanceMonth)) {
    const originMonth = priorAdvanceTx
      ? formatMonthYearFromDate(priorAdvanceTx.date) || formatMonthYearFromKey(getMonthKeyFromDate(priorAdvanceTx.date))
      : histAdvanceMonth || houseBasePeriod;
    const effectivePriorNominal = nominal > 0 ? nominal : (config?.duesAmountPerMonth || 25000);
    const effectivePaidMonths = paidMonths > 1 ? paidMonths : priorAdvanceTx ? Math.max(1, Math.round(priorAdvanceTx.amount / effectivePriorNominal)) : 2;
    const effectiveCovered = coveredMonths.length > 0 ? coveredMonths : getSubsequentMonthLabels(originMonth, effectivePaidMonths);
    return {
      status: 'Lunas',
      amount: 0,
      isAdvanceSubsequentMonth: true,
      label: `Lunas Bulan ${originMonth}`,
      badgeClass: 'bg-emerald-100 text-emerald-900 border border-emerald-300 font-bold shadow-xs',
      paidDate: house.duesPaidDate || priorAdvanceTx?.date,
      note: `(Bayar >1 Bulan)`,
      basePaymentMonth: originMonth,
      paidMonthsCount: effectivePaidMonths,
      coveredMonths: effectiveCovered,
      lastCoveredMonth: effectiveCovered[effectiveCovered.length - 1] || originMonth,
    };
  }

  // 4. Jika periode cocok dengan inputan dasar rumah (base month) dan status Lunas / Bayar Lebih
  const isBaseMatch = (baseKey && targetKey === baseKey) || periodLabel === houseBasePeriod;
  if (isBaseMatch && isPaidState) {
    const isAdvance = paidMonths > 1 || house.duesStatus === 'Bayar Lebih';
    const totalDuesInBase = isAdvance ? nominal * paidMonths : nominal;
    return {
      status: isAdvance ? 'Bayar Lebih' : 'Lunas',
      amount: totalDuesInBase,
      isAdvanceSubsequentMonth: false,
      label: isAdvance ? `Bayar Lebih (${paidMonths} Bln)` : 'Lunas',
      badgeClass: isAdvance
        ? 'bg-sky-600 text-white border border-sky-500 font-bold shadow-xs'
        : 'bg-emerald-600 text-white border border-emerald-500 font-bold shadow-xs',
      paidDate: house.duesPaidDate,
      note: isAdvance
        ? `Tercakup: ${coveredMonths.join(', ')} (Total iuran ${formatRupiah(totalDuesInBase)} masuk di bulan ini)`
        : undefined,
      basePaymentMonth: houseBasePeriod,
      paidMonthsCount: paidMonths,
      coveredMonths: coveredMonths,
      lastCoveredMonth: coveredMonths[coveredMonths.length - 1] || houseBasePeriod,
    };
  }

  // 5. Belum Ditempati (jika belum membayar, tampilkan Belum Bayar)
  const periodOccupancy = getHouseOccupancyForPeriod(house, periodLabel, transactions);
  if (periodOccupancy === 'Belum Ditempati') {
    return {
      status: 'Belum Bayar',
      amount: 0,
      isAdvanceSubsequentMonth: false,
      label: 'Belum Bayar',
      badgeClass: 'bg-rose-100 text-rose-800 border border-rose-300 font-bold shadow-xs',
      paidDate: undefined,
      note: 'Rumah Belum Ditempati (Belum Bayar)',
    };
  }

  // 6. Bulan berjalan aktif jika periodLabel cocok
  if (periodLabel === defaultMonthLabel || targetKey === currentKey) {
    if (house.occupancy === 'Kosong' || house.duesStatus === 'Kosong' || isPeriodVacant) {
      return {
        status: 'Kosong',
        amount: 0,
        isAdvanceSubsequentMonth: false,
        label: 'Bebas Iuran',
        badgeClass: 'bg-black text-white border border-neutral-700 font-semibold',
        paidDate: undefined,
        note: 'Rumah Kosong (Tidak Wajib)',
      };
    }
    if (house.duesStatus === 'Lunas' || house.duesStatus === 'Bayar Lebih') {
      const isAdvance = house.duesStatus === 'Bayar Lebih';
      const advMonths = Math.max(2, house.duesPaidMonths || 2);
      const advCovered = getSubsequentMonthLabels(defaultMonthLabel, advMonths);
      return {
        status: house.duesStatus,
        amount: isAdvance ? nominal * advMonths : nominal,
        isAdvanceSubsequentMonth: false,
        label: isAdvance ? `Bayar Lebih (${advMonths} Bln)` : 'Lunas',
        badgeClass: isAdvance
          ? 'bg-sky-600 text-white border border-sky-500 font-bold shadow-xs'
          : 'bg-emerald-100 text-emerald-800 border border-emerald-200 font-bold',
        paidDate: house.duesPaidDate,
        note: isAdvance
          ? `Tercakup: ${advCovered.join(', ')} (Total iuran ${formatRupiah(nominal * advMonths)} masuk di bulan ini)`
          : undefined,
        basePaymentMonth: defaultMonthLabel,
        paidMonthsCount: advMonths,
        coveredMonths: advCovered,
        lastCoveredMonth: advCovered[advCovered.length - 1] || defaultMonthLabel,
      };
    }
    const settlement = findArrearSettlementForPeriod(house, targetKey, periodLabel, transactions);
    if (settlement) {
      return {
        status: 'Lunas',
        amount: 0,
        isAdvanceSubsequentMonth: false,
        label: `Lunas Bulan ${settlement.settlementMonth}`,
        badgeClass: 'bg-emerald-100 text-emerald-900 border border-emerald-300 font-bold shadow-xs',
        paidDate: settlement.paidDate,
        note: `Tunggakan dilunasi pada bulan ${settlement.settlementMonth}`,
        isArrearSettledLater: true,
        settlementMonth: settlement.settlementMonth,
      };
    }

    const paidPart = house.duesPaidAmount || 0;
    return {
      status: 'Belum Bayar',
      amount: paidPart,
      isAdvanceSubsequentMonth: false,
      label: paidPart > 0 ? `Cicil ${formatRupiah(paidPart)}` : 'Belum Bayar',
      badgeClass: 'bg-rose-100 text-rose-800 border border-rose-200 font-bold',
      note: paidPart > 0 ? `Sisa ${formatRupiah(Math.max(0, nominal - paidPart))}` : 'Belum Bayar',
    };
  }

  // 7. Bulan lampau (targetKey < currentKey)
  if (targetKey < currentKey) {
    const settlement = findArrearSettlementForPeriod(house, targetKey, periodLabel, transactions);
    if (settlement) {
      return {
        status: 'Lunas',
        amount: 0,
        isAdvanceSubsequentMonth: false,
        label: `Lunas Bulan ${settlement.settlementMonth}`,
        badgeClass: 'bg-emerald-100 text-emerald-900 border border-emerald-300 font-bold shadow-xs',
        paidDate: settlement.paidDate,
        note: `Tunggakan dilunasi pada bulan ${settlement.settlementMonth}`,
        isArrearSettledLater: true,
        settlementMonth: settlement.settlementMonth,
      };
    }

    return {
      status: 'Belum Bayar',
      amount: 0,
      isAdvanceSubsequentMonth: false,
      label: 'Tertunggak',
      badgeClass: 'bg-rose-100 text-rose-800 border border-rose-300 font-bold',
      note: house.previousArrearsNote || 'Tertunggak',
    };
  }

  // 8. Bulan masa depan
  return {
    status: 'Belum Bayar',
    amount: 0,
    isAdvanceSubsequentMonth: false,
    label: 'Belum Masuk Periode',
    badgeClass: 'bg-slate-100 text-slate-500 border border-slate-200',
  };
}

export function getHouseBaksosForPeriod(
  house: ResidentHouse,
  periodLabel: string,
  baksosAgendas: BaksosAgenda[] = [],
  transactions: CashTransaction[] = [],
  residents: ResidentHouse[] = []
): HousePeriodBaksosInfo {
  const isPureKosong = house.occupancy === 'Kosong' || isHouseVacant(house);
  const isUnoccupied = house.occupancy === 'Belum Ditempati';
  const isContract = house.ownership === 'Kontrak' || house.occupancy === 'Dikontrakan';
  const targetKey = periodLabel !== 'semua' ? parseIndonesianMonthYearToKey(periodLabel) : null;
  const pMonthName = (periodLabel || '').split(' ')[0]?.toLowerCase();

  const agendas = baksosAgendas || [];

  // Filter agendas matching this period
  const matchingAgendas = agendas.filter((agenda) => {
    if (!targetKey) return true;
    const agendaKey = getMonthKeyFromDate(agenda.date);
    if (agendaKey && agendaKey === targetKey) return true;
    if (pMonthName && pMonthName.length > 2) {
      const titleDesc = `${agenda.title || ''} ${agenda.description || ''} ${agenda.date || ''}`.toLowerCase();
      if (titleDesc.includes(pMonthName)) return true;
    }
    return false;
  });

  // Matching baksos fine payment transactions in Kas Utama
  const blockRegex = new RegExp(`\\b${house.blockNumber.replace('/', '\\/')}\\b`, 'i');
  const baksosTxs = transactions.filter((t) => {
    if (t.type !== 'masuk') return false;
    const cat = t.category || '';
    const desc = (t.description || '').toLowerCase();
    const isBaksos = cat === 'Denda Baksos' || desc.includes('denda');
    if (!isBaksos) return false;
    if (!isTransactionForHouse(t, house)) return false;
    if (targetKey) {
      const tKey = getMonthKeyFromDate(t.date);
      const descMatchesMonth = pMonthName && desc.includes(pMonthName);
      return tKey === targetKey || descMatchesMonth;
    }
    return true;
  });
  const txPaidAmount = baksosTxs.reduce((sum, t) => sum + t.amount, 0);

  // Paid baksos agendas
  const paidAgendas = matchingAgendas.filter((agenda) => {
    const isPaid = isBaksosFinePaidForHouse(agenda, house, residents);
    const att = getBaksosAttendanceForHouse(agenda, house, residents);
    return isPaid || (att === 'Tidak Hadir' && isPaid);
  });
  const agendaPaidAmount = paidAgendas.reduce((sum, a) => sum + (a.fineAmount || 10000), 0);

  // Total denda baksos paid
  const dendaPaid = isPureKosong || isUnoccupied ? 0 : Math.max(txPaidAmount, agendaPaidAmount);

  // Unpaid baksos agendas
  const unpaidAgendas = matchingAgendas.filter((agenda) => {
    const isPaid = isBaksosFinePaidForHouse(agenda, house, residents);
    if (isPaid) return false;
    const att = getBaksosAttendanceForHouse(agenda, house, residents);
    if (att) {
      return att === 'Tidak Hadir';
    }
    if (house.occupancy === 'Kosong' || isPureKosong || isUnoccupied) return false;
    if (isContract) return false;
    return false;
  });
  const calculatedUnpaid = isPureKosong || isUnoccupied ? 0 : unpaidAgendas.reduce((sum, a) => sum + (a.fineAmount || 10000), 0);
  const dendaUnpaid =
    targetKey === null && house.customBaksosFineAmount !== undefined
      ? house.customBaksosFineAmount
      : calculatedUnpaid;

  const hadHadir = matchingAgendas.some((a) => {
    const att = getBaksosAttendanceForHouse(a, house, residents);
    return att === 'Hadir';
  });
  const hadTidakWajib =
    (matchingAgendas.length > 0 && isContract) ||
    matchingAgendas.some((a) => {
      const att = getBaksosAttendanceForHouse(a, house, residents);
      return att === 'Tidak Wajib';
    });

  return {
    matchingAgendasCount: matchingAgendas.length,
    dendaPaid,
    dendaUnpaid,
    hadHadir,
    hadTidakWajib,
    isPureKosong: isPureKosong || isUnoccupied,
    paidAgendas,
    unpaidAgendas,
  };
}

export interface OverallKKRecapPeriodDetail {
  periodLabel: string;
  pKey: string;
  statusInfo?: HousePeriodStatusInfo;
  periodHeadName: string;
  isPeriodVacant: boolean;
  iuranPaid: number;
  dendaPaid: number;
  tunggakanPaid: number;
  periodTotal: number;
  isLunasThisPeriod: boolean;
  isArrearSettledLater: boolean;
  settlementMonth: string | null;
  isAdvanceSubsequent: boolean;
  advancePaymentMonth?: string | null;
  statusBadge: string;
  badgeClass: string;
  paidDate?: string;
  unpaidAmount: number;
  baksosAgendaTitle?: string;
  baksosAttendance?: BaksosAttendanceStatus | null;
  baksosFineUnpaid?: number;
  tunggakanDetailNote?: string;
  tunggakanPaidMonths?: string[];
  baksosStatusLabel?: string;
}

export interface OverallKKRecapItem {
  house: ResidentHouse;
  idx: number;
  isPureKosong: boolean;
  isUnoccupied: boolean;
  isRumahKosongHitam: boolean;
  nominalPerMonth: number;
  payerName: string;
  periodsDetail: OverallKKRecapPeriodDetail[];
  totalIuranAllPeriods: number;
  totalDendaAllPeriods: number;
  totalTunggakanAllPeriods: number;
  grandTotalAllPeriods: number;
  totalPeriodsCount: number;
  totalPeriodsPaidCount: number;
  unpaidPeriodsCount: number;
  currentMonthDuesArrears: number;
  previousDuesArrears: number;
  previousArrearsNote: string;
  unpaidPastPeriods: string[];
  unpaidPeriods: string[];
  unpaidBaksosList: BaksosAgenda[];
  baksosFineArrears: number;
  baksosFineAmount: number;
  remainingArrearsTotal: number;
  overallStatus: 'Lunas Semua' | 'Bayar Lebih' | 'Ada Tunggakan' | 'Kosong';
  overallBadgeClass: string;
  rowCellClass: string;
}

export function computeOverallKKRecapList(
  residents: ResidentHouse[],
  config: SiteConfig,
  transactions: CashTransaction[],
  baksosAgendas: BaksosAgenda[] = [],
  customPeriods?: string[]
): {
  sortedPeriods: string[];
  recapList: OverallKKRecapItem[];
  totalAllArrears: number;
  housesWithArrearsCount: number;
} {
  const currentActiveMonth = config.duesCurrentMonth || 'September 2026';
  const currentActiveKey = parseIndonesianMonthYearToKey(currentActiveMonth) || '2026-09';

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

  const baksosMonths = (baksosAgendas || [])
    .map((a) => {
      const mKey = getMonthKeyFromDate(a.date);
      return formatMonthYearFromKey(mKey);
    })
    .filter((label): label is string => Boolean(label));

  const combined = Array.from(
    new Set(customPeriods || [currentActiveMonth, ...rawList, ...txMonths, ...baksosMonths])
  ).filter(Boolean);

  const sortedPeriods = combined
    .filter((p) => {
      const key = parseIndonesianMonthYearToKey(p);
      if (!key) return false;
      const isExplicitPeriod =
        (config.duesAvailablePeriods || []).includes(p) ||
        Boolean(customPeriods && customPeriods.includes(p));
      const hasRealData = txMonths.includes(p) || baksosMonths.includes(p) || isExplicitPeriod;
      if (key > currentActiveKey && !hasRealData) return false;
      if (key === '2026-04') return false;
      const pLower = p.toLowerCase().trim();
      if (pLower === 'april 2026' || pLower === 'april') return false;
      return true;
    })
    .sort((a, b) => {
      const keyA = parseIndonesianMonthYearToKey(a) || '';
      const keyB = parseIndonesianMonthYearToKey(b) || '';
      return keyA.localeCompare(keyB);
    });

  let totalAllArrears = 0;
  let housesWithArrearsCount = 0;

  const recapList: OverallKKRecapItem[] = residents.map((house, idx) => {
    const occStr = (house.occupancy as string) || '';
    const isUnoccupied = occStr === 'Belum Ditempati' || occStr === 'Belum Diisi';
    const occNow = getHouseOccupancyForPeriod(house, currentActiveMonth, transactions) || house.occupancy;
    const isPureKosong =
      !isUnoccupied &&
      (occNow === 'Kosong' ||
        (house.occupancy === 'Kosong' && isHouseVacant(house)));
    const isRumahKosongHitam = isPureKosong;

    const defaultNominal =
      house.customDuesAmount !== undefined
        ? house.customDuesAmount
        : config.duesAmountPerMonth || 25000;
    const nominalPerMonth = isPureKosong ? 0 : defaultNominal;

    const currentMonthHeadName = getHouseHeadNameForPeriod(house, currentActiveMonth, transactions);
    const payerName = isPureKosong
      ? currentMonthHeadName && currentMonthHeadName !== 'Rumah Kosong'
        ? currentMonthHeadName
        : 'Rumah Kosong'
      : isUnoccupied
      ? currentMonthHeadName || 'Belum Ditempati'
      : currentMonthHeadName || house.duesHeadNameOverride || house.headName || '';

    const blockRegex = new RegExp(`\\b${house.blockNumber.replace('/', '\\/')}\\b`, 'i');

    let totalIuranAllPeriods = 0;
    let totalDendaAllPeriods = 0;
    let totalTunggakanAllPeriods = 0;

    const periodsDetail: OverallKKRecapPeriodDetail[] = sortedPeriods.map((periodLabel) => {
      const pKey = parseIndonesianMonthYearToKey(periodLabel) || '';
      const statusInfo = getHouseStatusForPeriod(house, periodLabel, config, transactions, residents, currentActiveMonth);
      const baksosInfo = getHouseBaksosForPeriod(house, periodLabel, baksosAgendas, transactions, residents);

      const isPeriodVacant = isHouseVacantInPeriod(house, periodLabel, transactions);
      const periodHeadName = isPeriodVacant
        ? 'Rumah Kosong'
        : getHouseHeadNameForPeriod(house, periodLabel, transactions) || (isUnoccupied ? 'Belum Ditempati' : house.headName || '-');
      const periodNominal = isPeriodVacant ? 0 : getHouseDuesNominalForPeriod(house, periodLabel, config, transactions);

      // Exact Iuran Paid for this cell - 100% consistent with monthly Rekap Iuran Per KK
      const iuranPaid = isPeriodVacant
        ? (statusInfo.status === 'Lunas' ? (statusInfo.amount || 0) : 0)
        : statusInfo.isAdvanceSubsequentMonth
        ? 0
        : statusInfo.status === 'Lunas' || statusInfo.status === 'Bayar Lebih'
        ? (statusInfo.amount !== undefined ? statusInfo.amount : periodNominal)
        : (statusInfo.amount || 0);

      // Denda Baksos Paid for this cell
      const dendaPaid = isPeriodVacant || isUnoccupied ? 0 : baksosInfo.dendaPaid;

      // Tunggakan Paid for this cell
      const tunggakanTxs = transactions.filter((t) => {
        if (t.type !== 'masuk' || !isTunggakanTx(t)) return false;
        if (!isTransactionForHouse(t, house)) return false;
        return getMonthKeyFromDate(t.date) === pKey;
      });
      const tunggakanPaid = isPeriodVacant ? 0 : tunggakanTxs.reduce((s, t) => s + t.amount, 0);

      // Extract detail bulan-bulan tunggakan yang dilunasi pada periode ini
      const settledMonthsFromNotes: string[] = [];
      tunggakanTxs.forEach((t) => {
        const desc = t.description || '';
        const monthRegex = /(Januari|Februari|Maret|April|Mei|Juni|Juli|Agustus|September|Oktober|November|Desember)(?:\s+\d{4})?/gi;
        const matches = desc.match(monthRegex);
        if (matches) {
          matches.forEach((m) => {
            const cleanM = m.trim();
            if (!settledMonthsFromNotes.some((x) => x.toLowerCase() === cleanM.toLowerCase())) {
              settledMonthsFromNotes.push(cleanM);
            }
          });
        }
      });

      // Cari periode-periode sebelum periode ini yang statusnya dilunasi pada periode ini (settlementMonth === periodLabel)
      sortedPeriods.forEach((priorPeriod) => {
        const priorKey = parseIndonesianMonthYearToKey(priorPeriod) || '';
        if (priorKey < pKey) {
          const priorStatus = getHouseStatusForPeriod(house, priorPeriod, config, transactions, residents, currentActiveMonth);
          if (priorStatus.isArrearSettledLater && priorStatus.settlementMonth === periodLabel) {
            if (!settledMonthsFromNotes.some((x) => x.toLowerCase() === priorPeriod.toLowerCase())) {
              settledMonthsFromNotes.push(priorPeriod);
            }
          }
        }
      });

      if (tunggakanPaid > 0 && settledMonthsFromNotes.length === 0 && house.previousArrearsNote) {
        const matches = house.previousArrearsNote.match(/(Januari|Februari|Maret|April|Mei|Juni|Juli|Agustus|September|Oktober|November|Desember)(?:\s+\d{4})?/gi);
        if (matches) {
          matches.forEach((m) => {
            const cleanM = m.trim();
            if (!settledMonthsFromNotes.some((x) => x.toLowerCase() === cleanM.toLowerCase())) {
              settledMonthsFromNotes.push(cleanM);
            }
          });
        }
      }

      const tunggakanDetailNote =
        settledMonthsFromNotes.length > 0
          ? settledMonthsFromNotes.join(', ')
          : tunggakanPaid > 0
          ? 'Bulan Lalu'
          : '';

      const periodTotal = iuranPaid + dendaPaid + tunggakanPaid;

      totalIuranAllPeriods += iuranPaid;
      totalDendaAllPeriods += dendaPaid;
      totalTunggakanAllPeriods += tunggakanPaid;

      const isAdvanceSubsequent = Boolean(statusInfo.isAdvanceSubsequentMonth);
      const isArrearSettledLater = Boolean(statusInfo.isArrearSettledLater);
      const settlementMonth = statusInfo.settlementMonth || null;
      const advancePaymentMonth = statusInfo.basePaymentMonth || null;

      const hasTunggakanPaidThisPeriod = tunggakanPaid > 0;

      const isLunasThisPeriod =
        isPeriodVacant
          ? true
          : statusInfo.status === 'Lunas' ||
            statusInfo.status === 'Bayar Lebih' ||
            isAdvanceSubsequent ||
            isArrearSettledLater ||
            hasTunggakanPaidThisPeriod ||
            (iuranPaid >= periodNominal && periodNominal > 0);

      const unpaidAmount =
        isPeriodVacant || isLunasThisPeriod
          ? 0
          : Math.max(0, periodNominal - (iuranPaid + tunggakanPaid));

      const statusBadge =
        isPeriodVacant
          ? iuranPaid > 0
            ? 'Lunas (Kosong)'
            : 'Bebas Iuran'
          : isAdvanceSubsequent
          ? statusInfo.label || (advancePaymentMonth ? `Lunas Bulan ${advancePaymentMonth}` : 'Lunas (Dimuka)')
          : statusInfo.status === 'Bayar Lebih'
          ? statusInfo.label || 'Bayar Lebih'
          : isArrearSettledLater && settlementMonth
          ? statusInfo.label || `Lunas Bulan ${settlementMonth}`
          : hasTunggakanPaidThisPeriod && iuranPaid === 0
          ? 'Lunas (Bayar Tunggakan)'
          : statusInfo.status === 'Lunas' || (iuranPaid >= periodNominal && periodNominal > 0)
          ? 'Lunas'
          : statusInfo.label || 'Belum Bayar';

      const badgeClass =
        isPeriodVacant
          ? 'bg-neutral-900 text-neutral-300 border-neutral-700'
          : isAdvanceSubsequent || isArrearSettledLater || isLunasThisPeriod
          ? statusInfo.status === 'Bayar Lebih'
            ? 'bg-sky-100 text-sky-950 border-sky-400 font-bold'
            : 'bg-emerald-100 text-emerald-900 border-emerald-300 font-bold'
          : 'bg-rose-100 text-rose-900 border-rose-300 font-bold';

      const paidDate =
        statusInfo.paidDate ||
        (tunggakanPaid > 0 && tunggakanTxs.length > 0 ? tunggakanTxs[0].date : house.duesPaidDate);

      const agendaTitle = baksosInfo.paidAgendas[0]?.title || baksosInfo.unpaidAgendas[0]?.title;
      const baksosAtt = baksosInfo.hadHadir ? 'Hadir' : baksosInfo.hadTidakWajib ? 'Tidak Wajib' : baksosInfo.dendaUnpaid > 0 ? 'Tidak Hadir' : null;
      const finePaid = baksosInfo.dendaPaid > 0 || (baksosInfo.matchingAgendasCount > 0 && baksosInfo.dendaUnpaid === 0 && !baksosInfo.hadTidakWajib && baksosInfo.hadHadir);

      let baksosStatusLabel = '';
      if (dendaPaid > 0) {
        baksosStatusLabel = `Denda Lunas (${formatRupiah(dendaPaid)})`;
      } else if (baksosInfo.dendaUnpaid > 0) {
        baksosStatusLabel = `Denda ${formatRupiah(baksosInfo.dendaUnpaid)} Belum Bayar`;
      } else if (baksosInfo.hadHadir) {
        baksosStatusLabel = 'Hadir (Bebas Denda)';
      } else if (baksosInfo.hadTidakWajib) {
        baksosStatusLabel = 'Tidak Wajib Baksos';
      }

      return {
        periodLabel,
        pKey,
        statusInfo,
        periodHeadName,
        isPeriodVacant,
        iuranPaid,
        dendaPaid,
        tunggakanPaid,
        tunggakanDetailNote,
        tunggakanPaidMonths: settledMonthsFromNotes,
        periodTotal,
        isLunasThisPeriod,
        isArrearSettledLater,
        settlementMonth,
        isAdvanceSubsequent,
        advancePaymentMonth,
        statusBadge,
        badgeClass,
        paidDate,
        unpaidAmount,
        baksosAgendaTitle: agendaTitle,
        baksosAttendance: baksosAtt,
        isBaksosFinePaid: finePaid,
        baksosFineUnpaid: isPeriodVacant ? 0 : baksosInfo.dendaUnpaid,
        baksosStatusLabel,
      };
    });

    const totalPeriodsCount = sortedPeriods.length;
    let totalPeriodsPaidCount = 0;
    let unpaidPeriodsCount = 0;

    periodsDetail.forEach((p) => {
      if (!isPureKosong && !p.isPeriodVacant) {
        if (p.isLunasThisPeriod) {
          totalPeriodsPaidCount++;
        } else {
          unpaidPeriodsCount++;
        }
      }
    });

    const grandTotalAllPeriods = totalIuranAllPeriods + totalDendaAllPeriods + totalTunggakanAllPeriods;

    // Sisa Tunggakan Dihitung Akurat Berdasarkan Data Bulan Sebelumnya & Bulan Ini
    const curP = periodsDetail.find((p) => p.periodLabel === currentActiveMonth);
    const currentMonthDuesArrears = isPureKosong ? 0 : curP ? curP.unpaidAmount : 0;

    // Tunggakan bulan-bulan sebelumnya (sebelum currentActiveMonth) yang belum lunas
    const pastUnpaidPeriods = periodsDetail.filter(
      (p) => !p.isLunasThisPeriod && p.pKey < currentActiveKey && !p.isPeriodVacant
    );
    const unpaidPastFromPeriods = isPureKosong
      ? 0
      : pastUnpaidPeriods.reduce((sum, p) => sum + p.unpaidAmount, 0);
    const unpaidPastPeriodNames = pastUnpaidPeriods.map((p) => p.periodLabel);

    // Amankan sisa tunggakan masa lalu lama dari luar rentang sortedPeriods jika ada
    const extraPriorArrears = isPureKosong
      ? 0
      : Math.max(0, (house.previousArrears || 0) - unpaidPastFromPeriods);
    const previousDuesArrears = unpaidPastFromPeriods + extraPriorArrears;

    let previousArrearsNote = '';
    if (unpaidPastPeriodNames.length > 0) {
      previousArrearsNote = `Iuran ${unpaidPastPeriodNames.join(', ')}`;
      if (
        house.previousArrearsNote &&
        !house.previousArrearsNote.toLowerCase().includes(unpaidPastPeriodNames[0].toLowerCase())
      ) {
        previousArrearsNote += ` (${house.previousArrearsNote})`;
      }
    } else if (house.previousArrearsNote) {
      previousArrearsNote = house.previousArrearsNote;
    }

    // Tunggakan Denda Baksos
    const isContract = house.ownership === 'Kontrak' || house.occupancy === 'Dikontrakan';
    const unpaidBaksosList = baksosAgendas.filter((agenda) => {
      const attendance =
        agenda.attendance?.[house.id] ||
        (house.occupancy === 'Kosong' ? 'Kosong' : isContract ? 'Tidak Wajib' : 'Hadir');
      const isFinePaid = agenda.finesPaid?.[house.id];
      return attendance === 'Tidak Hadir' && !isFinePaid;
    });

    const baksosFineArrears = isPureKosong
      ? 0
      : house.customBaksosFineAmount !== undefined
      ? house.customBaksosFineAmount
      : periodsDetail.reduce((sum, p) => sum + (p.baksosFineUnpaid || 0), 0);

    // Yang dimaksud tunggakan di Tabel Rekapitulasi Keseluruhan Kas Per Kepala Keluarga
    // adalah iuran belum bayar di bulan-bulan sebelumnya. Denda baksos dianggap denda baksos saja bukan tunggakan.
    const remainingArrearsTotal = isPureKosong ? 0 : previousDuesArrears;

    const unpaidPeriods = periodsDetail
      .filter((p) => !p.isLunasThisPeriod && !p.isPeriodVacant)
      .map((p) => p.periodLabel);

    if (remainingArrearsTotal > 0) {
      totalAllArrears += remainingArrearsTotal;
      housesWithArrearsCount += 1;
    }

    let overallStatus: 'Lunas Semua' | 'Bayar Lebih' | 'Ada Tunggakan' | 'Kosong';
    let overallBadgeClass = '';

    if (isPureKosong) {
      overallStatus = 'Kosong';
      overallBadgeClass = 'bg-black text-white border-neutral-700';
    } else if (remainingArrearsTotal > 0) {
      // Ada tunggakan iuran dari bulan-bulan sebelumnya
      overallStatus = 'Ada Tunggakan';
      overallBadgeClass = 'bg-rose-100 text-rose-950 border border-rose-300 font-bold';
    } else if (
      house.duesStatus === 'Bayar Lebih' ||
      (house.duesPaidMonths || 0) > 1 ||
      periodsDetail.some((p) => p.statusInfo?.status === 'Bayar Lebih' || p.isAdvanceSubsequent)
    ) {
      overallStatus = 'Bayar Lebih';
      overallBadgeClass = 'bg-sky-100 text-sky-950 border border-sky-300 font-bold';
    } else {
      overallStatus = 'Lunas Semua';
      overallBadgeClass = 'bg-emerald-100 text-emerald-950 border border-emerald-300 font-bold';
    }

    const rowCellClass = isRumahKosongHitam
      ? 'bg-neutral-950 text-neutral-200 border-neutral-800 hover:bg-neutral-900/95'
      : overallStatus === 'Bayar Lebih'
      ? 'bg-sky-50 text-sky-950 border-sky-300 hover:bg-sky-100/60'
      : overallStatus === 'Lunas Semua'
      ? 'bg-emerald-50 text-emerald-950 border-emerald-300 hover:bg-emerald-100/60'
      : 'bg-rose-50 text-rose-950 border-rose-300 hover:bg-rose-100/60';

    return {
      house,
      idx,
      isPureKosong,
      isUnoccupied,
      isRumahKosongHitam,
      nominalPerMonth,
      payerName,
      periodsDetail,
      totalIuranAllPeriods,
      totalDendaAllPeriods,
      totalTunggakanAllPeriods,
      grandTotalAllPeriods,
      totalPeriodsCount,
      totalPeriodsPaidCount,
      unpaidPeriodsCount,
      currentMonthDuesArrears,
      previousDuesArrears,
      previousArrearsNote,
      unpaidPastPeriods: unpaidPastPeriodNames,
      unpaidPeriods,
      unpaidBaksosList,
      baksosFineArrears,
      baksosFineAmount: baksosFineArrears,
      remainingArrearsTotal,
      overallStatus,
      overallBadgeClass,
      rowCellClass,
    };
  });

  return {
    sortedPeriods,
    recapList,
    totalAllArrears,
    housesWithArrearsCount,
  };
}

