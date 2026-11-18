import fs from "fs";
import path from "path";
import crypto from "crypto";
import { StickerPack, StickerItem } from "@/lib/sigstick";

export interface SavedStickerEntry {
  key: string;
  pack: StickerPack;
  sticker: StickerItem;
  savedAt: number;
}

export interface SyncProfileData {
  code: string;
  pinHash?: string;
  favorites: SavedStickerEntry[];
  savedPacks: StickerPack[];
  updatedAt: number;
}

const DATA_DIR = path.join(process.cwd(), "data", "sync");
const memCache = new Map<string, SyncProfileData>();

function ensureDirectoryExists() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

export function normalizeSyncCode(raw: string): string {
  return raw
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9_-]/g, "");
}

function hashPin(pin?: string): string | undefined {
  if (!pin || !pin.trim()) return undefined;
  return crypto.createHash("sha256").update(`sigstick_pin_${pin.trim()}`).digest("hex");
}

function getFilePath(code: string): string {
  ensureDirectoryExists();
  const safe = normalizeSyncCode(code);
  const hash = crypto.createHash("sha1").update(safe).digest("hex").slice(0, 16);
  return path.join(DATA_DIR, `${safe}_${hash}.json`);
}

export async function getSyncProfile(code: string): Promise<SyncProfileData | null> {
  const norm = normalizeSyncCode(code);
  if (!norm || norm.length < 3) return null;

  const cached = memCache.get(norm);
  if (cached) return cached;

  try {
    const filePath = getFilePath(norm);
    if (!fs.existsSync(filePath)) {
      return null;
    }
    const raw = fs.readFileSync(filePath, "utf-8");
    const parsed = JSON.parse(raw) as SyncProfileData;
    const data: SyncProfileData = {
      code: norm,
      pinHash: parsed.pinHash,
      favorites: Array.isArray(parsed.favorites) ? parsed.favorites : [],
      savedPacks: Array.isArray(parsed.savedPacks) ? parsed.savedPacks : [],
      updatedAt: parsed.updatedAt || Date.now(),
    };
    memCache.set(norm, data);
    return data;
  } catch (err) {
    console.error("Failed to read sync profile:", err);
    return null;
  }
}

export async function verifyAndGetSyncProfile(
  code: string,
  pin?: string
): Promise<{ ok: true; data: SyncProfileData | null } | { ok: false; error: string }> {
  const profile = await getSyncProfile(code);
  if (!profile) {
    return { ok: true, data: null };
  }
  if (profile.pinHash) {
    const inputHash = hashPin(pin);
    if (!inputHash || inputHash !== profile.pinHash) {
      return { ok: false, error: "Mã PIN bảo vệ không đúng!" };
    }
  }
  return { ok: true, data: profile };
}

export async function saveSyncProfile(
  code: string,
  pin: string | undefined,
  payload: { favorites?: SavedStickerEntry[]; savedPacks?: StickerPack[] }
): Promise<{ ok: true; data: SyncProfileData } | { ok: false; error: string }> {
  const norm = normalizeSyncCode(code);
  if (!norm || norm.length < 3) {
    return { ok: false, error: "Mã đồng bộ phải có ít nhất 3 ký tự (chữ hoặc số)." };
  }

  const existing = await getSyncProfile(norm);
  if (existing && existing.pinHash) {
    const inputHash = hashPin(pin);
    if (!inputHash || inputHash !== existing.pinHash) {
      return { ok: false, error: "Mã PIN bảo vệ không đúng!" };
    }
  }

  const updated: SyncProfileData = {
    code: norm,
    pinHash: existing?.pinHash || hashPin(pin),
    favorites: payload.favorites !== undefined ? payload.favorites : existing?.favorites || [],
    savedPacks: payload.savedPacks !== undefined ? payload.savedPacks : existing?.savedPacks || [],
    updatedAt: Date.now(),
  };

  memCache.set(norm, updated);

  try {
    const filePath = getFilePath(norm);
    const tempPath = `${filePath}.tmp`;
    fs.writeFileSync(tempPath, JSON.stringify(updated, null, 2), "utf-8");
    fs.renameSync(tempPath, filePath);
  } catch (err) {
    console.error("Failed to write sync profile:", err);
  }

  return { ok: true, data: updated };
}
