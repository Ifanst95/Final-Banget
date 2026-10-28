import React, { useEffect, useRef, useState } from 'react';
import {
  Award,
  Bell,
  BookOpen,
  Building2,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Coins,
  Download,
  Edit2,
  Eye,
  EyeOff,
  FileJson,
  FileSpreadsheet,
  FileText,
  Heart,
  Info,
  Layers,
  Megaphone,
  Menu,
  Plus,
  RefreshCw,
  RotateCcw,
  Save,
  Settings,
  ShieldCheck,
  Sliders,
  Sparkles,
  Trash2,
  Upload,
  Users,
  Wallet,
  X,
} from 'lucide-react';
import { MenuItemConfig, PortalDatabasePayload, SiteConfig, SubMenuItemConfig } from '../types';
import { INITIAL_NAV_MENUS, INITIAL_SITE_CONFIG } from '../data/initialData';
import { downloadBackupJsonFile, parseAndNormalizeBackupJson } from '../utils/backupRestoreHelper';
import confetti from 'canvas-confetti';

interface EditSiteConfigModalProps {
  isOpen: boolean;
  onClose: () => void;
  config: SiteConfig;
  onSave: (newConfig: Partial<SiteConfig>) => void;
  initialTab?: 'menus' | 'titles' | 'dues' | 'backup';
  onResetAllData?: () => void;
  onResetToDefaultWithLatestDb?: () => void;
  currentPayload?: PortalDatabasePayload;
  onRestorePayload?: (payload: PortalDatabasePayload) => void;
}

const AVAILABLE_ICONS = [
  { name: 'Megaphone', label: 'Pengumuman / Megafon', icon: Megaphone },
  { name: 'Users', label: 'Warga / Statistik', icon: Users },
  { name: 'Wallet', label: 'Kas / Dompet', icon: Wallet },
  { name: 'CheckCircle2', label: 'Baksos / Centang', icon: CheckCircle2 },
  { name: 'FileSpreadsheet', label: 'Spreadsheet / Buku Induk', icon: FileSpreadsheet },
  { name: 'Bell', label: 'Tunggakan / Lonceng', icon: Bell },
  { name: 'FileText', label: 'Dokumen / Formulir', icon: FileText },
  { name: 'BookOpen', label: 'Buku Pedoman / SOP', icon: BookOpen },
  { name: 'Info', label: 'Informasi Umum', icon: Info },
  { name: 'Building2', label: 'Fasilitas / Gapura', icon: Building2 },
  { name: 'Heart', label: 'Sosial / Rukem', icon: Heart },
  { name: 'Award', label: 'Prestasi / Piagam', icon: Award },
  { name: 'ShieldCheck', label: 'Keamanan / Ronda', icon: ShieldCheck },
  { name: 'Sparkles', label: 'Kegiatan Spesial', icon: Sparkles },
];

const AVAILABLE_COLORS = [
  { id: 'emerald', label: 'Hijau Emerald', bg: 'bg-emerald-600', ring: 'ring-emerald-400' },
  { id: 'teal', label: 'Biru Teal', bg: 'bg-teal-600', ring: 'ring-teal-400' },
  { id: 'cyan', label: 'Biru Cyan', bg: 'bg-cyan-600', ring: 'ring-cyan-400' },
  { id: 'indigo', label: 'Ungu Indigo', bg: 'bg-indigo-600', ring: 'ring-indigo-400' },
  { id: 'violet', label: 'Ungu Violet', bg: 'bg-violet-600', ring: 'ring-violet-400' },
  { id: 'amber', label: 'Kuning Amber', bg: 'bg-amber-500', ring: 'ring-amber-400' },
  { id: 'rose', label: 'Merah Rose', bg: 'bg-rose-600', ring: 'ring-rose-400' },
];

export const EditSiteConfigModal: React.FC<EditSiteConfigModalProps> = ({
  isOpen,
  onClose,
  config,
  onSave,
  initialTab = 'menus',
  onResetAllData,
  onResetToDefaultWithLatestDb,
  currentPayload,
  onRestorePayload,
}) => {
  // Master modal tab selection
  const [activeTab, setActiveTab] = useState<'menus' | 'titles' | 'dues' | 'backup'>(initialTab);

  // General site configuration state
  const [formData, setFormData] = useState<SiteConfig>({ ...config });
  const [confirmResetAll, setConfirmResetAll] = useState(false);
  const [jsonRestoreStatus, setJsonRestoreStatus] = useState<string | null>(null);
  const jsonFileInputRef = useRef<HTMLInputElement | null>(null);

  // Navigation Menus State
  const [menus, setMenus] = useState<MenuItemConfig[]>(() => {
    return config.navigationMenus && config.navigationMenus.length > 0
      ? JSON.parse(JSON.stringify(config.navigationMenus))
      : JSON.parse(JSON.stringify(INITIAL_NAV_MENUS));
  });

  // Menu sub-view state: 'list' | 'add_menu' | 'edit_menu' | 'submenus' | 'add_submenu' | 'edit_submenu'
  const [menuView, setMenuView] = useState<
    'list' | 'add_menu' | 'edit_menu' | 'submenus' | 'add_submenu' | 'edit_submenu'
  >('list');
  const [selectedMenuIndex, setSelectedMenuIndex] = useState<number>(0);
  const [selectedSubMenuIndex, setSelectedSubMenuIndex] = useState<number>(-1);

  // Form states for Main Menu
  const [menuFormId, setMenuFormId] = useState<string>('');
  const [menuFormLabel, setMenuFormLabel] = useState<string>('');
  const [menuFormShortLabel, setMenuFormShortLabel] = useState<string>('');
  const [menuFormIcon, setMenuFormIcon] = useState<string>('FileText');
  const [menuFormColor, setMenuFormColor] = useState<string>('emerald');
  const [menuFormContent, setMenuFormContent] = useState<string>('');

  // Form states for Sub Menu
  const [subFormId, setSubFormId] = useState<string>('');
  const [subFormLabel, setSubFormLabel] = useState<string>('');
  const [subFormTitle, setSubFormTitle] = useState<string>('');
  const [subFormDesc, setSubFormDesc] = useState<string>('');
  const [subFormContent, setSubFormContent] = useState<string>('');

  const [confirmDeleteMenuId, setConfirmDeleteMenuId] = useState<string | null>(null);
  const [confirmDeleteSubId, setConfirmDeleteSubId] = useState<string | null>(null);
  const [saveSuccessNotice, setSaveSuccessNotice] = useState<boolean>(false);

  useEffect(() => {
    if (isOpen) {
      setFormData({ ...config });
      setMenus(
        config.navigationMenus && config.navigationMenus.length > 0
          ? JSON.parse(JSON.stringify(config.navigationMenus))
          : JSON.parse(JSON.stringify(INITIAL_NAV_MENUS))
      );
      setActiveTab(initialTab);
      setMenuView('list');
      setConfirmResetAll(false);
      setJsonRestoreStatus(null);
      setSaveSuccessNotice(false);
    }
  }, [isOpen, config, initialTab]);

  if (!isOpen) return null;

  // SAVE ALL (Config + Menus)
  const handleSaveAll = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    onSave({
      ...formData,
      navigationMenus: menus,
    });
    try {
      confetti({ particleCount: 35, spread: 50, origin: { y: 0.6 } });
    } catch {}
    onClose();
  };

  // Quick save menus directly into parent state
  const handleSaveMenusDirect = (updatedMenus: MenuItemConfig[]) => {
    setMenus(updatedMenus);
    onSave({ navigationMenus: updatedMenus });
    setSaveSuccessNotice(true);
    setTimeout(() => setSaveSuccessNotice(false), 2000);
  };

  const clearField = (key: keyof SiteConfig) => {
    setFormData((prev) => ({ ...prev, [key]: '' }));
  };

  // --- MENU MANAGEMENT HANDLERS ---
  const handleOpenAddMainMenu = () => {
    const newId = 'menu-' + Date.now();
    setMenuFormId(newId);
    setMenuFormLabel('');
    setMenuFormShortLabel('');
    setMenuFormIcon('FileText');
    setMenuFormColor('teal');
    setMenuFormContent('');
    setMenuView('add_menu');
  };

  const handleOpenEditMainMenu = (index: number) => {
    const item = menus[index];
    if (!item) return;
    setSelectedMenuIndex(index);
    setMenuFormId(item.id);
    setMenuFormLabel(item.label);
    setMenuFormShortLabel(item.shortLabel || item.label);
    setMenuFormIcon(item.icon || 'FileText');
    setMenuFormColor(item.colorScheme || 'emerald');
    setMenuFormContent(item.content || '');
    setMenuView('edit_menu');
  };

  const handleSaveMainMenu = (e: React.FormEvent) => {
    e.preventDefault();
    if (!menuFormLabel.trim()) return;

    if (menuView === 'add_menu') {
      const newMenu: MenuItemConfig = {
        id: menuFormId || 'custom-' + Date.now(),
        label: menuFormLabel.trim(),
        shortLabel: menuFormShortLabel.trim() || menuFormLabel.trim(),
        title: menuFormLabel.trim(),
        description: '',
        icon: menuFormIcon,
        colorScheme: menuFormColor,
        isCustom: true,
        isHidden: false,
        content: menuFormContent.trim(),
        subMenus: [],
      };
      const updated = [...menus, newMenu];
      handleSaveMenusDirect(updated);
    } else if (menuView === 'edit_menu') {
      const updated = [...menus];
      const existing = updated[selectedMenuIndex];
      if (existing) {
        updated[selectedMenuIndex] = {
          ...existing,
          label: menuFormLabel.trim(),
          shortLabel: menuFormShortLabel.trim() || menuFormLabel.trim(),
          icon: menuFormIcon,
          colorScheme: menuFormColor,
          content: menuFormContent.trim(),
        };
        handleSaveMenusDirect(updated);
      }
    }

    try {
      confetti({ particleCount: 30, spread: 50, origin: { y: 0.7 } });
    } catch {}
    setMenuView('list');
  };

  const handleDeleteMainMenu = (id: string) => {
    const updated = menus.filter((m) => m.id !== id);
    handleSaveMenusDirect(updated);
    setConfirmDeleteMenuId(null);
  };

  const handleToggleHideMainMenu = (index: number) => {
    const updated = [...menus];
    updated[index].isHidden = !updated[index].isHidden;
    handleSaveMenusDirect(updated);
  };

  const handleMoveMenuUp = (index: number) => {
    if (index <= 0) return;
    const updated = [...menus];
    const temp = updated[index];
    updated[index] = updated[index - 1];
    updated[index - 1] = temp;
    handleSaveMenusDirect(updated);
  };

  const handleMoveMenuDown = (index: number) => {
    if (index >= menus.length - 1) return;
    const updated = [...menus];
    const temp = updated[index];
    updated[index] = updated[index + 1];
    updated[index + 1] = temp;
    handleSaveMenusDirect(updated);
  };

  // --- SUBMENU MANAGEMENT HANDLERS ---
  const handleOpenSubMenusManager = (index: number) => {
    setSelectedMenuIndex(index);
    setMenuView('submenus');
  };

  const handleOpenAddSubMenu = () => {
    setSubFormId('sub-' + Date.now());
    setSubFormLabel('');
    setSubFormTitle('');
    setSubFormDesc('');
    setSubFormContent('');
    setMenuView('add_submenu');
  };

  const handleOpenEditSubMenu = (subIndex: number) => {
    const parent = menus[selectedMenuIndex];
    if (!parent || !parent.subMenus) return;
    const item = parent.subMenus[subIndex];
    if (!item) return;
    setSelectedSubMenuIndex(subIndex);
    setSubFormId(item.id);
    setSubFormLabel(item.label);
    setSubFormTitle(item.title || item.label);
    setSubFormDesc(item.description || '');
    setSubFormContent(item.content || '');
    setMenuView('edit_submenu');
  };

  const handleSaveSubMenu = (e: React.FormEvent) => {
    e.preventDefault();
    if (!subFormLabel.trim()) return;

    const parent = menus[selectedMenuIndex];
    if (!parent) return;

    const currentSubMenus = parent.subMenus ? [...parent.subMenus] : [];

    if (menuView === 'add_submenu') {
      const newSub: SubMenuItemConfig = {
        id: subFormId || 'sub-' + Date.now(),
        label: subFormLabel.trim(),
        title: subFormTitle.trim() || subFormLabel.trim(),
        description: subFormDesc.trim(),
        content: subFormContent.trim(),
      };
      currentSubMenus.push(newSub);
    } else if (menuView === 'edit_submenu' && selectedSubMenuIndex >= 0) {
      currentSubMenus[selectedSubMenuIndex] = {
        ...currentSubMenus[selectedSubMenuIndex],
        label: subFormLabel.trim(),
        title: subFormTitle.trim() || subFormLabel.trim(),
        description: subFormDesc.trim(),
        content: subFormContent.trim(),
      };
    }

    const updated = [...menus];
    updated[selectedMenuIndex] = {
      ...parent,
      subMenus: currentSubMenus,
    };

    handleSaveMenusDirect(updated);
    setMenuView('submenus');
    try {
      confetti({ particleCount: 25, spread: 45, origin: { y: 0.7 } });
    } catch {}
  };

  const handleDeleteSubMenu = (subId: string) => {
    const parent = menus[selectedMenuIndex];
    if (!parent || !parent.subMenus) return;

    const updatedSubMenus = parent.subMenus.filter((s) => s.id !== subId);
    const updated = [...menus];
    updated[selectedMenuIndex] = {
      ...parent,
      subMenus: updatedSubMenus,
    };

    handleSaveMenusDirect(updated);
    setConfirmDeleteSubId(null);
  };

  const handleResetMenusToDefault = () => {
    const defaultCopy = JSON.parse(JSON.stringify(INITIAL_NAV_MENUS));
    setMenus(defaultCopy);
    handleSaveMenusDirect(defaultCopy);
    setMenuView('list');
    try {
      confetti({ particleCount: 40, spread: 60, origin: { y: 0.6 } });
    } catch {}
  };

  // --- BACKUP & RESTORE HANDLERS ---
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

  const selectedMenu = menus[selectedMenuIndex];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-slate-950/70 backdrop-blur-xs overflow-y-auto animate-in fade-in duration-200">
      <div className="bg-white rounded-3xl shadow-2xl border-2 border-emerald-400 w-full max-w-4xl max-h-[92vh] flex flex-col overflow-hidden my-4">
        {/* Header Terpadu */}
        <div className="bg-gradient-to-r from-teal-700 via-emerald-700 to-indigo-800 text-white p-4 sm:p-5 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-white/15 rounded-2xl backdrop-blur-xs shadow-xs border border-white/20">
              <Sliders className="w-5 h-5 text-amber-300" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="font-extrabold text-base sm:text-lg">
                  Pengaturan Penuh & Kelola Menu Portal
                </h2>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-400 text-slate-950 uppercase">
                  Akses Pengurus
                </span>
              </div>
              <p className="text-xs text-emerald-100 mt-0.5">
                Kelola menu utama, sub menu, judul halaman, deskripsi website, serta cadangan database tanpa duplikasi.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-xl text-emerald-100 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Navigasi Terpadu (4 Bagian Jelas & Tidak Dobel) */}
        <div className="flex border-b border-slate-200 bg-slate-50/90 p-2 gap-1.5 overflow-x-auto shrink-0">
          <button
            type="button"
            onClick={() => {
              setActiveTab('menus');
              setMenuView('list');
            }}
            className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
              activeTab === 'menus'
                ? 'bg-emerald-600 text-white shadow-xs'
                : 'text-slate-600 hover:bg-slate-200 hover:text-slate-900'
            }`}
          >
            <Menu className="w-4 h-4" />
            <span>1. Kelola Menu & Sub Menu</span>
            <span className="font-mono text-[10px] px-1.5 py-0.2 rounded-md bg-white/20">
              {menus.length}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('titles')}
            className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
              activeTab === 'titles'
                ? 'bg-emerald-600 text-white shadow-xs'
                : 'text-slate-600 hover:bg-slate-200 hover:text-slate-900'
            }`}
          >
            <FileText className="w-4 h-4" />
            <span>2. Judul, Deskripsi & Isi Halaman</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('dues')}
            className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
              activeTab === 'dues'
                ? 'bg-emerald-600 text-white shadow-xs'
                : 'text-slate-600 hover:bg-slate-200 hover:text-slate-900'
            }`}
          >
            <Coins className="w-4 h-4" />
            <span>3. Pengaturan Iuran & Kas</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('backup')}
            className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
              activeTab === 'backup'
                ? 'bg-emerald-600 text-white shadow-xs'
                : 'text-slate-600 hover:bg-slate-200 hover:text-slate-900'
            }`}
          >
            <FileJson className="w-4 h-4" />
            <span>4. Cadangan & Reset Database</span>
          </button>
        </div>

        {/* Konten Tab Aktif */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6">
          {saveSuccessNotice && (
            <div className="mb-4 p-3 rounded-2xl bg-emerald-100 border border-emerald-300 text-emerald-900 text-xs font-bold flex items-center gap-2 animate-in fade-in">
              <CheckCircle2 className="w-4 h-4 text-emerald-700" />
              <span>Perubahan struktur menu berhasil disimpan ke database online!</span>
            </div>
          )}

          {/* ======================================================== */}
          {/* TAB 1: KELOLA MENU UTAMA & SUB MENU PORTAL               */}
          {/* ======================================================== */}
          {activeTab === 'menus' && (
            <div className="space-y-4">
              {/* SUB-VIEW 1.1: LIST MENU UTAMA */}
              {menuView === 'list' && (
                <div className="space-y-4">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
                    <div>
                      <h4 className="font-extrabold text-sm sm:text-base text-slate-900">
                        Daftar Menu Utama Navigasi Portal
                      </h4>
                      <p className="text-xs text-slate-500">
                        Atur urutan, edit nama menu, sembunyikan, atau tambahkan sub menu untuk setiap tombol navigasi.
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={handleOpenAddMainMenu}
                        className="flex items-center gap-1.5 px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-xs transition-colors cursor-pointer"
                      >
                        <Plus className="w-4 h-4" />
                        <span>Tambah Menu Baru</span>
                      </button>
                      <button
                        type="button"
                        onClick={handleResetMenusToDefault}
                        className="flex items-center gap-1 px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold transition-colors cursor-pointer"
                        title="Kembalikan susunan menu bawaan sistem"
                      >
                        <RotateCcw className="w-3.5 h-3.5" />
                        <span>Reset Menu Default</span>
                      </button>
                    </div>
                  </div>

                  {/* Menu Cards */}
                  <div className="space-y-3">
                    {menus.map((item, idx) => {
                      const IconComp =
                        AVAILABLE_ICONS.find((i) => i.name === item.icon)?.icon || Layers;
                      const isHidden = item.isHidden;
                      const subCount = item.subMenus?.length || 0;

                      return (
                        <div
                          key={item.id}
                          className={`p-3.5 sm:p-4 rounded-2xl border transition-all ${
                            isHidden
                              ? 'bg-slate-50/80 border-slate-200 opacity-60'
                              : 'bg-white border-slate-200 shadow-2xs hover:border-emerald-300'
                          }`}
                        >
                          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                            <div className="flex items-start gap-3">
                              {/* Urutan Move Up / Move Down */}
                              <div className="flex flex-col gap-1 items-center justify-center shrink-0 pt-0.5">
                                <button
                                  type="button"
                                  disabled={idx === 0}
                                  onClick={() => handleMoveMenuUp(idx)}
                                  className="p-1 rounded-lg hover:bg-slate-200 text-slate-500 disabled:opacity-30 cursor-pointer disabled:cursor-not-allowed"
                                  title="Pindah ke Atas"
                                >
                                  <ChevronUp className="w-3.5 h-3.5" />
                                </button>
                                <span className="font-mono text-[10px] font-bold text-slate-400">
                                  #{idx + 1}
                                </span>
                                <button
                                  type="button"
                                  disabled={idx === menus.length - 1}
                                  onClick={() => handleMoveMenuDown(idx)}
                                  className="p-1 rounded-lg hover:bg-slate-200 text-slate-500 disabled:opacity-30 cursor-pointer disabled:cursor-not-allowed"
                                  title="Pindah ke Bawah"
                                >
                                  <ChevronDown className="w-3.5 h-3.5" />
                                </button>
                              </div>

                              <div className="p-2.5 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 text-white shadow-2xs shrink-0 mt-0.5">
                                <IconComp className="w-4 h-4" />
                              </div>

                              <div>
                                <div className="flex items-center gap-2 flex-wrap">
                                  <h5 className="font-extrabold text-sm sm:text-base text-slate-900">
                                    {item.label}
                                  </h5>
                                  {item.shortLabel && item.shortLabel !== item.label && (
                                    <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-100 text-slate-600">
                                      HP: {item.shortLabel}
                                    </span>
                                  )}
                                  {subCount > 0 && (
                                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-800 border border-indigo-200">
                                      {subCount} Sub Menu
                                    </span>
                                  )}
                                  {item.isCustom && (
                                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 border border-amber-200">
                                      Menu Kustom
                                    </span>
                                  )}
                                  {isHidden && (
                                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-200 text-slate-700">
                                      Disembunyikan
                                    </span>
                                  )}
                                </div>
                                <div className="text-xs text-slate-500 mt-0.5">
                                  Ikon: <span className="font-semibold text-slate-700">{item.icon || 'FileText'}</span> | Warna: <span className="font-semibold text-slate-700">{item.colorScheme || 'emerald'}</span>
                                </div>
                              </div>
                            </div>

                            {/* Tombol Aksi Menu */}
                            <div className="flex items-center gap-1.5 self-end sm:self-auto shrink-0">
                              <button
                                type="button"
                                onClick={() => handleOpenSubMenusManager(idx)}
                                className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-indigo-50 hover:bg-indigo-100 text-indigo-800 border border-indigo-200 text-xs font-bold transition-colors cursor-pointer"
                                title="Kelola Sub Menu di bawah menu ini"
                              >
                                <Layers className="w-3.5 h-3.5 text-indigo-600" />
                                <span>Sub Menu ({subCount})</span>
                              </button>

                              <button
                                type="button"
                                onClick={() => handleToggleHideMainMenu(idx)}
                                className={`p-2 rounded-xl border text-xs transition-colors cursor-pointer ${
                                  isHidden
                                    ? 'bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-100'
                                    : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                                }`}
                                title={isHidden ? 'Tampilkan Menu ini di Navbar' : 'Sembunyikan Menu ini dari Navbar'}
                              >
                                {isHidden ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                              </button>

                              <button
                                type="button"
                                onClick={() => handleOpenEditMainMenu(idx)}
                                className="p-2 rounded-xl bg-teal-50 hover:bg-teal-100 text-teal-800 border border-teal-200 text-xs font-bold transition-colors cursor-pointer"
                                title="Edit Nama & Ikon Menu"
                              >
                                <Edit2 className="w-4 h-4 text-teal-700" />
                              </button>

                              {confirmDeleteMenuId === item.id ? (
                                <div className="flex items-center gap-1">
                                  <button
                                    type="button"
                                    onClick={() => handleDeleteMainMenu(item.id)}
                                    className="px-2.5 py-1 bg-rose-600 text-white rounded-lg text-xs font-bold cursor-pointer"
                                  >
                                    Hapus
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => setConfirmDeleteMenuId(null)}
                                    className="px-2 py-1 bg-slate-100 text-slate-700 rounded-lg text-xs cursor-pointer"
                                  >
                                    Batal
                                  </button>
                                </div>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => setConfirmDeleteMenuId(item.id)}
                                  className="p-2 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 text-xs transition-colors cursor-pointer"
                                  title="Hapus Menu ini"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              )}
                            </div>
                          </div>

                          {/* Submenu Preview tags */}
                          {item.subMenus && item.subMenus.length > 0 && (
                            <div className="mt-3 pt-2.5 border-t border-slate-100 flex flex-wrap items-center gap-1.5">
                              <span className="text-[11px] font-bold text-slate-400">Sub Menu:</span>
                              {item.subMenus.map((sub) => (
                                <span
                                  key={sub.id}
                                  className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-lg bg-slate-100 text-slate-800"
                                >
                                  <span>{sub.label}</span>
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* SUB-VIEW 1.2: FORM TAMBAH / EDIT MENU UTAMA */}
              {(menuView === 'add_menu' || menuView === 'edit_menu') && (
                <form onSubmit={handleSaveMainMenu} className="space-y-4 bg-slate-50 p-4 sm:p-5 rounded-2xl border border-slate-200">
                  <div className="flex items-center justify-between pb-3 border-b border-slate-200">
                    <div>
                      <h4 className="font-bold text-sm text-slate-900">
                        {menuView === 'add_menu' ? 'Tambah Menu Navigasi Baru' : `Edit Menu: ${menuFormLabel}`}
                      </h4>
                      <p className="text-xs text-slate-500">
                        Sesuaikan nama label tombol di navbar, singkatan untuk mobile, dan ikon visual.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setMenuView('list')}
                      className="px-3 py-1.5 bg-white border border-slate-300 text-slate-700 rounded-xl text-xs font-bold hover:bg-slate-100 cursor-pointer"
                    >
                      Kembali ke Daftar
                    </button>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">
                        Nama Menu di Navbar (Label) *
                      </label>
                      <input
                        type="text"
                        required
                        placeholder="Contoh: Agenda Warga, SOP Gang, Jadwal Ronda..."
                        value={menuFormLabel}
                        onChange={(e) => setMenuFormLabel(e.target.value)}
                        className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl focus:ring-2 focus:ring-emerald-500 font-bold bg-white"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">
                        Singkatan untuk Layar HP (Opsional)
                      </label>
                      <input
                        type="text"
                        placeholder="Singkatan 1-2 kata"
                        value={menuFormShortLabel}
                        onChange={(e) => setMenuFormShortLabel(e.target.value)}
                        className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl focus:ring-2 focus:ring-emerald-500 bg-white"
                      />
                    </div>
                  </div>

                  {/* Icon Selector */}
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1.5">
                      Pilih Ikon Menu:
                    </label>
                    <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-7 gap-2">
                      {AVAILABLE_ICONS.map((ico) => {
                        const IcoComp = ico.icon;
                        const isSelected = menuFormIcon === ico.name;
                        return (
                          <button
                            key={ico.name}
                            type="button"
                            onClick={() => setMenuFormIcon(ico.name)}
                            className={`p-2.5 rounded-xl border flex flex-col items-center justify-center gap-1 transition-all cursor-pointer ${
                              isSelected
                                ? 'bg-emerald-600 text-white border-emerald-700 shadow-xs ring-2 ring-emerald-300'
                                : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
                            }`}
                            title={ico.label}
                          >
                            <IcoComp className="w-4 h-4" />
                            <span className="text-[10px] truncate max-w-full font-medium">
                              {ico.name}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Color Selector */}
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1.5">
                      Warna Aksen Menu:
                    </label>
                    <div className="flex flex-wrap gap-2">
                      {AVAILABLE_COLORS.map((col) => (
                        <button
                          key={col.id}
                          type="button"
                          onClick={() => setMenuFormColor(col.id)}
                          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all cursor-pointer ${
                            menuFormColor === col.id
                              ? `${col.bg} text-white border-transparent shadow-xs ring-2 ${col.ring}`
                              : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
                          }`}
                        >
                          <span className={`w-2.5 h-2.5 rounded-full ${col.bg}`}></span>
                          <span>{col.label}</span>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Custom Page Content Area */}
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Isi Konten / Panduan Halaman (Opsional untuk Menu Kustom)
                    </label>
                    <textarea
                      rows={3}
                      placeholder="Tuliskan informasi, catatan, atau panduan yang ingin ditampilkan kepada warga saat menu ini dibuka..."
                      value={menuFormContent}
                      onChange={(e) => setMenuFormContent(e.target.value)}
                      className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl focus:ring-2 focus:ring-emerald-500 bg-white leading-relaxed"
                    />
                  </div>

                  <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-200">
                    <button
                      type="button"
                      onClick={() => setMenuView('list')}
                      className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-200 rounded-xl cursor-pointer"
                    >
                      Batal
                    </button>
                    <button
                      type="submit"
                      className="flex items-center gap-1.5 px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-md cursor-pointer"
                    >
                      <Save className="w-4 h-4" />
                      <span>Simpan Menu</span>
                    </button>
                  </div>
                </form>
              )}

              {/* SUB-VIEW 1.3: KELOLA SUB MENU */}
              {menuView === 'submenus' && selectedMenu && (
                <div className="space-y-4">
                  <div className="p-3.5 rounded-2xl bg-indigo-50 border border-indigo-200 text-xs text-indigo-950 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div>
                      <h4 className="font-extrabold text-sm text-indigo-950">
                        Sub Menu untuk: {selectedMenu.label} ({selectedMenu.subMenus?.length || 0} Sub Menu)
                      </h4>
                      <p className="text-[11px] text-indigo-800 mt-0.5">
                        Sub menu akan tampil sebagai tab navigasi turunan di dalam halaman {selectedMenu.label}.
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={handleOpenAddSubMenu}
                        className="flex items-center gap-1.5 px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold cursor-pointer shadow-xs"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>Tambah Sub Menu</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setMenuView('list')}
                        className="px-3 py-1.5 bg-white border border-indigo-200 text-indigo-800 rounded-xl text-xs font-bold cursor-pointer hover:bg-indigo-100"
                      >
                        Daftar Menu Utama
                      </button>
                    </div>
                  </div>

                  {/* Submenu List */}
                  {!selectedMenu.subMenus || selectedMenu.subMenus.length === 0 ? (
                    <div className="p-8 text-center bg-slate-50 rounded-2xl border border-dashed border-slate-300 space-y-2">
                      <Layers className="w-8 h-8 text-slate-400 mx-auto" />
                      <p className="text-xs font-bold text-slate-700">
                        Belum ada Sub Menu di bawah menu "{selectedMenu.label}".
                      </p>
                      <p className="text-[11px] text-slate-500 max-w-sm mx-auto">
                        Anda dapat menambahkan sub menu seperti rincian iuran, peraturan, formulir, atau halaman pendukung.
                      </p>
                      <button
                        type="button"
                        onClick={handleOpenAddSubMenu}
                        className="mt-2 inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-indigo-600 text-white rounded-xl text-xs font-bold cursor-pointer"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>Tambah Sub Menu Pertama</span>
                      </button>
                    </div>
                  ) : (
                    <div className="space-y-2.5">
                      {selectedMenu.subMenus.map((sub, sIdx) => (
                        <div
                          key={sub.id}
                          className="p-3.5 rounded-2xl border border-slate-200 bg-white hover:border-indigo-300 shadow-2xs flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                        >
                          <div>
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-mono text-xs font-bold text-slate-400">
                                #{sIdx + 1}
                              </span>
                              <span className="font-bold text-sm text-slate-900">
                                {sub.label}
                              </span>
                            </div>
                            <div className="text-xs text-indigo-900 font-semibold mt-1">
                              Judul: <span>{sub.title || sub.label}</span>
                            </div>
                            {sub.description && (
                              <p className="text-xs text-slate-500 mt-0.5 line-clamp-2">
                                Deskripsi: {sub.description}
                              </p>
                            )}
                          </div>

                          <div className="flex items-center gap-1.5 self-end sm:self-auto shrink-0">
                            <button
                              type="button"
                              onClick={() => handleOpenEditSubMenu(sIdx)}
                              className="p-2 rounded-xl bg-indigo-50 hover:bg-indigo-100 text-indigo-800 border border-indigo-200 text-xs font-bold transition-colors cursor-pointer"
                              title="Edit Sub Menu"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>
                            {confirmDeleteSubId === sub.id ? (
                              <div className="flex items-center gap-1">
                                <button
                                  type="button"
                                  onClick={() => handleDeleteSubMenu(sub.id)}
                                  className="px-2.5 py-1 bg-rose-600 text-white rounded-lg text-xs font-bold cursor-pointer"
                                >
                                  Hapus
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setConfirmDeleteSubId(null)}
                                  className="px-2 py-1 bg-slate-100 text-slate-700 rounded-lg text-xs cursor-pointer"
                                >
                                  Batal
                                </button>
                              </div>
                            ) : (
                              <button
                                type="button"
                                onClick={() => setConfirmDeleteSubId(sub.id)}
                                className="p-2 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 text-xs transition-colors cursor-pointer"
                                title="Hapus Sub Menu"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* SUB-VIEW 1.4: FORM TAMBAH / EDIT SUB MENU */}
              {(menuView === 'add_submenu' || menuView === 'edit_submenu') && selectedMenu && (
                <form onSubmit={handleSaveSubMenu} className="space-y-4 bg-slate-50 p-4 sm:p-5 rounded-2xl border border-slate-200">
                  <div className="flex items-center justify-between pb-3 border-b border-slate-200">
                    <div>
                      <h4 className="font-bold text-sm text-indigo-950">
                        {menuView === 'add_submenu'
                          ? `Tambah Sub Menu Baru untuk: ${selectedMenu.label}`
                          : `Edit Sub Menu: ${subFormLabel}`}
                      </h4>
                      <p className="text-[11px] text-slate-500">
                        Sub menu ini akan menjadi tab pilihan navigasi di dalam halaman {selectedMenu.label}.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setMenuView('submenus')}
                      className="px-3 py-1.5 bg-white border border-indigo-200 text-indigo-800 rounded-xl text-xs font-bold cursor-pointer hover:bg-indigo-100"
                    >
                      Kembali ke Sub Menu
                    </button>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Nama Tombol Sub Menu (Label) *
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="Contoh: Rekap Tahunan, SOP, Rincian..."
                      value={subFormLabel}
                      onChange={(e) => setSubFormLabel(e.target.value)}
                      className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500 font-bold bg-white"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Judul Halaman Sub Menu (Opsional)
                    </label>
                    <input
                      type="text"
                      placeholder="Judul besar saat sub menu ini dibuka..."
                      value={subFormTitle}
                      onChange={(e) => setSubFormTitle(e.target.value)}
                      className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500 bg-white"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Deskripsi Sub Menu (Opsional)
                    </label>
                    <textarea
                      rows={2}
                      placeholder="Penjelasan ringkas mengenai sub menu ini..."
                      value={subFormDesc}
                      onChange={(e) => setSubFormDesc(e.target.value)}
                      className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500 bg-white leading-relaxed"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Isi Konten Bebas Sub Menu
                    </label>
                    <textarea
                      rows={3}
                      placeholder="Tuliskan teks, informasi, atau petunjuk khusus untuk sub menu ini..."
                      value={subFormContent}
                      onChange={(e) => setSubFormContent(e.target.value)}
                      className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500 bg-white leading-relaxed"
                    />
                  </div>

                  <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-200">
                    <button
                      type="button"
                      onClick={() => setMenuView('submenus')}
                      className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-200 rounded-xl cursor-pointer"
                    >
                      Batal
                    </button>
                    <button
                      type="submit"
                      className="flex items-center gap-1.5 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold shadow-md cursor-pointer"
                    >
                      <Save className="w-4 h-4" />
                      <span>Simpan Sub Menu</span>
                    </button>
                  </div>
                </form>
              )}
            </div>
          )}

          {/* ======================================================== */}
          {/* TAB 2: JUDUL, DESKRIPSI & ISI HALAMAN WEBSITE            */}
          {/* ======================================================== */}
          {activeTab === 'titles' && (
            <div className="space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-slate-100">
                <div>
                  <h4 className="font-extrabold text-sm sm:text-base text-slate-900">
                    Edit & Hapus Judul, Deskripsi & Isi Halaman Website
                  </h4>
                  <p className="text-xs text-slate-500">
                    Ubah atau kosongkan teks judul dan keterangan di setiap modul. Klik "Hapus" pada bidang yang ingin dikosongkan.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setFormData({ ...INITIAL_SITE_CONFIG, navigationMenus: menus })}
                  className="flex items-center gap-1 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-emerald-800 rounded-xl text-xs font-semibold transition-colors cursor-pointer self-start sm:self-auto shrink-0"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Kembalikan Teks Bawaan</span>
                </button>
              </div>

              {/* 2.1 Identitas Utama Website */}
              <div className="space-y-3 p-4 rounded-2xl bg-slate-50/80 border border-slate-200">
                <h5 className="text-xs font-bold uppercase tracking-wider text-emerald-800">
                  A. Identitas Utama & Banner Beranda
                </h5>

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
                      className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:outline-none bg-white font-bold"
                    />
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="text-xs font-semibold text-slate-700">
                        Judul Utama Website / Banner
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
                      placeholder="PAPAN INFORMASI WARGA"
                      value={formData.title ?? ''}
                      onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                      className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:outline-none bg-white font-bold"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="text-xs font-semibold text-slate-700">
                        Sub-Judul Website
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
                      placeholder="Portal Keterbukaan Informasi Warga..."
                      value={formData.subtitle ?? ''}
                      onChange={(e) => setFormData({ ...formData, subtitle: e.target.value })}
                      className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:outline-none bg-white"
                    />
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="text-xs font-semibold text-slate-700">
                        Teks Hak Cipta di Footer Bawah
                      </label>
                      <button
                        type="button"
                        onClick={() => clearField('footerCopyrightText')}
                        className="text-[10px] text-rose-600 hover:underline cursor-pointer"
                      >
                        Hapus
                      </button>
                    </div>
                    <input
                      type="text"
                      value={formData.footerCopyrightText ?? ''}
                      onChange={(e) => setFormData({ ...formData, footerCopyrightText: e.target.value })}
                      className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:outline-none bg-white"
                    />
                  </div>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-xs font-semibold text-slate-700">
                      Deskripsi Lengkap Portal di Beranda
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
                    placeholder="Portal informasi warga, laporan kas, data kependudukan..."
                    value={formData.description ?? ''}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:outline-none bg-white leading-relaxed"
                  />
                </div>
              </div>

              {/* 2.2 Judul & Deskripsi Halaman-Halaman Portal */}
              <div className="space-y-3 p-4 rounded-2xl bg-slate-50/80 border border-slate-200">
                <h5 className="text-xs font-bold uppercase tracking-wider text-emerald-800">
                  B. Judul & Deskripsi Modul Halaman
                </h5>

                {/* Pengumuman */}
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
                      onChange={(e) => setFormData({ ...formData, announcementSectionTitle: e.target.value })}
                      className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:outline-none bg-white"
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
                      onChange={(e) => setFormData({ ...formData, announcementSectionSubtitle: e.target.value })}
                      className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:outline-none bg-white"
                    />
                  </div>
                </div>

                {/* Bakti Sosial */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-slate-200/60">
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
                      onChange={(e) => setFormData({ ...formData, baksosSectionTitle: e.target.value })}
                      className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:outline-none bg-white"
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
                      value={formData.baksosDescription ?? ''}
                      onChange={(e) => setFormData({ ...formData, baksosDescription: e.target.value })}
                      className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:outline-none bg-white"
                    />
                  </div>
                </div>

                {/* Data Warga */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-slate-200/60">
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
                      onChange={(e) => setFormData({ ...formData, directorySectionTitle: e.target.value })}
                      className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:outline-none bg-white"
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
                      onChange={(e) => setFormData({ ...formData, directorySectionDescription: e.target.value })}
                      className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:outline-none bg-white"
                    />
                  </div>
                </div>

                {/* Rekapitulasi Tunggakan */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-slate-200/60">
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
                      onChange={(e) => setFormData({ ...formData, arrearsSectionTitle: e.target.value })}
                      className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:outline-none bg-white"
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
                      onChange={(e) => setFormData({ ...formData, arrearsSectionDescription: e.target.value })}
                      className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:outline-none bg-white"
                    />
                  </div>
                </div>

                {/* Kontak Pelayanan Publik */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-slate-200/60">
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
                      onChange={(e) => setFormData({ ...formData, publicContactTitle: e.target.value })}
                      className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:outline-none bg-white"
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
                      onChange={(e) => setFormData({ ...formData, publicContactDescription: e.target.value })}
                      className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:outline-none bg-white"
                    />
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ======================================================== */}
          {/* TAB 3: PENGATURAN IURAN & LAPORAN KAS                    */}
          {/* ======================================================== */}
          {activeTab === 'dues' && (
            <div className="space-y-4">
              <div className="pb-3 border-b border-slate-100">
                <h4 className="font-extrabold text-sm sm:text-base text-slate-900">
                  Pengaturan Bulan Iuran, Tarif Standar & Buku Kas
                </h4>
                <p className="text-xs text-slate-500">
                  Atur bulan berjalan untuk penarikan iuran warga dan nominal standar iuran kas bulanan.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-4 rounded-2xl bg-slate-50/80 border border-slate-200">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Keterangan Bulan Iuran Berjalan *
                  </label>
                  <input
                    type="text"
                    placeholder="Misal: September 2026 atau Oktober 2026"
                    value={formData.duesCurrentMonth ?? 'September 2026'}
                    onChange={(e) => setFormData({ ...formData, duesCurrentMonth: e.target.value })}
                    className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl focus:ring-2 focus:ring-emerald-500 bg-white font-bold"
                  />
                  <p className="text-[11px] text-slate-500 mt-1">
                    Bulan ini menjadi acuan batas rekapitulasi iuran per KK dan kartu saldo penarikan berjalan.
                  </p>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Nominal Standar Iuran Kas Bulanan (Rp) *
                  </label>
                  <input
                    type="number"
                    value={formData.duesAmountPerMonth}
                    onChange={(e) => setFormData({ ...formData, duesAmountPerMonth: Number(e.target.value) || 0 })}
                    className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl focus:ring-2 focus:ring-emerald-500 bg-white font-bold"
                  />
                  <p className="text-[11px] text-slate-500 mt-1">
                    Tarif standar per KK per bulan (dapat di-override khusus untuk rumah kosong/kavling tertentu).
                  </p>
                </div>
              </div>

              <div className="p-4 rounded-2xl bg-emerald-50/70 border border-emerald-200/80 text-emerald-900 text-xs flex items-start gap-2.5">
                <Sparkles className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                <p>
                  <strong>Tips:</strong> Untuk mengubah judul atau deskripsi modul Kas Utama, Buku Mutasi, atau modul lainnya, gunakan Tab <strong>"Judul & Deskripsi"</strong> di atas. Setiap bagian dilengkapi tombol 1-klik <em>"Hapus"</em> untuk mengosongkan teks dengan cepat.
                </p>
              </div>
            </div>
          )}

          {/* ======================================================== */}
          {/* TAB 4: CADANGAN, PULIHKAN & RESET DATABASE               */}
          {/* ======================================================== */}
          {activeTab === 'backup' && (
            <div className="space-y-4">
              <div className="pb-3 border-b border-slate-100">
                <h4 className="font-extrabold text-sm sm:text-base text-slate-900">
                  Cadangan, Pemulihan File JSON & Pemeliharaan Sistem
                </h4>
                <p className="text-xs text-slate-500">
                  Unduh berkas cadangan database, pulihkan dari file cadangan, atau lakukan reset tampilan.
                </p>
              </div>

              {/* Cadangan & Pulihkan File JSON */}
              <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <FileJson className="w-4 h-4 text-emerald-600" />
                    <h5 className="text-xs font-bold text-slate-800">
                      Cadangan & Pulihkan Seluruh Database (.JSON)
                    </h5>
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
                    className={`p-2.5 rounded-xl text-xs font-semibold ${
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
                      className="flex items-center gap-1.5 px-3.5 py-2 bg-white border border-slate-300 hover:bg-slate-100 text-slate-800 rounded-xl text-xs font-bold shadow-2xs transition-colors cursor-pointer"
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
                        className="flex items-center gap-1.5 px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-2xs transition-colors cursor-pointer"
                      >
                        <Upload className="w-3.5 h-3.5 text-amber-200" />
                        <span>Pulihkan dari File (.json)</span>
                      </button>
                    </>
                  )}
                </div>
              </div>

              {/* Default & Tarik Data Terakhir */}
              {onResetToDefaultWithLatestDb && (
                <div className="p-4 rounded-2xl bg-emerald-50/80 border border-emerald-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="space-y-0.5">
                    <span className="text-xs font-bold text-emerald-950 block">
                      Kembali ke Tampilan Default & Tarik Data Inputan Server Terakhir
                    </span>
                    <span className="text-[11px] text-emerald-800">
                      Mengembalikan teks tampilan ke default namun tetap menarik seluruh input data terbaru dari server database online.
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      onResetToDefaultWithLatestDb();
                      onClose();
                    }}
                    className="flex items-center gap-1.5 px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-xs cursor-pointer whitespace-nowrap self-start sm:self-auto shrink-0"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    <span>Default & Tarik Data Terakhir</span>
                  </button>
                </div>
              )}

              {/* Reset Total Database */}
              {onResetAllData && (
                <div className="p-4 rounded-2xl bg-rose-50/80 border border-rose-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="space-y-0.5">
                    <span className="text-xs font-bold text-rose-950 block">
                      Reset Seluruh Isi Website ke Data Bawaan Sistem
                    </span>
                    <span className="text-[11px] text-rose-800">
                      Tindakan ini akan mengembalikan seluruh warga, iuran, dan kas ke data bawaan awal.
                    </span>
                  </div>
                  {confirmResetAll ? (
                    <div className="flex items-center gap-1.5 shrink-0">
                      <button
                        type="button"
                        onClick={() => {
                          onResetAllData();
                          onClose();
                        }}
                        className="px-3.5 py-2 bg-rose-600 text-white text-xs font-bold rounded-xl cursor-pointer shadow-xs"
                      >
                        Ya, Reset Semua Data
                      </button>
                      <button
                        type="button"
                        onClick={() => setConfirmResetAll(false)}
                        className="px-3 py-2 bg-white border border-rose-300 text-slate-700 text-xs font-semibold rounded-xl cursor-pointer"
                      >
                        Batal
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setConfirmResetAll(true)}
                      className="flex items-center gap-1 px-3.5 py-2 bg-white border border-rose-300 hover:bg-rose-100 text-rose-700 text-xs font-bold rounded-xl cursor-pointer shadow-2xs self-start sm:self-auto shrink-0"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>Reset Seluruh Data Website</span>
                    </button>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer Modal Bersama */}
        <div className="p-3.5 sm:p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between shrink-0">
          <div className="text-xs text-slate-500 font-medium">
            Tab aktif: <span className="font-bold text-emerald-800">{activeTab === 'menus' ? 'Kelola Menu' : activeTab === 'titles' ? 'Judul & Deskripsi' : activeTab === 'dues' ? 'Iuran & Kas' : 'Cadangan & Reset'}</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-200 rounded-xl transition-colors cursor-pointer"
            >
              Tutup
            </button>
            <button
              type="button"
              onClick={() => handleSaveAll()}
              className="flex items-center gap-1.5 px-5 py-2 text-xs font-bold text-white bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 rounded-xl shadow-md transition-all cursor-pointer"
            >
              <Save className="w-4 h-4" />
              <span>Simpan Semua Pengaturan</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
