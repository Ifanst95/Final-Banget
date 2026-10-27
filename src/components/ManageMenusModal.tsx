import React, { useState } from 'react';
import confetti from 'canvas-confetti';
import {
  Award,
  Bell,
  BookOpen,
  Building2,
  Calendar,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  ChevronUp,
  Edit2,
  Eye,
  EyeOff,
  FileSpreadsheet,
  FileText,
  Heart,
  Info,
  Layers,
  LayoutGrid,
  Megaphone,
  Menu,
  Plus,
  RotateCcw,
  Save,
  Settings,
  ShieldCheck,
  Sparkles,
  Trash2,
  User,
  Users,
  Wallet,
  X,
} from 'lucide-react';
import { MenuItemConfig, SiteConfig, SubMenuItemConfig } from '../types';
import { INITIAL_NAV_MENUS } from '../data/initialData';

interface ManageMenusModalProps {
  isOpen: boolean;
  onClose: () => void;
  config: SiteConfig;
  onSaveMenus: (menus: MenuItemConfig[]) => void;
  onResetMenusToDefault: () => void;
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

export const ManageMenusModal: React.FC<ManageMenusModalProps> = ({
  isOpen,
  onClose,
  config,
  onSaveMenus,
  onResetMenusToDefault,
}) => {
  const [menus, setMenus] = useState<MenuItemConfig[]>(() => {
    return config.navigationMenus && config.navigationMenus.length > 0
      ? JSON.parse(JSON.stringify(config.navigationMenus))
      : JSON.parse(JSON.stringify(INITIAL_NAV_MENUS));
  });

  // Modal Sub-state: 'list' | 'add_menu' | 'edit_menu' | 'submenus' | 'add_submenu' | 'edit_submenu'
  const [activeView, setActiveView] = useState<'list' | 'add_menu' | 'edit_menu' | 'submenus' | 'add_submenu' | 'edit_submenu'>('list');
  const [selectedMenuIndex, setSelectedMenuIndex] = useState<number>(0);
  const [selectedSubMenuIndex, setSelectedSubMenuIndex] = useState<number>(-1);

  // Form states for Main Menu
  const [menuFormId, setMenuFormId] = useState<string>('');
  const [menuFormLabel, setMenuFormLabel] = useState<string>('');
  const [menuFormShortLabel, setMenuFormShortLabel] = useState<string>('');
  const [menuFormTitle, setMenuFormTitle] = useState<string>('');
  const [menuFormDesc, setMenuFormDesc] = useState<string>('');
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

  // Sync when modal opens
  React.useEffect(() => {
    if (isOpen) {
      setMenus(
        config.navigationMenus && config.navigationMenus.length > 0
          ? JSON.parse(JSON.stringify(config.navigationMenus))
          : JSON.parse(JSON.stringify(INITIAL_NAV_MENUS))
      );
      setActiveView('list');
      setSaveSuccessNotice(false);
    }
  }, [isOpen, config.navigationMenus]);

  if (!isOpen) return null;

  // OPEN ADD MAIN MENU
  const handleOpenAddMainMenu = () => {
    const newId = 'menu-' + Date.now();
    setMenuFormId(newId);
    setMenuFormLabel('');
    setMenuFormShortLabel('');
    setMenuFormTitle('');
    setMenuFormDesc('');
    setMenuFormIcon('FileText');
    setMenuFormColor('teal');
    setMenuFormContent('');
    setActiveView('add_menu');
  };

  // OPEN EDIT MAIN MENU
  const handleOpenEditMainMenu = (index: number) => {
    const item = menus[index];
    if (!item) return;
    setSelectedMenuIndex(index);
    setMenuFormId(item.id);
    setMenuFormLabel(item.label);
    setMenuFormShortLabel(item.shortLabel || item.label);
    setMenuFormTitle(item.title);
    setMenuFormDesc(item.description);
    setMenuFormIcon(item.icon || 'FileText');
    setMenuFormColor(item.colorScheme || 'emerald');
    setMenuFormContent(item.content || '');
    setActiveView('edit_menu');
  };

  // SAVE MAIN MENU (ADD or EDIT)
  const handleSaveMainMenu = (e: React.FormEvent) => {
    e.preventDefault();
    if (!menuFormLabel.trim()) return;

    const trimmedTitle = menuFormTitle.trim() || menuFormLabel.trim();
    const trimmedDesc = menuFormDesc.trim();

    if (activeView === 'add_menu') {
      const newMenu: MenuItemConfig = {
        id: menuFormId || 'custom-' + Date.now(),
        label: menuFormLabel.trim(),
        shortLabel: menuFormShortLabel.trim() || menuFormLabel.trim(),
        title: trimmedTitle,
        description: trimmedDesc,
        icon: menuFormIcon,
        colorScheme: menuFormColor,
        isCustom: true,
        isHidden: false,
        content: menuFormContent.trim(),
        subMenus: [],
      };
      const updated = [...menus, newMenu];
      setMenus(updated);
      onSaveMenus(updated);
    } else if (activeView === 'edit_menu') {
      const updated = [...menus];
      const existing = updated[selectedMenuIndex];
      if (existing) {
        updated[selectedMenuIndex] = {
          ...existing,
          label: menuFormLabel.trim(),
          shortLabel: menuFormShortLabel.trim() || menuFormLabel.trim(),
          title: trimmedTitle,
          description: trimmedDesc,
          icon: menuFormIcon,
          colorScheme: menuFormColor,
          content: menuFormContent.trim(),
        };
        setMenus(updated);
        onSaveMenus(updated);
      }
    }

    try {
      confetti({ particleCount: 30, spread: 50, origin: { y: 0.7 } });
    } catch {}
    setActiveView('list');
    setSaveSuccessNotice(true);
    setTimeout(() => setSaveSuccessNotice(false), 2000);
  };

  // DELETE MAIN MENU
  const handleDeleteMainMenu = (id: string) => {
    const updated = menus.filter((m) => m.id !== id);
    setMenus(updated);
    onSaveMenus(updated);
    setConfirmDeleteMenuId(null);
  };

  // TOGGLE HIDE MAIN MENU
  const handleToggleHideMainMenu = (index: number) => {
    const updated = [...menus];
    updated[index].isHidden = !updated[index].isHidden;
    setMenus(updated);
    onSaveMenus(updated);
  };

  // OPEN SUBMENUS MANAGER FOR A MENU
  const handleOpenSubMenusManager = (index: number) => {
    setSelectedMenuIndex(index);
    setActiveView('submenus');
  };

  // OPEN ADD SUBMENU
  const handleOpenAddSubMenu = () => {
    setSubFormId('sub-' + Date.now());
    setSubFormLabel('');
    setSubFormTitle('');
    setSubFormDesc('');
    setSubFormContent('');
    setActiveView('add_submenu');
  };

  // OPEN EDIT SUBMENU
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
    setActiveView('edit_submenu');
  };

  // SAVE SUBMENU (ADD or EDIT)
  const handleSaveSubMenu = (e: React.FormEvent) => {
    e.preventDefault();
    if (!subFormLabel.trim()) return;

    const parent = menus[selectedMenuIndex];
    if (!parent) return;

    const currentSubMenus = parent.subMenus ? [...parent.subMenus] : [];

    if (activeView === 'add_submenu') {
      const newSub: SubMenuItemConfig = {
        id: subFormId || 'sub-' + Date.now(),
        label: subFormLabel.trim(),
        title: subFormTitle.trim() || subFormLabel.trim(),
        description: subFormDesc.trim(),
        content: subFormContent.trim(),
      };
      currentSubMenus.push(newSub);
    } else if (activeView === 'edit_submenu' && selectedSubMenuIndex >= 0) {
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

    setMenus(updated);
    onSaveMenus(updated);
    setActiveView('submenus');
    try {
      confetti({ particleCount: 25, spread: 45, origin: { y: 0.7 } });
    } catch {}
  };

  // DELETE SUBMENU
  const handleDeleteSubMenu = (subId: string) => {
    const parent = menus[selectedMenuIndex];
    if (!parent || !parent.subMenus) return;

    const updatedSubMenus = parent.subMenus.filter((s) => s.id !== subId);
    const updated = [...menus];
    updated[selectedMenuIndex] = {
      ...parent,
      subMenus: updatedSubMenus,
    };

    setMenus(updated);
    onSaveMenus(updated);
    setConfirmDeleteSubId(null);
  };

  // RESET MENUS TO DEFAULT
  const handleResetToDefault = () => {
    const defaultCopy = JSON.parse(JSON.stringify(INITIAL_NAV_MENUS));
    setMenus(defaultCopy);
    onResetMenusToDefault();
    setActiveView('list');
    try {
      confetti({ particleCount: 40, spread: 60, origin: { y: 0.6 } });
    } catch {}
  };

  const selectedMenu = menus[selectedMenuIndex];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-slate-950/70 backdrop-blur-xs overflow-y-auto animate-in fade-in duration-200">
      <div className="bg-white rounded-3xl shadow-2xl border-2 border-emerald-300 w-full max-w-4xl max-h-[92vh] flex flex-col overflow-hidden my-4">
        {/* Header */}
        <div className="bg-gradient-to-r from-emerald-700 via-teal-700 to-cyan-800 text-white p-4 sm:p-5 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-white/15 rounded-2xl backdrop-blur-xs shadow-xs border border-white/20">
              <Menu className="w-5 h-5 text-amber-300" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-extrabold text-base sm:text-lg">
                  Kelola Menu Utama & Sub Menu Portal
                </h3>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-400 text-slate-950 uppercase">
                  Akses Pengurus
                </span>
              </div>
              <p className="text-xs text-emerald-100 mt-0.5">
                Tambah, edit, hapus, sembunyikan menu utama, sub menu, serta sesuaikan judul & deskripsi halaman.
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

        {/* Modal Breadcrumbs / Sub-nav */}
        <div className="p-3 bg-emerald-50/80 border-b border-emerald-200/80 flex items-center justify-between gap-2 shrink-0 text-xs">
          <div className="flex items-center gap-1.5 font-bold text-slate-700">
            <button
              type="button"
              onClick={() => setActiveView('list')}
              className={`hover:text-emerald-700 transition-colors cursor-pointer ${
                activeView === 'list' ? 'text-emerald-800 underline' : ''
              }`}
            >
              Daftar Menu Utama ({menus.length})
            </button>
            {activeView !== 'list' && (
              <>
                <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
                <span className="text-emerald-800">
                  {activeView === 'add_menu' && '+ Tambah Menu Utama Baru'}
                  {activeView === 'edit_menu' && `Edit Menu: ${selectedMenu?.label || ''}`}
                  {activeView === 'submenus' && `Sub Menu: ${selectedMenu?.label || ''}`}
                  {activeView === 'add_submenu' && `+ Tambah Sub Menu di ${selectedMenu?.label || ''}`}
                  {activeView === 'edit_submenu' && `Edit Sub Menu`}
                </span>
              </>
            )}
          </div>
          {saveSuccessNotice && (
            <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-full">
              <Check className="w-3.5 h-3.5 text-emerald-600" />
              <span>Perubahan Disimpan!</span>
            </span>
          )}
        </div>

        {/* Body Content */}
        <div className="p-4 sm:p-6 overflow-y-auto space-y-5 flex-1">
          {/* VIEW 1: DAFTAR MENU UTAMA */}
          {activeView === 'list' && (
            <div className="space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-2 border-b border-slate-100">
                <div>
                  <h4 className="font-extrabold text-sm sm:text-base text-slate-900">
                    Struktur Menu Utama & Sub Menu Aktif
                  </h4>
                  <p className="text-xs text-slate-500">
                    Menu di bawah ini tampil di Navbar bagian atas dan navigasi mobile.
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
                    onClick={handleResetToDefault}
                    className="flex items-center gap-1 px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold transition-colors cursor-pointer"
                    title="Kembalikan struktur menu bawaan sistem"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    <span>Reset Bawaan</span>
                  </button>
                </div>
              </div>

              {/* Menu List Cards */}
              <div className="space-y-3">
                {menus.map((item, idx) => {
                  const IconComp =
                    AVAILABLE_ICONS.find((i) => i.name === item.icon)?.icon || Layers;
                  const isHidden = item.isHidden;
                  const subCount = item.subMenus?.length || 0;

                  return (
                    <div
                      key={item.id}
                      className={`p-4 rounded-2xl border transition-all ${
                        isHidden
                          ? 'bg-slate-50/80 border-slate-200 opacity-60'
                          : 'bg-white border-slate-200 shadow-2xs hover:border-emerald-300'
                      }`}
                    >
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <div className="flex items-start gap-3">
                          <div className="p-2.5 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 text-white shadow-2xs shrink-0 mt-0.5">
                            <IconComp className="w-4 h-4" />
                          </div>
                          <div>
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-mono text-xs font-bold text-slate-400">
                                #{idx + 1}
                              </span>
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
                                  Kustom
                                </span>
                              )}
                              {isHidden && (
                                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-200 text-slate-700">
                                  Disembunyikan
                                </span>
                              )}
                            </div>
                            <div className="mt-1 space-y-0.5">
                              <div className="text-xs font-semibold text-emerald-800">
                                Judul Halaman: <span>{item.title}</span>
                              </div>
                              <p className="text-xs text-slate-500 line-clamp-2 leading-relaxed">
                                Deskripsi: {item.description || '-'}
                              </p>
                            </div>
                          </div>
                        </div>

                        {/* Action buttons */}
                        <div className="flex items-center gap-1.5 self-end sm:self-auto shrink-0">
                          {/* Kelola Submenu Button */}
                          <button
                            type="button"
                            onClick={() => handleOpenSubMenusManager(idx)}
                            className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-indigo-50 hover:bg-indigo-100 text-indigo-800 border border-indigo-200 text-xs font-bold transition-colors cursor-pointer"
                            title="Kelola Sub Menu di bawah menu ini"
                          >
                            <Layers className="w-3.5 h-3.5 text-indigo-600" />
                            <span>Sub Menu ({subCount})</span>
                          </button>

                          {/* Toggle Hide */}
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

                          {/* Edit Menu */}
                          <button
                            type="button"
                            onClick={() => handleOpenEditMainMenu(idx)}
                            className="p-2 rounded-xl bg-teal-50 hover:bg-teal-100 text-teal-800 border border-teal-200 text-xs font-bold transition-colors cursor-pointer"
                            title="Edit Judul, Deskripsi & Label Menu"
                          >
                            <Edit2 className="w-4 h-4 text-teal-700" />
                          </button>

                          {/* Delete Menu */}
                          {confirmDeleteMenuId === item.id ? (
                            <div className="flex items-center gap-1">
                              <button
                                type="button"
                                onClick={() => handleDeleteMainMenu(item.id)}
                                className="px-2 py-1 bg-rose-600 text-white rounded-lg text-xs font-bold cursor-pointer"
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

                      {/* Preview Submenus list if any */}
                      {item.subMenus && item.subMenus.length > 0 && (
                        <div className="mt-3 pt-3 border-t border-slate-100 flex flex-wrap items-center gap-2">
                          <span className="text-[11px] font-bold text-slate-400">Sub Menu:</span>
                          {item.subMenus.map((sub) => (
                            <span
                              key={sub.id}
                              className="inline-flex items-center gap-1 text-[11px] font-semibold px-2.5 py-1 rounded-lg bg-slate-100 text-slate-800"
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

          {/* VIEW 2: FORM TAMBAH / EDIT MENU UTAMA */}
          {(activeView === 'add_menu' || activeView === 'edit_menu') && (
            <form onSubmit={handleSaveMainMenu} className="space-y-4">
              <div className="p-3.5 rounded-2xl bg-emerald-50 border border-emerald-200 text-xs text-emerald-900 flex items-center justify-between">
                <div>
                  <strong>
                    {activeView === 'add_menu'
                      ? 'Formulir Tambah Menu Utama Baru'
                      : `Edit Menu Utama: ${menuFormLabel || ''}`}
                  </strong>
                  <p className="text-[11px] text-emerald-800 mt-0.5">
                    Nama menu akan muncul di Navbar atas, dan Judul serta Deskripsi akan muncul di kepala halaman saat menu dibuka.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setActiveView('list')}
                  className="px-3 py-1.5 bg-white border border-emerald-300 text-emerald-800 rounded-xl font-bold cursor-pointer hover:bg-emerald-100"
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
                    placeholder="Contoh: Agenda Rapat, Inventaris Gang, Surat..."
                    value={menuFormLabel}
                    onChange={(e) => setMenuFormLabel(e.target.value)}
                    className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl focus:ring-2 focus:ring-emerald-500 font-bold"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Singkatan untuk Layar HP (Opsional)
                  </label>
                  <input
                    type="text"
                    placeholder="Singkatan (1–2 kata)"
                    value={menuFormShortLabel}
                    onChange={(e) => setMenuFormShortLabel(e.target.value)}
                    className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Judul Halaman Menu (Title) *
                </label>
                <input
                  type="text"
                  required
                  placeholder="Judul besar yang tampil di bagian atas halaman saat menu diklik..."
                  value={menuFormTitle}
                  onChange={(e) => setMenuFormTitle(e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl focus:ring-2 focus:ring-emerald-500 font-bold"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Deskripsi / Penjelasan Halaman (Description)
                </label>
                <textarea
                  rows={2}
                  placeholder="Keterangan atau penjelasan mengenai isi dan tujuan dari halaman menu ini..."
                  value={menuFormDesc}
                  onChange={(e) => setMenuFormDesc(e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl focus:ring-2 focus:ring-emerald-500 leading-relaxed"
                />
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
                            : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
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

              {/* Custom Page Content Area (for custom created pages) */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Isi Konten / Informasi Halaman (Teks Bebas / Panduan Warga)
                </label>
                <textarea
                  rows={4}
                  placeholder="Tuliskan informasi, peraturan, jadwal, pedoman, atau catatan yang ingin ditampilkan kepada warga di halaman ini..."
                  value={menuFormContent}
                  onChange={(e) => setMenuFormContent(e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl focus:ring-2 focus:ring-emerald-500 font-sans leading-relaxed"
                />
                <span className="text-[10px] text-slate-400 block mt-1">
                  *Untuk menu bawaan sistem (seperti Pengumuman, Kas, Baksos, Warga, Tunggakan), modul otomatis tetap berjalan dan judul/deskripsinya menggunakan inputan di atas.
                </span>
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setActiveView('list')}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="flex items-center gap-1.5 px-5 py-2.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white rounded-xl text-xs font-bold shadow-md cursor-pointer"
                >
                  <Save className="w-4 h-4" />
                  <span>Simpan Pengaturan Menu</span>
                </button>
              </div>
            </form>
          )}

          {/* VIEW 3: DAFTAR SUB MENU UNTUK MENU TERPILIH */}
          {activeView === 'submenus' && selectedMenu && (
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
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold cursor-pointer shadow-xs"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Tambah Sub Menu</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveView('list')}
                    className="px-3 py-1.5 bg-white border border-indigo-200 text-indigo-800 rounded-xl text-xs font-bold cursor-pointer hover:bg-indigo-100"
                  >
                    Daftar Menu Utama
                  </button>
                </div>
              </div>

              {/* Submenu List Cards */}
              {!selectedMenu.subMenus || selectedMenu.subMenus.length === 0 ? (
                <div className="p-8 text-center bg-slate-50 rounded-2xl border border-dashed border-slate-300 space-y-2">
                  <Layers className="w-8 h-8 text-slate-400 mx-auto" />
                  <p className="text-xs font-bold text-slate-700">
                    Belum ada Sub Menu di bawah menu "{selectedMenu.label}".
                  </p>
                  <p className="text-[11px] text-slate-500 max-w-sm mx-auto">
                    Anda dapat menambahkan sub menu seperti modul rincian, formulir, atau halaman pelengkap.
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
                          Judul: <span>{sub.title}</span>
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
                              className="px-2 py-1 bg-rose-600 text-white rounded-lg text-xs font-bold cursor-pointer"
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

          {/* VIEW 4: FORM TAMBAH / EDIT SUB MENU */}
          {(activeView === 'add_submenu' || activeView === 'edit_submenu') && selectedMenu && (
            <form onSubmit={handleSaveSubMenu} className="space-y-4">
              <div className="p-3.5 rounded-2xl bg-indigo-50 border border-indigo-200 text-xs text-indigo-950 flex items-center justify-between">
                <div>
                  <strong>
                    {activeView === 'add_submenu'
                      ? `Tambah Sub Menu Baru untuk: ${selectedMenu.label}`
                      : `Edit Sub Menu: ${subFormLabel}`}
                  </strong>
                  <p className="text-[11px] text-indigo-800 mt-0.5">
                    Sub menu ini akan menjadi pilihan navigasi turunan di dalam halaman {selectedMenu.label}.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setActiveView('submenus')}
                  className="px-3 py-1.5 bg-white border border-indigo-200 text-indigo-800 rounded-xl font-bold cursor-pointer hover:bg-indigo-100"
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
                  placeholder="Contoh: Rekap Tahunan, Jadwal Ronda, SOP..."
                  value={subFormLabel}
                  onChange={(e) => setSubFormLabel(e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500 font-bold"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Judul Halaman Sub Menu (Title) *
                </label>
                <input
                  type="text"
                  required
                  placeholder="Judul saat sub menu ini aktif..."
                  value={subFormTitle}
                  onChange={(e) => setSubFormTitle(e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500 font-bold"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Deskripsi Sub Menu (Description)
                </label>
                <textarea
                  rows={2}
                  placeholder="Penjelasan ringkas mengenai sub menu ini..."
                  value={subFormDesc}
                  onChange={(e) => setSubFormDesc(e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500 leading-relaxed"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Konten / Teks Penjelasan Sub Menu (Opsional)
                </label>
                <textarea
                  rows={4}
                  placeholder="Tuliskan catatan, penjelasan rinci, atau panduan untuk sub menu ini..."
                  value={subFormContent}
                  onChange={(e) => setSubFormContent(e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500 font-sans leading-relaxed"
                />
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setActiveView('submenus')}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl cursor-pointer"
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

        {/* Footer */}
        <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between shrink-0">
          <span className="text-[11px] text-slate-500">
            Perubahan menu dan sub menu langsung tersimpan dan otomatis tersinkron ke semua perangkat.
          </span>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-slate-800 hover:bg-slate-900 text-white font-bold text-xs rounded-xl cursor-pointer shadow-xs"
          >
            Selesai & Tutup
          </button>
        </div>
      </div>
    </div>
  );
};
