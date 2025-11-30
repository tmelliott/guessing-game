const { createServer } = require('http');
const { parse } = require('url');
const next = require('next');
const { Server } = require('socket.io');

const dev = process.env.NODE_ENV !== 'production';
const hostname = 'localhost';
const port = parseInt(process.env.PORT || '3000', 10);

const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();

// Import game state functions
const gameState = require('./lib/game-state-server.js');

app.prepare().then(() => {
  const httpServer = createServer(async (req, res) => {
    try {
      const parsedUrl = parse(req.url, true);
      await handle(req, res, parsedUrl);
    } catch (err) {
      console.error('Error occurred handling', req.url, err);
      res.statusCode = 500;
      res.end('internal server error');
    }
  });

  const io = new Server(httpServer, {
    cors: {
      origin: '*',
      methods: ['GET', 'POST'],
    },
  });

  io.on('connection', (socket) => {
    console.log('Client connected:', socket.id);

    // Host creates/joins game
    socket.on('host:join', (data) => {
      const { code, token } = data;
      const trimmedToken = token?.trim();
      const trimmedCode = code?.toUpperCase()?.trim();

      console.log('[Host Join] Attempt:', { code: trimmedCode, tokenLength: trimmedToken?.length });

      const game = gameState.getGame(trimmedCode);

      if (!game) {
        console.log('[Host Join] Game not found for code:', trimmedCode);
        const availableGames = gameState.listGameCodes ? gameState.listGameCodes() : 'unknown';
        console.log('[Host Join] Available games:', availableGames);
        socket.emit('error', { message: 'Invalid game code. Game may not exist or server was restarted.' });
        return;
      }

      console.log('[Host Join] Game found:', {
        code: game.code,
        topic: game.topic,
        expectedTokenPrefix: game.hostToken?.substring(0, 10),
        providedTokenPrefix: trimmedToken?.substring(0, 10),
        tokensMatch: game.hostToken === trimmedToken
      });

      if (game.hostToken !== trimmedToken) {
        console.log('[Host Join] Token mismatch!');
        socket.emit('error', { message: 'Invalid host token. Please check your URL or create a new game.' });
        return;
      }

      game.hostSocketId = socket.id;
      socket.join(`game:${code}`);
      socket.join(`host:${code}`);

      socket.emit('host:joined', {
        code,
        topic: game.topic,
        playerCount: game.players.size,
        photoCount: game.photos.length,
      });

      // Broadcast player count update
      io.to(`game:${code}`).emit('game:update', {
        playerCount: game.players.size,
        photoCount: game.photos.length,
      });
    });

    // Player joins game
    socket.on('player:join', (data) => {
      const { code, token, name } = data;
      const game = gameState.getGame(code);

      if (!game) {
        socket.emit('error', { message: 'Invalid game code' });
        return;
      }

      try {
        const { playerId, token: playerToken } = gameState.addPlayer(code, name, token);
        socket.join(`game:${code}`);
        socket.data = { code, playerToken, playerId };

        socket.emit('player:joined', {
          code,
          token: playerToken,
          name,
          topic: game.topic,
        });

        // Notify host
        io.to(`host:${code}`).emit('player:connected', {
          playerCount: game.players.size,
          photoCount: game.photos.length,
        });

        // Broadcast to all players
        io.to(`game:${code}`).emit('game:update', {
          playerCount: game.players.size,
          photoCount: game.photos.length,
        });
      } catch (error) {
        socket.emit('error', { message: error.message });
      }
    });

    // Player uploads photo
    socket.on('player:upload-photo', (data) => {
      const { code, token, url, name } = data;

      try {
        gameState.addPhoto(code, token, url, name);
        const game = gameState.getGame(code);

        // Notify host
        io.to(`host:${code}`).emit('photo:uploaded', {
          photoCount: game.photos.length,
        });

        // Broadcast to all
        io.to(`game:${code}`).emit('game:update', {
          playerCount: game.players.size,
          photoCount: game.photos.length,
        });
      } catch (error) {
        socket.emit('error', { message: error.message });
      }
    });

    // Host starts a question
    socket.on('host:start-question', (data) => {
      const { code, photoIndex } = data;
      const game = gameState.getGame(code);

      if (!game || game.hostSocketId !== socket.id) {
        socket.emit('error', { message: 'Unauthorized' });
        return;
      }

      try {
        gameState.startQuestion(code, photoIndex);
        const updatedGame = gameState.getGame(code);
        const question = updatedGame.currentQuestion;

        // Send question to all players
        io.to(`game:${code}`).emit('question:started', {
          photoUrl: question.photo.url,
          photoIndex: question.photoIndex,
          totalPhotos: updatedGame.photos.length,
        });

        // Notify host
        socket.emit('question:started', {
          photoUrl: question.photo.url,
          photoIndex: question.photoIndex,
          totalPhotos: updatedGame.photos.length,
        });
      } catch (error) {
        socket.emit('error', { message: error.message });
      }
    });

    // Player submits answer
    socket.on('player:submit-answer', (data) => {
      const { code, token, answer } = data;

      try {
        gameState.submitAnswer(code, token, answer);
        const game = gameState.getGame(code);
        const status = gameState.getAnswerStatus(code);

        // Notify host of answer status
        io.to(`host:${code}`).emit('answer:status', status);

        // Confirm to player
        socket.emit('answer:submitted', { success: true });
      } catch (error) {
        socket.emit('error', { message: error.message });
      }
    });

    // Host reveals answer
    socket.on('host:reveal', (data) => {
      const { code } = data;
      const game = gameState.getGame(code);

      if (!game || game.hostSocketId !== socket.id) {
        socket.emit('error', { message: 'Unauthorized' });
        return;
      }

      if (!game.currentQuestion) {
        socket.emit('error', { message: 'No active question' });
        return;
      }

      gameState.revealAnswer(code);
      const updatedGame = gameState.getGame(code);

      // Broadcast reveal to all
      io.to(`game:${code}`).emit('answer:revealed', {
        correctAnswer: updatedGame.currentQuestion.photo.name,
        answers: Array.from(updatedGame.currentQuestion.answers.entries()).map(([playerId, answer]) => {
          const player = Array.from(updatedGame.players.values()).find(p => p.id === playerId);
          return { name: player?.name || 'Unknown', answer };
        }),
      });
    });

    // Host requests answer status
    socket.on('host:get-status', (data) => {
      const { code } = data;
      const game = gameState.getGame(code);

      if (!game || game.hostSocketId !== socket.id) {
        socket.emit('error', { message: 'Unauthorized' });
        return;
      }

      const status = gameState.getAnswerStatus(code);
      socket.emit('answer:status', status);
    });

    socket.on('disconnect', () => {
      console.log('Client disconnected:', socket.id);
    });
  });

  httpServer
    .once('error', (err) => {
      console.error(err);
      process.exit(1);
    })
    .listen(port, () => {
      console.log(`> Ready on http://${hostname}:${port}`);
    });
});
