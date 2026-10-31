import React, { useMemo, useState } from 'react';
import {
  Check,
  Copy,
  CreditCard,
  Search,
  Sparkles,
} from 'lucide-react';
import { BaksosAgenda, CashTransaction, ResidentHouse, SiteConfig } from '../types';
import {
  computeOverallKKRecapList,
  formatDateDDMMYYYY,
  formatRupiah,
  isHouseVacant,
} from '../utils/helpers';
import { BalanceBreakdown } from '../hooks/useStorage';

interface ResidentSelfCheckBarProps {
  residents: ResidentHouse[];
  baksosAgendas: BaksosAgenda[];
  transactions?: CashTransaction[];
  balances: BalanceBreakdown;
  config: SiteConfig;
  isAdmin?: boolean;
  onNavigateTab: (tab: string) => void;
}

export const ResidentSelfCheckBar: React.FC<ResidentSelfCheckBarProps> = ({
  residents,
  baksosAgendas,
  transactions = [],
  balances,
  config,
  isAdmin = false,
  onNavigateTab,
}) => {
  const [selectedBlock, setSelectedBlock] = useState<string>('');
  const [copiedBank, setCopiedBank] = useState(false);

  const handleCopyRekening = () => {
    try {
      navigator.clipboard.writeText('7130889411');
      setCopiedBank(true);
      setTimeout(() => setCopiedBank(false), 2500);
    } catch {
      const textarea = document.createElement('textarea');
      textarea.value = '7130889411';
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
      setCopiedBank(true);
      setTimeout(() => setCopiedBank(false), 2500);
    }
  };

  const { recapList } = useMemo(() => {
    return computeOverallKKRecapList(residents, config, transactions, baksosAgendas);
  }, [residents, config, transactions, baksosAgendas]);

  const selectedHouse = residents.find((r) => r.blockNumber === selectedBlock);

  const getHouseSummary = (house: ResidentHouse) => {
    const recapItem = recapList.find((r) => r.house.id === house.id);
    const duesDebt = recapItem ? recapItem.currentMonthDuesArrears : 0;
    const unpaidBaksos = baksosAgendas.filter(
      (a) => a.attendance?.[house.id] === 'Tidak Hadir' && !a.finesPaid?.[house.id]
    );
    const baksosDebt = recapItem ? recapItem.baksosFineArrears : unpaidBaksos.length * 10000;
    const prevDebt = recapItem ? recapItem.previousDuesArrears : (house.previousArrears || 0);
    const prevNote = recapItem?.previousArrearsNote || house.previousArrearsNote || '';
    const pastUnpaidPeriods = recapItem?.unpaidPastPeriods || [];
    const totalDebt = recapItem ? recapItem.remainingArrearsTotal : (duesDebt + baksosDebt + prevDebt);
    const attendedCount = baksosAgendas.filter(
      (a) => a.attendance?.[house.id] === 'Hadir'
    ).length;

    return {
      duesDebt,
      unpaidBaksos,
      baksosDebt,
      prevDebt,
      prevNote,
      pastUnpaidPeriods,
      totalDebt,
      attendedCount,
      recapItem,
    };
  };

  return (
    <div className="rounded-2xl border-2 border-indigo-200 overflow-hidden shadow-lg bg-gradient-to-br from-indigo-100/90 via-cyan-100/80 to-emerald-100/90">
      {/* Colored Header Banner for Kartu Mandiri Warga & Cek Status Cepat */}
      <div className="bg-gradient-to-r from-indigo-600 via-purple-600 to-teal-600 text-white p-5 sm:p-6 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="text-xs font-bold text-amber-300 flex items-center gap-1.5 uppercase tracking-wide">
            <CreditCard className="w-4 h-4 text-amber-300" />
            <span>Kartu Mandiri Warga & Cek Status Cepat</span>
          </div>
          <h3 className="text-base sm:text-lg font-extrabold text-white">
            Cek Status Iuran, Presensi Baksos & Rincian Rumah Anda
          </h3>
          <p className="text-xs text-sky-100">
            Pilih nomor blok rumah Anda untuk melihat status iuran bulanan, riwayat kehadiran gotong royong, dan tanggungan kas secara instan.
          </p>
        </div>

        {/* Block Selector Dropdown */}
        <div className="flex items-center gap-2 w-full lg:w-auto shrink-0">
          <div className="relative flex-1 sm:flex-initial sm:min-w-[260px]">
            <Search className="w-4 h-4 text-indigo-600 absolute left-3 top-2.5 pointer-events-none" />
            <select
              value={selectedBlock}
              onChange={(e) => setSelectedBlock(e.target.value)}
              className="w-full pl-9 pr-4 py-2 text-xs font-bold bg-gradient-to-r from-amber-50 to-cyan-50 border-2 border-amber-300 rounded-xl text-slate-900 shadow-sm focus:outline-none focus:ring-2 focus:ring-amber-300 cursor-pointer"
            >
              <option value="">— Pilih Blok Rumah Anda —</option>
              {residents.map((h) => {
                const isVac = isHouseVacant(h) || h.occupancy === 'Kosong';
                const name = isVac
                  ? (h.duesHeadNameOverride && h.duesHeadNameOverride.toLowerCase().includes('kosong')
                      ? h.duesHeadNameOverride
                      : 'Rumah Kosong')
                  : (h.duesHeadNameOverride || h.headName);
                return (
                  <option key={h.id} value={h.blockNumber}>
                    Blok {h.blockNumber} — {name}
                  </option>
                );
              })}
            </select>
          </div>
          {selectedBlock && (
            <button
              type="button"
              onClick={() => setSelectedBlock('')}
              className="px-3 py-2 text-xs font-bold bg-rose-500 hover:bg-rose-600 text-white rounded-xl transition-colors cursor-pointer whitespace-nowrap shadow-xs"
            >
              Reset
            </button>
          )}
        </div>
      </div>

      <div className="p-5 sm:p-6">
        {/* Selected House Digital Card */}
        {selectedHouse ? (
          (() => {
            const isVacant = isHouseVacant(selectedHouse);
            const summary = getHouseSummary(selectedHouse);
            const isClean = summary.totalDebt === 0;

            return (
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-center">
                {/* Digital Member Card */}
                <div
                  className={`lg:col-span-5 p-5 rounded-2xl text-white shadow-md flex flex-col justify-between space-y-4 ${
                    isVacant
                      ? 'bg-gradient-to-br from-slate-600 via-slate-700 to-slate-800'
                      : 'bg-gradient-to-br from-emerald-600 via-teal-600 to-indigo-700'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <span
                        className={`text-[11px] font-bold tracking-wide flex items-center gap-1 ${
                          isVacant ? 'text-slate-300' : 'text-amber-300'
                        }`}
                      >
                        <Sparkles className="w-3.5 h-3.5" />
                        <span>
                          {isVacant ? 'STATUS RUMAH KOSONG' : 'KARTU WARGA GANG MANDOR'}
                        </span>
                      </span>
                      <h4 className="text-lg font-extrabold tracking-tight mt-0.5">
                        {isVacant
                          ? (selectedHouse.duesHeadNameOverride && selectedHouse.duesHeadNameOverride.toLowerCase().includes('kosong')
                              ? selectedHouse.duesHeadNameOverride
                              : 'Rumah Kosong')
                          : (selectedHouse.duesHeadNameOverride || selectedHouse.headName)}
                      </h4>
                      <p className="text-xs text-slate-200">
                        Kavling Blok {selectedHouse.blockNumber} · {selectedHouse.ownership} ·{' '}
                        {selectedHouse.occupancy}
                      </p>
                    </div>
                    <span
                      className={`font-mono text-sm font-black px-3 py-1 rounded-xl shadow-xs ${
                        isVacant ? 'bg-slate-400 text-white' : 'text-slate-950 bg-amber-300'
                      }`}
                    >
                      {selectedHouse.blockNumber}
                    </span>
                  </div>

                  <div className="grid grid-cols-3 gap-2 pt-2.5 border-t border-white/20 text-xs">
                    <div>
                      <span className="text-[10px] text-emerald-200 block">Anggota KK</span>
                      <span className="font-mono font-bold text-white tabular-nums">
                        {selectedHouse.members?.length || 0} Jiwa
                      </span>
                    </div>
                    <div>
                      <span className="text-[10px] text-emerald-200 block">Status Rukem</span>
                      <span className="font-bold text-white">{selectedHouse.rukem}</span>
                    </div>
                    <div>
                      <span className="text-[10px] text-emerald-200 block">Internet WiFi</span>
                      <span className="font-bold text-white">
                        {selectedHouse.wifiStatus === 'Pasang'
                          ? selectedHouse.wifiProvider
                          : 'Tidak'}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Status Breakdown */}
                <div className="lg:col-span-7 grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="p-4 rounded-2xl border-2 border-emerald-300 bg-gradient-to-br from-emerald-100 via-teal-50 to-cyan-100 flex flex-col justify-between shadow-2xs">
                    <span className="text-xs font-bold text-emerald-900">
                      Iuran ({selectedHouse.duesMonthNote || config.duesCurrentMonth || 'Bulan Ini'})
                    </span>
                    <div className="mt-2">
                      {(selectedHouse.occupancy === 'Kosong' || isHouseVacant(selectedHouse)) &&
                      selectedHouse.duesStatus !== 'Lunas' &&
                      selectedHouse.duesStatus !== 'Bayar Lebih' ? (
                        <>
                          <span className="text-sm font-bold text-slate-700">Rumah Kosong (Bebas Iuran)</span>
                          <span className="block text-[11px] text-slate-600 mt-0.5">
                            Otomatis tidak wajib membayar iuran kas
                          </span>
                        </>
                      ) : (
                        <>
                          <span
                            className={`text-base font-extrabold font-mono tabular-nums ${
                              selectedHouse.duesStatus === 'Bayar Lebih'
                                ? 'text-indigo-700'
                                : selectedHouse.duesStatus === 'Lunas'
                                ? 'text-emerald-700'
                                : 'text-rose-600'
                            }`}
                          >
                            {selectedHouse.duesStatus === 'Bayar Lebih'
                              ? `Bayar Lebih (${selectedHouse.duesPaidMonths || 2} Bln)`
                              : selectedHouse.duesStatus}
                          </span>
                          <span className="block text-[11px] text-slate-700 font-medium mt-0.5 tabular-nums">
                            {selectedHouse.duesStatus === 'Bayar Lebih'
                              ? `Deposit +${formatRupiah(
                                  selectedHouse.duesPrepaidBalance || 0
                                )} · Tgl: ${
                                  selectedHouse.duesPaidDate
                                    ? formatDateDDMMYYYY(selectedHouse.duesPaidDate)
                                    : '-'
                                }`
                              : selectedHouse.duesStatus === 'Lunas'
                              ? `Tgl Terima: ${
                                  selectedHouse.duesPaidDate
                                    ? formatDateDDMMYYYY(selectedHouse.duesPaidDate)
                                    : '-'
                                }`
                              : `Tagihan: ${formatRupiah(summary.duesDebt)}`}
                          </span>
                        </>
                      )}
                    </div>
                  </div>

                  <div className="p-4 rounded-2xl border-2 border-cyan-300 bg-gradient-to-br from-cyan-100 via-sky-50 to-indigo-100 flex flex-col justify-between shadow-2xs">
                    <span className="text-xs font-bold text-cyan-900">Kehadiran Baksos</span>
                    <div className="mt-2">
                      <span className="text-base font-extrabold font-mono tabular-nums text-cyan-800">
                        {selectedHouse.ownership === 'Kontrak' ||
                        selectedHouse.occupancy === 'Dikontrakan'
                          ? 'Tidak Wajib (Kontrak)'
                          : `${summary.attendedCount} / ${baksosAgendas.length} Hadir`}
                      </span>
                      <span className="block text-[11px] text-slate-700 font-medium mt-0.5 tabular-nums">
                        Denda belum bayar: {formatRupiah(summary.baksosDebt)}
                      </span>
                    </div>
                  </div>

                  <div className="p-4 rounded-2xl border-2 border-amber-300 bg-gradient-to-br from-amber-100 via-orange-50 to-yellow-100 flex flex-col justify-between shadow-2xs">
                    <span className="text-xs font-bold text-amber-950">Total Tanggungan</span>
                    <div className="mt-2">
                      <span
                        className={`text-base font-extrabold font-mono tabular-nums ${
                          isClean ? 'text-emerald-700' : 'text-rose-600'
                        }`}
                      >
                        {formatRupiah(summary.totalDebt)}
                      </span>
                      {summary.prevDebt > 0 && (
                        <span className="block text-[10px] text-amber-900 font-semibold mt-0.5 tabular-nums">
                          Termasuk tunggakan lalu: {formatRupiah(summary.prevDebt)}
                          {summary.prevNote ? ` (${summary.prevNote})` : ''}
                        </span>
                      )}
                      <button
                        type="button"
                        onClick={() => onNavigateTab(isClean ? 'kas' : 'tunggakan')}
                        className="block text-[11px] font-bold text-indigo-700 hover:underline mt-0.5 cursor-pointer"
                      >
                        {isClean ? 'Lihat Laporan Kas →' : 'Lihat Rincian Tunggakan →'}
                      </button>
                    </div>
                  </div>

                  {summary.totalDebt > 0 && (
                    <div className="col-span-1 sm:col-span-3 mt-1 p-3.5 rounded-2xl bg-gradient-to-r from-blue-900 via-indigo-900 to-slate-900 text-white flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-md border border-blue-400/30">
                      <div className="flex items-center gap-2.5">
                        <div className="p-2 rounded-xl bg-blue-500/20 text-sky-300 shrink-0">
                          <CreditCard className="w-5 h-5 text-amber-300" />
                        </div>
                        <div className="text-xs">
                          <span className="text-sky-300 font-semibold block sm:inline">
                            Rekening Penyaluran Kas Gang (Bendahara):{' '}
                          </span>
                          <span className="font-mono font-black text-amber-300 text-sm tracking-wider">
                            BCA 7130889411
                          </span>
                          <span className="text-sky-100 font-medium"> a.n. Muhidin Akbar</span>
                          <span className="block text-[11px] text-sky-200 mt-0.5">
                            Berita Transfer: Kas Gang - Blok {selectedHouse.blockNumber} · WA: +62 878-8733-2749
                          </span>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={handleCopyRekening}
                        className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 self-start sm:self-auto shrink-0 shadow-xs ${
                          copiedBank
                            ? 'bg-emerald-500 text-white'
                            : 'bg-white hover:bg-sky-50 text-slate-900'
                        }`}
                        title="Salin Nomor Rekening Bendahara"
                      >
                        {copiedBank ? (
                          <>
                            <Check className="w-3.5 h-3.5 text-white" />
                            <span>Tersalin!</span>
                          </>
                        ) : (
                          <>
                            <Copy className="w-3.5 h-3.5 text-blue-700" />
                            <span>Salin No. Rek</span>
                          </>
                        )}
                      </button>
                    </div>
                  )}
                </div>
              </div>
            );
          })()
        ) : (
          /* Panduan Cek Mandiri Warga saat belum ada blok yang dipilih */
          <div className="p-6 sm:p-8 rounded-2xl bg-white/70 border border-indigo-200/80 text-center flex flex-col items-center justify-center space-y-3">
            <div className="p-3.5 rounded-2xl bg-gradient-to-br from-indigo-500 to-teal-500 text-white shadow-sm">
              <Search className="w-6 h-6 text-amber-200" />
            </div>
            <div className="max-w-md space-y-1">
              <h4 className="font-extrabold text-sm sm:text-base text-slate-900">
                Cari & Pilih Nomor Blok Rumah Anda
              </h4>
              <p className="text-xs text-slate-600 leading-relaxed">
                Pilih nomor blok rumah Anda pada daftar pilihan di atas untuk melihat status pembayaran iuran kas bulanan, presensi kehadiran kerja bakti, dan kartu data warga secara mandiri.
              </p>
            </div>
            <div className="flex flex-wrap items-center justify-center gap-2 pt-2 text-xs">
              <button
                type="button"
                onClick={() => onNavigateTab('kas')}
                className="px-3 py-1.5 rounded-xl bg-teal-50 text-teal-800 hover:bg-teal-100 font-bold border border-teal-200 transition-colors cursor-pointer"
              >
                Lihat Laporan Buku Kas →
              </button>
              <button
                type="button"
                onClick={() => onNavigateTab('dashboard')}
                className="px-3 py-1.5 rounded-xl bg-cyan-50 text-cyan-800 hover:bg-cyan-100 font-bold border border-cyan-200 transition-colors cursor-pointer"
              >
                Lihat Statistik Warga →
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
