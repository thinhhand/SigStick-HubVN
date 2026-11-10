import JSZip from 'jszip';
import { StickerPack, normalizeCdnUrl } from './sigstick';

export type BgMode = 'transparent' | 'zalo-light' | 'zalo-dark' | 'white' | 'dark';
export type ExportFormat = 'png' | 'gif' | 'webp';
export type StickerSizePreset = 180 | 220 | 320;

export const STICKER_SIZE_OPTIONS: Array<{
  size: StickerSizePreset;
  label: string;
  shortLabel: string;
  desc: string;
}> = [
  {
    size: 180,
    label: 'Nhỏ gọn (180px - Chuẩn Zalo Mobile)',
    shortLabel: 'Nhỏ (180px)',
    desc: 'Nhỏ xinh bằng đúng sticker gốc của Zalo trên điện thoại',
  },
  {
    size: 220,
    label: 'Vừa vặn (220px - Khuyên dùng)',
    shortLabel: 'Vừa (220px)',
    desc: 'Kích thước cân đối cho cả Zalo Mobile & PC',
  },
  {
    size: 320,
    label: 'Lớn rõ (320px - Chữ Meme)',
    shortLabel: 'Lớn (320px)',
    desc: 'Phù hợp khi sticker có nhiều chữ nhỏ',
  },
];

export const BG_MODE_COLORS: Record<Exclude<BgMode, 'transparent'>, string> = {
  'zalo-light': '#ebecf0',
  'zalo-dark': '#22262b',
  white: '#ffffff',
  dark: '#1e293b',
};

const COPY_BG_STORAGE_KEY = 'sigstick_vn_copy_bg_v2';
const STICKER_SIZE_STORAGE_KEY = 'sigstick_vn_sticker_size_v1';

export function getDefaultCopyBgMode(): BgMode {
  if (typeof window === 'undefined') return 'transparent';
  try {
    const saved = localStorage.getItem(COPY_BG_STORAGE_KEY) as BgMode | null;
    if (
      saved === 'transparent' ||
      saved === 'zalo-light' ||
      saved === 'zalo-dark' ||
      saved === 'white' ||
      saved === 'dark'
    ) {
      return saved;
    }
  } catch {}
  return 'transparent';
}

export function setDefaultCopyBgMode(mode: BgMode): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(COPY_BG_STORAGE_KEY, mode);
  } catch {}
}

export function getDefaultStickerSize(): StickerSizePreset {
  if (typeof window === 'undefined') return 180;
  try {
    const raw = Number(localStorage.getItem(STICKER_SIZE_STORAGE_KEY));
    if (raw === 180 || raw === 220 || raw === 320) {
      return raw;
    }
  } catch {}
  return 180;
}

export function setDefaultStickerSize(size: StickerSizePreset): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(STICKER_SIZE_STORAGE_KEY, String(size));
  } catch {}
}

export interface StickerCustomizeOptions {
  bg?: BgMode;
  caption?: string;
  captionColor?: string;
  captionPosition?: 'bottom' | 'top';
  addWhiteStroke?: boolean;
  size?: number;
}

export function getConvertedStickerUrl(
  stickerUrl: string,
  format: ExportFormat = 'png',
  bg: BgMode = 'transparent',
  size?: number
): string {
  const finalSize = size ?? getDefaultStickerSize();
  const cleanUrl = normalizeCdnUrl(stickerUrl);
  const params = new URLSearchParams({
    url: cleanUrl,
    format: format === 'webp' ? 'raw' : format,
    bg,
    size: String(finalSize),
  });
  return `/api/sticker/convert?${params.toString()}`;
}

/**
 * Vẽ sticker lên Canvas (hỗ trợ thêm viền trắng Sticker, nền trùng màu khung chat Zalo và chữ Caption Meme)
 * Trả về PNG Blob với kích thước nhỏ gọn chuẩn Sticker Mobile để copy vào Clipboard hoặc tải về
 */
export async function renderCustomizedPngBlob(
  stickerUrl: string,
  options: StickerCustomizeOptions = {}
): Promise<Blob> {
  const {
    bg = 'transparent',
    caption = '',
    captionColor = '#ffffff',
    captionPosition = 'bottom',
    addWhiteStroke = false,
    size = getDefaultStickerSize(),
  } = options;

  // Nếu không có tùy chỉnh chữ hoặc viền trắng, gọi trực tiếp API convert PNG đã tối ưu size
  if (!caption.trim() && !addWhiteStroke) {
    const apiUrl = getConvertedStickerUrl(stickerUrl, 'png', bg, size);
    const res = await fetch(apiUrl);
    if (!res.ok) throw new Error('Không thể chuyển đổi sticker sang PNG');
    return await res.blob();
  }

  // Tải ảnh PNG gốc (trong suốt) từ proxy để vẽ lên Canvas
  const basePngUrl = getConvertedStickerUrl(stickerUrl, 'png', 'transparent', size);
  const res = await fetch(basePngUrl);
  if (!res.ok) throw new Error('Không thể tải ảnh sticker');
  const blob = await res.blob();
  const bitmap = await createImageBitmap(blob);

  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas 2D không khả dụng');

  // 1. Vẽ nền toàn khung nếu chọn nền Zalo (Light/Dark), Trắng hoặc Tối
  if (bg !== 'transparent') {
    ctx.save();
    ctx.fillStyle = BG_MODE_COLORS[bg] || '#ebecf0';
    ctx.fillRect(0, 0, size, size);
    ctx.restore();
  }

  // 2. Tính toán vùng vẽ sticker (chừa chỗ nếu có caption)
  const hasCaption = caption.trim().length > 0;
  const padding = Math.round(size * 0.05);
  const captionSpace = hasCaption ? Math.round(size * 0.16) : 0;
  const availW = size - padding * 2;
  const availH = size - padding * 2 - captionSpace;

  const scale = Math.min(availW / bitmap.width, availH / bitmap.height);
  const drawW = Math.round(bitmap.width * scale);
  const drawH = Math.round(bitmap.height * scale);
  const drawX = Math.round((size - drawW) / 2);
  const drawY =
    captionPosition === 'top' && hasCaption
      ? Math.round(padding + captionSpace + (availH - drawH) / 2)
      : Math.round(padding + (availH - drawH) / 2);

  // 3. Nếu bật viền trắng (White Die-Cut Sticker Stroke)
  if (addWhiteStroke) {
    ctx.save();
    const strokeRadius = Math.max(2, Math.round(size * 0.015));
    const diag = Math.max(1, Math.round(strokeRadius * 0.7));
    const strokeOffsets = [
      [-strokeRadius, 0],
      [strokeRadius, 0],
      [0, -strokeRadius],
      [0, strokeRadius],
      [-diag, -diag],
      [diag, -diag],
      [-diag, diag],
      [diag, diag],
    ];
    const offCanvas = document.createElement('canvas');
    offCanvas.width = drawW;
    offCanvas.height = drawH;
    const offCtx = offCanvas.getContext('2d');
    if (offCtx) {
      offCtx.drawImage(bitmap, 0, 0, drawW, drawH);
      offCtx.globalCompositeOperation = 'source-in';
      offCtx.fillStyle = '#ffffff';
      offCtx.fillRect(0, 0, drawW, drawH);

      ctx.shadowColor = 'rgba(0,0,0,0.2)';
      ctx.shadowBlur = Math.max(4, Math.round(size * 0.025));
      for (const [ox, oy] of strokeOffsets) {
        ctx.drawImage(offCanvas, drawX + ox, drawY + oy);
      }
    }
    ctx.restore();
  }

  // 4. Vẽ hình sticker chính
  ctx.drawImage(bitmap, drawX, drawY, drawW, drawH);

  // 5. Vẽ chữ Caption Meme nếu có (tự động tỉ lệ theo size)
  if (hasCaption) {
    ctx.save();
    const text = caption.trim();
    const minFont = Math.max(12, Math.round(size * 0.08));
    const maxFont = Math.max(18, Math.round(size * 0.14));
    const fontSize = Math.max(
      minFont,
      Math.min(maxFont, Math.floor((size * 0.9) / Math.max(text.length * 0.55, 6)))
    );
    ctx.font = `900 ${fontSize}px system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    const textX = size / 2;
    const textY =
      captionPosition === 'top'
        ? padding + captionSpace / 2
        : size - padding - captionSpace / 2 + Math.round(size * 0.015);

    ctx.lineJoin = 'round';
    ctx.miterLimit = 2;
    ctx.lineWidth = Math.max(3, Math.round(fontSize * 0.24));
    ctx.strokeStyle = '#0f172a';
    ctx.shadowColor = 'rgba(0,0,0,0.35)';
    ctx.shadowBlur = Math.max(3, Math.round(size * 0.02));
    ctx.strokeText(text, textX, textY, size - Math.round(size * 0.08));

    ctx.fillStyle = captionColor;
    ctx.fillText(text, textX, textY, size - Math.round(size * 0.08));
    ctx.restore();
  }

  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (b) => {
        if (b) resolve(b);
        else reject(new Error('Không thể xuất ảnh PNG từ Canvas'));
      },
      'image/png',
      1.0
    );
  });
}

/**
 * Copy Sticker dưới dạng PNG vào Clipboard (hỗ trợ cả Chrome, Edge, Safari iOS/macOS)
 */
export async function copyStickerToClipboard(
  stickerUrl: string,
  options: StickerCustomizeOptions = {}
): Promise<void> {
  if (!navigator.clipboard || typeof ClipboardItem === 'undefined') {
    throw new Error('Trình duyệt không hỗ trợ Clipboard API cho hình ảnh');
  }

  const finalOptions: StickerCustomizeOptions = {
    ...options,
    bg: options.bg ?? getDefaultCopyBgMode(),
    size: options.size ?? getDefaultStickerSize(),
  };

  // Sử dụng Promise trong ClipboardItem để tương thích cả Safari iOS lẫn Chrome/Edge
  const pngPromise = renderCustomizedPngBlob(stickerUrl, finalOptions);
  const item = new ClipboardItem({
    'image/png': pngPromise,
  });
  await navigator.clipboard.write([item]);
}

/**
 * Mở hộp thoại Chia sẻ gốc của thiết bị (Web Share API Level 2) để bắn thẳng file GIF hoặc PNG sang app Zalo, Messenger
 */
export async function shareStickerViaNativeSheet(
  stickerUrl: string,
  format: ExportFormat = 'png',
  options: StickerCustomizeOptions = {},
  title = 'Sticker'
): Promise<'shared' | 'unsupported'> {
  const targetSize = options.size ?? getDefaultStickerSize();
  let blob: Blob;
  let ext = format;
  let mime = 'image/png';

  if (format === 'gif') {
    const gifUrl = getConvertedStickerUrl(
      stickerUrl,
      'gif',
      options.bg || 'transparent',
      targetSize
    );
    const res = await fetch(gifUrl);
    if (!res.ok) throw new Error('Không thể chuyển đổi sang GIF');
    blob = await res.blob();
    ext = 'gif';
    mime = 'image/gif';
  } else {
    blob = await renderCustomizedPngBlob(stickerUrl, {
      ...options,
      size: targetSize,
    });
    ext = 'png';
    mime = 'image/png';
  }

  const file = new File([blob], `sigstick-${Date.now()}.${ext}`, { type: mime });

  if (
    typeof navigator !== 'undefined' &&
    typeof navigator.canShare === 'function' &&
    navigator.canShare({ files: [file] })
  ) {
    await navigator.share({
      files: [file],
      title,
    });
    return 'shared';
  }

  return 'unsupported';
}

/**
 * Tải xuống 1 sticker đã chuyển đổi định dạng (PNG / GIF / WebP)
 */
export async function downloadSticker(
  stickerUrl: string,
  format: ExportFormat = 'png',
  options: StickerCustomizeOptions = {},
  filenamePrefix = 'sticker'
): Promise<void> {
  const targetSize = options.size ?? getDefaultStickerSize();
  let blob: Blob;
  if (format === 'png') {
    blob = await renderCustomizedPngBlob(stickerUrl, {
      ...options,
      size: targetSize,
    });
  } else {
    const url = getConvertedStickerUrl(
      stickerUrl,
      format,
      options.bg || 'transparent',
      targetSize
    );
    const res = await fetch(url);
    if (!res.ok) throw new Error('Không thể tải xuống sticker');
    blob = await res.blob();
  }

  const objectUrl = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = objectUrl;
  a.download = `${filenamePrefix}.${format}`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(objectUrl), 3000);
}

/**
 * Tải xuống toàn bộ bộ Sticker dưới dạng file .ZIP (đã tự động chuyển sang PNG hoặc GIF để import vào Zalo/Messenger)
 */
export async function downloadPackZip(
  pack: StickerPack,
  format: 'png' | 'gif' = 'png',
  onProgress?: (current: number, total: number) => void
): Promise<void> {
  const zip = new JSZip();
  const folderName =
    pack.title.replace(/[^a-zA-Z0-9_\u00C0-\u024F\u1E00-\u1EFF -]/g, '').trim() || pack.id;
  const folder = zip.folder(folderName) || zip;

  const total = pack.stickers.length;
  let completed = 0;
  const targetSize = getDefaultStickerSize();

  // Tải song song theo từng cụm 4 ảnh để tránh nghẽn mạng
  const concurrency = 4;
  for (let i = 0; i < total; i += concurrency) {
    const batch = pack.stickers.slice(i, i + concurrency);
    await Promise.all(
      batch.map(async (sticker, idx) => {
        const index = i + idx + 1;
        try {
          const convertUrl = getConvertedStickerUrl(
            sticker.url,
            format,
            'transparent',
            targetSize
          );
          const res = await fetch(convertUrl);
          if (res.ok) {
            const buf = await res.arrayBuffer();
            folder.file(`sticker-${String(index).padStart(2, '0')}.${format}`, buf);
          }
        } catch (e) {
          console.warn('Skip sticker in zip:', e);
        } finally {
          completed++;
          onProgress?.(completed, total);
        }
      })
    );
  }

  const zipBlob = await zip.generateAsync({ type: 'blob' });
  const objectUrl = URL.createObjectURL(zipBlob);
  const a = document.createElement('a');
  a.href = objectUrl;
  a.download = `${folderName}-${format.toUpperCase()}.zip`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(objectUrl), 5000);
}
