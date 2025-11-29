"use client";

import { useState, FormEvent, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";

export default function JoinPage() {
  const params = useParams();
  const router = useRouter();
  const code = (params.code as string)?.toUpperCase() || "";

  const [name, setName] = useState("");
  const [photo, setPhoto] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);
  const [photoCount, setPhotoCount] = useState(0);
  const [topic, setTopic] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [shareLink, setShareLink] = useState("");

  useEffect(() => {
    if (code) {
      setShareLink(`${window.location.origin}/join/${code}`);
      fetchGameInfo();

      // Set up Server-Sent Events for real-time updates
      const eventSource = new EventSource(
        `/api/game-status-stream?code=${encodeURIComponent(code)}`
      );

      eventSource.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.error) {
            console.error("SSE error:", data.error);
          } else {
            setPhotoCount(data.photoCount || 0);
            if (data.topic) {
              setTopic(data.topic);
            }
          }
        } catch (error) {
          console.error("Error parsing SSE message:", error);
        }
      };

      eventSource.onerror = (error) => {
        console.error("SSE connection error:", error);
        eventSource.close();
      };

      return () => {
        eventSource.close();
      };
    }
  }, [code]);

  const fetchGameInfo = async () => {
    try {
      const response = await fetch(`/api/game-status?code=${encodeURIComponent(code)}`);
      const data = await response.json();

      if (response.ok) {
        setTopic(data.topic || "Photo Guessing Game");
        setPhotoCount(data.photoCount || 0);
      } else {
        setMessage({ type: "error", text: data.error || "Invalid game code" });
      }
    } catch (error) {
      console.error("Error fetching game info:", error);
      setMessage({ type: "error", text: "Failed to load game information" });
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();

    if (!name.trim() || !photo) {
      setMessage({
        type: "error",
        text: "Please enter your name and select a photo",
      });
      return;
    }

    setUploading(true);
    setMessage(null);

    try {
      const formData = new FormData();
      formData.append("name", name.trim());
      formData.append("photo", photo);
      formData.append("code", code);

      const response = await fetch("/api/upload", {
        method: "POST",
        body: formData,
      });

      const data = await response.json();

      if (response.ok) {
        setMessage({ type: "success", text: "Photo uploaded successfully!" });
        setName("");
        setPhoto(null);
        // Reset file input
        const fileInput = document.getElementById(
          "photo-input"
        ) as HTMLInputElement;
        if (fileInput) fileInput.value = "";
        // Photo count will update automatically via SSE
      } else {
        setMessage({
          type: "error",
          text: data.error || "Failed to upload photo",
        });
      }
    } catch {
      setMessage({ type: "error", text: "An error occurred while uploading" });
    } finally {
      setUploading(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setPhoto(e.target.files[0]);
    }
  };

  const copyShareLink = () => {
    navigator.clipboard.writeText(shareLink);
    setMessage({ type: "success", text: "Share link copied to clipboard!" });
    setTimeout(() => setMessage(null), 2000);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <p className="text-white text-3xl font-bold">Loading...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-900 flex items-center justify-center p-4">
      <div className="max-w-2xl w-full">
        <h1 className="text-5xl font-bold text-white mb-3 text-center">
          {topic || "Photo Guessing Game"}
        </h1>
        <p className="text-gray-300 text-xl mb-2 text-center font-semibold">
          Join Code: <span className="font-mono tracking-widest text-blue-400">{code}</span>
        </p>

        <div className="bg-gray-800 border-2 border-blue-600 rounded-xl p-6 mb-6">
          <p className="text-white font-bold text-lg mb-2">Share this link:</p>
          <div className="flex gap-2">
            <input
              type="text"
              value={shareLink}
              readOnly
              className="flex-1 px-4 py-2 bg-gray-900 border-2 border-gray-600 rounded-lg text-white text-sm font-mono"
            />
            <button
              onClick={copyShareLink}
              className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded-lg transition-colors cursor-pointer"
            >
              Copy
            </button>
          </div>
        </div>

        <div className="text-center mb-8">
          <p className="text-white text-2xl font-bold">
            {photoCount === 0
              ? "No photos uploaded yet"
              : `${photoCount} photo${photoCount === 1 ? "" : "s"} uploaded`}
          </p>
        </div>

        <div className="bg-gray-800 border-2 border-gray-700 rounded-xl p-8">
          <form onSubmit={handleSubmit} className="space-y-6">
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
                className="w-full px-5 py-3 bg-gray-900 border-2 border-gray-600 rounded-lg text-white text-lg focus:outline-none focus:border-blue-500"
                placeholder="Enter your name"
                disabled={uploading}
              />
            </div>

            <div>
              <label
                htmlFor="photo-input"
                className="block text-white font-bold text-lg mb-3"
              >
                Photo
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
              disabled={uploading}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-4 px-6 rounded-lg text-xl transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
            >
              {uploading ? "Uploading..." : "Upload Photo"}
            </button>
          </form>

          <div className="mt-8 pt-8 border-t border-gray-700 space-y-4">
            <button
              onClick={() => router.push(`/game/${code}`)}
              className="w-full bg-green-600 hover:bg-green-700 text-white font-bold py-4 px-6 rounded-lg transition-colors cursor-pointer"
            >
              Go to Game
            </button>
            <button
              onClick={() => router.push("/")}
              className="w-full bg-gray-700 hover:bg-gray-600 text-white font-bold py-3 px-6 rounded-lg transition-colors cursor-pointer"
            >
              Back to Home
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
