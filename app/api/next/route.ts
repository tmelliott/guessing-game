import { NextRequest, NextResponse } from 'next/server';
import { readGameData, writeGameData, getGameMeta } from '@/lib/game-utils';

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

    if (!data.gameState?.started) {
      return NextResponse.json({ error: 'Game not started' }, { status: 400 });
    }

    data.gameState.currentIndex += 1;
    await writeGameData(code, data);

    const finished = data.gameState.currentIndex >= data.gameState.shuffledOrder.length;

    return NextResponse.json({ success: true, finished });
  } catch (error) {
    console.error('Next photo error:', error);
    return NextResponse.json({ error: 'Failed to move to next photo' }, { status: 500 });
  }
}
