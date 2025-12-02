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

// Store active games: gameCode -> { host: ws, guests: Map<ws, {name, id}> }
const games = new Map();

// Generate a random 5-digit code
function generateGameCode() {
  let code;
  do {
    code = Math.floor(10000 + Math.random() * 90000).toString();
  } while (games.has(code));
  return code;
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
        // Host creating a new game
        gameCode = generateGameCode();
        isHost = true;
        games.set(gameCode, {
          host: ws,
          guests: new Map(),
          questions: [],
          currentQuestion: null,
          responses: [],
          shuffledResponses: [],
          currentResponseIndex: -1,
        });

        ws.send(
          JSON.stringify({
            type: "game-created",
            gameCode: gameCode,
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

        guestId = data.guestId || `guest-${Date.now()}-${Math.random()}`;
        game.guests.set(ws, {
          name: data.name || "Guest",
          id: guestId,
          hasAnswered: false,
        });

        ws.send(
          JSON.stringify({
            type: "joined",
            gameCode: gameCode,
            guestId: guestId,
          })
        );

        // Notify host
        if (game.host && game.host.readyState === WebSocket.OPEN) {
          game.host.send(
            JSON.stringify({
              type: "guest-joined",
              guest: {
                name: game.guests.get(ws).name,
                id: guestId,
              },
              totalGuests: game.guests.size,
            })
          );
        }
      } else if (data.type === "guest-name") {
        // Guest providing their name
        const game = games.get(gameCode);
        if (game && game.guests.has(ws)) {
          const guest = game.guests.get(ws);
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
                  id: guest.id,
                },
              })
            );
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
          game.guests.forEach((guest) => {
            guest.hasAnswered = false;
          });

          game.responses = [];

          // Broadcast question to all guests
          game.guests.forEach((guest, guestWs) => {
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
          const guest = game.guests.get(ws);

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
                totalGuests: game.guests.size,
                allAnswered: game.responses.length === game.guests.size,
              })
            );
          }
        }
      } else if (data.type === "host-start-guessing") {
        // Host starting the guessing phase
        const game = games.get(gameCode);
        if (game && isHost && game.host === ws) {
          // Shuffle responses
          game.shuffledResponses = [...game.responses].sort(
            () => Math.random() - 0.5
          );
          game.currentResponseIndex = 0;

          // Show first response
          if (game.shuffledResponses.length > 0) {
            const firstResponse = { ...game.shuffledResponses[0] };
            delete firstResponse.guestName; // Hide the name initially

            ws.send(
              JSON.stringify({
                type: "response-display",
                response: firstResponse,
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
      // Host disconnected - remove game
      games.delete(gameCode);
    } else if (gameCode) {
      // Guest disconnected
      const game = games.get(gameCode);
      if (game && game.guests.has(ws)) {
        const guest = game.guests.get(ws);
        game.guests.delete(ws);

        // Notify host
        if (game.host && game.host.readyState === WebSocket.OPEN) {
          game.host.send(
            JSON.stringify({
              type: "guest-left",
              guest: {
                name: guest.name,
                id: guest.id,
              },
              totalGuests: game.guests.size,
            })
          );
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
