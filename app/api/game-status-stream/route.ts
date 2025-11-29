import { NextRequest } from 'next/server';
import { readGameData, getGameMeta } from '@/lib/game-utils';

// Server-Sent Events endpoint for real-time photo count updates
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const code = searchParams.get('code');

  if (!code) {
    return new Response('Game code is required', { status: 400 });
  }

  // Set up SSE headers
  const headers = new Headers({
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
  });

  const stream = new ReadableStream({
    async start(controller) {
      const encoder = new TextEncoder();

      const sendUpdate = async () => {
        try {
          const gameMeta = await getGameMeta(code);
          if (!gameMeta) {
            controller.enqueue(encoder.encode('data: {"error":"Invalid game code"}\n\n'));
            controller.close();
            return;
          }

          const data = await readGameData(code);
          const message = JSON.stringify({
            photoCount: data.photos.length,
            topic: gameMeta.topic,
          });

          controller.enqueue(encoder.encode(`data: ${message}\n\n`));
        } catch (error) {
          console.error('SSE error:', error);
          controller.enqueue(encoder.encode('data: {"error":"Failed to get status"}\n\n'));
        }
      };

      // Send initial update
      await sendUpdate();

      // Poll every 2 seconds
      const interval = setInterval(async () => {
        try {
          await sendUpdate();
        } catch (error) {
          console.error('SSE polling error:', error);
          clearInterval(interval);
          controller.close();
        }
      }, 2000);

      // Clean up on client disconnect
      request.signal.addEventListener('abort', () => {
        clearInterval(interval);
        controller.close();
      });
    },
  });

  return new Response(stream, { headers });
}
