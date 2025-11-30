import { NextRequest, NextResponse } from 'next/server';
import { verifyHostToken } from '@/lib/game-utils';

export async function POST(request: NextRequest) {
  try {
    const { code, token } = await request.json();

    if (!code || !token) {
      return NextResponse.json({ error: 'Code and token are required' }, { status: 400 });
    }

    const isValid = await verifyHostToken(code, token);

    if (!isValid) {
      return NextResponse.json({ error: 'Invalid host token' }, { status: 401 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Verify host error:', error);
    return NextResponse.json({ error: 'Failed to verify host token' }, { status: 500 });
  }
}

