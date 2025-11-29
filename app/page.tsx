"use client";

import { useState, FormEvent } from "react";
import { useRouter } from "next/navigation";

export default function Home() {
  const [mode, setMode] = useState<"select" | "host" | "join">("select");
  const [topic, setTopic] = useState("");
  const [joinCode, setJoinCode] = useState("");
  const [creating, setCreating] = useState(false);
  const [joining, setJoining] = useState(false);
  const [message, setMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);
  const router = useRouter();

  const handleCreateGame = async (e: FormEvent) => {
    e.preventDefault();

    if (!topic.trim()) {
      setMessage({
        type: "error",
        text: "Please enter a topic for the game",
      });
      return;
    }

    setCreating(true);
    setMessage(null);

    try {
      const response = await fetch("/api/create-game", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ topic: topic.trim() }),
      });

      const data = await response.json();

      if (response.ok) {
        // Navigate to join page with the code
        router.push(`/join/${data.code}`);
      } else {
        setMessage({
          type: "error",
          text: data.error || "Failed to create game",
        });
      }
    } catch {
      setMessage({ type: "error", text: "An error occurred while creating the game" });
    } finally {
      setCreating(false);
    }
  };

  const handleJoin = async (e: FormEvent) => {
    e.preventDefault();

    if (!joinCode.trim()) {
      setMessage({
        type: "error",
        text: "Please enter a join code",
      });
      return;
    }

    setJoining(true);
    setMessage(null);

    try {
      // Verify the game exists
      const response = await fetch(`/api/game-status?code=${encodeURIComponent(joinCode.trim().toUpperCase())}`);
      const data = await response.json();

      if (response.ok) {
        // Navigate to join page
        router.push(`/join/${joinCode.trim().toUpperCase()}`);
      } else {
        setMessage({
          type: "error",
          text: data.error || "Invalid join code",
        });
      }
    } catch {
      setMessage({ type: "error", text: "An error occurred while joining" });
    } finally {
      setJoining(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-900 flex items-center justify-center p-4">
      <div className="max-w-2xl w-full">
        <h1 className="text-5xl font-bold text-white mb-3 text-center">
          Photo Guessing Game
        </h1>
        <p className="text-gray-300 text-xl mb-8 text-center font-semibold">
          Host or join a game
        </p>

        {mode === "select" && (
          <div className="bg-gray-800 border-2 border-gray-700 rounded-xl p-8 space-y-4">
            <button
              onClick={() => setMode("host")}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-4 px-6 rounded-lg text-xl transition-colors cursor-pointer"
            >
              Host a Game
            </button>
            <button
              onClick={() => setMode("join")}
              className="w-full bg-green-600 hover:bg-green-700 text-white font-bold py-4 px-6 rounded-lg text-xl transition-colors cursor-pointer"
            >
              Join with Code
            </button>
          </div>
        )}

        {mode === "host" && (
          <div className="bg-gray-800 border-2 border-gray-700 rounded-xl p-8">
            <button
              onClick={() => {
                setMode("select");
                setTopic("");
                setMessage(null);
              }}
              className="mb-4 text-gray-400 hover:text-white transition-colors cursor-pointer"
            >
              ← Back
            </button>
            <form onSubmit={handleCreateGame} className="space-y-6">
              <div>
                <label
                  htmlFor="topic"
                  className="block text-white font-bold text-lg mb-3"
                >
                  Game Topic
                </label>
                <input
                  type="text"
                  id="topic"
                  value={topic}
                  onChange={(e) => setTopic(e.target.value)}
                  className="w-full px-5 py-3 bg-gray-900 border-2 border-gray-600 rounded-lg text-white text-lg focus:outline-none focus:border-blue-500"
                  placeholder="e.g., baby photos, vacation memories"
                  disabled={creating}
                  autoFocus
                />
                <p className="text-gray-400 text-sm mt-2">
                  This topic will be shown to players when they join
                </p>
              </div>

              {message && (
                <div
                  className={`p-5 rounded-lg text-lg font-semibold border-2 ${
                    message.type === "success"
                      ? "bg-green-900 text-green-200 border-green-600"
                      : "bg-red-900 text-red-200 border-red-600"
                  }`}
                >
                  {message.text}
                </div>
              )}

              <button
                type="submit"
                disabled={creating}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-4 px-6 rounded-lg text-xl transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
              >
                {creating ? "Creating..." : "Create Game"}
              </button>
            </form>
          </div>
        )}

        {mode === "join" && (
          <div className="bg-gray-800 border-2 border-gray-700 rounded-xl p-8">
            <button
              onClick={() => {
                setMode("select");
                setJoinCode("");
                setMessage(null);
              }}
              className="mb-4 text-gray-400 hover:text-white transition-colors cursor-pointer"
            >
              ← Back
            </button>
            <form onSubmit={handleJoin} className="space-y-6">
              <div>
                <label
                  htmlFor="join-code"
                  className="block text-white font-bold text-lg mb-3"
                >
                  Join Code
                </label>
                <input
                  type="text"
                  id="join-code"
                  value={joinCode}
                  onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                  className="w-full px-5 py-3 bg-gray-900 border-2 border-gray-600 rounded-lg text-white text-lg focus:outline-none focus:border-green-500 text-center tracking-widest font-mono"
                  placeholder="ABCDEF"
                  maxLength={6}
                  disabled={joining}
                  autoFocus
                />
                <p className="text-gray-400 text-sm mt-2 text-center">
                  Enter the 6-letter code shared by the host
                </p>
              </div>

              {message && (
                <div
                  className={`p-5 rounded-lg text-lg font-semibold border-2 ${
                    message.type === "success"
                      ? "bg-green-900 text-green-200 border-green-600"
                      : "bg-red-900 text-red-200 border-red-600"
                  }`}
                >
                  {message.text}
                </div>
              )}

              <button
                type="submit"
                disabled={joining}
                className="w-full bg-green-600 hover:bg-green-700 text-white font-bold py-4 px-6 rounded-lg text-xl transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
              >
                {joining ? "Joining..." : "Join Game"}
              </button>
            </form>
          </div>
        )}
      </div>
    </div>
  );
}
