import React, { useState } from 'react';
import {
  Edit2,
  Headphones,
  MessageCircle,
  Monitor,
  Phone,
  Plus,
  Settings,
  Smartphone,
  Tablet,
  Trash2,
  User,
  X,
} from 'lucide-react';
import { CommitteeContact, SiteConfig } from '../types';
import { openWhatsAppShare } from '../utils/helpers';
import { useDeviceView } from '../hooks/useDeviceView';

interface CommitteesFooterProps {
  config: SiteConfig;
  committees: CommitteeContact[];
  isAdmin: boolean;
  showContactSection?: boolean;
  onAddCommittee: (name: string, role: string, phone: string) => void;
  onEditCommittee: (contact: CommitteeContact) => void;
  onDeleteCommittee: (id: string) => void;
  onOpenLogin: () => void;
  onOpenConfigModal?: () => void;
}

export const CommitteesFooter: React.FC<CommitteesFooterProps> = ({
  config,
  committees,
  isAdmin,
  showContactSection = true,
  onAddCommittee,
  onEditCommittee,
  onDeleteCommittee,
  onOpenLogin,
  onOpenConfigModal,
}) => {
  const { deviceLabel, isHandphone, isTablet } = useDeviceView();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingCommittee, setEditingCommittee] = useState<CommitteeContact | null>(null);
  const [name, setName] = useState('');
  const [role, setRole] = useState('');
  const [phone, setPhone] = useState('');
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  const handleOpenAdd = () => {
    setEditingCommittee(null);
    setName('');
    setRole('Pengurus Gang');
    setPhone('');
    setIsModalOpen(true);
  };

  const handleOpenEdit = (contact: CommitteeContact) => {
    setEditingCommittee(contact);
    setName(contact.name);
    setRole((contact.role || 'Pengurus Gang').replace(/Lingkungan/gi, 'Gang'));
    setPhone(contact.phone);
    setIsModalOpen(true);
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !phone.trim()) return;

    if (editingCommittee) {
      onEditCommittee({
        ...editingCommittee,
        name: name.trim(),
        role: role.trim() || 'Pengurus Gang',
        phone: phone.trim(),
      });
    } else {
      onAddCommittee(
        name.trim(),
        role.trim() || 'Pengurus Gang',
        phone.trim()
      );
    }
    setIsModalOpen(false);
  };

  const handleChatWA = (contact: CommitteeContact) => {
    const text = isAdmin
      ? `Halo ${contact.name} (${contact.role}), koordinasi pengurus Gang Mandor Blok K2/25 - K3/24...`
      : `Halo ${contact.name} (${contact.role}), saya warga Gang Mandor Blok K2/25 - K3/24 ingin bertanya / berkoordinasi terkait pelayanan warga...`;
    openWhatsAppShare(text, contact.phone);
  };

  const sectionTitle =
    config.publicContactTitle !== undefined
      ? config.publicContactTitle
      : 'Kontak WhatsApp Langsung Pelayanan Publik Gang Mandor';
  const sectionDesc =
    config.publicContactDescription !== undefined
      ? config.publicContactDescription
      : 'Daftar kontak pengurus dan layanan masyarakat Gang Mandor Blok K2/25 - K3/24 untuk kebutuhan administrasi, keamanan, dan kebersihan.';

  return (
    <footer id="kontak-pelayanan-publik" className="mt-12 bg-gradient-to-b from-teal-50/80 via-emerald-50/60 to-cyan-50/80 border-t-2 border-emerald-200 scroll-mt-20">
      <div className="max-w-7xl mx-auto px-4 py-6 sm:py-8">
        {/* Public Service Contacts Section - ONLY displayed when showContactSection is true (Papan Pengumuman) */}
        {showContactSection && (
          <div>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-3">
              <div>
                {sectionTitle && (
                  <div className="flex items-center gap-2">
                  <div className="p-1.5 bg-emerald-100 text-emerald-800 rounded-lg">
                    <Headphones className="w-4 h-4" />
                  </div>
                  <h3 className="text-sm font-bold text-slate-900">
                    {sectionTitle}
                  </h3>
                </div>
              )}
              {sectionDesc && (
                <p className="text-[11px] text-slate-500 mt-0.5 leading-relaxed">
                  {sectionDesc}
                </p>
              )}
            </div>

            {isAdmin && (
              <div className="flex items-center gap-1.5 shrink-0">
                <button
                  type="button"
                  onClick={handleOpenAdd}
                  className="flex items-center gap-1 px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-[11px] font-semibold shadow-2xs cursor-pointer"
                >
                  <Plus className="w-3 h-3" />
                  <span>Tambah Kontak</span>
                </button>
                {onOpenConfigModal && (
                  <button
                    type="button"
                    onClick={onOpenConfigModal}
                    className="p-1.5 text-slate-500 hover:text-emerald-700 hover:bg-slate-100 rounded-lg cursor-pointer"
                    title="Edit / Hapus Judul & Deskripsi Kontak Pelayanan"
                  >
                    <Settings className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            )}
          </div>

          {/* 2–3 Columns Across and Continue Downward (Font Lebih Kecil) */}
          {committees.length === 0 ? (
            <div className="p-4 text-center text-[11px] text-slate-400 border border-slate-200 rounded-xl bg-slate-50/40">
              Belum ada kontak pelayanan publik.
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
              {committees.map((contact, idx) => {
                const avatarColors = [
                  'from-emerald-500 to-teal-600',
                  'from-cyan-500 to-blue-600',
                  'from-purple-500 to-indigo-600',
                  'from-amber-500 to-orange-600',
                  'from-rose-500 to-pink-600',
                ];
                const avatarGradient = avatarColors[idx % avatarColors.length];
                return (
                  <div
                    key={contact.id}
                    className="px-3.5 py-2.5 bg-white hover:bg-emerald-50/30 border border-slate-200 rounded-xl shadow-2xs transition-colors flex items-center justify-between gap-2.5"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div
                        className={`w-7 h-7 rounded-lg bg-gradient-to-br ${avatarGradient} text-white flex items-center justify-center shrink-0 shadow-2xs`}
                      >
                        <User className="w-3.5 h-3.5 text-white" />
                      </div>
                      <div className="min-w-0">
                        <div className="font-bold text-xs text-slate-800 truncate">
                          {contact.name}
                        </div>
                        <div className="text-[11px] font-medium text-emerald-700 truncate">
                          {(contact.role || 'Pengurus Gang').replace(/Lingkungan/gi, 'Gang')}
                        </div>
                        <div className="text-[11px] text-slate-500 font-mono flex items-center gap-1 mt-0.5 tabular-nums">
                          <Phone className="w-2.5 h-2.5 text-emerald-600 shrink-0" />
                          <span>{contact.phone}</span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-1 shrink-0">
                      {/* Direct WhatsApp button available for all residents and admins */}
                      <button
                        type="button"
                        onClick={() => handleChatWA(contact)}
                        className="flex items-center gap-1 py-1.5 px-2.5 bg-gradient-to-r from-emerald-600 via-teal-600 to-green-600 hover:from-emerald-500 hover:to-green-500 text-white rounded-xl text-xs font-bold shadow-2xs transition-all cursor-pointer whitespace-nowrap min-h-[32px]"
                        title={`Hubungi ${contact.name} (${contact.role}) via WhatsApp`}
                      >
                        <MessageCircle className="w-3.5 h-3.5 text-white" />
                        <span>Chat WA</span>
                      </button>

                      {isAdmin && (
                        <>
                          <button
                            type="button"
                            onClick={() => handleOpenEdit(contact)}
                            className="p-1.5 text-slate-400 hover:text-emerald-700 hover:bg-slate-100 rounded-lg cursor-pointer transition-colors"
                            title="Edit Kontak & Jabatan"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          {deleteConfirmId === contact.id ? (
                            <div className="flex items-center gap-1">
                              <button
                                type="button"
                                onClick={() => {
                                  onDeleteCommittee(contact.id);
                                  setDeleteConfirmId(null);
                                }}
                                className="px-1.5 py-0.5 bg-rose-600 text-white rounded text-[10px] font-bold cursor-pointer"
                              >
                                Hapus
                              </button>
                              <button
                                type="button"
                                onClick={() => setDeleteConfirmId(null)}
                                className="px-1.5 py-0.5 bg-slate-100 text-slate-600 rounded text-[10px] cursor-pointer"
                              >
                                Batal
                              </button>
                            </div>
                          ) : (
                            <button
                              type="button"
                              onClick={() => setDeleteConfirmId(contact.id)}
                              className="p-1 text-slate-400 hover:text-rose-600 rounded cursor-pointer"
                              title="Hapus Kontak"
                            >
                              <Trash2 className="w-3 h-3" />
                            </button>
                          )}
                        </>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Bottom Copyright & Discreet Admin Access Link */}
        <div className="mt-8 pt-4 border-t border-slate-200/80 flex flex-col sm:flex-row items-center justify-between gap-3 text-[11px] text-slate-500">
          <div className="flex flex-wrap items-center gap-2">
            <p>
              © {new Date().getFullYear()} {config.title || 'Portal Warga Gang Mandor'}.
            </p>
            {config.footerCopyrightText !== '' && (
              <span>
                • {config.footerCopyrightText || 'Rukun Tetangga & Warga Blok K2/25 s/d K3/24'}
              </span>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {/* Real-time responsive device indicator */}
            <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white border border-teal-200 text-teal-900 text-[11px] font-bold shadow-2xs">
              {isHandphone ? (
                <Smartphone className="w-3.5 h-3.5 text-emerald-600" />
              ) : isTablet ? (
                <Tablet className="w-3.5 h-3.5 text-cyan-600" />
              ) : (
                <Monitor className="w-3.5 h-3.5 text-indigo-600" />
              )}
              <span>Tampilan Otomatis: {deviceLabel}</span>
            </div>

            {!isAdmin && (
              <button
                type="button"
                onClick={onOpenLogin}
                className="hover:text-slate-800 transition-colors cursor-pointer text-[11px] font-semibold"
              >
                Akses Pengurus
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Modal Add / Edit Public Service Contact */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs">
          <div className="bg-white rounded-2xl shadow-xl border border-slate-200 w-full max-w-sm overflow-hidden">
            <div className="bg-gradient-to-r from-emerald-600 to-teal-700 p-4 text-white flex justify-between items-center">
              <h4 className="font-bold text-sm">
                {editingCommittee ? 'Edit Kontak Pelayanan Publik' : 'Tambah Kontak Pelayanan Publik'}
              </h4>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="text-white/80 hover:text-white cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={handleSave} className="p-5 space-y-3.5">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Nama Lengkap
                </label>
                <input
                  type="text"
                  required
                  placeholder="Misal: Bpk. Bambang Sutrisno"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                  autoFocus
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Jabatan / Posisi Pelayanan
                </label>
                <input
                  type="text"
                  required
                  placeholder="Misal: Ketua Koordinator, Bendahara Kas, Sie Keamanan..."
                  value={role}
                  onChange={(e) => setRole(e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Nomor HP / WhatsApp
                </label>
                <input
                  type="text"
                  required
                  placeholder="081234567890"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="w-full px-3 py-2 text-xs font-mono border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-100 rounded-lg cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 text-xs bg-emerald-600 hover:bg-emerald-700 text-white font-semibold rounded-lg cursor-pointer"
                >
                  Simpan Kontak
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </footer>
  );
};
