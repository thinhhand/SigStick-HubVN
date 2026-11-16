import fs from "fs";
import path from "path";
import { StickerPack, StickerItem } from "@/lib/sigstick";

export interface SavedStickerEntry {
  key: string;
  pack: StickerPack;
  sticker: StickerItem;
  savedAt: number;
}

export interface UserData {
  favorites: SavedStickerEntry[];
  savedPacks: StickerPack[];
  updatedAt: number;
}

const DATA_DIR = path.join(process.cwd(), "data", "users");

function ensureDirectoryExists() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

function sanitizeId(id: string): string {
  return id.replace(/[^a-zA-Z0-9_-]/g, "_");
}

function getUserFilePath(userId: string): string {
  ensureDirectoryExists();
  return path.join(DATA_DIR, `${sanitizeId(userId)}.json`);
}

export async function getUserData(userId: string): Promise<UserData> {
  try {
    const filePath = getUserFilePath(userId);
    if (!fs.existsSync(filePath)) {
      return { favorites: [], savedPacks: [], updatedAt: Date.now() };
    }
    const raw = fs.readFileSync(filePath, "utf-8");
    const parsed = JSON.parse(raw);
    return {
      favorites: Array.isArray(parsed.favorites) ? parsed.favorites : [],
      savedPacks: Array.isArray(parsed.savedPacks) ? parsed.savedPacks : [],
      updatedAt: parsed.updatedAt || Date.now(),
    };
  } catch (err) {
    console.error("Failed to read user data:", err);
    return { favorites: [], savedPacks: [], updatedAt: Date.now() };
  }
}

export async function saveUserData(
  userId: string,
  data: { favorites?: SavedStickerEntry[]; savedPacks?: StickerPack[] }
): Promise<UserData> {
  const current = await getUserData(userId);
  const updated: UserData = {
    favorites: data.favorites !== undefined ? data.favorites : current.favorites,
    savedPacks: data.savedPacks !== undefined ? data.savedPacks : current.savedPacks,
    updatedAt: Date.now(),
  };

  try {
    const filePath = getUserFilePath(userId);
    const tempPath = `${filePath}.tmp`;
    fs.writeFileSync(tempPath, JSON.stringify(updated, null, 2), "utf-8");
    fs.renameSync(tempPath, filePath);
  } catch (err) {
    console.error("Failed to save user data:", err);
  }

  return updated;
}
