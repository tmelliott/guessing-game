"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter, useParams, useSearchParams } from "next/navigation";
import { io, Socket } from "socket.io-client";
import Image from "next/image";

interface Player {
  name: string;
  hasAnswered?: boolean;
}

interface Photo {
  url: string;
  name: string;
}

export default function HostPage() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const code = (params.code as string)?.toUpperCase() || "";
  const token = searchParams.get("token") || "";
  const socketRef = useRef<Socket | null>(null);

  const [topic, setTopic] = useState<string>("");
  const [playerCount, setPlayerCount] = useState(0);
  const [photoCount, setPhotoCount] = useState(0);
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [connected, setConnected] = useState(false);
  const [loading, setLoading] = useState(true);
  const [shareLink, setShareLink] = useState("");

  // Game state
  const [currentQuestion, setCurrentQuestion] = useState<{
    photoUrl: string;
    photoIndex: number;
    totalPhotos: number;
  } | null>(null);
  const [answerStatus, setAnswerStatus] = useState<{
    total: number;
    answered: number;
    waitingFor: string[];
  } | null>(null);
  const [revealed, setRevealed] = useState(false);
  const [correctAnswer, setCorrectAnswer] = useState<string>("");
  const [allAnswers, setAllAnswers] = useState<Array<{ name: string; answer: string }>>([]);

  useEffect(() => {
    if (code && token) {
      setShareLink(`${window.location.origin}/join/${code}`);

      // Connect to WebSocket server
      const socket = io(window.location.origin, {
        transports: ['websocket', 'polling'],
      });

      socketRef.current = socket;

      socket.on("connect", () => {
        console.log("Connected to server");
        socket.emit("host:join", { code, token });
      });

      socket.on("host:joined", (data) => {
        setTopic(data.topic);
        setPlayerCount(data.playerCount);
        setPhotoCount(data.photoCount);
        setConnected(true);
        setLoading(false);
      });

      socket.on("game:update", (data) => {
        setPlayerCount(data.playerCount);
        setPhotoCount(data.photoCount);
      });

      socket.on("player:connected", (data) => {
        setPlayerCount(data.playerCount);
        setPhotoCount(data.photoCount);
      });

      socket.on("photo:uploaded", (data) => {
        setPhotoCount(data.photoCount);
        // Refresh photos list - in a real app you'd fetch this from the server
        fetchPhotos();
      });

      socket.on("question:started", (data) => {
        setCurrentQuestion({
          photoUrl: data.photoUrl,
          photoIndex: data.photoIndex,
          totalPhotos: data.totalPhotos,
        });
        setRevealed(false);
        setAnswerStatus(null);
        setCorrectAnswer("");
        setAllAnswers([]);
      });

      socket.on("answer:status", (status) => {
        setAnswerStatus(status);
      });

      socket.on("answer:revealed", (data) => {
        setRevealed(true);
        setCorrectAnswer(data.correctAnswer);
        setAllAnswers(data.answers);
      });

      socket.on("error", (data) => {
        console.error("Socket error:", data.message);
        alert(data.message || "An error occurred");
      });

      socket.on("disconnect", () => {
        setConnected(false);
      });

      return () => {
        socket.disconnect();
      };
    }
  }, [code, token]);

  const fetchPhotos = async () => {
    try {
      // In a real implementation, you'd fetch photos from the server
      // For now, we'll rely on WebSocket updates
    } catch (error) {
      console.error("Error fetching photos:", error);
    }
  };

  const handleStartQuestion = (photoIndex: number) => {
    if (!socketRef.current) return;
    socketRef.current.emit("host:start-question", { code, photoIndex });
  };

  const handleReveal = () => {
    if (!socketRef.current) return;
    socketRef.current.emit("host:reveal", { code });
  };

  const handleNextQuestion = () => {
    if (!currentQuestion) return;
    const nextIndex = currentQuestion.photoIndex + 1;
    if (nextIndex >= photoCount) {
      // Game finished
      alert("All photos have been shown!");
      return;
    }
    handleStartQuestion(nextIndex);
  };

  const handleRequestStatus = () => {
    if (!socketRef.current) return;
    socketRef.current.emit("host:get-status", { code });
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <p className="text-white text-3xl font-bold">Loading...</p>
      </div>
    );
  }

  if (!connected) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center p-4">
        <div className="max-w-2xl w-full text-center">
          <h1 className="text-5xl font-bold text-white mb-6">Connection Failed</h1>
          <div className="bg-gray-800 border-2 border-red-600 rounded-xl p-8">
            <p className="text-gray-300 text-xl mb-8 font-semibold">
              Unable to connect to the game server. Please check your connection.
            </p>
            <button
              onClick={() => router.push("/")}
              className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-4 px-10 rounded-lg text-xl transition-colors cursor-pointer"
            >
              Go Home
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-900 flex items-center justify-center p-4">
      <div className="max-w-4xl w-full">
        <h1 className="text-4xl font-bold text-white mb-3 text-center">
          {topic || "Photo Guessing Game"}
        </h1>
        <p className="text-gray-300 text-xl mb-2 text-center font-semibold">
          Host View - Join Code: <span className="font-mono tracking-widest text-blue-400">{code}</span>
        </p>

        <div className="bg-gray-800 border-2 border-blue-600 rounded-xl p-6 mb-6">
          <p className="text-white font-bold text-lg mb-2">Share this link with players:</p>
          <div className="flex gap-2">
            <input
              type="text"
              value={shareLink}
              readOnly
              className="flex-1 px-4 py-2 bg-gray-900 border-2 border-gray-600 rounded-lg text-white text-sm font-mono"
            />
            <button
              onClick={() => {
                navigator.clipboard.writeText(shareLink);
                alert("Link copied to clipboard!");
              }}
              className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded-lg transition-colors cursor-pointer"
            >
              Copy
            </button>
          </div>
        </div>

        <div className="text-center mb-6">
          <p className="text-white text-xl font-bold">
            {playerCount} player{playerCount !== 1 ? "s" : ""} connected • {photoCount} photo{photoCount !== 1 ? "s" : ""} uploaded
          </p>
        </div>

        {!currentQuestion ? (
          <div className="bg-gray-800 border-2 border-gray-700 rounded-xl p-8">
            <h2 className="text-2xl font-bold text-white mb-4">Ready to Start</h2>
            <p className="text-gray-300 mb-6">
              {photoCount === 0
                ? "Waiting for players to upload photos..."
                : photoCount > 0
                ? "Click below to start the first question!"
                : ""}
            </p>
            {photoCount > 0 && (
              <button
                onClick={() => handleStartQuestion(0)}
                className="w-full bg-green-600 hover:bg-green-700 text-white font-bold py-4 px-6 rounded-lg text-xl transition-colors cursor-pointer"
              >
                Start First Question
              </button>
            )}
          </div>
        ) : (
          <div className="bg-gray-800 border-2 border-gray-700 rounded-xl p-8">
            <div className="text-center mb-6">
              <h2 className="text-2xl font-bold text-white mb-2">
                Photo {currentQuestion.photoIndex + 1} of {currentQuestion.totalPhotos}
              </h2>
            </div>

            <div className="relative w-full aspect-square max-w-2xl mx-auto bg-gray-900 rounded-lg p-4 border-2 border-gray-600 mb-6">
              <Image
                src={currentQuestion.photoUrl}
                alt="Question photo"
                fill
                className="object-contain rounded-lg"
                unoptimized
              />
            </div>

            {!revealed ? (
              <>
                {answerStatus && (
                  <div className="text-center mb-6">
                    {answerStatus.answered === answerStatus.total ? (
                      <p className="text-green-400 text-xl font-bold mb-4">
                        All players have answered!
                      </p>
                    ) : (
                      <p className="text-yellow-400 text-xl font-bold mb-2">
                        Waiting on {answerStatus.total - answerStatus.answered} response{answerStatus.total - answerStatus.answered !== 1 ? "s" : ""}
                      </p>
                    )}
                    {answerStatus.waitingFor.length > 0 && (
                      <p className="text-gray-400 text-sm">
                        Waiting for: {answerStatus.waitingFor.join(", ")}
                      </p>
                    )}
                  </div>
                )}

                <div className="flex gap-4 justify-center">
                  {answerStatus && answerStatus.answered === answerStatus.total ? (
                    <button
                      onClick={handleReveal}
                      className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-4 px-10 rounded-lg text-xl transition-colors cursor-pointer"
                    >
                      Reveal Answer
                    </button>
                  ) : (
                    <>
                      <button
                        onClick={handleRequestStatus}
                        className="bg-gray-600 hover:bg-gray-700 text-white font-bold py-4 px-6 rounded-lg transition-colors cursor-pointer"
                      >
                        Check Status
                      </button>
                      {answerStatus && (
                        <p className="text-white text-lg self-center">
                          {answerStatus.answered} / {answerStatus.total} answered
                        </p>
                      )}
                    </>
                  )}
                </div>
              </>
            ) : (
              <div className="space-y-6">
                <div className="text-center">
                  <p className="text-3xl font-bold text-white mb-2">It&apos;s</p>
                  <p className="text-5xl font-bold text-white">{correctAnswer}!</p>
                </div>

                {allAnswers.length > 0 && (
                  <div className="bg-gray-900 rounded-lg p-4">
                    <h3 className="text-xl font-bold text-white mb-3">Answers:</h3>
                    <ul className="space-y-2">
                      {allAnswers.map((item, idx) => (
                        <li key={idx} className="text-gray-300">
                          <span className="font-bold">{item.name}:</span> {item.answer}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                <div className="flex gap-4 justify-center">
                  {currentQuestion.photoIndex + 1 < currentQuestion.totalPhotos ? (
                    <button
                      onClick={handleNextQuestion}
                      className="bg-green-600 hover:bg-green-700 text-white font-bold py-4 px-10 rounded-lg text-xl transition-colors cursor-pointer"
                    >
                      Next Question
                    </button>
                  ) : (
                    <button
                      onClick={() => {
                        alert("Game finished! All photos have been shown.");
                        setCurrentQuestion(null);
                      }}
                      className="bg-green-600 hover:bg-green-700 text-white font-bold py-4 px-10 rounded-lg text-xl transition-colors cursor-pointer"
                    >
                      Finish Game
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        <div className="mt-6 bg-gray-800 border-2 border-gray-700 rounded-xl p-4">
          <button
            onClick={() => router.push("/")}
            className="w-full bg-gray-700 hover:bg-gray-600 text-white font-bold py-3 px-6 rounded-lg transition-colors cursor-pointer"
          >
            Back to Home
          </button>
        </div>
      </div>
    </div>
  );
}
