import { NextRequest, NextResponse } from 'next/server';
import { put } from '@vercel/blob';
import { getGame, addPhoto } from '@/lib/game-state-api';

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('photo') as File | null;
    const name = formData.get('name') as string | null;
    const code = formData.get('code') as string | null;
    const token = formData.get('token') as string | null;

    if (!file || !name || !code) {
      return NextResponse.json({ error: 'Photo, name, and game code are required' }, { status: 400 });
    }

    // Verify game exists
    const game = getGame(code);
    if (!game) {
      return NextResponse.json({ error: 'Invalid game code' }, { status: 404 });
    }

    // Verify player token if provided
    if (token && !game.players.has(token)) {
      return NextResponse.json({ error: 'Invalid player token' }, { status: 403 });
    }

    // Upload to Vercel Blob Storage (or convert to base64 for simplicity)
    const timestamp = Date.now();
    const extension = file.name.split('.').pop() || 'jpg';
    const blobName = `${code}/${timestamp}-${Math.random().toString(36).substring(7)}.${extension}`;

    const blobToken = process.env.GG_READ_WRITE_TOKEN;
    let photoUrl: string;

    if (blobToken) {
      // Use Vercel Blob if configured
      const blob = await put(blobName, file, {
        access: 'public',
        contentType: file.type,
        token: blobToken,
      });
      photoUrl = blob.url;
    } else {
      // Fallback to base64 (for simplicity, but not recommended for production)
      const arrayBuffer = await file.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);
      const base64 = buffer.toString('base64');
      photoUrl = `data:${file.type};base64,${base64}`;
    }

    // Add photo to in-memory game state
    const playerToken = token || 'temp'; // If no token, we'll need to create a player first
    addPhoto(code, playerToken, photoUrl, name.trim());

    return NextResponse.json({ success: true, url: photoUrl });
  } catch (error) {
    console.error('Upload error:', error);
    return NextResponse.json({ error: 'Failed to upload photo' }, { status: 500 });
  }
}
