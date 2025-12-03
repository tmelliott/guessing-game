// WebSocket connection
let ws = null;
let currentPage = "landing";
let gameCode = null;
let isHost = false;
let guestId = null;
let guestName = null;
let guestToken = null;
let hostToken = null;
let currentQuestionId = null;
let guestResponseStatus = new Map(); // Track which guests have answered

// Get WebSocket URL (works for both local and public URLs)
function getWebSocketURL() {
  const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
  const host = window.location.host;
  return `${protocol}//${host}`;
}

// Page navigation
function showPage(pageId) {
  document.querySelectorAll(".page").forEach((page) => {
    page.classList.remove("active");
    if (page.classList.contains("fullscreen-view")) {
      page.classList.add("hidden");
    }
  });
  const targetPage = document.getElementById(pageId);
  if (targetPage) {
    targetPage.classList.add("active");
    if (targetPage.classList.contains("fullscreen-view")) {
      targetPage.classList.remove("hidden");
    }
  }
  currentPage = pageId;
}

// Error display
function showError(elementId, message) {
  const errorEl = document.getElementById(elementId);
  if (errorEl) {
    errorEl.textContent = message;
    setTimeout(() => {
      errorEl.textContent = "";
    }, 5000);
  }
}

// Connect WebSocket
function connectWebSocket() {
  const url = getWebSocketURL();
  ws = new WebSocket(url);

  ws.onopen = () => {
    console.log("WebSocket connected");
    updateGuestConnectionStatus(true);
  };

  ws.onmessage = (event) => {
    const data = JSON.parse(event.data);
    handleWebSocketMessage(data);
  };

  ws.onerror = (error) => {
    console.error("WebSocket error:", error);
    updateGuestConnectionStatus(false);
    // If we're on a page other than landing and connection fails, redirect
    if (currentPage !== "landing-page") {
      showError("landing-error", "Connection error. Redirecting to home...");
      setTimeout(() => {
        redirectToLanding();
      }, 2000);
    } else {
      showError("landing-error", "Connection error. Please try again.");
    }
  };

  ws.onclose = () => {
    console.log("WebSocket disconnected");
    updateGuestConnectionStatus(false);
    // Only attempt to reconnect if we have valid tokens and are already in a game
    // Don't reconnect if we're on landing page or if connection failed during initial connection
    if (currentPage !== "landing-page" && !isHost && guestToken && gameCode) {
      setTimeout(() => {
        if (ws.readyState === WebSocket.CLOSED) {
          reconnectAsGuest();
        }
      }, 3000);
    } else if (
      currentPage !== "landing-page" &&
      isHost &&
      hostToken &&
      gameCode
    ) {
      // Host reconnection attempt
      setTimeout(() => {
        if (ws.readyState === WebSocket.CLOSED) {
          createOrReconnectHost();
        }
      }, 3000);
    }
  };
}

// Handle WebSocket messages
function handleWebSocketMessage(data) {
  console.log("Received:", data);

  switch (data.type) {
    case "game-created":
      gameCode = data.gameCode;
      isHost = true;
      hostToken = data.token;
      localStorage.setItem("hostGameCode", gameCode);
      if (hostToken) {
        localStorage.setItem("hostToken", hostToken);
        // Update URL with token
        const url = new URL(window.location);
        url.searchParams.set("hostToken", hostToken);
        url.searchParams.set("gameCode", gameCode);
        window.history.replaceState({}, "", url);
      }
      document.getElementById("host-game-code").textContent = gameCode;
      showPage("host-page");
      break;

    case "join-error":
      // Connection failed - redirect to landing page and clear saved state
      showError("landing-error", data.message);
      // Clear saved game state
      localStorage.removeItem("guestGameCode");
      localStorage.removeItem("guestId");
      localStorage.removeItem("guestToken");
      localStorage.removeItem("hostGameCode");
      localStorage.removeItem("hostToken");
      // Clear URL parameters
      window.history.replaceState({}, "", "/");
      // Reset state
      gameCode = null;
      guestId = null;
      guestToken = null;
      hostToken = null;
      isHost = false;
      // Show landing page
      showPage("landing-page");
      break;

    case "joined":
      gameCode = data.gameCode;
      guestId = data.guestId;
      guestToken = data.token;
      localStorage.setItem("guestGameCode", gameCode);
      localStorage.setItem("guestId", guestId);
      localStorage.setItem("guestToken", guestToken);

      // Update URL with token
      if (guestToken) {
        const url = new URL(window.location);
        url.searchParams.set("token", guestToken);
        url.searchParams.set("gameCode", gameCode);
        window.history.replaceState({}, "", url);
      }

      // Check if we have a saved name (from localStorage or current session)
      const savedName = guestName || localStorage.getItem("guestName");

      // If we have a name, skip the name entry screen and go directly to guest page
      if (savedName) {
        guestName = savedName;
        document.getElementById("guest-name-display").textContent = guestName;
        showPage("guest-page");
        // Send name to server
        ws.send(
          JSON.stringify({
            type: "guest-name",
            name: guestName,
            gameCode: gameCode,
          })
        );
      } else {
        showPage("guest-name-page");
      }
      break;

    case "name-accepted":
      guestName = data.name;
      localStorage.setItem("guestName", guestName);
      document.getElementById("guest-name-display").textContent = guestName;
      showPage("guest-page");
      break;

    case "question":
      currentQuestionId = data.questionId;
      document.getElementById("guest-question-text").textContent =
        data.question;
      const responseType = data.responseType || "text";
      document.getElementById(
        "guest-response-type"
      ).textContent = `Response type: ${
        responseType.charAt(0).toUpperCase() + responseType.slice(1)
      }`;

      // Show appropriate input based on response type
      document
        .querySelectorAll(".answer-input")
        .forEach((el) => el.classList.add("hidden"));
      document
        .getElementById("guest-answer-section")
        .classList.remove("hidden");

      if (responseType === "text") {
        document.getElementById("guest-text-answer").classList.remove("hidden");
        document.getElementById("guest-text-answer").value = "";
      } else if (responseType === "numeric") {
        document
          .getElementById("guest-numeric-answer")
          .classList.remove("hidden");
        document.getElementById("guest-numeric-answer").value = "";
      } else if (responseType === "image") {
        document
          .getElementById("guest-image-answer")
          .classList.remove("hidden");
        document.getElementById("guest-image-file").value = "";
        document.getElementById("guest-image-preview").innerHTML = "";
      }

      // Reset status styling
      const guestStatus = document.getElementById("guest-status");
      guestStatus.style.color = "";
      guestStatus.style.fontSize = "";
      guestStatus.textContent = "Answer the question:";

      document
        .getElementById("guest-question-section")
        .classList.remove("hidden");
      document.getElementById("guest-answer-status").textContent = "";
      // Re-enable the submit button for the new question
      document.getElementById("submit-answer-btn").disabled = false;
      break;

    case "answer-received":
      document.getElementById("guest-answer-status").textContent =
        "Answer submitted! Waiting for others...";
      document.getElementById("guest-answer-status").style.color = "#27ae60";
      document.getElementById("submit-answer-btn").disabled = true;
      break;

    case "answer-error":
      showError("guest-answer-status", data.message);
      break;

    case "guest-joined":
    case "guest-reconnected":
      updateGuestsList(data.guest, data.totalGuests);
      if (data.allGuests) {
        updateAllGuestsList(data.allGuests);
      }
      break;

    case "guest-left":
    case "guest-disconnected":
      updateGuestInList(data.guest);
      updateGuestCount(data.totalGuests);
      if (data.allGuests) {
        updateAllGuestsList(data.allGuests);
      }
      break;

    case "guest-name-updated":
      updateGuestNameInList(data.guest);
      if (data.allGuests) {
        updateAllGuestsList(data.allGuests);
      }
      break;

    case "question-sent":
      document
        .getElementById("host-responses-section")
        .classList.remove("hidden");
      document.getElementById("response-count").textContent = "0";
      document.getElementById("responses-status").textContent =
        "Waiting for responses...";
      document.getElementById("start-guessing-btn").classList.add("hidden");
      // Reset all guest response statuses
      guestResponseStatus.clear();
      updateGuestResponseStatuses();
      break;

    case "guest-answered":
      guestResponseStatus.set(data.guest.id, true);
      updateGuestResponseStatuses();
      updateResponseCount(data.totalResponses, data.totalGuests);
      if (data.allGuests) {
        updateAllGuestsList(data.allGuests);
      }
      // Allow starting even if not all answered (but show status)
      const connectedCount = data.connectedGuests || data.totalGuests;
      if (data.totalResponses > 0) {
        document
          .getElementById("start-guessing-btn")
          .classList.remove("hidden");
        if (data.allAnswered) {
          document.getElementById("responses-status").textContent =
            "All connected guests have answered!";
          document.getElementById("responses-status").style.color = "#27ae60";
        } else {
          document.getElementById(
            "responses-status"
          ).textContent = `${data.totalResponses} of ${connectedCount} connected guests have answered. You can start guessing now.`;
          document.getElementById("responses-status").style.color = "#f39c12";
        }
      }
      break;

    case "waiting-for-question":
      // Host started a new question - show waiting screen
      document.getElementById("guest-status").textContent =
        "Waiting for question...";
      document.getElementById("guest-question-section").classList.add("hidden");
      document.getElementById("guest-answer-section").classList.add("hidden");
      document.getElementById("guest-answer-status").textContent = "";
      // Re-enable submit button for when new question arrives
      document.getElementById("submit-answer-btn").disabled = false;
      currentQuestionId = null;
      break;

    case "guessing-started":
      // Game has started - show "Game has started" screen
      document.getElementById("guest-status").textContent = "Game has started!";
      document.getElementById("guest-status").style.color = "#27ae60";
      document.getElementById("guest-status").style.fontSize = "2em";
      // Hide question and answer sections
      document.getElementById("guest-question-section").classList.add("hidden");
      document.getElementById("guest-answer-section").classList.add("hidden");
      document.getElementById("guest-answer-status").textContent = "";
      // Disable submit button
      document.getElementById("submit-answer-btn").disabled = true;
      break;

    case "response-display":
      showResponse(data.response, data.index, data.total);
      // Show full-screen view (only if host)
      if (isHost) {
        showFullscreenGuessing(
          data.response,
          data.question,
          data.index,
          data.total
        );
      }
      break;

    case "answer-revealed":
      revealAnswer(data.guestName);
      if (isHost) {
        revealFullscreenAnswer(data.guestName);
      }
      break;

    case "all-responses-shown":
      if (isHost) {
        document.getElementById("next-response-btn").classList.add("hidden");
        document.getElementById("new-question-btn").classList.remove("hidden");
        const fullscreenNextBtn = document.getElementById(
          "fullscreen-next-btn"
        );
        const fullscreenNewQuestionBtn = document.getElementById(
          "fullscreen-new-question-btn"
        );
        if (fullscreenNextBtn) fullscreenNextBtn.classList.add("hidden");
        if (fullscreenNewQuestionBtn)
          fullscreenNewQuestionBtn.classList.remove("hidden");
      }
      break;

    case "ready-for-question":
      if (isHost) {
        document.getElementById("guessing-section").classList.add("hidden");
        document
          .getElementById("host-responses-section")
          .classList.add("hidden");
        document.getElementById("fullscreen-guessing").classList.add("hidden");
        showPage("host-page");
      }
      break;

    case "reload":
      // Hot reload: reload the page when files change
      console.log("Reloading page due to file change...");
      window.location.reload();
      break;
  }
}

// Host functions
function updateGuestsList(guest, totalGuests) {
  const list = document.getElementById("guests-list");
  const existingItem = document.getElementById(`guest-${guest.id}`);
  const displayName = guest.name || "Guest";
  const isConnected =
    guest.connected !== false && guest.connected !== undefined;

  if (existingItem) {
    const nameEl = existingItem.querySelector(".guest-name");
    if (nameEl) {
      nameEl.textContent = displayName;
    }
    // Update connection status if element exists
    const connectionStatus = existingItem.querySelector(
      ".guest-connection-status"
    );
    if (connectionStatus) {
      if (isConnected) {
        connectionStatus.textContent = "●";
        connectionStatus.className = "guest-connection-status connected";
        connectionStatus.title = "Connected";
        existingItem.classList.remove("disconnected");
      } else {
        connectionStatus.textContent = "○";
        connectionStatus.className = "guest-connection-status disconnected";
        connectionStatus.title = "Disconnected";
        existingItem.classList.add("disconnected");
      }
    }
  } else {
    const li = document.createElement("li");
    li.id = `guest-${guest.id}`;
    li.className = "guest-item";
    const connectionStatusClass = isConnected ? "connected" : "disconnected";
    const connectionSymbol = isConnected ? "●" : "○";
    if (!isConnected) {
      li.classList.add("disconnected");
    }
    li.innerHTML = `
            <span class="guest-name">${displayName}</span>
            <span class="guest-id">${guest.id}</span>
            <span class="guest-connection-status ${connectionStatusClass}" title="${
      isConnected ? "Connected" : "Disconnected"
    }">${connectionSymbol}</span>
            <span class="guest-status-indicator"></span>
        `;
    list.appendChild(li);
  }

  updateGuestCount(totalGuests);
  updateGuestResponseStatuses();
}

function updateAllGuestsList(allGuests) {
  // Update all guests in the list with their connection status
  allGuests.forEach((guest) => {
    const item = document.getElementById(`guest-${guest.id}`);
    if (item) {
      const connectionStatus = item.querySelector(".guest-connection-status");
      if (connectionStatus) {
        if (guest.connected) {
          connectionStatus.textContent = "●";
          connectionStatus.className = "guest-connection-status connected";
          connectionStatus.title = "Connected";
          item.classList.remove("disconnected");
        } else {
          connectionStatus.textContent = "○";
          connectionStatus.className = "guest-connection-status disconnected";
          connectionStatus.title = "Disconnected";
          item.classList.add("disconnected");
        }
      }
    } else {
      // Guest not in list yet, add them
      updateGuestsList(guest, allGuests.length);
    }
  });
}

function updateGuestInList(guest) {
  const item = document.getElementById(`guest-${guest.id}`);
  if (item) {
    const connectionStatus = item.querySelector(".guest-connection-status");
    if (connectionStatus) {
      if (guest.connected) {
        connectionStatus.textContent = "●";
        connectionStatus.className = "guest-connection-status connected";
        connectionStatus.title = "Connected";
        item.classList.remove("disconnected");
      } else {
        connectionStatus.textContent = "○";
        connectionStatus.className = "guest-connection-status disconnected";
        connectionStatus.title = "Disconnected";
        item.classList.add("disconnected");
      }
    }
  }
}

function removeGuestFromList(guestId) {
  const item = document.getElementById(`guest-${guestId}`);
  if (item) {
    item.remove();
  }
}

function updateGuestNameInList(guest) {
  const item = document.getElementById(`guest-${guest.id}`);
  if (item) {
    const nameEl = item.querySelector(".guest-name");
    if (nameEl) {
      nameEl.textContent = guest.name || "Guest";
    }
  }
}

function updateGuestResponseStatuses() {
  const allGuests = document.querySelectorAll("#guests-list .guest-item");
  allGuests.forEach((guestItem) => {
    const guestId = guestItem.id.replace("guest-", "");
    const statusIndicator = guestItem.querySelector(".guest-status-indicator");
    const hasAnswered = guestResponseStatus.get(guestId);

    if (hasAnswered === true) {
      guestItem.classList.add("answered");
      guestItem.classList.remove("pending");
      if (statusIndicator) {
        statusIndicator.textContent = "✓";
        statusIndicator.className = "guest-status-indicator answered";
      }
    } else if (currentQuestionId) {
      guestItem.classList.add("pending");
      guestItem.classList.remove("answered");
      if (statusIndicator) {
        statusIndicator.textContent = "○";
        statusIndicator.className = "guest-status-indicator pending";
      }
    } else {
      guestItem.classList.remove("answered", "pending");
      if (statusIndicator) {
        statusIndicator.textContent = "";
        statusIndicator.className = "guest-status-indicator";
      }
    }
  });
}

function updateGuestCount(count) {
  document.getElementById("guest-count").textContent = count;
}

function updateResponseCount(current, total) {
  document.getElementById("response-count").textContent = current;
  document.getElementById("total-guests-count").textContent = total;
}

function showResponse(response, index, total) {
  document.getElementById("guessing-section").classList.remove("hidden");
  const display = document.getElementById("current-response-display");
  const responseInfo = document.getElementById("response-info");
  const responseCounter = document.getElementById("response-counter");

  // Show response counter in the controls area
  if (responseCounter) {
    responseCounter.textContent = `Response ${index + 1} of ${total}`;
  }

  // Clear any previous author name and show reveal button in the response-info area
  const existingAuthor = responseInfo.querySelector(".answer-author-simple");
  if (existingAuthor) {
    existingAuthor.remove();
  }
  const revealBtn = document.getElementById("reveal-answer-btn");
  if (revealBtn) {
    revealBtn.classList.remove("hidden");
    revealBtn.textContent = "Reveal Answer";
    // Ensure button is in response-info (it should already be there from HTML)
    if (revealBtn.parentNode !== responseInfo) {
      responseInfo.appendChild(revealBtn);
    }
  }

  if (response.answerType === "image" && response.answer) {
    display.innerHTML = `<img src="${response.answer}" alt="Response image">`;
  } else {
    display.textContent = response.answer;
  }

  document.getElementById("next-response-btn").classList.add("hidden");
  document.getElementById("new-question-btn").classList.add("hidden");
}

function showFullscreenGuessing(response, question, index, total) {
  const fullscreenPage = document.getElementById("fullscreen-guessing");
  if (!fullscreenPage) return;

  fullscreenPage.classList.remove("hidden");
  showPage("fullscreen-guessing");

  const questionEl = document.getElementById("fullscreen-question");
  const counterEl = document.getElementById("fullscreen-response-counter");
  const textDisplay = document.getElementById("fullscreen-response-text");
  const imageDisplay = document.getElementById("fullscreen-response-image");
  const authorEl = document.getElementById("fullscreen-response-author");
  const revealBtn = document.getElementById("fullscreen-reveal-btn");
  const nextBtn = document.getElementById("fullscreen-next-btn");
  const newQuestionBtn = document.getElementById("fullscreen-new-question-btn");
  const backBtn = document.getElementById("fullscreen-back-btn");

  // Display question at top (smaller text)
  if (questionEl && question) {
    questionEl.textContent = question;
    questionEl.style.display = "block";
  } else if (questionEl) {
    questionEl.style.display = "none";
  }

  // Display counter above answer (small text)
  if (counterEl) {
    counterEl.textContent = `Response ${index + 1} of ${total}`;
  }

  // Clear author name initially
  if (authorEl) {
    authorEl.textContent = "";
    authorEl.style.display = "none";
  }

  // Display answer (large, emphasized)
  if (response.answerType === "image" && response.answer) {
    if (textDisplay) {
      textDisplay.textContent = "";
      textDisplay.style.display = "none";
    }
    if (imageDisplay) {
      imageDisplay.style.display = "flex";
      imageDisplay.innerHTML = `<img src="${response.answer}" alt="Response image">`;
    }
  } else {
    if (textDisplay) {
      textDisplay.style.display = "block";
      textDisplay.textContent = response.answer;
    }
    if (imageDisplay) {
      imageDisplay.style.display = "none";
      imageDisplay.innerHTML = "";
    }
  }

  // Button visibility - single row
  // Show reveal button initially (author not yet revealed)
  if (revealBtn) revealBtn.classList.remove("hidden");
  if (nextBtn) nextBtn.classList.add("hidden");
  if (newQuestionBtn) newQuestionBtn.classList.add("hidden");
  if (backBtn) backBtn.classList.remove("hidden");
}

function revealAnswer(guestName) {
  const responseInfo = document.getElementById("response-info");
  const revealBtn = document.getElementById("reveal-answer-btn");

  // Replace the reveal button with the author name
  if (revealBtn && revealBtn.parentNode === responseInfo) {
    revealBtn.remove();
  }
  const authorDiv = document.createElement("div");
  authorDiv.className = "answer-author-simple";
  authorDiv.textContent = guestName;
  responseInfo.appendChild(authorDiv);

  document.getElementById("next-response-btn").classList.remove("hidden");
}

function revealFullscreenAnswer(guestName) {
  const authorEl = document.getElementById("fullscreen-response-author");
  const revealBtn = document.getElementById("fullscreen-reveal-btn");
  const nextBtn = document.getElementById("fullscreen-next-btn");

  // Show author name
  if (authorEl) {
    authorEl.textContent = guestName;
    authorEl.style.display = "block";
  }

  // Hide reveal button, show next button
  if (revealBtn) revealBtn.classList.add("hidden");
  if (nextBtn) nextBtn.classList.remove("hidden");
}

// Event listeners
document.addEventListener("DOMContentLoaded", () => {
  // Landing page
  document.getElementById("host-btn").addEventListener("click", () => {
    createOrReconnectHost();
  });

  document.getElementById("join-btn").addEventListener("click", () => {
    const code = document.getElementById("game-code-input").value.trim();
    if (code.length !== 5 || !/^\d+$/.test(code)) {
      showError("landing-error", "Please enter a valid 5-digit code");
      return;
    }

    joinGame(code);
  });

  document
    .getElementById("game-code-input")
    .addEventListener("keypress", (e) => {
      if (e.key === "Enter") {
        document.getElementById("join-btn").click();
      }
    });

  // Guest name page
  document.getElementById("submit-name-btn").addEventListener("click", () => {
    const name = document.getElementById("guest-name-input").value.trim();
    if (!name) {
      showError("name-error", "Please enter your name");
      return;
    }

    ws.send(
      JSON.stringify({
        type: "guest-name",
        name: name,
        gameCode: gameCode,
      })
    );
  });

  document
    .getElementById("guest-name-input")
    .addEventListener("keypress", (e) => {
      if (e.key === "Enter") {
        document.getElementById("submit-name-btn").click();
      }
    });

  // Guest answer page
  document.getElementById("submit-answer-btn").addEventListener("click", () => {
    const responseType = document
      .getElementById("guest-text-answer")
      .classList.contains("hidden")
      ? document
          .getElementById("guest-numeric-answer")
          .classList.contains("hidden")
        ? "image"
        : "numeric"
      : "text";

    let answer = "";

    if (responseType === "text") {
      answer = document.getElementById("guest-text-answer").value.trim();
    } else if (responseType === "numeric") {
      answer = document.getElementById("guest-numeric-answer").value.trim();
    } else if (responseType === "image") {
      const fileInput = document.getElementById("guest-image-file");
      const file = fileInput.files[0];
      if (!file) {
        showError("guest-answer-status", "Please select an image");
        return;
      }

      const reader = new FileReader();
      reader.onload = (e) => {
        answer = e.target.result;
        submitAnswer(answer, responseType);
      };
      reader.readAsDataURL(file);
      return;
    }

    if (!answer) {
      showError("guest-answer-status", "Please provide an answer");
      return;
    }

    submitAnswer(answer, responseType);
  });

  // Image preview
  document
    .getElementById("guest-image-file")
    .addEventListener("change", (e) => {
      const file = e.target.files[0];
      if (file) {
        const reader = new FileReader();
        reader.onload = (e) => {
          const preview = document.getElementById("guest-image-preview");
          preview.innerHTML = `<img src="${e.target.result}" alt="Preview">`;
        };
        reader.readAsDataURL(file);
      }
    });

  // Host page
  document.getElementById("send-question-btn").addEventListener("click", () => {
    const question = document
      .getElementById("host-question-input")
      .value.trim();
    if (!question) {
      alert("Please enter a question");
      return;
    }

    const responseType = document.querySelector(
      'input[name="response-type"]:checked'
    ).value;

    ws.send(
      JSON.stringify({
        type: "host-question",
        question: question,
        responseType: responseType,
        questionId: Date.now().toString(),
      })
    );

    document.getElementById("host-question-input").value = "";
  });

  document
    .getElementById("start-guessing-btn")
    .addEventListener("click", () => {
      ws.send(JSON.stringify({ type: "host-start-guessing" }));
    });

  document.getElementById("reveal-answer-btn").addEventListener("click", () => {
    ws.send(JSON.stringify({ type: "host-reveal-answer" }));
  });

  document.getElementById("next-response-btn").addEventListener("click", () => {
    ws.send(JSON.stringify({ type: "host-next-response" }));
  });

  document.getElementById("new-question-btn").addEventListener("click", () => {
    ws.send(JSON.stringify({ type: "host-new-question" }));
  });

  document
    .getElementById("new-question-from-responses-btn")
    .addEventListener("click", () => {
      ws.send(JSON.stringify({ type: "host-new-question" }));
    });

  // Fullscreen guessing controls
  document
    .getElementById("fullscreen-reveal-btn")
    .addEventListener("click", () => {
      ws.send(JSON.stringify({ type: "host-reveal-answer" }));
    });

  document
    .getElementById("fullscreen-next-btn")
    .addEventListener("click", () => {
      ws.send(JSON.stringify({ type: "host-next-response" }));
    });

  document
    .getElementById("fullscreen-new-question-btn")
    .addEventListener("click", () => {
      ws.send(JSON.stringify({ type: "host-new-question" }));
    });

  document
    .getElementById("fullscreen-back-btn")
    .addEventListener("click", () => {
      document.getElementById("fullscreen-guessing").classList.add("hidden");
      showPage("host-page");
    });

  // Initialize WebSocket connection
  connectWebSocket();

  // Check for token in URL or localStorage for auto-reconnect
  const urlParams = new URLSearchParams(window.location.search);
  const urlToken = urlParams.get("token");
  const urlHostToken = urlParams.get("hostToken");
  const urlGameCode = urlParams.get("gameCode");

  // Check if this is a host reconnection
  if (urlHostToken && urlGameCode) {
    // Host token in URL, restore from URL
    localStorage.setItem("hostToken", urlHostToken);
    localStorage.setItem("hostGameCode", urlGameCode);
    hostToken = urlHostToken;
    gameCode = urlGameCode;
    isHost = true;

    // Auto-reconnect as host if WebSocket is ready
    setTimeout(() => {
      if (ws && ws.readyState === WebSocket.OPEN) {
        createOrReconnectHost();
      }
    }, 500);
  } else if (urlToken && urlGameCode) {
    // Guest token in URL, restore from URL
    localStorage.setItem("guestToken", urlToken);
    localStorage.setItem("guestGameCode", urlGameCode);
    guestToken = urlToken;
    gameCode = urlGameCode;

    // Auto-join if WebSocket is ready
    setTimeout(() => {
      if (ws && ws.readyState === WebSocket.OPEN) {
        joinGame(urlGameCode);
      }
    }, 500);
  } else {
    // Check localStorage for saved state
    const savedHostToken = localStorage.getItem("hostToken");
    const savedHostGameCode = localStorage.getItem("hostGameCode");
    const savedToken = localStorage.getItem("guestToken");
    const savedGameCode = localStorage.getItem("guestGameCode");

    if (savedHostToken && savedHostGameCode) {
      // Host state
      hostToken = savedHostToken;
      gameCode = savedHostGameCode;
      isHost = true;

      // Update URL with token
      const url = new URL(window.location);
      url.searchParams.set("hostToken", savedHostToken);
      url.searchParams.set("gameCode", savedHostGameCode);
      window.history.replaceState({}, "", url);
    } else if (savedToken && savedGameCode) {
      // Guest state
      guestToken = savedToken;
      gameCode = savedGameCode;
      guestId = localStorage.getItem("guestId");
      guestName = localStorage.getItem("guestName");

      // Update URL with token
      const url = new URL(window.location);
      url.searchParams.set("token", savedToken);
      url.searchParams.set("gameCode", savedGameCode);
      window.history.replaceState({}, "", url);
    }
  }
});

function submitAnswer(answer, answerType) {
  ws.send(
    JSON.stringify({
      type: "guest-answer",
      answer: answer,
      answerType: answerType,
      questionId: currentQuestionId,
      gameCode: gameCode,
    })
  );
}

function updateGuestConnectionStatus(connected) {
  const statusEl = document.getElementById("guest-connection-status");
  if (statusEl) {
    const indicator = statusEl.querySelector(".status-indicator");
    const text = statusEl.querySelector("span:last-child");
    if (connected) {
      if (indicator) indicator.className = "status-indicator connected";
      if (text) text.textContent = "Connected";
    } else {
      if (indicator) indicator.className = "status-indicator disconnected";
      if (text) text.textContent = "Disconnected";
    }
  }
}

function joinGame(code) {
  const savedToken = localStorage.getItem("guestToken");
  const savedGuestId = localStorage.getItem("guestId");

  if (!ws || ws.readyState !== WebSocket.OPEN) {
    connectWebSocket();
    setTimeout(() => {
      if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(
          JSON.stringify({
            type: "guest-join",
            gameCode: code,
            guestId: savedGuestId,
            token: savedToken,
          })
        );
      } else {
        // Connection failed - redirect to landing
        redirectToLanding();
      }
    }, 100);
  } else {
    ws.send(
      JSON.stringify({
        type: "guest-join",
        gameCode: code,
        guestId: savedGuestId,
        token: savedToken,
      })
    );
  }
}

function redirectToLanding() {
  // Clear all saved state
  localStorage.removeItem("guestGameCode");
  localStorage.removeItem("guestId");
  localStorage.removeItem("guestToken");
  localStorage.removeItem("hostGameCode");
  localStorage.removeItem("hostToken");
  // Clear URL parameters
  window.history.replaceState({}, "", "/");
  // Reset state
  gameCode = null;
  guestId = null;
  guestToken = null;
  hostToken = null;
  isHost = false;
  // Show landing page
  showPage("landing-page");
}

function reconnectAsGuest() {
  const savedToken = localStorage.getItem("guestToken");
  const savedGameCode = localStorage.getItem("guestGameCode");
  const savedGuestId = localStorage.getItem("guestId");
  const savedName = localStorage.getItem("guestName");

  if (savedToken && savedGameCode) {
    connectWebSocket();
    setTimeout(() => {
      if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(
          JSON.stringify({
            type: "guest-join",
            gameCode: savedGameCode,
            guestId: savedGuestId,
            token: savedToken,
          })
        );
      } else {
        // Connection failed - redirect to landing
        redirectToLanding();
      }
    }, 100);
  } else {
    // No saved state - redirect to landing
    redirectToLanding();
  }
}

function createOrReconnectHost() {
  const savedHostToken = localStorage.getItem("hostToken");
  const savedGameCode = localStorage.getItem("hostGameCode");

  if (!ws || ws.readyState !== WebSocket.OPEN) {
    connectWebSocket();
    setTimeout(() => {
      if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(
          JSON.stringify({
            type: "host-create",
            token: savedHostToken,
            gameCode: savedGameCode,
          })
        );
      } else {
        // Connection failed - redirect to landing
        redirectToLanding();
      }
    }, 100);
  } else {
    ws.send(
      JSON.stringify({
        type: "host-create",
        token: savedHostToken,
        gameCode: savedGameCode,
      })
    );
  }
}
