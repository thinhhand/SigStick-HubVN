'use client';

import React, { useState } from 'react';
import {
  X,
  Copy,
  Check,
  Share2,
  Sparkles,
  Download,
  Bookmark,
  Heart,
  Film,
  Loader2,
  ExternalLink,
  Layers,
  Maximize2,
  Send,
} from 'lucide-react';
import {
  StickerItem,
  StickerPack,
  formatCount,
  getEmojiString,
  getThumbnailUrl,
  isPackAnimated,
  normalizeCdnUrl,
} from '@/lib/sigstick';
import {
  BgMode,
  StickerSizePreset,
  STICKER_SIZE_OPTIONS,
  copyStickerToClipboard,
  downloadPackZip,
  getDefaultCopyBgMode,
  setDefaultCopyBgMode,
  getDefaultStickerSize,
  setDefaultStickerSize,
  shareStickerToZalo,
} from '@/lib/stickerActions';

interface PackDetailModalProps {
  pack: StickerPack;
  isSavedPack: boolean;
  onToggleSavePack: (pack: StickerPack) => void;
  isFavoriteSticker: (url: string) => boolean;
  onToggleFavoriteSticker: (sticker: StickerItem, pack: StickerPack) => void;
  onSelectStickerForStudio: (sticker: StickerItem, pack: StickerPack) => void;
  onStickerUsed: (sticker: StickerItem, pack: StickerPack) => void;
  onToast: (msg: string) => void;
  onClose: () => void;
  onSearchTag: (tag: string) => void;
}

export default function PackDetailModal({
  pack,
  isSavedPack,
  onToggleSavePack,
  isFavoriteSticker,
  onToggleFavoriteSticker,
  onSelectStickerForStudio,
  onStickerUsed,
  onToast,
  onClose,
  onSearchTag,
}: PackDetailModalProps) {
  const animated = isPackAnimated(pack);
  const [quickClickMode, setQuickClickMode] = useState<
    'share-zalo' | 'copy-png' | 'studio'
  >('share-zalo');
  const [copyBgMode, setCopyBgMode] = useState<BgMode>(() => getDefaultCopyBgMode());
  const [stickerSize, setStickerSize] = useState<StickerSizePreset>(() =>
    getDefaultStickerSize()
  );
  const [copyingUrl, setCopyingUrl] = useState<string | null>(null);
  const [copiedUrl, setCopiedUrl] = useState<string | null>(null);
  const [zipDownloading, setZipDownloading] = useState<'png' | 'gif' | null>(null);
  const [zipProgress, setZipProgress] = useState<{
    current: number;
    total: number;
  } | null>(null);

  const handleChangeCopyBgMode = (mode: BgMode) => {
    setCopyBgMode(mode);
    setDefaultCopyBgMode(mode);
  };

  const handleChangeStickerSize = (size: StickerSizePreset) => {
    setStickerSize(size);
    setDefaultStickerSize(size);
  };

  const executeZaloShare = async (sticker: StickerItem, forceGif?: boolean) => {
    const rawUrl = normalizeCdnUrl(sticker.url);
    onStickerUsed(sticker, pack);
    setCopyingUrl(rawUrl);
    try {
      const useGif = forceGif ?? animated;
      const res = await shareStickerToZalo(
        rawUrl,
        {
          bg: copyBgMode,
          size: stickerSize,
          addWhiteStroke: true,
          preferGif: useGif,
        },
        pack.title
      );
      if (res === 'shared') {
        onToast(
          `Đã mở Chia sẻ Zalo (${useGif ? 'GIF động' : 'PNG'} • ${stickerSize}px • Có viền • Không nền đen/trắng)!`
        );
      } else if (res === 'copied') {
        onToast(
          `Đã Copy Sticker chuẩn Zalo (${stickerSize}px + Viền trắng)! Mở Zalo và Dán ngay.`
        );
      } else {
        onToast(
          `Đã tải Sticker ${useGif ? '.GIF động' : '.PNG'} chuẩn Zalo (${stickerSize}px)! Gửi vào Zalo ngay.`
        );
      }
      setCopiedUrl(rawUrl);
      setTimeout(() => setCopiedUrl((prev) => (prev === rawUrl ? null : prev)), 2000);
    } catch (err: any) {
      if (err?.name !== 'AbortError') {
        onToast('Lỗi khi chuẩn bị sticker cho Zalo.');
      }
    } finally {
      setCopyingUrl(null);
    }
  };

  const handleQuickAction = async (sticker: StickerItem) => {
    const rawUrl = normalizeCdnUrl(sticker.url);
    onStickerUsed(sticker, pack);

    if (quickClickMode === 'studio') {
      onSelectStickerForStudio(sticker, pack);
      return;
    }

    if (quickClickMode === 'share-zalo') {
      await executeZaloShare(sticker, animated);
      return;
    }

    // Chế độ Copy PNG vào Clipboard
    setCopyingUrl(rawUrl);
    try {
      await copyStickerToClipboard(rawUrl, {
        bg: copyBgMode,
        size: stickerSize,
        addWhiteStroke: true,
      });
      setCopiedUrl(rawUrl);
      onToast(
        `Đã Copy Sticker (${stickerSize}px • Viền trắng • Không nền đen/trắng)! Dán vào Zalo ngay.`
      );
      setTimeout(() => setCopiedUrl((prev) => (prev === rawUrl ? null : prev)), 2000);
    } catch {
      onSelectStickerForStudio(sticker, pack);
    } finally {
      setCopyingUrl(null);
    }
  };

  const handleDownloadAllZip = async (format: 'png' | 'gif') => {
    setZipDownloading(format);
    setZipProgress({ current: 0, total: pack.stickers.length });
    try {
      await downloadPackZip(pack, format, (current, total) => {
        setZipProgress({ current, total });
      });
      onToast(
        `Đã tải trọn bộ "${pack.title}" (${pack.stickers.length} sticker .${format.toUpperCase()})!`
      );
    } catch {
      onToast('Không thể tạo file ZIP lúc này.');
    } finally {
      setZipDownloading(null);
      setZipProgress(null);
    }
  };

  const coverUrl = getThumbnailUrl(pack.cover || pack.stickers[0], 256);

  return (
    <div
      className="fixed inset-0 z-40 flex items-end sm:items-center justify-center bg-slate-900/45 backdrop-blur-xs p-0 sm:p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-4xl max-h-[92dvh] sm:max-h-[88dvh] flex flex-col rounded-t-3xl sm:rounded-3xl bg-white border border-slate-200/90 shadow-2xl overflow-hidden text-slate-800"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Mobile Bottom-Sheet Handle */}
        <div className="sm:hidden flex justify-center pt-2 pb-0.5 bg-white">
          <div className="w-10 h-1 rounded-full bg-slate-200" />
        </div>

        {/* Compact Pack Header */}
        <div className="px-4 py-3 sm:px-6 sm:py-4 border-b border-slate-200/80 bg-white flex items-start sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0 flex-1">
            <div className="w-13 h-13 sm:w-16 sm:h-16 rounded-2xl bg-slate-50 border border-slate-200/80 p-1.5 shrink-0 flex items-center justify-center relative">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={coverUrl}
                alt={pack.title}
                onError={(e) => {
                  const target = e.currentTarget;
                  const fallback = normalizeCdnUrl(pack.cover || pack.stickers[0]);
                  if (fallback && target.src !== fallback) target.src = fallback;
                }}
                className="w-full h-full object-contain"
              />
              {animated && (
                <span className="absolute -bottom-1 -right-1 px-1.5 py-0.5 rounded-md text-[9px] font-bold bg-indigo-600 text-white shadow-xs flex items-center gap-0.5">
                  <Film className="w-2.5 h-2.5" />
                  GIF
                </span>
              )}
            </div>

            <div className="min-w-0 flex-1">
              <h2 className="text-base sm:text-lg font-bold text-slate-800 truncate">
                {pack.title}
              </h2>
              <div className="flex items-center gap-2 text-xs text-slate-500 mt-0.5 flex-wrap">
                <span className="truncate max-w-[140px] sm:max-w-none">
                  {pack.author || 'SigStick'}
                </span>
                <span>•</span>
                <span className="font-medium text-slate-600">
                  {pack.stickers.length} hình
                </span>
                {pack.download ? (
                  <>
                    <span>•</span>
                    <span>{formatCount(pack.download)} tải</span>
                  </>
                ) : null}
              </div>

              {/* Scrollable Tags Row */}
              {pack.tags && pack.tags.length > 0 && (
                <div className="flex items-center gap-1 mt-1.5 overflow-x-auto no-scrollbar">
                  {pack.tags.slice(0, 6).map((tag) => (
                    <button
                      key={tag}
                      onClick={() => {
                        onClose();
                        onSearchTag(tag);
                      }}
                      className="shrink-0 px-2 py-0.5 rounded-full text-[10px] font-medium bg-slate-100 hover:bg-indigo-50 text-slate-600 hover:text-indigo-600 border border-slate-200/70 transition-colors cursor-pointer"
                    >
                      #{tag}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Action Buttons: Save, ZIP, Close */}
          <div className="flex items-center gap-1.5 shrink-0">
            <button
              type="button"
              onClick={() => onToggleSavePack(pack)}
              aria-label={isSavedPack ? 'Bỏ lưu bộ' : 'Lưu bộ này'}
              className={`min-h-[38px] px-2.5 sm:px-3 py-1.5 rounded-xl text-xs font-semibold border flex items-center gap-1.5 transition-all cursor-pointer active:scale-95 ${
                isSavedPack
                  ? 'bg-indigo-50 border-indigo-200 text-indigo-600'
                  : 'bg-slate-50 hover:bg-slate-100 border-slate-200 text-slate-700'
              }`}
            >
              <Bookmark
                className={`w-4 h-4 ${isSavedPack ? 'fill-indigo-600 text-indigo-600' : ''}`}
              />
              <span className="hidden sm:inline">
                {isSavedPack ? 'Đã lưu' : 'Lưu bộ'}
              </span>
            </button>

            <button
              type="button"
              onClick={() => handleDownloadAllZip('png')}
              disabled={zipDownloading !== null}
              className="min-h-[38px] px-2.5 sm:px-3 py-1.5 rounded-xl text-xs font-semibold bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-700 flex items-center gap-1 transition-all cursor-pointer disabled:opacity-50"
              title="Tải trọn bộ ảnh PNG trong file ZIP"
            >
              {zipDownloading === 'png' ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin text-indigo-600" />
              ) : (
                <Download className="w-3.5 h-3.5 text-indigo-600" />
              )}
              <span className="text-[11px]">
                {zipDownloading === 'png' && zipProgress
                  ? `${zipProgress.current}/${zipProgress.total}`
                  : 'ZIP'}
              </span>
            </button>

            <button
              type="button"
              onClick={() => handleDownloadAllZip('gif')}
              disabled={zipDownloading !== null}
              className="min-h-[38px] px-2.5 py-1.5 rounded-xl text-xs font-semibold bg-violet-50 hover:bg-violet-100/80 border border-violet-200 text-violet-700 hidden sm:flex items-center gap-1 transition-all cursor-pointer disabled:opacity-50"
              title="Chuyển toàn bộ sang GIF động chuẩn Zalo và nén ZIP"
            >
              {zipDownloading === 'gif' ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin text-violet-600" />
              ) : (
                <Film className="w-3.5 h-3.5 text-violet-600" />
              )}
              <span className="text-[11px]">
                {zipDownloading === 'gif' && zipProgress
                  ? `${zipProgress.current}/${zipProgress.total}`
                  : 'ZIP GIF'}
              </span>
            </button>

            <button
              type="button"
              onClick={onClose}
              className="min-h-[38px] min-w-[38px] flex items-center justify-center rounded-xl bg-slate-100 hover:bg-slate-200/80 text-slate-600 hover:text-slate-900 cursor-pointer"
              aria-label="Đóng"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Compact Segmented Controls: Click Action, Size & Zalo Background */}
        <div className="px-3.5 sm:px-6 py-2.5 bg-slate-50/90 border-b border-slate-200/80 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          {/* Segmented Click Action */}
          <div className="grid grid-cols-3 sm:flex items-center gap-1 bg-slate-200/70 p-1 rounded-xl">
            <button
              type="button"
              onClick={() => setQuickClickMode('share-zalo')}
              className={`py-1.5 px-2.5 rounded-lg text-[11px] sm:text-xs font-bold flex items-center justify-center gap-1 transition-all cursor-pointer ${
                quickClickMode === 'share-zalo'
                  ? 'bg-[#0068ff] text-white shadow-xs'
                  : 'text-slate-700 hover:text-slate-900'
              }`}
            >
              <Send className="w-3.5 h-3.5 shrink-0" />
              <span className="truncate">
                Chia sẻ Zalo {animated ? '(GIF)' : ''}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setQuickClickMode('copy-png')}
              className={`py-1.5 px-2.5 rounded-lg text-[11px] sm:text-xs font-semibold flex items-center justify-center gap-1 transition-all cursor-pointer ${
                quickClickMode === 'copy-png'
                  ? 'bg-white text-indigo-600 shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Copy className="w-3.5 h-3.5 shrink-0" />
              <span className="truncate">Copy PNG</span>
            </button>

            <button
              type="button"
              onClick={() => setQuickClickMode('studio')}
              className={`py-1.5 px-2.5 rounded-lg text-[11px] sm:text-xs font-semibold flex items-center justify-center gap-1 transition-all cursor-pointer ${
                quickClickMode === 'studio'
                  ? 'bg-white text-indigo-600 shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Sparkles className="w-3.5 h-3.5 shrink-0" />
              <span className="truncate">Chế chữ</span>
            </button>
          </div>

          {/* Background Mode & Sticker Size Pills */}
          <div className="flex items-center gap-1 overflow-x-auto no-scrollbar">
            {/* Size Selector Pills */}
            <div className="flex items-center gap-1 pr-2 mr-1 border-r border-slate-200 shrink-0">
              <span className="text-[11px] text-slate-500 flex items-center gap-1 shrink-0">
                <Maximize2 className="w-3 h-3 text-indigo-500" />
                Cỡ:
              </span>
              {STICKER_SIZE_OPTIONS.map((opt) => (
                <button
                  key={opt.size}
                  type="button"
                  onClick={() => handleChangeStickerSize(opt.size)}
                  title={opt.desc}
                  className={`shrink-0 px-2 py-1 rounded-lg text-[11px] font-medium border transition-all cursor-pointer ${
                    stickerSize === opt.size
                      ? 'bg-indigo-50 border-indigo-300 text-indigo-700 font-semibold'
                      : 'bg-white border-slate-200 text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {opt.shortLabel}
                </button>
              ))}
            </div>

            <span className="text-[11px] text-slate-500 flex items-center gap-1 mr-1 shrink-0">
              <Layers className="w-3 h-3 text-teal-600" />
              Nền:
            </span>
            {(
              [
                {
                  id: 'zalo-mobile',
                  label: 'Zalo ĐT (Không đen/trắng)',
                  dot: 'bg-[#e2e9f1] border-sky-400',
                },
                {
                  id: 'zalo-light',
                  label: 'Zalo PC',
                  dot: 'bg-[#ebecf0] border-slate-400',
                },
                {
                  id: 'zalo-dark',
                  label: 'Zalo Tối',
                  dot: 'bg-[#22262b] border-slate-600',
                },
                {
                  id: 'transparent',
                  label: 'Trong suốt',
                  dot: 'bg-white border-dashed border-teal-500',
                },
              ] as const
            ).map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => handleChangeCopyBgMode(item.id)}
                className={`shrink-0 px-2.5 py-1 rounded-lg text-[11px] font-medium flex items-center gap-1.5 border transition-all cursor-pointer ${
                  copyBgMode === item.id
                    ? 'bg-teal-50 border-teal-300 text-teal-800 font-semibold'
                    : 'bg-white border-slate-200 text-slate-600 hover:text-slate-900'
                }`}
              >
                <span className={`w-2 h-2 rounded-full border ${item.dot}`} />
                {item.label}
              </button>
            ))}
          </div>
        </div>

        {/* Sticker Grid — 3 to 4 Columns on Mobile, Soft Cards with 1-Tap Zalo Share Button */}
        <div className="p-3 sm:p-5 overflow-y-auto flex-1 bg-[#f8fafc]">
          <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-2 sm:gap-3">
            {pack.stickers.map((sticker, index) => {
              const rawUrl = normalizeCdnUrl(sticker.url);
              const thumbUrl = getThumbnailUrl(sticker.url, 256);
              const emojiStr = getEmojiString(sticker.emoji);
              const isCopying = copyingUrl === rawUrl;
              const isCopied = copiedUrl === rawUrl;
              const fav = isFavoriteSticker(rawUrl);

              return (
                <div
                  key={`${rawUrl}-${index}`}
                  onClick={() => handleQuickAction(sticker)}
                  className={`group relative aspect-square rounded-2xl p-2 pb-7 sm:pb-8 flex items-center justify-center cursor-pointer border transition-all select-none active:scale-95 ${
                    isCopied
                      ? 'bg-teal-50 border-teal-400 scale-[0.98]'
                      : 'bg-[#e2e9f1]/55 hover:bg-[#e2e9f1] border-slate-200/90 hover:border-[#0068ff]/50 shadow-[0_1px_2px_rgba(15,23,42,0.03)]'
                  }`}
                >
                  {/* Emoji Corner */}
                  {emojiStr && (
                    <span className="absolute top-1.5 left-2 text-[11px] opacity-70 pointer-events-none">
                      {emojiStr}
                    </span>
                  )}

                  {/* Favorite Heart Button */}
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onToggleFavoriteSticker(sticker, pack);
                    }}
                    aria-label="Yêu thích"
                    className={`absolute top-1 right-1 p-1.5 rounded-lg z-10 transition-all cursor-pointer ${
                      fav
                        ? 'opacity-100 bg-rose-50 text-rose-500'
                        : 'opacity-70 sm:opacity-0 group-hover:opacity-100 bg-white/80 text-slate-400 hover:text-rose-500'
                    }`}
                    title="Yêu thích"
                  >
                    <Heart
                      className={`w-3.5 h-3.5 ${fav ? 'fill-rose-500 text-rose-500' : ''}`}
                    />
                  </button>

                  {/* Sticker Image with Simulated Die-Cut White Outline Preview */}
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={thumbUrl}
                    alt={`${pack.title} #${index + 1}`}
                    loading="lazy"
                    onError={(e) => {
                      if (e.currentTarget.src !== rawUrl) {
                        e.currentTarget.src = rawUrl;
                      }
                    }}
                    className="w-full h-full object-contain group-hover:scale-105 transition-transform duration-200 drop-shadow-[0_0_2px_#fff]"
                  />

                  {/* Dedicated Bottom Action Strip: 1-Tap Share to Zalo & Studio */}
                  <div className="absolute inset-x-1.5 bottom-1.5 flex items-center gap-1 z-10">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        executeZaloShare(sticker, animated);
                      }}
                      title="Chia sẻ thẳng qua Zalo (Chuẩn GIF/PNG + Cỡ 180px + Viền trắng + Không nền đen/trắng)"
                      className="flex-1 py-1 px-1.5 rounded-lg bg-[#0068ff] hover:bg-[#0057d9] text-white text-[10px] font-bold flex items-center justify-center gap-1 shadow-2xs transition cursor-pointer active:scale-95"
                    >
                      <Share2 className="w-2.5 h-2.5 shrink-0" />
                      <span className="truncate">Zalo {animated ? 'GIF' : ''}</span>
                    </button>

                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onSelectStickerForStudio(sticker, pack);
                      }}
                      aria-label="Mở Studio chế chữ"
                      title="Chỉnh sửa chữ / Xem trước khung chat Zalo"
                      className="p-1 rounded-lg bg-white/90 hover:bg-indigo-600 text-indigo-600 hover:text-white border border-slate-200/80 shadow-2xs transition cursor-pointer"
                    >
                      <Sparkles className="w-3 h-3" />
                    </button>
                  </div>

                  {/* Copying / Copied Overlay */}
                  {(isCopying || isCopied) && (
                    <div className="absolute inset-0 z-20 rounded-2xl bg-white/92 backdrop-blur-[2px] flex flex-col items-center justify-center gap-1 p-2 text-center">
                      {isCopying ? (
                        <>
                          <Loader2 className="w-5 h-5 animate-spin text-[#0068ff]" />
                          <span className="text-[10px] font-bold text-[#0068ff]">
                            Đang tạo chuẩn Zalo...
                          </span>
                        </>
                      ) : (
                        <>
                          <div className="w-7 h-7 rounded-full bg-teal-100 border border-teal-300 flex items-center justify-center">
                            <Check className="w-4 h-4 text-teal-600" />
                          </div>
                          <span className="text-[10px] font-bold text-teal-700">
                            Xong! Gửi Zalo ngay
                          </span>
                        </>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Compact Footer */}
        <div className="px-4 py-2.5 border-t border-slate-200/80 bg-white flex items-center justify-between gap-2 text-[11px] text-slate-500 pb-safe">
          <span className="truncate">
            Chạm sticker hoặc bấm nút <strong className="text-[#0068ff]">Zalo</strong> để gửi chuẩn cỡ {stickerSize}px, có viền trắng, không bị nền đen/trắng
          </span>
          <div className="flex items-center gap-3 shrink-0">
            {pack.telegramUrl && (
              <a
                href={pack.telegramUrl}
                target="_blank"
                rel="noreferrer"
                className="text-sky-600 hover:underline flex items-center gap-1 font-medium"
              >
                <span>Telegram</span>
                <ExternalLink className="w-3 h-3" />
              </a>
            )}
            <a
              href={`https://www.sigstick.com/pack/${pack.id}`}
              target="_blank"
              rel="noreferrer"
              className="text-slate-500 hover:text-slate-800 flex items-center gap-1"
            >
              <span>SigStick</span>
              <ExternalLink className="w-3 h-3" />
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
