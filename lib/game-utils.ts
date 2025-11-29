import { join } from "path";
import { mkdir, readFile, writeFile, readdir, unlink, stat } from "fs/promises";
import { existsSync } from "fs";
import { tmpdir } from "os";

const GAMES_DIR = join(process.cwd(), "data", "games");
const GAMES_META_FILE = join(process.cwd(), "data", "games.json");

// Ensure directories exist
async function ensureDirectories() {
  if (!existsSync(GAMES_DIR)) {
    await mkdir(GAMES_DIR, { recursive: true });
  }
  if (!existsSync(join(process.cwd(), "data"))) {
    await mkdir(join(process.cwd(), "data"), { recursive: true });
  }
}

// Generate a random 6-letter code
export function generateGameCode(): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
  let code = "";
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

// Read games metadata
async function readGamesMeta(): Promise<
  Record<string, { topic: string; createdAt: number }>
> {
  await ensureDirectories();
  try {
    const data = await readFile(GAMES_META_FILE, "utf-8");
    return JSON.parse(data);
  } catch {
    return {};
  }
}

// Write games metadata
async function writeGamesMeta(
  meta: Record<string, { topic: string; createdAt: number }>
) {
  await ensureDirectories();
  await writeFile(GAMES_META_FILE, JSON.stringify(meta, null, 2), "utf-8");
}

// Create a new game
export async function createGame(topic: string): Promise<string> {
  await ensureDirectories();
  const code = generateGameCode();
  const meta = await readGamesMeta();
  const gameDataFile = join(GAMES_DIR, `${code}.json`);

  // Initialize game data
  const gameData = {
    photos: [],
    gameState: {
      started: false,
      currentIndex: 0,
      shuffledOrder: [],
    },
  };

  await writeFile(gameDataFile, JSON.stringify(gameData, null, 2), "utf-8");

  // Store metadata
  meta[code] = {
    topic,
    createdAt: Date.now(),
  };
  await writeGamesMeta(meta);

  return code;
}

// Get game metadata
export async function getGameMeta(
  code: string
): Promise<{ topic: string; createdAt: number } | null> {
  const meta = await readGamesMeta();
  return meta[code] || null;
}

// Get game data file path
export function getGameDataPath(code: string): string {
  return join(GAMES_DIR, `${code}.json`);
}

// Note: Upload directory no longer needed with Vercel Blob Storage
// Keeping for backward compatibility but it won't be used
export function getUploadDir(code: string): string {
  return join(tmpdir(), `photo-guessing-${code}`);
}

interface PhotoData {
  url: string; // Blob URL for Vercel Blob Storage
  name: string;
}

interface GameState {
  started: boolean;
  currentIndex: number;
  shuffledOrder: number[];
}

interface GameData {
  photos: PhotoData[];
  gameState: GameState;
}

// Read game data
export async function readGameData(code: string): Promise<GameData> {
  const gameDataFile = getGameDataPath(code);
  try {
    const data = await readFile(gameDataFile, "utf-8");
    return JSON.parse(data) as GameData;
  } catch {
    return {
      photos: [],
      gameState: { started: false, currentIndex: 0, shuffledOrder: [] },
    };
  }
}

// Write game data
export async function writeGameData(code: string, data: GameData) {
  const gameDataFile = getGameDataPath(code);
  await ensureDirectories();
  await writeFile(gameDataFile, JSON.stringify(data, null, 2), "utf-8");
}

// Cleanup old games and files (called periodically)
// Note: With Vercel Blob, files are automatically cleaned up based on blob store settings
// This function now only cleans up game metadata and data files
export async function cleanupOldGames(maxAgeHours: number = 24) {
  const meta = await readGamesMeta();
  const now = Date.now();
  const maxAge = maxAgeHours * 60 * 60 * 1000;

  for (const [code, gameMeta] of Object.entries(meta)) {
    if (now - gameMeta.createdAt > maxAge) {
      // Delete game data file
      const gameDataFile = getGameDataPath(code);
      try {
        if (existsSync(gameDataFile)) {
          await unlink(gameDataFile);
        }
      } catch (error) {
        console.error(`Error deleting game data for ${code}:`, error);
      }

      // Note: Blob files are managed by Vercel Blob Storage
      // They can be deleted via the blob API if needed, but typically
      // Vercel handles cleanup automatically

      // Remove from metadata
      delete meta[code];
    }
  }

  await writeGamesMeta(meta);
}

// Cleanup files older than specified age in a game's upload directory
export async function cleanupGameFiles(code: string, maxAgeHours: number = 24) {
  const uploadDir = getUploadDir(code);
  if (!existsSync(uploadDir)) return;

  const maxAge = maxAgeHours * 60 * 60 * 1000;
  const now = Date.now();

  try {
    const files = await readdir(uploadDir);
    for (const file of files) {
      const filepath = join(uploadDir, file);
      try {
        const stats = await stat(filepath);
        if (now - stats.mtime.getTime() > maxAge) {
          await unlink(filepath);
        }
      } catch (error) {
        console.error(`Error checking/deleting file ${file}:`, error);
      }
    }
  } catch (error) {
    console.error(`Error cleaning files for game ${code}:`, error);
  }
}
