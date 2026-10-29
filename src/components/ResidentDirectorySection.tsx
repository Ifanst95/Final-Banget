import React, { useState } from 'react';
import {
  ChevronDown,
  ChevronUp,
  Download,
  Edit2,
  FileSpreadsheet,
  LayoutGrid,
  Plus,
  Search,
  Share2,
  Table,
  Trash2,
  Upload,
  User,
  UserPlus,
  Users,
  X,
} from 'lucide-react';
import {
  DuesStatus,
  FamilyMember,
  FamilyRole,
  Gender,
  OccupancyStatus,
  OwnershipStatus,
  Religion,
  ResidentHouse,
  RukemStatus,
  SiteConfig,
  WifiStatus,
} from '../types';
import {
  calculateAge,
  downloadExcelTemplate,
  exportResidentsToExcel,
  formatDateDDMMYYYY,
  formatRupiah,
  isHouseUnfilled,
  isHouseVacant,
  openWhatsAppShare,
} from '../utils/helpers';
import { ExcelUploadModal } from './ExcelUploadModal';

interface ResidentDirectorySectionProps {
  config?: SiteConfig;
  residents: ResidentHouse[];
  isAdmin: boolean;
  onAddResident: (house: ResidentHouse) => void;
  onUpdateResident: (house: ResidentHouse) => void;
  onDeleteResident: (id: string) => void;
  onImportResidents?: (houses: ResidentHouse[], mode: 'replace' | 'merge') => void;
  onOpenConfigModal?: () => void;
}

export const ResidentDirectorySection: React.FC<ResidentDirectorySectionProps> = ({
  config,
  residents,
  isAdmin,
  onAddResident,
  onUpdateResident,
  onDeleteResident,
  onImportResidents,
  onOpenConfigModal,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [filterOwnership, setFilterOwnership] = useState<string>('semua');
  const [filterRukem, setFilterRukem] = useState<string>('semua');
  const [filterWifi, setFilterWifi] = useState<string>('semua');
  const [viewMode, setViewMode] = useState<'excel' | 'card'>('excel');
  const [expandedHouseIds, setExpandedHouseIds] = useState<Record<string, boolean>>({});
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  // Modal states for Add/Edit & Excel Upload
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [editingHouse, setEditingHouse] = useState<ResidentHouse | null>(null);

  // Form states matching exact Excel columns
  const [formBlock, setFormBlock] = useState('K2/25');
  const [formHeadName, setFormHeadName] = useState('');
  const [formPhone, setFormPhone] = useState('');
  const [formOwnership, setFormOwnership] = useState<OwnershipStatus>('Milik Sendiri');
  const [formOccupancy, setFormOccupancy] = useState<OccupancyStatus>('Ditempati');
  const [formRukem, setFormRukem] = useState<RukemStatus>('Ikut Rukem');
  const [formWifiStatus, setFormWifiStatus] = useState<WifiStatus>('Pasang');
  const [formWifiProvider, setFormWifiProvider] = useState('Indihome');
  const [formDuesStatus, setFormDuesStatus] = useState<DuesStatus>('Lunas');
  const [formPrevArrears, setFormPrevArrears] = useState<number>(0);
  const [formMembers, setFormMembers] = useState<FamilyMember[]>([]);

  const toggleExpand = (id: string) => {
    setExpandedHouseIds((prev) => ({ ...prev, [id]: !(prev[id] ?? false) }));
  };

  const handleExpandAll = (expand: boolean) => {
    const next: Record<string, boolean> = {};
    residents.forEach((h) => {
      next[h.id] = expand;
    });
    setExpandedHouseIds(next);
  };

  const handleOpenAdd = () => {
    setEditingHouse(null);
    setFormBlock('K2/31');
    setFormHeadName('');
    setFormPhone('');
    setFormOwnership('Milik Sendiri');
    setFormOccupancy('Ditempati');
    setFormRukem('Ikut Rukem');
    setFormWifiStatus('Pasang');
    setFormWifiProvider('Indihome');
    setFormDuesStatus('Lunas');
    setFormPrevArrears(0);
    setFormMembers([
      {
        id: 'm-' + Date.now(),
        name: '',
        relation: 'Kepala Keluarga',
        birthPlace: 'Jakarta',
        birthDate: '1985-01-01',
        gender: 'Laki-laki',
        religion: 'Islam',
      },
    ]);
    setIsModalOpen(true);
  };

  const handleOpenEdit = (house: ResidentHouse) => {
    setEditingHouse(house);
    setFormBlock(house.blockNumber);
    setFormHeadName(house.headName);
    setFormPhone(house.phone);
    setFormOwnership(house.ownership);
    setFormOccupancy(house.occupancy);
    setFormRukem(house.rukem);
    setFormWifiStatus(house.wifiStatus);
    setFormWifiProvider(house.wifiProvider || '-');
    setFormDuesStatus(house.duesStatus || 'Lunas');
    setFormPrevArrears(house.previousArrears || 0);
    setFormMembers(house.members ? [...house.members] : []);
    setIsModalOpen(true);
  };

  const handleAddMemberToForm = () => {
    setFormMembers([
      ...formMembers,
      {
        id: 'm-' + Date.now() + Math.random().toString(36).substring(2, 5),
        name: '',
        relation: 'Anak',
        birthPlace: 'Jakarta',
        birthDate: '2010-01-01',
        gender: 'Laki-laki',
        religion: 'Islam',
      },
    ]);
  };

  const handleRemoveMemberFromForm = (index: number) => {
    setFormMembers(formMembers.filter((_, idx) => idx !== index));
  };

  const handleMemberChange = (index: number, field: keyof FamilyMember, val: any) => {
    const updated = [...formMembers];
    updated[index] = { ...updated[index], [field]: val };
    setFormMembers(updated);
  };

  const handleSaveHouse = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formBlock.trim() || !formHeadName.trim()) return;

    const headInMembers = formMembers.find((m) => m.relation === 'Kepala Keluarga');
    const finalHeadName = headInMembers?.name?.trim() || formHeadName.trim();

    const housePayload: ResidentHouse = {
      id: editingHouse ? editingHouse.id : 'warga-' + Date.now(),
      blockNumber: formBlock.trim(),
      headName: finalHeadName,
      phone: formPhone.trim(),
      ownership: formOwnership,
      occupancy: formOccupancy,
      rukem: formRukem,
      wifiStatus: formWifiStatus,
      wifiProvider: formWifiStatus === 'Pasang' ? formWifiProvider : '-',
      duesStatus: editingHouse ? editingHouse.duesStatus : formDuesStatus,
      customDuesAmount: editingHouse?.customDuesAmount,
      duesPaidAmount: editingHouse?.duesPaidAmount,
      duesPaidMonths: editingHouse?.duesPaidMonths,
      duesPrepaidBalance: editingHouse?.duesPrepaidBalance,
      duesPaidDate: editingHouse?.duesPaidDate,
      duesMonthNote: editingHouse?.duesMonthNote,
      previousArrears: editingHouse ? editingHouse.previousArrears : Number(formPrevArrears) || 0,
      previousArrearsNote: editingHouse?.previousArrearsNote,
      members: formMembers,
    };

    if (editingHouse) {
      onUpdateResident(housePayload);
    } else {
      onAddResident(housePayload);
    }
    setIsModalOpen(false);
  };

  const handleExportExcel = () => {
    exportResidentsToExcel(residents);
  };

  const handleShareDirectoryWA = () => {
    let text =
      `🏘️ *DATA WARGA GANG MANDOR BLOK K2/25 - K3/24*\n` +
      `Total Rumah: ${residents.length} | Total Terdata: ${residents.flatMap((h) => h.members).length} Jiwa\n\n`;

    residents.forEach((h) => {
      text +=
        `🏠 *Blok ${h.blockNumber}* - Bpk/Ibu ${h.headName}\n` +
        `• Jumlah Anggota: ${h.members?.length || 0} Jiwa\n` +
        `• Status Rumah: ${h.ownership} (${h.occupancy})\n` +
        `• Rukem: ${h.rukem} | WiFi: ${h.wifiStatus === 'Pasang' ? `Pasang (${h.wifiProvider})` : 'Tidak Pasang'}\n` +
        `• No HP: ${h.phone || '-'}\n\n`;
    });

    text += `_Data resmi portal kependudukan Gang Mandor._`;
    openWhatsAppShare(text);
  };

  // Filter residents
  const filteredResidents = residents.filter((h) => {
    const term = searchTerm.toLowerCase();
    const matchTerm =
      h.blockNumber.toLowerCase().includes(term) ||
      h.headName.toLowerCase().includes(term) ||
      (h.phone || '').toLowerCase().includes(term) ||
      h.members?.some((m) => m.name.toLowerCase().includes(term));

    const matchOwnership =
      filterOwnership === 'semua' || h.ownership === filterOwnership;
    const matchRukem = filterRukem === 'semua' || h.rukem === filterRukem;
    const matchWifi = filterWifi === 'semua' || h.wifiStatus === filterWifi;

    return matchTerm && matchOwnership && matchRukem && matchWifi;
  });

  // Flatten filtered residents into exact Excel rows for Master Table View
  const flattenedExcelRows = filteredResidents.flatMap(
    (
      house
    ): {
      house: ResidentHouse;
      member: FamilyMember | null;
      isEmptyHouse: boolean;
      orderLabel: string;
      isFirstInHouse: boolean;
      houseRowCount: number;
    }[] => {
      const isVacant = isHouseVacant(house);
      if (!isVacant && house.members && house.members.length > 0) {
        // Ensure Kepala Keluarga is first
        const sortedMembers = [...house.members].sort((a, b) => {
          if (a.relation === 'Kepala Keluarga') return -1;
          if (b.relation === 'Kepala Keluarga') return 1;
          return 0;
        });
        return sortedMembers.map((member, index) => ({
          house,
          member,
          isEmptyHouse: false,
          orderLabel: index === 0 ? 'Utama (KK)' : `Anggota #${index + 1}`,
          isFirstInHouse: index === 0,
          houseRowCount: sortedMembers.length,
        }));
      }
      return [
        {
          house,
          member: null,
          isEmptyHouse: true,
          orderLabel: 'Utama (KK)',
          isFirstInHouse: true,
          houseRowCount: 1,
        },
      ];
    }
  );

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Header with Title and Actions positioned below description */}
      <div className="bg-gradient-to-r from-blue-700 via-indigo-700 to-teal-700 text-white rounded-2xl p-5 sm:p-6 border-b-2 border-indigo-400 shadow-md space-y-4">
        {/* Row 1: Title & Description */}
        <div>
          <div className="flex items-start sm:items-center gap-2.5">
            <div className="p-2.5 bg-white/15 text-amber-300 rounded-xl border border-white/25 shadow-xs backdrop-blur-xs shrink-0 mt-0.5 sm:mt-0">
              <FileSpreadsheet className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-lg sm:text-xl font-black text-white tracking-tight">
                  {config?.directorySectionTitle !== undefined
                    ? config.directorySectionTitle
                    : isAdmin
                    ? 'Buku Induk Warga (Sesuai Format Standar Inputan Excel)'
                    : 'Direktori Data Warga Gang Mandor'}
                </h2>
                <span className="px-2.5 py-0.5 rounded-full text-[11px] font-extrabold bg-amber-400 text-slate-950 shadow-xs">
                  {residents.length} Kavling Rumah
                </span>
              </div>
              <p className="text-xs sm:text-sm text-sky-100 max-w-4xl mt-1.5 leading-relaxed">
                {config?.directorySectionDescription !== undefined
                  ? config.directorySectionDescription
                  : 'Daftar data warga per kavling blok rumah beserta rincian nama kepala keluarga dan anggota keluarga.'}
              </p>
            </div>
          </div>
        </div>

        {/* Row 2: Pilihan / Action Buttons (Berada di Bawah Deskripsi) */}
        {isAdmin && (
          <div className="pt-3 border-t border-white/20 flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setIsUploadModalOpen(true)}
              className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold bg-amber-400 hover:bg-amber-300 text-slate-950 rounded-xl shadow-xs transition-colors cursor-pointer whitespace-nowrap"
              title="Upload file Excel (.xlsx / .xls) untuk memperbarui data warga"
            >
              <Upload className="w-4 h-4 text-slate-950" />
              <span>Upload Excel (.xlsx)</span>
            </button>

            <button
              type="button"
              onClick={downloadExcelTemplate}
              className="flex items-center gap-1.5 px-3 py-2 text-xs font-bold bg-white/15 hover:bg-white/25 text-white border border-white/25 rounded-xl transition-colors cursor-pointer whitespace-nowrap"
              title="Download template kosong Excel dengan format kolom resmi"
            >
              <Download className="w-4 h-4 text-amber-200" />
              <span>Unduh Template</span>
            </button>

            <button
              type="button"
              onClick={handleExportExcel}
              className="flex items-center gap-1.5 px-3 py-2 text-xs font-bold bg-white/15 hover:bg-white/25 text-white border border-white/25 rounded-xl transition-colors cursor-pointer whitespace-nowrap"
              title="Download seluruh data warga saat ini ke Excel (.xlsx)"
            >
              <FileSpreadsheet className="w-4 h-4 text-emerald-300" />
              <span>Ekspor Excel</span>
            </button>

            <button
              type="button"
              onClick={handleShareDirectoryWA}
              className="flex items-center gap-1.5 px-3 py-2 text-xs font-bold bg-white/15 hover:bg-white/25 text-white border border-white/25 rounded-xl transition-colors cursor-pointer whitespace-nowrap"
              title="Bagikan ringkasan data warga ke WhatsApp"
            >
              <Share2 className="w-4 h-4 text-cyan-300" />
              <span>Bagikan WA</span>
            </button>

            <button
              type="button"
              onClick={handleOpenAdd}
              className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold bg-emerald-500 hover:bg-emerald-400 text-white rounded-xl shadow-sm transition-colors cursor-pointer whitespace-nowrap"
            >
              <Plus className="w-4 h-4" />
              <span>Input Warga Baru</span>
            </button>

            {onOpenConfigModal && (
              <button
                type="button"
                onClick={onOpenConfigModal}
                className="p-2 text-white/80 hover:text-white bg-white/10 hover:bg-white/20 rounded-xl border border-white/20 cursor-pointer ml-auto"
                title="Edit / Hapus Judul & Deskripsi Data Warga"
              >
                <Edit2 className="w-4 h-4 text-amber-200" />
              </button>
            )}
          </div>
        )}
      </div>

      {/* Filter, Search & View Mode Switcher Bar */}
      <div className="bg-gradient-to-r from-teal-50/80 via-cyan-50/60 to-indigo-50/60 dark:from-slate-900 dark:to-teal-950/40 rounded-2xl p-4 border border-teal-200/80 shadow-xs flex flex-col lg:flex-row lg:items-center justify-between gap-3">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
          <input
            type="text"
            placeholder={isAdmin ? "Cari No Blok, Kepala Keluarga, Nama Anggota, atau No Telepon/WA..." : "Cari No Blok, Kepala Keluarga, atau Nama Anggota..."}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2 text-xs">
          {isAdmin && (
            <>
              <div className="flex items-center gap-1">
                <span className="text-slate-500">Kepemilikan:</span>
                <select
                  value={filterOwnership}
                  onChange={(e) => setFilterOwnership(e.target.value)}
                  className="px-2.5 py-1.5 bg-slate-50 border border-slate-300 rounded-lg text-xs focus:ring-1 focus:ring-emerald-500"
                >
                  <option value="semua">Semua</option>
                  <option value="Milik Sendiri">Milik Sendiri</option>
                  <option value="Kontrak">Kontrak</option>
                  <option value="Milik Orang Lain">Milik Orang Lain</option>
                </select>
              </div>

              <div className="flex items-center gap-1">
                <span className="text-slate-500">Rukem:</span>
                <select
                  value={filterRukem}
                  onChange={(e) => setFilterRukem(e.target.value)}
                  className="px-2.5 py-1.5 bg-slate-50 border border-slate-300 rounded-lg text-xs focus:ring-1 focus:ring-emerald-500"
                >
                  <option value="semua">Semua</option>
                  <option value="Ikut Rukem">Ikut Rukem</option>
                  <option value="Tidak Ikut">Tidak Ikut</option>
                </select>
              </div>

              <div className="flex items-center gap-1">
                <span className="text-slate-500">WiFi:</span>
                <select
                  value={filterWifi}
                  onChange={(e) => setFilterWifi(e.target.value)}
                  className="px-2.5 py-1.5 bg-slate-50 border border-slate-300 rounded-lg text-xs focus:ring-1 focus:ring-emerald-500"
                >
                  <option value="semua">Semua</option>
                  <option value="Pasang">Pasang</option>
                  <option value="Tidak Pasang">Tidak Pasang</option>
                </select>
              </div>
            </>
          )}

          {/* Mode Tampilan: Tabel Buku Induk Excel hanya untuk Admin */}
          {isAdmin && (
            <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-xl border border-slate-200 ml-auto lg:ml-2">
              <button
                type="button"
                onClick={() => setViewMode('excel')}
                className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-medium transition-colors cursor-pointer whitespace-nowrap ${
                  viewMode === 'excel'
                    ? 'bg-emerald-600 text-white font-semibold shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Table className="w-3.5 h-3.5" />
                <span>Tabel Buku Induk (Excel)</span>
              </button>
              <button
                type="button"
                onClick={() => setViewMode('card')}
                className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-medium transition-colors cursor-pointer whitespace-nowrap ${
                  viewMode === 'card'
                    ? 'bg-emerald-600 text-white font-semibold shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <LayoutGrid className="w-3.5 h-3.5" />
                <span>Kartu Per Blok</span>
              </button>
            </div>
          )}

          {(!isAdmin || viewMode === 'card') && (
            <div className="flex items-center gap-1 pl-2 border-l border-slate-200">
              <button
                type="button"
                onClick={() => handleExpandAll(true)}
                className="px-2 py-1 text-xs font-medium text-emerald-700 hover:bg-emerald-50 rounded-md transition-colors cursor-pointer whitespace-nowrap"
              >
                Buka Semua
              </button>
              <button
                type="button"
                onClick={() => handleExpandAll(false)}
                className="px-2 py-1 text-xs font-medium text-slate-600 hover:bg-slate-100 rounded-md transition-colors cursor-pointer whitespace-nowrap"
              >
                Ringkas Semua
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Keterangan Warna Status Rumah */}
      <div className="flex flex-wrap items-center gap-2.5 sm:gap-3 text-xs bg-white/95 rounded-2xl p-3 sm:px-4 border border-slate-200/90 shadow-2xs">
        <span className="font-bold text-slate-700 text-xs">Keterangan Warna Rumah:</span>
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-neutral-950 text-white font-bold border border-neutral-800 text-[11px] shadow-2xs">
          <span className="w-2.5 h-2.5 rounded-full bg-red-400"></span>
          Rumah Kosong (Hitam)
        </span>
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-sky-100 text-sky-950 font-bold border border-sky-300 text-[11px] shadow-2xs">
          <span className="w-2.5 h-2.5 rounded-full bg-sky-500"></span>
          Rumah Belum Diisi / Belum Ditempati (Biru Muda)
        </span>
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-emerald-50 text-emerald-900 font-bold border border-emerald-300 text-[11px] shadow-2xs">
          <span className="w-2.5 h-2.5 rounded-full bg-emerald-500"></span>
          Rumah Ditempati (Hijau)
        </span>
      </div>

      {/* VIEW 1: TABEL BUKU INDUK LENGKAP (HANYA UNTUK VIEW ADMIN) */}
      {isAdmin && viewMode === 'excel' ? (
        <div className="bg-gradient-to-br from-indigo-50/60 via-cyan-50/40 to-emerald-50/50 dark:from-slate-900 dark:to-indigo-950/40 rounded-2xl border border-indigo-200 dark:border-indigo-800/60 overflow-hidden shadow-md">
          <div className="px-5 py-4 bg-gradient-to-r from-indigo-600 via-blue-600 to-teal-600 text-white flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2 text-xs sm:text-sm">
              <span className="font-bold text-white">
                Lembar Buku Induk Kependudukan (Format Spreadsheet Excel)
              </span>
              <span aria-hidden="true" className="text-sky-200">·</span>
              <span className="font-mono text-amber-300 font-bold tabular-nums">
                {flattenedExcelRows.length} Baris Data ({filteredResidents.length} Rumah)
              </span>
            </div>
            <span className="text-[11px] text-sky-100 hidden md:inline">
              Geser tabel ke kanan (scroll horizontal) untuk melihat seluruh 16 kolom standar Excel
            </span>
            <span className="text-[11px] text-sky-100 md:hidden">
              Mode ringkas mobile aktif (tanpa scroll berlebih)
            </span>
          </div>

          {/* Mobile Responsive Master List (Zero Horizontal Scroll on Mobile) */}
          <div className="md:hidden divide-y divide-slate-200">
            {flattenedExcelRows.length === 0 ? (
              <div className="py-10 px-4 text-center text-slate-400 text-xs">
                Tidak ada baris data warga yang cocok dengan filter pencarian.
              </div>
            ) : (
              flattenedExcelRows.map((row, idx) => {
                const { house, member, isEmptyHouse, orderLabel, isFirstInHouse } = row;
                const isKK = member?.relation === 'Kepala Keluarga' || isEmptyHouse;
                const wifiText = `${house.wifiStatus}${
                  house.wifiStatus === 'Pasang' &&
                  house.wifiProvider &&
                  house.wifiProvider !== '-'
                    ? ` (${house.wifiProvider})`
                    : ''
                }`;

                const isVacant = isEmptyHouse || isHouseVacant(house);
                const isUnfilled = !isVacant && isHouseUnfilled(house);

                return (
                  <div
                    key={member ? member.id : house.id}
                    className={`p-3.5 space-y-2 transition-colors ${
                      isFirstInHouse
                        ? isVacant
                          ? 'border-t-4 border-t-neutral-700'
                          : isUnfilled
                          ? 'border-t-4 border-t-sky-400'
                          : 'border-t-2 border-t-emerald-500/40'
                        : ''
                    } ${
                      isVacant
                        ? 'bg-neutral-950 text-white border-2 border-neutral-800 rounded-2xl my-2 shadow-sm'
                        : isUnfilled
                        ? 'bg-sky-100 text-sky-950 border-2 border-sky-300 rounded-2xl my-2 shadow-sm'
                        : isKK
                        ? 'bg-emerald-50/70 border-l-4 border-l-emerald-500 rounded-xl my-1'
                        : 'bg-white'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className={`text-[11px] font-mono tabular-nums ${
                          isVacant ? 'text-neutral-400' : isUnfilled ? 'text-sky-800' : 'text-slate-400'
                        }`}>
                          #{idx + 1}
                        </span>
                        <span
                          className={`px-2 py-0.5 rounded-md font-mono font-bold text-xs shrink-0 ${
                            isVacant
                              ? 'bg-neutral-800 text-white border border-neutral-700'
                              : isUnfilled
                              ? 'bg-sky-200 text-sky-950 border border-sky-400'
                              : 'bg-gradient-to-r from-emerald-600 to-teal-600 text-white shadow-xs'
                          }`}
                        >
                          {house.blockNumber}
                        </span>
                        <div className="min-w-0">
                          <div
                            className={`font-bold text-xs truncate ${
                              isVacant ? 'text-white italic' : isUnfilled ? 'text-sky-950 font-black' : 'text-slate-900'
                            }`}
                          >
                            {isVacant
                              ? house.headName.toLowerCase().includes('kosong')
                                ? house.headName
                                : `Rumah Kosong (${house.headName})`
                              : isEmptyHouse
                              ? house.headName || '-'
                              : member?.name || house.headName || '-'}
                          </div>
                          <div
                            className={`text-[11px] font-bold ${
                              isVacant ? 'text-neutral-400' : isUnfilled ? 'text-sky-800' : 'text-emerald-700'
                            }`}
                          >
                            {isVacant
                              ? 'Rumah Kosong / Tanpa Penghuni'
                              : isEmptyHouse
                              ? 'Kepala Keluarga'
                              : member?.relation || 'Kepala Keluarga'}{' '}
                            · {orderLabel}
                          </div>
                        </div>
                      </div>

                      {isAdmin && (
                        <div className="flex items-center gap-1 shrink-0">
                          <button
                            type="button"
                            onClick={() => handleOpenEdit(house)}
                            className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
                              isVacant
                                ? 'text-neutral-300 hover:text-white bg-neutral-800'
                                : isUnfilled
                                ? 'text-sky-800 hover:text-sky-950 bg-sky-200'
                                : 'text-slate-500 hover:text-emerald-700 bg-slate-100'
                            }`}
                            title={`Edit Blok ${house.blockNumber}`}
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          {deleteConfirmId === house.id ? (
                            <button
                              type="button"
                              onClick={() => {
                                onDeleteResident(house.id);
                                setDeleteConfirmId(null);
                              }}
                              className="px-2 py-1 bg-rose-600 text-white rounded text-[10px] font-bold cursor-pointer"
                            >
                              Hapus
                            </button>
                          ) : (
                            <button
                              type="button"
                              onClick={() => setDeleteConfirmId(house.id)}
                              className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
                                isVacant
                                  ? 'text-neutral-400 hover:text-rose-400 bg-neutral-800'
                                  : isUnfilled
                                  ? 'text-sky-800 hover:text-rose-600 bg-sky-200'
                                  : 'text-slate-500 hover:text-rose-600 bg-slate-100'
                              }`}
                              title={`Hapus Blok ${house.blockNumber}`}
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      )}
                    </div>

                    <div
                      className={`grid grid-cols-2 gap-x-3 gap-y-1 text-[11px] p-2.5 rounded-xl border ${
                        isVacant
                          ? 'bg-neutral-900 text-neutral-200 border-neutral-800'
                          : isUnfilled
                          ? 'bg-sky-50 text-sky-950 border-sky-200'
                          : 'text-slate-600 bg-slate-50 border-slate-200/70'
                      }`}
                    >
                      <div>
                        <span className={isVacant ? 'text-neutral-400' : isUnfilled ? 'text-sky-700' : 'text-slate-400'}>KK:</span>{' '}
                        <strong className={isVacant ? 'text-white' : isUnfilled ? 'text-sky-950' : 'text-slate-800'}>
                          {house.headName || '-'}
                        </strong>
                      </div>
                      <div>
                        <span className={isVacant ? 'text-neutral-400' : isUnfilled ? 'text-sky-700' : 'text-slate-400'}>Umur / JK:</span>{' '}
                        <strong className={`font-mono ${isVacant ? 'text-neutral-300' : isUnfilled ? 'text-sky-950' : 'text-slate-800'}`}>
                          {isVacant || (!member?.birthDate && !member?.gender)
                            ? '-'
                            : `${calculateAge(member?.birthDate || '')} thn (${
                                member?.gender === 'Laki-laki' ? 'L' : 'P'
                              })`}
                        </strong>
                      </div>
                      <div>
                        <span className={isVacant ? 'text-neutral-400' : isUnfilled ? 'text-sky-700' : 'text-slate-400'}>TTL:</span>{' '}
                        <span className={isVacant ? 'text-neutral-300' : isUnfilled ? 'text-sky-900' : 'text-slate-700'}>
                          {isVacant || (!member?.birthPlace && !member?.birthDate)
                            ? '-'
                            : `${member?.birthPlace || '-'}, ${formatDateDDMMYYYY(
                                member?.birthDate || ''
                              )}`}
                        </span>
                      </div>
                      <div>
                        <span className={isVacant ? 'text-neutral-400' : isUnfilled ? 'text-sky-700' : 'text-slate-400'}>Agama:</span>{' '}
                        <span className={isVacant ? 'text-neutral-300' : isUnfilled ? 'text-sky-900' : 'text-slate-700'}>
                          {isVacant ? '-' : member?.religion || '-'}
                        </span>
                      </div>
                      <div>
                        <span className={isVacant ? 'text-neutral-400' : isUnfilled ? 'text-sky-700' : 'text-slate-400'}>Hunian:</span>{' '}
                        <strong className={isVacant ? 'text-neutral-300' : isUnfilled ? 'text-sky-950' : 'text-slate-700'}>
                          {house.ownership} (
                          <span
                            className={
                              isVacant
                                ? 'px-1.5 py-0.5 rounded bg-neutral-800 text-white font-bold border border-neutral-700'
                                : isUnfilled
                                ? 'px-1.5 py-0.5 rounded bg-sky-200 text-sky-950 font-bold border border-sky-300'
                                : 'font-bold text-emerald-700'
                            }
                          >
                            {isVacant ? 'Kosong' : house.occupancy}
                          </span>
                          )
                        </strong>
                      </div>
                      <div>
                        <span className={isVacant ? 'text-neutral-400' : isUnfilled ? 'text-sky-700' : 'text-slate-400'}>Rukem / WiFi:</span>{' '}
                        <span className={isVacant ? 'text-neutral-300' : isUnfilled ? 'text-sky-900' : 'text-slate-700'}>
                          {house.rukem} · {wifiText}
                        </span>
                      </div>
                      {house.phone && (
                        <div className="col-span-2">
                          <span className={isVacant ? 'text-neutral-400' : isUnfilled ? 'text-sky-700' : 'text-slate-400'}>No. HP/WA:</span>{' '}
                          <span className={`font-mono font-semibold ${isVacant ? 'text-neutral-200' : isUnfilled ? 'text-sky-950' : 'text-emerald-700'}`}>
                            {house.phone}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Desktop 16-Column Excel Table */}
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse whitespace-nowrap">
              <thead>
                <tr className="bg-slate-100/90 text-slate-700 font-bold border-b border-slate-300">
                  <th className="py-3 px-3 text-center border-r border-slate-200 w-10">No</th>
                  <th className="py-3 px-3 border-r border-slate-200 bg-emerald-100/50 text-emerald-950">
                    No Blok
                  </th>
                  <th className="py-3 px-3 border-r border-slate-200 bg-emerald-100/50 text-emerald-950">
                    Kepala Keluarga
                  </th>
                  <th className="py-3 px-3 border-r border-slate-200 bg-teal-100/40 text-teal-950">
                    Nama Anggota
                  </th>
                  <th className="py-3 px-3 border-r border-slate-200">Status Hubungan</th>
                  <th className="py-3 px-3 border-r border-slate-200">Tempat Lahir</th>
                  <th className="py-3 px-3 border-r border-slate-200">Tanggal Lahir</th>
                  <th className="py-3 px-3 text-center border-r border-slate-200">Umur (Tahun)</th>
                  <th className="py-3 px-3 border-r border-slate-200">Jenis Kelamin</th>
                  <th className="py-3 px-3 border-r border-slate-200">Agama</th>
                  <th className="py-3 px-3 border-r border-slate-200">No Telepon / WA</th>
                  <th className="py-3 px-3 border-r border-slate-200">Status Kepemilikan</th>
                  <th className="py-3 px-3 border-r border-slate-200">Status Rumah</th>
                  <th className="py-3 px-3 border-r border-slate-200">Status Rukem</th>
                  <th className="py-3 px-3 border-r border-slate-200">Status WiFi</th>
                  <th className="py-3 px-3 border-r border-slate-200">Urutan Anggota</th>
                  {isAdmin && <th className="py-3 px-3 text-center">Aksi</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {flattenedExcelRows.length === 0 ? (
                  <tr>
                    <td
                      colSpan={isAdmin ? 17 : 16}
                      className="py-10 text-center text-slate-400 text-xs"
                    >
                      Tidak ada baris data warga yang cocok dengan filter pencarian.
                    </td>
                  </tr>
                ) : (
                  flattenedExcelRows.map((row, idx) => {
                    const { house, member, isEmptyHouse, orderLabel, isFirstInHouse } = row;
                    const isKK = member?.relation === 'Kepala Keluarga' || isEmptyHouse;
                    const wifiText = `${house.wifiStatus}${
                      house.wifiStatus === 'Pasang' &&
                      house.wifiProvider &&
                      house.wifiProvider !== '-'
                        ? ` (${house.wifiProvider})`
                        : ''
                    }`;

                    const isVacant = isEmptyHouse || isHouseVacant(house);
                    const isUnfilled = !isVacant && isHouseUnfilled(house);

                    return (
                      <tr
                        key={member ? member.id : house.id}
                        className={`transition-colors ${
                          isVacant
                            ? 'bg-neutral-950 text-white hover:bg-neutral-900'
                            : isUnfilled
                            ? 'bg-sky-100 text-sky-950 hover:bg-sky-200/90'
                            : isKK
                            ? 'bg-emerald-50/40 hover:bg-emerald-50/70'
                            : 'bg-white hover:bg-teal-50/20'
                        } ${
                          isFirstInHouse
                            ? isVacant
                              ? 'border-t-2 border-t-neutral-700'
                              : isUnfilled
                              ? 'border-t-2 border-t-sky-400'
                              : 'border-t-2 border-t-slate-300'
                            : ''
                        }`}
                      >
                        <td className={`py-2.5 px-3 text-center font-mono border-r tabular-nums ${
                          isVacant
                            ? 'text-neutral-400 border-neutral-800 bg-neutral-950'
                            : isUnfilled
                            ? 'text-sky-800 font-semibold border-sky-300 bg-sky-100/90'
                            : 'text-slate-400 border-slate-100'
                        }`}>
                          {idx + 1}
                        </td>
                        <td className={`py-2.5 px-3 font-mono font-bold border-r ${
                          isVacant
                            ? 'border-neutral-800 bg-neutral-950'
                            : isUnfilled
                            ? 'border-sky-300 bg-sky-100/90'
                            : 'border-slate-100'
                        }`}>
                          <span
                            className={
                              isVacant
                                ? 'px-2 py-0.5 rounded bg-neutral-800 text-white border border-neutral-700 font-mono text-xs font-bold'
                                : isUnfilled
                                ? 'px-2 py-0.5 rounded bg-sky-200 text-sky-950 border border-sky-400 font-mono text-xs font-bold'
                                : 'px-2 py-0.5 rounded bg-emerald-100 text-emerald-900 border border-emerald-300 font-mono text-xs font-bold'
                            }
                          >
                            {house.blockNumber}
                          </span>
                        </td>
                        <td className={`py-2.5 px-3 font-bold border-r ${
                          isVacant
                            ? 'text-white border-neutral-800 bg-neutral-950'
                            : isUnfilled
                            ? 'text-sky-950 border-sky-300 bg-sky-100/90'
                            : 'text-slate-900 border-slate-100'
                        }`}>
                          {isVacant
                            ? house.headName.toLowerCase().includes('kosong')
                              ? house.headName
                              : `Rumah Kosong (${house.headName})`
                            : house.headName}
                        </td>
                        <td
                          className={`py-2.5 px-3 border-r ${
                            isVacant
                              ? 'text-neutral-400 italic border-neutral-800 bg-neutral-950'
                              : isUnfilled
                              ? 'text-sky-900 font-medium border-sky-300 bg-sky-100/90'
                              : isKK
                              ? 'font-bold text-slate-900 border-slate-100'
                              : 'text-slate-700 border-slate-100'
                          }`}
                        >
                          {isEmptyHouse || isVacant
                            ? '-'
                            : member?.name || house.headName || '-'}
                        </td>
                        <td
                          className={`py-2.5 px-3 border-r ${
                            isVacant
                              ? 'text-neutral-300 border-neutral-800 bg-neutral-950'
                              : isUnfilled
                              ? 'text-sky-900 font-semibold border-sky-300 bg-sky-100/90'
                              : isKK
                              ? 'font-bold text-emerald-800 border-slate-100'
                              : 'text-slate-600 border-slate-100'
                          }`}
                        >
                          {isVacant
                            ? 'Rumah Kosong'
                            : isEmptyHouse
                            ? 'Kepala Keluarga'
                            : member?.relation || 'Kepala Keluarga'}
                        </td>
                        <td className={`py-2.5 px-3 border-r ${
                          isVacant
                            ? 'text-neutral-400 border-neutral-800 bg-neutral-950'
                            : isUnfilled
                            ? 'text-sky-900 border-sky-300 bg-sky-100/90'
                            : 'text-slate-600 border-slate-100'
                        }`}>
                          {isEmptyHouse || isVacant ? '-' : member?.birthPlace || '-'}
                        </td>
                        <td className={`py-2.5 px-3 font-mono border-r tabular-nums ${
                          isVacant
                            ? 'text-neutral-400 border-neutral-800 bg-neutral-950'
                            : isUnfilled
                            ? 'text-sky-900 border-sky-300 bg-sky-100/90'
                            : 'text-slate-600 border-slate-100'
                        }`}>
                          {isEmptyHouse || isVacant || !member?.birthDate ? '-' : formatDateDDMMYYYY(member?.birthDate || '')}
                        </td>
                        <td className={`py-2.5 px-3 text-center font-mono font-bold border-r tabular-nums ${
                          isVacant
                            ? 'text-neutral-400 border-neutral-800 bg-neutral-950'
                            : isUnfilled
                            ? 'text-sky-950 border-sky-300 bg-sky-100/90'
                            : 'text-slate-800 border-slate-100'
                        }`}>
                          {isEmptyHouse || isVacant || !member?.birthDate ? '-' : calculateAge(member?.birthDate || '')}
                        </td>
                        <td className={`py-2.5 px-3 border-r ${
                          isVacant
                            ? 'text-neutral-400 border-neutral-800 bg-neutral-950'
                            : isUnfilled
                            ? 'text-sky-900 border-sky-300 bg-sky-100/90'
                            : 'text-slate-600 border-slate-100'
                        }`}>
                          {isEmptyHouse || isVacant ? '-' : member?.gender || '-'}
                        </td>
                        <td className={`py-2.5 px-3 border-r ${
                          isVacant
                            ? 'text-neutral-400 border-neutral-800 bg-neutral-950'
                            : isUnfilled
                            ? 'text-sky-900 border-sky-300 bg-sky-100/90'
                            : 'text-slate-600 border-slate-100'
                        }`}>
                          {isEmptyHouse || isVacant ? '-' : member?.religion || '-'}
                        </td>
                        <td className={`py-2.5 px-3 font-mono border-r tabular-nums ${
                          isVacant
                            ? 'text-neutral-400 border-neutral-800 bg-neutral-950'
                            : isUnfilled
                            ? 'text-sky-900 border-sky-300 bg-sky-100/90 font-medium'
                            : 'text-slate-700 border-slate-100'
                        }`}>
                          {house.phone || '-'}
                        </td>
                        <td className={`py-2.5 px-3 border-r ${
                          isVacant
                            ? 'text-neutral-300 border-neutral-800 bg-neutral-950'
                            : isUnfilled
                            ? 'text-sky-950 font-medium border-sky-300 bg-sky-100/90'
                            : 'text-slate-700 border-slate-100'
                        }`}>
                          {house.ownership}
                        </td>
                        <td className={`py-2.5 px-3 border-r font-medium ${
                          isVacant
                            ? 'border-neutral-800 bg-neutral-950'
                            : isUnfilled
                            ? 'border-sky-300 bg-sky-100/90'
                            : 'border-slate-100'
                        }`}>
                          {isVacant ? (
                            <span className="px-2 py-0.5 rounded-md bg-neutral-800 text-white font-bold border border-neutral-700">
                              Kosong (Tanpa Penghuni)
                            </span>
                          ) : house.occupancy === 'Belum Ditempati' || isUnfilled ? (
                            <span className="px-2 py-0.5 rounded-md bg-sky-200 text-sky-950 font-bold border border-sky-400">
                              Belum Ditempati
                            </span>
                          ) : (
                            <span
                              className={`px-2 py-0.5 rounded-md font-bold ${
                                house.occupancy === 'Dikontrakan'
                                  ? 'bg-purple-100 text-purple-800 border border-purple-200'
                                  : 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                              }`}
                            >
                              {house.occupancy}
                            </span>
                          )}
                        </td>
                        <td
                          className={`py-2.5 px-3 border-r font-medium ${
                            isVacant
                              ? 'text-neutral-400 border-neutral-800 bg-neutral-950'
                              : isUnfilled
                              ? 'text-sky-900 font-semibold border-sky-300 bg-sky-100/90'
                              : house.rukem === 'Ikut Rukem'
                              ? 'text-purple-700 font-bold border-slate-100'
                              : 'text-slate-500 border-slate-100'
                          }`}
                        >
                          {house.rukem}
                        </td>
                        <td className={`py-2.5 px-3 border-r ${
                          isVacant
                            ? 'text-neutral-400 border-neutral-800 bg-neutral-950'
                            : isUnfilled
                            ? 'text-sky-900 border-sky-300 bg-sky-100/90'
                            : 'text-slate-700 border-slate-100'
                        }`}>
                          {wifiText}
                        </td>
                        <td className={`py-2.5 px-3 border-r ${
                          isVacant
                            ? 'text-neutral-400 border-neutral-800 bg-neutral-950'
                            : isUnfilled
                            ? 'text-sky-900 border-sky-300 bg-sky-100/90'
                            : 'text-slate-500 border-slate-100'
                        }`}>
                          {orderLabel}
                        </td>
                        {isAdmin && (
                          <td className={`py-2.5 px-3 text-center ${
                            isVacant ? 'bg-neutral-950 border-neutral-800' : isUnfilled ? 'bg-sky-100/90 border-sky-300' : ''
                          }`}>
                            <div className="flex items-center justify-center gap-1">
                              <button
                                type="button"
                                onClick={() => handleOpenEdit(house)}
                                className={`p-1 rounded transition-colors cursor-pointer ${
                                  isVacant
                                    ? 'text-neutral-300 hover:text-white hover:bg-neutral-800'
                                    : isUnfilled
                                    ? 'text-sky-800 hover:text-sky-950 hover:bg-sky-200'
                                    : 'text-slate-500 hover:text-emerald-700 hover:bg-emerald-50'
                                }`}
                                title={`Edit Blok ${house.blockNumber}`}
                              >
                                <Edit2 className="w-3.5 h-3.5" />
                              </button>
                              {deleteConfirmId === house.id ? (
                                <button
                                  type="button"
                                  onClick={() => {
                                    onDeleteResident(house.id);
                                    setDeleteConfirmId(null);
                                  }}
                                  className="px-1.5 py-0.5 bg-rose-600 text-white rounded text-[10px] font-bold cursor-pointer"
                                >
                                  Hapus
                                </button>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => setDeleteConfirmId(house.id)}
                                  className={`p-1 rounded transition-colors cursor-pointer ${
                                    isVacant
                                      ? 'text-neutral-400 hover:text-rose-400 hover:bg-neutral-800'
                                      : isUnfilled
                                      ? 'text-sky-700 hover:text-rose-600 hover:bg-sky-200'
                                      : 'text-slate-500 hover:text-rose-600 hover:bg-rose-50'
                                  }`}
                                  title={`Hapus Blok ${house.blockNumber}`}
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              )}
                            </div>
                          </td>
                        )}
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        /* VIEW 2: KARTU PER BLOK RUMAH (GROUPED VIEW) */
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 bg-gradient-to-r from-emerald-50 via-teal-50 to-sky-50 rounded-2xl border border-emerald-200/80 shadow-2xs">
            <div className="flex items-center gap-2.5">
              <span className="p-2 rounded-xl bg-emerald-600 text-white shadow-2xs shrink-0">
                <Users className="w-4 h-4" />
              </span>
              <div>
                <h3 className="font-black text-xs sm:text-sm text-slate-900">
                  Direktori Data Warga Gang Mandor
                </h3>
                <p className="text-[11px] text-slate-600">
                  Default diringkas semua kavling. Klik tombol <span className="font-bold text-emerald-700 bg-emerald-100 px-1 py-0.5 rounded">Buka</span> pada setiap rumah jika ingin melihat anggotanya.
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => handleExpandAll(false)}
                className="px-3 py-1.5 text-xs font-bold bg-white hover:bg-slate-50 text-slate-700 border border-slate-300 rounded-xl transition-colors cursor-pointer shadow-2xs"
              >
                Ringkas Semua
              </button>
              <button
                type="button"
                onClick={() => handleExpandAll(true)}
                className="px-3 py-1.5 text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white border border-emerald-700 rounded-xl transition-colors cursor-pointer shadow-2xs"
              >
                Buka Semua
              </button>
            </div>
          </div>

          {filteredResidents.length === 0 ? (
            <div className="bg-white rounded-xl border border-slate-200 p-8 text-center text-slate-400 text-xs">
              Tidak ada data warga yang cocok dengan kriteria pencarian.
            </div>
          ) : (
            filteredResidents.map((house) => {
              const isExpanded = expandedHouseIds[house.id] ?? false;
              const headMember = house.members?.find((m) => m.relation === 'Kepala Keluarga');
              const otherMembers =
                house.members?.filter((m) => m.relation !== 'Kepala Keluarga') || [];

              const isVacant = isHouseVacant(house);
              const isUnfilled = !isVacant && isHouseUnfilled(house);

              return (
                <div
                  key={house.id}
                  className={`rounded-2xl border overflow-hidden transition-all ${
                    isVacant
                      ? 'bg-neutral-950 text-white border-2 border-neutral-800 shadow-sm'
                      : isUnfilled
                      ? 'bg-sky-50 text-sky-950 border-2 border-sky-300 shadow-sm hover:border-sky-400'
                      : 'bg-white border-2 border-emerald-200/90 hover:border-emerald-500 hover:shadow-lg shadow-xs'
                  }`}
                >
                  {/* House Summary Card Header */}
                  <div
                    className={`p-4 flex flex-col md:flex-row md:items-center justify-between gap-3 border-b ${
                      isVacant
                        ? 'bg-neutral-900 text-white border-neutral-800'
                        : isUnfilled
                        ? 'bg-gradient-to-r from-sky-100 via-sky-50 to-blue-100 text-sky-950 border-sky-300'
                        : 'bg-gradient-to-r from-teal-50/90 via-emerald-50/70 to-cyan-50/80 border-emerald-200/80'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <span
                        className={`px-3 py-1.5 font-black text-sm rounded-xl font-mono shadow-xs ${
                          isVacant
                            ? 'bg-neutral-800 text-white border border-neutral-700 font-bold'
                            : isUnfilled
                            ? 'bg-sky-200 text-sky-950 border border-sky-400 font-bold'
                            : 'bg-gradient-to-br from-emerald-600 via-teal-600 to-cyan-700 text-white shadow-xs'
                        }`}
                      >
                        {house.blockNumber}
                      </span>
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3
                            className={`font-black text-sm sm:text-base ${
                              isVacant ? 'text-white' : isUnfilled ? 'text-sky-950' : 'text-slate-900'
                            }`}
                          >
                            {isVacant
                              ? house.headName.toLowerCase().includes('kosong')
                                ? house.headName
                                : `Rumah Kosong (${house.headName})`
                              : `Keluarga ${house.headName}`}
                          </h3>
                          <span
                            className={`text-xs font-bold px-2.5 py-0.5 rounded-lg ${
                              isVacant
                                ? 'bg-neutral-800 text-neutral-200 border border-neutral-700'
                                : isUnfilled
                                ? 'bg-sky-200 text-sky-950 border border-sky-400'
                                : 'bg-emerald-100 text-emerald-900 border border-emerald-300'
                            }`}
                          >
                            {isVacant
                              ? 'Rumah Kosong'
                              : isUnfilled
                              ? `${house.members?.length || 1} Anggota (Belum Ditempati)`
                              : `${house.members?.length || 0} Anggota`}
                          </span>
                        </div>
                        {isAdmin && (
                          <div className="flex flex-wrap items-center gap-2 text-xs mt-1">
                            {isVacant ? (
                              <>
                                <span className="text-neutral-400">
                                  Status: <strong className="px-1.5 py-0.5 rounded bg-neutral-800 text-white border border-neutral-700 font-bold">Kosong (Tanpa Penghuni)</strong>
                                </span>
                                <span className="text-neutral-600">·</span>
                                <span className="text-neutral-400">
                                  Kepemilikan: <strong className="text-neutral-200">{house.ownership}</strong>
                                </span>
                              </>
                            ) : isUnfilled ? (
                              <>
                                <span className="text-sky-800">
                                  Status: <strong className="px-1.5 py-0.5 rounded bg-sky-200 text-sky-950 border border-sky-400 font-bold">Belum Ditempati</strong>
                                </span>
                                <span className="text-sky-300">·</span>
                                <span className="text-sky-800">
                                  Kepemilikan: <strong className="text-sky-950">{house.ownership}</strong>
                                </span>
                                <span className="text-sky-300">·</span>
                                <span className="text-sky-800">
                                  Rukem: <strong className="text-sky-950">{house.rukem}</strong>
                                </span>
                                <span className="text-sky-300">·</span>
                                <span className="text-sky-800">
                                  WiFi: <strong className="text-sky-950">{house.wifiStatus === 'Pasang' ? `Pasang (${house.wifiProvider || 'WiFi'})` : 'Tidak Pasang'}</strong>
                                </span>
                                {house.phone && (
                                  <>
                                    <span className="text-sky-300">·</span>
                                    <span className="font-mono text-sky-900 font-bold">Telp: {house.phone}</span>
                                  </>
                                )}
                              </>
                            ) : (
                              <>
                                <span className="text-slate-600">
                                  Kepemilikan:{' '}
                                  <strong className="px-1.5 py-0.5 rounded bg-teal-100 text-teal-800 border border-teal-200 font-bold">
                                    {house.ownership}
                                  </strong>
                                </span>
                                <span className="text-slate-300">·</span>
                                <span className="text-slate-600">
                                  Status:{' '}
                                  <strong
                                    className={`px-1.5 py-0.5 rounded font-bold border ${
                                      house.occupancy === 'Dikontrakan'
                                        ? 'bg-purple-100 text-purple-800 border-purple-200'
                                        : 'bg-emerald-100 text-emerald-800 border-emerald-200'
                                    }`}
                                  >
                                    {house.occupancy}
                                  </strong>
                                </span>
                                <span className="text-slate-300">·</span>
                                <span className="text-slate-600">
                                  Rukem:{' '}
                                  <strong
                                    className={`px-1.5 py-0.5 rounded font-bold border ${
                                      house.rukem === 'Ikut Rukem'
                                        ? 'bg-purple-100 text-purple-800 border-purple-200'
                                        : 'bg-slate-100 text-slate-600 border-slate-200'
                                    }`}
                                  >
                                    {house.rukem}
                                  </strong>
                                </span>
                                <span className="text-slate-300">·</span>
                                <span className="text-slate-600">
                                  WiFi:{' '}
                                  <strong
                                    className={`px-1.5 py-0.5 rounded font-bold border ${
                                      house.wifiStatus === 'Pasang'
                                        ? 'bg-cyan-100 text-cyan-800 border-cyan-200'
                                        : 'bg-slate-100 text-slate-600 border-slate-200'
                                    }`}
                                  >
                                    {house.wifiStatus === 'Pasang'
                                      ? `Pasang (${house.wifiProvider || 'WiFi'})`
                                      : 'Tidak Pasang'}
                                  </strong>
                                </span>
                                {house.phone && (
                                  <>
                                    <span className="text-slate-300">·</span>
                                    <span className="font-mono text-emerald-700 font-bold">Telp: {house.phone}</span>
                                  </>
                                )}
                              </>
                            )}
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-2 self-end md:self-auto">
                      {isAdmin && (
                        <>
                          <button
                            type="button"
                            onClick={() => handleOpenEdit(house)}
                            className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
                              isVacant
                                ? 'text-neutral-300 hover:text-white bg-neutral-800'
                                : isUnfilled
                                ? 'text-sky-800 hover:text-sky-950 bg-sky-200'
                                : 'text-slate-600 hover:text-emerald-700 hover:bg-slate-100'
                            }`}
                            title="Edit Data Warga & Anggota Keluarga"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          {deleteConfirmId === house.id ? (
                            <div className="flex items-center gap-1">
                              <button
                                type="button"
                                onClick={() => {
                                  onDeleteResident(house.id);
                                  setDeleteConfirmId(null);
                                }}
                                className="px-2 py-1 bg-rose-600 text-white rounded text-xs font-semibold cursor-pointer"
                              >
                                Hapus
                              </button>
                              <button
                                type="button"
                                onClick={() => setDeleteConfirmId(null)}
                                className="px-2 py-1 bg-slate-100 text-slate-600 rounded text-xs cursor-pointer"
                              >
                                Batal
                              </button>
                            </div>
                          ) : (
                            <button
                              type="button"
                              onClick={() => setDeleteConfirmId(house.id)}
                              className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
                                isVacant
                                  ? 'text-neutral-400 hover:text-rose-400 bg-neutral-800'
                                  : isUnfilled
                                  ? 'text-sky-700 hover:text-rose-600 bg-sky-200'
                                  : 'text-slate-600 hover:text-rose-600 hover:bg-rose-50'
                              }`}
                              title="Hapus Data Warga"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                        </>
                      )}
                      <button
                        type="button"
                        onClick={() => toggleExpand(house.id)}
                        className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-xl transition-all cursor-pointer shadow-xs ${
                          isExpanded
                            ? 'bg-slate-200 hover:bg-slate-300 text-slate-800 border border-slate-300'
                            : isVacant
                            ? 'bg-neutral-800 hover:bg-neutral-700 text-white border border-neutral-700'
                            : isUnfilled
                            ? 'bg-sky-200 hover:bg-sky-300 text-sky-950 border border-sky-400'
                            : 'bg-emerald-600 hover:bg-emerald-700 text-white border border-emerald-700'
                        }`}
                        title={isExpanded ? 'Tutup rincian' : 'Klik buka jika ingin lihat anggotanya'}
                      >
                        <span>{isExpanded ? 'Tutup' : 'Buka'}</span>
                        {isExpanded ? (
                          <ChevronUp className="w-3.5 h-3.5" />
                        ) : (
                          <ChevronDown className="w-3.5 h-3.5" />
                        )}
                      </button>
                    </div>
                  </div>

                  {/* Expanded Family Members Table matching Excel Member Columns */}
                  {isExpanded && (
                    <div
                      className={`p-4 space-y-3 ${
                        isVacant
                          ? 'bg-neutral-900 text-white border-t border-neutral-800'
                          : isUnfilled
                          ? 'bg-sky-50 text-sky-950 border-t border-sky-300'
                          : 'bg-gradient-to-b from-teal-50/40 via-cyan-50/25 to-emerald-50/40 space-y-3'
                      }`}
                    >
                      {isVacant || house.occupancy === 'Kosong' ? (
                        <div
                          className="p-4 rounded-xl border border-neutral-800 bg-neutral-950 text-xs space-y-2 text-white"
                        >
                          <div className="flex items-center gap-2 font-bold text-white text-sm">
                            <span className="p-1 rounded bg-neutral-800 text-neutral-300">🏚️</span>
                            <span>Rumah Kosong / Belum Berpenghuni Tetap</span>
                          </div>
                          <p className="text-neutral-300 leading-relaxed">
                            Kavling {house.blockNumber} saat ini tercatat kosong / belum berpenghuni tetap.
                          </p>
                        </div>
                      ) : (!house.members || house.members.length === 0) && (!house.headName || house.headName === '-' || house.headName.toLowerCase().includes('belum')) ? (
                        <div
                          className="p-4 rounded-xl border border-sky-300 bg-sky-100/90 text-xs space-y-2 text-sky-950"
                        >
                          <div className="flex items-center gap-2 font-bold text-sky-950 text-sm">
                            <span className="p-1 rounded bg-sky-200 text-sky-800">🏠</span>
                            <span>Rumah Belum Ditempati</span>
                          </div>
                          <p className="text-sky-900 leading-relaxed">
                            Kavling {house.blockNumber} saat ini tercatat belum ditempati. Rincian data anggota keluarga belum tersedia.
                          </p>
                        </div>
                      ) : !isAdmin ? (
                        /* TAMPILAN KHUSUS WARGA: HANYA MENAMPILKAN NAMA KEPALA KELUARGA & ANGGOTA KELUARGA */
                        <div className="space-y-2">
                          <div className="flex items-center justify-between text-xs font-bold text-slate-700 pb-1 border-b border-slate-200/70">
                            <span className="flex items-center gap-1.5">
                              <Users className="w-3.5 h-3.5 text-emerald-600" />
                              <span>Daftar Anggota Keluarga ({house.members?.length || 0} Orang):</span>
                            </span>
                            <span className="text-[11px] font-normal text-slate-500">
                              Blok {house.blockNumber}
                            </span>
                          </div>

                          <div className="overflow-hidden border border-slate-200/90 rounded-xl bg-white shadow-2xs divide-y divide-slate-100">
                            {headMember && (
                              <div className="p-3 sm:px-4 flex items-center justify-between bg-emerald-50/70">
                                <div className="flex items-center gap-3">
                                  <span className="w-5 h-5 rounded-full bg-emerald-600 text-white font-mono text-[10px] font-bold flex items-center justify-center shrink-0">
                                    1
                                  </span>
                                  <User className="w-4 h-4 text-emerald-600 shrink-0" />
                                  <span className="font-bold text-slate-900 text-xs sm:text-sm">
                                    {headMember.name}
                                  </span>
                                </div>
                                <span className="text-[11px] font-bold text-emerald-800 bg-emerald-100/90 border border-emerald-200 px-2.5 py-0.5 rounded-md">
                                  Kepala Keluarga
                                </span>
                              </div>
                            )}

                            {otherMembers.map((member, idx) => (
                              <div
                                key={member.id}
                                className="p-3 sm:px-4 flex items-center justify-between hover:bg-slate-50 transition-colors"
                              >
                                <div className="flex items-center gap-3">
                                  <span className="w-5 h-5 rounded-full bg-slate-100 text-slate-600 font-mono text-[10px] font-bold flex items-center justify-center shrink-0">
                                    {headMember ? idx + 2 : idx + 1}
                                  </span>
                                  <span className="font-medium text-slate-800 text-xs sm:text-sm">
                                    {member.name}
                                  </span>
                                </div>
                                <span className="text-[11px] font-medium text-slate-600 bg-slate-100 border border-slate-200/80 px-2 py-0.5 rounded-md">
                                  {member.relation}
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>
                      ) : (
                        <>
                          {/* Mobile Family Member Stack (No Horizontal Scroll on Mobile) */}
                          <div className="md:hidden space-y-2">
                            {headMember && (
                              <div className="p-3 rounded-xl bg-emerald-50/50 dark:bg-emerald-950/40 border border-emerald-200/70 space-y-1.5">
                                <div className="flex items-center justify-between gap-2">
                                  <div className="flex items-center gap-1.5 font-bold text-xs text-slate-900">
                                    <span className="w-5 h-5 rounded-full bg-emerald-600 text-white font-mono text-[10px] flex items-center justify-center">
                                      1
                                    </span>
                                    <User className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                                    <span>{headMember.name}</span>
                                  </div>
                                  <span className="text-[11px] font-bold text-emerald-800 bg-emerald-100/80 px-2 py-0.5 rounded-md">
                                    Kepala Keluarga
                                  </span>
                                </div>
                                <div className="grid grid-cols-2 gap-x-2 gap-y-1 text-[11px] text-slate-600 pt-1 border-t border-emerald-200/50">
                                  <div>
                                    <span className="text-slate-400">TTL:</span>{' '}
                                    {headMember.birthPlace},{' '}
                                    <span className="font-mono">
                                      {formatDateDDMMYYYY(headMember.birthDate)}
                                    </span>
                                  </div>
                                  <div>
                                    <span className="text-slate-400">Umur:</span>{' '}
                                    <strong className="font-mono text-emerald-800">
                                      {calculateAge(headMember.birthDate)} thn
                                    </strong>{' '}
                                    ({headMember.gender === 'Laki-laki' ? 'L' : 'P'})
                                  </div>
                                  <div>
                                    <span className="text-slate-400">Agama:</span> {headMember.religion}
                                  </div>
                                  <div>
                                    <span className="text-slate-400">Urutan:</span> Utama (KK)
                                  </div>
                                </div>
                              </div>
                            )}

                            {otherMembers.map((member, idx) => (
                              <div
                                key={member.id}
                                className="p-3 rounded-xl bg-slate-50/80 dark:bg-slate-900/60 border border-slate-200/80 space-y-1.5"
                              >
                                <div className="flex items-center justify-between gap-2">
                                  <div className="flex items-center gap-1.5 font-semibold text-xs text-slate-800">
                                    <span className="w-5 h-5 rounded-full bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200 font-mono text-[10px] flex items-center justify-center">
                                      {headMember ? idx + 2 : idx + 1}
                                    </span>
                                    <span>{member.name}</span>
                                  </div>
                                  <span className="text-[11px] font-medium text-slate-600 bg-white dark:bg-slate-800 px-2 py-0.5 rounded-md border border-slate-200">
                                    {member.relation}
                                  </span>
                                </div>
                                <div className="grid grid-cols-2 gap-x-2 gap-y-1 text-[11px] text-slate-600 pt-1 border-t border-slate-200/60">
                                  <div>
                                    <span className="text-slate-400">TTL:</span> {member.birthPlace},{' '}
                                    <span className="font-mono">
                                      {formatDateDDMMYYYY(member.birthDate)}
                                    </span>
                                  </div>
                                  <div>
                                    <span className="text-slate-400">Umur:</span>{' '}
                                    <strong className="font-mono text-slate-800">
                                      {calculateAge(member.birthDate)} thn
                                    </strong>{' '}
                                    ({member.gender === 'Laki-laki' ? 'L' : 'P'})
                                  </div>
                                  <div>
                                    <span className="text-slate-400">Agama:</span> {member.religion}
                                  </div>
                                  <div>
                                    <span className="text-slate-400">Urutan:</span> Anggota #
                                    {headMember ? idx + 2 : idx + 1}
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>

                          {/* Desktop Table View */}
                          <div className="hidden md:block overflow-x-auto border border-slate-100 rounded-xl">
                            <table className="w-full text-left text-xs border-collapse">
                            <thead>
                              <tr className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200">
                                <th className="py-2.5 px-3 w-10 text-center">No</th>
                                <th className="py-2.5 px-3">Nama Anggota</th>
                                <th className="py-2.5 px-3">Status Hubungan</th>
                                <th className="py-2.5 px-3">Tempat Lahir</th>
                                <th className="py-2.5 px-3">Tanggal Lahir (dd/mm/yyyy)</th>
                                <th className="py-2.5 px-3 text-center">Umur (Tahun)</th>
                                <th className="py-2.5 px-3">Jenis Kelamin</th>
                                <th className="py-2.5 px-3">Agama</th>
                                <th className="py-2.5 px-3">Urutan Anggota</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                              {headMember && (
                                <tr className="bg-emerald-50/40 font-medium">
                                  <td className="py-2.5 px-3 text-center text-emerald-700 font-bold font-mono tabular-nums">
                                    1
                                  </td>
                                  <td className="py-2.5 px-3 text-slate-900 font-bold flex items-center gap-1.5">
                                    <User className="w-3.5 h-3.5 text-emerald-600" />
                                    <span>{headMember.name}</span>
                                  </td>
                                  <td className="py-2.5 px-3 font-semibold text-emerald-800">
                                    Kepala Keluarga
                                  </td>
                                  <td className="py-2.5 px-3 text-slate-700">
                                    {headMember.birthPlace}
                                  </td>
                                  <td className="py-2.5 px-3 text-slate-700 font-mono tabular-nums">
                                    {formatDateDDMMYYYY(headMember.birthDate)}
                                  </td>
                                  <td className="py-2.5 px-3 text-center font-bold font-mono text-emerald-800 tabular-nums">
                                    {calculateAge(headMember.birthDate)} thn
                                  </td>
                                  <td className="py-2.5 px-3 text-slate-700">{headMember.gender}</td>
                                  <td className="py-2.5 px-3 text-slate-700">
                                    {headMember.religion}
                                  </td>
                                  <td className="py-2.5 px-3 text-slate-500">Utama (KK)</td>
                                </tr>
                              )}

                              {otherMembers.map((member, idx) => (
                                <tr
                                  key={member.id}
                                  className="hover:bg-slate-50 transition-colors"
                                >
                                  <td className="py-2.5 px-3 text-center text-slate-400 font-mono tabular-nums">
                                    {headMember ? idx + 2 : idx + 1}
                                  </td>
                                  <td className="py-2.5 px-3 text-slate-800 pl-6">
                                    {member.name}
                                  </td>
                                  <td className="py-2.5 px-3 text-slate-600">{member.relation}</td>
                                  <td className="py-2.5 px-3 text-slate-600">
                                    {member.birthPlace}
                                  </td>
                                  <td className="py-2.5 px-3 text-slate-600 font-mono tabular-nums">
                                    {formatDateDDMMYYYY(member.birthDate)}
                                  </td>
                                  <td className="py-2.5 px-3 text-center font-mono text-slate-800 tabular-nums">
                                    {calculateAge(member.birthDate)} thn
                                  </td>
                                  <td className="py-2.5 px-3 text-slate-600">{member.gender}</td>
                                  <td className="py-2.5 px-3 text-slate-600">{member.religion}</td>
                                  <td className="py-2.5 px-3 text-slate-500">
                                    Anggota #{headMember ? idx + 2 : idx + 1}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                        </>
                      )}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      )}

      {/* Modal Add / Edit Resident House & Members (Matching All Excel Columns) */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-4xl overflow-hidden my-8">
            <div className="bg-gradient-to-r from-emerald-600 to-teal-700 p-5 text-white flex justify-between items-center">
              <div>
                <h4 className="font-bold text-base">
                  {editingHouse
                    ? `Edit Buku Induk Warga: Blok ${editingHouse.blockNumber}`
                    : 'Input Buku Induk Rumah & Warga Baru (Sesuai Kolom Excel)'}
                </h4>
                <p className="text-xs text-emerald-100">
                  Formulir buku induk kependudukan dengan kolom yang sama persis dengan template Excel
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="text-white/80 hover:text-white cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveHouse} className="p-6 space-y-5 max-h-[80vh] overflow-y-auto">
              {/* Section 1: Data Kolom Rumah & Tagihan Excel */}
              <div className="space-y-3">
                <h5 className="text-xs font-bold text-emerald-800 uppercase tracking-wider">
                  1. Kolom Identitas Blok, Hunian, Fasilitas & Iuran (Standar Excel)
                </h5>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      No Blok
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="K2/25"
                      value={formBlock}
                      onChange={(e) => setFormBlock(e.target.value)}
                      className="w-full px-3 py-2 text-xs font-mono border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Kepala Keluarga
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="Nama Kepala Keluarga..."
                      value={formHeadName}
                      onChange={(e) => setFormHeadName(e.target.value)}
                      className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      No Telepon / WA
                    </label>
                    <input
                      type="text"
                      placeholder="081287654321"
                      value={formPhone}
                      onChange={(e) => setFormPhone(e.target.value)}
                      className="w-full px-3 py-2 text-xs font-mono border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Status Kepemilikan
                    </label>
                    <select
                      value={formOwnership}
                      onChange={(e) => setFormOwnership(e.target.value as OwnershipStatus)}
                      className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                    >
                      <option value="Milik Sendiri">Milik Sendiri</option>
                      <option value="Kontrak">Kontrak</option>
                      <option value="Milik Orang Lain">Milik Orang Lain</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Status Rumah
                    </label>
                    <select
                      value={formOccupancy}
                      onChange={(e) => {
                        const next = e.target.value as OccupancyStatus;
                        setFormOccupancy(next);
                        if (next === 'Kosong') {
                          setFormRukem('Tidak Ikut');
                        }
                      }}
                      className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                    >
                      <option value="Ditempati">Ditempati</option>
                      <option value="Belum Ditempati">Belum Ditempati</option>
                      <option value="Dikontrakan">Dikontrakan</option>
                      <option value="Kosong">Kosong</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Status Rukem
                    </label>
                    <select
                      value={formRukem}
                      onChange={(e) => setFormRukem(e.target.value as RukemStatus)}
                      className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                    >
                      <option value="Ikut Rukem">Ikut Rukem</option>
                      <option value="Tidak Ikut">Tidak Ikut</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Status WiFi
                    </label>
                    <select
                      value={formWifiStatus}
                      onChange={(e) => setFormWifiStatus(e.target.value as WifiStatus)}
                      className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                    >
                      <option value="Pasang">Pasang</option>
                      <option value="Tidak Pasang">Tidak Pasang</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Provider WiFi (Jika Pasang)
                    </label>
                    <input
                      type="text"
                      disabled={formWifiStatus !== 'Pasang'}
                      placeholder="Indihome, Biznet, MyRepublic..."
                      value={formWifiStatus === 'Pasang' ? formWifiProvider : '-'}
                      onChange={(e) => setFormWifiProvider(e.target.value)}
                      className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:outline-none disabled:bg-slate-100"
                    />
                  </div>
                </div>
              </div>

              {/* Section 2: Family Members Editor */}
              <div className="space-y-3 pt-3 border-t border-slate-200">
                <div className="flex items-center justify-between">
                  <h5 className="text-xs font-bold text-emerald-800 uppercase tracking-wider">
                    2. Baris Anggota Keluarga ({formMembers.length} Baris Excel)
                  </h5>
                  <button
                    type="button"
                    onClick={handleAddMemberToForm}
                    className="flex items-center gap-1 text-xs font-semibold text-emerald-700 hover:text-emerald-800 bg-emerald-50 hover:bg-emerald-100 px-3 py-1.5 rounded-lg border border-emerald-200 transition-colors cursor-pointer"
                  >
                    <UserPlus className="w-3.5 h-3.5" />
                    <span>Tambah Baris Anggota</span>
                  </button>
                </div>

                <div className="space-y-3">
                  {formMembers.map((member, index) => (
                    <div
                      key={member.id || index}
                      className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl space-y-2.5 relative"
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-emerald-900">
                          {index === 0
                            ? 'Urutan Anggota: Utama (KK) — Baris Pertama'
                            : `Urutan Anggota: Anggota #${index + 1}`}
                        </span>
                        {formMembers.length > 1 && (
                          <button
                            type="button"
                            onClick={() => handleRemoveMemberFromForm(index)}
                            className="text-rose-500 hover:text-rose-700 p-1 rounded hover:bg-rose-50 transition-colors cursor-pointer"
                            title="Hapus Baris Anggota Ini"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                        <div>
                          <label className="block text-[11px] font-semibold text-slate-600 mb-0.5">
                            Nama Anggota
                          </label>
                          <input
                            type="text"
                            required
                            value={member.name}
                            onChange={(e) => handleMemberChange(index, 'name', e.target.value)}
                            className="w-full px-2.5 py-1.5 text-xs bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-emerald-500"
                          />
                        </div>
                        <div>
                          <label className="block text-[11px] font-semibold text-slate-600 mb-0.5">
                            Status Hubungan
                          </label>
                          <select
                            value={member.relation}
                            onChange={(e) =>
                              handleMemberChange(index, 'relation', e.target.value as FamilyRole)
                            }
                            className="w-full px-2.5 py-1.5 text-xs bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-emerald-500"
                          >
                            <option value="Kepala Keluarga">Kepala Keluarga</option>
                            <option value="Istri">Istri</option>
                            <option value="Anak">Anak</option>
                            <option value="Orang Tua">Orang Tua</option>
                            <option value="Famili Lain">Famili Lain</option>
                          </select>
                        </div>
                        <div>
                          <label className="block text-[11px] font-semibold text-slate-600 mb-0.5">
                            Tempat Lahir
                          </label>
                          <input
                            type="text"
                            required
                            value={member.birthPlace}
                            onChange={(e) =>
                              handleMemberChange(index, 'birthPlace', e.target.value)
                            }
                            className="w-full px-2.5 py-1.5 text-xs bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-emerald-500"
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                        <div>
                          <label className="block text-[11px] font-semibold text-slate-600 mb-0.5">
                            Tanggal Lahir (dd/mm/yyyy)
                          </label>
                          <input
                            type="date"
                            required
                            value={member.birthDate}
                            onChange={(e) =>
                              handleMemberChange(index, 'birthDate', e.target.value)
                            }
                            className="w-full px-2.5 py-1.5 text-xs bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-emerald-500"
                          />
                          <span className="text-[10px] text-slate-500 mt-0.5 block font-mono">
                            Excel: {formatDateDDMMYYYY(member.birthDate)} · Umur: {calculateAge(member.birthDate)} thn
                          </span>
                        </div>
                        <div>
                          <label className="block text-[11px] font-semibold text-slate-600 mb-0.5">
                            Jenis Kelamin
                          </label>
                          <select
                            value={member.gender}
                            onChange={(e) =>
                              handleMemberChange(index, 'gender', e.target.value as Gender)
                            }
                            className="w-full px-2.5 py-1.5 text-xs bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-emerald-500"
                          >
                            <option value="Laki-laki">Laki-laki</option>
                            <option value="Perempuan">Perempuan</option>
                          </select>
                        </div>
                        <div>
                          <label className="block text-[11px] font-semibold text-slate-600 mb-0.5">
                            Agama
                          </label>
                          <select
                            value={member.religion}
                            onChange={(e) =>
                              handleMemberChange(index, 'religion', e.target.value as Religion)
                            }
                            className="w-full px-2.5 py-1.5 text-xs bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-emerald-500"
                          >
                            <option value="Islam">Islam</option>
                            <option value="Kristen">Kristen</option>
                            <option value="Katolik">Katolik</option>
                            <option value="Hindu">Hindu</option>
                            <option value="Buddha">Buddha</option>
                            <option value="Konghucu">Konghucu</option>
                          </select>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 text-xs text-slate-600 hover:bg-slate-100 rounded-lg cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 text-xs bg-emerald-600 hover:bg-emerald-700 text-white font-semibold rounded-lg shadow-sm cursor-pointer"
                >
                  Simpan ke Buku Induk
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Excel Upload & Import Modal */}
      <ExcelUploadModal
        isOpen={isUploadModalOpen}
        onClose={() => setIsUploadModalOpen(false)}
        onImportResidents={onImportResidents || (() => {})}
      />
    </div>
  );
};
