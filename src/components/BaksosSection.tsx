import React, { useState } from 'react';
import {
  AlertCircle,
  Calendar,
  Check,
  CheckCircle2,
  Download,
  Edit2,
  FileSpreadsheet,
  Home,
  MapPin,
  Plus,
  Share2,
  ShieldCheck,
  Trash2,
  Upload,
  Users,
  X,
} from 'lucide-react';
import { BaksosAgenda, BaksosAttendanceStatus, ResidentHouse, SiteConfig } from '../types';
import {
  formatDateDDMMYYYY,
  formatRupiah,
  getBaksosAttendanceForHouse,
  isBaksosFinePaidForHouse,
  isHouseVacant,
  openWhatsAppShare,
} from '../utils/helpers';
import { downloadBaksosExcelTemplate } from '../utils/baksosExcelHelper';
import { BaksosExcelUploadModal } from './BaksosExcelUploadModal';

interface BaksosSectionProps {
  config: SiteConfig;
  agendas: BaksosAgenda[];
  residents: ResidentHouse[];
  isAdmin: boolean;
  onAddAgenda: (agenda: Omit<BaksosAgenda, 'id'>) => void;
  onEditAgenda: (agenda: BaksosAgenda) => void;
  onDeleteAgenda: (id: string) => void;
  onSetAttendance: (agendaId: string, residentId: string, status: BaksosAttendanceStatus) => void;
  onMarkFinePaid: (agendaId: string, residentId: string, houseName: string, blockNo: string) => void;
  onUnmarkFinePaid?: (agendaId: string, residentId: string) => void;
  onOpenConfigModal: () => void;
}

export const BaksosSection: React.FC<BaksosSectionProps> = ({
  config,
  agendas,
  residents,
  isAdmin,
  onAddAgenda,
  onEditAgenda,
  onDeleteAgenda,
  onSetAttendance,
  onMarkFinePaid,
  onUnmarkFinePaid,
  onOpenConfigModal,
}) => {
  const [selectedAgendaId, setSelectedAgendaId] = useState<string>(
    agendas[0]?.id || ''
  );
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isBaksosUploadModalOpen, setIsBaksosUploadModalOpen] = useState(false);
  const [editingAgenda, setEditingAgenda] = useState<BaksosAgenda | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  // Form states
  const [title, setTitle] = useState('');
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [location, setLocation] = useState('Pos Gang Mandor');
  const [description, setDescription] = useState('');

  const currentAgenda = agendas.find((a) => a.id === selectedAgendaId) || agendas[0];

  const handleOpenAdd = () => {
    setEditingAgenda(null);
    setTitle('');
    setDate(new Date().toISOString().slice(0, 10));
    setLocation('Pos Gang Mandor');
    setDescription('');
    setIsModalOpen(true);
  };

  const handleOpenEdit = (agenda: BaksosAgenda) => {
    setEditingAgenda(agenda);
    setTitle(agenda.title);
    setDate(agenda.date);
    setLocation(agenda.location);
    setDescription(agenda.description);
    setIsModalOpen(true);
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;

    if (editingAgenda) {
      onEditAgenda({
        ...editingAgenda,
        title,
        date,
        location,
        description,
      });
    } else {
      // Initialize attendance: 'Kosong' for empty houses, 'Tidak Wajib' for Kontrak/Dikontrakan, and 'Hadir' for others
      const initialAttendance: Record<string, BaksosAttendanceStatus> = {};
      residents.forEach((h) => {
        if (h.occupancy === 'Kosong') {
          initialAttendance[h.id] = 'Kosong';
        } else if (h.ownership === 'Kontrak' || h.occupancy === 'Dikontrakan') {
          initialAttendance[h.id] = 'Tidak Wajib';
        } else {
          initialAttendance[h.id] = 'Hadir';
        }
      });
      onAddAgenda({
        title,
        date,
        location,
        description,
        attendance: initialAttendance,
        finesPaid: {},
      });
    }
    setIsModalOpen(false);
  };

  const handleShareAgendaWA = (agenda: BaksosAgenda) => {
    const presentCount = Object.values(agenda.attendance || {}).filter((s) => s === 'Hadir').length;
    const absentCount = Object.values(agenda.attendance || {}).filter((s) => s === 'Tidak Hadir').length;
    const exemptCount = Object.values(agenda.attendance || {}).filter((s) => s === 'Tidak Wajib').length;
    const emptyCount = Object.values(agenda.attendance || {}).filter((s) => s === 'Kosong').length;

    let text =
      `🧹 *REKAP KEHADIRAN BAKTI SOSIAL GANG MANDOR*\n` +
      `📌 *Kegiatan:* ${agenda.title}\n` +
      `📅 *Tanggal:* ${formatDateDDMMYYYY(agenda.date)}\n` +
      `📍 *Lokasi:* ${agenda.location}\n` +
      `────────────────────\n` +
      `✅ Hadir: ${presentCount} | ❌ Tidak Hadir: ${absentCount} | 🛡️ Tidak Wajib: ${exemptCount} | 🏠 Kosong: ${emptyCount}\n` +
      `💡 *Catatan:* Denda Rp 10.000 berlaku khusus bagi warga berstatus *Tidak Hadir* dan disalurkan ke kas gang.\n\n` +
      `*Daftar Presensi Warga:*\n`;

    residents.forEach((h) => {
      const isContract = h.ownership === 'Kontrak' || h.occupancy === 'Dikontrakan';
      const defaultStatus: BaksosAttendanceStatus =
        h.occupancy === 'Kosong' || isHouseVacant(h) ? 'Kosong' : isContract ? 'Tidak Wajib' : 'Hadir';
      const status = getBaksosAttendanceForHouse(agenda, h, residents) || defaultStatus;
      const isFinePaid = isBaksosFinePaidForHouse(agenda, h, residents);
      const fineNote =
        status === 'Tidak Hadir'
          ? isFinePaid
            ? ' [Denda Lunas]'
            : ' [Denda Rp 10rb]'
          : '';
      text += `• Blok ${h.blockNumber} (${h.headName}): ${status}${fineNote}\n`;
    });

    openWhatsAppShare(text);
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-300">
      {/* Header Info */}
      {/* HEADER BANNER: 1. Judul di atas -> 2. Deskripsi di bawahnya -> 3. Menu-menu lainnya di bawahnya lagi */}
      <div className="bg-gradient-to-r from-emerald-800 via-teal-800 to-indigo-900 text-white rounded-3xl p-5 sm:p-7 shadow-lg border-b-4 border-emerald-400 space-y-4">
        {/* 1. Judul Halaman di Bagian Atas */}
        <div className="flex items-center gap-2.5 flex-wrap">
          <div className="p-2.5 bg-white/15 text-white border border-white/20 rounded-2xl backdrop-blur-xs">
            <Users className="w-5 h-5 text-amber-300" />
          </div>
          <h2 className="text-xl sm:text-2xl font-black text-white tracking-tight">
            {config.baksosSectionTitle !== undefined
              ? config.baksosSectionTitle
              : 'Agenda Bakti Sosial & Integrasi Denda Kas'}
          </h2>
          <span className="px-3 py-1 rounded-full text-xs font-black bg-amber-400 text-slate-950 shadow-sm uppercase tracking-wider">
            Gotong Royong
          </span>
        </div>

        {/* 2. Deskripsi Halaman di Bawahnya */}
        <div className="space-y-2">
          {config.baksosDescription && (
            <p className="text-xs sm:text-sm text-emerald-100 max-w-3xl leading-relaxed">
              {config.baksosDescription}
            </p>
          )}
          <div className="text-xs text-white bg-white/15 border border-white/20 px-3.5 py-2 rounded-xl inline-block backdrop-blur-xs font-medium">
            Pilihan Status Presensi: <strong className="text-emerald-300">Hadir</strong>, <strong className="text-rose-300">Tidak Hadir</strong> (Denda Rp 10.000), <strong className="text-amber-300">Tidak Wajib</strong> (Bebas Denda), dan <strong className="text-cyan-300">Kosong</strong> (Rumah Kosong/Bebas Denda).
          </div>
        </div>

        {/* 3. Menu-menu Lainnya di Bawahnya Lagi */}
        {isAdmin && (
          <div className="pt-2 border-t border-emerald-700/60 flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={handleOpenAdd}
              className="flex items-center gap-1.5 px-4 py-2.5 text-xs font-black bg-gradient-to-r from-emerald-400 to-amber-300 hover:from-emerald-300 hover:to-amber-200 text-slate-950 rounded-xl shadow-md transition-all cursor-pointer whitespace-nowrap"
            >
              <Plus className="w-4 h-4" />
              <span>Tambah Agenda Baksos</span>
            </button>
            {currentAgenda && (
              <>
                <button
                  type="button"
                  onClick={() => downloadBaksosExcelTemplate(currentAgenda, residents)}
                  className="flex items-center gap-1.5 px-3.5 py-2.5 text-xs font-extrabold bg-white hover:bg-slate-100 text-slate-900 rounded-xl shadow-md transition-all cursor-pointer whitespace-nowrap"
                  title="Download Template Excel Presensi Baksos (Format Sama Web)"
                >
                  <Download className="w-4 h-4 text-emerald-700" />
                  <span>Download Template Excel</span>
                </button>
                <button
                  type="button"
                  onClick={() => setIsBaksosUploadModalOpen(true)}
                  className="flex items-center gap-1.5 px-3.5 py-2.5 text-xs font-black bg-amber-400 hover:bg-amber-300 text-slate-950 rounded-xl shadow-md transition-all cursor-pointer whitespace-nowrap"
                  title="Upload Excel Presensi Baksos untuk update massal kehadiran dan denda"
                >
                  <Upload className="w-4 h-4 text-slate-950" />
                  <span>Upload Excel Presensi</span>
                </button>
              </>
            )}
            <button
              type="button"
              onClick={onOpenConfigModal}
              className="p-2.5 text-white/80 hover:text-white bg-white/10 hover:bg-white/20 rounded-xl border border-white/20 transition-colors cursor-pointer"
              title="Edit Deskripsi Baksos"
            >
              <Edit2 className="w-4 h-4 text-amber-200" />
            </button>
          </div>
        )}
      </div>

      {/* Agendas Tabs / List */}
      <div className="flex gap-2 overflow-x-auto pb-1 no-scrollbar">
        {agendas.map((agenda) => {
          const isSelected = agenda.id === (currentAgenda?.id || '');
          return (
            <button
              key={agenda.id}
              type="button"
              onClick={() => setSelectedAgendaId(agenda.id)}
              className={`px-4 py-2.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all border text-left cursor-pointer ${
                isSelected
                  ? 'bg-gradient-to-r from-emerald-600 to-teal-600 text-white border-emerald-600 shadow-sm'
                  : 'bg-white hover:bg-emerald-50/50 text-slate-700 border-slate-200'
              }`}
            >
              <div className="flex items-center gap-1.5 font-mono tabular-nums">
                <Calendar className="w-3.5 h-3.5" />
                <span>{formatDateDDMMYYYY(agenda.date)}</span>
              </div>
              <div className="text-xs mt-0.5 truncate max-w-[220px] opacity-95">
                {agenda.title}
              </div>
            </button>
          );
        })}
      </div>

      {/* Current Agenda Detail & Attendance Table */}
      {currentAgenda && (
        <div className="bg-gradient-to-br from-emerald-50/60 via-teal-50/40 to-cyan-50/60 rounded-2xl border border-emerald-200 overflow-hidden shadow-xs space-y-6 p-4 sm:p-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-slate-100">
            <div>
              <div className="flex items-center gap-2 text-xs text-slate-500 mb-1">
                <span className="flex items-center gap-1 font-mono tabular-nums">
                  <Calendar className="w-3.5 h-3.5 text-emerald-600" />
                  {formatDateDDMMYYYY(currentAgenda.date)}
                </span>
                <span>·</span>
                <span className="flex items-center gap-1">
                  <MapPin className="w-3.5 h-3.5 text-teal-600" />
                  {currentAgenda.location}
                </span>
              </div>
              <h3 className="text-base sm:text-lg font-bold text-slate-900">
                {currentAgenda.title}
              </h3>
              <p className="text-xs text-slate-600 mt-1 max-w-3xl leading-relaxed">
                {currentAgenda.description}
              </p>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              {isAdmin && (
                <button
                  type="button"
                  onClick={() => handleShareAgendaWA(currentAgenda)}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-emerald-50 text-emerald-800 hover:bg-emerald-100 border border-emerald-200 rounded-xl transition-colors cursor-pointer whitespace-nowrap"
                >
                  <Share2 className="w-3.5 h-3.5 text-emerald-600" />
                  <span>Bagikan Rekap ke WA</span>
                </button>
              )}
              {isAdmin && (
                <>
                  <button
                    type="button"
                    onClick={() => handleOpenEdit(currentAgenda)}
                    className="p-1.5 text-slate-600 hover:text-emerald-700 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
                    title="Edit Agenda Baksos"
                  >
                    <Edit2 className="w-4 h-4" />
                  </button>
                  {deleteConfirmId === currentAgenda.id ? (
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => {
                          onDeleteAgenda(currentAgenda.id);
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
                      onClick={() => setDeleteConfirmId(currentAgenda.id)}
                      className="p-1.5 text-slate-600 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                      title="Hapus Agenda Baksos"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </>
              )}
            </div>
          </div>

          {/* Colorful Quick Metrics of Attendance */}
          {(() => {
            const getStatus = (h: ResidentHouse): BaksosAttendanceStatus => {
              const isContract = h.ownership === 'Kontrak' || h.occupancy === 'Dikontrakan';
              const defaultStatus: BaksosAttendanceStatus =
                h.occupancy === 'Kosong' || isHouseVacant(h) ? 'Kosong' : isContract ? 'Tidak Wajib' : 'Hadir';
              return getBaksosAttendanceForHouse(currentAgenda, h, residents) || defaultStatus;
            };

            const hadir = residents.filter((h) => getStatus(h) === 'Hadir').length;
            const tidakHadir = residents.filter((h) => getStatus(h) === 'Tidak Hadir').length;
            const tidakWajib = residents.filter((h) => getStatus(h) === 'Tidak Wajib').length;
            const kosong = residents.filter((h) => getStatus(h) === 'Kosong').length;

            const dendaLunasCount = residents.filter(
              (h) => getStatus(h) === 'Tidak Hadir' && isBaksosFinePaidForHouse(currentAgenda, h, residents)
            ).length;
            const dendaBelumCount = Math.max(0, tidakHadir - dendaLunasCount);

            return (
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
                <div className="p-3.5 bg-gradient-to-br from-emerald-500 to-teal-600 text-white rounded-xl text-center shadow-xs">
                  <span className="block text-2xl font-black font-mono tabular-nums">
                    {hadir}
                  </span>
                  <span className="text-xs font-semibold text-emerald-50">Warga Hadir</span>
                </div>

                <div className="p-3.5 bg-gradient-to-br from-rose-500 to-red-600 text-white rounded-xl text-center shadow-xs">
                  <span className="block text-2xl font-black font-mono tabular-nums">
                    {tidakHadir}
                  </span>
                  <span className="text-xs font-semibold text-rose-50">Tidak Hadir (Denda)</span>
                </div>

                <div className="p-3.5 bg-gradient-to-br from-violet-500 to-purple-600 text-white rounded-xl text-center shadow-xs">
                  <span className="block text-2xl font-black font-mono tabular-nums">
                    {tidakWajib}
                  </span>
                  <span className="text-xs font-semibold text-purple-50">Tidak Wajib</span>
                </div>

                <div className="p-3.5 bg-gradient-to-br from-slate-500 to-slate-700 text-white rounded-xl text-center shadow-xs">
                  <span className="block text-2xl font-black font-mono tabular-nums">
                    {kosong}
                  </span>
                  <span className="text-xs font-semibold text-slate-100">Rumah Kosong</span>
                </div>

                <div className="p-3.5 bg-gradient-to-br from-cyan-500 to-blue-600 text-white rounded-xl text-center shadow-xs">
                  <span className="block text-2xl font-black font-mono tabular-nums">
                    {dendaLunasCount}
                  </span>
                  <span className="text-xs font-semibold text-cyan-50">Denda Lunas</span>
                </div>

                <div className="p-3.5 bg-gradient-to-br from-amber-500 to-orange-600 text-white rounded-xl text-center shadow-xs">
                  <span className="block text-xl font-black font-mono tabular-nums">
                    {formatRupiah(dendaBelumCount * 10000)}
                  </span>
                  <span className="text-xs font-semibold text-amber-50">Denda Tertunggak</span>
                </div>
              </div>
            );
          })()}

          {/* Attendance Roster Table */}
          <div className="space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-1">
              <h4 className="font-bold text-sm text-slate-800 flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                <span>Daftar Presensi Seluruh Warga (Hadir / Tidak Hadir / Tidak Wajib / Kosong)</span>
              </h4>
              <span className="text-xs text-slate-500">
                *Warga <strong>Kontrak / Dikontrakan</strong> otomatis terisi <strong>Tidak Wajib</strong> (Bebas Denda)
              </span>
            </div>

            {/* Keterangan Warna Otomatis Sama Persis Dengan Rekap Iuran Per KK */}
            <div className="flex flex-wrap items-center gap-2.5 sm:gap-3 text-xs bg-white/95 rounded-2xl p-3 sm:px-4 border border-slate-200/90 shadow-2xs">
              <span className="font-bold text-slate-700 text-xs">Keterangan Warna Presensi:</span>
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-neutral-950 text-white font-bold border border-neutral-800 text-[11px] shadow-2xs">
                <span className="w-2.5 h-2.5 rounded-full bg-neutral-400"></span>
                Rumah Kosong (Hitam / Bebas Denda)
              </span>
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-sky-100 text-sky-950 font-bold border border-sky-300 text-[11px] shadow-2xs">
                <span className="w-2.5 h-2.5 rounded-full bg-sky-500"></span>
                Tidak Wajib (Biru Muda / Kontrak)
              </span>
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-emerald-100 text-emerald-950 font-bold border border-emerald-300 text-[11px] shadow-2xs">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500"></span>
                Hadir / Denda Lunas (Hijau Muda)
              </span>
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-rose-100 text-rose-950 font-bold border border-rose-300 text-[11px] shadow-2xs">
                <span className="w-2.5 h-2.5 rounded-full bg-rose-500"></span>
                Tidak Hadir (Merah Muda / Denda Rp 10.000)
              </span>
            </div>

            <div className="overflow-x-auto rounded-2xl border border-slate-300/90 shadow-sm bg-white">
              <table className="w-full text-left text-xs border-collapse border border-slate-300 whitespace-nowrap">
                <thead>
                  <tr className="border-b border-slate-300 bg-gradient-to-r from-emerald-950 via-teal-900 to-slate-900 text-white font-extrabold">
                    <th className="py-3 px-3 text-center w-12 border border-slate-300/80 text-white">No</th>
                    <th className="py-3 px-3 text-center w-28 border border-slate-300/80 text-white">No Blok</th>
                    <th className="py-3 px-4 text-left min-w-[200px] border border-slate-300/80 text-white">Nama Kepala Keluarga</th>
                    <th className="py-3 px-4 text-center w-56 border border-slate-300/80 text-white">Status Kehadiran</th>
                    <th className="py-3 px-4 text-center w-60 border border-slate-300/80 text-white">Denda Bakti Sosial (Rp 10.000)</th>
                    {isAdmin && <th className="py-3 px-3 text-center w-48 border border-slate-300/80 text-white">Integrasi Kas & Aksi</th>}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-300">
                  {residents.map((house, idx) => {
                    const isContract =
                      house.ownership === 'Kontrak' || house.occupancy === 'Dikontrakan';
                    const defaultHouseStatus: BaksosAttendanceStatus =
                      house.occupancy === 'Kosong' || isHouseVacant(house)
                        ? 'Kosong'
                        : isContract
                        ? 'Tidak Wajib'
                        : 'Hadir';
                    const status: BaksosAttendanceStatus =
                      getBaksosAttendanceForHouse(currentAgenda, house, residents) || defaultHouseStatus;
                    const isAbsentWithFine = status === 'Tidak Hadir';
                    const isFinePaid = isBaksosFinePaidForHouse(currentAgenda, house, residents);

                    const statusOptions: {
                      val: BaksosAttendanceStatus;
                      label: string;
                      activeClass: string;
                    }[] = [
                      {
                        val: 'Hadir',
                        label: 'Hadir',
                        activeClass: 'bg-emerald-600 text-white shadow-xs',
                      },
                      {
                        val: 'Tidak Hadir',
                        label: 'Tidak Hadir',
                        activeClass: 'bg-rose-600 text-white shadow-xs',
                      },
                      {
                        val: 'Tidak Wajib',
                        label: 'Tidak Wajib',
                        activeClass: 'bg-sky-600 text-white shadow-xs',
                      },
                      {
                        val: 'Kosong',
                        label: 'Kosong',
                        activeClass: 'bg-slate-700 text-white shadow-xs',
                      },
                    ];

                    const isRumahKosongHitam =
                      house.occupancy === 'Kosong' || status === 'Kosong' || isHouseVacant(house);
                    const isTidakWajibBiru = !isRumahKosongHitam && status === 'Tidak Wajib';
                    const isHadirOrLunas =
                      !isRumahKosongHitam && !isTidakWajibBiru && (status === 'Hadir' || isFinePaid);
                    const isTidakHadirMerah =
                      !isRumahKosongHitam && !isTidakWajibBiru && !isHadirOrLunas;

                    const rowCellClass = isRumahKosongHitam
                      ? 'bg-neutral-950 text-white border-neutral-800'
                      : isTidakWajibBiru
                      ? 'bg-sky-50 text-sky-950 border-sky-300 font-medium'
                      : isHadirOrLunas
                      ? 'bg-emerald-50 text-emerald-950 border-emerald-300 font-medium'
                      : 'bg-rose-50 text-rose-950 border-rose-300 font-medium';

                    const rowHoverClass = isRumahKosongHitam
                      ? 'hover:bg-neutral-900'
                      : isTidakWajibBiru
                      ? 'hover:bg-sky-100/60'
                      : isHadirOrLunas
                      ? 'hover:bg-emerald-100/60'
                      : 'hover:bg-rose-100/60';

                    const payerName = isRumahKosongHitam
                      ? (house.duesHeadNameOverride && house.duesHeadNameOverride.toLowerCase().includes('kosong')
                          ? house.duesHeadNameOverride
                          : `Rumah Kosong (${house.headName || 'Tanpa Penghuni'})`)
                      : (house.duesHeadNameOverride || house.headName || '-');

                    return (
                      <tr
                        key={house.id}
                        className={`transition-colors border-b ${
                          isRumahKosongHitam
                            ? 'bg-black text-white border-neutral-800 hover:bg-neutral-900'
                            : isTidakWajibBiru
                            ? 'bg-sky-50 text-sky-950 border-sky-300 hover:bg-sky-100/60'
                            : isHadirOrLunas
                            ? 'bg-emerald-50 text-emerald-950 border-emerald-300 hover:bg-emerald-100/60'
                            : 'bg-rose-50 text-rose-950 border-rose-300 hover:bg-rose-100/60'
                        } ${rowHoverClass}`}
                      >
                        {/* 1. No */}
                        <td className={`py-2.5 px-3 text-center font-mono border ${rowCellClass} ${isRumahKosongHitam ? 'text-slate-300' : 'text-slate-600'}`}>
                          {idx + 1}
                        </td>

                        {/* 2. No Blok */}
                        <td className={`py-2.5 px-3 text-center border ${rowCellClass}`}>
                          <span
                            className={`font-mono text-xs font-bold px-2.5 py-1 rounded-lg border shadow-2xs ${
                              isRumahKosongHitam
                                ? 'bg-neutral-900 text-white border-neutral-700'
                                : isTidakWajibBiru
                                ? 'bg-sky-200/90 text-sky-950 border-sky-400'
                                : isHadirOrLunas
                                ? 'bg-emerald-200/90 text-emerald-950 border-emerald-400'
                                : 'bg-rose-200/90 text-rose-950 border-rose-400'
                            }`}
                          >
                            Blok {house.blockNumber}
                          </span>
                        </td>

                        {/* 3. Nama Kepala Keluarga */}
                        <td className={`py-2.5 px-4 border ${rowCellClass}`}>
                          <div className="flex flex-col">
                            <span
                              className={`font-bold ${
                                isRumahKosongHitam
                                  ? 'text-white'
                                  : isTidakWajibBiru
                                  ? 'text-sky-950'
                                  : isHadirOrLunas
                                  ? 'text-emerald-950'
                                  : 'text-rose-950'
                              }`}
                            >
                              {payerName}
                            </span>
                            {isContract && (
                              <span className={`text-[10px] font-bold ${isRumahKosongHitam ? 'text-neutral-400' : 'text-sky-800'}`}>
                                Kontrak · Otomatis Tidak Wajib
                              </span>
                            )}
                            {isRumahKosongHitam && !isContract && (
                              <span className="text-[10px] font-medium text-neutral-400">
                                Rumah Kosong · Bebas Presensi & Denda
                              </span>
                            )}
                          </div>
                        </td>

                        {/* 4. Status Kehadiran */}
                        <td className={`py-2.5 px-3 text-center border ${rowCellClass}`}>
                          {isAdmin ? (
                            <div className="inline-flex flex-wrap items-center gap-0.5 p-1 bg-white/80 dark:bg-slate-900/80 rounded-xl border border-slate-300/80 shadow-2xs">
                              {statusOptions.map((opt) => (
                                <button
                                  key={opt.val}
                                  type="button"
                                  onClick={() =>
                                    onSetAttendance(currentAgenda.id, house.id, opt.val)
                                  }
                                  className={`px-2 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer whitespace-nowrap ${
                                    status === opt.val
                                      ? opt.activeClass
                                      : isRumahKosongHitam
                                      ? 'text-slate-400 hover:text-white hover:bg-neutral-800'
                                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                                  }`}
                                >
                                  {opt.label}
                                </button>
                              ))}
                            </div>
                          ) : (
                            <span
                              className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-xl font-bold text-xs shadow-2xs border ${
                                isRumahKosongHitam
                                  ? 'bg-neutral-900 text-white border-neutral-700'
                                  : isTidakWajibBiru
                                  ? 'bg-sky-200/90 text-sky-950 border-sky-400'
                                  : isHadirOrLunas
                                  ? 'bg-emerald-200/90 text-emerald-950 border-emerald-400'
                                  : 'bg-rose-200/90 text-rose-950 border-rose-400'
                              }`}
                            >
                              {status === 'Hadir' && <Check className="w-3.5 h-3.5 text-emerald-700" />}
                              {status === 'Tidak Hadir' && <X className="w-3.5 h-3.5 text-rose-700" />}
                              {status === 'Tidak Wajib' && <ShieldCheck className="w-3.5 h-3.5 text-sky-700" />}
                              {status === 'Kosong' && <Home className="w-3.5 h-3.5 text-slate-300" />}
                              <span>{status}</span>
                            </span>
                          )}
                        </td>

                        {/* 5. Denda Bakti Sosial (Rp 10.000) */}
                        <td className={`py-2.5 px-3 text-center border ${rowCellClass}`}>
                          {status === 'Hadir' ? (
                            <span className="text-emerald-800 text-xs font-bold">
                              Bebas Denda (Hadir)
                            </span>
                          ) : status === 'Tidak Wajib' ? (
                            <span className="text-sky-800 text-xs font-bold">
                              Bebas Denda (Tidak Wajib)
                            </span>
                          ) : isRumahKosongHitam ? (
                            <span className="text-slate-300 text-xs italic">
                              Bebas Denda (Rumah Kosong)
                            </span>
                          ) : isFinePaid ? (
                            <span className="inline-flex items-center gap-1.5 text-emerald-900 font-black text-xs bg-emerald-200/80 px-2.5 py-1 rounded-lg border border-emerald-400 shadow-2xs">
                              <CheckCircle2 className="w-4 h-4 text-emerald-700" />
                              <span>Denda Lunas (Tercatat di Kas)</span>
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1.5 text-rose-950 font-black text-xs bg-rose-200/80 px-2.5 py-1 rounded-lg border border-rose-400 shadow-2xs">
                              <AlertCircle className="w-4 h-4 text-rose-700" />
                              <span>Denda Rp 10.000 (Belum Bayar)</span>
                            </span>
                          )}
                        </td>

                        {/* 6. Integrasi Kas & Aksi */}
                        {isAdmin && (
                          <td className={`py-2.5 px-3 text-center border ${rowCellClass}`}>
                            {isAbsentWithFine && !isFinePaid ? (
                              <button
                                type="button"
                                onClick={() =>
                                  onMarkFinePaid(
                                    currentAgenda.id,
                                    house.id,
                                    house.headName,
                                    house.blockNumber
                                  )
                                }
                                className="px-3 py-1.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold rounded-xl text-xs transition-all shadow-xs cursor-pointer whitespace-nowrap"
                              >
                                Bayar Denda & Catat ke Kas
                              </button>
                            ) : isAbsentWithFine && isFinePaid ? (
                              <div className="flex items-center justify-center gap-1.5">
                                <span className="text-xs text-emerald-800 font-extrabold bg-emerald-100/90 px-2 py-0.5 rounded-md border border-emerald-300">
                                  Tercatat di Kas
                                </span>
                                {onUnmarkFinePaid && (
                                  <button
                                    type="button"
                                    onClick={() => onUnmarkFinePaid(currentAgenda.id, house.id)}
                                    className="px-1.5 py-0.5 text-[10px] font-bold text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 rounded-md cursor-pointer transition-all active:scale-95"
                                    title="Batalkan pelunasan denda & bersihkan dari kas"
                                  >
                                    Batal
                                  </button>
                                )}
                              </div>
                            ) : (
                              <span className="text-xs text-slate-400 font-mono">-</span>
                            )}
                          </td>
                        )}
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot>
                  <tr className="bg-gradient-to-r from-slate-200 via-indigo-100/70 to-emerald-100/70 font-black text-slate-950 border-t-2 border-indigo-300">
                    <td colSpan={3} className="py-3 px-4 text-left border border-slate-300 text-slate-900 font-extrabold">
                      TOTAL WARGA ({residents.length} Kavling)
                    </td>
                    <td className="py-3 px-3 text-center font-mono border border-slate-300 font-black">
                      <span className="text-emerald-800">
                        {residents.filter((h) => (currentAgenda.attendance?.[h.id] || (h.occupancy === 'Kosong' ? 'Kosong' : h.ownership === 'Kontrak' || h.occupancy === 'Dikontrakan' ? 'Tidak Wajib' : 'Hadir')) === 'Hadir').length} Hadir
                      </span> · <span className="text-rose-700">
                        {residents.filter((h) => (currentAgenda.attendance?.[h.id] || (h.occupancy === 'Kosong' ? 'Kosong' : h.ownership === 'Kontrak' || h.occupancy === 'Dikontrakan' ? 'Tidak Wajib' : 'Hadir')) === 'Tidak Hadir').length} Tidak Hadir
                      </span>
                    </td>
                    <td className="py-3 px-3 text-center font-mono border border-slate-300 font-black">
                      <span className="text-rose-700">
                        Tertunggak: {formatRupiah(residents.filter((h) => (currentAgenda.attendance?.[h.id] || (h.occupancy === 'Kosong' ? 'Kosong' : h.ownership === 'Kontrak' || h.occupancy === 'Dikontrakan' ? 'Tidak Wajib' : 'Hadir')) === 'Tidak Hadir' && !currentAgenda.finesPaid?.[h.id]).length * 10000)}
                      </span>
                    </td>
                    {isAdmin && (
                      <td className="py-3 px-3 text-center font-mono text-emerald-800 border border-slate-300 font-black">
                        {residents.filter((h) => (currentAgenda.attendance?.[h.id] || (h.occupancy === 'Kosong' ? 'Kosong' : h.ownership === 'Kontrak' || h.occupancy === 'Dikontrakan' ? 'Tidak Wajib' : 'Hadir')) === 'Tidak Hadir' && currentAgenda.finesPaid?.[h.id]).length} Denda Lunas
                      </td>
                    )}
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Modal Add / Edit Baksos Agenda */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs">
          <div className="bg-white rounded-2xl shadow-xl border border-slate-200 w-full max-w-md overflow-hidden">
            <div className="bg-gradient-to-r from-emerald-600 to-teal-700 p-4 text-white flex justify-between items-center">
              <h4 className="font-bold text-sm">
                {editingAgenda ? 'Edit Agenda Bakti Sosial' : 'Tambah Agenda Bakti Sosial Baru'}
              </h4>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="text-white/80 hover:text-white cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={handleSave} className="p-5 space-y-3.5">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Nama Agenda / Kegiatan
                </label>
                <input
                  type="text"
                  required
                  placeholder="Misal: Kerja Bakti Saluran Air & Selokan..."
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Tanggal Pelaksanaan
                  </label>
                  <input
                    type="date"
                    required
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                    className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Lokasi Kumpul
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Pos Gang Mandor"
                    value={location}
                    onChange={(e) => setLocation(e.target.value)}
                    className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Deskripsi Kegiatan & Ketentuan
                </label>
                <textarea
                  rows={3}
                  required
                  placeholder="Keterangan peralatan yang dibawa, titik kerja bakti, dll..."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                />
              </div>
              <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-100 rounded-lg cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 text-xs bg-emerald-600 hover:bg-emerald-700 text-white font-semibold rounded-lg cursor-pointer"
                >
                  Simpan Agenda
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Upload Excel Presensi Baksos */}
      {isBaksosUploadModalOpen && currentAgenda && (
        <BaksosExcelUploadModal
          isOpen={isBaksosUploadModalOpen}
          onClose={() => setIsBaksosUploadModalOpen(false)}
          agenda={currentAgenda}
          residents={residents}
          onConfirmImport={(updatedAttendance, updatedFinesPaid) => {
            onEditAgenda({
              ...currentAgenda,
              attendance: updatedAttendance,
              finesPaid: updatedFinesPaid,
            });
          }}
        />
      )}
    </div>
  );
};
