// In-memory game state storage (no file system) - Server-side JavaScript version

// In-memory storage
const games = new Map();

// Generate a random 6-letter code
function generateGameCode() {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
  let code = "";
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

// Generate a random token
function generateToken() {
  return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
}

// Create a new game
function createGame(topic) {
  const code = generateGameCode();
  const hostToken = generateToken();

  const game = {
    code: code.toUpperCase(),
    topic: topic.trim(),
    hostToken,
    players: new Map(),
    photos: [],
    currentQuestion: null,
    questions: [],
    createdAt: Date.now(),
  };

  const normalizedCode = code.toUpperCase();
  games.set(normalizedCode, game);
  console.log('[Game Created]', { code: normalizedCode, topic: game.topic, tokenPrefix: hostToken.substring(0, 10), totalGames: games.size });

  // Clean up old games (older than 24 hours)
  cleanupOldGames();

  return { code: normalizedCode, hostToken };
}

// Get game by code
function getGame(code) {
  const normalizedCode = code?.toUpperCase()?.trim();
  return games.get(normalizedCode) || null;
}

// List all game codes (for debugging)
function listGameCodes() {
  return Array.from(games.keys());
}

// Verify host token
function verifyHostToken(code, token) {
  const game = games.get(code);
  return game?.hostToken === token;
}

// Add a player to the game
function addPlayer(code, name, token) {
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

  const player = {
    id: playerId,
    token: playerToken,
    name: name.trim(),
  };

  game.players.set(playerToken, player);

  return { playerId, token: playerToken };
}

// Get player by token
function getPlayer(code, token) {
  const game = games.get(code);
  if (!game) return null;
  return game.players.get(token) || null;
}

// Add photo to game
function addPhoto(code, playerToken, url, name) {
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
function startQuestion(code, photoIndex) {
  const game = games.get(code);
  if (!game) {
    throw new Error("Game not found");
  }

  if (photoIndex < 0 || photoIndex >= game.photos.length) {
    throw new Error("Invalid photo index");
  }

  const photo = game.photos[photoIndex];

  const question = {
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
function submitAnswer(code, playerToken, answer) {
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
function revealAnswer(code) {
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
function getAnswerStatus(code) {
  const game = games.get(code);
  if (!game || !game.currentQuestion) {
    return { total: 0, answered: 0, waitingFor: [] };
  }

  const total = game.players.size;
  const answered = game.currentQuestion.answers.size;
  const waitingFor = [];

  for (const player of game.players.values()) {
    if (!game.currentQuestion.answers.has(player.id)) {
      waitingFor.push(player.name);
    }
  }

  return { total, answered, waitingFor };
}

// Clean up old games (older than 24 hours)
function cleanupOldGames() {
  const now = Date.now();
  const maxAge = 24 * 60 * 60 * 1000; // 24 hours

  for (const [code, game] of games.entries()) {
    if (now - game.createdAt > maxAge) {
      games.delete(code);
    }
  }
}

// Delete a game
function deleteGame(code) {
  games.delete(code);
}

module.exports = {
  createGame,
  getGame,
  verifyHostToken,
  addPlayer,
  getPlayer,
  addPhoto,
  startQuestion,
  submitAnswer,
  revealAnswer,
  getAnswerStatus,
  deleteGame,
  listGameCodes, // For debugging
};
