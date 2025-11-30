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

    return NextResponse.json({
      photos: data.photos || [],
      topic: gameMeta.topic,
    });
  } catch (error) {
    console.error('Get game photos error:', error);
    return NextResponse.json({ error: 'Failed to get photos' }, { status: 500 });
  }
}

