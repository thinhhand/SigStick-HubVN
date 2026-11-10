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
 * Chuyển đổi APNG nhiều frame sang Animated GIF bằng upng-js + gifenc
 */
function convertApngToGif(
  buffer: Buffer,
  bgMode: BgMode
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

    const width = img.width;
    const height = img.height;
    const gif = GIFEncoder();
    const bgRgb = getBgRgb(bgMode);

    for (let i = 0; i < rgbaFrames.length; i++) {
      const rawFrame = new Uint8Array(rgbaFrames[i]);
      const processed = new Uint8Array(rawFrame.length);

      for (let p = 0; p < rawFrame.length; p += 4) {
        const r = rawFrame[p];
        const g = rawFrame[p + 1];
        const b = rawFrame[p + 2];
        const a = rawFrame[p + 3];

        if (bgRgb) {
          const alpha = a / 255;
          processed[p] = Math.round(r * alpha + bgRgb.r * (1 - alpha));
          processed[p + 1] = Math.round(g * alpha + bgRgb.g * (1 - alpha));
          processed[p + 2] = Math.round(b * alpha + bgRgb.b * (1 - alpha));
          processed[p + 3] = 255;
        } else {
          // Chế độ trong suốt (transparent): làm sạch viền bán trong suốt (chống viền trắng/đen lem nhem)
          // Đồng thời khử màu trắng trộn trong biên anti-alias (unpremultiply / de-halo)
          if (a < 110) {
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
  const sizeParam = parseInt(searchParams.get('size') || '512', 10);
  const size = Math.min(Math.max(sizeParam || 512, 128), 1024);

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
      // Nếu file gốc là PNG (có thể là APNG động trên SigStick), ưu tiên giải mã APNG
      if (isPngBuffer(buffer)) {
        const apngGifBytes = convertApngToGif(buffer, bg);
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

      // Nếu là Animated WebP hoặc ảnh tĩnh, dùng sharp với { animated: true }
      const gifSize = Math.min(size, 360);
      const bgRgb = getBgRgb(bg);
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

    // 3. Mặc định: Chuyển đổi sang PNG chuẩn (Tương thích Clipboard Copy -> Paste vào Zalo & Messenger)
    const bgRgb = getBgRgb(bg);
    let pngPipeline = sharp(buffer, { animated: false }).resize(size, size, {
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
