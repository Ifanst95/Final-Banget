import React, { useEffect, useRef } from 'react';
import {
  Award,
  Banknote,
  Bell,
  BookOpen,
  Building2,
  CheckCircle2,
  CreditCard,
  FileSpreadsheet,
  FileText,
  Globe,
  Heart,
  Info,
  Layers,
  Lock,
  LogOut,
  Megaphone,
  Menu,
  Monitor,
  Phone,
  RefreshCw,
  Settings,
  ShieldCheck,
  Sliders,
  Smartphone,
  Sparkles,
  Tablet,
  Users,
  Wallet,
} from 'lucide-react';
import { MenuItemConfig, SiteConfig } from '../types';
import { INITIAL_NAV_MENUS } from '../data/initialData';
import { useDeviceView } from '../hooks/useDeviceView';

interface NavbarProps {
  config: SiteConfig;
  isAdmin: boolean;
  onOpenLogin: () => void;
  onLogout: () => void;
  onOpenConfigModal: () => void;
  onOpenDatabaseModal: () => void;
  isOnlineSyncing?: boolean;
  isOnlineConnected?: boolean;
  lastOnlineSync?: string | null;
  activeTab: string;
  setActiveTab: (tab: string) => void;
  totalArrearsCount: number;
}

const getMenuIcon = (iconName?: string) => {
  switch (iconName) {
    case 'Megaphone':
      return Megaphone;
    case 'Users':
      return Users;
    case 'Wallet':
      return Wallet;
    case 'CheckCircle2':
      return CheckCircle2;
    case 'FileSpreadsheet':
      return FileSpreadsheet;
    case 'Bell':
      return Bell;
    case 'FileText':
      return FileText;
    case 'BookOpen':
      return BookOpen;
    case 'Info':
      return Info;
    case 'Building2':
      return Building2;
    case 'Heart':
      return Heart;
    case 'Award':
      return Award;
    case 'ShieldCheck':
      return ShieldCheck;
    case 'Sparkles':
      return Sparkles;
    default:
      return Layers;
  }
};

const getMenuColorStyles = (colorScheme?: string) => {
  switch (colorScheme) {
    case 'cyan':
      return {
        active:
          'bg-gradient-to-r from-cyan-600 via-sky-500 to-blue-600 text-white shadow-md shadow-cyan-500/30 ring-2 ring-cyan-300/60',
        inactive:
          'bg-cyan-100/75 hover:bg-cyan-200/80 text-cyan-950 border border-cyan-300/80',
        icon: 'text-cyan-600',
      };
    case 'teal':
      return {
        active:
          'bg-gradient-to-r from-teal-600 via-emerald-600 to-cyan-600 text-white shadow-md shadow-teal-500/30 ring-2 ring-teal-300/60',
        inactive:
          'bg-teal-100/75 hover:bg-teal-200/80 text-teal-950 border border-teal-300/80',
        icon: 'text-teal-600',
      };
    case 'violet':
      return {
        active:
          'bg-gradient-to-r from-violet-600 via-purple-600 to-fuchsia-600 text-white shadow-md shadow-purple-500/30 ring-2 ring-purple-300/60',
        inactive:
          'bg-purple-100/75 hover:bg-purple-200/80 text-purple-950 border border-purple-300/80',
        icon: 'text-violet-600',
      };
    case 'amber':
      return {
        active:
          'bg-gradient-to-r from-amber-500 via-orange-500 to-yellow-500 text-slate-950 shadow-md shadow-amber-500/30 ring-2 ring-amber-300/70',
        inactive:
          'bg-amber-100/80 hover:bg-amber-200/85 text-amber-950 border border-amber-300/80',
        icon: 'text-amber-700',
      };
    case 'rose':
      return {
        active:
          'bg-gradient-to-r from-rose-600 via-pink-600 to-orange-500 text-white shadow-md shadow-rose-500/30 ring-2 ring-rose-300/60',
        inactive:
          'bg-rose-100/75 hover:bg-rose-200/80 text-rose-950 border border-rose-300/80',
        icon: 'text-rose-600',
      };
    case 'indigo':
      return {
        active:
          'bg-gradient-to-r from-indigo-600 via-purple-600 to-blue-600 text-white shadow-md shadow-indigo-500/30 ring-2 ring-indigo-300/60',
        inactive:
          'bg-indigo-100/75 hover:bg-indigo-200/80 text-indigo-950 border border-indigo-300/80',
        icon: 'text-indigo-600',
      };
    case 'emerald':
    default:
      return {
        active:
          'bg-gradient-to-r from-emerald-600 via-teal-500 to-cyan-600 text-white shadow-md shadow-emerald-500/30 ring-2 ring-emerald-300/60',
        inactive:
          'bg-emerald-100/75 hover:bg-emerald-200/80 text-emerald-950 border border-emerald-300/80',
        icon: 'text-emerald-600',
      };
  }
};

export const Navbar: React.FC<NavbarProps> = ({
  config,
  isAdmin,
  onOpenLogin,
  onLogout,
  onOpenConfigModal,
  onOpenDatabaseModal,
  isOnlineSyncing = false,
  isOnlineConnected = true,
  lastOnlineSync,
  activeTab,
  setActiveTab,
  totalArrearsCount,
}) => {
  const { deviceType, isHandphone, isTablet, isPC, deviceLabel } = useDeviceView();
  const scrollNavRef = useRef<HTMLDivElement>(null);

  // Smoothly scroll active tab into view in horizontal mobile/tablet scrollbar
  useEffect(() => {
    if (!scrollNavRef.current) return;
    const activeTabId = activeTab === 'iuran_kk' ? 'kas' : activeTab;
    const activeBtn = scrollNavRef.current.querySelector<HTMLElement>(
      `[data-tab-id="${activeTabId}"]`
    );
    if (activeBtn) {
      activeBtn.scrollIntoView({
        behavior: 'smooth',
        block: 'nearest',
        inline: 'center',
      });
    }
  }, [activeTab]);

  // Dynamically resolve navigation menus from configuration or fallback defaults
  const activeMenus: MenuItemConfig[] = (
    config.navigationMenus && config.navigationMenus.length > 0
      ? config.navigationMenus
      : INITIAL_NAV_MENUS
  ).filter((m) => !m.isHidden);

  // Deduplicate activeMenus by id and label to ensure no double menus appear in navigation
  const seenMenuIds = new Set<string>();
  const seenMenuLabels = new Set<string>();
  const uniqueActiveMenus = activeMenus.filter((m) => {
    if (m.id === 'penarikan') return false; // Terintegrasi di Buku Kas & Iuran KK
    if (seenMenuIds.has(m.id)) return false;
    const normLabel = (m.label || '').toLowerCase().trim();
    if (normLabel && seenMenuLabels.has(normLabel)) return false;
    seenMenuIds.add(m.id);
    if (normLabel) seenMenuLabels.add(normLabel);
    return true;
  });

  const navItems = uniqueActiveMenus.map((item) => {
    const colors = getMenuColorStyles(item.colorScheme);
    const IconComponent = getMenuIcon(item.icon);
    return {
      id: item.id,
      label: item.label,
      shortLabel: item.shortLabel || item.label,
      icon: IconComponent,
      activeGradient: colors.active,
      inactiveColor: colors.inactive,
      iconColor: colors.icon,
      count:
        item.id === 'tunggakan' && totalArrearsCount > 0
          ? totalArrearsCount
          : undefined,
      subMenus: item.subMenus || [],
    };
  });


  return (
    <>
      <header className="sticky top-0 z-40 bg-gradient-to-r from-emerald-100/95 via-cyan-100/95 to-indigo-100/95 backdrop-blur-md border-b-2 border-teal-300/80 shadow-md">
        {/* Multi-color vibrant top accent bar */}
        <div className="h-1.5 sm:h-2 w-full bg-gradient-to-r from-emerald-500 via-cyan-500 via-indigo-500 via-fuchsia-500 to-amber-400" />

        <div className="max-w-7xl mx-auto px-3 sm:px-6 h-14 sm:h-16 flex items-center justify-between gap-3">
          {/* Zone 1: Brand Wordmark with Colorful Badge */}
          <button
            type="button"
            onClick={() => setActiveTab('pengumuman')}
            className="flex items-center gap-2 sm:gap-2.5 text-left group cursor-pointer whitespace-nowrap min-h-[44px] shrink-0"
            aria-label="Kembali ke Beranda Pengumuman"
          >
            <span className="p-1 sm:p-1.5 rounded-xl bg-gradient-to-br from-emerald-500 via-teal-500 to-indigo-600 text-white shadow-sm shrink-0 group-hover:scale-105 transition-transform">
              <Sparkles className="w-4 h-4 sm:w-4.5 sm:h-4.5 text-amber-200" />
            </span>
            <div className="flex flex-col">
              <span className="font-display font-extrabold text-xs xs:text-sm sm:text-base md:text-lg tracking-tight bg-gradient-to-r from-emerald-800 via-teal-700 to-indigo-800 bg-clip-text text-transparent group-hover:opacity-90 transition-opacity truncate max-w-[210px] xs:max-w-[280px] sm:max-w-md">
                {config.brandName !== undefined ? config.brandName : 'Warga Gang Mandor K2/25–K3/24'}
              </span>
              {isAdmin && (
                <span className="text-[10px] font-bold text-emerald-700 tracking-wide uppercase flex items-center gap-1">
                  <ShieldCheck className="w-3 h-3 text-emerald-600" />
                  Mode Pengurus Aktif
                </span>
              )}
            </div>
          </button>

          {/* Zone 2: Online Sync + Device Mode Indicator + Admin Actions */}
          <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
            {/* Automatic Device View Indicator Badge (Hanya tampil untuk Pengurus / Admin) */}
            {isAdmin && (
              <div
                className="hidden xl:inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-teal-50 border border-teal-300/80 text-[11px] font-bold text-teal-900 shadow-2xs"
                title={`Situs otomatis menyesuaikan tampilan untuk: ${deviceLabel}`}
              >
                {isHandphone ? (
                  <Smartphone className="w-3.5 h-3.5 text-emerald-600 animate-bounce" />
                ) : isTablet ? (
                  <Tablet className="w-3.5 h-3.5 text-cyan-600" />
                ) : (
                  <Monitor className="w-3.5 h-3.5 text-indigo-600" />
                )}
                <span className="font-semibold">{deviceLabel}</span>
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              </div>
            )}

            {/* Online Real-Time Sync Button (Hanya tampil untuk Pengurus / Admin) */}
            {isAdmin && (
              <button
                type="button"
                onClick={onOpenDatabaseModal}
                className="flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-xl bg-gradient-to-r from-emerald-500 via-teal-500 to-cyan-600 hover:from-emerald-600 hover:to-cyan-700 text-white text-xs font-bold transition-all cursor-pointer whitespace-nowrap shadow-sm min-h-[36px]"
                title={
                  lastOnlineSync
                    ? `Website Online & Sinkron Otomatis (${new Date(lastOnlineSync).toLocaleTimeString('id-ID')})`
                    : 'Sinkronisasi Server Online Real-Time'
                }
              >
                {isOnlineSyncing ? (
                  <RefreshCw className="w-3.5 h-3.5 text-amber-200 animate-spin" />
                ) : (
                  <span className="relative flex items-center justify-center">
                    {isOnlineConnected && (
                      <span className="animate-ping absolute inline-flex h-2.5 w-2.5 rounded-full bg-amber-300 opacity-75"></span>
                    )}
                    <Globe
                      className={`relative w-3.5 h-3.5 ${
                        isOnlineConnected ? 'text-amber-200' : 'text-rose-200'
                      }`}
                    />
                  </span>
                )}
                <span className="hidden sm:inline">
                  {isOnlineSyncing
                    ? 'Sinkron...'
                    : isOnlineConnected
                    ? 'Online · Auto-Sync'
                    : 'Cek Koneksi'}
                </span>
              </button>
            )}

            {isAdmin ? (
              <div className="flex items-center gap-1 sm:gap-1.5">
                <button
                  type="button"
                  onClick={onOpenConfigModal}
                  className="flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-xl bg-gradient-to-r from-emerald-600 via-teal-600 to-amber-500 hover:from-emerald-500 hover:to-amber-400 text-white text-xs font-bold shadow-sm transition-all cursor-pointer whitespace-nowrap min-h-[36px]"
                  title="Kelola Menu Utama & Pengaturan Penuh Website (Judul, Deskripsi & Isi)"
                >
                  <Sliders className="w-3.5 h-3.5 text-amber-200" />
                  <span className="hidden md:inline">Kelola Menu & Pengaturan</span>
                  <span className="md:hidden">Pengaturan</span>
                </button>
                <button
                  type="button"
                  onClick={onLogout}
                  className="p-1.5 sm:p-2 rounded-xl bg-rose-500 hover:bg-rose-600 text-white shadow-xs transition-colors cursor-pointer min-h-[36px] min-w-[36px] flex items-center justify-center gap-1.5 font-bold text-xs"
                  title="Keluar Mode Pengurus"
                >
                  <LogOut className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                  <span className="hidden lg:inline">Keluar</span>
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-1 sm:gap-1.5">
                <button
                  type="button"
                  onClick={() => {
                    setActiveTab('pengumuman');
                    setTimeout(() => {
                      const el = document.getElementById('kontak-pelayanan-publik');
                      if (el) el.scrollIntoView({ behavior: 'smooth' });
                    }, 50);
                  }}
                  className="hidden xs:flex items-center gap-1 sm:gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white text-xs font-bold shadow-xs transition-all cursor-pointer whitespace-nowrap min-h-[36px]"
                  title="Hubungi WhatsApp Pelayanan Publik"
                >
                  <Phone className="w-3.5 h-3.5 text-amber-200" />
                  <span>Layanan WA</span>
                </button>
                <button
                  type="button"
                  onClick={onOpenLogin}
                  className="flex items-center gap-1 sm:gap-1.5 px-2.5 sm:px-3.5 py-1.5 rounded-xl bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 hover:from-indigo-500 hover:to-pink-500 text-white text-xs font-bold shadow-sm transition-all cursor-pointer whitespace-nowrap min-h-[36px]"
                >
                  <Lock className="w-3.5 h-3.5 text-amber-200" />
                  <span>Pengurus</span>
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Dedicated Navigation Bar: Clean, Spacious, and Accessible across PC, Tablet & Mobile */}
        <div className="border-t border-teal-200/80 bg-gradient-to-r from-emerald-50/95 via-cyan-50/95 to-purple-50/95 shadow-inner">
          <div
            ref={scrollNavRef}
            className="max-w-7xl mx-auto px-2.5 sm:px-6 py-2 overflow-x-auto no-scrollbar flex items-center gap-1.5 sm:gap-2 scroll-smooth"
            aria-label="Navigasi Menu Utama Portal"
          >
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.id || (item.id === 'kas' && activeTab === 'iuran_kk');
              const isAmberTab = item.id === 'warga' && isActive;
              return (
                <button
                  key={item.id}
                  data-tab-id={item.id}
                  type="button"
                  onClick={() => setActiveTab(item.id)}
                  className={`flex items-center gap-1.5 px-3 sm:px-3.5 py-1.5 sm:py-2 rounded-xl text-xs sm:text-xs font-bold transition-all whitespace-nowrap cursor-pointer shrink-0 min-h-[38px] ${
                    isActive ? item.activeGradient : item.inactiveColor
                  }`}
                >
                  <Icon
                    className={`w-3.5 h-3.5 ${
                      isActive ? (isAmberTab ? 'text-slate-950' : 'text-white') : item.iconColor
                    }`}
                  />
                  <span>{item.label}</span>
                  {item.count !== undefined && (
                    <span
                      className={`font-mono text-[11px] font-black px-1.5 py-0.5 rounded-md tabular-nums ${
                        isActive
                          ? 'bg-amber-300 text-slate-950'
                          : 'bg-rose-600 text-white animate-pulse'
                      }`}
                    >
                      {item.count}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      </header>
    </>
  );
};
