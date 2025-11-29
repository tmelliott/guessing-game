// This route is no longer needed with Vercel Blob Storage
// Photos are served directly from blob URLs
// Keeping for backward compatibility but redirecting to blob URL if needed

import { NextRequest, NextResponse } from 'next/server';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ filename: string }> }
) {
  // With Vercel Blob, photos are accessed directly via their blob URLs
  // This endpoint is kept for backward compatibility but should not be used
  return NextResponse.json({
    error: 'This endpoint is deprecated. Photos are now served directly from blob storage URLs.'
  }, { status: 410 });
}
