import { NextRequest, NextResponse } from 'next/server';
import { createGame } from '@/lib/game-utils';

export async function POST(request: NextRequest) {
  try {
    const { topic } = await request.json();

    if (!topic || typeof topic !== 'string' || topic.trim().length === 0) {
      return NextResponse.json({ error: 'Topic is required' }, { status: 400 });
    }

    const code = await createGame(topic.trim());

    return NextResponse.json({ success: true, code, topic: topic.trim() });
  } catch (error) {
    console.error('Create game error:', error);
    return NextResponse.json({ error: 'Failed to create game' }, { status: 500 });
  }
}
