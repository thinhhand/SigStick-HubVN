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

// In-memory cache for SigStick API responses
const apiCache = new Map<string, { data: any; expiresAt: number }>();
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

async function fetchJsonWithCache(url: string) {
  const now = Date.now();
  const cached = apiCache.get(url);
  if (cached && cached.expiresAt > now) {
    return cached.data;
  }

  const res = await fetch(url, {
    headers: DEFAULT_HEADERS,
    next: { revalidate: 300 },
  });
  if (!res.ok) {
    throw new Error(`Upstream HTTP ${res.status} for ${url}`);
  }
  const data = await res.json();
  
  // Prune cache if oversized
  if (apiCache.size > 200) {
    const oldestKey = apiCache.keys().next().value;
    if (oldestKey) apiCache.delete(oldestKey);
  }
  apiCache.set(url, { data, expiresAt: now + CACHE_TTL_MS });
  return data;
}

function jsonResponse(data: any, maxAge = 300) {
  return NextResponse.json(data, {
    headers: {
      'Cache-Control': `public, max-age=${maxAge}, stale-while-revalidate=${maxAge * 2}`,
    },
  });
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
        return jsonResponse({ error: 'Missing pack id' }, 60);
      }
      const cleanId = extractPackIdFromInput(packId) || packId;
      const data = await fetchJsonWithCache(
        `${SIGSTICK_API_HOST}/v1/stickerPack/${encodeURIComponent(cleanId)}?fresh=0`
      );
      return jsonResponse({
        status: 'ok',
        pack: data?.data || null,
      }, 600);
    }

    if (action === 'suggestions') {
      const q = keyword.trim();
      const url = q
        ? `${SIGSTICK_API_HOST}/v1/search/suggestions?keyword=${encodeURIComponent(q)}`
        : `${SIGSTICK_API_HOST}/v1/search/suggestions`;
      const data = await fetchJsonWithCache(url);
      return jsonResponse({
        status: 'ok',
        suggestions: Array.isArray(data?.data) ? data.data : [],
      }, 300);
    }

    if (action === 'featured') {
      const data = await fetchJsonWithCache(`${SIGSTICK_API_HOST}/v1/featured`);
      return jsonResponse({
        status: 'ok',
        items: data?.data?.items || [],
      }, 600);
    }

    if (action === 'search') {
      const q = keyword.trim();
      if (!q) {
        return jsonResponse({ status: 'ok', packs: [] }, 60);
      }

      // Kiểm tra xem người dùng có dán link SigStick hoặc Pack ID trực tiếp không
      const extractedId = extractPackIdFromInput(q);
      const promises: Promise<any>[] = [
        fetchJsonWithCache(
          `${SIGSTICK_API_HOST}/v1/stickerPack?keyword=${encodeURIComponent(q)}`
        ).catch(() => null),
        fetchJsonWithCache(
          `${SIGSTICK_API_HOST}/v1/search/tagged?keyword=${encodeURIComponent(q)}`
        ).catch(() => null),
        fetchJsonWithCache(
          `${SIGSTICK_API_HOST}/v1/search/related?keyword=${encodeURIComponent(q)}`
        ).catch(() => null),
      ];

      if (extractedId) {
        promises.unshift(
          fetchJsonWithCache(
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

      return jsonResponse({
        status: 'ok',
        packs: merged,
      }, 300);
    }

    // Mặc định: discover (trending | top | new)
    let endpoint = '/v1/stickerPack/trending';
    if (category === 'top') endpoint = '/v1/stickerPack';
    if (category === 'new') endpoint = '/v1/stickerPack/new';

    const params = new URLSearchParams();
    if (region) params.set('region', region);
    if (startAfter && startAfter !== '0') params.set('startAfter', startAfter);

    const url = `${SIGSTICK_API_HOST}${endpoint}?${params.toString()}`;
    const data = await fetchJsonWithCache(url);

    return jsonResponse({
      status: 'ok',
      packs: data?.data?.packs || [],
      nextStartAfter: data?.data?.nextStartAfter ?? 0,
    }, 300);
  } catch (error: any) {
    console.error('[API /api/sigstick error]:', error);
    return jsonResponse(
      { status: 'error', message: error?.message || 'Internal Server Error', packs: [] },
      60
    );
  }
}
