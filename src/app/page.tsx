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
import { copyStickerToClipboard } from "@/lib/stickerActions";
import PackDetailModal from "@/components/PackDetailModal";
import StickerStudioModal from "@/components/StickerStudioModal";

export interface SavedStickerEntry {
  key: string; // normalized sticker URL
  pack: StickerPack;
  sticker: StickerItem;
  savedAt: number;
}

const POPULAR_TAGS = [
  { label: "🔥 Meme Việt", query: "Meme" },
  { label: "🐱 Mèo Cute", query: "Cat" },
  { label: "🐻 Bubu Dudu", query: "Bubu Dudu" },
  { label: "🐹 Chiikawa", query: "Chiikawa" },
  { label: "👶 Quby / Pentol", query: "Quby" },
  { label: "🐶 Doge & Shiba", query: "Shiba" },
  { label: "🦫 Capybara", query: "Capybara" },
  { label: "🎌 Anime", query: "Anime" },
  { label: "🐸 Pepe", query: "Pepe" },
  { label: "💖 Tình yêu", query: "Couple Love" },
  { label: "😂 Hài hước", query: "Funny" },
  { label: "🐧 Cánh cụt", query: "Penguin" },
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
      }, 3600);
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
    } catch (e) {
      console.error("Failed to read localStorage", e);
    }
  }, []);

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
        showToast("❤️ Đã lưu vào Sticker yêu thích!", "success");
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
        showToast(`🔖 Đã lưu bộ sticker "${pack.title}"!`, "success");
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

  // Quick 1-click copy on pack preview card
  const handleQuickPreviewCopy = async (
    e: React.MouseEvent,
    pack: StickerPack,
    sticker: StickerItem
  ) => {
    e.stopPropagation();
    const key = normalizeCdnUrl(sticker.url);
    setCopyingPreviewKey(key);
    try {
      await copyStickerToClipboard(sticker.url, { addWhiteStroke: false });
      recordRecentSticker(sticker, pack);
      setCopiedPreviewKey(key);
      showToast(
        "Đã Copy Sticker (PNG)! Mở Zalo / Messenger và nhấn Ctrl+V để gửi ngay.",
        "success"
      );
      setTimeout(() => {
        setCopiedPreviewKey((prev) => (prev === key ? null : prev));
      }, 2000);
    } catch {
      showToast(
        "Trình duyệt chặn Clipboard tự động, đang mở Studio để bạn tải/chia sẻ!",
        "info"
      );
      setStudioTarget({
        sticker,
        pack,
      });
    } finally {
      setCopyingPreviewKey(null);
    }
  };

  const favoriteKeySet = new Set(favoriteStickers.map((s) => s.key));
  const savedPackIdSet = new Set(savedPacks.map((p) => p.id));

  return (
    <div className="min-h-screen flex flex-col bg-[#090d16] text-slate-100">
      {/* Decorative Ambient Background Glows */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden z-0">
        <div className="absolute -top-40 -left-40 w-96 h-96 bg-indigo-600/15 rounded-full blur-[130px]" />
        <div className="absolute top-20 right-0 w-96 h-96 bg-fuchsia-600/10 rounded-full blur-[140px]" />
        <div className="absolute bottom-0 left-1/3 w-96 h-96 bg-blue-600/10 rounded-full blur-[150px]" />
      </div>

      {/* Top Sticky Navbar */}
      <header className="sticky top-0 z-30 backdrop-blur-xl bg-[#090d16]/85 border-b border-slate-800/80">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-3">
          {/* Brand Logo */}
          <div
            onClick={() => {
              setMainTab("discover");
              setActiveQuery("");
              setSearchInput("");
            }}
            className="flex items-center gap-3 cursor-pointer group shrink-0"
          >
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-indigo-600 via-violet-500 to-pink-500 flex items-center justify-center shadow-lg shadow-indigo-500/25 group-hover:scale-105 transition">
              <MessageCircle className="w-5 h-5 text-white fill-white/20" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-extrabold text-lg tracking-tight bg-gradient-to-r from-white via-indigo-200 to-pink-200 bg-clip-text text-transparent">
                  SigStick Hub
                </span>
                <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                  Zalo & Messenger
                </span>
              </div>
              <p className="text-[11px] text-slate-400 hidden sm:block">
                Kho Sticker SigStick • Tự động đổi PNG & GIF động 1 chạm
              </p>
            </div>
          </div>

          {/* Navigation Pills (Desktop) */}
          <nav className="hidden lg:flex items-center gap-1 bg-slate-900/90 p-1 rounded-xl border border-slate-800">
            <button
              onClick={() => setMainTab("discover")}
              className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer ${
                mainTab === "discover"
                  ? "bg-indigo-600 text-white shadow"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              <Flame className="w-3.5 h-3.5" />
              Khám phá
            </button>
            <button
              onClick={() => setMainTab("collections")}
              className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer ${
                mainTab === "collections"
                  ? "bg-indigo-600 text-white shadow"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              <Layers className="w-3.5 h-3.5" />
              Bộ sưu tập
            </button>
            <button
              onClick={() => setMainTab("favorites")}
              className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer ${
                mainTab === "favorites"
                  ? "bg-pink-600 text-white shadow"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              <Heart className="w-3.5 h-3.5" />
              Yêu thích ({favoriteStickers.length})
            </button>
            <button
              onClick={() => setMainTab("saved")}
              className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer ${
                mainTab === "saved"
                  ? "bg-indigo-600 text-white shadow"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              <Bookmark className="w-3.5 h-3.5" />
              Đã lưu ({savedPacks.length})
            </button>
            <button
              onClick={() => setMainTab("recent")}
              className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer ${
                mainTab === "recent"
                  ? "bg-indigo-600 text-white shadow"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              <Clock className="w-3.5 h-3.5" />
              Gần đây ({recentStickers.length})
            </button>
          </nav>

          {/* Right Action Buttons */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowGuideModal(true)}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-800/90 hover:bg-slate-700 text-slate-200 border border-slate-700/80 text-xs font-semibold transition cursor-pointer"
            >
              <HelpCircle className="w-4 h-4 text-indigo-400" />
              <span className="hidden sm:inline">Cách gửi Zalo / Messenger</span>
              <span className="sm:hidden">Hướng dẫn</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Content Container */}
      <main className="relative z-10 flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 py-6 space-y-6">
        {/* Hero Search & Quick URL Import */}
        <section className="relative rounded-3xl bg-gradient-to-br from-slate-900/95 via-[#11182c]/95 to-indigo-950/40 border border-slate-800/90 p-5 sm:p-7 shadow-2xl">
          <div className="max-w-3xl mx-auto text-center space-y-3 mb-5">
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white">
              Gửi Sticker{" "}
              <span className="bg-gradient-to-r from-sky-400 to-blue-500 bg-clip-text text-transparent">
                Zalo
              </span>{" "}
              &{" "}
              <span className="bg-gradient-to-r from-indigo-400 via-purple-400 to-pink-400 bg-clip-text text-transparent">
                Messenger
              </span>{" "}
              siêu tốc
            </h1>
            <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
              Tìm kiếm hàng trăm ngàn bộ sticker từ{" "}
              <code className="text-indigo-300 font-semibold">sigstick.com</code>
              . Nhấn vào bất kỳ sticker nào để{" "}
              <strong className="text-white">Copy PNG dán thẳng (Ctrl+V)</strong>
              , <strong className="text-white">Chia sẻ ảnh động GIF</strong> hoặc{" "}
              <strong className="text-white">Chế chữ Meme</strong>!
            </p>
          </div>

          {/* Search Form */}
          <form
            onSubmit={(e) => handleSearchSubmit(e)}
            className="relative max-w-2xl mx-auto"
          >
            <div className="relative flex items-center">
              <Search className="w-5 h-5 text-slate-400 absolute left-4 pointer-events-none" />
              <input
                type="text"
                value={searchInput}
                onFocus={() => setShowSuggestions(true)}
                onBlur={() => setTimeout(() => setShowSuggestions(false), 180)}
                onChange={(e) => setSearchInput(e.target.value)}
                placeholder="Tìm tên sticker (vd: Mèo, Bubu Dudu, Chiikawa...) hoặc dán link sigstick.com/pack/..."
                className="w-full pl-12 pr-28 py-3.5 rounded-2xl bg-slate-950/90 border border-slate-700/80 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 shadow-inner"
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
                  className="absolute right-24 p-1.5 text-slate-400 hover:text-white cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
              <button
                type="submit"
                disabled={isLoadingDirectPack}
                className="absolute right-2 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs transition shadow-md cursor-pointer"
              >
                {isLoadingDirectPack ? "Đang mở..." : "Tìm kiếm"}
              </button>
            </div>

            {/* Autocomplete Suggestions Dropdown */}
            {showSuggestions && suggestions.length > 0 && (
              <div className="absolute left-0 right-0 top-full mt-2 bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl overflow-hidden z-30">
                <div className="px-3 py-1.5 text-[11px] font-semibold text-slate-400 border-b border-slate-800 flex items-center justify-between">
                  <span>Gợi ý từ SigStick</span>
                  <span>Nhấn để tìm</span>
                </div>
                <div className="divide-y divide-slate-800/60 max-h-60 overflow-y-auto">
                  {suggestions.map((sug) => (
                    <button
                      type="button"
                      key={sug}
                      onMouseDown={() => {
                        setSearchInput(sug);
                        handleSearchSubmit(undefined, sug);
                      }}
                      className="w-full px-4 py-2.5 text-left text-sm text-slate-200 hover:bg-indigo-600/20 hover:text-indigo-200 flex items-center gap-2.5 transition cursor-pointer"
                    >
                      <Search className="w-3.5 h-3.5 text-slate-400" />
                      <span>{sug}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </form>

          {/* Popular Tag Chips */}
          <div className="max-w-4xl mx-auto mt-4 flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar">
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
                  className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-medium transition cursor-pointer border ${
                    isSelected
                      ? "bg-indigo-600 text-white border-indigo-400 shadow-sm"
                      : "bg-slate-800/80 hover:bg-slate-700/80 text-slate-300 border-slate-700/70"
                  }`}
                >
                  {tag.label}
                </button>
              );
            })}
          </div>
        </section>

        {/* Mobile / Tablet Navigation Bar */}
        <div className="flex lg:hidden items-center gap-1.5 overflow-x-auto pb-1">
          <button
            onClick={() => setMainTab("discover")}
            className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold shrink-0 cursor-pointer ${
              mainTab === "discover"
                ? "bg-indigo-600 text-white"
                : "bg-slate-900 text-slate-400 border border-slate-800"
            }`}
          >
            <Flame className="w-3.5 h-3.5" />
            Khám phá
          </button>
          <button
            onClick={() => setMainTab("collections")}
            className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold shrink-0 cursor-pointer ${
              mainTab === "collections"
                ? "bg-indigo-600 text-white"
                : "bg-slate-900 text-slate-400 border border-slate-800"
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            Bộ sưu tập
          </button>
          <button
            onClick={() => setMainTab("favorites")}
            className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold shrink-0 cursor-pointer ${
              mainTab === "favorites"
                ? "bg-pink-600 text-white"
                : "bg-slate-900 text-slate-400 border border-slate-800"
            }`}
          >
            <Heart className="w-3.5 h-3.5" />
            Yêu thích ({favoriteStickers.length})
          </button>
          <button
            onClick={() => setMainTab("saved")}
            className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold shrink-0 cursor-pointer ${
              mainTab === "saved"
                ? "bg-indigo-600 text-white"
                : "bg-slate-900 text-slate-400 border border-slate-800"
            }`}
          >
            <Bookmark className="w-3.5 h-3.5" />
            Đã lưu ({savedPacks.length})
          </button>
          <button
            onClick={() => setMainTab("recent")}
            className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold shrink-0 cursor-pointer ${
              mainTab === "recent"
                ? "bg-indigo-600 text-white"
                : "bg-slate-900 text-slate-400 border border-slate-800"
            }`}
          >
            <Clock className="w-3.5 h-3.5" />
            Gần đây ({recentStickers.length})
          </button>
        </div>

        {/* =========================================================
            TAB 1: DISCOVER & SEARCH RESULTS
           ========================================================= */}
        {mainTab === "discover" && (
          <div className="space-y-5">
            {/* Sub-header controls: Trending / Top / New OR Active Search Banner */}
            <div className="flex flex-wrap items-center justify-between gap-3">
              {activeQuery ? (
                <div className="flex items-center gap-3">
                  <h2 className="text-lg font-bold text-white flex items-center gap-2">
                    <Search className="w-5 h-5 text-indigo-400" />
                    Kết quả cho:{" "}
                    <span className="text-indigo-300">
                      &ldquo;{activeQuery}&rdquo;
                    </span>
                    <span className="text-xs font-normal text-slate-400">
                      ({packs.length} bộ sticker)
                    </span>
                  </h2>
                  <button
                    onClick={() => {
                      setActiveQuery("");
                      setSearchInput("");
                    }}
                    className="px-3 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs text-slate-300 flex items-center gap-1 cursor-pointer"
                  >
                    <X className="w-3.5 h-3.5" />
                    Xóa bộ lọc
                  </button>
                </div>
              ) : (
                <div className="flex items-center gap-1.5 bg-slate-900/90 p-1 rounded-xl border border-slate-800">
                  <button
                    onClick={() => setDiscoverTab("trending")}
                    className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer ${
                      discoverTab === "trending"
                        ? "bg-gradient-to-r from-orange-500 to-pink-600 text-white shadow"
                        : "text-slate-400 hover:text-white"
                    }`}
                  >
                    <Flame className="w-3.5 h-3.5" />
                    Thịnh hành (Trending)
                  </button>
                  <button
                    onClick={() => setDiscoverTab("top")}
                    className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer ${
                      discoverTab === "top"
                        ? "bg-indigo-600 text-white shadow"
                        : "text-slate-400 hover:text-white"
                    }`}
                  >
                    <Trophy className="w-3.5 h-3.5" />
                    Tải nhiều nhất
                  </button>
                  <button
                    onClick={() => setDiscoverTab("new")}
                    className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer ${
                      discoverTab === "new"
                        ? "bg-emerald-600 text-white shadow"
                        : "text-slate-400 hover:text-white"
                    }`}
                  >
                    <Sparkles className="w-3.5 h-3.5" />
                    Mới cập nhật
                  </button>
                </div>
              )}

              {/* Region Filter (when browsing Discover) */}
              {!activeQuery && (
                <div className="flex items-center gap-2 text-xs">
                  <span className="text-slate-400">Khu vực:</span>
                  {(
                    [
                      { id: "vn", label: "🇻🇳 Việt Nam" },
                      { id: "jp", label: "🇯🇵 Nhật Bản" },
                      { id: "kr", label: "🇰🇷 Hàn Quốc" },
                      { id: "us", label: "🌎 Quốc tế" },
                    ] as const
                  ).map((r) => (
                    <button
                      key={r.id}
                      onClick={() => setRegion(r.id)}
                      className={`px-2.5 py-1 rounded-lg font-medium transition cursor-pointer border ${
                        region === r.id
                          ? "bg-indigo-600/25 text-indigo-200 border-indigo-500/50"
                          : "bg-slate-900 text-slate-400 border-slate-800 hover:text-slate-200"
                      }`}
                    >
                      {r.label}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Pack Cards Grid */}
            {isLoading ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {Array.from({ length: 9 }).map((_, idx) => (
                  <div
                    key={idx}
                    className="h-56 rounded-2xl bg-slate-900/60 border border-slate-800/80 p-4 animate-pulse flex flex-col justify-between"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-14 h-14 rounded-xl bg-slate-800" />
                      <div className="flex-1 space-y-2">
                        <div className="h-4 bg-slate-800 rounded w-3/4" />
                        <div className="h-3 bg-slate-800 rounded w-1/2" />
                      </div>
                    </div>
                    <div className="grid grid-cols-4 gap-2">
                      {Array.from({ length: 4 }).map((__, i) => (
                        <div
                          key={i}
                          className="aspect-square rounded-xl bg-slate-800/70"
                        />
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            ) : packs.length === 0 ? (
              <div className="rounded-2xl bg-slate-900/50 border border-slate-800 p-12 text-center space-y-3">
                <p className="text-base font-semibold text-slate-300">
                  Không tìm thấy bộ sticker nào khớp với từ khóa này.
                </p>
                <p className="text-xs text-slate-400">
                  Hãy thử tìm bằng từ khóa tiếng Anh (vd: Cat, Bear, Cute, Meme,
                  Anime) hoặc dán trực tiếp link từ sigstick.com.
                </p>
              </div>
            ) : (
              <>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
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
                        className="group relative rounded-2xl bg-slate-900/75 hover:bg-slate-900 border border-slate-800/90 hover:border-indigo-500/50 p-4 transition-all duration-200 flex flex-col justify-between cursor-pointer shadow-lg hover:shadow-indigo-500/10"
                      >
                        {/* Pack Card Header */}
                        <div className="flex items-start gap-3">
                          <div className="w-14 h-14 rounded-2xl bg-slate-800/90 border border-slate-700/70 p-1.5 shrink-0 flex items-center justify-center overflow-hidden">
                            {coverUrl ? (
                              <img
                                src={coverUrl}
                                alt={pack.title}
                                className="w-full h-full object-contain group-hover:scale-110 transition duration-200"
                                loading="lazy"
                              />
                            ) : (
                              <Sparkles className="w-6 h-6 text-indigo-400" />
                            )}
                          </div>

                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-1.5">
                              <h3 className="font-bold text-sm text-white truncate group-hover:text-indigo-300 transition">
                                {pack.title}
                              </h3>
                            </div>
                            <p className="text-xs text-slate-400 truncate mt-0.5">
                              {pack.author || "SigStick Creator"}
                            </p>
                            <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                              {animated ? (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-gradient-to-r from-pink-500/20 to-violet-500/20 text-pink-300 border border-pink-500/30">
                                  <Sparkles className="w-2.5 h-2.5" />
                                  Động (GIF)
                                </span>
                              ) : (
                                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium bg-slate-800 text-slate-300">
                                  Tĩnh (PNG)
                                </span>
                              )}
                              <span className="text-[11px] text-slate-400">
                                {pack.stickers?.length || 0} hình
                              </span>
                              {pack.download ? (
                                <span className="text-[11px] text-slate-400 flex items-center gap-0.5">
                                  • <Download className="w-3 h-3 inline" />{" "}
                                  {formatCount(pack.download)}
                                </span>
                              ) : null}
                            </div>
                          </div>

                          {/* Bookmark Pack Button */}
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              toggleSavePack(pack);
                            }}
                            title={isSaved ? "Bỏ lưu bộ này" : "Lưu bộ sticker"}
                            className={`p-2 rounded-xl border transition cursor-pointer shrink-0 ${
                              isSaved
                                ? "bg-indigo-600/20 border-indigo-500/50 text-indigo-300"
                                : "bg-slate-800/70 border-slate-700/60 text-slate-400 hover:text-white"
                            }`}
                          >
                            <Bookmark
                              className={`w-4 h-4 ${
                                isSaved ? "fill-indigo-400" : ""
                              }`}
                            />
                          </button>
                        </div>

                        {/* 4 Preview Stickers with 1-Click Copy on Hover */}
                        <div className="grid grid-cols-4 gap-2 my-3.5">
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
                                title="Nhấn để Copy nhanh sticker này vào Clipboard (Ctrl+V)"
                                className="relative aspect-square rounded-xl bg-slate-800/50 hover:bg-slate-800 border border-slate-700/40 hover:border-indigo-500/60 p-1.5 flex items-center justify-center overflow-hidden group/st transition"
                              >
                                <img
                                  src={thumbUrl}
                                  alt={getEmojiString(st.emoji)}
                                  className="w-full h-full object-contain group-hover/st:scale-110 transition"
                                  loading="lazy"
                                />
                                <div className="absolute inset-0 bg-indigo-950/75 opacity-0 group-hover/st:opacity-100 transition flex flex-col items-center justify-center gap-0.5 text-[10px] font-bold text-white">
                                  {isCopying ? (
                                    <Loader2 className="w-4 h-4 animate-spin text-indigo-300" />
                                  ) : isCopied ? (
                                    <>
                                      <Check className="w-4 h-4 text-emerald-400" />
                                      <span className="text-emerald-300">
                                        Đã Copy
                                      </span>
                                    </>
                                  ) : (
                                    <>
                                      <Copy className="w-3.5 h-3.5 text-indigo-300" />
                                      <span>Copy</span>
                                    </>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                        </div>

                        {/* Card Footer */}
                        <div className="flex items-center justify-between pt-2 border-t border-slate-800/80 text-xs">
                          <span className="text-slate-400 text-[11px]">
                            Nhấn hình nhỏ để Copy luôn
                          </span>
                          <span className="font-semibold text-indigo-400 group-hover:text-indigo-300 flex items-center gap-1">
                            Xem trọn bộ ({pack.stickers?.length || 0})
                            <ChevronRight className="w-3.5 h-3.5" />
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Load More Pagination Button */}
                {nextCursor && !activeQuery && (
                  <div className="flex justify-center pt-4">
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
                      className="px-6 py-3 rounded-2xl bg-slate-800 hover:bg-slate-700 text-white font-semibold text-sm border border-slate-700 flex items-center gap-2 transition cursor-pointer disabled:opacity-50"
                    >
                      {isLoadingMore ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          Đang tải thêm...
                        </>
                      ) : (
                        <>Tải thêm bộ Sticker</>
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
          <div className="space-y-8">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-xl font-bold text-white flex items-center gap-2">
                  <Layers className="w-5 h-5 text-indigo-400" />
                  Bộ sưu tập Sticker theo chủ đề
                </h2>
                <p className="text-xs text-slate-400 mt-0.5">
                  Tổng hợp các chủ đề được yêu thích nhất trên SigStick
                </p>
              </div>
            </div>

            {isLoading ? (
              <div className="flex items-center justify-center py-20">
                <Loader2 className="w-8 h-8 text-indigo-500 animate-spin" />
              </div>
            ) : (
              <div className="space-y-8">
                {collections.map((col) => (
                  <div
                    key={col.id}
                    className="rounded-2xl bg-slate-900/60 border border-slate-800 p-5 space-y-4"
                  >
                    <div className="flex items-center justify-between">
                      <h3 className="text-base font-bold text-white flex items-center gap-2">
                        <Sparkles className="w-4 h-4 text-amber-400" />
                        {col.title}
                      </h3>
                      <span className="text-xs text-slate-400">
                        {col.items?.length || 0} bộ sticker
                      </span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
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
                            className="rounded-xl bg-slate-950/70 hover:bg-slate-800/80 border border-slate-800 hover:border-indigo-500/40 p-3 flex items-center gap-3 cursor-pointer transition"
                          >
                            <img
                              src={coverUrl}
                              alt={pack.title}
                              className="w-12 h-12 object-contain rounded-lg bg-slate-900 p-1 shrink-0"
                            />
                            <div className="min-w-0 flex-1">
                              <p className="text-xs font-bold text-white truncate">
                                {pack.title}
                              </p>
                              <p className="text-[11px] text-slate-400 truncate">
                                {pack.stickers?.length || 0} stickers •{" "}
                                {formatCount(pack.download)} tải
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
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-xl font-bold text-white flex items-center gap-2">
                  {mainTab === "favorites" ? (
                    <>
                      <Heart className="w-5 h-5 text-pink-500 fill-pink-500" />
                      Sticker Yêu thích của bạn ({favoriteStickers.length})
                    </>
                  ) : (
                    <>
                      <Clock className="w-5 h-5 text-indigo-400" />
                      Sticker vừa sử dụng gần đây ({recentStickers.length})
                    </>
                  )}
                </h2>
                <p className="text-xs text-slate-400 mt-0.5">
                  Nhấn vào từng sticker để Copy PNG ngay lập tức, Chia sẻ GIF
                  hoặc mở Phòng Studio chế chữ.
                </p>
              </div>

              {mainTab === "recent" && recentStickers.length > 0 && (
                <button
                  onClick={() => {
                    setRecentStickers([]);
                    localStorage.removeItem("sigstick_vn_recent_stickers");
                    showToast("Đã xóa lịch sử sticker gần đây", "info");
                  }}
                  className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-rose-950/60 text-slate-300 hover:text-rose-300 text-xs font-medium flex items-center gap-1.5 border border-slate-700 cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  Xóa lịch sử
                </button>
              )}
            </div>

            {(mainTab === "favorites" ? favoriteStickers : recentStickers)
              .length === 0 ? (
              <div className="rounded-2xl bg-slate-900/50 border border-slate-800 p-12 text-center space-y-3">
                <p className="text-base font-semibold text-slate-300">
                  {mainTab === "favorites"
                    ? "Bạn chưa thả tim lưu riêng sticker nào."
                    : "Bạn chưa copy hoặc chia sẻ sticker nào gần đây."}
                </p>
                <button
                  onClick={() => setMainTab("discover")}
                  className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold cursor-pointer"
                >
                  Khám phá kho Sticker ngay
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-3">
                {(mainTab === "favorites"
                  ? favoriteStickers
                  : recentStickers
                ).map((entry) => {
                  const thumbUrl = getThumbnailUrl(entry.sticker.url, 256);
                  return (
                    <div
                      key={entry.key}
                      className="group relative rounded-2xl bg-slate-900/80 border border-slate-800 hover:border-indigo-500/60 p-3 flex flex-col items-center justify-between gap-2 transition"
                    >
                      <div
                        onClick={async () => {
                          try {
                            await copyStickerToClipboard(entry.sticker.url);
                            showToast(
                              "Đã Copy PNG! Dán (Ctrl+V) vào Zalo / Messenger ngay.",
                              "success"
                            );
                          } catch {
                            setStudioTarget({
                              sticker: entry.sticker,
                              pack: entry.pack,
                            });
                          }
                        }}
                        className="w-full aspect-square flex items-center justify-center cursor-pointer"
                      >
                        <img
                          src={thumbUrl}
                          alt={entry.pack.title}
                          className="w-full h-full object-contain group-hover:scale-105 transition"
                        />
                      </div>

                      <div className="w-full flex items-center justify-between gap-1 pt-1 border-t border-slate-800/80">
                        <button
                          onClick={async () => {
                            try {
                              await copyStickerToClipboard(entry.sticker.url);
                              showToast(
                                "Đã Copy PNG vào Clipboard!",
                                "success"
                              );
                            } catch {
                              showToast("Không thể Copy tự động", "error");
                            }
                          }}
                          title="Copy PNG"
                          className="flex-1 py-1 rounded-lg bg-indigo-600/20 hover:bg-indigo-600 text-indigo-300 hover:text-white text-[10px] font-bold flex items-center justify-center gap-1 transition cursor-pointer"
                        >
                          <Copy className="w-3 h-3" />
                          Copy
                        </button>
                        <button
                          onClick={() =>
                            setStudioTarget({
                              sticker: entry.sticker,
                              pack: entry.pack,
                            })
                          }
                          title="Mở Studio / Tải GIF"
                          className="p-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 cursor-pointer"
                        >
                          <Wand2 className="w-3 h-3" />
                        </button>
                        <button
                          onClick={() =>
                            toggleFavoriteSticker(entry.sticker, entry.pack)
                          }
                          title="Bỏ yêu thích"
                          className="p-1 rounded-lg bg-slate-800 hover:bg-pink-600/20 text-pink-400 cursor-pointer"
                        >
                          <Heart
                            className={`w-3 h-3 ${
                              favoriteKeySet.has(entry.key)
                                ? "fill-pink-500"
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
          <div className="space-y-4">
            <h2 className="text-xl font-bold text-white flex items-center gap-2">
              <Bookmark className="w-5 h-5 text-indigo-400 fill-indigo-400" />
              Bộ Sticker đã lưu ({savedPacks.length})
            </h2>

            {savedPacks.length === 0 ? (
              <div className="rounded-2xl bg-slate-900/50 border border-slate-800 p-12 text-center space-y-3">
                <p className="text-base font-semibold text-slate-300">
                  Bạn chưa lưu bộ sticker nào.
                </p>
                <button
                  onClick={() => setMainTab("discover")}
                  className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold cursor-pointer"
                >
                  Khám phá bộ Sticker ngay
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
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
                      className="rounded-2xl bg-slate-900/80 border border-slate-800 hover:border-indigo-500/50 p-4 flex items-center justify-between gap-3 cursor-pointer transition"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <img
                          src={coverUrl}
                          alt={pack.title}
                          className="w-14 h-14 object-contain rounded-xl bg-slate-800 p-1.5"
                        />
                        <div className="min-w-0">
                          <h3 className="font-bold text-sm text-white truncate">
                            {pack.title}
                          </h3>
                          <p className="text-xs text-slate-400 truncate">
                            {pack.author} • {pack.stickers?.length || 0} hình
                          </p>
                        </div>
                      </div>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleSavePack(pack);
                        }}
                        className="p-2 rounded-xl bg-slate-800 hover:bg-rose-950/60 text-slate-300 hover:text-rose-300 cursor-pointer"
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
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4"
          onClick={() => setShowGuideModal(false)}
        >
          <div
            className="w-full max-w-2xl rounded-3xl bg-slate-900 border border-slate-700/80 shadow-2xl overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-900/80">
              <div className="flex items-center gap-2.5">
                <HelpCircle className="w-5 h-5 text-indigo-400" />
                <h3 className="font-bold text-white text-base">
                  Mẹo gửi Sticker qua Zalo & Messenger nhanh nhất
                </h3>
              </div>
              <button
                onClick={() => setShowGuideModal(false)}
                className="p-1.5 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-300 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-6 space-y-5 text-sm text-slate-300 max-h-[80vh] overflow-y-auto">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="rounded-2xl bg-slate-800/60 border border-slate-700/70 p-4 space-y-2.5">
                  <div className="flex items-center gap-2 text-indigo-300 font-bold">
                    <Monitor className="w-4 h-4" />
                    <span>Trên Máy tính (PC / Laptop)</span>
                  </div>
                  <ul className="space-y-2 text-xs text-slate-300 list-disc pl-4 leading-relaxed">
                    <li>
                      <strong>Cách 1 (Sticker tĩnh PNG - 1 giây):</strong> Nhấn
                      trực tiếp vào bất kỳ sticker nào để{" "}
                      <strong>Copy PNG</strong>, sau đó chuyển qua cửa sổ chat{" "}
                      <strong>Zalo PC</strong> hoặc{" "}
                      <strong>Messenger Web</strong> và bấm{" "}
                      <kbd className="px-1.5 py-0.5 rounded bg-slate-950 border border-slate-700 text-indigo-300">
                        Ctrl + V
                      </kbd>
                      .
                    </li>
                    <li>
                      <strong>Cách 2 (Sticker động GIF):</strong> Mở bộ sticker
                      động, chọn chế độ <strong>Studio / Chế chữ</strong> và
                      chuyển sang tab <strong>Ảnh động GIF</strong>. Bạn có thể{" "}
                      <strong>Kéo-thả trực tiếp ảnh GIF</strong> từ khung xem
                      trước thả vào khung chat Zalo/Messenger hoặc tải file{" "}
                      <code>.gif</code>.
                    </li>
                  </ul>
                </div>

                <div className="rounded-2xl bg-slate-800/60 border border-slate-700/70 p-4 space-y-2.5">
                  <div className="flex items-center gap-2 text-pink-300 font-bold">
                    <Smartphone className="w-4 h-4" />
                    <span>Trên Điện thoại (iOS / Android)</span>
                  </div>
                  <ul className="space-y-2 text-xs text-slate-300 list-disc pl-4 leading-relaxed">
                    <li>
                      <strong>Gửi qua Menu Chia sẻ (Share Sheet):</strong> Mở bộ
                      sticker, chuyển thanh công cụ sang chế độ{" "}
                      <strong>Gửi GIF / Share</strong> rồi chạm vào sticker.
                      Menu chia sẻ của điện thoại sẽ bật lên để bạn chọn{" "}
                      <strong>Zalo</strong> hoặc <strong>Messenger</strong> gửi
                      ngay không cần lưu máy!
                    </li>
                    <li>
                      <strong>Cài đặt như App (PWA):</strong> Chọn{" "}
                      <em>&ldquo;Thêm vào màn hình chính&rdquo;</em> trên Safari
                      hoặc Chrome để mở ứng dụng full màn hình mọi lúc.
                    </li>
                  </ul>
                </div>
              </div>

              <div className="rounded-2xl bg-indigo-950/40 border border-indigo-500/30 p-4 text-xs text-indigo-200 space-y-1">
                <p className="font-bold text-indigo-300">
                  💡 Vì sao cần tự động chuyển đổi định dạng?
                </p>
                <p className="leading-relaxed">
                  SigStick lưu trữ sticker gốc dưới dạng <code>.webp</code> và{" "}
                  <code>APNG</code>. Khi gửi trực tiếp vào Zalo hoặc Messenger,
                  các định dạng này thường bị lỗi đứng hình hoặc biến thành file
                  đính kèm. Hệ thống của chúng tôi tự động giải mã từng khung
                  hình sang chuẩn <strong>PNG trong suốt</strong> và{" "}
                  <strong>GIF lặp vô hạn</strong> tương thích 100% với Zalo &
                  Messenger!
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Floating Toast Notification */}
      {toast && (
        <div className="fixed bottom-5 right-5 z-50 max-w-sm animate-in fade-in slide-in-from-bottom-4 duration-200">
          <div
            className={`px-4 py-3 rounded-2xl shadow-2xl border flex items-center gap-3 text-xs sm:text-sm font-medium ${
              toast.type === "success"
                ? "bg-emerald-950/95 border-emerald-500/50 text-emerald-100"
                : toast.type === "error"
                ? "bg-rose-950/95 border-rose-500/50 text-rose-100"
                : "bg-slate-900/95 border-indigo-500/50 text-indigo-100"
            }`}
          >
            {toast.type === "success" ? (
              <Check className="w-4 h-4 text-emerald-400 shrink-0" />
            ) : (
              <Sparkles className="w-4 h-4 text-indigo-400 shrink-0" />
            )}
            <span>{toast.message}</span>
          </div>
        </div>
      )}
    </div>
  );
}
