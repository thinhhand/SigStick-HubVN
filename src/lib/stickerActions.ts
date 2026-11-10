import JSZip from 'jszip';
import { StickerPack, normalizeCdnUrl } from './sigstick';

export type BgMode =
  | 'zalo-mobile'
  | 'zalo-light'
  | 'zalo-dark'
  | 'transparent'
  | 'white'
  | 'dark';
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
  'zalo-mobile': '#e2e9f1',
  'zalo-light': '#ebecf0',
  'zalo-dark': '#22262b',
  white: '#ffffff',
  dark: '#1e293b',
};

const COPY_BG_STORAGE_KEY = 'sigstick_vn_copy_bg_v3';
const STICKER_SIZE_STORAGE_KEY = 'sigstick_vn_sticker_size_v1';

export function getDefaultCopyBgMode(): BgMode {
  if (typeof window === 'undefined') return 'zalo-mobile';
  try {
    const saved = localStorage.getItem(COPY_BG_STORAGE_KEY) as BgMode | null;
    if (
      saved === 'zalo-mobile' ||
      saved === 'zalo-light' ||
      saved === 'zalo-dark' ||
      saved === 'transparent' ||
      saved === 'white' ||
      saved === 'dark'
    ) {
      return saved;
    }
  } catch {}
  return 'zalo-mobile';
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

/**
 * Đảm bảo khi gửi sang Zalo luôn dùng nền tiệp màu khung chat Zalo (#e2e9f1 trên Mobile hoặc #ebecf0 trên PC)
 * để tuyệt đối không bao giờ bị Zalo biến phần trong suốt thành nền đen hoặc nền trắng.
 */
export function resolveZaloSafeBgMode(bg?: BgMode): BgMode {
  if (bg === 'zalo-mobile' || bg === 'zalo-light' || bg === 'zalo-dark') {
    return bg;
  }
  if (typeof window !== 'undefined' && window.innerWidth >= 768 && bg === 'transparent') {
    return 'zalo-mobile';
  }
  return 'zalo-mobile';
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
  bg: BgMode = 'zalo-mobile',
  size?: number,
  addWhiteStroke = true
): string {
  const finalSize = size ?? getDefaultStickerSize();
  const cleanUrl = normalizeCdnUrl(stickerUrl);
  const params = new URLSearchParams({
    url: cleanUrl,
    format: format === 'webp' ? 'raw' : format,
    bg,
    size: String(finalSize),
    stroke: addWhiteStroke ? '1' : '0',
  });
  return `/api/sticker/convert?${params.toString()}`;
}

/**
 * Xuất Sticker PNG với kích thước chuẩn Mobile, tự động tách nền, tạo viền trắng Die-Cut và chèn chữ Meme (nếu có)
 */
export async function renderCustomizedPngBlob(
  stickerUrl: string,
  options: StickerCustomizeOptions = {}
): Promise<Blob> {
  const {
    bg = getDefaultCopyBgMode(),
    caption = '',
    captionColor = '#ffffff',
    captionPosition = 'bottom',
    addWhiteStroke = true,
    size = getDefaultStickerSize(),
  } = options;

  // Nếu không chèn chữ tùy chỉnh, gọi trực tiếp API convert PNG trên server (đã bao gồm tự tách nền + viền Die-Cut + chống nền đen/trắng)
  if (!caption.trim()) {
    const apiUrl = getConvertedStickerUrl(
      stickerUrl,
      'png',
      bg,
      size,
      addWhiteStroke
    );
    const res = await fetch(apiUrl);
    if (!res.ok) throw new Error('Không thể chuyển đổi sticker sang PNG');
    return await res.blob();
  }

  // Khi có chèn chữ Meme: tải ảnh PNG đã tách nền (trong suốt, chưa viền) để canh bố cục với dòng chữ trên Canvas
  const basePngUrl = getConvertedStickerUrl(
    stickerUrl,
    'png',
    'transparent',
    size,
    false
  );
  const res = await fetch(basePngUrl);
  if (!res.ok) throw new Error('Không thể tải ảnh sticker');
  const blob = await res.blob();
  const bitmap = await createImageBitmap(blob);

  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas 2D không khả dụng');

  // 1. Vẽ nền toàn khung nếu chọn nền Zalo (Mobile/PC/Dark), Trắng hoặc Tối
  if (bg !== 'transparent') {
    ctx.save();
    ctx.fillStyle = BG_MODE_COLORS[bg] || '#e2e9f1';
    ctx.fillRect(0, 0, size, size);
    ctx.restore();
  }

  // 2. Tính toán vùng vẽ sticker (chừa chỗ cho caption)
  const hasCaption = caption.trim().length > 0;
  const padding = Math.round(size * 0.06);
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

  // 3. Vẽ viền trắng Die-Cut quanh nhân vật
  if (addWhiteStroke) {
    ctx.save();
    const strokeRadius = Math.max(2, Math.round(size * 0.017));
    const diag = Math.max(1, Math.round(strokeRadius * 0.72));
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

      ctx.shadowColor = 'rgba(15, 23, 42, 0.18)';
      ctx.shadowBlur = Math.max(3, Math.round(size * 0.02));
      for (const [ox, oy] of strokeOffsets) {
        ctx.drawImage(offCanvas, drawX + ox, drawY + oy);
      }
    }
    ctx.restore();
  }

  // 4. Vẽ hình sticker chính
  ctx.drawImage(bitmap, drawX, drawY, drawW, drawH);

  // 5. Vẽ chữ Caption Meme nếu có
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
 * Copy Sticker dưới dạng PNG vào Clipboard (hỗ trợ Chrome, Edge, Safari iOS/macOS)
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
    addWhiteStroke: options.addWhiteStroke ?? true,
  };

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
  title = 'Sticker Zalo'
): Promise<'shared' | 'unsupported'> {
  const targetSize = options.size ?? getDefaultStickerSize();
  const targetBg = options.bg ?? getDefaultCopyBgMode();
  const targetStroke = options.addWhiteStroke ?? true;
  let blob: Blob;
  let ext = format;
  let mime = 'image/png';

  if (format === 'gif') {
    const gifUrl = getConvertedStickerUrl(
      stickerUrl,
      'gif',
      targetBg,
      targetSize,
      targetStroke
    );
    const res = await fetch(gifUrl);
    if (!res.ok) throw new Error('Không thể chuyển đổi sang GIF');
    blob = await res.blob();
    ext = 'gif';
    mime = 'image/gif';
  } else {
    blob = await renderCustomizedPngBlob(stickerUrl, {
      ...options,
      bg: targetBg,
      size: targetSize,
      addWhiteStroke: targetStroke,
    });
    ext = 'png';
    mime = 'image/png';
  }

  const file = new File([blob], `sticker-zalo-${Date.now()}.${ext}`, {
    type: mime,
  });

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
 * Chia sẻ chuyên biệt sang Zalo (Chuẩn kích thước Mobile 180px, tự tách nền, viền trắng Die-Cut, nền tiệp khung chat Zalo không bị đen/trắng, GIF hoạt động 100%)
 */
export async function shareStickerToZalo(
  stickerUrl: string,
  options: StickerCustomizeOptions & { preferGif?: boolean } = {},
  title = 'Sticker Zalo'
): Promise<'shared' | 'copied' | 'downloaded'> {
  const safeBg = resolveZaloSafeBgMode(options.bg ?? getDefaultCopyBgMode());
  const targetSize = options.size ?? getDefaultStickerSize();
  const targetStroke = options.addWhiteStroke ?? true;
  const hasCaption = Boolean(options.caption && options.caption.trim().length > 0);
  const format: 'gif' | 'png' =
    options.preferGif && !hasCaption ? 'gif' : 'png';

  const shareResult = await shareStickerViaNativeSheet(
    stickerUrl,
    format,
    {
      ...options,
      bg: safeBg,
      size: targetSize,
      addWhiteStroke: targetStroke,
    },
    title
  );

  if (shareResult === 'shared') {
    return 'shared';
  }

  // Fallback trên máy tính (PC) khi trình duyệt không hỗ trợ mở Share Sheet cho file:
  if (format === 'gif') {
    await downloadSticker(
      stickerUrl,
      'gif',
      {
        ...options,
        bg: safeBg,
        size: targetSize,
        addWhiteStroke: targetStroke,
      },
      'sticker-zalo'
    );
    return 'downloaded';
  }

  try {
    await copyStickerToClipboard(stickerUrl, {
      ...options,
      bg: safeBg,
      size: targetSize,
      addWhiteStroke: targetStroke,
    });
    return 'copied';
  } catch {
    await downloadSticker(
      stickerUrl,
      'png',
      {
        ...options,
        bg: safeBg,
        size: targetSize,
        addWhiteStroke: targetStroke,
      },
      'sticker-zalo'
    );
    return 'downloaded';
  }
}

/**
 * Tải xuống 1 sticker đã chuyển đổi định dạng (PNG / GIF / WebP)
 */
export async function downloadSticker(
  stickerUrl: string,
  format: ExportFormat = 'png',
  options: StickerCustomizeOptions = {},
  filenamePrefix = 'sticker-zalo'
): Promise<void> {
  const targetSize = options.size ?? getDefaultStickerSize();
  const targetBg = options.bg ?? getDefaultCopyBgMode();
  const targetStroke = options.addWhiteStroke ?? true;

  let blob: Blob;
  if (format === 'png') {
    blob = await renderCustomizedPngBlob(stickerUrl, {
      ...options,
      bg: targetBg,
      size: targetSize,
      addWhiteStroke: targetStroke,
    });
  } else {
    const url = getConvertedStickerUrl(
      stickerUrl,
      format,
      targetBg,
      targetSize,
      targetStroke
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
 * Tải xuống toàn bộ bộ Sticker dưới dạng file .ZIP (đã tự động chuyển sang PNG hoặc GIF chuẩn Zalo)
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
  const targetBg = getDefaultCopyBgMode();

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
            targetBg,
            targetSize,
            true
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
