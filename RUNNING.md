# How to Run the Application

## Important: Use the Custom Server

This application requires a **custom server** with WebSocket support. Do NOT run `next dev` directly.

## Steps to Run

1. **Stop any running Next.js servers**
   ```bash
   # Find and kill any running Next.js processes
   pkill -f "next dev"
   pkill -f "next-server"
   ```

2. **Start the custom server**
   ```bash
   bun dev
   # or
   npm run dev
   ```

   This will run `node server.js` which includes:
   - Next.js server
   - Socket.io WebSocket server
   - In-memory game state

3. **Open your browser**
   - Navigate to http://localhost:3000
   - The WebSocket connection should work automatically

## What's Different?

- **Old way (won't work)**: `next dev` → No WebSocket support ❌
- **New way (correct)**: `bun dev` → Runs `server.js` with WebSocket support ✅

## Troubleshooting

If you see WebSocket connection errors:
1. Make sure you're running `bun dev` (not `next dev`)
2. Check that port 3000 is not already in use
3. Verify Socket.io is installed: `bun install`
4. Check browser console for connection errors


