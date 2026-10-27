import React, { useState } from 'react';
import {
  BookOpen,
  Calendar,
  CheckCircle2,
  Edit2,
  FileText,
  Info,
  Layers,
  Sparkles,
} from 'lucide-react';
import { MenuItemConfig, SiteConfig, SubMenuItemConfig } from '../types';

interface CustomMenuSectionProps {
  config: SiteConfig;
  menu: MenuItemConfig;
  isAdmin: boolean;
  onOpenManageMenus: () => void;
}

export const CustomMenuSection: React.FC<CustomMenuSectionProps> = ({
  config,
  menu,
  isAdmin,
  onOpenManageMenus,
}) => {
  const subMenus = menu.subMenus || [];
  const [activeSubId, setActiveSubId] = useState<string>(
    subMenus.length > 0 ? subMenus[0].id : ''
  );

  const activeSub: SubMenuItemConfig | undefined = subMenus.find(
    (s) => s.id === activeSubId
  );

  const currentTitle = activeSub?.title || menu.title || menu.label;
  const currentDesc = activeSub?.description || menu.description;
  const currentContent = activeSub?.content || menu.content;

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-teal-700 via-emerald-700 to-indigo-800 text-white rounded-2xl p-6 shadow-md border-b-2 border-emerald-400 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1.5">
          <div className="flex items-center gap-2">
            <div className="p-2 bg-white/20 rounded-xl backdrop-blur-xs text-amber-300 shadow-xs">
              <Layers className="w-5 h-5" />
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-lg sm:text-xl font-black text-white tracking-tight">
                {currentTitle}
              </h2>
              {menu.isCustom && (
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-400 text-slate-950 uppercase">
                  Menu Warga
                </span>
              )}
            </div>
          </div>
          {currentDesc && (
            <p className="text-xs sm:text-sm text-emerald-100/90 max-w-3xl leading-relaxed">
              {currentDesc}
            </p>
          )}
        </div>

        {isAdmin && (
          <button
            type="button"
            onClick={onOpenManageMenus}
            className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold bg-amber-400 hover:bg-amber-300 text-slate-950 rounded-xl shadow-xs transition-colors cursor-pointer shrink-0 self-start md:self-auto"
            title="Edit Judul, Deskripsi & Isi Menu ini"
          >
            <Edit2 className="w-3.5 h-3.5" />
            <span>Edit Judul & Menu Ini</span>
          </button>
        )}
      </div>

      {/* Sub Menu Switcher Tabs if any */}
      {subMenus.length > 0 && (
        <div className="p-1.5 bg-gradient-to-r from-emerald-100/90 via-teal-100/90 to-indigo-100/90 rounded-2xl border-2 border-teal-300/80 shadow-xs flex flex-wrap items-center gap-1.5">
          {subMenus.map((sub) => {
            const isActive = activeSubId === sub.id;
            return (
              <button
                key={sub.id}
                type="button"
                onClick={() => setActiveSubId(sub.id)}
                className={`px-4 py-2 rounded-xl text-xs font-extrabold transition-all cursor-pointer flex items-center gap-1.5 ${
                  isActive
                    ? 'bg-gradient-to-r from-teal-600 to-emerald-600 text-white shadow-md shadow-teal-600/30 ring-2 ring-teal-300/60'
                    : 'bg-white/80 hover:bg-white text-slate-700 border border-slate-200'
                }`}
              >
                <Layers className="w-3.5 h-3.5 text-amber-300" />
                <span>{sub.label}</span>
              </button>
            );
          })}
        </div>
      )}

      {/* Main Content Area */}
      <div className="bg-white rounded-2xl border border-slate-200/90 shadow-xs p-6 space-y-4">
        {currentContent ? (
          <div className="space-y-4 text-slate-800 text-sm leading-relaxed whitespace-pre-wrap font-sans">
            <div className="p-4 rounded-xl bg-slate-50 border border-slate-200">
              {currentContent}
            </div>
          </div>
        ) : (
          <div className="p-10 text-center bg-slate-50 rounded-2xl border border-dashed border-slate-300 space-y-2">
            <FileText className="w-10 h-10 text-slate-400 mx-auto" />
            <h4 className="font-bold text-sm text-slate-700">
              Halaman {menu.label}
            </h4>
            <p className="text-xs text-slate-500 max-w-md mx-auto">
              Belum ada teks rincian khusus yang ditambahkan pada menu ini. Pengurus dapat menambahkan konten atau panduan warga melalui tombol "Edit Judul & Menu Ini" di atas.
            </p>
          </div>
        )}
      </div>
    </div>
  );
};
