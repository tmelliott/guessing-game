// In-memory game state storage (no file system)

export interface Player {
  id: string;
  token: string;
  name: string;
  photoUrl?: string;
  currentAnswer?: string;
}

export interface Photo {
  url: string;
  name: string; // Name of the person in the photo
  uploadedBy: string; // Player ID who uploaded it
}

export interface Question {
  photoIndex: number;
  photo: Photo;
  answers: Map<string, string>; // playerId -> answer
  revealed: boolean;
}

export interface Game {
  code: string;
  topic: string;
  hostToken: string;
  hostSocketId?: string;
  players: Map<string, Player>; // token -> Player
  photos: Photo[];
  currentQuestion: Question | null;
  questions: Question[]; // History of questions
  createdAt: number;
}

// In-memory storage
const games = new Map<string, Game>();

// Generate a random 6-letter code
export function generateGameCode(): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
  let code = "";
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

// Generate a random token
export function generateToken(): string {
  return (
    Math.random().toString(36).substring(2, 15) +
    Math.random().toString(36).substring(2, 15)
  );
}

// Create a new game
export function createGame(topic: string): { code: string; hostToken: string } {
  const code = generateGameCode();
  const hostToken = generateToken();

  const game: Game = {
    code,
    topic: topic.trim(),
    hostToken,
    players: new Map(),
    photos: [],
    currentQuestion: null,
    questions: [],
    createdAt: Date.now(),
  };

  games.set(code, game);

  // Clean up old games (older than 24 hours)
  cleanupOldGames();

  return { code, hostToken };
}

// Get game by code
export function getGame(code: string): Game | null {
  return games.get(code) || null;
}

// Verify host token
export function verifyHostToken(code: string, token: string): boolean {
  const game = games.get(code);
  return game?.hostToken === token;
}

// Add a player to the game
export function addPlayer(
  code: string,
  name: string,
  token?: string
): { playerId: string; token: string } {
  const game = games.get(code);
  if (!game) {
    throw new Error("Game not found");
  }

  // If token provided, check if player already exists
  if (token) {
    const existingPlayer = game.players.get(token);
    if (existingPlayer) {
      return { playerId: existingPlayer.id, token };
    }
  }

  // Create new player
  const playerToken = token || generateToken();
  const playerId = generateToken();

  const player: Player = {
    id: playerId,
    token: playerToken,
    name: name.trim(),
  };

  game.players.set(playerToken, player);

  return { playerId, token: playerToken };
}

// Get player by token
export function getPlayer(code: string, token: string): Player | null {
  const game = games.get(code);
  if (!game) return null;
  return game.players.get(token) || null;
}

// Add photo to game
export function addPhoto(
  code: string,
  playerToken: string,
  url: string,
  name: string
): void {
  const game = games.get(code);
  if (!game) {
    throw new Error("Game not found");
  }

  const player = game.players.get(playerToken);
  if (!player) {
    throw new Error("Player not found");
  }

  player.photoUrl = url;

  game.photos.push({
    url,
    name: name.trim(),
    uploadedBy: player.id,
  });
}

// Start a new question (host shows a photo)
export function startQuestion(code: string, photoIndex: number): void {
  const game = games.get(code);
  if (!game) {
    throw new Error("Game not found");
  }

  if (photoIndex < 0 || photoIndex >= game.photos.length) {
    throw new Error("Invalid photo index");
  }

  const photo = game.photos[photoIndex];

  const question: Question = {
    photoIndex,
    photo,
    answers: new Map(),
    revealed: false,
  };

  game.currentQuestion = question;
  game.questions.push(question);

  // Clear all players' answers
  for (const player of game.players.values()) {
    player.currentAnswer = undefined;
  }
}

// Submit an answer
export function submitAnswer(
  code: string,
  playerToken: string,
  answer: string
): void {
  const game = games.get(code);
  if (!game) {
    throw new Error("Game not found");
  }

  if (!game.currentQuestion) {
    throw new Error("No active question");
  }

  const player = game.players.get(playerToken);
  if (!player) {
    throw new Error("Player not found");
  }

  game.currentQuestion.answers.set(player.id, answer.trim());
  player.currentAnswer = answer.trim();
}

// Reveal the answer (host reveals who's in the photo)
export function revealAnswer(code: string): void {
  const game = games.get(code);
  if (!game) {
    throw new Error("Game not found");
  }

  if (!game.currentQuestion) {
    throw new Error("No active question");
  }

  game.currentQuestion.revealed = true;
}

// Get answer status
export function getAnswerStatus(code: string): {
  total: number;
  answered: number;
  waitingFor: string[];
} {
  const game = games.get(code);
  if (!game || !game.currentQuestion) {
    return { total: 0, answered: 0, waitingFor: [] };
  }

  const total = game.players.size;
  const answered = game.currentQuestion.answers.size;
  const waitingFor: string[] = [];

  for (const player of game.players.values()) {
    if (!game.currentQuestion.answers.has(player.id)) {
      waitingFor.push(player.name);
    }
  }

  return { total, answered, waitingFor };
}

// Clean up old games (older than 24 hours)
function cleanupOldGames(): void {
  const now = Date.now();
  const maxAge = 24 * 60 * 60 * 1000; // 24 hours

  for (const [code, game] of games.entries()) {
    if (now - game.createdAt > maxAge) {
      games.delete(code);
    }
  }
}

// Delete a game
export function deleteGame(code: string): void {
  games.delete(code);
}

