import React, { useRef, useState } from 'react';
import confetti from 'canvas-confetti';
import {
  AlertCircle,
  Calendar,
  Check,
  CheckCircle2,
  Download,
  FileSpreadsheet,
  Search,
  Upload,
  Users,
  X,
} from 'lucide-react';
import { BaksosAgenda, BaksosAttendanceStatus, ResidentHouse } from '../types';
import { formatDateDDMMYYYY, formatRupiah } from '../utils/helpers';
import {
  downloadBaksosExcelTemplate,
  parseBaksosExcelFile,
  ParseBaksosExcelResult,
} from '../utils/baksosExcelHelper';

interface BaksosExcelUploadModalProps {
  isOpen: boolean;
  onClose: () => void;
  agenda: BaksosAgenda;
  residents: ResidentHouse[];
  onConfirmImport: (
    updatedAttendance: Record<string, BaksosAttendanceStatus>,
    updatedFinesPaid: Record<string, boolean>
  ) => void;
}

export const BaksosExcelUploadModal: React.FC<BaksosExcelUploadModalProps> = ({
  isOpen,
  onClose,
  agenda,
  residents,
  onConfirmImport,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isParsing, setIsParsing] = useState<boolean>(false);
  const [parseResult, setParseResult] = useState<ParseBaksosExcelResult | null>(null);
  const [filterPreview, setFilterPreview] = useState<'semua' | 'hadir' | 'tidak_hadir' | 'tidak_wajib' | 'kosong'>('semua');
  const [searchPreview, setSearchPreview] = useState<string>('');
  const [isSuccess, setIsSuccess] = useState<boolean>(false);

  if (!isOpen) return null;

  const handleDownloadTemplate = () => {
    downloadBaksosExcelTemplate(agenda, residents);
  };

  const handleFileProcess = async (file: File) => {
    setSelectedFile(file);
    setIsParsing(true);
    setParseResult(null);
    const res = await parseBaksosExcelFile(file, agenda, residents);
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

  const handleConfirm = () => {
    if (!parseResult || !parseResult.success || !parseResult.updatedAttendance || !parseResult.updatedFinesPaid) return;

    onConfirmImport(parseResult.updatedAttendance, parseResult.updatedFinesPaid);

    setIsSuccess(true);
    try {
      confetti({ particleCount: 70, spread: 70, origin: { y: 0.6 } });
    } catch {}

    setTimeout(() => {
      setIsSuccess(false);
      onClose();
    }, 1200);
  };

  const rows = parseResult?.rows || [];
  const filteredRows = rows.filter((r) => {
    if (filterPreview === 'hadir' && r.attendance !== 'Hadir') return false;
    if (filterPreview === 'tidak_hadir' && r.attendance !== 'Tidak Hadir') return false;
    if (filterPreview === 'tidak_wajib' && r.attendance !== 'Tidak Wajib') return false;
    if (filterPreview === 'kosong' && r.attendance !== 'Kosong') return false;

    if (searchPreview.trim()) {
      const q = searchPreview.toLowerCase();
      const matchBlock = r.blockNumber.toLowerCase().includes(q);
      const matchName = r.headName.toLowerCase().includes(q);
      return matchBlock || matchName;
    }
    return true;
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/70 backdrop-blur-xs overflow-y-auto animate-in fade-in duration-200">
      <div className="bg-white rounded-3xl max-w-4xl w-full max-h-[92vh] flex flex-col shadow-2xl border border-slate-200 overflow-hidden my-auto">
        {/* HEADER */}
        <div className="p-4 sm:p-5 bg-gradient-to-r from-emerald-800 via-teal-800 to-indigo-900 text-white flex items-center justify-between border-b-4 border-emerald-400">
          <div className="flex items-center gap-3">
            <span className="p-2.5 rounded-2xl bg-white/15 border border-white/20 text-amber-300">
              <FileSpreadsheet className="w-5 h-5" />
            </span>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base sm:text-lg font-black text-white">
                  Upload Excel Presensi Bakti Sosial
                </h3>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-amber-400 text-slate-950 uppercase tracking-wider">
                  Format Sama Web
                </span>
              </div>
              <p className="text-xs text-emerald-100 mt-0.5 flex items-center gap-2">
                <span>Agenda: <strong>{agenda.title}</strong></span>
                <span>•</span>
                <span>Tanggal: <strong>{formatDateDDMMYYYY(agenda.date)}</strong></span>
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 text-white/80 hover:text-white bg-white/10 hover:bg-white/20 rounded-xl transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* BODY */}
        <div className="p-4 sm:p-6 overflow-y-auto space-y-5 text-slate-700">
          {/* STEP 1: DOWNLOAD TEMPLATE BANNER */}
          <div className="p-4 rounded-2xl bg-gradient-to-r from-emerald-50 via-teal-50 to-indigo-50 border-2 border-emerald-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-start gap-3">
              <div className="p-2 rounded-xl bg-emerald-600 text-white shrink-0 mt-0.5">
                <Users className="w-5 h-5" />
              </div>
              <div>
                <strong className="block text-xs sm:text-sm font-extrabold text-slate-900">
                  Langkah 1: Download Template Excel Presensi
                </strong>
                <p className="text-xs text-slate-600 mt-0.5">
                  Template ini menggunakan format kolom yang sama persis dengan tabel di web ({residents.length} KK).
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={handleDownloadTemplate}
              className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs shadow-md transition-all cursor-pointer shrink-0 whitespace-nowrap"
            >
              <Download className="w-4 h-4" />
              <span>Download Template Excel</span>
            </button>
          </div>

          {/* STEP 2: DROPZONE FILE */}
          <div className="space-y-2">
            <label className="block text-xs font-bold text-slate-800">
              Langkah 2: Pilih atau Drop File Excel yang Sudah Diisi
            </label>
            <div
              onDragOver={(e) => e.preventDefault()}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className={`p-6 border-2 border-dashed rounded-2xl text-center cursor-pointer transition-all ${
                selectedFile
                  ? 'border-emerald-500 bg-emerald-50/40'
                  : 'border-slate-300 hover:border-emerald-400 bg-slate-50/60 hover:bg-slate-50'
              }`}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".xlsx, .xls"
                onChange={handleFileChange}
                className="hidden"
              />
              <div className="flex flex-col items-center justify-center gap-2">
                <div className="p-3 rounded-2xl bg-white shadow-xs border border-slate-200 text-emerald-600">
                  <Upload className="w-6 h-6" />
                </div>
                {selectedFile ? (
                  <div>
                    <span className="font-bold text-sm text-slate-900 block">{selectedFile.name}</span>
                    <span className="text-xs text-slate-500">
                      {(selectedFile.size / 1024).toFixed(1)} KB · Klik untuk ganti file
                    </span>
                  </div>
                ) : (
                  <div>
                    <span className="font-bold text-xs sm:text-sm text-slate-800 block">
                      Klik untuk memilih file Excel, atau tarik (drag &amp; drop) ke sini
                    </span>
                    <span className="text-[11px] text-slate-500 mt-0.5 block">
                      Mendukung format .xlsx dan .xls (Kolom: No, No Blok, Nama Kepala Keluarga, Status Kehadiran, Denda Baksos, Status Denda)
                    </span>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* PARSING LOADER */}
          {isParsing && (
            <div className="py-6 text-center text-xs font-semibold text-slate-500 animate-pulse">
              Sedang membaca dan menganalisis baris data presensi baksos...
            </div>
          )}

          {/* STEP 3: PREVIEW */}
          {parseResult && parseResult.success && parseResult.summary && (
            <div className="space-y-4 animate-in fade-in duration-200">
              {/* SUMMARY STATS */}
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
                <div className="p-2.5 rounded-xl bg-slate-900 text-white text-center">
                  <span className="text-[10px] text-slate-400 font-semibold block">Total Baris</span>
                  <span className="text-base font-black font-mono">{parseResult.summary.totalRows} KK</span>
                </div>
                <div className="p-2.5 rounded-xl bg-emerald-100 text-emerald-950 border border-emerald-200 text-center">
                  <span className="text-[10px] text-emerald-800 font-semibold block">Warga Hadir</span>
                  <span className="text-base font-black font-mono text-emerald-900">{parseResult.summary.hadirCount}</span>
                </div>
                <div className="p-2.5 rounded-xl bg-rose-100 text-rose-950 border border-rose-200 text-center">
                  <span className="text-[10px] text-rose-800 font-semibold block">Tidak Hadir (Denda)</span>
                  <span className="text-base font-black font-mono text-rose-900">{parseResult.summary.tidakHadirCount}</span>
                </div>
                <div className="p-2.5 rounded-xl bg-sky-100 text-sky-950 border border-sky-200 text-center">
                  <span className="text-[10px] text-sky-800 font-semibold block">Tidak Wajib</span>
                  <span className="text-base font-black font-mono text-sky-900">{parseResult.summary.tidakWajibCount}</span>
                </div>
                <div className="p-2.5 rounded-xl bg-neutral-900 text-white border border-neutral-700 text-center">
                  <span className="text-[10px] text-slate-300 font-semibold block">Rumah Kosong</span>
                  <span className="text-base font-black font-mono">{parseResult.summary.kosongCount}</span>
                </div>
                <div className="p-2.5 rounded-xl bg-amber-100 text-amber-950 border border-amber-200 text-center">
                  <span className="text-[10px] text-amber-800 font-semibold block">Denda Belum Bayar</span>
                  <span className="text-base font-black font-mono text-amber-900">{parseResult.summary.dendaBelumCount}</span>
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
                      Semua ({rows.length})
                    </button>
                    <button
                      type="button"
                      onClick={() => setFilterPreview('hadir')}
                      className={`px-2.5 py-1 rounded-lg font-bold transition-colors cursor-pointer ${
                        filterPreview === 'hadir'
                          ? 'bg-emerald-600 text-white'
                          : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                      }`}
                    >
                      Hadir ({parseResult.summary.hadirCount})
                    </button>
                    <button
                      type="button"
                      onClick={() => setFilterPreview('tidak_hadir')}
                      className={`px-2.5 py-1 rounded-lg font-bold transition-colors cursor-pointer ${
                        filterPreview === 'tidak_hadir'
                          ? 'bg-rose-600 text-white'
                          : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                      }`}
                    >
                      Tidak Hadir ({parseResult.summary.tidakHadirCount})
                    </button>
                    <button
                      type="button"
                      onClick={() => setFilterPreview('tidak_wajib')}
                      className={`px-2.5 py-1 rounded-lg font-bold transition-colors cursor-pointer ${
                        filterPreview === 'tidak_wajib'
                          ? 'bg-sky-600 text-white'
                          : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                      }`}
                    >
                      Tidak Wajib ({parseResult.summary.tidakWajibCount})
                    </button>
                    <button
                      type="button"
                      onClick={() => setFilterPreview('kosong')}
                      className={`px-2.5 py-1 rounded-lg font-bold transition-colors cursor-pointer ${
                        filterPreview === 'kosong'
                          ? 'bg-neutral-900 text-white'
                          : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                      }`}
                    >
                      Kosong ({parseResult.summary.kosongCount})
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
                    <thead className="sticky top-0 bg-gradient-to-r from-emerald-950 via-teal-900 to-slate-900 text-white font-extrabold border-b border-slate-300 z-10">
                      <tr>
                        <th className="py-2.5 px-3 text-center w-12 border border-slate-300/80">No</th>
                        <th className="py-2.5 px-3 text-center w-28 border border-slate-300/80">No Blok</th>
                        <th className="py-2.5 px-4 text-left min-w-[190px] border border-slate-300/80">Nama Kepala Keluarga</th>
                        <th className="py-2.5 px-4 text-center w-48 border border-slate-300/80">Status Kehadiran</th>
                        <th className="py-2.5 px-4 text-center w-52 border border-slate-300/80">Denda Bakti Sosial (Rp 10.000)</th>
                        <th className="py-2.5 px-3 text-center w-40 border border-slate-300/80">Status Denda</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-300">
                      {filteredRows.map((r, i) => {
                        const isKosong = r.attendance === 'Kosong';
                        const isTidakWajib = r.attendance === 'Tidak Wajib';
                        const isHadirOrLunas = r.attendance === 'Hadir' || r.isFinePaid;
                        const isTidakHadir = r.attendance === 'Tidak Hadir';

                        const rowClass = isKosong
                          ? 'bg-neutral-950 text-white border-neutral-800'
                          : isTidakWajib
                          ? 'bg-sky-50 text-sky-950 border-sky-300 font-medium'
                          : isHadirOrLunas
                          ? 'bg-emerald-50 text-emerald-950 border-emerald-300 font-medium'
                          : 'bg-rose-50 text-rose-950 border-rose-300 font-medium';

                        return (
                          <tr key={i} className={`border-b transition-colors ${rowClass}`}>
                            {/* 1. No */}
                            <td className={`py-2 px-3 text-center font-mono border ${isKosong ? 'text-slate-300 border-neutral-800' : 'text-slate-600 border-slate-300'}`}>
                              {i + 1}
                            </td>

                            {/* 2. No Blok */}
                            <td className="py-2 px-3 text-center border border-slate-300">
                              <span
                                className={`font-mono font-bold text-xs px-2 py-0.5 rounded-lg border shadow-2xs ${
                                  isKosong
                                    ? 'bg-neutral-900 text-white border-neutral-700'
                                    : isTidakWajib
                                    ? 'bg-sky-200 text-sky-950 border-sky-400'
                                    : isHadirOrLunas
                                    ? 'bg-emerald-200 text-emerald-950 border-emerald-400'
                                    : 'bg-rose-200 text-rose-950 border-rose-400'
                                }`}
                              >
                                Blok {r.blockNumber}
                              </span>
                            </td>

                            {/* 3. Nama Kepala Keluarga */}
                            <td className="py-2 px-4 border border-slate-300">
                              <span className={`font-extrabold text-xs ${isKosong ? 'text-white' : 'text-slate-900'}`}>
                                {r.headName}
                              </span>
                            </td>

                            {/* 4. Status Kehadiran */}
                            <td className="py-2 px-4 text-center border border-slate-300">
                              <span
                                className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-lg text-xs font-bold border shadow-2xs ${
                                  r.attendance === 'Hadir'
                                    ? 'bg-emerald-600 text-white border-emerald-700'
                                    : r.attendance === 'Tidak Hadir'
                                    ? 'bg-rose-600 text-white border-rose-700'
                                    : r.attendance === 'Tidak Wajib'
                                    ? 'bg-sky-600 text-white border-sky-700'
                                    : 'bg-slate-700 text-white border-slate-800'
                                }`}
                              >
                                {r.attendance}
                              </span>
                            </td>

                            {/* 5. Denda Bakti Sosial */}
                            <td className="py-2 px-4 text-center font-mono border border-slate-300">
                              {r.attendance === 'Tidak Hadir' ? (
                                <span className="font-bold text-rose-600">
                                  Rp 10.000
                                </span>
                              ) : (
                                <span className={isKosong ? 'text-slate-400 font-sans text-xs' : 'text-slate-500 font-sans text-xs'}>
                                  Rp 0 (Bebas)
                                </span>
                              )}
                            </td>

                            {/* 6. Status Denda */}
                            <td className="py-2 px-3 text-center border border-slate-300">
                              {r.attendance === 'Tidak Hadir' ? (
                                <span
                                  className={`inline-block px-2 py-0.5 rounded-md text-[10px] font-black uppercase tracking-wider border shadow-2xs ${
                                    r.isFinePaid
                                      ? 'bg-emerald-100 text-emerald-950 border-emerald-300'
                                      : 'bg-rose-100 text-rose-950 border-rose-300'
                                  }`}
                                >
                                  {r.isFinePaid ? '✓ Denda Lunas' : 'Belum Bayar'}
                                </span>
                              ) : (
                                <span className={isKosong ? 'text-slate-400 text-xs' : 'text-slate-400 text-xs'}>
                                  -
                                </span>
                              )}
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

        {/* FOOTER */}
        <div className="p-4 bg-slate-50 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="text-xs text-slate-500 text-center sm:text-left">
            {parseResult?.summary && (
              <span>
                Total <strong>{parseResult.summary.totalRows} KK</strong> siap diperbarui ke agenda "{agenda.title}".
              </span>
            )}
          </div>
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 sm:flex-none px-4 py-2.5 rounded-xl border border-slate-300 text-slate-700 font-bold text-xs hover:bg-slate-100 transition-colors cursor-pointer"
            >
              Batal
            </button>
            <button
              type="button"
              disabled={!parseResult || !parseResult.success || isSuccess}
              onClick={handleConfirm}
              className={`flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-5 py-2.5 rounded-xl font-black text-xs shadow-md transition-all cursor-pointer ${
                isSuccess
                  ? 'bg-emerald-600 text-white'
                  : parseResult && parseResult.success
                  ? 'bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white shadow-emerald-500/20'
                  : 'bg-slate-200 text-slate-400 cursor-not-allowed shadow-none'
              }`}
            >
              {isSuccess ? (
                <>
                  <Check className="w-4 h-4" />
                  <span>Presensi Berhasil Diperbarui!</span>
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Terapkan Presensi Baksos</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
