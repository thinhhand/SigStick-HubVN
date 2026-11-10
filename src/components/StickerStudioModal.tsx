'use client';

import React, { useState, useEffect } from 'react';
import {
  X,
  Copy,
  Check,
  Share2,
  Download,
  Sparkles,
  Heart,
  Type,
  Layers,
  Film,
  Image as ImageIcon,
  Loader2,
  MessageCircle,
} from 'lucide-react';
import { StickerItem, StickerPack, normalizeCdnUrl, isPackAnimated } from '@/lib/sigstick';
import {
  BgMode,
  copyStickerToClipboard,
  downloadSticker,
  getConvertedStickerUrl,
  getDefaultCopyBgMode,
  renderCustomizedPngBlob,
  setDefaultCopyBgMode,
  shareStickerViaNativeSheet,
} from '@/lib/stickerActions';

interface StickerStudioModalProps {
  sticker: StickerItem;
  pack: StickerPack;
  isFavorite: boolean;
  onToggleFavorite: () => void;
  onCopied: (msg: string) => void;
  onClose: () => void;
}

const QUICK_CAPTIONS = [
  'Ok sếp!',
  'Hết cứu...',
  'Đúng nhận sai cãi',
  'Cảm ơn nha ❤️',
  'Đợi xíu nha',
  'Chốt đơn!',
  'Ảo thật đấy',
  'Xin lỗi được chưa',
];

export default function StickerStudioModal({
  sticker,
  pack,
  isFavorite,
  onToggleFavorite,
  onCopied,
  onClose,
}: StickerStudioModalProps) {
  const animatedPack = isPackAnimated(pack);
  const [activeTab, setActiveTab] = useState<'png' | 'gif'>(animatedPack ? 'gif' : 'png');
  const [bgMode, setBgMode] = useState<BgMode>(() => getDefaultCopyBgMode());
  const [addWhiteStroke, setAddWhiteStroke] = useState(false);
  const [caption, setCaption] = useState('');
  const [captionColor, setCaptionColor] = useState('#ffffff');
  const [captionPosition, setCaptionPosition] = useState<'bottom' | 'top'>('bottom');
  const [chatPreviewTheme, setChatPreviewTheme] = useState<'zalo' | 'messenger-dark' | 'checker'>(
    'zalo'
  );

  const [previewPngUrl, setPreviewPngUrl] = useState<string>('');
  const [isRenderingPreview, setIsRenderingPreview] = useState(false);
  const [isCopying, setIsCopying] = useState(false);
  const [copiedDone, setCopiedDone] = useState(false);
  const [isSharing, setIsSharing] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [gifLoading, setGifLoading] = useState(false);

  const rawStickerUrl = normalizeCdnUrl(sticker.url);
  const convertedGifUrl = getConvertedStickerUrl(rawStickerUrl, 'gif', bgMode, 360);

  // Render preview PNG khi người dùng đổi tùy chỉnh chữ / viền / nền
  useEffect(() => {
    let revoked = false;
    let currentObjUrl = '';

    if (activeTab === 'gif' && !caption.trim() && !addWhiteStroke) {
      setGifLoading(true);
      return;
    }

    const timer = setTimeout(async () => {
      setIsRenderingPreview(true);
      try {
        const blob = await renderCustomizedPngBlob(rawStickerUrl, {
          bg: bgMode,
          caption,
          captionColor,
          captionPosition,
          addWhiteStroke,
          size: 512,
        });
        if (!revoked) {
          currentObjUrl = URL.createObjectURL(blob);
          setPreviewPngUrl((prev) => {
            if (prev) URL.revokeObjectURL(prev);
            return currentObjUrl;
          });
        }
      } catch (err) {
        console.error('Preview error:', err);
      } finally {
        if (!revoked) setIsRenderingPreview(false);
      }
    }, 180);

    return () => {
      revoked = true;
      clearTimeout(timer);
    };
  }, [rawStickerUrl, bgMode, caption, captionColor, captionPosition, addWhiteStroke, activeTab]);

  const handleCopyPng = async () => {
    setIsCopying(true);
    try {
      await copyStickerToClipboard(rawStickerUrl, {
        bg: bgMode,
        caption,
        captionColor,
        captionPosition,
        addWhiteStroke,
        size: 512,
      });
      setCopiedDone(true);
      onCopied('Đã copy Sticker (PNG)! Mở Zalo hoặc Messenger và nhấn Ctrl+V (hoặc Dán) ngay.');
      setTimeout(() => setCopiedDone(false), 2500);
    } catch (err: any) {
      alert(err?.message || 'Không thể copy vào Clipboard. Hãy thử nhấn Tải xuống!');
    } finally {
      setIsCopying(false);
    }
  };

  const handleShareNative = async (format: 'png' | 'gif') => {
    setIsSharing(true);
    try {
      const result = await shareStickerViaNativeSheet(
        rawStickerUrl,
        format,
        {
          bg: bgMode,
          caption,
          captionColor,
          captionPosition,
          addWhiteStroke,
          size: format === 'gif' ? 360 : 512,
        },
        pack.title
      );
      if (result === 'unsupported') {
        if (format === 'gif') {
          await downloadSticker(
            rawStickerUrl,
            'gif',
            { bg: bgMode },
            `${pack.id}-sticker`
          );
          onCopied(
            'Đã tải file Sticker Động (.GIF)! Bạn có thể kéo thả file này vào khung chat Zalo / Messenger.'
          );
        } else {
          await handleCopyPng();
        }
      } else {
        onCopied('Đã mở bảng chia sẻ sang Zalo / Messenger!');
      }
    } catch (err: any) {
      if (err?.name !== 'AbortError') {
        console.error(err);
      }
    } finally {
      setIsSharing(false);
    }
  };

  const handleDownload = async (format: 'png' | 'gif' | 'webp') => {
    setIsDownloading(true);
    try {
      await downloadSticker(
        rawStickerUrl,
        format,
        {
          bg: bgMode,
          caption,
          captionColor,
          captionPosition,
          addWhiteStroke,
          size: format === 'gif' ? 360 : 512,
        },
        `sigstick-${pack.id}`
      );
      onCopied(`Đã tải xuống sticker định dạng .${format.toUpperCase()}!`);
    } catch (err: any) {
      alert(err?.message || 'Lỗi khi tải xuống sticker');
    } finally {
      setIsDownloading(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/75 backdrop-blur-md p-3 sm:p-6 overflow-y-auto"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-4xl rounded-3xl bg-slate-900 border border-slate-800 shadow-2xl overflow-hidden text-slate-100 my-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-800 bg-slate-900/90">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-500 flex items-center justify-center shrink-0 shadow-md shadow-blue-500/20">
              <Sparkles className="w-5 h-5 text-white" />
            </div>
            <div className="min-w-0">
              <h3 className="font-bold text-base sm:text-lg text-white truncate">
                Sticker Studio & Chuyển đổi Zalo / Messenger
              </h3>
              <p className="text-xs text-slate-400 truncate">
                Bộ: <span className="text-slate-300 font-medium">{pack.title}</span>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={onToggleFavorite}
              className={`p-2.5 rounded-xl border transition-all ${
                isFavorite
                  ? 'bg-rose-500/15 border-rose-500/40 text-rose-400'
                  : 'bg-slate-800 border-slate-700 text-slate-300 hover:text-white'
              }`}
              title="Lưu vào Sticker yêu thích"
            >
              <Heart className={`w-5 h-5 ${isFavorite ? 'fill-rose-500 text-rose-500' : ''}`} />
            </button>
            <button
              onClick={onClose}
              className="p-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors"
              aria-label="Đóng"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="grid grid-cols-1 lg:grid-cols-12">
          {/* Cột Trái: Khung xem trước trực tiếp trên nền Zalo / Messenger */}
          <div className="lg:col-span-6 p-5 flex flex-col justify-between border-b lg:border-b-0 lg:border-r border-slate-800 bg-slate-950/50">
            {/* Bộ chuyển đổi định dạng PNG vs GIF */}
            <div className="flex items-center justify-between gap-2 mb-4">
              <div className="inline-flex p-1 rounded-xl bg-slate-900 border border-slate-800">
                <button
                  type="button"
                  onClick={() => setActiveTab('png')}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                    activeTab === 'png'
                      ? 'bg-blue-600 text-white shadow'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  <ImageIcon className="w-3.5 h-3.5" />
                  PNG (Copy Ctrl+V)
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('gif')}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                    activeTab === 'gif'
                      ? 'bg-indigo-600 text-white shadow'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  <Film className="w-3.5 h-3.5" />
                  GIF Động (Zalo/Messenger)
                </button>
              </div>

              {/* Chọn nền giả lập khung chat */}
              <div className="flex items-center gap-1 text-xs">
                <button
                  type="button"
                  onClick={() => setChatPreviewTheme('zalo')}
                  className={`px-2.5 py-1 rounded-lg border transition-all ${
                    chatPreviewTheme === 'zalo'
                      ? 'bg-sky-500/20 border-sky-500/50 text-sky-300 font-medium'
                      : 'border-slate-800 text-slate-400 hover:text-slate-200'
                  }`}
                >
                  Nền Zalo Sáng
                </button>
                <button
                  type="button"
                  onClick={() => setChatPreviewTheme('messenger-dark')}
                  className={`px-2.5 py-1 rounded-lg border transition-all ${
                    chatPreviewTheme === 'messenger-dark'
                      ? 'bg-purple-500/20 border-purple-500/50 text-purple-300 font-medium'
                      : 'border-slate-800 text-slate-400 hover:text-slate-200'
                  }`}
                >
                  Zalo / Messenger Tối
                </button>
              </div>
            </div>

            {/* Khung giả lập khung chat */}
            <div
              className={`relative rounded-2xl p-6 min-h-[290px] flex flex-col items-center justify-center transition-colors overflow-hidden border ${
                chatPreviewTheme === 'zalo'
                  ? 'bg-[#ebecf0] border-slate-300 text-slate-800'
                  : chatPreviewTheme === 'messenger-dark'
                    ? 'bg-[#22262b] border-slate-800 text-slate-100'
                    : 'bg-[radial-gradient(#334155_1px,transparent_1px)] [background-size:16px_16px] bg-slate-900 border-slate-800'
              }`}
            >
              {/* Nhãn góc */}
              <div className="absolute top-3 left-3 flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium bg-black/50 text-white backdrop-blur-sm">
                <MessageCircle className="w-3 h-3 text-blue-400" />
                {chatPreviewTheme === 'zalo'
                  ? 'Xem trước khung chat Zalo Sáng (#ebecf0)'
                  : 'Xem trước khung chat Zalo / Messenger Tối'}
              </div>

              {activeTab === 'gif' && !caption.trim() && !addWhiteStroke ? (
                <div className="relative flex flex-col items-center">
                  {gifLoading && (
                    <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/20 rounded-xl backdrop-blur-[2px]">
                      <Loader2 className="w-7 h-7 animate-spin text-indigo-400 mb-1" />
                      <span className="text-[11px] font-medium text-white bg-black/60 px-2 py-0.5 rounded">
                        Đang chuyển WebP/APNG sang GIF...
                      </span>
                    </div>
                  )}
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={convertedGifUrl}
                    alt={pack.title}
                    draggable
                    onLoad={() => setGifLoading(false)}
                    onError={() => setGifLoading(false)}
                    className="w-52 h-52 sm:w-60 sm:h-60 object-contain cursor-grab active:cursor-grabbing select-all rounded-xl"
                    title="Kéo thả trực tiếp ảnh GIF này vào cửa sổ Zalo PC hoặc Messenger!"
                  />
                  <span className="mt-3 text-[11px] px-3 py-1 rounded-full bg-indigo-950/80 text-indigo-200 border border-indigo-500/30">
                    💡 Mẹo PC: Bạn có thể kéo & thả trực tiếp ảnh GIF trên vào Zalo / Messenger!
                  </span>
                </div>
              ) : (
                <div className="relative flex flex-col items-center">
                  {isRenderingPreview && (
                    <div className="absolute inset-0 flex items-center justify-center">
                      <Loader2 className="w-7 h-7 animate-spin text-blue-500" />
                    </div>
                  )}
                  {previewPngUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={previewPngUrl}
                      alt={pack.title}
                      draggable
                      className="w-52 h-52 sm:w-60 sm:h-60 object-contain cursor-grab active:cursor-grabbing rounded-xl"
                      title="Kéo thả hoặc nhấn Copy PNG để dán vào Zalo / Messenger"
                    />
                  ) : (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={rawStickerUrl}
                      alt={pack.title}
                      className="w-52 h-52 sm:w-60 sm:h-60 object-contain"
                    />
                  )}
                </div>
              )}
            </div>

            {/* Hướng dẫn ngắn */}
            <div className="mt-4 grid grid-cols-2 gap-2.5 text-xs">
              <div className="p-3 rounded-xl bg-blue-500/10 border border-blue-500/20 text-blue-200">
                <div className="font-semibold text-blue-300 mb-0.5">Cách 1: Copy & Dán (Khử nền trắng Zalo)</div>
                Chọn <b>Tiệp nền Zalo Sáng</b> rồi bấm <b>Copy Sticker (PNG)</b> và nhấn <b>Ctrl+V</b> vào Zalo!
              </div>
              <div className="p-3 rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-200">
                <div className="font-semibold text-indigo-300 mb-0.5">Cách 2: Gửi Sticker Động (.GIF)</div>
                Bấm <b>Gửi GIF qua App</b> (trên điện thoại) hoặc <b>Kéo thả ảnh GIF</b> vào Zalo PC / Messenger.
              </div>
            </div>
          </div>

          {/* Cột Phải: Công cụ Tùy chỉnh & Nút gửi */}
          <div className="lg:col-span-6 p-5 flex flex-col justify-between space-y-5">
            <div className="space-y-4">
              {/* 1. Chèn chữ / Caption Meme */}
              <div>
                <label className="flex items-center justify-between text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">
                  <span className="flex items-center gap-1.5">
                    <Type className="w-3.5 h-3.5 text-blue-400" />
                    Chèn chữ Meme lên Sticker (Tùy chọn)
                  </span>
                  {caption && (
                    <button
                      type="button"
                      onClick={() => setCaption('')}
                      className="text-rose-400 hover:underline text-[11px] normal-case"
                    >
                      Xóa chữ
                    </button>
                  )}
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={caption}
                    onChange={(e) => {
                      setCaption(e.target.value);
                      if (activeTab === 'gif' && e.target.value.trim()) {
                        setActiveTab('png');
                      }
                    }}
                    placeholder="Nhập chữ (VD: Ok sếp, Hết cứu, Đúng nhận sai cãi...)"
                    className="flex-1 px-3.5 py-2 rounded-xl bg-slate-800 border border-slate-700 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
                  />
                  <input
                    type="color"
                    value={captionColor}
                    onChange={(e) => setCaptionColor(e.target.value)}
                    className="w-10 h-10 rounded-xl bg-slate-800 border border-slate-700 cursor-pointer p-1"
                    title="Màu chữ"
                  />
                </div>

                {/* Các câu mẫu nhanh */}
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {QUICK_CAPTIONS.map((text) => (
                    <button
                      key={text}
                      type="button"
                      onClick={() => {
                        setCaption(text);
                        setActiveTab('png');
                      }}
                      className={`px-2.5 py-1 rounded-lg text-xs border transition-all ${
                        caption === text
                          ? 'bg-blue-600/30 border-blue-500 text-blue-200 font-medium'
                          : 'bg-slate-800/70 border-slate-700/80 text-slate-300 hover:bg-slate-800'
                      }`}
                    >
                      {text}
                    </button>
                  ))}
                </div>
              </div>

              {/* 2. Tùy chỉnh Nền & Viền Trắng chống chìm chữ trên Dark Mode */}
              <div className="space-y-3 pt-1">
                <div>
                  <label className="flex items-center justify-between text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">
                    <span className="flex items-center gap-1.5">
                      <Layers className="w-3.5 h-3.5 text-indigo-400" />
                      Nền Sticker khi gửi (Khử viền trắng Zalo)
                    </span>
                    <span className="text-[10px] font-normal normal-case text-emerald-400">
                      Tự động lưu cho lần Copy sau
                    </span>
                  </label>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
                    {(
                      [
                        { id: 'zalo-light', label: '✨ Tiệp nền Zalo Sáng' },
                        { id: 'zalo-dark', label: '🌙 Tiệp nền Zalo Tối' },
                        { id: 'transparent', label: 'Trong suốt (Messenger)' },
                      ] as const
                    ).map((item) => (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => {
                          setBgMode(item.id);
                          setDefaultCopyBgMode(item.id);
                          if (item.id === 'zalo-dark') setChatPreviewTheme('messenger-dark');
                          if (item.id === 'zalo-light') setChatPreviewTheme('zalo');
                        }}
                        className={`py-2 px-2.5 rounded-xl text-xs font-medium border transition-all cursor-pointer ${
                          bgMode === item.id
                            ? 'bg-emerald-600/25 border-emerald-500 text-emerald-200 shadow-xs'
                            : 'bg-slate-800 border-slate-700 text-slate-400 hover:text-white'
                        }`}
                      >
                        {item.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">
                    <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                    Hiệu ứng Viền Sticker (Die-Cut)
                  </label>
                  <button
                    type="button"
                    onClick={() => {
                      setAddWhiteStroke(!addWhiteStroke);
                      if (!addWhiteStroke) setActiveTab('png');
                    }}
                    className={`w-full py-2 px-3 rounded-xl text-xs font-medium border flex items-center justify-between transition-all cursor-pointer ${
                      addWhiteStroke
                        ? 'bg-amber-500/20 border-amber-500/60 text-amber-200'
                        : 'bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-750'
                    }`}
                  >
                    <span>Viền trắng quanh nhân vật Sticker</span>
                    <span
                      className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                        addWhiteStroke ? 'bg-amber-400 text-slate-950' : 'bg-slate-700 text-slate-400'
                      }`}
                    >
                      {addWhiteStroke ? 'BẬT' : 'TẮT'}
                    </span>
                  </button>
                </div>
              </div>
            </div>

            {/* Cụm nút Hành động chính */}
            <div className="space-y-2.5 pt-3 border-t border-slate-800">
              {/* Nút 1: Copy PNG vào Clipboard */}
              <button
                type="button"
                onClick={handleCopyPng}
                disabled={isCopying}
                className="w-full py-3.5 px-5 rounded-2xl font-bold text-sm sm:text-base bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white shadow-lg shadow-blue-600/25 flex items-center justify-center gap-2.5 transition-all active:scale-[0.99] cursor-pointer"
              >
                {isCopying ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : copiedDone ? (
                  <Check className="w-5 h-5 text-emerald-300" />
                ) : (
                  <Copy className="w-5 h-5" />
                )}
                <span>
                  {copiedDone
                    ? 'Đã Copy PNG! Nhấn Ctrl+V vào Zalo / Messenger'
                    : 'Copy Sticker (PNG) — Dán Ctrl+V vào Zalo & Messenger'}
                </span>
              </button>

              {/* Hàng nút 2: Chia sẻ trực tiếp (Share Sheet) sang Zalo/Messenger & Tải GIF */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <button
                  type="button"
                  onClick={() => handleShareNative('gif')}
                  disabled={isSharing}
                  className="py-3 px-4 rounded-xl font-semibold text-xs sm:text-sm bg-indigo-500/20 hover:bg-indigo-500/30 border border-indigo-500/40 text-indigo-200 flex items-center justify-center gap-2 transition-all cursor-pointer"
                >
                  {isSharing ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Share2 className="w-4 h-4 text-indigo-400" />
                  )}
                  <span>Gửi Sticker Động (.GIF) sang App</span>
                </button>

                <button
                  type="button"
                  onClick={() => handleShareNative('png')}
                  disabled={isSharing}
                  className="py-3 px-4 rounded-xl font-semibold text-xs sm:text-sm bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 flex items-center justify-center gap-2 transition-all cursor-pointer"
                >
                  <Share2 className="w-4 h-4 text-blue-400" />
                  <span>Mở Share Sheet (PNG)</span>
                </button>
              </div>

              {/* Hàng nút 3: Tải file theo định dạng */}
              <div className="flex items-center justify-between gap-2 pt-1">
                <span className="text-xs text-slate-400">Tải file đã chuyển đổi:</span>
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => handleDownload('png')}
                    disabled={isDownloading}
                    className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-medium text-slate-200 flex items-center gap-1 border border-slate-700"
                  >
                    <Download className="w-3.5 h-3.5 text-blue-400" />
                    .PNG
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDownload('gif')}
                    disabled={isDownloading}
                    className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-medium text-slate-200 flex items-center gap-1 border border-slate-700"
                  >
                    <Download className="w-3.5 h-3.5 text-indigo-400" />
                    .GIF (Động)
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDownload('webp')}
                    disabled={isDownloading}
                    className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-medium text-slate-400 hover:text-slate-200 flex items-center gap-1 border border-slate-800"
                  >
                    .WebP gốc
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
