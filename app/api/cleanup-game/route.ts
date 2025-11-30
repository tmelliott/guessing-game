import { NextRequest, NextResponse } from 'next/server';
import { del } from '@vercel/blob';
import { unlink } from 'fs/promises';
import { existsSync } from 'fs';
import { getGameMeta, getGameDataPath, readGameData, readGamesMeta, writeGamesMeta } from '@/lib/game-utils';

export async function POST(request: NextRequest) {
  try {
    const { code } = await request.json();

    if (!code) {
      return NextResponse.json({ error: 'Game code is required' }, { status: 400 });
    }

    const gameMeta = await getGameMeta(code);
    if (!gameMeta) {
      return NextResponse.json({ error: 'Invalid game code' }, { status: 404 });
    }

    const blobToken = process.env.GG_READ_WRITE_TOKEN;

    // Delete all uploaded photos from Vercel Blob Storage
    if (blobToken) {
      try {
        const data = await readGameData(code);
        // Delete all blob URLs for this game
        for (const photo of data.photos) {
          try {
            await del(photo.url, { token: blobToken });
          } catch (error) {
            console.error(`Error deleting blob ${photo.url}:`, error);
          }
        }
      } catch (error) {
        console.error('Error deleting blobs:', error);
      }
    }

    // Delete game data file
    const gameDataFile = getGameDataPath(code);
    try {
      if (existsSync(gameDataFile)) {
        await unlink(gameDataFile);
      }
    } catch (error) {
      console.error(`Error deleting game data file:`, error);
    }

    // Remove from metadata
    const meta = await readGamesMeta();
    delete meta[code];
    await writeGamesMeta(meta);

    return NextResponse.json({
      success: true,
      message: 'Game deleted successfully',
    });
  } catch (error) {
    console.error('Cleanup game error:', error);
    return NextResponse.json({ error: 'Failed to delete game' }, { status: 500 });
  }
}

