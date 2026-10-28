import React, { useState } from 'react';
import {
  AlertCircle,
  Calendar,
  Check,
  CheckCircle2,
  Edit2,
  Home,
  MapPin,
  Plus,
  Share2,
  ShieldCheck,
  Trash2,
  Users,
  X,
} from 'lucide-react';
import { BaksosAgenda, BaksosAttendanceStatus, ResidentHouse, SiteConfig } from '../types';
import { formatDateDDMMYYYY, formatRupiah, isHouseVacant, openWhatsAppShare } from '../utils/helpers';

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
  onOpenConfigModal,
}) => {
  const [selectedAgendaId, setSelectedAgendaId] = useState<string>(
    agendas[0]?.id || ''
  );
  const [isModalOpen, setIsModalOpen] = useState(false);
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
        h.occupancy === 'Kosong' ? 'Kosong' : isContract ? 'Tidak Wajib' : 'Hadir';
      const status = isContract
        ? 'Tidak Wajib'
        : agenda.attendance?.[h.id] || defaultStatus;
      const isFinePaid = agenda.finesPaid?.[h.id];
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
          <div className="pt-2 border-t border-emerald-700/60 flex items-center gap-2">
            <button
              type="button"
              onClick={handleOpenAdd}
              className="flex items-center gap-1.5 px-4 py-2.5 text-xs font-black bg-gradient-to-r from-emerald-400 to-amber-300 hover:from-emerald-300 hover:to-amber-200 text-slate-950 rounded-xl shadow-md transition-all cursor-pointer whitespace-nowrap"
            >
              <Plus className="w-4 h-4" />
              <span>Tambah Agenda Baksos</span>
            </button>
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
              if (h.ownership === 'Kontrak' || h.occupancy === 'Dikontrakan') {
                return currentAgenda.attendance?.[h.id] || 'Tidak Wajib';
              }
              return (
                currentAgenda.attendance?.[h.id] ||
                (h.occupancy === 'Kosong' ? 'Kosong' : 'Hadir')
              );
            };

            const hadir = residents.filter((h) => getStatus(h) === 'Hadir').length;
            const tidakHadir = residents.filter((h) => getStatus(h) === 'Tidak Hadir').length;
            const tidakWajib = residents.filter((h) => getStatus(h) === 'Tidak Wajib').length;
            const kosong = residents.filter((h) => getStatus(h) === 'Kosong').length;

            const dendaLunasCount = residents.filter(
              (h) => getStatus(h) === 'Tidak Hadir' && currentAgenda.finesPaid?.[h.id]
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
          <div>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3">
              <h4 className="font-bold text-sm text-slate-800 flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                <span>Daftar Presensi Seluruh Warga (Hadir / Tidak Hadir / Tidak Wajib / Kosong)</span>
              </h4>
              <span className="text-xs text-slate-500">
                *Warga <strong>Kontrak / Dikontrakan</strong> otomatis terisi <strong>Tidak Wajib</strong> (Bebas Denda)
              </span>
            </div>

            <div className="overflow-x-auto border border-slate-200 rounded-xl">
              <table className="w-full text-left text-xs border-collapse whitespace-nowrap">
                <thead>
                  <tr className="bg-slate-100/90 border-b border-slate-200 text-slate-700 font-bold">
                    <th className="py-3 px-3 w-12 text-center">No</th>
                    <th className="py-3 px-3">Blok</th>
                    <th className="py-3 px-3">Kepala Keluarga</th>
                    <th className="py-3 px-3 text-center">Status Kehadiran</th>
                    <th className="py-3 px-3 text-center">Denda Bakti Sosial (Rp 10.000)</th>
                    {isAdmin && <th className="py-3 px-3 text-center">Integrasi Kas & Aksi</th>}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {residents.map((house, idx) => {
                    const isContract =
                      house.ownership === 'Kontrak' || house.occupancy === 'Dikontrakan';
                    const defaultHouseStatus: BaksosAttendanceStatus =
                      house.occupancy === 'Kosong'
                        ? 'Kosong'
                        : isContract
                        ? 'Tidak Wajib'
                        : 'Hadir';
                    const status: BaksosAttendanceStatus =
                      currentAgenda.attendance?.[house.id] || defaultHouseStatus;
                    const isAbsentWithFine = status === 'Tidak Hadir';
                    const isFinePaid = Boolean(currentAgenda.finesPaid?.[house.id]);

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
                        activeClass: 'bg-purple-600 text-white shadow-xs',
                      },
                      {
                        val: 'Kosong',
                        label: 'Kosong',
                        activeClass: 'bg-slate-600 text-white shadow-xs',
                      },
                    ];

                    const isVacant = house.occupancy === 'Kosong' || status === 'Kosong' || isHouseVacant(house);

                    return (
                      <tr
                        key={house.id}
                        className={`transition-colors ${
                          isVacant
                            ? 'bg-slate-100/90 text-slate-600 hover:bg-slate-200/50'
                            : isAbsentWithFine
                            ? 'bg-rose-50/30 hover:bg-slate-50/80'
                            : 'hover:bg-slate-50/80'
                        }`}
                      >
                        <td className="py-3 px-3 text-center text-slate-400 font-mono tabular-nums">
                          {idx + 1}
                        </td>
                        <td className="py-3 px-3 font-mono font-bold">
                          <span
                            className={
                              isVacant
                                ? 'px-2 py-0.5 rounded bg-slate-500 text-white text-xs'
                                : 'text-emerald-800'
                            }
                          >
                            Blok {house.blockNumber}
                          </span>
                        </td>
                        <td className="py-3 px-3">
                          <div
                            className={
                              isVacant
                                ? 'text-slate-700 italic font-semibold'
                                : 'font-semibold text-slate-800'
                            }
                          >
                            {isVacant
                              ? (house.duesHeadNameOverride && house.duesHeadNameOverride.toLowerCase().includes('kosong')
                                  ? house.duesHeadNameOverride
                                  : 'Rumah Kosong')
                              : (house.duesHeadNameOverride || house.headName)}
                          </div>
                          {isContract && (
                            <span className="text-[10px] font-medium text-purple-700">
                              Kontrak · Otomatis Tidak Wajib
                            </span>
                          )}
                          {isVacant && !isContract && (
                            <span className="text-[10px] font-medium text-slate-500">
                              Rumah Kosong · Bebas Presensi & Denda
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-3 text-center">
                          {isAdmin ? (
                            <div className="inline-flex flex-wrap items-center gap-0.5 p-1 bg-slate-100 rounded-xl border border-slate-200">
                              {statusOptions.map((opt) => (
                                <button
                                  key={opt.val}
                                  type="button"
                                  onClick={() =>
                                    onSetAttendance(currentAgenda.id, house.id, opt.val)
                                  }
                                  className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer whitespace-nowrap ${
                                    status === opt.val
                                      ? opt.activeClass
                                      : 'text-slate-600 hover:text-slate-900 hover:bg-white/60'
                                  }`}
                                >
                                  {opt.label}
                                </button>
                              ))}
                            </div>
                          ) : (
                            <span
                              className={`inline-flex items-center gap-1 font-bold text-xs ${
                                status === 'Hadir'
                                  ? 'text-emerald-700'
                                  : status === 'Tidak Hadir'
                                  ? 'text-rose-600'
                                  : status === 'Tidak Wajib'
                                  ? 'text-purple-700'
                                  : 'text-slate-500'
                              }`}
                            >
                              {status === 'Hadir' && <Check className="w-3.5 h-3.5" />}
                              {status === 'Tidak Hadir' && <X className="w-3.5 h-3.5" />}
                              {status === 'Tidak Wajib' && <ShieldCheck className="w-3.5 h-3.5" />}
                              {status === 'Kosong' && <Home className="w-3.5 h-3.5" />}
                              <span>{status}</span>
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-3 text-center">
                          {status === 'Hadir' ? (
                            <span className="text-emerald-600 text-xs font-medium">
                              Bebas Denda (Hadir)
                            </span>
                          ) : status === 'Tidak Wajib' ? (
                            <span className="text-purple-700 text-xs font-medium">
                              Bebas Denda (Tidak Wajib)
                            </span>
                          ) : status === 'Kosong' ? (
                            <span className="text-slate-400 text-xs italic">
                              Bebas Denda (Rumah Kosong)
                            </span>
                          ) : isFinePaid ? (
                            <span className="inline-flex items-center gap-1 text-teal-700 font-semibold text-xs">
                              <CheckCircle2 className="w-3.5 h-3.5" /> Denda Lunas (Masuk Kas)
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-rose-600 font-bold text-xs">
                              <AlertCircle className="w-3.5 h-3.5" /> Denda Rp 10.000 Belum Bayar
                            </span>
                          )}
                        </td>
                        {isAdmin && (
                          <td className="py-3 px-3 text-center">
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
                                className="px-3 py-1 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-semibold rounded-lg text-xs transition-all shadow-xs cursor-pointer"
                              >
                                Bayar Denda & Catat ke Kas
                              </button>
                            ) : isAbsentWithFine && isFinePaid ? (
                              <span className="text-xs text-teal-700 font-medium">Tercatat di Kas</span>
                            ) : (
                              <span className="text-xs text-slate-300">-</span>
                            )}
                          </td>
                        )}
                      </tr>
                    );
                  })}
                </tbody>
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
    </div>
  );
};
