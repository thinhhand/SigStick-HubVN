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
  copyStickerToClipboard,
  downloadPackZip,
  downloadSticker,
  getDefaultCopyBgMode,
  setDefaultCopyBgMode,
  shareStickerViaNativeSheet,
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
  const [quickClickMode, setQuickClickMode] = useState<'copy-png' | 'share-gif' | 'studio'>(
    'copy-png'
  );
  const [copyBgMode, setCopyBgMode] = useState<BgMode>(() => getDefaultCopyBgMode());
  const [copyingUrl, setCopyingUrl] = useState<string | null>(null);
  const [copiedUrl, setCopiedUrl] = useState<string | null>(null);
  const [zipDownloading, setZipDownloading] = useState<'png' | 'gif' | null>(null);
  const [zipProgress, setZipProgress] = useState<{ current: number; total: number } | null>(null);

  const handleChangeCopyBgMode = (mode: BgMode) => {
    setCopyBgMode(mode);
    setDefaultCopyBgMode(mode);
  };

  const handleQuickAction = async (sticker: StickerItem) => {
    const rawUrl = normalizeCdnUrl(sticker.url);
    onStickerUsed(sticker, pack);

    if (quickClickMode === 'studio') {
      onSelectStickerForStudio(sticker, pack);
      return;
    }

    if (quickClickMode === 'share-gif') {
      setCopyingUrl(rawUrl);
      try {
        const res = await shareStickerViaNativeSheet(
          rawUrl,
          'gif',
          { bg: copyBgMode },
          pack.title
        );
        if (res === 'unsupported') {
          await downloadSticker(rawUrl, 'gif', { bg: copyBgMode }, `sticker-${pack.id}`);
          onToast(
            'Đã chuyển sang .GIF động và tải về! Hãy gửi file GIF vào Zalo / Messenger.'
          );
        } else {
          onToast('Đã mở bảng chia sẻ GIF sang Zalo / Messenger!');
        }
        setCopiedUrl(rawUrl);
        setTimeout(() => setCopiedUrl((prev) => (prev === rawUrl ? null : prev)), 2000);
      } catch (err: any) {
        if (err?.name !== 'AbortError') {
          onToast('Lỗi khi chuyển đổi GIF.');
        }
      } finally {
        setCopyingUrl(null);
      }
      return;
    }

    // Mặc định: Copy PNG vào Clipboard
    setCopyingUrl(rawUrl);
    try {
      await copyStickerToClipboard(rawUrl, { bg: copyBgMode, size: 512 });
      setCopiedUrl(rawUrl);
      onToast(
        copyBgMode === 'transparent'
          ? 'Đã tự tách nền & copy Sticker! Dán vào Zalo/Messenger ngay.'
          : copyBgMode === 'zalo-light'
            ? 'Đã copy Sticker (tiệp nền Zalo sáng)!'
            : 'Đã copy Sticker (tiệp nền Zalo tối)!'
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
                <span className="font-medium text-slate-600">{pack.stickers.length} hình</span>
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
              <Bookmark className={`w-4 h-4 ${isSavedPack ? 'fill-indigo-600 text-indigo-600' : ''}`} />
              <span className="hidden sm:inline">{isSavedPack ? 'Đã lưu' : 'Lưu bộ'}</span>
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

            {animated && (
              <button
                type="button"
                onClick={() => handleDownloadAllZip('gif')}
                disabled={zipDownloading !== null}
                className="min-h-[38px] px-2.5 py-1.5 rounded-xl text-xs font-semibold bg-violet-50 hover:bg-violet-100/80 border border-violet-200 text-violet-700 hidden sm:flex items-center gap-1 transition-all cursor-pointer disabled:opacity-50"
                title="Chuyển toàn bộ sang GIF động và nén ZIP"
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
            )}

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

        {/* Compact Segmented Controls: Click Action & Background Removal */}
        <div className="px-3.5 sm:px-6 py-2.5 bg-slate-50/90 border-b border-slate-200/80 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          {/* Segmented Click Action */}
          <div className="grid grid-cols-3 sm:flex items-center gap-1 bg-slate-200/70 p-1 rounded-xl">
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
              onClick={() => setQuickClickMode('share-gif')}
              className={`py-1.5 px-2.5 rounded-lg text-[11px] sm:text-xs font-semibold flex items-center justify-center gap-1 transition-all cursor-pointer ${
                quickClickMode === 'share-gif'
                  ? 'bg-white text-indigo-600 shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Share2 className="w-3.5 h-3.5 shrink-0" />
              <span className="truncate">Gửi GIF</span>
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

          {/* Background Mode Pills */}
          <div className="flex items-center gap-1 overflow-x-auto no-scrollbar">
            <span className="text-[11px] text-slate-500 flex items-center gap-1 mr-1 shrink-0">
              <Layers className="w-3 h-3 text-teal-600" />
              Nền:
            </span>
            {(
              [
                {
                  id: 'transparent',
                  label: 'Tự tách nền (Trong suốt)',
                  dot: 'bg-white border-dashed border-teal-500',
                },
                {
                  id: 'zalo-light',
                  label: 'Zalo Sáng',
                  dot: 'bg-[#ebecf0] border-slate-400',
                },
                {
                  id: 'zalo-dark',
                  label: 'Zalo Tối',
                  dot: 'bg-[#22262b] border-slate-600',
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

        {/* Sticker Grid — 3 to 4 Columns on Mobile, Soft Cards */}
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
                  className={`group relative aspect-square rounded-2xl p-2.5 flex items-center justify-center cursor-pointer border transition-all select-none active:scale-95 ${
                    isCopied
                      ? 'bg-teal-50 border-teal-400 scale-[0.98]'
                      : 'bg-white hover:bg-indigo-50/30 border-slate-200/80 hover:border-indigo-300 shadow-[0_1px_2px_rgba(15,23,42,0.03)]'
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
                    <Heart className={`w-3.5 h-3.5 ${fav ? 'fill-rose-500 text-rose-500' : ''}`} />
                  </button>

                  {/* Sticker Image */}
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
                    className="w-full h-full object-contain group-hover:scale-105 transition-transform duration-200"
                  />

                  {/* Copying / Copied Overlay */}
                  {(isCopying || isCopied) && (
                    <div className="absolute inset-0 rounded-2xl bg-white/90 backdrop-blur-[2px] flex flex-col items-center justify-center gap-1 p-2 text-center">
                      {isCopying ? (
                        <>
                          <Loader2 className="w-5 h-5 animate-spin text-indigo-600" />
                          <span className="text-[10px] font-semibold text-indigo-700">
                            Đang xử lý...
                          </span>
                        </>
                      ) : (
                        <>
                          <div className="w-7 h-7 rounded-full bg-teal-100 border border-teal-300 flex items-center justify-center">
                            <Check className="w-4 h-4 text-teal-600" />
                          </div>
                          <span className="text-[10px] font-bold text-teal-700">
                            Đã Copy!
                          </span>
                        </>
                      )}
                    </div>
                  )}

                  {/* Quick Studio Button on Desktop Hover */}
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onSelectStickerForStudio(sticker, pack);
                    }}
                    aria-label="Mở Studio chế chữ"
                    className="hidden sm:flex absolute bottom-1.5 right-1.5 opacity-0 group-hover:opacity-100 transition-opacity p-1.5 rounded-lg bg-indigo-50 hover:bg-indigo-600 text-indigo-600 hover:text-white border border-indigo-200/80 shadow-2xs cursor-pointer"
                    title="Chỉnh sửa chữ / Xuất GIF trong Studio"
                  >
                    <Sparkles className="w-3 h-3" />
                  </button>
                </div>
              );
            })}
          </div>
        </div>

        {/* Compact Footer */}
        <div className="px-4 py-2.5 border-t border-slate-200/80 bg-white flex items-center justify-between gap-2 text-[11px] text-slate-500 pb-safe">
          <span className="truncate">
            Chạm vào sticker để {quickClickMode === 'copy-png' ? 'Copy PNG tách nền' : quickClickMode === 'share-gif' ? 'Gửi GIF động' : 'Mở Studio chế chữ'}
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
