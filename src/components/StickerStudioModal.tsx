'use client';

import React, { useState } from 'react';
import {
  X,
  Copy,
  Check,
  Share2,
  Download,
  Heart,
  Film,
  Loader2,
  Maximize2,
  Send,
  Layers,
  Sparkles,
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
  setDefaultCopyBgMode,
  setDefaultStickerSize,
  shareSticker,
} from '@/lib/stickerActions';

interface StickerStudioModalProps {
  sticker: StickerItem;
  pack: StickerPack;
  isFavorite: boolean;
  onToggleFavorite: () => void;
  onCopied: (msg: string) => void;
  onClose: () => void;
}

export default function StickerStudioModal({
  sticker,
  pack,
  isFavorite,
  onToggleFavorite,
  onCopied,
  onClose,
}: StickerStudioModalProps) {
  const [bgMode, setBgMode] = useState<BgMode>(() => getDefaultCopyBgMode());
  const [stickerSize, setStickerSize] = useState<StickerSizePreset>(() =>
    getDefaultStickerSize()
  );
  const [addWhiteStroke, setAddWhiteStroke] = useState(false);
  const [isSharing, setIsSharing] = useState(false);
  const [isCopying, setIsCopying] = useState(false);
  const [copiedDone, setCopiedDone] = useState(false);
  const [downloadingFormat, setDownloadingFormat] = useState<'gif' | 'png' | null>(null);

  const rawStickerUrl = normalizeCdnUrl(sticker.url);

  // URL xem trước ảnh GIF động chất lượng cao
  const previewGifUrl = getConvertedStickerUrl(
    rawStickerUrl,
    'gif',
    bgMode,
    stickerSize,
    addWhiteStroke
  );

  const handleShare = async () => {
    setIsSharing(true);
    try {
      const result = await shareSticker(
        rawStickerUrl,
        {
          bg: bgMode,
          size: stickerSize,
          addWhiteStroke,
          preferGif: true,
        },
        pack.title
      );
      if (result === 'shared') {
        onCopied('Đã mở bảng chia sẻ! Chọn Messenger hoặc Zalo để gửi.');
      } else if (result === 'copied') {
        setCopiedDone(true);
        onCopied('Đã Copy Sticker nền trong suốt! Dán ngay vào khung chat.');
        setTimeout(() => setCopiedDone(false), 2000);
      } else {
        onCopied('Đã tải file GIF động trong suốt! Gửi vào Messenger/Zalo sẽ tự động chạy.');
      }
    } catch (err: any) {
      if (err?.name !== 'AbortError') {
        onCopied('Lỗi khi chuẩn bị sticker để chia sẻ.');
      }
    } finally {
      setIsSharing(false);
    }
  };

  const handleCopy = async () => {
    setIsCopying(true);
    try {
      await copyStickerToClipboard(rawStickerUrl, {
        bg: bgMode,
        size: stickerSize,
        addWhiteStroke,
      });
      setCopiedDone(true);
      onCopied('Đã Copy Sticker PNG nền trong suốt! Nhấn Ctrl + V để dán.');
      setTimeout(() => setCopiedDone(false), 2000);
    } catch {
      onCopied('Trình duyệt không hỗ trợ Copy trực tiếp, hãy nhấn nút Chia sẻ hoặc Tải về.');
    } finally {
      setIsCopying(false);
    }
  };

  const handleDownload = async (format: 'gif' | 'png') => {
    setDownloadingFormat(format);
    try {
      await downloadSticker(
        rawStickerUrl,
        format,
        {
          bg: bgMode,
          size: stickerSize,
          addWhiteStroke,
        },
        `SigStick_${pack.id}_${Date.now()}`
      );
      onCopied(`Đã tải xuống file .${format.toUpperCase()} (${stickerSize}px)!`);
    } catch {
      onCopied('Không thể tải xuống sticker lúc này.');
    } finally {
      setDownloadingFormat(null);
    }
  };

  const handleBgChange = (mode: BgMode) => {
    setBgMode(mode);
    setDefaultCopyBgMode(mode);
  };

  const handleSizeChange = (size: StickerSizePreset) => {
    setStickerSize(size);
    setDefaultStickerSize(size);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-slate-900/50 backdrop-blur-xs p-0 sm:p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-xl max-h-[92dvh] sm:max-h-[88dvh] flex flex-col rounded-t-3xl sm:rounded-3xl bg-white border border-slate-200/90 shadow-2xl overflow-hidden text-slate-800"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Mobile Drag Indicator */}
        <div className="sm:hidden flex justify-center pt-2 pb-0.5 bg-white">
          <div className="w-10 h-1 rounded-full bg-slate-200" />
        </div>

        {/* Modal Header */}
        <div className="flex items-center justify-between px-4 py-3 sm:px-6 sm:py-4 border-b border-slate-200/80 bg-white shrink-0">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-indigo-500 via-sky-500 to-teal-400 flex items-center justify-center shrink-0 shadow-xs">
              <Sparkles className="w-4 h-4 text-white" />
            </div>
            <div className="min-w-0">
              <h3 className="font-bold text-sm sm:text-base text-slate-800 truncate">
                Xem & Chia sẻ Sticker
              </h3>
              <p className="text-[11px] text-slate-500 truncate">
                Bộ: <span className="text-slate-700 font-medium">{pack.title}</span>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={onToggleFavorite}
              aria-label="Lưu vào Yêu thích"
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
              type="button"
              onClick={onClose}
              className="min-h-[38px] min-w-[38px] flex items-center justify-center rounded-xl bg-slate-100 hover:bg-slate-200/80 text-slate-600 hover:text-slate-900 transition-colors cursor-pointer"
              aria-label="Đóng"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Modal Body */}
        <div className="p-4 sm:p-6 overflow-y-auto space-y-4">
          {/* Live Animated Sticker Preview on Checkerboard */}
          <div className="relative aspect-square max-w-[280px] sm:max-w-[320px] mx-auto rounded-2xl border border-slate-200/80 p-4 flex items-center justify-center overflow-hidden shadow-inner bg-[linear-gradient(45deg,#f1f5f9_25%,transparent_25%),linear-gradient(-45deg,#f1f5f9_25%,transparent_25%),linear-gradient(45deg,transparent_75%,#f1f5f9_75%),linear-gradient(-45deg,transparent_75%,#f1f5f9_75%)] bg-[size:20px_20px] bg-[position:0_0,0_10px,10px_-10px,-10px_0px]">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={previewGifUrl}
              alt={pack.title}
              className="max-w-full max-h-full object-contain filter drop-shadow-sm select-none"
              loading="eager"
              decoding="async"
            />
            <div className="absolute bottom-2 right-2 px-2 py-0.5 rounded-md text-[10px] font-bold bg-slate-900/70 text-white backdrop-blur-xs">
              GIF Động • Nền trong suốt
            </div>
          </div>

          {/* Primary Action Buttons: Share to Messenger & Zalo, Copy, Download */}
          <div className="space-y-2 pt-1">
            <button
              type="button"
              onClick={handleShare}
              disabled={isSharing}
              className="w-full min-h-[48px] px-4 py-3 rounded-2xl bg-gradient-to-r from-indigo-600 via-sky-600 to-teal-500 hover:from-indigo-700 hover:to-teal-600 text-white font-bold text-sm sm:text-base flex items-center justify-center gap-2 shadow-md shadow-indigo-500/20 transition-all cursor-pointer active:scale-98 disabled:opacity-50"
            >
              {isSharing ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  <span>Đang chuẩn bị sticker...</span>
                </>
              ) : (
                <>
                  <Send className="w-5 h-5" />
                  <span>Chia sẻ ngay (Messenger & Zalo)</span>
                </>
              )}
            </button>

            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={handleCopy}
                disabled={isCopying}
                className="min-h-[42px] px-3 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200/80 text-slate-700 font-semibold text-xs sm:text-sm flex items-center justify-center gap-1.5 border border-slate-200 transition cursor-pointer active:scale-98 disabled:opacity-50"
              >
                {isCopying ? (
                  <Loader2 className="w-4 h-4 animate-spin text-indigo-600" />
                ) : copiedDone ? (
                  <Check className="w-4 h-4 text-teal-600" />
                ) : (
                  <Copy className="w-4 h-4 text-slate-500" />
                )}
                <span>{copiedDone ? 'Đã Copy!' : 'Copy PNG (Ctrl+V)'}</span>
              </button>

              <button
                type="button"
                onClick={() => handleDownload('gif')}
                disabled={downloadingFormat !== null}
                className="min-h-[42px] px-3 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200/80 text-slate-700 font-semibold text-xs sm:text-sm flex items-center justify-center gap-1.5 border border-slate-200 transition cursor-pointer active:scale-98 disabled:opacity-50"
              >
                {downloadingFormat === 'gif' ? (
                  <Loader2 className="w-4 h-4 animate-spin text-indigo-600" />
                ) : (
                  <Film className="w-4 h-4 text-violet-600" />
                )}
                <span>Tải file .GIF</span>
              </button>
            </div>
          </div>

          {/* Quick Settings: Resolution & White Stroke */}
          <div className="pt-2 border-t border-slate-100 space-y-2.5">
            {/* Resolution Selector */}
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-semibold text-slate-600 flex items-center gap-1">
                <Maximize2 className="w-3.5 h-3.5 text-indigo-500" />
                Độ phân giải:
              </span>
              <div className="flex items-center gap-1">
                {STICKER_SIZE_OPTIONS.map((opt) => (
                  <button
                    key={opt.size}
                    type="button"
                    onClick={() => handleSizeChange(opt.size)}
                    className={`px-2.5 py-1 rounded-lg text-xs font-medium border transition cursor-pointer ${
                      stickerSize === opt.size
                        ? 'bg-indigo-50 border-indigo-300 text-indigo-700 font-semibold'
                        : 'bg-white border-slate-200 text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    {opt.shortLabel}
                  </button>
                ))}
              </div>
            </div>

            {/* Toggle White Stroke Die-Cut */}
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-semibold text-slate-600 flex items-center gap-1">
                <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                Viền trắng Die-cut:
              </span>
              <button
                type="button"
                onClick={() => setAddWhiteStroke(!addWhiteStroke)}
                className={`px-3 py-1 rounded-lg text-xs font-medium border transition cursor-pointer ${
                  addWhiteStroke
                    ? 'bg-amber-50 border-amber-300 text-amber-800 font-semibold'
                    : 'bg-white border-slate-200 text-slate-600 hover:text-slate-900'
                }`}
              >
                {addWhiteStroke ? 'Đang BẬT' : 'Đang TẮT'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
