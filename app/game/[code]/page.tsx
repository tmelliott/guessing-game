"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter, useParams } from "next/navigation";
import Image from "next/image";

interface GameStatus {
  started: boolean;
  photoCount: number;
  topic?: string;
}

interface CurrentPhoto {
  url: string;
  index: number;
  total: number;
}

export default function GamePage() {
  const params = useParams();
  const router = useRouter();
  const code = (params.code as string)?.toUpperCase() || "";

  const [gameStatus, setGameStatus] = useState<GameStatus>({
    started: false,
    photoCount: 0,
  });
  const [currentPhoto, setCurrentPhoto] = useState<CurrentPhoto | null>(null);
  const [revealedName, setRevealedName] = useState<string | null>(null);
  const [finished, setFinished] = useState(false);
  const [loading, setLoading] = useState(true);

  const checkGameStatus = useCallback(async () => {
    if (!code) return;

    try {
      const response = await fetch(`/api/game-status?code=${encodeURIComponent(code)}`);
      const data = await response.json();

      if (response.ok) {
        setGameStatus(data);
      } else {
        console.error("Error checking game status:", data.error);
      }
      setLoading(false);
    } catch (error) {
      console.error("Error checking game status:", error);
      setLoading(false);
    }
  }, [code]);

  const loadCurrentPhoto = useCallback(async () => {
    if (!code) return;

    try {
      const response = await fetch(`/api/current-photo?code=${encodeURIComponent(code)}`);
      const data = await response.json();

      if (data.finished) {
        setFinished(true);
        setCurrentPhoto(null);
      } else if (data.error) {
        console.error("Error loading photo:", data.error);
      } else {
        setCurrentPhoto(data);
        setRevealedName(null);
      }
    } catch (error) {
      console.error("Error loading current photo:", error);
    }
  }, [code]);

  useEffect(() => {
    if (code) {
      checkGameStatus();
    }
  }, [code, checkGameStatus]);

  useEffect(() => {
    if (gameStatus.started && !finished && code) {
      loadCurrentPhoto();
    }
  }, [gameStatus.started, finished, code, loadCurrentPhoto]);

  const handleStartGame = async () => {
    if (!code) return;

    try {
      const response = await fetch("/api/start-game", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ code }),
      });
      const data = await response.json();

      if (response.ok) {
        setGameStatus({ ...gameStatus, started: true });
        await loadCurrentPhoto();
      } else {
        alert(data.error || "Failed to start game");
      }
    } catch (error) {
      console.error("Error starting game:", error);
      alert("Failed to start game");
    }
  };

  const handleReveal = async () => {
    if (!code) return;

    try {
      const response = await fetch(`/api/reveal?code=${encodeURIComponent(code)}`);
      const data = await response.json();

      if (data.error) {
        console.error("Error revealing name:", data.error);
      } else if (data.finished) {
        setFinished(true);
      } else {
        setRevealedName(data.name);
      }
    } catch (error) {
      console.error("Error revealing name:", error);
    }
  };

  const handleNext = async () => {
    if (!code) return;

    try {
      const response = await fetch("/api/next", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ code }),
      });
      const data = await response.json();

      if (data.finished) {
        setFinished(true);
        setCurrentPhoto(null);
      } else {
        await loadCurrentPhoto();
      }
    } catch (error) {
      console.error("Error moving to next photo:", error);
    }
  };

  const handleReset = async () => {
    if (!code) return;

    try {
      // Reset state first
      setFinished(false);
      setCurrentPhoto(null);
      setRevealedName(null);

      // Start a fresh game with new shuffle
      const response = await fetch("/api/start-game", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ code }),
      });
      const data = await response.json();

      if (response.ok) {
        setGameStatus({ ...gameStatus, started: true });
        await loadCurrentPhoto();
      } else {
        alert(data.error || "Failed to restart game");
      }
    } catch (error) {
      console.error("Error resetting game:", error);
      alert("Failed to restart game");
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <p className="text-white text-3xl font-bold">Loading...</p>
      </div>
    );
  }

  if (!code) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="max-w-2xl w-full text-center">
          <h1 className="text-5xl font-bold text-white mb-6">Invalid Game Code</h1>
          <button
            onClick={() => router.push("/")}
            className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-4 px-10 rounded-lg text-xl transition-colors cursor-pointer"
          >
            Go Home
          </button>
        </div>
      </div>
    );
  }

  if (!gameStatus.started && !finished) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center p-4">
        <div className="max-w-2xl w-full text-center">
          <h1 className="text-5xl font-bold text-white mb-6">
            {gameStatus.topic || "Photo Guessing Game"}
          </h1>
          <div className="bg-gray-800 border-2 border-gray-700 rounded-xl p-8">
            <p className="text-gray-300 text-xl mb-8 font-semibold">
              {gameStatus.photoCount === 0
                ? "No photos uploaded yet. Go back to upload photos."
                : `${gameStatus.photoCount} photo${
                    gameStatus.photoCount === 1 ? "" : "s"
                  } ready. Click below to start the game!`}
            </p>

            {gameStatus.photoCount > 0 && (
              <button
                onClick={handleStartGame}
                className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-4 px-10 rounded-lg text-xl transition-colors cursor-pointer"
              >
                Start Game
              </button>
            )}

            <button
              onClick={() => router.push(`/join/${code}`)}
              className="mt-6 block w-full bg-gray-700 hover:bg-gray-600 text-white font-bold py-4 px-6 rounded-lg transition-colors cursor-pointer"
            >
              Back to Upload
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (finished) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center p-4">
        <div className="max-w-2xl w-full text-center">
          <h1 className="text-5xl font-bold text-white mb-6">Game Finished!</h1>
          <div className="bg-gray-800 border-2 border-gray-700 rounded-xl p-8">
            <p className="text-gray-300 text-2xl mb-8 font-semibold">
              All photos have been shown. Great game!
            </p>
            <button
              onClick={handleReset}
              className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-4 px-10 rounded-lg text-xl transition-colors cursor-pointer"
            >
              Play Again
            </button>
            <button
              onClick={() => router.push(`/join/${code}`)}
              className="mt-6 block w-full bg-gray-700 hover:bg-gray-600 text-white font-bold py-4 px-6 rounded-lg transition-colors cursor-pointer"
            >
              Back to Upload
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-900 flex items-center justify-center p-4">
      <div className="max-w-4xl w-full">
        <div className="text-center mb-6">
          <h1 className="text-4xl font-bold text-white mb-2">
            Photo #{currentPhoto?.index || 0} of {currentPhoto?.total || 0}
          </h1>
        </div>

        <div className="bg-gray-800 border-2 border-gray-700 rounded-xl p-8">
          {currentPhoto && (
            <div className="space-y-6">
              <div className="relative w-full aspect-square max-w-2xl mx-auto bg-gray-900 rounded-lg p-4 border-2 border-gray-600">
                <Image
                  src={currentPhoto.url}
                  alt="Photo"
                  fill
                  className="object-contain rounded-lg"
                  unoptimized
                  priority
                />
              </div>

              <div className="text-center min-h-[120px] flex flex-col justify-center">
                {revealedName ? (
                  <>
                    <p className="text-3xl font-bold text-white mb-3">
                      It&apos;s
                    </p>
                    <p className="text-5xl font-bold text-white">
                      {revealedName}!
                    </p>
                  </>
                ) : (
                  <div className="h-[120px]" />
                )}
              </div>

              <div className="flex gap-4 justify-center">
                {!revealedName ? (
                  <button
                    onClick={handleReveal}
                    className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-4 px-10 rounded-lg text-xl transition-colors cursor-pointer"
                  >
                    Reveal Name
                  </button>
                ) : (
                  <button
                    onClick={handleNext}
                    className="bg-green-600 hover:bg-green-700 text-white font-bold py-4 px-10 rounded-lg text-xl transition-colors cursor-pointer"
                  >
                    Next Photo
                  </button>
                )}
              </div>
            </div>
          )}

          <div className="mt-8 pt-8 border-t border-gray-700">
            <button
              onClick={() => router.push(`/join/${code}`)}
              className="w-full bg-gray-700 hover:bg-gray-600 text-white font-bold py-4 px-6 rounded-lg transition-colors cursor-pointer"
            >
              Back to Upload
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
