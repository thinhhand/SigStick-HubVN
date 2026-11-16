import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { getUserData, saveUserData } from "@/lib/userStore";

export async function GET() {
  try {
    const session = await auth();
    const userId = session?.user?.id || session?.user?.email;

    if (!userId) {
      return NextResponse.json(
        { status: "unauthenticated", favorites: [], savedPacks: [] },
        { status: 401 }
      );
    }

    const data = await getUserData(userId);
    return NextResponse.json({
      status: "ok",
      favorites: data.favorites,
      savedPacks: data.savedPacks,
      updatedAt: data.updatedAt,
    });
  } catch (error: any) {
    console.error("API GET /api/user/favorites error:", error);
    return NextResponse.json(
      { status: "error", message: error?.message || "Internal error" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    const userId = session?.user?.id || session?.user?.email;

    if (!userId) {
      return NextResponse.json(
        { error: "Vui lòng đăng nhập để lưu dữ liệu" },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { favorites, savedPacks } = body;

    const updated = await saveUserData(userId, { favorites, savedPacks });
    return NextResponse.json({
      status: "ok",
      favorites: updated.favorites,
      savedPacks: updated.savedPacks,
      updatedAt: updated.updatedAt,
    });
  } catch (error: any) {
    console.error("API POST /api/user/favorites error:", error);
    return NextResponse.json(
      { status: "error", message: error?.message || "Internal error" },
      { status: 500 }
    );
  }
}
