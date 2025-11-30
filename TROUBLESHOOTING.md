# Troubleshooting Guide

## "Invalid host token" Error

This error occurs when the WebSocket server can't verify the host's token. Common causes:

### 1. Server Restart
**Problem**: Game state is stored in memory. If the server restarts, all games are lost.

**Solution**: Create a new game after server restart.

**Check**: Look for `[Game Created]` log in console when creating a game.

### 2. Token Mismatch
**Problem**: The token in the URL doesn't match the stored token.

**Check console logs for**:
- `[Game Created]` - Shows the token prefix when game was created
- `[Host Join]` - Shows token comparison details

**Solution**:
- Make sure you're using the exact URL provided when creating the game
- The token is case-sensitive and in the URL query parameter: `?token=...`

### 3. Code Normalization
**Problem**: Game code might not be uppercase consistently.

**Solution**: The code is now normalized to uppercase automatically. Make sure URLs use uppercase codes.

## Debugging Steps

1. **Check if game exists**:
   - Look for `[Game Created]` log when creating a game
   - Look for `[Host Join]` log when trying to join
   - Check "Available games" in the host join log

2. **Check token matching**:
   - Console logs show token prefixes for comparison
   - Make sure the token from URL matches what was created

3. **Verify server is running**:
   - Make sure you're running `bun dev` (custom server)
   - NOT `next dev` (no WebSocket support)

## Common Issues

### Server Restarted
**Symptom**: "Invalid game code" or "Game not found"

**Solution**: This is expected - in-memory state is lost on restart. Create a new game.

### Multiple Server Instances
**Symptom**: Games created but can't be found

**Solution**: Make sure only one server instance is running on port 3000

### Module Loading Issue
**Symptom**: Game created but server can't find it

**Solution**: Restart the server and try again. The modules should share state via require() caching.

## Console Logs to Watch

- `[Game Created]` - When a game is successfully created
- `[API Create Game]` - When API route creates a game
- `[Host Join]` - When host tries to join
- `Client connected` - When WebSocket connection established

