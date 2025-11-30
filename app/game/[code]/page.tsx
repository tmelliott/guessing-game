"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter, useParams, useSearchParams } from "next/navigation";
import { io, Socket } from "socket.io-client";
import Image from "next/image";

export default function GamePage() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const code = (params.code as string)?.toUpperCase() || "";
  const token = searchParams.get("token") || "";
  const socketRef = useRef<Socket | null>(null);

  const [topic, setTopic] = useState<string>("");
  const [playerName, setPlayerName] = useState<string>("");
  const [connected, setConnected] = useState(false);
  const [loading, setLoading] = useState(true);
  const [playerToken, setPlayerToken] = useState<string>(token || "");

  // Photo upload state
  const [name, setName] = useState("");
  const [photoName, setPhotoName] = useState(""); // Name of person in photo
  const [photo, setPhoto] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [photoUploaded, setPhotoUploaded] = useState(false);

  // Game state
  const [currentQuestion, setCurrentQuestion] = useState<{
    photoUrl: string;
    photoIndex: number;
    totalPhotos: number;
  } | null>(null);
  const [myAnswer, setMyAnswer] = useState("");
  const [answerSubmitted, setAnswerSubmitted] = useState(false);
  const [revealed, setRevealed] = useState(false);
  const [correctAnswer, setCorrectAnswer] = useState<string>("");
  const [allAnswers, setAllAnswers] = useState<Array<{ name: string; answer: string }>>([]);

  useEffect(() => {
    if (!code) {
      setLoading(false);
      return;
    }

    // Get or generate token from URL
    const urlToken = searchParams.get("token");
    if (urlToken) {
      setPlayerToken(urlToken);
    }

    // Connect to WebSocket server
    const socket = io(window.location.origin, {
      transports: ['websocket', 'polling'],
    });

    socketRef.current = socket;

    socket.on("connect", () => {
      console.log("Connected to server");
      // If we have a token and name, reconnect as existing player
      if (urlToken && playerName) {
        socket.emit("player:join", { code, token: urlToken, name: playerName });
      }
    });

    socket.on("player:joined", (data) => {
      setPlayerToken(data.token);
      setPlayerName(data.name);
      setTopic(data.topic);
      setConnected(true);
      setLoading(false);

      // Update URL with token for reconnection
      if (data.token && data.token !== urlToken) {
        const newUrl = new URL(window.location.href);
        newUrl.searchParams.set("token", data.token);
        window.history.replaceState({}, "", newUrl.toString());
      }
    });

    socket.on("question:started", (data) => {
      setCurrentQuestion({
        photoUrl: data.photoUrl,
        photoIndex: data.photoIndex,
        totalPhotos: data.totalPhotos,
      });
      setMyAnswer("");
      setAnswerSubmitted(false);
      setRevealed(false);
      setCorrectAnswer("");
      setAllAnswers([]);
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
  }, [code, searchParams]);

  const handleJoinGame = () => {
    if (!name.trim() || !socketRef.current) return;

    socketRef.current.emit("player:join", {
      code,
      token: playerToken || undefined,
      name: name.trim(),
    });
    setPlayerName(name.trim());
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setPhoto(e.target.files[0]);
    }
  };

  const handleUploadPhoto = async () => {
    if (!photoName.trim() || !photo || !code || !socketRef.current || !playerToken) return;

    setUploading(true);

    try {
      // Upload via API route (which handles blob storage if available)
      const formData = new FormData();
      formData.append("photo", photo);
      formData.append("name", photoName.trim()); // Name of person in photo
      formData.append("code", code);
      formData.append("token", playerToken);

      const response = await fetch("/api/upload", {
        method: "POST",
        body: formData,
      });

      const data = await response.json();

      if (response.ok) {
        // Notify server via WebSocket
        socketRef.current?.emit("player:upload-photo", {
          code,
          token: playerToken,
          url: data.url,
          name: photoName.trim(),
        });

        setPhotoUploaded(true);
        setUploading(false);
      } else {
        alert(data.error || "Failed to upload photo");
        setUploading(false);
      }
    } catch (error) {
      console.error("Upload error:", error);
      alert("Failed to upload photo");
      setUploading(false);
    }
  };

  const handleSubmitAnswer = () => {
    if (!myAnswer.trim() || !socketRef.current || !playerToken) return;

    socketRef.current.emit("player:submit-answer", {
      code,
      token: playerToken,
      answer: myAnswer.trim(),
    });

    setAnswerSubmitted(true);
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

  // Not connected yet - join form
  if (!connected || !playerName) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center p-4">
        <div className="max-w-2xl w-full">
          <h1 className="text-5xl font-bold text-white mb-3 text-center">
            {topic || "Photo Guessing Game"}
          </h1>
          <p className="text-gray-300 text-xl mb-2 text-center font-semibold">
            Join Code: <span className="font-mono tracking-widest text-blue-400">{code}</span>
          </p>

          <div className="bg-gray-800 border-2 border-gray-700 rounded-xl p-8">
            <div className="space-y-6">
              <div>
                <label
                  htmlFor="name"
                  className="block text-white font-bold text-lg mb-3"
                >
                  Your Name
                </label>
                <input
                  type="text"
                  id="name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && name.trim()) {
                      handleJoinGame();
                    }
                  }}
                  className="w-full px-5 py-3 bg-gray-900 border-2 border-gray-600 rounded-lg text-white text-lg focus:outline-none focus:border-blue-500"
                  placeholder="Enter your name"
                  autoFocus
                />
              </div>

              <button
                onClick={handleJoinGame}
                disabled={!name.trim()}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-4 px-6 rounded-lg text-xl transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
              >
                Join Game
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Connected but no photo uploaded
  if (!photoUploaded) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center p-4">
        <div className="max-w-2xl w-full">
          <h1 className="text-4xl font-bold text-white mb-3 text-center">
            {topic || "Photo Guessing Game"}
          </h1>
          <p className="text-gray-300 text-xl mb-2 text-center font-semibold">
            Welcome, {playerName}!
          </p>

          <div className="bg-gray-800 border-2 border-gray-700 rounded-xl p-8">
            <form onSubmit={(e) => { e.preventDefault(); handleUploadPhoto(); }} className="space-y-6">
              <div>
                <label
                  htmlFor="photo-name"
                  className="block text-white font-bold text-lg mb-3"
                >
                  Name of Person in Photo
                </label>
                <input
                  type="text"
                  id="photo-name"
                  value={photoName}
                  onChange={(e) => setPhotoName(e.target.value)}
                  className="w-full px-5 py-3 bg-gray-900 border-2 border-gray-600 rounded-lg text-white text-lg focus:outline-none focus:border-blue-500"
                  placeholder="Enter the name of the person in the photo"
                  disabled={uploading}
                />
              </div>

              <div>
                <label
                  htmlFor="photo-input"
                  className="block text-white font-bold text-lg mb-3"
                >
                  Upload Photo
                </label>
                <input
                  type="file"
                  id="photo-input"
                  accept="image/*"
                  onChange={handleFileChange}
                  className="w-full px-5 py-3 bg-gray-900 border-2 border-gray-600 rounded-lg text-white text-lg file:mr-4 file:py-2 file:px-6 file:rounded-lg file:border-0 file:bg-blue-600 file:text-white file:font-bold file:cursor-pointer hover:file:bg-blue-700 focus:outline-none focus:border-blue-500"
                  disabled={uploading}
                />
                {photo && (
                  <p className="text-gray-300 text-base mt-3 font-semibold">
                    Selected: {photo.name}
                  </p>
                )}
              </div>

              <button
                type="submit"
                disabled={!photo || !photoName.trim() || uploading}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-4 px-6 rounded-lg text-xl transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
              >
                {uploading ? "Uploading..." : "Upload Photo"}
              </button>
            </form>
          </div>
        </div>
      </div>
    );
  }

  // Waiting for question
  if (!currentQuestion) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center p-4">
        <div className="max-w-2xl w-full text-center">
          <h1 className="text-4xl font-bold text-white mb-6">
            {topic || "Photo Guessing Game"}
          </h1>
          <div className="bg-gray-800 border-2 border-gray-700 rounded-xl p-8">
            <p className="text-gray-300 text-xl mb-8 font-semibold">
              Waiting for host to start a question...
            </p>
            <p className="text-gray-400 text-lg">
              Welcome, {playerName}! Your photo has been uploaded.
            </p>
          </div>
        </div>
      </div>
    );
  }

  // Question in progress
  return (
    <div className="min-h-screen bg-gray-900 flex items-center justify-center p-4">
      <div className="max-w-4xl w-full">
        <div className="text-center mb-6">
          <h1 className="text-3xl font-bold text-white mb-2">
            Photo {currentQuestion.photoIndex + 1} of {currentQuestion.totalPhotos}
          </h1>
          <p className="text-gray-300">Who is this?</p>
        </div>

        <div className="bg-gray-800 border-2 border-gray-700 rounded-xl p-8">
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
            <div className="space-y-6">
              {!answerSubmitted ? (
                <>
                  <div>
                    <label
                      htmlFor="answer"
                      className="block text-white font-bold text-lg mb-3"
                    >
                      Your Answer
                    </label>
                    <input
                      type="text"
                      id="answer"
                      value={myAnswer}
                      onChange={(e) => setMyAnswer(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && myAnswer.trim()) {
                          handleSubmitAnswer();
                        }
                      }}
                      className="w-full px-5 py-3 bg-gray-900 border-2 border-gray-600 rounded-lg text-white text-lg focus:outline-none focus:border-blue-500"
                      placeholder="Enter your guess"
                      autoFocus
                    />
                  </div>
                  <button
                    onClick={handleSubmitAnswer}
                    disabled={!myAnswer.trim()}
                    className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-4 px-6 rounded-lg text-xl transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                  >
                    Submit Answer
                  </button>
                </>
              ) : (
                <div className="text-center">
                  <p className="text-green-400 text-xl font-bold mb-4">
                    Answer submitted! Waiting for host to reveal...
                  </p>
                  <p className="text-gray-400 text-lg">
                    Your answer: <span className="font-bold text-white">{myAnswer}</span>
                  </p>
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-6">
              <div className="text-center">
                <p className="text-3xl font-bold text-white mb-2">It&apos;s</p>
                <p className="text-5xl font-bold text-white">{correctAnswer}!</p>
              </div>

              {allAnswers.length > 0 && (
                <div className="bg-gray-900 rounded-lg p-4">
                  <h3 className="text-xl font-bold text-white mb-3">All Answers:</h3>
                  <ul className="space-y-2">
                    {allAnswers.map((item, idx) => (
                      <li
                        key={idx}
                        className={`text-lg ${
                          item.name === playerName
                            ? "text-blue-400 font-bold"
                            : "text-gray-300"
                        }`}
                      >
                        <span className="font-bold">{item.name}:</span> {item.answer}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              <div className="text-center">
                <p className="text-gray-400 text-lg">
                  Waiting for next question...
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
