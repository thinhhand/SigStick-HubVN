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
  Zap,
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
            'Đã chuyển sang .GIF động và tải về! Hãy kéo thả file GIF vào Zalo / Messenger.'
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
          ? '✨ Đã tự động tách nền & copy Sticker (không background)! Nhấn Ctrl+V ngay!'
          : copyBgMode === 'zalo-light'
            ? '✅ Đã copy Sticker (tiệp nền Zalo sáng)! Nhấn Ctrl+V ngay!'
            : '✅ Đã copy Sticker (tiệp nền Zalo tối)! Nhấn Ctrl+V ngay!'
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
        `Đã tải trọn bộ "${pack.title}" (${pack.stickers.length} sticker định dạng .${format.toUpperCase()})!`
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
      className="fixed inset-0 z-40 flex items-end sm:items-center justify-center bg-slate-950/75 backdrop-blur-sm p-0 sm:p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-5xl max-h-[92vh] sm:max-h-[88vh] flex flex-col rounded-t-3xl sm:rounded-3xl bg-slate-900 border border-slate-800 shadow-2xl overflow-hidden text-slate-100"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header thông tin bộ Sticker */}
        <div className="p-4 sm:p-6 border-b border-slate-800 bg-slate-900/95 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-4 min-w-0">
            <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl bg-slate-800/90 border border-slate-700/70 p-2 shrink-0 flex items-center justify-center relative">
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
                <span className="absolute -bottom-1.5 -right-1.5 px-1.5 py-0.5 rounded-md text-[10px] font-bold bg-indigo-600 text-white shadow flex items-center gap-0.5">
                  <Film className="w-2.5 h-2.5" />
                  ĐỘNG
                </span>
              )}
            </div>

            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-lg sm:text-xl font-bold text-white truncate">{pack.title}</h2>
                {pack.locale?.en && pack.locale.en !== pack.title && (
                  <span className="text-xs text-slate-400 truncate">({pack.locale.en})</span>
                )}
              </div>
              <div className="flex items-center gap-3 text-xs text-slate-400 mt-1 flex-wrap">
                <span>
                  Tác giả: <strong className="text-slate-200">{pack.author || 'SigStick'}</strong>
                </span>
                <span>•</span>
                <span>{pack.stickers.length} stickers</span>
                {pack.download ? (
                  <>
                    <span>•</span>
                    <span>{formatCount(pack.download)} lượt tải</span>
                  </>
                ) : null}
              </div>

              {/* Tags */}
              {pack.tags && pack.tags.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {pack.tags.slice(0, 8).map((tag) => (
                    <button
                      key={tag}
                      onClick={() => {
                        onClose();
                        onSearchTag(tag);
                      }}
                      className="px-2 py-0.5 rounded-full text-[11px] bg-slate-800 hover:bg-blue-600/20 text-slate-300 hover:text-blue-300 border border-slate-700/80 transition-colors"
                    >
                      #{tag}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Cụm nút Lưu bộ, Tải ZIP & Đóng */}
          <div className="flex items-center gap-2 self-end sm:self-center shrink-0">
            <button
              type="button"
              onClick={() => onToggleSavePack(pack)}
              className={`px-3.5 py-2 rounded-xl text-xs font-semibold border flex items-center gap-1.5 transition-all cursor-pointer ${
                isSavedPack
                  ? 'bg-amber-500/20 border-amber-500/50 text-amber-300'
                  : 'bg-slate-800 hover:bg-slate-750 border-slate-700 text-slate-200'
              }`}
            >
              <Bookmark className={`w-4 h-4 ${isSavedPack ? 'fill-amber-400 text-amber-400' : ''}`} />
              <span>{isSavedPack ? 'Đã lưu bộ' : 'Lưu bộ này'}</span>
            </button>

            <button
              type="button"
              onClick={() => handleDownloadAllZip('png')}
              disabled={zipDownloading !== null}
              className="px-3 py-2 rounded-xl text-xs font-semibold bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 flex items-center gap-1.5 transition-all cursor-pointer disabled:opacity-50"
              title="Tải trọn bộ ảnh PNG trong file ZIP"
            >
              {zipDownloading === 'png' ? (
                <Loader2 className="w-4 h-4 animate-spin text-blue-400" />
              ) : (
                <Download className="w-4 h-4 text-blue-400" />
              )}
              <span>
                {zipDownloading === 'png' && zipProgress
                  ? `${zipProgress.current}/${zipProgress.total}`
                  : 'ZIP (PNG)'}
              </span>
            </button>

            {animated && (
              <button
                type="button"
                onClick={() => handleDownloadAllZip('gif')}
                disabled={zipDownloading !== null}
                className="px-3 py-2 rounded-xl text-xs font-semibold bg-indigo-500/20 hover:bg-indigo-500/30 border border-indigo-500/40 text-indigo-200 flex items-center gap-1.5 transition-all cursor-pointer disabled:opacity-50"
                title="Chuyển toàn bộ sang GIF động và nén ZIP"
              >
                {zipDownloading === 'gif' ? (
                  <Loader2 className="w-4 h-4 animate-spin text-indigo-400" />
                ) : (
                  <Film className="w-4 h-4 text-indigo-400" />
                )}
                <span>
                  {zipDownloading === 'gif' && zipProgress
                    ? `${zipProgress.current}/${zipProgress.total}`
                    : 'ZIP (.GIF)'}
                </span>
              </button>
            )}

            <button
              type="button"
              onClick={onClose}
              className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white"
              aria-label="Đóng"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Thanh chọn chế độ Click 1-Chạm & Tách nền tự động */}
        <div className="px-4 sm:px-6 py-2.5 bg-slate-950/80 border-b border-slate-800/80 flex flex-col gap-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2 text-xs text-slate-300">
              <Zap className="w-4 h-4 text-amber-400 shrink-0" />
              <span className="font-medium">Khi bấm vào Sticker:</span>
            </div>

            <div className="flex items-center gap-1.5 flex-wrap">
              <button
                type="button"
                onClick={() => setQuickClickMode('copy-png')}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${
                  quickClickMode === 'copy-png'
                    ? 'bg-blue-600 text-white shadow-sm shadow-blue-500/30'
                    : 'bg-slate-800/80 text-slate-400 hover:text-white'
                }`}
              >
                <Copy className="w-3.5 h-3.5" />
                Copy PNG (Tự tách nền)
              </button>

              <button
                type="button"
                onClick={() => setQuickClickMode('share-gif')}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${
                  quickClickMode === 'share-gif'
                    ? 'bg-indigo-600 text-white shadow-sm shadow-indigo-500/30'
                    : 'bg-slate-800/80 text-slate-400 hover:text-white'
                }`}
              >
                <Share2 className="w-3.5 h-3.5" />
                Chuyển sang .GIF Động & Gửi
              </button>

              <button
                type="button"
                onClick={() => setQuickClickMode('studio')}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${
                  quickClickMode === 'studio'
                    ? 'bg-purple-600 text-white shadow-sm shadow-purple-500/30'
                    : 'bg-slate-800/80 text-slate-400 hover:text-white'
                }`}
              >
                <Sparkles className="w-3.5 h-3.5" />
                Mở Studio (Chèn chữ Meme)
              </button>
            </div>
          </div>

          {/* Tùy chọn Tách nền không background */}
          <div className="flex flex-wrap items-center justify-between gap-2 pt-1.5 border-t border-slate-800/60 text-xs">
            <span className="text-slate-400 text-[11px]">
              🪄 Xử lý nền khi gửi:
            </span>
            <div className="flex items-center gap-1.5 flex-wrap">
              {(
                [
                  {
                    id: 'transparent',
                    label: '✨ Tự động tách nền (Không background)',
                    dot: 'bg-transparent border-dashed border-emerald-400',
                  },
                  {
                    id: 'zalo-light',
                    label: 'Tiệp nền Zalo Sáng',
                    dot: 'bg-[#ebecf0] border-slate-400',
                  },
                  {
                    id: 'zalo-dark',
                    label: 'Tiệp nền Zalo Tối',
                    dot: 'bg-[#22262b] border-slate-500',
                  },
                ] as const
              ).map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => handleChangeCopyBgMode(item.id)}
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-medium flex items-center gap-1.5 border transition-all cursor-pointer ${
                    copyBgMode === item.id
                      ? 'bg-emerald-500/20 border-emerald-500/60 text-emerald-300'
                      : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <span className={`w-2.5 h-2.5 rounded-full border ${item.dot}`} />
                  {item.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Lưới danh sách toàn bộ Sticker trong bộ */}
        <div className="p-4 sm:p-6 overflow-y-auto flex-1">
          <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-3">
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
                  className={`group relative aspect-square rounded-2xl p-3 flex items-center justify-center cursor-pointer border transition-all select-none ${
                    isCopied
                      ? 'bg-emerald-500/15 border-emerald-500/60 scale-[0.98]'
                      : 'bg-slate-800/50 hover:bg-slate-800 border-slate-800 hover:border-blue-500/50 hover:shadow-lg hover:shadow-blue-500/5'
                  }`}
                >
                  {/* Emoji góc trái */}
                  {emojiStr && (
                    <span className="absolute top-2 left-2 text-xs opacity-75 pointer-events-none">
                      {emojiStr}
                    </span>
                  )}

                  {/* Nút Yêu thích góc phải */}
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onToggleFavoriteSticker(sticker, pack);
                    }}
                    className={`absolute top-1.5 right-1.5 p-1.5 rounded-lg z-10 transition-all ${
                      fav
                        ? 'opacity-100 bg-rose-500/20 text-rose-400'
                        : 'opacity-0 group-hover:opacity-100 bg-slate-900/80 text-slate-400 hover:text-rose-400'
                    }`}
                    title="Yêu thích"
                  >
                    <Heart className={`w-3.5 h-3.5 ${fav ? 'fill-rose-500 text-rose-500' : ''}`} />
                  </button>

                  {/* Hình ảnh Sticker */}
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

                  {/* Trạng thái đang Copy / Đã Copy */}
                  {(isCopying || isCopied) && (
                    <div className="absolute inset-0 rounded-2xl bg-slate-950/75 backdrop-blur-[2px] flex flex-col items-center justify-center gap-1 p-2 text-center">
                      {isCopying ? (
                        <>
                          <Loader2 className="w-6 h-6 animate-spin text-blue-400" />
                          <span className="text-[11px] font-semibold text-blue-200">
                            Đang xử lý...
                          </span>
                        </>
                      ) : (
                        <>
                          <div className="w-8 h-8 rounded-full bg-emerald-500/20 border border-emerald-500/50 flex items-center justify-center">
                            <Check className="w-5 h-5 text-emerald-400" />
                          </div>
                          <span className="text-[11px] font-bold text-emerald-300">
                            Đã Copy! Nhấn Ctrl+V
                          </span>
                        </>
                      )}
                    </div>
                  )}

                  {/* Thanh công cụ phụ khi hover */}
                  <div className="absolute inset-x-1.5 bottom-1.5 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-between gap-1 bg-slate-950/90 backdrop-blur-md px-2 py-1 rounded-xl border border-slate-700/80">
                    <span className="text-[10px] font-semibold text-blue-300 truncate">
                      {quickClickMode === 'copy-png'
                        ? 'Bấm: Copy PNG'
                        : quickClickMode === 'share-gif'
                          ? 'Bấm: Gửi GIF'
                          : 'Bấm: Studio'}
                    </span>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onSelectStickerForStudio(sticker, pack);
                      }}
                      className="p-1 rounded-md bg-blue-600/30 hover:bg-blue-600 text-blue-200 hover:text-white transition-colors"
                      title="Chỉnh sửa chữ / Xuất GIF trong Studio"
                    >
                      <Sparkles className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Footer liên kết gốc */}
        <div className="px-5 py-3 border-t border-slate-800 bg-slate-950 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-400">
          <div>
            Mẹo: Bấm trực tiếp vào bất kỳ sticker nào để copy nhanh, hoặc bấm biểu tượng{' '}
            <Sparkles className="w-3.5 h-3.5 inline text-blue-400" /> để chèn chữ & xuất GIF động!
          </div>
          <div className="flex items-center gap-3">
            {pack.telegramUrl && (
              <a
                href={pack.telegramUrl}
                target="_blank"
                rel="noreferrer"
                className="text-sky-400 hover:underline flex items-center gap-1"
              >
                <span>Telegram</span>
                <ExternalLink className="w-3 h-3" />
              </a>
            )}
            <a
              href={`https://www.sigstick.com/pack/${pack.id}`}
              target="_blank"
              rel="noreferrer"
              className="text-slate-400 hover:text-white flex items-center gap-1"
            >
              <span>Xem trên SigStick</span>
              <ExternalLink className="w-3 h-3" />
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
