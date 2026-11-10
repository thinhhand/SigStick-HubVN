import { NextRequest, NextResponse } from 'next/server';
import sharp from 'sharp';
import UPNG from 'upng-js';
import { GIFEncoder, quantize, applyPalette } from 'gifenc';
import { normalizeCdnUrl } from '@/lib/sigstick';

const ALLOWED_HOSTS = new Set([
  'cdn2.cdnstep.com',
  'cdn.cdnstep.com',
  'imgcdn.sigstick.com',
]);

function isPngBuffer(buf: Buffer): boolean {
  return (
    buf.length > 8 &&
    buf[0] === 0x89 &&
    buf[1] === 0x50 &&
    buf[2] === 0x4e &&
    buf[3] === 0x47
  );
}

export type BgMode =
  | 'zalo-mobile'
  | 'zalo-light'
  | 'zalo-dark'
  | 'transparent'
  | 'white'
  | 'dark';

function getBgRgb(bgMode: BgMode): { r: number; g: number; b: number } | null {
  switch (bgMode) {
    case 'zalo-mobile':
      return { r: 226, g: 233, b: 241 }; // #e2e9f1 - Màu nền khung chat Zalo Mobile Sáng chuẩn
    case 'zalo-light':
      return { r: 235, g: 236, b: 240 }; // #ebecf0 - Màu nền khung chat Zalo PC Sáng
    case 'zalo-dark':
      return { r: 34, g: 38, b: 43 }; // #22262b - Màu nền khung chat Zalo Tối
    case 'white':
      return { r: 255, g: 255, b: 255 };
    case 'dark':
      return { r: 30, g: 41, b: 59 };
    default:
      return null;
  }
}

/**
 * Tự động phát hiện và tách nền đặc (trắng/xám/màu đồng nhất từ 4 góc) bằng thuật toán Flood-Fill 8 hướng,
 * kết hợp khử viền trắng răng cưa (Un-premultiply / De-halo) quanh nhân vật sticker.
 */
function autoRemoveBackgroundRgba(
  data: Uint8Array | Buffer,
  width: number,
  height: number
): void {
  const samplePoints = [
    [0, 0],
    [width - 1, 0],
    [0, height - 1],
    [width - 1, height - 1],
    [Math.floor(width / 2), 0],
    [Math.floor(width / 2), height - 1],
    [0, Math.floor(height / 2)],
    [width - 1, Math.floor(height / 2)],
  ];

  // Kiểm tra các điểm sát biên xem có nền đặc (alpha > 200) không
  const opaqueSamples: Array<[number, number, number, number, number]> = [];
  for (const [cx, cy] of samplePoints) {
    if (cx < 0 || cx >= width || cy < 0 || cy >= height) continue;
    const idx = (cy * width + cx) * 4;
    const a = data[idx + 3];
    if (a > 200) {
      opaqueSamples.push([cx, cy, data[idx], data[idx + 1], data[idx + 2]]);
    }
  }

  // Nếu ít nhất 3 điểm biên có màu đồng nhất -> ảnh có nền đặc cần tách tự động
  if (opaqueSamples.length >= 3) {
    let bestCluster: Array<[number, number, number, number, number]> = [];
    for (let i = 0; i < opaqueSamples.length; i++) {
      const [, , r1, g1, b1] = opaqueSamples[i];
      const cluster: Array<[number, number, number, number, number]> = [];
      for (let j = 0; j < opaqueSamples.length; j++) {
        const [, , r2, g2, b2] = opaqueSamples[j];
        const diff = Math.abs(r1 - r2) + Math.abs(g1 - g2) + Math.abs(b1 - b2);
        if (diff <= 48) {
          cluster.push(opaqueSamples[j]);
        }
      }
      if (cluster.length > bestCluster.length) {
        bestCluster = cluster;
      }
    }

    if (bestCluster.length >= 3) {
      let bgR = 0;
      let bgG = 0;
      let bgB = 0;
      for (const [, , r, g, b] of bestCluster) {
        bgR += r;
        bgG += g;
        bgB += b;
      }
      bgR = Math.round(bgR / bestCluster.length);
      bgG = Math.round(bgG / bestCluster.length);
      bgB = Math.round(bgB / bestCluster.length);

      const colorDist = (r: number, g: number, b: number) =>
        Math.sqrt((r - bgR) ** 2 + (g - bgG) ** 2 + (b - bgB) ** 2);

      const tolerance = 38;
      const softTolerance = 64;

      const totalPixels = width * height;
      const visited = new Uint8Array(totalPixels);
      const queue = new Int32Array(totalPixels * 2);
      let head = 0;
      let tail = 0;

      const trySeed = (x: number, y: number) => {
        const p = y * width + x;
        if (visited[p]) return;
        const idx = p * 4;
        if (data[idx + 3] === 0) {
          visited[p] = 1;
          queue[tail++] = x;
          queue[tail++] = y;
          return;
        }
        const d = colorDist(data[idx], data[idx + 1], data[idx + 2]);
        if (d <= tolerance) {
          visited[p] = 1;
          queue[tail++] = x;
          queue[tail++] = y;
        }
      };

      for (let x = 0; x < width; x++) {
        trySeed(x, 0);
        trySeed(x, height - 1);
      }
      for (let y = 0; y < height; y++) {
        trySeed(0, y);
        trySeed(width - 1, y);
      }

      const dx = [1, -1, 0, 0, 1, -1, 1, -1];
      const dy = [0, 0, 1, -1, 1, 1, -1, -1];

      while (head < tail) {
        const x = queue[head++];
        const y = queue[head++];
        const p = y * width + x;
        const idx = p * 4;

        data[idx] = 0;
        data[idx + 1] = 0;
        data[idx + 2] = 0;
        data[idx + 3] = 0;

        for (let dir = 0; dir < 8; dir++) {
          const nx = x + dx[dir];
          const ny = y + dy[dir];
          if (nx < 0 || nx >= width || ny < 0 || ny >= height) continue;
          const np = ny * width + nx;
          if (visited[np]) continue;
          const nidx = np * 4;
          if (data[nidx + 3] === 0) {
            visited[np] = 1;
            queue[tail++] = nx;
            queue[tail++] = ny;
            continue;
          }
          const d = colorDist(data[nidx], data[nidx + 1], data[nidx + 2]);
          if (d <= tolerance) {
            visited[np] = 1;
            queue[tail++] = nx;
            queue[tail++] = ny;
          } else if (d <= softTolerance) {
            visited[np] = 2;
            const factor = (d - tolerance) / (softTolerance - tolerance);
            const newAlpha = Math.round(data[nidx + 3] * factor);
            if (newAlpha < 24) {
              data[nidx] = 0;
              data[nidx + 1] = 0;
              data[nidx + 2] = 0;
              data[nidx + 3] = 0;
            } else {
              const inv = 1 - factor;
              data[nidx] = Math.max(
                0,
                Math.min(255, Math.round((data[nidx] - bgR * inv) / factor))
              );
              data[nidx + 1] = Math.max(
                0,
                Math.min(255, Math.round((data[nidx + 1] - bgG * inv) / factor))
              );
              data[nidx + 2] = Math.max(
                0,
                Math.min(255, Math.round((data[nidx + 2] - bgB * inv) / factor))
              );
              data[nidx + 3] = newAlpha;
            }
          }
        }
      }
    }
  }

  // Bước 2: Khử viền sáng/trắng (De-halo / Un-premultiply white matte) trên các pixel bán trong suốt ở rìa sticker
  const total = width * height;
  for (let i = 0; i < total; i++) {
    const idx = i * 4;
    const a = data[idx + 3];
    if (a === 0) {
      data[idx] = 0;
      data[idx + 1] = 0;
      data[idx + 2] = 0;
    } else if (a < 242) {
      const r = data[idx];
      const g = data[idx + 1];
      const b = data[idx + 2];
      if (a < 95 && r > 220 && g > 220 && b > 220) {
        data[idx] = 0;
        data[idx + 1] = 0;
        data[idx + 2] = 0;
        data[idx + 3] = 0;
      } else {
        const alpha = a / 255;
        data[idx] = Math.max(
          0,
          Math.min(255, Math.round((r - 255 * (1 - alpha)) / alpha))
        );
        data[idx + 1] = Math.max(
          0,
          Math.min(255, Math.round((g - 255 * (1 - alpha)) / alpha))
        );
        data[idx + 2] = Math.max(
          0,
          Math.min(255, Math.round((b - 255 * (1 - alpha)) / alpha))
        );
      }
    }
  }
}

/**
 * Thu phóng buffer RGBA có chừa lề an toàn (padding) để viền trắng Die-Cut không bao giờ bị cắt sát mép,
 * đồng thời dùng nội suy Bilinear trọng số Alpha để rìa nhân vật luôn mịn, không bị ám đen.
 */
function resizeRgbaWithPadding(
  src: Uint8Array,
  srcW: number,
  srcH: number,
  dstSize: number,
  padRatio = 0.08,
  yShift = 0
): Uint8Array {
  const dst = new Uint8Array(dstSize * dstSize * 4);
  const avail = Math.max(16, Math.round(dstSize * (1 - padRatio * 2)));
  const scale = Math.min(avail / srcW, avail / srcH);
  const drawW = Math.max(1, Math.round(srcW * scale));
  const drawH = Math.max(1, Math.round(srcH * scale));
  const offsetX = Math.floor((dstSize - drawW) / 2);
  const offsetY = Math.floor((dstSize - drawH) / 2) + yShift;

  for (let y = 0; y < drawH; y++) {
    const dy = y + offsetY;
    if (dy < 0 || dy >= dstSize) continue;

    const gy = ((y + 0.5) / drawH) * srcH - 0.5;
    const y0 = Math.max(0, Math.min(srcH - 1, Math.floor(gy)));
    const y1 = Math.max(0, Math.min(srcH - 1, y0 + 1));
    const wy = Math.max(0, Math.min(1, gy - y0));

    for (let x = 0; x < drawW; x++) {
      const dx = x + offsetX;
      if (dx < 0 || dx >= dstSize) continue;

      const gx = ((x + 0.5) / drawW) * srcW - 0.5;
      const x0 = Math.max(0, Math.min(srcW - 1, Math.floor(gx)));
      const x1 = Math.max(0, Math.min(srcW - 1, x0 + 1));
      const wx = Math.max(0, Math.min(1, gx - x0));

      const i00 = (y0 * srcW + x0) * 4;
      const i10 = (y0 * srcW + x1) * 4;
      const i01 = (y1 * srcW + x0) * 4;
      const i11 = (y1 * srcW + x1) * 4;

      const w00 = (1 - wx) * (1 - wy);
      const w10 = wx * (1 - wy);
      const w01 = (1 - wx) * wy;
      const w11 = wx * wy;

      const a00 = src[i00 + 3];
      const a10 = src[i10 + 3];
      const a01 = src[i01 + 3];
      const a11 = src[i11 + 3];

      const alphaSum = w00 * a00 + w10 * a10 + w01 * a01 + w11 * a11;
      if (alphaSum < 8) continue;

      const aw00 = w00 * a00;
      const aw10 = w10 * a10;
      const aw01 = w01 * a01;
      const aw11 = w11 * a11;

      const r =
        (src[i00] * aw00 + src[i10] * aw10 + src[i01] * aw01 + src[i11] * aw11) /
        alphaSum;
      const g =
        (src[i00 + 1] * aw00 +
          src[i10 + 1] * aw10 +
          src[i01 + 1] * aw01 +
          src[i11 + 1] * aw11) /
        alphaSum;
      const b =
        (src[i00 + 2] * aw00 +
          src[i10 + 2] * aw10 +
          src[i01 + 2] * aw01 +
          src[i11 + 2] * aw11) /
        alphaSum;

      const dIdx = (dy * dstSize + dx) * 4;
      dst[dIdx] = Math.round(r);
      dst[dIdx + 1] = Math.round(g);
      dst[dIdx + 2] = Math.round(b);
      dst[dIdx + 3] = Math.round(alphaSum);
    }
  }
  return dst;
}

/**
 * Tạo viền trắng Die-Cut chuẩn Sticker Zalo/Telegram quanh nhân vật kèm đường contour dịu nhẹ (#cbd5e1),
 * giúp cả các sticker màu trắng (như mèo trắng, thỏ trắng) nổi bật rõ nét trên mọi màu nền khung chat.
 */
function addDieCutOutlineRgba(
  src: Uint8Array,
  width: number,
  height: number,
  strokeRadius = 3
): Uint8Array {
  const out = new Uint8Array(src.length);
  out.set(src);

  const outerRadius = strokeRadius + 1;
  const strokeSq = strokeRadius * strokeRadius;
  const outerSq = outerRadius * outerRadius;

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = (y * width + x) * 4;
      const origA = src[idx + 3];
      if (origA >= 235) continue;

      let minDistSq = 9999;
      for (let dy = -outerRadius; dy <= outerRadius; dy++) {
        const ny = y + dy;
        if (ny < 0 || ny >= height) continue;
        for (let dx = -outerRadius; dx <= outerRadius; dx++) {
          const dSq = dx * dx + dy * dy;
          if (dSq > outerSq || dSq >= minDistSq) continue;
          const nx = x + dx;
          if (nx < 0 || nx >= width) continue;
          const nA = src[(ny * width + nx) * 4 + 3];
          if (nA >= 115) {
            minDistSq = dSq;
          }
        }
      }

      if (minDistSq <= strokeSq) {
        if (origA > 0) {
          const factor = origA / 255;
          out[idx] = Math.round(src[idx] * factor + 255 * (1 - factor));
          out[idx + 1] = Math.round(src[idx + 1] * factor + 255 * (1 - factor));
          out[idx + 2] = Math.round(src[idx + 2] * factor + 255 * (1 - factor));
          out[idx + 3] = 255;
        } else {
          out[idx] = 255;
          out[idx + 1] = 255;
          out[idx + 2] = 255;
          out[idx + 3] = 255;
        }
      } else if (minDistSq <= outerSq && origA === 0) {
        // Đường viền bóng nhẹ bên ngoài viền trắng để tách biệt hoàn hảo với nền sáng
        out[idx] = 203;
        out[idx + 1] = 213;
        out[idx + 2] = 225;
        out[idx + 3] = 210;
      }
    }
  }

  return out;
}

interface ExtractedFrames {
  frames: Uint8Array[];
  width: number;
  height: number;
  delays: number[];
}

/**
 * Giải mã mọi định dạng ảnh Sticker từ SigStick (APNG, Multi-frame GIF, Multi-frame WebP, hoặc PNG/WebP tĩnh)
 * thành danh sách các RGBA frames thống nhất.
 */
async function extractStickerFrames(buffer: Buffer): Promise<ExtractedFrames> {
  // 1. Kiểm tra APNG nếu header là PNG
  if (isPngBuffer(buffer)) {
    try {
      const ab = buffer.buffer.slice(
        buffer.byteOffset,
        buffer.byteOffset + buffer.byteLength
      ) as ArrayBuffer;
      const img = UPNG.decode(ab);
      const rgbaList = UPNG.toRGBA8(img);
      if (rgbaList && rgbaList.length > 1) {
        const frames = rgbaList.map((f) => new Uint8Array(f.slice(0)));
        const delays = frames.map((_, i) => {
          const d = img.frames?.[i]?.delay ?? 80;
          return d >= 20 ? d : 80;
        });
        return {
          frames,
          width: img.width,
          height: img.height,
          delays,
        };
      }
    } catch (e) {
      console.warn('[UPNG decode fallback]:', e);
    }
  }

  // 2. Kiểm tra ảnh động nhiều trang (Animated WebP hoặc Animated GIF có đuôi .png/.webp)
  try {
    const meta = await sharp(buffer, { animated: true }).metadata();
    const pages = meta.pages ?? 1;
    if (pages > 1) {
      const { data, info } = await sharp(buffer, { animated: true, pages: -1 })
        .ensureAlpha()
        .raw()
        .toBuffer({ resolveWithObject: true });

      const frameWidth = info.width;
      const frameHeight = meta.pageHeight || Math.floor(info.height / pages);
      const frameByteLen = frameWidth * frameHeight * 4;
      const frames: Uint8Array[] = [];

      for (let i = 0; i < pages; i++) {
        const start = i * frameByteLen;
        const end = start + frameByteLen;
        if (end <= data.length) {
          frames.push(new Uint8Array(data.subarray(start, end)));
        }
      }

      if (frames.length > 1) {
        const rawDelays = Array.isArray(meta.delay) ? meta.delay : [];
        const delays = frames.map((_, i) => {
          const d = rawDelays[i] ?? 80;
          return d >= 20 ? d : 80;
        });
        return {
          frames,
          width: frameWidth,
          height: frameHeight,
          delays,
        };
      }
    }
  } catch (e) {
    console.warn('[Animated sharp decode fallback]:', e);
  }

  // 3. Mặc định: Ảnh tĩnh 1 frame
  const { data, info } = await sharp(buffer, { animated: false })
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  return {
    frames: [new Uint8Array(data)],
    width: info.width,
    height: info.height,
    delays: [90],
  };
}

/**
 * Tạo file Animated GIF chuẩn GIF89a tương thích 100% với Zalo Mobile, Zalo PC & Messenger:
 * - Tự động tách nền & khử răng cưa
 * - Thêm viền trắng Die-Cut nổi bật quanh nhân vật
 * - Hòa trộn nền tiệp màu khung chat Zalo để tuyệt đối không bị nền đen hay nền trắng
 * - Nếu ảnh gốc chỉ có 1 frame tĩnh, tự động tạo chuyển động nhún nhảy (6 frames) để Zalo luôn phát động mượt mà
 * - Chuẩn hóa qua libvips/cgif để bảng màu Global Color Table và LZW Code Size hợp lệ trên mọi thiết bị Android/iOS
 */
async function buildZaloCompatibleGif(
  buffer: Buffer,
  bgMode: BgMode,
  removeBg: boolean,
  targetSize: number,
  addStroke: boolean
): Promise<Buffer> {
  const extracted = await extractStickerFrames(buffer);
  const bgRgb = getBgRgb(bgMode);
  const strokeRadius = Math.max(2, Math.round(targetSize * 0.017));
  const padRatio = addStroke ? 0.08 : 0.04;

  // Chuẩn bị danh sách frame đã tách nền và thu phóng
  const processedFrames: Uint8Array[] = [];
  const frameDelays: number[] = [];

  if (extracted.frames.length === 1) {
    // Sticker gốc là ảnh tĩnh 1 frame -> tạo hiệu ứng nhún nhảy 6 frames để khi gửi GIF qua Zalo luôn chuyển động sống động
    const baseFrame = new Uint8Array(extracted.frames[0]);
    if (removeBg) {
      autoRemoveBackgroundRgba(baseFrame, extracted.width, extracted.height);
    }
    const bounceShifts = [0, -2, -4, -2, 0, 1];
    for (const yShift of bounceShifts) {
      let scaled = resizeRgbaWithPadding(
        baseFrame,
        extracted.width,
        extracted.height,
        targetSize,
        padRatio,
        yShift
      );
      if (addStroke) {
        scaled = addDieCutOutlineRgba(scaled, targetSize, targetSize, strokeRadius);
      }
      processedFrames.push(scaled);
      frameDelays.push(90);
    }
  } else {
    for (let i = 0; i < extracted.frames.length; i++) {
      const rawFrame = new Uint8Array(extracted.frames[i]);
      if (removeBg) {
        autoRemoveBackgroundRgba(rawFrame, extracted.width, extracted.height);
      }
      let scaled = resizeRgbaWithPadding(
        rawFrame,
        extracted.width,
        extracted.height,
        targetSize,
        padRatio,
        0
      );
      if (addStroke) {
        scaled = addDieCutOutlineRgba(scaled, targetSize, targetSize, strokeRadius);
      }
      processedFrames.push(scaled);
      frameDelays.push(extracted.delays[i] ?? 80);
    }
  }

  const gif = GIFEncoder();
  const useTransparency = !bgRgb;
  const fallbackBg = bgRgb || { r: 226, g: 233, b: 241 };

  for (let i = 0; i < processedFrames.length; i++) {
    const frame = processedFrames[i];
    const composited = new Uint8Array(frame.length);

    for (let p = 0; p < frame.length; p += 4) {
      const r = frame[p];
      const g = frame[p + 1];
      const b = frame[p + 2];
      const a = frame[p + 3];

      if (bgRgb) {
        const alpha = a / 255;
        composited[p] = Math.round(r * alpha + bgRgb.r * (1 - alpha));
        composited[p + 1] = Math.round(g * alpha + bgRgb.g * (1 - alpha));
        composited[p + 2] = Math.round(b * alpha + bgRgb.b * (1 - alpha));
        composited[p + 3] = 255;
      } else {
        if (a < 120) {
          composited[p] = fallbackBg.r;
          composited[p + 1] = fallbackBg.g;
          composited[p + 2] = fallbackBg.b;
          composited[p + 3] = 0;
        } else {
          composited[p] = r;
          composited[p + 1] = g;
          composited[p + 2] = b;
          composited[p + 3] = 255;
        }
      }
    }

    const fmt = useTransparency ? 'rgba4444' : 'rgb565';
    const palette = quantize(composited, 256, {
      format: fmt,
      oneBitAlpha: useTransparency,
    });
    const index = applyPalette(composited, palette, fmt);
    const transparentIndex = useTransparency
      ? palette.findIndex((color: number[]) => color[3] === 0)
      : -1;

    // Pad bảng màu đủ 256 màu (8-bit) để khớp tuyệt đối với LZW minimum code size = 8 của gifenc
    while (palette.length < 256) {
      palette.push(
        useTransparency
          ? [fallbackBg.r, fallbackBg.g, fallbackBg.b, 255]
          : [fallbackBg.r, fallbackBg.g, fallbackBg.b]
      );
    }

    gif.writeFrame(index, targetSize, targetSize, {
      palette,
      delay: frameDelays[i],
      repeat: i === 0 ? 0 : undefined,
      transparent: useTransparency && transparentIndex >= 0,
      transparentIndex: transparentIndex >= 0 ? transparentIndex : 0,
      dispose: useTransparency ? 2 : 1,
    });
  }

  gif.finish();
  const rawGifBuffer = Buffer.from(gif.bytes());

  // Chuẩn hóa lần cuối qua libvips (cgif) để gộp Global Color Table chuẩn chỉnh cho trình phát Zalo Android/iOS
  try {
    return await sharp(rawGifBuffer, { animated: true, pages: -1 })
      .gif({ loop: 0 })
      .toBuffer();
  } catch {
    return rawGifBuffer;
  }
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const rawTarget = searchParams.get('url');
  const format = (searchParams.get('format') || 'png').toLowerCase(); // png | gif | webp | raw
  const bg = (searchParams.get('bg') || 'zalo-mobile') as BgMode;
  const removeBg = searchParams.get('removeBg') !== '0';
  const addStroke = searchParams.get('stroke') !== '0';
  const sizeParam = parseInt(searchParams.get('size') || '180', 10);
  const size = Math.min(Math.max(sizeParam || 180, 96), 1024);

  if (!rawTarget) {
    return NextResponse.json({ error: 'Missing url parameter' }, { status: 400 });
  }

  const normalizedUrl = normalizeCdnUrl(rawTarget);
  let parsedUrl: URL;
  try {
    parsedUrl = new URL(normalizedUrl);
  } catch {
    return NextResponse.json({ error: 'Invalid url parameter' }, { status: 400 });
  }

  if (!ALLOWED_HOSTS.has(parsedUrl.hostname)) {
    return NextResponse.json({ error: 'Disallowed host' }, { status: 403 });
  }

  try {
    const upstream = await fetch(normalizedUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) SigStickWebClient/1.0',
      },
    });

    if (!upstream.ok) {
      return NextResponse.json(
        { error: `Failed to fetch sticker: ${upstream.status}` },
        { status: upstream.status }
      );
    }

    const arrayBuffer = await upstream.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // 1. Trả về nguyên bản có CORS header nếu format=raw
    if (format === 'raw') {
      const contentType = upstream.headers.get('content-type') || 'image/webp';
      return new NextResponse(new Uint8Array(buffer), {
        headers: {
          'Content-Type': contentType,
          'Cache-Control': 'public, max-age=86400',
          'Access-Control-Allow-Origin': '*',
        },
      });
    }

    // 2. Chuyển đổi sang GIF chuẩn Zalo & Messenger (Hoạt động 100%, có viền Die-Cut, không nền đen/trắng)
    if (format === 'gif') {
      const gifSize = Math.min(size, 360);
      const outGif = await buildZaloCompatibleGif(
        buffer,
        bg,
        removeBg,
        gifSize,
        addStroke
      );
      return new NextResponse(new Uint8Array(outGif), {
        headers: {
          'Content-Type': 'image/gif',
          'Content-Disposition': 'inline; filename="sticker-zalo.gif"',
          'Cache-Control': 'public, max-age=86400',
          'Access-Control-Allow-Origin': '*',
        },
      });
    }

    // 3. Mặc định: Chuyển đổi sang PNG chuẩn kích thước Mobile, tự động tách nền + viền trắng Die-Cut + chống nền đen/trắng
    const { data: rawPixels, info } = await sharp(buffer, { animated: false })
      .ensureAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });

    if (removeBg) {
      autoRemoveBackgroundRgba(rawPixels, info.width, info.height);
    }

    const padRatio = addStroke ? 0.08 : 0.04;
    let scaledRgba = resizeRgbaWithPadding(
      new Uint8Array(rawPixels),
      info.width,
      info.height,
      size,
      padRatio,
      0
    );

    if (addStroke) {
      const strokeRadius = Math.max(2, Math.round(size * 0.017));
      scaledRgba = addDieCutOutlineRgba(scaledRgba, size, size, strokeRadius);
    }

    const bgRgb = getBgRgb(bg);
    const finalRgba = new Uint8Array(scaledRgba.length);

    for (let p = 0; p < scaledRgba.length; p += 4) {
      const r = scaledRgba[p];
      const g = scaledRgba[p + 1];
      const b = scaledRgba[p + 2];
      const a = scaledRgba[p + 3];

      if (bgRgb) {
        const alpha = a / 255;
        finalRgba[p] = Math.round(r * alpha + bgRgb.r * (1 - alpha));
        finalRgba[p + 1] = Math.round(g * alpha + bgRgb.g * (1 - alpha));
        finalRgba[p + 2] = Math.round(b * alpha + bgRgb.b * (1 - alpha));
        finalRgba[p + 3] = 255;
      } else {
        if (a === 0) {
          // Đặt RGB ẩn dưới pixel trong suốt là màu sáng để trình đọc ảnh không bao giờ hiển thị màu đen (0,0,0)
          finalRgba[p] = 226;
          finalRgba[p + 1] = 233;
          finalRgba[p + 2] = 241;
          finalRgba[p + 3] = 0;
        } else {
          finalRgba[p] = r;
          finalRgba[p + 1] = g;
          finalRgba[p + 2] = b;
          finalRgba[p + 3] = a;
        }
      }
    }

    const outPng = await sharp(finalRgba, {
      raw: {
        width: size,
        height: size,
        channels: 4,
      },
    })
      .png({ compressionLevel: 8 })
      .toBuffer();

    return new NextResponse(new Uint8Array(outPng), {
      headers: {
        'Content-Type': 'image/png',
        'Content-Disposition': 'inline; filename="sticker-zalo.png"',
        'Cache-Control': 'public, max-age=86400',
        'Access-Control-Allow-Origin': '*',
      },
    });
  } catch (err: any) {
    console.error('[API /api/sticker/convert error]:', err);
    return NextResponse.json(
      { error: err?.message || 'Conversion failed' },
      { status: 500 }
    );
  }
}
