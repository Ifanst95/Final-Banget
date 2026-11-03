import React, { useState, useRef } from 'react';
import {
  MessageCircle,
  X,
  RotateCcw,
  Save,
  Check,
  Copy,
  Sparkles,
  Info,
  Layers,
  Send,
  Eye,
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { SiteConfig, ResidentHouse } from '../types';
import {
  DEFAULT_WA_ARREARS_SINGLE_TEMPLATE,
  DEFAULT_WA_ARREARS_BROADCAST_TEMPLATE,
  renderArrearsSingleWhatsAppMessage,
  renderArrearsBroadcastWhatsAppMessage,
  formatRupiah,
} from '../utils/helpers';
import { TREASURER_BANK } from './ArrearsSection';

interface EditWaTemplateModalProps {
  isOpen: boolean;
  onClose: () => void;
  config: SiteConfig;
  onSave: (newConfig: Partial<SiteConfig>) => void;
  sampleHouse?: ResidentHouse | null;
}

export const EditWaTemplateModal: React.FC<EditWaTemplateModalProps> = ({
  isOpen,
  onClose,
  config,
  onSave,
  sampleHouse,
}) => {
  const [activeTab, setActiveTab] = useState<'single' | 'broadcast'>('single');
  const [singleTemplate, setSingleTemplate] = useState<string>(
    config.waArrearsMessageTemplate || DEFAULT_WA_ARREARS_SINGLE_TEMPLATE
  );
  const [broadcastTemplate, setBroadcastTemplate] = useState<string>(
    config.waArrearsBroadcastTemplate || DEFAULT_WA_ARREARS_BROADCAST_TEMPLATE
  );
  const [copiedPreview, setCopiedPreview] = useState(false);
  const singleTextareaRef = useRef<HTMLTextAreaElement | null>(null);
  const broadcastTextareaRef = useRef<HTMLTextAreaElement | null>(null);

  if (!isOpen) return null;

  // Insert tag helper into textarea at current cursor position
  const insertTag = (tag: string, target: 'single' | 'broadcast') => {
    const textarea = target === 'single' ? singleTextareaRef.current : broadcastTextareaRef.current;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const currentVal = target === 'single' ? singleTemplate : broadcastTemplate;
    const newVal = currentVal.substring(0, start) + tag + currentVal.substring(end);

    if (target === 'single') {
      setSingleTemplate(newVal);
    } else {
      setBroadcastTemplate(newVal);
    }

    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(start + tag.length, start + tag.length);
    }, 50);
  };

  const handleResetToDefault = () => {
    if (activeTab === 'single') {
      setSingleTemplate(DEFAULT_WA_ARREARS_SINGLE_TEMPLATE);
    } else {
      setBroadcastTemplate(DEFAULT_WA_ARREARS_BROADCAST_TEMPLATE);
    }
  };

  const handleSave = () => {
    onSave({
      waArrearsMessageTemplate: singleTemplate.trim(),
      waArrearsBroadcastTemplate: broadcastTemplate.trim(),
    });
    try {
      confetti({ particleCount: 50, spread: 60, origin: { y: 0.6 } });
    } catch {}
    onClose();
  };

  // Preview computations
  const samplePayer = sampleHouse
    ? sampleHouse.duesHeadNameOverride || sampleHouse.headName
    : 'Bpk. Muhidin';
  const sampleBlok = sampleHouse ? sampleHouse.blockNumber : 'K2/25';

  const singlePreviewText = renderArrearsSingleWhatsAppMessage({
    template: singleTemplate,
    payerName: samplePayer,
    blockNumber: sampleBlok,
    monthStr: config.duesCurrentMonth || 'Oktober 2026',
    duesArrears: config.duesAmountPerMonth || 50000,
    baksosFineArrears: 10000,
    previousArrears: sampleHouse?.previousArrears || 25000,
    totalArrears: (config.duesAmountPerMonth || 50000) + 10000 + (sampleHouse?.previousArrears || 25000),
    previousArrearsNote: sampleHouse?.previousArrearsNote || 'Tunggakan kas periode sebelumnya',
    previousBaksosArrearsNote: '',
    bankName: TREASURER_BANK.bankName,
    accountNumber: TREASURER_BANK.accountNumber,
    accountName: `${TREASURER_BANK.accountName} (${TREASURER_BANK.role})`,
    bankPhone: TREASURER_BANK.phone,
    brandName: config.brandName || config.title || 'Warga Gang Mandor Blok K2/25 - K3/24',
  });

  const sampleHousesList =
    `1. *Blok K2/25* - ${samplePayer}: *Rp 85.000* (Iuran: Rp 50.000, Denda: Rp 10.000, Lalu: Rp 25.000)\n` +
    `2. *Blok K2/27* - Bpk. Hendro: *Rp 50.000* (Iuran: Rp 50.000)\n` +
    `3. *Blok K3/10* - Ibu Siti: *Rp 60.000* (Iuran: Rp 50.000, Denda: Rp 10.000)`;

  const broadcastPreviewText = renderArrearsBroadcastWhatsAppMessage({
    template: broadcastTemplate,
    brandName: config.brandName || config.title || 'Gang Mandor Blok K2/25 s/d K3/24',
    monthStr: config.duesCurrentMonth || 'Oktober 2026',
    totalAllArrears: 195000,
    housesCount: 3,
    housesListFormatted: sampleHousesList,
    bankName: TREASURER_BANK.bankName,
    accountNumber: TREASURER_BANK.accountNumber,
    accountName: `${TREASURER_BANK.accountName} (${TREASURER_BANK.role})`,
    bankPhone: TREASURER_BANK.phone,
  });

  const currentPreview = activeTab === 'single' ? singlePreviewText : broadcastPreviewText;

  const handleCopyPreview = () => {
    navigator.clipboard.writeText(currentPreview);
    setCopiedPreview(true);
    setTimeout(() => setCopiedPreview(false), 2000);
  };

  const singleTags = [
    { tag: '{nama_warga}', label: 'Nama Warga / Kepala Keluarga' },
    { tag: '{blok}', label: 'Nomor Blok' },
    { tag: '{periode}', label: 'Bulan / Periode' },
    { tag: '{total_tagihan}', label: 'Total Nominal Tagihan' },
    { tag: '{iuran_kas}', label: 'Nominal Iuran Kas' },
    { tag: '{denda_baksos}', label: 'Denda Gotong Royong / Baksos' },
    { tag: '{tunggakan_lalu}', label: 'Tunggakan Periode Lalu' },
    { tag: '{rincian_tagihan}', label: 'Rincian Poin-Poin Tagihan' },
    { tag: '{nama_bank}', label: 'Nama Bank Bendahara' },
    { tag: '{no_rekening}', label: 'No. Rekening Bendahara' },
    { tag: '{atas_nama}', label: 'Atas Nama Rekening' },
    { tag: '{kontak_bendahara}', label: 'Nomor WhatsApp Bendahara' },
    { tag: '{nama_gang}', label: 'Nama Gang / Brand' },
  ];

  const broadcastTags = [
    { tag: '{nama_gang}', label: 'Nama Gang / Brand' },
    { tag: '{periode}', label: 'Bulan / Periode' },
    { tag: '{total_seluruh_tunggakan}', label: 'Total Akumulasi Tunggakan' },
    { tag: '{jumlah_rumah_tertunggak}', label: 'Jumlah Rumah Tertunggak' },
    { tag: '{daftar_tunggakan_warga}', label: 'Daftar Rincian Seluruh Rumah' },
    { tag: '{nama_bank}', label: 'Nama Bank Bendahara' },
    { tag: '{no_rekening}', label: 'No. Rekening Bendahara' },
    { tag: '{atas_nama}', label: 'Atas Nama Rekening' },
    { tag: '{kontak_bendahara}', label: 'Nomor WhatsApp Bendahara' },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-xs overflow-y-auto">
      <div className="bg-white rounded-3xl shadow-2xl border border-slate-200 w-full max-w-4xl overflow-hidden my-auto flex flex-col max-h-[94vh] animate-in fade-in zoom-in-95">
        {/* Header */}
        <div className="bg-gradient-to-r from-emerald-800 via-teal-800 to-slate-900 p-4 sm:p-5 text-white flex justify-between items-center shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-emerald-500/25 border border-emerald-400/30 text-emerald-300">
              <MessageCircle className="w-5 h-5 text-emerald-400" />
            </div>
            <div>
              <h4 className="font-extrabold text-sm sm:text-base text-white flex items-center gap-2">
                <span>Edit Template Pesan WhatsApp Penagihan</span>
                <span className="text-[10px] bg-amber-400 text-slate-950 font-black px-2 py-0.5 rounded-full uppercase tracking-wider">
                  Kustomisasi
                </span>
              </h4>
              <p className="text-[11px] text-emerald-200/90 font-medium">
                Pesan WhatsApp penagihan per KK &amp; broadcast grup otomatis berubah mengikuti template ini
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-white/70 hover:text-white p-1 rounded-lg hover:bg-white/10 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Selection */}
        <div className="bg-slate-100 p-2 border-b border-slate-200 flex gap-2 shrink-0">
          <button
            type="button"
            onClick={() => setActiveTab('single')}
            className={`flex-1 py-2 px-3 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
              activeTab === 'single'
                ? 'bg-emerald-600 text-white shadow-sm ring-1 ring-emerald-500'
                : 'bg-white hover:bg-slate-50 text-slate-700 border border-slate-200'
            }`}
          >
            <Send className="w-3.5 h-3.5 text-amber-300" />
            <span>1. Template Tagihan Per Rumah (Pribadi / Single)</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('broadcast')}
            className={`flex-1 py-2 px-3 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
              activeTab === 'broadcast'
                ? 'bg-emerald-600 text-white shadow-sm ring-1 ring-emerald-500'
                : 'bg-white hover:bg-slate-50 text-slate-700 border border-slate-200'
            }`}
          >
            <Layers className="w-3.5 h-3.5 text-cyan-300" />
            <span>2. Template Broadcast Rekap Grup WA</span>
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-4 sm:p-5 space-y-4 overflow-y-auto flex-1">
          {/* Petunjuk Penggunaan Variabel */}
          <div className="p-3 bg-gradient-to-r from-emerald-50 to-teal-50 border border-emerald-200/90 rounded-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2.5">
            <div className="flex items-start gap-2">
              <Sparkles className="w-4 h-4 text-emerald-600 mt-0.5 shrink-0" />
              <div className="text-[11px] text-slate-700 leading-snug">
                <strong className="text-emerald-950 font-bold block">
                  Sisipkan Variabel Otomatis:
                </strong>
                Klik tombol variabel di bawah ini untuk memasukkan data dinamis warga langsung ke dalam template.
              </div>
            </div>

            <button
              type="button"
              onClick={handleResetToDefault}
              className="px-2.5 py-1.5 rounded-xl bg-white hover:bg-slate-100 text-slate-700 text-xs font-bold border border-slate-300 shadow-2xs transition-all cursor-pointer flex items-center gap-1 active:scale-95 shrink-0"
              title="Kembalikan template ini ke format bawaan resmi"
            >
              <RotateCcw className="w-3.5 h-3.5 text-slate-600" />
              <span>Reset Template Ini</span>
            </button>
          </div>

          {/* Chips Variabel Tag */}
          <div className="space-y-1.5">
            <label className="text-xs font-black text-slate-800 flex items-center gap-1">
              <span>Daftar Variabel Yang Tersedia (Klik untuk Menambahkan):</span>
            </label>
            <div className="flex flex-wrap gap-1.5 p-2 bg-slate-50 rounded-2xl border border-slate-200">
              {(activeTab === 'single' ? singleTags : broadcastTags).map((item) => (
                <button
                  key={item.tag}
                  type="button"
                  onClick={() => insertTag(item.tag, activeTab)}
                  className="px-2.5 py-1 rounded-lg bg-white hover:bg-emerald-50 text-emerald-900 border border-emerald-300 text-[11px] font-mono font-bold transition-all cursor-pointer shadow-2xs active:scale-95 hover:border-emerald-500"
                  title={`Klik untuk memasukkan ${item.label}`}
                >
                  <span className="text-emerald-700">{item.tag}</span>
                  <span className="text-slate-400 font-sans font-normal ml-1">({item.label})</span>
                </button>
              ))}
            </div>
          </div>

          {/* Dual Column: Editor & Live Preview */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Editor Textarea */}
            <div className="space-y-1.5 flex flex-col">
              <label className="text-xs font-bold text-slate-700 flex items-center justify-between">
                <span>Editor Template Teks:</span>
                <span className="text-[10px] text-slate-400 font-normal">Gunakan tanda bintang (*) untuk cetak tebal di WA</span>
              </label>
              {activeTab === 'single' ? (
                <textarea
                  ref={singleTextareaRef}
                  value={singleTemplate}
                  onChange={(e) => setSingleTemplate(e.target.value)}
                  rows={14}
                  className="w-full flex-1 p-3 text-xs font-mono bg-slate-900 text-emerald-300 border border-slate-700 rounded-2xl focus:ring-2 focus:ring-emerald-500 focus:outline-none resize-none leading-relaxed selection:bg-emerald-600 selection:text-white"
                  placeholder="Ketik template pesan WhatsApp penagihan di sini..."
                />
              ) : (
                <textarea
                  ref={broadcastTextareaRef}
                  value={broadcastTemplate}
                  onChange={(e) => setBroadcastTemplate(e.target.value)}
                  rows={14}
                  className="w-full flex-1 p-3 text-xs font-mono bg-slate-900 text-emerald-300 border border-slate-700 rounded-2xl focus:ring-2 focus:ring-emerald-500 focus:outline-none resize-none leading-relaxed selection:bg-emerald-600 selection:text-white"
                  placeholder="Ketik template pesan broadcast grup WhatsApp di sini..."
                />
              )}
            </div>

            {/* Live Preview Container (WhatsApp Style Bubble) */}
            <div className="space-y-1.5 flex flex-col">
              <div className="flex items-center justify-between text-xs font-bold text-slate-700">
                <span className="flex items-center gap-1">
                  <Eye className="w-3.5 h-3.5 text-emerald-600" />
                  <span>Pratinjau Langsung WhatsApp:</span>
                </span>
                <button
                  type="button"
                  onClick={handleCopyPreview}
                  className="text-[11px] text-emerald-700 hover:text-emerald-800 flex items-center gap-1 cursor-pointer font-bold"
                >
                  {copiedPreview ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
                  <span>{copiedPreview ? 'Pratinjau Tersalin!' : 'Salin Pratinjau'}</span>
                </button>
              </div>

              <div className="flex-1 bg-[#efeae2] border border-slate-300 rounded-2xl p-3 overflow-y-auto max-h-[380px] shadow-inner">
                {/* Chat Bubble */}
                <div className="bg-white rounded-2xl rounded-tl-xs p-3.5 shadow-sm border border-slate-200 text-slate-800 text-xs font-sans whitespace-pre-wrap leading-relaxed max-w-full selection:bg-emerald-200">
                  {currentPreview}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="p-4 bg-slate-100/90 border-t border-slate-200 flex flex-wrap items-center justify-between gap-2 shrink-0">
          <div className="text-[11px] text-slate-500 font-medium">
            Template otomatis tersinkronisasi ke seluruh penagihan otomatis &amp; manual di sistem.
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-3.5 py-2 rounded-xl text-xs text-slate-600 hover:bg-slate-200 font-bold cursor-pointer transition-colors"
            >
              Batal
            </button>

            <button
              type="button"
              onClick={handleSave}
              className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-extrabold text-xs shadow-md shadow-emerald-700/20 active:scale-95 transition-all cursor-pointer flex items-center gap-1.5"
            >
              <Save className="w-4 h-4 text-amber-300" />
              <span>Simpan Perubahan Template</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
