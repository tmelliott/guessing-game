# WebSocket Migration Summary

## Overview
The game has been migrated from a server-side file-based storage system to a WebSocket-based in-memory system where the host manages game state in server memory (not browser memory, but ephemeral server memory).

## Key Changes

### 1. **WebSocket Server Setup**
- Created `server.js` - Custom Next.js server with Socket.io integration
- Added Socket.io for real-time bidirectional communication
- Game state is stored in memory on the server (ephemeral, lost on restart)

### 2. **In-Memory Game State**
- `lib/game-state-server.js` - Server-side JavaScript game state management
- `lib/game-state.ts` - TypeScript definitions and types
- `lib/game-state-api.ts` - TypeScript wrapper for API routes
- No file system storage - all games are stored in a Map in memory
- Games automatically clean up after 24 hours

### 3. **New Architecture**

#### Host Flow:
1. Host creates game at home page → gets code + host token
2. Host connects to `/host/[code]` with token → WebSocket connection established
3. Host sees real-time player count and photo count
4. Host can start questions, see answer status, reveal answers
5. All game management happens through WebSocket events

#### Client/Player Flow:
1. Player visits `/join/[code]` → redirected to `/game/[code]`
2. Player enters name → joins game via WebSocket → gets player token
3. Token is stored in URL for reconnection
4. Player uploads photo with person's name
5. Player waits for questions, answers them, sees reveals
6. All interactions happen through WebSocket events

### 4. **WebSocket Events**

#### Host Events:
- `host:join` - Host connects to game
- `host:start-question` - Start showing a photo
- `host:reveal` - Reveal the correct answer
- `host:get-status` - Check answer status

#### Player Events:
- `player:join` - Player joins game
- `player:upload-photo` - Upload a photo
- `player:submit-answer` - Submit answer to question

#### Broadcast Events:
- `question:started` - New question started (sent to all)
- `answer:status` - Answer status update (sent to host)
- `answer:revealed` - Answer revealed (sent to all)
- `game:update` - Game state update (player count, photo count)

### 5. **Updated Pages**

#### `/app/host/[code]/page.tsx`
- Complete rewrite using WebSockets
- Real-time game management interface
- Shows answer status ("Waiting on X responses")
- "Play game" button appears when all have answered

#### `/app/game/[code]/page.tsx`
- Complete rewrite using WebSockets
- Handles player joining, photo upload, answering questions
- Token-based reconnection support

#### `/app/join/[code]/page.tsx`
- Simplified to just redirect to game page

### 6. **API Routes Updated**
- `/api/create-game` - Now uses in-memory game state
- `/api/upload` - Updated to use in-memory game state
- Old routes still exist but are no longer used by the new system

## Features

### ✅ Implemented
- WebSocket-based real-time communication
- In-memory game state (no file system)
- Token-based player reconnection
- Host manages game state
- "Waiting on X responses" status
- Answer submission and reveal
- Question cycle (start → answer → reveal → next)

### 🔄 Photo Storage
- Still uses Vercel Blob Storage if `GG_READ_WRITE_TOKEN` is set
- Falls back to base64 encoding if not configured (for simplicity, not recommended for production)

## Running the Application

```bash
# Development
bun dev  # Runs custom server with WebSocket support

# Production
bun build
bun start  # Runs custom server with WebSocket support
```

## Important Notes

1. **Server Restart**: Game state is lost when the server restarts (it's in-memory)
2. **Custom Server Required**: The app now requires the custom `server.js` to run
3. **WebSocket Support**: Make sure your deployment platform supports WebSockets (Vercel Serverless Functions have limitations)
4. **Old API Routes**: Many old API routes still exist but are unused - can be cleaned up later

## Migration from Old System

The old file-based system (`lib/game-utils.ts`, old API routes) is no longer used but kept for reference. All game data now lives in memory on the server via WebSocket connections.

