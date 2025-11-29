import { NextRequest, NextResponse } from 'next/server';
import { put } from '@vercel/blob';
import { readGameData, writeGameData, getGameMeta } from '@/lib/game-utils';

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('photo') as File | null;
    const name = formData.get('name') as string | null;
    const code = formData.get('code') as string | null;

    if (!file || !name || !code) {
      return NextResponse.json({ error: 'Photo, name, and game code are required' }, { status: 400 });
    }

    // Verify game exists
    const gameMeta = await getGameMeta(code);
    if (!gameMeta) {
      return NextResponse.json({ error: 'Invalid game code' }, { status: 404 });
    }

    // Upload to Vercel Blob Storage
    const timestamp = Date.now();
    const extension = file.name.split('.').pop() || 'jpg';
    const blobName = `${code}/${timestamp}-${Math.random().toString(36).substring(7)}.${extension}`;

    const blob = await put(blobName, file, {
      access: 'public',
      contentType: file.type,
    });

    // Update game data
    const data = await readGameData(code);
    data.photos.push({ url: blob.url, name: name.trim() });
    await writeGameData(code, data);

    return NextResponse.json({ success: true, url: blob.url });
  } catch (error) {
    console.error('Upload error:', error);
    return NextResponse.json({ error: 'Failed to upload photo' }, { status: 500 });
  }
}
