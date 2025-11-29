import { NextRequest, NextResponse } from 'next/server';
import { readGameData, getGameMeta } from '@/lib/game-utils';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const code = searchParams.get('code');

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

    const { currentIndex, shuffledOrder } = data.gameState || {};

    if (!shuffledOrder || currentIndex >= shuffledOrder.length) {
      return NextResponse.json({ finished: true });
    }

    const photoIndex = shuffledOrder[currentIndex];
    const photo = data.photos[photoIndex];

    if (!photo) {
      return NextResponse.json({ error: 'Photo not found' }, { status: 404 });
    }

    return NextResponse.json({
      name: photo.name
    });
  } catch (error) {
    console.error('Reveal error:', error);
    return NextResponse.json({ error: 'Failed to reveal name' }, { status: 500 });
  }
}
