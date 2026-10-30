import React, { useRef, useState } from 'react';
import confetti from 'canvas-confetti';
import {
  AlertCircle,
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
  Wallet,
  X,
} from 'lucide-react';
import { BaksosAgenda, CashTransaction, ResidentHouse } from '../types';
import { formatDateDDMMYYYY, formatRupiah } from '../utils/helpers';
import {
  downloadBillingExcelTemplate,
  parseBillingExcelFile,
  ParseBillingExcelResult,
} from '../utils/billingExcelHelper';

interface BillingExcelUploadModalProps {
  isOpen: boolean;
  onClose: () => void;
  availablePeriods: string[];
  currentPeriod: string;
  residents: ResidentHouse[];
  baksosAgendas?: BaksosAgenda[];
  defaultNominal?: number;
  onConfirmImport: (
    updatedResidents: ResidentHouse[],
    newTransactions: Omit<CashTransaction, 'id'>[],
    periodLabel: string,
    setAsActivePeriod: boolean,
    baksosPaidActions?: { agendaId: string; residentId: string; headName: string; blockNumber: string }[]
  ) => void;
}

export const BillingExcelUploadModal: React.FC<BillingExcelUploadModalProps> = ({
  isOpen,
  onClose,
  availablePeriods,
  currentPeriod,
  residents,
  baksosAgendas = [],
  defaultNominal = 50000,
  onConfirmImport,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedPeriod, setSelectedPeriod] = useState<string>(currentPeriod || 'Oktober 2026');
  const [isCustomPeriod, setIsCustomPeriod] = useState<boolean>(false);
  const [customPeriodInput, setCustomPeriodInput] = useState<string>('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isParsing, setIsParsing] = useState<boolean>(false);
  const [parseResult, setParseResult] = useState<ParseBillingExcelResult | null>(null);
  const [filterPreview, setFilterPreview] = useState<'semua' | 'lunas' | 'iuran_only' | 'baksos_only' | 'tunggakan_only' | 'belum'>('semua');
  const [searchPreview, setSearchPreview] = useState<string>('');
  const [autoRecordCash, setAutoRecordCash] = useState<boolean>(true);
  const [setActivePeriod, setSetActivePeriod] = useState<boolean>(false);
  const [isSuccess, setIsSuccess] = useState<boolean>(false);

  if (!isOpen) return null;

  const effectivePeriod = isCustomPeriod
    ? customPeriodInput.trim() || selectedPeriod
    : selectedPeriod;

  const handleDownloadTemplate = () => {
    downloadBillingExcelTemplate(residents, effectivePeriod, defaultNominal, baksosAgendas);
  };

  const handleFileProcess = async (file: File) => {
    setSelectedFile(file);
    setIsParsing(true);
    setParseResult(null);
    const res = await parseBillingExcelFile(file, effectivePeriod, defaultNominal, residents, baksosAgendas);
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
    const residentsToSave = parseResult.updatedResidents;
    const txsToSave = autoRecordCash ? parseResult.cashTransactions || [] : [];

    onConfirmImport(
      residentsToSave,
      txsToSave,
      effectivePeriod,
      setActivePeriod,
      parseResult.baksosPaidActions
    );

    try {
      confetti({ particleCount: 70, spread: 80, origin: { y: 0.6 } });
    } catch {}
    setIsSuccess(true);
    setTimeout(() => {
      setIsSuccess(false);
      handleReset();
      onClose();
    }, 1200);
  };

  const filteredRows = (parseResult?.rows || []).filter((row) => {
    if (filterPreview === 'lunas' && row.paymentChoice !== 'Semua Lunas') {
      return false;
    }
    if (filterPreview === 'iuran_only' && row.paymentChoice !== 'Hanya Iuran') {
      return false;
    }
    if (filterPreview === 'baksos_only' && row.paymentChoice !== 'Hanya Baksos') {
      return false;
    }
    if (filterPreview === 'tunggakan_only' && row.paymentChoice !== 'Hanya Tunggakan') {
      return false;
    }
    if (filterPreview === 'belum' && row.paymentChoice !== 'Belum Bayar') {
      return false;
    }
    if (searchPreview.trim()) {
      const q = searchPreview.toLowerCase();
      const matchBlock = row.blockNumber.toLowerCase().includes(q);
      const matchName = row.headName.toLowerCase().includes(q);
      const matchChoice = row.paymentChoice.toLowerCase().includes(q);
      if (!matchBlock && !matchName && !matchChoice) return false;
    }
    return true;
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/70 backdrop-blur-xs overflow-y-auto animate-in fade-in duration-200">
      <div className="bg-white rounded-3xl shadow-2xl border-2 border-emerald-400 w-full max-w-5xl overflow-hidden my-4 sm:my-8 flex flex-col max-h-[92vh]">
        {/* MODAL HEADER */}
        <div className="bg-gradient-to-r from-emerald-800 via-teal-800 to-indigo-900 p-4 sm:p-5 text-white flex justify-between items-center shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-white/15 rounded-2xl backdrop-blur-xs shadow-xs border border-white/20">
              <FileSpreadsheet className="w-6 h-6 text-amber-300" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-extrabold text-base sm:text-lg tracking-tight">
                  Upload & Import Excel Penarikan Keuangan
                </h3>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-400 text-slate-950 uppercase">
                  Akses Pengurus
                </span>
              </div>
              <p className="text-xs text-emerald-100/90 mt-0.5">
                Mendukung pembayaran Iuran Bulanan, Tunggakan Sebelumnya, Denda Baksos, atau pilihan membayar salah satu.
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
          <div className="p-4 rounded-2xl bg-gradient-to-br from-emerald-50 via-teal-50/50 to-indigo-50/40 border-2 border-emerald-200 shadow-2xs space-y-3">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <span className="text-xs font-bold text-emerald-950 flex items-center gap-1.5">
                <Calendar className="w-4 h-4 text-emerald-700" />
                <span>Langkah 1: Tentukan Periode & Unduh Template Penarikan Keuangan Lengkap</span>
              </span>
              <button
                type="button"
                onClick={handleDownloadTemplate}
                className="flex items-center gap-1.5 px-3.5 py-1.5 bg-emerald-700 hover:bg-emerald-800 text-white rounded-xl text-xs font-bold shadow-xs transition-colors cursor-pointer"
                title="Download template Excel siap isi sesuai daftar warga saat ini"
              >
                <Download className="w-3.5 h-3.5 text-amber-300" />
                <span>Unduh Template Excel Penarikan ({effectivePeriod})</span>
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
              <div>
                <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                  Pilih Periode Penarikan:
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

            <div className="text-[11px] text-slate-700 leading-relaxed bg-white/90 p-3 rounded-xl border border-emerald-200 space-y-1">
              <p>
                <strong>Ketentuan Kolom Template Excel Penarikan:</strong>
              </p>
              <ul className="list-disc pl-4 space-y-0.5 text-slate-600">
                <li>
                  <strong>Jumlah Iuran Bulanan</strong>: Otomatis kosong (0) untuk rumah kosong, bisa diedit untuk rumah belum ditempati/dihuni.
                </li>
                <li>
                  <strong>Tunggakan Lalu & Denda Baksos</strong>: Terisi otomatis sesuai catatan riwayat warga.
                </li>
                <li>
                  <strong>Pilihan Bayar (Bisa Memilih Salah Satu)</strong>:
                  <span className="font-semibold text-slate-800"> "Semua Lunas"</span>, 
                  <span className="font-semibold text-slate-800"> "Hanya Iuran"</span>, 
                  <span className="font-semibold text-slate-800"> "Hanya Baksos"</span>, 
                  <span className="font-semibold text-slate-800"> "Hanya Tunggakan"</span>, atau 
                  <span className="font-semibold text-slate-800"> "Belum Bayar"</span>.
                </li>
                <li>
                  Komponen yang dibayar otomatis masuk ke Rekap Per KK dan Kas Utama. Komponen yang belum dibayar otomatis masuk ke Daftar Tunggakan Warga.
                </li>
              </ul>
            </div>
          </div>

          {/* STEP 2: DROPZONE FILE EXCEL */}
          <div className="space-y-2">
            <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
              <Upload className="w-4 h-4 text-teal-600" />
              <span>Langkah 2: Pilih atau Tarik (Drop) File Excel Penarikan</span>
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
                      Menganalisis & memvalidasi komponen iuran, tunggakan, dan denda baksos...
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
                        Mendukung format Microsoft Excel: <strong>.xlsx</strong> dan <strong>.xls</strong>
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
                      {selectedFile?.name || 'File Excel Penarikan Keuangan'}
                    </span>
                    <span className="text-[11px] text-emerald-800">
                      Berhasil dibaca: {parseResult.summary?.totalRows || 0} Baris Data Warga
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
              <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-2">
                <div className="p-2.5 rounded-xl bg-slate-900 text-white">
                  <span className="text-[10px] text-slate-400 font-semibold block">Total Baris</span>
                  <span className="text-base font-black font-mono">{parseResult.summary.totalRows} KK</span>
                </div>
                <div className="p-2.5 rounded-xl bg-emerald-100 text-emerald-950 border border-emerald-200">
                  <span className="text-[10px] text-emerald-800 font-semibold block">Semua Lunas</span>
                  <span className="text-base font-black font-mono text-emerald-900">{parseResult.summary.semuaLunasCount}</span>
                </div>
                <div className="p-2.5 rounded-xl bg-teal-100 text-teal-950 border border-teal-200">
                  <span className="text-[10px] text-teal-800 font-semibold block">Hanya Iuran</span>
                  <span className="text-base font-black font-mono text-teal-900">{parseResult.summary.hanyaIuranCount}</span>
                </div>
                <div className="p-2.5 rounded-xl bg-amber-100 text-amber-950 border border-amber-200">
                  <span className="text-[10px] text-amber-800 font-semibold block">Hanya Baksos</span>
                  <span className="text-base font-black font-mono text-amber-900">{parseResult.summary.hanyaBaksosCount}</span>
                </div>
                <div className="p-2.5 rounded-xl bg-purple-100 text-purple-950 border border-purple-200">
                  <span className="text-[10px] text-purple-800 font-semibold block">Hanya Tunggakan</span>
                  <span className="text-base font-black font-mono text-purple-900">{parseResult.summary.hanyaTunggakanCount}</span>
                </div>
                <div className="p-2.5 rounded-xl bg-rose-100 text-rose-950 border border-rose-200">
                  <span className="text-[10px] text-rose-800 font-semibold block">Belum Bayar</span>
                  <span className="text-base font-black font-mono text-rose-900">{parseResult.summary.belumBayarCount}</span>
                </div>
              </div>

              {/* INTEGRATION TOGGLES */}
              <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-2xl space-y-2">
                <span className="text-xs font-bold text-slate-800 block">
                  Konfirmasi Alur Integrasi:
                </span>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                  <label className="flex items-start gap-2 p-2 rounded-xl bg-white border border-slate-200 cursor-pointer hover:border-emerald-400">
                    <input
                      type="checkbox"
                      checked={autoRecordCash}
                      onChange={(e) => setAutoRecordCash(e.target.checked)}
                      className="mt-0.5 rounded text-emerald-600 focus:ring-emerald-500"
                    />
                    <div>
                      <strong className="block text-slate-800">Catat Otomatis ke Buku Kas Utama</strong>
                      <span className="text-[10px] text-slate-500">
                        Total {formatRupiah(parseResult.summary.totalCashInflow)} dari komponen yang terbayar otomatis masuk ke Kas Utama.
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
                      <strong className="block text-slate-800">Jadikan Periode Berjalan Saat Ini</strong>
                      <span className="text-[10px] text-slate-500">
                        Ubah periode aktif portal ke "{effectivePeriod}".
                      </span>
                    </div>
                  </label>
                </div>
              </div>

              {/* TABLE PREVIEW */}
              <div className="space-y-2">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div className="flex flex-wrap items-center gap-1.5 text-xs">
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
                      Semua Lunas ({parseResult.summary.semuaLunasCount})
                    </button>
                    <button
                      type="button"
                      onClick={() => setFilterPreview('iuran_only')}
                      className={`px-2.5 py-1 rounded-lg font-bold transition-colors cursor-pointer ${
                        filterPreview === 'iuran_only'
                          ? 'bg-teal-600 text-white'
                          : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                      }`}
                    >
                      Hanya Iuran ({parseResult.summary.hanyaIuranCount})
                    </button>
                    <button
                      type="button"
                      onClick={() => setFilterPreview('baksos_only')}
                      className={`px-2.5 py-1 rounded-lg font-bold transition-colors cursor-pointer ${
                        filterPreview === 'baksos_only'
                          ? 'bg-amber-600 text-white'
                          : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                      }`}
                    >
                      Hanya Baksos ({parseResult.summary.hanyaBaksosCount})
                    </button>
                    <button
                      type="button"
                      onClick={() => setFilterPreview('tunggakan_only')}
                      className={`px-2.5 py-1 rounded-lg font-bold transition-colors cursor-pointer ${
                        filterPreview === 'tunggakan_only'
                          ? 'bg-purple-600 text-white'
                          : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                      }`}
                    >
                      Hanya Tunggakan ({parseResult.summary.hanyaTunggakanCount})
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

                <div className="border border-slate-300/90 rounded-2xl overflow-hidden max-h-72 overflow-y-auto shadow-xs">
                  <table className="w-full text-left text-xs border-collapse whitespace-nowrap">
                    <thead className="sticky top-0 bg-slate-100 text-slate-800 font-extrabold border-b border-slate-300 z-10">
                      <tr>
                        <th className="py-2.5 px-2 text-center w-10 border border-slate-300 bg-slate-100">No</th>
                        <th className="py-2.5 px-2.5 text-center w-24 border border-slate-300 bg-slate-100">No Blok</th>
                        <th className="py-2.5 px-3 min-w-[190px] border border-slate-300 bg-slate-100">
                          Kepala Keluarga / Penanggung Jawab
                        </th>
                        <th className="py-2.5 px-2.5 text-center border border-slate-300 bg-slate-100">Status Rumah</th>
                        <th className="py-2.5 px-3 text-right border border-slate-300 bg-emerald-100/80 text-emerald-950 font-bold">
                          1. Iuran Bulanan
                        </th>
                        <th className="py-2.5 px-3 text-right border border-slate-300 bg-purple-100/80 text-purple-950 font-bold">
                          2. Tunggakan Lalu
                        </th>
                        <th className="py-2.5 px-3 text-right border border-slate-300 bg-amber-100/80 text-amber-950 font-bold">
                          3. Denda Baksos
                        </th>
                        <th className="py-2.5 px-3 text-right border border-slate-300 bg-rose-100/80 text-rose-950 font-black">
                          Total Tagihan
                        </th>
                        <th className="py-2.5 px-3 text-center min-w-[200px] border border-slate-300 bg-slate-100 text-slate-800">
                          Pilihan Pembayaran &amp; Aksi
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-300">
                      {filteredRows.map((r, i) => {
                        const isKosong = r.isVacant || /kosong/i.test(r.occupancy) || r.paymentChoice === 'Bebas Iuran';
                        const isSemuaLunas = r.paymentChoice === 'Semua Lunas';
                        const isBayarSebagian =
                          r.paymentChoice === 'Hanya Iuran' ||
                          r.paymentChoice === 'Hanya Baksos' ||
                          r.paymentChoice === 'Hanya Tunggakan';

                        const rowClass = isKosong
                          ? 'bg-black text-white border-neutral-800'
                          : isSemuaLunas
                          ? 'bg-emerald-50 text-emerald-950 border-emerald-300'
                          : isBayarSebagian
                          ? 'bg-sky-50 text-sky-950 border-sky-300'
                          : 'bg-rose-50 text-rose-950 border-rose-300';

                        return (
                          <tr key={i} className={`border-b transition-colors ${rowClass}`}>
                            {/* 1. No */}
                            <td className={`py-2 px-2 text-center font-mono border ${isKosong ? 'text-slate-300 border-neutral-800' : 'text-slate-600 border-slate-300'}`}>
                              {i + 1}
                            </td>

                            {/* 2. No Blok */}
                            <td className="py-2 px-2.5 text-center border border-slate-300">
                              <span
                                className={`font-mono font-bold text-xs px-2 py-0.5 rounded-lg border shadow-2xs ${
                                  isKosong
                                    ? 'bg-neutral-900 text-white border-neutral-700'
                                    : isSemuaLunas
                                    ? 'bg-emerald-200/90 text-emerald-950 border-emerald-400'
                                    : isBayarSebagian
                                    ? 'bg-sky-200/90 text-sky-950 border-sky-400'
                                    : 'bg-rose-200/90 text-rose-950 border-rose-400'
                                }`}
                              >
                                Blok {r.blockNumber}
                              </span>
                            </td>

                            {/* 3. Kepala Keluarga / Penanggung Jawab */}
                            <td className="py-2 px-3 border border-slate-300">
                              <span className={`font-extrabold text-xs ${isKosong ? 'text-white' : 'text-slate-900'}`}>
                                {r.headName}
                              </span>
                            </td>

                            {/* 4. Status Rumah */}
                            <td className="py-2 px-2.5 text-center border border-slate-300">
                              <span
                                className={`inline-block px-2 py-0.5 rounded-md text-[10px] font-bold border ${
                                  isKosong
                                    ? 'bg-neutral-900 text-slate-300 border-neutral-700'
                                    : isSemuaLunas
                                    ? 'bg-emerald-100 text-emerald-950 border-emerald-300'
                                    : isBayarSebagian
                                    ? 'bg-sky-100 text-sky-950 border-sky-300'
                                    : 'bg-rose-100 text-rose-950 border-rose-300'
                                }`}
                              >
                                {r.occupancy || (isKosong ? 'Kosong' : 'Ditempati')}
                              </span>
                            </td>

                            {/* 5. 1. Iuran Bulanan */}
                            <td className="py-2 px-3 text-right font-mono border border-slate-300 font-bold">
                              {isKosong ? (
                                <span className="text-slate-400 italic text-[11px]">Rp 0 (Bebas)</span>
                              ) : r.paidDues ? (
                                <span className={isKosong ? 'text-emerald-400' : 'text-emerald-800'}>
                                  {formatRupiah(r.duesAmount)}
                                </span>
                              ) : (
                                <span className={isKosong ? 'text-slate-400' : 'text-rose-900'}>
                                  {formatRupiah(r.duesAmount)}
                                </span>
                              )}
                            </td>

                            {/* 6. 2. Tunggakan Lalu */}
                            <td className="py-2 px-3 text-right font-mono border border-slate-300">
                              {r.previousArrears > 0 ? (
                                <div>
                                  <span className={`font-bold ${isKosong ? 'text-amber-300' : 'text-purple-900'}`}>
                                    {formatRupiah(r.previousArrears)}
                                  </span>
                                  {r.previousArrearsNote && (
                                    <span className="block text-[9px] text-slate-500 font-sans truncate max-w-[120px] text-right">
                                      {r.previousArrearsNote}
                                    </span>
                                  )}
                                </div>
                              ) : (
                                <span className="text-slate-400 font-sans text-[11px]">-</span>
                              )}
                            </td>

                            {/* 7. 3. Denda Baksos */}
                            <td className="py-2 px-3 text-right font-mono border border-slate-300">
                              {r.baksosFine > 0 ? (
                                <div>
                                  <span className={`font-bold ${isKosong ? 'text-rose-400' : 'text-amber-900'}`}>
                                    {formatRupiah(r.baksosFine)}
                                  </span>
                                  {r.unpaidBaksosCount > 0 && (
                                    <span className="block text-[9px] text-amber-700 font-sans">
                                      ({r.unpaidBaksosCount}x Absen)
                                    </span>
                                  )}
                                </div>
                              ) : (
                                <span className="text-slate-400 font-sans text-[11px]">-</span>
                              )}
                            </td>

                            {/* 8. Total Tagihan */}
                            <td className="py-2 px-3 text-right font-mono font-black border border-slate-300 tabular-nums">
                              {r.totalBill > 0 ? (
                                <span className={isKosong ? 'text-rose-400' : 'text-rose-700'}>
                                  {formatRupiah(r.totalBill)}
                                </span>
                              ) : (
                                <span className={isKosong ? 'text-slate-300 text-xs' : 'text-emerald-800 text-xs'}>
                                  Rp 0 (Lunas)
                                </span>
                              )}
                            </td>

                            {/* 9. Pilihan Pembayaran & Aksi */}
                            <td className="py-2 px-3 text-center border border-slate-300">
                              <span
                                className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-xl text-[10px] font-black uppercase tracking-wider border shadow-2xs ${
                                  isKosong
                                    ? 'bg-neutral-900 text-slate-300 border-neutral-700'
                                    : r.paymentChoice === 'Semua Lunas'
                                    ? 'bg-emerald-200 text-emerald-950 border-emerald-400'
                                    : r.paymentChoice === 'Hanya Iuran'
                                    ? 'bg-teal-200 text-teal-950 border-teal-400'
                                    : r.paymentChoice === 'Hanya Baksos'
                                    ? 'bg-amber-200 text-amber-950 border-amber-400'
                                    : r.paymentChoice === 'Hanya Tunggakan'
                                    ? 'bg-purple-200 text-purple-950 border-purple-400'
                                    : 'bg-rose-200 text-rose-950 border-rose-400'
                                }`}
                              >
                                {r.paymentChoice === 'Semua Lunas' && <CheckCircle2 className="w-3 h-3 text-emerald-700 inline" />}
                                <span>{r.paymentChoice}</span>
                              </span>
                            </td>
                          </tr>
                        );
                      })}
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
                Siap menerapkan data penarikan untuk <strong>{parseResult.updatedResidents?.length || 0}</strong> kavling. 
                Total uang masuk ke Kas Utama: <strong className="text-emerald-700 font-mono">{formatRupiah(parseResult.summary?.totalCashInflow || 0)}</strong>.
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
                    Terapkan Penarikan Keuangan ({parseResult?.summary?.matchedCount || 0} KK)
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
