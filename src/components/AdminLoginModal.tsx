import React, { useState } from 'react';
import { KeyRound, Lock, ShieldCheck, X } from 'lucide-react';

interface AdminLoginModalProps {
  isOpen: boolean;
  onClose: () => void;
  onLogin: (password: string) => boolean;
  isAdmin: boolean;
  onChangePassword: (newPass: string) => void;
  onLogoutAndWipe: () => void;
}

export const AdminLoginModal: React.FC<AdminLoginModalProps> = ({
  isOpen,
  onClose,
  onLogin,
  isAdmin,
  onChangePassword,
  onLogoutAndWipe,
}) => {
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isChangingPass, setIsChangingPass] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [passChangedSuccess, setPassChangedSuccess] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    const success = onLogin(password);
    if (success) {
      setPassword('');
      onClose();
    } else {
      setError('Kata sandi salah. Silakan periksa kembali.');
    }
  };

  const handleChangePassSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPassword || newPassword.length < 4) {
      setError('Kata sandi baru minimal 4 karakter.');
      return;
    }
    onChangePassword(newPassword);
    setPassChangedSuccess(true);
    setNewPassword('');
    setTimeout(() => {
      setPassChangedSuccess(false);
      setIsChangingPass(false);
    }, 1500);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-100 w-full max-w-md overflow-hidden transform transition-all">
        {/* Header */}
        <div className="bg-gradient-to-r from-emerald-600 to-teal-700 p-5 text-white flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-white/10">
              <Lock className="w-5 h-5 text-emerald-200" />
            </div>
            <div>
              <h2 className="font-bold text-base">Akses Khusus Pengurus Gang</h2>
              <p className="text-xs text-emerald-100">Kredensial Privat Pengurus Blok K2/25 - K3/24</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-emerald-100 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6">
          {isAdmin ? (
            <div className="space-y-4">
              <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center gap-3 text-emerald-800 text-sm">
                <ShieldCheck className="w-5 h-5 text-emerald-600 shrink-0" />
                <div>
                  <p className="font-semibold">Anda sedang dalam Mode Pengurus Aktif</p>
                  <p className="text-xs text-emerald-700">
                    Semua fitur edit, hapus, tambah data kas, iuran, warga, dan baksos dapat diakses.
                  </p>
                </div>
              </div>

              {!isChangingPass ? (
                <div className="space-y-2 pt-2">
                  <button
                    onClick={() => setIsChangingPass(true)}
                    className="w-full flex items-center justify-center gap-2 px-4 py-2.5 border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-xl text-sm font-medium transition-colors cursor-pointer"
                  >
                    <KeyRound className="w-4 h-4 text-slate-500" />
                    <span>Ubah Kata Sandi Pengurus</span>
                  </button>
                  <button
                    onClick={() => {
                      onLogoutAndWipe();
                      onClose();
                    }}
                    className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-xl text-sm font-semibold transition-colors cursor-pointer"
                  >
                    <span>Keluar & Bersihkan Riwayat Sesi</span>
                  </button>
                </div>
              ) : (
                <form onSubmit={handleChangePassSubmit} className="space-y-3 pt-2">
                  <h3 className="text-sm font-semibold text-slate-800">Ganti Kata Sandi Baru</h3>
                  <input
                    type="password"
                    placeholder="Masukkan kata sandi baru..."
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    autoFocus
                  />
                  {passChangedSuccess && (
                    <p className="text-xs text-emerald-600 font-medium">Kata sandi berhasil diperbarui!</p>
                  )}
                  <div className="flex gap-2">
                    <button
                      type="submit"
                      className="flex-1 py-2 bg-emerald-600 text-white text-xs font-semibold rounded-lg hover:bg-emerald-700 transition-colors cursor-pointer"
                    >
                      Simpan Sandi
                    </button>
                    <button
                      type="button"
                      onClick={() => setIsChangingPass(false)}
                      className="px-3 py-2 text-xs text-slate-600 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
                    >
                      Batal
                    </button>
                  </div>
                </form>
              )}
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Masukkan Kata Sandi Pengurus:
                </label>
                <div className="relative">
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••••"
                    autoFocus
                    className="w-full pl-3.5 pr-10 py-2.5 text-sm border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 tracking-widest text-slate-800"
                  />
                </div>
                {error && <p className="text-xs text-rose-600 mt-1.5 font-medium">{error}</p>}
                <p className="text-[11px] text-slate-400 mt-2">
                  * Akses ini terlindungi. Sandi awal terkonfigurasi secara aman untuk administrator Gang Mandor.
                </p>
              </div>

              <div className="flex items-center gap-2 pt-2">
                <button
                  type="submit"
                  className="flex-1 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-sm rounded-xl shadow-sm transition-all cursor-pointer"
                >
                  Buka Kunci Akses
                </button>
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2.5 text-slate-600 hover:bg-slate-100 rounded-xl text-sm font-medium transition-colors cursor-pointer"
                >
                  Tutup
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};
