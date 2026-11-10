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
  Send,
} from 'lucide-react';
import { StickerItem, StickerPack, normalizeCdnUrl } from '@/lib/sigstick';
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
  shareStickerToZalo,
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
  const [activeTab, setActiveTab] = useState<'png' | 'gif'>('gif');
  const [bgMode, setBgMode] = useState<BgMode>(() => getDefaultCopyBgMode());
  const [stickerSize, setStickerSize] = useState<StickerSizePreset>(() =>
    getDefaultStickerSize()
  );
  const [addWhiteStroke, setAddWhiteStroke] = useState(false);
  const [caption, setCaption] = useState('');
  const [captionColor, setCaptionColor] = useState('#ffffff');
  const [captionPosition] = useState<'bottom' | 'top'>('bottom');
  const [chatPreviewTheme, setChatPreviewTheme] = useState<
    'checker' | 'zalo-mobile' | 'messenger-dark'
  >('checker');

  const [previewPngUrl, setPreviewPngUrl] = useState<string>('');
  const [isRenderingPreview, setIsRenderingPreview] = useState(false);
  const [isCopying, setIsCopying] = useState(false);
  const [copiedDone, setCopiedDone] = useState(false);
  const [isSharingZalo, setIsSharingZalo] = useState(false);
  const [isSharing, setIsSharing] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [gifLoading, setGifLoading] = useState(false);

  const rawStickerUrl = normalizeCdnUrl(sticker.url);
  const convertedGifUrl = getConvertedStickerUrl(
    rawStickerUrl,
    'gif',
    bgMode,
    stickerSize,
    addWhiteStroke
  );

  // Render preview PNG khi người dùng đổi tùy chỉnh chữ / viền / nền / kích thước
  useEffect(() => {
    let revoked = false;
    let currentObjUrl = '';

    if (activeTab === 'gif' && !caption.trim()) {
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
  }, [
    rawStickerUrl,
    bgMode,
    caption,
    captionColor,
    captionPosition,
    addWhiteStroke,
    activeTab,
    stickerSize,
  ]);

  const handleShareZalo = async () => {
    setIsSharingZalo(true);
    try {
      const preferGif = activeTab === 'gif' && !caption.trim();
      const result = await shareStickerToZalo(
        rawStickerUrl,
        {
          bg: bgMode,
          caption,
          captionColor,
          captionPosition,
          addWhiteStroke,
          size: stickerSize,
          preferGif,
        },
        pack.title
      );
      if (result === 'shared') {
        onCopied(
          `Đã mở Chia sẻ (${preferGif ? 'GIF động nền trong suốt' : 'PNG'} • ${stickerSize}px) sang Zalo / Messenger!`
        );
      } else if (result === 'copied') {
        setCopiedDone(true);
        onCopied(
          `Đã Copy Sticker (${stickerSize}px)! Mở Zalo / Messenger và Dán ngay.`
        );
        setTimeout(() => setCopiedDone(false), 2500);
      } else {
        onCopied(
          `Đã tải file ${preferGif ? '.GIF động nền trong suốt' : '.PNG'} (${stickerSize}px)! Gửi qua Zalo / Messenger sẽ tự động chạy.`
        );
      }
    } catch (err: any) {
      if (err?.name !== 'AbortError') {
        console.error(err);
      }
    } finally {
      setIsSharingZalo(false);
    }
  };

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
      onCopied(
        `Đã Copy Sticker PNG (${stickerSize}px)! Mở Zalo / Messenger và Dán ngay.`
      );
      setTimeout(() => setCopiedDone(false), 2500);
    } catch (err: any) {
      alert(
        err?.message ||
          'Không thể copy vào Clipboard. Hãy nhấn nút Chia sẻ qua Zalo hoặc Tải xuống!'
      );
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
            { bg: bgMode, size: stickerSize, addWhiteStroke },
            `Messenger_creation_${pack.id}`
          );
          onCopied(
            `Đã tải file .GIF động nền trong suốt (${stickerSize}px)! Gửi vào Zalo / Messenger sẽ tự chuyển động.`
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
        `Messenger_creation_${pack.id}`
      );
      onCopied(
        `Đã tải xuống sticker định dạng .${format.toUpperCase()} (${stickerSize}px)!`
      );
    } catch (err: any) {
      alert(err?.message || 'Lỗi khi tải xuống sticker');
    } finally {
      setIsDownloading(false);
    }
  };

  const previewDimensionClass =
    stickerSize === 320
      ? 'w-32 h-32 sm:w-36 sm:h-36'
      : stickerSize === 512
        ? 'w-36 h-36 sm:w-44 sm:h-44'
        : 'w-40 h-40 sm:w-48 sm:h-48';

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
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-[#0068ff] to-sky-500 flex items-center justify-center shrink-0 shadow-xs">
              <Sparkles className="w-4 h-4 text-white" />
            </div>
            <div className="min-w-0">
              <h3 className="font-bold text-sm sm:text-base text-slate-800 truncate">
                Sticker Studio • GIF Chuyển động & Nền trong suốt
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
                  onClick={() => setActiveTab('gif')}
                  className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                    activeTab === 'gif'
                      ? 'bg-white text-[#0068ff] shadow-2xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <Film className="w-3.5 h-3.5" />
                  GIF Động Trong suốt
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('png')}
                  className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                    activeTab === 'png'
                      ? 'bg-white text-[#0068ff] shadow-2xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <ImageIcon className="w-3.5 h-3.5" />
                  PNG Ultra HD
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
                  onClick={() => setChatPreviewTheme('zalo-mobile')}
                  className={`px-2 py-1 rounded-lg border transition-all cursor-pointer ${
                    chatPreviewTheme === 'zalo-mobile'
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

            {/* Simulated Chat Canvas */}
            <div
              className={`relative rounded-2xl p-4 min-h-[195px] sm:min-h-[245px] flex flex-col items-center justify-center transition-colors overflow-hidden border ${
                chatPreviewTheme === 'zalo-mobile'
                  ? 'bg-[#e2e9f1] border-sky-200 text-slate-800'
                  : chatPreviewTheme === 'messenger-dark'
                    ? 'bg-[#22262b] border-slate-700 text-slate-100'
                    : 'bg-[radial-gradient(#cbd5e1_1px,transparent_1px)] [background-size:14px_14px] bg-white border-slate-200'
              }`}
            >
              <div className="absolute top-2.5 left-2.5 flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-slate-900/65 text-white backdrop-blur-xs">
                <MessageCircle className="w-3 h-3 text-sky-300" />
                <span>
                  {chatPreviewTheme === 'checker'
                    ? `Nền trong suốt 100% • ${stickerSize}px`
                    : chatPreviewTheme === 'zalo-mobile'
                      ? `Khung chat Zalo (#e2e9f1) • ${stickerSize}px`
                      : `Khung chat Tối (#22262b) • ${stickerSize}px`}
                </span>
              </div>

              {activeTab === 'gif' && !caption.trim() ? (
                <div className="relative flex flex-col items-center">
                  {gifLoading && (
                    <div className="absolute inset-0 flex flex-col items-center justify-center bg-white/60 rounded-xl backdrop-blur-[2px]">
                      <Loader2 className="w-6 h-6 animate-spin text-[#0068ff] mb-1" />
                      <span className="text-[10px] font-semibold text-slate-700 bg-white/90 px-2 py-0.5 rounded shadow-2xs">
                        Đang tạo GIF trong suốt...
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
                    title="Kéo thả trực tiếp ảnh GIF trong suốt này vào cửa sổ Zalo / Messenger!"
                  />
                </div>
              ) : (
                <div className="relative flex flex-col items-center">
                  {isRenderingPreview && (
                    <div className="absolute inset-0 flex items-center justify-center">
                      <Loader2 className="w-6 h-6 animate-spin text-[#0068ff]" />
                    </div>
                  )}
                  {previewPngUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={previewPngUrl}
                      alt={pack.title}
                      draggable
                      className={`${previewDimensionClass} object-contain cursor-grab active:cursor-grabbing rounded-xl transition-all duration-200`}
                      title="Kéo thả hoặc nhấn Chia sẻ qua Zalo / Copy PNG"
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
              {/* 1. Sticker Resolution Selector */}
              <div>
                <label className="flex items-center justify-between text-xs font-semibold text-slate-600 mb-1.5">
                  <span className="flex items-center gap-1.5">
                    <Maximize2 className="w-3.5 h-3.5 text-indigo-500" />
                    Độ phân giải Sticker
                  </span>
                  <span className="text-[10px] font-medium text-indigo-600">
                    Mặc định: Tối đa (1024px Ultra HD)
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

              {/* 2. Background Mode (Default: Transparent like Messenger_creation.gif) */}
              <div>
                <label className="flex items-center justify-between text-xs font-semibold text-slate-600 mb-1.5">
                  <span className="flex items-center gap-1.5">
                    <Layers className="w-3.5 h-3.5 text-teal-600" />
                    Chế độ nền khi xuất GIF / PNG
                  </span>
                  <span className="text-[10px] font-medium text-teal-600">
                    Mặc định: Nền trong suốt
                  </span>
                </label>
                <div className="grid grid-cols-4 gap-1.5">
                  {(
                    [
                      { id: 'transparent', label: 'Trong suốt' },
                      { id: 'zalo-mobile', label: 'Zalo ĐT' },
                      { id: 'zalo-light', label: 'Zalo PC' },
                      { id: 'zalo-dark', label: 'Zalo Tối' },
                    ] as const
                  ).map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => {
                        setBgMode(item.id);
                        setDefaultCopyBgMode(item.id);
                        if (item.id === 'transparent')
                          setChatPreviewTheme('checker');
                        if (item.id === 'zalo-mobile' || item.id === 'zalo-light')
                          setChatPreviewTheme('zalo-mobile');
                        if (item.id === 'zalo-dark')
                          setChatPreviewTheme('messenger-dark');
                      }}
                      className={`py-2 px-1.5 rounded-xl text-[11px] font-semibold border transition-all cursor-pointer truncate ${
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

              {/* 3. Optional White Die-Cut Stroke Toggle */}
              <button
                type="button"
                onClick={() => setAddWhiteStroke(!addWhiteStroke)}
                className={`w-full py-2 px-3 rounded-xl text-xs font-medium border flex items-center justify-between transition-all cursor-pointer ${
                  addWhiteStroke
                    ? 'bg-amber-50 border-amber-300 text-amber-800'
                    : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                }`}
              >
                <span className="flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                  Thêm viền trắng bao ngoài (Tùy chọn)
                </span>
                <span
                  className={`px-2 py-0.5 rounded-md text-[10px] font-bold ${
                    addWhiteStroke
                      ? 'bg-amber-500 text-white'
                      : 'bg-slate-200 text-slate-600'
                  }`}
                >
                  {addWhiteStroke ? 'BẬT' : 'TẮT (Chuẩn gốc)'}
                </span>
              </button>

              {/* 4. Meme Caption Input */}
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
            </div>

            {/* Primary Action Buttons (Touch-Friendly >= 44px) */}
            <div className="space-y-2 pt-3 border-t border-slate-100 pb-safe">
              {/* Primary CTA #1: Dedicated Share Transparent GIF to Zalo & Messenger */}
              <button
                type="button"
                onClick={handleShareZalo}
                disabled={isSharingZalo}
                className="w-full min-h-[46px] py-3 px-4 rounded-2xl font-bold text-sm bg-[#0068ff] hover:bg-[#0057d9] text-white shadow-md shadow-[#0068ff]/25 flex items-center justify-center gap-2 transition-all active:scale-[0.99] cursor-pointer"
              >
                {isSharingZalo ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Send className="w-4 h-4" />
                )}
                <span>
                  Gửi Zalo / Messenger ({activeTab === 'gif' && !caption.trim() ? 'GIF Động Trong suốt' : 'PNG Trong suốt'})
                </span>
              </button>

              {/* Secondary CTAs: Copy PNG & Share GIF */}
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
                  <span>Chia sẻ .GIF Trong suốt</span>
                </button>

                <button
                  type="button"
                  onClick={handleCopyPng}
                  disabled={isCopying}
                  className="min-h-[42px] py-2.5 px-3 rounded-xl font-semibold text-xs bg-indigo-50 hover:bg-indigo-100/80 border border-indigo-200 text-indigo-700 flex items-center justify-center gap-1.5 transition-all cursor-pointer active:scale-95"
                >
                  {isCopying ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : copiedDone ? (
                    <Check className="w-4 h-4 text-teal-600" />
                  ) : (
                    <Copy className="w-3.5 h-3.5 text-indigo-600" />
                  )}
                  <span>{copiedDone ? 'Đã Copy!' : 'Copy PNG'}</span>
                </button>
              </div>

              {/* Download Row */}
              <div className="flex items-center justify-between gap-2 pt-1">
                <span className="text-[11px] text-slate-500">
                  Tải về ({stickerSize}px):
                </span>
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => handleDownload('gif')}
                    disabled={isDownloading}
                    className="px-2.5 py-1 rounded-lg bg-violet-50 hover:bg-violet-100 text-xs font-semibold text-violet-700 flex items-center gap-1 border border-violet-200 cursor-pointer"
                  >
                    <Download className="w-3 h-3 text-violet-600" />
                    .GIF Trong suốt
                  </button>
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
