import React, { useRef, useState } from 'react';
import confetti from 'canvas-confetti';
import {
  AlertCircle,
  ArrowRight,
  Calendar,
  Check,
  CheckCircle2,
  Clock,
  Download,
  FileSpreadsheet,
  HelpCircle,
  RefreshCw,
  Search,
  Upload,
  Users,
  Wallet,
  X,
} from 'lucide-react';
import { CashTransaction, ResidentHouse } from '../types';
import { formatDateDDMMYYYY, formatRupiah } from '../utils/helpers';
import {
  downloadDuesExcelTemplate,
  parseDuesExcelFile,
  ParseDuesExcelResult,
} from '../utils/duesExcelHelper';

interface DuesExcelUploadModalProps {
  isOpen: boolean;
  onClose: () => void;
  availablePeriods: string[];
  currentPeriod: string;
  residents: ResidentHouse[];
  defaultNominal?: number;
  onConfirmImport: (
    updatedResidents: ResidentHouse[],
    newTransactions: Omit<CashTransaction, 'id'>[],
    periodLabel: string,
    setAsActivePeriod: boolean
  ) => void;
}

export const DuesExcelUploadModal: React.FC<DuesExcelUploadModalProps> = ({
  isOpen,
  onClose,
  availablePeriods,
  currentPeriod,
  residents,
  defaultNominal = 50000,
  onConfirmImport,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedPeriod, setSelectedPeriod] = useState<string>(currentPeriod || 'Oktober 2026');
  const [isCustomPeriod, setIsCustomPeriod] = useState<boolean>(false);
  const [customPeriodInput, setCustomPeriodInput] = useState<string>('');

  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isParsing, setIsParsing] = useState<boolean>(false);
  const [parseResult, setParseResult] = useState<ParseDuesExcelResult | null>(null);

  const [filterPreview, setFilterPreview] = useState<'semua' | 'lunas' | 'belum' | 'kosong'>('semua');
  const [searchPreview, setSearchPreview] = useState<string>('');

  const [autoRecordCash, setAutoRecordCash] = useState<boolean>(true);
  const [autoSyncArrears, setAutoSyncArrears] = useState<boolean>(true);
  const [setActivePeriod, setSetActivePeriod] = useState<boolean>(false);

  const [isSuccess, setIsSuccess] = useState<boolean>(false);

  if (!isOpen) return null;

  const effectivePeriod = isCustomPeriod
    ? customPeriodInput.trim() || selectedPeriod
    : selectedPeriod;

  const handleDownloadTemplate = () => {
    downloadDuesExcelTemplate(residents, effectivePeriod, defaultNominal);
  };

  const handleFileProcess = async (file: File) => {
    setSelectedFile(file);
    setIsParsing(true);
    setParseResult(null);

    const res = await parseDuesExcelFile(file, effectivePeriod, defaultNominal, residents);
    setIsParsing(false);
    setParseResult(res);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      handleFileProcess(e.target.files[0]);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileProcess(e.dataTransfer.files[0]);
    }
  };

  const handleReset = () => {
    setSelectedFile(null);
    setParseResult(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleExecuteImport = () => {
    if (!parseResult || !parseResult.updatedResidents) return;

    let residentsToSave = parseResult.updatedResidents;
    if (!autoSyncArrears) {
      // Revert previous arrears to existing values if user unchecked arrears sync
      residentsToSave = residentsToSave.map((r) => {
        const orig = residents.find((o) => o.id === r.id);
        return {
          ...r,
          previousArrears: orig ? orig.previousArrears : r.previousArrears,
          previousArrearsNote: orig ? orig.previousArrearsNote : r.previousArrearsNote,
        };
      });
    }

    const txsToSave = autoRecordCash ? parseResult.cashTransactions || [] : [];

    onConfirmImport(residentsToSave, txsToSave, effectivePeriod, setActivePeriod);

    try {
      confetti({ particleCount: 60, spread: 70, origin: { y: 0.6 } });
    } catch {}

    setIsSuccess(true);
    setTimeout(() => {
      setIsSuccess(false);
      handleReset();
      onClose();
    }, 1200);
  };

  // Filtered preview rows
  const filteredRows = (parseResult?.rows || []).filter((row) => {
    if (filterPreview === 'lunas' && row.status !== 'Lunas' && row.status !== 'Bayar Lebih') {
      return false;
    }
    if (filterPreview === 'belum' && row.status !== 'Belum Bayar') {
      return false;
    }
    if (filterPreview === 'kosong' && row.status !== 'Bebas Iuran' && !row.isVacant) {
      return false;
    }
    if (searchPreview.trim()) {
      const q = searchPreview.toLowerCase();
      const matchBlock = row.blockNumber.toLowerCase().includes(q);
      const matchName = row.headName.toLowerCase().includes(q);
      const matchStatus = row.status.toLowerCase().includes(q);
      if (!matchBlock && !matchName && !matchStatus) return false;
    }
    return true;
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-xs overflow-y-auto animate-in fade-in duration-200">
      <div className="bg-white rounded-3xl shadow-2xl border border-slate-200 w-full max-w-4xl overflow-hidden my-4 sm:my-8 flex flex-col max-h-[92vh]">
        {/* MODAL HEADER */}
        <div className="bg-gradient-to-r from-emerald-700 via-teal-700 to-indigo-800 p-4 sm:p-5 text-white flex justify-between items-center shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-white/15 rounded-2xl backdrop-blur-xs shadow-xs">
              <FileSpreadsheet className="w-6 h-6 text-emerald-200" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-extrabold text-base sm:text-lg tracking-tight">
                  Upload & Import Iuran Warga Per KK via Excel
                </h3>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-400 text-slate-950 uppercase">
                  Pengurus
                </span>
              </div>
              <p className="text-xs text-emerald-100/90 mt-0.5">
                Sinkronisasi massal data iuran kas, rekap per KK, buku kas masuk, dan tunggakan
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-white/70 hover:text-white hover:bg-white/10 rounded-xl transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* MODAL BODY */}
        <div className="p-4 sm:p-6 overflow-y-auto space-y-5 flex-1">
          {/* STEP 1: PILIH PERIODE & DOWNLOAD TEMPLATE */}
          <div className="p-4 rounded-2xl bg-gradient-to-br from-emerald-50/70 via-teal-50/40 to-slate-50 border-2 border-emerald-200/80 shadow-2xs space-y-3">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <span className="text-xs font-bold text-emerald-950 flex items-center gap-1.5">
                <Calendar className="w-4 h-4 text-emerald-700" />
                <span>Langkah 1: Tentukan Periode Iuran & Unduh Template Excel</span>
              </span>
              <button
                type="button"
                onClick={handleDownloadTemplate}
                className="flex items-center gap-1.5 px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-xs transition-colors cursor-pointer"
                title="Download template Excel siap isi sesuai daftar warga saat ini"
              >
                <Download className="w-3.5 h-3.5 text-amber-300" />
                <span>Unduh Template Excel ({effectivePeriod})</span>
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
              <div>
                <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                  Pilih Periode Iuran:
                </label>
                <div className="flex items-center gap-2">
                  <select
                    disabled={isCustomPeriod}
                    value={selectedPeriod}
                    onChange={(e) => setSelectedPeriod(e.target.value)}
                    className="flex-1 px-3 py-2 text-xs font-bold bg-white border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 disabled:bg-slate-100 disabled:text-slate-400"
                  >
                    {availablePeriods.map((p) => (
                      <option key={p} value={p}>
                        {p} {p === currentPeriod ? '(Bulan Berjalan Saat Ini)' : ''}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    onClick={() => setIsCustomPeriod(!isCustomPeriod)}
                    className={`px-3 py-2 rounded-xl text-xs font-bold border transition-colors cursor-pointer ${
                      isCustomPeriod
                        ? 'bg-indigo-600 text-white border-indigo-600'
                        : 'bg-white text-slate-700 hover:bg-slate-100 border-slate-300'
                    }`}
                  >
                    {isCustomPeriod ? 'Pilih Ada' : '+ Periode Baru'}
                  </button>
                </div>
              </div>

              {isCustomPeriod && (
                <div>
                  <label className="block text-[11px] font-semibold text-indigo-900 mb-1">
                    Nama Periode Baru:
                  </label>
                  <input
                    type="text"
                    placeholder="Contoh: November 2026 atau Desember 2026"
                    value={customPeriodInput}
                    onChange={(e) => setCustomPeriodInput(e.target.value)}
                    className="w-full px-3 py-2 text-xs font-bold bg-white border border-indigo-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 text-indigo-950"
                  />
                </div>
              )}
            </div>

            <div className="text-[11px] text-slate-600 leading-relaxed bg-white/80 p-2.5 rounded-xl border border-emerald-100">
              💡 <strong>Tips Praktis:</strong> Klik tombol <strong>Unduh Template Excel</strong> untuk mendapatkan spreadsheet yang sudah terisi otomatis dengan seluruh nomor blok ({residents.length} rumah) dan nama warga Gang Mandor. Buka file tersebut, perbarui status pembayaran / nominal uang diterima, lalu upload di bawah.
            </div>
          </div>

          {/* STEP 2: DROPZONE FILE EXCEL */}
          <div className="space-y-2">
            <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
              <Upload className="w-4 h-4 text-teal-600" />
              <span>Langkah 2: Pilih atau Tarik (Drop) File Excel Iuran</span>
            </span>

            <input
              ref={fileInputRef}
              type="file"
              accept=".xlsx, .xls"
              onChange={handleFileChange}
              className="hidden"
            />

            {!parseResult ? (
              <div
                onDragOver={(e) => e.preventDefault()}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                className={`p-6 sm:p-8 border-2 border-dashed rounded-2xl text-center cursor-pointer transition-all ${
                  isParsing
                    ? 'border-emerald-500 bg-emerald-50/50'
                    : 'border-slate-300 hover:border-emerald-500 hover:bg-emerald-50/20 bg-slate-50/50'
                }`}
              >
                {isParsing ? (
                  <div className="flex flex-col items-center justify-center space-y-2">
                    <RefreshCw className="w-8 h-8 text-emerald-600 animate-spin" />
                    <p className="text-xs font-bold text-emerald-900">
                      Menganalisis & mencocokkan data iuran warga...
                    </p>
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center space-y-2">
                    <div className="p-3 bg-emerald-100 text-emerald-700 rounded-2xl">
                      <FileSpreadsheet className="w-8 h-8" />
                    </div>
                    <div>
                      <p className="text-xs sm:text-sm font-bold text-slate-800">
                        Klik untuk memilih file Excel atau seret file ke sini
                      </p>
                      <p className="text-[11px] text-slate-500 mt-0.5">
                        Format didukung: <strong>.xlsx</strong> atau <strong>.xls</strong>
                      </p>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="p-3.5 bg-emerald-50/80 border border-emerald-300 rounded-2xl flex items-center justify-between gap-3">
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="p-2 bg-emerald-600 text-white rounded-xl shrink-0">
                    <FileSpreadsheet className="w-4 h-4" />
                  </div>
                  <div className="truncate">
                    <span className="font-bold text-xs text-emerald-950 block truncate">
                      {selectedFile?.name || 'File Excel Iuran'}
                    </span>
                    <span className="text-[11px] text-emerald-800">
                      Berhasil dibaca: {parseResult.summary?.totalRows || 0} Baris Data
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={handleReset}
                    className="px-3 py-1.5 text-xs text-rose-700 hover:bg-rose-100 rounded-xl font-bold transition-colors cursor-pointer"
                  >
                    Ganti File
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* STEP 3: PREVIEW & VALIDATION */}
          {parseResult && parseResult.success && parseResult.summary && (
            <div className="space-y-4 animate-in fade-in duration-200">
              {/* SUMMARY METRICS CARDS */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                <div className="p-3 rounded-2xl bg-slate-900 text-white flex flex-col justify-between shadow-2xs">
                  <span className="text-[10px] text-slate-300 font-semibold">Total Rumah di File</span>
                  <div className="mt-1 flex items-baseline justify-between">
                    <span className="text-lg font-black font-mono">
                      {parseResult.summary.totalRows}
                    </span>
                    <span className="text-[10px] text-slate-400">
                      {parseResult.summary.matchedCount} Cocok
                    </span>
                  </div>
                </div>

                <div className="p-3 rounded-2xl bg-emerald-100 text-emerald-950 border border-emerald-200 flex flex-col justify-between shadow-2xs">
                  <span className="text-[10px] text-emerald-800 font-semibold">Lunas & Bayar Lebih</span>
                  <div className="mt-1 flex items-baseline justify-between">
                    <span className="text-lg font-black font-mono text-emerald-900">
                      {parseResult.summary.lunasCount + parseResult.summary.bayarLebihCount}
                    </span>
                    <span className="text-[10px] text-emerald-800 font-bold">
                      +{parseResult.summary.bayarLebihCount} Muka
                    </span>
                  </div>
                </div>

                <div className="p-3 rounded-2xl bg-rose-100 text-rose-950 border border-rose-200 flex flex-col justify-between shadow-2xs">
                  <span className="text-[10px] text-rose-800 font-semibold">Belum Bayar (Menunggak)</span>
                  <div className="mt-1 flex items-baseline justify-between">
                    <span className="text-lg font-black font-mono text-rose-900">
                      {parseResult.summary.belumBayarCount}
                    </span>
                    <span className="text-[10px] text-rose-800">
                      {parseResult.summary.kosongCount} Kosong
                    </span>
                  </div>
                </div>

                <div className="p-3 rounded-2xl bg-gradient-to-br from-emerald-600 to-teal-700 text-white flex flex-col justify-between shadow-2xs">
                  <span className="text-[10px] text-emerald-100 font-semibold">Uang Masuk Kas Utama</span>
                  <div className="mt-1">
                    <span className="text-sm sm:text-base font-black font-mono tracking-tight tabular-nums">
                      {formatRupiah(parseResult.summary.totalCashInflow)}
                    </span>
                  </div>
                </div>
              </div>

              {/* INTEGRATION TOGGLES */}
              <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-2xl space-y-2">
                <span className="text-xs font-bold text-slate-800 block">
                  Pengaturan Integrasi Otomatis:
                </span>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs">
                  <label className="flex items-start gap-2 p-2 rounded-xl bg-white border border-slate-200 cursor-pointer hover:border-emerald-400">
                    <input
                      type="checkbox"
                      checked={autoRecordCash}
                      onChange={(e) => setAutoRecordCash(e.target.checked)}
                      className="mt-0.5 rounded text-emerald-600 focus:ring-emerald-500"
                    />
                    <div>
                      <strong className="block text-slate-800">1. Catat ke Buku Kas</strong>
                      <span className="text-[10px] text-slate-500">
                        Catat {parseResult.cashTransactions?.length || 0} mutasi masuk kas senilai{' '}
                        {formatRupiah(parseResult.summary.totalCashInflow)}
                      </span>
                    </div>
                  </label>

                  <label className="flex items-start gap-2 p-2 rounded-xl bg-white border border-slate-200 cursor-pointer hover:border-emerald-400">
                    <input
                      type="checkbox"
                      checked={autoSyncArrears}
                      onChange={(e) => setAutoSyncArrears(e.target.checked)}
                      className="mt-0.5 rounded text-emerald-600 focus:ring-emerald-500"
                    />
                    <div>
                      <strong className="block text-slate-800">2. Sinkron ke Tunggakan</strong>
                      <span className="text-[10px] text-slate-500">
                        Perbarui tagihan & tunggakan warga di menu Daftar Tunggakan
                      </span>
                    </div>
                  </label>

                  <label className="flex items-start gap-2 p-2 rounded-xl bg-white border border-slate-200 cursor-pointer hover:border-emerald-400">
                    <input
                      type="checkbox"
                      checked={setActivePeriod}
                      onChange={(e) => setSetActivePeriod(e.target.checked)}
                      className="mt-0.5 rounded text-emerald-600 focus:ring-emerald-500"
                    />
                    <div>
                      <strong className="block text-slate-800">3. Jadikan Bulan Berjalan</strong>
                      <span className="text-[10px] text-slate-500">
                        Ubah periode aktif sistem ke "{effectivePeriod}"
                      </span>
                    </div>
                  </label>
                </div>
              </div>

              {/* TABLE PREVIEW */}
              <div className="space-y-2">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5 text-xs">
                    <button
                      type="button"
                      onClick={() => setFilterPreview('semua')}
                      className={`px-2.5 py-1 rounded-lg font-bold transition-colors cursor-pointer ${
                        filterPreview === 'semua'
                          ? 'bg-slate-900 text-white'
                          : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                      }`}
                    >
                      Semua ({parseResult.rows?.length || 0})
                    </button>
                    <button
                      type="button"
                      onClick={() => setFilterPreview('lunas')}
                      className={`px-2.5 py-1 rounded-lg font-bold transition-colors cursor-pointer ${
                        filterPreview === 'lunas'
                          ? 'bg-emerald-600 text-white'
                          : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                      }`}
                    >
                      Lunas ({parseResult.summary.lunasCount + parseResult.summary.bayarLebihCount})
                    </button>
                    <button
                      type="button"
                      onClick={() => setFilterPreview('belum')}
                      className={`px-2.5 py-1 rounded-lg font-bold transition-colors cursor-pointer ${
                        filterPreview === 'belum'
                          ? 'bg-rose-600 text-white'
                          : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                      }`}
                    >
                      Belum Bayar ({parseResult.summary.belumBayarCount})
                    </button>
                    <button
                      type="button"
                      onClick={() => setFilterPreview('kosong')}
                      className={`px-2.5 py-1 rounded-lg font-bold transition-colors cursor-pointer ${
                        filterPreview === 'kosong'
                          ? 'bg-slate-700 text-white'
                          : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                      }`}
                    >
                      Rumah Kosong ({parseResult.summary.kosongCount})
                    </button>
                  </div>

                  <div className="relative w-full sm:w-56">
                    <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2" />
                    <input
                      type="text"
                      placeholder="Cari blok / nama..."
                      value={searchPreview}
                      onChange={(e) => setSearchPreview(e.target.value)}
                      className="w-full pl-8 pr-2.5 py-1 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-emerald-500"
                    />
                  </div>
                </div>

                <div className="border border-slate-200 rounded-2xl overflow-hidden max-h-60 overflow-y-auto">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead className="sticky top-0 bg-slate-100 text-slate-700 font-bold border-b border-slate-200 z-10">
                      <tr>
                        <th className="py-2 px-2.5 text-center w-10">No</th>
                        <th className="py-2 px-2.5">No Blok</th>
                        <th className="py-2 px-3">Kepala Keluarga</th>
                        <th className="py-2 px-2.5 text-center">Status</th>
                        <th className="py-2 px-3 text-right">Uang Masuk Kas</th>
                        <th className="py-2 px-3 text-right">Tunggakan Lalu</th>
                        <th className="py-2 px-2.5 text-center">Tgl Bayar</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {filteredRows.map((r, i) => (
                        <tr
                          key={i}
                          className={`hover:bg-slate-50/70 transition-colors ${
                            !r.matchedResident ? 'bg-amber-50/60' : ''
                          }`}
                        >
                          <td className="py-2 px-2.5 text-center font-mono text-slate-400 text-[11px]">
                            {i + 1}
                          </td>
                          <td className="py-2 px-2.5 font-mono font-bold text-slate-900">
                            {r.blockNumber}
                            {!r.matchedResident && (
                              <span className="block text-[9px] text-amber-700 font-sans">
                                (Blok baru/tidak di DB)
                              </span>
                            )}
                          </td>
                          <td className="py-2 px-3">
                            <div className="font-semibold text-slate-800">{r.headName}</div>
                            {r.isVacant && (
                              <span className="text-[10px] text-slate-400">Rumah Kosong</span>
                            )}
                          </td>
                          <td className="py-2 px-2.5 text-center">
                            <span
                              className={`inline-block px-2 py-0.5 rounded-md text-[10px] font-bold ${
                                r.status === 'Lunas'
                                  ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                                  : r.status === 'Bayar Lebih'
                                  ? 'bg-indigo-100 text-indigo-800 border border-indigo-200'
                                  : r.status === 'Bebas Iuran'
                                  ? 'bg-slate-200 text-slate-700'
                                  : 'bg-rose-100 text-rose-800 border border-rose-200'
                              }`}
                            >
                              {r.status} {r.paidMonths > 1 ? `(${r.paidMonths} bln)` : ''}
                            </span>
                          </td>
                          <td className="py-2 px-3 text-right font-mono font-bold text-emerald-800">
                            {r.totalReceived > 0 ? formatRupiah(r.totalReceived) : '-'}
                          </td>
                          <td className="py-2 px-3 text-right font-mono text-rose-700">
                            {r.previousArrears > 0 ? formatRupiah(r.previousArrears) : '-'}
                          </td>
                          <td className="py-2 px-2.5 text-center font-mono text-[11px] text-slate-500">
                            {r.paidDate ? formatDateDDMMYYYY(r.paidDate) : '-'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {parseResult && !parseResult.success && (
            <div className="p-4 bg-rose-50 border border-rose-200 rounded-2xl flex items-start gap-3 text-rose-800 text-xs">
              <AlertCircle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
              <div>
                <strong className="block text-sm">Gagal Memproses File Excel</strong>
                <p className="mt-0.5">{parseResult.error}</p>
                <button
                  type="button"
                  onClick={handleReset}
                  className="mt-2 px-3 py-1 bg-rose-600 text-white rounded-lg font-bold text-xs cursor-pointer"
                >
                  Coba Upload Ulang
                </button>
              </div>
            </div>
          )}
        </div>

        {/* MODAL FOOTER */}
        <div className="p-4 sm:p-5 bg-slate-50 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3 shrink-0">
          <div className="text-xs text-slate-600 text-center sm:text-left">
            {parseResult?.success ? (
              <span>
                Siap menerapkan <strong>{parseResult.updatedResidents?.length || 0}</strong> data warga
                untuk periode <strong>{effectivePeriod}</strong>.
              </span>
            ) : (
              <span>Silakan pilih periode, unduh template, dan unggah file Excel Anda.</span>
            )}
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-200 rounded-xl transition-colors cursor-pointer"
            >
              Batal
            </button>

            <button
              type="button"
              disabled={!parseResult?.success || isSuccess}
              onClick={handleExecuteImport}
              className={`flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold shadow-md transition-all cursor-pointer ${
                parseResult?.success && !isSuccess
                  ? 'bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white shadow-emerald-600/30 ring-2 ring-emerald-300'
                  : 'bg-slate-200 text-slate-400 cursor-not-allowed shadow-none'
              }`}
            >
              {isSuccess ? (
                <>
                  <CheckCircle2 className="w-4 h-4 text-white" />
                  <span>Berhasil Diterapkan!</span>
                </>
              ) : (
                <>
                  <Check className="w-4 h-4" />
                  <span>
                    Terapkan Data Iuran & Kas (
                    {parseResult?.summary?.matchedCount || 0} KK)
                  </span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
