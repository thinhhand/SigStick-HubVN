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

  const opaqueSamples: Array<[number, number, number, number, number]> = [];
  for (const [cx, cy] of samplePoints) {
    if (cx < 0 || cx >= width || cy < 0 || cy >= height) continue;
    const idx = (cy * width + cx) * 4;
    const a = data[idx + 3];
    if (a > 200) {
      opaqueSamples.push([cx, cy, data[idx], data[idx + 1], data[idx + 2]]);
    }
  }

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
 * Nâng độ phân giải Sticker lên tối đa bằng thuật toán nội suy Lanczos-3 (sharp.kernel.lanczos3)
 * kết hợp làm nét thông minh (Unsharp Masking) và chừa lề an toàn cho viền Die-Cut.
 */
async function resizeRgbaHighRes(
  src: Uint8Array,
  srcW: number,
  srcH: number,
  dstSize: number,
  padRatio = 0.075,
  yShift = 0
): Promise<Uint8Array> {
  const pad = Math.max(4, Math.round(dstSize * padRatio));
  const avail = Math.max(32, dstSize - pad * 2);
  const topPad = Math.max(0, Math.min(dstSize - avail, pad + yShift));
  const bottomPad = Math.max(0, dstSize - avail - topPad);
  const leftPad = pad;
  const rightPad = Math.max(0, dstSize - avail - leftPad);

  const outBuf = await sharp(Buffer.from(src.buffer, src.byteOffset, src.byteLength), {
    raw: { width: srcW, height: srcH, channels: 4 },
  })
    .resize(avail, avail, {
      fit: 'contain',
      kernel: sharp.kernel.lanczos3,
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    })
    .sharpen({ sigma: 0.65, m1: 0.7, m2: 1.5 })
    .extend({
      top: topPad,
      bottom: bottomPad,
      left: leftPad,
      right: rightPad,
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    })
    .raw()
    .toBuffer();

  return new Uint8Array(outBuf);
}

/**
 * Thuật toán 2-Pass Exact 2D Euclidean Distance Transform (Felzenszwalb & Huttenlocher)
 * độ phức tạp tuyến tính O(W * H), giúp tính khoảng cách chính xác tới từng sub-pixel ở độ phân giải 1024x1024 chỉ trong vài ms.
 */
function computeEdt2d(
  mask: Uint8Array,
  width: number,
  height: number
): Float32Array | null {
  const INF = 1e9;
  const maxDim = Math.max(width, height);
  const f = new Float64Array(maxDim);
  const v = new Int32Array(maxDim);
  const z = new Float64Array(maxDim + 1);
  const grid = new Float32Array(width * height);

  let hasForeground = false;
  const total = width * height;
  for (let i = 0; i < total; i++) {
    if (mask[i]) {
      grid[i] = 0;
      hasForeground = true;
    } else {
      grid[i] = INF;
    }
  }
  if (!hasForeground) return null;

  // Pass 1: dọc theo từng cột
  for (let x = 0; x < width; x++) {
    for (let y = 0; y < height; y++) f[y] = grid[y * width + x];
    let k = 0;
    v[0] = 0;
    z[0] = -INF;
    z[1] = INF;
    for (let q = 1; q < height; q++) {
      let s = (f[q] + q * q - (f[v[k]] + v[k] * v[k])) / (2 * q - 2 * v[k]);
      while (s <= z[k]) {
        k--;
        s = (f[q] + q * q - (f[v[k]] + v[k] * v[k])) / (2 * q - 2 * v[k]);
      }
      k++;
      v[k] = q;
      z[k] = s;
      z[k + 1] = INF;
    }
    k = 0;
    for (let q = 0; q < height; q++) {
      while (z[k + 1] < q) k++;
      const dy = q - v[k];
      grid[q * width + x] = dy * dy + f[v[k]];
    }
  }

  // Pass 2: ngang theo từng hàng
  for (let y = 0; y < height; y++) {
    const rowOffset = y * width;
    for (let x = 0; x < width; x++) f[x] = grid[rowOffset + x];
    let k = 0;
    v[0] = 0;
    z[0] = -INF;
    z[1] = INF;
    for (let q = 1; q < width; q++) {
      let s = (f[q] + q * q - (f[v[k]] + v[k] * v[k])) / (2 * q - 2 * v[k]);
      while (s <= z[k]) {
        k--;
        s = (f[q] + q * q - (f[v[k]] + v[k] * v[k])) / (2 * q - 2 * v[k]);
      }
      k++;
      v[k] = q;
      z[k] = s;
      z[k + 1] = INF;
    }
    k = 0;
    for (let q = 0; q < width; q++) {
      while (z[k + 1] < q) k++;
      const dx = q - v[k];
      grid[rowOffset + q] = Math.sqrt(dx * dx + f[v[k]]);
    }
  }

  return grid;
}

/**
 * Tạo viền trắng Die-Cut độ phân giải cao khử răng cưa mượt mà (Sub-pixel Anti-Aliased Outline)
 * kèm đường contour dịu nhẹ (#cbd5e1) giúp cả các sticker màu trắng nổi bật sắc nét.
 */
function addDieCutOutlineRgba(
  src: Uint8Array,
  width: number,
  height: number,
  strokeRadius = 6
): Uint8Array {
  const total = width * height;
  const mask = new Uint8Array(total);
  for (let i = 0; i < total; i++) {
    if (src[i * 4 + 3] >= 115) {
      mask[i] = 1;
    }
  }

  const distGrid = computeEdt2d(mask, width, height);
  if (!distGrid) return src;

  const out = new Uint8Array(src.length);
  out.set(src);

  const outerLimit = strokeRadius + 1.35;

  for (let i = 0; i < total; i++) {
    const idx = i * 4;
    const origA = src[idx + 3];
    if (origA >= 245) continue;

    const d = distGrid[i];
    if (d > outerLimit) continue;

    if (d <= strokeRadius) {
      // Bên trong vùng viền trắng Die-Cut
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
    } else if (origA === 0) {
      // Rìa ngoài chống răng cưa mượt mà (Sub-pixel feathering + subtle #cbd5e1 contour)
      const edgeProgress = (d - strokeRadius) / (outerLimit - strokeRadius);
      const contourAlpha = Math.round(215 * Math.max(0, 1 - edgeProgress));
      out[idx] = 203;
      out[idx + 1] = 213;
      out[idx + 2] = 225;
      out[idx + 3] = contourAlpha;
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
 * ở độ phân giải gốc tối đa.
 */
async function extractStickerFrames(buffer: Buffer): Promise<ExtractedFrames> {
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
 * Tạo file Animated GIF chuẩn HD sắc nét cho Zalo Mobile, Zalo PC & Messenger:
 * - Upscale bằng Lanczos-3 + Unsharp Mask
 * - Viền trắng Die-Cut khử răng cưa bằng 2D Euclidean Distance Transform
 * - Lượng tử hóa bảng màu 24-bit Truecolor (rgb888) giữ trọn chi tiết màu sắc
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
  const strokeRadius = Math.max(3, Math.round(targetSize * 0.018));
  const padRatio = addStroke ? 0.075 : 0.035;

  const processedFrames: Uint8Array[] = [];
  const frameDelays: number[] = [];

  if (extracted.frames.length === 1) {
    const baseFrame = new Uint8Array(extracted.frames[0]);
    if (removeBg) {
      autoRemoveBackgroundRgba(baseFrame, extracted.width, extracted.height);
    }
    const step = Math.max(2, Math.round(targetSize * 0.01));
    const bounceShifts = [0, -step, -step * 2, -step, 0, Math.round(step * 0.5)];
    for (const yShift of bounceShifts) {
      let scaled = await resizeRgbaHighRes(
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
      let scaled = await resizeRgbaHighRes(
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

    // Mặc định (undefined) trong gifenc là rgb888 (24-bit Truecolor) giúp giữ trọn chi tiết màu sắc, không bị bệt màu
    const fmt = useTransparency ? ('rgba4444' as const) : undefined;
    const palette = quantize(composited, 256, {
      format: fmt,
      oneBitAlpha: useTransparency,
    });
    const index = applyPalette(composited, palette, fmt);
    const transparentIndex = useTransparency
      ? palette.findIndex((color: number[]) => color[3] === 0)
      : -1;

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
  const sizeParam = parseInt(searchParams.get('size') || '1024', 10);
  const size = Math.min(Math.max(sizeParam || 1024, 128), 1024);

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

    // 1. Trả về nguyên bản độ phân giải gốc nếu format=raw
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

    // 2. Chuyển đổi sang GIF chuẩn HD (512x512 sắc nét, 24-bit palette quantization, hoạt động 100% trên Zalo)
    if (format === 'gif') {
      const gifSize = Math.min(size, 512);
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
          'Content-Disposition': 'inline; filename="sticker-zalo-hd.gif"',
          'Cache-Control': 'public, max-age=86400',
          'Access-Control-Allow-Origin': '*',
        },
      });
    }

    // 3. Mặc định: Chuyển đổi sang PNG độ phân giải tối đa (lên tới 1024x1024 Ultra HD, Lanczos-3 + Sharpen + Viền Die-Cut mượt)
    const { data: rawPixels, info } = await sharp(buffer, { animated: false })
      .ensureAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });

    if (removeBg) {
      autoRemoveBackgroundRgba(rawPixels, info.width, info.height);
    }

    const padRatio = addStroke ? 0.075 : 0.035;
    let scaledRgba = await resizeRgbaHighRes(
      new Uint8Array(rawPixels),
      info.width,
      info.height,
      size,
      padRatio,
      0
    );

    if (addStroke) {
      const strokeRadius = Math.max(3, Math.round(size * 0.018));
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
      .png({ compressionLevel: 6, adaptiveFiltering: true, quality: 100 })
      .toBuffer();

    return new NextResponse(new Uint8Array(outPng), {
      headers: {
        'Content-Type': 'image/png',
        'Content-Disposition': 'inline; filename="sticker-zalo-uhd.png"',
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
