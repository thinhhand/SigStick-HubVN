import { NextRequest, NextResponse } from "next/server";
import {
  normalizeSyncCode,
  verifyAndGetSyncProfile,
  saveSyncProfile,
} from "@/lib/userStore";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const rawCode = searchParams.get("code") || "";
    const pin = searchParams.get("pin") || "";

    const code = normalizeSyncCode(rawCode);
    if (!code || code.length < 3) {
      return NextResponse.json(
        { status: "error", error: "Mã đồng bộ phải có ít nhất 3 ký tự" },
        { status: 400 }
      );
    }

    const result = await verifyAndGetSyncProfile(code, pin);
    if (!result.ok) {
      return NextResponse.json(
        { status: "error", error: result.error },
        { status: 403 }
      );
    }

    if (!result.data) {
      return NextResponse.json({
        status: "ok",
        exists: false,
        code,
        favorites: [],
        savedPacks: [],
      });
    }

    return NextResponse.json({
      status: "ok",
      exists: true,
      code: result.data.code,
      hasPin: Boolean(result.data.pinHash),
      favorites: result.data.favorites,
      savedPacks: result.data.savedPacks,
      updatedAt: result.data.updatedAt,
    });
  } catch (error: any) {
    console.error("API GET /api/sync error:", error);
    return NextResponse.json(
      { status: "error", error: error?.message || "Internal error" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { code: rawCode, pin, favorites, savedPacks } = body;

    const code = normalizeSyncCode(rawCode || "");
    if (!code || code.length < 3) {
      return NextResponse.json(
        { status: "error", error: "Mã đồng bộ phải có ít nhất 3 ký tự" },
        { status: 400 }
      );
    }

    const result = await saveSyncProfile(code, pin, { favorites, savedPacks });
    if (!result.ok) {
      return NextResponse.json(
        { status: "error", error: result.error },
        { status: 403 }
      );
    }

    return NextResponse.json({
      status: "ok",
      code: result.data.code,
      hasPin: Boolean(result.data.pinHash),
      favorites: result.data.favorites,
      savedPacks: result.data.savedPacks,
      updatedAt: result.data.updatedAt,
    });
  } catch (error: any) {
    console.error("API POST /api/sync error:", error);
    return NextResponse.json(
      { status: "error", error: error?.message || "Internal error" },
      { status: 500 }
    );
  }
}
