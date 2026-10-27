import React, { useRef, useState } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  Download,
  FileSpreadsheet,
  HelpCircle,
  RefreshCw,
  Upload,
  X,
} from 'lucide-react';
import { FamilyMember, ResidentHouse } from '../types';
import {
  downloadExcelTemplate,
  parseResidentsFromExcelFile,
} from '../utils/helpers';

interface ExcelUploadModalProps {
  isOpen: boolean;
  onClose: () => void;
  onImportResidents: (houses: ResidentHouse[], mode: 'replace' | 'merge') => void;
}

export const ExcelUploadModal: React.FC<ExcelUploadModalProps> = ({
  isOpen,
  onClose,
  onImportResidents,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isParsing, setIsParsing] = useState(false);
  const [parseError, setParseError] = useState<string | null>(null);
  const [parsedData, setParsedData] = useState<ResidentHouse[] | null>(null);
  const [totalRows, setTotalRows] = useState<number>(0);
  const [importMode, setImportMode] = useState<'merge' | 'replace'>('merge');
  const [isSuccess, setIsSuccess] = useState(false);

  if (!isOpen) return null;

  const handleFileChange = async (file: File) => {
    setSelectedFile(file);
    setParseError(null);
    setParsedData(null);
    setIsParsing(true);

    const result = await parseResidentsFromExcelFile(file);
    setIsParsing(false);

    if (result.success && result.data) {
      setParsedData(result.data);
      setTotalRows(result.totalRows || 0);
    } else {
      setParseError(result.error || 'Gagal memproses file Excel.');
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileChange(e.dataTransfer.files[0]);
    }
  };

  const handleConfirmImport = () => {
    if (!parsedData || parsedData.length === 0) return;
    onImportResidents(parsedData, importMode);
    setIsSuccess(true);
    setTimeout(() => {
      setIsSuccess(false);
      onClose();
    }, 1200);
  };

  const handleReset = () => {
    setSelectedFile(null);
    setParsedData(null);
    setParseError(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs overflow-y-auto animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-2xl overflow-hidden my-8">
        {/* Header */}
        <div className="bg-gradient-to-r from-emerald-600 to-teal-700 p-5 text-white flex justify-between items-center">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-white/10 rounded-xl">
              <FileSpreadsheet className="w-5 h-5 text-emerald-200" />
            </div>
            <div>
              <h3 className="font-bold text-base leading-snug">
                Upload & Update Data Warga via Excel
              </h3>
              <p className="text-xs text-emerald-100">
                Perbarui buku induk warga secara massal menggunakan file spreadsheet (.xlsx / .xls)
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-emerald-100 hover:text-white hover:bg-white/10 rounded-lg transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-5 max-h-[80vh] overflow-y-auto">
          {/* Template Download Notification Card */}
          <div className="p-4 bg-emerald-50/80 border border-emerald-200 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="space-y-0.5">
              <h4 className="text-xs font-bold text-emerald-900 flex items-center gap-1.5">
                <HelpCircle className="w-4 h-4 text-emerald-700" />
                <span>Format Kolom Excel yang Didukung</span>
              </h4>
              <p className="text-[11px] text-emerald-800 leading-relaxed">
                Unduh template resmi kami untuk memastikan susunan kolom sesuai dengan sistem.
              </p>
            </div>
            <button
              onClick={downloadExcelTemplate}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-white hover:bg-emerald-100 text-emerald-800 border border-emerald-300 rounded-lg text-xs font-semibold shadow-xs transition-colors shrink-0 cursor-pointer self-start sm:self-auto"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Unduh Template (.xlsx)</span>
            </button>
          </div>

          {/* Upload Dropzone */}
          {!parsedData && (
            <div
              onDragOver={(e) => e.preventDefault()}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className="border-2 border-dashed border-slate-300 hover:border-emerald-500 bg-slate-50 hover:bg-emerald-50/30 rounded-2xl p-8 text-center transition-all cursor-pointer space-y-3"
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".xlsx, .xls"
                className="hidden"
                onChange={(e) => {
                  if (e.target.files && e.target.files[0]) {
                    handleFileChange(e.target.files[0]);
                  }
                }}
              />
              <div className="w-12 h-12 bg-emerald-100 text-emerald-700 rounded-2xl flex items-center justify-center mx-auto">
                {isParsing ? (
                  <RefreshCw className="w-6 h-6 animate-spin text-emerald-600" />
                ) : (
                  <Upload className="w-6 h-6" />
                )}
              </div>
              <div>
                <p className="text-sm font-bold text-slate-800">
                  {isParsing
                    ? 'Sedang membaca dan menganalisis file Excel...'
                    : 'Pilih File Excel atau Tarik & Lepaskan ke Sini'}
                </p>
                <p className="text-xs text-slate-500 mt-1">
                  Mendukung format Microsoft Excel <strong>.xlsx</strong> dan <strong>.xls</strong>
                </p>
              </div>
              {selectedFile && !isParsing && (
                <div className="inline-block bg-white border border-slate-200 px-3 py-1 rounded-md text-xs font-mono text-slate-700">
                  {selectedFile.name} ({(selectedFile.size / 1024).toFixed(1)} KB)
                </div>
              )}
            </div>
          )}

          {/* Parsing Error */}
          {parseError && (
            <div className="p-4 bg-rose-50 border border-rose-200 rounded-xl flex items-start gap-3 text-rose-800 text-xs">
              <AlertCircle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
              <div className="space-y-1">
                <p className="font-bold">Gagal Memproses Excel:</p>
                <p>{parseError}</p>
                <p className="text-[11px] text-rose-700 pt-1">
                  Tips: Pastikan baris memiliki kolom <strong>No Blok</strong>, <strong>Kepala Keluarga</strong>, dan <strong>Nama Anggota</strong>. Anda bisa menggunakan tombol "Unduh Template" di atas sebagai panduan.
                </p>
              </div>
            </div>
          )}

          {/* Parsed Preview & Options */}
          {parsedData && (
            <div className="space-y-4">
              {/* Summary Stats of parsed Excel */}
              <div className="grid grid-cols-3 gap-3">
                <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-center">
                  <span className="block text-2xl font-black text-emerald-800 font-mono">
                    {totalRows}
                  </span>
                  <span className="text-[11px] font-semibold text-emerald-700">Baris Data</span>
                </div>
                <div className="p-3 bg-teal-50 border border-teal-200 rounded-xl text-center">
                  <span className="block text-2xl font-black text-teal-800 font-mono">
                    {parsedData.length}
                  </span>
                  <span className="text-[11px] font-semibold text-teal-700">Rumah / No Blok</span>
                </div>
                <div className="p-3 bg-cyan-50 border border-cyan-200 rounded-xl text-center">
                  <span className="block text-2xl font-black text-cyan-800 font-mono">
                    {parsedData.flatMap((h) => h.members).length}
                  </span>
                  <span className="text-[11px] font-semibold text-cyan-700">Total Anggota Jiwa</span>
                </div>
              </div>

              {/* Import Mode Selector */}
              <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
                <label className="block text-xs font-bold text-slate-800 uppercase tracking-wider">
                  Pilih Metode Pembaruan Data:
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                  <label
                    className={`flex items-start gap-2 p-3 rounded-lg border cursor-pointer transition-all ${
                      importMode === 'merge'
                        ? 'bg-emerald-50/80 border-emerald-400 text-emerald-950 font-medium'
                        : 'bg-white border-slate-200 text-slate-700'
                    }`}
                  >
                    <input
                      type="radio"
                      name="importMode"
                      value="merge"
                      checked={importMode === 'merge'}
                      onChange={() => setImportMode('merge')}
                      className="mt-0.5 text-emerald-600 focus:ring-emerald-500"
                    />
                    <div>
                      <span className="font-bold block">Perbarui & Gabungkan (Disarankan)</span>
                      <span className="text-[11px] text-slate-500 leading-relaxed block mt-0.5">
                        Memperbarui blok yang cocok dan menambahkan blok baru tanpa menghapus rumah lain yang sudah ada.
                      </span>
                    </div>
                  </label>

                  <label
                    className={`flex items-start gap-2 p-3 rounded-lg border cursor-pointer transition-all ${
                      importMode === 'replace'
                        ? 'bg-rose-50/80 border-rose-400 text-rose-950 font-medium'
                        : 'bg-white border-slate-200 text-slate-700'
                    }`}
                  >
                    <input
                      type="radio"
                      name="importMode"
                      value="replace"
                      checked={importMode === 'replace'}
                      onChange={() => setImportMode('replace')}
                      className="mt-0.5 text-rose-600 focus:ring-rose-500"
                    />
                    <div>
                      <span className="font-bold block text-rose-800">Timpa Seluruh Data</span>
                      <span className="text-[11px] text-slate-500 leading-relaxed block mt-0.5">
                        Mengganti seluruh daftar warga dengan data yang ada di file Excel ini.
                      </span>
                    </div>
                  </label>
                </div>
              </div>

              {/* Data Table Preview */}
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-bold text-slate-700">
                    Pratinjau Baris Buku Induk Excel ({parsedData.length} Rumah · {totalRows} Baris):
                  </span>
                  <button
                    onClick={handleReset}
                    className="text-xs text-rose-600 hover:underline cursor-pointer"
                  >
                    Ganti File Excel
                  </button>
                </div>

                <div className="max-h-60 overflow-auto border border-slate-200 rounded-xl">
                  <table className="w-full text-left text-xs border-collapse whitespace-nowrap">
                    <thead className="bg-slate-100 text-slate-700 sticky top-0 font-semibold border-b border-slate-200">
                      <tr>
                        <th className="py-2 px-3">No Blok</th>
                        <th className="py-2 px-3">Kepala Keluarga</th>
                        <th className="py-2 px-3">Nama Anggota</th>
                        <th className="py-2 px-3">Status Hubungan</th>
                        <th className="py-2 px-3">Tempat, Tgl Lahir</th>
                        <th className="py-2 px-3">L/P</th>
                        <th className="py-2 px-3">Agama</th>
                        <th className="py-2 px-3">No Telepon / WA</th>
                        <th className="py-2 px-3">Kepemilikan</th>
                        <th className="py-2 px-3">Status Rumah</th>
                        <th className="py-2 px-3">Status Rukem</th>
                        <th className="py-2 px-3">Status WiFi</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {parsedData
                        .flatMap((house): { house: ResidentHouse; m: FamilyMember | null }[] =>
                          house.members && house.members.length > 0
                            ? house.members.map((m) => ({ house, m }))
                            : [{ house, m: null }]
                        )
                        .slice(0, 25)
                        .map(({ house, m }, i) => (
                          <tr key={`${house.id}-${i}`} className="hover:bg-slate-50">
                            <td className="py-2 px-3 font-mono font-bold text-emerald-800">
                              {house.blockNumber}
                            </td>
                            <td className="py-2 px-3 font-semibold text-slate-800">
                              {house.headName}
                            </td>
                            <td className="py-2 px-3 text-slate-900 font-medium">
                              {m ? m.name : house.headName}
                            </td>
                            <td className="py-2 px-3 text-slate-600">
                              {m ? m.relation : 'Kepala Keluarga'}
                            </td>
                            <td className="py-2 px-3 font-mono text-slate-600">
                              {m ? `${m.birthPlace}, ${m.birthDate.split('-').reverse().join('/')}` : '-'}
                            </td>
                            <td className="py-2 px-3 text-slate-600">{m ? m.gender : '-'}</td>
                            <td className="py-2 px-3 text-slate-600">{m ? m.religion : '-'}</td>
                            <td className="py-2 px-3 font-mono text-slate-600">
                              {house.phone || '-'}
                            </td>
                            <td className="py-2 px-3 text-slate-600">{house.ownership}</td>
                            <td className="py-2 px-3 text-slate-600">{house.occupancy}</td>
                            <td className="py-2 px-3 text-slate-600">{house.rukem}</td>
                            <td className="py-2 px-3 text-slate-600">
                              {house.wifiStatus === 'Pasang'
                                ? `Pasang (${house.wifiProvider})`
                                : 'Tidak Pasang'}
                            </td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {isSuccess && (
            <div className="p-3 bg-emerald-100 text-emerald-800 rounded-xl text-xs font-semibold flex items-center justify-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              <span>Data warga berhasil diperbarui dari Excel!</span>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-200">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg cursor-pointer transition-colors"
            >
              Batal
            </button>
            {parsedData && (
              <button
                type="button"
                onClick={handleConfirmImport}
                disabled={isSuccess}
                className="flex items-center gap-1.5 px-5 py-2 text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg shadow-sm transition-colors cursor-pointer"
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>
                  {importMode === 'merge' ? 'Perbarui & Gabungkan Data' : 'Terapkan (Timpa Seluruh Data)'}
                </span>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
