import { NextResponse } from 'next/server';
import { cleanupOldGames } from '@/lib/game-utils';

// This endpoint can be called periodically (e.g., via CRON job) to clean up old games
// Games older than 24 hours will be deleted
export async function POST() {
  try {
    await cleanupOldGames(24); // Clean up games older than 24 hours
    return NextResponse.json({ success: true, message: 'Cleanup completed' });
  } catch (error) {
    console.error('Cleanup error:', error);
    return NextResponse.json({ error: 'Failed to cleanup' }, { status: 500 });
  }
}

// Also allow GET for easier CRON job setup
export async function GET() {
  try {
    await cleanupOldGames(24); // Clean up games older than 24 hours
    return NextResponse.json({ success: true, message: 'Cleanup completed' });
  } catch (error) {
    console.error('Cleanup error:', error);
    return NextResponse.json({ error: 'Failed to cleanup' }, { status: 500 });
  }
}
