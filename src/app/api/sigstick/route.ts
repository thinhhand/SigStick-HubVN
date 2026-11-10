import { NextRequest, NextResponse } from 'next/server';
import {
  SIGSTICK_API_HOST,
  StickerPack,
  extractPackIdFromInput,
} from '@/lib/sigstick';

const DEFAULT_HEADERS = {
  Accept: 'application/json',
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) SigStickWebClient/1.0',
};

async function fetchJson(url: string) {
  const res = await fetch(url, {
    headers: DEFAULT_HEADERS,
    next: { revalidate: 300 },
  });
  if (!res.ok) {
    throw new Error(`Upstream HTTP ${res.status} for ${url}`);
  }
  return res.json();
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const action = searchParams.get('action') || 'discover';
  const region = searchParams.get('region') || 'vn';
  const startAfter = searchParams.get('startAfter') || '';
  const keyword = searchParams.get('keyword') || '';
  const packId = searchParams.get('id') || '';
  const category = searchParams.get('category') || 'trending'; // trending | top | new

  try {
    if (action === 'pack') {
      if (!packId) {
        return NextResponse.json({ error: 'Missing pack id' }, { status: 400 });
      }
      const cleanId = extractPackIdFromInput(packId) || packId;
      const data = await fetchJson(
        `${SIGSTICK_API_HOST}/v1/stickerPack/${encodeURIComponent(cleanId)}?fresh=0`
      );
      return NextResponse.json({
        status: 'ok',
        pack: data?.data || null,
      });
    }

    if (action === 'suggestions') {
      const q = keyword.trim();
      const url = q
        ? `${SIGSTICK_API_HOST}/v1/search/suggestions?keyword=${encodeURIComponent(q)}`
        : `${SIGSTICK_API_HOST}/v1/search/suggestions`;
      const data = await fetchJson(url);
      return NextResponse.json({
        status: 'ok',
        suggestions: Array.isArray(data?.data) ? data.data : [],
      });
    }

    if (action === 'featured') {
      const data = await fetchJson(`${SIGSTICK_API_HOST}/v1/featured`);
      return NextResponse.json({
        status: 'ok',
        items: data?.data?.items || [],
      });
    }

    if (action === 'search') {
      const q = keyword.trim();
      if (!q) {
        return NextResponse.json({ status: 'ok', packs: [] });
      }

      // Kiểm tra xem người dùng có dán link SigStick hoặc Pack ID trực tiếp không
      const extractedId = extractPackIdFromInput(q);
      const promises: Promise<any>[] = [
        fetchJson(
          `${SIGSTICK_API_HOST}/v1/stickerPack?keyword=${encodeURIComponent(q)}`
        ).catch(() => null),
        fetchJson(
          `${SIGSTICK_API_HOST}/v1/search/tagged?keyword=${encodeURIComponent(q)}`
        ).catch(() => null),
        fetchJson(
          `${SIGSTICK_API_HOST}/v1/search/related?keyword=${encodeURIComponent(q)}`
        ).catch(() => null),
      ];

      if (extractedId) {
        promises.unshift(
          fetchJson(
            `${SIGSTICK_API_HOST}/v1/stickerPack/${encodeURIComponent(extractedId)}?fresh=0`
          ).catch(() => null)
        );
      }

      const results = await Promise.all(promises);
      const seen = new Set<string>();
      const merged: StickerPack[] = [];

      const addPack = (p?: StickerPack | null) => {
        if (p && p.id && Array.isArray(p.stickers) && p.stickers.length > 0 && !seen.has(p.id)) {
          seen.add(p.id);
          merged.push(p);
        }
      };

      if (extractedId) {
        const directRes = results.shift();
        if (directRes?.data?.id) {
          addPack(directRes.data);
        }
      }

      const [keywordRes, taggedRes, relatedRes] = results;
      if (Array.isArray(keywordRes?.data)) {
        keywordRes.data.forEach(addPack);
      }
      if (Array.isArray(taggedRes?.data?.stickerPacks)) {
        taggedRes.data.stickerPacks.forEach(addPack);
      }
      if (Array.isArray(relatedRes?.data?.stickerPacks)) {
        relatedRes.data.stickerPacks.forEach(addPack);
      }

      return NextResponse.json({
        status: 'ok',
        packs: merged,
      });
    }

    // Mặc định: discover (trending | top | new)
    let endpoint = '/v1/stickerPack/trending';
    if (category === 'top') endpoint = '/v1/stickerPack';
    if (category === 'new') endpoint = '/v1/stickerPack/new';

    const params = new URLSearchParams();
    if (region) params.set('region', region);
    if (startAfter && startAfter !== '0') params.set('startAfter', startAfter);

    const url = `${SIGSTICK_API_HOST}${endpoint}?${params.toString()}`;
    const data = await fetchJson(url);

    return NextResponse.json({
      status: 'ok',
      packs: data?.data?.packs || [],
      nextStartAfter: data?.data?.nextStartAfter ?? 0,
    });
  } catch (error: any) {
    console.error('[API /api/sigstick error]:', error);
    return NextResponse.json(
      { status: 'error', message: error?.message || 'Internal Server Error', packs: [] },
      { status: 500 }
    );
  }
}
