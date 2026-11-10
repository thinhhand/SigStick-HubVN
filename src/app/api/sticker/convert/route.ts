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

type BgMode = 'transparent' | 'zalo-light' | 'zalo-dark' | 'white' | 'dark';

function getBgRgb(bgMode: BgMode): { r: number; g: number; b: number } | null {
  switch (bgMode) {
    case 'zalo-light':
      return { r: 235, g: 236, b: 240 }; // #ebecf0 - màu nền khung chat Zalo Light
    case 'zalo-dark':
      return { r: 34, g: 38, b: 43 }; // #22262b - màu nền khung chat Zalo Dark
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
            // Làm mượt biên chống răng cưa (Feathering & De-contamination)
            visited[np] = 2;
            const factor = (d - tolerance) / (softTolerance - tolerance);
            const newAlpha = Math.round(data[nidx + 3] * factor);
            if (newAlpha < 24) {
              data[nidx] = 0;
              data[nidx + 1] = 0;
              data[nidx + 2] = 0;
              data[nidx + 3] = 0;
            } else {
              // Khử màu nền bị pha vào pixel biên
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

  // Bước 2: Khử viền sáng/trắng (De-halo / Un-premultiply white matte) trên toàn bộ các pixel bán trong suốt ở rìa sticker
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
      // Nếu là bóng mờ trắng ở rìa ngoài (alpha thấp và màu rất sáng) -> xóa hẳn để không bị nổi viền trắng
      if (a < 95 && r > 220 && g > 220 && b > 220) {
        data[idx] = 0;
        data[idx + 1] = 0;
        data[idx + 2] = 0;
        data[idx + 3] = 0;
      } else {
        const alpha = a / 255;
        // Tách bỏ lượng màu trắng (255,255,255) bị pha sẵn vào biên khi thiết kế trên nền trắng
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
 * Thu phóng buffer RGBA (Nearest/Bilinear kết hợp) về kích thước nhỏ gọn cho Sticker Mobile
 */
function resizeRgbaFrame(
  src: Uint8Array,
  srcW: number,
  srcH: number,
  dstW: number,
  dstH: number
): Uint8Array {
  if (srcW === dstW && srcH === dstH) return src;
  const dst = new Uint8Array(dstW * dstH * 4);
  const scale = Math.min(dstW / srcW, dstH / srcH);
  const drawW = Math.max(1, Math.round(srcW * scale));
  const drawH = Math.max(1, Math.round(srcH * scale));
  const offsetX = Math.floor((dstW - drawW) / 2);
  const offsetY = Math.floor((dstH - drawH) / 2);

  for (let y = 0; y < drawH; y++) {
    const sy = Math.min(srcH - 1, Math.floor((y / drawH) * srcH));
    for (let x = 0; x < drawW; x++) {
      const sx = Math.min(srcW - 1, Math.floor((x / drawW) * srcW));
      const sIdx = (sy * srcW + sx) * 4;
      const dIdx = ((y + offsetY) * dstW + (x + offsetX)) * 4;
      dst[dIdx] = src[sIdx];
      dst[dIdx + 1] = src[sIdx + 1];
      dst[dIdx + 2] = src[sIdx + 2];
      dst[dIdx + 3] = src[sIdx + 3];
    }
  }
  return dst;
}

/**
 * Chuyển đổi APNG nhiều frame sang Animated GIF bằng upng-js + gifenc (hỗ trợ tự tách nền & thu nhỏ kích thước vừa khung chat Mobile)
 */
function convertApngToGif(
  buffer: Buffer,
  bgMode: BgMode,
  removeBg = true,
  targetSize = 240
): Uint8Array | null {
  try {
    const ab = buffer.buffer.slice(
      buffer.byteOffset,
      buffer.byteOffset + buffer.byteLength
    ) as ArrayBuffer;
    const img = UPNG.decode(ab);
    const rgbaFrames = UPNG.toRGBA8(img);

    if (!rgbaFrames || rgbaFrames.length <= 1) {
      return null; // Không phải ảnh động nhiều frame
    }

    const srcWidth = img.width;
    const srcHeight = img.height;
    const width = Math.min(srcWidth, targetSize);
    const height = Math.min(srcHeight, targetSize);
    const gif = GIFEncoder();
    const bgRgb = getBgRgb(bgMode);

    for (let i = 0; i < rgbaFrames.length; i++) {
      const rawFrame = new Uint8Array(rgbaFrames[i].slice(0));
      if (removeBg) {
        autoRemoveBackgroundRgba(rawFrame, srcWidth, srcHeight);
      }

      const scaledFrame = resizeRgbaFrame(
        rawFrame,
        srcWidth,
        srcHeight,
        width,
        height
      );

      const processed = new Uint8Array(scaledFrame.length);

      for (let p = 0; p < scaledFrame.length; p += 4) {
        const r = scaledFrame[p];
        const g = scaledFrame[p + 1];
        const b = scaledFrame[p + 2];
        const a = scaledFrame[p + 3];

        if (bgRgb) {
          const alpha = a / 255;
          processed[p] = Math.round(r * alpha + bgRgb.r * (1 - alpha));
          processed[p + 1] = Math.round(g * alpha + bgRgb.g * (1 - alpha));
          processed[p + 2] = Math.round(b * alpha + bgRgb.b * (1 - alpha));
          processed[p + 3] = 255;
        } else {
          // Chế độ trong suốt (transparent): GIF chỉ hỗ trợ 1-bit alpha (0 hoặc 255)
          if (a < 120) {
            processed[p] = 0;
            processed[p + 1] = 0;
            processed[p + 2] = 0;
            processed[p + 3] = 0;
          } else {
            processed[p] = r;
            processed[p + 1] = g;
            processed[p + 2] = b;
            processed[p + 3] = 255;
          }
        }
      }

      const useTransparency = !bgRgb;
      const fmt = useTransparency ? 'rgba4444' : 'rgb565';
      const palette = quantize(processed, 256, {
        format: fmt,
        oneBitAlpha: useTransparency,
      });
      const index = applyPalette(processed, palette, fmt);
      const transparentIndex = useTransparency
        ? palette.findIndex((color: number[]) => color[3] === 0)
        : -1;

      const rawDelay = img.frames?.[i]?.delay ?? 80;
      const delayMs = rawDelay > 10 ? rawDelay : 80;

      gif.writeFrame(index, width, height, {
        palette,
        delay: delayMs,
        transparent: transparentIndex >= 0,
        transparentIndex: transparentIndex >= 0 ? transparentIndex : 0,
        dispose: 2,
      });
    }

    gif.finish();
    return gif.bytes();
  } catch (err) {
    console.warn('[APNG -> GIF fallback warning]:', err);
    return null;
  }
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const rawTarget = searchParams.get('url');
  const format = (searchParams.get('format') || 'png').toLowerCase(); // png | gif | webp | raw
  const bg = (searchParams.get('bg') || 'transparent') as BgMode;
  const removeBg = searchParams.get('removeBg') !== '0';
  const sizeParam = parseInt(searchParams.get('size') || '240', 10);
  const size = Math.min(Math.max(sizeParam || 240, 96), 1024);

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

    // 2. Chuyển đổi sang GIF (Tương thích gửi sticker động qua Messenger & Zalo)
    if (format === 'gif') {
      const gifSize = Math.min(size, 420);
      // Nếu file gốc là PNG (có thể là APNG động trên SigStick), ưu tiên giải mã APNG
      if (isPngBuffer(buffer)) {
        const apngGifBytes = convertApngToGif(buffer, bg, removeBg, gifSize);
        if (apngGifBytes) {
          return new NextResponse(new Uint8Array(apngGifBytes), {
            headers: {
              'Content-Type': 'image/gif',
              'Content-Disposition': 'inline; filename="sticker.gif"',
              'Cache-Control': 'public, max-age=86400',
              'Access-Control-Allow-Origin': '*',
            },
          });
        }
      }

      // Kiểm tra xem WebP có nhiều frame hay ảnh tĩnh
      const meta = await sharp(buffer, { animated: true }).metadata();
      const isAnimatedWebp = (meta.pages ?? 1) > 1;
      const bgRgb = getBgRgb(bg);

      if (!isAnimatedWebp) {
        // Ảnh tĩnh chuyển sang GIF -> chạy qua bộ tự động tách nền & khử viền trắng
        const { data: rawData, info } = await sharp(buffer, { animated: false })
          .ensureAlpha()
          .raw()
          .toBuffer({ resolveWithObject: true });

        if (removeBg) {
          autoRemoveBackgroundRgba(rawData, info.width, info.height);
        }

        let singleGifPipeline = sharp(rawData, {
          raw: { width: info.width, height: info.height, channels: 4 },
        }).resize(gifSize, gifSize, {
          fit: 'contain',
          background: bgRgb
            ? { r: bgRgb.r, g: bgRgb.g, b: bgRgb.b, alpha: 1 }
            : { r: 0, g: 0, b: 0, alpha: 0 },
        });

        if (bgRgb) {
          singleGifPipeline = singleGifPipeline.flatten({ background: bgRgb });
        }

        const outSingleGif = await singleGifPipeline.gif().toBuffer();
        return new NextResponse(new Uint8Array(outSingleGif), {
          headers: {
            'Content-Type': 'image/gif',
            'Content-Disposition': 'inline; filename="sticker.gif"',
            'Cache-Control': 'public, max-age=86400',
            'Access-Control-Allow-Origin': '*',
          },
        });
      }

      // Nếu là Animated WebP nhiều frame
      let pipeline = sharp(buffer, { animated: true, pages: -1 }).resize(gifSize, gifSize, {
        fit: 'contain',
        background: bgRgb
          ? { r: bgRgb.r, g: bgRgb.g, b: bgRgb.b, alpha: 1 }
          : { r: 0, g: 0, b: 0, alpha: 0 },
      });

      if (bgRgb) {
        pipeline = pipeline.flatten({ background: bgRgb });
      }

      const outGif = await pipeline.gif({ loop: 0 }).toBuffer();
      return new NextResponse(new Uint8Array(outGif), {
        headers: {
          'Content-Type': 'image/gif',
          'Content-Disposition': 'inline; filename="sticker.gif"',
          'Cache-Control': 'public, max-age=86400',
          'Access-Control-Allow-Origin': '*',
        },
      });
    }

    // 3. Mặc định: Chuyển đổi sang PNG chuẩn đã tự động tách nền & khử răng cưa trắng
    const { data: rawPixels, info } = await sharp(buffer, { animated: false })
      .ensureAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });

    if (removeBg) {
      autoRemoveBackgroundRgba(rawPixels, info.width, info.height);
    }

    const bgRgb = getBgRgb(bg);
    let pngPipeline = sharp(rawPixels, {
      raw: {
        width: info.width,
        height: info.height,
        channels: 4,
      },
    }).resize(size, size, {
      fit: 'contain',
      background: bgRgb
        ? { r: bgRgb.r, g: bgRgb.g, b: bgRgb.b, alpha: 1 }
        : { r: 0, g: 0, b: 0, alpha: 0 },
    });

    if (bgRgb) {
      pngPipeline = pngPipeline.flatten({ background: bgRgb });
    }

    const outPng = await pngPipeline.png({ compressionLevel: 8 }).toBuffer();
    return new NextResponse(new Uint8Array(outPng), {
      headers: {
        'Content-Type': 'image/png',
        'Content-Disposition': 'inline; filename="sticker.png"',
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
