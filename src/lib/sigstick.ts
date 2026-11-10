export interface StickerEmojiObject {
  skinTone?: number;
  shortName?: string;
}

export interface StickerItem {
  url: string;
  emoji?: string | StickerEmojiObject;
}

export interface StickerPack {
  id: string;
  title: string;
  author: string;
  authorId?: string;
  status?: string;
  createdAt?: number;
  cover?: {
    url: string;
  };
  stickers: StickerItem[];
  download?: number;
  version?: number;
  whatsapp?: {
    isAnimated?: boolean;
    version?: number;
    v?: number;
  };
  telegramUrl?: string;
  signalUrl?: string;
  discord?: {
    version?: number;
    url?: string;
  };
  tags?: string[];
  locale?: Record<string, string>;
  stats?: {
    views?: number;
    opens?: number;
    shares?: number;
  };
  isNsfw?: boolean;
  ogImageUrl?: string;
}

export interface FeaturedCollectionItem {
  addedAt: number;
  id: string;
  pack: StickerPack;
}

export interface FeaturedCollection {
  id: string;
  title: string;
  description?: string;
  items: FeaturedCollectionItem[];
}

export const SIGSTICK_API_HOST = 'https://api.sigstick.com';

/**
 * Chuẩn hóa URL từ CDN của SigStick giống hàm dE() trong mã nguồn gốc
 */
export function normalizeCdnUrl(input?: { url?: string } | string | null): string {
  if (!input) return '';
  const rawUrl = typeof input === 'string' ? input : input.url;
  if (!rawUrl) return '';

  const prefixes = ['https://cdn.cdnstep.com/', 'https://imgcdn.sigstick.com/'];
  for (const prefix of prefixes) {
    if (rawUrl.startsWith(prefix)) {
      return 'https://cdn2.cdnstep.com/' + rawUrl.slice(prefix.length);
    }
  }
  return rawUrl;
}

/**
 * Tạo URL thumbnail (128 hoặc 256) giống hàm O2() của SigStick
 */
export function getThumbnailUrl(
  input?: { url?: string } | string | null,
  size: 128 | 256 = 128
): string {
  const url = normalizeCdnUrl(input);
  if (!url) return '';
  const parts = url.split('.');
  const ext = parts.pop() ?? '';
  parts.push(`thumb${size}`);
  parts.push(ext);
  return parts.join('.');
}

/**
 * Xử lý trường emoji (có thể là chuỗi hoặc object { skinTone, shortName })
 */
export function getEmojiString(emoji?: string | StickerEmojiObject | null): string {
  if (!emoji) return '';
  if (typeof emoji === 'string') return emoji;
  if (typeof emoji === 'object' && emoji.shortName) {
    const map: Record<string, string> = {
      heart_eyes: '😍',
      sunglasses: '😎',
      cry: '😢',
      sob: '😭',
      grin: '😁',
      starstruck: '🤩',
      question: '❓',
      muscle: '💪',
      no_mouth: '😶',
      relieved: '😌',
      open_mouth: '😮',
      exploding_head: '🤯',
      hushed: '😯',
      triumph: '😤',
      loveyou_gesture: '🤟',
      face_with_raised_eyebrow: '🤨',
    };
    return map[emoji.shortName] || '';
  }
  return '';
}

/**
 * Định dạng số lượt tải (ví dụ: 156K, 1.2M)
 */
export function formatCount(count?: number): string {
  if (!count) return '0';
  if (count < 1000) return `${count}`;
  if (count < 1_000_000) return `${(count / 1000).toFixed(count >= 10000 ? 0 : 1)}K`;
  return `${(count / 1_000_000).toFixed(1)}M`;
}

/**
 * Tách Pack ID nếu người dùng dán link https://www.sigstick.com/pack/{id}-{slug}
 */
export function extractPackIdFromInput(input: string): string | null {
  const trimmed = input.trim();
  // Khớp URL dạng /pack/WkFD7dSfBGVaFmApnZrw-ten-bo-sticker
  const urlMatch = trimmed.match(/\/pack\/([A-Za-z0-9]{15,28})(?:-|$|\/|\?)/);
  if (urlMatch) return urlMatch[1];

  // Khớp trực tiếp ID 20 ký tự của SigStick
  if (/^[A-Za-z0-9]{18,24}$/.test(trimmed)) {
    return trimmed;
  }
  return null;
}

/**
 * Kiểm tra xem sticker hoặc bộ sticker có phải dạng động (Animated WebP / APNG) hay không
 */
export function isPackAnimated(pack?: StickerPack | null): boolean {
  if (!pack) return false;
  if (pack.whatsapp?.isAnimated) return true;
  if (pack.tags?.some((t) => ['animated', 'gif', 'animation'].includes(t.toLowerCase()))) {
    return true;
  }
  return false;
}
