import React, { useState } from 'react';
import {
  Activity,
  Award,
  Baby,
  Briefcase,
  Edit2,
  Heart,
  Home,
  ShieldCheck,
  Smile,
  Sparkles,
  UserCheck,
  Users,
  Wifi,
} from 'lucide-react';
import { ResidentHouse, SiteConfig } from '../types';
import { calculateAge } from '../utils/helpers';

interface DashboardSummaryProps {
  config?: SiteConfig;
  residents: ResidentHouse[];
  isAdmin?: boolean;
  onOpenConfigModal?: () => void;
}

export const DashboardSummary: React.FC<DashboardSummaryProps> = ({
  config,
  residents,
  isAdmin,
  onOpenConfigModal,
}) => {
  const [selectedAgeGroup, setSelectedAgeGroup] = useState<string | null>(null);

  // Aggregate statistics
  const totalHouses = residents.length;
  const occupiedHouses = residents.filter((h) => h.occupancy === 'Ditempati').length;
  const notOccupiedYetHouses = residents.filter((h) => h.occupancy === 'Belum Ditempati').length;
  const rentedOutHouses = residents.filter((h) => h.occupancy === 'Dikontrakan').length;
  const emptyHouses = residents.filter((h) => h.occupancy === 'Kosong').length;

  const allMembers = residents.flatMap((h) =>
    (h.members || []).map((m) => ({
      ...m,
      blockNumber: h.blockNumber,
      age: calculateAge(m.birthDate),
    }))
  );
  const totalCitizens = allMembers.length;

  // Gender counts
  const maleCount = allMembers.filter((m) => m.gender === 'Laki-laki').length;
  const femaleCount = allMembers.filter((m) => m.gender === 'Perempuan').length;
  const malePct = totalCitizens ? ((maleCount / totalCitizens) * 100).toFixed(1) : '0';
  const femalePct = totalCitizens ? ((femaleCount / totalCitizens) * 100).toFixed(1) : '0';

  // Separated Age Groups: Balita (0-5 thn), Anak-anak (6-12 thn), Remaja (13-24 thn), Dewasa (25-55 thn), Lansia (56+ thn)
  const ageGroups = [
    {
      id: 'balita',
      shortLabel: 'Warga Balita',
      label: 'Balita (0–5 thn)',
      ageRange: 'Usia 0–5 Tahun',
      min: 0,
      max: 5,
      icon: Baby,
      cardGradient: 'from-pink-500 via-rose-500 to-fuchsia-600',
      shadowClass: 'shadow-pink-600/15',
      textMuted: 'text-pink-100',
      color: 'bg-pink-500',
      cardBorder: 'border-pink-200 hover:border-pink-400',
      activeRing: 'border-pink-600 bg-pink-50/70 ring-2 ring-pink-500/40',
      badgeText: 'text-pink-800',
    },
    {
      id: 'anak',
      shortLabel: 'Warga Anak-anak',
      label: 'Anak-anak (6–12 thn)',
      ageRange: 'Usia 6–12 Tahun',
      min: 6,
      max: 12,
      icon: Smile,
      cardGradient: 'from-sky-500 via-cyan-600 to-blue-700',
      shadowClass: 'shadow-sky-600/15',
      textMuted: 'text-sky-100',
      color: 'bg-sky-500',
      cardBorder: 'border-sky-200 hover:border-sky-400',
      activeRing: 'border-sky-600 bg-sky-50/70 ring-2 ring-sky-500/40',
      badgeText: 'text-sky-800',
    },
    {
      id: 'remaja',
      shortLabel: 'Warga Remaja',
      label: 'Remaja & Pemuda (13–24 thn)',
      ageRange: 'Usia 13–24 Tahun',
      min: 13,
      max: 24,
      icon: Sparkles,
      cardGradient: 'from-emerald-500 via-teal-600 to-green-700',
      shadowClass: 'shadow-emerald-600/15',
      textMuted: 'text-emerald-100',
      color: 'bg-emerald-500',
      cardBorder: 'border-emerald-200 hover:border-emerald-400',
      activeRing: 'border-emerald-600 bg-emerald-50/70 ring-2 ring-emerald-500/40',
      badgeText: 'text-emerald-800',
    },
    {
      id: 'dewasa',
      shortLabel: 'Warga Dewasa',
      label: 'Dewasa Produktif (25–55 thn)',
      ageRange: 'Usia 25–55 Tahun',
      min: 25,
      max: 55,
      icon: Briefcase,
      cardGradient: 'from-indigo-600 via-violet-600 to-purple-700',
      shadowClass: 'shadow-indigo-600/15',
      textMuted: 'text-indigo-100',
      color: 'bg-indigo-600',
      cardBorder: 'border-indigo-200 hover:border-indigo-400',
      activeRing: 'border-indigo-600 bg-indigo-50/70 ring-2 ring-indigo-500/40',
      badgeText: 'text-indigo-800',
    },
    {
      id: 'lansia',
      shortLabel: 'Warga Lansia',
      label: 'Pra-Lansia & Lansia (56+ thn)',
      ageRange: 'Usia 56+ Tahun',
      min: 56,
      max: 200,
      icon: Award,
      cardGradient: 'from-amber-500 via-orange-500 to-rose-600',
      shadowClass: 'shadow-amber-600/15',
      textMuted: 'text-amber-100',
      color: 'bg-amber-500',
      cardBorder: 'border-amber-200 hover:border-amber-400',
      activeRing: 'border-amber-600 bg-amber-50/70 ring-2 ring-amber-500/40',
      badgeText: 'text-amber-900',
    },
  ].map((g) => {
    const members = allMembers.filter((m) => m.age >= g.min && m.age <= g.max);
    const maleInGroup = members.filter((m) => m.gender === 'Laki-laki').length;
    const femaleInGroup = members.filter((m) => m.gender === 'Perempuan').length;
    return {
      ...g,
      count: members.length,
      maleInGroup,
      femaleInGroup,
      members,
    };
  });

  // Religion counts
  const religionCounts: Record<string, number> = {};
  allMembers.forEach((m) => {
    religionCounts[m.religion] = (religionCounts[m.religion] || 0) + 1;
  });

  // House ownership counts
  const ownershipCounts: Record<string, number> = {
    'Milik Sendiri': 0,
    Kontrak: 0,
    'Milik Orang Lain': 0,
  };
  residents.forEach((h) => {
    if (ownershipCounts[h.ownership] !== undefined) {
      ownershipCounts[h.ownership]++;
    }
  });

  // Rukem counts
  const rukemIkut = residents.filter((h) => h.rukem === 'Ikut Rukem').length;
  const rukemTidak = residents.filter((h) => h.rukem === 'Tidak Ikut').length;

  // WiFi counts & providers
  const wifiInstalled = residents.filter((h) => h.wifiStatus === 'Pasang').length;
  const wifiNotInstalled = residents.filter((h) => h.wifiStatus === 'Tidak Pasang').length;
  const wifiProviders: Record<string, number> = {};
  residents.forEach((h) => {
    if (h.wifiStatus === 'Pasang' && h.wifiProvider && h.wifiProvider !== '-') {
      wifiProviders[h.wifiProvider] = (wifiProviders[h.wifiProvider] || 0) + 1;
    }
  });

  const activeAgeGroupObj = ageGroups.find((g) => g.id === selectedAgeGroup);

  const occupancySummaryList = [
    {
      label: 'Rumah Ditempati',
      count: occupiedHouses,
      pct: totalHouses ? ((occupiedHouses / totalHouses) * 100).toFixed(0) : '0',
      barColor: 'bg-emerald-500',
      textColor: 'text-emerald-700',
    },
    {
      label: 'Belum Ditempati',
      count: notOccupiedYetHouses,
      pct: totalHouses ? ((notOccupiedYetHouses / totalHouses) * 100).toFixed(0) : '0',
      barColor: 'bg-amber-500',
      textColor: 'text-amber-700',
    },
    {
      label: 'Dikontrakan',
      count: rentedOutHouses,
      pct: totalHouses ? ((rentedOutHouses / totalHouses) * 100).toFixed(0) : '0',
      barColor: 'bg-purple-500',
      textColor: 'text-purple-700',
    },
    {
      label: 'Rumah Kosong',
      count: emptyHouses,
      pct: totalHouses ? ((emptyHouses / totalHouses) * 100).toFixed(0) : '0',
      barColor: 'bg-slate-400',
      textColor: 'text-slate-600',
    },
  ];

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* Header Banner */}
      {((config?.dashboardSectionTitle ?? 'Rangkuman Demografi & Statistik Warga') ||
        (config?.dashboardSectionDescription ??
          'Data agregat kependudukan, ringkasan statistik usia (Balita, Anak-anak, Remaja, Dewasa, dan Lansia), status hunian rumah, kepesertaan Rukem, dan jaringan WiFi.') ||
        isAdmin) && (
        <div className="bg-gradient-to-r from-indigo-600 via-teal-600 to-emerald-600 text-white rounded-2xl p-6 shadow-lg shadow-teal-600/15 flex flex-col md:flex-row md:items-center justify-between gap-4 relative overflow-hidden">
          <div className="absolute -right-12 -top-12 w-48 h-48 bg-amber-300/20 rounded-full blur-2xl pointer-events-none"></div>
          <div className="space-y-1 relative z-10">
            {(config?.dashboardSectionTitle ?? 'Rangkuman Demografi & Statistik Warga') && (
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-white/20 backdrop-blur-xs text-amber-300 rounded-xl shadow-xs">
                  <Users className="w-5 h-5" />
                </div>
                <h2 className="text-lg sm:text-xl font-extrabold text-white tracking-tight">
                  {config?.dashboardSectionTitle !== undefined
                    ? config.dashboardSectionTitle.replace(/Lingkungan/gi, 'Gang')
                    : 'Rangkuman Demografi & Statistik Warga Gang'}
                </h2>
              </div>
            )}
            {(config?.dashboardSectionDescription ??
              'Data agregat kependudukan, ringkasan statistik usia (Balita, Anak-anak, Remaja, Dewasa, dan Lansia), kepemilikan rumah, kepesertaan Rukem, dan fasilitas WiFi warga.') && (
              <p className="text-xs sm:text-sm text-emerald-50 max-w-3xl leading-relaxed">
                {config?.dashboardSectionDescription !== undefined
                  ? config.dashboardSectionDescription
                  : 'Data agregat kependudukan, ringkasan statistik usia (Balita, Anak-anak, Remaja, Dewasa, dan Lansia), kepemilikan rumah, kepesertaan Rukem, dan fasilitas WiFi warga.'}
              </p>
            )}
          </div>
          {isAdmin && onOpenConfigModal && (
            <button
              type="button"
              onClick={onOpenConfigModal}
              className="relative z-10 flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold text-slate-950 bg-amber-400 hover:bg-amber-300 rounded-xl shadow-xs transition-colors cursor-pointer self-start md:self-auto"
              title="Edit / Hapus Judul & Deskripsi Rangkuman"
            >
              <Edit2 className="w-3.5 h-3.5" />
              <span>Edit Judul / Deskripsi</span>
            </button>
          )}
        </div>
      )}

      {/* Baris 1: Ringkasan Utama Kependudukan & Fasilitas Gang */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
        <div className="bg-gradient-to-br from-emerald-600 via-teal-600 to-cyan-700 text-white p-4 rounded-2xl shadow-md shadow-emerald-600/15">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-emerald-100">Total Jiwa Warga</span>
            <Users className="w-4 h-4 text-emerald-200" />
          </div>
          <div className="mt-2 flex items-baseline gap-1.5">
            <span className="text-2xl sm:text-3xl font-extrabold font-mono tabular-nums text-white">
              {totalCitizens}
            </span>
            <span className="text-xs text-emerald-100">Jiwa</span>
          </div>
          <div className="mt-1.5 text-[11px] text-emerald-100/90 font-mono tabular-nums">
            Laki-laki: {maleCount} ({malePct}%) · Perempuan: {femaleCount} ({femalePct}%)
          </div>
        </div>

        <div className="bg-gradient-to-br from-indigo-600 via-blue-600 to-cyan-700 text-white p-4 rounded-2xl shadow-md shadow-indigo-600/15">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-indigo-100">Total Rumah / KK</span>
            <Home className="w-4 h-4 text-indigo-200" />
          </div>
          <div className="mt-2 flex items-baseline gap-1.5">
            <span className="text-2xl sm:text-3xl font-extrabold font-mono tabular-nums text-white">
              {totalHouses}
            </span>
            <span className="text-xs text-indigo-100">Rumah</span>
          </div>
          <div className="mt-1.5 text-[11px] text-indigo-100/90 font-mono tabular-nums">
            Ditempati: {occupiedHouses} · Kosong: {emptyHouses}
          </div>
        </div>

        <div className="bg-gradient-to-br from-violet-600 via-purple-600 to-fuchsia-700 text-white p-4 rounded-2xl shadow-md shadow-purple-600/15">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-purple-100">Peserta Rukem</span>
            <Heart className="w-4 h-4 text-purple-200" />
          </div>
          <div className="mt-2 flex items-baseline gap-1.5">
            <span className="text-2xl sm:text-3xl font-extrabold font-mono tabular-nums text-white">
              {rukemIkut}
            </span>
            <span className="text-xs text-purple-100">KK</span>
          </div>
          <div className="mt-1.5 text-[11px] text-purple-100/90 font-mono tabular-nums">
            {((rukemIkut / (totalHouses || 1)) * 100).toFixed(0)}% Partisipasi Warga
          </div>
        </div>

        <div className="bg-gradient-to-br from-amber-500 via-orange-500 to-rose-600 text-white p-4 rounded-2xl shadow-md shadow-orange-500/15">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-amber-100">Jaringan WiFi</span>
            <Wifi className="w-4 h-4 text-amber-200" />
          </div>
          <div className="mt-2 flex items-baseline gap-1.5">
            <span className="text-2xl sm:text-3xl font-extrabold font-mono tabular-nums text-white">
              {wifiInstalled}
            </span>
            <span className="text-xs text-amber-100">Rumah</span>
          </div>
          <div className="mt-1.5 text-[11px] text-amber-100/90 font-mono tabular-nums">
            {wifiNotInstalled} Rumah Belum Pasang
          </div>
        </div>
      </div>

      {/* Baris 2: Ringkasan Statistik 5 Kelompok Usia Warga (Balita, Anak-anak, Remaja, Dewasa, dan Lansia) */}
      <div className="space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 px-1">
          <h3 className="font-bold text-sm sm:text-base text-slate-900 dark:text-white flex items-center gap-2">
            <UserCheck className="w-4 h-4 text-teal-600" />
            <span>
              Ringkasan Statistik Usia Warga: Balita, Anak-anak, Remaja, Dewasa & Lansia
            </span>
          </h3>
          <span className="text-xs text-slate-500">
            Klik kartu kategori usia untuk menampilkan daftar nama warga
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3.5">
          {ageGroups.map((group) => {
            const Icon = group.icon;
            const isSelected = selectedAgeGroup === group.id;
            const pct = totalCitizens
              ? ((group.count / totalCitizens) * 100).toFixed(1)
              : '0';

            return (
              <button
                key={group.id}
                type="button"
                onClick={() => setSelectedAgeGroup(isSelected ? null : group.id)}
                className={`text-left bg-gradient-to-br ${group.cardGradient} text-white p-4 rounded-2xl shadow-md ${group.shadowClass} relative overflow-hidden hover:opacity-95 transition-all cursor-pointer ${
                  isSelected ? 'ring-3 ring-amber-300 ring-offset-2' : ''
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className={`text-xs font-bold ${group.textMuted}`}>
                    {group.shortLabel}
                  </span>
                  <Icon className={`w-4 h-4 ${group.textMuted}`} />
                </div>

                <div className="mt-2 flex items-baseline justify-between gap-1.5">
                  <div className="flex items-baseline gap-1.5">
                    <span className="text-2xl sm:text-3xl font-extrabold font-mono tabular-nums text-white">
                      {group.count}
                    </span>
                    <span className={`text-xs ${group.textMuted}`}>Jiwa</span>
                  </div>
                  <span className="font-mono text-xs font-bold text-white/95 tabular-nums">
                    {pct}%
                  </span>
                </div>

                <div className={`mt-1.5 text-[11px] ${group.textMuted} font-medium`}>
                  {group.ageRange}
                </div>

                <div className="mt-2 pt-2 border-t border-white/20 flex items-center justify-between text-[11px] font-mono tabular-nums text-white">
                  <span>
                    L: <strong>{group.maleInGroup}</strong> · P:{' '}
                    <strong>{group.femaleInGroup}</strong>
                  </span>
                  <span className="font-sans font-bold text-amber-200">
                    {isSelected ? 'Tutup ▲' : 'Detail ▼'}
                  </span>
                </div>
              </button>
            );
          })}
        </div>
        {activeAgeGroupObj && (
          <div className="bg-gradient-to-br from-violet-50/80 via-cyan-50/50 to-emerald-50/70 rounded-2xl p-4 sm:p-5 border border-indigo-200 shadow-xs space-y-3 animate-in fade-in duration-150">
            <div className="flex flex-wrap items-center justify-between gap-2 pb-2.5 border-b border-slate-200/80">
              <div className="text-xs sm:text-sm font-extrabold text-slate-900">
                Daftar Nama Warga — {activeAgeGroupObj.label} ({activeAgeGroupObj.count} Jiwa ·
                Laki-laki: {activeAgeGroupObj.maleInGroup}, Perempuan:{' '}
                {activeAgeGroupObj.femaleInGroup})
              </div>
              <button
                type="button"
                onClick={() => setSelectedAgeGroup(null)}
                className="px-3 py-1 rounded-lg bg-white hover:bg-rose-50 text-rose-600 border border-rose-200 text-xs font-bold transition-colors cursor-pointer"
              >
                Tutup Daftar Nama ✕
              </button>
            </div>
            {activeAgeGroupObj.members.length === 0 ? (
              <div className="p-4 rounded-xl bg-white/80 border border-slate-200 text-xs text-slate-500 text-center">
                Belum ada warga pada rentang usia {activeAgeGroupObj.label}.
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2.5">
                {activeAgeGroupObj.members.map((m) => (
                  <div
                    key={m.id}
                    className="p-3 rounded-xl border border-slate-200 bg-white flex items-center justify-between text-xs hover:border-emerald-300 transition-colors shadow-2xs"
                  >
                    <div>
                      <div className="font-bold text-slate-900">{m.name}</div>
                      <div className="text-[11px] text-slate-500">
                        Blok {m.blockNumber} · {m.relation} · {m.gender}
                      </div>
                    </div>
                    <span className="font-mono font-extrabold text-emerald-800 tabular-nums">
                      {m.age} thn
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Ringkasan Statistik Demografi, Hunian, Iuran, Agama, Kepemilikan, Rukem & WiFi */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {/* 1. Ringkasan Jenis Kelamin Warga */}
        <div className="bg-gradient-to-br from-sky-50/80 via-indigo-50/40 to-rose-50/50 rounded-2xl p-5 border border-sky-200 border-t-4 border-t-sky-500 shadow-xs space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <h4 className="font-bold text-sm text-slate-800 flex items-center gap-2">
              <Users className="w-4 h-4 text-sky-600" />
              <span>Ringkasan Jenis Kelamin Warga</span>
            </h4>
            <span className="text-xs text-slate-500 font-mono tabular-nums">
              {totalCitizens} Jiwa
            </span>
          </div>

          <div className="space-y-3 text-xs">
            <div className="p-3 rounded-xl bg-white/80 border border-sky-200/80 space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="font-bold text-slate-800">Warga Laki-laki</span>
                <span className="font-mono font-extrabold text-sky-700 tabular-nums">
                  {maleCount} Jiwa ({malePct}%)
                </span>
              </div>
              <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                <div
                  className="bg-sky-500 h-full rounded-full"
                  style={{ width: `${malePct}%` }}
                ></div>
              </div>
            </div>

            <div className="p-3 rounded-xl bg-white/80 border border-rose-200/80 space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="font-bold text-slate-800">Warga Perempuan</span>
                <span className="font-mono font-extrabold text-rose-600 tabular-nums">
                  {femaleCount} Jiwa ({femalePct}%)
                </span>
              </div>
              <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                <div
                  className="bg-rose-500 h-full rounded-full"
                  style={{ width: `${femalePct}%` }}
                ></div>
              </div>
            </div>
          </div>
        </div>

        {/* 2. Ringkasan Status Hunian */}
        <div className="bg-gradient-to-br from-emerald-50/80 via-teal-50/50 to-amber-50/50 rounded-2xl p-5 border border-emerald-200 border-t-4 border-t-emerald-500 shadow-xs space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <h4 className="font-bold text-sm text-slate-800 flex items-center gap-2">
              <Home className="w-4 h-4 text-emerald-600" />
              <span>Ringkasan Status Hunian Rumah</span>
            </h4>
            <span className="text-xs text-slate-500 font-mono tabular-nums">
              {totalHouses} Unit
            </span>
          </div>

          <div className="space-y-2.5 text-xs">
            {occupancySummaryList.map((item) => (
              <div key={item.label} className="space-y-1">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-slate-700">{item.label}</span>
                  <span className={`font-mono font-bold tabular-nums ${item.textColor}`}>
                    {item.count} Unit ({item.pct}%)
                  </span>
                </div>
                <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                  <div
                    className={`${item.barColor} h-full rounded-full`}
                    style={{ width: `${item.pct}%` }}
                  ></div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* 3. Rangkuman Agama */}
        <div className="bg-gradient-to-br from-teal-50/80 via-emerald-50/50 to-sky-50/50 rounded-2xl p-5 border border-teal-200 border-t-4 border-t-teal-500 shadow-xs space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <h4 className="font-bold text-sm text-slate-800 flex items-center gap-2">
              <Activity className="w-4 h-4 text-teal-600" />
              <span>Demografi Agama Warga</span>
            </h4>
            <span className="text-xs text-slate-400 font-mono tabular-nums">{totalCitizens} Jiwa</span>
          </div>
          <div className="space-y-2.5">
            {Object.entries(religionCounts).map(([rel, count]) => {
              const pct = totalCitizens ? ((count / totalCitizens) * 100).toFixed(0) : 0;
              return (
                <div key={rel} className="space-y-1 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-slate-700">{rel}</span>
                    <div className="flex items-center gap-2 font-mono tabular-nums">
                      <span className="text-teal-600">{pct}%</span>
                      <span className="text-teal-900 font-bold min-w-6 text-right">
                        {count} Jiwa
                      </span>
                    </div>
                  </div>
                  <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                    <div
                      className="bg-gradient-to-r from-teal-500 to-emerald-500 h-full rounded-full"
                      style={{ width: `${pct}%` }}
                    ></div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* 5. Rangkuman Status Kepemilikan Rumah */}
        <div className="bg-gradient-to-br from-cyan-50/80 via-sky-50/50 to-indigo-50/50 rounded-2xl p-5 border border-cyan-200 border-t-4 border-t-cyan-500 shadow-xs space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <h4 className="font-bold text-sm text-slate-800 flex items-center gap-2">
              <Home className="w-4 h-4 text-cyan-600" />
              <span>Status Kepemilikan Rumah</span>
            </h4>
            <span className="text-xs text-slate-400 font-mono tabular-nums">{totalHouses} Rumah</span>
          </div>
          <div className="space-y-2.5">
            {Object.entries(ownershipCounts).map(([status, count]) => {
              const pct = totalHouses ? ((count / totalHouses) * 100).toFixed(0) : 0;
              return (
                <div key={status} className="space-y-1 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-slate-700">{status}</span>
                    <div className="flex items-center gap-2 font-mono tabular-nums">
                      <span className="text-cyan-600">{pct}%</span>
                      <span className="text-cyan-900 font-bold min-w-6 text-right">
                        {count} Unit
                      </span>
                    </div>
                  </div>
                  <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                    <div
                      className="bg-gradient-to-r from-cyan-500 to-blue-600 h-full rounded-full"
                      style={{ width: `${pct}%` }}
                    ></div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* 6. Rangkuman Status Rukem & WiFi */}
        <div className="bg-gradient-to-br from-purple-50/80 via-violet-50/50 to-amber-50/50 rounded-2xl p-5 border border-purple-200 border-t-4 border-t-purple-500 shadow-xs space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <h4 className="font-bold text-sm text-slate-800 flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-purple-600" />
              <span>Rukem & Jaringan WiFi Warga</span>
            </h4>
            <span className="text-xs text-slate-400">Sosial & Fasilitas</span>
          </div>
          <div className="space-y-2 text-xs">
            <div className="flex items-center justify-between p-2.5 rounded-xl bg-purple-50/80 border border-purple-100">
              <span className="font-semibold text-purple-900">Ikut Rukem</span>
              <span className="font-bold text-purple-800 font-mono tabular-nums">
                {rukemIkut} KK ({totalHouses ? ((rukemIkut / totalHouses) * 100).toFixed(0) : 0}%)
              </span>
            </div>
            <div className="flex items-center justify-between p-2.5 rounded-xl bg-slate-50 border border-slate-200/80">
              <span className="font-medium text-slate-600">Tidak Ikut Rukem</span>
              <span className="font-bold text-slate-700 font-mono tabular-nums">
                {rukemTidak} KK ({totalHouses ? ((rukemTidak / totalHouses) * 100).toFixed(0) : 0}%)
              </span>
            </div>
            <div className="pt-1 border-t border-slate-100 space-y-1.5">
              {Object.entries(wifiProviders).map(([provider, count]) => {
                const pct = wifiInstalled ? Math.round((count / wifiInstalled) * 100) : 0;
                return (
                  <div key={provider} className="flex justify-between items-center text-slate-700">
                    <span className="font-medium">WiFi {provider}</span>
                    <span className="font-mono font-bold text-amber-800 tabular-nums">
                      {count} Rumah ({pct}%)
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
