import { NextRequest, NextResponse } from "next/server";
import { del } from "@vercel/blob";
import { writeGameData, getGameMeta, readGameData } from "@/lib/game-utils";

export async function POST(request: NextRequest) {
  try {
    const { code } = await request.json();

    if (!code) {
      return NextResponse.json(
        { error: "Game code is required" },
        { status: 400 }
      );
    }

    const gameMeta = await getGameMeta(code);
    if (!gameMeta) {
      return NextResponse.json({ error: "Invalid game code" }, { status: 404 });
    }

    // Delete all uploaded photos from Vercel Blob Storage
    try {
      const data = await readGameData(code);
      // Delete all blob URLs for this game
      for (const photo of data.photos) {
        try {
          await del(photo.url);
        } catch (error) {
          console.error(`Error deleting blob ${photo.url}:`, error);
        }
      }
    } catch (error) {
      console.error("Error deleting blobs:", error);
    }

    // Reset game data
    const resetData = {
      photos: [],
      gameState: {
        started: false,
        currentIndex: 0,
        shuffledOrder: [],
      },
    };

    await writeGameData(code, resetData);

    return NextResponse.json({
      success: true,
      message: "All photos and game data cleared",
    });
  } catch (error) {
    console.error("Reset error:", error);
    return NextResponse.json({ error: "Failed to reset" }, { status: 500 });
  }
}
