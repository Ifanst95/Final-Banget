import React, { useState } from 'react';
import {
  AlertTriangle,
  Calendar,
  CheckCircle2,
  CreditCard,
  Edit2,
  FileSpreadsheet,
  MapPin,
  Megaphone,
  Plus,
  Share2,
  Sparkles,
  Trash2,
  Wallet,
} from 'lucide-react';
import {
  Announcement,
  BaksosAgenda,
  CashTransaction,
  CommitteeContact,
  ResidentHouse,
  SiteConfig,
} from '../types';
import { formatDateDDMMYYYY, openWhatsAppShare } from '../utils/helpers';
import { ResidentSelfCheckBar } from './ResidentSelfCheckBar';
import { BalanceBreakdown } from '../hooks/useStorage';

interface NoticeBoardSectionProps {
  config: SiteConfig;
  residents: ResidentHouse[];
  baksosAgendas: BaksosAgenda[];
  transactions?: CashTransaction[];
  balances: BalanceBreakdown;
  announcements: Announcement[];
  committees?: CommitteeContact[];
  isAdmin: boolean;
  onAddAnnouncement: (ann: Omit<Announcement, 'id'>) => void;
  onEditAnnouncement: (ann: Announcement) => void;
  onDeleteAnnouncement: (id: string) => void;
  onNavigateTab: (tab: string) => void;
  onOpenConfigModal?: () => void;
}

export const NoticeBoardSection: React.FC<NoticeBoardSectionProps> = ({
  config,
  residents,
  baksosAgendas,
  transactions = [],
  balances,
  announcements,
  committees = [],
  isAdmin,
  onAddAnnouncement,
  onEditAnnouncement,
  onDeleteAnnouncement,
  onNavigateTab,
  onOpenConfigModal,
}) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingAnn, setEditingAnn] = useState<Announcement | null>(null);
  const [annTitle, setAnnTitle] = useState('');
  const [annDate, setAnnDate] = useState(new Date().toISOString().slice(0, 10));
  const [annContent, setAnnContent] = useState('');
  const [annPriority, setAnnPriority] = useState<'normal' | 'penting' | 'darurat'>('normal');
  const [priorityFilter, setPriorityFilter] = useState<'semua' | 'penting' | 'normal'>('semua');
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  const handleOpenAdd = () => {
    setEditingAnn(null);
    setAnnTitle('');
    setAnnDate(new Date().toISOString().slice(0, 10));
    setAnnContent('');
    setAnnPriority('normal');
    setIsModalOpen(true);
  };

  const handleOpenEdit = (ann: Announcement) => {
    setEditingAnn(ann);
    setAnnTitle(ann.title);
    setAnnDate(ann.date);
    setAnnContent(ann.content);
    setAnnPriority(ann.priority);
    setIsModalOpen(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!annTitle.trim() || !annContent.trim()) return;
    if (editingAnn) {
      onEditAnnouncement({
        ...editingAnn,
        title: annTitle,
        date: annDate,
        content: annContent,
        priority: annPriority,
      });
    } else {
      onAddAnnouncement({
        title: annTitle,
        date: annDate,
        content: annContent,
        priority: annPriority,
      });
    }
    setIsModalOpen(false);
  };

  const handleShareAnnouncement = (ann: Announcement) => {
    if (!isAdmin) return;
    const text =
      `📢 *PENGUMUMAN WARGA GANG MANDOR*\n` +
      `*${ann.title}*\n` +
      `Tanggal: ${formatDateDDMMYYYY(ann.date)}\n\n` +
      `${ann.content}\n\n` +
      `_Papan Informasi Warga Blok K2/25 - K3/24_`;
    openWhatsAppShare(text);
  };

  const filteredAnnouncements = announcements.filter((a) => {
    if (priorityFilter === 'semua') return true;
    if (priorityFilter === 'penting') return a.priority === 'penting' || a.priority === 'darurat';
    return a.priority === 'normal';
  });

  return (
    <div className="space-y-7 animate-in fade-in duration-200">
      {/* 1. Pengumuman & Agenda Warga (Di Paling Atas Sesuai Permintaan) */}
      <div className="space-y-4">
        {/* HEADER BANNER: 1. Judul di atas -> 2. Deskripsi di bawahnya -> 3. Menu-menu lainnya di bawahnya lagi */}
        <div className="bg-gradient-to-r from-violet-600 via-purple-600 via-fuchsia-600 to-indigo-600 text-white p-5 sm:p-6 rounded-3xl shadow-lg border-b-4 border-purple-400 space-y-4">
          {/* 1. Judul Halaman di Bagian Atas */}
          <div className="flex items-center gap-2.5 flex-wrap">
            <div className="p-2.5 bg-white/20 rounded-2xl backdrop-blur-xs">
              <Megaphone className="w-5 h-5 text-amber-300" />
            </div>
            <h2 className="text-xl sm:text-2xl font-black text-white tracking-tight">
              {config.announcementSectionTitle || 'Papan Pengumuman & Agenda Warga'}
            </h2>
            <span className="px-3 py-1 rounded-full text-xs font-black bg-amber-400 text-slate-950 shadow-sm uppercase tracking-wider">
              Informasi Resmi
            </span>
          </div>

          {/* 2. Deskripsi Halaman di Bawahnya */}
          <p className="text-xs sm:text-sm text-purple-100 max-w-3xl leading-relaxed">
            {config.announcementSectionSubtitle
              ? config.announcementSectionSubtitle.replace(/lingkungan/gi, 'gang')
              : 'Pemberitahuan terkini seputar gotong royong, jadwal gang, dan agenda bersama seluruh warga.'}
          </p>

          {/* 3. Menu-menu Lainnya di Bawahnya Lagi */}
          <div className="pt-2 border-t border-purple-400/50 flex flex-wrap items-center justify-between gap-3">
            {/* Segmented Filter Control */}
            <div className="flex items-center gap-1 p-1 bg-black/20 backdrop-blur-xs rounded-xl text-xs">
              <button
                type="button"
                onClick={() => setPriorityFilter('semua')}
                className={`px-3 py-1.5 rounded-lg font-bold transition-colors cursor-pointer whitespace-nowrap ${
                  priorityFilter === 'semua'
                    ? 'bg-amber-400 text-slate-950 shadow-xs'
                    : 'text-purple-100 hover:text-white'
                }`}
              >
                Semua ({announcements.length})
              </button>
              <button
                type="button"
                onClick={() => setPriorityFilter('penting')}
                className={`px-3 py-1.5 rounded-lg font-bold transition-colors cursor-pointer whitespace-nowrap ${
                  priorityFilter === 'penting'
                    ? 'bg-amber-400 text-slate-950 shadow-xs'
                    : 'text-purple-100 hover:text-white'
                }`}
              >
                Penting / Darurat
              </button>
              <button
                type="button"
                onClick={() => setPriorityFilter('normal')}
                className={`px-3 py-1.5 rounded-lg font-bold transition-colors cursor-pointer whitespace-nowrap ${
                  priorityFilter === 'normal'
                    ? 'bg-amber-400 text-slate-950 shadow-xs'
                    : 'text-purple-100 hover:text-white'
                }`}
              >
                Info Rutin
              </button>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {isAdmin && (
                <button
                  type="button"
                  onClick={handleOpenAdd}
                  className="flex items-center gap-1.5 bg-amber-400 hover:bg-amber-300 text-slate-950 text-xs font-extrabold px-3.5 py-2 rounded-xl shadow-xs transition-colors cursor-pointer whitespace-nowrap"
                >
                  <Plus className="w-4 h-4" />
                  <span>Buat Pengumuman</span>
                </button>
              )}

              {isAdmin && onOpenConfigModal && (
                <button
                  type="button"
                  onClick={onOpenConfigModal}
                  className="flex items-center gap-1 px-3 py-2 rounded-xl bg-white/20 hover:bg-white/30 text-white text-xs font-bold transition-colors cursor-pointer whitespace-nowrap"
                  title="Edit Judul & Deskripsi Website"
                >
                  <Edit2 className="w-3.5 h-3.5 text-amber-200" />
                  <span className="hidden sm:inline">Edit Judul Web</span>
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Grid Pengumuman Warga */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredAnnouncements.length === 0 && (
            <div className="col-span-full py-12 text-center text-slate-500 bg-white/70 rounded-2xl border border-purple-200">
              <Megaphone className="w-8 h-8 text-purple-400 mx-auto mb-2 opacity-60" />
              <p className="text-sm font-semibold">Belum ada pengumuman untuk kategori ini.</p>
            </div>
          )}

          {/* Kartu Pengumuman Warga */}
          {filteredAnnouncements.map((ann, idx) => {
            const isUrgent = ann.priority === 'darurat';
            const isImportant = ann.priority === 'penting';
            const routineThemes = [
              {
                card: 'border-emerald-300 bg-gradient-to-br from-emerald-100/90 via-teal-50/90 to-cyan-100/80',
                header: 'bg-gradient-to-r from-emerald-600 to-teal-600 text-white',
              },
              {
                card: 'border-cyan-300 bg-gradient-to-br from-cyan-100/90 via-sky-50/90 to-indigo-100/80',
                header: 'bg-gradient-to-r from-cyan-600 to-blue-600 text-white',
              },
              {
                card: 'border-purple-300 bg-gradient-to-br from-purple-100/90 via-fuchsia-50/85 to-indigo-100/80',
                header: 'bg-gradient-to-r from-violet-600 to-purple-600 text-white',
              },
            ];
            const routineTheme = routineThemes[idx % routineThemes.length];

            return (
              <article
                key={ann.id}
                className={`rounded-2xl overflow-hidden border-2 transition-all hover:shadow-lg hover:-translate-y-0.5 flex flex-col justify-between ${
                  isUrgent
                    ? 'border-rose-300 bg-gradient-to-br from-rose-100/90 via-orange-50/85 to-amber-100/80'
                    : isImportant
                    ? 'border-amber-300 bg-gradient-to-br from-amber-100/90 via-yellow-50/85 to-orange-100/80'
                    : routineTheme.card
                }`}
              >
                <div>
                  <div
                    className={`px-4 py-2.5 flex items-center justify-between text-xs font-bold ${
                      isUrgent
                        ? 'bg-gradient-to-r from-rose-600 to-orange-600 text-white'
                        : isImportant
                        ? 'bg-gradient-to-r from-amber-500 to-orange-500 text-slate-950'
                        : routineTheme.header
                    }`}
                  >
                    <span className="font-mono tabular-nums">{formatDateDDMMYYYY(ann.date)}</span>
                    {isUrgent ? (
                      <span className="flex items-center gap-1 font-extrabold">
                        <AlertTriangle className="w-3.5 h-3.5" />
                        Darurat
                      </span>
                    ) : isImportant ? (
                      <span className="font-extrabold">Penting</span>
                    ) : (
                      <span>Informasi Rutin</span>
                    )}
                  </div>

                  <div className="p-5 space-y-2.5">
                    <h3 className="font-extrabold text-base text-slate-900 leading-snug">
                      {ann.title}
                    </h3>
                    <p className="text-xs text-slate-700 leading-relaxed whitespace-pre-line">
                      {ann.content}
                    </p>
                  </div>
                </div>

                {isAdmin && (
                  <div className="px-5 py-3 border-t border-teal-200/70 bg-white/50 flex items-center justify-between gap-2 text-xs">
                    <button
                      type="button"
                      onClick={() => handleShareAnnouncement(ann)}
                      className="text-emerald-800 hover:text-emerald-950 font-bold flex items-center gap-1 cursor-pointer"
                    >
                      <Share2 className="w-3.5 h-3.5 text-emerald-600" />
                      <span>Teruskan ke WA</span>
                    </button>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => handleOpenEdit(ann)}
                        className="text-slate-600 hover:text-emerald-700 p-1 rounded hover:bg-emerald-100 transition-colors cursor-pointer"
                        title="Edit Pengumuman"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      {deleteConfirmId === ann.id ? (
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => {
                              onDeleteAnnouncement(ann.id);
                              setDeleteConfirmId(null);
                            }}
                            className="bg-rose-600 text-white px-2 py-0.5 rounded text-[11px] font-bold cursor-pointer"
                          >
                            Hapus
                          </button>
                          <button
                            type="button"
                            onClick={() => setDeleteConfirmId(null)}
                            className="bg-slate-200 text-slate-700 px-2 py-0.5 rounded text-[11px] cursor-pointer"
                          >
                            Batal
                          </button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setDeleteConfirmId(ann.id)}
                          className="text-slate-600 hover:text-rose-600 p-1 rounded hover:bg-rose-100 transition-colors cursor-pointer"
                          title="Hapus Pengumuman"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </article>
            );
          })}
        </div>
      </div>

      {/* 2. Kartu Mandiri Warga & Cek Status Cepat (Tepat di Bawah Pengumuman & Agenda) */}
      <ResidentSelfCheckBar
        residents={residents}
        baksosAgendas={baksosAgendas}
        transactions={transactions}
        balances={balances}
        config={config}
        isAdmin={isAdmin}
        onNavigateTab={onNavigateTab}
      />



      {/* Add / Edit Announcement Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs">
          <div className="bg-gradient-to-br from-emerald-50 via-cyan-50 to-indigo-50 rounded-2xl shadow-xl border-2 border-teal-300 w-full max-w-lg overflow-hidden">
            <div className="bg-gradient-to-r from-emerald-600 via-teal-600 to-indigo-600 p-4 text-white flex justify-between items-center">
              <h4 className="font-bold text-sm">
                {editingAnn ? 'Edit Pengumuman Warga' : 'Tambah Pengumuman Baru'}
              </h4>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="text-white/80 hover:text-white text-xs cursor-pointer"
              >
                Tutup
              </button>
            </div>
            <form onSubmit={handleSubmit} className="p-5 space-y-3.5">
              <div>
                <label className="block text-xs font-bold text-slate-800 mb-1">
                  Judul Pengumuman
                </label>
                <input
                  type="text"
                  required
                  placeholder="Misal: Kerja Bakti Massal Saluran Air..."
                  value={annTitle}
                  onChange={(e) => setAnnTitle(e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-teal-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-800 mb-1">
                    Tanggal Pengumuman
                  </label>
                  <input
                    type="date"
                    required
                    value={annDate}
                    onChange={(e) => setAnnDate(e.target.value)}
                    className="w-full px-3 py-2 text-xs border border-teal-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-800 mb-1">
                    Tingkat Kepentingan
                  </label>
                  <select
                    value={annPriority}
                    onChange={(e) => setAnnPriority(e.target.value as any)}
                    className="w-full px-3 py-2 text-xs border border-teal-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                  >
                    <option value="normal">Normal (Informasi Warga)</option>
                    <option value="penting">Penting</option>
                    <option value="darurat">Darurat</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-800 mb-1">
                  Isi Pengumuman
                </label>
                <textarea
                  rows={4}
                  required
                  placeholder="Tuliskan isi pengumuman lengkap..."
                  value={annContent}
                  onChange={(e) => setAnnContent(e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-teal-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                />
              </div>
              <div className="flex justify-end gap-2 pt-2 border-t border-teal-200">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-3 py-1.5 text-xs text-slate-700 hover:bg-slate-200 rounded-lg cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 text-xs bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold rounded-lg cursor-pointer"
                >
                  Simpan Pengumuman
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
