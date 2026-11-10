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
  Maximize2,
} from 'lucide-react';
import { StickerItem, StickerPack, normalizeCdnUrl, isPackAnimated } from '@/lib/sigstick';
import {
  BgMode,
  StickerSizePreset,
  STICKER_SIZE_OPTIONS,
  copyStickerToClipboard,
  downloadSticker,
  getConvertedStickerUrl,
  getDefaultCopyBgMode,
  getDefaultStickerSize,
  renderCustomizedPngBlob,
  setDefaultCopyBgMode,
  setDefaultStickerSize,
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
  'Cảm ơn nha',
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
  const [stickerSize, setStickerSize] = useState<StickerSizePreset>(() => getDefaultStickerSize());
  const [addWhiteStroke, setAddWhiteStroke] = useState(false);
  const [caption, setCaption] = useState('');
  const [captionColor, setCaptionColor] = useState('#ffffff');
  const [captionPosition] = useState<'bottom' | 'top'>('bottom');
  const [chatPreviewTheme, setChatPreviewTheme] = useState<'zalo' | 'messenger-dark' | 'checker'>(
    'checker'
  );

  const [previewPngUrl, setPreviewPngUrl] = useState<string>('');
  const [isRenderingPreview, setIsRenderingPreview] = useState(false);
  const [isCopying, setIsCopying] = useState(false);
  const [copiedDone, setCopiedDone] = useState(false);
  const [isSharing, setIsSharing] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [gifLoading, setGifLoading] = useState(false);

  const rawStickerUrl = normalizeCdnUrl(sticker.url);
  const convertedGifUrl = getConvertedStickerUrl(rawStickerUrl, 'gif', bgMode, stickerSize);

  // Render preview PNG khi người dùng đổi tùy chỉnh chữ / viền / nền / kích thước
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
          size: stickerSize,
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
  }, [rawStickerUrl, bgMode, caption, captionColor, captionPosition, addWhiteStroke, activeTab, stickerSize]);

  const handleCopyPng = async () => {
    setIsCopying(true);
    try {
      await copyStickerToClipboard(rawStickerUrl, {
        bg: bgMode,
        caption,
        captionColor,
        captionPosition,
        addWhiteStroke,
        size: stickerSize,
      });
      setCopiedDone(true);
      onCopied(`Đã copy Sticker (${stickerSize}px)! Mở Zalo hoặc Messenger và Dán ngay.`);
      setTimeout(() => setCopiedDone(false), 2500);
    } catch (err: any) {
      alert(err?.message || 'Không thể copy vào Clipboard. Hãy thử nhấn Chia sẻ hoặc Tải xuống!');
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
          size: stickerSize,
        },
        pack.title
      );
      if (result === 'unsupported') {
        if (format === 'gif') {
          await downloadSticker(
            rawStickerUrl,
            'gif',
            { bg: bgMode, size: stickerSize },
            `${pack.id}-sticker`
          );
          onCopied(
            `Đã tải file Sticker Động .GIF (${stickerSize}px)! Bạn có thể gửi vào Zalo / Messenger.`
          );
        } else {
          await handleCopyPng();
        }
      } else {
        onCopied(`Đã mở bảng chia sẻ (${stickerSize}px) sang Zalo / Messenger!`);
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
          size: stickerSize,
        },
        `sigstick-${pack.id}`
      );
      onCopied(`Đã tải xuống sticker định dạng .${format.toUpperCase()} (${stickerSize}px)!`);
    } catch (err: any) {
      alert(err?.message || 'Lỗi khi tải xuống sticker');
    } finally {
      setIsDownloading(false);
    }
  };

  // Visual preview size in simulated chat box so user sees realistic Zalo Mobile proportion
  const previewDimensionClass =
    stickerSize === 180
      ? 'w-28 h-28 sm:w-32 sm:h-32'
      : stickerSize === 220
        ? 'w-36 h-36 sm:w-40 sm:h-40'
        : 'w-44 h-44 sm:w-48 sm:h-48';

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-slate-900/45 backdrop-blur-xs p-0 sm:p-4"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-3xl max-h-[92dvh] sm:max-h-[88dvh] flex flex-col rounded-t-3xl sm:rounded-3xl bg-white border border-slate-200 shadow-2xl overflow-hidden text-slate-800"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Mobile Handle */}
        <div className="sm:hidden flex justify-center pt-2 pb-0.5 bg-white">
          <div className="w-10 h-1 rounded-full bg-slate-200" />
        </div>

        {/* Compact Header */}
        <div className="flex items-center justify-between px-4 py-3 sm:px-6 sm:py-4 border-b border-slate-200/80 bg-white shrink-0">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-indigo-500 to-sky-500 flex items-center justify-center shrink-0 shadow-xs">
              <Sparkles className="w-4 h-4 text-white" />
            </div>
            <div className="min-w-0">
              <h3 className="font-bold text-sm sm:text-base text-slate-800 truncate">
                Sticker Studio & Chỉnh cỡ Mobile
              </h3>
              <p className="text-[11px] text-slate-500 truncate">
                Bộ: <span className="text-slate-700 font-medium">{pack.title}</span>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              onClick={onToggleFavorite}
              aria-label="Lưu vào Sticker yêu thích"
              className={`min-h-[38px] min-w-[38px] flex items-center justify-center rounded-xl border transition-all cursor-pointer ${
                isFavorite
                  ? 'bg-rose-50 border-rose-200 text-rose-500'
                  : 'bg-slate-50 border-slate-200 text-slate-500 hover:text-slate-800'
              }`}
              title="Lưu vào Sticker yêu thích"
            >
              <Heart className={`w-4 h-4 ${isFavorite ? 'fill-rose-500 text-rose-500' : ''}`} />
            </button>
            <button
              onClick={onClose}
              className="min-h-[38px] min-w-[38px] flex items-center justify-center rounded-xl bg-slate-100 hover:bg-slate-200/80 text-slate-600 hover:text-slate-900 transition-colors cursor-pointer"
              aria-label="Đóng"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Scrollable Body */}
        <div className="grid grid-cols-1 lg:grid-cols-12 overflow-y-auto flex-1">
          {/* Left Column: Live Chat Preview */}
          <div className="lg:col-span-6 p-3.5 sm:p-5 flex flex-col justify-between border-b lg:border-b-0 lg:border-r border-slate-200/80 bg-slate-50/60">
            {/* Format Switcher & Preview Background Switcher */}
            <div className="flex items-center justify-between gap-2 mb-3">
              <div className="inline-flex p-1 rounded-xl bg-slate-200/70">
                <button
                  type="button"
                  onClick={() => setActiveTab('png')}
                  className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                    activeTab === 'png'
                      ? 'bg-white text-indigo-600 shadow-2xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <ImageIcon className="w-3.5 h-3.5" />
                  PNG
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('gif')}
                  className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                    activeTab === 'gif'
                      ? 'bg-white text-indigo-600 shadow-2xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <Film className="w-3.5 h-3.5" />
                  GIF Động
                </button>
              </div>

              {/* Chat Surface Preview Selector */}
              <div className="flex items-center gap-1 text-[11px]">
                <button
                  type="button"
                  onClick={() => setChatPreviewTheme('checker')}
                  className={`px-2 py-1 rounded-lg border transition-all cursor-pointer ${
                    chatPreviewTheme === 'checker'
                      ? 'bg-teal-50 border-teal-300 text-teal-700 font-semibold'
                      : 'bg-white border-slate-200 text-slate-500'
                  }`}
                >
                  Trong suốt
                </button>
                <button
                  type="button"
                  onClick={() => setChatPreviewTheme('zalo')}
                  className={`px-2 py-1 rounded-lg border transition-all cursor-pointer ${
                    chatPreviewTheme === 'zalo'
                      ? 'bg-sky-50 border-sky-300 text-sky-700 font-semibold'
                      : 'bg-white border-slate-200 text-slate-500'
                  }`}
                >
                  Zalo Sáng
                </button>
                <button
                  type="button"
                  onClick={() => setChatPreviewTheme('messenger-dark')}
                  className={`px-2 py-1 rounded-lg border transition-all cursor-pointer ${
                    chatPreviewTheme === 'messenger-dark'
                      ? 'bg-slate-800 border-slate-700 text-white font-semibold'
                      : 'bg-white border-slate-200 text-slate-500'
                  }`}
                >
                  Nền Tối
                </button>
              </div>
            </div>

            {/* Simulated Chat Canvas (Shows realistic Zalo Mobile sticker size) */}
            <div
              className={`relative rounded-2xl p-4 min-h-[190px] sm:min-h-[240px] flex flex-col items-center justify-center transition-colors overflow-hidden border ${
                chatPreviewTheme === 'zalo'
                  ? 'bg-[#ebecf0] border-slate-300 text-slate-800'
                  : chatPreviewTheme === 'messenger-dark'
                    ? 'bg-[#22262b] border-slate-700 text-slate-100'
                    : 'bg-[radial-gradient(#cbd5e1_1px,transparent_1px)] [background-size:14px_14px] bg-white border-slate-200'
              }`}
            >
              <div className="absolute top-2.5 left-2.5 flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-slate-900/65 text-white backdrop-blur-xs">
                <MessageCircle className="w-3 h-3 text-sky-300" />
                <span>
                  {chatPreviewTheme === 'checker'
                    ? `Tách nền • ${stickerSize}x${stickerSize}px`
                    : chatPreviewTheme === 'zalo'
                      ? `Zalo Sáng • ${stickerSize}x${stickerSize}px`
                      : `Nền Tối • ${stickerSize}x${stickerSize}px`}
                </span>
              </div>

              {activeTab === 'gif' && !caption.trim() && !addWhiteStroke ? (
                <div className="relative flex flex-col items-center">
                  {gifLoading && (
                    <div className="absolute inset-0 flex flex-col items-center justify-center bg-white/60 rounded-xl backdrop-blur-[2px]">
                      <Loader2 className="w-6 h-6 animate-spin text-indigo-600 mb-1" />
                      <span className="text-[10px] font-semibold text-slate-700 bg-white/90 px-2 py-0.5 rounded shadow-2xs">
                        Đang tạo GIF...
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
                    className={`${previewDimensionClass} object-contain cursor-grab active:cursor-grabbing select-all rounded-xl transition-all duration-200`}
                    title="Kéo thả trực tiếp ảnh GIF này vào cửa sổ Zalo PC hoặc Messenger!"
                  />
                </div>
              ) : (
                <div className="relative flex flex-col items-center">
                  {isRenderingPreview && (
                    <div className="absolute inset-0 flex items-center justify-center">
                      <Loader2 className="w-6 h-6 animate-spin text-indigo-600" />
                    </div>
                  )}
                  {previewPngUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={previewPngUrl}
                      alt={pack.title}
                      draggable
                      className={`${previewDimensionClass} object-contain cursor-grab active:cursor-grabbing rounded-xl transition-all duration-200`}
                      title="Kéo thả hoặc nhấn Copy PNG để dán vào Zalo / Messenger"
                    />
                  ) : (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={rawStickerUrl}
                      alt={pack.title}
                      className={`${previewDimensionClass} object-contain transition-all duration-200`}
                    />
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Right Column: Customization Controls & Primary CTAs */}
          <div className="lg:col-span-6 p-3.5 sm:p-5 flex flex-col justify-between space-y-3.5 bg-white">
            <div className="space-y-3">
              {/* 1. Sticker Size Selector (Mobile-friendly compact sizes) */}
              <div>
                <label className="flex items-center justify-between text-xs font-semibold text-slate-600 mb-1.5">
                  <span className="flex items-center gap-1.5">
                    <Maximize2 className="w-3.5 h-3.5 text-indigo-500" />
                    Kích thước khi gửi Zalo / Messenger
                  </span>
                  <span className="text-[10px] font-medium text-indigo-600">
                    Mặc định: Nhỏ gọn (180px)
                  </span>
                </label>
                <div className="grid grid-cols-3 gap-1.5">
                  {STICKER_SIZE_OPTIONS.map((opt) => (
                    <button
                      key={opt.size}
                      type="button"
                      onClick={() => {
                        setStickerSize(opt.size);
                        setDefaultStickerSize(opt.size);
                      }}
                      title={opt.desc}
                      className={`py-2 px-2 rounded-xl text-xs font-semibold border transition-all cursor-pointer ${
                        stickerSize === opt.size
                          ? 'bg-indigo-50 border-indigo-400 text-indigo-700 shadow-2xs'
                          : 'bg-slate-50 border-slate-200 text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      {opt.shortLabel}
                    </button>
                  ))}
                </div>
              </div>

              {/* 2. Background Removal Mode */}
              <div>
                <label className="flex items-center justify-between text-xs font-semibold text-slate-600 mb-1.5">
                  <span className="flex items-center gap-1.5">
                    <Layers className="w-3.5 h-3.5 text-teal-600" />
                    Chế độ Tách nền Sticker
                  </span>
                  <span className="text-[10px] font-medium text-teal-600">
                    Tự động lưu
                  </span>
                </label>
                <div className="grid grid-cols-3 gap-1.5">
                  {(
                    [
                      { id: 'transparent', label: 'Tự tách nền' },
                      { id: 'zalo-light', label: 'Zalo Sáng' },
                      { id: 'zalo-dark', label: 'Zalo Tối' },
                    ] as const
                  ).map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => {
                        setBgMode(item.id);
                        setDefaultCopyBgMode(item.id);
                        if (item.id === 'transparent') setChatPreviewTheme('checker');
                        if (item.id === 'zalo-dark') setChatPreviewTheme('messenger-dark');
                        if (item.id === 'zalo-light') setChatPreviewTheme('zalo');
                      }}
                      className={`py-2 px-2 rounded-xl text-xs font-semibold border transition-all cursor-pointer ${
                        bgMode === item.id
                          ? 'bg-teal-50 border-teal-400 text-teal-800 shadow-2xs'
                          : 'bg-slate-50 border-slate-200 text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      {item.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* 3. Meme Caption Input */}
              <div>
                <label className="flex items-center justify-between text-xs font-semibold text-slate-600 mb-1.5">
                  <span className="flex items-center gap-1.5">
                    <Type className="w-3.5 h-3.5 text-indigo-500" />
                    Chèn chữ Meme (Tùy chọn)
                  </span>
                  {caption && (
                    <button
                      type="button"
                      onClick={() => setCaption('')}
                      className="text-rose-500 hover:underline text-[11px] cursor-pointer"
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
                    placeholder="Nhập chữ (VD: Ok sếp, Hết cứu...)"
                    className="flex-1 px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-base sm:text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:bg-white focus:border-indigo-400"
                  />
                  <input
                    type="color"
                    value={captionColor}
                    onChange={(e) => setCaptionColor(e.target.value)}
                    className="w-10 h-10 rounded-xl bg-slate-50 border border-slate-200 cursor-pointer p-1 shrink-0"
                    title="Màu chữ"
                  />
                </div>

                {/* Quick Captions Horizontal Scroll on Mobile */}
                <div className="flex items-center gap-1.5 mt-1.5 overflow-x-auto no-scrollbar pb-0.5">
                  {QUICK_CAPTIONS.map((text) => (
                    <button
                      key={text}
                      type="button"
                      onClick={() => {
                        setCaption(text);
                        setActiveTab('png');
                      }}
                      className={`shrink-0 px-2.5 py-1 rounded-lg text-[11px] font-medium border transition-all cursor-pointer ${
                        caption === text
                          ? 'bg-indigo-50 border-indigo-300 text-indigo-700 font-semibold'
                          : 'bg-slate-50 border-slate-200/80 text-slate-600 hover:bg-slate-100'
                      }`}
                    >
                      {text}
                    </button>
                  ))}
                </div>
              </div>

              {/* 4. White Die-Cut Stroke Toggle */}
              <button
                type="button"
                onClick={() => {
                  setAddWhiteStroke(!addWhiteStroke);
                  if (!addWhiteStroke) setActiveTab('png');
                }}
                className={`w-full py-2 px-3 rounded-xl text-xs font-medium border flex items-center justify-between transition-all cursor-pointer ${
                  addWhiteStroke
                    ? 'bg-amber-50 border-amber-300 text-amber-800'
                    : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                }`}
              >
                <span className="flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                  Viền trắng quanh nhân vật (Die-Cut)
                </span>
                <span
                  className={`px-2 py-0.5 rounded-md text-[10px] font-bold ${
                    addWhiteStroke ? 'bg-amber-500 text-white' : 'bg-slate-200 text-slate-600'
                  }`}
                >
                  {addWhiteStroke ? 'BẬT' : 'TẮT'}
                </span>
              </button>
            </div>

            {/* Primary Action Buttons (Touch-Friendly >= 44px) */}
            <div className="space-y-2 pt-3 border-t border-slate-100 pb-safe">
              {/* Primary CTA: Copy PNG */}
              <button
                type="button"
                onClick={handleCopyPng}
                disabled={isCopying}
                className="w-full min-h-[46px] py-3 px-4 rounded-2xl font-bold text-sm bg-indigo-600 hover:bg-indigo-500 text-white shadow-md shadow-indigo-500/20 flex items-center justify-center gap-2 transition-all active:scale-[0.99] cursor-pointer"
              >
                {isCopying ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : copiedDone ? (
                  <Check className="w-4 h-4 text-teal-200" />
                ) : (
                  <Copy className="w-4 h-4" />
                )}
                <span>
                  {copiedDone
                    ? `Đã Copy (${stickerSize}px)! Mở Zalo và Dán`
                    : `Copy Sticker (${stickerSize}px) — Dán ngay`}
                </span>
              </button>

              {/* Secondary CTAs: Share GIF & Share PNG */}
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => handleShareNative('gif')}
                  disabled={isSharing}
                  className="min-h-[42px] py-2.5 px-3 rounded-xl font-semibold text-xs bg-violet-50 hover:bg-violet-100/80 border border-violet-200 text-violet-700 flex items-center justify-center gap-1.5 transition-all cursor-pointer active:scale-95"
                >
                  {isSharing ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Share2 className="w-3.5 h-3.5 text-violet-600" />
                  )}
                  <span>Gửi GIF ({stickerSize}px)</span>
                </button>

                <button
                  type="button"
                  onClick={() => handleShareNative('png')}
                  disabled={isSharing}
                  className="min-h-[42px] py-2.5 px-3 rounded-xl font-semibold text-xs bg-slate-100 hover:bg-slate-200/80 border border-slate-200 text-slate-700 flex items-center justify-center gap-1.5 transition-all cursor-pointer active:scale-95"
                >
                  <Share2 className="w-3.5 h-3.5 text-indigo-600" />
                  <span>Chia sẻ PNG</span>
                </button>
              </div>

              {/* Download Row */}
              <div className="flex items-center justify-between gap-2 pt-1">
                <span className="text-[11px] text-slate-500">Tải về ({stickerSize}px):</span>
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => handleDownload('png')}
                    disabled={isDownloading}
                    className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-xs font-semibold text-slate-700 flex items-center gap-1 border border-slate-200 cursor-pointer"
                  >
                    <Download className="w-3 h-3 text-indigo-600" />
                    .PNG
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDownload('gif')}
                    disabled={isDownloading}
                    className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-xs font-semibold text-slate-700 flex items-center gap-1 border border-slate-200 cursor-pointer"
                  >
                    <Download className="w-3 h-3 text-violet-600" />
                    .GIF
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDownload('webp')}
                    disabled={isDownloading}
                    className="px-2.5 py-1 rounded-lg bg-slate-50 hover:bg-slate-100 text-xs font-medium text-slate-500 border border-slate-200 cursor-pointer"
                  >
                    .WebP
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
