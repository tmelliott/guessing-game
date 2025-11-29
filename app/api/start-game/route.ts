import { NextRequest, NextResponse } from 'next/server';
import { readGameData, writeGameData, getGameMeta } from '@/lib/game-utils';

// Fisher-Yates shuffle algorithm - creates a fresh random shuffle each time
function shuffleArray<T>(array: T[]): T[] {
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

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

    const data = await readGameData(code);

    if (data.photos.length === 0) {
      return NextResponse.json({ error: 'No photos uploaded yet' }, { status: 400 });
    }

    const shuffledIndices = shuffleArray(data.photos.map((_: any, i: number) => i));

    data.gameState = {
      started: true,
      currentIndex: 0,
      shuffledOrder: shuffledIndices
    };

    await writeGameData(code, data);

    return NextResponse.json({ success: true, shuffledOrder: shuffledIndices });
  } catch (error) {
    console.error('Start game error:', error);
    return NextResponse.json({ error: 'Failed to start game' }, { status: 500 });
  }
}
