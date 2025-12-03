const express = require("express");
const WebSocket = require("ws");
const http = require("http");
const path = require("path");
const os = require("os");

// Hot reload support (development only)
let fileWatcher = null;
if (process.env.NODE_ENV !== "production") {
  try {
    const chokidar = require("chokidar");
    fileWatcher = chokidar.watch("public/**/*", {
      ignored: /node_modules/,
      persistent: true,
    });
  } catch (e) {
    console.log("Hot reload not available (chokidar not installed)");
  }
}

const app = express();
const server = http.createServer(app);

// Serve static files
app.use(express.static("public"));

// Store active games: gameCode -> {
//   host: ws,
//   guests: Map<ws, guestId>,  // Active connections: WebSocket -> guestId
//   allGuests: Map<guestId, {name, id, token, connected, hasAnswered}>  // All guests by ID
// }
const games = new Map();

// Store guest tokens: token -> { gameCode, guestId }
const guestTokens = new Map();

// Store host tokens: token -> { gameCode }
const hostTokens = new Map();

// TEMPORARY: API endpoint to list all active games (for debugging)
// Defined after games Map is initialized
app.get("/api/games", (req, res) => {
  console.log("API /api/games endpoint called"); // Debug log
  try {
    const gamesList = Array.from(games.entries()).map(([code, game]) => {
      const connectedGuests = Array.from(game.guests.values()).length;
      const totalGuests = game.allGuests.size;
      const guestsList = Array.from(game.allGuests.values()).map((g) => ({
        name: g.name,
        id: g.id,
        connected: g.connected,
        hasAnswered: g.hasAnswered,
      }));

      return {
        gameCode: code,
        hasHost: game.host && game.host.readyState === WebSocket.OPEN,
        connectedGuests: connectedGuests,
        totalGuests: totalGuests,
        guests: guestsList,
        hasCurrentQuestion: game.currentQuestion !== null,
        guessingStarted: game.guessingStarted,
        responseCount: game.responses.length,
      };
    });

    res.setHeader("Content-Type", "application/json");
    res.json({
      totalGames: gamesList.length,
      games: gamesList,
    });
  } catch (error) {
    console.error("Error in /api/games:", error);
    res.status(500).json({
      error: "Internal server error",
      message: error.message,
    });
  }
});

// Generate a random 5-digit code
function generateGameCode() {
  let code;
  do {
    code = Math.floor(10000 + Math.random() * 90000).toString();
  } while (games.has(code));
  return code;
}

// Generate a unique token for guests
function generateGuestToken() {
  return `token-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

// Generate a unique token for hosts
function generateHostToken() {
  return `host-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

// WebSocket server
const wss = new WebSocket.Server({ server });

// Store all connected clients for hot reload
const allClients = new Set();

wss.on("connection", (ws) => {
  // Add to all clients for hot reload
  allClients.add(ws);

  let gameCode = null;
  let isHost = false;
  let guestId = null;

  ws.on("message", (message) => {
    try {
      const data = JSON.parse(message.toString());

      if (data.type === "host-create") {
        // Check if reconnecting with a token
        let hostToken = data.token;
        let isReconnect = false;
        let existingGameCode = null;

        if (hostToken && hostTokens.has(hostToken)) {
          const tokenData = hostTokens.get(hostToken);
          existingGameCode = tokenData.gameCode;
          const existingGame = games.get(existingGameCode);

          if (existingGame) {
            // Reconnecting to existing game
            isReconnect = true;
            gameCode = existingGameCode;
            isHost = true;
            // Update host WebSocket
            existingGame.host = ws;

            ws.send(
              JSON.stringify({
                type: "game-created",
                gameCode: gameCode,
                token: hostToken,
                isReconnect: true,
              })
            );

            // Send current game state
            if (existingGame.currentQuestion && !existingGame.guessingStarted) {
              // Game has an active question - host should see responses
              ws.send(
                JSON.stringify({
                  type: "question-sent",
                  questionId: existingGame.currentQuestion.questionId,
                })
              );
            }

            // Send current guest list
            const allGuests = Array.from(existingGame.allGuests.values()).map(
              (g) => ({
                name: g.name,
                id: g.id,
                connected: g.connected,
                hasAnswered: g.hasAnswered,
              })
            );

            allGuests.forEach((guest) => {
              ws.send(
                JSON.stringify({
                  type: "guest-joined",
                  guest: guest,
                  totalGuests: existingGame.allGuests.size,
                  allGuests: allGuests,
                })
              );
            });

            // Send response status if there are responses
            if (existingGame.responses.length > 0) {
              const connectedCount = Array.from(
                existingGame.allGuests.values()
              ).filter((g) => g.connected).length;
              ws.send(
                JSON.stringify({
                  type: "guest-answered",
                  totalResponses: existingGame.responses.length,
                  totalGuests: existingGame.allGuests.size,
                  connectedGuests: connectedCount,
                  allAnswered: existingGame.responses.length === connectedCount,
                  allGuests: allGuests,
                })
              );
            }

            return;
          }
        }

        // Creating a new game
        gameCode = generateGameCode();
        isHost = true;

        // Generate new token if not reconnecting
        if (!hostToken) {
          hostToken = generateHostToken();
        }

        games.set(gameCode, {
          host: ws,
          hostToken: hostToken,
          guests: new Map(), // WebSocket -> guestId
          allGuests: new Map(), // guestId -> {name, id, token, connected, hasAnswered}
          questions: [],
          currentQuestion: null,
          responses: [],
          shuffledResponses: [],
          currentResponseIndex: -1,
          guessingStarted: false,
        });

        // Store host token mapping
        hostTokens.set(hostToken, {
          gameCode: gameCode,
        });

        ws.send(
          JSON.stringify({
            type: "game-created",
            gameCode: gameCode,
            token: hostToken,
            isReconnect: false,
          })
        );
      } else if (data.type === "guest-join") {
        // Guest trying to join a game
        gameCode = data.gameCode;
        const game = games.get(gameCode);

        if (!game) {
          ws.send(
            JSON.stringify({
              type: "join-error",
              message: "Game not found",
            })
          );
          return;
        }

        if (game.host === ws) {
          ws.send(
            JSON.stringify({
              type: "join-error",
              message: "Host cannot join as guest",
            })
          );
          return;
        }

        // Check if reconnecting with a token
        let guestToken = data.token;
        let existingGuest = null;
        let isReconnect = false;

        if (guestToken && guestTokens.has(guestToken)) {
          const tokenData = guestTokens.get(guestToken);
          if (tokenData.gameCode === gameCode) {
            guestId = tokenData.guestId;
            // Find existing guest data (might be disconnected)
            if (game.allGuests.has(guestId)) {
              existingGuest = game.allGuests.get(guestId);
              // Remove old WebSocket connection if exists
              for (const [
                existingWs,
                existingGuestId,
              ] of game.guests.entries()) {
                if (existingGuestId === guestId) {
                  game.guests.delete(existingWs);
                  break;
                }
              }
              isReconnect = true;
            }
          }
        }

        // Generate new token if not reconnecting
        if (!guestToken) {
          guestToken = generateGuestToken();
        }

        // Create or restore guest data
        if (existingGuest) {
          guestId = existingGuest.id;
          // Update guest data
          existingGuest.connected = true;
          existingGuest.token = guestToken;
          game.allGuests.set(guestId, existingGuest);
        } else {
          guestId = data.guestId || `guest-${Date.now()}-${Math.random()}`;
          game.allGuests.set(guestId, {
            name: data.name || "Guest",
            id: guestId,
            token: guestToken,
            hasAnswered: false,
            connected: true,
          });
        }

        // Map WebSocket to guestId
        game.guests.set(ws, guestId);

        // Store token mapping
        guestTokens.set(guestToken, {
          gameCode: gameCode,
          guestId: guestId,
        });

        ws.send(
          JSON.stringify({
            type: "joined",
            gameCode: gameCode,
            guestId: guestId,
            token: guestToken,
            isReconnect: isReconnect,
          })
        );

        // Send current question if one exists and guessing hasn't started
        if (game.currentQuestion && !game.guessingStarted) {
          ws.send(
            JSON.stringify({
              type: "question",
              question: game.currentQuestion.question,
              responseType: game.currentQuestion.responseType || "text",
              questionId: game.currentQuestion.questionId,
            })
          );
        }

        // Notify host
        if (game.host && game.host.readyState === WebSocket.OPEN) {
          const guest = game.allGuests.get(guestId);
          game.host.send(
            JSON.stringify({
              type: isReconnect ? "guest-reconnected" : "guest-joined",
              guest: {
                name: guest.name,
                id: guestId,
                connected: true,
              },
              totalGuests: game.allGuests.size,
              allGuests: Array.from(game.allGuests.values()).map((g) => ({
                name: g.name,
                id: g.id,
                connected: g.connected,
                hasAnswered: g.hasAnswered,
              })),
            })
          );
        }
      } else if (data.type === "guest-name") {
        // Guest providing their name
        const game = games.get(gameCode);
        if (game && game.guests.has(ws)) {
          const guestId = game.guests.get(ws);
          const guest = game.allGuests.get(guestId);
          if (guest) {
            guest.name = data.name;

            ws.send(
              JSON.stringify({
                type: "name-accepted",
                name: data.name,
              })
            );

            // Notify host
            if (game.host && game.host.readyState === WebSocket.OPEN) {
              game.host.send(
                JSON.stringify({
                  type: "guest-name-updated",
                  guest: {
                    name: data.name,
                    id: guestId,
                  },
                  allGuests: Array.from(game.allGuests.values()).map((g) => ({
                    name: g.name,
                    id: g.id,
                    connected: g.connected,
                    hasAnswered: g.hasAnswered,
                  })),
                })
              );
            }
          }
        }
      } else if (data.type === "host-question") {
        // Host sending a question
        const game = games.get(gameCode);
        if (game && isHost && game.host === ws) {
          game.currentQuestion = {
            question: data.question,
            responseType: data.responseType || "text",
            questionId: data.questionId || Date.now().toString(),
          };

          // Reset all guest answer states
          game.allGuests.forEach((guest) => {
            guest.hasAnswered = false;
          });

          game.responses = [];

          // Broadcast question to all connected guests
          game.guests.forEach((guestId, guestWs) => {
            if (guestWs.readyState === WebSocket.OPEN) {
              guestWs.send(
                JSON.stringify({
                  type: "question",
                  question: data.question,
                  responseType: data.responseType || "text",
                  questionId: game.currentQuestion.questionId,
                })
              );
            }
          });

          ws.send(
            JSON.stringify({
              type: "question-sent",
              questionId: game.currentQuestion.questionId,
            })
          );
        }
      } else if (data.type === "guest-answer") {
        // Guest submitting an answer
        const game = games.get(gameCode);
        if (game && game.guests.has(ws)) {
          const guestId = game.guests.get(ws);
          const guest = game.allGuests.get(guestId);
          if (!guest) return;

          // Check if guessing has started - prevent new answers
          if (game.guessingStarted) {
            ws.send(
              JSON.stringify({
                type: "answer-error",
                message:
                  "Guessing has already started. No new answers can be submitted.",
              })
            );
            return;
          }

          if (guest.hasAnswered) {
            ws.send(
              JSON.stringify({
                type: "answer-error",
                message: "You have already answered this question",
              })
            );
            return;
          }

          guest.hasAnswered = true;

          const response = {
            guestId: guest.id,
            guestName: guest.name,
            answer: data.answer,
            answerType: data.answerType || "text",
            questionId: data.questionId,
          };

          game.responses.push(response);

          ws.send(
            JSON.stringify({
              type: "answer-received",
              questionId: data.questionId,
            })
          );

          // Count connected guests for "all answered" check
          const connectedGuestsCount = Array.from(
            game.allGuests.values()
          ).filter((g) => g.connected).length;

          // Notify host
          if (game.host && game.host.readyState === WebSocket.OPEN) {
            game.host.send(
              JSON.stringify({
                type: "guest-answered",
                guest: {
                  name: guest.name,
                  id: guest.id,
                },
                totalResponses: game.responses.length,
                totalGuests: game.allGuests.size,
                connectedGuests: connectedGuestsCount,
                allAnswered: game.responses.length === connectedGuestsCount,
                allGuests: Array.from(game.allGuests.values()).map((g) => ({
                  name: g.name,
                  id: g.id,
                  connected: g.connected,
                  hasAnswered: g.hasAnswered,
                })),
              })
            );
          }
        }
      } else if (data.type === "host-start-guessing") {
        // Host starting the guessing phase
        const game = games.get(gameCode);
        if (game && isHost && game.host === ws) {
          // Mark guessing as started
          game.guessingStarted = true;

          // Shuffle responses
          game.shuffledResponses = [...game.responses].sort(
            () => Math.random() - 0.5
          );
          game.currentResponseIndex = 0;

          // Notify all connected guests that guessing has started (stop accepting answers)
          game.guests.forEach((guestId, guestWs) => {
            if (guestWs.readyState === WebSocket.OPEN) {
              guestWs.send(
                JSON.stringify({
                  type: "guessing-started",
                })
              );
            }
          });

          // Show first response
          if (game.shuffledResponses.length > 0) {
            const firstResponse = { ...game.shuffledResponses[0] };
            delete firstResponse.guestName; // Hide the name initially

            ws.send(
              JSON.stringify({
                type: "response-display",
                response: firstResponse,
                question: game.currentQuestion
                  ? game.currentQuestion.question
                  : null,
                index: 0,
                total: game.shuffledResponses.length,
              })
            );
          }
        }
      } else if (data.type === "host-next-response") {
        // Host moving to next response
        const game = games.get(gameCode);
        if (game && isHost && game.host === ws) {
          game.currentResponseIndex++;

          if (game.currentResponseIndex < game.shuffledResponses.length) {
            const response = {
              ...game.shuffledResponses[game.currentResponseIndex],
            };
            delete response.guestName; // Hide the name initially

            ws.send(
              JSON.stringify({
                type: "response-display",
                response: response,
                question: game.currentQuestion
                  ? game.currentQuestion.question
                  : null,
                index: game.currentResponseIndex,
                total: game.shuffledResponses.length,
              })
            );
          } else {
            ws.send(
              JSON.stringify({
                type: "all-responses-shown",
              })
            );
          }
        }
      } else if (data.type === "host-reveal-answer") {
        // Host revealing who submitted the current response
        const game = games.get(gameCode);
        if (game && isHost && game.host === ws) {
          const currentIndex = game.currentResponseIndex;
          if (
            currentIndex >= 0 &&
            currentIndex < game.shuffledResponses.length
          ) {
            const response = game.shuffledResponses[currentIndex];

            ws.send(
              JSON.stringify({
                type: "answer-revealed",
                response: response,
                guestName: response.guestName,
              })
            );
          }
        }
      } else if (data.type === "host-new-question") {
        // Host ready for a new question
        const game = games.get(gameCode);
        if (game && isHost && game.host === ws) {
          game.currentQuestion = null;
          game.responses = [];
          game.shuffledResponses = [];
          game.currentResponseIndex = -1;
          game.guessingStarted = false;

          // Notify all connected guests to show waiting screen
          game.guests.forEach((guestId, guestWs) => {
            if (guestWs.readyState === WebSocket.OPEN) {
              guestWs.send(
                JSON.stringify({
                  type: "waiting-for-question",
                })
              );
            }
          });

          ws.send(
            JSON.stringify({
              type: "ready-for-question",
            })
          );
        }
      }
    } catch (error) {
      console.error("Error handling message:", error);
      ws.send(
        JSON.stringify({
          type: "error",
          message: "Invalid message format",
        })
      );
    }
  });

  ws.on("close", () => {
    // Remove from hot reload clients
    allClients.delete(ws);

    if (isHost && gameCode) {
      // Host disconnected - mark as disconnected but keep game (host can reconnect)
      const game = games.get(gameCode);
      if (game) {
        // Don't delete the game, just mark host as disconnected
        // The game will persist until host reconnects or manually deletes it
        game.host = null;
      }
    } else if (gameCode) {
      // Guest disconnected - mark as disconnected but keep in game
      const game = games.get(gameCode);
      if (game && game.guests.has(ws)) {
        const guestId = game.guests.get(ws);
        game.guests.delete(ws);

        // Mark guest as disconnected in allGuests
        const guest = game.allGuests.get(guestId);
        if (guest) {
          guest.connected = false;

          // Notify host
          if (game.host && game.host.readyState === WebSocket.OPEN) {
            game.host.send(
              JSON.stringify({
                type: "guest-disconnected",
                guest: {
                  name: guest.name,
                  id: guestId,
                  connected: false,
                },
                totalGuests: game.allGuests.size,
                allGuests: Array.from(game.allGuests.values()).map((g) => ({
                  name: g.name,
                  id: g.id,
                  connected: g.connected,
                  hasAnswered: g.hasAnswered,
                })),
              })
            );
          }
        }
      }
    }
  });
});

const PORT = process.env.PORT || 3000;

// Get local network IP address
function getLocalIPAddress() {
  const interfaces = os.networkInterfaces();
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name]) {
      // Skip internal and non-IPv4 addresses
      if (iface.family === "IPv4" && !iface.internal) {
        return iface.address;
      }
    }
  }
  return "localhost";
}

// File watcher for hot reload (development only)
if (fileWatcher) {
  fileWatcher.on("change", (filePath) => {
    console.log(`File changed: ${filePath}`);
    // Send reload message to all connected clients
    allClients.forEach((client) => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(
          JSON.stringify({
            type: "reload",
          })
        );
      }
    });
  });
  console.log("Hot reload enabled - watching public/ directory");
}

server.listen(PORT, "0.0.0.0", () => {
  const localIP = getLocalIPAddress();
  console.log(`Server running on http://localhost:${PORT}`);
  console.log(`Access from local network: http://${localIP}:${PORT}`);
});
