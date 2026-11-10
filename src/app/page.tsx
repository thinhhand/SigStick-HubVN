"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import {
  Search,
  Flame,
  Trophy,
  Sparkles,
  Heart,
  Bookmark,
  Clock,
  Copy,
  Wand2,
  Download,
  HelpCircle,
  X,
  Check,
  Loader2,
  Layers,
  MessageCircle,
  Smartphone,
  Monitor,
  ChevronRight,
  Trash2,
  Globe,
  Maximize2,
  Share2,
} from "lucide-react";
import {
  StickerPack,
  StickerItem,
  FeaturedCollection,
  getThumbnailUrl,
  normalizeCdnUrl,
  formatCount,
  isPackAnimated,
  getEmojiString,
  extractPackIdFromInput,
} from "@/lib/sigstick";
import {
  BgMode,
  StickerSizePreset,
  STICKER_SIZE_OPTIONS,
  copyStickerToClipboard,
  getDefaultCopyBgMode,
  setDefaultCopyBgMode,
  getDefaultStickerSize,
  setDefaultStickerSize,
  shareStickerToZalo,
} from "@/lib/stickerActions";
import PackDetailModal from "@/components/PackDetailModal";
import StickerStudioModal from "@/components/StickerStudioModal";
import { APP_VERSION } from "@/config/version";

export interface SavedStickerEntry {
  key: string; // normalized sticker URL
  pack: StickerPack;
  sticker: StickerItem;
  savedAt: number;
}

const POPULAR_TAGS = [
  { label: "Meme Việt", query: "Meme" },
  { label: "Mèo Cute", query: "Cat" },
  { label: "Bubu Dudu", query: "Bubu Dudu" },
  { label: "Chiikawa", query: "Chiikawa" },
  { label: "Quby", query: "Quby" },
  { label: "Shiba", query: "Shiba" },
  { label: "Capybara", query: "Capybara" },
  { label: "Anime", query: "Anime" },
  { label: "Pepe", query: "Pepe" },
  { label: "Tình yêu", query: "Couple Love" },
  { label: "Hài hước", query: "Funny" },
  { label: "Cánh cụt", query: "Penguin" },
];

type MainTab = "discover" | "collections" | "favorites" | "saved" | "recent";
type DiscoverSubTab = "trending" | "top" | "new";

export default function SigStickHomePage() {
  // Navigation & Search states
  const [mainTab, setMainTab] = useState<MainTab>("discover");
  const [discoverTab, setDiscoverTab] = useState<DiscoverSubTab>("trending");
  const [region, setRegion] = useState<"vn" | "us" | "jp" | "kr">("vn");

  const [searchInput, setSearchInput] = useState("");
  const [activeQuery, setActiveQuery] = useState("");
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);

  // Data states
  const [packs, setPacks] = useState<StickerPack[]>([]);
  const [nextCursor, setNextCursor] = useState<number | null>(null);
  const [collections, setCollections] = useState<FeaturedCollection[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);

  // LocalStorage states
  const [favoriteStickers, setFavoriteStickers] = useState<SavedStickerEntry[]>(
    []
  );
  const [savedPacks, setSavedPacks] = useState<StickerPack[]>([]);
  const [recentStickers, setRecentStickers] = useState<SavedStickerEntry[]>([]);
  const [copyBgMode, setCopyBgMode] = useState<BgMode>("zalo-mobile");
  const [stickerSize, setStickerSize] = useState<StickerSizePreset>(1024);

  // Modals & Active Selections
  const [selectedPack, setSelectedPack] = useState<StickerPack | null>(null);
  const [isLoadingDirectPack, setIsLoadingDirectPack] = useState(false);
  const [studioTarget, setStudioTarget] = useState<{
    sticker: StickerItem;
    pack: StickerPack;
  } | null>(null);
  const [showGuideModal, setShowGuideModal] = useState(false);

  // Quick copy state on card preview stickers
  const [copyingPreviewKey, setCopyingPreviewKey] = useState<string | null>(
    null
  );
  const [copiedPreviewKey, setCopiedPreviewKey] = useState<string | null>(null);

  // Toast Notification
  const [toast, setToast] = useState<{
    message: string;
    type: "success" | "info" | "error";
  } | null>(null);
  const toastTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const showToast = useCallback(
    (
      message: string,
      type: "success" | "info" | "error" = "success"
    ) => {
      if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current);
      setToast({ message, type });
      toastTimeoutRef.current = setTimeout(() => {
        setToast(null);
      }, 3200);
    },
    []
  );

  // Load persisted data from localStorage
  useEffect(() => {
    try {
      const favRaw = localStorage.getItem("sigstick_vn_fav_stickers");
      if (favRaw) setFavoriteStickers(JSON.parse(favRaw));

      const packsRaw = localStorage.getItem("sigstick_vn_saved_packs");
      if (packsRaw) setSavedPacks(JSON.parse(packsRaw));

      const recentRaw = localStorage.getItem("sigstick_vn_recent_stickers");
      if (recentRaw) setRecentStickers(JSON.parse(recentRaw));

      setCopyBgMode(getDefaultCopyBgMode());
      setStickerSize(getDefaultStickerSize());
    } catch (e) {
      console.error("Failed to read localStorage", e);
    }
  }, []);

  const handleToggleCopyBgMode = () => {
    const order: BgMode[] = [
      "zalo-mobile",
      "zalo-light",
      "zalo-dark",
      "transparent",
    ];
    const nextIdx = (order.indexOf(copyBgMode) + 1) % order.length;
    const next = order[nextIdx];
    setCopyBgMode(next);
    setDefaultCopyBgMode(next);
    const labelMap: Record<BgMode, string> = {
      "zalo-mobile": "Nền Zalo Điện thoại (#e2e9f1 • Không bao giờ bị nền đen/trắng)",
      "zalo-light": "Nền Zalo PC Sáng (#ebecf0)",
      "zalo-dark": "Nền Zalo Tối (#22262b)",
      transparent: "Tự tách nền (Trong suốt)",
      white: "Nền trắng",
      dark: "Nền tối",
    };
    showToast(`Đã đổi chế độ: ${labelMap[next]}`, "info");
  };

  const handleToggleStickerSize = () => {
    const order: StickerSizePreset[] = [1024, 512, 320];
    const nextIdx = (order.indexOf(stickerSize) + 1) % order.length;
    const next = order[nextIdx];
    setStickerSize(next);
    setDefaultStickerSize(next);
    const found = STICKER_SIZE_OPTIONS.find((o) => o.size === next);
    showToast(
      `Đã đổi độ phân giải Sticker: ${found?.label || `${next}px`}`,
      "info"
    );
  };

  // Save helpers
  const persistFavorites = (next: SavedStickerEntry[]) => {
    setFavoriteStickers(next);
    try {
      localStorage.setItem("sigstick_vn_fav_stickers", JSON.stringify(next));
    } catch {}
  };

  const persistSavedPacks = (next: StickerPack[]) => {
    setSavedPacks(next);
    try {
      localStorage.setItem("sigstick_vn_saved_packs", JSON.stringify(next));
    } catch {}
  };

  const recordRecentSticker = useCallback(
    (sticker: StickerItem, pack: StickerPack) => {
      const key = normalizeCdnUrl(sticker.url);
      setRecentStickers((prev) => {
        const filtered = prev.filter((item) => item.key !== key);
        const next: SavedStickerEntry[] = [
          {
            key,
            pack,
            sticker,
            savedAt: Date.now(),
          },
          ...filtered,
        ].slice(0, 60);
        try {
          localStorage.setItem(
            "sigstick_vn_recent_stickers",
            JSON.stringify(next)
          );
        } catch {}
        return next;
      });
    },
    []
  );

  const toggleFavoriteSticker = useCallback(
    (sticker: StickerItem, pack: StickerPack) => {
      const key = normalizeCdnUrl(sticker.url);
      const exists = favoriteStickers.some((item) => item.key === key);
      if (exists) {
        const next = favoriteStickers.filter((item) => item.key !== key);
        persistFavorites(next);
        showToast("Đã bỏ khỏi danh sách Sticker yêu thích", "info");
      } else {
        const next: SavedStickerEntry[] = [
          {
            key,
            pack,
            sticker,
            savedAt: Date.now(),
          },
          ...favoriteStickers,
        ];
        persistFavorites(next);
        showToast("Đã lưu vào Sticker yêu thích!", "success");
      }
    },
    [favoriteStickers, showToast]
  );

  const toggleSavePack = useCallback(
    (pack: StickerPack) => {
      const exists = savedPacks.some((p) => p.id === pack.id);
      if (exists) {
        const next = savedPacks.filter((p) => p.id !== pack.id);
        persistSavedPacks(next);
        showToast(`Đã bỏ lưu bộ "${pack.title}"`, "info");
      } else {
        const next = [pack, ...savedPacks];
        persistSavedPacks(next);
        showToast(`Đã lưu bộ sticker "${pack.title}"!`, "success");
      }
    },
    [savedPacks, showToast]
  );

  // Open pack modal and fetch full sticker list if needed
  const openPackDetail = useCallback(
    async (packOrId: StickerPack | string) => {
      if (typeof packOrId !== "string") {
        setSelectedPack(packOrId);
        // Fetch full pack in background if stickers list is truncated
        try {
          const res = await fetch(
            `/api/sigstick?action=pack&id=${encodeURIComponent(packOrId.id)}`
          );
          const json = await res.json();
          if (json?.pack?.id) {
            setSelectedPack(json.pack);
          }
        } catch {}
      } else {
        setIsLoadingDirectPack(true);
        try {
          const res = await fetch(
            `/api/sigstick?action=pack&id=${encodeURIComponent(packOrId)}`
          );
          const json = await res.json();
          if (json?.pack?.id) {
            setSelectedPack(json.pack);
          } else {
            showToast("Không tìm thấy bộ Sticker với ID này", "error");
          }
        } catch {
          showToast("Không thể tải bộ Sticker", "error");
        } finally {
          setIsLoadingDirectPack(false);
        }
      }
    },
    [showToast]
  );

  // Fetch packs for Discover or Search
  const fetchPacks = useCallback(
    async (opts: {
      query?: string;
      tab?: DiscoverSubTab;
      reg?: string;
      startAfter?: number | null;
      append?: boolean;
    }) => {
      const q = opts.query ?? activeQuery;
      const subTab = opts.tab ?? discoverTab;
      const reg = opts.reg ?? region;
      const append = opts.append ?? false;

      if (append) {
        setIsLoadingMore(true);
      } else {
        setIsLoading(true);
      }

      try {
        if (q.trim()) {
          const res = await fetch(
            `/api/sigstick?action=search&keyword=${encodeURIComponent(q.trim())}`
          );
          const json = await res.json();
          setPacks(json.packs || []);
          setNextCursor(null);
        } else {
          let url = `/api/sigstick?action=discover&category=${subTab}&region=${reg}`;
          if (opts.startAfter) {
            url += `&startAfter=${opts.startAfter}`;
          }
          const res = await fetch(url);
          const json = await res.json();
          if (append) {
            setPacks((prev) => {
              const seen = new Set(prev.map((p) => p.id));
              const merged = [...prev];
              for (const p of json.packs || []) {
                if (!seen.has(p.id)) {
                  seen.add(p.id);
                  merged.push(p);
                }
              }
              return merged;
            });
          } else {
            setPacks(json.packs || []);
          }
          setNextCursor(json.nextStartAfter ?? null);
        }
      } catch (err) {
        console.error("Failed to fetch packs", err);
        showToast("Không thể tải dữ liệu từ SigStick API", "error");
      } finally {
        setIsLoading(false);
        setIsLoadingMore(false);
      }
    },
    [activeQuery, discoverTab, region, showToast]
  );

  // Initial load & when discoverTab / region / activeQuery changes
  useEffect(() => {
    if (mainTab === "discover") {
      fetchPacks({
        query: activeQuery,
        tab: discoverTab,
        reg: region,
        append: false,
      });
    } else if (mainTab === "collections" && collections.length === 0) {
      setIsLoading(true);
      fetch("/api/sigstick?action=featured")
        .then((r) => r.json())
        .then((data) => {
          const rawItems = Array.isArray(data?.items) ? data.items : [];
          const parsedCollections: FeaturedCollection[] = rawItems
            .filter((it: any) => it?.type === "collection" && it?.data?.title)
            .map((it: any) => it.data as FeaturedCollection);
          setCollections(parsedCollections);
        })
        .catch(() => showToast("Lỗi tải Bộ sưu tập nổi bật", "error"))
        .finally(() => setIsLoading(false));
    }
  }, [
    mainTab,
    discoverTab,
    region,
    activeQuery,
    fetchPacks,
    collections.length,
    showToast,
  ]);

  // Fetch search suggestions
  useEffect(() => {
    const trimmed = searchInput.trim();
    if (!trimmed || trimmed.length < 2 || extractPackIdFromInput(trimmed)) {
      setSuggestions([]);
      return;
    }
    const timer = setTimeout(() => {
      fetch(
        `/api/sigstick?action=suggestions&keyword=${encodeURIComponent(trimmed)}`
      )
        .then((r) => r.json())
        .then((data) => {
          if (Array.isArray(data.suggestions)) {
            setSuggestions(data.suggestions);
          }
        })
        .catch(() => {});
    }, 220);

    return () => clearTimeout(timer);
  }, [searchInput]);

  const handleSearchSubmit = (e?: React.FormEvent, customQuery?: string) => {
    if (e) e.preventDefault();
    const raw = (customQuery !== undefined ? customQuery : searchInput).trim();
    setShowSuggestions(false);

    // Check if user pasted a direct SigStick pack link
    const directPackId = extractPackIdFromInput(raw);
    if (directPackId && raw.includes("sigstick.com")) {
      openPackDetail(directPackId);
      showToast(`Đang mở trực tiếp bộ Sticker ID: ${directPackId}`, "info");
      return;
    }

    setMainTab("discover");
    setActiveQuery(raw);
  };

  // Quick 1-click copy / share on pack preview card
  const handleQuickPreviewCopy = async (
    e: React.MouseEvent,
    pack: StickerPack,
    sticker: StickerItem
  ) => {
    e.stopPropagation();
    const key = normalizeCdnUrl(sticker.url);
    setCopyingPreviewKey(key);
    try {
      await copyStickerToClipboard(sticker.url, {
        bg: copyBgMode,
        size: stickerSize,
        addWhiteStroke: true,
      });
      recordRecentSticker(sticker, pack);
      setCopiedPreviewKey(key);
      showToast(
        `Đã Copy Sticker chuẩn Zalo (${stickerSize}px • Có viền • Không nền đen/trắng)!`,
        "success"
      );
      setTimeout(() => {
        setCopiedPreviewKey((prev) => (prev === key ? null : prev));
      }, 2000);
    } catch {
      try {
        await shareStickerToZalo(
          sticker.url,
          {
            bg: copyBgMode,
            size: stickerSize,
            addWhiteStroke: true,
            preferGif: isPackAnimated(pack),
          },
          pack.title
        );
        recordRecentSticker(sticker, pack);
      } catch {
        setStudioTarget({
          sticker,
          pack,
        });
      }
    } finally {
      setCopyingPreviewKey(null);
    }
  };

  const favoriteKeySet = new Set(favoriteStickers.map((s) => s.key));
  const savedPackIdSet = new Set(savedPacks.map((p) => p.id));

  return (
    <div className="min-h-dvh flex flex-col bg-[#f4f7fb] text-slate-800 pb-20 lg:pb-0">
      {/* Soft Pastel Ambient Background Accents */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden z-0">
        <div className="absolute -top-32 -left-32 w-80 h-80 bg-indigo-200/40 rounded-full blur-[100px]" />
        <div className="absolute top-16 right-0 w-72 h-72 bg-sky-200/35 rounded-full blur-[110px]" />
        <div className="absolute bottom-10 left-1/3 w-80 h-80 bg-rose-200/25 rounded-full blur-[120px]" />
      </div>

      {/* Compact Sticky App Bar */}
      <header className="sticky top-0 z-30 backdrop-blur-xl bg-white/85 border-b border-slate-200/80 shadow-[0_1px_3px_rgba(15,23,42,0.03)]">
        <div className="max-w-7xl mx-auto px-3 sm:px-6 h-14 sm:h-16 flex items-center justify-between gap-2">
          {/* Brand Logo */}
          <div
            onClick={() => {
              setMainTab("discover");
              setActiveQuery("");
              setSearchInput("");
            }}
            className="flex items-center gap-2.5 cursor-pointer group shrink-0"
          >
            <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl sm:rounded-2xl bg-gradient-to-tr from-indigo-500 via-sky-500 to-teal-400 flex items-center justify-center shadow-sm shadow-indigo-500/20 group-hover:scale-105 transition">
              <MessageCircle className="w-4 h-4 sm:w-5 sm:h-5 text-white fill-white/20" />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="font-extrabold text-base sm:text-lg tracking-tight text-slate-800">
                  SigStick
                </span>
                <span className="text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-full bg-indigo-50 text-indigo-600 border border-indigo-200/80">
                  VN
                </span>
                <span className="text-[10px] font-semibold font-mono px-1.5 py-0.5 rounded-md bg-slate-100 text-slate-500 border border-slate-200/80">
                  {APP_VERSION}
                </span>
              </div>
              <p className="text-[11px] text-slate-500 hidden sm:block">
                Chuẩn GIF & PNG Zalo • Độ phân giải Max Ultra HD • Có viền • Không nền đen/trắng
              </p>
            </div>
          </div>

          {/* Desktop Navigation Pills */}
          <nav className="hidden lg:flex items-center gap-1 bg-slate-100/90 p-1 rounded-xl border border-slate-200/80">
            <button
              onClick={() => setMainTab("discover")}
              className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer ${
                mainTab === "discover"
                  ? "bg-white text-indigo-600 shadow-xs border border-slate-200/60"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              <Flame className="w-3.5 h-3.5" />
              Khám phá
            </button>
            <button
              onClick={() => setMainTab("collections")}
              className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer ${
                mainTab === "collections"
                  ? "bg-white text-indigo-600 shadow-xs border border-slate-200/60"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              <Layers className="w-3.5 h-3.5" />
              Bộ sưu tập
            </button>
            <button
              onClick={() => setMainTab("favorites")}
              className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer ${
                mainTab === "favorites"
                  ? "bg-white text-rose-600 shadow-xs border border-slate-200/60"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              <Heart className="w-3.5 h-3.5" />
              Yêu thích ({favoriteStickers.length})
            </button>
            <button
              onClick={() => setMainTab("saved")}
              className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer ${
                mainTab === "saved"
                  ? "bg-white text-indigo-600 shadow-xs border border-slate-200/60"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              <Bookmark className="w-3.5 h-3.5" />
              Đã lưu ({savedPacks.length})
            </button>
            <button
              onClick={() => setMainTab("recent")}
              className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer ${
                mainTab === "recent"
                  ? "bg-white text-indigo-600 shadow-xs border border-slate-200/60"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              <Clock className="w-3.5 h-3.5" />
              Gần đây ({recentStickers.length})
            </button>
          </nav>

          {/* Right Quick Actions (Mobile-Ergonomic) */}
          <div className="flex items-center gap-1.5 sm:gap-2">
            <button
              onClick={handleToggleStickerSize}
              title="Đổi độ phân giải Sticker khi gửi qua Zalo / Messenger"
              className="min-h-[38px] flex items-center gap-1 px-2 sm:px-2.5 py-1.5 rounded-xl bg-indigo-50/90 hover:bg-indigo-100/80 text-indigo-700 border border-indigo-200/90 text-[11px] sm:text-xs font-semibold transition cursor-pointer active:scale-95"
            >
              <Maximize2 className="w-3.5 h-3.5 text-indigo-500 shrink-0" />
              <span>
                {stickerSize === 1024
                  ? "Max HD (1024px)"
                  : stickerSize === 512
                  ? "Chuẩn HD (512px)"
                  : "Nhanh (320px)"}
              </span>
            </button>

            <button
              onClick={handleToggleCopyBgMode}
              title="Chế độ nền chống đen/trắng khi gửi Sticker qua Zalo"
              className="min-h-[38px] flex items-center gap-1.5 px-2 sm:px-3 py-1.5 rounded-xl bg-teal-50/90 hover:bg-teal-100/80 text-teal-700 border border-teal-200/90 text-xs font-semibold transition cursor-pointer active:scale-95"
            >
              <span
                className={`w-2.5 h-2.5 rounded-full border shrink-0 ${
                  copyBgMode === "zalo-mobile"
                    ? "bg-[#e2e9f1] border-sky-500"
                    : copyBgMode === "zalo-light"
                    ? "bg-[#ebecf0] border-slate-400"
                    : copyBgMode === "zalo-dark"
                    ? "bg-[#22262b] border-slate-600"
                    : "bg-white border-dashed border-teal-500"
                }`}
              />
              <span className="hidden md:inline">
                {copyBgMode === "zalo-mobile"
                  ? "Zalo ĐT (#e2e9f1)"
                  : copyBgMode === "zalo-light"
                  ? "Zalo PC"
                  : copyBgMode === "zalo-dark"
                  ? "Zalo Tối"
                  : "Trong suốt"}
              </span>
              <span className="md:hidden text-[11px]">
                {copyBgMode === "zalo-mobile"
                  ? "Zalo ĐT"
                  : copyBgMode === "zalo-light"
                  ? "Zalo PC"
                  : copyBgMode === "zalo-dark"
                  ? "Zalo Tối"
                  : "Trong suốt"}
              </span>
            </button>

            <button
              onClick={() => setShowGuideModal(true)}
              aria-label="Hướng dẫn sử dụng"
              className="min-h-[38px] flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200/80 text-slate-700 border border-slate-200/90 text-xs font-semibold transition cursor-pointer active:scale-95"
            >
              <HelpCircle className="w-4 h-4 text-indigo-500" />
              <span className="hidden sm:inline">Hướng dẫn</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Content Container */}
      <main className="relative z-10 flex-1 max-w-7xl w-full mx-auto px-3 sm:px-6 py-3 sm:py-5 space-y-3.5 sm:space-y-5">
        {/* Compact Search & Tag Bar (Always reachable, doesn't push content off-screen on mobile) */}
        <section className="rounded-2xl sm:rounded-3xl bg-white/90 backdrop-blur-md border border-slate-200/80 p-3 sm:p-5 shadow-[0_2px_12px_rgba(15,23,42,0.04)]">
          {/* Search Form */}
          <form
            onSubmit={(e) => handleSearchSubmit(e)}
            className="relative max-w-3xl mx-auto"
          >
            <div className="relative flex items-center">
              <Search className="w-4 h-4 sm:w-5 sm:h-5 text-slate-400 absolute left-3.5 pointer-events-none" />
              <input
                type="text"
                value={searchInput}
                onFocus={() => setShowSuggestions(true)}
                onBlur={() => setTimeout(() => setShowSuggestions(false), 180)}
                onChange={(e) => setSearchInput(e.target.value)}
                placeholder="Tìm sticker (Mèo, Bubu Dudu, Chiikawa...) hoặc dán link..."
                className="w-full pl-10 sm:pl-11 pr-24 py-2.5 sm:py-3 rounded-xl sm:rounded-2xl bg-slate-50/90 border border-slate-200/90 text-base sm:text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:bg-white focus:border-indigo-400 focus:ring-3 focus:ring-indigo-500/10 transition"
              />
              {searchInput && (
                <button
                  type="button"
                  onClick={() => {
                    setSearchInput("");
                    if (activeQuery) {
                      setActiveQuery("");
                    }
                  }}
                  aria-label="Xóa từ khóa"
                  className="absolute right-20 p-1.5 text-slate-400 hover:text-slate-600 cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
              <button
                type="submit"
                disabled={isLoadingDirectPack}
                className="absolute right-1.5 px-3.5 py-1.5 sm:py-2 rounded-lg sm:rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs transition shadow-xs cursor-pointer active:scale-95"
              >
                {isLoadingDirectPack ? "Mở..." : "Tìm"}
              </button>
            </div>

            {/* Autocomplete Suggestions Dropdown */}
            {showSuggestions && suggestions.length > 0 && (
              <div className="absolute left-0 right-0 top-full mt-1.5 bg-white border border-slate-200 rounded-2xl shadow-xl overflow-hidden z-30">
                <div className="px-3 py-1.5 text-[11px] font-semibold text-slate-400 bg-slate-50 border-b border-slate-100 flex items-center justify-between">
                  <span>Gợi ý tìm kiếm</span>
                  <span>Chạm để chọn</span>
                </div>
                <div className="divide-y divide-slate-100 max-h-56 overflow-y-auto">
                  {suggestions.map((sug) => (
                    <button
                      type="button"
                      key={sug}
                      onMouseDown={() => {
                        setSearchInput(sug);
                        handleSearchSubmit(undefined, sug);
                      }}
                      className="w-full px-3.5 py-2.5 text-left text-sm text-slate-700 hover:bg-indigo-50/70 hover:text-indigo-600 flex items-center gap-2.5 transition cursor-pointer"
                    >
                      <Search className="w-3.5 h-3.5 text-slate-400" />
                      <span>{sug}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </form>

          {/* Popular Tag Chips (Single compact scrollable row) */}
          <div className="max-w-3xl mx-auto mt-2.5 flex items-center gap-1.5 overflow-x-auto pb-0.5 no-scrollbar">
            {POPULAR_TAGS.map((tag) => {
              const isSelected =
                activeQuery.toLowerCase() === tag.query.toLowerCase();
              return (
                <button
                  key={tag.query}
                  onClick={() => {
                    setSearchInput(tag.query);
                    handleSearchSubmit(undefined, tag.query);
                  }}
                  className={`shrink-0 px-2.5 py-1 rounded-full text-xs font-medium transition cursor-pointer border active:scale-95 ${
                    isSelected
                      ? "bg-indigo-600 text-white border-indigo-600 shadow-xs"
                      : "bg-slate-100/80 hover:bg-slate-200/70 text-slate-600 border-slate-200/70"
                  }`}
                >
                  {tag.label}
                </button>
              );
            })}
          </div>
        </section>

        {/* =========================================================
            TAB 1: DISCOVER & SEARCH RESULTS
           ========================================================= */}
        {mainTab === "discover" && (
          <div className="space-y-3.5 sm:space-y-4">
            {/* Compact Filter Bar: Trending / Top / New + Region Selector */}
            <div className="flex items-center justify-between gap-2 overflow-x-auto no-scrollbar pb-0.5">
              {activeQuery ? (
                <div className="flex items-center justify-between w-full gap-2 bg-white px-3.5 py-2 rounded-xl border border-slate-200/80">
                  <h2 className="text-sm sm:text-base font-bold text-slate-800 flex items-center gap-1.5 truncate">
                    <Search className="w-4 h-4 text-indigo-500 shrink-0" />
                    <span className="truncate">
                      Kết quả: &ldquo;{activeQuery}&rdquo;
                    </span>
                    <span className="text-xs font-normal text-slate-500 shrink-0">
                      ({packs.length})
                    </span>
                  </h2>
                  <button
                    onClick={() => {
                      setActiveQuery("");
                      setSearchInput("");
                    }}
                    className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-xs font-medium text-slate-600 flex items-center gap-1 shrink-0 cursor-pointer"
                  >
                    <X className="w-3.5 h-3.5" />
                    Xóa lọc
                  </button>
                </div>
              ) : (
                <>
                  {/* Category Segmented Control */}
                  <div className="flex items-center gap-1 bg-white p-1 rounded-xl border border-slate-200/80 shadow-[0_1px_2px_rgba(15,23,42,0.03)] shrink-0">
                    <button
                      onClick={() => setDiscoverTab("trending")}
                      className={`flex items-center gap-1 px-2.5 sm:px-3 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer ${
                        discoverTab === "trending"
                          ? "bg-indigo-600 text-white shadow-xs"
                          : "text-slate-600 hover:text-slate-900"
                      }`}
                    >
                      <Flame className="w-3.5 h-3.5" />
                      <span>Thịnh hành</span>
                    </button>
                    <button
                      onClick={() => setDiscoverTab("top")}
                      className={`flex items-center gap-1 px-2.5 sm:px-3 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer ${
                        discoverTab === "top"
                          ? "bg-indigo-600 text-white shadow-xs"
                          : "text-slate-600 hover:text-slate-900"
                      }`}
                    >
                      <Trophy className="w-3.5 h-3.5" />
                      <span>Tải nhiều</span>
                    </button>
                    <button
                      onClick={() => setDiscoverTab("new")}
                      className={`flex items-center gap-1 px-2.5 sm:px-3 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer ${
                        discoverTab === "new"
                          ? "bg-indigo-600 text-white shadow-xs"
                          : "text-slate-600 hover:text-slate-900"
                      }`}
                    >
                      <Sparkles className="w-3.5 h-3.5" />
                      <span>Mới</span>
                    </button>
                  </div>

                  {/* Region Pills */}
                  <div className="flex items-center gap-1 bg-white p-1 rounded-xl border border-slate-200/80 shadow-[0_1px_2px_rgba(15,23,42,0.03)] shrink-0">
                    <Globe className="w-3.5 h-3.5 text-slate-400 ml-1.5 hidden sm:inline" />
                    {(
                      [
                        { id: "vn", label: "VN" },
                        { id: "jp", label: "JP" },
                        { id: "kr", label: "KR" },
                        { id: "us", label: "Quốc tế" },
                      ] as const
                    ).map((r) => (
                      <button
                        key={r.id}
                        onClick={() => setRegion(r.id)}
                        className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer ${
                          region === r.id
                            ? "bg-indigo-50 text-indigo-600 border border-indigo-200/80"
                            : "text-slate-500 hover:text-slate-800"
                        }`}
                      >
                        {r.label}
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>

            {/* Pack Cards Grid — 2 Columns on Mobile for Compact Browsing, 3 on lg, 4 on xl */}
            {isLoading ? (
              <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-2.5 sm:gap-4">
                {Array.from({ length: 8 }).map((_, idx) => (
                  <div
                    key={idx}
                    className="h-48 sm:h-52 rounded-2xl bg-white border border-slate-200/80 p-3 sm:p-4 animate-pulse flex flex-col justify-between"
                  >
                    <div className="flex items-center gap-2.5">
                      <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-slate-100 shrink-0" />
                      <div className="flex-1 space-y-2">
                        <div className="h-3.5 bg-slate-100 rounded w-3/4" />
                        <div className="h-2.5 bg-slate-100 rounded w-1/2" />
                      </div>
                    </div>
                    <div className="grid grid-cols-4 gap-1.5">
                      {Array.from({ length: 4 }).map((__, i) => (
                        <div
                          key={i}
                          className="aspect-square rounded-lg bg-slate-100"
                        />
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            ) : packs.length === 0 ? (
              <div className="rounded-2xl bg-white border border-slate-200/80 p-10 text-center space-y-2.5">
                <p className="text-sm sm:text-base font-semibold text-slate-700">
                  Không tìm thấy bộ sticker nào khớp với từ khóa này.
                </p>
                <p className="text-xs text-slate-500">
                  Hãy thử tìm bằng từ khóa ngắn (vd: Cat, Bear, Cute, Meme,
                  Anime) hoặc dán trực tiếp link từ sigstick.com.
                </p>
              </div>
            ) : (
              <>
                <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-2.5 sm:gap-4">
                  {packs.map((pack) => {
                    const animated = isPackAnimated(pack);
                    const isSaved = savedPackIdSet.has(pack.id);
                    const coverUrl = pack.cover?.url
                      ? getThumbnailUrl(pack.cover.url, 128)
                      : pack.stickers?.[0]?.url
                      ? getThumbnailUrl(pack.stickers[0].url, 128)
                      : "";
                    const previewStickers = (pack.stickers || []).slice(0, 4);

                    return (
                      <div
                        key={pack.id}
                        onClick={() => openPackDetail(pack)}
                        className="group relative rounded-2xl bg-white hover:bg-slate-50/60 border border-slate-200/80 hover:border-indigo-300 p-2.5 sm:p-4 transition-all duration-200 flex flex-col justify-between cursor-pointer shadow-[0_1px_4px_rgba(15,23,42,0.03)] hover:shadow-md"
                      >
                        {/* Pack Card Header */}
                        <div className="flex items-start gap-2 sm:gap-3">
                          <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-slate-50 border border-slate-200/70 p-1 shrink-0 flex items-center justify-center overflow-hidden">
                            {coverUrl ? (
                              <img
                                src={coverUrl}
                                alt={pack.title}
                                className="w-full h-full object-contain group-hover:scale-105 transition duration-200"
                                loading="lazy"
                              />
                            ) : (
                              <Sparkles className="w-5 h-5 text-indigo-400" />
                            )}
                          </div>

                          <div className="flex-1 min-w-0">
                            <h3 className="font-bold text-xs sm:text-sm text-slate-800 truncate group-hover:text-indigo-600 transition">
                              {pack.title}
                            </h3>
                            <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                              {animated ? (
                                <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-md text-[10px] font-semibold bg-violet-50 text-violet-600 border border-violet-200/80">
                                  GIF
                                </span>
                              ) : (
                                <span className="inline-flex items-center px-1.5 py-0.5 rounded-md text-[10px] font-medium bg-slate-100 text-slate-600">
                                  PNG
                                </span>
                              )}
                              <span className="text-[10px] sm:text-[11px] text-slate-500">
                                {pack.stickers?.length || 0} hình
                              </span>
                            </div>
                          </div>

                          {/* Bookmark Pack Button */}
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              toggleSavePack(pack);
                            }}
                            aria-label={isSaved ? "Bỏ lưu bộ này" : "Lưu bộ sticker"}
                            title={isSaved ? "Bỏ lưu bộ này" : "Lưu bộ sticker"}
                            className={`p-1.5 sm:p-2 rounded-lg sm:rounded-xl border transition cursor-pointer shrink-0 ${
                              isSaved
                                ? "bg-indigo-50 border-indigo-200 text-indigo-600"
                                : "bg-slate-50 border-slate-200/70 text-slate-400 hover:text-slate-700"
                            }`}
                          >
                            <Bookmark
                              className={`w-3.5 h-3.5 sm:w-4 sm:h-4 ${
                                isSaved ? "fill-indigo-600" : ""
                              }`}
                            />
                          </button>
                        </div>

                        {/* 4 Preview Stickers with 1-Click Copy */}
                        <div className="grid grid-cols-4 gap-1.5 sm:gap-2 my-2.5 sm:my-3">
                          {previewStickers.map((st, idx) => {
                            const thumbUrl = getThumbnailUrl(st.url, 128);
                            const previewKey = normalizeCdnUrl(st.url);
                            const isCopying = copyingPreviewKey === previewKey;
                            const isCopied = copiedPreviewKey === previewKey;

                            return (
                              <div
                                key={`${pack.id}_${idx}`}
                                onClick={(e) =>
                                  handleQuickPreviewCopy(e, pack, st)
                                }
                                title="Chạm để Copy nhanh sticker này"
                                className="relative aspect-square rounded-lg sm:rounded-xl bg-slate-50/90 hover:bg-indigo-50/50 border border-slate-200/60 hover:border-indigo-300 p-1 sm:p-1.5 flex items-center justify-center overflow-hidden group/st transition active:scale-95"
                              >
                                <img
                                  src={thumbUrl}
                                  alt={getEmojiString(st.emoji)}
                                  className="w-full h-full object-contain group-hover/st:scale-105 transition"
                                  loading="lazy"
                                />
                                {(isCopying || isCopied) && (
                                  <div className="absolute inset-0 bg-white/90 backdrop-blur-[1px] flex flex-col items-center justify-center gap-0.5 text-[9px] font-bold text-indigo-600">
                                    {isCopying ? (
                                      <Loader2 className="w-3.5 h-3.5 animate-spin text-indigo-600" />
                                    ) : (
                                      <Check className="w-4 h-4 text-teal-600" />
                                    )}
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>

                        {/* Card Footer */}
                        <div className="flex items-center justify-between pt-1.5 border-t border-slate-100 text-[11px]">
                          <span className="text-slate-400 truncate hidden sm:inline">
                            {pack.download ? `${formatCount(pack.download)} tải` : "Chạm hình để Copy"}
                          </span>
                          <span className="text-slate-400 truncate sm:hidden text-[10px]">
                            Chạm để mở
                          </span>
                          <span className="font-semibold text-indigo-600 flex items-center gap-0.5 ml-auto">
                            <span>Mở bộ</span>
                            <ChevronRight className="w-3 h-3" />
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Load More Pagination Button */}
                {nextCursor && !activeQuery && (
                  <div className="flex justify-center pt-3">
                    <button
                      onClick={() =>
                        fetchPacks({
                          tab: discoverTab,
                          reg: region,
                          startAfter: nextCursor,
                          append: true,
                        })
                      }
                      disabled={isLoadingMore}
                      className="min-h-[44px] px-6 py-2.5 rounded-2xl bg-white hover:bg-slate-50 text-slate-700 font-semibold text-xs sm:text-sm border border-slate-200 shadow-xs flex items-center gap-2 transition cursor-pointer disabled:opacity-50 active:scale-95"
                    >
                      {isLoadingMore ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin text-indigo-600" />
                          Đang tải thêm...
                        </>
                      ) : (
                        <>Xem thêm bộ Sticker</>
                      )}
                    </button>
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {/* =========================================================
            TAB 2: FEATURED COLLECTIONS (BỘ SƯU TẬP CHỌN LỌC)
           ========================================================= */}
        {mainTab === "collections" && (
          <div className="space-y-5">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-base sm:text-lg font-bold text-slate-800 flex items-center gap-2">
                  <Layers className="w-5 h-5 text-indigo-500" />
                  Bộ sưu tập theo chủ đề
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Tổng hợp các chủ đề được yêu thích nhất trên SigStick
                </p>
              </div>
            </div>

            {isLoading ? (
              <div className="flex items-center justify-center py-16">
                <Loader2 className="w-7 h-7 text-indigo-500 animate-spin" />
              </div>
            ) : (
              <div className="space-y-4">
                {collections.map((col) => (
                  <div
                    key={col.id}
                    className="rounded-2xl bg-white border border-slate-200/80 p-3.5 sm:p-5 space-y-3 shadow-xs"
                  >
                    <div className="flex items-center justify-between">
                      <h3 className="text-sm sm:text-base font-bold text-slate-800 flex items-center gap-1.5">
                        <Sparkles className="w-4 h-4 text-amber-500" />
                        {col.title}
                      </h3>
                      <span className="text-xs text-slate-400">
                        {col.items?.length || 0} bộ
                      </span>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
                      {(col.items || []).map((item) => {
                        const pack = item.pack;
                        if (!pack) return null;
                        const coverUrl = pack.cover?.url
                          ? getThumbnailUrl(pack.cover.url, 128)
                          : pack.stickers?.[0]?.url
                          ? getThumbnailUrl(pack.stickers[0].url, 128)
                          : "";
                        return (
                          <div
                            key={pack.id}
                            onClick={() => openPackDetail(pack)}
                            className="rounded-xl bg-slate-50/80 hover:bg-indigo-50/40 border border-slate-200/70 hover:border-indigo-300 p-2.5 flex items-center gap-2.5 cursor-pointer transition active:scale-95"
                          >
                            <img
                              src={coverUrl}
                              alt={pack.title}
                              className="w-11 h-11 object-contain rounded-lg bg-white border border-slate-200/60 p-1 shrink-0"
                            />
                            <div className="min-w-0 flex-1">
                              <p className="text-xs font-bold text-slate-800 truncate">
                                {pack.title}
                              </p>
                              <p className="text-[11px] text-slate-500 truncate">
                                {pack.stickers?.length || 0} hình
                              </p>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* =========================================================
            TAB 3 & 5: FAVORITE STICKERS & RECENTLY USED STICKERS
           ========================================================= */}
        {(mainTab === "favorites" || mainTab === "recent") && (
          <div className="space-y-3.5">
            <div className="flex items-center justify-between gap-2">
              <div>
                <h2 className="text-base sm:text-lg font-bold text-slate-800 flex items-center gap-2">
                  {mainTab === "favorites" ? (
                    <>
                      <Heart className="w-5 h-5 text-rose-500 fill-rose-500" />
                      Sticker Yêu thích ({favoriteStickers.length})
                    </>
                  ) : (
                    <>
                      <Clock className="w-5 h-5 text-indigo-500" />
                      Dùng gần đây ({recentStickers.length})
                    </>
                  )}
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Chạm vào sticker để Copy PNG ngay hoặc mở Studio chế chữ.
                </p>
              </div>

              {mainTab === "recent" && recentStickers.length > 0 && (
                <button
                  onClick={() => {
                    setRecentStickers([]);
                    localStorage.removeItem("sigstick_vn_recent_stickers");
                    showToast("Đã xóa lịch sử sticker gần đây", "info");
                  }}
                  className="px-3 py-1.5 rounded-xl bg-white hover:bg-rose-50 text-slate-600 hover:text-rose-600 text-xs font-medium flex items-center gap-1.5 border border-slate-200 cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  Xóa lịch sử
                </button>
              )}
            </div>

            {(mainTab === "favorites" ? favoriteStickers : recentStickers)
              .length === 0 ? (
              <div className="rounded-2xl bg-white border border-slate-200/80 p-10 text-center space-y-3">
                <p className="text-sm font-semibold text-slate-600">
                  {mainTab === "favorites"
                    ? "Bạn chưa thả tim lưu riêng sticker nào."
                    : "Bạn chưa copy hoặc chia sẻ sticker nào gần đây."}
                </p>
                <button
                  onClick={() => setMainTab("discover")}
                  className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold cursor-pointer"
                >
                  Khám phá kho Sticker
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-2.5">
                {(mainTab === "favorites"
                  ? favoriteStickers
                  : recentStickers
                ).map((entry) => {
                  const thumbUrl = getThumbnailUrl(entry.sticker.url, 256);
                  const animated = isPackAnimated(entry.pack);
                  return (
                    <div
                      key={entry.key}
                      className="group relative rounded-2xl bg-[#e2e9f1]/60 hover:bg-[#e2e9f1] border border-slate-200/80 hover:border-[#0068ff]/50 p-2.5 flex flex-col items-center justify-between gap-2 transition shadow-2xs"
                    >
                      <div
                        onClick={async () => {
                          try {
                            const res = await shareStickerToZalo(
                              entry.sticker.url,
                              {
                                bg: copyBgMode,
                                size: stickerSize,
                                addWhiteStroke: true,
                                preferGif: animated,
                              },
                              entry.pack.title
                            );
                            showToast(
                              res === "shared"
                                ? `Đã mở Chia sẻ Zalo (${animated ? "GIF" : "PNG"} • ${stickerSize}px)!`
                                : `Đã Copy Sticker chuẩn Zalo (${stickerSize}px)!`,
                              "success"
                            );
                          } catch {
                            setStudioTarget({
                              sticker: entry.sticker,
                              pack: entry.pack,
                            });
                          }
                        }}
                        className="w-full aspect-square flex items-center justify-center cursor-pointer active:scale-95 transition"
                      >
                        <img
                          src={thumbUrl}
                          alt={entry.pack.title}
                          className="w-full h-full object-contain group-hover:scale-105 transition drop-shadow-[0_0_2px_#fff]"
                        />
                      </div>

                      <div className="w-full flex items-center justify-between gap-1 pt-1.5 border-t border-slate-200/70">
                        <button
                          onClick={async () => {
                            try {
                              const res = await shareStickerToZalo(
                                entry.sticker.url,
                                {
                                  bg: copyBgMode,
                                  size: stickerSize,
                                  addWhiteStroke: true,
                                  preferGif: animated,
                                },
                                entry.pack.title
                              );
                              showToast(
                                res === "shared"
                                  ? `Đã mở Chia sẻ Zalo (${animated ? "GIF" : "PNG"} • ${stickerSize}px)!`
                                  : `Đã Copy Sticker chuẩn Zalo (${stickerSize}px)!`,
                                "success"
                              );
                            } catch {
                              showToast("Không thể chia sẻ tự động", "error");
                            }
                          }}
                          title="Chia sẻ qua Zalo (Chuẩn GIF/PNG + Cỡ 180px + Có viền)"
                          className="flex-1 py-1 rounded-lg bg-[#0068ff] hover:bg-[#0057d9] text-white text-[10px] font-bold flex items-center justify-center gap-1 transition cursor-pointer"
                        >
                          <Share2 className="w-2.5 h-2.5" />
                          Zalo
                        </button>
                        <button
                          onClick={() =>
                            setStudioTarget({
                              sticker: entry.sticker,
                              pack: entry.pack,
                            })
                          }
                          title="Mở Studio / Tải GIF"
                          className="p-1.5 rounded-lg bg-white hover:bg-slate-100 text-slate-600 cursor-pointer"
                        >
                          <Wand2 className="w-3 h-3" />
                        </button>
                        <button
                          onClick={() =>
                            toggleFavoriteSticker(entry.sticker, entry.pack)
                          }
                          title="Bỏ yêu thích"
                          className="p-1.5 rounded-lg bg-white hover:bg-rose-50 text-rose-500 cursor-pointer"
                        >
                          <Heart
                            className={`w-3 h-3 ${
                              favoriteKeySet.has(entry.key)
                                ? "fill-rose-500"
                                : ""
                            }`}
                          />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* =========================================================
            TAB 4: SAVED PACKS (BỘ STICKER ĐÃ LƯU)
           ========================================================= */}
        {mainTab === "saved" && (
          <div className="space-y-3.5">
            <h2 className="text-base sm:text-lg font-bold text-slate-800 flex items-center gap-2">
              <Bookmark className="w-5 h-5 text-indigo-600 fill-indigo-600" />
              Bộ Sticker đã lưu ({savedPacks.length})
            </h2>

            {savedPacks.length === 0 ? (
              <div className="rounded-2xl bg-white border border-slate-200/80 p-10 text-center space-y-3">
                <p className="text-sm font-semibold text-slate-600">
                  Bạn chưa lưu bộ sticker nào.
                </p>
                <button
                  onClick={() => setMainTab("discover")}
                  className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold cursor-pointer"
                >
                  Khám phá bộ Sticker
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {savedPacks.map((pack) => {
                  const coverUrl = pack.cover?.url
                    ? getThumbnailUrl(pack.cover.url, 128)
                    : pack.stickers?.[0]?.url
                    ? getThumbnailUrl(pack.stickers[0].url, 128)
                    : "";
                  return (
                    <div
                      key={pack.id}
                      onClick={() => openPackDetail(pack)}
                      className="rounded-2xl bg-white border border-slate-200/80 hover:border-indigo-300 p-3.5 flex items-center justify-between gap-3 cursor-pointer transition shadow-2xs"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <img
                          src={coverUrl}
                          alt={pack.title}
                          className="w-12 h-12 object-contain rounded-xl bg-slate-50 border border-slate-200/60 p-1"
                        />
                        <div className="min-w-0">
                          <h3 className="font-bold text-sm text-slate-800 truncate">
                            {pack.title}
                          </h3>
                          <p className="text-xs text-slate-500 truncate">
                            {pack.author} • {pack.stickers?.length || 0} hình
                          </p>
                        </div>
                      </div>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleSavePack(pack);
                        }}
                        aria-label="Xóa bộ đã lưu"
                        className="p-2 rounded-xl bg-slate-100 hover:bg-rose-50 text-slate-500 hover:text-rose-600 cursor-pointer"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </main>

      {/* Mobile Fixed Bottom Navigation Bar (<= 5 items, 48px+ touch target, safe area) */}
      <nav
        aria-label="Điều hướng chính"
        className="lg:hidden fixed bottom-0 inset-x-0 z-30 bg-white/95 backdrop-blur-xl border-t border-slate-200/90 shadow-[0_-2px_10px_rgba(15,23,42,0.04)] pb-safe"
      >
        <div className="grid grid-cols-5 h-14 px-1">
          <button
            onClick={() => setMainTab("discover")}
            className={`flex flex-col items-center justify-center gap-0.5 text-[10px] font-semibold transition cursor-pointer ${
              mainTab === "discover"
                ? "text-indigo-600"
                : "text-slate-500 hover:text-slate-800"
            }`}
          >
            <Flame className="w-4 h-4" />
            <span>Khám phá</span>
          </button>

          <button
            onClick={() => setMainTab("collections")}
            className={`flex flex-col items-center justify-center gap-0.5 text-[10px] font-semibold transition cursor-pointer ${
              mainTab === "collections"
                ? "text-indigo-600"
                : "text-slate-500 hover:text-slate-800"
            }`}
          >
            <Layers className="w-4 h-4" />
            <span>Chủ đề</span>
          </button>

          <button
            onClick={() => setMainTab("favorites")}
            className={`relative flex flex-col items-center justify-center gap-0.5 text-[10px] font-semibold transition cursor-pointer ${
              mainTab === "favorites"
                ? "text-rose-600"
                : "text-slate-500 hover:text-slate-800"
            }`}
          >
            <Heart className={`w-4 h-4 ${mainTab === "favorites" ? "fill-rose-500" : ""}`} />
            <span>Yêu thích</span>
            {favoriteStickers.length > 0 && (
              <span className="absolute top-1.5 right-4 min-w-[15px] h-[15px] px-1 rounded-full bg-rose-500 text-white text-[9px] font-bold flex items-center justify-center">
                {favoriteStickers.length > 99 ? "99+" : favoriteStickers.length}
              </span>
            )}
          </button>

          <button
            onClick={() => setMainTab("saved")}
            className={`relative flex flex-col items-center justify-center gap-0.5 text-[10px] font-semibold transition cursor-pointer ${
              mainTab === "saved"
                ? "text-indigo-600"
                : "text-slate-500 hover:text-slate-800"
            }`}
          >
            <Bookmark className={`w-4 h-4 ${mainTab === "saved" ? "fill-indigo-600" : ""}`} />
            <span>Đã lưu</span>
            {savedPacks.length > 0 && (
              <span className="absolute top-1.5 right-4 min-w-[15px] h-[15px] px-1 rounded-full bg-indigo-600 text-white text-[9px] font-bold flex items-center justify-center">
                {savedPacks.length > 99 ? "99+" : savedPacks.length}
              </span>
            )}
          </button>

          <button
            onClick={() => setMainTab("recent")}
            className={`flex flex-col items-center justify-center gap-0.5 text-[10px] font-semibold transition cursor-pointer ${
              mainTab === "recent"
                ? "text-indigo-600"
                : "text-slate-500 hover:text-slate-800"
            }`}
          >
            <Clock className="w-4 h-4" />
            <span>Gần đây</span>
          </button>
        </div>
      </nav>

      {/* Footer */}
      <footer className="relative z-10 border-t border-slate-200/80 bg-white/60 mt-8 py-6 px-4 sm:px-6 text-xs text-slate-500">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-2 text-center sm:text-left">
          <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2">
            <span className="font-bold text-slate-700 tracking-tight">SigStick Hub VN</span>
            <span className="text-[10px] font-mono px-2 py-0.5 rounded-md bg-indigo-50 text-indigo-600 border border-indigo-200/70 font-semibold">
              {APP_VERSION}
            </span>
            <span className="text-slate-300 hidden sm:inline">•</span>
            <span className="text-slate-500">Kho Sticker tối ưu cho Zalo & Messenger</span>
          </div>
          <p className="text-slate-400 text-[11px]">
            Tự động tách nền PNG trong suốt & GIF động 1 chạm
          </p>
        </div>
      </footer>

      {/* Pack Detail Modal */}
      {selectedPack && (
        <PackDetailModal
          pack={selectedPack}
          isSavedPack={savedPackIdSet.has(selectedPack.id)}
          onToggleSavePack={toggleSavePack}
          isFavoriteSticker={(url) => favoriteKeySet.has(normalizeCdnUrl(url))}
          onToggleFavoriteSticker={toggleFavoriteSticker}
          onSelectStickerForStudio={(sticker, pack) => {
            setStudioTarget({ sticker, pack });
          }}
          onStickerUsed={recordRecentSticker}
          onToast={(msg) => showToast(msg, "success")}
          onClose={() => setSelectedPack(null)}
          onSearchTag={(tag) => {
            setSelectedPack(null);
            setSearchInput(tag);
            handleSearchSubmit(undefined, tag);
          }}
        />
      )}

      {/* Sticker Studio Modal */}
      {studioTarget && (
        <StickerStudioModal
          sticker={studioTarget.sticker}
          pack={studioTarget.pack}
          isFavorite={favoriteKeySet.has(
            normalizeCdnUrl(studioTarget.sticker.url)
          )}
          onToggleFavorite={() =>
            toggleFavoriteSticker(studioTarget.sticker, studioTarget.pack)
          }
          onCopied={(msg) => {
            recordRecentSticker(studioTarget.sticker, studioTarget.pack);
            showToast(msg, "success");
          }}
          onClose={() => setStudioTarget(null)}
        />
      )}

      {/* Guide Modal: How to send stickers to Zalo & Messenger */}
      {showGuideModal && (
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-slate-900/40 backdrop-blur-xs p-0 sm:p-4"
          onClick={() => setShowGuideModal(false)}
        >
          <div
            className="w-full max-w-xl rounded-t-3xl sm:rounded-3xl bg-white border border-slate-200 shadow-2xl overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 bg-slate-50/70">
              <div className="flex items-center gap-2">
                <HelpCircle className="w-5 h-5 text-indigo-600" />
                <h3 className="font-bold text-slate-800 text-sm sm:text-base">
                  Mẹo gửi Sticker qua Zalo & Messenger
                </h3>
              </div>
              <button
                onClick={() => setShowGuideModal(false)}
                className="p-2 rounded-full bg-slate-200/70 hover:bg-slate-200 text-slate-600 cursor-pointer"
                aria-label="Đóng hướng dẫn"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-5 space-y-4 text-sm text-slate-600 max-h-[78vh] overflow-y-auto">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="rounded-2xl bg-slate-50 border border-slate-200/70 p-4 space-y-2">
                  <div className="flex items-center gap-2 text-indigo-600 font-bold text-xs sm:text-sm">
                    <Smartphone className="w-4 h-4" />
                    <span>Trên Điện thoại (iOS / Android)</span>
                  </div>
                  <ul className="space-y-1.5 text-xs text-slate-600 list-disc pl-4 leading-relaxed">
                    <li>
                      <strong>Copy dán thẳng:</strong> Chạm vào bất kỳ sticker
                      nào để Copy ảnh đã tách nền, sau đó mở khung chat{" "}
                      <strong>Zalo / Messenger</strong> và chọn <strong>Dán</strong>.
                    </li>
                    <li>
                      <strong>Gửi ảnh động GIF:</strong> Mở bộ sticker, chọn{" "}
                      <strong>Gửi GIF</strong> rồi chạm vào sticker để mở bảng
                      Chia sẻ trực tiếp sang Zalo/Messenger.
                    </li>
                  </ul>
                </div>

                <div className="rounded-2xl bg-slate-50 border border-slate-200/70 p-4 space-y-2">
                  <div className="flex items-center gap-2 text-teal-600 font-bold text-xs sm:text-sm">
                    <Monitor className="w-4 h-4" />
                    <span>Trên Máy tính (PC / Laptop)</span>
                  </div>
                  <ul className="space-y-1.5 text-xs text-slate-600 list-disc pl-4 leading-relaxed">
                    <li>
                      <strong>Copy 1 chạm:</strong> Nhấn vào sticker bất kỳ rồi
                      qua cửa sổ <strong>Zalo PC</strong> hoặc{" "}
                      <strong>Messenger</strong> bấm{" "}
                      <kbd className="px-1.5 py-0.5 rounded bg-white border border-slate-300 text-slate-700 font-mono text-[11px]">
                        Ctrl + V
                      </kbd>
                      .
                    </li>
                    <li>
                      <strong>Kéo thả GIF động:</strong> Mở Studio để kéo thả
                      trực tiếp ảnh GIF động vào cửa sổ chat.
                    </li>
                  </ul>
                </div>
              </div>

              <div className="rounded-2xl bg-indigo-50/70 border border-indigo-100 p-3.5 text-xs text-indigo-900 space-y-1">
                <p className="font-bold text-indigo-700">
                  Tự động tách nền thông minh
                </p>
                <p className="leading-relaxed text-indigo-800/90">
                  Hệ thống tự động loại bỏ nền trắng/nền đặc của sticker và khử
                  viền răng cưa để khi gửi qua Zalo chỉ hiển thị đúng hình
                  nhân vật trong suốt.
                </p>
              </div>

              <div className="pt-2 flex items-center justify-between text-xs text-slate-400 border-t border-slate-100">
                <span>SigStick Hub VN</span>
                <span className="font-mono bg-slate-100 px-2 py-0.5 rounded text-indigo-600 border border-slate-200 font-semibold text-[11px]">
                  {APP_VERSION}
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Floating Toast Notification (Positioned above mobile bottom nav) */}
      {toast && (
        <div
          role="status"
          aria-live="polite"
          className="fixed bottom-16 lg:bottom-5 inset-x-3 sm:inset-x-auto sm:right-5 z-50 sm:max-w-sm animate-in fade-in slide-in-from-bottom-4 duration-200 pointer-events-none"
        >
          <div
            className={`px-4 py-3 rounded-2xl shadow-lg border flex items-center gap-2.5 text-xs sm:text-sm font-semibold backdrop-blur-md ${
              toast.type === "success"
                ? "bg-teal-600/95 border-teal-500 text-white"
                : toast.type === "error"
                ? "bg-rose-600/95 border-rose-500 text-white"
                : "bg-slate-800/95 border-slate-700 text-white"
            }`}
          >
            {toast.type === "success" ? (
              <Check className="w-4 h-4 text-teal-200 shrink-0" />
            ) : (
              <Sparkles className="w-4 h-4 text-indigo-300 shrink-0" />
            )}
            <span className="truncate">{toast.message}</span>
          </div>
        </div>
      )}
    </div>
  );
}
