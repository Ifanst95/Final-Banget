import React, { useEffect, useRef, useState } from 'react';
import { Download, FileJson, RefreshCw, RotateCcw, Save, Settings, Trash2, Upload, X } from 'lucide-react';
import { PortalDatabasePayload, SiteConfig } from '../types';
import { INITIAL_SITE_CONFIG } from '../data/initialData';
import { downloadBackupJsonFile, parseAndNormalizeBackupJson } from '../utils/backupRestoreHelper';
import confetti from 'canvas-confetti';

interface EditSiteConfigModalProps {
  isOpen: boolean;
  onClose: () => void;
  config: SiteConfig;
  onSave: (newConfig: Partial<SiteConfig>) => void;
  onOpenManageMenus?: () => void;
  onResetAllData?: () => void;
  onResetToDefaultWithLatestDb?: () => void;
  currentPayload?: PortalDatabasePayload;
  onRestorePayload?: (payload: PortalDatabasePayload) => void;
}

export const EditSiteConfigModal: React.FC<EditSiteConfigModalProps> = ({
  isOpen,
  onClose,
  config,
  onSave,
  onOpenManageMenus,
  onResetAllData,
  onResetToDefaultWithLatestDb,
  currentPayload,
  onRestorePayload,
}) => {
  const [formData, setFormData] = useState<SiteConfig>({ ...config });
  const [confirmResetAll, setConfirmResetAll] = useState(false);
  const [jsonRestoreStatus, setJsonRestoreStatus] = useState<string | null>(null);
  const jsonFileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (isOpen) {
      setFormData({ ...config });
      setConfirmResetAll(false);
      setJsonRestoreStatus(null);
    }
  }, [isOpen, config]);

  const handleDownloadBackup = () => {
    if (currentPayload) {
      downloadBackupJsonFile(currentPayload);
    }
  };

  const handleRestoreBackupFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !onRestorePayload) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const raw = String(event.target?.result || '');
        const res = parseAndNormalizeBackupJson(raw);
        if (!res.success || !res.payload) {
          setJsonRestoreStatus(`Gagal: ${res.error || 'Format JSON tidak valid'}`);
          return;
        }
        onRestorePayload(res.payload);
        setJsonRestoreStatus(
          `Sukses! Memulihkan ${res.stats?.residentsCount || 0} warga & ${res.stats?.transactionsCount || 0} mutasi kas.`
        );
        try {
          confetti({ particleCount: 50, spread: 60, origin: { y: 0.7 } });
        } catch {}
      } catch (err) {
        setJsonRestoreStatus('Gagal membaca file cadangan JSON.');
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave(formData);
    onClose();
  };

  const clearField = (key: keyof SiteConfig) => {
    setFormData((prev) => ({ ...prev, [key]: '' }));
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm overflow-y-auto animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-100 w-full max-w-3xl overflow-hidden my-8">
        <div className="bg-gradient-to-r from-teal-600 to-emerald-700 p-5 text-white flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <Settings className="w-5 h-5 text-emerald-200" />
            <div>
              <h2 className="font-bold text-base">
                Pengaturan Penuh: Edit & Hapus Judul, Deskripsi & Isi Website
              </h2>
              <p className="text-xs text-emerald-100">
                Admin dapat mengubah atau menghapus/mengosongkan seluruh teks judul dan deskripsi di semua halaman website
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-lg text-emerald-100 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-5 max-h-[80vh] overflow-y-auto">
          {/* Quick Menu Manager Callout */}
          {onOpenManageMenus && (
            <div className="p-4 rounded-2xl bg-gradient-to-r from-emerald-100/90 via-teal-100/80 to-cyan-100/80 border-2 border-teal-300 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs">
              <div>
                <h3 className="font-extrabold text-sm text-teal-950 flex items-center gap-1.5">
                  <Settings className="w-4 h-4 text-emerald-700" />
                  <span>Kelola Menu Utama & Sub Menu Portal</span>
                </h3>
                <p className="text-xs text-teal-800 mt-0.5">
                  Pengurus dapat menambah menu baru, mengedit nama & judul halaman, menghapus menu, serta mengelola sub menu.
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onOpenManageMenus();
                }}
                className="px-4 py-2 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white font-bold text-xs rounded-xl shadow-xs cursor-pointer whitespace-nowrap self-start sm:self-auto"
              >
                Buka Kelola Menu & Sub Menu →
              </button>
            </div>
          )}

          {/* 1. Identitas Utama Website & Banner */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold uppercase tracking-wider text-emerald-700">
                1. Judul Utama, Brand Navbar & Deskripsi Beranda
              </h3>
              <button
                type="button"
                onClick={() => setFormData({ ...INITIAL_SITE_CONFIG })}
                className="flex items-center gap-1 text-[11px] font-semibold text-emerald-700 hover:underline cursor-pointer"
              >
                <RotateCcw className="w-3 h-3" />
                <span>Kembalikan Teks Default</span>
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-semibold text-slate-700">
                    Nama Brand di Navbar Atas
                  </label>
                  <button
                    type="button"
                    onClick={() => clearField('brandName')}
                    className="text-[10px] text-rose-600 hover:underline cursor-pointer"
                  >
                    Hapus
                  </button>
                </div>
                <input
                  type="text"
                  placeholder="Warga Gang Mandor K2/25–K3/24"
                  value={formData.brandName ?? ''}
                  onChange={(e) => setFormData({ ...formData, brandName: e.target.value })}
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-semibold text-slate-700">
                    Judul Utama Website (Banner)
                  </label>
                  <button
                    type="button"
                    onClick={() => clearField('title')}
                    className="text-[10px] text-rose-600 hover:underline cursor-pointer"
                  >
                    Hapus
                  </button>
                </div>
                <input
                  type="text"
                  placeholder="Judul Utama Website..."
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs font-semibold text-slate-700">
                  Subjudul / Tagline Atas Banner
                </label>
                <button
                  type="button"
                  onClick={() => clearField('subtitle')}
                  className="text-[10px] text-rose-600 hover:underline cursor-pointer"
                >
                  Hapus
                </button>
              </div>
              <input
                type="text"
                placeholder="Subjudul website..."
                value={formData.subtitle}
                onChange={(e) => setFormData({ ...formData, subtitle: e.target.value })}
                className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:outline-none"
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs font-semibold text-slate-700">
                  Deskripsi Umum Website (Banner Beranda)
                </label>
                <button
                  type="button"
                  onClick={() => clearField('description')}
                  className="text-[10px] text-rose-600 hover:underline cursor-pointer"
                >
                  Hapus
                </button>
              </div>
              <textarea
                rows={2}
                placeholder="Deskripsi umum website..."
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:outline-none"
              />
            </div>
          </div>

          {/* 2. Pengaturan Iuran & Kas */}
          <div className="pt-3 border-t border-slate-100 space-y-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-emerald-700">
              2. Pengaturan Bulan Iuran, Nominal & Deskripsi Kas
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-semibold text-slate-700">
                    Keterangan Bulan Iuran Berjalan
                  </label>
                </div>
                <input
                  type="text"
                  placeholder="Misal: Oktober 2026"
                  value={formData.duesCurrentMonth ?? 'Oktober 2026'}
                  onChange={(e) =>
                    setFormData({ ...formData, duesCurrentMonth: e.target.value })
                  }
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Nominal Standar Iuran Kas Bulanan (Rp)
                </label>
                <input
                  type="number"
                  value={formData.duesAmountPerMonth}
                  onChange={(e) =>
                    setFormData({ ...formData, duesAmountPerMonth: Number(e.target.value) })
                  }
                  className="w-full px-3 py-2 text-xs font-mono border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs font-semibold text-slate-700">
                  Judul Halaman Laporan Kas
                </label>
                <button
                  type="button"
                  onClick={() => clearField('cashSectionTitle')}
                  className="text-[10px] text-rose-600 hover:underline cursor-pointer"
                >
                  Hapus
                </button>
              </div>
              <input
                type="text"
                value={formData.cashSectionTitle ?? ''}
                onChange={(e) => setFormData({ ...formData, cashSectionTitle: e.target.value })}
                className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:outline-none"
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs font-semibold text-slate-700">
                  Deskripsi Laporan Kas Utama
                </label>
                <button
                  type="button"
                  onClick={() => clearField('cashDescription')}
                  className="text-[10px] text-rose-600 hover:underline cursor-pointer"
                >
                  Hapus
                </button>
              </div>
              <textarea
                rows={2}
                value={formData.cashDescription}
                onChange={(e) => setFormData({ ...formData, cashDescription: e.target.value })}
                className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:outline-none"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-semibold text-slate-700">
                    Deskripsi Cashback WiFi
                  </label>
                  <button
                    type="button"
                    onClick={() => clearField('wifiCashbackDescription')}
                    className="text-[10px] text-rose-600 hover:underline cursor-pointer"
                  >
                    Hapus
                  </button>
                </div>
                <textarea
                  rows={2}
                  value={formData.wifiCashbackDescription}
                  onChange={(e) =>
                    setFormData({ ...formData, wifiCashbackDescription: e.target.value })
                  }
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-semibold text-slate-700">
                    Deskripsi Cashback & Iuran Sampah
                  </label>
                  <button
                    type="button"
                    onClick={() => clearField('trashCashbackDescription')}
                    className="text-[10px] text-rose-600 hover:underline cursor-pointer"
                  >
                    Hapus
                  </button>
                </div>
                <textarea
                  rows={2}
                  value={formData.trashCashbackDescription}
                  onChange={(e) =>
                    setFormData({ ...formData, trashCashbackDescription: e.target.value })
                  }
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                />
              </div>
            </div>
          </div>

          {/* 3. Judul & Deskripsi Bagian Lainnya */}
          <div className="pt-3 border-t border-slate-100 space-y-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-emerald-700">
              3. Judul & Deskripsi Pengumuman, Statistik, Baksos, Warga, Tunggakan & Kontak
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-semibold text-slate-700">
                    Judul Bagian Pengumuman
                  </label>
                  <button
                    type="button"
                    onClick={() => clearField('announcementSectionTitle')}
                    className="text-[10px] text-rose-600 hover:underline cursor-pointer"
                  >
                    Hapus
                  </button>
                </div>
                <input
                  type="text"
                  value={formData.announcementSectionTitle ?? ''}
                  onChange={(e) =>
                    setFormData({ ...formData, announcementSectionTitle: e.target.value })
                  }
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-semibold text-slate-700">
                    Deskripsi Bagian Pengumuman
                  </label>
                  <button
                    type="button"
                    onClick={() => clearField('announcementSectionSubtitle')}
                    className="text-[10px] text-rose-600 hover:underline cursor-pointer"
                  >
                    Hapus
                  </button>
                </div>
                <input
                  type="text"
                  value={formData.announcementSectionSubtitle ?? ''}
                  onChange={(e) =>
                    setFormData({ ...formData, announcementSectionSubtitle: e.target.value })
                  }
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-semibold text-slate-700">
                    Judul Halaman Bakti Sosial
                  </label>
                  <button
                    type="button"
                    onClick={() => clearField('baksosSectionTitle')}
                    className="text-[10px] text-rose-600 hover:underline cursor-pointer"
                  >
                    Hapus
                  </button>
                </div>
                <input
                  type="text"
                  value={formData.baksosSectionTitle ?? ''}
                  onChange={(e) =>
                    setFormData({ ...formData, baksosSectionTitle: e.target.value })
                  }
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-semibold text-slate-700">
                    Deskripsi Agenda Bakti Sosial
                  </label>
                  <button
                    type="button"
                    onClick={() => clearField('baksosDescription')}
                    className="text-[10px] text-rose-600 hover:underline cursor-pointer"
                  >
                    Hapus
                  </button>
                </div>
                <input
                  type="text"
                  value={formData.baksosDescription}
                  onChange={(e) => setFormData({ ...formData, baksosDescription: e.target.value })}
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-semibold text-slate-700">
                    Judul Halaman Data Warga
                  </label>
                  <button
                    type="button"
                    onClick={() => clearField('directorySectionTitle')}
                    className="text-[10px] text-rose-600 hover:underline cursor-pointer"
                  >
                    Hapus
                  </button>
                </div>
                <input
                  type="text"
                  value={formData.directorySectionTitle ?? ''}
                  onChange={(e) =>
                    setFormData({ ...formData, directorySectionTitle: e.target.value })
                  }
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-semibold text-slate-700">
                    Deskripsi Halaman Data Warga
                  </label>
                  <button
                    type="button"
                    onClick={() => clearField('directorySectionDescription')}
                    className="text-[10px] text-rose-600 hover:underline cursor-pointer"
                  >
                    Hapus
                  </button>
                </div>
                <input
                  type="text"
                  value={formData.directorySectionDescription ?? ''}
                  onChange={(e) =>
                    setFormData({ ...formData, directorySectionDescription: e.target.value })
                  }
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-semibold text-slate-700">
                    Judul Halaman Tunggakan
                  </label>
                  <button
                    type="button"
                    onClick={() => clearField('arrearsSectionTitle')}
                    className="text-[10px] text-rose-600 hover:underline cursor-pointer"
                  >
                    Hapus
                  </button>
                </div>
                <input
                  type="text"
                  value={formData.arrearsSectionTitle ?? ''}
                  onChange={(e) =>
                    setFormData({ ...formData, arrearsSectionTitle: e.target.value })
                  }
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-semibold text-slate-700">
                    Deskripsi Halaman Tunggakan
                  </label>
                  <button
                    type="button"
                    onClick={() => clearField('arrearsSectionDescription')}
                    className="text-[10px] text-rose-600 hover:underline cursor-pointer"
                  >
                    Hapus
                  </button>
                </div>
                <input
                  type="text"
                  value={formData.arrearsSectionDescription ?? ''}
                  onChange={(e) =>
                    setFormData({ ...formData, arrearsSectionDescription: e.target.value })
                  }
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-semibold text-slate-700">
                    Judul Kontak Pelayanan Publik
                  </label>
                  <button
                    type="button"
                    onClick={() => clearField('publicContactTitle')}
                    className="text-[10px] text-rose-600 hover:underline cursor-pointer"
                  >
                    Hapus
                  </button>
                </div>
                <input
                  type="text"
                  value={formData.publicContactTitle ?? ''}
                  onChange={(e) =>
                    setFormData({ ...formData, publicContactTitle: e.target.value })
                  }
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-semibold text-slate-700">
                    Deskripsi Kontak Pelayanan Publik
                  </label>
                  <button
                    type="button"
                    onClick={() => clearField('publicContactDescription')}
                    className="text-[10px] text-rose-600 hover:underline cursor-pointer"
                  >
                    Hapus
                  </button>
                </div>
                <input
                  type="text"
                  value={formData.publicContactDescription ?? ''}
                  onChange={(e) =>
                    setFormData({ ...formData, publicContactDescription: e.target.value })
                  }
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                />
              </div>
            </div>
          </div>

          {onResetToDefaultWithLatestDb && (
            <div className="pt-3 border-t border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-2 bg-emerald-50/70 p-3 rounded-xl border border-emerald-200">
              <div className="space-y-0.5">
                <span className="text-xs font-bold text-emerald-950 block">
                  Hapus Halaman Kembali ke Default & Tarik Database Terakhir
                </span>
                <span className="text-[11px] text-emerald-800">
                  Mengembalikan tampilan ke default namun otomatis menarik seluruh input data terbaru dari server database.
                </span>
              </div>
              <button
                type="button"
                onClick={() => {
                  onResetToDefaultWithLatestDb();
                  onClose();
                }}
                className="flex items-center gap-1.5 px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-semibold shadow-xs cursor-pointer whitespace-nowrap self-start sm:self-auto"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Default & Tarik Data Terakhir</span>
              </button>
            </div>
          )}

          {/* Cadangan & Pulihkan File JSON */}
          <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <FileJson className="w-4 h-4 text-emerald-600" />
                <h4 className="text-xs font-bold text-slate-800">
                  Cadangan & Pulihkan Seluruh Database (.JSON)
                </h4>
              </div>
              <span className="text-[10px] bg-emerald-100 text-emerald-800 font-bold px-2 py-0.5 rounded-full">
                File Cadangan Mandor
              </span>
            </div>
            <p className="text-[11px] text-slate-600 leading-relaxed">
              Unduh salinan berkas JSON berisi seluruh data warga, rincian iuran, mutasi kas, agenda baksos, dan susunan pengurus, atau pulihkan kembali data dari file JSON yang Anda miliki.
            </p>
            {jsonRestoreStatus && (
              <div
                className={`p-2.5 rounded-lg text-xs font-semibold ${
                  jsonRestoreStatus.startsWith('Sukses')
                    ? 'bg-emerald-100 text-emerald-900 border border-emerald-300'
                    : 'bg-rose-100 text-rose-900 border border-rose-300'
                }`}
              >
                {jsonRestoreStatus}
              </div>
            )}
            <div className="flex flex-wrap items-center gap-2 pt-1">
              {currentPayload && (
                <button
                  type="button"
                  onClick={handleDownloadBackup}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-slate-300 hover:bg-slate-100 text-slate-800 rounded-lg text-xs font-bold shadow-2xs transition-colors cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5 text-emerald-600" />
                  <span>Download Backup (.json)</span>
                </button>
              )}
              {onRestorePayload && (
                <>
                  <input
                    ref={jsonFileInputRef}
                    type="file"
                    accept=".json,application/json"
                    onChange={handleRestoreBackupFile}
                    className="hidden"
                  />
                  <button
                    type="button"
                    onClick={() => jsonFileInputRef.current?.click()}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold shadow-2xs transition-colors cursor-pointer"
                  >
                    <Upload className="w-3.5 h-3.5 text-amber-200" />
                    <span>Pulihkan dari File (.json)</span>
                  </button>
                </>
              )}
            </div>
          </div>

          {onResetAllData && (
            <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
              <span className="text-[11px] text-slate-500">
                Ingin mereset seluruh data website kembali ke data awal bawaan?
              </span>
              {confirmResetAll ? (
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => {
                      onResetAllData();
                      onClose();
                    }}
                    className="px-3 py-1 bg-rose-600 text-white text-xs font-semibold rounded-lg cursor-pointer"
                  >
                    Ya, Reset Semua Data
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirmResetAll(false)}
                    className="px-2.5 py-1 bg-slate-100 text-slate-600 text-xs rounded-lg cursor-pointer"
                  >
                    Batal
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setConfirmResetAll(true)}
                  className="flex items-center gap-1 text-xs font-semibold text-rose-600 hover:text-rose-700 cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Reset Seluruh Isi Website</span>
                </button>
              )}
            </div>
          )}

          <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
            >
              Batal
            </button>
            <button
              type="submit"
              className="flex items-center gap-1.5 px-5 py-2 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg shadow-sm transition-colors cursor-pointer"
            >
              <Save className="w-4 h-4" />
              <span>Simpan Perubahan</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
