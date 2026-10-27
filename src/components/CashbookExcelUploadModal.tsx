import React, { useRef, useState } from 'react';
import confetti from 'canvas-confetti';
import {
  AlertCircle,
  ArrowDownRight,
  ArrowUpRight,
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
import { CashTransaction } from '../types';
import { formatDateDDMMYYYY, formatRupiah } from '../utils/helpers';
import {
  downloadCashbookExcelTemplate,
  parseCashbookExcelFile,
  ParseCashbookExcelResult,
  ParsedCashbookRow,
} from '../utils/cashbookExcelHelper';

interface CashbookExcelUploadModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentPeriodLabel?: string;
  onConfirmImport: (newTransactions: Omit<CashTransaction, 'id'>[]) => void;
}

export const CashbookExcelUploadModal: React.FC<CashbookExcelUploadModalProps> = ({
  isOpen,
  onClose,
  currentPeriodLabel = 'Oktober 2026',
  onConfirmImport,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isParsing, setIsParsing] = useState<boolean>(false);
  const [parseResult, setParseResult] = useState<ParseCashbookExcelResult | null>(null);

  const [filterType, setFilterType] = useState<'semua' | 'masuk' | 'keluar' | 'invalid'>('semua');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [isSuccess, setIsSuccess] = useState<boolean>(false);

  if (!isOpen) return null;

  const handleDownloadTemplate = () => {
    downloadCashbookExcelTemplate(currentPeriodLabel);
  };

  const handleFileProcess = async (file: File) => {
    setSelectedFile(file);
    setIsParsing(true);
    setParseResult(null);

    const res = await parseCashbookExcelFile(file);
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

  const handleExecuteImport = () => {
    if (!parseResult || !parseResult.validTransactions || parseResult.validTransactions.length === 0) {
      return;
    }

    onConfirmImport(parseResult.validTransactions);
    setIsSuccess(true);
    try {
      confetti({ particleCount: 70, spread: 80, origin: { y: 0.6 } });
    } catch {}

    setTimeout(() => {
      setIsSuccess(false);
      onClose();
    }, 1800);
  };

  const filteredRows = (parseResult?.rows || []).filter((r) => {
    if (filterType === 'masuk' && r.type !== 'masuk') return false;
    if (filterType === 'keluar' && r.type !== 'keluar') return false;
    if (filterType === 'invalid' && r.isValid) return false;

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchDesc = r.description.toLowerCase().includes(q);
      const matchCat = r.category.toLowerCase().includes(q);
      const matchPool = r.pool.toLowerCase().includes(q);
      if (!matchDesc && !matchCat && !matchPool) return false;
    }

    return true;
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-slate-950/70 backdrop-blur-xs overflow-y-auto animate-in fade-in duration-200">
      <div className="bg-white rounded-3xl shadow-2xl border border-slate-200 w-full max-w-4xl max-h-[92vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="p-4 sm:p-5 bg-gradient-to-r from-emerald-700 via-teal-700 to-cyan-800 text-white flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-white/10 rounded-2xl backdrop-blur-xs border border-white/20">
              <FileSpreadsheet className="w-5 h-5 text-amber-300" />
            </div>
            <div>
              <h3 className="font-extrabold text-base sm:text-lg flex items-center gap-2">
                <span>Upload Excel Buku Kas (Keluar & Masuk)</span>
                <span className="px-2 py-0.5 rounded-full text-[10px] bg-amber-400 text-slate-950 font-bold uppercase tracking-wider">
                  Input Massal
                </span>
              </h3>
              <p className="text-xs text-emerald-100 mt-0.5">
                Download template excel, isi catatan pemasukan & pengeluaran kas, lalu upload untuk sinkronisasi massal.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-xl text-white/80 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body Content */}
        <div className="p-4 sm:p-6 overflow-y-auto space-y-5 flex-1">
          {/* STEP 1 & STEP 2 Action Banner */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
            {/* Step 1: Download Template */}
            <div className="p-4 rounded-2xl border-2 border-dashed border-emerald-300 bg-emerald-50/50 flex flex-col justify-between space-y-3">
              <div>
                <div className="flex items-center gap-2">
                  <span className="w-6 h-6 rounded-full bg-emerald-600 text-white text-xs font-bold flex items-center justify-center">
                    1
                  </span>
                  <h4 className="font-bold text-xs sm:text-sm text-emerald-950">
                    Download Template Excel Buku Kas
                  </h4>
                </div>
                <p className="text-xs text-slate-600 mt-1.5 leading-relaxed">
                  Gunakan template resmi dengan kolom: Tanggal, Jenis (Masuk/Keluar), Alokasi Kas (Kas Utama/WiFi/Sampah), Kategori, Uraian, dan Nominal.
                </p>
              </div>

              <button
                type="button"
                onClick={handleDownloadTemplate}
                className="w-full flex items-center justify-center gap-2 py-2.5 px-4 bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold rounded-xl shadow-xs transition-colors cursor-pointer"
              >
                <Download className="w-4 h-4 text-amber-300" />
                <span>Download Template (.xlsx)</span>
              </button>
            </div>

            {/* Step 2: Upload Excel File */}
            <div
              onDragOver={(e) => e.preventDefault()}
              onDrop={handleDrop}
              className={`p-4 rounded-2xl border-2 border-dashed flex flex-col justify-between space-y-3 transition-colors ${
                selectedFile
                  ? 'border-teal-400 bg-teal-50/50'
                  : 'border-slate-300 bg-slate-50 hover:bg-slate-100/70'
              }`}
            >
              <div>
                <div className="flex items-center gap-2">
                  <span className="w-6 h-6 rounded-full bg-teal-600 text-white text-xs font-bold flex items-center justify-center">
                    2
                  </span>
                  <h4 className="font-bold text-xs sm:text-sm text-slate-900">
                    Pilih / Tarik File Excel Anda
                  </h4>
                </div>
                <p className="text-xs text-slate-600 mt-1.5 leading-relaxed">
                  Format file: <strong>.xlsx</strong> atau <strong>.xls</strong>. Sistem otomatis membaca baris pemasukan & pengeluaran kas.
                </p>
              </div>

              <div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".xlsx, .xls"
                  onChange={handleFileChange}
                  className="hidden"
                />
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="w-full flex items-center justify-center gap-2 py-2.5 px-4 bg-white hover:bg-slate-50 text-slate-800 border border-slate-300 text-xs font-bold rounded-xl shadow-2xs transition-colors cursor-pointer"
                >
                  <Upload className="w-4 h-4 text-teal-600" />
                  <span>
                    {selectedFile ? `Ganti File (${selectedFile.name})` : 'Pilih File Excel...'}
                  </span>
                </button>
              </div>
            </div>
          </div>

          {/* Loading Indicator */}
          {isParsing && (
            <div className="p-8 text-center bg-slate-50 rounded-2xl border border-slate-200 flex flex-col items-center justify-center gap-2">
              <RefreshCw className="w-6 h-6 text-teal-600 animate-spin" />
              <p className="text-xs font-bold text-slate-700">Sedang membaca dan memvalidasi file Excel Buku Kas...</p>
            </div>
          )}

          {/* Parse Error State */}
          {parseResult && !parseResult.success && (
            <div className="p-4 bg-rose-50 border border-rose-200 rounded-2xl text-rose-800 text-xs flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
              <div>
                <h5 className="font-bold">Gagal Memproses Excel:</h5>
                <p className="mt-0.5">{parseResult.error}</p>
              </div>
            </div>
          )}

          {/* Preview & Summary Area */}
          {parseResult && parseResult.success && parseResult.summary && (
            <div className="space-y-4">
              {/* Summary Cards */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl">
                  <span className="text-[11px] text-slate-500 font-semibold block">Total Transaksi:</span>
                  <div className="font-mono font-extrabold text-sm sm:text-base text-slate-900 mt-0.5">
                    {parseResult.summary.totalRows} Baris
                  </div>
                  <span className="text-[10px] text-emerald-700">
                    {parseResult.summary.validCount} Valid · {parseResult.summary.invalidCount} Error
                  </span>
                </div>

                <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl">
                  <span className="text-[11px] text-emerald-800 font-semibold flex items-center gap-1">
                    <ArrowDownRight className="w-3.5 h-3.5 text-emerald-600" />
                    <span>Total Uang Masuk (+):</span>
                  </span>
                  <div className="font-mono font-black text-sm sm:text-base text-emerald-900 mt-0.5 tabular-nums">
                    {formatRupiah(parseResult.summary.totalMasuk)}
                  </div>
                </div>

                <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl">
                  <span className="text-[11px] text-rose-800 font-semibold flex items-center gap-1">
                    <ArrowUpRight className="w-3.5 h-3.5 text-rose-600" />
                    <span>Total Uang Keluar (-):</span>
                  </span>
                  <div className="font-mono font-black text-sm sm:text-base text-rose-900 mt-0.5 tabular-nums">
                    {formatRupiah(parseResult.summary.totalKeluar)}
                  </div>
                </div>

                <div className="p-3 bg-teal-50 border border-teal-200 rounded-xl">
                  <span className="text-[11px] text-teal-800 font-semibold block">Selisih Net Kas:</span>
                  <div className="font-mono font-black text-sm sm:text-base text-teal-950 mt-0.5 tabular-nums">
                    {formatRupiah(parseResult.summary.netAmount)}
                  </div>
                </div>
              </div>

              {/* Filter & Search Toolbar */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 pt-2 border-t border-slate-200">
                <div className="flex items-center gap-1 text-xs">
                  <button
                    type="button"
                    onClick={() => setFilterType('semua')}
                    className={`px-2.5 py-1 rounded-lg font-semibold cursor-pointer ${
                      filterType === 'semua'
                        ? 'bg-slate-900 text-white font-bold'
                        : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                    }`}
                  >
                    Semua ({parseResult.summary.totalRows})
                  </button>
                  <button
                    type="button"
                    onClick={() => setFilterType('masuk')}
                    className={`px-2.5 py-1 rounded-lg font-semibold cursor-pointer ${
                      filterType === 'masuk'
                        ? 'bg-emerald-600 text-white font-bold'
                        : 'bg-emerald-50 text-emerald-800 hover:bg-emerald-100'
                    }`}
                  >
                    Masuk (+)
                  </button>
                  <button
                    type="button"
                    onClick={() => setFilterType('keluar')}
                    className={`px-2.5 py-1 rounded-lg font-semibold cursor-pointer ${
                      filterType === 'keluar'
                        ? 'bg-rose-600 text-white font-bold'
                        : 'bg-rose-50 text-rose-800 hover:bg-rose-100'
                    }`}
                  >
                    Keluar (-)
                  </button>
                  {parseResult.summary.invalidCount > 0 && (
                    <button
                      type="button"
                      onClick={() => setFilterType('invalid')}
                      className={`px-2.5 py-1 rounded-lg font-semibold cursor-pointer ${
                        filterType === 'invalid'
                          ? 'bg-amber-600 text-white font-bold'
                          : 'bg-amber-50 text-amber-800 hover:bg-amber-100'
                      }`}
                    >
                      Perlu Perbaikan ({parseResult.summary.invalidCount})
                    </button>
                  )}
                </div>

                <div className="relative w-full sm:w-56">
                  <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2" />
                  <input
                    type="text"
                    placeholder="Cari keterangan / kategori..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full pl-8 pr-3 py-1 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-teal-500"
                  />
                </div>
              </div>

              {/* Preview Table */}
              <div className="overflow-x-auto rounded-xl border border-slate-200 max-h-64 shadow-2xs">
                <table className="w-full text-left text-xs border-collapse whitespace-nowrap">
                  <thead className="sticky top-0 bg-slate-100 font-bold text-slate-700 border-b border-slate-200">
                    <tr>
                      <th className="py-2 px-2 text-center w-8">No</th>
                      <th className="py-2 px-3">Tanggal</th>
                      <th className="py-2 px-3 text-center">Tipe</th>
                      <th className="py-2 px-3">Alokasi Kas</th>
                      <th className="py-2 px-3">Kategori</th>
                      <th className="py-2 px-3 min-w-[200px]">Uraian / Keterangan</th>
                      <th className="py-2 px-3 text-right">Nominal</th>
                      <th className="py-2 px-3 text-center">Validasi</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 bg-white">
                    {filteredRows.map((row) => (
                      <tr
                        key={row.rowNumber}
                        className={`transition-colors ${
                          !row.isValid
                            ? 'bg-rose-50/40 text-rose-900'
                            : row.type === 'masuk'
                            ? 'hover:bg-emerald-50/20'
                            : 'hover:bg-rose-50/20'
                        }`}
                      >
                        <td className="py-2 px-2 text-center text-slate-400 font-mono">
                          {row.rowNumber}
                        </td>
                        <td className="py-2 px-3 font-mono text-slate-600">
                          {formatDateDDMMYYYY(row.date)}
                        </td>
                        <td className="py-2 px-3 text-center">
                          <span
                            className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold ${
                              row.type === 'masuk'
                                ? 'bg-emerald-100 text-emerald-800'
                                : 'bg-rose-100 text-rose-800'
                            }`}
                          >
                            {row.type === 'masuk' ? 'Masuk (+)' : 'Keluar (-)'}
                          </span>
                        </td>
                        <td className="py-2 px-3 font-medium text-slate-700">
                          {row.pool}
                        </td>
                        <td className="py-2 px-3 text-slate-600">
                          {row.category}
                        </td>
                        <td className="py-2 px-3 text-slate-900 font-semibold max-w-[280px] truncate" title={row.description}>
                          {row.description}
                        </td>
                        <td className={`py-2 px-3 text-right font-mono font-bold tabular-nums ${
                          row.type === 'masuk' ? 'text-emerald-700' : 'text-rose-700'
                        }`}>
                          {formatRupiah(row.amount)}
                        </td>
                        <td className="py-2 px-3 text-center">
                          {row.isValid ? (
                            <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700">
                              <Check className="w-3.5 h-3.5" />
                              <span>Valid</span>
                            </span>
                          ) : (
                            <span className="inline-block px-1.5 py-0.5 rounded bg-rose-100 text-rose-800 text-[10px] font-bold" title={row.errorMessage}>
                              {row.errorMessage || 'Error'}
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="p-4 bg-slate-50 border-t border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shrink-0">
          <div className="text-xs text-slate-600">
            {parseResult?.validTransactions ? (
              <span>
                Siap mengimpor{' '}
                <strong className="text-emerald-700">{parseResult.validTransactions.length} transaksi valid</strong>{' '}
                ke Buku Kas Keluar & Masuk.
              </span>
            ) : (
              <span>Silakan pilih file Excel untuk melihat pratinjau data.</span>
            )}
          </div>

          <div className="flex items-center gap-2 self-end sm:self-auto">
            <button
              type="button"
              onClick={onClose}
              disabled={isSuccess}
              className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-200/80 rounded-xl cursor-pointer transition-colors"
            >
              Batal
            </button>
            <button
              type="button"
              onClick={handleExecuteImport}
              disabled={
                !parseResult ||
                !parseResult.validTransactions ||
                parseResult.validTransactions.length === 0 ||
                isSuccess
              }
              className={`flex items-center gap-2 px-5 py-2 text-xs font-bold rounded-xl shadow-xs transition-all cursor-pointer ${
                isSuccess
                  ? 'bg-emerald-600 text-white'
                  : 'bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white disabled:opacity-50 disabled:cursor-not-allowed'
              }`}
            >
              {isSuccess ? (
                <>
                  <CheckCircle2 className="w-4 h-4 text-emerald-200" />
                  <span>Berhasil Diimpor!</span>
                </>
              ) : (
                <>
                  <Upload className="w-4 h-4 text-amber-200" />
                  <span>
                    Impor {parseResult?.validTransactions?.length || 0} Transaksi ke Buku Kas
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
