import React, { useRef, useState } from 'react';
import {
  CheckCircle2,
  CloudUpload,
  Download,
  FileJson,
  Globe,
  RefreshCw,
  Upload,
  Wifi,
  WifiOff,
  X,
  Users,
  Wallet,
  CalendarDays,
  Bell,
  AlertCircle,
} from 'lucide-react';
import { PortalDatabasePayload } from '../types';
import {
  downloadBackupJsonFile,
  parseAndNormalizeBackupJson,
} from '../utils/backupRestoreHelper';
import confetti from 'canvas-confetti';

interface OnlineDatabaseModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentPayload: PortalDatabasePayload;
  onRestorePayload: (payload: PortalDatabasePayload) => void;
  lastOnlineSync: string | null;
  onlineRevision: number;
  isOnlineSyncing: boolean;
  isOnlineConnected: boolean;
  isAutoSyncEnabled: boolean;
  onToggleAutoSync: (enabled: boolean) => void;
  onSyncOnlineNow: (mode: 'pull' | 'push') => Promise<boolean>;
}

export const OnlineDatabaseModal: React.FC<OnlineDatabaseModalProps> = ({
  isOpen,
  onClose,
  currentPayload,
  onRestorePayload,
  lastOnlineSync,
  onlineRevision,
  isOnlineSyncing,
  isOnlineConnected,
  isAutoSyncEnabled,
  onToggleAutoSync,
  onSyncOnlineNow,
}) => {
  const [statusMessage, setStatusMessage] = useState<{
    type: 'success' | 'error' | 'info' | 'warning';
    text: string;
  } | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  if (!isOpen) return null;

  const residentCount = currentPayload.residents?.length || 0;
  const txCount = currentPayload.transactions?.length || 0;
  const baksosCount = currentPayload.baksosAgendas?.length || 0;
  const announceCount = currentPayload.announcements?.length || 0;
  const totalRecords = residentCount + txCount + baksosCount + announceCount;

  const handlePullLatest = async () => {
    setStatusMessage(null);
    const ok = await onSyncOnlineNow('pull');
    if (ok) {
      setStatusMessage({
        type: 'success',
        text: 'Sinkronisasi Berhasil! Data terbaru dari server online & cloud database berhasil dimuat dan diperbarui di perangkat ini.',
      });
    } else {
      setStatusMessage({
        type: 'warning',
        text: 'Koneksi jaringan terputus sementara. Seluruh data tetap tersimpan aman di penyimpanan internal browser (IndexedDB & LocalStorage) dan akan dicoba sinkronkan ulang otomatis begitu koneksi stabil.',
      });
    }
  };

  const handlePushNow = async () => {
    setStatusMessage(null);
    const ok = await onSyncOnlineNow('push');
    if (ok) {
      setStatusMessage({
        type: 'success',
        text: 'Seluruh data berhasil disimpan ke server online & Cloud Firestore serta disiarkan otomatis ke seluruh perangkat warga!',
      });
      try {
        confetti({ particleCount: 50, spread: 60, origin: { y: 0.6 } });
      } catch {}
    } else {
      setStatusMessage({
        type: 'warning',
        text: 'Koneksi jaringan terputus sementara. Data perubahan Anda tetap aman di penyimpanan internal browser dan akan otomatis disiarkan ulang saat terhubung kembali.',
      });
    }
  };

  const handleDownloadJsonBackup = () => {
    downloadBackupJsonFile(currentPayload);
  };

  const handleImportJsonFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const rawText = String(event.target?.result || '');
        const result = parseAndNormalizeBackupJson(rawText);
        if (!result.success || !result.payload) {
          setStatusMessage({
            type: 'error',
            text: result.error || 'Format file JSON tidak valid.',
          });
          return;
        }

        onRestorePayload(result.payload);
        const st = result.stats;
        setStatusMessage({
          type: 'success',
          text: `Cadangan data berhasil dipulihkan! (${st?.residentsCount || 0} Warga, ${st?.transactionsCount || 0} Mutasi Kas, ${st?.agendasCount || 0} Agenda Baksos) dan otomatis disinkronkan ke server online!`,
        });
        try {
          confetti({ particleCount: 60, spread: 70, origin: { y: 0.6 } });
        } catch {}
      } catch {
        setStatusMessage({
          type: 'error',
          text: 'Gagal memproses file cadangan JSON. Pastikan file tidak rusak.',
        });
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm overflow-y-auto animate-in fade-in duration-200">
      <div className="bg-gradient-to-br from-emerald-50 via-cyan-50 to-indigo-50 rounded-2xl shadow-2xl border border-emerald-200 w-full max-w-2xl overflow-hidden my-8">
        {/* Header: Title at top, description below */}
        <div className="bg-gradient-to-r from-emerald-600 via-teal-600 to-indigo-600 p-5 text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-white/15 rounded-xl">
              <Globe className="w-5 h-5 text-amber-300" />
            </div>
            <div>
              <h2 className="font-bold text-base">
                Sinkronisasi Server Online Real-Time
              </h2>
              <p className="text-xs text-emerald-100">
                Penyimpanan cloud otomatis dan sinkronisasi data antar perangkat warga & pengurus
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-white/80 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-5 max-h-[78vh] overflow-y-auto">
          {/* Online Server Status Banner */}
          <div
            className={`p-3.5 rounded-xl border flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs ${
              isOnlineConnected
                ? 'bg-gradient-to-r from-emerald-100/90 via-teal-50 to-cyan-100/80 border-emerald-300'
                : 'bg-amber-100/90 border-amber-300'
            }`}
          >
            <div className="flex items-center gap-2.5">
              {isOnlineConnected ? (
                <div className="relative flex items-center justify-center">
                  <span className="animate-ping absolute inline-flex h-3 w-3 rounded-full bg-emerald-400 opacity-75"></span>
                  <Wifi className="relative w-4 h-4 text-emerald-700 shrink-0" />
                </div>
              ) : (
                <WifiOff className="w-4 h-4 text-amber-700 shrink-0" />
              )}
              <div>
                <span className="font-bold text-emerald-950 block">
                  {isOnlineConnected
                    ? `Website Online & Sinkron Otomatis Aktif (${totalRecords} Data · Revisi #${onlineRevision || 1})`
                    : 'Menghubungkan ulang ke Server Online...'}
                </span>
                <span className="text-emerald-800 text-[11px]">
                  Setiap perubahan data Pengumuman, Kas, Iuran KK, Baksos, Warga & Tunggakan langsung tersimpan aman dan disiarkan otomatis.
                </span>
              </div>
            </div>
            {lastOnlineSync && (
              <span className="font-mono text-[10px] font-semibold px-2.5 py-1 rounded-lg bg-emerald-200/70 text-emerald-900 shrink-0 tabular-nums">
                Update: {new Date(lastOnlineSync).toLocaleTimeString('id-ID')}
              </span>
            )}
          </div>

          {statusMessage && (
            <div
              className={`p-3.5 rounded-xl border text-xs font-medium flex items-center justify-between gap-2.5 shadow-2xs ${
                statusMessage.type === 'success'
                  ? 'bg-emerald-100/90 border-emerald-300 text-emerald-900'
                  : statusMessage.type === 'warning'
                  ? 'bg-amber-50/95 border-amber-300 text-amber-900'
                  : statusMessage.type === 'error'
                  ? 'bg-rose-100/90 border-rose-300 text-rose-900'
                  : 'bg-sky-100/90 border-sky-300 text-sky-900'
              }`}
            >
              <div className="flex items-center gap-2">
                {statusMessage.type === 'success' ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-700 shrink-0" />
                ) : statusMessage.type === 'warning' ? (
                  <AlertCircle className="w-4 h-4 text-amber-700 shrink-0" />
                ) : (
                  <CheckCircle2 className="w-4 h-4 shrink-0" />
                )}
                <span className="leading-relaxed">{statusMessage.text}</span>
              </div>
              <button
                type="button"
                onClick={() => setStatusMessage(null)}
                className="text-xs opacity-70 hover:opacity-100 cursor-pointer p-1"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          {/* Quick Record Stats */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
            <div className="p-3 bg-white/80 rounded-xl border border-emerald-200/80 shadow-2xs">
              <div className="flex items-center gap-1.5 text-emerald-700 text-xs font-bold mb-1">
                <Users className="w-3.5 h-3.5" />
                <span>Data Warga</span>
              </div>
              <div className="text-lg font-bold text-slate-800 tabular-nums">{residentCount} Rumah</div>
            </div>
            <div className="p-3 bg-white/80 rounded-xl border border-teal-200/80 shadow-2xs">
              <div className="flex items-center gap-1.5 text-teal-700 text-xs font-bold mb-1">
                <Wallet className="w-3.5 h-3.5" />
                <span>Transaksi Kas</span>
              </div>
              <div className="text-lg font-bold text-slate-800 tabular-nums">{txCount} Mutasi</div>
            </div>
            <div className="p-3 bg-white/80 rounded-xl border border-cyan-200/80 shadow-2xs">
              <div className="flex items-center gap-1.5 text-cyan-700 text-xs font-bold mb-1">
                <CalendarDays className="w-3.5 h-3.5" />
                <span>Bakti Sosial</span>
              </div>
              <div className="text-lg font-bold text-slate-800 tabular-nums">{baksosCount} Agenda</div>
            </div>
            <div className="p-3 bg-white/80 rounded-xl border border-indigo-200/80 shadow-2xs">
              <div className="flex items-center gap-1.5 text-indigo-700 text-xs font-bold mb-1">
                <Bell className="w-3.5 h-3.5" />
                <span>Pengumuman</span>
              </div>
              <div className="text-lg font-bold text-slate-800 tabular-nums">{announceCount} Info</div>
            </div>
          </div>

          <div className="space-y-4">
            {/* Auto-Sync Control Card */}
            <div className="p-4 rounded-2xl border border-teal-200 bg-gradient-to-br from-teal-50/90 via-emerald-50/70 to-cyan-50/90 space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <span className="text-[11px] font-bold uppercase tracking-wider text-teal-800 block">
                    Sinkronisasi Otomatis Lintas Perangkat
                  </span>
                  <h3 className="font-bold text-sm text-slate-900 mt-0.5">
                    Sinkronkan Otomatis Data Terbaru
                  </h3>
                  <p className="text-xs text-slate-600 mt-0.5 leading-relaxed">
                    Setiap perubahan data otomatis disimpan dan langsung tampil di perangkat warga lain secara real-time.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => onToggleAutoSync(!isAutoSyncEnabled)}
                  className={`px-3.5 py-2 rounded-xl text-xs font-bold border transition-all cursor-pointer shrink-0 flex items-center gap-2 ${
                    isAutoSyncEnabled
                      ? 'bg-emerald-600 text-white border-emerald-700 shadow-xs'
                      : 'bg-amber-100 text-amber-900 border-amber-300'
                  }`}
                >
                  <span
                    className={`w-2 h-2 rounded-full ${
                      isAutoSyncEnabled ? 'bg-amber-300 animate-pulse' : 'bg-amber-600'
                    }`}
                  />
                  <span>{isAutoSyncEnabled ? 'Auto-Sync: AKTIF' : 'Auto-Sync: NONAKTIF'}</span>
                </button>
              </div>

              {/* Manual Sync Action Buttons */}
              <div className="pt-3 border-t border-teal-200/70 flex flex-wrap items-center gap-2.5">
                <button
                  type="button"
                  onClick={handlePullLatest}
                  disabled={isOnlineSyncing}
                  className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white text-xs font-bold rounded-xl shadow-xs transition-all cursor-pointer disabled:opacity-60"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isOnlineSyncing ? 'animate-spin' : ''}`} />
                  <span>Muat Data Terbaru dari Server</span>
                </button>

                <button
                  type="button"
                  onClick={handlePushNow}
                  disabled={isOnlineSyncing}
                  className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-500 hover:to-blue-500 text-white text-xs font-bold rounded-xl shadow-xs transition-all cursor-pointer disabled:opacity-60"
                >
                  <CloudUpload className="w-3.5 h-3.5 text-amber-300" />
                  <span>Simpan & Siarkan ke Semua Perangkat</span>
                </button>
              </div>
            </div>

            {/* Backup & Restore File JSON */}
            <div className="p-4 rounded-2xl border border-indigo-200 bg-gradient-to-br from-indigo-50/80 via-sky-50/70 to-emerald-50/60 space-y-3">
              <div className="flex items-center gap-2">
                <FileJson className="w-4 h-4 text-indigo-600" />
                <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                  Cadangan File Database (.JSON)
                </h4>
              </div>
              <p className="text-xs text-slate-600 leading-relaxed">
                Unduh salinan lengkap seluruh database portal atau pulihkan data dari file cadangan untuk disinkronkan langsung ke server online.
              </p>
              <div className="flex flex-wrap items-center gap-2.5">
                <button
                  type="button"
                  onClick={handleDownloadJsonBackup}
                  className="flex items-center gap-1.5 px-3.5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl shadow-2xs transition-colors cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5 text-amber-300" />
                  <span>Download Backup (.json)</span>
                </button>

                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".json,application/json"
                  onChange={handleImportJsonFile}
                  className="hidden"
                />
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="flex items-center gap-1.5 px-3.5 py-2 bg-amber-100 hover:bg-amber-200 text-amber-950 border border-amber-300 text-xs font-bold rounded-xl transition-colors cursor-pointer"
                >
                  <Upload className="w-3.5 h-3.5 text-amber-700" />
                  <span>Pulihkan dari File (.json)</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
